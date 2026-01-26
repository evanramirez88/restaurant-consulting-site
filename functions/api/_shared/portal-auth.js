/**
 * Shared Portal Authentication Utilities
 *
 * Used by rep and client portal API endpoints to verify authentication.
 * Supports both cookie-based sessions and admin fallback access.
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../_shared/auth.js';

const REP_COOKIE_NAME = 'ccrc_rep_token';
const CLIENT_COOKIE_NAME = 'ccrc_client_token';
const ADMIN_COOKIE_NAME = 'ccrc_admin_token';

/**
 * Parse cookies from request header
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
 * Verify portal session from request
 *
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {string} requiredType - Optional: 'rep' or 'client' to require specific portal type
 * @returns {Promise<{authenticated: boolean, session?: Object, error?: string}>}
 */
export async function verifyPortalSession(request, env, requiredType = null) {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = parseCookies(cookieHeader);
  const now = Math.floor(Date.now() / 1000);

  // Try to verify based on portal type
  const jwtSecret = env.JWT_SECRET || env.ADMIN_PASSWORD_HASH;
  const repSecret = env.REP_JWT_SECRET || jwtSecret;
  const clientSecret = env.CLIENT_JWT_SECRET || jwtSecret;

  // Check rep token
  if (!requiredType || requiredType === 'rep') {
    const repToken = cookies[REP_COOKIE_NAME];
    if (repToken) {
      try {
        const isValid = await jwt.verify(repToken, repSecret);
        if (isValid) {
          const { payload } = jwt.decode(repToken);
          if (payload.type === 'rep' && payload.exp > now) {
            return {
              authenticated: true,
              session: {
                userId: payload.repId,
                userSlug: payload.slug,
                email: payload.email,
                portalType: 'rep'
              }
            };
          }
        }
      } catch (e) {
        // Token invalid, continue checking
      }
    }
  }

  // Check client token
  if (!requiredType || requiredType === 'client') {
    const clientToken = cookies[CLIENT_COOKIE_NAME];
    if (clientToken) {
      try {
        const isValid = await jwt.verify(clientToken, clientSecret);
        if (isValid) {
          const { payload } = jwt.decode(clientToken);
          if (payload.type === 'session' && payload.exp > now) {
            return {
              authenticated: true,
              session: {
                userId: payload.clientId,
                userSlug: payload.slug,
                email: payload.email,
                portalType: 'client'
              }
            };
          }
        }
      } catch (e) {
        // Token invalid, continue checking
      }
    }
  }

  // Check admin token as fallback
  const adminToken = cookies[ADMIN_COOKIE_NAME];
  if (adminToken) {
    try {
      const isValid = await jwt.verify(adminToken, jwtSecret);
      if (isValid) {
        const { payload } = jwt.decode(adminToken);
        if (payload.exp > now) {
          return {
            authenticated: true,
            isAdmin: true,
            session: {
              portalType: 'admin'
            }
          };
        }
      }
    } catch (e) {
      // Token invalid
    }
  }

  return {
    authenticated: false,
    error: 'No valid session found'
  };
}

/**
 * Verify rep portal authentication with slug validation
 *
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {string} slug - The rep slug to validate against
 * @returns {Promise<{authenticated: boolean, isAdmin?: boolean, repId?: string, error?: string}>}
 */
export async function verifyRepSession(request, env, slug) {
  const result = await verifyPortalSession(request, env, null);

  if (!result.authenticated) {
    return result;
  }

  // Admin can access any rep portal
  if (result.isAdmin) {
    return {
      authenticated: true,
      isAdmin: true
    };
  }

  // Verify slug matches for rep sessions
  if (result.session.portalType === 'rep') {
    if (result.session.userSlug === slug) {
      return {
        authenticated: true,
        isAdmin: false,
        repId: result.session.userId
      };
    }
    return {
      authenticated: false,
      error: 'Access denied to this portal'
    };
  }

  return {
    authenticated: false,
    error: 'Invalid session type'
  };
}

/**
 * Verify client portal authentication with slug validation
 *
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {string} slug - The client slug to validate against
 * @returns {Promise<{authenticated: boolean, isAdmin?: boolean, clientId?: string, error?: string}>}
 */
export async function verifyClientSession(request, env, slug) {
  const result = await verifyPortalSession(request, env, null);

  if (!result.authenticated) {
    return result;
  }

  // Admin can access any client portal
  if (result.isAdmin) {
    return {
      authenticated: true,
      isAdmin: true
    };
  }

  // Verify slug matches for client sessions
  if (result.session.portalType === 'client') {
    if (result.session.userSlug === slug) {
      return {
        authenticated: true,
        isAdmin: false,
        clientId: result.session.userId
      };
    }
    return {
      authenticated: false,
      error: 'Access denied to this portal'
    };
  }

  return {
    authenticated: false,
    error: 'Invalid session type'
  };
}

/**
 * Create an unauthorized portal response
 */
export function unauthorizedPortalResponse(error = 'Unauthorized', request = null) {
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
 * Get portal CORS headers
 */
export function getPortalCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

/**
 * Handle CORS preflight for portal endpoints
 */
export function handlePortalOptions(request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getCorsOrigin(request),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
