/**
 * Prospects/Leads API for Intelligence Dashboard
 *
 * GET /api/admin/intelligence/prospects - List prospects from restaurant_leads
 *
 * Data Source: restaurant_leads table (cleaned, validated restaurant prospects)
 * Service Area: Cape Cod (Outer/Lower/Mid/Upper), South Shore, Islands
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Service area regions - Cape Cod sub-regions, South Shore, Islands
const SERVICE_REGIONS = {
  'Outer Cape': ['Provincetown', 'Truro', 'Wellfleet', 'Eastham'],
  'Lower Cape': ['Orleans', 'Chatham', 'Brewster', 'Harwich'],
  'Mid Cape': ['Dennis', 'Yarmouth', 'Barnstable', 'Hyannis'],
  'Upper Cape': ['Mashpee', 'Falmouth', 'Sandwich', 'Bourne'],
  'South Shore': ['Plymouth', 'Duxbury', 'Kingston', 'Wareham'],
  'Islands': ['Nantucket', 'Edgartown', 'Oak Bluffs', 'Vineyard Haven'],
};

// Get region from city
function getRegion(city) {
  if (!city) return 'Other';
  for (const [region, cities] of Object.entries(SERVICE_REGIONS)) {
    if (cities.includes(city)) return region;
  }
  return 'Other';
}

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
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Simple, clean query - data validation happens on import, not query time
    let query = `
      SELECT
        COALESCE(id, 'lead_' || CAST(rowid AS TEXT)) as id,
        name as company,
        COALESCE(dba_name, name, '') as contact_name,
        primary_email as email,
        primary_phone as phone,
        website_url as website,
        COALESCE(address_line1, '') as address,
        city as town,
        state,
        zip,
        cuisine_primary as category,
        current_pos as pos_system,
        COALESCE(service_style, '') as service_style,
        COALESCE(lead_score, 50) as lead_score,
        created_at,
        domain,
        hubspot_id,
        source,
        license_number,
        license_type,
        actual_seat_count as seating_capacity,
        health_score,
        last_inspection_date,
        online_ordering_provider as online_ordering,
        seasonal
      FROM restaurant_leads
      WHERE 1=1
    `;
    const params = [];

    // Search filter
    if (search) {
      query += ` AND (
        name LIKE ? OR
        dba_name LIKE ? OR
        primary_email LIKE ? OR
        city LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Region filter
    if (region && region !== 'all') {
      const regionCities = SERVICE_REGIONS[region];
      if (regionCities) {
        const placeholders = regionCities.map(() => '?').join(', ');
        query += ` AND city IN (${placeholders})`;
        params.push(...regionCities);
      }
    }

    // POS filter
    if (posSystem && posSystem !== 'all') {
      query += ` AND LOWER(current_pos) LIKE ?`;
      params.push(`%${posSystem.toLowerCase()}%`);
    }

    // Status filter (based on lead_score)
    if (status && status !== 'all') {
      if (status === 'lead') {
        query += ` AND lead_score >= 70`;
      } else if (status === 'prospect') {
        query += ` AND lead_score < 70`;
      }
    }

    // Ordering and pagination
    query += ` ORDER BY lead_score DESC, created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // Execute query
    const results = await env.DB.prepare(query).bind(...params).all();

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM restaurant_leads WHERE 1=1`;
    const countParams = [];

    if (search) {
      countQuery += ` AND (name LIKE ? OR dba_name LIKE ? OR primary_email LIKE ? OR city LIKE ?)`;
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (region && region !== 'all' && SERVICE_REGIONS[region]) {
      const regionCities = SERVICE_REGIONS[region];
      const placeholders = regionCities.map(() => '?').join(', ');
      countQuery += ` AND city IN (${placeholders})`;
      countParams.push(...regionCities);
    }

    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

    // Transform results
    const prospects = (results.results || []).map((row) => ({
      id: row.id,
      name: row.contact_name || row.company,
      company: row.company || 'Unknown',
      email: row.email || '',
      phone: row.phone || null,
      website: row.website || row.domain ? `https://${row.domain}` : null,
      address: row.address || null,
      town: row.town || null,
      state: row.state || 'MA',
      zip: row.zip || null,
      region: getRegion(row.town),
      category: row.category || null,
      service_style: row.service_style || null,
      seasonal: row.seasonal === 1 || row.seasonal === true,
      pos_system: row.pos_system || 'Unknown',
      online_ordering: row.online_ordering || null,
      license_number: row.license_number || null,
      license_type: row.license_type || null,
      seating_capacity: row.seating_capacity || null,
      health_score: row.health_score || null,
      last_inspection_date: row.last_inspection_date || null,
      lead_score: row.lead_score || 50,
      status: row.lead_score >= 70 ? 'lead' : 'prospect',
      domain: row.domain || null,
      hubspot_id: row.hubspot_id || null,
      source: row.source || null,
      created_at: row.created_at || Date.now(),
      tags: [],
      notes: null,
      rating: null,
    }));

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
    }), { status: 500, headers: corsHeaders });
  }
}
