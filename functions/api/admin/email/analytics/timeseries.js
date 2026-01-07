/**
 * Email Analytics API - Time Series Data
 *
 * GET /api/admin/email/analytics/timeseries - Get time series data for charts
 *
 * Query params:
 *   - sequence_id: Filter by specific sequence (optional)
 *   - start_date: Start date in YYYY-MM-DD format
 *   - end_date: End date in YYYY-MM-DD format
 *   - granularity: 'day', 'week', or 'month' (default: 'day')
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
    const sequenceId = url.searchParams.get('sequence_id');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const granularity = url.searchParams.get('granularity') || 'day';

    // Default to last 30 days if no dates provided
    const now = new Date();
    const defaultEnd = now.toISOString().split('T')[0];
    const defaultStart = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];

    const start = startDate || defaultStart;
    const end = endDate || defaultEnd;

    // Convert dates to Unix timestamps
    const startTs = Math.floor(new Date(start).getTime() / 1000);
    const endTs = Math.floor(new Date(end + 'T23:59:59').getTime() / 1000);

    // Determine date grouping format based on granularity
    let dateFormat;
    switch (granularity) {
      case 'week':
        dateFormat = "strftime('%Y-W%W', datetime(created_at, 'unixepoch'))";
        break;
      case 'month':
        dateFormat = "strftime('%Y-%m', datetime(created_at, 'unixepoch'))";
        break;
      case 'day':
      default:
        dateFormat = "strftime('%Y-%m-%d', datetime(created_at, 'unixepoch'))";
        break;
    }

    // Build query
    let query = `
      SELECT
        ${dateFormat} as date,
        COUNT(*) as sent,
        SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
        SUM(CASE WHEN bounced_at IS NOT NULL OR status = 'bounced' THEN 1 ELSE 0 END) as bounced
      FROM email_logs
      WHERE created_at >= ? AND created_at <= ?
    `;

    const params = [startTs, endTs];

    // Add sequence filter if provided
    if (sequenceId) {
      query += ' AND sequence_id = ?';
      params.push(sequenceId);
    }

    query += ` GROUP BY ${dateFormat} ORDER BY date ASC`;

    // Execute query
    const { results } = await db.prepare(query).bind(...params).all();

    // Fill in missing dates for continuous time series
    const filledData = fillMissingDates(results || [], start, end, granularity);

    return new Response(JSON.stringify({
      success: true,
      data: filledData,
      meta: {
        granularity,
        start,
        end,
        total_points: filledData.length
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Timeseries GET error:', error);
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
 * Fill in missing dates with zero values for continuous time series
 */
function fillMissingDates(data, startDate, endDate, granularity) {
  const dataMap = new Map(data.map(d => [d.date, d]));
  const result = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  let current = new Date(start);

  while (current <= end) {
    let dateKey;

    switch (granularity) {
      case 'week':
        // Get ISO week number
        const weekStart = new Date(current);
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        const yearStart = new Date(weekStart.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((weekStart - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
        dateKey = `${weekStart.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
        current.setDate(current.getDate() + 7);
        break;

      case 'month':
        dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        current.setMonth(current.getMonth() + 1);
        break;

      case 'day':
      default:
        dateKey = current.toISOString().split('T')[0];
        current.setDate(current.getDate() + 1);
        break;
    }

    const existing = dataMap.get(dateKey);
    if (existing) {
      result.push({
        date: dateKey,
        sent: existing.sent || 0,
        opened: existing.opened || 0,
        clicked: existing.clicked || 0,
        bounced: existing.bounced || 0
      });
    } else {
      result.push({
        date: dateKey,
        sent: 0,
        opened: 0,
        clicked: 0,
        bounced: 0
      });
    }

    // Prevent duplicate entries for weekly/monthly
    if (granularity === 'week' || granularity === 'month') {
      dataMap.delete(dateKey);
    }
  }

  return result;
}

export async function onRequestOptions() {
  return handleOptions();
}
