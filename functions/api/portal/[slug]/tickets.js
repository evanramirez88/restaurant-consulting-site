/**
 * Portal Tickets API
 *
 * GET /api/portal/[slug]/tickets - List client's visible tickets
 * POST /api/portal/[slug]/tickets - Create a new support ticket
 *
 * IMPORTANT: Only returns tickets with visibility='client'
 * Internal tickets are hidden from clients.
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../../_shared/auth.js';

const COOKIE_NAME = 'ccrc_client_token';

// Demo tickets data
const DEMO_TICKETS = [
  {
    id: 'demo-ticket-001',
    subject: 'Menu item not showing on tablet',
    description: 'The new seasonal special we added yesterday is not appearing on the server tablets.',
    status: 'in_progress',
    priority: 'high',
    category: 'technical',
    created_at: Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60,
    updated_at: Math.floor(Date.now() / 1000) - 6 * 60 * 60,
    due_date: Math.floor(Date.now() / 1000) + 1 * 24 * 60 * 60,
    assigned_to: 'Tech Support'
  },
  {
    id: 'demo-ticket-002',
    subject: 'Question about next invoice',
    description: 'Can you explain the charges on my upcoming quarterly invoice?',
    status: 'waiting',
    priority: 'normal',
    category: 'billing',
    created_at: Math.floor(Date.now() / 1000) - 5 * 24 * 60 * 60,
    updated_at: Math.floor(Date.now() / 1000) - 1 * 24 * 60 * 60,
    due_date: null,
    assigned_to: 'Billing Team'
  },
  {
    id: 'demo-ticket-003',
    subject: 'Staff training request',
    description: 'We have 3 new servers starting next week. Can we schedule a training session?',
    status: 'resolved',
    priority: 'normal',
    category: 'training',
    created_at: Math.floor(Date.now() / 1000) - 10 * 24 * 60 * 60,
    updated_at: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60,
    resolved_at: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60,
    due_date: null,
    assigned_to: 'Training Team'
  }
];

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

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

/**
 * GET - List client's visible tickets
 */
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

  // Check for demo mode
  const url = new URL(request.url);
  const isDemoMode = slug.startsWith('demo-') || url.searchParams.get('demo') === 'true';

  if (isDemoMode) {
    return new Response(JSON.stringify({
      success: true,
      data: DEMO_TICKETS
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

    // Parse query params
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build query - ONLY return client-visible tickets
    let query = `
      SELECT
        id,
        subject,
        description,
        status,
        priority,
        category,
        assigned_to,
        due_date,
        target_date,
        target_date_label,
        resolved_at,
        created_at,
        updated_at
      FROM tickets
      WHERE client_id = ?
        AND visibility = 'client'
    `;
    const bindings = [auth.clientId];

    if (status) {
      query += ' AND status = ?';
      bindings.push(status);
    }

    if (category) {
      query += ' AND category = ?';
      bindings.push(category);
    }

    query += `
      ORDER BY
        CASE
          WHEN status = 'in_progress' THEN 1
          WHEN status = 'waiting' THEN 2
          WHEN status = 'open' THEN 3
          WHEN status = 'resolved' THEN 4
          ELSE 5
        END,
        CASE priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        updated_at DESC
      LIMIT ? OFFSET ?
    `;
    bindings.push(limit, offset);

    const { results } = await db.prepare(query).bind(...bindings).all();

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total FROM tickets
      WHERE client_id = ? AND visibility = 'client'
    `;
    const countBindings = [auth.clientId];

    if (status) {
      countQuery += ' AND status = ?';
      countBindings.push(status);
    }
    if (category) {
      countQuery += ' AND category = ?';
      countBindings.push(category);
    }

    const countResult = await db.prepare(countQuery).bind(...countBindings).first();

    return new Response(JSON.stringify({
      success: true,
      data: results || [],
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset,
        hasMore: offset + limit < (countResult?.total || 0)
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Portal tickets error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to load tickets'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * POST - Create a new support ticket
 */
export async function onRequestPost(context) {
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

  // Demo mode - simulate ticket creation
  const url = new URL(request.url);
  const isDemoMode = slug.startsWith('demo-') || url.searchParams.get('demo') === 'true';

  if (isDemoMode) {
    const body = await request.json();
    return new Response(JSON.stringify({
      success: true,
      data: {
        id: `demo-ticket-${Date.now()}`,
        ...body,
        status: 'open',
        visibility: 'client',
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      },
      message: 'Demo ticket created (not persisted)'
    }), {
      status: 201,
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
    const body = await request.json();

    // Validate required fields
    if (!body.subject || body.subject.trim() === '') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Subject is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Client-created tickets are always visible to client
    await db.prepare(`
      INSERT INTO tickets (
        id, client_id, subject, description, priority, status, category,
        visibility, ticket_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'open', ?, 'client', 'support', ?, ?)
    `).bind(
      ticketId,
      auth.clientId,
      body.subject.trim(),
      body.description?.trim() || null,
      body.priority || 'normal',
      body.category || 'other',
      now,
      now
    ).run();

    const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?')
      .bind(ticketId)
      .first();

    return new Response(JSON.stringify({
      success: true,
      data: ticket,
      message: 'Support ticket created successfully'
    }), {
      status: 201,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Create ticket error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to create ticket'
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
