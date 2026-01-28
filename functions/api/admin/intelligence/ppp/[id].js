/**
 * Individual Prospect P-P-P Score Management
 * 
 * GET /api/admin/intelligence/ppp/[id] - Get prospect with full P-P-P data
 * PATCH /api/admin/intelligence/ppp/[id] - Update P-P-P scores and research notes
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Cape Cod regions for display
const CAPE_COD_REGIONS = {
  'Outer Cape': ['Provincetown', 'Truro', 'North Truro', 'Wellfleet', 'Eastham', 'North Eastham'],
  'Lower Cape': ['Orleans', 'East Orleans', 'Chatham', 'West Chatham', 'Brewster', 'East Brewster', 'Harwich', 'Harwich Port', 'West Harwich', 'East Harwich'],
  'Mid Cape': ['Dennis', 'Dennis Port', 'West Dennis', 'East Dennis', 'Yarmouth', 'South Yarmouth', 'West Yarmouth', 'Yarmouth Port', 'Barnstable', 'Hyannis', 'Centerville', 'Osterville', 'Cotuit', 'Marstons Mills', 'West Barnstable', 'Cummaquid'],
  'Upper Cape': ['Mashpee', 'New Seabury', 'Popponesset', 'Falmouth', 'East Falmouth', 'West Falmouth', 'North Falmouth', 'Woods Hole', 'Sandwich', 'East Sandwich', 'Forestdale', 'Bourne', 'Buzzards Bay', 'Sagamore', 'Pocasset', 'Cataumet', 'Monument Beach'],
};

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

function generateId() {
  return 'rlog_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { params, env } = context;
  const { id } = params;

  try {
    // Get prospect data
    const prospect = await env.DB.prepare(`
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
        social_links,
        cuisine_primary,
        cuisine_secondary,
        service_style,
        bar_program,
        menu_complexity,
        price_level,
        current_pos,
        current_pos_confidence,
        online_ordering_provider,
        reservation_provider,
        status,
        lead_score,
        segment,
        source,
        tags,
        notes,
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
      WHERE id = ?
    `).bind(id).first();

    if (!prospect) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Prospect not found',
      }), { status: 404, headers: corsHeaders });
    }

    // Get research log
    const logs = await env.DB.prepare(`
      SELECT * FROM prospect_research_log
      WHERE lead_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(id).all();

    // Get web research
    const webResearch = await env.DB.prepare(`
      SELECT * FROM prospect_web_research
      WHERE lead_id = ?
      ORDER BY fetched_at DESC
    `).bind(id).all();

    // Transform response
    const data = {
      id: prospect.id,
      name: prospect.dba_name || prospect.name || 'Unknown',
      dbaName: prospect.dba_name,
      domain: prospect.domain,
      address: prospect.address_line1,
      city: prospect.city,
      state: prospect.state,
      zip: prospect.zip,
      region: getRegionForCity(prospect.city),
      email: prospect.primary_email,
      phone: prospect.primary_phone,
      website: prospect.website_url,
      socialLinks: prospect.social_links ? JSON.parse(prospect.social_links) : null,
      cuisine: prospect.cuisine_primary,
      cuisineSecondary: prospect.cuisine_secondary,
      serviceStyle: prospect.service_style,
      barProgram: prospect.bar_program,
      menuComplexity: prospect.menu_complexity,
      priceLevel: prospect.price_level,
      posSystem: prospect.current_pos || 'Unknown',
      posConfidence: prospect.current_pos_confidence,
      onlineOrdering: prospect.online_ordering_provider,
      reservationProvider: prospect.reservation_provider,
      status: prospect.status || 'prospect',
      leadScore: prospect.lead_score,
      segment: prospect.segment,
      source: prospect.source,
      tags: prospect.tags ? prospect.tags.split(',').map(t => t.trim()) : [],
      notes: prospect.notes,
      ppp: {
        problem: prospect.ppp_problem_score,
        pain: prospect.ppp_pain_score,
        priority: prospect.ppp_priority_score,
        composite: prospect.ppp_composite_score,
      },
      research: {
        problemDescription: prospect.research_problem_description,
        painSymptoms: prospect.research_pain_symptoms,
        prioritySignals: prospect.research_priority_signals,
        generalNotes: prospect.research_notes,
        webData: prospect.research_web_data ? JSON.parse(prospect.research_web_data) : null,
      },
      pppLastScoredAt: prospect.ppp_last_scored_at,
      pppScoredBy: prospect.ppp_scored_by,
      researchLastUpdatedAt: prospect.research_last_updated_at,
      createdAt: prospect.created_at,
      updatedAt: prospect.updated_at,
      researchLog: (logs.results || []).map(log => ({
        id: log.id,
        activityType: log.activity_type,
        problemScore: log.problem_score,
        painScore: log.pain_score,
        priorityScore: log.priority_score,
        compositeScore: log.composite_score,
        notes: log.notes,
        performedBy: log.performed_by,
        createdAt: log.created_at,
      })),
      webResearchEntries: (webResearch.results || []).map(wr => ({
        id: wr.id,
        sourceType: wr.source_type,
        sourceUrl: wr.source_url,
        title: wr.title,
        content: wr.content,
        extractedData: wr.extracted_data ? JSON.parse(wr.extracted_data) : null,
        relevanceScore: wr.relevance_score,
        fetchedAt: wr.fetched_at,
      })),
    };

    return new Response(JSON.stringify({
      success: true,
      data,
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Get P-P-P prospect error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestPatch(context) {
  const { params, request, env } = context;
  const { id } = params;

  try {
    const body = await request.json();
    const now = Math.floor(Date.now() / 1000);

    // Validate scores if provided
    const { 
      problemScore, 
      painScore, 
      priorityScore,
      problemDescription,
      painSymptoms,
      prioritySignals,
      researchNotes,
      status,
    } = body;

    // Calculate composite score
    let compositeScore = null;
    if (problemScore != null && painScore != null && priorityScore != null) {
      compositeScore = Math.round((problemScore + painScore + priorityScore) / 3 * 10);
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (problemScore !== undefined) {
      updates.push('ppp_problem_score = ?');
      values.push(problemScore);
    }
    if (painScore !== undefined) {
      updates.push('ppp_pain_score = ?');
      values.push(painScore);
    }
    if (priorityScore !== undefined) {
      updates.push('ppp_priority_score = ?');
      values.push(priorityScore);
    }
    if (compositeScore !== null) {
      updates.push('ppp_composite_score = ?');
      values.push(compositeScore);
      updates.push('ppp_last_scored_at = ?');
      values.push(now);
      updates.push('ppp_scored_by = ?');
      values.push('admin'); // TODO: Get from auth
    }
    if (problemDescription !== undefined) {
      updates.push('research_problem_description = ?');
      values.push(problemDescription);
    }
    if (painSymptoms !== undefined) {
      updates.push('research_pain_symptoms = ?');
      values.push(painSymptoms);
    }
    if (prioritySignals !== undefined) {
      updates.push('research_priority_signals = ?');
      values.push(prioritySignals);
    }
    if (researchNotes !== undefined) {
      updates.push('research_notes = ?');
      values.push(researchNotes);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }

    // Always update timestamps
    updates.push('updated_at = ?');
    values.push(now);
    updates.push('research_last_updated_at = ?');
    values.push(now);

    // Add id for WHERE clause
    values.push(id);

    // Execute update
    const updateQuery = `
      UPDATE restaurant_leads
      SET ${updates.join(', ')}
      WHERE id = ?
    `;
    await env.DB.prepare(updateQuery).bind(...values).run();

    // Log the activity
    if (compositeScore !== null) {
      await env.DB.prepare(`
        INSERT INTO prospect_research_log (id, lead_id, activity_type, problem_score, pain_score, priority_score, composite_score, notes, performed_by, created_at)
        VALUES (?, ?, 'ppp_scored', ?, ?, ?, ?, ?, 'admin', ?)
      `).bind(
        generateId(),
        id,
        problemScore,
        painScore,
        priorityScore,
        compositeScore,
        researchNotes || null,
        now
      ).run();
    } else if (researchNotes || problemDescription || painSymptoms || prioritySignals) {
      await env.DB.prepare(`
        INSERT INTO prospect_research_log (id, lead_id, activity_type, notes, performed_by, created_at)
        VALUES (?, ?, 'note_added', ?, 'admin', ?)
      `).bind(
        generateId(),
        id,
        researchNotes || 'Research notes updated',
        now
      ).run();
    }

    // Return updated prospect
    const updated = await env.DB.prepare(`
      SELECT * FROM restaurant_leads WHERE id = ?
    `).bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: updated.id,
        name: updated.dba_name || updated.name,
        ppp: {
          problem: updated.ppp_problem_score,
          pain: updated.ppp_pain_score,
          priority: updated.ppp_priority_score,
          composite: updated.ppp_composite_score,
        },
        pppLastScoredAt: updated.ppp_last_scored_at,
      },
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Update P-P-P prospect error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), { status: 500, headers: corsHeaders });
  }
}
