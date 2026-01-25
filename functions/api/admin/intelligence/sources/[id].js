/**
 * Single Intelligence Feed Source API
 * GET /api/admin/intelligence/sources/[id] - Get single source with details
 * PATCH /api/admin/intelligence/sources/[id] - Partial update
 * DELETE /api/admin/intelligence/sources/[id] - Delete source
 */

import { verifyAuth, unauthorizedResponse, getCorsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  const { env, request, params } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const { id } = params;

    const source = await env.DB.prepare(`
      SELECT
        s.*,
        (SELECT COUNT(*) FROM intel_feed_items WHERE source_id = s.id) as item_count,
        (SELECT COUNT(*) FROM intel_feed_items WHERE source_id = s.id AND triage_status = 'pending') as pending_count,
        (SELECT COUNT(*) FROM intel_feed_items WHERE source_id = s.id AND converted_to_finding = 1) as converted_count,
        (SELECT MAX(fetched_at) FROM intel_feed_items WHERE source_id = s.id) as latest_item_at
      FROM intel_feed_sources s
      WHERE s.id = ?
    `).bind(id).first();

    if (!source) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Source not found'
      }), {
        status: 404,
        headers: getCorsHeaders(request)
      });
    }

    // Get recent items for this source
    const recentItems = await env.DB.prepare(`
      SELECT id, title, url, published_at, fetched_at, relevance_score, triage_status
      FROM intel_feed_items
      WHERE source_id = ?
      ORDER BY fetched_at DESC
      LIMIT 10
    `).bind(id).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...source,
        recent_items: recentItems.results || []
      }
    }), {
      status: 200,
      headers: getCorsHeaders(request)
    });

  } catch (error) {
    console.error('Source GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to fetch source'
    }), {
      status: 500,
      headers: getCorsHeaders(request)
    });
  }
}

export async function onRequestPatch(context) {
  const { env, request, params } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const { id } = params;
    const body = await request.json();

    // Check exists
    const existing = await env.DB.prepare('SELECT * FROM intel_feed_sources WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Source not found'
      }), {
        status: 404,
        headers: getCorsHeaders(request)
      });
    }

    // Build dynamic update
    const updates = ['updated_at = unixepoch()'];
    const params_arr = [];
    const allowedFields = ['name', 'source_type', 'url', 'category', 'territory', 'poll_interval_minutes', 'is_active'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'is_active') {
          updates.push(`${field} = ?`);
          params_arr.push(body[field] ? 1 : 0);
        } else {
          updates.push(`${field} = ?`);
          params_arr.push(body[field]);
        }
      }
    }

    if (body.config !== undefined) {
      updates.push('config_json = ?');
      params_arr.push(JSON.stringify(body.config));
    }

    // Reset error count if explicitly requested
    if (body.reset_errors) {
      updates.push('error_count = 0');
      updates.push('last_error = NULL');
    }

    params_arr.push(id);

    await env.DB.prepare(`
      UPDATE intel_feed_sources SET ${updates.join(', ')} WHERE id = ?
    `).bind(...params_arr).run();

    const updated = await env.DB.prepare('SELECT * FROM intel_feed_sources WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      message: 'Source updated',
      data: updated
    }), {
      status: 200,
      headers: getCorsHeaders(request)
    });

  } catch (error) {
    console.error('Source PATCH error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to update source'
    }), {
      status: 500,
      headers: getCorsHeaders(request)
    });
  }
}

export async function onRequestDelete(context) {
  const { env, request, params } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const { id } = params;

    const existing = await env.DB.prepare('SELECT * FROM intel_feed_sources WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Source not found'
      }), {
        status: 404,
        headers: getCorsHeaders(request)
      });
    }

    // Delete associated items first
    await env.DB.prepare('DELETE FROM intel_feed_items WHERE source_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM intel_feed_sources WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Source deleted'
    }), {
      status: 200,
      headers: getCorsHeaders(request)
    });

  } catch (error) {
    console.error('Source DELETE error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to delete source'
    }), {
      status: 500,
      headers: getCorsHeaders(request)
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
