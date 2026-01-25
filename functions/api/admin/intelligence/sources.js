/**
 * Intelligence Feed Sources API
 * GET /api/admin/intelligence/sources - List all feed sources
 * POST /api/admin/intelligence/sources - Create a new feed source
 * PUT /api/admin/intelligence/sources - Update a feed source
 * DELETE /api/admin/intelligence/sources - Delete a feed source
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions, getCorsHeaders } from '../../../_shared/auth.js';

const VALID_SOURCE_TYPES = ['rss', 'reddit', 'google_alerts', 'twitter', 'yelp', 'google_reviews', 'news_api', 'custom_scraper'];

export async function onRequestGet(context) {
  const { env, request } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const url = new URL(request.url);
    const activeOnly = url.searchParams.get('active') === 'true';
    const sourceType = url.searchParams.get('type');

    let query = `
      SELECT
        s.*,
        (SELECT COUNT(*) FROM intel_feed_items WHERE source_id = s.id) as item_count,
        (SELECT COUNT(*) FROM intel_feed_items WHERE source_id = s.id AND triage_status = 'pending') as pending_count,
        (SELECT COUNT(*) FROM intel_feed_items WHERE source_id = s.id AND converted_to_finding = 1) as converted_count
      FROM intel_feed_sources s
      WHERE 1=1
    `;
    const params = [];

    if (activeOnly) {
      query += ' AND s.is_active = 1';
    }
    if (sourceType) {
      query += ' AND s.source_type = ?';
      params.push(sourceType);
    }

    query += ' ORDER BY s.is_active DESC, s.name ASC';

    const result = await env.DB.prepare(query).bind(...params).all();

    // Get summary stats
    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_sources,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_sources,
        SUM(error_count) as total_errors,
        (SELECT COUNT(*) FROM intel_feed_items) as total_items,
        (SELECT COUNT(*) FROM intel_feed_items WHERE triage_status = 'pending') as pending_items
      FROM intel_feed_sources
    `).first();

    return new Response(JSON.stringify({
      success: true,
      data: result.results || [],
      stats: stats || {}
    }), {
      status: 200,
      headers: getCorsHeaders(request)
    });

  } catch (error) {
    console.error('Intelligence sources GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to fetch sources'
    }), {
      status: 500,
      headers: getCorsHeaders(request)
    });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const body = await request.json();
    const { name, source_type, url: sourceUrl, config, category, territory, poll_interval_minutes = 60 } = body;

    // Validation
    if (!name || !source_type || !sourceUrl) {
      return new Response(JSON.stringify({
        success: false,
        error: 'name, source_type, and url are required'
      }), {
        status: 400,
        headers: getCorsHeaders(request)
      });
    }

    if (!VALID_SOURCE_TYPES.includes(source_type)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid source_type. Must be one of: ${VALID_SOURCE_TYPES.join(', ')}`
      }), {
        status: 400,
        headers: getCorsHeaders(request)
      });
    }

    const id = `feed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const configJson = config ? JSON.stringify(config) : null;

    await env.DB.prepare(`
      INSERT INTO intel_feed_sources (id, name, source_type, url, config_json, category, territory, poll_interval_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, name, source_type, sourceUrl, configJson, category || null, territory || null, poll_interval_minutes).run();

    const newSource = await env.DB.prepare('SELECT * FROM intel_feed_sources WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      message: 'Feed source created',
      data: newSource
    }), {
      status: 201,
      headers: getCorsHeaders(request)
    });

  } catch (error) {
    console.error('Intelligence sources POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to create source'
    }), {
      status: 500,
      headers: getCorsHeaders(request)
    });
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const body = await request.json();
    const { id, name, source_type, url: sourceUrl, config, category, territory, poll_interval_minutes, is_active } = body;

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Source ID is required'
      }), {
        status: 400,
        headers: getCorsHeaders(request)
      });
    }

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

    // Build update
    const updates = ['updated_at = unixepoch()'];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (source_type !== undefined) {
      if (!VALID_SOURCE_TYPES.includes(source_type)) {
        return new Response(JSON.stringify({
          success: false,
          error: `Invalid source_type. Must be one of: ${VALID_SOURCE_TYPES.join(', ')}`
        }), {
          status: 400,
          headers: getCorsHeaders(request)
        });
      }
      updates.push('source_type = ?');
      params.push(source_type);
    }
    if (sourceUrl !== undefined) {
      updates.push('url = ?');
      params.push(sourceUrl);
    }
    if (config !== undefined) {
      updates.push('config_json = ?');
      params.push(JSON.stringify(config));
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (territory !== undefined) {
      updates.push('territory = ?');
      params.push(territory);
    }
    if (poll_interval_minutes !== undefined) {
      updates.push('poll_interval_minutes = ?');
      params.push(poll_interval_minutes);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    params.push(id);

    await env.DB.prepare(`
      UPDATE intel_feed_sources SET ${updates.join(', ')} WHERE id = ?
    `).bind(...params).run();

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
    console.error('Intelligence sources PUT error:', error);
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
  const { env, request } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Source ID is required'
      }), {
        status: 400,
        headers: getCorsHeaders(request)
      });
    }

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

    // Delete source and associated items
    await env.DB.prepare('DELETE FROM intel_feed_items WHERE source_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM intel_feed_sources WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Source and associated items deleted'
    }), {
      status: 200,
      headers: getCorsHeaders(request)
    });

  } catch (error) {
    console.error('Intelligence sources DELETE error:', error);
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
