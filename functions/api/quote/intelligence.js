/**
 * Quote Builder Intelligence API
 *
 * GET /api/quote/intelligence?lead_id=<id> or ?client_id=<id>
 *
 * Fetches comprehensive intelligence data for pre-populating
 * Quote Builder with restaurant characteristics, DCI factors,
 * and configuration recommendations.
 *
 * Integration Points:
 * - client_profiles (known clients)
 * - restaurant_leads (prospects)
 * - restaurant_classifications (AI classifications)
 * - client_atomic_facts (verified facts)
 * - toast_config_templates (configuration recommendations)
 * - scraped_data_cache (web-scraped intelligence)
 * - lead_verifications (validated data)
 */

import { getCorsOrigin } from '../../_shared/auth.js';
import { rateLimit, RATE_LIMITS } from '../../_shared/rate-limit.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

// Service style to DCI modifier mapping
const SERVICE_STYLE_MODIFIERS = {
  'fine_dining': { modifier: 1.25, label: 'Fine Dining (+25%)' },
  'upscale_casual': { modifier: 1.15, label: 'Upscale Casual (+15%)' },
  'full_service': { modifier: 1.10, label: 'Full Service (+10%)' },
  'fast_casual': { modifier: 1.05, label: 'Fast Casual (+5%)' },
  'quick_service': { modifier: 1.00, label: 'Quick Service (baseline)' },
  'counter': { modifier: 0.95, label: 'Counter Service (-5%)' },
  'cafe': { modifier: 0.90, label: 'Cafe (-10%)' },
  'food_truck': { modifier: 0.85, label: 'Food Truck (-15%)' }
};

// Menu complexity modifiers
const MENU_COMPLEXITY_MODIFIERS = {
  'ultra': { modifier: 1.30, label: 'Ultra Complex (+30%)' },
  'complex': { modifier: 1.15, label: 'Complex (+15%)' },
  'moderate': { modifier: 1.05, label: 'Moderate (+5%)' },
  'simple': { modifier: 0.90, label: 'Simple (-10%)' }
};

// Bar program modifiers
const BAR_PROGRAM_MODIFIERS = {
  'craft_cocktail': { modifier: 1.25, label: 'Craft Cocktails (+25%)' },
  'full_bar': { modifier: 1.15, label: 'Full Bar (+15%)' },
  'wine_focus': { modifier: 1.10, label: 'Wine Focused (+10%)' },
  'beer_wine': { modifier: 1.05, label: 'Beer & Wine (+5%)' },
  'none': { modifier: 1.00, label: 'No Alcohol (baseline)' }
};

// Infer service style from cuisine type
function inferServiceStyle(cuisineType) {
  if (!cuisineType) return null;

  const lower = cuisineType.toLowerCase();

  if (['french', 'steakhouse', 'fine dining'].some(c => lower.includes(c))) {
    return 'fine_dining';
  }
  if (['sushi', 'japanese', 'upscale'].some(c => lower.includes(c))) {
    return 'upscale_casual';
  }
  if (['pizza', 'fast', 'quick', 'burger'].some(c => lower.includes(c))) {
    return 'fast_casual';
  }
  if (['cafe', 'coffee', 'bakery'].some(c => lower.includes(c))) {
    return 'cafe';
  }
  if (['food truck', 'truck'].some(c => lower.includes(c))) {
    return 'food_truck';
  }

  return 'full_service'; // Default for most cuisines
}

// Infer bar program from various signals
function inferBarProgram(data) {
  if (!data) return null;

  // Check liquor license info
  if (data.liquor_license === 'full' || data.has_full_bar) {
    return 'full_bar';
  }
  if (data.liquor_license === 'beer_wine') {
    return 'beer_wine';
  }
  if (data.has_craft_cocktails) {
    return 'craft_cocktail';
  }

  // Check beverage focus from classification
  if (data.beverage_focus === 'cocktail') return 'craft_cocktail';
  if (data.beverage_focus === 'wine') return 'wine_focus';
  if (data.beverage_focus === 'beer') return 'beer_wine';

  // Default based on service style
  if (data.service_style === 'fine_dining') return 'full_bar';
  if (data.service_style === 'cafe') return 'none';

  return null;
}

