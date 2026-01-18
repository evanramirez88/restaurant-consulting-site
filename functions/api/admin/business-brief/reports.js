// Business Brief Reports API - Report Library & Generation
// GET: Returns report library and history
// POST: Generate a new report

import { verifyAuth, unauthorizedResponse, getCorsOrigin, handleOptions } from '../../../_shared/auth.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}

export async function onRequestGet(context) {
  const { env, request } = context;

  // Verify authentication
  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error, request);
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 86400);

    // Fetch report history and generated reports
    const [reportHistory, scheduledReports] = await Promise.all([
      env.DB.prepare(`
        SELECT
          id, report_type, title, parameters, format, status,
          generated_at, file_url, file_size, recipient_count, error_message
        FROM generated_reports
        WHERE generated_at > ?
        ORDER BY generated_at DESC
        LIMIT 50
      `).bind(thirtyDaysAgo).all().catch(() => ({ results: [] })),

      env.DB.prepare(`
        SELECT
          id, report_type, title, description, frequency, format,
          recipients, parameters, next_run_at, last_run_at, is_active
        FROM scheduled_reports
        WHERE is_active = 1
        ORDER BY next_run_at ASC
      `).all().catch(() => ({ results: [] }))
    ]);

    // Pre-built report library
    const reportLibrary = [
      {
        id: 'daily-executive',
        name: 'Daily Executive Brief',
        description: 'AI-generated daily summary with key metrics and priority actions',
        category: 'financial',
        frequency: 'daily',
        format: 'email',
        icon: 'FileText',
        estimatedTime: '30 seconds',
        dataPoints: ['revenue', 'pipeline', 'tickets', 'leads']
      },
      {
        id: 'weekly-pipeline',
        name: 'Weekly Pipeline Report',
        description: 'Lead funnel analysis, quote status, and conversion metrics',
        category: 'sales',
        frequency: 'weekly',
        format: 'dashboard',
        icon: 'TrendingUp',
        estimatedTime: '45 seconds',
        dataPoints: ['leads', 'quotes', 'conversions', 'segments']
      },
      {
        id: 'monthly-revenue',
        name: 'Monthly Revenue Analysis',
        description: 'Complete revenue breakdown by service line, client, and trend analysis',
        category: 'financial',
        frequency: 'monthly',
        format: 'excel',
        icon: 'DollarSign',
        estimatedTime: '60 seconds',
        dataPoints: ['stripe', 'square', 'subscriptions', 'invoices']
      },
      {
        id: 'client-health',
        name: 'Client Health Scorecard',
        description: 'Health scores, risk indicators, churn probability, and recommendations',
        category: 'operations',
        frequency: 'weekly',
        format: 'dashboard',
        icon: 'Heart',
        estimatedTime: '45 seconds',
        dataPoints: ['clients', 'tickets', 'engagement', 'billing']
      },
      {
        id: 'email-performance',
        name: 'Email Campaign Performance',
        description: 'Sequence analytics, open/click rates, and optimization suggestions',
        category: 'marketing',
        frequency: 'weekly',
        format: 'dashboard',
        icon: 'Mail',
        estimatedTime: '30 seconds',
        dataPoints: ['sequences', 'emails', 'engagement', 'conversions']
      },
      {
        id: 'intelligence-digest',
        name: 'Intelligence Agent Digest',
        description: 'Summary of Core 4 agent findings, leads scored, and recommendations',
        category: 'sales',
        frequency: 'daily',
        format: 'dashboard',
        icon: 'Brain',
        estimatedTime: '30 seconds',
        dataPoints: ['agents', 'leads', 'actions', 'insights']
      },
      {
        id: 'support-metrics',
        name: 'Support Performance Report',
        description: 'Ticket volume, response times, SLA compliance, satisfaction scores',
        category: 'operations',
        frequency: 'weekly',
        format: 'dashboard',
        icon: 'Headphones',
        estimatedTime: '30 seconds',
        dataPoints: ['tickets', 'sla', 'satisfaction', 'workload']
      },
      {
        id: 'lead-segment-analysis',
        name: 'Lead Segment Analysis',
        description: 'Deep dive into segment performance, conversion rates, and opportunities',
        category: 'sales',
        frequency: 'monthly',
        format: 'excel',
        icon: 'Users',
        estimatedTime: '60 seconds',
        dataPoints: ['segments', 'leads', 'pos', 'geography']
      },
      {
        id: 'goal-progress',
        name: 'Goal Progress Report',
        description: 'Milestone tracking, projections, and recommendations for $400K target',
        category: 'financial',
        frequency: 'weekly',
        format: 'dashboard',
        icon: 'Target',
        estimatedTime: '30 seconds',
        dataPoints: ['goals', 'revenue', 'projections', 'milestones']
      },
      {
        id: 'beacon-content',
        name: 'Beacon Content Report',
        description: 'Content pipeline status, top performers, and publishing schedule',
        category: 'marketing',
        frequency: 'weekly',
        format: 'dashboard',
        icon: 'Radio',
        estimatedTime: '30 seconds',
        dataPoints: ['beacon', 'content', 'engagement', 'seo']
      }
    ];

    // Process history
    const history = (reportHistory?.results || []).map(r => ({
      id: r.id,
      type: r.report_type,
      title: r.title,
      parameters: r.parameters ? JSON.parse(r.parameters) : null,
      format: r.format,
      status: r.status,
      generatedAt: r.generated_at,
      fileUrl: r.file_url,
      fileSize: r.file_size,
      recipientCount: r.recipient_count,
      error: r.error_message
    }));

    // Process scheduled reports
    const scheduled = (scheduledReports?.results || []).map(r => ({
      id: r.id,
      type: r.report_type,
      title: r.title,
      description: r.description,
      frequency: r.frequency,
      format: r.format,
      recipients: r.recipients ? JSON.parse(r.recipients) : [],
      parameters: r.parameters ? JSON.parse(r.parameters) : null,
      nextRunAt: r.next_run_at,
      lastRunAt: r.last_run_at,
      isActive: r.is_active === 1
    }));

    // Calculate stats
    const stats = {
      totalGenerated: history.length,
      successRate: history.length > 0
        ? Math.round((history.filter(h => h.status === 'completed').length / history.length) * 100)
        : 100,
      scheduledActive: scheduled.filter(s => s.isActive).length,
      mostUsed: getMostUsedReport(history)
    };

    return new Response(JSON.stringify({
      success: true,
      timestamp: now,
      library: reportLibrary,
      history,
      scheduled,
      stats
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Reports API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;

  // Verify authentication
  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error, request);
  }

  try {
    const body = await request.json();
    const { reportType, format, parameters, schedule } = body;

    if (!reportType) {
      return new Response(JSON.stringify({
        success: false,
        error: 'reportType is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const reportId = `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate report based on type
    let reportData;
    switch (reportType) {
      case 'daily-executive':
        reportData = await generateDailyExecutive(env);
        break;
      case 'weekly-pipeline':
        reportData = await generatePipelineReport(env);
        break;
      case 'client-health':
        reportData = await generateClientHealth(env);
        break;
      case 'email-performance':
        reportData = await generateEmailPerformance(env);
        break;
      case 'intelligence-digest':
        reportData = await generateIntelligenceDigest(env);
        break;
      case 'goal-progress':
        reportData = await generateGoalProgress(env);
        break;
      default:
        reportData = await generateGenericReport(env, reportType, parameters);
    }

    // Store generated report
    await env.DB.prepare(`
      INSERT INTO generated_reports (id, report_type, title, parameters, format, status, generated_at, report_data)
      VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)
    `).bind(
      reportId,
      reportType,
      reportData.title,
      JSON.stringify(parameters || {}),
      format || 'dashboard',
      now,
      JSON.stringify(reportData)
    ).run().catch(() => {});

    return new Response(JSON.stringify({
      success: true,
      reportId,
      report: reportData,
      generatedAt: now
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Report generation error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Report Generation Functions

async function generateDailyExecutive(env) {
  const now = Math.floor(Date.now() / 1000);
  const todayStart = now - (now % 86400);
  const sevenDaysAgo = now - (7 * 86400);

  const [revenue, leads, tickets, quotes, actions] = await Promise.all([
    // Revenue metrics
    env.DB.prepare(`
      SELECT
        COUNT(CASE WHEN support_plan_status = 'active' THEN 1 END) as active_subscriptions,
        COUNT(*) as total_clients
      FROM clients
      WHERE status = 'active' OR status IS NULL
    `).first().catch(() => ({})),

    // Lead metrics
    env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN created_at > ? THEN 1 END) as new_today,
        COUNT(CASE WHEN lead_score >= 80 THEN 1 END) as hot_leads
      FROM restaurant_leads
    `).bind(todayStart).first().catch(() => ({})),

    // Ticket metrics
    env.DB.prepare(`
      SELECT
        COUNT(CASE WHEN status != 'resolved' THEN 1 END) as open_tickets,
        COUNT(CASE WHEN priority = 'urgent' AND status != 'resolved' THEN 1 END) as urgent
      FROM tickets
    `).first().catch(() => ({})),

    // Quote metrics
    env.DB.prepare(`
      SELECT
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'accepted' AND updated_at > ? THEN 1 END) as accepted_7d,
        SUM(CASE WHEN status = 'sent' THEN total_amount ELSE 0 END) as pipeline_value
      FROM quotes
    `).bind(sevenDaysAgo).first().catch(() => ({})),

    // Priority actions
    env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM business_brief_actions
      WHERE status = 'pending' AND priority IN ('critical', 'high')
    `).first().catch(() => ({ count: 0 }))
  ]);

  const mrr = (revenue?.active_subscriptions || 0) * 450; // Avg plan value

  return {
    title: 'Daily Executive Brief',
    date: new Date().toISOString().split('T')[0],
    sections: [
      {
        name: 'Revenue Snapshot',
        metrics: [
          { label: 'MRR', value: mrr, format: 'currency' },
          { label: 'ARR', value: mrr * 12, format: 'currency' },
          { label: 'Active Clients', value: revenue?.total_clients || 0, format: 'number' }
        ]
      },
      {
        name: 'Pipeline',
        metrics: [
          { label: 'Pending Quotes', value: quotes?.pending || 0, format: 'number' },
          { label: 'Pipeline Value', value: quotes?.pipeline_value || 0, format: 'currency' },
          { label: 'Accepted (7d)', value: quotes?.accepted_7d || 0, format: 'number' }
        ]
      },
      {
        name: 'Leads',
        metrics: [
          { label: 'Total Leads', value: leads?.total || 0, format: 'number' },
          { label: 'New Today', value: leads?.new_today || 0, format: 'number' },
          { label: 'Hot Leads', value: leads?.hot_leads || 0, format: 'number' }
        ]
      },
      {
        name: 'Support',
        metrics: [
          { label: 'Open Tickets', value: tickets?.open_tickets || 0, format: 'number' },
          { label: 'Urgent', value: tickets?.urgent || 0, format: 'number', alert: tickets?.urgent > 0 }
        ]
      }
    ],
    actionItems: actions?.count || 0,
    generatedAt: now
  };
}

async function generatePipelineReport(env) {
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - (30 * 86400);

  const [funnel, quotes, segments] = await Promise.all([
    // Lead funnel
    env.DB.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM restaurant_leads
      WHERE status IS NOT NULL
      GROUP BY status
    `).all().catch(() => ({ results: [] })),

    // Quote pipeline
    env.DB.prepare(`
      SELECT
        status,
        COUNT(*) as count,
        SUM(total_amount) as value
      FROM quotes
      WHERE created_at > ?
      GROUP BY status
    `).bind(thirtyDaysAgo).all().catch(() => ({ results: [] })),

    // Top segments
    env.DB.prepare(`
      SELECT
        ls.name,
        COUNT(lsm.lead_id) as lead_count,
        AVG(rl.lead_score) as avg_score
      FROM lead_segments ls
      LEFT JOIN lead_segment_members lsm ON ls.id = lsm.segment_id
      LEFT JOIN restaurant_leads rl ON lsm.lead_id = rl.id
      GROUP BY ls.id
      ORDER BY lead_count DESC
      LIMIT 5
    `).all().catch(() => ({ results: [] }))
  ]);

  // Process funnel
  const funnelData = {};
  (funnel?.results || []).forEach(f => {
    funnelData[f.status] = f.count;
  });

  // Process quotes
  const quoteData = {};
  (quotes?.results || []).forEach(q => {
    quoteData[q.status] = { count: q.count, value: q.value || 0 };
  });

  return {
    title: 'Weekly Pipeline Report',
    period: 'Last 30 days',
    sections: [
      {
        name: 'Lead Funnel',
        data: {
          prospects: funnelData.prospect || funnelData.new || 0,
          leads: funnelData.lead || 0,
          qualified: funnelData.qualified || 0,
          opportunities: funnelData.opportunity || 0,
          clients: funnelData.converted || funnelData.client || 0
        }
      },
      {
        name: 'Quote Pipeline',
        data: {
          draft: quoteData.draft || { count: 0, value: 0 },
          sent: quoteData.sent || { count: 0, value: 0 },
          viewed: quoteData.viewed || { count: 0, value: 0 },
          accepted: quoteData.accepted || { count: 0, value: 0 },
          declined: quoteData.declined || { count: 0, value: 0 }
        }
      },
      {
        name: 'Top Segments',
        data: (segments?.results || []).map(s => ({
          name: s.name,
          leads: s.lead_count,
          avgScore: Math.round(s.avg_score || 0)
        }))
      }
    ],
    generatedAt: now
  };
}

async function generateClientHealth(env) {
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - (30 * 86400);

  const clients = await env.DB.prepare(`
    SELECT
      c.id,
      c.name,
      c.company,
      c.support_plan_tier,
      c.support_plan_status,
      COUNT(DISTINCT t.id) as ticket_count,
      COUNT(DISTINCT CASE WHEN t.status != 'resolved' THEN t.id END) as open_tickets,
      MAX(t.created_at) as last_ticket
    FROM clients c
    LEFT JOIN tickets t ON c.id = t.client_id AND t.created_at > ?
    WHERE c.status = 'active' OR c.status IS NULL
    GROUP BY c.id
    ORDER BY ticket_count DESC
    LIMIT 50
  `).bind(thirtyDaysAgo).all().catch(() => ({ results: [] }));

  const healthScores = (clients?.results || []).map(c => {
    const ticketPenalty = Math.min((c.ticket_count || 0) * 5, 30);
    const openTicketPenalty = (c.open_tickets || 0) * 10;
    const planBonus = c.support_plan_tier === 'premium' ? 10 : c.support_plan_tier === 'professional' ? 5 : 0;
    const healthScore = Math.max(0, Math.min(100, 80 - ticketPenalty - openTicketPenalty + planBonus));

    return {
      id: c.id,
      name: c.name,
      company: c.company,
      plan: c.support_plan_tier || 'none',
      healthScore,
      riskLevel: healthScore < 40 ? 'high' : healthScore < 70 ? 'medium' : 'low',
      ticketCount: c.ticket_count || 0,
      openTickets: c.open_tickets || 0
    };
  });

  const atRisk = healthScores.filter(c => c.riskLevel === 'high');
  const avgHealth = healthScores.length > 0
    ? Math.round(healthScores.reduce((sum, c) => sum + c.healthScore, 0) / healthScores.length)
    : 0;

  return {
    title: 'Client Health Scorecard',
    period: 'Last 30 days',
    summary: {
      totalClients: healthScores.length,
      avgHealthScore: avgHealth,
      atRiskCount: atRisk.length,
      healthyCount: healthScores.filter(c => c.riskLevel === 'low').length
    },
    clients: healthScores,
    atRiskClients: atRisk,
    generatedAt: now
  };
}

async function generateEmailPerformance(env) {
  const now = Math.floor(Date.now() / 1000);
  const sevenDaysAgo = now - (7 * 86400);

  const [sequences, emailStats] = await Promise.all([
    env.DB.prepare(`
      SELECT
        es.id,
        es.name,
        es.trigger_type,
        COUNT(DISTINCT ese.contact_id) as enrolled,
        COUNT(DISTINCT CASE WHEN ese.status = 'completed' THEN ese.contact_id END) as completed
      FROM email_sequences es
      LEFT JOIN email_sequence_enrollments ese ON es.id = ese.sequence_id
      WHERE es.is_active = 1
      GROUP BY es.id
    `).all().catch(() => ({ results: [] })),

    env.DB.prepare(`
      SELECT
        COUNT(*) as total_sent,
        COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened,
        COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked,
        COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced
      FROM email_queue
      WHERE sent_at > ?
    `).bind(sevenDaysAgo).first().catch(() => ({}))
  ]);

  const totalSent = emailStats?.total_sent || 0;
  const openRate = totalSent > 0 ? Math.round((emailStats?.opened || 0) / totalSent * 100) : 0;
  const clickRate = totalSent > 0 ? Math.round((emailStats?.clicked || 0) / totalSent * 100) : 0;
  const bounceRate = totalSent > 0 ? Math.round((emailStats?.bounced || 0) / totalSent * 100) : 0;

  return {
    title: 'Email Campaign Performance',
    period: 'Last 7 days',
    overview: {
      totalSent,
      openRate,
      clickRate,
      bounceRate,
      deliverabilityScore: Math.max(0, 100 - bounceRate * 5)
    },
    sequences: (sequences?.results || []).map(s => ({
      id: s.id,
      name: s.name,
      trigger: s.trigger_type,
      enrolled: s.enrolled || 0,
      completed: s.completed || 0,
      completionRate: s.enrolled > 0 ? Math.round((s.completed / s.enrolled) * 100) : 0
    })),
    generatedAt: now
  };
}

async function generateIntelligenceDigest(env) {
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 86400;

  const [agentJobs, findings, leadsScored] = await Promise.all([
    env.DB.prepare(`
      SELECT
        agent_type,
        MAX(completed_at) as last_run,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as success,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM automation_jobs
      WHERE job_type LIKE 'agent_%' AND created_at > ?
      GROUP BY agent_type
    `).bind(oneDayAgo).all().catch(() => ({ results: [] })),

    env.DB.prepare(`
      SELECT
        priority, category, title, description, source_type, estimated_value, created_at
      FROM business_brief_actions
      WHERE source_type LIKE 'agent_%' AND created_at > ?
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(oneDayAgo).all().catch(() => ({ results: [] })),

    env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM restaurant_leads
      WHERE lead_score IS NOT NULL AND updated_at > ?
    `).bind(oneDayAgo).first().catch(() => ({ count: 0 }))
  ]);

  const agents = {};
  (agentJobs?.results || []).forEach(a => {
    const key = (a.agent_type || '').replace('agent_', '');
    agents[key] = {
      lastRun: a.last_run,
      successCount: a.success || 0,
      failedCount: a.failed || 0,
      status: a.failed > a.success ? 'error' : 'healthy'
    };
  });

  return {
    title: 'Intelligence Agent Digest',
    period: 'Last 24 hours',
    agents: {
      hunter: agents.hunter || { status: 'idle', successCount: 0, failedCount: 0 },
      analyst: agents.analyst || { status: 'idle', successCount: 0, failedCount: 0 },
      operator: agents.operator || { status: 'idle', successCount: 0, failedCount: 0 },
      strategist: agents.strategist || { status: 'idle', successCount: 0, failedCount: 0 }
    },
    findings: (findings?.results || []).map(f => ({
      priority: f.priority,
      category: f.category,
      title: f.title,
      description: f.description,
      source: f.source_type,
      value: f.estimated_value,
      timestamp: f.created_at
    })),
    leadsScored: leadsScored?.count || 0,
    generatedAt: now
  };
}

async function generateGoalProgress(env) {
  const now = Math.floor(Date.now() / 1000);

  // Get goals and milestones
  const [goals, revenue] = await Promise.all([
    env.DB.prepare(`
      SELECT
        g.id, g.title, g.description, g.category, g.target_value,
        g.current_value, g.unit, g.deadline, g.status,
        (SELECT GROUP_CONCAT(m.target_date || ':' || m.target_value || ':' || COALESCE(m.actual_value, ''))
         FROM goal_milestones m WHERE m.goal_id = g.id) as milestones
      FROM business_goals g
      WHERE g.status != 'archived'
      ORDER BY g.deadline ASC
    `).all().catch(() => ({ results: [] })),

    // Calculate current revenue
    env.DB.prepare(`
      SELECT
        COUNT(CASE WHEN support_plan_tier = 'core' THEN 1 END) as core,
        COUNT(CASE WHEN support_plan_tier = 'professional' THEN 1 END) as professional,
        COUNT(CASE WHEN support_plan_tier = 'premium' THEN 1 END) as premium
      FROM clients
      WHERE support_plan_status = 'active'
    `).first().catch(() => ({}))
  ]);

  const currentMRR = (revenue?.core || 0) * 350 +
    (revenue?.professional || 0) * 500 +
    (revenue?.premium || 0) * 800;

  const goalData = (goals?.results || []).map(g => {
    const milestones = g.milestones
      ? g.milestones.split(',').map(m => {
          const [date, target, actual] = m.split(':');
          return { date: parseInt(date), target: parseFloat(target), actual: actual ? parseFloat(actual) : null };
        })
      : [];

    return {
      id: g.id,
      title: g.title,
      description: g.description,
      category: g.category,
      targetValue: g.target_value,
      currentValue: g.current_value,
      unit: g.unit,
      deadline: g.deadline,
      status: g.status,
      progress: g.target_value > 0 ? Math.round((g.current_value / g.target_value) * 100) : 0,
      milestones
    };
  });

  // Calculate projections for $400K goal
  const targetDate = new Date('2026-05-01').getTime() / 1000;
  const daysRemaining = Math.max(0, Math.floor((targetDate - now) / 86400));
  const targetMRR = 23400; // $400K / ~17 months
  const mrrGap = targetMRR - currentMRR;
  const weeklyTarget = daysRemaining > 0 ? Math.round((400000 - currentMRR * 12) / (daysRemaining / 7)) : 0;

  return {
    title: 'Goal Progress Report',
    goals: goalData,
    primaryGoal: {
      target: 400000,
      currentMRR,
      projectedAnnual: currentMRR * 12,
      targetDate: '2026-05-01',
      daysRemaining,
      progress: Math.round((currentMRR * 12 / 400000) * 100),
      mrrGap,
      weeklyTarget,
      onTrack: currentMRR >= targetMRR * 0.9
    },
    planMix: {
      current: {
        core: revenue?.core || 0,
        professional: revenue?.professional || 0,
        premium: revenue?.premium || 0
      },
      target: { core: 15, professional: 25, premium: 5 }
    },
    generatedAt: now
  };
}

async function generateGenericReport(env, reportType, parameters) {
  return {
    title: `${reportType} Report`,
    message: 'Custom report generation',
    parameters,
    generatedAt: Math.floor(Date.now() / 1000)
  };
}

function getMostUsedReport(history) {
  if (!history || history.length === 0) return null;

  const counts = {};
  history.forEach(h => {
    counts[h.type] = (counts[h.type] || 0) + 1;
  });

  let maxType = null;
  let maxCount = 0;
  Object.entries(counts).forEach(([type, count]) => {
    if (count > maxCount) {
      maxType = type;
      maxCount = count;
    }
  });

  return maxType;
}
