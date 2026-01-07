/**
 * Sequence Steps Reorder API
 *
 * PUT /api/admin/email/sequences/:id/steps/reorder - Reorder steps
 *
 * Expects body: { steps: [{ id: string, step_order: number }, ...] }
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../../../_shared/auth.js';

export async function onRequestPut(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const sequenceId = context.params.id;
    const body = await context.request.json();

    // Verify sequence exists
    const sequence = await db.prepare(
      'SELECT id FROM email_sequences WHERE id = ?'
    ).bind(sequenceId).first();

    if (!sequence) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Sequence not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Validate input
    if (!body.steps || !Array.isArray(body.steps)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'steps array is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate each step in the array
    for (const step of body.steps) {
      if (!step.id || typeof step.step_order !== 'number') {
        return new Response(JSON.stringify({
          success: false,
          error: 'Each step must have an id and step_order'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
    }

    const now = Math.floor(Date.now() / 1000);

    // Update each step's order in a transaction-like manner
    // Note: D1 doesn't support true transactions, so we do our best
    const updates = [];
    for (const step of body.steps) {
      // Skip temp IDs (they should be created first)
      if (step.id.startsWith('temp_')) {
        continue;
      }

      const result = await db.prepare(`
        UPDATE sequence_steps
        SET step_order = ?, updated_at = ?
        WHERE id = ? AND sequence_id = ?
      `).bind(step.step_order, now, step.id, sequenceId).run();

      updates.push({
        id: step.id,
        step_order: step.step_order,
        success: result.success
      });
    }

    // Fetch the updated steps
    const { results } = await db.prepare(`
      SELECT * FROM sequence_steps
      WHERE sequence_id = ?
      ORDER BY step_order ASC
    `).bind(sequenceId).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || [],
      updates
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Steps reorder error:', error);
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
