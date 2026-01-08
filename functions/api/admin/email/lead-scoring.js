/**
 * Lead Scoring API - R&G Consulting
 *
 * Calculates lead scores based on a 100-point priority matrix:
 * - POS System (40 pts): Toast=40, Clover/Square=25, Other=15
 * - Geography (30 pts): Cape Cod=30, MA=20, New England=15, National=10
 * - Tech Signals (30 pts): Based on tech stack indicators
 *
 * Tier Assignment:
 * - Tier 1 Hot (80-100 points): ~4,000 leads
 * - Tier 2 Warm (60-79 points): ~10,000 leads
 * - Tier 3 Nurture (40-59 points): ~17,000 leads
 * - Tier 4 Long-tail (<40 points): ~12,000 leads
 */

import { verifyAdminToken, getCorsHeaders, handleOptions } from '../../../_shared/auth.js';

// POS System scoring (40 points max)
const POS_SCORES = {
  'toast': 40,
  'square': 25,
  'clover': 25,
  'lightspeed': 20,
  'aloha': 20,
  'micros': 20,
  'revel': 15,
  'touchbistro': 15,
  'other': 15,
  'none': 10,
  'unknown': 10,
};

// Geographic tier scoring (30 points max)
// Tier 1: Cape Cod (Barnstable County zip codes)
const CAPE_COD_ZIPS = [
  '02532', '02534', '02536', '02537', '02538', '02539', '02540', '02542', '02543',
  '02553', '02554', '02556', '02557', '02558', '02559', '02561', '02562', '02563',
  '02564', '02568', '02571', '02574', '02584', '02601', '02630', '02631', '02632',
  '02633', '02634', '02635', '02637', '02638', '02639', '02641', '02642', '02643',
  '02644', '02645', '02646', '02647', '02648', '02649', '02650', '02651', '02652',
  '02653', '02655', '02657', '02659', '02660', '02661', '02662', '02663', '02664',
  '02666', '02667', '02668', '02669', '02670', '02671', '02672', '02673', '02675',
];

// Tier 2: Greater Boston area zip prefixes
const BOSTON_AREA_PREFIXES = ['02', '017', '018', '019'];

// New England states
const NEW_ENGLAND_STATES = ['MA', 'CT', 'RI', 'NH', 'VT', 'ME'];

function calculateGeographyScore(zip, state, city) {
  // Tier 1: Cape Cod (30 points)
  if (zip && CAPE_COD_ZIPS.includes(zip.substring(0, 5))) {
    return { score: 30, tier: 'tier1' };
  }

  // Check for Cape Cod cities
  const capeCodCities = [
    'barnstable', 'bourne', 'brewster', 'chatham', 'dennis', 'eastham',
    'falmouth', 'harwich', 'mashpee', 'orleans', 'provincetown', 'sandwich',
    'truro', 'wellfleet', 'yarmouth', 'hyannis', 'centerville', 'cotuit',
    'osterville', 'marstons mills', 'west barnstable', 'woods hole'
  ];

  if (city && capeCodCities.some(c => city.toLowerCase().includes(c))) {
    return { score: 30, tier: 'tier1' };
  }

  // Tier 2: Greater Boston (20 points)
  if (zip && BOSTON_AREA_PREFIXES.some(p => zip.startsWith(p))) {
    return { score: 20, tier: 'tier2' };
  }

  // Tier 3: New England (15 points)
  if (state && NEW_ENGLAND_STATES.includes(state.toUpperCase())) {
    return { score: 15, tier: 'tier3' };
  }

  // Tier 4: National (10 points)
  return { score: 10, tier: 'tier4' };
}

function calculatePOSScore(posSystem) {
  const normalized = (posSystem || 'unknown').toLowerCase().trim();
  return POS_SCORES[normalized] || POS_SCORES['other'];
}

