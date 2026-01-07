/**
 * Email Analytics API - Main Analytics Endpoint
 *
 * GET /api/admin/email/analytics - Get email analytics totals and trends
 *
 * Query params:
 *   - sequence_id: Filter by specific sequence (optional)
 *   - start_date: Start date in YYYY-MM-DD format
 *   - end_date: End date in YYYY-MM-DD format
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

    // Default to last 30 days if no dates provided
    const now = new Date();
    const defaultEnd = now.toISOString().split('T')[0];
    const defaultStart = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];

    const start = startDate || defaultStart;
    const end = endDate || defaultEnd;

    // Convert dates to Unix timestamps
    const startTs = Math.floor(new Date(start).getTime() / 1000);
    const endTs = Math.floor(new Date(end + 'T23:59:59').getTime() / 1000);

    // Calculate previous period for trends
    const periodDays = Math.ceil((endTs - startTs) / 86400);
    const prevEndTs = startTs - 1;
    const prevStartTs = prevEndTs - (periodDays * 86400);

    // Build query for current period
    let currentQuery = `
      SELECT
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'delivered' OR status = 'sent' OR opened_at IS NOT NULL THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
        SUM(CASE WHEN bounced_at IS NOT NULL OR status = 'bounced' THEN 1 ELSE 0 END) as bounced,
        SUM(CASE WHEN status = 'unsubscribed' THEN 1 ELSE 0 END) as unsubscribed
      FROM email_logs
      WHERE created_at >= ? AND created_at <= ?
    `;

    let previousQuery = `
      SELECT
        COUNT(*) as total_sent,
        SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
        SUM(CASE WHEN bounced_at IS NOT NULL OR status = 'bounced' THEN 1 ELSE 0 END) as bounced
      FROM email_logs
      WHERE created_at >= ? AND created_at <= ?
    `;

    const currentParams = [startTs, endTs];
    const previousParams = [prevStartTs, prevEndTs];

    // Add sequence filter if provided
    if (sequenceId) {
      currentQuery += ' AND sequence_id = ?';
      previousQuery += ' AND sequence_id = ?';
      currentParams.push(sequenceId);
      previousParams.push(sequenceId);
    }

    // Execute queries
    const [currentResult, previousResult] = await Promise.all([
      db.prepare(currentQuery).bind(...currentParams).first(),
      db.prepare(previousQuery).bind(...previousParams).first()
    ]);

    // Calculate rates for current period
    const current = {
      total_sent: currentResult?.total_sent || 0,
      delivered: currentResult?.delivered || 0,
      opened: currentResult?.opened || 0,
      clicked: currentResult?.clicked || 0,
      bounced: currentResult?.bounced || 0,
      unsubscribed: currentResult?.unsubscribed || 0,
      open_rate: currentResult?.total_sent > 0
        ? ((currentResult?.opened || 0) / currentResult.total_sent) * 100
        : 0,
      click_rate: currentResult?.total_sent > 0
        ? ((currentResult?.clicked || 0) / currentResult.total_sent) * 100
        : 0,
      bounce_rate: currentResult?.total_sent > 0
        ? ((currentResult?.bounced || 0) / currentResult.total_sent) * 100
        : 0,
      unsub_rate: currentResult?.total_sent > 0
        ? ((currentResult?.unsubscribed || 0) / currentResult.total_sent) * 100
        : 0
    };

    // Calculate rates for previous period (for trend comparison)
    const previous = {
      total_sent: previousResult?.total_sent || 0,
      open_rate: previousResult?.total_sent > 0
        ? ((previousResult?.opened || 0) / previousResult.total_sent) * 100
        : 0,
      click_rate: previousResult?.total_sent > 0
        ? ((previousResult?.clicked || 0) / previousResult.total_sent) * 100
        : 0,
      bounce_rate: previousResult?.total_sent > 0
        ? ((previousResult?.bounced || 0) / previousResult.total_sent) * 100
        : 0
    };

    return new Response(JSON.stringify({
      success: true,
      data: {
        current,
        previous,
        period: {
          start,
          end,
          days: periodDays
        }
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Analytics GET error:', error);
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
