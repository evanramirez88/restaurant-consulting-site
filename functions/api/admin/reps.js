/**
 * Admin Reps API - List and Create
 *
 * GET /api/admin/reps - List all reps (protected)
 * POST /api/admin/reps - Create new rep (protected)
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;

    const { results } = await db.prepare(`
      SELECT
        r.*,
        (SELECT COUNT(*) FROM client_rep_assignments WHERE rep_id = r.id) as client_count
      FROM reps r
      ORDER BY r.created_at DESC
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Reps GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPost(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const body = await context.request.json();

    // Validate required fields
    if (!body.email || !body.name) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email and name are required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db.prepare(`
      INSERT INTO reps (
        id, email, name, territory, slug, phone, portal_enabled,
        status, avatar_url, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.email,
      body.name,
      body.territory || null,
      body.slug || null,
      body.phone || null,
      body.portal_enabled ? 1 : 0,
      body.status || 'pending',
      body.avatar_url || null,
      body.notes || null,
      now,
      now
    ).run();

    const rep = await db.prepare('SELECT * FROM reps WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: rep
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Reps POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
