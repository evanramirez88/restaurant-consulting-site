/**
 * Client Notes API
 * GET /api/admin/clients/:clientId/notes - List notes
 * POST /api/admin/clients/:clientId/notes - Create note
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
    const noteType = url.searchParams.get('type');
    const pinnedOnly = url.searchParams.get('pinned') === 'true';

    let query = `
      SELECT * FROM client_notes WHERE client_id = ?
    `;
    const params_list = [clientId];

    if (noteType) {
      query += ' AND note_type = ?';
      params_list.push(noteType);
    }
    if (pinnedOnly) {
      query += ' AND is_pinned = 1';
    }

    query += ' ORDER BY is_pinned DESC, created_at DESC';

    const result = await env.DB.prepare(query).bind(...params_list).all();

    return new Response(JSON.stringify({
      success: true,
      data: result.results || []
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
    const { content, note_type = 'general', is_pinned = false, is_private = false } = body;

    if (!content || !content.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'Content is required' }), {
        status: 400, headers: corsHeaders
      });
    }

    const id = `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await env.DB.prepare(`
      INSERT INTO client_notes (id, client_id, author_id, author_name, author_type, content, note_type, is_pinned, is_private)
      VALUES (?, ?, ?, ?, 'admin', ?, ?, ?, ?)
    `).bind(id, clientId, auth.userId || 'admin', auth.username || 'Admin', content.trim(), note_type, is_pinned ? 1 : 0, is_private ? 1 : 0).run();

    // Log activity
    await env.DB.prepare(`
      INSERT INTO client_activity_log (id, client_id, activity_type, title, performed_by_type, performed_by_name)
      VALUES (?, ?, 'note_added', ?, 'admin', ?)
    `).bind(`act_${Date.now()}`, clientId, `Note added: ${note_type}`, auth.username || 'Admin').run();

    // Update last_activity_at on client
    await env.DB.prepare(`
      UPDATE clients SET last_activity_at = unixepoch() WHERE id = ?
    `).bind(clientId).run();

    return new Response(JSON.stringify({
      success: true,
      data: { id, content: content.trim(), note_type, is_pinned, author_name: auth.username || 'Admin', created_at: Math.floor(Date.now() / 1000) }
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
