/**
 * Worker Credentials Endpoint
 *
 * GET /api/automation/worker/credentials/:clientId - Get credentials for a client
 *
 * Worker-only endpoint authenticated via API key
 * Returns encrypted password - worker decrypts locally with ENCRYPTION_KEY
 *
 * Query Parameters:
 * - platform: (optional) Filter by platform (toast, square, etc.)
 */

import { verifyWorkerAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify worker authentication
    const auth = await verifyWorkerAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const clientId = context.params.clientId;
    const url = new URL(context.request.url);
    const platform = url.searchParams.get('platform');

    // Build query
    let query = `
      SELECT
        id,
        client_id,
        platform,
        username,
        password_encrypted,
        restaurant_guid,
        location_name,
        is_active,
        last_used_at,
        created_at
      FROM automation_credentials
      WHERE client_id = ? AND is_active = 1
    `;
    let params = [clientId];

    if (platform) {
      query += ' AND platform = ?';
      params.push(platform);
    }

    query += ' ORDER BY created_at DESC LIMIT 1';

    const cred = await db.prepare(query).bind(...params).first();

    if (!cred) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No active credentials found for this client'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Update last_used_at
    const now = Math.floor(Date.now() / 1000);
    await db.prepare(`
      UPDATE automation_credentials
      SET last_used_at = ?
      WHERE id = ?
    `).bind(now, cred.id).run();

    // Return credentials with encrypted password
    // Worker will decrypt locally using ENCRYPTION_KEY
    return new Response(JSON.stringify({
      success: true,
      data: {
        id: cred.id,
        client_id: cred.client_id,
        platform: cred.platform,
        username: cred.username,
        password_encrypted: cred.password_encrypted,
        restaurant_guid: cred.restaurant_guid,
        location_name: cred.location_name,
        is_active: !!cred.is_active,
        last_used_at: new Date(now * 1000).toISOString(),
        created_at: cred.created_at ? new Date(cred.created_at * 1000).toISOString() : null
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Worker credentials error:', error);
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
