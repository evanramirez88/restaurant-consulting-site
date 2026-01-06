/**
 * Admin Tickets API - List and Create
 *
 * GET /api/admin/tickets - List all tickets (protected)
 * POST /api/admin/tickets - Create new ticket (protected)
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    const { env, request } = context;
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const clientId = url.searchParams.get('client_id');
    const priority = url.searchParams.get('priority');

    // Verify authentication using proper JWT
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    // Build query with optional filters
    let query = `
      SELECT t.*, c.name as client_name, c.company as client_company
      FROM tickets t
      LEFT JOIN clients c ON t.client_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ' AND t.status = ?';
      params.push(status);
    }

    if (clientId) {
      query += ' AND t.client_id = ?';
      params.push(clientId);
    }

    if (priority && priority !== 'all') {
      query += ' AND t.priority = ?';
      params.push(priority);
    }

    // Sorting logic
    const sortBy = url.searchParams.get('sort_by') || 'priority';
    const sortOrder = url.searchParams.get('sort_order') || 'asc';

    if (sortBy === 'client') {
      query += ` ORDER BY c.company ${sortOrder === 'desc' ? 'DESC' : 'ASC'}, c.name ${sortOrder === 'desc' ? 'DESC' : 'ASC'}, t.created_at DESC`;
    } else if (sortBy === 'due_date') {
      query += ` ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ${sortOrder === 'desc' ? 'DESC' : 'ASC'}, t.created_at DESC`;
    } else if (sortBy === 'target_date') {
      query += ` ORDER BY CASE WHEN t.target_date IS NULL THEN 1 ELSE 0 END, t.target_date ${sortOrder === 'desc' ? 'DESC' : 'ASC'}, t.created_at DESC`;
    } else if (sortBy === 'created_at') {
      query += ` ORDER BY t.created_at ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      // Default: priority-based sorting
      query += ' ORDER BY CASE t.priority WHEN \'urgent\' THEN 0 WHEN \'high\' THEN 1 WHEN \'normal\' THEN 2 ELSE 3 END, t.created_at DESC';
    }

    const stmt = env.DB.prepare(query);
    const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

    // Get counts by status
    const countResult = await env.DB.prepare(`
      SELECT status, COUNT(*) as count FROM tickets GROUP BY status
    `).all();
    const statusCounts = {};
    countResult.results?.forEach(r => { statusCounts[r.status] = r.count; });

    return new Response(JSON.stringify({
      success: true,
      data: result.results || [],
      statusCounts
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Get tickets error:', error);
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
    const { env, request } = context;

    // Verify authentication using proper JWT
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();
    const { client_id, project_id, subject, description, priority = 'normal', category, assigned_to, due_date, target_date, target_date_label } = body;

    if (!client_id || !subject) {
      return new Response(JSON.stringify({
        success: false,
        error: 'client_id and subject are required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Convert date strings to unix timestamps if provided
    const dueDateTimestamp = due_date ? Math.floor(new Date(due_date).getTime() / 1000) : null;
    const targetDateTimestamp = target_date ? Math.floor(new Date(target_date).getTime() / 1000) : null;

    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO tickets (id, client_id, project_id, subject, description, priority, category, assigned_to, due_date, target_date, target_date_label, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', unixepoch(), unixepoch())
    `).bind(id, client_id, project_id || null, subject, description || null, priority, category || null, assigned_to || null, dueDateTimestamp, targetDateTimestamp, target_date_label || null).run();

    return new Response(JSON.stringify({
      success: true,
      data: { id, client_id, subject, priority, status: 'open' }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Create ticket error:', error);
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
