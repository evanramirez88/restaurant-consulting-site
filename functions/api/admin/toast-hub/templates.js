// Toast Hub Templates API
// GET /api/admin/toast-hub/templates - List all templates
// POST /api/admin/toast-hub/templates - Create a new template
import { verifyAuth, unauthorizedResponse, getCorsHeaders, handleOptions } from '../../../_shared/auth.js';

export async function onRequestGet(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, context.request);
    }

    const db = context.env.DB;
    const url = new URL(context.request.url);
    const type = url.searchParams.get('type');
    const activeOnly = url.searchParams.get('active') !== 'false';

    let query = `
      SELECT * FROM toast_hub_templates
      WHERE 1=1
    `;
    const params = [];

    if (activeOnly) {
      query += ' AND is_active = 1';
    }

    if (type) {
      query += ' AND template_type = ?';
      params.push(type);
    }

    query += ' ORDER BY usage_count DESC, name ASC';

    const stmt = db.prepare(query);
    const { results } = params.length > 0
      ? await stmt.bind(...params).all()
      : await stmt.all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: getCorsHeaders(context.request)
    });
  }
}

export async function onRequestPost(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, context.request);
    }

    const db = context.env.DB;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    const { name, description, template_type, default_content, variables_json, thumbnail_url } = body;

    if (!name || !template_type) {
      return new Response(JSON.stringify({
        success: false,
        error: 'name and template_type are required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const validTypes = ['article', 'guide', 'faq', 'announcement', 'case_study', 'tutorial'];
    if (!validTypes.includes(template_type)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid template_type. Must be one of: ${validTypes.join(', ')}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const id = crypto.randomUUID();

    await db.prepare(`
      INSERT INTO toast_hub_templates (
        id, name, description, template_type, default_content,
        variables_json, thumbnail_url, usage_count, is_active,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?)
    `).bind(
      id,
      name,
      description || null,
      template_type,
      default_content || null,
      variables_json || null,
      thumbnail_url || null,
      auth.payload?.sub || 'admin',
      now,
      now
    ).run();

    const template = await db.prepare('SELECT * FROM toast_hub_templates WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: template
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: getCorsHeaders(context.request)
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
