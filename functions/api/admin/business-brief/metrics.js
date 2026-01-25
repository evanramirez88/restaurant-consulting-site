/**
 * Business Brief Metrics API
 *
 * GET /api/admin/business-brief/metrics
 *   - Returns metrics snapshots with date range filtering
 *   - Query params: startDate, endDate, type
 *
 * POST /api/admin/business-brief/metrics/snapshot
 *   - Captures current day snapshot (called by cron or manually)
 */

import { verifyAuth, unauthorizedResponse, getCorsOrigin, handleOptions } from '../../../_shared/auth.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

/**
 * Generate a unique ID
 */
function generateId(prefix = 'ms') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get date N days ago in YYYY-MM-DD format
 */
function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
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
    const startDate = url.searchParams.get('startDate') || getDateDaysAgo(30);
    const endDate = url.searchParams.get('endDate') || getTodayDate();
    const metricType = url.searchParams.get('type'); // Optional filter

    // Build query
    let query = `
      SELECT id, snapshot_date, metric_type, metric_value, metric_meta, created_at
      FROM metrics_snapshots
      WHERE snapshot_date >= ? AND snapshot_date <= ?
    `;
    const params = [startDate, endDate];

    if (metricType) {
      query += ' AND metric_type = ?';
      params.push(metricType);
    }

    query += ' ORDER BY snapshot_date DESC, metric_type';

    const snapshots = await env.DB.prepare(query).bind(...params).all();

    // Group by date for easier consumption
    const byDate = {};
    const byType = {};

    for (const snapshot of snapshots.results || []) {
      const date = snapshot.snapshot_date;
      const type = snapshot.metric_type;

      if (!byDate[date]) byDate[date] = {};
      byDate[date][type] = {
        value: snapshot.metric_value,
        meta: snapshot.metric_meta ? JSON.parse(snapshot.metric_meta) : null
      };

      if (!byType[type]) byType[type] = [];
      byType[type].push({
        date: snapshot.snapshot_date,
        value: snapshot.metric_value,
        meta: snapshot.metric_meta ? JSON.parse(snapshot.metric_meta) : null
      });
    }

    return new Response(JSON.stringify({
      success: true,
      startDate,
      endDate,
      snapshots: snapshots.results || [],
      byDate,
      byType,
      count: (snapshots.results || []).length
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Metrics API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    // Verify admin auth
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json().catch(() => ({}));
    const snapshotDate = body.date || getTodayDate();

    // Collect current metrics from various sources
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

    // Parallel fetch all metrics
    const [
      revenueMetrics,
      clientMetrics,
      pipelineMetrics,
      emailMetrics,
      supportMetrics,
      engagementMetrics
    ] = await Promise.all([
      // Revenue: MRR from active subscriptions
      env.DB.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN billing_interval = 'month' THEN amount ELSE amount / 12 END), 0) as mrr,
          COUNT(*) as subscription_count
        FROM stripe_subscriptions
        WHERE status = 'active'
      `).first().catch(() => ({ mrr: 0, subscription_count: 0 })),

      // Clients: Active clients and plan breakdown
      env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN support_plan_status = 'active' THEN 1 ELSE 0 END) as active_plans,
          SUM(CASE WHEN support_plan_tier = 'core' AND support_plan_status = 'active' THEN 1 ELSE 0 END) as core,
          SUM(CASE WHEN support_plan_tier = 'professional' AND support_plan_status = 'active' THEN 1 ELSE 0 END) as professional,
          SUM(CASE WHEN support_plan_tier = 'premium' AND support_plan_status = 'active' THEN 1 ELSE 0 END) as premium
        FROM clients
      `).first().catch(() => ({ total: 0, active_plans: 0, core: 0, professional: 0, premium: 0 })),

      // Pipeline: Active quotes and value
      env.DB.prepare(`
        SELECT
          COUNT(*) as active_quotes,
          COALESCE(SUM(total_quote), 0) as pipeline_value
        FROM quotes
        WHERE status IN ('sent', 'viewed')
      `).first().catch(() => ({ active_quotes: 0, pipeline_value: 0 })),

      // Email: Delivery and engagement metrics (last 30 days)
      env.DB.prepare(`
        SELECT
          COUNT(*) as total_sent,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN first_opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
          SUM(CASE WHEN first_clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
          SUM(CASE WHEN status = 'failed' OR status = 'bounced' THEN 1 ELSE 0 END) as failed
        FROM email_logs
        WHERE created_at > ?
      `).bind(thirtyDaysAgo).first().catch(() => ({ total_sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 })),

      // Support: Open tickets and resolution
      env.DB.prepare(`
        SELECT
          SUM(CASE WHEN status IN ('open', 'pending', 'in_progress') THEN 1 ELSE 0 END) as open_tickets,
          SUM(CASE WHEN status = 'resolved' AND updated_at > ? THEN 1 ELSE 0 END) as resolved_30d,
          COUNT(*) as total_tickets
        FROM tickets
        WHERE visibility = 'client'
      `).bind(thirtyDaysAgo).first().catch(() => ({ open_tickets: 0, resolved_30d: 0, total_tickets: 0 })),

      // Engagement: Portal logins and activity
      env.DB.prepare(`
        SELECT
          COUNT(*) as active_sessions
        FROM portal_sessions
        WHERE expires_at > ?
      `).bind(now).first().catch(() => ({ active_sessions: 0 }))
    ]);

    // Calculate derived metrics
    const mrr = revenueMetrics?.mrr || 0;
    const openRate = emailMetrics?.total_sent > 0
      ? (emailMetrics.opened / emailMetrics.total_sent) * 100
      : 0;
    const deliveryRate = emailMetrics?.total_sent > 0
      ? (emailMetrics.delivered / emailMetrics.total_sent) * 100
      : 100;

    // Prepare snapshots to insert
    const snapshots = [
      {
        id: generateId('ms_rev'),
        type: 'revenue',
        value: mrr,
        meta: {
          arr: mrr * 12,
          subscriptions: revenueMetrics?.subscription_count || 0
        }
      },
      {
        id: generateId('ms_cli'),
        type: 'clients',
        value: clientMetrics?.active_plans || 0,
        meta: {
          total: clientMetrics?.total || 0,
          core: clientMetrics?.core || 0,
          professional: clientMetrics?.professional || 0,
          premium: clientMetrics?.premium || 0
        }
      },
      {
        id: generateId('ms_pip'),
        type: 'pipeline',
        value: pipelineMetrics?.pipeline_value || 0,
        meta: {
          activeQuotes: pipelineMetrics?.active_quotes || 0
        }
      },
      {
        id: generateId('ms_eml'),
        type: 'email',
        value: openRate,
        meta: {
          sent: emailMetrics?.total_sent || 0,
          delivered: emailMetrics?.delivered || 0,
          opened: emailMetrics?.opened || 0,
          clicked: emailMetrics?.clicked || 0,
          deliveryRate: deliveryRate
        }
      },
      {
        id: generateId('ms_sup'),
        type: 'support',
        value: supportMetrics?.open_tickets || 0,
        meta: {
          resolved30d: supportMetrics?.resolved_30d || 0,
          total: supportMetrics?.total_tickets || 0
        }
      },
      {
        id: generateId('ms_eng'),
        type: 'engagement',
        value: engagementMetrics?.active_sessions || 0,
        meta: {}
      }
    ];

    // Insert/update snapshots (upsert using INSERT OR REPLACE)
    const insertStmt = env.DB.prepare(`
      INSERT OR REPLACE INTO metrics_snapshots (id, snapshot_date, metric_type, metric_value, metric_meta)
      VALUES (?, ?, ?, ?, ?)
    `);

    const results = [];
    for (const snapshot of snapshots) {
      try {
        await insertStmt.bind(
          snapshot.id,
          snapshotDate,
          snapshot.type,
          snapshot.value,
          JSON.stringify(snapshot.meta)
        ).run();
        results.push({ type: snapshot.type, success: true });
      } catch (err) {
        results.push({ type: snapshot.type, success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      date: snapshotDate,
      snapshots: results,
      metrics: {
        revenue: mrr,
        clients: clientMetrics?.active_plans || 0,
        pipeline: pipelineMetrics?.pipeline_value || 0,
        emailOpenRate: openRate,
        openTickets: supportMetrics?.open_tickets || 0
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Metrics snapshot error:', error);
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
