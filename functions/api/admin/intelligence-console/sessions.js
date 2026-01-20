/**
 * Intelligence Console Sessions API
 *
 * GET /api/admin/intelligence-console/sessions - List sessions
 * POST /api/admin/intelligence-console/sessions - Create session
 * GET /api/admin/intelligence-console/sessions/:id - Get session with messages
 * DELETE /api/admin/intelligence-console/sessions/:id - Delete session
 */

import { verifyAuth, unauthorizedResponse, handleOptions } from '../../../_shared/auth.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error, request);
  }

  try {
    const url = new URL(request.url);
    const folderId = url.searchParams.get('folder');
    const assistantId = url.searchParams.get('assistant');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const includeArchived = url.searchParams.get('archived') === 'true';

    let query = `
      SELECT
        s.*,
        a.name as assistant_name,
        a.avatar_url as assistant_avatar,
        m.display_name as model_name
      FROM intelligence_sessions s
      LEFT JOIN ai_assistants a ON s.assistant_id = a.id
      LEFT JOIN ai_models m ON s.model_id = m.id
      WHERE 1=1
    `;
    const params = [];

    if (!includeArchived) {
      query += ' AND s.is_archived = 0';
    }

    if (folderId) {
      query += ' AND s.folder_id = ?';
      params.push(folderId);
    }

    if (assistantId) {
      query += ' AND s.assistant_id = ?';
      params.push(assistantId);
    }

    query += ' ORDER BY s.is_pinned DESC, s.updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const sessions = await env.DB.prepare(query).bind(...params).all();

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM intelligence_sessions WHERE 1=1';
    const countParams = [];
    if (!includeArchived) countQuery += ' AND is_archived = 0';
    if (folderId) { countQuery += ' AND folder_id = ?'; countParams.push(folderId); }
    if (assistantId) { countQuery += ' AND assistant_id = ?'; countParams.push(assistantId); }

    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

    return new Response(JSON.stringify({
      success: true,
      sessions: sessions.results || [],
      total: countResult?.total || 0,
      limit,
      offset
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Sessions GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error, request);
  }

  try {
    const body = await request.json();
    const {
      title,
      assistantId,
      modelId,
      folderId,
      builderMode = 'none',
      styleId
    } = body;

    const now = Math.floor(Date.now() / 1000);
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await env.DB.prepare(`
      INSERT INTO intelligence_sessions
      (id, title, assistant_id, model_id, folder_id, builder_mode, speaking_style_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sessionId,
      title || 'New Conversation',
      assistantId || null,
      modelId || null,
      folderId || null,
      builderMode,
      styleId || null,
      now,
      now
    ).run();

    const session = await env.DB.prepare(
      'SELECT * FROM intelligence_sessions WHERE id = ?'
    ).bind(sessionId).first();

    return new Response(JSON.stringify({
      success: true,
      session
    }), { status: 201, headers: corsHeaders });

  } catch (error) {
    console.error('Sessions POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}
