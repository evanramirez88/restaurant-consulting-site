/**
 * Verify Magic Link Token Handler
 *
 * POST /api/client/auth/verify-magic-link
 *
 * Verifies a magic link token and creates a session.
 */

import jwt from '@tsndr/cloudflare-worker-jwt';

const COOKIE_NAME = 'ccrc_client_token';
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { token, slug } = body;

    if (!token) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Token is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const jwtSecret = env.CLIENT_JWT_SECRET || env.JWT_SECRET;
    if (!jwtSecret) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Server configuration error'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    // Verify the magic link token
    let isValid;
    try {
      isValid = await jwt.verify(token, jwtSecret);
    } catch (e) {
      isValid = false;
    }

    if (!isValid) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or expired login link'
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Decode token
    const { payload } = jwt.decode(token);

    // Verify it's a magic link token
    if (payload.type !== 'magic_link') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid token type'
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Verify slug matches if provided
    if (slug && payload.slug !== slug) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid portal'
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Verify client still exists and is enabled
    const db = env.DB;
    const client = await db.prepare(`
      SELECT id, email, name, slug, portal_enabled
      FROM clients WHERE id = ?
    `).bind(payload.clientId).first();

    if (!client || !client.portal_enabled) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Portal access is not available'
      }), {
        status: 403,
        headers: corsHeaders
      });
    }

    // Create session token
    const now = Math.floor(Date.now() / 1000);
    const sessionToken = await jwt.sign({
      clientId: client.id,
      email: client.email,
      slug: client.slug,
      type: 'session',
      iat: now,
      exp: now + SESSION_DURATION
    }, jwtSecret);

    // Set cookie
    const isProduction = env.ENVIRONMENT === 'production' || !env.ENVIRONMENT;
    const cookieOptions = [
      `${COOKIE_NAME}=${sessionToken}`,
      'Path=/',
      `Max-Age=${SESSION_DURATION}`,
      'HttpOnly',
      'SameSite=Strict'
    ];

    if (isProduction) {
      cookieOptions.push('Secure');
    }

    return new Response(JSON.stringify({
      success: true,
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        slug: client.slug
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Set-Cookie': cookieOptions.join('; ')
      }
    });

  } catch (error) {
    console.error('Verify magic link error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to verify login link'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