function calculateTechScore(subscriber) {
  let score = 0;

  // Online ordering presence (+10)
  if (subscriber.custom_fields_json) {
    try {
      const customFields = JSON.parse(subscriber.custom_fields_json);
      if (customFields.has_online_ordering || customFields.online_ordering) {
        score += 10;
      }
      if (customFields.has_loyalty || customFields.loyalty_program) {
        score += 10;
      }
      if (customFields.integrations_count > 2) {
        score += 10;
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Source-based signals
  if (subscriber.source === 'website') {
    score += 5; // Showed interest
  }
  if (subscriber.utm_campaign && subscriber.utm_campaign.includes('toast')) {
    score += 5;
  }

  // Engagement-based signals
  if (subscriber.total_emails_opened > 3) {
    score += 5;
  }
  if (subscriber.total_emails_clicked > 0) {
    score += 5;
  }

  return Math.min(score, 30); // Cap at 30 points
}

function calculateLeadScore(subscriber) {
  const posScore = calculatePOSScore(subscriber.pos_system);
  const { score: geoScore, tier: geoTier } = calculateGeographyScore(
    subscriber.zip,
    subscriber.state,
    subscriber.city
  );
  const techScore = calculateTechScore(subscriber);

  const totalScore = posScore + geoScore + techScore;

  // Determine tier based on total score
  let tier;
  if (totalScore >= 80) {
    tier = 'tier1'; // Hot
  } else if (totalScore >= 60) {
    tier = 'tier2'; // Warm
  } else if (totalScore >= 40) {
    tier = 'tier3'; // Nurture
  } else {
    tier = 'tier4'; // Long-tail
  }

  return {
    lead_score: totalScore,
    geo_tier: geoTier,
    scoring_breakdown: {
      pos: posScore,
      geo: geoScore,
      tech: techScore,
    },
    tier,
  };
}

// POST /api/admin/email/lead-scoring - Score a batch of subscribers
export async function onRequestPost(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }

  const corsHeaders = getCorsHeaders(request);

  try {
    // Verify admin token
    const authResult = await verifyAdminToken(request, env);
    if (!authResult.valid) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { action, subscriber_ids, batch_size = 1000, offset = 0 } = body;

    // Score specific subscribers
    if (action === 'score_specific' && subscriber_ids?.length > 0) {
      const placeholders = subscriber_ids.map(() => '?').join(',');
      const { results } = await env.DB.prepare(`
        SELECT * FROM email_subscribers WHERE id IN (${placeholders})
      `).bind(...subscriber_ids).all();

      const scored = results.map(sub => ({
        id: sub.id,
        email: sub.email,
        ...calculateLeadScore(sub),
      }));

      return new Response(JSON.stringify({ success: true, scored }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Batch score all subscribers
    if (action === 'score_batch') {
      const { results } = await env.DB.prepare(`
        SELECT * FROM email_subscribers
        WHERE status = 'active'
        ORDER BY id
        LIMIT ? OFFSET ?
      `).bind(batch_size, offset).all();

      if (!results || results.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'No more subscribers to score',
          processed: 0,
          offset,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const now = Math.floor(Date.now() / 1000);
      let updated = 0;

      for (const sub of results) {
        const { lead_score, geo_tier } = calculateLeadScore(sub);

        await env.DB.prepare(`
          UPDATE email_subscribers
          SET lead_score = ?,
              geo_tier = ?,
              engagement_score_updated_at = ?,
              updated_at = ?
          WHERE id = ?
        `).bind(lead_score, geo_tier, now, now, sub.id).run();

        updated++;
      }

      return new Response(JSON.stringify({
        success: true,
        processed: updated,
        next_offset: offset + batch_size,
        has_more: results.length === batch_size,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get scoring stats
    if (action === 'stats') {
      const stats = await env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN lead_score >= 80 THEN 1 END) as tier1_count,
          COUNT(CASE WHEN lead_score >= 60 AND lead_score < 80 THEN 1 END) as tier2_count,
          COUNT(CASE WHEN lead_score >= 40 AND lead_score < 60 THEN 1 END) as tier3_count,
          COUNT(CASE WHEN lead_score < 40 THEN 1 END) as tier4_count,
          COUNT(CASE WHEN lead_score IS NULL THEN 1 END) as unscored_count,
          AVG(lead_score) as avg_score
        FROM email_subscribers
        WHERE status = 'active'
      `).first();

      const posDist = await env.DB.prepare(`
        SELECT pos_system, COUNT(*) as count
        FROM email_subscribers
        WHERE status = 'active'
        GROUP BY pos_system
        ORDER BY count DESC
      `).all();

      const geoDist = await env.DB.prepare(`
        SELECT geo_tier, COUNT(*) as count
        FROM email_subscribers
        WHERE status = 'active'
        GROUP BY geo_tier
        ORDER BY count DESC
      `).all();

      return new Response(JSON.stringify({
        success: true,
        stats,
        pos_distribution: posDist.results,
        geo_distribution: geoDist.results,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Lead scoring error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// GET /api/admin/email/lead-scoring - Get scoring stats
export async function onRequestGet(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }

  const corsHeaders = getCorsHeaders(request);

  try {
    // Verify admin token
    const authResult = await verifyAdminToken(request, env);
    if (!authResult.valid) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN lead_score >= 80 THEN 1 END) as tier1_hot,
        COUNT(CASE WHEN lead_score >= 60 AND lead_score < 80 THEN 1 END) as tier2_warm,
        COUNT(CASE WHEN lead_score >= 40 AND lead_score < 60 THEN 1 END) as tier3_nurture,
        COUNT(CASE WHEN lead_score < 40 OR lead_score IS NULL THEN 1 END) as tier4_longtail,
        ROUND(AVG(lead_score), 1) as avg_score,
        COUNT(CASE WHEN pos_system = 'toast' THEN 1 END) as toast_users,
        COUNT(CASE WHEN pos_system IN ('clover', 'square') THEN 1 END) as conversion_targets
      FROM email_subscribers
      WHERE status = 'active'
    `).first();

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Lead scoring stats error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
