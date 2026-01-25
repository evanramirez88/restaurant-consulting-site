/**
 * Business Brief Health Score API
 *
 * GET /api/admin/business-brief/health-score
 *   - Returns weighted health score with detailed breakdown
 *
 * POST /api/admin/business-brief/health-score
 *   - Captures current health score snapshot
 *
 * Health Score Weights:
 *   - Revenue vs Goal: 35%
 *   - Active Clients vs Goal: 25%
 *   - Pipeline Value: 20%
 *   - Email Response Rate: 10%
 *   - Client Retention: 10%
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
 * Health score component weights
 */
const WEIGHTS = {
  revenue: 0.35,
  clients: 0.25,
  pipeline: 0.20,
  email: 0.10,
  retention: 0.10
};

/**
 * Goal targets
 */
const GOALS = {
  revenue: 400000, // Annual revenue goal
  clients: 45, // Target client count with plans
  monthlyPipeline: 50000 // Target monthly pipeline value
};

/**
 * Generate unique ID
 */
function generateId() {
  return `hs_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Calculate individual component scores (0-100)
 */
function calculateComponentScores(metrics, goals) {
  const scores = {};

  // Revenue Score: Current ARR / Goal ARR (capped at 100)
  const arr = (metrics.mrr || 0) * 12;
  scores.revenue = Math.min(100, (arr / goals.revenue) * 100);

  // Clients Score: Active clients / Goal clients (capped at 100)
  scores.clients = Math.min(100, (metrics.activeClients / goals.clients) * 100);

  // Pipeline Score: Based on pipeline value relative to monthly target
  // More generous scoring - having any pipeline is good
  const pipelineRatio = metrics.pipelineValue / goals.monthlyPipeline;
  if (pipelineRatio >= 2) scores.pipeline = 100;
  else if (pipelineRatio >= 1) scores.pipeline = 80 + (pipelineRatio - 1) * 20;
  else if (pipelineRatio >= 0.5) scores.pipeline = 50 + pipelineRatio * 30;
  else scores.pipeline = pipelineRatio * 50;

  // Email Score: Open rate benchmark (industry avg ~20%)
  // 30%+ = 100, 20% = 80, 10% = 50, 0% = 0
  const openRate = metrics.emailOpenRate || 0;
  if (openRate >= 30) scores.email = 100;
  else if (openRate >= 20) scores.email = 80 + (openRate - 20) * 2;
  else if (openRate >= 10) scores.email = 50 + (openRate - 10) * 3;
  else scores.email = openRate * 5;

  // Retention Score: Based on churn (lower is better)
  // 0% churn = 100, 5% = 80, 10% = 50, 20%+ = 0
  const churnRate = metrics.churnRate || 0;
  if (churnRate === 0) scores.retention = 100;
  else if (churnRate <= 2) scores.retention = 100 - (churnRate * 5);
  else if (churnRate <= 5) scores.retention = 90 - ((churnRate - 2) * 10 / 3);
  else if (churnRate <= 10) scores.retention = 80 - ((churnRate - 5) * 6);
  else if (churnRate <= 20) scores.retention = 50 - ((churnRate - 10) * 5);
  else scores.retention = 0;

  return scores;
}

/**
 * Calculate weighted overall score
 */
function calculateOverallScore(componentScores) {
  let total = 0;
  for (const [component, score] of Object.entries(componentScores)) {
    total += (score || 0) * (WEIGHTS[component] || 0);
  }
  return Math.round(total * 10) / 10; // Round to 1 decimal
}

/**
 * Determine health status from score
 */
function getHealthStatus(score) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  if (score >= 20) return 'poor';
  return 'critical';
}

/**
 * Generate recommendations based on low-scoring components
 */
function generateRecommendations(componentScores) {
  const recommendations = [];

  if (componentScores.revenue < 50) {
    recommendations.push({
      component: 'revenue',
      priority: 'high',
      message: 'Revenue is significantly below target. Focus on closing pending quotes and upselling existing clients.'
    });
  }

  if (componentScores.clients < 50) {
    recommendations.push({
      component: 'clients',
      priority: 'high',
      message: 'Client count is below target. Prioritize lead conversion and pipeline progression.'
    });
  }

  if (componentScores.pipeline < 40) {
    recommendations.push({
      component: 'pipeline',
      priority: 'medium',
      message: 'Pipeline value is low. Generate more quotes and follow up on cold leads.'
    });
  }

  if (componentScores.email < 50) {
    recommendations.push({
      component: 'email',
      priority: 'medium',
      message: 'Email engagement is below average. Review subject lines and sending times.'
    });
  }

  if (componentScores.retention < 60) {
    recommendations.push({
      component: 'retention',
      priority: 'high',
      message: 'Client retention needs attention. Schedule check-ins with at-risk clients.'
    });
  }

  return recommendations;
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

    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

    // Fetch all required metrics in parallel
    const [
      revenueData,
      clientData,
      pipelineData,
      emailData,
      churnData,
      recentHistory
    ] = await Promise.all([
      // Current MRR
      env.DB.prepare(`
        SELECT COALESCE(SUM(CASE WHEN billing_interval = 'month' THEN amount ELSE amount / 12 END), 0) as mrr
        FROM stripe_subscriptions WHERE status = 'active'
      `).first().catch(() => ({ mrr: 0 })),

      // Active clients with plans
      env.DB.prepare(`
        SELECT COUNT(*) as count FROM clients WHERE support_plan_status = 'active'
      `).first().catch(() => ({ count: 0 })),

      // Pipeline value
      env.DB.prepare(`
        SELECT COALESCE(SUM(total_quote), 0) as value
        FROM quotes WHERE status IN ('sent', 'viewed')
      `).first().catch(() => ({ value: 0 })),

      // Email metrics (last 30 days)
      env.DB.prepare(`
        SELECT
          COUNT(*) as sent,
          SUM(CASE WHEN first_opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened
        FROM email_logs WHERE created_at >= ?
      `).bind(thirtyDaysAgo).first().catch(() => ({ sent: 0, opened: 0 })),

      // Churn rate (clients lost / total clients in last 30 days)
      env.DB.prepare(`
        SELECT
          SUM(CASE WHEN support_plan_status = 'cancelled' AND updated_at >= ? THEN 1 ELSE 0 END) as churned,
          COUNT(*) as total
        FROM clients WHERE support_plan_status IN ('active', 'cancelled')
      `).bind(thirtyDaysAgo).first().catch(() => ({ churned: 0, total: 1 })),

      // Recent health score history
      env.DB.prepare(`
        SELECT score_date, overall_score, revenue_score, clients_score, pipeline_score, email_score, retention_score
        FROM health_score_history
        ORDER BY score_date DESC
        LIMIT 30
      `).all().catch(() => ({ results: [] }))
    ]);

    // Calculate metrics
    const metrics = {
      mrr: revenueData?.mrr || 0,
      activeClients: clientData?.count || 0,
      pipelineValue: pipelineData?.value || 0,
      emailOpenRate: emailData?.sent > 0 ? (emailData.opened / emailData.sent) * 100 : 0,
      churnRate: churnData?.total > 0 ? (churnData.churned / churnData.total) * 100 : 0
    };

    // Calculate component scores
    const componentScores = calculateComponentScores(metrics, GOALS);

    // Calculate overall score
    const overallScore = calculateOverallScore(componentScores);

    // Get status and recommendations
    const status = getHealthStatus(overallScore);
    const recommendations = generateRecommendations(componentScores);

    // Find trend from history
    let trend = 'stable';
    const history = recentHistory.results || [];
    if (history.length > 0) {
      const previousScore = history[0].overall_score;
      const change = overallScore - previousScore;
      if (change > 2) trend = 'improving';
      else if (change < -2) trend = 'declining';
    }

    return new Response(JSON.stringify({
      success: true,
      generatedAt: now,
      healthScore: {
        overall: overallScore,
        status,
        trend,
        components: {
          revenue: {
            score: Math.round(componentScores.revenue * 10) / 10,
            weight: WEIGHTS.revenue,
            contribution: Math.round(componentScores.revenue * WEIGHTS.revenue * 10) / 10,
            metric: metrics.mrr,
            metricLabel: 'MRR',
            target: Math.round(GOALS.revenue / 12),
            targetLabel: 'Monthly Goal'
          },
          clients: {
            score: Math.round(componentScores.clients * 10) / 10,
            weight: WEIGHTS.clients,
            contribution: Math.round(componentScores.clients * WEIGHTS.clients * 10) / 10,
            metric: metrics.activeClients,
            metricLabel: 'Active Clients',
            target: GOALS.clients,
            targetLabel: 'Goal'
          },
          pipeline: {
            score: Math.round(componentScores.pipeline * 10) / 10,
            weight: WEIGHTS.pipeline,
            contribution: Math.round(componentScores.pipeline * WEIGHTS.pipeline * 10) / 10,
            metric: metrics.pipelineValue,
            metricLabel: 'Pipeline Value',
            target: GOALS.monthlyPipeline,
            targetLabel: 'Monthly Target'
          },
          email: {
            score: Math.round(componentScores.email * 10) / 10,
            weight: WEIGHTS.email,
            contribution: Math.round(componentScores.email * WEIGHTS.email * 10) / 10,
            metric: Math.round(metrics.emailOpenRate * 10) / 10,
            metricLabel: 'Open Rate %',
            target: 25,
            targetLabel: 'Industry Benchmark'
          },
          retention: {
            score: Math.round(componentScores.retention * 10) / 10,
            weight: WEIGHTS.retention,
            contribution: Math.round(componentScores.retention * WEIGHTS.retention * 10) / 10,
            metric: Math.round(metrics.churnRate * 10) / 10,
            metricLabel: 'Churn Rate %',
            target: 2,
            targetLabel: 'Target (lower is better)'
          }
        }
      },
      recommendations,
      history: history.slice(0, 14).map(h => ({
        date: h.score_date,
        overall: h.overall_score,
        revenue: h.revenue_score,
        clients: h.clients_score,
        pipeline: h.pipeline_score,
        email: h.email_score,
        retention: h.retention_score
      }))
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Health Score API error:', error);
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

    const today = getTodayDate();
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

    // Fetch metrics (same as GET)
    const [revenueData, clientData, pipelineData, emailData, churnData] = await Promise.all([
      env.DB.prepare(`
        SELECT COALESCE(SUM(CASE WHEN billing_interval = 'month' THEN amount ELSE amount / 12 END), 0) as mrr
        FROM stripe_subscriptions WHERE status = 'active'
      `).first().catch(() => ({ mrr: 0 })),

      env.DB.prepare(`
        SELECT COUNT(*) as count FROM clients WHERE support_plan_status = 'active'
      `).first().catch(() => ({ count: 0 })),

      env.DB.prepare(`
        SELECT COALESCE(SUM(total_quote), 0) as value
        FROM quotes WHERE status IN ('sent', 'viewed')
      `).first().catch(() => ({ value: 0 })),

      env.DB.prepare(`
        SELECT
          COUNT(*) as sent,
          SUM(CASE WHEN first_opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened
        FROM email_logs WHERE created_at >= ?
      `).bind(thirtyDaysAgo).first().catch(() => ({ sent: 0, opened: 0 })),

      env.DB.prepare(`
        SELECT
          SUM(CASE WHEN support_plan_status = 'cancelled' AND updated_at >= ? THEN 1 ELSE 0 END) as churned,
          COUNT(*) as total
        FROM clients WHERE support_plan_status IN ('active', 'cancelled')
      `).bind(thirtyDaysAgo).first().catch(() => ({ churned: 0, total: 1 }))
    ]);

    const metrics = {
      mrr: revenueData?.mrr || 0,
      activeClients: clientData?.count || 0,
      pipelineValue: pipelineData?.value || 0,
      emailOpenRate: emailData?.sent > 0 ? (emailData.opened / emailData.sent) * 100 : 0,
      churnRate: churnData?.total > 0 ? (churnData.churned / churnData.total) * 100 : 0
    };

    const componentScores = calculateComponentScores(metrics, GOALS);
    const overallScore = calculateOverallScore(componentScores);

    // Insert or replace today's health score
    await env.DB.prepare(`
      INSERT OR REPLACE INTO health_score_history (
        id, score_date, overall_score, revenue_score, clients_score,
        pipeline_score, email_score, retention_score, component_weights, component_details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      generateId(),
      today,
      overallScore,
      componentScores.revenue,
      componentScores.clients,
      componentScores.pipeline,
      componentScores.email,
      componentScores.retention,
      JSON.stringify(WEIGHTS),
      JSON.stringify({ metrics, goals: GOALS })
    ).run();

    return new Response(JSON.stringify({
      success: true,
      date: today,
      overallScore,
      componentScores
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Health Score snapshot error:', error);
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
