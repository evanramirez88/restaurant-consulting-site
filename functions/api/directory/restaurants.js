/**
 * Cape Cod Restaurant Directory API
 *
 * GET /api/directory/restaurants - List all restaurants with filtering
 * GET /api/directory/restaurants?id=xxx - Get single restaurant with details
 * POST /api/directory/restaurants - Create new restaurant (validated)
 * PUT /api/directory/restaurants - Update restaurant
 * DELETE /api/directory/restaurants?id=xxx - Remove restaurant
 *
 * Integrated with validation pipeline - rejects invalid data at import time
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Town to region mapping
const TOWN_REGION_MAP = {
  'Provincetown': 'Outer Cape',
  'Truro': 'Outer Cape',
  'Wellfleet': 'Outer Cape',
  'Eastham': 'Outer Cape',
  'Orleans': 'Lower Cape',
  'Chatham': 'Lower Cape',
  'Brewster': 'Lower Cape',
  'Harwich': 'Lower Cape',
  'Dennis': 'Mid Cape',
  'Yarmouth': 'Mid Cape',
  'Barnstable': 'Mid Cape',
  'Mashpee': 'Upper Cape',
  'Falmouth': 'Upper Cape',
  'Sandwich': 'Upper Cape',
  'Bourne': 'Upper Cape',
};

const VALID_TOWNS = Object.keys(TOWN_REGION_MAP);

// Generate unique ID
function generateId() {
  return 'ccr_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// GET - List restaurants or get single restaurant
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    // Single restaurant by ID
    const id = url.searchParams.get('id');
    if (id) {
      const restaurant = await env.DB.prepare(`
        SELECT * FROM cape_cod_restaurants WHERE id = ?
      `).bind(id).first();

      if (!restaurant) {
        return new Response(
          JSON.stringify({ success: false, error: 'Restaurant not found' }),
          { status: 404, headers: corsHeaders }
        );
      }

      // Get location history for this address
      const history = await env.DB.prepare(`
        SELECT * FROM restaurant_location_history
        WHERE address = ? AND town = ?
        ORDER BY period_start DESC
      `).bind(restaurant.address || '', restaurant.town).all();

      // Get public records links for this town
      const publicRecords = await env.DB.prepare(`
        SELECT * FROM public_records_links
        WHERE town = ? OR town IS NULL
        ORDER BY record_type
      `).bind(restaurant.town).all();

      return new Response(
        JSON.stringify({
          success: true,
          data: restaurant,
          location_history: history.results || [],
          public_records: publicRecords.results || [],
        }),
        { headers: corsHeaders }
      );
    }

    // List with filters
    const search = url.searchParams.get('search') || '';
    const town = url.searchParams.get('town');
    const region = url.searchParams.get('region');
    const type = url.searchParams.get('type');
    const pos = url.searchParams.get('pos');
    const seasonal = url.searchParams.get('seasonal');
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    let query = `SELECT * FROM cape_cod_restaurants WHERE 1=1`;
    const params = [];

    if (search) {
      query += ` AND (name LIKE ? OR description LIKE ? OR address LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (town) {
      query += ` AND town = ?`;
      params.push(town);
    }

    if (region) {
      query += ` AND region = ?`;
      params.push(region);
    }

    if (type) {
      query += ` AND type = ?`;
      params.push(type);
    }

    if (pos) {
      query += ` AND pos_system = ?`;
      params.push(pos);
    }

    if (seasonal === 'true') {
      query += ` AND seasonal = 1`;
    } else if (seasonal === 'false') {
      query += ` AND seasonal = 0`;
    }

    // Count total
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await env.DB.prepare(countQuery).bind(...params).first();

    // Add ordering and pagination
    query += ` ORDER BY name ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const results = await env.DB.prepare(query).bind(...params).all();

    // Get aggregated stats
    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN seasonal = 1 THEN 1 END) as seasonal_count,
        COUNT(DISTINCT town) as towns_count,
        COUNT(DISTINCT region) as regions_count,
        COUNT(CASE WHEN pos_system IS NOT NULL AND pos_system != 'Unknown' THEN 1 END) as known_pos_count
      FROM cape_cod_restaurants
    `).first();

    // Get breakdown by region
    const regionBreakdown = await env.DB.prepare(`
      SELECT region, COUNT(*) as count FROM cape_cod_restaurants GROUP BY region ORDER BY region
    `).all();

    // Get breakdown by type
    const typeBreakdown = await env.DB.prepare(`
      SELECT type, COUNT(*) as count FROM cape_cod_restaurants WHERE type IS NOT NULL GROUP BY type ORDER BY count DESC LIMIT 10
    `).all();

    // Get breakdown by POS
    const posBreakdown = await env.DB.prepare(`
      SELECT pos_system, COUNT(*) as count FROM cape_cod_restaurants WHERE pos_system IS NOT NULL GROUP BY pos_system ORDER BY count DESC
    `).all();

    return new Response(
      JSON.stringify({
        success: true,
        data: results.results || [],
        total: countResult?.total || 0,
        limit,
        offset,
        stats: {
          ...stats,
          by_region: Object.fromEntries((regionBreakdown.results || []).map(r => [r.region, r.count])),
          by_type: Object.fromEntries((typeBreakdown.results || []).map(r => [r.type, r.count])),
          by_pos: Object.fromEntries((posBreakdown.results || []).map(r => [r.pos_system, r.count])),
        },
      }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Directory API error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST - Create new restaurant
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const {
      name, dba_name, domain, address, village, town, region, zip,
      latitude, longitude, type, cuisine_primary, cuisine_secondary,
      service_style, price_level, seasonal, season_open, hours_json,
      phone, email, website, socials, online_ordering, online_ordering_url,
      pos_system, pos_confidence, license_number, license_type, license_expiry,
      seating_capacity, health_score, last_inspection_date, health_violations_count,
      rating, review_count, estimated_revenue, employee_count,
      description, notable_features, data_source
    } = body;

    // Validation: Required fields
    if (!name || !town) {
      return new Response(
        JSON.stringify({ success: false, error: 'name and town are required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validation: Town must be valid Cape Cod town
    if (!VALID_TOWNS.includes(town)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid town "${town}". Must be one of: ${VALID_TOWNS.join(', ')}`,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Auto-assign region if not provided
    const finalRegion = region || TOWN_REGION_MAP[town];

    // Check for duplicate
    const existing = await env.DB.prepare(`
      SELECT id FROM cape_cod_restaurants WHERE name = ? AND town = ?
    `).bind(name, town).first();

    if (existing) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Restaurant "${name}" already exists in ${town}`,
          existing_id: existing.id,
        }),
        { status: 409, headers: corsHeaders }
      );
    }

    const id = generateId();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(`
      INSERT INTO cape_cod_restaurants (
        id, name, dba_name, domain, address, village, town, region, state, zip,
        latitude, longitude, type, cuisine_primary, cuisine_secondary,
        service_style, price_level, seasonal, season_open, hours_json,
        phone, email, website, socials, online_ordering, online_ordering_url,
        pos_system, pos_confidence, pos_detected_at, license_number, license_type,
        license_expiry, seating_capacity, health_score, last_inspection_date,
        health_violations_count, rating, review_count, estimated_revenue,
        employee_count, description, notable_features, data_source,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, 'MA', ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `).bind(
      id, name, dba_name || null, domain || null, address || null, village || null, town, finalRegion, zip || null,
      latitude || null, longitude || null, type || null, cuisine_primary || null, cuisine_secondary || null,
      service_style || null, price_level || null, seasonal ? 1 : 0, season_open || null, hours_json || null,
      phone || null, email || null, website || null, socials || null, online_ordering || null, online_ordering_url || null,
      pos_system || null, pos_confidence || null, pos_system ? now : null, license_number || null, license_type || null,
      license_expiry || null, seating_capacity || null, health_score || null, last_inspection_date || null,
      health_violations_count || null, rating || null, review_count || null, estimated_revenue || null,
      employee_count || null, description || null, notable_features || null, data_source || 'manual',
      now, now
    ).run();

    return new Response(
      JSON.stringify({ success: true, id, message: 'Restaurant created successfully' }),
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Create restaurant error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// PUT - Update restaurant
export async function onRequestPut(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: 'id is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check exists
    const existing = await env.DB.prepare(`
      SELECT * FROM cape_cod_restaurants WHERE id = ?
    `).bind(id).first();

    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, error: 'Restaurant not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Validate town if being updated
    if (updates.town && !VALID_TOWNS.includes(updates.town)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid town "${updates.town}". Must be one of: ${VALID_TOWNS.join(', ')}`,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Build update query dynamically
    const allowedFields = [
      'name', 'dba_name', 'domain', 'address', 'village', 'town', 'region', 'zip',
      'latitude', 'longitude', 'type', 'cuisine_primary', 'cuisine_secondary',
      'service_style', 'price_level', 'seasonal', 'season_open', 'hours_json',
      'phone', 'email', 'website', 'socials', 'online_ordering', 'online_ordering_url',
      'pos_system', 'pos_confidence', 'license_number', 'license_type', 'license_expiry',
      'seating_capacity', 'health_score', 'last_inspection_date', 'health_violations_count',
      'rating', 'review_count', 'estimated_revenue', 'employee_count',
      'description', 'notable_features', 'data_source', 'last_verified_at', 'last_enriched_at'
    ];

    const setClauses = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (setClauses.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No valid fields to update' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Always update updated_at
    setClauses.push('updated_at = ?');
    params.push(Math.floor(Date.now() / 1000));

    // Add id for WHERE clause
    params.push(id);

    await env.DB.prepare(`
      UPDATE cape_cod_restaurants SET ${setClauses.join(', ')} WHERE id = ?
    `).bind(...params).run();

    return new Response(
      JSON.stringify({ success: true, message: 'Restaurant updated successfully' }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Update restaurant error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE - Remove restaurant
export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return new Response(
      JSON.stringify({ success: false, error: 'id is required' }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    // Check exists
    const existing = await env.DB.prepare(`
      SELECT * FROM cape_cod_restaurants WHERE id = ?
    `).bind(id).first();

    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, error: 'Restaurant not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Delete (location history references will remain for historical record)
    await env.DB.prepare(`
      DELETE FROM cape_cod_restaurants WHERE id = ?
    `).bind(id).run();

    return new Response(
      JSON.stringify({ success: true, message: 'Restaurant deleted successfully' }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Delete restaurant error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
