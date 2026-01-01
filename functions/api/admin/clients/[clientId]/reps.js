// Client-Rep Assignment API
// GET /api/admin/clients/:clientId/reps - Get assigned reps for a client
// POST /api/admin/clients/:clientId/reps - Assign a rep to a client

export async function onRequestGet(context) {
  try {
    const { env, params } = context;
    const { clientId } = params;

    // Check admin auth
    const authCookie = context.request.headers.get('Cookie')?.match(/admin_session=([^;]+)/)?.[1];
    if (!authCookie) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get assigned reps for this client
    const result = await env.DB.prepare(`
      SELECT r.id, r.name, r.email, r.territory, r.slug, r.status,
             cra.assigned_at, cra.referral_source
      FROM client_rep_assignments cra
      JOIN reps r ON cra.rep_id = r.id
      WHERE cra.client_id = ?
      ORDER BY cra.assigned_at DESC
    `).bind(clientId).all();

    return new Response(JSON.stringify({
      success: true,
      data: result.results || []
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get client reps error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  try {
    const { env, request, params } = context;
    const { clientId } = params;

    // Check admin auth
    const authCookie = request.headers.get('Cookie')?.match(/admin_session=([^;]+)/)?.[1];
    if (!authCookie) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { rep_id, referral_source } = body;

    if (!rep_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'rep_id is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create the assignment
    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO client_rep_assignments (id, client_id, rep_id, referral_source, assigned_at)
      VALUES (?, ?, ?, ?, unixepoch())
      ON CONFLICT(client_id, rep_id) DO NOTHING
    `).bind(id, clientId, rep_id, referral_source || null).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Rep assigned successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Assign rep error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
