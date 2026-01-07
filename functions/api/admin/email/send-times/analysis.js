/**
 * Send Time Analysis API
 *
 * GET /api/admin/email/send-times/analysis - Get optimal send times analysis
 *
 * Query params:
 *   - segment: Filter by segment (optional)
 *   - by_segment: Return breakdown by segment (optional)
 *   - start_date: Start date for analysis (optional, defaults to 90 days)
 *   - end_date: End date for analysis (optional)
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
    const segment = url.searchParams.get('segment');
    const bySegment = url.searchParams.get('by_segment') === 'true';
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    // Default to last 90 days for analysis
    const now = new Date();
    const defaultEnd = now.toISOString().split('T')[0];
    const defaultStart = new Date(now.setDate(now.getDate() - 90)).toISOString().split('T')[0];

    const start = startDate || defaultStart;
    const end = endDate || defaultEnd;

    // Convert dates to Unix timestamps
    const startTs = Math.floor(new Date(start).getTime() / 1000);
    const endTs = Math.floor(new Date(end + 'T23:59:59').getTime() / 1000);

    if (bySegment) {
      // Return breakdown by segment
      const segmentData = await getSegmentAnalysis(db, startTs, endTs);
      return new Response(JSON.stringify({
        success: true,
        data: {
          by_segment: segmentData
        }
      }), { headers: corsHeaders });
    }

    // Build base query for heatmap data
    let heatmapQuery = `
      SELECT
        CAST(strftime('%w', datetime(created_at, 'unixepoch')) AS INTEGER) as day_of_week,
        CAST(strftime('%H', datetime(created_at, 'unixepoch')) AS INTEGER) as hour_of_day,
        COUNT(*) as total_sent,
        SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as total_opened
      FROM email_logs
      WHERE created_at >= ? AND created_at <= ?
    `;

    const params = [startTs, endTs];

    // Add segment filter if provided
    if (segment && segment !== 'all') {
      const segmentFilter = getSegmentFilter(segment);
      if (segmentFilter) {
        heatmapQuery += ` AND ${segmentFilter.condition}`;
        if (segmentFilter.params) {
          params.push(...segmentFilter.params);
        }
      }
    }

    heatmapQuery += ` GROUP BY day_of_week, hour_of_day`;

    // Execute query
    const { results } = await db.prepare(heatmapQuery).bind(...params).all();

    // Process heatmap data
    const heatmapData = (results || []).map(row => ({
      day: row.day_of_week,
      hour: row.hour_of_day,
      total_sent: row.total_sent,
      total_opened: row.total_opened,
      open_rate: row.total_sent > 0 ? (row.total_opened / row.total_sent) * 100 : 0
    }));

    // Calculate overall best times
    const bestTimes = calculateBestTimes(heatmapData);

    return new Response(JSON.stringify({
      success: true,
      data: {
        overall_best_times: bestTimes,
        heatmap_data: heatmapData,
        meta: {
          start,
          end,
          segment: segment || 'all',
          total_data_points: heatmapData.length
        }
      }
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Send time analysis error:', error);
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
 * Get segment filter condition
 */
function getSegmentFilter(segment) {
  const filters = {
    // Geographic segments
    'geo_cape_cod': {
      condition: `subscriber_id IN (
        SELECT id FROM email_subscribers
        WHERE custom_fields LIKE '%"region":"cape_cod"%'
        OR custom_fields LIKE '%"state":"MA"%'
        OR custom_fields LIKE '%Cape Cod%'
      )`
    },
    'geo_ma': {
      condition: `subscriber_id IN (
        SELECT id FROM email_subscribers
        WHERE custom_fields LIKE '%"state":"MA"%'
      )`
    },
    'geo_national': {
      condition: `subscriber_id IN (
        SELECT id FROM email_subscribers
        WHERE custom_fields NOT LIKE '%"state":"MA"%'
        OR custom_fields IS NULL
      )`
    },
    // POS segments
    'pos_toast': {
      condition: `subscriber_id IN (
        SELECT id FROM email_subscribers
        WHERE custom_fields LIKE '%"pos":"toast"%'
        OR custom_fields LIKE '%"pos_system":"toast"%'
      )`
    },
    'pos_clover': {
      condition: `subscriber_id IN (
        SELECT id FROM email_subscribers
        WHERE custom_fields LIKE '%"pos":"clover"%'
        OR custom_fields LIKE '%"pos_system":"clover"%'
      )`
    },
    'pos_square': {
      condition: `subscriber_id IN (
        SELECT id FROM email_subscribers
        WHERE custom_fields LIKE '%"pos":"square"%'
        OR custom_fields LIKE '%"pos_system":"square"%'
      )`
    },
    // Engagement segments (based on historical behavior)
    'engagement_high': {
      condition: `subscriber_id IN (
        SELECT subscriber_id FROM email_logs
        GROUP BY subscriber_id
        HAVING (SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) * 1.0 / COUNT(*)) >= 0.4
      )`
    },
    'engagement_medium': {
      condition: `subscriber_id IN (
        SELECT subscriber_id FROM email_logs
        GROUP BY subscriber_id
        HAVING (SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) * 1.0 / COUNT(*)) BETWEEN 0.15 AND 0.4
      )`
    },
    'engagement_low': {
      condition: `subscriber_id IN (
        SELECT subscriber_id FROM email_logs
        GROUP BY subscriber_id
        HAVING (SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) * 1.0 / COUNT(*)) < 0.15
      )`
    }
  };

  return filters[segment] || null;
}

