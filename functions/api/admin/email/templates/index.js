/**
 * Email Templates API - List and Create
 *
 * GET /api/admin/email/templates - List all templates
 * POST /api/admin/email/templates - Create a new template
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const url = new URL(context.request.url);

    // Optional query parameters
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = `
      SELECT
        id, name, subject, body, is_html,
        created_at, updated_at
      FROM email_templates
    `;
    const params = [];

    if (search) {
      query += ` WHERE name LIKE ? OR subject LIKE ?`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const { results } = await db.prepare(query).bind(...params).all();

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM email_templates';
    if (search) {
      countQuery += ` WHERE name LIKE ? OR subject LIKE ?`;
    }
    const countResult = await db.prepare(countQuery).bind(
      ...(search ? [`%${search}%`, `%${search}%`] : [])
    ).first();

    return new Response(JSON.stringify({
      success: true,
      data: results || [],
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Templates GET error:', error);
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

    // Validate required fields
    if (!body.name || !body.name.trim()) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Template name is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Check for duplicate name
    const existing = await db.prepare(
      'SELECT id FROM email_templates WHERE LOWER(name) = LOWER(?)'
    ).bind(body.name.trim()).first();

    if (existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'A template with this name already exists'
      }), {
        status: 409,
        headers: corsHeaders
      });
    }

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db.prepare(`
      INSERT INTO email_templates (
        id, name, subject, body, is_html, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.name.trim(),
      body.subject || null,
      body.body || null,
      body.is_html ? 1 : 0,
      now,
      now
    ).run();

    const template = await db.prepare(
      'SELECT * FROM email_templates WHERE id = ?'
    ).bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: template
    }), {
      status: 201,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Templates POST error:', error);
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
