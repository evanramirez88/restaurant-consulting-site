/**
 * A/B Test API - Single Test Operations
 *
 * GET /api/admin/email/ab-tests/[id] - Get single A/B test
 * PUT /api/admin/email/ab-tests/[id] - Update A/B test
 * DELETE /api/admin/email/ab-tests/[id] - Delete A/B test
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
    const testId = context.params.id;

    const test = await db.prepare(`
      SELECT
        ab.*,
        es.name as sequence_name,
        ss.subject as step_subject
      FROM ab_tests ab
      LEFT JOIN email_sequences es ON ab.sequence_id = es.id
      LEFT JOIN sequence_steps ss ON ab.step_id = ss.id
      WHERE ab.id = ?
    `).bind(testId).first();

    if (!test) {
      return new Response(JSON.stringify({
        success: false,
        error: 'A/B test not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: test
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('AB Test GET error:', error);
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
    const testId = context.params.id;
    const body = await context.request.json();

    // Check if test exists
    const existing = await db.prepare('SELECT * FROM ab_tests WHERE id = ?').bind(testId).first();
    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'A/B test not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Only allow editing draft tests
    if (existing.status !== 'draft') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot edit a test that is not in draft status'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name.trim());
    }

    if (body.test_type !== undefined) {
      const validTestTypes = ['subject', 'body', 'sender'];
      if (!validTestTypes.includes(body.test_type)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid test type'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      updates.push('test_type = ?');
      values.push(body.test_type);
    }

    if (body.variant_a_content !== undefined) {
      updates.push('variant_a_content = ?');
      values.push(body.variant_a_content);
    }

    if (body.variant_b_content !== undefined) {
      updates.push('variant_b_content = ?');
      values.push(body.variant_b_content);
    }

    if (body.traffic_split !== undefined) {
      if (body.traffic_split < 10 || body.traffic_split > 50) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Traffic split must be between 10 and 50'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      updates.push('traffic_split = ?');
      values.push(body.traffic_split);
    }

    if (body.winning_metric !== undefined) {
      const validMetrics = ['open_rate', 'click_rate', 'conversion_rate'];
      if (!validMetrics.includes(body.winning_metric)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid winning metric'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      updates.push('winning_metric = ?');
      values.push(body.winning_metric);
    }

    if (body.confidence_level !== undefined) {
      if (body.confidence_level < 0.9 || body.confidence_level > 0.99) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Confidence level must be between 0.90 and 0.99'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      updates.push('confidence_level = ?');
      values.push(body.confidence_level);
    }

    if (body.auto_declare_winner !== undefined) {
      updates.push('auto_declare_winner = ?');
      values.push(body.auto_declare_winner ? 1 : 0);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No valid fields to update'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Add updated_at
    updates.push('updated_at = ?');
    values.push(Math.floor(Date.now() / 1000));

    // Add test ID for WHERE clause
    values.push(testId);

    await db.prepare(`
      UPDATE ab_tests SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();

    // Fetch updated test
    const test = await db.prepare(`
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
      data: test
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('AB Test PUT error:', error);
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
    const testId = context.params.id;

    // Check if test exists
    const existing = await db.prepare('SELECT * FROM ab_tests WHERE id = ?').bind(testId).first();
    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'A/B test not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Delete the test
    await db.prepare('DELETE FROM ab_tests WHERE id = ?').bind(testId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'A/B test deleted successfully'
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('AB Test DELETE error:', error);
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
