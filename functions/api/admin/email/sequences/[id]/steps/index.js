/**
 * Sequence Steps API - List and Create
 *
 * GET /api/admin/email/sequences/:id/steps - List all steps for a sequence
 * POST /api/admin/email/sequences/:id/steps - Create a new step
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
    const sequenceId = context.params.id;

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

    // Get all steps for this sequence, ordered by step_order
    const { results } = await db.prepare(`
      SELECT
        id, sequence_id, step_order, step_type,
        subject, body, from_name,
        delay_amount, delay_unit,
        condition_type, condition_action,
        ab_variant_id, ab_variant_subject, ab_variant_body,
        created_at, updated_at
      FROM sequence_steps
      WHERE sequence_id = ?
      ORDER BY step_order ASC
    `).bind(sequenceId).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Steps GET error:', error);
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

    // Validate step type
    const validStepTypes = ['email', 'delay', 'condition'];
    if (!body.step_type || !validStepTypes.includes(body.step_type)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid step type. Must be: email, delay, or condition'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get the next step order
    const maxOrderResult = await db.prepare(
      'SELECT MAX(step_order) as max_order FROM sequence_steps WHERE sequence_id = ?'
    ).bind(sequenceId).first();
    const nextOrder = (maxOrderResult?.max_order ?? -1) + 1;

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db.prepare(`
      INSERT INTO sequence_steps (
        id, sequence_id, step_order, step_type,
        subject, body, from_name,
        delay_amount, delay_unit,
        condition_type, condition_action,
        ab_variant_id, ab_variant_subject, ab_variant_body,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      sequenceId,
      body.step_order ?? nextOrder,
      body.step_type,
      body.subject || null,
      body.body || null,
      body.from_name || null,
      body.delay_amount || null,
      body.delay_unit || null,
      body.condition_type || null,
      body.condition_action || null,
      body.ab_variant_id || null,
      body.ab_variant_subject || null,
      body.ab_variant_body || null,
      now,
      now
    ).run();

    const step = await db.prepare(
      'SELECT * FROM sequence_steps WHERE id = ?'
    ).bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: step
    }), {
      status: 201,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Steps POST error:', error);
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
