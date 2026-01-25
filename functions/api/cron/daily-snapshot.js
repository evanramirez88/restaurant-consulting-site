/**
 * Daily Snapshot Cron Worker
 *
 * POST /api/cron/daily-snapshot
 *   - Captures daily metrics snapshot
 *   - Should be triggered by Cloudflare Cron Triggers or external scheduler
 *   - Stores: total_revenue, active_clients, pipeline_value, avg_health_score
 *
 * Authentication: Worker API key or admin session
 */

import { verifyAuthOrWorker, unauthorizedResponse, getCorsOrigin, handleOptions } from '../../_shared/auth.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

/**
 * Generate unique ID
 */
function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Health score weights (matching health-score.js)
 */
const WEIGHTS = {
  revenue: 0.35,
  clients: 0.25,
  pipeline: 0.20,
  email: 0.10,
  retention: 0.10
};

const GOALS = {
  revenue: 400000,
  clients: 45,
  monthlyPipeline: 50000
};

function calculateComponentScores(metrics, goals) {
  const scores = {};

  const arr = (metrics.mrr || 0) * 12;
  scores.revenue = Math.min(100, (arr / goals.revenue) * 100);
  scores.clients = Math.min(100, (metrics.activeClients / goals.clients) * 100);

  const pipelineRatio = metrics.pipelineValue / goals.monthlyPipeline;
  if (pipelineRatio >= 2) scores.pipeline = 100;
  else if (pipelineRatio >= 1) scores.pipeline = 80 + (pipelineRatio - 1) * 20;
  else if (pipelineRatio >= 0.5) scores.pipeline = 50 + pipelineRatio * 30;
  else scores.pipeline = pipelineRatio * 50;

  const openRate = metrics.emailOpenRate || 0;
  if (openRate >= 30) scores.email = 100;
  else if (openRate >= 20) scores.email = 80 + (openRate - 20) * 2;
  else if (openRate >= 10) scores.email = 50 + (openRate - 10) * 3;
  else scores.email = openRate * 5;

  const churnRate = metrics.churnRate || 0;
  if (churnRate === 0) scores.retention = 100;
  else if (churnRate <= 2) scores.retention = 100 - (churnRate * 5);
  else if (churnRate <= 5) scores.retention = 90 - ((churnRate - 2) * 10 / 3);
  else if (churnRate <= 10) scores.retention = 80 - ((churnRate - 5) * 6);
  else if (churnRate <= 20) scores.retention = 50 - ((churnRate - 10) * 5);
  else scores.retention = 0;

  return scores;
}

