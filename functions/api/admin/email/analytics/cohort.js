/**
 * Email Analytics API - Cohort Comparison
 *
 * GET /api/admin/email/analytics/cohort - Get cohort comparison data
 *
 * Query params:
 *   - compare: Comparison type ('periods', 'segments', 'sequences')
 *   - period1_start, period1_end: First period dates
 *   - period2_start, period2_end: Second period dates
 *   - segments: Comma-separated segment IDs to compare
 *   - sequences: Comma-separated sequence IDs to compare
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const url = new URL(context.request.url);

    // Get query parameters
    const compareType = url.searchParams.get('compare') || 'periods';

    if (compareType === 'periods') {
      return await comparePeriods(db, url);
    } else if (compareType === 'segments') {
      return await compareSegments(db, url);
    } else if (compareType === 'sequences') {
      return await compareSequences(db, url);
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid comparison type. Must be: periods, segments, or sequences'
    }), {
      status: 400,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Cohort analysis error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * Compare two time periods
 */
async function comparePeriods(db, url) {
  const period1Start = url.searchParams.get('period1_start');
  const period1End = url.searchParams.get('period1_end');
  const period2Start = url.searchParams.get('period2_start');
  const period2End = url.searchParams.get('period2_end');

  // Default to this week vs last week
  const now = new Date();
  const thisWeekEnd = now.toISOString().split('T')[0];
  const thisWeekStart = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
  const lastWeekEnd = new Date(now.setDate(now.getDate() - 1)).toISOString().split('T')[0];
  const lastWeekStart = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];

  const p1Start = period1Start || thisWeekStart;
  const p1End = period1End || thisWeekEnd;
  const p2Start = period2Start || lastWeekStart;
  const p2End = period2End || lastWeekEnd;

  // Convert to timestamps
  const p1StartTs = Math.floor(new Date(p1Start).getTime() / 1000);
  const p1EndTs = Math.floor(new Date(p1End + 'T23:59:59').getTime() / 1000);
  const p2StartTs = Math.floor(new Date(p2Start).getTime() / 1000);
  const p2EndTs = Math.floor(new Date(p2End + 'T23:59:59').getTime() / 1000);

  // Get metrics for both periods
  const query = `
    SELECT
      COUNT(*) as total_sent,
      SUM(CASE WHEN status = 'delivered' OR opened_at IS NOT NULL THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
      SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
      SUM(CASE WHEN bounced_at IS NOT NULL THEN 1 ELSE 0 END) as bounced,
      SUM(CASE WHEN status = 'unsubscribed' THEN 1 ELSE 0 END) as unsubscribed
    FROM email_logs
    WHERE created_at >= ? AND created_at <= ?
  `;

  const [period1, period2] = await Promise.all([
    db.prepare(query).bind(p1StartTs, p1EndTs).first(),
    db.prepare(query).bind(p2StartTs, p2EndTs).first()
  ]);

  // Calculate rates
  const calculateRates = (data) => ({
    total_sent: data?.total_sent || 0,
    delivered: data?.delivered || 0,
    opened: data?.opened || 0,
    clicked: data?.clicked || 0,
    bounced: data?.bounced || 0,
    unsubscribed: data?.unsubscribed || 0,
    open_rate: data?.total_sent > 0 ? ((data.opened || 0) / data.total_sent) * 100 : 0,
    click_rate: data?.total_sent > 0 ? ((data.clicked || 0) / data.total_sent) * 100 : 0,
    click_to_open_rate: data?.opened > 0 ? ((data.clicked || 0) / data.opened) * 100 : 0,
    bounce_rate: data?.total_sent > 0 ? ((data.bounced || 0) / data.total_sent) * 100 : 0,
    unsub_rate: data?.total_sent > 0 ? ((data.unsubscribed || 0) / data.total_sent) * 100 : 0
  });

  const p1Data = calculateRates(period1);
  const p2Data = calculateRates(period2);

  // Calculate changes
  const calculateChange = (current, previous) => {
    if (!previous || previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const changes = {
    total_sent: calculateChange(p1Data.total_sent, p2Data.total_sent),
    open_rate: p1Data.open_rate - p2Data.open_rate,
    click_rate: p1Data.click_rate - p2Data.click_rate,
    click_to_open_rate: p1Data.click_to_open_rate - p2Data.click_to_open_rate,
    bounce_rate: p1Data.bounce_rate - p2Data.bounce_rate,
    unsub_rate: p1Data.unsub_rate - p2Data.unsub_rate
  };

  return new Response(JSON.stringify({
    success: true,
    data: {
      type: 'periods',
      cohorts: [
        {
          name: 'Current Period',
          label: `${p1Start} to ${p1End}`,
          ...p1Data
        },
        {
          name: 'Previous Period',
          label: `${p2Start} to ${p2End}`,
          ...p2Data
        }
      ],
      changes,
      meta: {
        period1: { start: p1Start, end: p1End },
        period2: { start: p2Start, end: p2End }
      }
    }
  }), { headers: corsHeaders });
}

/**
 * Compare segments
 */
async function compareSegments(db, url) {
  const segmentIds = (url.searchParams.get('segments') || '').split(',').filter(Boolean);

  // Default segments if none provided
  const defaultSegments = ['engagement_high', 'engagement_medium', 'engagement_low'];
  const segments = segmentIds.length > 0 ? segmentIds : defaultSegments;

  const now = new Date();
  const endTs = Math.floor(now.getTime() / 1000);
  const startTs = endTs - (30 * 86400); // Last 30 days

  const results = [];

  for (const segmentId of segments) {
    const filter = getSegmentFilter(segmentId);
    if (!filter) continue;

    const query = `
      SELECT
        COUNT(*) as total_sent,
        SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
        SUM(CASE WHEN bounced_at IS NOT NULL THEN 1 ELSE 0 END) as bounced
      FROM email_logs
      WHERE created_at >= ? AND created_at <= ? AND ${filter.condition}
    `;

    const data = await db.prepare(query).bind(startTs, endTs).first();

    results.push({
      name: filter.label,
      segment_id: segmentId,
      total_sent: data?.total_sent || 0,
      opened: data?.opened || 0,
      clicked: data?.clicked || 0,
      bounced: data?.bounced || 0,
      open_rate: data?.total_sent > 0 ? ((data.opened || 0) / data.total_sent) * 100 : 0,
      click_rate: data?.total_sent > 0 ? ((data.clicked || 0) / data.total_sent) * 100 : 0,
      click_to_open_rate: data?.opened > 0 ? ((data.clicked || 0) / data.opened) * 100 : 0,
      bounce_rate: data?.total_sent > 0 ? ((data.bounced || 0) / data.total_sent) * 100 : 0
    });
  }

  return new Response(JSON.stringify({
    success: true,
    data: {
      type: 'segments',
      cohorts: results,
      meta: {
        period_days: 30
      }
    }
  }), { headers: corsHeaders });
}

/**
 * Compare sequences
 */
async function compareSequences(db, url) {
  const sequenceIds = (url.searchParams.get('sequences') || '').split(',').filter(Boolean);

  const now = new Date();
  const endTs = Math.floor(now.getTime() / 1000);
  const startTs = endTs - (30 * 86400); // Last 30 days

  let query;
  let params = [startTs, endTs];

  if (sequenceIds.length > 0) {
    const placeholders = sequenceIds.map(() => '?').join(',');
    query = `
      SELECT
        es.id as sequence_id,
        es.name as sequence_name,
        COUNT(*) as total_sent,
        SUM(CASE WHEN el.opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN el.clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
        SUM(CASE WHEN el.bounced_at IS NOT NULL THEN 1 ELSE 0 END) as bounced
      FROM email_logs el
      JOIN email_sequences es ON el.sequence_id = es.id
      WHERE el.created_at >= ? AND el.created_at <= ? AND el.sequence_id IN (${placeholders})
      GROUP BY es.id, es.name
    `;
    params.push(...sequenceIds);
  } else {
    // Get top 5 sequences by volume
    query = `
      SELECT
        es.id as sequence_id,
        es.name as sequence_name,
        COUNT(*) as total_sent,
        SUM(CASE WHEN el.opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN el.clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
        SUM(CASE WHEN el.bounced_at IS NOT NULL THEN 1 ELSE 0 END) as bounced
      FROM email_logs el
      JOIN email_sequences es ON el.sequence_id = es.id
      WHERE el.created_at >= ? AND el.created_at <= ?
      GROUP BY es.id, es.name
      ORDER BY total_sent DESC
      LIMIT 5
    `;
  }

  const { results } = await db.prepare(query).bind(...params).all();

  const cohorts = (results || []).map(row => ({
    name: row.sequence_name,
    sequence_id: row.sequence_id,
    total_sent: row.total_sent,
    opened: row.opened,
    clicked: row.clicked,
    bounced: row.bounced,
    open_rate: row.total_sent > 0 ? (row.opened / row.total_sent) * 100 : 0,
    click_rate: row.total_sent > 0 ? (row.clicked / row.total_sent) * 100 : 0,
    click_to_open_rate: row.opened > 0 ? (row.clicked / row.opened) * 100 : 0,
    bounce_rate: row.total_sent > 0 ? (row.bounced / row.total_sent) * 100 : 0
  }));

  return new Response(JSON.stringify({
    success: true,
    data: {
      type: 'sequences',
      cohorts,
      meta: {
        period_days: 30
      }
    }
  }), { headers: corsHeaders });
}

/**
 * Get segment filter
 */
function getSegmentFilter(segmentId) {
  const filters = {
    'engagement_high': {
      label: 'High Engagement',
      condition: `subscriber_id IN (
        SELECT subscriber_id FROM email_logs
        GROUP BY subscriber_id
        HAVING (SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) * 1.0 / COUNT(*)) >= 0.4
      )`
    },
    'engagement_medium': {
      label: 'Medium Engagement',
      condition: `subscriber_id IN (
        SELECT subscriber_id FROM email_logs
        GROUP BY subscriber_id
        HAVING (SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) * 1.0 / COUNT(*)) BETWEEN 0.15 AND 0.4
      )`
    },
    'engagement_low': {
      label: 'Low Engagement',
      condition: `subscriber_id IN (
        SELECT subscriber_id FROM email_logs
        GROUP BY subscriber_id
        HAVING (SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) * 1.0 / COUNT(*)) < 0.15
      )`
    },
    'geo_cape_cod': {
      label: 'Cape Cod',
      condition: `subscriber_id IN (
        SELECT id FROM email_subscribers
        WHERE custom_fields LIKE '%cape_cod%' OR custom_fields LIKE '%Cape Cod%'
      )`
    },
    'geo_ma': {
      label: 'Massachusetts',
      condition: `subscriber_id IN (
        SELECT id FROM email_subscribers WHERE custom_fields LIKE '%"state":"MA"%'
      )`
    },
    'pos_toast': {
      label: 'Toast POS',
      condition: `subscriber_id IN (
        SELECT id FROM email_subscribers WHERE custom_fields LIKE '%"pos":"toast"%'
      )`
    }
  };

  return filters[segmentId] || null;
}

export async function onRequestOptions() {
  return handleOptions();
}
