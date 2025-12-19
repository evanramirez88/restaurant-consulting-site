/**
 * Auth Verification Handler
 *
 * GET /api/auth/verify
 *
 * Checks if the current session is valid
 * Returns 200 if authenticated, 401 if not
 */

import jwt from '@tsndr/cloudflare-worker-jwt';

const COOKIE_NAME = 'ccrc_admin_token';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

/**
 * Parse cookies from request
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    const value = rest.join('=').trim();
    if (name) {
      cookies[name.trim()] = value;
    }
  });

  return cookies;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    // Get token from cookie
    const cookieHeader = request.headers.get('Cookie');
    const cookies = parseCookies(cookieHeader);
    const token = cookies[COOKIE_NAME];

    if (!token) {
      return new Response(JSON.stringify({
        authenticated: false,
        error: 'No session found'
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Verify JWT
    const jwtSecret = env.JWT_SECRET || env.ADMIN_PASSWORD_HASH;

    if (!jwtSecret) {
      return new Response(JSON.stringify({
        authenticated: false,
        error: 'Server configuration error'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const isValid = await jwt.verify(token, jwtSecret);

    if (!isValid) {
      return new Response(JSON.stringify({
        authenticated: false,
        error: 'Invalid or expired session'
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Decode to get expiration
    const { payload } = jwt.decode(token);

    return new Response(JSON.stringify({
      authenticated: true,
      expiresAt: payload.exp ? payload.exp * 1000 : null
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Verify error:', error);
    return new Response(JSON.stringify({
      authenticated: false,
      error: 'Session verification failed'
    }), {
      status: 401,
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
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
