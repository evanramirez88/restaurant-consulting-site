/**
 * A/B Test Start API
 *
 * POST /api/admin/email/ab-tests/[id]/start - Start an A/B test
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

    // Check status
    if (test.status !== 'draft') {
      return new Response(JSON.stringify({
        success: false,
        error: `Cannot start a test that is in ${test.status} status`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate variants are set
    if (!test.variant_a_content || !test.variant_b_content) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Both variants must have content before starting the test'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Check that sequence and step exist and are valid
    const step = await db.prepare('SELECT * FROM sequence_steps WHERE id = ?').bind(test.step_id).first();
    if (!step) {
      return new Response(JSON.stringify({
        success: false,
        error: 'The email step for this test no longer exists'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);

    // Update test status
    await db.prepare(`
      UPDATE ab_tests
      SET status = 'running', started_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(now, now, testId).run();

    // Update the sequence step to indicate it's part of an A/B test
    await db.prepare(`
      UPDATE sequence_steps
      SET ab_test_id = ?, updated_at = ?
      WHERE id = ?
    `).bind(testId, now, test.step_id).run();

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
      message: 'A/B test started successfully'
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('AB Test Start error:', error);
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
