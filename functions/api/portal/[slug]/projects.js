/**
 * Portal Projects API
 *
 * GET /api/portal/[slug]/projects
 *
 * Returns projects for the authenticated client.
 * Requires client authentication.
 * Supports demo mode for slugs starting with "demo-".
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../../_shared/auth.js';

const COOKIE_NAME = 'ccrc_client_token';

// Demo projects data
const DEMO_PROJECTS = [
  {
    id: 'demo-project-001',
    name: 'Toast POS Installation',
    description: 'Complete Toast POS system installation including hardware setup and staff training.',
    status: 'in_progress',
    progress_percentage: 65,
    start_date: Date.now() - 14 * 24 * 60 * 60 * 1000,
    due_date: Date.now() + 7 * 24 * 60 * 60 * 1000,
    milestone_json: JSON.stringify([
      { name: 'Hardware Delivery', completed: true },
      { name: 'System Configuration', completed: true },
      { name: 'Menu Setup', completed: false },
      { name: 'Staff Training', completed: false }
    ]),
    created_at: Date.now() - 14 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 1 * 24 * 60 * 60 * 1000
  },
  {
    id: 'demo-project-002',
    name: 'Menu Digitization',
    description: 'Converting paper menus to digital format for Toast POS.',
    status: 'pending',
    progress_percentage: 0,
    start_date: null,
    due_date: Date.now() + 21 * 24 * 60 * 60 * 1000,
    milestone_json: null,
    created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 7 * 24 * 60 * 60 * 1000
  }
];

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

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

/**
 * Verify client authentication and return client ID
 */
async function verifyClientAuth(request, env, slug) {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = parseCookies(cookieHeader);

  // 1. Try client-specific token
  const token = cookies[COOKIE_NAME];
  if (token) {
    const jwtSecret = env.CLIENT_JWT_SECRET || env.JWT_SECRET;
    if (jwtSecret) {
      try {
        const isValid = await jwt.verify(token, jwtSecret);
        if (isValid) {
          const { payload } = jwt.decode(token);
          const db = env.DB;
          const client = await db.prepare('SELECT id, slug FROM clients WHERE id = ?')
            .bind(payload.clientId).first();
          if (client && client.slug === slug) {
            return { authenticated: true, clientId: payload.clientId };
          }
        }
      } catch (e) { /* fall through */ }
    }
  }

  // 2. Fall back to admin token
  const adminToken = cookies['ccrc_admin_token'];
  if (adminToken) {
    const jwtSecret = env.JWT_SECRET || env.ADMIN_PASSWORD_HASH;
    if (jwtSecret) {
      try {
        const isValid = await jwt.verify(adminToken, jwtSecret);
        if (isValid) {
          const db = env.DB;
          const client = await db.prepare('SELECT id FROM clients WHERE slug = ?')
            .bind(slug).first();
          return { authenticated: true, isAdmin: true, clientId: client?.id };
        }
      } catch (e) { /* fall through */ }
    }
  }

  return { authenticated: false, error: 'No session' };
}

export async function onRequestGet(context) {
  const { request, params, env } = context;
  const { slug } = params;
  const corsHeaders = getCorsHeaders(request);

  if (!slug) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing client slug'
    }), {
      status: 400,
      headers: corsHeaders
    });
  }

  // Check for demo mode - slug starts with "demo-"
  const url = new URL(request.url);
  const isDemoMode = slug.startsWith('demo-') || url.searchParams.get('demo') === 'true';

  if (isDemoMode) {
    return new Response(JSON.stringify({
      success: true,
      data: DEMO_PROJECTS
    }), {
      status: 200,
      headers: corsHeaders
    });
  }

  // Verify authentication
  const auth = await verifyClientAuth(request, env, slug);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({
      success: false,
      error: auth.error || 'Unauthorized'
    }), {
      status: 401,
      headers: corsHeaders
    });
  }

  try {
    const db = env.DB;

    // Get projects for this client
    const { results } = await db.prepare(`
      SELECT
        id,
        name,
        description,
        status,
        progress_percentage,
        start_date,
        due_date,
        milestone_json,
        timeline_json,
        created_at,
        updated_at
      FROM projects
      WHERE client_id = ?
      ORDER BY
        CASE
          WHEN status = 'in_progress' THEN 1
          WHEN status = 'pending' THEN 2
          WHEN status = 'on_hold' THEN 3
          ELSE 4
        END,
        updated_at DESC
    `).bind(auth.clientId).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Portal projects error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to load projects'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  const { request } = context;
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getCorsOrigin(request),
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
