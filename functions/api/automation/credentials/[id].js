/**
 * Automation Credential API - Single Credential Operations
 *
 * GET /api/automation/credentials/[id] - Get credential details (password masked)
 * PUT /api/automation/credentials/[id] - Update credential
 * DELETE /api/automation/credentials/[id] - Delete/deactivate credential
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

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
    const { id } = context.params;

    const credential = await db.prepare(`
      SELECT
        ac.id,
        ac.client_id,
        ac.platform,
        ac.username,
        ac.restaurant_guid,
        ac.location_name,
        ac.is_active,
        ac.last_used_at,
        ac.last_verified_at,
        ac.created_at,
        ac.updated_at,
        ac.notes,
        c.name as client_name,
        c.company as client_company
      FROM automation_credentials ac
      LEFT JOIN clients c ON ac.client_id = c.id
      WHERE ac.id = ?
    `).bind(id).first();

    if (!credential) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Credential not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: credential.id,
        client_id: credential.client_id,
        client_name: credential.client_name,
        client_company: credential.client_company,
        platform: credential.platform,
        username: credential.username,
        username_masked: maskCredential(credential.username),
        restaurant_guid: credential.restaurant_guid,
        location_name: credential.location_name,
        is_active: !!credential.is_active,
        last_used_at: credential.last_used_at ? new Date(credential.last_used_at * 1000).toISOString() : null,
        last_verified_at: credential.last_verified_at ? new Date(credential.last_verified_at * 1000).toISOString() : null,
        created_at: credential.created_at ? new Date(credential.created_at * 1000).toISOString() : null,
        updated_at: credential.updated_at ? new Date(credential.updated_at * 1000).toISOString() : null,
        notes: credential.notes,
        has_password: true
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Credential GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPut(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    // Verify credential exists
    const existing = await db.prepare('SELECT * FROM automation_credentials WHERE id = ?')
      .bind(id).first();

    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Credential not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Build update query dynamically
    let setClauses = ['updated_at = ?'];
    let params = [now];

    if (body.username !== undefined) {
      setClauses.push('username = ?');
      params.push(body.username);
    }

    if (body.password !== undefined) {
      const encryptionKey = context.env.CREDENTIAL_ENCRYPTION_KEY || context.env.JWT_SECRET || 'default-key-change-in-production';
      const encryptedPassword = await encryptCredential(body.password, encryptionKey);
      setClauses.push('password_encrypted = ?');
      params.push(encryptedPassword);
    }

    if (body.restaurantGuid !== undefined) {
      setClauses.push('restaurant_guid = ?');
      params.push(body.restaurantGuid);
    }

    if (body.locationName !== undefined) {
      setClauses.push('location_name = ?');
      params.push(body.locationName);
    }

    if (body.isActive !== undefined) {
      setClauses.push('is_active = ?');
      params.push(body.isActive ? 1 : 0);
    }

    if (body.notes !== undefined) {
      setClauses.push('notes = ?');
      params.push(body.notes);
    }

    params.push(id);

    await db.prepare(`
      UPDATE automation_credentials
      SET ${setClauses.join(', ')}
      WHERE id = ?
    `).bind(...params).run();

    // Get updated credential
    const updated = await db.prepare(`
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
      WHERE id = ?
    `).bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: updated.id,
        client_id: updated.client_id,
        platform: updated.platform,
        username: updated.username,
        username_masked: maskCredential(updated.username),
        restaurant_guid: updated.restaurant_guid,
        location_name: updated.location_name,
        is_active: !!updated.is_active,
        last_used_at: updated.last_used_at ? new Date(updated.last_used_at * 1000).toISOString() : null,
        last_verified_at: updated.last_verified_at ? new Date(updated.last_verified_at * 1000).toISOString() : null,
        created_at: updated.created_at ? new Date(updated.created_at * 1000).toISOString() : null,
        updated_at: updated.updated_at ? new Date(updated.updated_at * 1000).toISOString() : null,
        notes: updated.notes,
        has_password: true
      },
      message: body.password ? 'Credential updated with new password' : 'Credential updated'
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Credential PUT error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestDelete(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;
    const url = new URL(context.request.url);
    const hardDelete = url.searchParams.get('hard') === 'true';

    // Verify credential exists
    const existing = await db.prepare('SELECT id, platform FROM automation_credentials WHERE id = ?')
      .bind(id).first();

    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Credential not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    if (hardDelete) {
      // Permanently delete
      await db.prepare('DELETE FROM automation_credentials WHERE id = ?').bind(id).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'Credential permanently deleted'
      }), {
        headers: corsHeaders
      });
    } else {
      // Soft delete - just deactivate
      const now = Math.floor(Date.now() / 1000);
      await db.prepare(`
        UPDATE automation_credentials
        SET is_active = 0, updated_at = ?
        WHERE id = ?
      `).bind(now, id).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'Credential deactivated. Use ?hard=true to permanently delete.'
      }), {
        headers: corsHeaders
      });
    }
  } catch (error) {
    console.error('Credential DELETE error:', error);
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
