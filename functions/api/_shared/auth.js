/**
 * Shared Authentication Utilities
 *
 * Used by protected API endpoints to verify admin authentication
 */

const COOKIE_NAME = 'ccrc_admin_token';
const CLIENT_COOKIE_NAME = 'ccrc_client_token';

/**
 * Allowed origins for CORS
 * Production domains and development environments
 */
const ALLOWED_ORIGINS = [
  'https://ccrestaurantconsulting.com',
  'https://www.ccrestaurantconsulting.com',
  'https://restaurant-consulting-site.pages.dev',
  'http://localhost:5173',  // Vite dev server
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

/**
 * Get valid CORS origin from request
 * Returns the origin if it's in the allowed list, otherwise returns the primary domain
 */
export function getCorsOrigin(request) {
  const origin = request?.headers?.get('Origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  // Default to primary production domain
  return 'https://ccrestaurantconsulting.com';
}

/**
 * Get CORS headers for a specific request
 */
export function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

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
 * Verify admin token (wrapper for verifyAuth with compatible response format)
 *
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @returns {Promise<{valid: boolean, error?: string, payload?: any}>}
 */
export async function verifyAdminToken(request, env) {
  const result = await verifyAuth(request, env);
  return {
    valid: result.authenticated,
    error: result.error,
    payload: result.payload
  };
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

    const result = await verifyJWT(token, jwtSecret);

    if (!result.valid) {
      return { authenticated: false, error: result.error || 'Invalid or expired session' };
    }

    // Get client ID from payload
    const clientId = result.payload?.clientId || result.payload?.sub;

    if (!clientId) {
      return { authenticated: false, error: 'Invalid token payload' };
    }

    return { authenticated: true, clientId, payload: result.payload };
  } catch (error) {
    console.error('Client auth verification error:', error);
    return { authenticated: false, error: 'Authentication failed' };
  }
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(error = 'Unauthorized', request = null) {
  return new Response(JSON.stringify({
    success: false,
    error
  }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': getCorsOrigin(request),
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}

/**
 * Verify worker API key authentication
 *
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @returns {Promise<{authenticated: boolean, workerId?: string, error?: string}>}
 */
export async function verifyWorkerAuth(request, env) {
  try {
    // Get API key from Authorization header (Bearer token)
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return { authenticated: false, error: 'No authorization header' };
    }

    // Support both "Bearer <key>" and just "<key>"
    let apiKey = authHeader;
    if (authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }

    if (!apiKey || apiKey.trim() === '') {
      return { authenticated: false, error: 'No API key provided' };
    }

    // Check against configured worker API key
    const workerApiKey = env.WORKER_API_KEY;

    if (!workerApiKey) {
      console.error('WORKER_API_KEY not configured in environment');
      return { authenticated: false, error: 'Server configuration error' };
    }

    // Constant-time comparison to prevent timing attacks
    if (apiKey.length !== workerApiKey.length) {
      return { authenticated: false, error: 'Invalid API key' };
    }

    let match = true;
    for (let i = 0; i < apiKey.length; i++) {
      if (apiKey[i] !== workerApiKey[i]) {
        match = false;
      }
    }

    if (!match) {
      return { authenticated: false, error: 'Invalid API key' };
    }

    return { authenticated: true, workerId: 'abo-worker' };
  } catch (error) {
    console.error('Worker auth verification error:', error);
    return { authenticated: false, error: 'Authentication failed' };
  }
}

/**
 * Verify either admin OR worker authentication
 * Used for endpoints that can be accessed by both
 *
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @returns {Promise<{authenticated: boolean, isWorker: boolean, error?: string}>}
 */
export async function verifyAuthOrWorker(request, env) {
  // First try worker auth (Bearer token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const workerAuth = await verifyWorkerAuth(request, env);
    if (workerAuth.authenticated) {
      return { authenticated: true, isWorker: true, workerId: workerAuth.workerId };
    }
  }

  // Fall back to admin auth (cookie)
  const adminAuth = await verifyAuth(request, env);
  if (adminAuth.authenticated) {
    return { authenticated: true, isWorker: false, payload: adminAuth.payload };
  }

  return { authenticated: false, error: adminAuth.error || 'Unauthorized' };
}

/**
 * Verify rep portal authentication, with admin fallback
 * Allows admin users to view rep portals for management purposes
 *
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {string} slug - The rep slug to validate against
 * @returns {Promise<{authenticated: boolean, isAdmin: boolean, repId?: string, error?: string}>}
 */
export async function verifyRepOrAdminAuth(request, env, slug) {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = parseCookies(cookieHeader);

  // 1. Try rep-specific token
  const repToken = cookies['ccrc_rep_token'];
  if (repToken) {
    try {
      const jwtSecret = env.REP_JWT_SECRET || env.JWT_SECRET || env.ADMIN_PASSWORD_HASH;
      if (jwtSecret) {
        const result = await verifyJWT(repToken, jwtSecret);
        if (result.valid && result.payload?.slug === slug && result.payload?.type === 'rep') {
          return { authenticated: true, isAdmin: false, repId: result.payload.repId };
        }
      }
    } catch (e) {
      // Fall through to admin check
    }
  }

  // 2. Fall back to admin token
  const adminToken = cookies[COOKIE_NAME];
  if (adminToken) {
    try {
      const jwtSecret = env.JWT_SECRET || env.ADMIN_PASSWORD_HASH;
      if (jwtSecret) {
        const result = await verifyJWT(adminToken, jwtSecret);
        if (result.valid) {
          return { authenticated: true, isAdmin: true };
        }
      }
    } catch (e) {
      // Fall through
    }
  }

  return { authenticated: false, error: 'No valid session found' };
}

/**
 * Verify client portal authentication, with admin fallback
 * Allows admin users to view client portals for management purposes
 *
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {string} slug - The client slug to validate against
 * @returns {Promise<{authenticated: boolean, isAdmin: boolean, clientId?: string, error?: string}>}
 */
export async function verifyClientOrAdminAuth(request, env, slug) {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = parseCookies(cookieHeader);

  // 1. Try client-specific token
  const clientToken = cookies[CLIENT_COOKIE_NAME];
  if (clientToken) {
    try {
      const jwtSecret = env.CLIENT_JWT_SECRET || env.JWT_SECRET || env.ADMIN_PASSWORD_HASH;
      if (jwtSecret) {
        const result = await verifyJWT(clientToken, jwtSecret);
        if (result.valid && result.payload?.slug === slug) {
          return { authenticated: true, isAdmin: false, clientId: result.payload.clientId };
        }
      }
    } catch (e) {
      // Fall through to admin check
    }
  }

  // 2. Fall back to admin token
  const adminToken = cookies[COOKIE_NAME];
  if (adminToken) {
    try {
      const jwtSecret = env.JWT_SECRET || env.ADMIN_PASSWORD_HASH;
      if (jwtSecret) {
        const result = await verifyJWT(adminToken, jwtSecret);
        if (result.valid) {
          return { authenticated: true, isAdmin: true };
        }
      }
    } catch (e) {
      // Fall through
    }
  }

  return { authenticated: false, error: 'No valid session found' };
}

/**
 * CORS headers helper (legacy - use getCorsHeaders(request) for dynamic origin)
 * @deprecated Use getCorsHeaders(request) instead for proper CORS security
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://ccrestaurantconsulting.com',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
};

/**
 * Handle CORS preflight
 */
export function handleOptions(request = null) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getCorsOrigin(request),
      'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
