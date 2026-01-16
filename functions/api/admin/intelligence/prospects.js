/**
 * Prospects/Leads API for Intelligence Dashboard
 *
 * GET /api/admin/intelligence/prospects - List prospects from restaurant_leads
 *
 * This endpoint serves the Intelligence tab's prospects view by pulling from:
 * 1. restaurant_leads table (42,000+ leads from BuiltWith)
 * 2. clients table (converted leads)
 */

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
    let query = `
      SELECT
        id,
        company_name as company,
        COALESCE(contact_name, '') as name,
        email,
        phone,
        website,
        city as town,
        state as region,
        vertical as category,
        current_pos as pos_system,
        revenue_estimate,
        employee_estimate as employee_count,
        lead_score,
        CASE
          WHEN EXISTS (SELECT 1 FROM clients WHERE clients.email = restaurant_leads.email) THEN 'client'
          WHEN lead_score >= 70 THEN 'lead'
          ELSE 'prospect'
        END as status,
        created_at
      FROM restaurant_leads
      WHERE 1=1
    `;
    const params = [];

    // Search filter
    if (search) {
      query += ` AND (
        company_name LIKE ? OR
        contact_name LIKE ? OR
        email LIKE ? OR
        city LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Region filter (using state)
    if (region && region !== 'all') {
      // Map friendly names to state codes or patterns
      const regionMap = {
        'Cape Cod': "city LIKE '%cape%' OR city IN ('Hyannis', 'Sandwich', 'Provincetown', 'Chatham', 'Falmouth', 'Barnstable', 'Dennis', 'Yarmouth', 'Brewster', 'Orleans', 'Eastham', 'Wellfleet', 'Truro')",
        'South Shore': "city IN ('Plymouth', 'Quincy', 'Weymouth', 'Braintree', 'Marshfield', 'Scituate', 'Duxbury', 'Kingston')",
        'Boston': "city IN ('Boston', 'Cambridge', 'Somerville', 'Brookline', 'Newton', 'Allston', 'Brighton')",
        'Islands': "city IN ('Nantucket', 'Martha''s Vineyard', 'Edgartown', 'Oak Bluffs', 'Vineyard Haven')",
      };

      if (regionMap[region]) {
        query += ` AND (${regionMap[region]})`;
      } else if (region.length === 2) {
        // Assume state code
        query += ` AND state = ?`;
        params.push(region);
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
        query += ` AND EXISTS (SELECT 1 FROM clients WHERE clients.email = restaurant_leads.email)`;
      } else if (status === 'lead') {
        query += ` AND lead_score >= 70 AND NOT EXISTS (SELECT 1 FROM clients WHERE clients.email = restaurant_leads.email)`;
      } else if (status === 'prospect') {
        query += ` AND lead_score < 70 AND NOT EXISTS (SELECT 1 FROM clients WHERE clients.email = restaurant_leads.email)`;
      }
    }

    // Ordering and pagination
    query += ` ORDER BY lead_score DESC, created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // Execute query
    const results = await env.DB.prepare(query).bind(...params).all();

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM restaurant_leads WHERE 1=1';
    const countParams = [];

    if (search) {
      countQuery += ` AND (company_name LIKE ? OR contact_name LIKE ? OR email LIKE ? OR city LIKE ?)`;
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

    // Transform results to match UI expected format
    const prospects = (results.results || []).map((row, index) => ({
      id: row.id || `lead_${index}`,
      name: row.name || 'Unknown Contact',
      company: row.company || 'Unknown Company',
      email: row.email || '',
      phone: row.phone || null,
      website: row.website || null,
      town: row.town || null,
      region: row.region || null,
      category: row.category || null,
      pos_system: row.pos_system || 'Unknown',
      revenue_estimate: row.revenue_estimate || null,
      employee_count: row.employee_count || null,
      seasonal: false,
      rating: null,
      lead_score: row.lead_score || 50,
      status: row.status || 'prospect',
      tags: [],
      notes: null,
      created_at: row.created_at || Date.now(),
    }));

    return Response.json({
      success: true,
      data: prospects,
      total: countResult?.total || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Prospects API error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
