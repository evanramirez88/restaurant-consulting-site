/**
 * Client Account Health API
 *
 * GET /api/client-accounts/:id/health - Get detailed health metrics
 * POST /api/client-accounts/:id/health - Recalculate health score
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

/**
 * Health Score Components (0-100 each):
 * - Engagement: Email opens + Portal logins + Response rate
 * - Payment: On-time payments + No disputes
 * - Satisfaction: NPS score + Ticket CSAT
 * - Activity: Days since last touch + Support frequency
 * - Relationship: Account tenure + Referrals
 */
const WEIGHTS = {
  engagement: 0.25,
  payment: 0.25,
  satisfaction: 0.20,
  activity: 0.15,
  relationship: 0.15
};

function getChurnRisk(score) {
  if (score >= 70) return 'low';
  if (score >= 50) return 'medium';
  if (score >= 30) return 'high';
  return 'critical';
}

function getTrend(current, previous) {
  if (!previous) return 'stable';
  if (current > previous + 5) return 'improving';
  if (current < previous - 5) return 'declining';
  return 'stable';
}

export async function onRequestGet(context) {
  const { params, env } = context;
  const { id } = params;

  try {
    const db = env.DB;

    // Get account and organization
    const account = await db.prepare(`
      SELECT ca.*, o.legal_name, o.dba_name
      FROM client_accounts ca
      JOIN organizations o ON ca.organization_id = o.id
      WHERE ca.id = ?
    `).bind(id).first();

    if (!account) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client account not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Get health score history
    const historyResult = await db.prepare(`
      SELECT overall_score, engagement_score, payment_score, satisfaction_score,
             activity_score, relationship_score, trend, calculated_at
      FROM client_health_scores
      WHERE client_id = ?
      ORDER BY calculated_at DESC
      LIMIT 12
    `).bind(account.organization_id).all();

    // Get recent activity stats
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
    const activityStats = await db.prepare(`
      SELECT
        COUNT(*) as total_activities,
        SUM(CASE WHEN activity_type = 'email_opened' THEN 1 ELSE 0 END) as emails_opened,
        SUM(CASE WHEN activity_type = 'portal_login' THEN 1 ELSE 0 END) as portal_logins,
        SUM(CASE WHEN activity_type IN ('ticket_created', 'ticket_resolved') THEN 1 ELSE 0 END) as ticket_activities,
        MAX(created_at) as last_activity
      FROM unified_activity_log
      WHERE (organization_id = ? OR client_account_id = ?)
        AND created_at > ?
    `).bind(account.organization_id, id, thirtyDaysAgo).first();

    // Get ticket metrics
    const ticketStats = await db.prepare(`
      SELECT
        COUNT(*) as total_tickets,
        SUM(CASE WHEN status IN ('open', 'in_progress') THEN 1 ELSE 0 END) as open_tickets,
        AVG(CASE WHEN resolved_at IS NOT NULL THEN resolved_at - created_at ELSE NULL END) as avg_resolution_time
      FROM tickets
      WHERE client_id = ?
    `).bind(account.organization_id).first();

    // Calculate account tenure (in months)
    const clientSince = account.client_since || account.created_at;
    const tenureMonths = Math.floor((Date.now() / 1000 - clientSince) / (30 * 24 * 60 * 60));

    // Parse stored health factors
    let factors = {};
    try {
      factors = account.health_factors ? JSON.parse(account.health_factors) : {};
    } catch (e) {
      factors = {};
    }

    const response = {
      account_id: account.id,
      organization: {
        id: account.organization_id,
        name: account.dba_name || account.legal_name
      },
      current_health: {
        score: account.health_score,
        trend: account.health_trend,
        churn_risk: account.churn_risk,
        computed_at: account.health_computed_at
      },
      components: {
        engagement: factors.engagement || null,
        payment: factors.payment || null,
        satisfaction: factors.satisfaction || null,
        activity: factors.activity || null,
        relationship: factors.relationship || null
      },
      weights: WEIGHTS,
      metrics: {
        tenure_months: tenureMonths,
        support_hours_used: account.support_hours_used,
        support_hours_included: account.support_hours_included,
        mrr: account.mrr,
        total_revenue: account.total_revenue,
        nps_score: account.nps_score,
        portal_logins_30d: activityStats?.portal_logins || 0,
        emails_opened_30d: activityStats?.emails_opened || 0,
        tickets_total: ticketStats?.total_tickets || 0,
        tickets_open: ticketStats?.open_tickets || 0,
        last_activity: activityStats?.last_activity || account.last_activity_at
      },
      history: historyResult.results.map(h => ({
        score: h.overall_score,
        trend: h.trend,
        components: {
          engagement: h.engagement_score,
          payment: h.payment_score,
          satisfaction: h.satisfaction_score,
          activity: h.activity_score,
          relationship: h.relationship_score
        },
        calculated_at: h.calculated_at
      })),
      recommendations: getRecommendations(account, activityStats, ticketStats)
    };

    return new Response(JSON.stringify({
      success: true,
      data: response
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Get health error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch health data'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * POST - Recalculate health score
 */
export async function onRequestPost(context) {
  const { params, env } = context;
  const { id } = params;

  try {
    const db = env.DB;

    // Get account
    const account = await db.prepare(`
      SELECT ca.*, o.legal_name
      FROM client_accounts ca
      JOIN organizations o ON ca.organization_id = o.id
      WHERE ca.id = ?
    `).bind(id).first();

    if (!account) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client account not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

    // Calculate Engagement Score (portal + email activity)
    const engagementStats = await db.prepare(`
      SELECT
        SUM(CASE WHEN activity_type = 'portal_login' THEN 1 ELSE 0 END) as logins,
        SUM(CASE WHEN activity_type = 'email_opened' THEN 1 ELSE 0 END) as opens,
        SUM(CASE WHEN activity_type = 'email_clicked' THEN 1 ELSE 0 END) as clicks
      FROM unified_activity_log
      WHERE organization_id = ? AND created_at > ?
    `).bind(account.organization_id, thirtyDaysAgo).first();

    let engagementScore = 50;
    if (engagementStats) {
      const logins = engagementStats.logins || 0;
      const opens = engagementStats.opens || 0;
      const clicks = engagementStats.clicks || 0;
      engagementScore = Math.min(100, 30 + logins * 10 + opens * 5 + clicks * 10);
    }

    // Calculate Payment Score (always 80+ unless we track issues)
    let paymentScore = 80;
    if (account.stripe_subscription_status === 'active') {
      paymentScore = 90;
    } else if (account.stripe_subscription_status === 'past_due') {
      paymentScore = 40;
    }

    // Calculate Satisfaction Score (tickets + NPS)
    const ticketSatisfaction = await db.prepare(`
      SELECT AVG(ts.rating) as avg_rating, COUNT(*) as rated_count
      FROM ticket_satisfaction ts
      JOIN tickets t ON ts.ticket_id = t.id
      WHERE t.client_id = ?
    `).bind(account.organization_id).first();

    let satisfactionScore = 60;
    if (ticketSatisfaction?.rated_count > 0) {
      satisfactionScore = Math.round((ticketSatisfaction.avg_rating / 5) * 100);
    }
    if (account.nps_score !== null) {
      // NPS ranges from -100 to 100, normalize to 0-100
      const npsNormalized = (account.nps_score + 100) / 2;
      satisfactionScore = Math.round((satisfactionScore + npsNormalized) / 2);
    }

    // Calculate Activity Score (recency of interaction)
    let activityScore = 50;
    const lastActivity = account.last_activity_at || account.created_at;
    const daysSinceActivity = (now - lastActivity) / (24 * 60 * 60);
    if (daysSinceActivity < 7) {
      activityScore = 90;
    } else if (daysSinceActivity < 14) {
      activityScore = 75;
    } else if (daysSinceActivity < 30) {
      activityScore = 60;
    } else if (daysSinceActivity < 60) {
      activityScore = 40;
    } else {
      activityScore = 20;
    }

    // Calculate Relationship Score (tenure + value)
    const clientSince = account.client_since || account.created_at;
    const tenureMonths = (now - clientSince) / (30 * 24 * 60 * 60);
    let relationshipScore = 50;
    if (tenureMonths >= 24) {
      relationshipScore = 90;
    } else if (tenureMonths >= 12) {
      relationshipScore = 75;
    } else if (tenureMonths >= 6) {
      relationshipScore = 60;
    } else if (tenureMonths >= 3) {
      relationshipScore = 50;
    } else {
      relationshipScore = 40;
    }
    // Bonus for high MRR
    if (account.mrr >= 50000) {
      relationshipScore = Math.min(100, relationshipScore + 10);
    }

    // Calculate overall score
    const overallScore = Math.round(
      engagementScore * WEIGHTS.engagement +
      paymentScore * WEIGHTS.payment +
      satisfactionScore * WEIGHTS.satisfaction +
      activityScore * WEIGHTS.activity +
      relationshipScore * WEIGHTS.relationship
    );

    // Determine trend
    const previousScore = account.health_score || 50;
    const trend = getTrend(overallScore, previousScore);
    const churnRisk = getChurnRisk(overallScore);

    const factors = {
      engagement: engagementScore,
      payment: paymentScore,
      satisfaction: satisfactionScore,
      activity: activityScore,
      relationship: relationshipScore
    };

    // Update client_accounts
    await db.prepare(`
      UPDATE client_accounts
      SET health_score = ?, health_trend = ?, health_computed_at = ?,
          health_factors = ?, churn_risk = ?, updated_at = ?
      WHERE id = ?
    `).bind(overallScore, trend, now, JSON.stringify(factors), churnRisk, now, id).run();

    // Store in health score history
    await db.prepare(`
      INSERT INTO client_health_scores (
        id, client_id, overall_score, engagement_score, payment_score,
        satisfaction_score, activity_score, relationship_score,
        factors_json, score_change, trend, calculated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      'hs_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      account.organization_id,
      overallScore,
      engagementScore,
      paymentScore,
      satisfactionScore,
      activityScore,
      relationshipScore,
      JSON.stringify(factors),
      overallScore - previousScore,
      trend,
      now
    ).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        previous_score: previousScore,
        new_score: overallScore,
        change: overallScore - previousScore,
        trend,
        churn_risk: churnRisk,
        components: factors
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Recalculate health error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to recalculate health score'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * Generate recommendations based on health metrics
 */
function getRecommendations(account, activityStats, ticketStats) {
  const recommendations = [];

  if (account.health_score < 50) {
    recommendations.push({
      priority: 'high',
      type: 'outreach',
      message: 'Schedule a check-in call - health score is critically low'
    });
  }

  if (activityStats && (activityStats.portal_logins || 0) === 0) {
    recommendations.push({
      priority: 'medium',
      type: 'engagement',
      message: 'No portal logins in 30 days - send re-engagement email'
    });
  }

  if (ticketStats && (ticketStats.open_tickets || 0) > 3) {
    recommendations.push({
      priority: 'high',
      type: 'support',
      message: `${ticketStats.open_tickets} open tickets - prioritize resolution`
    });
  }

  if (account.support_hours_used > account.support_hours_included * 0.8) {
    recommendations.push({
      priority: 'medium',
      type: 'upsell',
      message: 'Support hours nearly exhausted - propose plan upgrade'
    });
  }

  if (!account.nps_score) {
    recommendations.push({
      priority: 'low',
      type: 'feedback',
      message: 'No NPS score recorded - send satisfaction survey'
    });
  }

  return recommendations;
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
