// API endpoint for toggling client portal status
// POST /api/admin/clients/[id]/portal
// Body: { enabled: boolean }

export async function onRequestPost(context) {
  const { params, env, request } = context;
  const clientId = params.id;
  
  // Verify admin auth
  const authCookie = request.headers.get('Cookie')?.match(/admin_session=([^;]+)/)?.[1];
  if (!authCookie) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { enabled } = body;
    
    if (typeof enabled !== 'boolean') {
      return Response.json({ success: false, error: 'enabled must be a boolean' }, { status: 400 });
    }
    
    // Update portal_enabled status
    const result = await env.DB.prepare(`
      UPDATE clients 
      SET portal_enabled = ?, updated_at = ?
      WHERE id = ?
    `).bind(enabled ? 1 : 0, Date.now(), clientId).run();
    
    if (result.changes === 0) {
      return Response.json({ success: false, error: 'Client not found' }, { status: 404 });
    }
    
    // Get updated client
    const client = await env.DB.prepare(`
      SELECT * FROM clients WHERE id = ?
    `).bind(clientId).first();
    
    // Log the action
    console.log(`Portal ${enabled ? 'enabled' : 'disabled'} for client ${clientId}`);
    
    // TODO: If enabling portal, send welcome email with magic link
    // if (enabled && client?.email) {
    //   await sendPortalWelcomeEmail(client.email, client.slug);
    // }
    
    return Response.json({
      success: true,
      data: client,
      message: `Portal ${enabled ? 'enabled' : 'disabled'} successfully`
    });
    
  } catch (error) {
    console.error('Portal toggle error:', error);
    return Response.json({ 
      success: false, 
      error: 'Failed to toggle portal status' 
    }, { status: 500 });
  }
}

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const clientId = params.id;
  
  // Verify admin auth
  const authCookie = request.headers.get('Cookie')?.match(/admin_session=([^;]+)/)?.[1];
  if (!authCookie) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const client = await env.DB.prepare(`
      SELECT id, portal_enabled, slug, email, name, company
      FROM clients WHERE id = ?
    `).bind(clientId).first();
    
    if (!client) {
      return Response.json({ success: false, error: 'Client not found' }, { status: 404 });
    }
    
    return Response.json({
      success: true,
      data: {
        id: client.id,
        portal_enabled: Boolean(client.portal_enabled),
        slug: client.slug,
        email: client.email,
        name: client.name,
        company: client.company
      }
    });
    
  } catch (error) {
    console.error('Get portal status error:', error);
    return Response.json({ 
      success: false, 
      error: 'Failed to get portal status' 
    }, { status: 500 });
  }
}
