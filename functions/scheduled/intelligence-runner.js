/**
 * Autonomous Intelligence Runner
 *
 * Scheduled Worker that runs every 4 hours to:
 * 1. Search for restaurants in target service areas
 * 2. Scrape and enrich leads with websites
 * 3. Discover new restaurants via web search
 * 4. Update lead scores and data quality
 *
 * Respects API rate limits:
 * - Tavily: ~30 searches/day (1000/month free tier)
 * - Exa: ~5 searches/day (1000 total credits, reserve most)
 *
 * Service Areas:
 * - Cape Cod (Provincetown to Sandwich)
 * - South Shore (Plymouth to Quincy)
 * - Boston Metro
 * - Islands (Martha's Vineyard, Nantucket)
 */

import { unifiedSearch, SearchPriority, getBudgetStatus } from '../../_shared/search-providers.js';
import { scrapeRestaurantWebsite } from '../api/admin/intelligence/_lib/scraper.js';

// Service areas to search
const SERVICE_AREAS = [
  // Cape Cod (Primary)
  { name: 'Provincetown MA', region: 'Cape Cod' },
  { name: 'Truro MA', region: 'Cape Cod' },
  { name: 'Wellfleet MA', region: 'Cape Cod' },
  { name: 'Eastham MA', region: 'Cape Cod' },
  { name: 'Orleans MA', region: 'Cape Cod' },
  { name: 'Brewster MA', region: 'Cape Cod' },
  { name: 'Chatham MA', region: 'Cape Cod' },
  { name: 'Harwich MA', region: 'Cape Cod' },
  { name: 'Dennis MA', region: 'Cape Cod' },
  { name: 'Yarmouth MA', region: 'Cape Cod' },
  { name: 'Barnstable MA', region: 'Cape Cod' },
  { name: 'Hyannis MA', region: 'Cape Cod' },
  { name: 'Mashpee MA', region: 'Cape Cod' },
  { name: 'Falmouth MA', region: 'Cape Cod' },
  { name: 'Sandwich MA', region: 'Cape Cod' },
  { name: 'Bourne MA', region: 'Cape Cod' },

  // South Shore
  { name: 'Plymouth MA', region: 'South Shore' },
  { name: 'Duxbury MA', region: 'South Shore' },
  { name: 'Marshfield MA', region: 'South Shore' },
  { name: 'Scituate MA', region: 'South Shore' },
  { name: 'Cohasset MA', region: 'South Shore' },
  { name: 'Hingham MA', region: 'South Shore' },
  { name: 'Weymouth MA', region: 'South Shore' },
  { name: 'Quincy MA', region: 'South Shore' },

  // Boston Metro
  { name: 'Boston MA', region: 'Boston' },
  { name: 'Cambridge MA', region: 'Boston' },
  { name: 'Somerville MA', region: 'Boston' },
  { name: 'Brookline MA', region: 'Boston' },

  // Islands
  { name: 'Nantucket MA', region: 'Islands' },
  { name: 'Martha\'s Vineyard MA', region: 'Islands' },
  { name: 'Edgartown MA', region: 'Islands' },
  { name: 'Oak Bluffs MA', region: 'Islands' },
];

// Search query templates
const SEARCH_QUERIES = [
  'restaurants in {location}',
  'new restaurants {location} 2024 2025',
  'best restaurants {location}',
  '{location} restaurant Toast POS',
  '{location} restaurant Square POS',
];

/**
 * Main scheduled handler - runs on cron schedule
 */
