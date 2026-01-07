/**
 * Individual Email Template API - Get, Update, Delete
 *
 * GET /api/admin/email/templates/:id - Get a specific template
 * PUT /api/admin/email/templates/:id - Update a template
 * DELETE /api/admin/email/templates/:id - Delete a template
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
    const templateId = context.params.id;

    const template = await db.prepare(`
      SELECT * FROM email_templates WHERE id = ?
    `).bind(templateId).first();

    if (!template) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Template not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: template
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Template GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPut(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const templateId = context.params.id;
    const body = await context.request.json();

    // Verify template exists
    const existingTemplate = await db.prepare(
      'SELECT * FROM email_templates WHERE id = ?'
    ).bind(templateId).first();

    if (!existingTemplate) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Template not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // If name is being changed, check for duplicates
    if (body.name && body.name.trim().toLowerCase() !== existingTemplate.name.toLowerCase()) {
      const duplicate = await db.prepare(
        'SELECT id FROM email_templates WHERE LOWER(name) = LOWER(?) AND id != ?'
      ).bind(body.name.trim(), templateId).first();

      if (duplicate) {
        return new Response(JSON.stringify({
          success: false,
          error: 'A template with this name already exists'
        }), {
          status: 409,
          headers: corsHeaders
        });
      }
    }

    const now = Math.floor(Date.now() / 1000);

    // Build dynamic update query
    const updates = [];
    const values = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name.trim());
    }
    if (body.subject !== undefined) {
      updates.push('subject = ?');
      values.push(body.subject || null);
    }
    if (body.body !== undefined) {
      updates.push('body = ?');
      values.push(body.body || null);
    }
    if (body.is_html !== undefined) {
      updates.push('is_html = ?');
      values.push(body.is_html ? 1 : 0);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        data: existingTemplate,
        message: 'No changes to update'
      }), {
        headers: corsHeaders
      });
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(templateId);

    await db.prepare(`
      UPDATE email_templates
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...values).run();

    const updatedTemplate = await db.prepare(
      'SELECT * FROM email_templates WHERE id = ?'
    ).bind(templateId).first();

    return new Response(JSON.stringify({
      success: true,
      data: updatedTemplate
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Template PUT error:', error);
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
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const templateId = context.params.id;

    // Verify template exists
    const existingTemplate = await db.prepare(
      'SELECT * FROM email_templates WHERE id = ?'
    ).bind(templateId).first();

    if (!existingTemplate) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Template not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Check if template is being used by any sequence steps
    // This is a soft check - we don't have a direct reference but could check body/subject content
    // For now, we allow deletion

    await db.prepare(
      'DELETE FROM email_templates WHERE id = ?'
    ).bind(templateId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Template deleted successfully'
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Template DELETE error:', error);
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
