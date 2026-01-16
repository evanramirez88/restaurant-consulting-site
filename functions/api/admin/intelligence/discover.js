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
 */

import { scrapeRestaurantWebsite, detectTechStack } from './_lib/scraper.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const {
      method = 'location',  // 'location', 'technology', 'competitor', 'bulk_websites'
      location,
      technology,
      websites,  // For bulk website scanning
      competitor_url,
      limit = 20,
    } = body;

    let results;

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
      case 'competitor':
        results = await researchCompetitor(env, competitor_url);
        break;
      default:
        return Response.json({
          success: false,
          error: 'Invalid discovery method',
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
  const searchQueries = [
    `restaurants in ${location}`,
    `best restaurants ${location}`,
    `new restaurants ${location}`,
    `${location} restaurant Toast POS`,
    `${location} restaurant Square POS`,
  ];

  // Use Brave Search or web fetch to find restaurants
  // For now, create a structured response that can be enhanced with actual search API

  // Check if we have any existing leads for this location
  const existingLeads = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM restaurant_leads
    WHERE city LIKE ? OR state LIKE ?
  `).bind(`%${location}%`, `%${location}%`).first();

  return {
    method: 'location',
    location,
    existing_leads: existingLeads?.count || 0,
    discovered: discovered,
    search_queries: searchQueries,
    message: `Found ${discovered.length} new leads in ${location}. ${existingLeads?.count || 0} existing leads in database.`,
    next_steps: [
      'Use bulk_websites method with URLs from search results',
      'Import CSV from Yelp/Google Business export',
      'Use BuiltWith data for technology-based discovery',
    ],
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
    SELECT id, company_name, email, website, city, state, lead_score
    FROM restaurant_leads
    WHERE LOWER(current_pos) LIKE ?
    ORDER BY lead_score DESC
    LIMIT ?
  `).bind(`%${technology.toLowerCase()}%`, limit).all();

  // Find leads WITHOUT this technology (potential switch targets)
  const switchTargets = await env.DB.prepare(`
    SELECT id, company_name, email, website, city, state, current_pos, lead_score
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
 * Scan multiple websites in bulk
 */
async function scanBulkWebsites(env, websites) {
  if (!websites || !Array.isArray(websites) || websites.length === 0) {
    return { error: 'Websites array is required', scanned: [] };
  }

  const results = [];
  const leadsCreated = [];
  const errors = [];

  // Limit to 10 websites per request to avoid timeout
  const toScan = websites.slice(0, 10);

  for (const url of toScan) {
    try {
      const scrapeResult = await scrapeRestaurantWebsite(url);

      if (scrapeResult.success) {
        results.push({
          url,
          success: true,
          data: scrapeResult,
        });

        // Try to create a lead from the scraped data
        const email = scrapeResult.contacts.emails?.[0];
        const phone = scrapeResult.contacts.phones?.[0];
        const companyName = scrapeResult.data.page_title?.split(/[|\-–]/)[0]?.trim() || url;

        if (email || phone) {
          // Check if already exists
          const exists = await env.DB.prepare(
            'SELECT id FROM restaurant_leads WHERE email = ? OR website = ?'
          ).bind(email || '', url).first();

          if (!exists) {
            const leadId = 'lead_discover_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);

            await env.DB.prepare(`
              INSERT INTO restaurant_leads (
                id, company_name, email, phone, website, current_pos,
                source, lead_score, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, 'web_discovery', ?, unixepoch())
            `).bind(
              leadId,
              companyName,
              email || null,
              phone || null,
              url,
              scrapeResult.tech_stack.pos_system || null,
              calculateLeadScore(scrapeResult)
            ).run();

            leadsCreated.push({
              id: leadId,
              company: companyName,
              url,
              pos: scrapeResult.tech_stack.pos_system,
            });
          }
        }
      } else {
        results.push({
          url,
          success: false,
          errors: scrapeResult.errors,
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
    new_leads: leadsCreated,
    results,
    errors,
    remaining: websites.length - toScan.length,
    message: websites.length > 10
      ? `Scanned first 10 of ${websites.length} URLs. Submit remaining ${websites.length - 10} in another request.`
      : `Scanned ${toScan.length} websites, created ${leadsCreated.length} new leads.`,
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
    let query = 'SELECT id, company_name, email, city, state, current_pos FROM restaurant_leads WHERE 1=1';
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
      SUM(CASE WHEN website IS NOT NULL THEN 1 ELSE 0 END) as with_website
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
