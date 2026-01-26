/**
 * Organization Locations API
 *
 * GET /api/organizations/:id/locations - List locations
 * POST /api/organizations/:id/locations - Add location
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export async function onRequestGet(context) {
  const { params, env } = context;
  const { id } = params;

  try {
    const db = env.DB;

    const locations = await db.prepare(`
      SELECT * FROM locations
      WHERE organization_id = ?
      ORDER BY is_primary DESC, created_at ASC
    `).bind(id).all();

    return new Response(JSON.stringify({
      success: true,
      data: locations.results
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Get locations error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch locations'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPost(context) {
  const { params, env, request } = context;
  const { id } = params;

  try {
    const body = await request.json();
    const db = env.DB;

    // Verify organization exists
    const org = await db.prepare('SELECT id FROM organizations WHERE id = ?').bind(id).first();
    if (!org) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Organization not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    const locationId = 'loc_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);

    // If this is the first location or marked primary, update others
    if (body.is_primary) {
      await db.prepare(`
        UPDATE locations SET is_primary = 0 WHERE organization_id = ?
      `).bind(id).run();
    }

    // Check if this should be primary (first location)
    const existingCount = await db.prepare(`
      SELECT COUNT(*) as count FROM locations WHERE organization_id = ?
    `).bind(id).first();
    const isPrimary = body.is_primary || existingCount.count === 0 ? 1 : 0;

    await db.prepare(`
      INSERT INTO locations (
        id, organization_id, name, slug, address_line1, address_line2,
        city, state, zip, country, latitude, longitude,
        phone, email, website_url, cuisine_primary, cuisine_secondary,
        service_style, bar_program, menu_complexity, pos_system,
        seating_capacity, employee_count, price_level,
        estimated_annual_revenue, avg_check_size, is_primary, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', unixepoch(), unixepoch())
    `).bind(
      locationId,
      id,
      body.name || 'New Location',
      body.slug || null,
      body.address_line1 || null,
      body.address_line2 || null,
      body.city || null,
      body.state || null,
      body.zip || null,
      body.country || 'US',
      body.latitude || null,
      body.longitude || null,
      body.phone || null,
      body.email || null,
      body.website_url || null,
      body.cuisine_primary || null,
      body.cuisine_secondary || null,
      body.service_style || null,
      body.bar_program || null,
      body.menu_complexity || null,
      body.pos_system || null,
      body.seating_capacity || null,
      body.employee_count || null,
      body.price_level || null,
      body.estimated_annual_revenue || null,
      body.avg_check_size || null,
      isPrimary
    ).run();

    const location = await db.prepare('SELECT * FROM locations WHERE id = ?').bind(locationId).first();

    return new Response(JSON.stringify({
      success: true,
      data: location
    }), {
      status: 201,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Create location error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to create location'
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
