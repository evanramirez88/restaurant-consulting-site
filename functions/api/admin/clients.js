/**
 * Admin Clients API - List and Create
 *
 * GET /api/admin/clients - List all clients (protected)
 * POST /api/admin/clients - Create new client (protected)
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
        c.*,
        (SELECT COUNT(*) FROM restaurants WHERE client_id = c.id) as restaurant_count,
        (SELECT COUNT(*) FROM client_rep_assignments WHERE client_id = c.id) as rep_count
      FROM clients c
      ORDER BY c.created_at DESC
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Clients GET error:', error);
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
      INSERT INTO clients (
        id, email, name, company, slug, phone, portal_enabled,
        support_plan_tier, support_plan_status, google_drive_folder_id,
        avatar_url, notes, timezone, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.email,
      body.name,
      body.company || null,
      body.slug || null,
      body.phone || null,
      body.portal_enabled ? 1 : 0,
      body.support_plan_tier || null,
      body.support_plan_status || null,
      body.google_drive_folder_id || null,
      body.avatar_url || null,
      body.notes || null,
      body.timezone || 'America/New_York',
      now,
      now
    ).run();

    const client = await db.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: client
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Clients POST error:', error);
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
