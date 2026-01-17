/**
 * Core 4 Intelligence Agents
 *
 * Scheduled automated intelligence pipeline:
 * - The Hunter (4:00 AM): Licensing board scans, real estate monitoring
 * - The Analyst (5:00 AM): Tech stack auditing, LinkedIn network mapping
 * - The Operator (6:00 AM): SMS log auditing, automation health checks
 * - The Strategist (7:00 AM): Lead scoring and prioritization
 *
 * POST /api/intelligence/agents/run?agent=hunter|analyst|operator|strategist|all
 * GET /api/intelligence/agents/status
 * GET /api/intelligence/agents/queue
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';

// ============================================
// AGENT DEFINITIONS
// ============================================

const AGENTS = {
  hunter: {
    id: 'hunter',
    name: 'The Hunter',
    schedule: '0 4 * * *', // 4:00 AM
    description: 'Licensing board scans, real estate listing monitoring',
    tasks: [
      'scan_licensing_boards',
      'monitor_real_estate',
      'check_new_permits',
      'track_restaurant_openings'
    ]
  },
  analyst: {
    id: 'analyst',
    name: 'The Analyst',
    schedule: '0 5 * * *', // 5:00 AM
    description: 'Tech stack auditing, LinkedIn network mapping',
    tasks: [
      'audit_pos_systems',
      'scan_job_postings',
      'map_linkedin_networks',
      'analyze_tech_trends'
    ]
  },
  operator: {
    id: 'operator',
    name: 'The Operator',
    schedule: '0 6 * * *', // 6:00 AM
    description: 'SMS log auditing, automation health checks',
    tasks: [
      'audit_communication_logs',
      'check_automation_health',
      'verify_integrations',
      'cleanup_stale_data'
    ]
  },
  strategist: {
    id: 'strategist',
    name: 'The Strategist',
    schedule: '0 7 * * *', // 7:00 AM
    description: 'Lead scoring and prioritization',
    tasks: [
      'calculate_lead_scores',
      'prioritize_outreach',
      'identify_gaps',
      'generate_daily_brief'
    ]
  }
};

// ============================================
// LEAD SCORING FORMULA
// Score = (Property Ownership × 3) + (Tech Vulnerability × 2) + (Warm Intro × 5)
// ============================================

const SCORING_WEIGHTS = {
  property_ownership: 3,   // Owner vs leasing
  tech_vulnerability: 2,   // Outdated POS, no online ordering, etc.
  warm_intro: 5,           // Referral, prior contact, network connection
  revenue_estimate: 1,     // Revenue signals
  employee_count: 0.5,     // Size indicator
  website_quality: 1,      // Online presence
  review_volume: 0.5,      // Active customer base
  review_sentiment: 1,     // Customer satisfaction
  pos_age: 1.5,            // How old is current POS
  growth_signals: 2        // Expansion, hiring, renovations
};

/**
 * Calculate lead score using the proprietary formula
 */
function calculateLeadScore(lead) {
  let score = 0;
  const factors = [];

  // Property Ownership (inferred from business type/age)
  if (lead.is_owner || lead.years_in_business > 5) {
    score += SCORING_WEIGHTS.property_ownership * 10;
    factors.push({ factor: 'property_ownership', value: 10, weight: SCORING_WEIGHTS.property_ownership });
  }

  // Tech Vulnerability
  const vulnerablePOS = ['square', 'clover', 'none', 'cash_only', 'legacy'];
  if (vulnerablePOS.some(p => (lead.current_pos || '').toLowerCase().includes(p))) {
    score += SCORING_WEIGHTS.tech_vulnerability * 10;
    factors.push({ factor: 'tech_vulnerability', value: 10, weight: SCORING_WEIGHTS.tech_vulnerability });
  }

  // Warm Intro
  if (lead.referral_source || lead.has_prior_contact) {
    score += SCORING_WEIGHTS.warm_intro * 10;
    factors.push({ factor: 'warm_intro', value: 10, weight: SCORING_WEIGHTS.warm_intro });
  }

  // Revenue estimate (normalize to 0-10)
  if (lead.revenue_estimate) {
    const revScore = Math.min(10, lead.revenue_estimate / 100000);
    score += SCORING_WEIGHTS.revenue_estimate * revScore;
    factors.push({ factor: 'revenue_estimate', value: revScore, weight: SCORING_WEIGHTS.revenue_estimate });
  }

  // Employee count
  if (lead.employee_estimate) {
    const empScore = Math.min(10, lead.employee_estimate / 10);
    score += SCORING_WEIGHTS.employee_count * empScore;
    factors.push({ factor: 'employee_count', value: empScore, weight: SCORING_WEIGHTS.employee_count });
  }

  // Website quality (has website = base score, SSL = bonus)
  if (lead.website) {
    let webScore = 5;
    if (lead.website.startsWith('https')) webScore += 2;
    if (lead.has_online_ordering) webScore += 3;
    score += SCORING_WEIGHTS.website_quality * webScore;
    factors.push({ factor: 'website_quality', value: webScore, weight: SCORING_WEIGHTS.website_quality });
  }

  // Growth signals
  if (lead.is_hiring || lead.recently_opened || lead.expanding) {
    score += SCORING_WEIGHTS.growth_signals * 10;
    factors.push({ factor: 'growth_signals', value: 10, weight: SCORING_WEIGHTS.growth_signals });
  }

  return {
    score: Math.round(Math.min(100, score)),
    factors,
    formula: 'Score = (Property Ownership × 3) + (Tech Vulnerability × 2) + (Warm Intro × 5) + ...'
  };
}

