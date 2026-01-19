/**
 * Lead Discovery API
 *
 * POST /api/admin/intelligence/discover - Discover new restaurant leads
 *
 * Discovery methods:
 * 1. Web search for restaurants in a location
 * 2. Technology-based discovery (find restaurants using specific POS)
 * 3. Directory scraping (Yelp, Google Business, TripAdvisor)
 * 4. Competitor research
 * 5. Single website scan (for testing)
 *
 * Integrates with Tavily/Exa search providers for web research
 */

import { scrapeRestaurantWebsite, detectTechStack } from './_lib/scraper.js';
import { unifiedSearch, SearchPriority } from '../../../_shared/search-providers.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const {
      method = 'location',  // 'location', 'technology', 'competitor', 'bulk_websites', 'single_website'
      location,
      technology,
      websites,  // For bulk website scanning
      website,   // For single website scanning
      url,       // Alternative name for single website
      competitor_url,
      limit = 20,
    } = body;

    let results;
    const targetUrl = website || url || competitor_url;

    switch (method) {
      case 'location':
        results = await discoverByLocation(env, location, limit);
        break;
      case 'technology':
        results = await discoverByTechnology(env, technology, limit);
        break;
      case 'bulk_websites':
        results = await scanBulkWebsites(env, websites);
        break;
      case 'single_website':
        results = await scanSingleWebsite(env, targetUrl);
        break;
      case 'competitor':
        results = await researchCompetitor(env, competitor_url);
        break;
      default:
        return Response.json({
          success: false,
          error: 'Invalid discovery method. Use: location, technology, bulk_websites, single_website, or competitor',
        }, { status: 400 });
    }

    return Response.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Discovery error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * Discover restaurants by location using web search
 */
