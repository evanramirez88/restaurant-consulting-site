/**
 * Business Brief Trends API
 *
 * GET /api/admin/business-brief/trends
 *   - Returns calculated trends (week-over-week, month-over-month)
 *   - Provides comparative analysis for key metrics
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
 * Get date in YYYY-MM-DD format
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Get date N days ago
 */
function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

/**
 * Calculate percentage change
 */
function calcPercentChange(current, previous) {
  if (!previous || previous === 0) {
    if (current > 0) return 100;
    return 0;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Determine trend direction
 */
function getTrendDirection(change) {
  if (change > 2) return 'up';
  if (change < -2) return 'down';
  return 'stable';
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

    const today = formatDate(new Date());
    const oneWeekAgo = getDateDaysAgo(7);
    const twoWeeksAgo = getDateDaysAgo(14);
    const oneMonthAgo = getDateDaysAgo(30);
    const twoMonthsAgo = getDateDaysAgo(60);

    const now = Math.floor(Date.now() / 1000);
    const weekAgoTs = now - (7 * 24 * 60 * 60);
    const twoWeeksAgoTs = now - (14 * 24 * 60 * 60);
    const monthAgoTs = now - (30 * 24 * 60 * 60);
    const twoMonthsAgoTs = now - (60 * 24 * 60 * 60);

    // Parallel data fetching for trend calculations
    const [
      // Current period metrics
      currentRevenue,
      currentClients,
      currentPipeline,
      currentEmail,
      currentSupport,

      // Previous week metrics
      prevWeekRevenue,
      prevWeekClients,
      prevWeekEmail,
      prevWeekSupport,

      // Previous month metrics
      prevMonthRevenue,
      prevMonthClients,

      // Metrics snapshots for historical comparison
      recentSnapshots,

      // Lead progression data
      leadConversions
    ] = await Promise.all([
      // Current MRR
      env.DB.prepare(`
        SELECT COALESCE(SUM(CASE WHEN billing_interval = 'month' THEN amount ELSE amount / 12 END), 0) as mrr
        FROM stripe_subscriptions WHERE status = 'active'
      `).first().catch(() => ({ mrr: 0 })),

      // Current active clients
      env.DB.prepare(`
        SELECT COUNT(*) as count FROM clients WHERE support_plan_status = 'active'
      `).first().catch(() => ({ count: 0 })),

      // Current pipeline value
      env.DB.prepare(`
        SELECT COUNT(*) as quotes, COALESCE(SUM(total_quote), 0) as value
        FROM quotes WHERE status IN ('sent', 'viewed')
      `).first().catch(() => ({ quotes: 0, value: 0 })),

      // Current week email metrics
      env.DB.prepare(`
        SELECT
          COUNT(*) as sent,
          SUM(CASE WHEN first_opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened
        FROM email_logs WHERE created_at >= ?
      `).bind(weekAgoTs).first().catch(() => ({ sent: 0, opened: 0 })),

      // Current week support tickets
      env.DB.prepare(`
        SELECT
          SUM(CASE WHEN status IN ('open', 'pending', 'in_progress') THEN 1 ELSE 0 END) as open_tickets,
          SUM(CASE WHEN status = 'resolved' AND updated_at >= ? THEN 1 ELSE 0 END) as resolved
        FROM tickets WHERE visibility = 'client'
      `).bind(weekAgoTs).first().catch(() => ({ open_tickets: 0, resolved: 0 })),

      // Previous week revenue (from snapshots)
      env.DB.prepare(`
        SELECT metric_value as mrr FROM metrics_snapshots
        WHERE snapshot_date = ? AND metric_type = 'revenue'
      `).bind(oneWeekAgo).first().catch(() => null),

      // Previous week clients (from snapshots)
      env.DB.prepare(`
        SELECT metric_value as count FROM metrics_snapshots
        WHERE snapshot_date = ? AND metric_type = 'clients'
      `).bind(oneWeekAgo).first().catch(() => null),

      // Previous week email metrics
      env.DB.prepare(`
        SELECT
          COUNT(*) as sent,
          SUM(CASE WHEN first_opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened
        FROM email_logs WHERE created_at >= ? AND created_at < ?
      `).bind(twoWeeksAgoTs, weekAgoTs).first().catch(() => ({ sent: 0, opened: 0 })),

      // Previous week support
      env.DB.prepare(`
        SELECT
          SUM(CASE WHEN status = 'resolved' AND updated_at >= ? AND updated_at < ? THEN 1 ELSE 0 END) as resolved
        FROM tickets WHERE visibility = 'client'
      `).bind(twoWeeksAgoTs, weekAgoTs).first().catch(() => ({ resolved: 0 })),

      // Previous month revenue (from snapshots)
      env.DB.prepare(`
        SELECT metric_value as mrr FROM metrics_snapshots
        WHERE snapshot_date = ? AND metric_type = 'revenue'
      `).bind(oneMonthAgo).first().catch(() => null),

      // Previous month clients (from snapshots)
      env.DB.prepare(`
        SELECT metric_value as count FROM metrics_snapshots
        WHERE snapshot_date = ? AND metric_type = 'clients'
      `).bind(oneMonthAgo).first().catch(() => null),

      // Recent snapshots for sparkline data
      env.DB.prepare(`
        SELECT snapshot_date, metric_type, metric_value
        FROM metrics_snapshots
        WHERE snapshot_date >= ?
        ORDER BY snapshot_date ASC
      `).bind(getDateDaysAgo(30)).all().catch(() => ({ results: [] })),

      // Lead conversions this week vs last week
      env.DB.prepare(`
        SELECT
          SUM(CASE WHEN updated_at >= ? THEN 1 ELSE 0 END) as this_week,
          SUM(CASE WHEN updated_at >= ? AND updated_at < ? THEN 1 ELSE 0 END) as last_week
        FROM restaurant_leads
        WHERE status = 'client'
      `).bind(weekAgoTs, twoWeeksAgoTs, weekAgoTs).first().catch(() => ({ this_week: 0, last_week: 0 }))
    ]);

    // Calculate trends
    const currentMRR = currentRevenue?.mrr || 0;
    const prevWeekMRR = prevWeekRevenue?.mrr || currentMRR;
    const prevMonthMRR = prevMonthRevenue?.mrr || currentMRR;

    const currentClientsCount = currentClients?.count || 0;
    const prevWeekClientsCount = prevWeekClients?.count || currentClientsCount;
    const prevMonthClientsCount = prevMonthClients?.count || currentClientsCount;

    const currentOpenRate = currentEmail?.sent > 0 ? (currentEmail.opened / currentEmail.sent) * 100 : 0;
    const prevWeekOpenRate = prevWeekEmail?.sent > 0 ? (prevWeekEmail.opened / prevWeekEmail.sent) * 100 : 0;

    const currentResolved = currentSupport?.resolved || 0;
    const prevWeekResolved = prevWeekSupport?.resolved || 0;

    // Build sparkline data from snapshots
    const sparklineData = {
      revenue: [],
      clients: [],
      pipeline: [],
      email: []
    };

    for (const snapshot of recentSnapshots.results || []) {
      const type = snapshot.metric_type;
      if (sparklineData[type]) {
        sparklineData[type].push({
          date: snapshot.snapshot_date,
          value: snapshot.metric_value
        });
      }
    }

    // Build trend response
    const trends = {
      revenue: {
        current: currentMRR,
        wow: {
          previous: prevWeekMRR,
          change: calcPercentChange(currentMRR, prevWeekMRR),
          direction: getTrendDirection(calcPercentChange(currentMRR, prevWeekMRR))
        },
        mom: {
          previous: prevMonthMRR,
          change: calcPercentChange(currentMRR, prevMonthMRR),
          direction: getTrendDirection(calcPercentChange(currentMRR, prevMonthMRR))
        },
        sparkline: sparklineData.revenue
      },
      clients: {
        current: currentClientsCount,
        wow: {
          previous: prevWeekClientsCount,
          change: calcPercentChange(currentClientsCount, prevWeekClientsCount),
          direction: getTrendDirection(calcPercentChange(currentClientsCount, prevWeekClientsCount))
        },
        mom: {
          previous: prevMonthClientsCount,
          change: calcPercentChange(currentClientsCount, prevMonthClientsCount),
          direction: getTrendDirection(calcPercentChange(currentClientsCount, prevMonthClientsCount))
        },
        sparkline: sparklineData.clients
      },
      pipeline: {
        current: currentPipeline?.value || 0,
        activeQuotes: currentPipeline?.quotes || 0,
        sparkline: sparklineData.pipeline
      },
      email: {
        currentOpenRate,
        wow: {
          previous: prevWeekOpenRate,
          change: calcPercentChange(currentOpenRate, prevWeekOpenRate),
          direction: getTrendDirection(calcPercentChange(currentOpenRate, prevWeekOpenRate))
        },
        sparkline: sparklineData.email
      },
      support: {
        openTickets: currentSupport?.open_tickets || 0,
        resolvedThisWeek: currentResolved,
        wow: {
          previous: prevWeekResolved,
          change: calcPercentChange(currentResolved, prevWeekResolved),
          direction: getTrendDirection(calcPercentChange(currentResolved, prevWeekResolved))
        }
      },
      conversions: {
        thisWeek: leadConversions?.this_week || 0,
        lastWeek: leadConversions?.last_week || 0,
        change: calcPercentChange(leadConversions?.this_week || 0, leadConversions?.last_week || 0),
        direction: getTrendDirection(calcPercentChange(leadConversions?.this_week || 0, leadConversions?.last_week || 0))
      }
    };

    return new Response(JSON.stringify({
      success: true,
      generatedAt: now,
      period: {
        today,
        oneWeekAgo,
        oneMonthAgo
      },
      trends
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Trends API error:', error);
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