// ============================================
// RECURSIVE GAP FILLING
// Flags missing data as <<NEED>> markers
// ============================================

const REQUIRED_FIELDS = [
  'company_name',
  'contact_name',
  'email',
  'phone',
  'city',
  'state',
  'current_pos',
  'website'
];

const DESIRED_FIELDS = [
  'full_address',
  'employee_estimate',
  'revenue_estimate',
  'seating_capacity_hint',
  'cuisine_hint',
  'service_style_hint'
];

/**
 * Identify data gaps and generate search queries
 */
function identifyGaps(lead) {
  const gaps = [];
  const searchQueries = [];

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!lead[field]) {
      gaps.push({
        field,
        priority: 'required',
        marker: `<<NEED:${field}>>`
      });

      // Generate search query
      if (field === 'email' && lead.company_name) {
        searchQueries.push({
          field,
          query: `"${lead.company_name}" contact email`,
          sources: ['google', 'linkedin', 'yelp']
        });
      }
      if (field === 'phone' && lead.company_name && lead.city) {
        searchQueries.push({
          field,
          query: `"${lead.company_name}" ${lead.city} phone`,
          sources: ['google', 'yelp', 'yellow_pages']
        });
      }
      if (field === 'current_pos' && lead.website) {
        searchQueries.push({
          field,
          query: `site:${lead.website} powered by OR checkout OR order online`,
          sources: ['builtwith', 'wappalyzer']
        });
      }
    }
  }

  // Check desired fields
  for (const field of DESIRED_FIELDS) {
    if (!lead[field]) {
      gaps.push({
        field,
        priority: 'desired',
        marker: `<<NEED:${field}>>`
      });
    }
  }

  return { gaps, searchQueries, gapCount: gaps.length };
}

// ============================================
// AGENT TASK IMPLEMENTATIONS
// ============================================

/**
 * Hunter Tasks
 */
async function runHunterTasks(env, options = {}) {
  const results = {
    agent: 'hunter',
    started: Date.now(),
    tasks: [],
    newLeads: 0,
    updatedLeads: 0
  };

  // Task: Check for new restaurant permits (simulated - would connect to external API)
  results.tasks.push({
    task: 'scan_licensing_boards',
    status: 'simulated',
    message: 'Would scan MA ABCC and local boards for new licenses',
    regions: ['barnstable', 'plymouth', 'providence']
  });

  // Task: Monitor real estate listings (simulated)
  results.tasks.push({
    task: 'monitor_real_estate',
    status: 'simulated',
    message: 'Would check LoopNet, commercial listings for restaurant spaces'
  });

  // Task: Check leads for stale data
  const staleLeads = await env.DB.prepare(`
    SELECT id, company_name, updated_at
    FROM restaurant_leads
    WHERE updated_at < unixepoch() - (86400 * 30)
    LIMIT 50
  `).all();

  results.tasks.push({
    task: 'identify_stale_leads',
    status: 'completed',
    count: staleLeads.results?.length || 0
  });

  results.ended = Date.now();
  return results;
}

