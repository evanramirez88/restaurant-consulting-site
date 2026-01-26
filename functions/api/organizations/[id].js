/**
 * Organization Detail API
 *
 * GET /api/organizations/:id - Get organization details
 * PATCH /api/organizations/:id - Update organization
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

/**
 * GET /api/organizations/:id
 * Get full organization details with related entities
 */
export async function onRequestGet(context) {
  const { params, env, request } = context;
  const { id } = params;
  const url = new URL(request.url);
  const include = url.searchParams.get('include')?.split(',') || [];

  try {
    const db = env.DB;

    // Get organization with primary contact and location
    const org = await db.prepare(`
      SELECT
        o.*,
        c.id as primary_contact_id,
        c.first_name,
        c.last_name,
        c.email as primary_email,
        c.phone as primary_phone,
        c.title as contact_title,
        c.role_type,
        c.portal_enabled,
        c.slug as contact_slug,
        l.id as primary_location_id,
        l.name as location_name,
        l.address_line1,
        l.address_line2,
        l.city,
        l.state,
        l.zip,
        l.phone as location_phone,
        l.website_url,
        l.pos_system,
        l.cuisine_primary,
        l.service_style,
        l.seating_capacity,
        ca.id as account_id,
        ca.status as account_status,
        ca.support_plan_tier,
        ca.support_plan_status,
        ca.support_plan_started,
        ca.support_plan_renews,
        ca.support_hours_used,
        ca.health_score,
        ca.health_trend,
        ca.churn_risk,
        ca.mrr,
        ca.total_revenue,
        ca.client_since
      FROM organizations o
      LEFT JOIN org_contacts c ON c.organization_id = o.id AND c.is_primary = 1
      LEFT JOIN locations l ON l.organization_id = o.id AND l.is_primary = 1
      LEFT JOIN client_accounts ca ON ca.organization_id = o.id
      WHERE o.id = ?
    `).bind(id).first();

    if (!org) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Organization not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Build response object
    const response = {
      id: org.id,
      legal_name: org.legal_name,
      dba_name: org.dba_name,
      slug: org.slug,
      entity_type: org.entity_type,
      industry: org.industry,
      lifecycle_stage: org.lifecycle_stage,
      lifecycle_changed_at: org.lifecycle_changed_at,
      source: org.source,
      source_id: org.source_id,
      hubspot_company_id: org.hubspot_company_id,
      stripe_customer_id: org.stripe_customer_id,
      square_customer_id: org.square_customer_id,
      tags: org.tags ? JSON.parse(org.tags) : [],
      notes: org.notes,
      created_at: org.created_at,
      updated_at: org.updated_at,
      // Nested primary contact
      primary_contact: org.primary_contact_id ? {
        id: org.primary_contact_id,
        first_name: org.first_name,
        last_name: org.last_name,
        email: org.primary_email,
        phone: org.primary_phone,
        title: org.contact_title,
        role_type: org.role_type,
        portal_enabled: Boolean(org.portal_enabled),
        slug: org.contact_slug
      } : null,
      // Nested primary location
      primary_location: org.primary_location_id ? {
        id: org.primary_location_id,
        name: org.location_name,
        address_line1: org.address_line1,
        address_line2: org.address_line2,
        city: org.city,
        state: org.state,
        zip: org.zip,
        phone: org.location_phone,
        website_url: org.website_url,
        pos_system: org.pos_system,
        cuisine_primary: org.cuisine_primary,
        service_style: org.service_style,
        seating_capacity: org.seating_capacity
      } : null,
      // Nested client account (if exists)
      client_account: org.account_id ? {
        id: org.account_id,
        status: org.account_status,
        support_plan_tier: org.support_plan_tier,
        support_plan_status: org.support_plan_status,
        support_plan_started: org.support_plan_started,
        support_plan_renews: org.support_plan_renews,
        support_hours_used: org.support_hours_used,
        health_score: org.health_score,
        health_trend: org.health_trend,
        churn_risk: org.churn_risk,
        mrr: org.mrr,
        total_revenue: org.total_revenue,
        client_since: org.client_since
      } : null
    };

    // Include additional data if requested
    if (include.includes('contacts')) {
      const contacts = await db.prepare(`
        SELECT * FROM org_contacts WHERE organization_id = ? ORDER BY is_primary DESC, created_at ASC
      `).bind(id).all();
      response.contacts = contacts.results;
    }

    if (include.includes('locations')) {
      const locations = await db.prepare(`
        SELECT * FROM locations WHERE organization_id = ? ORDER BY is_primary DESC, created_at ASC
      `).bind(id).all();
      response.locations = locations.results;
    }

    if (include.includes('activity')) {
      const activity = await db.prepare(`
        SELECT * FROM unified_activity_log WHERE organization_id = ?
        ORDER BY created_at DESC LIMIT 20
      `).bind(id).all();
      response.recent_activity = activity.results;
    }

    if (include.includes('lifecycle')) {
      const transitions = await db.prepare(`
        SELECT * FROM lifecycle_transitions WHERE organization_id = ?
        ORDER BY created_at DESC LIMIT 10
      `).bind(id).all();
      response.lifecycle_history = transitions.results;
    }

    return new Response(JSON.stringify({
      success: true,
      data: response
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Get organization error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch organization'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * PATCH /api/organizations/:id
 * Update organization and optionally its related entities
 */
export async function onRequestPatch(context) {
  const { params, env, request } = context;
  const { id } = params;

  try {
    const body = await request.json();
    const db = env.DB;

    // Verify organization exists
    const existing = await db.prepare('SELECT id FROM organizations WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Organization not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Build update query dynamically
    const allowedFields = [
      'legal_name', 'dba_name', 'slug', 'entity_type', 'industry',
      'lifecycle_stage', 'source', 'source_id', 'source_campaign',
      'hubspot_company_id', 'stripe_customer_id', 'square_customer_id',
      'tags', 'notes'
    ];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        // Handle tags as JSON
        if (field === 'tags' && Array.isArray(body[field])) {
          values.push(JSON.stringify(body[field]));
        } else {
          values.push(body[field]);
        }
      }
    }

    if (updates.length > 0) {
      values.push(id);
      await db.prepare(`
        UPDATE organizations SET ${updates.join(', ')}, updated_at = unixepoch() WHERE id = ?
      `).bind(...values).run();

      // Log lifecycle stage change
      if (body.lifecycle_stage) {
        await db.prepare(`
          INSERT INTO unified_activity_log (
            id, organization_id, activity_type, title, description,
            performed_by_type, created_at
          ) VALUES (?, ?, 'stage_changed', 'Lifecycle stage updated', ?, 'api', unixepoch())
        `).bind(
          'act_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
          id,
          `Changed to: ${body.lifecycle_stage}`
        ).run();
      }
    }

    // Update primary contact if provided
    if (body.primary_contact) {
      const pc = body.primary_contact;
      const contactFields = ['first_name', 'last_name', 'email', 'phone', 'title', 'role_type'];
      const contactUpdates = [];
      const contactValues = [];

      for (const field of contactFields) {
        if (pc[field] !== undefined) {
          contactUpdates.push(`${field} = ?`);
          contactValues.push(pc[field]);
        }
      }

      if (contactUpdates.length > 0) {
        contactValues.push(id);
        await db.prepare(`
          UPDATE org_contacts SET ${contactUpdates.join(', ')}, updated_at = unixepoch()
          WHERE organization_id = ? AND is_primary = 1
        `).bind(...contactValues).run();
      }
    }

    // Update primary location if provided
    if (body.primary_location) {
      const pl = body.primary_location;
      const locationFields = [
        'name', 'address_line1', 'address_line2', 'city', 'state', 'zip',
        'phone', 'email', 'website_url', 'pos_system', 'cuisine_primary',
        'service_style', 'seating_capacity', 'employee_count'
      ];
      const locationUpdates = [];
      const locationValues = [];

      for (const field of locationFields) {
        if (pl[field] !== undefined) {
          locationUpdates.push(`${field} = ?`);
          locationValues.push(pl[field]);
        }
      }

      if (locationUpdates.length > 0) {
        locationValues.push(id);
        await db.prepare(`
          UPDATE locations SET ${locationUpdates.join(', ')}, updated_at = unixepoch()
          WHERE organization_id = ? AND is_primary = 1
        `).bind(...locationValues).run();
      }
    }

    // Fetch updated organization
    const result = await db.prepare(`
      SELECT
        o.id, o.legal_name, o.dba_name, o.slug, o.lifecycle_stage,
        o.entity_type, o.source, o.updated_at,
        c.email as primary_email, c.phone as primary_phone,
        l.city, l.state, l.pos_system,
        ca.support_plan_tier, ca.health_score
      FROM organizations o
      LEFT JOIN org_contacts c ON c.organization_id = o.id AND c.is_primary = 1
      LEFT JOIN locations l ON l.organization_id = o.id AND l.is_primary = 1
      LEFT JOIN client_accounts ca ON ca.organization_id = o.id
      WHERE o.id = ?
    `).bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Update organization error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update organization'
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
      'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
