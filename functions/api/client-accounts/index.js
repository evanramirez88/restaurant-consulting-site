/**
 * Client Accounts API
 *
 * GET /api/client-accounts - List all client accounts
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);

  // Query params
  const status = url.searchParams.get('status');
  const tier = url.searchParams.get('tier');
  const churnRisk = url.searchParams.get('churn_risk');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    const db = env.DB;

    // Build query with filters
    let whereConditions = ['1=1'];
    const params = [];

    if (status) {
      whereConditions.push('ca.status = ?');
      params.push(status);
    }

    if (tier) {
      whereConditions.push('ca.support_plan_tier = ?');
      params.push(tier);
    }

    if (churnRisk) {
      whereConditions.push('ca.churn_risk = ?');
      params.push(churnRisk);
    }

    params.push(limit, offset);

    const query = `
      SELECT
        ca.*,
        o.legal_name,
        o.dba_name,
        o.slug as org_slug,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.slug as contact_slug,
        c.portal_enabled,
        l.city,
        l.state,
        l.pos_system,
        r.name as assigned_rep_name,
        r.email as assigned_rep_email
      FROM client_accounts ca
      JOIN organizations o ON ca.organization_id = o.id
      LEFT JOIN org_contacts c ON c.organization_id = o.id AND c.is_primary = 1
      LEFT JOIN locations l ON l.organization_id = o.id AND l.is_primary = 1
      LEFT JOIN reps r ON ca.assigned_rep_id = r.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ca.health_score ASC, ca.client_since DESC
      LIMIT ? OFFSET ?
    `;

    const results = await db.prepare(query).bind(...params).all();

    // Get totals and summary
    const summaryQuery = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN ca.status = 'active' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN ca.churn_risk IN ('high', 'critical') THEN 1 ELSE 0 END) as at_risk_count,
        SUM(ca.mrr) as total_mrr,
        AVG(ca.health_score) as avg_health_score
      FROM client_accounts ca
      WHERE ${whereConditions.slice(0, -2).join(' AND ') || '1=1'}
    `;
    const summaryParams = params.slice(0, -2);
    const summary = await db.prepare(summaryQuery).bind(...summaryParams).first();

    return new Response(JSON.stringify({
      success: true,
      data: results.results.map(r => ({
        id: r.id,
        organization_id: r.organization_id,
        organization: {
          legal_name: r.legal_name,
          dba_name: r.dba_name,
          slug: r.org_slug
        },
        primary_contact: r.email ? {
          name: [r.first_name, r.last_name].filter(Boolean).join(' ') || null,
          email: r.email,
          phone: r.phone,
          portal_slug: r.contact_slug,
          portal_enabled: Boolean(r.portal_enabled)
        } : null,
        location: {
          city: r.city,
          state: r.state,
          pos_system: r.pos_system
        },
        status: r.status,
        support_plan_tier: r.support_plan_tier,
        support_plan_status: r.support_plan_status,
        support_plan_started: r.support_plan_started,
        support_plan_renews: r.support_plan_renews,
        support_hours_used: r.support_hours_used,
        mrr: r.mrr,
        total_revenue: r.total_revenue,
        health_score: r.health_score,
        health_trend: r.health_trend,
        churn_risk: r.churn_risk,
        client_since: r.client_since,
        last_activity_at: r.last_activity_at,
        assigned_rep: r.assigned_rep_name ? {
          name: r.assigned_rep_name,
          email: r.assigned_rep_email
        } : null,
        service_lane: r.service_lane
      })),
      summary: {
        total: summary.total,
        active_count: summary.active_count,
        at_risk_count: summary.at_risk_count,
        total_mrr: summary.total_mrr || 0,
        avg_health_score: Math.round(summary.avg_health_score || 0)
      },
      pagination: {
        limit,
        offset,
        hasMore: offset + results.results.length < summary.total
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Client accounts list error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch client accounts'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