/**
 * Calculate best send times from heatmap data
 */
function calculateBestTimes(heatmapData) {
  // Filter for slots with meaningful data (at least 10 sends)
  const significantSlots = heatmapData.filter(slot => slot.total_sent >= 10);

  // Sort by open rate descending
  const sorted = [...significantSlots].sort((a, b) => b.open_rate - a.open_rate);

  // Calculate confidence based on sample size
  const maxSent = Math.max(...heatmapData.map(d => d.total_sent), 1);

  return sorted.slice(0, 10).map(slot => ({
    hour: slot.hour,
    day: slot.day,
    day_name: DAYS[slot.day],
    open_rate: parseFloat(slot.open_rate.toFixed(2)),
    total_sent: slot.total_sent,
    confidence: slot.total_sent >= maxSent * 0.5 ? 'high' :
                slot.total_sent >= maxSent * 0.2 ? 'medium' : 'low'
  }));
}

/**
 * Get analysis by segment
 */
async function getSegmentAnalysis(db, startTs, endTs) {
  const segments = [
    { key: 'geo_cape_cod', label: 'Cape Cod' },
    { key: 'geo_ma', label: 'Massachusetts' },
    { key: 'geo_national', label: 'National' },
    { key: 'pos_toast', label: 'Toast POS' },
    { key: 'pos_clover', label: 'Clover POS' },
    { key: 'pos_square', label: 'Square POS' },
    { key: 'engagement_high', label: 'High Engagement' },
    { key: 'engagement_medium', label: 'Medium Engagement' },
    { key: 'engagement_low', label: 'Low Engagement' }
  ];

  const results = [];

  for (const seg of segments) {
    try {
      const filter = getSegmentFilter(seg.key);
      if (!filter) continue;

      // Get aggregated stats for segment
      const query = `
        SELECT
          COUNT(*) as total_sent,
          SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as total_opened,
          CAST(strftime('%w', datetime(created_at, 'unixepoch')) AS INTEGER) as best_day,
          CAST(strftime('%H', datetime(created_at, 'unixepoch')) AS INTEGER) as best_hour
        FROM email_logs
        WHERE created_at >= ? AND created_at <= ? AND ${filter.condition}
        GROUP BY best_day, best_hour
        ORDER BY (SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) * 1.0 / COUNT(*)) DESC
        LIMIT 3
      `;

      const { results: segResults } = await db.prepare(query).bind(startTs, endTs).all();

      if (segResults && segResults.length > 0) {
        const totalSent = segResults.reduce((sum, r) => sum + r.total_sent, 0);
        const totalOpened = segResults.reduce((sum, r) => sum + r.total_opened, 0);

        results.push({
          segment: seg.key,
          segment_label: seg.label,
          sample_size: totalSent,
          avg_open_rate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
          best_times: segResults.slice(0, 3).map(r => ({
            day: r.best_day,
            hour: r.best_hour,
            day_name: DAYS[r.best_day],
            open_rate: r.total_sent > 0 ? (r.total_opened / r.total_sent) * 100 : 0
          }))
        });
      }
    } catch (err) {
      console.error(`Error getting segment ${seg.key}:`, err);
    }
  }

  return results;
}

export async function onRequestOptions() {
  return handleOptions();
}
