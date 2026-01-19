/**
 * Prospects/Leads API for Intelligence Dashboard
 *
 * GET /api/admin/intelligence/prospects - List prospects from restaurant_leads
 *
 * This endpoint serves the Intelligence tab's prospects view by pulling from:
 * 1. restaurant_leads table (42,000+ leads from BuiltWith)
 * 2. clients table (converted leads)
 */

// CORS headers for admin APIs
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

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

    // Build query for restaurant_leads (main prospects source)
    // CRITICAL: Exclude existing clients, reps, and garbage data
    // Column mapping: name (company name), primary_email, primary_phone, website_url
    let query = `
      SELECT
        COALESCE(id, 'lead_' || CAST(rowid AS TEXT)) as id,
        name as company,
        COALESCE(dba_name, name, '') as name,
        primary_email as email,
        primary_phone as phone,
        website_url as website,
        -- Full address from address_line1 + address_line2
        CASE
          WHEN address_line2 IS NOT NULL AND address_line2 != ''
          THEN COALESCE(address_line1, '') || ', ' || address_line2
          ELSE address_line1
        END as address,
        city as town,
        state,
        zip,
        CASE
          WHEN city IN ('Provincetown', 'Truro', 'Wellfleet', 'Eastham') THEN 'Outer Cape'
          WHEN city IN ('Orleans', 'Chatham', 'Brewster', 'Harwich') THEN 'Lower Cape'
          WHEN city IN ('Dennis', 'Yarmouth', 'Barnstable', 'Hyannis') THEN 'Mid Cape'
          WHEN city IN ('Mashpee', 'Falmouth', 'Sandwich', 'Bourne') THEN 'Upper Cape'
          WHEN city IN ('Plymouth', 'Duxbury', 'Kingston', 'Marshfield', 'Scituate', 'Cohasset', 'Hingham', 'Weymouth', 'Braintree', 'Quincy') THEN 'South Shore'
          WHEN city IN ('Nantucket', 'Edgartown', 'Oak Bluffs', 'Vineyard Haven', 'West Tisbury', 'Chilmark', 'Aquinnah') THEN 'Islands'
          ELSE 'Other'
        END as region,
        cuisine_primary as category,
        current_pos as pos_system,
        COALESCE(service_style, '') as service_style,
        COALESCE(lead_score, 0) as lead_score,
        CASE
          WHEN lead_score >= 70 THEN 'lead'
          ELSE 'prospect'
        END as status,
        created_at,
        domain,
        hubspot_id,
        source,
        -- Business intelligence fields (use existing columns or placeholders)
        license_number,
        license_type,
        actual_seat_count as seating_capacity,
        health_score,
        last_inspection_date,
        online_ordering_provider as online_ordering,
        seasonal
      FROM restaurant_leads
      WHERE 1=1
        -- EXCLUDE existing clients
        AND NOT EXISTS (SELECT 1 FROM clients WHERE clients.email = restaurant_leads.primary_email)
        -- EXCLUDE Toast reps and other vendor emails
        AND (primary_email IS NULL OR (
          primary_email NOT LIKE '%@toasttab.com'
          AND primary_email NOT LIKE '%@squareup.com'
          AND primary_email NOT LIKE '%@clover.com'
          AND primary_email NOT LIKE '%@lightspeedhq.com'
          AND primary_email NOT LIKE '%@upserve.com'
          AND primary_email NOT LIKE '%@ncr.com'
        ))
        -- EXCLUDE garbage domains (directories, platforms, social media, tourism)
        AND (domain IS NULL OR (
          domain NOT LIKE '%reddit.com%'
          AND domain NOT LIKE '%assembly.com%'
          AND domain NOT LIKE '%rezi.%'
          AND domain NOT LIKE '%resy.com%'
          AND domain NOT LIKE '%facebook.com%'
          AND domain NOT LIKE '%instagram.com%'
          AND domain NOT LIKE '%twitter.com%'
          AND domain NOT LIKE '%linkedin.com%'
          AND domain NOT LIKE '%yelp.com%'
          AND domain NOT LIKE '%tripadvisor.com%'
          AND domain NOT LIKE '%google.com%'
          AND domain NOT LIKE '%bostonchefs.com%'
          AND domain NOT LIKE '%ptowntourism.com%'
          AND domain NOT LIKE '%ptownchamber.com%'
          AND domain NOT LIKE '%capecod.com%'
          AND domain NOT LIKE '%capecodchamber.org%'
          AND domain NOT LIKE '%larkhotels.com%'
          AND domain NOT LIKE '%opentable.com%'
          AND domain NOT LIKE '%doordash.com%'
          AND domain NOT LIKE '%grubhub.com%'
          AND domain NOT LIKE '%ubereats.com%'
          AND domain NOT LIKE '%seamless.com%'
          AND domain NOT LIKE '%timeout.com%'
          AND domain NOT LIKE '%eater.com%'
          AND domain NOT LIKE '%thrillist.com%'
          AND domain NOT LIKE '%patch.com%'
          AND domain NOT LIKE '%wickedlocal.com%'
          AND domain NOT LIKE '%capecodtimes.com%'
          AND domain NOT LIKE '%wikipedia.org%'
        ))
        -- EXCLUDE non-restaurant names (guides, lists, directories, generic)
        AND (name IS NULL OR (
          name NOT LIKE '%Reddit%'
          AND name NOT LIKE '%Assembly%'
          AND name NOT LIKE '%Rezi%'
          AND name NOT LIKE '%Resy%'
          AND name NOT LIKE '%Quincy%Adams%'
          AND name NOT LIKE 'Restaurants Near%'
          AND name NOT LIKE '%Restaurants in%'
          AND name NOT LIKE '%Year Round Restaurants%'
          AND name NOT LIKE '%Favorite%Restaurants%'
          AND name NOT LIKE '%Best%Restaurants%'
          AND name NOT LIKE '%Top%Restaurants%'
          AND name NOT LIKE '%Guide%'
          AND name NOT LIKE '%Winter Guide%'
          AND name NOT LIKE '%Visitor Guide%'
          AND name NOT LIKE 'Home'
          AND name NOT LIKE 'QUINCY'
          AND name NOT LIKE 'BOSTON'
          AND name NOT LIKE 'PLYMOUTH'
          AND name NOT LIKE '%bostonchefs%'
          AND name NOT LIKE '%&#8212;%'
          AND name NOT LIKE '%&#8211;%'
          AND name NOT LIKE '%&#%'
          AND name NOT LIKE '%Tourism%'
          AND name NOT LIKE '%Chamber%'
          AND name NOT LIKE '%Seafood, Brunch%'
          AND LENGTH(name) > 2
        ))
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

    // Region filter - Cape Cod sub-regions, South Shore, and Islands (NO BOSTON)
    if (region && region !== 'all') {
      // Map to Cape Cod sub-regions as defined in the demo prototype
      const regionMap = {
        // Cape Cod sub-regions
        'Outer Cape': "city IN ('Provincetown', 'Truro', 'Wellfleet', 'Eastham')",
        'Lower Cape': "city IN ('Orleans', 'Chatham', 'Brewster', 'Harwich')",
        'Mid Cape': "city IN ('Dennis', 'Yarmouth', 'Barnstable', 'Hyannis')",
        'Upper Cape': "city IN ('Mashpee', 'Falmouth', 'Sandwich', 'Bourne')",
        // All of Cape Cod
        'Cape Cod': "city IN ('Provincetown', 'Truro', 'Wellfleet', 'Eastham', 'Orleans', 'Chatham', 'Brewster', 'Harwich', 'Dennis', 'Yarmouth', 'Barnstable', 'Hyannis', 'Mashpee', 'Falmouth', 'Sandwich', 'Bourne')",
        // South Shore (IN service area)
        'South Shore': "city IN ('Plymouth', 'Duxbury', 'Kingston', 'Marshfield', 'Scituate', 'Cohasset', 'Hingham', 'Weymouth', 'Braintree', 'Quincy')",
        // Islands
        'Islands': "city IN ('Nantucket', 'Edgartown', 'Oak Bluffs', 'Vineyard Haven', 'West Tisbury', 'Chilmark', 'Aquinnah')",
      };

      if (regionMap[region]) {
        query += ` AND (${regionMap[region]})`;
      } else if (region.length === 2) {
        // State code - only allow MA
        if (region === 'MA') {
          query += ` AND state = ?`;
          params.push(region);
        }
      }
    }

    // POS filter
    if (posSystem && posSystem !== 'all') {
      query += ` AND LOWER(current_pos) LIKE ?`;
      params.push(`%${posSystem.toLowerCase()}%`);
    }

    // Status filter
    if (status && status !== 'all') {
      if (status === 'client') {
        query += ` AND EXISTS (SELECT 1 FROM clients WHERE clients.email = restaurant_leads.primary_email)`;
      } else if (status === 'lead') {
        query += ` AND lead_score >= 70 AND NOT EXISTS (SELECT 1 FROM clients WHERE clients.email = restaurant_leads.primary_email)`;
      } else if (status === 'prospect') {
        query += ` AND lead_score < 70 AND NOT EXISTS (SELECT 1 FROM clients WHERE clients.email = restaurant_leads.primary_email)`;
      }
    }

    // Ordering and pagination
    query += ` ORDER BY lead_score DESC, created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // Execute query
    const results = await env.DB.prepare(query).bind(...params).all();

    // Get total count for pagination (with same exclusion filters)
    let countQuery = `SELECT COUNT(*) as total FROM restaurant_leads WHERE 1=1
      -- EXCLUDE existing clients
      AND NOT EXISTS (SELECT 1 FROM clients WHERE clients.email = restaurant_leads.primary_email)
      -- EXCLUDE Toast reps and vendor emails
      AND (primary_email IS NULL OR (
        primary_email NOT LIKE '%@toasttab.com'
        AND primary_email NOT LIKE '%@squareup.com'
        AND primary_email NOT LIKE '%@clover.com'
        AND primary_email NOT LIKE '%@lightspeedhq.com'
        AND primary_email NOT LIKE '%@upserve.com'
        AND primary_email NOT LIKE '%@ncr.com'
      ))
      -- EXCLUDE garbage domains (directories, platforms, social media, tourism)
      AND (domain IS NULL OR (
        domain NOT LIKE '%reddit.com%'
        AND domain NOT LIKE '%assembly.com%'
        AND domain NOT LIKE '%rezi.%'
        AND domain NOT LIKE '%resy.com%'
        AND domain NOT LIKE '%facebook.com%'
        AND domain NOT LIKE '%instagram.com%'
        AND domain NOT LIKE '%twitter.com%'
        AND domain NOT LIKE '%linkedin.com%'
        AND domain NOT LIKE '%yelp.com%'
        AND domain NOT LIKE '%tripadvisor.com%'
        AND domain NOT LIKE '%google.com%'
        AND domain NOT LIKE '%bostonchefs.com%'
        AND domain NOT LIKE '%ptowntourism.com%'
        AND domain NOT LIKE '%ptownchamber.com%'
        AND domain NOT LIKE '%capecod.com%'
        AND domain NOT LIKE '%capecodchamber.org%'
        AND domain NOT LIKE '%larkhotels.com%'
        AND domain NOT LIKE '%opentable.com%'
        AND domain NOT LIKE '%doordash.com%'
        AND domain NOT LIKE '%grubhub.com%'
        AND domain NOT LIKE '%ubereats.com%'
        AND domain NOT LIKE '%seamless.com%'
        AND domain NOT LIKE '%timeout.com%'
        AND domain NOT LIKE '%eater.com%'
        AND domain NOT LIKE '%thrillist.com%'
        AND domain NOT LIKE '%patch.com%'
        AND domain NOT LIKE '%wickedlocal.com%'
        AND domain NOT LIKE '%capecodtimes.com%'
        AND domain NOT LIKE '%wikipedia.org%'
      ))
      -- EXCLUDE non-restaurant names (guides, lists, directories, generic)
      AND (name IS NULL OR (
        name NOT LIKE '%Reddit%'
        AND name NOT LIKE '%Assembly%'
        AND name NOT LIKE '%Rezi%'
        AND name NOT LIKE '%Resy%'
        AND name NOT LIKE '%Quincy%Adams%'
        AND name NOT LIKE 'Restaurants Near%'
        AND name NOT LIKE '%Restaurants in%'
        AND name NOT LIKE '%Year Round Restaurants%'
        AND name NOT LIKE '%Favorite%Restaurants%'
        AND name NOT LIKE '%Best%Restaurants%'
        AND name NOT LIKE '%Top%Restaurants%'
        AND name NOT LIKE '%Guide%'
        AND name NOT LIKE '%Winter Guide%'
        AND name NOT LIKE '%Visitor Guide%'
        AND name NOT LIKE 'Home'
        AND name NOT LIKE 'QUINCY'
        AND name NOT LIKE 'BOSTON'
        AND name NOT LIKE 'PLYMOUTH'
        AND name NOT LIKE '%bostonchefs%'
        AND name NOT LIKE '%&#8212;%'
        AND name NOT LIKE '%&#8211;%'
        AND name NOT LIKE '%&#%'
        AND name NOT LIKE '%Tourism%'
        AND name NOT LIKE '%Chamber%'
        AND name NOT LIKE '%Seafood, Brunch%'
        AND LENGTH(name) > 2
      ))`;
    const countParams = [];

    if (search) {
      countQuery += ` AND (name LIKE ? OR dba_name LIKE ? OR primary_email LIKE ? OR city LIKE ?)`;
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

    // Transform results to match UI expected format (matching demo prototype)
    const prospects = (results.results || []).map((row, index) => ({
      id: row.id || `lead_${index}`,
      name: row.name || 'Unknown Contact',
      company: row.company || 'Unknown Company',
      email: row.email || '',
      phone: row.phone || null,
      website: row.website || null,
      // Location fields
      address: row.address || null,
      town: row.town || null,
      state: row.state || 'MA',
      zip: row.zip || null,
      region: row.region || 'Other',
      // Business classification
      category: row.category || null,
      service_style: row.service_style || null,
      seasonal: row.seasonal === 1 || row.seasonal === true,
      // Technology
      pos_system: row.pos_system || 'Unknown',
      online_ordering: row.online_ordering || null,
      // Licensure & Compliance (from demo prototype)
      license_number: row.license_number || null,
      license_type: row.license_type || null,
      seating_capacity: row.seating_capacity || null,
      // Health & Safety
      health_score: row.health_score || null,
      last_inspection_date: row.last_inspection_date || null,
      // Scoring & Status
      lead_score: row.lead_score || 50,
      status: row.status || 'prospect',
      // Metadata
      domain: row.domain || null,
      hubspot_id: row.hubspot_id || null,
      source: row.source || null,
      created_at: row.created_at || Date.now(),
      // Placeholder for future enrichment
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
