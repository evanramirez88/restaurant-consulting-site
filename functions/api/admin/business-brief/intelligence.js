// Business Brief Intelligence API - Deep Analysis & Insights
// GET: Returns intelligence data (leads, clients, agents, beacon)

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
    const sevenDaysAgo = now - (7 * 86400);

    // Parallel fetch all intelligence data
    const [
      // Lead Intelligence
      segmentAnalysis,
      posDistribution,
      geoDistribution,
      topScoredLeads,
      recentlyEnriched,

      // Client Intelligence
      clientHealthData,
      clientEngagement,
      upsellCandidates,

      // Agent Intelligence
      agentStatus,
      recentAgentFindings,

      // Beacon Intelligence
      beaconStats,
      topBeaconContent,
      pendingBeaconItems,

      // Data Context
      dataContextStats,
      recentSyncedComms
    ] = await Promise.all([
      // Segment analysis with performance
      env.DB.prepare(`
        SELECT
          ls.id,
          ls.name,
          ls.segment_key,
          ls.description,
          COUNT(lsm.lead_id) as lead_count,
          AVG(rl.lead_score) as avg_score,
          COUNT(CASE WHEN rl.lead_score >= 80 THEN 1 END) as hot_count,
          ls.email_sequence_id
        FROM lead_segments ls
        LEFT JOIN lead_segment_members lsm ON ls.id = lsm.segment_id
        LEFT JOIN restaurant_leads rl ON lsm.lead_id = rl.id
        GROUP BY ls.id
        ORDER BY lead_count DESC
        LIMIT 12
      `).all().catch(() => ({ results: [] })),

      // POS distribution
      env.DB.prepare(`
        SELECT
          COALESCE(current_pos, 'Unknown') as pos,
          COUNT(*) as count,
          AVG(lead_score) as avg_score,
          COUNT(CASE WHEN lead_score >= 80 THEN 1 END) as hot_count
        FROM restaurant_leads
        WHERE current_pos IS NOT NULL
        GROUP BY current_pos
        ORDER BY count DESC
        LIMIT 10
      `).all().catch(() => ({ results: [] })),

      // Geographic distribution
      env.DB.prepare(`
        SELECT
          COALESCE(state, 'Unknown') as state,
          COUNT(*) as lead_count,
          AVG(lead_score) as avg_score,
          COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as with_email
        FROM restaurant_leads
        GROUP BY state
        ORDER BY lead_count DESC
        LIMIT 15
      `).all().catch(() => ({ results: [] })),

      // Top scored leads
      env.DB.prepare(`
        SELECT
          id, name, company_name, email, phone, city, state,
          current_pos, lead_score, status, created_at
        FROM restaurant_leads
        WHERE lead_score >= 70
        ORDER BY lead_score DESC
        LIMIT 20
      `).all().catch(() => ({ results: [] })),

      // Recently enriched leads
      env.DB.prepare(`
        SELECT COUNT(*) as count
        FROM restaurant_leads
        WHERE enriched_at > ?
      `).bind(sevenDaysAgo).first().catch(() => ({ count: 0 })),

      // Client health data
      env.DB.prepare(`
        SELECT
          c.id,
          c.name,
          c.company,
          c.support_plan_tier,
          c.support_plan_status,
          COUNT(DISTINCT t.id) as ticket_count,
          COUNT(DISTINCT CASE WHEN t.status != 'resolved' THEN t.id END) as open_tickets,
          MAX(t.created_at) as last_ticket_date
        FROM clients c
        LEFT JOIN tickets t ON c.id = t.client_id AND t.created_at > ?
        WHERE c.status = 'active' OR c.status IS NULL
        GROUP BY c.id
        ORDER BY ticket_count DESC
        LIMIT 20
      `).bind(thirtyDaysAgo).all().catch(() => ({ results: [] })),

      // Client engagement (portal activity)
      env.DB.prepare(`
        SELECT
          c.id,
          c.name,
          COUNT(DISTINCT pal.id) as activity_count,
          MAX(pal.created_at) as last_activity
        FROM clients c
        LEFT JOIN portal_activity_log pal ON c.id = pal.user_id AND pal.portal_type = 'client'
        WHERE c.status = 'active' OR c.status IS NULL
        GROUP BY c.id
        HAVING activity_count > 0
        ORDER BY activity_count DESC
        LIMIT 10
      `).all().catch(() => ({ results: [] })),

      // Upsell candidates (clients without premium plans)
      env.DB.prepare(`
        SELECT
          c.id,
          c.name,
          c.company,
          c.support_plan_tier,
          COUNT(t.id) as recent_tickets
        FROM clients c
        LEFT JOIN tickets t ON c.id = t.client_id AND t.created_at > ?
        WHERE (c.support_plan_tier IS NULL OR c.support_plan_tier IN ('core', 'none', ''))
        AND (c.status = 'active' OR c.status IS NULL)
        GROUP BY c.id
        HAVING recent_tickets >= 2
        ORDER BY recent_tickets DESC
        LIMIT 10
      `).bind(thirtyDaysAgo).all().catch(() => ({ results: [] })),

      // Agent status from intelligence_agents table or automation_jobs
      env.DB.prepare(`
        SELECT
          agent_type,
          MAX(completed_at) as last_run,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
        FROM automation_jobs
        WHERE job_type LIKE 'agent_%'
        AND created_at > ?
        GROUP BY agent_type
      `).bind(sevenDaysAgo).all().catch(() => ({ results: [] })),

      // Recent agent findings (from action items or intel)
      env.DB.prepare(`
        SELECT
          id, priority, category, title, description,
          source_type, estimated_value, created_at
        FROM business_brief_actions
        WHERE source_type IN ('agent_hunter', 'agent_analyst', 'agent_operator', 'agent_strategist')
        AND created_at > ?
        ORDER BY created_at DESC
        LIMIT 10
      `).bind(sevenDaysAgo).all().catch(() => ({ results: [] })),

      // Beacon stats
      env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
          COUNT(CASE WHEN status = 'published' THEN 1 END) as published,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
          COUNT(CASE WHEN created_at > ? THEN 1 END) as new_7d
        FROM beacon_items
      `).bind(sevenDaysAgo).first().catch(() => ({
        total: 0, pending: 0, approved: 0, published: 0, rejected: 0, new_7d: 0
      })),

      // Top beacon content by engagement
      env.DB.prepare(`
        SELECT
          id, title, source_name, category, status,
          relevance_score, created_at
        FROM beacon_items
        WHERE status IN ('approved', 'published')
        ORDER BY relevance_score DESC, created_at DESC
        LIMIT 10
      `).all().catch(() => ({ results: [] })),

      // Pending beacon items for review
      env.DB.prepare(`
        SELECT
          id, title, source_name, category, summary,
          relevance_score, created_at
        FROM beacon_items
        WHERE status = 'pending'
        ORDER BY relevance_score DESC
        LIMIT 5
      `).all().catch(() => ({ results: [] })),

      // Data Context Stats (New)
      env.DB.prepare(`
        SELECT
          (SELECT COUNT(*) FROM synced_contacts) as total_contacts,
          (SELECT COUNT(*) FROM synced_contacts WHERE privacy_level = 'business') as business_contacts,
          (SELECT COUNT(*) FROM synced_communications WHERE occurred_at > ?) as recent_interactions_24h,
          (SELECT COUNT(*) FROM context_items) as total_facts
      `).bind(now - 86400).first().catch(() => ({
        total_contacts: 0, business_contacts: 0, recent_interactions_24h: 0, total_facts: 0
      })),

      // Recent Synced Communications
      env.DB.prepare(`
         SELECT type, summary, occurred_at, source_id
         FROM synced_communications
         ORDER BY occurred_at DESC
         LIMIT 10
      `).all().catch(() => ({ results: [] }))
    ]);

    // Process lead intelligence
    const leadIntelligence = {
      segments: (segmentAnalysis?.results || []).map(s => ({
        id: s.id,
        name: s.name,
        key: s.segment_key,
        description: s.description,
        leadCount: s.lead_count || 0,
        avgScore: Math.round(s.avg_score || 0),
        hotCount: s.hot_count || 0,
        emailSequence: s.email_sequence_id
      })),

      posDistribution: (posDistribution?.results || []).map(p => ({
        pos: p.pos,
        count: p.count,
        avgScore: Math.round(p.avg_score || 0),
        hotCount: p.hot_count || 0,
        switcherPotential: getSwitcherPotential(p.pos)
      })),

      geoDistribution: (geoDistribution?.results || []).map(g => ({
        state: g.state,
        leadCount: g.lead_count,
        avgScore: Math.round(g.avg_score || 0),
        emailCoverage: g.lead_count > 0 ? Math.round((g.with_email / g.lead_count) * 100) : 0
      })),

      topLeads: (topScoredLeads?.results || []).map(l => ({
        id: l.id,
        name: l.name || l.company_name,
        company: l.company_name,
        email: l.email,
        phone: l.phone,
        location: [l.city, l.state].filter(Boolean).join(', '),
        pos: l.current_pos,
        score: l.lead_score,
        status: l.status
      })),

      recentlyEnriched: recentlyEnriched?.count || 0
    };

    // Process client intelligence
    const clientIntelligence = {
      healthScores: (clientHealthData?.results || []).map(c => {
        // Calculate health score based on ticket volume and plan status
        const ticketPenalty = Math.min((c.ticket_count || 0) * 5, 30);
        const openTicketPenalty = (c.open_tickets || 0) * 10;
        const planBonus = c.support_plan_tier === 'premium' ? 10 : c.support_plan_tier === 'professional' ? 5 : 0;
        const healthScore = Math.max(0, Math.min(100, 80 - ticketPenalty - openTicketPenalty + planBonus));

        return {
          id: c.id,
          name: c.name,
          company: c.company,
          plan: c.support_plan_tier || 'none',
          planStatus: c.support_plan_status,
          ticketCount: c.ticket_count || 0,
          openTickets: c.open_tickets || 0,
          healthScore,
          riskLevel: healthScore < 40 ? 'high' : healthScore < 70 ? 'medium' : 'low'
        };
      }),

      engagement: (clientEngagement?.results || []).map(c => ({
        id: c.id,
        name: c.name,
        activityCount: c.activity_count,
        lastActivity: c.last_activity
      })),

      upsellOpportunities: (upsellCandidates?.results || []).map(c => ({
        id: c.id,
        name: c.name,
        company: c.company,
        currentPlan: c.support_plan_tier || 'none',
        recentTickets: c.recent_tickets,
        recommendedPlan: c.recent_tickets >= 5 ? 'premium' : 'professional',
        reason: c.recent_tickets >= 5
          ? 'High support volume suggests premium plan would be beneficial'
          : 'Moderate support needs indicate professional plan value'
      }))
    };

    // Process agent intelligence
    const agents = {
      hunter: { name: 'Hunter', lastRun: null, status: 'idle', findings: 0 },
      analyst: { name: 'Analyst', lastRun: null, status: 'idle', findings: 0 },
      operator: { name: 'Operator', lastRun: null, status: 'idle', findings: 0 },
      strategist: { name: 'Strategist', lastRun: null, status: 'idle', findings: 0 }
    };

    (agentStatus?.results || []).forEach(a => {
      const agentKey = (a.agent_type || '').replace('agent_', '');
      if (agents[agentKey]) {
        agents[agentKey].lastRun = a.last_run;
        agents[agentKey].status = a.failed_count > a.completed_count ? 'error' : 'healthy';
        agents[agentKey].completedRuns = a.completed_count;
        agents[agentKey].failedRuns = a.failed_count;
      }
    });

    const agentIntelligence = {
      agents,
      recentFindings: (recentAgentFindings?.results || []).map(f => ({
        id: f.id,
        priority: f.priority,
        category: f.category,
        title: f.title,
        description: f.description,
        source: f.source_type,
        value: f.estimated_value,
        timestamp: f.created_at
      }))
    };

    // Process beacon intelligence
    const beaconIntelligence = {
      stats: {
        total: beaconStats?.total || 0,
        pending: beaconStats?.pending || 0,
        approved: beaconStats?.approved || 0,
        published: beaconStats?.published || 0,
        rejected: beaconStats?.rejected || 0,
        newLast7Days: beaconStats?.new_7d || 0
      },

      topContent: (topBeaconContent?.results || []).map(b => ({
        id: b.id,
        title: b.title,
        source: b.source_name,
        category: b.category,
        status: b.status,
        relevanceScore: b.relevance_score,
        createdAt: b.created_at
      })),

      pendingReview: (pendingBeaconItems?.results || []).map(b => ({
        id: b.id,
        title: b.title,
        source: b.source_name,
        category: b.category,
        summary: b.summary,
        relevanceScore: b.relevance_score
      }))
    };

    return new Response(JSON.stringify({
      success: true,
      timestamp: now,
      lastUpdated: new Date().toISOString(),
      leadIntelligence,
      clientIntelligence,
      agentIntelligence,
      beaconIntelligence,
      dataContext: {
        stats: dataContextStats || { total_contacts: 0, business_contacts: 0, recent_interactions_24h: 0, total_facts: 0 },
        recentActivity: recentSyncedComms?.results || []
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Intelligence API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Helper function to determine switcher potential
function getSwitcherPotential(pos) {
  const highPotential = ['clover', 'square', 'aloha', 'micros', 'ncr'];
  const mediumPotential = ['toast', 'lightspeed', 'revel'];

  const posLower = (pos || '').toLowerCase();

  if (highPotential.some(p => posLower.includes(p))) {
    return 'high';
  }
  if (mediumPotential.some(p => posLower.includes(p))) {
    return 'medium';
  }
  return 'low';
}
