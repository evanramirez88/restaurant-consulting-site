/**
 * Client Atomic Facts API
 *
 * GET /api/admin/intelligence/facts - List facts with filters
 * POST /api/admin/intelligence/facts - Create a new fact manually
 */

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';
    const clientId = url.searchParams.get('client_id');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    let query = `
      SELECT
        f.id,
        f.client_id,
        c.name as client_name,
        c.company as client_company,
        f.field_name,
        f.field_value,
        f.original_text,
        f.source,
        f.source_file,
        f.confidence,
        f.status,
        f.reviewed_by,
        f.reviewed_at,
        f.rejection_reason,
        f.created_at,
        ai.name as ai_provider_name
      FROM client_atomic_facts f
      JOIN clients c ON f.client_id = c.id
      LEFT JOIN ai_providers ai ON f.ai_provider_id = ai.id
      WHERE 1=1
    `;
    const params = [];

    if (status !== 'all') {
      query += ' AND f.status = ?';
      params.push(status);
    }

    if (clientId) {
      query += ' AND f.client_id = ?';
      params.push(clientId);
    }

    query += ' ORDER BY f.confidence DESC, f.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const facts = await env.DB.prepare(query).bind(...params).all();

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM client_atomic_facts f WHERE 1=1';
    const countParams = [];
    if (status !== 'all') {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    if (clientId) {
      countQuery += ' AND client_id = ?';
      countParams.push(clientId);
    }

    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

    return Response.json({
      success: true,
      facts: facts.results || [],
      total: countResult?.total || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Facts GET error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { client_id, field_name, field_value, original_text, source, confidence } = body;

    if (!client_id || !field_name || field_value === undefined) {
      return Response.json({
        success: false,
        error: 'Missing required fields: client_id, field_name, field_value',
      }, { status: 400 });
    }

    // Verify client exists
    const client = await env.DB.prepare(
      'SELECT id FROM clients WHERE id = ?'
    ).bind(client_id).first();

    if (!client) {
      return Response.json({
        success: false,
        error: 'Client not found',
      }, { status: 404 });
    }

    // Generate ID
    const id = 'fact_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);

    // Insert fact
    await env.DB.prepare(`
      INSERT INTO client_atomic_facts (id, client_id, field_name, field_value, original_text, source, confidence, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', unixepoch())
    `).bind(
      id,
      client_id,
      field_name,
      String(field_value),
      original_text || null,
      source || 'manual',
      confidence || 1.0
    ).run();

    return Response.json({
      success: true,
      id,
      message: 'Fact created successfully',
    });
  } catch (error) {
    console.error('Facts POST error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
