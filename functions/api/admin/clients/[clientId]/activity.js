/**
 * Client Activity Log API
 * GET /api/admin/clients/:clientId/activity - List activities (paginated)
 * POST /api/admin/clients/:clientId/activity - Log new activity
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const { clientId } = params;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const url = new URL(request.url);
    const activityType = url.searchParams.get('type');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = 'SELECT * FROM client_activity_log WHERE client_id = ?';
    const queryParams = [clientId];

    if (activityType) {
      query += ' AND activity_type = ?';
      queryParams.push(activityType);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...queryParams).all();

    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM client_activity_log WHERE client_id = ?'
    ).bind(clientId).first();

    return new Response(JSON.stringify({
      success: true,
      data: result.results || [],
      total: countResult?.total || 0,
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
  const { env, request, params } = context;
  const { clientId } = params;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const body = await request.json();
    const { activity_type, title, description, metadata_json, is_internal = false } = body;

    if (!activity_type || !title) {
      return new Response(JSON.stringify({ success: false, error: 'activity_type and title are required' }), {
        status: 400, headers: corsHeaders
      });
    }

    const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await env.DB.prepare(`
      INSERT INTO client_activity_log (id, client_id, activity_type, title, description, metadata_json, performed_by_type, performed_by_name, is_internal)
      VALUES (?, ?, ?, ?, ?, ?, 'admin', ?, ?)
    `).bind(id, clientId, activity_type, title, description || null, metadata_json || null, auth.username || 'Admin', is_internal ? 1 : 0).run();

    await env.DB.prepare('UPDATE clients SET last_activity_at = unixepoch() WHERE id = ?').bind(clientId).run();

    return new Response(JSON.stringify({
      success: true,
      data: { id, activity_type, title, created_at: Math.floor(Date.now() / 1000) }
    }), { status: 201, headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
