/**
 * Email Analytics API - Link Click Breakdown
 *
 * GET /api/admin/email/analytics/links - Get link click breakdown
 *
 * Query params:
 *   - sequence_id: Filter by sequence (optional)
 *   - step_id: Filter by step (optional)
 *   - start_date: Start date in YYYY-MM-DD format
 *   - end_date: End date in YYYY-MM-DD format
 *   - limit: Max number of links to return (default: 20)
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
    const stepId = url.searchParams.get('step_id');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

    // Default to last 30 days
    const now = new Date();
    const defaultEnd = now.toISOString().split('T')[0];
    const defaultStart = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];

    const start = startDate || defaultStart;
    const end = endDate || defaultEnd;

    // Convert dates to Unix timestamps
    const startTs = Math.floor(new Date(start).getTime() / 1000);
    const endTs = Math.floor(new Date(end + 'T23:59:59').getTime() / 1000);

    // Build query for link clicks
    let query = `
      SELECT
        clicked_link as url,
        COUNT(*) as total_clicks,
        COUNT(DISTINCT subscriber_id) as unique_clicks,
        MIN(clicked_at) as first_click,
        MAX(clicked_at) as last_click
      FROM email_logs
      WHERE clicked_at IS NOT NULL
        AND clicked_link IS NOT NULL
        AND clicked_link != ''
        AND clicked_at >= ? AND clicked_at <= ?
    `;

    const params = [startTs, endTs];

    if (sequenceId) {
      query += ' AND sequence_id = ?';
      params.push(sequenceId);
    }

    if (stepId) {
      query += ' AND step_id = ?';
      params.push(stepId);
    }

    query += ` GROUP BY clicked_link ORDER BY total_clicks DESC LIMIT ?`;
    params.push(limit);

    // Execute query
    const { results } = await db.prepare(query).bind(...params).all();

    // Get total clicks for percentage calculation
    let totalQuery = `
      SELECT COUNT(*) as total FROM email_logs
      WHERE clicked_at IS NOT NULL AND clicked_at >= ? AND clicked_at <= ?
    `;
    const totalParams = [startTs, endTs];

    if (sequenceId) {
      totalQuery += ' AND sequence_id = ?';
      totalParams.push(sequenceId);
    }
    if (stepId) {
      totalQuery += ' AND step_id = ?';
      totalParams.push(stepId);
    }

    const totalResult = await db.prepare(totalQuery).bind(...totalParams).first();
    const totalClicks = totalResult?.total || 0;

    // Process and format results
    const links = (results || []).map(row => {
      // Extract domain and path from URL
      let domain = '';
      let path = '';
      try {
        const urlObj = new URL(row.url);
        domain = urlObj.hostname;
        path = urlObj.pathname + urlObj.search;
      } catch {
        domain = row.url;
      }

      return {
        url: row.url,
        domain,
        path: path.length > 50 ? path.substring(0, 47) + '...' : path,
        total_clicks: row.total_clicks,
        unique_clicks: row.unique_clicks,
        percentage: totalClicks > 0 ? (row.total_clicks / totalClicks) * 100 : 0,
        first_click: row.first_click,
        last_click: row.last_click
      };
    });

    // Get top domains summary
    const domainCounts = {};
    links.forEach(link => {
      domainCounts[link.domain] = (domainCounts[link.domain] || 0) + link.total_clicks;
    });

    const topDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domain, clicks]) => ({
        domain,
        clicks,
        percentage: totalClicks > 0 ? (clicks / totalClicks) * 100 : 0
      }));

    return new Response(JSON.stringify({
      success: true,
      data: {
        links,
        top_domains: topDomains,
        summary: {
          total_clicks: totalClicks,
          unique_links: links.length
        },
        meta: {
          start,
          end,
          sequence_id: sequenceId,
          step_id: stepId
        }
      }
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Link analytics error:', error);
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
