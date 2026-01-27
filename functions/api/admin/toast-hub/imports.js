// Toast Hub Imports API - Two-Gate Curation System
// Manages the pending queue, approval workflow, and visibility toggles
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

/**
 * GET /api/admin/toast-hub/imports
 * Query params:
 * - status: 'pending' | 'approved' | 'rejected' (default: all)
 * - visibility: 'public' | 'client' | 'rep' (filter by visibility)
 * - source_id: filter by source
 * - limit: number (default 50)
 * - offset: number (default 0)
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
    const visibility = url.searchParams.get('visibility');
    const sourceId = url.searchParams.get('source_id');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = `
      SELECT i.*, s.name as source_name, s.source_type
      FROM toast_hub_imports i
      LEFT JOIN toast_hub_sources s ON i.source_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }

    if (visibility === 'public') {
      query += ' AND i.visible_public = 1';
    } else if (visibility === 'client') {
      query += ' AND i.visible_client_portal = 1';
    } else if (visibility === 'rep') {
      query += ' AND i.visible_rep_portal = 1';
    }

    if (sourceId) {
      query += ' AND i.source_id = ?';
      params.push(sourceId);
    }

    query += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const { results } = await db.prepare(query).bind(...params).all();

    // Get counts by status
    const counts = await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM toast_hub_imports
    `).first();

    return new Response(JSON.stringify({
      success: true,
      data: results || [],
      counts,
      pagination: { limit, offset }
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
 * POST /api/admin/toast-hub/imports
 * Create a manual import (for internal content)
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

    const id = generateId('imp');

    await db.prepare(`
      INSERT INTO toast_hub_imports (
        id, source_id, external_url, title, excerpt, content_body,
        author, published_at, status,
        visible_public, visible_client_portal, visible_rep_portal,
        tldr_summary, expert_commentary, fact_highlights_json,
        tags_json, category_suggestion, ai_score,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.source_id || null,
      body.external_url || null,
      body.title,
      body.excerpt || null,
      body.content_body || null,
      body.author || 'Evan Ramirez',
      body.published_at || now,
      body.status || 'pending',
      body.visible_public ? 1 : 0,
      body.visible_client_portal ? 1 : 0,
      body.visible_rep_portal ? 1 : 0,
      body.tldr_summary || null,
      body.expert_commentary || null,
      body.fact_highlights_json ? JSON.stringify(body.fact_highlights_json) : null,
      body.tags_json ? JSON.stringify(body.tags_json) : null,
      body.category_suggestion || null,
      body.ai_score || null,
      now,
      now
    ).run();

    const created = await db.prepare('SELECT * FROM toast_hub_imports WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: created
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
 * PUT /api/admin/toast-hub/imports
 * Bulk update (approve/reject multiple)
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

    // Bulk status update
    if (body.action === 'bulk_status' && body.ids && body.status) {
      const placeholders = body.ids.map(() => '?').join(',');
      await db.prepare(`
        UPDATE toast_hub_imports
        SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
        WHERE id IN (${placeholders})
      `).bind(body.status, auth.user?.email || 'admin', now, now, ...body.ids).run();

      return new Response(JSON.stringify({
        success: true,
        updated: body.ids.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid action'
    }), {
      status: 400,
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
