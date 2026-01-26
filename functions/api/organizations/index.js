/**
 * Organizations API
 *
 * GET /api/organizations - List organizations with filtering
 * POST /api/organizations - Create new organization
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

/**
 * GET /api/organizations
 * List organizations with optional filtering
 */
export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);

  // Query params
  const lifecycle = url.searchParams.get('lifecycle');
  const source = url.searchParams.get('source');
  const search = url.searchParams.get('search');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    const db = env.DB;

    // Build query with filters
    let whereConditions = ['1=1'];
    const params = [];

    if (lifecycle) {
      whereConditions.push('o.lifecycle_stage = ?');
      params.push(lifecycle);
    }

    if (source) {
      whereConditions.push('o.source = ?');
      params.push(source);
    }

    if (search) {
      whereConditions.push('(o.legal_name LIKE ? OR o.dba_name LIKE ? OR c.email LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    params.push(limit, offset);

    const query = `
      SELECT
        o.id,
        o.legal_name,
        o.dba_name,
        o.slug,
        o.lifecycle_stage,
        o.entity_type,
        o.source,
        o.tags,
        c.email as primary_email,
        c.phone as primary_phone,
        c.first_name,
        c.last_name,
        l.city,
        l.state,
        l.pos_system,
        ca.support_plan_tier,
        ca.support_plan_status,
        ca.health_score,
        o.created_at,
        o.updated_at
      FROM organizations o
      LEFT JOIN org_contacts c ON c.organization_id = o.id AND c.is_primary = 1
      LEFT JOIN locations l ON l.organization_id = o.id AND l.is_primary = 1
      LEFT JOIN client_accounts ca ON ca.organization_id = o.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY o.updated_at DESC
      LIMIT ? OFFSET ?
    `;

    const results = await db.prepare(query).bind(...params).all();

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM organizations o
      LEFT JOIN org_contacts c ON c.organization_id = o.id AND c.is_primary = 1
      WHERE ${whereConditions.join(' AND ')}
    `;
    const countParams = params.slice(0, -2); // Remove limit and offset
    const countResult = await db.prepare(countQuery).bind(...countParams).first();

    return new Response(JSON.stringify({
      success: true,
      data: results.results,
      pagination: {
        total: countResult.total,
        limit,
        offset,
        hasMore: offset + results.results.length < countResult.total
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Organizations list error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch organizations'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * POST /api/organizations
 * Create a new organization
 */
export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const body = await request.json();
    const db = env.DB;

    // Validate required fields
    if (!body.legal_name) {
      return new Response(JSON.stringify({
        success: false,
        error: 'legal_name is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Generate ID and slug
    const orgId = 'org_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const slug = body.slug || body.legal_name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Insert organization
    await db.prepare(`
      INSERT INTO organizations (
        id, legal_name, dba_name, slug, entity_type, lifecycle_stage,
        source, source_id, source_campaign, tags, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
    `).bind(
      orgId,
      body.legal_name,
      body.dba_name || null,
      slug,
      body.entity_type || 'single_location',
      body.lifecycle_stage || 'lead',
      body.source || 'manual',
      body.source_id || null,
      body.source_campaign || null,
      body.tags ? JSON.stringify(body.tags) : null,
      body.notes || null
    ).run();

    // If primary contact info provided, create contact
    if (body.primary_email || body.primary_phone) {
      const contactId = orgId + '_contact';
      await db.prepare(`
        INSERT INTO org_contacts (
          id, organization_id, first_name, last_name, email, phone,
          title, role_type, is_primary, is_decision_maker, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, unixepoch(), unixepoch())
      `).bind(
        contactId,
        orgId,
        body.first_name || null,
        body.last_name || null,
        body.primary_email || null,
        body.primary_phone || null,
        body.title || null,
        body.role_type || 'owner'
      ).run();
    }

    // If location info provided, create location
    if (body.address || body.city || body.state) {
      const locationId = orgId + '_loc';
      await db.prepare(`
        INSERT INTO locations (
          id, organization_id, name, address_line1, city, state, zip,
          phone, email, website_url, pos_system, is_primary, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active', unixepoch(), unixepoch())
      `).bind(
        locationId,
        orgId,
        body.legal_name,
        body.address || null,
        body.city || null,
        body.state || null,
        body.zip || null,
        body.primary_phone || null,
        body.primary_email || null,
        body.website_url || null,
        body.pos_system || null
      ).run();
    }

    // Log activity
    await db.prepare(`
      INSERT INTO unified_activity_log (
        id, organization_id, activity_type, title, description,
        performed_by_type, created_at
      ) VALUES (?, ?, 'stage_changed', 'Organization created', ?, 'system', unixepoch())
    `).bind(
      'act_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      orgId,
      `Created via API with lifecycle stage: ${body.lifecycle_stage || 'lead'}`
    ).run();

    // Fetch the created organization with joins
    const result = await db.prepare(`
      SELECT
        o.id, o.legal_name, o.dba_name, o.slug, o.lifecycle_stage,
        o.entity_type, o.source, o.created_at,
        c.email as primary_email, c.phone as primary_phone,
        l.city, l.state
      FROM organizations o
      LEFT JOIN org_contacts c ON c.organization_id = o.id AND c.is_primary = 1
      LEFT JOIN locations l ON l.organization_id = o.id AND l.is_primary = 1
      WHERE o.id = ?
    `).bind(orgId).first();

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 201,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Create organization error:', error);

    // Handle unique constraint violations
    if (error.message?.includes('UNIQUE constraint failed')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Organization with this slug already exists'
      }), {
        status: 409,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to create organization'
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
