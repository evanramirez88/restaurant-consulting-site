/**
 * Email Analytics API - Funnel Data
 *
 * GET /api/admin/email/analytics/funnel - Get email funnel metrics
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

    // Build query for funnel metrics
    let query = `
      SELECT
        COUNT(*) as sent,
        SUM(CASE WHEN status = 'delivered' OR status = 'sent' OR opened_at IS NOT NULL THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
        SUM(CASE WHEN converted_at IS NOT NULL THEN 1 ELSE 0 END) as converted
      FROM email_logs
      WHERE created_at >= ? AND created_at <= ?
    `;

    const params = [startTs, endTs];

    // Add sequence filter if provided
    if (sequenceId) {
      query += ' AND sequence_id = ?';
      params.push(sequenceId);
    }

    // Execute query
    const result = await db.prepare(query).bind(...params).first();

    // Calculate funnel data with rates
    const sent = result?.sent || 0;
    const delivered = result?.delivered || 0;
    const opened = result?.opened || 0;
    const clicked = result?.clicked || 0;
    const converted = result?.converted || 0;

    const funnel = {
      sent,
      delivered,
      opened,
      clicked,
      converted,
      // Calculate rates as percentages
      delivery_rate: sent > 0 ? (delivered / sent) * 100 : 0,
      open_rate: delivered > 0 ? (opened / delivered) * 100 : 0,
      click_rate: opened > 0 ? (clicked / opened) * 100 : 0,
      conversion_rate: clicked > 0 ? (converted / clicked) * 100 : 0,
      // Overall rates from sent
      overall_open_rate: sent > 0 ? (opened / sent) * 100 : 0,
      overall_click_rate: sent > 0 ? (clicked / sent) * 100 : 0,
      overall_conversion_rate: sent > 0 ? (converted / sent) * 100 : 0
    };

    return new Response(JSON.stringify({
      success: true,
      data: funnel,
      meta: {
        start,
        end,
        sequence_id: sequenceId || 'all'
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Funnel GET error:', error);
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
