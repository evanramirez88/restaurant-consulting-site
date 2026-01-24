// Client-Rep Unassignment API
// DELETE /api/admin/clients/:clientId/reps/:repId - Unassign a rep from a client

import { verifyAuth, unauthorizedResponse, getCorsOrigin, handleOptions } from '../../../../../_shared/auth.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const corsHeaders = getCorsHeaders(request);
  const { clientId, repId } = params;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    // Delete the assignment
    await env.DB.prepare(`
      DELETE FROM client_rep_assignments
      WHERE client_id = ? AND rep_id = ?
    `).bind(clientId, repId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Rep unassigned successfully'
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Unassign rep error:', error);
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
