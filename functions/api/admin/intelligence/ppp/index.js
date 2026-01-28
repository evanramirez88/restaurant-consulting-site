/**
 * P-P-P (Problem-Pain-Priority) Prospect Research API
 * 
 * GET /api/admin/intelligence/ppp - List prospects with P-P-P scores
 * POST /api/admin/intelligence/ppp - Batch update P-P-P scores (future)
 * 
 * Supports:
 * - Priority queue view (sorted by composite score)
 * - Filtering by scored/unscored
 * - Cape Cod region filtering
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Cape Cod regions for filtering
const CAPE_COD_REGIONS = {
  'Outer Cape': ['Provincetown', 'Truro', 'North Truro', 'Wellfleet', 'Eastham', 'North Eastham'],
  'Lower Cape': ['Orleans', 'East Orleans', 'Chatham', 'West Chatham', 'Brewster', 'East Brewster', 'Harwich', 'Harwich Port', 'West Harwich', 'East Harwich'],
  'Mid Cape': ['Dennis', 'Dennis Port', 'West Dennis', 'East Dennis', 'Yarmouth', 'South Yarmouth', 'West Yarmouth', 'Yarmouth Port', 'Barnstable', 'Hyannis', 'Centerville', 'Osterville', 'Cotuit', 'Marstons Mills', 'West Barnstable', 'Cummaquid'],
  'Upper Cape': ['Mashpee', 'New Seabury', 'Popponesset', 'Falmouth', 'East Falmouth', 'West Falmouth', 'North Falmouth', 'Woods Hole', 'Sandwich', 'East Sandwich', 'Forestdale', 'Bourne', 'Buzzards Bay', 'Sagamore', 'Pocasset', 'Cataumet', 'Monument Beach'],
};
const CAPE_COD_LOCATIONS = Object.values(CAPE_COD_REGIONS).flat();

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

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    
    // Query params
    const search = url.searchParams.get('search') || '';
    const region = url.searchParams.get('region');
    const posSystem = url.searchParams.get('pos');
    const status = url.searchParams.get('status');
    const scoredOnly = url.searchParams.get('scoredOnly') === 'true';
    const unscoredOnly = url.searchParams.get('unscoredOnly') === 'true';
    const minComposite = parseInt(url.searchParams.get('minComposite') || '0', 10);
    const sortBy = url.searchParams.get('sortBy') || 'composite';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Build Cape Cod filter
    const cityPlaceholders = CAPE_COD_LOCATIONS.map(() => '?').join(', ');

    let query = `
      SELECT
        id,
        name,
        dba_name,
        domain,
        address_line1,
        city,
        state,
        zip,
        primary_phone,
        primary_email,
        website_url,
        cuisine_primary,
        service_style,
        current_pos,
        current_pos_confidence,
        status,
        lead_score,
        segment,
        ppp_problem_score,
        ppp_pain_score,
        ppp_priority_score,
        ppp_composite_score,
        ppp_last_scored_at,
        ppp_scored_by,
        research_problem_description,
        research_pain_symptoms,
        research_priority_signals,
        research_notes,
        research_web_data,
        research_last_updated_at,
        created_at,
        updated_at
      FROM restaurant_leads
      WHERE state = 'MA'
        AND city IN (${cityPlaceholders})
    `;
    const params = [...CAPE_COD_LOCATIONS];

    // Search filter
    if (search) {
      query += ` AND (name LIKE ? OR dba_name LIKE ? OR city LIKE ? OR domain LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Region filter
    if (region && region !== 'all' && CAPE_COD_REGIONS[region]) {
      const regionTowns = CAPE_COD_REGIONS[region];
      const regionPlaceholders = regionTowns.map(() => '?').join(', ');
      query += ` AND city IN (${regionPlaceholders})`;
      params.push(...regionTowns);
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

    // Status filter
    if (status && status !== 'all') {
      query += ` AND status = ?`;
      params.push(status);
    }

    // Scored/unscored filter
    if (scoredOnly) {
      query += ` AND ppp_composite_score IS NOT NULL`;
    } else if (unscoredOnly) {
      query += ` AND ppp_composite_score IS NULL`;
    }

    // Min composite filter
    if (minComposite > 0) {
      query += ` AND ppp_composite_score >= ?`;
      params.push(minComposite);
    }

    // Sorting
    const sortColumn = {
      composite: 'ppp_composite_score',
      problem: 'ppp_problem_score',
      pain: 'ppp_pain_score',
      priority: 'ppp_priority_score',
      leadScore: 'lead_score',
      updated: 'updated_at',
    }[sortBy] || 'ppp_composite_score';

    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
    
    // For composite score, put unscored at bottom when sorting desc
    if (sortBy === 'composite' && sortOrder === 'desc') {
      query += ` ORDER BY CASE WHEN ppp_composite_score IS NULL THEN 1 ELSE 0 END, ${sortColumn} ${order}`;
    } else {
      query += ` ORDER BY ${sortColumn} ${order} NULLS LAST`;
    }

    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // Execute query
    const results = await env.DB.prepare(query).bind(...params).all();

    // Get stats
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(ppp_composite_score) as scored,
        COUNT(*) - COUNT(ppp_composite_score) as unscored,
        AVG(ppp_composite_score) as avg_composite
      FROM restaurant_leads
      WHERE state = 'MA' AND city IN (${cityPlaceholders})
    `;
    const statsResult = await env.DB.prepare(statsQuery).bind(...CAPE_COD_LOCATIONS).first();

    // Transform results
    const prospects = (results.results || []).map(row => ({
      id: row.id,
      name: row.dba_name || row.name || 'Unknown',
      dbaName: row.dba_name,
      domain: row.domain,
      address: row.address_line1,
      city: row.city,
      state: row.state,
      zip: row.zip,
      region: getRegionForCity(row.city),
      email: row.primary_email,
      phone: row.primary_phone,
      website: row.website_url,
      cuisine: row.cuisine_primary,
      serviceStyle: row.service_style,
      posSystem: row.current_pos || 'Unknown',
      posConfidence: row.current_pos_confidence,
      status: row.status || 'prospect',
      leadScore: row.lead_score,
      segment: row.segment,
      ppp: {
        problem: row.ppp_problem_score,
        pain: row.ppp_pain_score,
        priority: row.ppp_priority_score,
        composite: row.ppp_composite_score,
      },
      research: {
        problemDescription: row.research_problem_description,
        painSymptoms: row.research_pain_symptoms,
        prioritySignals: row.research_priority_signals,
        generalNotes: row.research_notes,
        webData: row.research_web_data ? JSON.parse(row.research_web_data) : null,
      },
      pppLastScoredAt: row.ppp_last_scored_at,
      pppScoredBy: row.ppp_scored_by,
      researchLastUpdatedAt: row.research_last_updated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return new Response(JSON.stringify({
      success: true,
      data: prospects,
      total: statsResult?.total || 0,
      scored: statsResult?.scored || 0,
      unscored: statsResult?.unscored || 0,
      avgComposite: Math.round((statsResult?.avg_composite || 0) * 10) / 10,
      limit,
      offset,
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('P-P-P API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), { status: 500, headers: corsHeaders });
  }
}
