/**
 * Prospects/Leads API for Intelligence Dashboard
 *
 * GET /api/admin/intelligence/prospects - List Cape Cod prospects from restaurant_leads
 *
 * Data Source: restaurant_leads table, filtered to ONLY Cape Cod
 * Service Area: Cape Cod ONLY (15 towns + villages)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Cape Cod regions - the 15 towns + common villages/neighborhoods
const CAPE_COD_REGIONS = {
  'Outer Cape': ['Provincetown', 'Truro', 'North Truro', 'Wellfleet', 'Eastham', 'North Eastham'],
  'Lower Cape': ['Orleans', 'East Orleans', 'Chatham', 'West Chatham', 'Brewster', 'East Brewster', 'Harwich', 'Harwich Port', 'West Harwich', 'East Harwich'],
  'Mid Cape': ['Dennis', 'Dennis Port', 'West Dennis', 'East Dennis', 'Yarmouth', 'South Yarmouth', 'West Yarmouth', 'Yarmouth Port', 'Barnstable', 'Hyannis', 'Centerville', 'Osterville', 'Cotuit', 'Marstons Mills', 'West Barnstable', 'Cummaquid'],
  'Upper Cape': ['Mashpee', 'New Seabury', 'Popponesset', 'Falmouth', 'East Falmouth', 'West Falmouth', 'North Falmouth', 'Woods Hole', 'Sandwich', 'East Sandwich', 'Forestdale', 'Bourne', 'Buzzards Bay', 'Sagamore', 'Pocasset', 'Cataumet', 'Monument Beach'],
};

// All Cape Cod locations (flat list for filtering)
const CAPE_COD_LOCATIONS = Object.values(CAPE_COD_REGIONS).flat();

// Map a city/village to its region
function getRegionForCity(city) {
  if (!city) return null;
  const cityLower = city.toLowerCase().trim();
  for (const [region, towns] of Object.entries(CAPE_COD_REGIONS)) {
    if (towns.some(t => t.toLowerCase() === cityLower)) {
      return region;
    }
  }
  return null;
}

// Check if a name/source looks like garbage data
function isGarbageData(row) {
  const name = row.name || '';
  const website = row.website || '';  // Aliased from website_url in query
  const email = row.email || '';      // Aliased from primary_email in query

  // Exact garbage names to filter
  const garbageNames = [
    'resy',
    'home',
    'contact',
    'menu',
    'about',
    'best american restaurants',
  ];

  if (garbageNames.includes(name.toLowerCase().trim())) {
    return true;
  }

  // Pattern-based garbage detection
  const garbagePatterns = [
    /reddit\.com/i,
    /bostonchefs/i,
    /quora\.com/i,
    /tripadvisor/i,
    /yelp\.com/i,
    /chamber/i,
    /quicklink/i,
    /category/i,
    /favorite.*restaurant/i,
    /best.*restaurant/i,           // "Best restaurant in X"
    /restaurants.*&.*pubs/i,       // "Restaurants & Pubs"
    /restaurants.*guide/i,         // "Restaurants guide"
    /guide.*restaurants/i,         // "Winter Guide ~ Restaurants"
    /where.*to.*eat/i,
    /top.*\d+/i,
    /seafood.*brunch.*beyond/i,    // "Seafood, Brunch, and Beyond"
    /&#\d+;/,                      // HTML entities like &#8212;
    /™|®/,                         // Trademark symbols in scraped names
    /\.com$/i,                     // Names that are just domain names
    /\.net$/i,
    /\.org$/i,
  ];

  if (garbagePatterns.some(p => p.test(name))) {
    return true;
  }

  // Filter out directory/aggregator content
  if (name.includes('QuickLink') ||
      name.includes('Restaurants at ') ||
      name.toLowerCase().includes('winter guide') ||
      name.toLowerCase().includes('year round')) {
    return true;
  }

  // Filter out fake/placeholder emails
  if (email === 'user@domain.com' || email.includes('falmouthchamber')) {
    return true;
  }

  return false;
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
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Build dynamic IN clause for Cape Cod cities
    const cityPlaceholders = CAPE_COD_LOCATIONS.map(() => '?').join(', ');

    // Query restaurant_leads table with strict Cape Cod filtering
    let query = `
      SELECT
        id,
        name,
        dba_name,
        address_line1 as address,
        city,
        state,
        zip,
        primary_phone as phone,
        primary_email as email,
        website_url as website,
        cuisine_primary,
        cuisine_secondary,
        service_style,
        bar_program,
        menu_complexity,
        price_level,
        seasonal,
        current_pos as pos_system,
        current_pos_confidence as pos_confidence,
        online_ordering_provider as online_ordering,
        license_number,
        license_type,
        actual_seat_count as seating_capacity,
        health_score,
        last_inspection_date,
        lead_score,
        source,
        notes,
        tags,
        created_at,
        updated_at
      FROM restaurant_leads
      WHERE state = 'MA'
        AND city IN (${cityPlaceholders})
    `;
    const params = [...CAPE_COD_LOCATIONS];

    // Search filter
    if (search) {
      query += ` AND (
        name LIKE ? OR
        dba_name LIKE ? OR
        city LIKE ? OR
        cuisine_primary LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Region filter
    if (region && region !== 'all') {
      if (CAPE_COD_REGIONS[region]) {
        const regionTowns = CAPE_COD_REGIONS[region];
        const regionPlaceholders = regionTowns.map(() => '?').join(', ');
        query += ` AND city IN (${regionPlaceholders})`;
        params.push(...regionTowns);
      }
    }

    // POS filter
    if (posSystem && posSystem !== 'all') {
      if (posSystem.toLowerCase() === 'unknown') {
        query += ` AND (current_pos IS NULL OR current_pos = 'Unknown' OR current_pos = '')`;
      } else {
        query += ` AND LOWER(current_pos) LIKE ?`;
        params.push(`%${posSystem.toLowerCase()}%`);
      }
    }

    // Status filter (based on data completeness)
    if (status && status !== 'all') {
      if (status === 'lead') {
        // Leads have more complete data (email or phone or website)
        query += ` AND (primary_email IS NOT NULL OR primary_phone IS NOT NULL OR website_url IS NOT NULL)`;
      } else if (status === 'prospect') {
        // Prospects have less data
        query += ` AND (primary_email IS NULL AND primary_phone IS NULL AND website_url IS NULL)`;
      }
    }

    // Ordering: prioritize records with contact info and known POS
    query += ` ORDER BY
      CASE WHEN primary_email IS NOT NULL AND primary_email != '' THEN 0 ELSE 1 END,
      CASE WHEN current_pos IS NOT NULL AND current_pos != 'Unknown' AND current_pos != '' THEN 0 ELSE 1 END,
      CASE WHEN primary_phone IS NOT NULL THEN 0 ELSE 1 END,
      name ASC
      LIMIT ? OFFSET ?`;
    params.push(limit + 50, offset); // Fetch extra to account for filtering

    // Execute query
    const results = await env.DB.prepare(query).bind(...params).all();

    // Get total count (before garbage filtering)
    let countQuery = `SELECT COUNT(*) as total FROM restaurant_leads WHERE state = 'MA' AND city IN (${cityPlaceholders})`;
    const countParams = [...CAPE_COD_LOCATIONS];

    if (search) {
      countQuery += ` AND (name LIKE ? OR dba_name LIKE ? OR city LIKE ? OR cuisine_primary LIKE ?)`;
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (region && region !== 'all') {
      if (CAPE_COD_REGIONS[region]) {
        const regionTowns = CAPE_COD_REGIONS[region];
        const regionPlaceholders = regionTowns.map(() => '?').join(', ');
        countQuery += ` AND city IN (${regionPlaceholders})`;
        countParams.push(...regionTowns);
      }
    }

    if (posSystem && posSystem !== 'all') {
      if (posSystem.toLowerCase() === 'unknown') {
        countQuery += ` AND (current_pos IS NULL OR current_pos = 'Unknown' OR current_pos = '')`;
      } else {
        countQuery += ` AND LOWER(current_pos) LIKE ?`;
        countParams.push(`%${posSystem.toLowerCase()}%`);
      }
    }

    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

    // Transform results for the UI, filtering out garbage data
    const prospects = (results.results || [])
      .filter(row => !isGarbageData(row))
      .slice(0, limit)
      .map((row) => {
        // Calculate lead score if not present
        let leadScore = row.lead_score || 50;
        if (!row.lead_score) {
          if (row.email) leadScore += 15;
          if (row.phone) leadScore += 10;
          if (row.website) leadScore += 10;
          if (row.pos_system && row.pos_system !== 'Unknown') leadScore += 10;
          if (row.pos_system === 'Toast') leadScore += 5;
        }

        // Compute region from city
        const computedRegion = getRegionForCity(row.city);

        // Try to extract domain from website
        let domain = null;
        if (row.website) {
          try {
            domain = new URL(row.website).hostname;
          } catch (e) {
            // Invalid URL, skip domain extraction
          }
        }

        return {
          id: row.id,
          name: row.dba_name || row.name,
          company: row.name,
          email: row.email || '',
          phone: row.phone || null,
          website: row.website || null,
          address: row.address || null,
          town: row.city || null,
          state: row.state || 'MA',
          zip: row.zip || null,
          region: computedRegion,
          category: row.cuisine_primary || null,
          cuisine_secondary: row.cuisine_secondary || null,
          service_style: row.service_style || null,
          bar_program: row.bar_program || null,
          menu_complexity: row.menu_complexity || null,
          seasonal: row.seasonal === 1,
          pos_system: row.pos_system || 'Unknown',
          pos_confidence: row.pos_confidence || null,
          online_ordering: row.online_ordering || null,
          license_number: row.license_number || null,
          license_type: row.license_type || null,
          seating_capacity: row.seating_capacity || null,
          health_score: row.health_score || null,
          last_inspection_date: row.last_inspection_date || null,
          lead_score: Math.min(100, leadScore),
          status: leadScore >= 70 ? 'lead' : 'prospect',
          domain: domain,
          source: row.source || 'builtwith',
          created_at: row.created_at || Date.now(),
          tags: row.tags ? row.tags.split(',').map(t => t.trim()) : [],
          notes: row.notes || null,
        };
      });

    return new Response(JSON.stringify({
      success: true,
      data: prospects,
      total: countResult?.total || 0,
      limit,
      offset,
      service_area: 'Cape Cod (15 towns)',
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Prospects API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      hint: 'Check that restaurant_leads table exists and has Cape Cod data'
    }), { status: 500, headers: corsHeaders });
  }
}
