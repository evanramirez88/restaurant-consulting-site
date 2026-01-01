/**
 * Auth Verification Handler
 *
 * GET /api/auth/verify
 *
 * Checks if the current session is valid
 * Returns 200 if authenticated, 401 if not
 */

const COOKIE_NAME = 'ccrc_admin_token';

/**
 * Verify a JWT token using native Web Crypto API
 */
async function verifyJWT(token, secret) {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) {
      return { valid: false, error: 'Invalid token format' };
    }

    const encoder = new TextEncoder();
    const data = `${headerB64}.${payloadB64}`;

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Convert base64url to regular base64
    const signatureBase64 = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    const signatureBytes = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(data));

    if (!isValid) {
      return { valid: false, error: 'Invalid signature' };
    }

    // Decode payload
    const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

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

    const result = await verifyJWT(token, jwtSecret);

    if (!result.valid) {
      return new Response(JSON.stringify({
        authenticated: false,
        error: result.error || 'Invalid or expired session'
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      authenticated: true,
      expiresAt: result.payload.exp ? result.payload.exp * 1000 : null
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
