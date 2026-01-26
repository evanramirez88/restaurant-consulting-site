/**
 * Automation Rules API - Individual Rule Operations
 *
 * GET /api/automation/rules/:id - Get a single rule
 * PATCH /api/automation/rules/:id - Update a rule
 * DELETE /api/automation/rules/:id - Delete a rule
 */

import { verifyAuth, unauthorizedResponse, getCorsHeaders, handleOptions } from '../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, context.request);
    }

    const db = context.env.DB;
    const { id } = context.params;

    const rule = await db.prepare(`
      SELECT
        ar.id,
        ar.rule_name as name,
        ar.rule_description as description,
        ar.rule_category as category,
        ar.rule_logic_json as logic,
        ar.is_active as enabled,
        ar.is_default,
        ar.applies_to_restaurant_type,
        ar.applies_to_pos_version,
        ar.created_at,
        ar.updated_at
      FROM automation_rules ar
      WHERE ar.id = ?
    `).bind(id).first();

    if (!rule) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rule not found'
      }), {
        status: 404,
        headers: getCorsHeaders(context.request)
      });
    }

    // Parse logic
    let logic = {};
    try {
      logic = rule.logic ? JSON.parse(rule.logic) : {};
    } catch (e) {
      logic = {};
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: rule.id,
        name: rule.name,
        description: rule.description || '',
        category: rule.category,
        trigger: {
          type: logic.trigger_type || 'schedule',
          schedule: logic.schedule,
          event: logic.event,
          threshold: logic.threshold
        },
        actions: logic.actions || [],
        enabled: rule.enabled === 1,
        isDefault: rule.is_default === 1,
        appliesToType: rule.applies_to_restaurant_type,
        appliesToVersion: rule.applies_to_pos_version,
        createdAt: rule.created_at ? rule.created_at * 1000 : null,
        updatedAt: rule.updated_at ? rule.updated_at * 1000 : null
      }
    }), {
      headers: getCorsHeaders(context.request)
    });
  } catch (error) {
    console.error('Get automation rule error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: getCorsHeaders(context.request)
    });
  }
}

export async function onRequestPatch(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, context.request);
    }

    const db = context.env.DB;
    const { id } = context.params;
    const body = await context.request.json();

    // Check rule exists
    const existing = await db.prepare('SELECT * FROM automation_rules WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rule not found'
      }), {
        status: 404,
        headers: getCorsHeaders(context.request)
      });
    }

    // Build update
    const updates = [];
    const params = [];

    if (body.name !== undefined) {
      updates.push('rule_name = ?');
      params.push(body.name);
    }

    if (body.description !== undefined) {
      updates.push('rule_description = ?');
      params.push(body.description);
    }

    if (body.category !== undefined) {
      updates.push('rule_category = ?');
      params.push(body.category);
    }

    if (body.enabled !== undefined) {
      updates.push('is_active = ?');
      params.push(body.enabled ? 1 : 0);
    }

    if (body.trigger !== undefined || body.actions !== undefined) {
      // Merge with existing logic
      let existingLogic = {};
      try {
        existingLogic = existing.rule_logic_json ? JSON.parse(existing.rule_logic_json) : {};
      } catch (e) {
        existingLogic = {};
      }

      if (body.trigger) {
        existingLogic.trigger_type = body.trigger.type || existingLogic.trigger_type;
        existingLogic.schedule = body.trigger.schedule || existingLogic.schedule;
        existingLogic.event = body.trigger.event || existingLogic.event;
        existingLogic.threshold = body.trigger.threshold || existingLogic.threshold;
      }

      if (body.actions) {
        existingLogic.actions = body.actions;
      }

      updates.push('rule_logic_json = ?');
      params.push(JSON.stringify(existingLogic));
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No valid fields to update'
      }), {
        status: 400,
        headers: getCorsHeaders(context.request)
      });
    }

    updates.push('updated_at = unixepoch()');
    params.push(id);

    await db.prepare(`
      UPDATE automation_rules SET ${updates.join(', ')} WHERE id = ?
    `).bind(...params).run();

    // Fetch updated rule
    const updated = await db.prepare('SELECT * FROM automation_rules WHERE id = ?').bind(id).first();

    let logic = {};
    try {
      logic = updated.rule_logic_json ? JSON.parse(updated.rule_logic_json) : {};
    } catch (e) {
      logic = {};
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: updated.id,
        name: updated.rule_name,
        description: updated.rule_description || '',
        category: updated.rule_category,
        trigger: {
          type: logic.trigger_type || 'schedule',
          schedule: logic.schedule,
          event: logic.event,
          threshold: logic.threshold
        },
        actions: logic.actions || [],
        enabled: updated.is_active === 1,
        updatedAt: updated.updated_at ? updated.updated_at * 1000 : null
      }
    }), {
      headers: getCorsHeaders(context.request)
    });
  } catch (error) {
    console.error('Update automation rule error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: getCorsHeaders(context.request)
    });
  }
}

export async function onRequestDelete(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, context.request);
    }

    const db = context.env.DB;
    const { id } = context.params;

    // Check rule exists
    const existing = await db.prepare('SELECT * FROM automation_rules WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rule not found'
      }), {
        status: 404,
        headers: getCorsHeaders(context.request)
      });
    }

    // Don't allow deleting default rules
    if (existing.is_default === 1) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot delete default rules'
      }), {
        status: 403,
        headers: getCorsHeaders(context.request)
      });
    }

    await db.prepare('DELETE FROM automation_rules WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Rule deleted successfully'
    }), {
      headers: getCorsHeaders(context.request)
    });
  } catch (error) {
    console.error('Delete automation rule error:', error);
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
