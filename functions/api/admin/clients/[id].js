// Admin Client API - Get, Update, Delete
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;

    const client = await db.prepare(`
      SELECT
        c.*,
        (SELECT COUNT(*) FROM restaurants WHERE client_id = c.id) as restaurant_count,
        (SELECT COUNT(*) FROM client_rep_assignments WHERE client_id = c.id) as rep_count
      FROM clients c
      WHERE c.id = ?
    `).bind(id).first();

    if (!client) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: client
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPut(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    // Get existing client to detect changes for activity logging
    const existing = await db.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({ success: false, error: 'Client not found' }), {
        status: 404, headers: corsHeaders
      });
    }

    await db.prepare(`
      UPDATE clients SET
        email = ?,
        name = ?,
        company = ?,
        slug = ?,
        phone = ?,
        portal_enabled = ?,
        support_plan_tier = ?,
        support_plan_status = ?,
        google_drive_folder_id = ?,
        avatar_url = ?,
        notes = ?,
        timezone = ?,
        intel_profile = ?,
        intel_notes = ?,
        tags = ?,
        local_folder_path = ?,
        last_activity_at = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
      body.email,
      body.name,
      body.company,
      body.slug || null,
      body.phone || null,
      body.portal_enabled ? 1 : 0,
      body.support_plan_tier || null,
      body.support_plan_status || null,
      body.google_drive_folder_id || null,
      body.avatar_url || null,
      body.notes || null,
      body.timezone || 'America/New_York',
      body.intel_profile || null,
      body.intel_notes || null,
      body.tags || null,
      body.local_folder_path || null,
      now,
      now,
      id
    ).run();

    // Log activity for significant changes
    const changes = [];
    if (existing.support_plan_tier !== body.support_plan_tier) {
      changes.push(`Plan: ${existing.support_plan_tier || 'none'} -> ${body.support_plan_tier || 'none'}`);
    }
    if (existing.portal_enabled !== (body.portal_enabled ? 1 : 0)) {
      changes.push(`Portal: ${body.portal_enabled ? 'enabled' : 'disabled'}`);
    }
    if (existing.company !== body.company) {
      changes.push(`Company renamed`);
    }

    if (changes.length > 0) {
      await db.prepare(`
        INSERT INTO client_activity_log (id, client_id, activity_type, title, description, performed_by_type, performed_by_name)
        VALUES (?, ?, 'status_change', 'Client updated', ?, 'admin', ?)
      `).bind(
        `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        id,
        changes.join('; '),
        auth.payload?.username || 'Admin'
      ).run();
    }

    const client = await db.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: client
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestDelete(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;

    await db.prepare('DELETE FROM clients WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({
      success: true
    }), {
      headers: corsHeaders
    });
  } catch (error) {
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
