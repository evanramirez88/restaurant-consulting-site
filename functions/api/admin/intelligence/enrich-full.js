/**
 * Full Business Brief Enrichment API
 *
 * POST /api/admin/intelligence/enrich-full - Full recursive enrichment
 * GET /api/admin/intelligence/enrich-full?lead_id=xxx - Get enrichment status
 *
 * This is the Pages Functions version that runs enrichment inline.
 * For heavy batch processing, use the dedicated worker.
 */

import { verifyAuth, unauthorizedResponse } from '../../_shared/auth.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Field weights for completeness
const FIELD_WEIGHTS = {
  companyName: 10, website: 8, phone: 8, email: 8, address: 5,
  cuisineType: 4, serviceStyle: 3, ownerName: 7, ownerEmail: 6,
  posSystem: 9, onlineOrdering: 5, reservationSystem: 4,
  googleRating: 3, yelpRating: 3, facebookUrl: 2, instagramHandle: 2,
  yelpUrl: 3, priceLevel: 2,
};

// Tech patterns
const TECH_PATTERNS = {
  pos_systems: {
    'Toast': [/toast\.?pos/i, /toasttab\.com/i, /pos\.toasttab/i, /"toast"/i],
    'Square': [/square\.?pos/i, /squareup\.com/i, /square for restaurants/i],
    'Clover': [/clover\.com/i, /clover pos/i],
    'Lightspeed': [/lightspeed/i, /lightspeedhq\.com/i],
    'Aloha': [/aloha pos/i, /ncr\.com.*aloha/i],
    'Micros': [/micros/i, /oracle.*micros/i],
    'Revel': [/revelsystems/i, /revel pos/i],
    'TouchBistro': [/touchbistro/i],
    'SpotOn': [/spoton\.com/i, /spoton pos/i],
  },
  online_ordering: {
    'Toast Online': [/order\.toasttab\.com/i],
    'ChowNow': [/chownow\.com/i],
    'DoorDash Storefront': [/doordash\.com.*storefront/i],
    'Square Online': [/square.*online.*order/i],
    'BentoBox': [/bentobox/i, /getbento\.com/i],
    'Olo': [/olo\.com/i],
  },
  reservation_systems: {
    'OpenTable': [/opentable\.com/i],
    'Resy': [/resy\.com/i],
    'Yelp Reservations': [/yelp.*reservations/i],
    'SevenRooms': [/sevenrooms/i],
    'Tock': [/exploretock\.com/i],
  },
};

const CUISINE_PATTERNS = {
  'Italian': /\b(italian|pasta|pizza|risotto|trattoria|pizzeria)\b/gi,
  'Mexican': /\b(mexican|tacos?|burritos?|enchiladas?|cantina|taqueria)\b/gi,
  'Chinese': /\b(chinese|dim sum|wonton|szechuan|cantonese)\b/gi,
  'Japanese': /\b(japanese|sushi|ramen|tempura|hibachi)\b/gi,
  'Thai': /\b(thai|pad thai|curry|tom yum)\b/gi,
  'Indian': /\b(indian|curry|tandoori|naan|biryani|masala)\b/gi,
  'American': /\b(american|burger|bbq|barbecue|steakhouse|grill)\b/gi,
  'Seafood': /\b(seafood|oyster|lobster|crab|shrimp|fish)\b/gi,
  'Mediterranean': /\b(mediterranean|greek|hummus|falafel|kebab)\b/gi,
  'Cafe/Coffee': /\b(cafe|coffee|espresso|latte|bakery)\b/gi,
  'Bar/Pub': /\b(bar|pub|tavern|brewery|taproom|gastropub)\b/gi,
};

