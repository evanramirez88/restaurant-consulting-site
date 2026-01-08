/**
 * Email Sequence Duplicate API
 *
 * POST /api/admin/email/sequences/:id/duplicate - Clone a sequence
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;

    // Get the original sequence
    const original = await db.prepare(`
      SELECT * FROM email_sequences WHERE id = ?
    `).bind(id).first();

    if (!original) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Sequence not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Create new sequence with copied data
    const newId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Generate unique name
    let newName = `${original.name} (Copy)`;

    // Check if name already exists and increment if needed
    const { results: existingCopies } = await db.prepare(`
      SELECT name FROM email_sequences WHERE name LIKE ?
    `).bind(`${original.name} (Copy%`).all();

    if (existingCopies && existingCopies.length > 0) {
      // Find the highest copy number
      let maxNum = 0;
      for (const copy of existingCopies) {
        const match = copy.name.match(/\(Copy(?: (\d+))?\)$/);
        if (match) {
          const num = match[1] ? parseInt(match[1]) : 1;
          if (num > maxNum) maxNum = num;
        }
      }
      newName = `${original.name} (Copy ${maxNum + 1})`;
    }

    // Insert new sequence as draft
    await db.prepare(`
      INSERT INTO email_sequences (
        id, name, description, type, status,
        trigger_type, trigger_config, settings,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      newId,
      newName,
      original.description,
      original.type,
      'draft', // Always start as draft
      original.trigger_type,
      original.trigger_config,
      original.settings,
      now,
      now
    ).run();

    // Copy all sequence steps
    const { results: originalSteps } = await db.prepare(`
      SELECT * FROM sequence_steps WHERE sequence_id = ?
    `).bind(id).all();

    if (originalSteps && originalSteps.length > 0) {
      for (const step of originalSteps) {
        const stepId = crypto.randomUUID();
        await db.prepare(`
          INSERT INTO sequence_steps (
            id, sequence_id, step_number, name, subject,
            body_html, body_text, from_name, from_email, reply_to,
            delay_minutes, delay_type, wait_for_open, total_sent,
            total_opened, total_clicked, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
        `).bind(
          stepId,
          newId,
          step.step_number,
          step.name,
          step.subject,
          step.body_html,
          step.body_text,
          step.from_name,
          step.from_email,
          step.reply_to,
          step.delay_minutes,
          step.delay_type,
          step.wait_for_open,
          now,
          now
        ).run();
      }
    }

    // Fetch the new sequence with stats
    const sequence = await db.prepare(`
      SELECT
        es.id,
        es.name,
        es.description,
        es.sequence_type as type,
        es.status,
        es.trigger_type,
        es.trigger_config,
        es.settings,
        es.created_at,
        es.updated_at,
        (SELECT COUNT(*) FROM subscriber_sequences ss WHERE ss.sequence_id = es.id) as subscriber_count,
        (SELECT COALESCE(SUM(total_sent), 0) FROM sequence_steps WHERE sequence_id = es.id) as total_sent,
        (SELECT COALESCE(SUM(total_opens), 0) FROM sequence_steps WHERE sequence_id = es.id) as total_opened,
        (SELECT COALESCE(SUM(total_clicks), 0) FROM sequence_steps WHERE sequence_id = es.id) as total_clicked
      FROM email_sequences es
      WHERE es.id = ?
    `).bind(newId).first();

    return new Response(JSON.stringify({
      success: true,
      data: sequence,
      message: 'Sequence duplicated successfully'
    }), {
      status: 201,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Sequence Duplicate error:', error);
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
