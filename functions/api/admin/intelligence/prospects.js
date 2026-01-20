/**
 * Prospects/Leads API for Intelligence Dashboard
 *
 * GET /api/admin/intelligence/prospects - List prospects from cape_cod_restaurants
 *
 * Data Source: cape_cod_restaurants table (clean, validated Cape Cod restaurant directory)
 * Service Area: Cape Cod ONLY (15 towns - Outer/Lower/Mid/Upper Cape)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Cape Cod regions - the 15 towns ONLY
const CAPE_COD_REGIONS = {
  'Outer Cape': ['Provincetown', 'Truro', 'Wellfleet', 'Eastham'],
  'Lower Cape': ['Orleans', 'Chatham', 'Brewster', 'Harwich'],
  'Mid Cape': ['Dennis', 'Yarmouth', 'Barnstable'],
  'Upper Cape': ['Mashpee', 'Falmouth', 'Sandwich', 'Bourne'],
};

// All Cape Cod towns (flat list for validation)
const CAPE_COD_TOWNS = Object.values(CAPE_COD_REGIONS).flat();

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const region = url.searchParams.get('region');
    const posSystem = url.searchParams.get('pos');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Query the CLEAN cape_cod_restaurants table
    let query = `
      SELECT
        id,
        name,
        dba_name,
        address,
        village,
        town,
        region,
        state,
        zip,
        phone,
        email,
        website,
        type,
        cuisine_primary,
        cuisine_secondary,
        service_style,
        price_level,
        seasonal,
        pos_system,
        pos_confidence,
        online_ordering,
        online_ordering_url,
        license_number,
        license_type,
        seating_capacity,
        health_score,
        last_inspection_date,
        rating,
        review_count,
        description,
        data_source,
        data_confidence,
        created_at,
        updated_at
      FROM cape_cod_restaurants
      WHERE 1=1
    `;
    const params = [];

    // Search filter
    if (search) {
      query += ` AND (
        name LIKE ? OR
        dba_name LIKE ? OR
        town LIKE ? OR
        type LIKE ? OR
        cuisine_primary LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Region filter - only Cape Cod regions
    if (region && region !== 'all') {
      if (CAPE_COD_REGIONS[region]) {
        const regionTowns = CAPE_COD_REGIONS[region];
        const placeholders = regionTowns.map(() => '?').join(', ');
        query += ` AND town IN (${placeholders})`;
        params.push(...regionTowns);
      } else {
        // Direct region match
        query += ` AND region = ?`;
        params.push(region);
      }
    }

    // POS filter
    if (posSystem && posSystem !== 'all') {
      if (posSystem.toLowerCase() === 'unknown') {
        query += ` AND (pos_system IS NULL OR pos_system = 'Unknown' OR pos_system = '')`;
      } else {
        query += ` AND LOWER(pos_system) LIKE ?`;
        params.push(`%${posSystem.toLowerCase()}%`);
      }
    }

    // Status filter (based on data completeness for now)
    if (status && status !== 'all') {
      if (status === 'lead') {
        // Leads have more complete data (email or phone or website)
        query += ` AND (email IS NOT NULL OR phone IS NOT NULL OR website IS NOT NULL)`;
      } else if (status === 'prospect') {
        // Prospects have less data
        query += ` AND (email IS NULL AND phone IS NULL AND website IS NULL)`;
      }
    }

    // Ordering and pagination
    query += ` ORDER BY
      CASE WHEN pos_system IS NOT NULL AND pos_system != 'Unknown' THEN 0 ELSE 1 END,
      CASE WHEN email IS NOT NULL THEN 0 ELSE 1 END,
      name ASC
      LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // Execute query
    const results = await env.DB.prepare(query).bind(...params).all();

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM cape_cod_restaurants WHERE 1=1`;
    const countParams = [];

    if (search) {
      countQuery += ` AND (name LIKE ? OR dba_name LIKE ? OR town LIKE ? OR type LIKE ? OR cuisine_primary LIKE ?)`;
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (region && region !== 'all') {
      if (CAPE_COD_REGIONS[region]) {
        const regionTowns = CAPE_COD_REGIONS[region];
        const placeholders = regionTowns.map(() => '?').join(', ');
        countQuery += ` AND town IN (${placeholders})`;
        countParams.push(...regionTowns);
      } else {
        countQuery += ` AND region = ?`;
        countParams.push(region);
      }
    }

    if (posSystem && posSystem !== 'all') {
      if (posSystem.toLowerCase() === 'unknown') {
        countQuery += ` AND (pos_system IS NULL OR pos_system = 'Unknown' OR pos_system = '')`;
      } else {
        countQuery += ` AND LOWER(pos_system) LIKE ?`;
        countParams.push(`%${posSystem.toLowerCase()}%`);
      }
    }

    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

    // Transform results for the UI
    const prospects = (results.results || []).map((row) => {
      // Calculate a simple lead score based on data completeness
      let leadScore = 50;
      if (row.email) leadScore += 15;
      if (row.phone) leadScore += 10;
      if (row.website) leadScore += 10;
      if (row.pos_system && row.pos_system !== 'Unknown') leadScore += 10;
      if (row.pos_system === 'Toast') leadScore += 5; // Bonus for Toast users

      return {
        id: row.id,
        name: row.dba_name || row.name,
        company: row.name,
        email: row.email || '',
        phone: row.phone || null,
        website: row.website || null,
        address: row.address || null,
        town: row.town || null,
        state: row.state || 'MA',
        zip: row.zip || null,
        region: row.region || null,
        category: row.type || row.cuisine_primary || null,
        service_style: row.service_style || null,
        seasonal: row.seasonal === 1,
        pos_system: row.pos_system || 'Unknown',
        online_ordering: row.online_ordering || null,
        license_number: row.license_number || null,
        license_type: row.license_type || null,
        seating_capacity: row.seating_capacity || null,
        health_score: row.health_score || null,
        last_inspection_date: row.last_inspection_date || null,
        lead_score: Math.min(100, leadScore),
        status: leadScore >= 70 ? 'lead' : 'prospect',
        domain: row.website ? new URL(row.website).hostname : null,
        source: row.data_source || 'directory',
        created_at: row.created_at || Date.now(),
        rating: row.rating || null,
        review_count: row.review_count || null,
        description: row.description || null,
        tags: [],
        notes: null,
      };
    });

    return new Response(JSON.stringify({
      success: true,
      data: prospects,
      total: countResult?.total || 0,
      limit,
      offset,
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Prospects API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      hint: 'If cape_cod_restaurants table does not exist, run migration 0044a first'
    }), { status: 500, headers: corsHeaders });
  }
}
