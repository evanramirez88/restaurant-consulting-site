/**
 * Individual Sequence Step API - Get, Update, Delete
 *
 * GET /api/admin/email/sequences/:id/steps/:stepId - Get a specific step
 * PUT /api/admin/email/sequences/:id/steps/:stepId - Update a step
 * DELETE /api/admin/email/sequences/:id/steps/:stepId - Delete a step
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id: sequenceId, stepId } = context.params;

    const step = await db.prepare(`
      SELECT * FROM sequence_steps
      WHERE id = ? AND sequence_id = ?
    `).bind(stepId, sequenceId).first();

    if (!step) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Step not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: step
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Step GET error:', error);
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
    const { id: sequenceId, stepId } = context.params;
    const body = await context.request.json();

    // Verify step exists
    const existingStep = await db.prepare(`
      SELECT * FROM sequence_steps
      WHERE id = ? AND sequence_id = ?
    `).bind(stepId, sequenceId).first();

    if (!existingStep) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Step not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Validate step type if provided
    if (body.step_type) {
      const validStepTypes = ['email', 'delay', 'condition'];
      if (!validStepTypes.includes(body.step_type)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid step type. Must be: email, delay, or condition'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
    }

    const now = Math.floor(Date.now() / 1000);

    // Build dynamic update query
    const updates = [];
    const values = [];

    const fields = [
      'step_order', 'step_type',
      'subject', 'body', 'from_name',
      'delay_amount', 'delay_unit',
      'condition_type', 'condition_action',
      'ab_variant_id', 'ab_variant_subject', 'ab_variant_body'
    ];

    for (const field of fields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field] === '' ? null : body[field]);
      }
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        data: existingStep,
        message: 'No changes to update'
      }), {
        headers: corsHeaders
      });
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(stepId);
    values.push(sequenceId);

    await db.prepare(`
      UPDATE sequence_steps
      SET ${updates.join(', ')}
      WHERE id = ? AND sequence_id = ?
    `).bind(...values).run();

    const updatedStep = await db.prepare(
      'SELECT * FROM sequence_steps WHERE id = ?'
    ).bind(stepId).first();

    return new Response(JSON.stringify({
      success: true,
      data: updatedStep
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Step PUT error:', error);
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
    const { id: sequenceId, stepId } = context.params;

    // Verify step exists
    const existingStep = await db.prepare(`
      SELECT * FROM sequence_steps
      WHERE id = ? AND sequence_id = ?
    `).bind(stepId, sequenceId).first();

    if (!existingStep) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Step not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Delete the step
    await db.prepare(`
      DELETE FROM sequence_steps
      WHERE id = ? AND sequence_id = ?
    `).bind(stepId, sequenceId).run();

    // Reorder remaining steps to close the gap
    const { results: remainingSteps } = await db.prepare(`
      SELECT id FROM sequence_steps
      WHERE sequence_id = ?
      ORDER BY step_order ASC
    `).bind(sequenceId).all();

    // Update step_order for each remaining step
    for (let i = 0; i < remainingSteps.length; i++) {
      await db.prepare(`
        UPDATE sequence_steps
        SET step_order = ?
        WHERE id = ?
      `).bind(i, remainingSteps[i].id).run();
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Step deleted successfully'
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Step DELETE error:', error);
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
