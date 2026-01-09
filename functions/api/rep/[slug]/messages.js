// Rep Messages API - Get and send private messages between rep and admin
// Supports demo mode for slugs starting with "demo-"
import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../../_shared/auth.js';

const REP_COOKIE_NAME = 'ccrc_rep_token';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

// Demo messages data
const DEMO_MESSAGES = [
  {
    id: 'demo-msg-001',
    thread_id: 'demo-thread-001',
    sender_type: 'admin',
    sender_id: 'admin',
    subject: null,
    body: 'Welcome to the rep portal! Let us know if you have any questions.',
    is_private: true,
    read_at: Date.now() - 1 * 24 * 60 * 60 * 1000,
    created_at: Date.now() - 7 * 24 * 60 * 60 * 1000
  },
  {
    id: 'demo-msg-002',
    thread_id: 'demo-thread-001',
    sender_type: 'rep',
    sender_id: 'demo-rep-001',
    subject: null,
    body: 'Thanks! I have a question about commission rates.',
    is_private: true,
    read_at: null,
    created_at: Date.now() - 5 * 24 * 60 * 60 * 1000
  }
];

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    const value = rest.join('=').trim();
    if (name) cookies[name.trim()] = value;
  });
  return cookies;
}

async function verifyRepAuth(request, env, slug) {
  try {
    const cookieHeader = request.headers.get('Cookie');
    const cookies = parseCookies(cookieHeader);
    const token = cookies[REP_COOKIE_NAME];

    if (!token) {
      return { authenticated: false, error: 'No session found' };
    }

    const jwtSecret = env.REP_JWT_SECRET || env.JWT_SECRET || env.ADMIN_PASSWORD_HASH;
    if (!jwtSecret) {
      return { authenticated: false, error: 'Server configuration error' };
    }

    const isValid = await jwt.verify(token, jwtSecret);
    if (!isValid) {
      return { authenticated: false, error: 'Invalid or expired session' };
    }

    const { payload } = jwt.decode(token);
    if (payload.slug !== slug || payload.type !== 'rep') {
      return { authenticated: false, error: 'Unauthorized' };
    }

    return { authenticated: true, repId: payload.repId };
  } catch (error) {
    console.error('Rep auth error:', error);
    return { authenticated: false, error: 'Authentication failed' };
  }
}

export async function onRequestGet(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const db = context.env.DB;
    const { slug } = context.params;

    // Check for demo mode - slug starts with "demo-"
    const url = new URL(context.request.url);
    const isDemoMode = slug.startsWith('demo-') || url.searchParams.get('demo') === 'true';

    if (isDemoMode) {
      return new Response(JSON.stringify({
        success: true,
        data: DEMO_MESSAGES,
        threadId: 'demo-thread-001'
      }), {
        headers: corsHeaders
      });
    }

    // Verify authentication
    const auth = await verifyRepAuth(context.request, context.env, slug);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Get rep ID from slug
    const rep = await db.prepare('SELECT id FROM reps WHERE slug = ?').bind(slug).first();
    if (!rep) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rep not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Get or create private thread for this rep
    let thread = await db.prepare(`
      SELECT id FROM message_threads
      WHERE rep_id = ? AND thread_type = 'private' AND client_id IS NULL
      LIMIT 1
    `).bind(rep.id).first();

    if (!thread) {
      // Create private thread
      const threadId = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);
      await db.prepare(`
        INSERT INTO message_threads (id, title, thread_type, rep_id, status, created_at, updated_at)
        VALUES (?, 'Private Thread', 'private', ?, 'open', ?, ?)
      `).bind(threadId, rep.id, now, now).run();
      thread = { id: threadId };
    }

    // Get messages in thread
    const { results } = await db.prepare(`
      SELECT
        id, thread_id, sender_type, sender_id, subject, body,
        is_private, read_at, created_at
      FROM messages
      WHERE thread_id = ? AND is_private = 1 AND visible_to_rep = 1
      ORDER BY created_at ASC
    `).bind(thread.id).all();

    // Mark unread messages as read
    const now = Math.floor(Date.now() / 1000);
    await db.prepare(`
      UPDATE messages
      SET read_at = ?
      WHERE thread_id = ? AND sender_type = 'admin' AND read_at IS NULL
    `).bind(now, thread.id).run();

    return new Response(JSON.stringify({
      success: true,
      data: results || [],
      threadId: thread.id
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Rep messages error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPost(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const db = context.env.DB;
    const { slug } = context.params;

    // Verify authentication
    const auth = await verifyRepAuth(context.request, context.env, slug);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Get rep ID from slug
    const rep = await db.prepare('SELECT id FROM reps WHERE slug = ?').bind(slug).first();
    if (!rep) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rep not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    // Get or create private thread for this rep
    let thread = await db.prepare(`
      SELECT id FROM message_threads
      WHERE rep_id = ? AND thread_type = 'private' AND client_id IS NULL
      LIMIT 1
    `).bind(rep.id).first();

    if (!thread) {
      // Create private thread
      const threadId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO message_threads (id, title, thread_type, rep_id, status, created_at, updated_at)
        VALUES (?, 'Private Thread', 'private', ?, 'open', ?, ?)
      `).bind(threadId, rep.id, now, now).run();
      thread = { id: threadId };
    }

    // Create message
    const messageId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO messages (
        id, thread_id, sender_type, sender_id, body, is_private,
        visible_to_client, visible_to_rep, created_at
      ) VALUES (?, ?, 'rep', ?, ?, 1, 0, 1, ?)
    `).bind(
      messageId,
      thread.id,
      rep.id,
      body.body,
      now
    ).run();

    // Update thread last_message_at
    await db.prepare(`
      UPDATE message_threads SET last_message_at = ?, updated_at = ? WHERE id = ?
    `).bind(now, now, thread.id).run();

    const message = await db.prepare('SELECT * FROM messages WHERE id = ?').bind(messageId).first();

    return new Response(JSON.stringify({
      success: true,
      data: message
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Send message error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getCorsOrigin(context.request),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
