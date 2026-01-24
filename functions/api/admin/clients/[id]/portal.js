// API endpoint for toggling client portal status
// POST /api/admin/clients/[id]/portal
// Body: { enabled: boolean }

import { verifyAuth, unauthorizedResponse, getCorsOrigin, handleOptions } from '../../../../_shared/auth.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

export async function onRequestPost(context) {
  const { params, env, request } = context;
  const clientId = params.id;
  const corsHeaders = getCorsHeaders(request);

  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error, request);
  }

  try {
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return new Response(JSON.stringify({ success: false, error: 'enabled must be a boolean' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Update portal_enabled status
    const result = await env.DB.prepare(`
      UPDATE clients
      SET portal_enabled = ?, updated_at = ?
      WHERE id = ?
    `).bind(enabled ? 1 : 0, Date.now(), clientId).run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Client not found' }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Get updated client
    const client = await env.DB.prepare(`
      SELECT * FROM clients WHERE id = ?
    `).bind(clientId).first();

    console.log(`Portal ${enabled ? 'enabled' : 'disabled'} for client ${clientId}`);

    return new Response(JSON.stringify({
      success: true,
      data: client,
      message: `Portal ${enabled ? 'enabled' : 'disabled'} successfully`
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Portal toggle error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to toggle portal status'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const clientId = params.id;
  const corsHeaders = getCorsHeaders(request);

  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error, request);
  }

  try {
    const client = await env.DB.prepare(`
      SELECT id, portal_enabled, slug, email, name, company
      FROM clients WHERE id = ?
    `).bind(clientId).first();

    if (!client) {
      return new Response(JSON.stringify({ success: false, error: 'Client not found' }), {
        status: 404,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: client.id,
        portal_enabled: Boolean(client.portal_enabled),
        slug: client.slug,
        email: client.email,
        name: client.name,
        company: client.company
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Get portal status error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get portal status'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
