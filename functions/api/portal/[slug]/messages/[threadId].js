/**
 * Portal Message Thread API
 *
 * GET /api/portal/[slug]/messages/[threadId] - Get messages in a thread
 * POST /api/portal/[slug]/messages/[threadId] - Add a message to a thread
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
 * GET - Get all messages in a thread
 */
export async function onRequestGet(context) {
  const { request, params, env } = context;
  const { slug, threadId } = params;

  if (!slug || !threadId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing required parameters'
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

    // Verify thread belongs to this client
    const thread = await db.prepare(`
      SELECT id, client_id, status FROM message_threads WHERE id = ?
    `).bind(threadId).first();

    if (!thread || thread.client_id !== auth.clientId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Thread not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Get messages in thread
    const { results } = await db.prepare(`
      SELECT
        id,
        thread_id,
        sender_type,
        sender_id,
        subject,
        body,
        body_format,
        attachments_json,
        read_at,
        created_at
      FROM messages
      WHERE thread_id = ?
      AND visible_to_client = 1
      ORDER BY created_at ASC
    `).bind(threadId).all();

    // Mark messages as read
    const now = Math.floor(Date.now() / 1000);
    await db.prepare(`
      UPDATE messages
      SET read_at = ?
      WHERE thread_id = ?
      AND sender_type != 'client'
      AND read_at IS NULL
    `).bind(now, threadId).run();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Get thread messages error:', error);
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
 * POST - Add a message to a thread
 */
export async function onRequestPost(context) {
  const { request, params, env } = context;
  const { slug, threadId } = params;

  if (!slug || !threadId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing required parameters'
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
    const { body: messageBody, attachments } = body;

    if (!messageBody || !messageBody.trim()) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Message body is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const db = env.DB;

    // Verify thread belongs to this client and is not closed
    const thread = await db.prepare(`
      SELECT id, client_id, status FROM message_threads WHERE id = ?
    `).bind(threadId).first();

    if (!thread || thread.client_id !== auth.clientId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Thread not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    if (thread.status === 'closed') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot reply to a closed thread'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const messageId = crypto.randomUUID();

    // Create message
    await db.prepare(`
      INSERT INTO messages (
        id, thread_id, sender_type, sender_id, body, body_format,
        attachments_json, visible_to_client, visible_to_rep, created_at
      ) VALUES (?, ?, 'client', ?, ?, 'text', ?, 1, 1, ?)
    `).bind(
      messageId,
      threadId,
      auth.clientId,
      messageBody.trim(),
      attachments ? JSON.stringify(attachments) : null,
      now
    ).run();

    // Update thread
    await db.prepare(`
      UPDATE message_threads
      SET last_message_at = ?, status = 'open', updated_at = ?
      WHERE id = ?
    `).bind(now, now, threadId).run();

    // Get the created message
    const message = await db.prepare(`
      SELECT id, thread_id, sender_type, sender_id, body, body_format, attachments_json, created_at
      FROM messages WHERE id = ?
    `).bind(messageId).first();

    return new Response(JSON.stringify({
      success: true,
      data: message
    }), {
      status: 201,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Create message error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to send message'
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
