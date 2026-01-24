/**
 * Admin Leads API
 *
 * GET /api/admin/leads - List leads with filtering and pagination
 * POST /api/admin/leads - Update lead status/segment
 *
 * Query params:
 *   - limit (default 50)
 *   - offset (default 0)
 *   - status (filter by status)
 *   - segment (filter by segment A/B/C/D)
 *   - pos (filter by current_pos)
 *   - search (search name, email, domain)
 *   - minScore (minimum lead score)
 *   - sort (field to sort by)
 *   - order (asc/desc)
 */

import { verifyAuth, unauthorizedResponse, getCorsOrigin, handleOptions } from '../../_shared/auth.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

/**
 * GET /api/admin/leads
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    // Verify admin auth
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const status = url.searchParams.get('status');
    const segment = url.searchParams.get('segment');
    const pos = url.searchParams.get('pos');
    const search = url.searchParams.get('search');
    const minScore = url.searchParams.get('minScore');
    const sort = url.searchParams.get('sort') || 'lead_score';
    const order = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';

    // Build query
    let query = `
      SELECT
        id, name, dba_name, domain, website_url,
        primary_email, primary_phone, secondary_email, secondary_phone,
        address_line1, city, state, zip,
        current_pos, lead_score, status, segment,
        service_style, cuisine_primary, bar_program, menu_complexity,
        source, tags, notes,
        hubspot_id, hubspot_synced_at,
        converted_to_client_id,
        created_at, updated_at
      FROM restaurant_leads
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    if (segment) {
      query += ` AND segment = ?`;
      params.push(segment);
    }

    if (pos) {
      query += ` AND current_pos = ?`;
      params.push(pos);
    }

    if (minScore) {
      query += ` AND lead_score >= ?`;
      params.push(parseInt(minScore));
    }

    if (search) {
      query += ` AND (name LIKE ? OR primary_email LIKE ? OR domain LIKE ? OR dba_name LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Validate sort field to prevent SQL injection
    const validSortFields = ['lead_score', 'name', 'created_at', 'updated_at', 'status', 'current_pos', 'city', 'state'];
    const sortField = validSortFields.includes(sort) ? sort : 'lead_score';

    query += ` ORDER BY ${sortField} ${order} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // Execute query
    const results = await env.DB.prepare(query).bind(...params).all();

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM restaurant_leads WHERE 1=1`;
    const countParams = [];

    if (status) {
      countQuery += ` AND status = ?`;
      countParams.push(status);
    }
    if (segment) {
      countQuery += ` AND segment = ?`;
      countParams.push(segment);
    }
    if (pos) {
      countQuery += ` AND current_pos = ?`;
      countParams.push(pos);
    }
    if (minScore) {
      countQuery += ` AND lead_score >= ?`;
      countParams.push(parseInt(minScore));
    }
    if (search) {
      countQuery += ` AND (name LIKE ? OR primary_email LIKE ? OR domain LIKE ? OR dba_name LIKE ?)`;
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

    // Get segment/POS stats for filters
    const statsQuery = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'prospect' THEN 1 ELSE 0 END) as prospects,
        SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted,
        SUM(CASE WHEN status = 'qualified' THEN 1 ELSE 0 END) as qualified,
        SUM(CASE WHEN status = 'client' THEN 1 ELSE 0 END) as clients,
        SUM(CASE WHEN segment = 'A' THEN 1 ELSE 0 END) as segment_a,
        SUM(CASE WHEN segment = 'B' THEN 1 ELSE 0 END) as segment_b,
        SUM(CASE WHEN segment = 'C' THEN 1 ELSE 0 END) as segment_c,
        SUM(CASE WHEN segment = 'D' THEN 1 ELSE 0 END) as segment_d
      FROM restaurant_leads
    `).first();

    const posStats = await env.DB.prepare(`
      SELECT current_pos, COUNT(*) as count
      FROM restaurant_leads
      WHERE current_pos IS NOT NULL AND current_pos != ''
      GROUP BY current_pos
      ORDER BY count DESC
      LIMIT 10
    `).all();

    return new Response(JSON.stringify({
      success: true,
      leads: results.results || [],
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset,
        hasMore: offset + limit < (countResult?.total || 0)
      },
      stats: statsQuery,
      posCounts: posStats.results || []
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Admin leads error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * POST /api/admin/leads - Update lead
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const body = await request.json();
    const { lead_id, status, segment, notes, tags } = body;

    if (!lead_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'lead_id is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Build update query
    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (segment) {
      updates.push('segment = ?');
      params.push(segment);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (tags !== undefined) {
      updates.push('tags = ?');
      params.push(tags);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No updates provided'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    updates.push('updated_at = unixepoch()');
    params.push(lead_id);

    await env.DB.prepare(`
      UPDATE restaurant_leads
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...params).run();

    // Log activity
    await env.DB.prepare(`
      INSERT INTO lead_activity_log (id, lead_id, activity_type, subject, description, performed_by, created_at)
      VALUES (?, ?, 'status_update', 'Lead updated', ?, ?, unixepoch())
    `).bind(
      `act_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      lead_id,
      JSON.stringify({ status, segment, notes, tags }),
      auth.user?.id || 'admin'
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Lead updated'
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Admin leads update error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
