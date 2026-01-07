/**
 * Error Statistics API
 *
 * GET /api/admin/email/errors/stats - Get error statistics
 *
 * Returns:
 *   - total_24h: Errors in last 24 hours
 *   - total_7d: Errors in last 7 days
 *   - total_30d: Errors in last 30 days
 *   - by_type: Count by error type
 *   - failed_rate: Percentage of emails that failed
 *   - trend: Percentage change from previous period
 *   - trend_data: Daily counts for chart
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
    const now = Math.floor(Date.now() / 1000);

    // Time periods
    const ts24h = now - (24 * 60 * 60);
    const ts7d = now - (7 * 24 * 60 * 60);
    const ts30d = now - (30 * 24 * 60 * 60);
    const ts60d = now - (60 * 24 * 60 * 60);

    // Get counts by time period
    const countsQuery = `
      SELECT
        SUM(CASE WHEN COALESCE(failed_at, created_at) >= ? THEN 1 ELSE 0 END) as total_24h,
        SUM(CASE WHEN COALESCE(failed_at, created_at) >= ? THEN 1 ELSE 0 END) as total_7d,
        COUNT(*) as total_30d
      FROM email_logs
      WHERE status IN ('failed', 'bounced', 'rejected')
      AND COALESCE(failed_at, created_at) >= ?
    `;
    const countsResult = await db.prepare(countsQuery).bind(ts24h, ts7d, ts30d).first();

    // Get counts by error type (last 30 days)
    const typeQuery = `
      SELECT
        COALESCE(error_type, 'unknown') as error_type,
        COUNT(*) as count
      FROM email_logs
      WHERE status IN ('failed', 'bounced', 'rejected')
      AND COALESCE(failed_at, created_at) >= ?
      GROUP BY COALESCE(error_type, 'unknown')
    `;
    const { results: typeResults } = await db.prepare(typeQuery).bind(ts30d).all();

    // Convert to object
    const byType = {
      bounced: 0,
      rejected: 0,
      timed_out: 0,
      invalid_email: 0,
      rate_limited: 0,
      unknown: 0
    };
    for (const row of typeResults) {
      if (byType.hasOwnProperty(row.error_type)) {
        byType[row.error_type] = row.count;
      } else {
        byType.unknown += row.count;
      }
    }

    // Calculate failed rate (last 30 days)
    const totalQuery = `
      SELECT
        COUNT(*) as total_sent,
        SUM(CASE WHEN status IN ('failed', 'bounced', 'rejected') THEN 1 ELSE 0 END) as total_failed
      FROM email_logs
      WHERE created_at >= ?
    `;
    const totalResult = await db.prepare(totalQuery).bind(ts30d).first();
    const failedRate = totalResult?.total_sent > 0
      ? (totalResult.total_failed / totalResult.total_sent) * 100
      : 0;

    // Calculate trend (compare last 30d to previous 30d)
    const prevQuery = `
      SELECT COUNT(*) as count
      FROM email_logs
      WHERE status IN ('failed', 'bounced', 'rejected')
      AND COALESCE(failed_at, created_at) >= ?
      AND COALESCE(failed_at, created_at) < ?
    `;
    const prevResult = await db.prepare(prevQuery).bind(ts60d, ts30d).first();
    const prevCount = prevResult?.count || 0;
    const currentCount = countsResult?.total_30d || 0;
    const trend = prevCount > 0
      ? ((currentCount - prevCount) / prevCount) * 100
      : 0;

    // Get daily trend data (last 14 days)
    const trendQuery = `
      SELECT
        DATE(COALESCE(failed_at, created_at), 'unixepoch') as date,
        COUNT(*) as count
      FROM email_logs
      WHERE status IN ('failed', 'bounced', 'rejected')
      AND COALESCE(failed_at, created_at) >= ?
      GROUP BY DATE(COALESCE(failed_at, created_at), 'unixepoch')
      ORDER BY date ASC
    `;
    const ts14d = now - (14 * 24 * 60 * 60);
    const { results: trendResults } = await db.prepare(trendQuery).bind(ts14d).all();

    // Fill in missing dates
    const trendData = [];
    const startDate = new Date(ts14d * 1000);
    const endDate = new Date(now * 1000);
    const trendMap = new Map(trendResults.map(r => [r.date, r.count]));

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      trendData.push({
        date: dateStr,
        count: trendMap.get(dateStr) || 0
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        total_24h: countsResult?.total_24h || 0,
        total_7d: countsResult?.total_7d || 0,
        total_30d: countsResult?.total_30d || 0,
        by_type: byType,
        failed_rate: parseFloat(failedRate.toFixed(2)),
        trend: parseFloat(trend.toFixed(2)),
        trend_data: trendData
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Error stats GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