/**
 * Analyst Tasks
 */
async function runAnalystTasks(env, options = {}) {
  const results = {
    agent: 'analyst',
    started: Date.now(),
    tasks: [],
    posBreakdown: {},
    techInsights: []
  };

  // Task: POS System Distribution
  const posDistribution = await env.DB.prepare(`
    SELECT current_pos, COUNT(*) as count
    FROM restaurant_leads
    WHERE current_pos IS NOT NULL AND current_pos != ''
    GROUP BY current_pos
    ORDER BY count DESC
    LIMIT 20
  `).all();

  results.posBreakdown = (posDistribution.results || []).reduce((acc, row) => {
    acc[row.current_pos] = row.count;
    return acc;
  }, {});

  results.tasks.push({
    task: 'audit_pos_systems',
    status: 'completed',
    distribution: results.posBreakdown
  });

  // Task: Identify Toast-ready leads (using vulnerable POS)
  const toastReady = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM restaurant_leads
    WHERE LOWER(current_pos) IN ('square', 'clover', 'micros', 'aloha', 'none')
      AND lead_score >= 50
  `).first();

  results.tasks.push({
    task: 'identify_toast_ready',
    status: 'completed',
    count: toastReady?.count || 0
  });

  results.ended = Date.now();
  return results;
}

/**
 * Operator Tasks
 */
async function runOperatorTasks(env, options = {}) {
  const results = {
    agent: 'operator',
    started: Date.now(),
    tasks: [],
    healthChecks: {},
    alerts: []
  };

  // Task: Check automation job health
  const recentJobs = await env.DB.prepare(`
    SELECT status, COUNT(*) as count
    FROM automation_jobs
    WHERE created_at > unixepoch() - 86400
    GROUP BY status
  `).all();

  const jobHealth = (recentJobs.results || []).reduce((acc, row) => {
    acc[row.status] = row.count;
    return acc;
  }, {});

  results.healthChecks.jobs = jobHealth;
  results.tasks.push({
    task: 'check_automation_health',
    status: 'completed',
    jobHealth
  });

  // Task: Check for failed jobs
  const failedJobs = await env.DB.prepare(`
    SELECT id, job_type, error_message, created_at
    FROM automation_jobs
    WHERE status = 'failed'
      AND created_at > unixepoch() - 86400
    ORDER BY created_at DESC
    LIMIT 10
  `).all();

  if ((failedJobs.results?.length || 0) > 0) {
    results.alerts.push({
      type: 'failed_jobs',
      severity: 'warning',
      count: failedJobs.results.length,
      jobs: failedJobs.results
    });
  }

  results.tasks.push({
    task: 'audit_failed_jobs',
    status: 'completed',
    failedCount: failedJobs.results?.length || 0
  });

  // Task: Check email sequence health
  const pendingEmails = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM email_queue
    WHERE status = 'pending'
  `).first();

  results.healthChecks.emailQueue = pendingEmails?.count || 0;
  results.tasks.push({
    task: 'check_email_queue',
    status: 'completed',
    pending: pendingEmails?.count || 0
  });

  results.ended = Date.now();
  return results;
}

/**
 * Strategist Tasks
 */