// Estimate menu complexity from item count or other signals
function inferMenuComplexity(data) {
  if (!data) return null;

  if (data.menu_item_count) {
    const count = parseInt(data.menu_item_count, 10);
    if (count > 200) return 'ultra';
    if (count > 100) return 'complex';
    if (count > 50) return 'moderate';
    return 'simple';
  }

  // Infer from service style
  if (data.service_style === 'fine_dining') return 'complex';
  if (data.service_style === 'fast_casual') return 'moderate';
  if (data.service_style === 'cafe') return 'simple';

  return null;
}

// Estimate station count from seating capacity
function estimateStationCount(seatingCapacity, serviceStyle) {
  const seats = parseInt(seatingCapacity, 10);
  if (isNaN(seats) || seats <= 0) return null;

  // Adjust for service style
  const seatsPerStation = serviceStyle === 'fine_dining' ? 20 :
                          serviceStyle === 'upscale_casual' ? 25 :
                          serviceStyle === 'fast_casual' ? 40 :
                          30;

  const serverStations = Math.ceil(seats / seatsPerStation);
  const hasBar = seats > 50 || serviceStyle === 'full_service';
  const kitchenStations = seats > 100 ? 3 : seats > 50 ? 2 : 1;

  return {
    total: serverStations + (hasBar ? 1 : 0) + kitchenStations,
    breakdown: {
      server: serverStations,
      bar: hasBar ? 1 : 0,
      kitchen: kitchenStations
    }
  };
}

