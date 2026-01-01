/**
 * Shared Authentication Utilities
 *
 * Used by protected API endpoints to verify admin authentication
 */

const COOKIE_NAME = 'ccrc_admin_token';
const CLIENT_COOKIE_NAME = 'ccrc_client_token';

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

/**
 * Parse cookies from request
 */
export function parseCookies(cookieHeader) {
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

/**
 * Verify admin authentication from request
 *
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @returns {Promise<{authenticated: boolean, error?: string}>}
 */
export async function verifyAuth(request, env) {
  try {
    // Get token from cookie
    const cookieHeader = request.headers.get('Cookie');
    const cookies = parseCookies(cookieHeader);
    const token = cookies[COOKIE_NAME];

    if (!token) {
      return { authenticated: false, error: 'No session found' };
    }

    // Verify JWT
    const jwtSecret = env.JWT_SECRET || env.ADMIN_PASSWORD_HASH;

    if (!jwtSecret) {
      return { authenticated: false, error: 'Server configuration error' };
    }

    const result = await verifyJWT(token, jwtSecret);

    if (!result.valid) {
      return { authenticated: false, error: result.error || 'Invalid or expired session' };
    }

    return { authenticated: true, payload: result.payload };
  } catch (error) {
    console.error('Auth verification error:', error);
    return { authenticated: false, error: 'Authentication failed' };
  }
}

/**
 * Verify client portal authentication from request
 *
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @returns {Promise<{authenticated: boolean, clientId?: string, error?: string}>}
 */
export async function verifyClientAuth(request, env) {
  try {
    // Get token from cookie
    const cookieHeader = request.headers.get('Cookie');
    const cookies = parseCookies(cookieHeader);
    const token = cookies[CLIENT_COOKIE_NAME];

    if (!token) {
      return { authenticated: false, error: 'No client session found' };
    }

    // Verify JWT
    const jwtSecret = env.CLIENT_JWT_SECRET || env.JWT_SECRET || env.ADMIN_PASSWORD_HASH;

    if (!jwtSecret) {
      return { authenticated: false, error: 'Server configuration error' };
    }

    const isValid = await jwt.verify(token, jwtSecret);

    if (!isValid) {
      return { authenticated: false, error: 'Invalid or expired session' };
    }

    // Decode to get client ID
    const decoded = jwt.decode(token);
    const clientId = decoded?.payload?.clientId || decoded?.payload?.sub;

    if (!clientId) {
      return { authenticated: false, error: 'Invalid token payload' };
    }

    return { authenticated: true, clientId };
  } catch (error) {
    console.error('Client auth verification error:', error);
    return { authenticated: false, error: 'Authentication failed' };
  }
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(error = 'Unauthorized') {
  return new Response(JSON.stringify({
    success: false,
    error
  }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

/**
 * CORS headers helper
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

/**
 * Handle CORS preflight
 */
export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