async function runStrategistTasks(env, options = {}) {
  const results = {
    agent: 'strategist',
    started: Date.now(),
    tasks: [],
    scoredLeads: 0,
    gapsIdentified: 0,
    gapsFilled: 0,
    dailyBrief: null
  };

  // Task: Calculate lead scores for unscored leads
  const unscoredLeads = await env.DB.prepare(`
    SELECT * FROM restaurant_leads
    WHERE lead_score IS NULL OR lead_score = 0
    LIMIT 100
  `).all();

  let scored = 0;
  let totalGaps = 0;
  const leadsWithGaps = [];

  for (const lead of unscoredLeads.results || []) {
    const scoreResult = calculateLeadScore(lead);
    const gapResult = identifyGaps(lead);

    // Update lead score
    await env.DB.prepare(`
      UPDATE restaurant_leads
      SET lead_score = ?, updated_at = unixepoch()
      WHERE id = ?
    `).bind(scoreResult.score, lead.id).run();

    scored++;
    totalGaps += gapResult.gapCount;

    // Collect leads with fillable gaps for Brave Search
    if (gapResult.searchQueries.length > 0) {
      leadsWithGaps.push({
        lead,
        gaps: gapResult.gaps,
        searchQueries: gapResult.searchQueries
      });
    }
  }

  results.scoredLeads = scored;
  results.gapsIdentified = totalGaps;
  results.tasks.push({
    task: 'calculate_lead_scores',
    status: 'completed',
    scored,
    gapsIdentified: totalGaps
  });

  // Task: Execute gap-fill searches using Brave Search API
  let gapsFilled = 0;
  if (env.BRAVE_API_KEY && leadsWithGaps.length > 0) {
    const gapFillResult = await runGapFillSearches(env, leadsWithGaps.slice(0, 10));
    gapsFilled = gapFillResult.filled;
    results.gapsFilled = gapsFilled;

    results.tasks.push({
      task: 'gap_fill_searches',
      status: 'completed',
      searched: gapFillResult.searched,
      filled: gapFillResult.filled,
      leads_processed: gapFillResult.leadsProcessed
    });
  } else {
    results.tasks.push({
      task: 'gap_fill_searches',
      status: env.BRAVE_API_KEY ? 'skipped_no_gaps' : 'skipped_no_api_key',
      message: env.BRAVE_API_KEY ?
        'No leads with fillable gaps found' :
        'BRAVE_API_KEY not configured - set via wrangler secret'
    });
  }

  // Task: Generate daily brief
  const highValueLeads = await env.DB.prepare(`
    SELECT company_name, city, state, lead_score, current_pos
    FROM restaurant_leads
    WHERE lead_score >= 80
    ORDER BY lead_score DESC
    LIMIT 10
  `).all();

  const newLeadsToday = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM restaurant_leads
    WHERE created_at > unixepoch() - 86400
  `).first();

  const scoreDistribution = await env.DB.prepare(`
    SELECT
      CASE
        WHEN lead_score >= 80 THEN 'hot'
        WHEN lead_score >= 60 THEN 'warm'
        WHEN lead_score >= 40 THEN 'cool'
        ELSE 'cold'
      END as tier,
      COUNT(*) as count
    FROM restaurant_leads
    WHERE lead_score IS NOT NULL
    GROUP BY tier
  `).all();

  results.dailyBrief = {
    date: new Date().toISOString().split('T')[0],
    newLeads: newLeadsToday?.count || 0,
    highValueLeads: highValueLeads.results || [],
    scoreDistribution: (scoreDistribution.results || []).reduce((acc, row) => {
      acc[row.tier] = row.count;
      return acc;
    }, {}),
    gapsFilled,
    recommendations: [
      highValueLeads.results?.length > 5 ?
        'Multiple high-value leads ready for outreach' :
        'Focus on nurturing warm leads',
      totalGaps > 50 ?
        'Run gap-filling queries to enrich lead data' :
        'Lead data quality is good',
      gapsFilled > 0 ?
        `${gapsFilled} lead records enriched via web search` :
        null
    ].filter(Boolean)
  };

  results.tasks.push({
    task: 'generate_daily_brief',
    status: 'completed',
    brief: results.dailyBrief
  });

  results.ended = Date.now();
  return results;
}

// ============================================
// BRAVE SEARCH GAP-FILL INTEGRATION
// ============================================

/**
 * POS patterns for detection from search results
 */
const POS_PATTERNS = [
  { pattern: /toast|toasttab/i, value: 'Toast' },
  { pattern: /square.*pos|powered by square|squareup/i, value: 'Square' },
  { pattern: /clover\s*(pos)?/i, value: 'Clover' },
  { pattern: /aloha/i, value: 'Aloha' },
  { pattern: /micros|oracle.*micros/i, value: 'MICROS' },
  { pattern: /revel/i, value: 'Revel' },
  { pattern: /lightspeed/i, value: 'Lightspeed' },
  { pattern: /touchbistro/i, value: 'TouchBistro' },
  { pattern: /upserve|breadcrumb/i, value: 'Upserve' },
  { pattern: /harbortouch/i, value: 'Harbortouch' },
  { pattern: /cake.*pos/i, value: 'CAKE' },
  { pattern: /shift4|skytab/i, value: 'Shift4/SkyTab' },
  { pattern: /ncr.*aloha|ncr.*pos/i, value: 'NCR' },
  { pattern: /par.*brink/i, value: 'PAR Brink' },
  { pattern: /focus.*pos/i, value: 'Focus POS' },
  { pattern: /spoton/i, value: 'SpotOn' },
  { pattern: /talech/i, value: 'Talech' },
  { pattern: /heartland/i, value: 'Heartland' }
];

/**
 * Extract relevant data from search results based on gap type
 */
function extractFromSearchResults(results, gapType, companyName) {
  const combinedText = results.map(r => `${r.title} ${r.description}`).join(' ');

  switch (gapType) {
    case 'email': {
      // Look for email patterns, prioritize ones that seem related to the company
      const emailMatches = combinedText.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/g) || [];
      for (const email of emailMatches) {
        const lowerEmail = email.toLowerCase();
        // Filter out common non-contact emails and generic addresses
        if (
          !lowerEmail.includes('noreply') &&
          !lowerEmail.includes('donotreply') &&
          !lowerEmail.includes('support@google') &&
          !lowerEmail.includes('support@yelp') &&
          !lowerEmail.includes('@example.') &&
          !lowerEmail.includes('webmaster')
        ) {
          return { value: lowerEmail, confidence: 0.6 };
        }
      }
      break;
    }
    case 'phone': {
      // Look for phone patterns
      const phoneMatches = combinedText.match(/(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g) || [];
      if (phoneMatches.length > 0) {
        // Clean the phone number
        const phone = phoneMatches[0].replace(/[^\d]/g, '').slice(-10);
        if (phone.length === 10) {
          return { value: phone, confidence: 0.7 };
        }
      }
      break;
    }
    case 'current_pos': {
      // Look for POS system mentions
      for (const { pattern, value } of POS_PATTERNS) {
        if (pattern.test(combinedText)) {
          return { value, confidence: 0.8 };
        }
      }
      break;
    }
    case 'website': {
      // Look for URLs that might be the restaurant's website
      const urlMatches = combinedText.match(/https?:\/\/[^\s<>"]+/g) || [];
      for (const url of urlMatches) {
        // Skip common non-restaurant URLs
        if (
          !url.includes('yelp.com') &&
          !url.includes('google.com') &&
          !url.includes('facebook.com') &&
          !url.includes('tripadvisor.com') &&
          !url.includes('doordash.com') &&
          !url.includes('ubereats.com')
        ) {
          return { value: url.split('?')[0], confidence: 0.5 };
        }
      }
      break;
    }
  }

  return null;
}

/**
 * Run gap-fill searches using Brave Search API
 */
async function runGapFillSearches(env, leadsWithGaps) {
  const results = {
    searched: 0,
    filled: 0,
    leadsProcessed: 0,
    errors: []
  };

  if (!env.BRAVE_API_KEY) {
    return results;
  }

  for (const { lead, searchQueries } of leadsWithGaps) {
    results.leadsProcessed++;

    // Limit to top 3 queries per lead to avoid rate limiting
    for (const queryInfo of searchQueries.slice(0, 3)) {
      if (results.searched >= 50) break; // Rate limit per run

      try {
        const searchResponse = await fetch(
          `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(queryInfo.query)}&count=5`,
          {
            headers: {
              'X-Subscription-Token': env.BRAVE_API_KEY,
              'Accept': 'application/json'
            }
          }
        );

        results.searched++;

        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          console.error(`[GapFill] Brave API error: ${searchResponse.status} - ${errorText}`);
          results.errors.push({
            lead_id: lead.id,
            field: queryInfo.field,
            error: `API error: ${searchResponse.status}`
          });
          continue;
        }

        const searchData = await searchResponse.json();
        const webResults = searchData.web?.results || [];

        if (webResults.length > 0) {
          const extractedData = extractFromSearchResults(
            webResults,
            queryInfo.field,
            lead.company_name || lead.name
          );

          if (extractedData) {
            // Determine the correct column name
            const columnMap = {
              'email': 'primary_email',
              'phone': 'primary_phone',
              'current_pos': 'current_pos',
              'website': 'website_url'
            };
            const columnName = columnMap[queryInfo.field] || queryInfo.field;

            // Update the lead with found data
            await env.DB.prepare(`
              UPDATE restaurant_leads
              SET ${columnName} = ?,
                  gap_fill_attempted_at = unixepoch(),
                  gap_fill_source = 'brave',
                  updated_at = unixepoch()
              WHERE id = ?
            `).bind(extractedData.value, lead.id).run();

            // Log the gap-fill result
            try {
              await env.DB.prepare(`
                INSERT INTO gap_fill_results (id, lead_id, field_name, old_value, new_value, source, search_query, confidence)
                VALUES (?, ?, ?, ?, ?, 'brave', ?, ?)
              `).bind(
                `gf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                lead.id,
                queryInfo.field,
                lead[columnName] || null,
                extractedData.value,
                queryInfo.query,
                extractedData.confidence
              ).run();
            } catch (logError) {
              // Table might not exist yet, continue anyway
              console.log('[GapFill] Could not log result (table may not exist):', logError.message);
            }

            results.filled++;
            console.log(`[GapFill] Found ${queryInfo.field} for ${lead.company_name || lead.name}: ${extractedData.value}`);
          }
        }

        // Rate limiting - wait 200ms between requests
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (searchError) {
        console.error(`[GapFill] Search error for ${lead.company_name}:`, searchError);
        results.errors.push({
          lead_id: lead.id,
          field: queryInfo.field,
          error: searchError.message
        });
      }
    }

    // Mark that we attempted gap fill for this lead
    await env.DB.prepare(`
      UPDATE restaurant_leads
      SET gap_fill_attempted_at = unixepoch()
      WHERE id = ? AND gap_fill_attempted_at IS NULL
    `).bind(lead.id).run();
  }

  console.log(`[GapFill] Completed: ${results.searched} searches, ${results.filled} gaps filled`);
  return results;
}

