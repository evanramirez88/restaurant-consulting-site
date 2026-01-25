/**
 * Admin Ticket Comments API
 * GET /api/admin/tickets/:ticketId/comments - List all comments
 * POST /api/admin/tickets/:ticketId/comments - Add comment
 */
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    const { env, request, params } = context;
    const { ticketId } = params;

    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const comments = await env.DB.prepare(`
      SELECT * FROM ticket_comments
      WHERE ticket_id = ?
      ORDER BY created_at ASC
    `).bind(ticketId).all();

    return new Response(JSON.stringify({
      success: true,
      data: comments.results || []
    }), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestPost(context) {
  try {
    const { env, request, params } = context;
    const { ticketId } = params;

    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const body = await request.json();
    const { content, visibility = 'all', is_resolution_note = false } = body;

    if (!content || !content.trim()) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Comment content is required'
      }), { status: 400, headers: corsHeaders });
    }

    const id = `comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await env.DB.prepare(`
      INSERT INTO ticket_comments (id, ticket_id, author_type, author_id, author_name, content, visibility, is_resolution_note)
      VALUES (?, ?, 'admin', ?, 'Admin', ?, ?, ?)
    `).bind(id, ticketId, auth.userId || 'admin', content.trim(), visibility, is_resolution_note ? 1 : 0).run();

    // Update ticket's updated_at and first_response_at if not set
    await env.DB.prepare(`
      UPDATE tickets SET
        updated_at = unixepoch(),
        first_response_at = CASE WHEN first_response_at IS NULL THEN unixepoch() ELSE first_response_at END
      WHERE id = ?
    `).bind(ticketId).run();

    const comment = await env.DB.prepare('SELECT * FROM ticket_comments WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: comment
    }), { status: 201, headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
