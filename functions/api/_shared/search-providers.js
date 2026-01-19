/**
 * Multi-Source Search Providers
 * Resilient search system using Tavily (primary) and Exa (fallback)
 *
 * Free Tier Limits:
 * - Tavily: 1,000 credits/month (basic=1, advanced=2)
 * - Exa: 1,000 credits total (doesn't reset)
 *
 * Strategy:
 * - Use Tavily for routine searches (monthly reset)
 * - Reserve Exa for high-value/fallback only
 * - Cache all results to avoid duplicate searches
 * - Track budget to stay within free tier
 */

// Budget configuration
const TAVILY_MONTHLY_BUDGET = 1000;
const TAVILY_DAILY_BUDGET = 30; // ~33/day, leave buffer
const EXA_TOTAL_BUDGET = 1000;
const EXA_RESERVE_THRESHOLD = 200; // Stop using Exa when below this

// Cache configuration
const CACHE_TTL_HOURS = 24;
const CACHE_PREFIX = 'search_cache:';
const BUDGET_PREFIX = 'search_budget:';

/**
 * Generate cache key from query parameters
 */
function generateCacheKey(query, options = {}) {
  const normalized = JSON.stringify({
    q: query.toLowerCase().trim(),
    domains: options.includeDomains?.sort() || [],
    topic: options.topic || 'general'
  });
  // Simple hash for cache key
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${CACHE_PREFIX}${Math.abs(hash).toString(36)}`;
}

/**
 * Get current budget status from KV
 */
async function getBudgetStatus(kv) {
  const now = new Date();
  const monthKey = `${BUDGET_PREFIX}tavily:${now.getFullYear()}-${now.getMonth() + 1}`;
  const dayKey = `${BUDGET_PREFIX}tavily:${now.toISOString().split('T')[0]}`;
  const exaKey = `${BUDGET_PREFIX}exa:total`;

  const [monthUsed, dayUsed, exaUsed] = await Promise.all([
    kv.get(monthKey).then(v => parseInt(v) || 0),
    kv.get(dayKey).then(v => parseInt(v) || 0),
    kv.get(exaKey).then(v => parseInt(v) || 0)
  ]);

  return {
    tavily: {
      monthUsed,
      monthRemaining: TAVILY_MONTHLY_BUDGET - monthUsed,
      dayUsed,
      dayRemaining: TAVILY_DAILY_BUDGET - dayUsed,
      canUse: dayUsed < TAVILY_DAILY_BUDGET && monthUsed < TAVILY_MONTHLY_BUDGET
    },
    exa: {
      totalUsed: exaUsed,
      remaining: EXA_TOTAL_BUDGET - exaUsed,
      canUse: (EXA_TOTAL_BUDGET - exaUsed) > EXA_RESERVE_THRESHOLD
    }
  };
}

/**
 * Increment budget usage
 */
async function incrementBudget(kv, provider, credits = 1) {
  const now = new Date();

  if (provider === 'tavily') {
    const monthKey = `${BUDGET_PREFIX}tavily:${now.getFullYear()}-${now.getMonth() + 1}`;
    const dayKey = `${BUDGET_PREFIX}tavily:${now.toISOString().split('T')[0]}`;

    const [monthUsed, dayUsed] = await Promise.all([
      kv.get(monthKey).then(v => parseInt(v) || 0),
      kv.get(dayKey).then(v => parseInt(v) || 0)
    ]);

    await Promise.all([
      kv.put(monthKey, String(monthUsed + credits), { expirationTtl: 35 * 24 * 60 * 60 }), // 35 days
      kv.put(dayKey, String(dayUsed + credits), { expirationTtl: 48 * 60 * 60 }) // 48 hours
    ]);
  } else if (provider === 'exa') {
    const exaKey = `${BUDGET_PREFIX}exa:total`;
    const exaUsed = await kv.get(exaKey).then(v => parseInt(v) || 0);
    await kv.put(exaKey, String(exaUsed + credits)); // No expiration - tracks total usage
  }
}

/**
 * Check and return cached results
 */
async function getCachedResults(kv, cacheKey) {
  try {
    const cached = await kv.get(cacheKey, { type: 'json' });
    if (cached && cached.timestamp) {
      const ageHours = (Date.now() - cached.timestamp) / (1000 * 60 * 60);
      if (ageHours < CACHE_TTL_HOURS) {
        return { ...cached, fromCache: true };
      }
    }
  } catch (e) {
    console.error('Cache read error:', e);
  }
  return null;
}

/**
 * Store results in cache
 */
async function cacheResults(kv, cacheKey, results, provider) {
  try {
    await kv.put(cacheKey, JSON.stringify({
      ...results,
      provider,
      timestamp: Date.now()
    }), { expirationTtl: CACHE_TTL_HOURS * 60 * 60 });
  } catch (e) {
    console.error('Cache write error:', e);
  }
}

/**
 * Search with Tavily API
 * Cost: 1 credit (basic) or 2 credits (advanced)
 */
async function searchTavily(query, apiKey, options = {}) {
  const {
    searchDepth = 'basic', // 1 credit
    maxResults = 5,
    topic = 'general',
    includeDomains = [],
    excludeDomains = [],
    includeAnswer = false
  } = options;

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      query,
      search_depth: searchDepth,
      max_results: maxResults,
      topic,
      include_domains: includeDomains.length > 0 ? includeDomains : undefined,
      exclude_domains: excludeDomains.length > 0 ? excludeDomains : undefined,
      include_answer: includeAnswer
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Tavily API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const credits = searchDepth === 'advanced' ? 2 : 1;

  return {
    provider: 'tavily',
    query,
    results: (data.results || []).map(r => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score
    })),
    answer: data.answer || null,
    credits,
    responseTime: data.response_time
  };
}

/**
 * Search with Exa API
 * Cost: ~1 credit per search (neural)
 */
async function searchExa(query, apiKey, options = {}) {
  const {
    type = 'auto', // auto, neural, fast
    numResults = 5,
    category = null,
    includeDomains = [],
    excludeDomains = [],
    includeText = true
  } = options;

  const body = {
    query,
    type,
    numResults,
    text: includeText
  };

  if (category) body.category = category;
  if (includeDomains.length > 0) body.includeDomains = includeDomains;
  if (excludeDomains.length > 0) body.excludeDomains = excludeDomains;

  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Exa API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  return {
    provider: 'exa',
    query,
    results: (data.results || []).map(r => ({
      title: r.title,
      url: r.url,
      content: r.text || r.summary || '',
      score: r.score,
      publishedDate: r.publishedDate
    })),
    answer: null,
    credits: 1, // Approximate
    searchType: data.searchType
  };
}

/**
 * Priority levels for search queries
 */
const SearchPriority = {
  CRITICAL: 'critical',  // Use both providers, compare results
  HIGH: 'high',          // Tavily primary, Exa fallback
  NORMAL: 'normal',      // Tavily only, basic search
  LOW: 'low'             // Skip if budget exhausted
};

/**
 * Main unified search function with fallback and caching
 *
 * @param {string} query - Search query
 * @param {Object} env - Environment with API keys and KV
 * @param {Object} options - Search options
 * @returns {Object} Search results with metadata
 */
async function unifiedSearch(query, env, options = {}) {
  const {
    priority = SearchPriority.NORMAL,
    maxResults = 5,
    topic = 'general',
    includeDomains = [],
    excludeDomains = [],
    category = null, // Exa category
    skipCache = false,
    forceProvider = null // 'tavily' or 'exa'
  } = options;

  const kv = env.RATE_LIMIT_KV;
  const tavilyKey = env.TAVILY_API_KEY;
  const exaKey = env.EXA_API_KEY;

  // Generate cache key
  const cacheKey = generateCacheKey(query, { includeDomains, topic });

  // Check cache first (unless skipCache)
  if (!skipCache) {
    const cached = await getCachedResults(kv, cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Get budget status
  const budget = await getBudgetStatus(kv);

  // Determine which providers to use based on priority and budget
  let providers = [];

  if (forceProvider) {
    providers = [forceProvider];
  } else {
    switch (priority) {
      case SearchPriority.CRITICAL:
        // Use both if available
        if (budget.tavily.canUse && tavilyKey) providers.push('tavily');
        if (budget.exa.canUse && exaKey) providers.push('exa');
        break;

      case SearchPriority.HIGH:
        // Tavily primary, Exa fallback
        if (budget.tavily.canUse && tavilyKey) {
          providers.push('tavily');
        } else if (budget.exa.canUse && exaKey) {
          providers.push('exa');
        }
        break;

      case SearchPriority.NORMAL:
        // Tavily only
        if (budget.tavily.canUse && tavilyKey) {
          providers.push('tavily');
        }
        break;

      case SearchPriority.LOW:
        // Only if plenty of budget remaining
        if (budget.tavily.dayRemaining > 15 && tavilyKey) {
          providers.push('tavily');
        }
        break;
    }
  }

  // If no providers available, return budget exhausted
  if (providers.length === 0) {
    return {
      success: false,
      error: 'Search budget exhausted',
      query,
      results: [],
      budget: {
        tavily: budget.tavily,
        exa: budget.exa
      }
    };
  }

  // Execute searches
  const searchOptions = {
    maxResults,
    numResults: maxResults,
    topic,
    includeDomains,
    excludeDomains,
    category
  };

  let lastError = null;
  let combinedResults = [];
  let successfulProvider = null;

  for (const provider of providers) {
    try {
      let result;

      if (provider === 'tavily') {
        result = await searchTavily(query, tavilyKey, searchOptions);
        await incrementBudget(kv, 'tavily', result.credits);
      } else if (provider === 'exa') {
        result = await searchExa(query, exaKey, searchOptions);
        await incrementBudget(kv, 'exa', result.credits);
      }

      if (result && result.results && result.results.length > 0) {
        successfulProvider = provider;
        combinedResults = result.results;

        // For CRITICAL priority, continue to get more results
        if (priority !== SearchPriority.CRITICAL) {
          break;
        }

        // Merge results from multiple providers (for CRITICAL)
        if (combinedResults.length > 0 && result.results.length > 0) {
          // Deduplicate by URL
          const urlSet = new Set(combinedResults.map(r => r.url));
          for (const r of result.results) {
            if (!urlSet.has(r.url)) {
              combinedResults.push(r);
            }
          }
        }
      }

    } catch (error) {
      console.error(`Search error (${provider}):`, error.message);
      lastError = error;
      // Continue to next provider on error
    }
  }

  // If all providers failed
  if (combinedResults.length === 0 && lastError) {
    return {
      success: false,
      error: lastError.message,
      query,
      results: [],
      providers: providers
    };
  }

  // Build successful response
  const response = {
    success: true,
    query,
    provider: successfulProvider,
    providers: providers,
    results: combinedResults,
    resultCount: combinedResults.length,
    fromCache: false,
    budget: await getBudgetStatus(kv)
  };

  // Cache the results
  await cacheResults(kv, cacheKey, response, successfulProvider);

  return response;
}

/**
 * Batch search multiple queries with rate limiting
 * Useful for bulk lead enrichment
 */
async function batchSearch(queries, env, options = {}) {
  const {
    priority = SearchPriority.NORMAL,
    maxResults = 3,
    delayMs = 200, // Delay between searches to avoid rate limits
    maxQueries = 10 // Limit batch size
  } = options;

  // Limit batch size
  const limitedQueries = queries.slice(0, maxQueries);
  const results = [];

  for (const query of limitedQueries) {
    const result = await unifiedSearch(query, env, { ...options, priority, maxResults });
    results.push(result);

    // Check if budget exhausted
    if (!result.success && result.error === 'Search budget exhausted') {
      break;
    }

    // Rate limit delay
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return {
    total: limitedQueries.length,
    completed: results.length,
    successful: results.filter(r => r.success).length,
    results
  };
}

/**
 * Get budget report for monitoring
 */
async function getBudgetReport(env) {
  const kv = env.RATE_LIMIT_KV;
  const budget = await getBudgetStatus(kv);

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysRemaining = daysInMonth - dayOfMonth;

  return {
    timestamp: now.toISOString(),
    tavily: {
      ...budget.tavily,
      monthlyBudget: TAVILY_MONTHLY_BUDGET,
      dailyBudget: TAVILY_DAILY_BUDGET,
      projectedMonthlyUsage: Math.round((budget.tavily.monthUsed / dayOfMonth) * daysInMonth),
      recommendedDailyUsage: Math.round(budget.tavily.monthRemaining / (daysRemaining || 1))
    },
    exa: {
      ...budget.exa,
      totalBudget: EXA_TOTAL_BUDGET,
      reserveThreshold: EXA_RESERVE_THRESHOLD,
      status: budget.exa.remaining > EXA_RESERVE_THRESHOLD ? 'healthy' :
              budget.exa.remaining > 0 ? 'low' : 'exhausted'
    },
    recommendations: generateBudgetRecommendations(budget, dayOfMonth, daysRemaining)
  };
}

function generateBudgetRecommendations(budget, dayOfMonth, daysRemaining) {
  const recommendations = [];

  if (budget.tavily.dayRemaining < 10) {
    recommendations.push('Daily Tavily budget running low - consider reducing search frequency');
  }

  if (budget.tavily.monthRemaining < 200) {
    recommendations.push('Monthly Tavily budget running low - use LOW priority for non-essential searches');
  }

  if (!budget.exa.canUse) {
    recommendations.push('Exa credits below reserve threshold - using Tavily only');
  }

  if (budget.exa.remaining < 100) {
    recommendations.push('Exa total budget critically low - reserve for CRITICAL priority only');
  }

  const projectedUsage = (budget.tavily.monthUsed / dayOfMonth) * (dayOfMonth + daysRemaining);
  if (projectedUsage > TAVILY_MONTHLY_BUDGET * 0.9) {
    recommendations.push('Projected to exceed monthly Tavily budget - reduce usage');
  }

  if (recommendations.length === 0) {
    recommendations.push('Budget healthy - normal operations');
  }

  return recommendations;
}

export {
  unifiedSearch,
  batchSearch,
  getBudgetStatus,
  getBudgetReport,
  SearchPriority,
  searchTavily,
  searchExa
};
