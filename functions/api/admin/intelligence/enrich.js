/**
 * Lead/Client Enrichment API
 *
 * POST /api/admin/intelligence/enrich - Enrich a lead or client with additional data
 * POST /api/admin/intelligence/enrich/bulk - Bulk enrich multiple leads
 *
 * Enrichment sources:
 * 1. Website scraping (tech stack, contacts, social)
 * 2. AI analysis of available data
 * 3. Cross-referencing with existing database
 * 4. Pattern matching and inference
 */

import { scrapeRestaurantWebsite, enrichLead } from './_lib/scraper.js';

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

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { lead_id, client_id, bulk_ids, options = {} } = body;

    // Bulk enrichment
    if (bulk_ids && Array.isArray(bulk_ids)) {
      return await bulkEnrich(env, bulk_ids, options);
    }

    // Single lead/client enrichment
    const targetId = lead_id || client_id;
    const targetType = lead_id ? 'lead' : 'client';

    if (!targetId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'lead_id, client_id, or bulk_ids is required',
      }), { status: 400, headers: corsHeaders });
    }

    const result = await enrichSingle(env, targetId, targetType, options);

    return new Response(JSON.stringify(result), { headers: corsHeaders });
  } catch (error) {
    console.error('Enrichment error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), { status: 500, headers: corsHeaders });
  }
}

/**
 * Enrich a single lead or client
 */
async function enrichSingle(env, targetId, targetType, options) {
  // Fetch the target record
  let target;
  if (targetType === 'lead') {
    target = await env.DB.prepare(
      'SELECT * FROM restaurant_leads WHERE id = ?'
    ).bind(targetId).first();
  } else {
    target = await env.DB.prepare(`
      SELECT c.*, cp.website, cp.pos_system
      FROM clients c
      LEFT JOIN client_profiles cp ON c.id = cp.client_id
      WHERE c.id = ?
    `).bind(targetId).first();
  }

  if (!target) {
    return {
      success: false,
      error: `${targetType} not found`,
    };
  }

  const enrichmentResults = {
    target_id: targetId,
    target_type: targetType,
    original_data: { ...target },
    enriched_fields: {},
    facts_created: 0,
    sources_checked: [],
    confidence_scores: {},
    timestamp: Date.now(),
  };

  // 1. Website scraping if URL available
  const website = target.website_url || target.website || target.url;
  if (website) {
    enrichmentResults.sources_checked.push('website');
    const scrapeResult = await scrapeRestaurantWebsite(website);

    if (scrapeResult.success) {
      // Extract and apply enrichments
      const websiteEnrichments = extractWebsiteEnrichments(target, scrapeResult);
      Object.assign(enrichmentResults.enriched_fields, websiteEnrichments.fields);
      Object.assign(enrichmentResults.confidence_scores, websiteEnrichments.confidence);

      // Create atomic facts for client enrichment
      if (targetType === 'client' || options.create_facts) {
        const clientId = targetType === 'client' ? targetId : null;
        if (clientId) {
          for (const [field, value] of Object.entries(websiteEnrichments.fields)) {
            if (value && websiteEnrichments.confidence[field] >= 0.6) {
              const factId = 'fact_enrich_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
              await env.DB.prepare(`
                INSERT INTO client_atomic_facts (
                  id, client_id, field_name, field_value, source, confidence, status, created_at
                ) VALUES (?, ?, ?, ?, 'web_scrape', ?, 'pending', unixepoch())
              `).bind(factId, clientId, field, String(value), websiteEnrichments.confidence[field]).run();
              enrichmentResults.facts_created++;
            }
          }
        }
      }
    }
  }

  // 2. Cross-reference with existing data
  enrichmentResults.sources_checked.push('database_crossref');
  const crossRef = await crossReferenceData(env, target);
  if (crossRef.found) {
    Object.assign(enrichmentResults.enriched_fields, crossRef.fields);
    Object.assign(enrichmentResults.confidence_scores, crossRef.confidence);
  }

  // 3. Infer missing data
  enrichmentResults.sources_checked.push('inference');
  const inferred = inferMissingData(target, enrichmentResults.enriched_fields);
  Object.assign(enrichmentResults.enriched_fields, inferred.fields);
  Object.assign(enrichmentResults.confidence_scores, inferred.confidence);

  // 4. Update the target record with high-confidence enrichments
  if (options.auto_apply !== false && Object.keys(enrichmentResults.enriched_fields).length > 0) {
    await applyEnrichments(env, targetId, targetType, enrichmentResults);
  }

  return {
    success: true,
    ...enrichmentResults,
    message: `Enriched ${Object.keys(enrichmentResults.enriched_fields).length} fields from ${enrichmentResults.sources_checked.length} sources`,
  };
}

