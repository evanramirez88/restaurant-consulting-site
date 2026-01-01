/**
 * Portal Messages API
 *
 * GET /api/portal/[slug]/messages - Get all message threads for client
 * POST /api/portal/[slug]/messages - Create a new message thread
 *
 * Requires client authentication.
 */

import jwt from '@tsndr/cloudflare-worker-jwt';

const COOKIE_NAME = 'ccrc_client_token';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    const client = await db.prepare('SELECT id, slug, name FROM clients WHERE id = ?')
      .bind(payload.clientId)
      .first();

    if (!client || client.slug !== slug) {
      return { authenticated: false, error: 'Unauthorized' };
    }

    return {
      authenticated: true,
      clientId: payload.clientId,
      clientName: client.name
    };
  } catch (error) {
    return { authenticated: false, error: 'Session error' };
  }
}

/**
 * GET - List all message threads for the client
 */
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

    // Get message threads for this client
    const { results } = await db.prepare(`
      SELECT
        mt.id,
        mt.title,
        mt.thread_type,
        mt.status,
        mt.priority,
        mt.last_message_at,
        mt.created_at,
        (
          SELECT COUNT(*)
          FROM messages m
          WHERE m.thread_id = mt.id
          AND m.read_at IS NULL
          AND m.sender_type != 'client'
        ) as unread_count
      FROM message_threads mt
      WHERE mt.client_id = ?
      ORDER BY mt.last_message_at DESC
    `).bind(auth.clientId).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Portal messages error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to load messages'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * POST - Create a new message thread
 */
export async function onRequestPost(context) {
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
    const body = await request.json();
    const { title, thread_type, priority, body: messageBody } = body;

    if (!title || !messageBody) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Title and message are required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const db = env.DB;
    const now = Math.floor(Date.now() / 1000);
    const threadId = crypto.randomUUID();
    const messageId = crypto.randomUUID();

    // Create thread
    await db.prepare(`
      INSERT INTO message_threads (
        id, title, thread_type, status, priority, client_id,
        participants_json, last_message_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)
    `).bind(
      threadId,
      title,
      thread_type || 'support',
      priority || 'normal',
      auth.clientId,
      JSON.stringify([{ type: 'client', id: auth.clientId }]),
      now,
      now,
      now
    ).run();

    // Create initial message
    await db.prepare(`
      INSERT INTO messages (
        id, thread_id, sender_type, sender_id, subject, body, body_format, created_at
      ) VALUES (?, ?, 'client', ?, ?, ?, 'text', ?)
    `).bind(
      messageId,
      threadId,
      auth.clientId,
      title,
      messageBody,
      now
    ).run();

    // Get the created thread
    const thread = await db.prepare(`
      SELECT id, title, thread_type, status, priority, last_message_at, created_at
      FROM message_threads WHERE id = ?
    `).bind(threadId).first();

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...thread,
        unread_count: 0
      }
    }), {
      status: 201,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Create thread error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to create message'
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