// ============================================
// API HANDLERS
// ============================================

export async function onRequestPost(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const url = new URL(context.request.url);
    const agentParam = url.searchParams.get('agent') || 'all';

    const results = {
      success: true,
      timestamp: new Date().toISOString(),
      agents: []
    };

    const agentsToRun = agentParam === 'all'
      ? Object.keys(AGENTS)
      : [agentParam];

    for (const agentId of agentsToRun) {
      if (!AGENTS[agentId]) continue;

      let agentResult;
      switch (agentId) {
        case 'hunter':
          agentResult = await runHunterTasks(context.env);
          break;
        case 'analyst':
          agentResult = await runAnalystTasks(context.env);
          break;
        case 'operator':
          agentResult = await runOperatorTasks(context.env);
          break;
        case 'strategist':
          agentResult = await runStrategistTasks(context.env);
          break;
      }

      if (agentResult) {
        results.agents.push({
          ...AGENTS[agentId],
          result: agentResult,
          duration: agentResult.ended - agentResult.started
        });
      }
    }

    // Log agent run
    await context.env.DB.prepare(`
      INSERT INTO automation_jobs (id, client_id, job_type, status, input, output, created_at, updated_at, completed_at)
      VALUES (?, 'system', 'intelligence_agents', 'completed', ?, ?, unixepoch(), unixepoch(), unixepoch())
    `).bind(
      `intel_${Date.now()}`,
      JSON.stringify({ agents: agentsToRun }),
      JSON.stringify(results)
    ).run();

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Intelligence agents error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestGet(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const url = new URL(context.request.url);
    const action = url.pathname.split('/').pop();

    // Status check
    if (action === 'status') {
      const lastRuns = await context.env.DB.prepare(`
        SELECT job_type, status, output, completed_at
        FROM automation_jobs
        WHERE job_type = 'intelligence_agents'
        ORDER BY created_at DESC
        LIMIT 5
      `).all();

      return new Response(JSON.stringify({
        success: true,
        agents: AGENTS,
        lastRuns: (lastRuns.results || []).map(r => ({
          ...r,
          output: JSON.parse(r.output || '{}'),
          completed_at_iso: new Date(r.completed_at * 1000).toISOString()
        }))
      }), { headers: corsHeaders });
    }

    // Default: return agent definitions
    return new Response(JSON.stringify({
      success: true,
      agents: AGENTS,
      scoringFormula: 'Score = (Property Ownership × 3) + (Tech Vulnerability × 2) + (Warm Intro × 5) + ...',
      scoringWeights: SCORING_WEIGHTS,
      gapFields: { required: REQUIRED_FIELDS, desired: DESIRED_FIELDS }
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Intelligence agents GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
