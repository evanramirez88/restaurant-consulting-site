/**
 * Business Brief Dashboard API
 *
 * GET /api/admin/business-brief/dashboard
 *
 * Returns the executive dashboard data including:
 * - AI-generated daily summary
 * - Priority action items
 * - Today's KPI snapshot
 * - Quick wins / opportunities
 * - Business health score
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
 * Calculate business health score (0-100)
 */
function calculateHealthScore(metrics) {
  let score = 50; // Base score

  // Revenue health (+/- 20 points)
  if (metrics.revenue?.percentToGoal) {
    const revenueScore = Math.min(metrics.revenue.percentToGoal, 100) * 0.2;
    score += revenueScore;
  }

  // Pipeline health (+/- 15 points)
  if (metrics.pipeline?.activeQuotes > 0) {
    score += Math.min(metrics.pipeline.activeQuotes * 2, 15);
  }

  // Support health (+/- 15 points)
  if (metrics.support) {
    // Lower ticket count is better
    const ticketPenalty = Math.min(metrics.support.openTickets * 2, 10);
    score -= ticketPenalty;
    // Add points for good response time
    if (metrics.support.avgResponseTime && metrics.support.avgResponseTime < 24) {
      score += 5;
    }
  }

  // Email health (+/- 10 points)
  if (metrics.email?.deliverabilityScore) {
    score += (metrics.email.deliverabilityScore / 100) * 10;
  }

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Determine trend direction
 */
function calculateTrend(current, previous) {
  if (!previous || previous === 0) return 'stable';
  const change = ((current - previous) / previous) * 100;
  if (change > 5) return 'up';
  if (change < -5) return 'down';
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

    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;
    const oneWeekAgo = now - 604800;
    const thirtyDaysAgo = now - 2592000;
    const startOfDay = now - (now % 86400);

    // ========================================
    // PARALLEL DATA FETCHING
    // ========================================
    const [
      // Action items
      actionItems,

      // Client & revenue metrics
      clientMetrics,
      supportPlanBreakdown,

      // Lead metrics
      leadMetrics,
      newLeadsToday,
      hotLeads,

      // Quote metrics
      quoteMetrics,
      expiringQuotes,

      // Ticket metrics
      ticketMetrics,
      urgentTickets,

      // Email metrics
      emailMetrics,
      failedEmails,

      // Portal activity
      portalActivity,

      // Goals
      primaryGoal,
      goalMilestones,

      // Recent conversions
      recentConversions,

      // Automation health
      automationHealth,

      // Intelligence agent status
      agentStatus
    ] = await Promise.all([
      // Action items (pending, not expired)
      env.DB.prepare(`
        SELECT * FROM business_brief_actions
        WHERE status IN ('pending', 'acknowledged', 'in_progress')
        AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY
          CASE priority
            WHEN 'critical' THEN 0
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            ELSE 3
          END,
          deadline ASC NULLS LAST,
          created_at DESC
        LIMIT 20
      `).bind(now).all().catch(() => ({ results: [] })),

      // Client count and revenue
      env.DB.prepare(`
        SELECT
          COUNT(*) as total_clients,
          SUM(CASE WHEN portal_enabled = 1 THEN 1 ELSE 0 END) as active_portals,
          SUM(CASE WHEN support_plan_status = 'active' THEN 1 ELSE 0 END) as active_plans
        FROM clients
      `).first().catch(() => ({ total_clients: 0, active_portals: 0, active_plans: 0 })),

      // Support plan breakdown
      env.DB.prepare(`
        SELECT
          support_plan_tier,
          COUNT(*) as count
        FROM clients
        WHERE support_plan_status = 'active'
        GROUP BY support_plan_tier
      `).all().catch(() => ({ results: [] })),

      // Lead funnel
      env.DB.prepare(`
        SELECT
          status,
          COUNT(*) as count
        FROM restaurant_leads
        GROUP BY status
      `).all().catch(() => ({ results: [] })),

      // New leads today
      env.DB.prepare(`
        SELECT COUNT(*) as count FROM restaurant_leads
        WHERE created_at > ?
      `).bind(startOfDay).first().catch(() => ({ count: 0 })),

      // Hot leads (score 80+, not contacted recently)
      env.DB.prepare(`
        SELECT id, name, dba_name, primary_email, lead_score, current_pos
        FROM restaurant_leads
        WHERE lead_score >= 80
        AND status IN ('prospect', 'lead')
        AND (last_contacted_at IS NULL OR last_contacted_at < ?)
        ORDER BY lead_score DESC
        LIMIT 5
      `).bind(oneWeekAgo).all().catch(() => ({ results: [] })),

      // Quote metrics
      env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'viewed' THEN 1 ELSE 0 END) as viewed,
          SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
          SUM(CASE WHEN status IN ('sent', 'viewed') THEN total_quote ELSE 0 END) as pipeline_value
        FROM quotes
        WHERE created_at > ?
      `).bind(thirtyDaysAgo).first().catch(() => ({ total: 0, sent: 0, viewed: 0, accepted: 0, pipeline_value: 0 })),

      // Expiring quotes (next 7 days)
      env.DB.prepare(`
        SELECT id, name, restaurant_name, total_quote, valid_until
        FROM quotes
        WHERE status IN ('sent', 'viewed')
        AND valid_until IS NOT NULL
        AND valid_until > ?
        AND valid_until < ?
        ORDER BY valid_until ASC
        LIMIT 5
      `).bind(now, now + 604800).all().catch(() => ({ results: [] })),

      // Ticket metrics
      env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status IN ('open', 'pending') THEN 1 ELSE 0 END) as open,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN priority IN ('urgent', 'high') THEN 1 ELSE 0 END) as high_priority
        FROM tickets
        WHERE visibility = 'client'
      `).first().catch(() => ({ total: 0, open: 0, in_progress: 0, high_priority: 0 })),

      // Urgent tickets needing attention
      env.DB.prepare(`
        SELECT t.id, t.subject, t.priority, t.status, t.created_at, c.company as client_name
        FROM tickets t
        LEFT JOIN clients c ON t.client_id = c.id
        WHERE t.status IN ('open', 'pending', 'in_progress')
        AND t.priority IN ('urgent', 'high')
        ORDER BY
          CASE t.priority WHEN 'urgent' THEN 0 ELSE 1 END,
          t.created_at ASC
        LIMIT 5
      `).all().catch(() => ({ results: [] })),

      // Email metrics (last 24h)
      env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'sent' OR status = 'delivered' THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN first_opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
          SUM(CASE WHEN first_clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked
        FROM email_logs
        WHERE created_at > ?
      `).bind(oneDayAgo).first().catch(() => ({ total: 0, sent: 0, delivered: 0, failed: 0, opened: 0, clicked: 0 })),

      // Failed emails needing attention
      env.DB.prepare(`
        SELECT email_to, subject, failure_message, created_at
        FROM email_logs
        WHERE status = 'failed' AND created_at > ?
        ORDER BY created_at DESC
        LIMIT 5
      `).bind(oneWeekAgo).all().catch(() => ({ results: [] })),

      // Portal activity
      env.DB.prepare(`
        SELECT
          SUM(CASE WHEN portal_type = 'client' THEN 1 ELSE 0 END) as client_sessions,
          SUM(CASE WHEN portal_type = 'rep' THEN 1 ELSE 0 END) as rep_sessions
        FROM portal_sessions
        WHERE expires_at > ?
      `).first().catch(() => ({ client_sessions: 0, rep_sessions: 0 })),

      // Primary goal
      env.DB.prepare(`
        SELECT * FROM business_goals
        WHERE id = 'goal_revenue_400k_2026'
      `).first().catch(() => null),

      // Goal milestones
      env.DB.prepare(`
        SELECT * FROM goal_milestones
        WHERE goal_id = 'goal_revenue_400k_2026'
        ORDER BY target_date ASC
      `).all().catch(() => ({ results: [] })),

      // Recent conversions
      env.DB.prepare(`
        SELECT rl.name, rl.converted_to_client_id, rl.updated_at
        FROM restaurant_leads rl
        WHERE rl.status = 'client' AND rl.updated_at > ?
        ORDER BY rl.updated_at DESC
        LIMIT 5
      `).bind(oneWeekAgo).all().catch(() => ({ results: [] })),

      // Automation health
      env.DB.prepare(`
        SELECT * FROM automation_server_status WHERE id = 1
      `).first().catch(() => null),

      // Intelligence agent last run
      env.DB.prepare(`
        SELECT agent_name, MAX(completed_at) as last_run, status, result_summary
        FROM intelligence_tasks
        WHERE completed_at > ?
        GROUP BY agent_name
      `).bind(oneDayAgo).all().catch(() => ({ results: [] }))
    ]);

    // ========================================
    // CALCULATE METRICS
    // ========================================

    // Build lead funnel
    const leadFunnel = {};
    (leadMetrics?.results || []).forEach(r => {
      leadFunnel[r.status] = r.count;
    });

    // Build support plan breakdown
    const planBreakdown = { core: 0, professional: 0, premium: 0 };
    (supportPlanBreakdown?.results || []).forEach(r => {
      if (r.support_plan_tier && planBreakdown.hasOwnProperty(r.support_plan_tier)) {
        planBreakdown[r.support_plan_tier] = r.count;
      }
    });

    // Calculate MRR from support plans
    const mrr = (planBreakdown.core * 350) + (planBreakdown.professional * 500) + (planBreakdown.premium * 800);

    // Build metrics object
    const metrics = {
      revenue: {
        mrr: mrr,
        arr: mrr * 12,
        mtd: mrr, // Simplified for now
        target: 400000,
        percentToGoal: primaryGoal ? (primaryGoal.current_value / primaryGoal.target_value) * 100 : 0
      },
      pipeline: {
        activeQuotes: (quoteMetrics?.sent || 0) + (quoteMetrics?.viewed || 0),
        quoteValue: quoteMetrics?.pipeline_value || 0,
        avgCloseRate: quoteMetrics?.total > 0 ? ((quoteMetrics?.accepted || 0) / quoteMetrics.total) * 100 : 0,
        projectedValue: (quoteMetrics?.pipeline_value || 0) * 0.3 // Assuming 30% close rate
      },
      support: {
        openTickets: ticketMetrics?.open || 0,
        inProgress: ticketMetrics?.in_progress || 0,
        highPriority: ticketMetrics?.high_priority || 0,
        avgResponseTime: 12 // Placeholder - would calculate from ticket history
      },
      email: {
        sentToday: emailMetrics?.sent || 0,
        deliverabilityScore: emailMetrics?.sent > 0
          ? Math.round(((emailMetrics?.delivered || 0) / emailMetrics.sent) * 100)
          : 100,
        openRate: emailMetrics?.sent > 0
          ? Math.round(((emailMetrics?.opened || 0) / emailMetrics.sent) * 100)
          : 0,
        clickRate: emailMetrics?.opened > 0
          ? Math.round(((emailMetrics?.clicked || 0) / emailMetrics.opened) * 100)
          : 0,
        failedCount: emailMetrics?.failed || 0
      },
      clients: {
        total: clientMetrics?.total_clients || 0,
        activePortals: clientMetrics?.active_portals || 0,
        activePlans: clientMetrics?.active_plans || 0,
        planBreakdown: planBreakdown
      },
      leads: {
        total: Object.values(leadFunnel).reduce((a, b) => a + b, 0),
        funnel: leadFunnel,
        newToday: newLeadsToday?.count || 0,
        hotLeadsCount: hotLeads?.results?.length || 0
      },
      portals: {
        activeClientSessions: portalActivity?.client_sessions || 0,
        activeRepSessions: portalActivity?.rep_sessions || 0
      }
    };

    // Calculate health score
    const healthScore = calculateHealthScore(metrics);
    const trend = 'stable'; // Would compare to yesterday's snapshot

    // ========================================
    // GENERATE QUICK WINS
    // ========================================
    const quickWins = [];

    // Hot leads not contacted
    if (hotLeads?.results?.length > 0) {
      hotLeads.results.forEach(lead => {
        quickWins.push({
          id: `qw_lead_${lead.id}`,
          type: 'lead',
          title: `Contact hot lead: ${lead.dba_name || lead.name}`,
          description: `Score: ${lead.lead_score}, POS: ${lead.current_pos || 'Unknown'}`,
          value: 2500, // Estimated deal value
          action: `/admin?tab=contacts&subtab=leads&lead=${lead.id}`,
          priority: 'high'
        });
      });
    }

    // Expiring quotes
    if (expiringQuotes?.results?.length > 0) {
      expiringQuotes.results.forEach(quote => {
        quickWins.push({
          id: `qw_quote_${quote.id}`,
          type: 'quote',
          title: `Follow up on quote: ${quote.restaurant_name}`,
          description: `$${quote.total_quote?.toLocaleString()} - Expires ${new Date(quote.valid_until * 1000).toLocaleDateString()}`,
          value: quote.total_quote,
          action: `/admin?tab=overview`,
          priority: 'medium'
        });
      });
    }

    // ========================================
    // BUILD DAILY BRIEF
    // ========================================
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Generate AI summary placeholder (will integrate Workers AI later)
    let aiSummary = '';
    const criticalActions = (actionItems?.results || []).filter(a => a.priority === 'critical').length;
    const highActions = (actionItems?.results || []).filter(a => a.priority === 'high').length;

    if (criticalActions > 0) {
      aiSummary = `You have ${criticalActions} critical item${criticalActions > 1 ? 's' : ''} requiring immediate attention. `;
    }

    if (metrics.email.failedCount > 0) {
      aiSummary += `${metrics.email.failedCount} emails failed delivery - check Resend configuration. `;
    }

    if (metrics.leads.newToday > 0) {
      aiSummary += `${metrics.leads.newToday} new lead${metrics.leads.newToday > 1 ? 's' : ''} came in today. `;
    }

    if (quickWins.length > 0) {
      aiSummary += `${quickWins.length} quick win opportunit${quickWins.length > 1 ? 'ies' : 'y'} identified worth ~$${quickWins.reduce((sum, qw) => sum + (qw.value || 0), 0).toLocaleString()}.`;
    }

    if (!aiSummary) {
      aiSummary = 'Business operations are running smoothly. Focus on outreach and pipeline development today.';
    }

    // ========================================
    // BUILD RESPONSE
    // ========================================
    const response = {
      success: true,
      generatedAt: now,

      // Daily Brief Header
      dailyBrief: {
        date: dateStr,
        aiSummary: aiSummary,
        urgentCount: criticalActions + highActions,
        opportunitiesCount: quickWins.length,
        healthScore: healthScore,
        trend: trend
      },

      // Priority Actions
      actionItems: (actionItems?.results || []).map(action => ({
        id: action.id,
        priority: action.priority,
        category: action.category,
        title: action.title,
        description: action.description,
        sourceType: action.source_type,
        sourceId: action.source_id,
        sourceLink: action.source_link,
        estimatedValue: action.estimated_value,
        deadline: action.deadline,
        suggestedAction: action.suggested_action,
        status: action.status,
        createdAt: action.created_at
      })),

      // KPI Snapshot
      metrics: metrics,

      // Quick Wins
      quickWins: quickWins.slice(0, 5),

      // Goal Progress
      goalProgress: primaryGoal ? {
        id: primaryGoal.id,
        title: primaryGoal.title,
        targetValue: primaryGoal.target_value,
        currentValue: primaryGoal.current_value,
        unit: primaryGoal.unit,
        deadline: primaryGoal.deadline,
        status: primaryGoal.status,
        percentComplete: (primaryGoal.current_value / primaryGoal.target_value) * 100,
        milestones: (goalMilestones?.results || []).map(m => ({
          id: m.id,
          title: m.title,
          targetDate: m.target_date,
          targetValue: m.target_value,
          actualValue: m.actual_value,
          achieved: m.achieved_at != null
        }))
      } : null,

      // Alerts (for immediate attention)
      alerts: {
        urgentTickets: (urgentTickets?.results || []).map(t => ({
          id: t.id,
          subject: t.subject,
          priority: t.priority,
          clientName: t.client_name,
          createdAt: t.created_at
        })),
        failedEmails: (failedEmails?.results || []).map(e => ({
          email: e.email_to,
          subject: e.subject,
          error: e.failure_message,
          createdAt: e.created_at
        })),
        recentConversions: (recentConversions?.results || []).map(c => ({
          name: c.name,
          convertedAt: c.updated_at
        }))
      },

      // System Health
      systemHealth: {
        automation: automationHealth ? {
          online: automationHealth.is_online,
          lastHeartbeat: automationHealth.last_heartbeat,
          queueDepth: automationHealth.queue_depth,
          browserHealthy: automationHealth.browser_healthy
        } : null,
        intelligenceAgents: (agentStatus?.results || []).reduce((acc, agent) => {
          acc[agent.agent_name] = {
            lastRun: agent.last_run,
            status: agent.status
          };
          return acc;
        }, {})
      }
    };

    return new Response(JSON.stringify(response), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Business Brief Dashboard error:', error);
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
