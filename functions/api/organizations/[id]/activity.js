/**
 * Organization Activity API
 *
 * GET /api/organizations/:id/activity - Get activity feed
 * POST /api/organizations/:id/activity - Log activity
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const { id } = params;
  const url = new URL(request.url);

  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const type = url.searchParams.get('type');

  try {
    const db = env.DB;

    let query = `
      SELECT * FROM unified_activity_log
      WHERE organization_id = ?
    `;
    const params_arr = [id];

    if (type) {
      query += ` AND activity_type = ?`;
      params_arr.push(type);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params_arr.push(limit, offset);

    const activity = await db.prepare(query).bind(...params_arr).all();

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM unified_activity_log WHERE organization_id = ?`;
    const countParams = [id];
    if (type) {
      countQuery += ` AND activity_type = ?`;
      countParams.push(type);
    }
    const countResult = await db.prepare(countQuery).bind(...countParams).first();

    return new Response(JSON.stringify({
      success: true,
      data: activity.results,
      pagination: {
        total: countResult.total,
        limit,
        offset,
        hasMore: offset + activity.results.length < countResult.total
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Get activity error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch activity'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPost(context) {
  const { params, env, request } = context;
  const { id } = params;

  try {
    const body = await request.json();
    const db = env.DB;

    // Verify organization exists
    const org = await db.prepare('SELECT id FROM organizations WHERE id = ?').bind(id).first();
    if (!org) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Organization not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    if (!body.activity_type || !body.title) {
      return new Response(JSON.stringify({
        success: false,
        error: 'activity_type and title are required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const activityId = 'act_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);

    await db.prepare(`
      INSERT INTO unified_activity_log (
        id, organization_id, contact_id, client_account_id, location_id,
        activity_type, title, description, metadata_json,
        ticket_id, project_id, deal_id, email_log_id, quote_id,
        performed_by_type, performed_by_id, performed_by_name,
        is_internal, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    `).bind(
      activityId,
      id,
      body.contact_id || null,
      body.client_account_id || null,
      body.location_id || null,
      body.activity_type,
      body.title,
      body.description || null,
      body.metadata ? JSON.stringify(body.metadata) : null,
      body.ticket_id || null,
      body.project_id || null,
      body.deal_id || null,
      body.email_log_id || null,
      body.quote_id || null,
      body.performed_by_type || 'system',
      body.performed_by_id || null,
      body.performed_by_name || null,
      body.is_internal ? 1 : 0
    ).run();

    const activity = await db.prepare('SELECT * FROM unified_activity_log WHERE id = ?').bind(activityId).first();

    return new Response(JSON.stringify({
      success: true,
      data: activity
    }), {
      status: 201,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Create activity error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to log activity'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