async function discoverByLocation(env, location, limit) {
  if (!location) {
    return { error: 'Location is required', discovered: [] };
  }

  const discovered = [];
  const searchResults = [];
  const searchQueries = [
    `restaurants in ${location}`,
    `best restaurants ${location}`,
    `new restaurants ${location}`,
  ];

  // Check if we have any existing leads for this location
  const existingLeads = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM restaurant_leads
    WHERE city LIKE ? OR state LIKE ?
  `).bind(`%${location}%`, `%${location}%`).first();

  // Perform web searches using Tavily/Exa if available
  const hasSearchProviders = env.TAVILY_API_KEY || env.EXA_API_KEY;

  if (hasSearchProviders) {
    // Only search if we have budget - use LOW priority to conserve credits
    for (const query of searchQueries.slice(0, 2)) { // Limit to 2 searches
      try {
        const result = await unifiedSearch(query, env, {
          priority: SearchPriority.LOW,
          maxResults: 5,
          topic: 'general'
        });

        if (result.success && result.results) {
          searchResults.push({
            query,
            results: result.results,
            provider: result.provider,
            fromCache: result.fromCache
          });

          // Extract potential restaurant URLs from results
          for (const r of result.results) {
            if (r.url && !r.url.includes('yelp.com') && !r.url.includes('tripadvisor.com')) {
              discovered.push({
                url: r.url,
                title: r.title,
                snippet: r.content?.substring(0, 200),
                source: 'web_search'
              });
            }
          }
        }
      } catch (error) {
        console.error(`Search error for "${query}":`, error.message);
      }
    }
  }

  return {
    method: 'location',
    location,
    existing_leads: existingLeads?.count || 0,
    discovered: discovered,
    search_queries: searchQueries,
    search_results: searchResults,
    search_enabled: hasSearchProviders,
    message: hasSearchProviders
      ? `Found ${discovered.length} potential leads in ${location} via web search. ${existingLeads?.count || 0} existing leads in database.`
      : `Search APIs not configured. ${existingLeads?.count || 0} existing leads in database.`,
    next_steps: discovered.length > 0
      ? ['Use bulk_websites method to scan discovered URLs', 'Review search results for additional leads']
      : ['Use bulk_websites method with URLs from manual search', 'Import CSV from Yelp/Google Business export', 'Use BuiltWith data for technology-based discovery'],
  };
}

/**
 * Discover restaurants using specific technology
 */
async function discoverByTechnology(env, technology, limit) {
  if (!technology) {
    return { error: 'Technology type is required', discovered: [] };
  }

  // Query existing leads with this technology
  const existingWithTech = await env.DB.prepare(`
    SELECT id, name, primary_email, website_url, city, state, lead_score
    FROM restaurant_leads
    WHERE LOWER(current_pos) LIKE ?
    ORDER BY lead_score DESC
    LIMIT ?
  `).bind(`%${technology.toLowerCase()}%`, limit).all();

  // Find leads WITHOUT this technology (potential switch targets)
  const switchTargets = await env.DB.prepare(`
    SELECT id, name, primary_email, website_url, city, state, current_pos, lead_score
    FROM restaurant_leads
    WHERE current_pos IS NOT NULL
    AND LOWER(current_pos) NOT LIKE ?
    AND LOWER(current_pos) NOT LIKE '%unknown%'
    AND lead_score >= 60
    ORDER BY lead_score DESC
    LIMIT ?
  `).bind(`%${technology.toLowerCase()}%`, limit).all();

  return {
    method: 'technology',
    technology,
    existing_users: {
      count: existingWithTech.results?.length || 0,
      leads: existingWithTech.results || [],
    },
    switch_targets: {
      count: switchTargets.results?.length || 0,
      leads: switchTargets.results || [],
      message: `Restaurants NOT using ${technology} - potential switch opportunities`,
    },
    discovery_tips: [
      `Search BuiltWith for "${technology}" technology`,
      `Check job postings mentioning ${technology}`,
      `Look for ${technology} partner/reseller directories`,
    ],
  };
}

/**
 * Scan a single website and create/update lead
 */
async function scanSingleWebsite(env, url) {
  if (!url) {
    return { error: 'URL is required', success: false };
  }

  // Normalize URL
  let normalizedUrl = url;
  if (!url.startsWith('http')) {
    normalizedUrl = 'https://' + url;
  }

  // Extract domain for matching
  let domain;
  try {
    domain = new URL(normalizedUrl).hostname.replace('www.', '');
  } catch (e) {
    return { error: 'Invalid URL format', success: false };
  }

  // Check if this is an existing client
  const existingClient = await env.DB.prepare(`
    SELECT id, name, company, email, phone
    FROM clients
    WHERE LOWER(company) LIKE ? OR LOWER(website) LIKE ?
  `).bind(`%${domain}%`, `%${domain}%`).first();

  // Check if this is an existing lead
  const existingLead = await env.DB.prepare(`
    SELECT id, name, primary_email, primary_phone, website_url, current_pos, status
    FROM restaurant_leads
    WHERE website_url LIKE ? OR domain LIKE ?
  `).bind(`%${domain}%`, `%${domain}%`).first();

  // Scrape the website
  const scrapeResult = await scrapeRestaurantWebsite(normalizedUrl);

  if (!scrapeResult.success) {
    return {
      method: 'single_website',
      url: normalizedUrl,
      success: false,
      errors: scrapeResult.errors,
      existing_client: existingClient || null,
      existing_lead: existingLead || null,
    };
  }

  // Extract data from scrape
  const email = scrapeResult.contacts.emails?.[0];
  const phone = scrapeResult.contacts.phones?.[0];
  const restaurantName = scrapeResult.data.page_title?.split(/[|\-–—]/)[0]?.trim() || domain;
  const address = scrapeResult.contacts.addresses?.[0];

  let leadResult = null;
  let action = 'none';

  if (existingClient) {
    // This is an existing client - return their info
    action = 'existing_client';
    leadResult = {
      type: 'client',
      id: existingClient.id,
      name: existingClient.name,
      company: existingClient.company,
    };
  } else if (existingLead) {
    // Update existing lead with new data
    action = 'updated_lead';
    const updates = [];
    const params = [];

    if (!existingLead.primary_email && email) {
      updates.push('primary_email = ?');
      params.push(email);
    }
    if (!existingLead.primary_phone && phone) {
      updates.push('primary_phone = ?');
      params.push(phone);
    }
    if (!existingLead.current_pos && scrapeResult.tech_stack.pos_system) {
      updates.push('current_pos = ?');
      params.push(scrapeResult.tech_stack.pos_system);
    }

    if (updates.length > 0) {
      updates.push('updated_at = unixepoch()');
      updates.push('enriched_at = unixepoch()');
      updates.push("enrichment_source = 'web_discovery'");
      params.push(existingLead.id);

      await env.DB.prepare(`
        UPDATE restaurant_leads SET ${updates.join(', ')} WHERE id = ?
      `).bind(...params).run();
    }

    leadResult = {
      type: 'lead',
      id: existingLead.id,
      name: existingLead.name,
      updated_fields: updates.length - 3, // minus the timestamp fields
    };
  } else {
    // Create new lead
    action = 'created_lead';
    const leadId = 'lead_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    const leadScore = calculateLeadScore(scrapeResult);

    await env.DB.prepare(`
      INSERT INTO restaurant_leads (
        id, name, domain, primary_email, primary_phone, website_url, current_pos,
        online_ordering_provider, reservation_provider,
        cuisine_primary, service_style,
        source, lead_score, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'web_discovery', ?, 'prospect', unixepoch(), unixepoch())
    `).bind(
      leadId,
      restaurantName,
      domain,
      email || null,
      phone || null,
      normalizedUrl,
      scrapeResult.tech_stack.pos_system || null,
      scrapeResult.tech_stack.online_ordering || null,
      scrapeResult.tech_stack.reservation_system || null,
      scrapeResult.data.cuisine_hints?.[0]?.cuisine || null,
      scrapeResult.data.service_hints?.[0]?.style || null,
      leadScore
    ).run();

    leadResult = {
      type: 'new_lead',
      id: leadId,
      name: restaurantName,
      score: leadScore,
    };
  }

  return {
    method: 'single_website',
    url: normalizedUrl,
    success: true,
    action,
    lead: leadResult,
    scraped_data: {
      name: restaurantName,
      email,
      phone,
      address,
      tech_stack: scrapeResult.tech_stack,
      social: scrapeResult.data.social,
      cuisine: scrapeResult.data.cuisine_hints,
      service_style: scrapeResult.data.service_hints,
      menu_url: scrapeResult.data.menu_url,
      order_url: scrapeResult.data.order_url,
    },
    existing_client: existingClient || null,
    existing_lead: existingLead || null,
  };
}

/**
 * Scan multiple websites in bulk
 */
async function scanBulkWebsites(env, websites) {
  if (!websites || !Array.isArray(websites) || websites.length === 0) {
    return { error: 'Websites array is required', scanned: [] };
  }

  const results = [];
  const leadsCreated = [];
  const leadsUpdated = [];
  const errors = [];

  // Limit to 10 websites per request to avoid timeout
  const toScan = websites.slice(0, 10);

  for (const url of toScan) {
    try {
      const scanResult = await scanSingleWebsite(env, url);

      if (scanResult.success) {
        results.push({
          url,
          success: true,
          action: scanResult.action,
          data: scanResult.scraped_data,
        });

        if (scanResult.action === 'created_lead') {
          // Include fields that frontend expects (company, pos)
          leadsCreated.push({
            ...scanResult.lead,
            company: scanResult.scraped_data?.name || scanResult.lead?.name,
            pos: scanResult.scraped_data?.tech_stack?.pos_system || null,
          });
        } else if (scanResult.action === 'updated_lead') {
          leadsUpdated.push({
            ...scanResult.lead,
            company: scanResult.scraped_data?.name || scanResult.lead?.name,
          });
        } else if (scanResult.action === 'existing_client') {
          // Note: this is an existing client, not a new lead
          results[results.length - 1].existing_client = scanResult.existing_client;
        }
      } else {
        results.push({
          url,
          success: false,
          errors: scanResult.errors,
        });
      }
    } catch (error) {
      errors.push({ url, error: error.message });
    }
  }

  return {
    method: 'bulk_websites',
    total_submitted: websites.length,
    scanned: toScan.length,
    successful: results.filter(r => r.success).length,
    leads_created: leadsCreated.length,
    leads_updated: leadsUpdated.length,
    new_leads: leadsCreated,
    updated_leads: leadsUpdated,
    results,
    errors,
    remaining: websites.length - toScan.length,
    message: websites.length > 10
      ? `Scanned first 10 of ${websites.length} URLs. Submit remaining ${websites.length - 10} in another request.`
      : `Scanned ${toScan.length} websites, created ${leadsCreated.length} new leads, updated ${leadsUpdated.length} existing leads.`,
  };
}

/**
 * Research a competitor restaurant
 */
async function researchCompetitor(env, competitorUrl) {
  if (!competitorUrl) {
    return { error: 'Competitor URL is required' };
  }

  // Scrape the competitor's website
  const scrapeResult = await scrapeRestaurantWebsite(competitorUrl);

  if (!scrapeResult.success) {
    return {
      method: 'competitor',
      url: competitorUrl,
      success: false,
      errors: scrapeResult.errors,
    };
  }

  // Find similar restaurants in our database
  const cuisine = scrapeResult.data.cuisine_hints?.[0]?.cuisine;
  const pos = scrapeResult.tech_stack.pos_system;

  let similarLeads = [];
  if (cuisine || pos) {
    let query = 'SELECT id, name, primary_email, city, state, current_pos FROM restaurant_leads WHERE 1=1';
    const params = [];

    if (pos) {
      query += ' AND LOWER(current_pos) LIKE ?';
      params.push(`%${pos.toLowerCase()}%`);
    }

    query += ' ORDER BY lead_score DESC LIMIT 20';

    const result = await env.DB.prepare(query).bind(...params).all();
    similarLeads = result.results || [];
  }

  return {
    method: 'competitor',
    url: competitorUrl,
    success: true,
    competitor_profile: {
      name: scrapeResult.data.page_title?.split(/[|\-–]/)[0]?.trim(),
      description: scrapeResult.data.meta_description,
      tech_stack: scrapeResult.tech_stack,
      contacts: scrapeResult.contacts,
      social: scrapeResult.data.social,
      cuisine: scrapeResult.data.cuisine_hints,
      service_style: scrapeResult.data.service_hints,
    },
    similar_leads: {
      count: similarLeads.length,
      leads: similarLeads,
      message: `Found ${similarLeads.length} similar restaurants in database`,
    },
    insights: generateCompetitorInsights(scrapeResult),
  };
}

/**
 * Calculate lead score based on scraped data
 */
function calculateLeadScore(scrapeResult) {
  let score = 30; // Base score

  if (scrapeResult.contacts.emails?.length) score += 25;
  if (scrapeResult.contacts.phones?.length) score += 15;
  if (scrapeResult.tech_stack.pos_system) score += 10;
  if (scrapeResult.tech_stack.online_ordering) score += 5;
  if (scrapeResult.data.social && Object.keys(scrapeResult.data.social).length >= 2) score += 10;
  if (scrapeResult.data.order_url) score += 5;

  return Math.min(score, 100);
}

/**
 * Generate insights about a competitor
 */
function generateCompetitorInsights(scrapeResult) {
  const insights = [];

  if (scrapeResult.tech_stack.pos_system) {
    insights.push({
      type: 'technology',
      insight: `Uses ${scrapeResult.tech_stack.pos_system} as their POS system`,
      actionable: scrapeResult.tech_stack.pos_system !== 'Toast',
      action: scrapeResult.tech_stack.pos_system !== 'Toast'
        ? 'Potential Toast migration opportunity'
        : 'Already on Toast - support plan opportunity',
    });
  }

  if (scrapeResult.tech_stack.online_ordering) {
    insights.push({
      type: 'technology',
      insight: `Online ordering via ${scrapeResult.tech_stack.online_ordering}`,
    });
  }

  if (scrapeResult.data.cuisine_hints?.length) {
    insights.push({
      type: 'market',
      insight: `Primary cuisine: ${scrapeResult.data.cuisine_hints[0].cuisine}`,
    });
  }

  if (!scrapeResult.tech_stack.reservation_system) {
    insights.push({
      type: 'opportunity',
      insight: 'No reservation system detected',
      actionable: true,
      action: 'May need reservation system recommendation',
    });
  }

  return insights;
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);

  // Return discovery statistics
  const stats = await env.DB.prepare(`
    SELECT
      COUNT(*) as total_leads,
      COUNT(DISTINCT source) as sources,
      SUM(CASE WHEN source = 'web_discovery' THEN 1 ELSE 0 END) as web_discovered,
      SUM(CASE WHEN current_pos IS NOT NULL THEN 1 ELSE 0 END) as with_pos,
      SUM(CASE WHEN website_url IS NOT NULL THEN 1 ELSE 0 END) as with_website
    FROM restaurant_leads
  `).first();

  return Response.json({
    success: true,
    stats,
    available_methods: [
      { method: 'location', description: 'Find restaurants in a specific location' },
      { method: 'technology', description: 'Find restaurants using/not using specific POS' },
      { method: 'bulk_websites', description: 'Scan multiple restaurant websites' },
      { method: 'competitor', description: 'Deep research on a competitor restaurant' },
    ],
  });
}