const PAIN_PATTERNS = [
  { pattern: /slow service|long wait/gi, type: 'service', severity: 'medium' },
  { pattern: /outdated|needs updating|ancient/gi, type: 'tech', severity: 'high' },
  { pattern: /pos.*crash|system.*down/gi, type: 'tech', severity: 'high' },
  { pattern: /no online ordering|can't order online/gi, type: 'tech', severity: 'high' },
  { pattern: /understaffed|short staff/gi, type: 'staffing', severity: 'medium' },
  { pattern: /cash only|no cards/gi, type: 'tech', severity: 'high' },
];

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Verify auth
  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error, request);
  }

  try {
    const body = await request.json();
    const { lead_id, max_rounds = 3 } = body;

    if (!lead_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'lead_id required',
      }), { status: 400, headers: corsHeaders });
    }

    const result = await enrichLeadFull(env, lead_id, max_rounds);
    return new Response(JSON.stringify(result), { headers: corsHeaders });
  } catch (error) {
    console.error('Enrichment error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error, request);
  }

  const url = new URL(request.url);
  const leadId = url.searchParams.get('lead_id');

  if (leadId) {
    // Get enrichment status for specific lead
    const lead = await env.DB.prepare(`
      SELECT id, name, company_name, data_completeness, last_enriched_at,
             gap_analysis_json, current_pos, primary_email, primary_phone,
             owner_name, cuisine_primary, yelp_url
      FROM restaurant_leads WHERE id = ?
    `).bind(leadId).first();

    if (!lead) {
      return new Response(JSON.stringify({ success: false, error: 'Lead not found' }), {
        status: 404, headers: corsHeaders
      });
    }

    // Get opportunity analysis if exists
    const opportunity = await env.DB.prepare(`
      SELECT opportunity_score, factors_json, recommendations_json, pain_signals_json
      FROM lead_opportunity_analysis
      WHERE lead_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(leadId).first();

    return new Response(JSON.stringify({
      success: true,
      lead: {
        id: lead.id,
        name: lead.name || lead.company_name,
        completeness: lead.data_completeness || 0,
        lastEnriched: lead.last_enriched_at,
        gaps: lead.gap_analysis_json ? JSON.parse(lead.gap_analysis_json) : null,
        fields: {
          pos: lead.current_pos,
          email: lead.primary_email,
          phone: lead.primary_phone,
          owner: lead.owner_name,
          cuisine: lead.cuisine_primary,
          yelp: lead.yelp_url,
        },
      },
      opportunity: opportunity ? {
        score: opportunity.opportunity_score,
        factors: JSON.parse(opportunity.factors_json || '[]'),
        recommendations: JSON.parse(opportunity.recommendations_json || '[]'),
        painSignals: JSON.parse(opportunity.pain_signals_json || '[]'),
      } : null,
    }), { headers: corsHeaders });
  }

  // Get overall stats
  const stats = await env.DB.prepare(`
    SELECT
      COUNT(*) as total,
      AVG(data_completeness) as avg_completeness,
      COUNT(CASE WHEN data_completeness >= 75 THEN 1 END) as enriched,
      COUNT(CASE WHEN data_completeness < 25 OR data_completeness IS NULL THEN 1 END) as needs_work,
      COUNT(CASE WHEN current_pos IS NOT NULL THEN 1 END) as has_pos,
      COUNT(CASE WHEN primary_email IS NOT NULL THEN 1 END) as has_email,
      COUNT(CASE WHEN owner_name IS NOT NULL THEN 1 END) as has_owner
    FROM restaurant_leads
  `).first();

  return new Response(JSON.stringify({
    success: true,
    stats: {
      totalLeads: stats.total,
      avgCompleteness: Math.round(stats.avg_completeness || 0),
      fullyEnriched: stats.enriched || 0,
      needsEnrichment: stats.needs_work || 0,
      coverage: {
        pos: Math.round(((stats.has_pos || 0) / stats.total) * 100),
        email: Math.round(((stats.has_email || 0) / stats.total) * 100),
        owner: Math.round(((stats.has_owner || 0) / stats.total) * 100),
      },
    },
  }), { headers: corsHeaders });
}

async function enrichLeadFull(env, leadId, maxRounds) {
  const result = {
    success: false,
    leadId,
    fieldsEnriched: 0,
    fieldsAttempted: 0,
    sourcesUsed: [],
    roundsCompleted: 0,
    newCompleteness: 0,
    previousCompleteness: 0,
    gapsRemaining: [],
    opportunityScore: 0,
    recommendations: [],
    errors: [],
  };

  // Fetch lead
  const lead = await env.DB.prepare(`
    SELECT * FROM restaurant_leads WHERE id = ?
  `).bind(leadId).first();

  if (!lead) {
    result.errors.push('Lead not found');
    return result;
  }

  // Build brief from existing data
  const brief = {
    companyName: lead.name || lead.company_name,
    website: lead.website_url || lead.website,
    phone: lead.primary_phone || lead.phone,
    email: lead.primary_email || lead.email,
    address: lead.address,
    city: lead.city,
    state: lead.state,
    cuisineType: lead.cuisine_primary,
    serviceStyle: lead.service_style,
    ownerName: lead.owner_name,
    ownerEmail: lead.owner_email,
    posSystem: lead.current_pos,
    onlineOrdering: lead.online_ordering,
    reservationSystem: lead.reservation_system,
    facebookUrl: lead.facebook_url,
    instagramHandle: lead.instagram_handle,
    yelpUrl: lead.yelp_url,
    googleRating: lead.google_rating,
    yelpRating: lead.yelp_rating,
    painSignals: [],
  };

  result.previousCompleteness = calculateCompleteness(brief);

  // Enrichment rounds
  for (let round = 1; round <= maxRounds; round++) {
    result.roundsCompleted = round;
    const gaps = analyzeGaps(brief);

    if (calculateCompleteness(brief) >= 75 || gaps.searchableGaps.length === 0) {
      break;
    }

    // Website scraping
    if (brief.website && !result.sourcesUsed.includes('website')) {
      const scrapeResult = await scrapeWebsite(brief.website);
      if (scrapeResult.success) {
        result.sourcesUsed.push('website');
        applyScrapedData(brief, scrapeResult, result);
      }
    }

    // Search enrichment (limited without API keys in Pages)
    // The full worker has Brave/Google integration
  }

  // Calculate opportunity score
  const opportunity = calculateOpportunity(brief);
  result.opportunityScore = opportunity.score;
  result.recommendations = opportunity.recommendations;

  // Calculate final completeness
  result.newCompleteness = calculateCompleteness(brief);
  result.gapsRemaining = analyzeGaps(brief).missingFields;

  // Persist to database
  await persistEnrichment(env.DB, leadId, brief, opportunity);

  result.success = true;
  return result;
}

async function scrapeWebsite(url) {
  try {
    if (!url.startsWith('http')) url = 'https://' + url;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RGConsultingBot/1.0)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });

    if (!response.ok) return { success: false };

    const html = await response.text();
    return {
      success: true,
      html,
      techStack: detectTechStack(html),
      contacts: extractContacts(html),
      social: extractSocial(html),
      cuisine: detectCuisine(html),
      painSignals: detectPainSignals(html),
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function detectTechStack(html) {
  const result = {};
  for (const [category, systems] of Object.entries(TECH_PATTERNS)) {
    for (const [name, patterns] of Object.entries(systems)) {
      for (const pattern of patterns) {
        if (pattern.test(html)) {
          result[category] = name;
          break;
        }
      }
      if (result[category]) break;
    }
  }
  return result;
}

function extractContacts(html) {
  const phones = html.match(/(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g) || [];
  const emails = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  return {
    phones: [...new Set(phones)].slice(0, 3),
    emails: [...new Set(emails)].filter(e => !e.includes('example.com')).slice(0, 3),
  };
}

function extractSocial(html) {
  const social = {};
  const patterns = {
    facebookUrl: /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"'\s]+)["']/i,
    instagramHandle: /href=["'](https?:\/\/(?:www\.)?instagram\.com\/([^"'\s/]+))["']/i,
    yelpUrl: /href=["'](https?:\/\/(?:www\.)?yelp\.com\/biz\/[^"'\s]+)["']/i,
  };
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = html.match(pattern);
    if (match) social[key] = match[1];
  }
  return social;
}

function detectCuisine(html) {
  let best = '';
  let bestCount = 0;
  for (const [cuisine, pattern] of Object.entries(CUISINE_PATTERNS)) {
    const matches = html.match(pattern);
    if (matches && matches.length > bestCount) {
      bestCount = matches.length;
      best = cuisine;
    }
  }
  return bestCount >= 3 ? best : null;
}

function detectPainSignals(html) {
  const signals = [];
  for (const { pattern, type, severity } of PAIN_PATTERNS) {
    const matches = html.match(pattern);
    if (matches) {
      signals.push({ type, description: matches[0], severity, source: 'website' });
    }
  }
  return signals;
}

function applyScrapedData(brief, scrape, result) {
  if (scrape.techStack.pos_systems && !brief.posSystem) {
    brief.posSystem = scrape.techStack.pos_systems;
    result.fieldsEnriched++;
  }
  if (scrape.techStack.online_ordering && !brief.onlineOrdering) {
    brief.onlineOrdering = scrape.techStack.online_ordering;
    result.fieldsEnriched++;
  }
  if (scrape.techStack.reservation_systems && !brief.reservationSystem) {
    brief.reservationSystem = scrape.techStack.reservation_systems;
    result.fieldsEnriched++;
  }
  if (scrape.contacts.phones.length && !brief.phone) {
    brief.phone = scrape.contacts.phones[0];
    result.fieldsEnriched++;
  }
  if (scrape.contacts.emails.length && !brief.email) {
    brief.email = scrape.contacts.emails[0];
    result.fieldsEnriched++;
  }
  if (scrape.social.facebookUrl && !brief.facebookUrl) {
    brief.facebookUrl = scrape.social.facebookUrl;
    result.fieldsEnriched++;
  }
  if (scrape.social.yelpUrl && !brief.yelpUrl) {
    brief.yelpUrl = scrape.social.yelpUrl;
    result.fieldsEnriched++;
  }
  if (scrape.cuisine && !brief.cuisineType) {
    brief.cuisineType = scrape.cuisine;
    result.fieldsEnriched++;
  }
  if (scrape.painSignals?.length) {
    brief.painSignals = scrape.painSignals;
  }
}

function calculateCompleteness(brief) {
  let total = 0, filled = 0;
  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    total += weight;
    if (brief[field]) filled += weight;
  }
  return Math.round((filled / total) * 100);
}

function analyzeGaps(brief) {
  const missingFields = [];
  const searchableGaps = [];
  for (const field of Object.keys(FIELD_WEIGHTS)) {
    if (!brief[field]) {
      missingFields.push(field);
      if (['phone', 'email', 'posSystem', 'yelpUrl', 'cuisineType'].includes(field)) {
        searchableGaps.push(field);
      }
    }
  }
  return { missingFields, searchableGaps };
}

function calculateOpportunity(brief) {
  const factors = [];
  const recommendations = [];
  let score = 50;

  if (!brief.posSystem || ['Unknown', 'None'].includes(brief.posSystem)) {
    score += 15;
    factors.push({ factor: 'No Modern POS', weight: 15 });
    recommendations.push('Offer POS consultation');
  } else if (['Square', 'Clover', 'Aloha'].includes(brief.posSystem)) {
    score += 10;
    factors.push({ factor: 'Legacy POS', weight: 10 });
    recommendations.push(`Explore ${brief.posSystem} upgrade path`);
  }

  if (!brief.onlineOrdering) {
    score += 12;
    factors.push({ factor: 'No Online Ordering', weight: 12 });
    recommendations.push('Propose online ordering solution');
  }

  if (brief.painSignals?.length) {
    const painScore = Math.min(brief.painSignals.length * 5, 15);
    score += painScore;
    factors.push({ factor: 'Pain Signals', weight: painScore });
    recommendations.push('Address identified pain points');
  }

  return { score: Math.min(score, 100), factors, recommendations };
}

async function persistEnrichment(db, leadId, brief, opportunity) {
  const updates = [];
  const values = [];
  const mapping = {
    phone: 'primary_phone', email: 'primary_email', cuisineType: 'cuisine_primary',
    posSystem: 'current_pos', ownerName: 'owner_name', ownerEmail: 'owner_email',
    onlineOrdering: 'online_ordering', reservationSystem: 'reservation_system',
    facebookUrl: 'facebook_url', instagramHandle: 'instagram_handle', yelpUrl: 'yelp_url',
  };

  for (const [briefField, dbField] of Object.entries(mapping)) {
    if (brief[briefField]) {
      updates.push(`${dbField} = ?`);
      values.push(brief[briefField]);
    }
  }

  updates.push('data_completeness = ?');
  values.push(calculateCompleteness(brief));
  updates.push('last_enriched_at = unixepoch()');
  updates.push('gap_analysis_json = ?');
  values.push(JSON.stringify(analyzeGaps(brief)));
  updates.push('updated_at = unixepoch()');
  values.push(leadId);

  await db.prepare(`UPDATE restaurant_leads SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

  // Store opportunity
  const oppId = `opp_${leadId}_${Date.now()}`;
  await db.prepare(`
    INSERT OR REPLACE INTO lead_opportunity_analysis
    (id, lead_id, opportunity_score, factors_json, recommendations_json, pain_signals_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch())
  `).bind(
    oppId, leadId, opportunity.score,
    JSON.stringify(opportunity.factors),
    JSON.stringify(opportunity.recommendations),
    JSON.stringify(brief.painSignals || [])
  ).run().catch(() => {});
}
