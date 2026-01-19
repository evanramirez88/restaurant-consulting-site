/**
 * Research Sessions API
 *
 * GET /api/admin/intelligence/research - List research sessions
 * POST /api/admin/intelligence/research - Start new research
 *
 * Research types:
 * - discovery: Find new information about a client/lead
 * - enrichment: Fill in missing data fields
 * - verification: Verify existing data accuracy
 */

import { unifiedSearch, SearchPriority } from '../../../_shared/search-providers.js';
import { scrapeRestaurantWebsite } from './_lib/scraper.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const clientId = url.searchParams.get('client_id');
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') || '20');

  try {
    let query = `
      SELECT
        rs.*,
        c.name as client_name,
        c.company as client_company,
        ai.name as ai_provider_name
      FROM research_sessions rs
      LEFT JOIN clients c ON rs.client_id = c.id
      LEFT JOIN ai_providers ai ON rs.ai_provider_id = ai.id
      WHERE 1=1
    `;
    const params = [];

    if (clientId) {
      query += ' AND rs.client_id = ?';
      params.push(clientId);
    }
    if (status) {
      query += ' AND rs.status = ?';
      params.push(status);
    }

    query += ' ORDER BY rs.created_at DESC LIMIT ?';
    params.push(limit);

    const sessions = await env.DB.prepare(query).bind(...params).all();

    return Response.json({
      success: true,
      sessions: sessions.results || [],
    });
  } catch (error) {
    console.error('Research GET error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { client_id, research_type, query: searchQuery } = body;

    if (!client_id || !research_type) {
      return Response.json({
        success: false,
        error: 'client_id and research_type are required',
      }, { status: 400 });
    }

    // Get client info
    const client = await env.DB.prepare(
      'SELECT id, name, company FROM clients WHERE id = ?'
    ).bind(client_id).first();

    if (!client) {
      return Response.json({
        success: false,
        error: 'Client not found',
      }, { status: 404 });
    }

    // Get default AI provider
    const defaultProvider = await env.DB.prepare(
      'SELECT id, name FROM ai_providers WHERE is_default = 1 AND is_active = 1'
    ).first();

    // Create research session
    const sessionId = 'research_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    const title = `${research_type} - ${client.company || client.name}`;

    await env.DB.prepare(`
      INSERT INTO research_sessions (
        id, title, client_id, target_type, research_type, query,
        status, ai_provider_id, started_at
      ) VALUES (?, ?, ?, 'client', ?, ?, 'in_progress', ?, unixepoch())
    `).bind(
      sessionId, title, client_id, research_type, searchQuery || null,
      defaultProvider?.id || null
    ).run();

    // Perform actual research using search providers and web scraping
    const researchResults = await performActualResearch(env, client, research_type, searchQuery);

    // Insert discovered facts
    for (const fact of researchResults.facts) {
      const factId = 'fact_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
      await env.DB.prepare(`
        INSERT INTO client_atomic_facts (
          id, client_id, field_name, field_value, original_text,
          source, confidence, status, ai_provider_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `).bind(
        factId, client_id, fact.field, fact.value, fact.source_text,
        fact.source, fact.confidence, defaultProvider?.id || null
      ).run();
    }

    // Update session as completed
    await env.DB.prepare(`
      UPDATE research_sessions
      SET status = 'completed', facts_found = ?, completed_at = unixepoch()
      WHERE id = ?
    `).bind(researchResults.facts.length, sessionId).run();

    return Response.json({
      success: true,
      session_id: sessionId,
      facts_found: researchResults.facts.length,
      sources_used: researchResults.sources,
      scrape_results: researchResults.scrapeData,
      search_results: researchResults.searchData,
      message: `Research completed. Found ${researchResults.facts.length} facts from ${researchResults.sources.length} sources.`,
    });
  } catch (error) {
    console.error('Research POST error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * Perform actual research using search providers and web scraping
 */
async function performActualResearch(env, client, researchType, customQuery) {
  const results = {
    facts: [],
    sources: [],
    scrapeData: null,
    searchData: [],
  };

  const companyName = client.company || client.name;

  // Step 1: If we have a website, scrape it for data
  if (client.website) {
    try {
      const scrapeResult = await scrapeRestaurantWebsite(client.website);
      results.scrapeData = scrapeResult;

      if (scrapeResult.success) {
        results.sources.push('website_scrape');

        // Extract facts from scrape
        if (scrapeResult.tech_stack.pos_system) {
          results.facts.push({
            field: 'current_pos',
            value: scrapeResult.tech_stack.pos_system,
            source: 'website_scrape',
            source_text: `Detected from ${client.website}`,
            confidence: 0.9,
          });
        }

        if (scrapeResult.tech_stack.online_ordering) {
          results.facts.push({
            field: 'online_ordering_provider',
            value: scrapeResult.tech_stack.online_ordering,
            source: 'website_scrape',
            source_text: `Detected from ${client.website}`,
            confidence: 0.9,
          });
        }

        if (scrapeResult.tech_stack.reservation_system) {
          results.facts.push({
            field: 'reservation_provider',
            value: scrapeResult.tech_stack.reservation_system,
            source: 'website_scrape',
            source_text: `Detected from ${client.website}`,
            confidence: 0.9,
          });
        }

        if (scrapeResult.contacts.phones?.length) {
          results.facts.push({
            field: 'phone',
            value: scrapeResult.contacts.phones[0],
            source: 'website_scrape',
            source_text: `Found on ${client.website}`,
            confidence: 0.85,
          });
        }

        if (scrapeResult.contacts.emails?.length) {
          results.facts.push({
            field: 'email',
            value: scrapeResult.contacts.emails[0],
            source: 'website_scrape',
            source_text: `Found on ${client.website}`,
            confidence: 0.85,
          });
        }

        if (scrapeResult.data.cuisine_hints?.length) {
          results.facts.push({
            field: 'cuisine_type',
            value: scrapeResult.data.cuisine_hints[0].cuisine,
            source: 'website_scrape',
            source_text: `${scrapeResult.data.cuisine_hints[0].mentions} mentions on website`,
            confidence: 0.75,
          });
        }

        if (scrapeResult.data.service_hints?.length) {
          results.facts.push({
            field: 'service_style',
            value: scrapeResult.data.service_hints[0].style,
            source: 'website_scrape',
            source_text: `${scrapeResult.data.service_hints[0].mentions} mentions on website`,
            confidence: 0.7,
          });
        }

        // Social media links as facts
        if (scrapeResult.data.social) {
          for (const [platform, url] of Object.entries(scrapeResult.data.social)) {
            results.facts.push({
              field: `social_${platform}`,
              value: url,
              source: 'website_scrape',
              source_text: `Found on ${client.website}`,
              confidence: 0.95,
            });
          }
        }
      }
    } catch (error) {
      console.error('Website scrape error:', error.message);
    }
  }

  // Step 2: Perform web searches based on research type
  const hasSearchProviders = env.TAVILY_API_KEY || env.EXA_API_KEY;

  if (hasSearchProviders) {
    const searchQueries = [];

    if (researchType === 'discovery' || researchType === 'enrichment') {
      searchQueries.push(`"${companyName}" restaurant`);
      if (client.city) {
        searchQueries.push(`"${companyName}" ${client.city} restaurant`);
      }
    }

    if (researchType === 'verification') {
      searchQueries.push(`"${companyName}" menu`);
      searchQueries.push(`"${companyName}" reviews`);
    }

    if (customQuery) {
      searchQueries.unshift(customQuery);
    }

    // Execute searches (limit to 2 to conserve budget)
    for (const query of searchQueries.slice(0, 2)) {
      try {
        const searchResult = await unifiedSearch(query, env, {
          priority: SearchPriority.NORMAL,
          maxResults: 5,
        });

        if (searchResult.success && searchResult.results?.length) {
          results.sources.push('web_search');
          results.searchData.push({
            query,
            provider: searchResult.provider,
            results: searchResult.results,
            fromCache: searchResult.fromCache,
          });

          // Extract facts from search results
          for (const result of searchResult.results) {
            // Check for contact info in snippets
            const phoneMatch = result.content?.match(/(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/);
            if (phoneMatch && !results.facts.find(f => f.field === 'phone')) {
              results.facts.push({
                field: 'phone',
                value: phoneMatch[0],
                source: 'web_search',
                source_text: `Found in search result: ${result.url}`,
                confidence: 0.6,
              });
            }

            // Check for potential website
            if (!client.website && result.url && !result.url.includes('yelp.com') && !result.url.includes('tripadvisor.com')) {
              const urlDomain = new URL(result.url).hostname.replace('www.', '');
              if (companyName.toLowerCase().replace(/[^a-z0-9]/g, '').includes(urlDomain.split('.')[0].replace(/[^a-z0-9]/g, ''))) {
                results.facts.push({
                  field: 'website',
                  value: result.url,
                  source: 'web_search',
                  source_text: `Potential website found via search`,
                  confidence: 0.5,
                });
              }
            }
          }
        }
      } catch (error) {
        console.error(`Search error for "${query}":`, error.message);
      }
    }
  }

  // If no facts found and no web scrape possible, add a note
  if (results.facts.length === 0) {
    results.facts.push({
      field: 'research_note',
      value: 'No automated data found - manual research recommended',
      source: 'system',
      source_text: `Searched for ${companyName} but found no extractable data`,
      confidence: 1.0,
    });
  }

  return results;
}
