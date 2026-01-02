/**
 * Contract Status & Management API
 *
 * GET /api/contracts/:id - Get contract status
 * DELETE /api/contracts/:id - Void/delete a contract
 *
 * Requires admin authentication or client ownership.
 */

import {
  isPandaDocEnabled,
  getDocumentStatus,
  deleteDocument,
  getSigningLink,
  downloadDocument
} from '../_shared/pandadoc.js';
import { verifyAuth, verifyClientAuth, unauthorizedResponse, corsHeaders } from '../../_shared/auth.js';

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const contractId = params.id;

  try {
    if (!isPandaDocEnabled(env)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'PandaDoc not configured'
      }), {
        status: 503,
        headers: corsHeaders
      });
    }

    // Verify authentication (admin or client)
    const adminAuth = await verifyAuth(request, env);
    const clientAuth = !adminAuth.authenticated
      ? await verifyClientAuth(request, env)
      : { authenticated: false };

    if (!adminAuth.authenticated && !clientAuth.authenticated) {
      return unauthorizedResponse('Authentication required');
    }

    const status = await getDocumentStatus(env, contractId);

    return new Response(JSON.stringify({
      success: true,
      contract: status
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Get contract error:', error);

    if (error.status === 404) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Contract not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to get contract status'
    }), {
      status: error.status || 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const contractId = params.id;

  try {
    if (!isPandaDocEnabled(env)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'PandaDoc not configured'
      }), {
        status: 503,
        headers: corsHeaders
      });
    }

    // Only admin can delete contracts
    const adminAuth = await verifyAuth(request, env);
    if (!adminAuth.authenticated) {
      return unauthorizedResponse('Admin authentication required');
    }

    await deleteDocument(env, contractId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Contract deleted'
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Delete contract error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to delete contract'
    }), {
      status: error.status || 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
      'Access-Control-Max-Age': '86400'
    }
  });
}
