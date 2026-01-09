// Site Content Management API
// GET: List all site content blocks
// POST: Create or update content blocks
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    const { env } = context;

    // Verify authentication
    const auth = await verifyAuth(context.request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const result = await env.DB.prepare(`
      SELECT id, page, section, content_key, content_value, content_type, is_editable, updated_at
      FROM site_content
      ORDER BY page, section, content_key
    `).all();

    // Group by page and section for easier UI consumption
    const grouped = {};
    for (const row of result.results || []) {
      if (!grouped[row.page]) grouped[row.page] = {};
      if (!grouped[row.page][row.section]) grouped[row.page][row.section] = [];
      grouped[row.page][row.section].push(row);
    }

    return new Response(JSON.stringify({
      success: true,
      data: result.results || [],
      grouped
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

export async function onRequestPost(context) {
  try {
    const { env, request } = context;

    // Verify authentication
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();
    const { page, section, content_key, content_value, content_type = 'text' } = body;

    if (!page || !section || !content_key) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: page, section, content_key'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const id = `${page}_${section}_${content_key}`;

    await env.DB.prepare(`
      INSERT INTO site_content (id, page, section, content_key, content_value, content_type, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, unixepoch())
      ON CONFLICT(page, section, content_key) DO UPDATE SET
        content_value = excluded.content_value,
        content_type = excluded.content_type,
        updated_at = unixepoch()
    `).bind(id, page, section, content_key, content_value || '', content_type).run();

    return new Response(JSON.stringify({
      success: true,
      data: { id, page, section, content_key, content_value, content_type }
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
    const { env, request } = context;

    // Verify authentication
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing content ID'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    await env.DB.prepare('DELETE FROM site_content WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({ success: true }), {
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
