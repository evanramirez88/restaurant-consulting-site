/**
 * Business Brief Revenue API
 *
 * GET /api/admin/business-brief/revenue
 *   - Returns revenue events and totals with date range filtering
 *   - Query params: startDate, endDate, source, eventType
 */

import { verifyAuth, unauthorizedResponse, getCorsOrigin, handleOptions } from '../../../_shared/auth.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

/**
 * Get date N days ago as Unix timestamp
 */
function getTimestampDaysAgo(days) {
  return Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    // Verify admin auth
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const url = new URL(request.url);
    const daysBack = parseInt(url.searchParams.get('days') || '30', 10);
    const source = url.searchParams.get('source'); // 'stripe', 'square', 'manual'
    const eventType = url.searchParams.get('eventType'); // 'invoice_paid', 'subscription_started', etc.

    const now = Math.floor(Date.now() / 1000);
    const startTimestamp = getTimestampDaysAgo(daysBack);

    // Build revenue events query
    let eventsQuery = `
      SELECT
        re.id,
        re.client_id,
        re.event_type,
        re.amount,
        re.event_date,
        re.source,
        re.reference_id,
        re.meta,
        c.company as client_name
      FROM revenue_events re
      LEFT JOIN clients c ON re.client_id = c.id
      WHERE re.event_date >= ?
    `;
    const params = [startTimestamp];

    if (source) {
      eventsQuery += ' AND re.source = ?';
      params.push(source);
    }
    if (eventType) {
      eventsQuery += ' AND re.event_type = ?';
      params.push(eventType);
    }

    eventsQuery += ' ORDER BY re.event_date DESC LIMIT 500';

    // Parallel data fetching
    const [
      revenueEvents,
      totalsBySource,
      totalsByType,
      dailyTotals,
      mrrData
    ] = await Promise.all([
      // Recent revenue events
      env.DB.prepare(eventsQuery).bind(...params).all().catch(() => ({ results: [] })),

      // Totals by source
      env.DB.prepare(`
        SELECT
          source,
          SUM(amount) as total,
          COUNT(*) as count
        FROM revenue_events
        WHERE event_date >= ? AND event_type NOT IN ('refund', 'subscription_cancelled')
        GROUP BY source
      `).bind(startTimestamp).all().catch(() => ({ results: [] })),

      // Totals by event type
      env.DB.prepare(`
        SELECT
          event_type,
          SUM(amount) as total,
          COUNT(*) as count
        FROM revenue_events
        WHERE event_date >= ?
        GROUP BY event_type
      `).bind(startTimestamp).all().catch(() => ({ results: [] })),

      // Daily totals for chart
      env.DB.prepare(`
        SELECT
          date(event_date, 'unixepoch') as date,
          SUM(CASE WHEN event_type NOT IN ('refund', 'subscription_cancelled') THEN amount ELSE 0 END) as revenue,
          SUM(CASE WHEN event_type = 'refund' THEN amount ELSE 0 END) as refunds,
          COUNT(*) as event_count
        FROM revenue_events
        WHERE event_date >= ?
        GROUP BY date(event_date, 'unixepoch')
        ORDER BY date ASC
      `).bind(startTimestamp).all().catch(() => ({ results: [] })),

      // Current MRR from subscriptions
      env.DB.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN billing_interval = 'month' THEN amount ELSE amount / 12 END), 0) as mrr,
          COUNT(*) as active_subscriptions
        FROM stripe_subscriptions
        WHERE status = 'active'
      `).first().catch(() => ({ mrr: 0, active_subscriptions: 0 }))
    ]);

    // Calculate summary statistics
    const bySource = {};
    for (const row of totalsBySource.results || []) {
      bySource[row.source || 'unknown'] = {
        total: row.total || 0,
        count: row.count || 0
      };
    }

    const byType = {};
    for (const row of totalsByType.results || []) {
      byType[row.event_type] = {
        total: row.total || 0,
        count: row.count || 0
      };
    }

    // Calculate total revenue (excluding refunds and cancellations)
    let totalRevenue = 0;
    let totalRefunds = 0;
    for (const row of totalsByType.results || []) {
      if (row.event_type === 'refund') {
        totalRefunds += row.total || 0;
      } else if (row.event_type !== 'subscription_cancelled') {
        totalRevenue += row.total || 0;
      }
    }

    // Prepare daily data for charts
    const dailyData = (dailyTotals.results || []).map(row => ({
      date: row.date,
      revenue: row.revenue || 0,
      refunds: row.refunds || 0,
      netRevenue: (row.revenue || 0) - (row.refunds || 0),
      eventCount: row.event_count || 0
    }));

    return new Response(JSON.stringify({
      success: true,
      period: {
        days: daysBack,
        startDate: new Date(startTimestamp * 1000).toISOString().split('T')[0],
        endDate: new Date(now * 1000).toISOString().split('T')[0]
      },
      summary: {
        totalRevenue,
        totalRefunds,
        netRevenue: totalRevenue - totalRefunds,
        currentMRR: mrrData?.mrr || 0,
        currentARR: (mrrData?.mrr || 0) * 12,
        activeSubscriptions: mrrData?.active_subscriptions || 0
      },
      bySource,
      byType,
      dailyData,
      events: (revenueEvents.results || []).map(e => ({
        id: e.id,
        clientId: e.client_id,
        clientName: e.client_name,
        eventType: e.event_type,
        amount: e.amount,
        eventDate: e.event_date,
        source: e.source,
        referenceId: e.reference_id,
        meta: e.meta ? JSON.parse(e.meta) : null
      })),
      eventCount: (revenueEvents.results || []).length
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Revenue API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
