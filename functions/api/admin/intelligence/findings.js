/**
 * Intelligence Findings API
 * GET /api/admin/intelligence/findings - List findings
 * POST /api/admin/intelligence/findings - Create finding
 * PUT /api/admin/intelligence/findings - Update finding status/action
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

export async function onRequestGet(context) {
  const { env, request } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const findingType = url.searchParams.get('type');
    const priority = url.searchParams.get('priority');
    const territory = url.searchParams.get('territory');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = 'SELECT * FROM agent_findings WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (findingType) {
      query += ' AND finding_type = ?';
      params.push(findingType);
    }
    if (priority) {
      query += ' AND priority = ?';
      params.push(priority);
    }
    if (territory) {
      query += ' AND territory = ?';
      params.push(territory);
    }

    query += ' ORDER BY CASE priority WHEN \'urgent\' THEN 0 WHEN \'high\' THEN 1 WHEN \'normal\' THEN 2 ELSE 3 END, created_at DESC';
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...params).all();

    // Stats
    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN status = 'actionable' THEN 1 ELSE 0 END) as actionable_count,
        SUM(CASE WHEN priority IN ('urgent', 'high') THEN 1 ELSE 0 END) as high_priority_count
      FROM agent_findings
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: result.results || [],
      stats: stats.results?.[0] || {},
      limit,
      offset
    }), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: corsHeaders
    });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const body = await request.json();
    const { agent_type, finding_type, title, summary, details_json, confidence_score = 50, priority = 'normal', client_id, lead_id, territory, source_url, source_type, tags_json } = body;

    if (!agent_type || !finding_type || !title) {
      return new Response(JSON.stringify({ success: false, error: 'agent_type, finding_type, and title are required' }), {
        status: 400, headers: corsHeaders
      });
    }

    const id = `finding_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await env.DB.prepare(`
      INSERT INTO agent_findings (id, agent_type, finding_type, title, summary, details_json, confidence_score, priority, client_id, lead_id, territory, source_url, source_type, tags_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, agent_type, finding_type, title, summary || null, details_json || null, confidence_score, priority, client_id || null, lead_id || null, territory || null, source_url || null, source_type || null, tags_json || null).run();

    return new Response(JSON.stringify({
      success: true,
      data: { id, agent_type, finding_type, title, priority }
    }), { status: 201, headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: corsHeaders
    });
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const body = await request.json();
    const { id, status, action_taken, priority } = body;

    if (!id) {
      return new Response(JSON.stringify({ success: false, error: 'Finding id is required' }), {
        status: 400, headers: corsHeaders
      });
    }

    const updates = ['updated_at = unixepoch()'];
    const params = [];

    if (status) { updates.push('status = ?'); params.push(status); }
    if (action_taken) {
      updates.push('action_taken = ?');
      updates.push('action_by = ?');
      updates.push('action_at = unixepoch()');
      params.push(action_taken, auth.username || 'Admin');
    }
    if (priority) { updates.push('priority = ?'); params.push(priority); }

    params.push(id);

    await env.DB.prepare(`UPDATE agent_findings SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
