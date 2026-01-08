/**
 * Email Sequences API - List and Create
 *
 * GET /api/admin/email/sequences - List all sequences with optional filters
 * POST /api/admin/email/sequences - Create new sequence
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
    const type = url.searchParams.get('type');

    // Build query with optional filters
    let query = `
      SELECT
        es.*,
        (SELECT COUNT(*) FROM subscriber_sequences ss WHERE ss.sequence_id = es.id) as subscriber_count,
        (SELECT COALESCE(SUM(total_sent), 0) FROM sequence_steps WHERE sequence_id = es.id) as total_sent,
        (SELECT COALESCE(SUM(total_opens), 0) FROM sequence_steps WHERE sequence_id = es.id) as total_opened,
        (SELECT COALESCE(SUM(total_clicks), 0) FROM sequence_steps WHERE sequence_id = es.id) as total_clicked
      FROM email_sequences es
      WHERE 1=1
    `;

    const params = [];

    if (status && status !== 'all') {
      query += ' AND es.status = ?';
      params.push(status);
    }

    if (type && type !== 'all') {
      query += ' AND es.type = ?';
      params.push(type);
    }

    query += ' ORDER BY es.created_at DESC';

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
    console.error('Sequences GET error:', error);
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
        error: 'Sequence name is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate type
    const validTypes = ['drip', 'behavior', 'onboarding', 'reengagement', 'transactional', 'newsletter'];
    if (body.type && !validTypes.includes(body.type)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid sequence type'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate status
    const validStatuses = ['draft', 'active', 'paused', 'completed', 'archived'];
    if (body.status && !validStatuses.includes(body.status)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid sequence status'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db.prepare(`
      INSERT INTO email_sequences (
        id, name, description, type, status,
        trigger_type, trigger_config, settings,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.name.trim(),
      body.description || null,
      body.type || 'drip',
      body.status || 'draft',
      body.trigger_type || 'manual',
      body.trigger_config || null,
      body.settings || null,
      now,
      now
    ).run();

    // Fetch the created sequence
    const sequence = await db.prepare('SELECT * FROM email_sequences WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: sequence
    }), {
      status: 201,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Sequences POST error:', error);
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
