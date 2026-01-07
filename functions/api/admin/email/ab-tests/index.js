/**
 * A/B Tests API - List and Create
 *
 * GET /api/admin/email/ab-tests - List all A/B tests with optional filters
 * POST /api/admin/email/ab-tests - Create new A/B test
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
    const url = new URL(context.request.url);

    // Get query parameters for filtering
    const status = url.searchParams.get('status');
    const sequenceId = url.searchParams.get('sequence_id');

    // Build query with optional filters
    let query = `
      SELECT
        ab.*,
        es.name as sequence_name,
        ss.subject as step_subject
      FROM ab_tests ab
      LEFT JOIN email_sequences es ON ab.sequence_id = es.id
      LEFT JOIN sequence_steps ss ON ab.step_id = ss.id
      WHERE 1=1
    `;

    const params = [];

    if (status && status !== 'all') {
      query += ' AND ab.status = ?';
      params.push(status);
    }

    if (sequenceId) {
      query += ' AND ab.sequence_id = ?';
      params.push(sequenceId);
    }

    query += ' ORDER BY ab.created_at DESC';

    const stmt = db.prepare(query);
    const { results } = params.length > 0
      ? await stmt.bind(...params).all()
      : await stmt.all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('AB Tests GET error:', error);
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
    const body = await context.request.json();

    // Validate required fields
    if (!body.name || !body.name.trim()) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Test name is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!body.sequence_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Sequence ID is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!body.step_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Step ID is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate test_type
    const validTestTypes = ['subject', 'body', 'sender'];
    if (body.test_type && !validTestTypes.includes(body.test_type)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid test type'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate winning_metric
    const validMetrics = ['open_rate', 'click_rate', 'conversion_rate'];
    if (body.winning_metric && !validMetrics.includes(body.winning_metric)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid winning metric'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate traffic_split
    const trafficSplit = body.traffic_split || 50;
    if (trafficSplit < 10 || trafficSplit > 50) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Traffic split must be between 10 and 50'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate confidence_level
    const confidenceLevel = body.confidence_level || 0.95;
    if (confidenceLevel < 0.9 || confidenceLevel > 0.99) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Confidence level must be between 0.90 and 0.99'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db.prepare(`
      INSERT INTO ab_tests (
        id, sequence_id, step_id, name, status, test_type,
        variant_a_content, variant_b_content, traffic_split,
        winning_metric, confidence_level, auto_declare_winner,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.sequence_id,
      body.step_id,
      body.name.trim(),
      'draft',
      body.test_type || 'subject',
      body.variant_a_content || '',
      body.variant_b_content || '',
      trafficSplit,
      body.winning_metric || 'open_rate',
      confidenceLevel,
      body.auto_declare_winner ? 1 : 0,
      now,
      now
    ).run();

    // Fetch the created test with joined data
    const test = await db.prepare(`
      SELECT
        ab.*,
        es.name as sequence_name,
        ss.subject as step_subject
      FROM ab_tests ab
      LEFT JOIN email_sequences es ON ab.sequence_id = es.id
      LEFT JOIN sequence_steps ss ON ab.step_id = ss.id
      WHERE ab.id = ?
    `).bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: test
    }), {
      status: 201,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('AB Tests POST error:', error);
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
