/**
 * A/B Test Stop API
 *
 * POST /api/admin/email/ab-tests/[id]/stop - Stop a running A/B test
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
    if (test.status !== 'running') {
      return new Response(JSON.stringify({
        success: false,
        error: `Cannot stop a test that is in ${test.status} status`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);

    // Update test status
    await db.prepare(`
      UPDATE ab_tests
      SET status = 'completed', ended_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(now, now, testId).run();

    // Remove A/B test reference from the sequence step
    await db.prepare(`
      UPDATE sequence_steps
      SET ab_test_id = NULL, updated_at = ?
      WHERE id = ?
    `).bind(now, test.step_id).run();

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
      message: 'A/B test stopped successfully'
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('AB Test Stop error:', error);
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
