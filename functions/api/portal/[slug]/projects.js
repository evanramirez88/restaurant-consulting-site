/**
 * Portal Projects API
 *
 * GET /api/portal/[slug]/projects
 *
 * Returns projects for the authenticated client.
 * Requires client authentication.
 */

import jwt from '@tsndr/cloudflare-worker-jwt';

const COOKIE_NAME = 'ccrc_client_token';

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

/**
 * Verify client authentication and return client ID
 */
async function verifyClientAuth(request, env, slug) {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME];

  if (!token) {
    return { authenticated: false, error: 'No session' };
  }

  const jwtSecret = env.CLIENT_JWT_SECRET || env.JWT_SECRET;
  if (!jwtSecret) {
    return { authenticated: false, error: 'Server config error' };
  }

  try {
    const isValid = await jwt.verify(token, jwtSecret);
    if (!isValid) {
      return { authenticated: false, error: 'Invalid session' };
    }

    const { payload } = jwt.decode(token);

    // Verify the client matches the slug
    const db = env.DB;
    const client = await db.prepare('SELECT id, slug FROM clients WHERE id = ?')
      .bind(payload.clientId)
      .first();

    if (!client || client.slug !== slug) {
      return { authenticated: false, error: 'Unauthorized' };
    }

    return { authenticated: true, clientId: payload.clientId };
  } catch (error) {
    return { authenticated: false, error: 'Session error' };
  }
}

export async function onRequestGet(context) {
  const { request, params, env } = context;
  const { slug } = params;

  if (!slug) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing client slug'
    }), {
      status: 400,
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
