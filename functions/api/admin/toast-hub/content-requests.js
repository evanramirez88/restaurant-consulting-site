// Toast Hub Content Requests API
// Manages requests to generate content from tickets, briefs, and manual entries
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

/**
 * GET /api/admin/toast-hub/content-requests
 * List all content generation requests
 */
export async function onRequestGet(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const url = new URL(context.request.url);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

    let query = `
      SELECT cr.*,
        i.title as import_title, i.status as import_status,
        p.title as post_title, p.status as post_status
      FROM toast_hub_content_requests cr
      LEFT JOIN toast_hub_imports i ON cr.generated_import_id = i.id
      LEFT JOIN toast_hub_posts p ON cr.generated_post_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND cr.status = ?';
      params.push(status);
    }
    if (type) {
      query += ' AND cr.request_type = ?';
      params.push(type);
    }

    query += ' ORDER BY cr.created_at DESC LIMIT ?';
    params.push(limit);

    const { results } = await db.prepare(query).bind(...params).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/admin/toast-hub/content-requests
 * Create a new content generation request
 *
 * Body:
 * - request_type: 'ticket' | 'brief' | 'manual' | 'ai_suggestion'
 * - source_reference: ticket_id, brief_id, etc.
 * - title: Title for the content
 * - description: What the content should be about
 * - priority: 0-10 (default 0)
 */
export async function onRequestPost(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    // Validate
    if (!body.request_type || !body.title) {
      return new Response(JSON.stringify({
        success: false,
        error: 'request_type and title are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const validTypes = ['ticket', 'brief', 'manual', 'ai_suggestion'];
    if (!validTypes.includes(body.request_type)) {
      return new Response(JSON.stringify({
        success: false,
        error: `request_type must be one of: ${validTypes.join(', ')}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const id = generateId('cr');

    await db.prepare(`
      INSERT INTO toast_hub_content_requests (
        id, request_type, source_reference, title, description,
        requested_by, status, priority, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `).bind(
      id,
      body.request_type,
      body.source_reference || null,
      body.title,
      body.description || null,
      auth.user?.email || 'admin',
      body.priority || 0,
      body.notes || null,
      now,
      now
    ).run();

    // If request is from a ticket, fetch ticket details for context
    let ticketContext = null;
    if (body.request_type === 'ticket' && body.source_reference) {
      ticketContext = await db.prepare(`
        SELECT id, subject, description, resolution_notes, category
        FROM support_tickets
        WHERE id = ?
      `).bind(body.source_reference).first();
    }

    const created = await db.prepare('SELECT * FROM toast_hub_content_requests WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: created,
      ticket_context: ticketContext
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PUT /api/admin/toast-hub/content-requests
 * Update request status or link to generated content
 */
export async function onRequestPut(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    if (!body.id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'id is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const updates = [];
    const params = [];

    if (body.status) {
      updates.push('status = ?');
      params.push(body.status);
    }
    if (body.generated_import_id !== undefined) {
      updates.push('generated_import_id = ?');
      params.push(body.generated_import_id);
    }
    if (body.generated_post_id !== undefined) {
      updates.push('generated_post_id = ?');
      params.push(body.generated_post_id);
    }
    if (body.notes !== undefined) {
      updates.push('notes = ?');
      params.push(body.notes);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No updates provided'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(body.id);

    await db.prepare(`
      UPDATE toast_hub_content_requests SET ${updates.join(', ')} WHERE id = ?
    `).bind(...params).run();

    const updated = await db.prepare('SELECT * FROM toast_hub_content_requests WHERE id = ?').bind(body.id).first();

    return new Response(JSON.stringify({
      success: true,
      data: updated
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
