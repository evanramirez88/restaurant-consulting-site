/**
 * Intelligence Runner API
 *
 * POST /api/admin/intelligence/runner - Trigger manual intelligence run
 * GET /api/admin/intelligence/runner - Get run history and status
 *
 * This provides manual control and monitoring of the intelligence gathering system.
 */

import { unifiedSearch, SearchPriority, getBudgetStatus } from '../../../_shared/search-providers.js';
import { scrapeRestaurantWebsite } from './_lib/scraper.js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// Service areas
const SERVICE_AREAS = [
  { name: 'Provincetown MA', region: 'Cape Cod' },
  { name: 'Hyannis MA', region: 'Cape Cod' },
  { name: 'Chatham MA', region: 'Cape Cod' },
  { name: 'Falmouth MA', region: 'Cape Cod' },
  { name: 'Plymouth MA', region: 'South Shore' },
  { name: 'Quincy MA', region: 'South Shore' },
  { name: 'Boston MA', region: 'Boston' },
  { name: 'Cambridge MA', region: 'Boston' },
  { name: 'Nantucket MA', region: 'Islands' },
];

/**
 * GET - Get runner status and history
 */
export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Get budget status
    const budget = await getBudgetStatus(env.RATE_LIMIT_KV);

    // Get recent run logs
    const recentRuns = await env.DB.prepare(`
      SELECT * FROM intelligence_run_logs
      ORDER BY created_at DESC
      LIMIT 20
    `).all().catch(() => ({ results: [] }));

    // Get lead stats
    const leadStats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN source = 'auto_discovery' THEN 1 ELSE 0 END) as auto_discovered,
        SUM(CASE WHEN enriched_at IS NOT NULL THEN 1 ELSE 0 END) as enriched,
        SUM(CASE WHEN created_at > unixepoch() - 86400 THEN 1 ELSE 0 END) as last_24h,
        SUM(CASE WHEN created_at > unixepoch() - 604800 THEN 1 ELSE 0 END) as last_7d
      FROM restaurant_leads
    `).first().catch(() => ({}));

    // Get today's search count
    const todaySearches = await env.DB.prepare(`
      SELECT SUM(searches_performed) as total
      FROM intelligence_run_logs
      WHERE created_at > unixepoch() - 86400
    `).first().catch(() => ({ total: 0 }));

    return new Response(JSON.stringify({
      success: true,
      status: 'active',
      budget: {
        tavily: budget.tavily,
        exa: budget.exa,
        searches_today: todaySearches?.total || 0,
        daily_limit: 30,
        can_search: budget.tavily.canUse,
      },
      lead_stats: leadStats,
      recent_runs: recentRuns.results || [],
      service_areas: SERVICE_AREAS.length,
      next_scheduled: 'Every 4 hours',
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Runner GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), { status: 500, headers: corsHeaders });
  }
}

/**
 * POST - Trigger manual intelligence run
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json().catch(() => ({}));
    const {
      action = 'run',
      location = null,
      max_searches = 3,
      max_enrichments = 5,
    } = body;

    if (action === 'status') {
      // Just return status
      return onRequestGet(context);
    }

    // Check budget
    const budget = await getBudgetStatus(env.RATE_LIMIT_KV);

    if (!budget.tavily.canUse && !budget.exa.canUse) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Search budget exhausted for today. Try again tomorrow.',
        budget,
      }), { status: 429, headers: corsHeaders });
    }

    const results = {
      started_at: Date.now(),
      searches_performed: 0,
      leads_created: 0,
      leads_enriched: 0,
      new_leads: [],
      errors: [],
    };

    // Determine areas to search
    let areasToSearch = [];
    if (location) {
      areasToSearch = [{ name: location, region: 'Custom' }];
    } else {
      // Pick random areas
      const shuffled = [...SERVICE_AREAS].sort(() => Math.random() - 0.5);
      areasToSearch = shuffled.slice(0, Math.min(max_searches, budget.tavily.dayRemaining));
    }

    console.log(`[Manual Run] Searching ${areasToSearch.length} areas`);

    // Phase 1: Search for new restaurants
    for (const area of areasToSearch) {
      const query = `restaurants in ${area.name}`;

      try {
        console.log(`[Manual Run] Searching: "${query}"`);

        const searchResult = await unifiedSearch(query, env, {
          priority: SearchPriority.NORMAL,
          maxResults: 10,
        });

        results.searches_performed++;

        if (searchResult.success && searchResult.results?.length > 0) {
          console.log(`[Manual Run] Found ${searchResult.results.length} results`);

          for (const result of searchResult.results) {
            if (!result.url) continue;

            // Skip aggregators
            if (['yelp.com', 'tripadvisor.com', 'google.com', 'facebook.com',
                 'instagram.com', 'doordash.com', 'ubereats.com', 'grubhub.com']
                .some(d => result.url.includes(d))) {
              continue;
            }

            // Check if exists
            const domain = new URL(result.url).hostname.replace('www.', '');
            const existing = await env.DB.prepare(`
              SELECT id FROM restaurant_leads WHERE domain = ? OR website_url LIKE ?
            `).bind(domain, `%${domain}%`).first();

            if (existing) continue;

            // Scrape
            try {
              const scrape = await scrapeRestaurantWebsite(result.url);

              if (scrape.success) {
                const leadId = 'lead_manual_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
                const name = scrape.data.page_title?.split(/[|\-–—]/)[0]?.trim() || domain;

                let score = 30;
                if (scrape.contacts.emails?.length) score += 25;
                if (scrape.contacts.phones?.length) score += 15;
                if (scrape.tech_stack.pos_system) score += 10;
                if (scrape.tech_stack.online_ordering) score += 5;
                score = Math.min(score, 100);

                await env.DB.prepare(`
                  INSERT INTO restaurant_leads (
                    id, name, domain, primary_email, primary_phone, website_url,
                    current_pos, online_ordering_provider, reservation_provider,
                    cuisine_primary, service_style, city, state,
                    source, lead_score, status, created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MA', 'manual_discovery', ?, 'prospect', unixepoch(), unixepoch())
                `).bind(
                  leadId, name, domain,
                  scrape.contacts.emails?.[0] || null,
                  scrape.contacts.phones?.[0] || null,
                  result.url,
                  scrape.tech_stack.pos_system || null,
                  scrape.tech_stack.online_ordering || null,
                  scrape.tech_stack.reservation_system || null,
                  scrape.data.cuisine_hints?.[0]?.cuisine || null,
                  scrape.data.service_hints?.[0]?.style || null,
                  area.name.replace(' MA', ''),
                  score
                ).run();

                results.leads_created++;
                results.new_leads.push({
                  id: leadId,
                  name,
                  domain,
                  score,
                  pos: scrape.tech_stack.pos_system,
                  email: scrape.contacts.emails?.[0],
                  phone: scrape.contacts.phones?.[0],
                });

                console.log(`[Manual Run] Created lead: ${name} (score: ${score})`);
              }
            } catch (scrapeErr) {
              console.error(`[Manual Run] Scrape error:`, scrapeErr.message);
            }
          }
        }
      } catch (searchErr) {
        console.error(`[Manual Run] Search error:`, searchErr.message);
        results.errors.push({ area: area.name, error: searchErr.message });
      }

      await new Promise(r => setTimeout(r, 500));
    }

    // Phase 2: Enrich existing leads
    const toEnrich = await env.DB.prepare(`
      SELECT id, name, website_url
      FROM restaurant_leads
      WHERE website_url IS NOT NULL AND website_url != ''
        AND (current_pos IS NULL OR current_pos = '' OR current_pos = 'Unknown')
        AND enriched_at IS NULL
      ORDER BY lead_score DESC
      LIMIT ?
    `).bind(max_enrichments).all();

    for (const lead of (toEnrich.results || [])) {
      try {
        const scrape = await scrapeRestaurantWebsite(lead.website_url);

        if (scrape.success) {
          const updates = [];
          const params = [];

          if (scrape.tech_stack.pos_system) {
            updates.push('current_pos = ?');
            params.push(scrape.tech_stack.pos_system);
          }
          if (scrape.tech_stack.online_ordering) {
            updates.push('online_ordering_provider = ?');
            params.push(scrape.tech_stack.online_ordering);
          }
          if (scrape.contacts.phones?.[0]) {
            updates.push('primary_phone = COALESCE(primary_phone, ?)');
            params.push(scrape.contacts.phones[0]);
          }
          if (scrape.contacts.emails?.[0]) {
            updates.push('primary_email = COALESCE(primary_email, ?)');
            params.push(scrape.contacts.emails[0]);
          }

          if (updates.length > 0) {
            updates.push('enriched_at = unixepoch()');
            updates.push('updated_at = unixepoch()');
            params.push(lead.id);

            await env.DB.prepare(`
              UPDATE restaurant_leads SET ${updates.join(', ')} WHERE id = ?
            `).bind(...params).run();

            results.leads_enriched++;
          }
        }
      } catch (e) {
        console.error(`[Manual Run] Enrich error:`, e.message);
      }

      await new Promise(r => setTimeout(r, 300));
    }

    // Log run
    results.completed_at = Date.now();
    results.duration_ms = results.completed_at - results.started_at;

    await env.DB.prepare(`
      INSERT INTO intelligence_run_logs (
        id, run_type, started_at, completed_at, searches_performed,
        leads_created, leads_enriched, errors, created_at
      ) VALUES (?, 'manual', ?, ?, ?, ?, ?, ?, unixepoch())
    `).bind(
      'run_manual_' + Date.now().toString(36),
      Math.floor(results.started_at / 1000),
      Math.floor(results.completed_at / 1000),
      results.searches_performed,
      results.leads_created,
      results.leads_enriched,
      JSON.stringify(results.errors)
    ).run().catch(e => console.error('Log error:', e));

    return new Response(JSON.stringify({
      success: true,
      message: `Intelligence run completed. Created ${results.leads_created} leads, enriched ${results.leads_enriched}.`,
      ...results,
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Runner POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), { status: 500, headers: corsHeaders });
  }
}
