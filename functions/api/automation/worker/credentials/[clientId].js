/**
 * Worker Credentials Endpoint
 *
 * GET /api/automation/worker/credentials/:clientId - Get credentials for a client
 *
 * Worker-only endpoint authenticated via API key
 * Returns encrypted password - worker decrypts locally with ENCRYPTION_KEY
 *
 * Query Parameters:
 * - platform: (optional) Currently only 'toast' is supported
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

    // Get Toast credentials for this client
    const cred = await db.prepare(`
      SELECT
        id,
        client_id,
        restaurant_id,
        toast_username_encrypted,
        toast_password_encrypted,
        toast_guid,
        toast_location_id,
        status,
        last_login_at,
        created_at
      FROM toast_credentials
      WHERE client_id = ? AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(clientId).first();

    if (!cred) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No active credentials found for this client'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Update last_login_at
    const now = Math.floor(Date.now() / 1000);
    await db.prepare(`
      UPDATE toast_credentials
      SET last_login_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(now, now, cred.id).run();

    // Return credentials with encrypted values
    // Worker will decrypt locally using ENCRYPTION_KEY
    return new Response(JSON.stringify({
      success: true,
      data: {
        id: cred.id,
        client_id: cred.client_id,
        restaurant_id: cred.restaurant_id,
        platform: 'toast',
        username: cred.toast_username_encrypted, // Note: encrypted, needs decryption
        password_encrypted: cred.toast_password_encrypted,
        restaurant_guid: cred.toast_guid,
        location_id: cred.toast_location_id,
        status: cred.status,
        last_login_at: new Date(now * 1000).toISOString(),
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
