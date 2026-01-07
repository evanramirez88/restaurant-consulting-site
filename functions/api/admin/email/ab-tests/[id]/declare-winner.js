/**
 * A/B Test Declare Winner API
 *
 * POST /api/admin/email/ab-tests/[id]/declare-winner - Declare a winner for the A/B test
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
    const testId = context.params.id;
    const body = await context.request.json();

    // Validate winner
    const winner = body.winner;
    if (!winner || !['A', 'B'].includes(winner)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Winner must be either "A" or "B"'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get the test
    const test = await db.prepare('SELECT * FROM ab_tests WHERE id = ?').bind(testId).first();

    if (!test) {
      return new Response(JSON.stringify({
        success: false,
        error: 'A/B test not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Check status - can only declare winner for running or completed tests
    if (!['running', 'completed'].includes(test.status)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Cannot declare winner for a test in ${test.status} status`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);

    // Update test with winner
    await db.prepare(`
      UPDATE ab_tests
      SET status = 'winner_selected',
          winner_variant = ?,
          ended_at = COALESCE(ended_at, ?),
          updated_at = ?
      WHERE id = ?
    `).bind(winner, now, now, testId).run();

    // Get the winning content
    const winningContent = winner === 'A' ? test.variant_a_content : test.variant_b_content;

    // Optionally update the original step with the winning content
    const applyToStep = body.apply_to_step !== false; // Default to true

    if (applyToStep) {
      const updateField = test.test_type === 'subject' ? 'subject'
        : test.test_type === 'body' ? 'body'
        : 'from_name';

      await db.prepare(`
        UPDATE sequence_steps
        SET ${updateField} = ?,
            ab_test_id = NULL,
            updated_at = ?
        WHERE id = ?
      `).bind(winningContent, now, test.step_id).run();
    } else {
      // Just remove the A/B test reference
      await db.prepare(`
        UPDATE sequence_steps
        SET ab_test_id = NULL, updated_at = ?
        WHERE id = ?
      `).bind(now, test.step_id).run();
    }

    // Fetch updated test
    const updatedTest = await db.prepare(`
      SELECT
        ab.*,
        es.name as sequence_name,
        ss.subject as step_subject
      FROM ab_tests ab
      LEFT JOIN email_sequences es ON ab.sequence_id = es.id
      LEFT JOIN sequence_steps ss ON ab.step_id = ss.id
      WHERE ab.id = ?
    `).bind(testId).first();

    return new Response(JSON.stringify({
      success: true,
      data: updatedTest,
      message: `Variant ${winner} has been declared the winner${applyToStep ? ' and applied to the email step' : ''}`
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('AB Test Declare Winner error:', error);
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
