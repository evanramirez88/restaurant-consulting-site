// Toast Hub Sources API - Content Source Management
// Manages RSS feeds, Reddit sources, and internal data sources
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

/**
 * GET /api/admin/toast-hub/sources
 * List all content sources with stats
 */
export async function onRequestGet(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const url = new URL(context.request.url);
    const type = url.searchParams.get('type'); // rss, reddit, api, manual, data_context
    const active = url.searchParams.get('active'); // '1' or '0'

    let query = `
      SELECT
        s.*,
        COUNT(DISTINCT i.id) as total_imports,
        SUM(CASE WHEN i.status = 'pending' THEN 1 ELSE 0 END) as pending_imports,
        SUM(CASE WHEN i.status = 'approved' THEN 1 ELSE 0 END) as approved_imports
      FROM toast_hub_sources s
      LEFT JOIN toast_hub_imports i ON s.id = i.source_id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      query += ' AND s.source_type = ?';
      params.push(type);
    }

    if (active !== null && active !== undefined) {
      query += ' AND s.is_active = ?';
      params.push(parseInt(active));
    }

    query += ' GROUP BY s.id ORDER BY s.name ASC';

    const { results } = await db.prepare(query).bind(...params).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/admin/toast-hub/sources
 * Create a new content source
 */
export async function onRequestPost(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    // Validate required fields
    if (!body.name || !body.source_type) {
      return new Response(JSON.stringify({
        success: false,
        error: 'name and source_type are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate source_type
    const validTypes = ['rss', 'reddit', 'api', 'manual', 'data_context'];
    if (!validTypes.includes(body.source_type)) {
      return new Response(JSON.stringify({
        success: false,
        error: `source_type must be one of: ${validTypes.join(', ')}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // RSS and Reddit require feed_url
    if (['rss', 'reddit'].includes(body.source_type) && !body.feed_url) {
      return new Response(JSON.stringify({
        success: false,
        error: 'feed_url is required for RSS and Reddit sources'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const id = generateId('src');

    await db.prepare(`
      INSERT INTO toast_hub_sources (
        id, name, source_type, feed_url, category_id,
        fetch_frequency_minutes, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.name,
      body.source_type,
      body.feed_url || null,
      body.category_id || null,
      body.fetch_frequency_minutes || 120,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
      now,
      now
    ).run();

    const created = await db.prepare('SELECT * FROM toast_hub_sources WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: created
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
