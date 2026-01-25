/**
 * Client 360 View API
 * GET /api/admin/clients/:clientId/360 - Aggregated client overview
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const { clientId } = params;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    // Fetch client base info with profile
    const client = await env.DB.prepare(`
      SELECT c.*, cp.pos_system, cp.cuisine_type, cp.seating_capacity,
             cp.client_score, cp.engagement_score as profile_engagement_score,
             cp.estimated_revenue_tier, cp.annual_revenue_estimate,
             cp.employee_count, cp.website_url
      FROM clients c
      LEFT JOIN client_profiles cp ON c.id = cp.client_id
      WHERE c.id = ?
    `).bind(clientId).first();

    if (!client) {
      return new Response(JSON.stringify({ success: false, error: 'Client not found' }), {
        status: 404, headers: corsHeaders
      });
    }

    // Run parallel queries for 360 data
    const [tickets, projects, deals, recentActivity, notes, healthHistory, reps, satisfaction] = await Promise.all([
      // Open tickets
      env.DB.prepare(`
        SELECT id, subject, status, priority, created_at, updated_at,
               response_due_at, resolution_due_at, sla_response_breached, sla_resolution_breached
        FROM tickets WHERE client_id = ? AND status NOT IN ('closed')
        ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END
        LIMIT 10
      `).bind(clientId).all(),

      // Active projects
      env.DB.prepare(`
        SELECT id, name, status, progress, budget, actual_spend, start_date, target_date
        FROM projects WHERE client_id = ? AND status IN ('active', 'in_progress', 'planning')
        ORDER BY created_at DESC LIMIT 5
      `).bind(clientId).all(),

      // Deal pipeline
      env.DB.prepare(`
        SELECT id, title, stage, value, recurring_value, probability, expected_close_date, deal_type
        FROM client_deals WHERE client_id = ?
        ORDER BY CASE stage WHEN 'negotiation' THEN 0 WHEN 'proposal' THEN 1 WHEN 'qualification' THEN 2 WHEN 'discovery' THEN 3 ELSE 4 END
        LIMIT 10
      `).bind(clientId).all(),

      // Recent activity (last 20)
      env.DB.prepare(`
        SELECT id, activity_type, title, description, performed_by_name, performed_by_type, created_at
        FROM client_activity_log WHERE client_id = ?
        ORDER BY created_at DESC LIMIT 20
      `).bind(clientId).all(),

      // Notes (pinned first, then recent)
      env.DB.prepare(`
        SELECT id, author_name, author_type, content, note_type, is_pinned, created_at
        FROM client_notes WHERE client_id = ? AND is_private = 0
        ORDER BY is_pinned DESC, created_at DESC LIMIT 10
      `).bind(clientId).all(),

      // Health score history (last 30 days)
      env.DB.prepare(`
        SELECT overall_score, engagement_score, payment_score, satisfaction_score,
               activity_score, relationship_score, trend, calculated_at
        FROM client_health_scores WHERE client_id = ?
        ORDER BY calculated_at DESC LIMIT 30
      `).bind(clientId).all(),

      // Assigned reps
      env.DB.prepare(`
        SELECT r.id, r.name, r.email, r.role, r.territory,
               cra.assigned_at, cra.is_primary
        FROM client_rep_assignments cra
        JOIN reps r ON cra.rep_id = r.id
        WHERE cra.client_id = ?
        ORDER BY cra.is_primary DESC
      `).bind(clientId).all(),

      // CSAT scores
      env.DB.prepare(`
        SELECT AVG(rating) as avg_rating, COUNT(*) as total_ratings,
               SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as positive_ratings
        FROM ticket_satisfaction WHERE client_id = ?
      `).bind(clientId).first()
    ]);

    // Aggregate ticket stats
    const ticketStats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('open', 'in_progress') THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
        SUM(CASE WHEN sla_response_breached = 1 THEN 1 ELSE 0 END) as sla_breaches,
        AVG(CASE WHEN first_response_at IS NOT NULL THEN first_response_at - created_at ELSE NULL END) as avg_response_seconds
      FROM tickets WHERE client_id = ?
    `).bind(clientId).first();

    // Revenue summary
    const revenue = await env.DB.prepare(`
      SELECT
        SUM(amount) as total_revenue,
        SUM(CASE WHEN created_at > unixepoch() - 2592000 THEN amount ELSE 0 END) as revenue_30d
      FROM project_revenue WHERE client_id = ?
    `).bind(clientId).first();

    return new Response(JSON.stringify({
      success: true,
      data: {
        client,
        tickets: {
          items: tickets.results || [],
          stats: ticketStats || {}
        },
        projects: projects.results || [],
        deals: deals.results || [],
        recentActivity: recentActivity.results || [],
        notes: notes.results || [],
        healthHistory: healthHistory.results || [],
        reps: reps.results || [],
        satisfaction: satisfaction || {},
        revenue: revenue || {},
        summary: {
          health_score: client.health_score || 50,
          health_trend: client.health_trend || 'stable',
          churn_risk: client.churn_risk || 'low',
          open_tickets: ticketStats?.open_count || 0,
          active_projects: (projects.results || []).length,
          open_deals: (deals.results || []).filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).length,
          total_revenue: revenue?.total_revenue || 0,
          avg_csat: satisfaction?.avg_rating || null
        }
      }
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Client 360 error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
