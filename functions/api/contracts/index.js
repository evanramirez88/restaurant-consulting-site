/**
 * Contract List API
 *
 * GET /api/contracts - List contracts with optional filters
 *
 * Query Parameters:
 * - status: Filter by status (draft, sent, completed, etc.)
 * - client_id: Filter by client ID (from metadata)
 *
 * Requires admin authentication.
 */

import {
  isPandaDocEnabled,
  listDocuments,
  mapDocumentStatus
} from '../_shared/pandadoc.js';
import { verifyAuth, unauthorizedResponse, corsHeaders } from '../../_shared/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    if (!isPandaDocEnabled(env)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'PandaDoc not configured',
        contracts: []
      }), {
        status: 200, // Return 200 with empty array, not error
        headers: corsHeaders
      });
    }

    // Only admin can list all contracts
    const adminAuth = await verifyAuth(request, env);
    if (!adminAuth.authenticated) {
      return unauthorizedResponse('Admin authentication required');
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const clientId = url.searchParams.get('client_id');

    const filters = {
      tag: 'ccrc' // Only get our documents
    };

    if (status) {
      filters.status = status;
    }

    if (clientId) {
      filters.metadata = { client_id: clientId };
    }

    const result = await listDocuments(env, filters);

    // Map to simpler format
    const contracts = (result.results || []).map(doc => ({
      id: doc.id,
      name: doc.name,
      status: mapDocumentStatus(doc.status),
      clientId: doc.metadata?.client_id,
      serviceType: doc.metadata?.service_type,
      dateCreated: doc.date_created,
      dateModified: doc.date_modified,
      dateCompleted: doc.date_completed
    }));

    return new Response(JSON.stringify({
      success: true,
      contracts,
      total: contracts.length
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('List contracts error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to list contracts',
      contracts: []
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
      'Access-Control-Max-Age': '86400'
    }
  });
}