function calculateOverallScore(componentScores) {
  let total = 0;
  for (const [component, score] of Object.entries(componentScores)) {
    total += (score || 0) * (WEIGHTS[component] || 0);
  }
  return Math.round(total * 10) / 10;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    // Verify either worker API key or admin auth
    const auth = await verifyAuthOrWorker(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const today = getTodayDate();
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

    console.log(`[Daily Snapshot] Starting snapshot for ${today}`);

    // Fetch all metrics in parallel
    const [
      revenueData,
      clientData,
      pipelineData,
      emailData,
      supportData,
      leadData,
      churnData,
      engagementData
    ] = await Promise.all([
      // Revenue metrics
      env.DB.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN billing_interval = 'month' THEN amount ELSE amount / 12 END), 0) as mrr,
          COUNT(*) as subscription_count
        FROM stripe_subscriptions
        WHERE status = 'active'
      `).first().catch(() => ({ mrr: 0, subscription_count: 0 })),

      // Client metrics
      env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN support_plan_status = 'active' THEN 1 ELSE 0 END) as active_plans,
          SUM(CASE WHEN support_plan_tier = 'core' AND support_plan_status = 'active' THEN 1 ELSE 0 END) as core,
          SUM(CASE WHEN support_plan_tier = 'professional' AND support_plan_status = 'active' THEN 1 ELSE 0 END) as professional,
          SUM(CASE WHEN support_plan_tier = 'premium' AND support_plan_status = 'active' THEN 1 ELSE 0 END) as premium
        FROM clients
      `).first().catch(() => ({ total: 0, active_plans: 0, core: 0, professional: 0, premium: 0 })),

      // Pipeline metrics
      env.DB.prepare(`
        SELECT
          COUNT(*) as active_quotes,
          COALESCE(SUM(total_quote), 0) as pipeline_value
        FROM quotes
        WHERE status IN ('sent', 'viewed')
      `).first().catch(() => ({ active_quotes: 0, pipeline_value: 0 })),

      // Email metrics (last 30 days)
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

      // Support metrics
      env.DB.prepare(`
        SELECT
          SUM(CASE WHEN status IN ('open', 'pending', 'in_progress') THEN 1 ELSE 0 END) as open_tickets,
          SUM(CASE WHEN status = 'resolved' AND updated_at > ? THEN 1 ELSE 0 END) as resolved_30d,
          COUNT(*) as total_tickets
        FROM tickets
        WHERE visibility = 'client'
      `).bind(thirtyDaysAgo).first().catch(() => ({ open_tickets: 0, resolved_30d: 0, total_tickets: 0 })),

      // Lead metrics
      env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN lead_score >= 80 THEN 1 ELSE 0 END) as hot_leads,
          SUM(CASE WHEN status = 'client' AND updated_at > ? THEN 1 ELSE 0 END) as conversions_30d
        FROM restaurant_leads
      `).bind(thirtyDaysAgo).first().catch(() => ({ total: 0, hot_leads: 0, conversions_30d: 0 })),

      // Churn data
      env.DB.prepare(`
        SELECT
          SUM(CASE WHEN support_plan_status = 'cancelled' AND updated_at >= ? THEN 1 ELSE 0 END) as churned,
          COUNT(*) as total
        FROM clients WHERE support_plan_status IN ('active', 'cancelled')
      `).bind(thirtyDaysAgo).first().catch(() => ({ churned: 0, total: 1 })),

      // Engagement (portal sessions)
      env.DB.prepare(`
        SELECT COUNT(*) as active_sessions
        FROM portal_sessions
        WHERE expires_at > ?
      `).bind(now).first().catch(() => ({ active_sessions: 0 }))
    ]);

    // Calculate derived metrics
    const mrr = revenueData?.mrr || 0;
    const activeClients = clientData?.active_plans || 0;
    const pipelineValue = pipelineData?.pipeline_value || 0;
    const openRate = emailData?.total_sent > 0
      ? (emailData.opened / emailData.total_sent) * 100
      : 0;
    const deliveryRate = emailData?.total_sent > 0
      ? (emailData.delivered / emailData.total_sent) * 100
      : 100;
    const churnRate = churnData?.total > 0
      ? (churnData.churned / churnData.total) * 100
      : 0;

    // Calculate health score
    const healthMetrics = {
      mrr,
      activeClients,
      pipelineValue,
      emailOpenRate: openRate,
      churnRate
    };
    const componentScores = calculateComponentScores(healthMetrics, GOALS);
    const overallHealthScore = calculateOverallScore(componentScores);

    // Prepare metric snapshots
    const snapshots = [
      {
        id: generateId('ms_rev'),
        type: 'revenue',
        value: mrr,
        meta: {
          arr: mrr * 12,
          subscriptions: revenueData?.subscription_count || 0
        }
      },
      {
        id: generateId('ms_cli'),
        type: 'clients',
        value: activeClients,
        meta: {
          total: clientData?.total || 0,
          core: clientData?.core || 0,
          professional: clientData?.professional || 0,
          premium: clientData?.premium || 0
        }
      },
      {
        id: generateId('ms_pip'),
        type: 'pipeline',
        value: pipelineValue,
        meta: {
          activeQuotes: pipelineData?.active_quotes || 0
        }
      },
      {
        id: generateId('ms_eml'),
        type: 'email',
        value: openRate,
        meta: {
          sent: emailData?.total_sent || 0,
          delivered: emailData?.delivered || 0,
          opened: emailData?.opened || 0,
          clicked: emailData?.clicked || 0,
          deliveryRate
        }
      },
      {
        id: generateId('ms_sup'),
        type: 'support',
        value: supportData?.open_tickets || 0,
        meta: {
          resolved30d: supportData?.resolved_30d || 0,
          total: supportData?.total_tickets || 0
        }
      },
      {
        id: generateId('ms_eng'),
        type: 'engagement',
        value: engagementData?.active_sessions || 0,
        meta: {
          hotLeads: leadData?.hot_leads || 0,
          conversions30d: leadData?.conversions_30d || 0,
          totalLeads: leadData?.total || 0
        }
      }
    ];

    // Insert metric snapshots
    const insertStmt = env.DB.prepare(`
      INSERT OR REPLACE INTO metrics_snapshots (id, snapshot_date, metric_type, metric_value, metric_meta)
      VALUES (?, ?, ?, ?, ?)
    `);

    const snapshotResults = [];
    for (const snapshot of snapshots) {
      try {
        await insertStmt.bind(
          snapshot.id,
          today,
          snapshot.type,
          snapshot.value,
          JSON.stringify(snapshot.meta)
        ).run();
        snapshotResults.push({ type: snapshot.type, success: true });
      } catch (err) {
        console.error(`[Daily Snapshot] Error saving ${snapshot.type}:`, err);
        snapshotResults.push({ type: snapshot.type, success: false, error: err.message });
      }
    }

    // Insert health score snapshot
    try {
      await env.DB.prepare(`
        INSERT OR REPLACE INTO health_score_history (
          id, score_date, overall_score, revenue_score, clients_score,
          pipeline_score, email_score, retention_score, component_weights, component_details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        generateId('hs'),
        today,
        overallHealthScore,
        componentScores.revenue,
        componentScores.clients,
        componentScores.pipeline,
        componentScores.email,
        componentScores.retention,
        JSON.stringify(WEIGHTS),
        JSON.stringify({ metrics: healthMetrics, goals: GOALS })
      ).run();
    } catch (err) {
      console.error('[Daily Snapshot] Error saving health score:', err);
    }

    console.log(`[Daily Snapshot] Completed for ${today}. Health score: ${overallHealthScore}`);

    return new Response(JSON.stringify({
      success: true,
      date: today,
      timestamp: now,
      summary: {
        mrr,
        arr: mrr * 12,
        activeClients,
        pipelineValue,
        emailOpenRate: openRate,
        openTickets: supportData?.open_tickets || 0,
        healthScore: overallHealthScore
      },
      snapshots: snapshotResults
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('[Daily Snapshot] Error:', error);
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