export async function scheduled(event, env, ctx) {
  console.log('[Intelligence Runner] Starting scheduled run at', new Date().toISOString());

  const results = {
    started_at: Date.now(),
    searches_performed: 0,
    leads_created: 0,
    leads_enriched: 0,
    errors: [],
    budget: null,
  };

  try {
    // Check budget status
    const budget = await getBudgetStatus(env.RATE_LIMIT_KV);
    results.budget = budget;

    console.log('[Intelligence Runner] Budget status:', JSON.stringify(budget));

    // Determine how many searches we can do this run
    // With 30/day budget and 6 runs/day (every 4 hours), that's ~5 searches per run
    const maxSearches = Math.min(5, budget.tavily.dayRemaining);

    if (maxSearches <= 0) {
      console.log('[Intelligence Runner] Daily search budget exhausted, skipping searches');
    } else {
      // Pick random locations to search (different each run)
      const shuffledAreas = [...SERVICE_AREAS].sort(() => Math.random() - 0.5);
      const areasToSearch = shuffledAreas.slice(0, maxSearches);

      for (const area of areasToSearch) {
        // Pick a random query template
        const queryTemplate = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
        const query = queryTemplate.replace('{location}', area.name);

        console.log(`[Intelligence Runner] Searching: "${query}"`);

        try {
          const searchResult = await unifiedSearch(query, env, {
            priority: SearchPriority.LOW, // Use LOW to conserve credits
            maxResults: 10,
            topic: 'general',
          });

          results.searches_performed++;

          if (searchResult.success && searchResult.results?.length > 0) {
            console.log(`[Intelligence Runner] Found ${searchResult.results.length} results`);

            // Process each result
            for (const result of searchResult.results) {
              if (!result.url) continue;

              // Skip aggregator sites
              if (result.url.includes('yelp.com') ||
                  result.url.includes('tripadvisor.com') ||
                  result.url.includes('google.com/maps') ||
                  result.url.includes('facebook.com') ||
                  result.url.includes('instagram.com') ||
                  result.url.includes('doordash.com') ||
                  result.url.includes('ubereats.com') ||
                  result.url.includes('grubhub.com')) {
                continue;
              }

              // Check if we already have this domain
              const domain = new URL(result.url).hostname.replace('www.', '');

              const existingLead = await env.DB.prepare(`
                SELECT id FROM restaurant_leads
                WHERE domain = ? OR website_url LIKE ?
              `).bind(domain, `%${domain}%`).first();

              if (existingLead) {
                console.log(`[Intelligence Runner] Skipping existing lead: ${domain}`);
                continue;
              }

              // Try to scrape the website
              console.log(`[Intelligence Runner] Scraping: ${result.url}`);

              try {
                const scrapeResult = await scrapeRestaurantWebsite(result.url);

                if (scrapeResult.success) {
                  // Create new lead
                  const leadId = 'lead_auto_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
                  const restaurantName = scrapeResult.data.page_title?.split(/[|\-–—]/)[0]?.trim() || domain;

                  // Calculate lead score
                  let leadScore = 30;
                  if (scrapeResult.contacts.emails?.length) leadScore += 25;
                  if (scrapeResult.contacts.phones?.length) leadScore += 15;
                  if (scrapeResult.tech_stack.pos_system) leadScore += 10;
                  if (scrapeResult.tech_stack.online_ordering) leadScore += 5;
                  if (scrapeResult.data.social && Object.keys(scrapeResult.data.social).length >= 2) leadScore += 10;
                  leadScore = Math.min(leadScore, 100);

                  await env.DB.prepare(`
                    INSERT INTO restaurant_leads (
                      id, name, domain, primary_email, primary_phone, website_url,
                      current_pos, online_ordering_provider, reservation_provider,
                      cuisine_primary, service_style, city, state,
                      source, lead_score, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MA', 'auto_discovery', ?, 'prospect', unixepoch(), unixepoch())
                  `).bind(
                    leadId,
                    restaurantName,
                    domain,
                    scrapeResult.contacts.emails?.[0] || null,
                    scrapeResult.contacts.phones?.[0] || null,
                    result.url,
                    scrapeResult.tech_stack.pos_system || null,
                    scrapeResult.tech_stack.online_ordering || null,
                    scrapeResult.tech_stack.reservation_system || null,
                    scrapeResult.data.cuisine_hints?.[0]?.cuisine || null,
                    scrapeResult.data.service_hints?.[0]?.style || null,
                    area.name.replace(' MA', ''),
                    leadScore
                  ).run();

                  results.leads_created++;
                  console.log(`[Intelligence Runner] Created lead: ${restaurantName} (score: ${leadScore})`);
                }
              } catch (scrapeError) {
                console.error(`[Intelligence Runner] Scrape error for ${result.url}:`, scrapeError.message);
              }
            }
          }
        } catch (searchError) {
          console.error(`[Intelligence Runner] Search error for ${area.name}:`, searchError.message);
          results.errors.push({ area: area.name, error: searchError.message });
        }

        // Small delay between searches to be nice to APIs
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Phase 2: Enrich existing leads with websites but missing data
    const leadsToEnrich = await env.DB.prepare(`
      SELECT id, name, website_url
      FROM restaurant_leads
      WHERE website_url IS NOT NULL
        AND website_url != ''
        AND (current_pos IS NULL OR current_pos = '' OR current_pos = 'Unknown')
        AND enriched_at IS NULL
      ORDER BY lead_score DESC
      LIMIT 5
    `).all();

    console.log(`[Intelligence Runner] Found ${leadsToEnrich.results?.length || 0} leads to enrich`);

    for (const lead of (leadsToEnrich.results || [])) {
      try {
        console.log(`[Intelligence Runner] Enriching: ${lead.name}`);
        const scrapeResult = await scrapeRestaurantWebsite(lead.website_url);

        if (scrapeResult.success) {
          const updates = [];
          const params = [];

          if (scrapeResult.tech_stack.pos_system) {
            updates.push('current_pos = ?');
            params.push(scrapeResult.tech_stack.pos_system);
          }
          if (scrapeResult.tech_stack.online_ordering) {
            updates.push('online_ordering_provider = ?');
            params.push(scrapeResult.tech_stack.online_ordering);
          }
          if (scrapeResult.tech_stack.reservation_system) {
            updates.push('reservation_provider = ?');
            params.push(scrapeResult.tech_stack.reservation_system);
          }
          if (scrapeResult.contacts.phones?.[0] && !lead.primary_phone) {
            updates.push('primary_phone = ?');
            params.push(scrapeResult.contacts.phones[0]);
          }
          if (scrapeResult.contacts.emails?.[0] && !lead.primary_email) {
            updates.push('primary_email = ?');
            params.push(scrapeResult.contacts.emails[0]);
          }
          if (scrapeResult.data.cuisine_hints?.[0]?.cuisine) {
            updates.push('cuisine_primary = ?');
            params.push(scrapeResult.data.cuisine_hints[0].cuisine);
          }
          if (scrapeResult.data.service_hints?.[0]?.style) {
            updates.push('service_style = ?');
            params.push(scrapeResult.data.service_hints[0].style);
          }

          if (updates.length > 0) {
            updates.push('enriched_at = unixepoch()');
            updates.push('updated_at = unixepoch()');
            params.push(lead.id);

            await env.DB.prepare(`
              UPDATE restaurant_leads SET ${updates.join(', ')} WHERE id = ?
            `).bind(...params).run();

            results.leads_enriched++;
            console.log(`[Intelligence Runner] Enriched lead: ${lead.name} with ${updates.length - 2} fields`);
          }
        }
      } catch (enrichError) {
        console.error(`[Intelligence Runner] Enrich error for ${lead.name}:`, enrichError.message);
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Log results
    results.completed_at = Date.now();
    results.duration_ms = results.completed_at - results.started_at;

    console.log('[Intelligence Runner] Run completed:', JSON.stringify(results));

    // Store run log
    await env.DB.prepare(`
      INSERT INTO intelligence_run_logs (
        id, run_type, started_at, completed_at, searches_performed,
        leads_created, leads_enriched, errors, created_at
      ) VALUES (?, 'scheduled', ?, ?, ?, ?, ?, ?, unixepoch())
    `).bind(
      'run_' + Date.now().toString(36),
      Math.floor(results.started_at / 1000),
      Math.floor(results.completed_at / 1000),
      results.searches_performed,
      results.leads_created,
      results.leads_enriched,
      JSON.stringify(results.errors)
    ).run();

  } catch (error) {
    console.error('[Intelligence Runner] Fatal error:', error);
    results.errors.push({ fatal: error.message });
  }

  return results;
}

export default {
  scheduled,
};
