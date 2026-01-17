/**
 * Beacon Content Sources CRUD
 *
 * GET /api/admin/beacon/sources - List all sources
 * POST /api/admin/beacon/sources - Create new source
 * PUT /api/admin/beacon/sources - Update source (requires id in body)
 * DELETE /api/admin/beacon/sources - Delete source (requires id in body)
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

// Valid source types
const VALID_TYPES = ['reddit', 'rss', 'web_scrape', 'notebooklm', 'manual', 'toast_central', 'toast_classroom'];

/**
 * GET - List all content sources
 */
export async function onRequestGet(context) {
  const { env } = context;

  try {
    const result = await env.DB.prepare(`
      SELECT
        s.*,
        (SELECT COUNT(*) FROM beacon_content_items WHERE source_id = s.id) as item_count,
        (SELECT COUNT(*) FROM beacon_content_items WHERE source_id = s.id AND status = 'pending') as pending_count
      FROM beacon_sources s
      ORDER BY enabled DESC, name ASC
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: result.results || []
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Beacon sources GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to fetch sources'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * POST - Create new source
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const data = await request.json();
    const { name, type, config, enabled = true, fetch_frequency_minutes = 60 } = data;

    // Validation
    if (!name || !type) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Name and type are required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!VALID_TYPES.includes(type)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const id = `src_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
    const configJson = config ? JSON.stringify(config) : null;

    await env.DB.prepare(`
      INSERT INTO beacon_sources (id, name, type, config_json, enabled, fetch_frequency_minutes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, name, type, configJson, enabled ? 1 : 0, fetch_frequency_minutes).run();

    // Fetch the created source
    const newSource = await env.DB.prepare('SELECT * FROM beacon_sources WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      message: 'Source created',
      data: newSource
    }), {
      status: 201,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Beacon sources POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to create source'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * PUT - Update source
 */
export async function onRequestPut(context) {
  const { request, env } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const data = await request.json();
    const { id, name, type, config, enabled, fetch_frequency_minutes } = data;

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Source ID is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Check source exists
    const existing = await env.DB.prepare('SELECT * FROM beacon_sources WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Source not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (type !== undefined) {
      if (!VALID_TYPES.includes(type)) {
        return new Response(JSON.stringify({
          success: false,
          error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      updates.push('type = ?');
      params.push(type);
    }
    if (config !== undefined) {
      updates.push('config_json = ?');
      params.push(JSON.stringify(config));
    }
    if (enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(enabled ? 1 : 0);
    }
    if (fetch_frequency_minutes !== undefined) {
      updates.push('fetch_frequency_minutes = ?');
      params.push(fetch_frequency_minutes);
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
      UPDATE beacon_sources SET ${updates.join(', ')} WHERE id = ?
    `).bind(...params).run();

    const updated = await env.DB.prepare('SELECT * FROM beacon_sources WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      message: 'Source updated',
      data: updated
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Beacon sources PUT error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to update source'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * DELETE - Delete source
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
        error: 'Source ID is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Check source exists
    const existing = await env.DB.prepare('SELECT * FROM beacon_sources WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Source not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Delete source (content items will have source_id set to NULL due to ON DELETE SET NULL)
    await env.DB.prepare('DELETE FROM beacon_sources WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Source deleted'
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Beacon sources DELETE error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to delete source'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