// Map zone from address
function classifyAddressZone(address) {
  if (!address) return null;

  const a = address.toLowerCase();

  // Islands
  if (a.includes('nantucket')) return { zone: 'island', subzone: 'nantucket', ferry: true };
  if (a.includes("martha's vineyard") || a.includes('oak bluffs') ||
      a.includes('edgartown') || a.includes('vineyard haven')) {
    return { zone: 'island', subzone: 'marthas_vineyard', ferry: true };
  }

  // Cape Cod towns
  const capeTowns = ['barnstable', 'falmouth', 'provincetown', 'hyannis', 'sandwich',
    'dennis', 'yarmouth', 'brewster', 'chatham', 'wellfleet', 'eastham', 'harwich',
    'orleans', 'truro', 'mashpee', 'bourne'];
  if (a.includes('cape cod') || capeTowns.some(t => a.includes(t))) {
    return { zone: 'cape', subzone: 'cape_cod', ferry: false };
  }

  // South Shore
  const southShore = ['plymouth', 'kingston', 'duxbury', 'marshfield', 'scituate',
    'hingham', 'quincy', 'weymouth', 'braintree', 'norwell', 'hanover', 'cohasset'];
  if (southShore.some(t => a.includes(t))) {
    return { zone: 'southShore', subzone: 'south_shore', ferry: false };
  }

  // Greater Boston
  if (a.includes('boston') || a.includes('cambridge') || a.includes('somerville')) {
    return { zone: 'southernNE', subzone: 'boston', ferry: false };
  }

  // Southern New England
  if (a.includes('massachusetts') || a.includes('rhode island') || a.includes('connecticut')) {
    return { zone: 'southernNE', subzone: 'new_england', ferry: false };
  }

  return { zone: 'outOfRegion', subzone: 'national', ferry: false };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  // Rate limiting
  const rateLimitResponse = await rateLimit(
    request,
    env.RATE_LIMIT_KV,
    'quote-intelligence',
    RATE_LIMITS.API_READ,
    corsHeaders
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const url = new URL(request.url);
    const leadId = url.searchParams.get('lead_id');
    const clientId = url.searchParams.get('client_id');

    if (!leadId && !clientId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Either lead_id or client_id is required'
      }), { status: 400, headers: corsHeaders });
    }

    const result = {
      found: false,
      source: null,
      confidence: 0,
      profile: {},
      dci: {},
      recommendations: {},
      zone: null,
      verifications: [],
      scraped: null
    };

    // Fetch client data if client_id provided
    if (clientId) {
      try {
        // Get client with profile
        const client = await env.DB.prepare(`
          SELECT
            c.id, c.name, c.company, c.email, c.phone, c.address,
            cp.service_style, cp.cuisine_type, cp.bar_program,
            cp.menu_complexity, cp.seating_capacity, cp.employee_count,
            cp.pos_system, cp.client_score, cp.menu_item_count,
            cp.has_full_bar, cp.has_craft_cocktails
          FROM clients c
          LEFT JOIN client_profiles cp ON cp.client_id = c.id
          WHERE c.id = ?
        `).bind(clientId).first();

        if (client) {
          result.found = true;
          result.source = 'client';
          result.confidence = 0.9;

          result.profile = {
            id: client.id,
            name: client.company || client.name,
            contact: client.name,
            email: client.email,
            phone: client.phone,
            address: client.address,
            service_style: client.service_style,
            cuisine_type: client.cuisine_type,
            bar_program: client.bar_program || inferBarProgram(client),
            menu_complexity: client.menu_complexity || inferMenuComplexity(client),
            seating_capacity: client.seating_capacity,
            pos_system: client.pos_system
          };

          // Fetch approved atomic facts
          const facts = await env.DB.prepare(`
            SELECT field_name, field_value, confidence, source
            FROM client_atomic_facts
            WHERE client_id = ? AND status = 'approved'
            ORDER BY confidence DESC
          `).bind(clientId).all();

          result.facts = facts.results || [];

          // Fetch classification if exists
          const classification = await env.DB.prepare(`
            SELECT
              service_style, establishment_type, beverage_focus,
              cuisine_types_json, price_point, volume_level,
              has_bar, has_patio, has_delivery, has_reservations,
              avg_party_size, classification_confidence,
              config_template_id
            FROM restaurant_classifications
            WHERE client_id = ?
            ORDER BY created_at DESC
            LIMIT 1
          `).bind(clientId).first();

          if (classification) {
            result.classification = classification;
            // Apply classification data to profile if not already set
            if (!result.profile.service_style && classification.service_style) {
              result.profile.service_style = classification.service_style;
            }
            if (!result.profile.bar_program && classification.beverage_focus) {
              result.profile.bar_program = inferBarProgram({ beverage_focus: classification.beverage_focus });
            }
          }
        }
      } catch (e) {
        console.log('Client lookup error:', e.message);
      }
    }

    // Fetch lead data if lead_id provided (or client not found)
    if (leadId && !result.found) {
      try {
        const lead = await env.DB.prepare(`
          SELECT
            id, company_name, contact_name, email, phone, website,
            city, state, full_address, current_pos, vertical,
            employee_estimate, revenue_estimate, lead_score,
            cuisine_hint, service_style_hint, menu_size_hint,
            bar_program_hint
          FROM restaurant_leads
          WHERE id = ?
        `).bind(leadId).first();

        if (lead) {
          result.found = true;
          result.source = 'lead';
          result.confidence = 0.6;

          const address = lead.full_address ||
            `${lead.city || ''}, ${lead.state || ''}`.trim();

          result.profile = {
            id: lead.id,
            name: lead.company_name,
            contact: lead.contact_name,
            email: lead.email,
            phone: lead.phone,
            website: lead.website,
            address: address,
            service_style: lead.service_style_hint || inferServiceStyle(lead.cuisine_hint),
            cuisine_type: lead.cuisine_hint,
            bar_program: lead.bar_program_hint || inferBarProgram({ service_style: lead.service_style_hint }),
            menu_complexity: inferMenuComplexity({ menu_item_count: lead.menu_size_hint }),
            seating_capacity: null,
            pos_system: lead.current_pos,
            lead_score: lead.lead_score
          };

          // Check for scraped data
          if (lead.website) {
            try {
              const urlHash = await crypto.subtle.digest(
                'SHA-256',
                new TextEncoder().encode(lead.website)
              );
              const hashHex = Array.from(new Uint8Array(urlHash))
                .map(b => b.toString(16).padStart(2, '0')).join('');

              const scraped = await env.DB.prepare(`
                SELECT scraped_data_json, tech_stack_json, contacts_json, social_json
                FROM scraped_data_cache
                WHERE url_hash = ? AND expires_at > unixepoch()
              `).bind(hashHex).first();

              if (scraped) {
                result.scraped = {
                  data: scraped.scraped_data_json ? JSON.parse(scraped.scraped_data_json) : null,
                  tech_stack: scraped.tech_stack_json ? JSON.parse(scraped.tech_stack_json) : null,
                  contacts: scraped.contacts_json ? JSON.parse(scraped.contacts_json) : null,
                  social: scraped.social_json ? JSON.parse(scraped.social_json) : null
                };
              }
            } catch (e) {
              // Non-fatal
            }
          }

          // Check for verifications
          const verifications = await env.DB.prepare(`
            SELECT verification_type, verified_value, is_valid, confidence
            FROM lead_verifications
            WHERE lead_id = ? AND is_valid = 1
          `).bind(leadId).all();

          result.verifications = verifications.results || [];
        }
      } catch (e) {
        console.log('Lead lookup error:', e.message);
      }
    }

    if (!result.found) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Lead or client not found'
      }), { status: 404, headers: corsHeaders });
    }

    // Calculate DCI factors
    const serviceStyleData = SERVICE_STYLE_MODIFIERS[result.profile.service_style] ||
      SERVICE_STYLE_MODIFIERS.full_service;
    const menuComplexityData = MENU_COMPLEXITY_MODIFIERS[result.profile.menu_complexity] ||
      { modifier: 1.0, label: 'Unknown' };
    const barProgramData = BAR_PROGRAM_MODIFIERS[result.profile.bar_program] ||
      { modifier: 1.0, label: 'Unknown' };

    result.dci = {
      service_style: {
        value: result.profile.service_style,
        ...serviceStyleData
      },
      menu_complexity: {
        value: result.profile.menu_complexity,
        ...menuComplexityData
      },
      bar_program: {
        value: result.profile.bar_program,
        ...barProgramData
      },
      combined_modifier: Math.round(
        serviceStyleData.modifier * menuComplexityData.modifier * barProgramData.modifier * 100
      ) / 100
    };

    // Station estimate
    if (result.profile.seating_capacity) {
      result.recommendations.stations = estimateStationCount(
        result.profile.seating_capacity,
        result.profile.service_style
      );
    }

    // Zone classification
    if (result.profile.address) {
      result.zone = classifyAddressZone(result.profile.address);
    }

    // Fetch config template recommendation
    if (result.classification?.config_template_id) {
      try {
        const template = await env.DB.prepare(`
          SELECT id, name, description, menu_structure_json, kds_config_json
          FROM toast_config_templates
          WHERE id = ?
        `).bind(result.classification.config_template_id).first();

        if (template) {
          result.recommendations.config_template = {
            id: template.id,
            name: template.name,
            description: template.description,
            menu_structure: template.menu_structure_json ?
              JSON.parse(template.menu_structure_json) : null,
            kds_config: template.kds_config_json ?
              JSON.parse(template.kds_config_json) : null
          };
        }
      } catch (e) {
        // Non-fatal
      }
    }

    return new Response(JSON.stringify({
      success: true,
      ...result
    }), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Intelligence fetch error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch intelligence'
    }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions(context) {
  const { request } = context;
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getCorsOrigin(request),
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