/**
 * Bulk enrich multiple leads
 */
async function bulkEnrich(env, ids, options) {
  const results = {
    total: ids.length,
    processed: 0,
    enriched: 0,
    failed: 0,
    details: [],
  };

  // Limit to 20 at a time
  const toProcess = ids.slice(0, 20);

  for (const id of toProcess) {
    try {
      const result = await enrichSingle(env, id, 'lead', { ...options, auto_apply: true });
      results.processed++;

      if (result.success && Object.keys(result.enriched_fields || {}).length > 0) {
        results.enriched++;
        results.details.push({
          id,
          success: true,
          fields_enriched: Object.keys(result.enriched_fields).length,
        });
      } else {
        results.details.push({
          id,
          success: true,
          fields_enriched: 0,
        });
      }
    } catch (error) {
      results.failed++;
      results.details.push({
        id,
        success: false,
        error: error.message,
      });
    }
  }

  return {
    success: true,
    ...results,
    remaining: ids.length - toProcess.length,
    message: `Processed ${results.processed} leads, enriched ${results.enriched}, ${results.failed} failed`,
  };
}

/**
 * Extract enrichment data from website scrape results
 */
function extractWebsiteEnrichments(target, scrapeResult) {
  const fields = {};
  const confidence = {};

  // POS system
  if (scrapeResult.tech_stack.pos_system && !target.current_pos && !target.pos_system) {
    fields.pos_system = scrapeResult.tech_stack.pos_system;
    confidence.pos_system = 0.9;
  }

  // Online ordering
  if (scrapeResult.tech_stack.online_ordering) {
    fields.online_ordering = scrapeResult.tech_stack.online_ordering;
    confidence.online_ordering = 0.9;
  }

  // Reservation system
  if (scrapeResult.tech_stack.reservation_system) {
    fields.reservation_system = scrapeResult.tech_stack.reservation_system;
    confidence.reservation_system = 0.9;
  }

  // Phone
  if (scrapeResult.contacts.phones?.length && !target.phone) {
    fields.phone = scrapeResult.contacts.phones[0];
    confidence.phone = 0.85;
  }

  // Email
  if (scrapeResult.contacts.emails?.length && !target.email) {
    fields.email = scrapeResult.contacts.emails[0];
    confidence.email = 0.8;
  }

  // Social media
  if (scrapeResult.data.social) {
    if (scrapeResult.data.social.facebook) {
      fields.facebook_url = scrapeResult.data.social.facebook;
      confidence.facebook_url = 0.95;
    }
    if (scrapeResult.data.social.instagram) {
      fields.instagram_handle = scrapeResult.data.social.instagram;
      confidence.instagram_handle = 0.95;
    }
    if (scrapeResult.data.social.yelp) {
      fields.yelp_url = scrapeResult.data.social.yelp;
      confidence.yelp_url = 0.95;
    }
    if (scrapeResult.data.social.google_business) {
      fields.google_business_url = scrapeResult.data.social.google_business;
      confidence.google_business_url = 0.95;
    }
  }

  // Cuisine type
  if (scrapeResult.data.cuisine_hints?.length) {
    fields.cuisine_type = scrapeResult.data.cuisine_hints[0].cuisine;
    confidence.cuisine_type = Math.min(0.9, 0.5 + (scrapeResult.data.cuisine_hints[0].mentions * 0.1));
  }

  // Service style
  if (scrapeResult.data.service_hints?.length) {
    fields.service_style = scrapeResult.data.service_hints[0].style;
    confidence.service_style = Math.min(0.85, 0.5 + (scrapeResult.data.service_hints[0].mentions * 0.1));
  }

  // Menu URL
  if (scrapeResult.data.menu_url) {
    fields.menu_url = scrapeResult.data.menu_url;
    confidence.menu_url = 0.9;
  }

  // Order URL
  if (scrapeResult.data.order_url) {
    fields.order_url = scrapeResult.data.order_url;
    confidence.order_url = 0.9;
  }

  return { fields, confidence };
}

