/**
 * Beacon Content Items CRUD
 *
 * GET /api/admin/beacon/items - List items with filters
 * POST /api/admin/beacon/items/:id/approve - Approve item
 * POST /api/admin/beacon/items/:id/reject - Reject item
 * PUT /api/admin/beacon/items - Update item
 * DELETE /api/admin/beacon/items - Delete item
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

// Valid status values
const VALID_STATUSES = ['pending', 'reviewed', 'approved', 'rejected', 'transformed', 'published', 'archived'];

/**
 * GET - List content items with filters and pagination
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    // Parse query parameters
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    const source_id = url.searchParams.get('source_id');
    const priority_min = url.searchParams.get('priority_min');
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const sort = url.searchParams.get('sort') || 'fetched_at';
    const order = url.searchParams.get('order') || 'DESC';

    // Build query
    let query = `
      SELECT
        i.*,
        s.name as source_name,
        s.type as source_type_name
      FROM beacon_content_items i
      LEFT JOIN beacon_sources s ON i.source_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }

    if (category) {
      query += ' AND i.ai_category = ?';
      params.push(category);
    }

    if (source_id) {
      query += ' AND i.source_id = ?';
      params.push(source_id);
    }

    if (priority_min) {
      query += ' AND i.ai_priority_score >= ?';
      params.push(parseInt(priority_min));
    }

    if (search) {
      query += ' AND (i.title LIKE ? OR i.body LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Validate sort column
    const validSorts = ['fetched_at', 'ai_priority_score', 'source_created_at', 'title'];
    const sortCol = validSorts.includes(sort) ? sort : 'fetched_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY i.${sortCol} ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...params).all();

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM beacon_content_items i
      WHERE 1=1
    `;
    const countParams = [];

    if (status) {
      countQuery += ' AND i.status = ?';
      countParams.push(status);
    }
    if (category) {
      countQuery += ' AND i.ai_category = ?';
      countParams.push(category);
    }
    if (source_id) {
      countQuery += ' AND i.source_id = ?';
      countParams.push(source_id);
    }
    if (priority_min) {
      countQuery += ' AND i.ai_priority_score >= ?';
      countParams.push(parseInt(priority_min));
    }
    if (search) {
      countQuery += ' AND (i.title LIKE ? OR i.body LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

    return new Response(JSON.stringify({
      success: true,
      data: {
        items: result.results || [],
        pagination: {
          total: countResult?.total || 0,
          limit,
          offset,
          hasMore: (offset + limit) < (countResult?.total || 0)
        }
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Beacon items GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to fetch items'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * POST - Approve or reject item, or create new manual item
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const data = await request.json();
    const { id, action, rejection_reason, notes } = data;

    // Handle approve/reject actions
    if (action === 'approve' && id) {
      await env.DB.prepare(`
        UPDATE beacon_content_items
        SET status = 'approved',
            reviewed_at = unixepoch(),
            reviewed_by = 'admin',
            notes = COALESCE(?, notes),
            updated_at = unixepoch()
        WHERE id = ?
      `).bind(notes || null, id).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'Item approved'
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    if (action === 'reject' && id) {
      await env.DB.prepare(`
        UPDATE beacon_content_items
        SET status = 'rejected',
            reviewed_at = unixepoch(),
            reviewed_by = 'admin',
            rejection_reason = ?,
            notes = COALESCE(?, notes),
            updated_at = unixepoch()
        WHERE id = ?
      `).bind(rejection_reason || 'Not relevant', notes || null, id).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'Item rejected'
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    if (action === 'archive' && id) {
      await env.DB.prepare(`
        UPDATE beacon_content_items
        SET status = 'archived',
            updated_at = unixepoch()
        WHERE id = ?
      `).bind(id).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'Item archived'
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // Create manual content item
    if (data.title) {
      const newId = crypto.randomUUID().replace(/-/g, '').substring(0, 16);

      await env.DB.prepare(`
        INSERT INTO beacon_content_items (
          id, title, body, url, author, source_type, status,
          ai_category, ai_priority_score, notes
        ) VALUES (?, ?, ?, ?, ?, 'manual', 'pending', ?, ?, ?)
      `).bind(
        newId,
        data.title,
        data.body || null,
        data.url || null,
        data.author || 'Admin',
        data.category || 'general',
        data.priority || 50,
        data.notes || null
      ).run();

      const newItem = await env.DB.prepare('SELECT * FROM beacon_content_items WHERE id = ?').bind(newId).first();

      return new Response(JSON.stringify({
        success: true,
        message: 'Manual item created',
        data: newItem
      }), {
        status: 201,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid request. Provide action (approve/reject/archive) with id, or title to create new item.'
    }), {
      status: 400,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Beacon items POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to process request'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * PUT - Update item
 */
export async function onRequestPut(context) {
  const { request, env } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const data = await request.json();
    const { id, status, priority, notes, ai_category } = data;

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Item ID is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Build update
    const updates = [];
    const params = [];

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return new Response(JSON.stringify({
          success: false,
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      updates.push('status = ?');
      params.push(status);
    }

    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }

    if (ai_category !== undefined) {
      updates.push('ai_category = ?');
      params.push(ai_category);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No fields to update'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    updates.push('updated_at = unixepoch()');
    params.push(id);

    await env.DB.prepare(`
      UPDATE beacon_content_items SET ${updates.join(', ')} WHERE id = ?
    `).bind(...params).run();

    const updated = await env.DB.prepare('SELECT * FROM beacon_content_items WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      message: 'Item updated',
      data: updated
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Beacon items PUT error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to update item'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * DELETE - Delete item
 */
export async function onRequestDelete(context) {
  const { request, env } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const data = await request.json();
    const { id } = data;

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Item ID is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    await env.DB.prepare('DELETE FROM beacon_content_items WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Item deleted'
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Beacon items DELETE error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to delete item'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
