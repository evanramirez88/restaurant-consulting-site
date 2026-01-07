/**
 * Email Analytics API - Top Performing Content
 *
 * GET /api/admin/email/analytics/top-content - Get top performing email content
 *
 * Query params:
 *   - sequence_id: Filter by specific sequence (optional)
 *   - start_date: Start date in YYYY-MM-DD format
 *   - end_date: End date in YYYY-MM-DD format
 *   - metric: Sort by 'open_rate' or 'click_rate' (default: 'open_rate')
 *   - limit: Number of results (default: 5, max: 20)
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
    const metric = url.searchParams.get('metric') || 'open_rate';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '5'), 20);

    // Validate metric
    const validMetrics = ['open_rate', 'click_rate'];
    if (!validMetrics.includes(metric)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid metric. Must be "open_rate" or "click_rate"'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Default to last 30 days if no dates provided
    const now = new Date();
    const defaultEnd = now.toISOString().split('T')[0];
    const defaultStart = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];

    const start = startDate || defaultStart;
    const end = endDate || defaultEnd;

    // Convert dates to Unix timestamps
    const startTs = Math.floor(new Date(start).getTime() / 1000);
    const endTs = Math.floor(new Date(end + 'T23:59:59').getTime() / 1000);

    // Build query to get top performing content by step
    let query = `
      SELECT
        el.step_id,
        ss.subject,
        COUNT(*) as sent,
        SUM(CASE WHEN el.opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN el.clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
        CASE
          WHEN COUNT(*) > 0 THEN (SUM(CASE WHEN el.opened_at IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*))
          ELSE 0
        END as open_rate,
        CASE
          WHEN COUNT(*) > 0 THEN (SUM(CASE WHEN el.clicked_at IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*))
          ELSE 0
        END as click_rate
      FROM email_logs el
      LEFT JOIN sequence_steps ss ON el.step_id = ss.id
      WHERE el.created_at >= ? AND el.created_at <= ?
        AND el.step_id IS NOT NULL
    `;

    const params = [startTs, endTs];

    // Add sequence filter if provided
    if (sequenceId) {
      query += ' AND el.sequence_id = ?';
      params.push(sequenceId);
    }

    // Group by step and order by chosen metric
    query += `
      GROUP BY el.step_id
      HAVING COUNT(*) >= 10
      ORDER BY ${metric} DESC
      LIMIT ?
    `;
    params.push(limit);

    // Execute query
    const { results } = await db.prepare(query).bind(...params).all();

    // Format results
    const topContent = (results || []).map(row => ({
      step_id: row.step_id,
      subject: row.subject || 'Unknown Subject',
      sent: row.sent || 0,
      opened: row.opened || 0,
      clicked: row.clicked || 0,
      open_rate: parseFloat((row.open_rate || 0).toFixed(2)),
      click_rate: parseFloat((row.click_rate || 0).toFixed(2))
    }));

    return new Response(JSON.stringify({
      success: true,
      data: topContent,
      meta: {
        start,
        end,
        sequence_id: sequenceId || 'all',
        metric,
        limit
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Top Content GET error:', error);
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