/**
 * Cross-reference with existing database records
 */
async function crossReferenceData(env, target) {
  const result = { found: false, fields: {}, confidence: {} };

  // Try to find matches by email or company name
  const email = target.email;
  const company = target.company_name || target.company;

  if (email) {
    // Check if this email exists in clients
    const client = await env.DB.prepare(`
      SELECT c.*, cp.*
      FROM clients c
      LEFT JOIN client_profiles cp ON c.id = cp.client_id
      WHERE c.email = ?
    `).bind(email).first();

    if (client) {
      result.found = true;
      if (client.pos_system && !target.current_pos) {
        result.fields.pos_system = client.pos_system;
        result.confidence.pos_system = 0.95;
      }
      if (client.cuisine_type) {
        result.fields.cuisine_type = client.cuisine_type;
        result.confidence.cuisine_type = 0.9;
      }
    }
  }

  if (company) {
    // Look for similar companies
    const similar = await env.DB.prepare(`
      SELECT current_pos, COUNT(*) as count
      FROM restaurant_leads
      WHERE name LIKE ?
      AND current_pos IS NOT NULL
      GROUP BY current_pos
      ORDER BY count DESC
      LIMIT 1
    `).bind(`%${company}%`).first();

    if (similar && similar.count >= 2) {
      result.found = true;
      result.fields.likely_chain = true;
      result.confidence.likely_chain = 0.7;
    }
  }

  return result;
}

/**
 * Infer missing data based on patterns
 */
function inferMissingData(target, existingEnrichments) {
  const fields = {};
  const confidence = {};

  const company = (target.company_name || target.company || '').toLowerCase();

  // Infer cuisine from company name
  if (!existingEnrichments.cuisine_type) {
    const cuisinePatterns = {
      'Italian': /pizz|pasta|italian|trattoria|ristorante/i,
      'Mexican': /taco|mexican|burrito|cantina|taqueria/i,
      'Chinese': /chinese|wok|dragon|panda|golden/i,
      'Japanese': /sushi|ramen|japanese|sakura|tokyo/i,
      'Seafood': /seafood|oyster|lobster|fish|crab|clam/i,
      'American': /grill|steakhouse|bbq|burger|diner/i,
      'Thai': /thai|bangkok|pad/i,
      'Indian': /indian|curry|tandoor|masala/i,
    };

    for (const [cuisine, pattern] of Object.entries(cuisinePatterns)) {
      if (pattern.test(company)) {
        fields.cuisine_type = cuisine;
        confidence.cuisine_type = 0.6;
        break;
      }
    }
  }

  // Infer service style from company name
  if (!existingEnrichments.service_style) {
    if (/cafe|coffee|bakery|espresso/i.test(company)) {
      fields.service_style = 'Cafe';
      confidence.service_style = 0.65;
    } else if (/bar|pub|tavern|brewery|taproom/i.test(company)) {
      fields.service_style = 'Bar/Pub';
      confidence.service_style = 0.7;
    } else if (/bistro|fine|upscale/i.test(company)) {
      fields.service_style = 'Fine Dining';
      confidence.service_style = 0.5;
    }
  }

  // Infer bar program
  if (/bar|pub|tavern|brewery|cocktail|wine/i.test(company)) {
    fields.bar_program = 'Full Bar';
    confidence.bar_program = 0.6;
  }

  return { fields, confidence };
}

/**
 * Apply enrichments to the database
 */
