/**
 * Automation Credentials API
 *
 * GET /api/automation/credentials - List credentials for a client (passwords masked)
 * POST /api/automation/credentials - Add new credentials
 *
 * Query Parameters (GET):
 * - client_id: (required) Client ID to get credentials for
 * - platform: (optional) Filter by platform (toast, square, etc.)
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';

// Supported platforms
const VALID_PLATFORMS = ['toast', 'square', 'doordash', 'ubereats', 'grubhub', 'google', 'yelp'];

/**
 * Encrypt sensitive data using AES-GCM
 */
async function encryptCredential(plaintext, secretKey) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Import the secret key
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey.slice(0, 32).padEnd(32, '0')),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Mask a credential value for display
 */
function maskCredential(value) {
  if (!value) return null;
  if (value.length <= 4) return '****';
  return value.slice(0, 2) + '*'.repeat(Math.min(value.length - 4, 10)) + value.slice(-2);
}

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const url = new URL(context.request.url);

    // Get query parameters
    const clientId = url.searchParams.get('client_id');
    const platform = url.searchParams.get('platform');

    if (!clientId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'client_id is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Build query
    let query = `
      SELECT
        id,
        client_id,
        platform,
        username,
        restaurant_guid,
        location_name,
        is_active,
        last_used_at,
        last_verified_at,
        created_at,
        updated_at,
        notes
      FROM automation_credentials
      WHERE client_id = ?
    `;
    let params = [clientId];

    if (platform) {
      if (!VALID_PLATFORMS.includes(platform)) {
        return new Response(JSON.stringify({
          success: false,
          error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}`
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      query += ' AND platform = ?';
      params.push(platform);
    }

    query += ' ORDER BY platform, created_at DESC';

    const { results } = await db.prepare(query).bind(...params).all();

    // Format credentials (passwords are never returned)
    const credentials = (results || []).map(cred => ({
      id: cred.id,
      client_id: cred.client_id,
      platform: cred.platform,
      username: cred.username,
      username_masked: maskCredential(cred.username),
      restaurant_guid: cred.restaurant_guid,
      location_name: cred.location_name,
      is_active: !!cred.is_active,
      last_used_at: cred.last_used_at ? new Date(cred.last_used_at * 1000).toISOString() : null,
      last_verified_at: cred.last_verified_at ? new Date(cred.last_verified_at * 1000).toISOString() : null,
      created_at: cred.created_at ? new Date(cred.created_at * 1000).toISOString() : null,
      updated_at: cred.updated_at ? new Date(cred.updated_at * 1000).toISOString() : null,
      notes: cred.notes,
      has_password: true // We don't return actual password status for security
    }));

    return new Response(JSON.stringify({
      success: true,
      data: credentials
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Credentials GET error:', error);
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
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const body = await context.request.json();

    // Validate required fields
    if (!body.clientId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'clientId is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!body.platform) {
      return new Response(JSON.stringify({
        success: false,
        error: 'platform is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!VALID_PLATFORMS.includes(body.platform)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!body.username) {
      return new Response(JSON.stringify({
        success: false,
        error: 'username is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!body.password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'password is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Verify client exists
    const client = await db.prepare('SELECT id FROM clients WHERE id = ?')
      .bind(body.clientId).first();

    if (!client) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Encrypt the password
    const encryptionKey = context.env.CREDENTIAL_ENCRYPTION_KEY || context.env.JWT_SECRET || 'default-key-change-in-production';
    const encryptedPassword = await encryptCredential(body.password, encryptionKey);

    const now = Math.floor(Date.now() / 1000);
    const credentialId = crypto.randomUUID();

    // Check for existing active credential for same platform
    const existing = await db.prepare(`
      SELECT id FROM automation_credentials
      WHERE client_id = ? AND platform = ? AND is_active = 1
    `).bind(body.clientId, body.platform).first();

    if (existing && !body.replace) {
      return new Response(JSON.stringify({
        success: false,
        error: `Active credentials already exist for ${body.platform}. Set replace=true to update.`
      }), {
        status: 409,
        headers: corsHeaders
      });
    }

    // If replacing, deactivate existing
    if (existing && body.replace) {
      await db.prepare(`
        UPDATE automation_credentials
        SET is_active = 0, updated_at = ?
        WHERE id = ?
      `).bind(now, existing.id).run();
    }

    // Insert new credentials
    await db.prepare(`
      INSERT INTO automation_credentials (
        id,
        client_id,
        platform,
        username,
        password_encrypted,
        restaurant_guid,
        location_name,
        is_active,
        notes,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      credentialId,
      body.clientId,
      body.platform,
      body.username,
      encryptedPassword,
      body.restaurantGuid || null,
      body.locationName || null,
      1,
      body.notes || null,
      now,
      now
    ).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: credentialId,
        client_id: body.clientId,
        platform: body.platform,
        username: body.username,
        username_masked: maskCredential(body.username),
        restaurant_guid: body.restaurantGuid || null,
        location_name: body.locationName || null,
        is_active: true,
        created_at: new Date(now * 1000).toISOString(),
        notes: body.notes || null
      },
      message: existing && body.replace
        ? 'Credentials updated successfully'
        : 'Credentials added successfully'
    }), {
      status: 201,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Credentials POST error:', error);
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
