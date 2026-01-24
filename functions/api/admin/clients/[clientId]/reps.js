// Client-Rep Assignment API
// GET /api/admin/clients/:clientId/reps - Get assigned reps for a client
// POST /api/admin/clients/:clientId/reps - Assign a rep to a client

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

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const corsHeaders = getCorsHeaders(request);
  const { clientId } = params;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
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
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Get client reps error:', error);
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
  const { request, env, params } = context;
  const corsHeaders = getCorsHeaders(request);
  const { clientId } = params;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const body = await request.json();
    const { rep_id, referral_source } = body;

    if (!rep_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'rep_id is required'
      }), {
        status: 400,
        headers: corsHeaders
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
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Assign rep error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
