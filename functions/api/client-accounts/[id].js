/**
 * Client Account Detail API
 *
 * GET /api/client-accounts/:id - Get client account details
 * PATCH /api/client-accounts/:id - Update client account
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const { id } = params;
  const url = new URL(request.url);
  const include = url.searchParams.get('include')?.split(',') || [];

  try {
    const db = env.DB;

    const account = await db.prepare(`
      SELECT
        ca.*,
        o.id as org_id,
        o.legal_name,
        o.dba_name,
        o.slug as org_slug,
        o.lifecycle_stage,
        o.hubspot_company_id,
        o.stripe_customer_id as org_stripe_customer_id,
        o.square_customer_id as org_square_customer_id,
        o.notes as org_notes,
        o.tags as org_tags,
        c.id as contact_id,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.title as contact_title,
        c.role_type,
        c.portal_enabled,
        c.slug as contact_slug,
        c.timezone,
        l.id as location_id,
        l.name as location_name,
        l.address_line1,
        l.city,
        l.state,
        l.zip,
        l.phone as location_phone,
        l.website_url,
        l.pos_system,
        l.cuisine_primary,
        l.seating_capacity,
        r.id as rep_id,
        r.name as rep_name,
        r.email as rep_email,
        r.territory as rep_territory
      FROM client_accounts ca
      JOIN organizations o ON ca.organization_id = o.id
      LEFT JOIN org_contacts c ON c.organization_id = o.id AND c.is_primary = 1
      LEFT JOIN locations l ON l.organization_id = o.id AND l.is_primary = 1
      LEFT JOIN reps r ON ca.assigned_rep_id = r.id
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

    const response = {
      id: account.id,
      organization_id: account.organization_id,
      status: account.status,
      client_since: account.client_since,
      // Support plan
      support_plan: {
        tier: account.support_plan_tier,
        status: account.support_plan_status,
        started: account.support_plan_started,
        renews: account.support_plan_renews,
        hours_included: account.support_hours_included,
        hours_used: account.support_hours_used
      },
      // Billing
      billing: {
        stripe_subscription_id: account.stripe_subscription_id,
        stripe_subscription_status: account.stripe_subscription_status,
        square_subscription_id: account.square_subscription_id,
        mrr: account.mrr,
        total_revenue: account.total_revenue
      },
      // Health
      health: {
        score: account.health_score,
        trend: account.health_trend,
        computed_at: account.health_computed_at,
        factors: account.health_factors ? JSON.parse(account.health_factors) : null,
        churn_risk: account.churn_risk,
        nps_score: account.nps_score
      },
      // Activity
      last_activity_at: account.last_activity_at,
      last_support_ticket_at: account.last_support_ticket_at,
      portal_logins_count: account.portal_logins_count,
      service_lane: account.service_lane,
      // Organization
      organization: {
        id: account.org_id,
        legal_name: account.legal_name,
        dba_name: account.dba_name,
        slug: account.org_slug,
        lifecycle_stage: account.lifecycle_stage,
        hubspot_company_id: account.hubspot_company_id,
        stripe_customer_id: account.org_stripe_customer_id,
        square_customer_id: account.org_square_customer_id,
        notes: account.org_notes,
        tags: account.org_tags ? JSON.parse(account.org_tags) : []
      },
      // Primary contact
      primary_contact: account.contact_id ? {
        id: account.contact_id,
        name: [account.first_name, account.last_name].filter(Boolean).join(' ') || null,
        first_name: account.first_name,
        last_name: account.last_name,
        email: account.email,
        phone: account.phone,
        title: account.contact_title,
        role_type: account.role_type,
        portal_enabled: Boolean(account.portal_enabled),
        portal_slug: account.contact_slug,
        timezone: account.timezone
      } : null,
      // Primary location
      primary_location: account.location_id ? {
        id: account.location_id,
        name: account.location_name,
        address_line1: account.address_line1,
        city: account.city,
        state: account.state,
        zip: account.zip,
        phone: account.location_phone,
        website_url: account.website_url,
        pos_system: account.pos_system,
        cuisine_primary: account.cuisine_primary,
        seating_capacity: account.seating_capacity
      } : null,
      // Assigned rep
      assigned_rep: account.rep_id ? {
        id: account.rep_id,
        name: account.rep_name,
        email: account.rep_email,
        territory: account.rep_territory
      } : null,
      created_at: account.created_at,
      updated_at: account.updated_at
    };

    // Include tickets if requested
    if (include.includes('tickets')) {
      const tickets = await db.prepare(`
        SELECT id, subject, status, priority, category, created_at, resolved_at
        FROM tickets
        WHERE client_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `).bind(account.organization_id).all();
      response.recent_tickets = tickets.results;
    }

    // Include projects if requested
    if (include.includes('projects')) {
      const projects = await db.prepare(`
        SELECT id, name, type, status, start_date, end_date
        FROM projects
        WHERE client_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `).bind(account.organization_id).all();
      response.projects = projects.results;
    }

    // Include activity if requested
    if (include.includes('activity')) {
      const activity = await db.prepare(`
        SELECT id, activity_type, title, description, created_at
        FROM unified_activity_log
        WHERE organization_id = ? OR client_account_id = ?
        ORDER BY created_at DESC
        LIMIT 20
      `).bind(account.organization_id, account.id).all();
      response.recent_activity = activity.results;
    }

    return new Response(JSON.stringify({
      success: true,
      data: response
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Get client account error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch client account'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPatch(context) {
  const { params, env, request } = context;
  const { id } = params;

  try {
    const body = await request.json();
    const db = env.DB;

    // Verify account exists
    const existing = await db.prepare('SELECT id, organization_id FROM client_accounts WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client account not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Build update query
    const allowedFields = [
      'status', 'support_plan_tier', 'support_plan_status',
      'support_plan_started', 'support_plan_renews',
      'support_hours_included', 'support_hours_used',
      'stripe_subscription_id', 'stripe_subscription_status',
      'square_subscription_id', 'mrr', 'total_revenue',
      'health_score', 'health_trend', 'health_factors', 'churn_risk', 'nps_score',
      'service_lane', 'assigned_rep_id'
    ];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        if (field === 'health_factors' && typeof body[field] === 'object') {
          values.push(JSON.stringify(body[field]));
        } else {
          values.push(body[field]);
        }
      }
    }

    if (updates.length > 0) {
      values.push(id);
      await db.prepare(`
        UPDATE client_accounts SET ${updates.join(', ')}, updated_at = unixepoch() WHERE id = ?
      `).bind(...values).run();

      // Log significant changes
      if (body.status || body.support_plan_tier || body.health_score) {
        await db.prepare(`
          INSERT INTO unified_activity_log (
            id, organization_id, client_account_id, activity_type, title, description,
            performed_by_type, created_at
          ) VALUES (?, ?, ?, 'note_added', 'Account updated', ?, 'api', unixepoch())
        `).bind(
          'act_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
          existing.organization_id,
          id,
          JSON.stringify(Object.keys(body).filter(k => allowedFields.includes(k)))
        ).run();
      }
    }

    // Fetch updated account
    const result = await db.prepare(`
      SELECT ca.*, o.legal_name, o.dba_name
      FROM client_accounts ca
      JOIN organizations o ON ca.organization_id = o.id
      WHERE ca.id = ?
    `).bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Update client account error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update client account'
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
      'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
