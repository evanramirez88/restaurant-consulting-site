/**
 * Client Health Score API
 * GET /api/admin/clients/:clientId/health - Get current health score with breakdown
 * POST /api/admin/clients/:clientId/health - Calculate and save a new health score snapshot
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

// Health score weights
const WEIGHTS = {
  payment: 0.30,      // 30% - Payment history (on-time ratio)
  engagement: 0.25,   // 25% - Last contact recency
  revenue: 0.25,      // 25% - MRR vs plan average
  tenure: 0.20        // 20% - Account age bonus
};

// Plan MRR benchmarks
const PLAN_MRR = {
  core: 350,
  professional: 500,
  premium: 800
};

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const { clientId } = params;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    // Get current health score from client record
    const client = await env.DB.prepare(`
      SELECT id, name, company, health_score, health_trend, churn_risk,
             active_mrr, support_plan_tier, client_since, last_activity_at
      FROM clients WHERE id = ?
    `).bind(clientId).first();

    if (!client) {
      return new Response(JSON.stringify({ success: false, error: 'Client not found' }), {
        status: 404, headers: corsHeaders
      });
    }

    // Get latest health snapshot with breakdown
    const latestSnapshot = await env.DB.prepare(`
      SELECT * FROM client_health_scores
      WHERE client_id = ?
      ORDER BY calculated_at DESC
      LIMIT 1
    `).bind(clientId).first();

    // Get history (last 30 days)
    const history = await env.DB.prepare(`
      SELECT overall_score, engagement_score, payment_score, satisfaction_score,
             activity_score, relationship_score, trend, calculated_at
      FROM client_health_scores
      WHERE client_id = ?
      ORDER BY calculated_at DESC
      LIMIT 30
    `).bind(clientId).all();

    // Parse factors if present
    let factors = null;
    if (latestSnapshot?.factors_json) {
      try {
        factors = JSON.parse(latestSnapshot.factors_json);
      } catch (e) {}
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        current: {
          overall_score: client.health_score || 50,
          trend: client.health_trend || 'stable',
          churn_risk: client.churn_risk || 'low'
        },
        breakdown: latestSnapshot ? {
          engagement_score: latestSnapshot.engagement_score,
          payment_score: latestSnapshot.payment_score,
          satisfaction_score: latestSnapshot.satisfaction_score,
          activity_score: latestSnapshot.activity_score,
          relationship_score: latestSnapshot.relationship_score
        } : null,
        factors,
        history: history.results || [],
        client: {
          mrr: client.active_mrr,
          plan: client.support_plan_tier,
          tenure_days: client.client_since ? Math.floor((Date.now() / 1000 - client.client_since) / 86400) : 0,
          last_activity: client.last_activity_at
        }
      }
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Health score get error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: corsHeaders
    });
  }
}

export async function onRequestPost(context) {
  const { env, request, params } = context;
  const { clientId } = params;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const now = Math.floor(Date.now() / 1000);

    // Get client data
    const client = await env.DB.prepare(`
      SELECT c.*, cp.engagement_score as profile_engagement
      FROM clients c
      LEFT JOIN client_profiles cp ON c.id = cp.client_id
      WHERE c.id = ?
    `).bind(clientId).first();

    if (!client) {
      return new Response(JSON.stringify({ success: false, error: 'Client not found' }), {
        status: 404, headers: corsHeaders
      });
    }

    // =========================================
    // Calculate Payment Score (30%)
    // =========================================
    const invoiceStats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue
      FROM invoices WHERE client_id = ?
    `).bind(clientId).first();

    let paymentScore = 70; // Default if no invoices
    if (invoiceStats && invoiceStats.total > 0) {
      const paidRatio = invoiceStats.paid / invoiceStats.total;
      const overdueRatio = invoiceStats.overdue / invoiceStats.total;
      paymentScore = Math.round(paidRatio * 100 - overdueRatio * 30);
      paymentScore = Math.max(0, Math.min(100, paymentScore));
    }

    // =========================================
    // Calculate Engagement Score (25%)
    // =========================================
    const lastActivityTs = client.last_activity_at || client.created_at || now;
    const daysSinceActivity = Math.floor((now - lastActivityTs) / 86400);

    let engagementScore = 100;
    if (daysSinceActivity > 90) engagementScore = 20;
    else if (daysSinceActivity > 60) engagementScore = 40;
    else if (daysSinceActivity > 30) engagementScore = 60;
    else if (daysSinceActivity > 14) engagementScore = 75;
    else if (daysSinceActivity > 7) engagementScore = 85;

    // Bonus for recent activity types
    const recentActivityCount = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM client_activity_log
      WHERE client_id = ? AND created_at > ?
    `).bind(clientId, now - 604800).first(); // Last 7 days

    if (recentActivityCount?.count > 5) engagementScore = Math.min(100, engagementScore + 10);

    // =========================================
    // Calculate Revenue Score (25%)
    // =========================================
    const mrr = client.active_mrr || 0;
    const planTier = client.support_plan_tier;
    const expectedMrr = PLAN_MRR[planTier] || 0;

    let revenueScore = 50;
    if (expectedMrr > 0) {
      revenueScore = Math.min(100, Math.round((mrr / expectedMrr) * 100));
    } else if (mrr > 0) {
      // No plan but has revenue
      revenueScore = Math.min(100, 50 + Math.round(mrr / 10));
    }

    // =========================================
    // Calculate Tenure Score (20%)
    // =========================================
    const clientSince = client.client_since || client.created_at || now;
    const tenureDays = Math.floor((now - clientSince) / 86400);

    let tenureScore = 30;
    if (tenureDays > 730) tenureScore = 100;      // 2+ years
    else if (tenureDays > 365) tenureScore = 85;  // 1+ year
    else if (tenureDays > 180) tenureScore = 70;  // 6+ months
    else if (tenureDays > 90) tenureScore = 55;   // 3+ months
    else if (tenureDays > 30) tenureScore = 40;   // 1+ month

    // =========================================
    // Calculate Overall Score
    // =========================================
    const overallScore = Math.round(
      paymentScore * WEIGHTS.payment +
      engagementScore * WEIGHTS.engagement +
      revenueScore * WEIGHTS.revenue +
      tenureScore * WEIGHTS.tenure
    );

    // =========================================
    // Determine Trend
    // =========================================
    const prevScore = await env.DB.prepare(`
      SELECT overall_score FROM client_health_scores
      WHERE client_id = ?
      ORDER BY calculated_at DESC
      LIMIT 1
    `).bind(clientId).first();

    let trend = 'stable';
    let scoreChange = 0;
    if (prevScore) {
      scoreChange = overallScore - prevScore.overall_score;
      if (scoreChange >= 5) trend = 'improving';
      else if (scoreChange <= -5) trend = 'declining';
    }

    // =========================================
    // Determine Churn Risk
    // =========================================
    let churnRisk = 'low';
    if (overallScore < 30) churnRisk = 'critical';
    else if (overallScore < 45) churnRisk = 'high';
    else if (overallScore < 60) churnRisk = 'medium';

    // =========================================
    // Store Snapshot
    // =========================================
    const snapshotId = `health_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const factors = {
      payment: {
        score: paymentScore,
        invoices_total: invoiceStats?.total || 0,
        invoices_paid: invoiceStats?.paid || 0,
        invoices_overdue: invoiceStats?.overdue || 0
      },
      engagement: {
        score: engagementScore,
        days_since_activity: daysSinceActivity,
        recent_activity_count: recentActivityCount?.count || 0
      },
      revenue: {
        score: revenueScore,
        mrr: mrr,
        expected_mrr: expectedMrr,
        plan: planTier
      },
      tenure: {
        score: tenureScore,
        days: tenureDays
      }
    };

    await env.DB.prepare(`
      INSERT INTO client_health_scores (
        id, client_id, overall_score, engagement_score, payment_score,
        satisfaction_score, activity_score, relationship_score,
        factors_json, score_change, trend, calculated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      snapshotId, clientId, overallScore,
      engagementScore, paymentScore,
      revenueScore, // using satisfaction_score for revenue
      engagementScore, // using activity_score for engagement backup
      tenureScore, // using relationship_score for tenure
      JSON.stringify(factors),
      scoreChange, trend, now
    ).run();

    // Update client record
    await env.DB.prepare(`
      UPDATE clients SET health_score = ?, health_trend = ?, churn_risk = ?
      WHERE id = ?
    `).bind(overallScore, trend, churnRisk, clientId).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        overall_score: overallScore,
        trend,
        churn_risk: churnRisk,
        score_change: scoreChange,
        breakdown: {
          payment_score: paymentScore,
          engagement_score: engagementScore,
          revenue_score: revenueScore,
          tenure_score: tenureScore
        },
        factors,
        snapshot_id: snapshotId
      }
    }), { status: 201, headers: corsHeaders });

  } catch (error) {
    console.error('Health score calculation error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