async function applyEnrichments(env, targetId, targetType, enrichmentResults) {
  const highConfidenceFields = {};

  for (const [field, value] of Object.entries(enrichmentResults.enriched_fields)) {
    if (enrichmentResults.confidence_scores[field] >= 0.7) {
      highConfidenceFields[field] = value;
    }
  }

  if (Object.keys(highConfidenceFields).length === 0) return;

  if (targetType === 'lead') {
    // Map enriched fields to restaurant_leads columns
    const fieldMapping = {
      pos_system: 'current_pos',
      phone: 'primary_phone',
      email: 'primary_email',
      cuisine_type: 'cuisine_primary',
      website: 'website_url',
    };

    const updates = [];
    const values = [];

    for (const [field, value] of Object.entries(highConfidenceFields)) {
      const column = fieldMapping[field] || field;
      if (['current_pos', 'primary_phone', 'primary_email', 'website_url', 'cuisine_primary', 'service_style'].includes(column)) {
        updates.push(`${column} = ?`);
        values.push(value);
      }
    }

    if (updates.length > 0) {
      values.push(targetId);
      await env.DB.prepare(`
        UPDATE restaurant_leads
        SET ${updates.join(', ')}, updated_at = unixepoch()
        WHERE id = ?
      `).bind(...values).run();
    }
  } else {
    // For clients, update client_profiles
    // First ensure profile exists
    const profile = await env.DB.prepare(
      'SELECT id FROM client_profiles WHERE client_id = ?'
    ).bind(targetId).first();

    if (profile) {
      const updates = [];
      const values = [];

      for (const [field, value] of Object.entries(highConfidenceFields)) {
        if (['pos_system', 'cuisine_type', 'service_style', 'bar_program', 'website',
          'facebook_url', 'instagram_handle', 'yelp_url', 'google_business_url',
          'online_ordering', 'reservation_system'].includes(field)) {
          updates.push(`${field} = ?`);
          values.push(value);
        }
      }

      if (updates.length > 0) {
        values.push(targetId);
        await env.DB.prepare(`
          UPDATE client_profiles
          SET ${updates.join(', ')}, updated_at = unixepoch()
          WHERE client_id = ?
        `).bind(...values).run();
      }
    }
  }
}

/**
 * GET endpoint to check enrichment capabilities
 */
export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const leadId = url.searchParams.get('lead_id');

  if (leadId) {
    // Return enrichment potential for a specific lead
    const lead = await env.DB.prepare(
      'SELECT * FROM restaurant_leads WHERE id = ?'
    ).bind(leadId).first();

    if (!lead) {
      return new Response(JSON.stringify({ success: false, error: 'Lead not found' }), { status: 404, headers: corsHeaders });
    }

    const potential = {
      has_website: !!lead.website,
      has_email: !!lead.email,
      has_phone: !!lead.phone,
      has_pos: !!lead.current_pos,
      enrichable_via_website: !!lead.website,
      missing_fields: [],
    };

    if (!lead.current_pos) potential.missing_fields.push('pos_system');
    if (!lead.email) potential.missing_fields.push('email');
    if (!lead.phone) potential.missing_fields.push('phone');

    return new Response(JSON.stringify({
      success: true,
      lead_id: leadId,
      potential,
    }), { headers: corsHeaders });
  }

  // Return stats on enrichable leads
  const stats = await env.DB.prepare(`
    SELECT
      COUNT(*) as total_leads,
      SUM(CASE WHEN website_url IS NOT NULL AND website_url != '' THEN 1 ELSE 0 END) as with_website,
      SUM(CASE WHEN current_pos IS NULL OR current_pos = '' THEN 1 ELSE 0 END) as missing_pos,
      SUM(CASE WHEN primary_email IS NULL OR primary_email = '' THEN 1 ELSE 0 END) as missing_email,
      SUM(CASE WHEN primary_phone IS NULL OR primary_phone = '' THEN 1 ELSE 0 END) as missing_phone
    FROM restaurant_leads
  `).first();

  const enrichableCount = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM restaurant_leads
    WHERE website_url IS NOT NULL AND website_url != ''
    AND (current_pos IS NULL OR primary_email IS NULL OR primary_phone IS NULL)
  `).first();

  return new Response(JSON.stringify({
    success: true,
    stats: {
      ...stats,
      enrichable_leads: enrichableCount?.count || 0,
    },
    capabilities: [
      'Website scraping for tech stack detection',
      'Contact information extraction',
      'Social media profile discovery',
      'Cuisine and service style detection',
      'Cross-database reference matching',
      'Pattern-based inference',
    ],
  }), { headers: corsHeaders });
}
