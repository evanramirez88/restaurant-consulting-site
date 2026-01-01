/**
 * Admin Availability Schedules API - List and Create
 *
 * GET /api/admin/availability/schedules - List all schedules (protected)
 * POST /api/admin/availability/schedules - Create new schedule (protected)
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;

    // Ensure table exists
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS availability_schedules (
        id TEXT PRIMARY KEY,
        title TEXT,
        status TEXT DEFAULT 'available',
        location_type TEXT DEFAULT 'remote',
        town TEXT,
        address TEXT,
        walk_ins_accepted INTEGER DEFAULT 0,
        scheduling_available INTEGER DEFAULT 1,
        scheduling_link TEXT,
        scheduling_link_type TEXT,
        availability_start INTEGER,
        availability_end INTEGER,
        display_start INTEGER,
        display_end INTEGER,
        custom_message TEXT,
        priority INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `).run();

    const { results } = await db.prepare(`
      SELECT * FROM availability_schedules
      ORDER BY priority DESC, created_at DESC
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Schedules GET error:', error);
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

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db.prepare(`
      INSERT INTO availability_schedules (
        id, title, status, location_type, town, address,
        walk_ins_accepted, scheduling_available, scheduling_link, scheduling_link_type,
        availability_start, availability_end, display_start, display_end,
        custom_message, priority, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.title || null,
      body.status || 'available',
      body.location_type || 'remote',
      body.town || null,
      body.address || null,
      body.walk_ins_accepted ? 1 : 0,
      body.scheduling_available ? 1 : 0,
      body.scheduling_link || null,
      body.scheduling_link_type || null,
      body.availability_start || null,
      body.availability_end || null,
      body.display_start || null,
      body.display_end || null,
      body.custom_message || null,
      body.priority || 0,
      body.is_active !== false ? 1 : 0,
      now,
      now
    ).run();

    const schedule = await db.prepare('SELECT * FROM availability_schedules WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: schedule
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
