/**
 * Rep Tickets API
 *
 * GET /api/rep/[slug]/tickets - List tickets for rep's assigned clients
 * POST /api/rep/[slug]/tickets - Create a new ticket (with visibility option)
 * PATCH /api/rep/[slug]/tickets/[id] - Update ticket status/details
 *
 * IMPORTANT: Reps can see ALL tickets (including internal) for their assigned clients.
 * Reps can create internal tickets that clients cannot see.
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../../_shared/auth.js';

const REP_COOKIE_NAME = 'ccrc_rep_token';

// Demo tickets data (includes internal tickets)
const DEMO_TICKETS = [
  {
    id: 'demo-ticket-001',
    client_id: 'demo-client-001',
    client_name: 'Demo Seafood Shack',
    subject: 'Menu item not showing on tablet',
    description: 'The new seasonal special we added yesterday is not appearing on the server tablets.',
    status: 'in_progress',
    priority: 'high',
    category: 'technical',
    visibility: 'client',
    ticket_type: 'support',
    created_at: Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60,
    updated_at: Math.floor(Date.now() / 1000) - 6 * 60 * 60,
    assigned_to: 'Tech Support'
  },
  {
    id: 'demo-ticket-int-001',
    client_id: 'demo-client-001',
    client_name: 'Demo Seafood Shack',
    subject: '[INTERNAL] Upsell opportunity - go-live support',
    description: 'Client mentioned they are nervous about launch day. Good candidate for go-live support package.',
    status: 'open',
    priority: 'normal',
    category: 'other',
    visibility: 'internal',
    ticket_type: 'internal',
    is_upsell_opportunity: 1,
    upsell_type: 'go_live_support',
    created_at: Math.floor(Date.now() / 1000) - 1 * 24 * 60 * 60,
    updated_at: Math.floor(Date.now() / 1000) - 1 * 24 * 60 * 60,
    assigned_to: null
  },
  {
    id: 'demo-ticket-002',
    client_id: 'demo-client-002',
    client_name: 'Cape Cod Bistro',
    subject: 'Question about next invoice',
    description: 'Client wants to understand the charges on their upcoming quarterly invoice.',
    status: 'waiting',
    priority: 'normal',
    category: 'billing',
    visibility: 'client',
    ticket_type: 'support',
    created_at: Math.floor(Date.now() / 1000) - 5 * 24 * 60 * 60,
    updated_at: Math.floor(Date.now() / 1000) - 1 * 24 * 60 * 60,
    assigned_to: 'Billing Team'
  },
  {
    id: 'demo-ticket-int-002',
    client_id: 'demo-client-002',
    client_name: 'Cape Cod Bistro',
    subject: '[INTERNAL] Follow up on renewal',
    description: 'Support plan renews in 7 days. Need to check if client has questions or wants to upgrade.',
    status: 'open',
    priority: 'high',
    category: 'billing',
    visibility: 'internal',
    ticket_type: 'internal',
    created_at: Math.floor(Date.now() / 1000) - 12 * 60 * 60,
    updated_at: Math.floor(Date.now() / 1000) - 12 * 60 * 60,
    assigned_to: null
  }
];

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
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

/**
 * GET - List tickets for rep's assigned clients
 */
export async function onRequestGet(context) {
  const { request, params, env } = context;
  const { slug } = params;
  const corsHeaders = getCorsHeaders(request);

  if (!slug) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing rep slug'
    }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const url = new URL(request.url);
  const isDemoMode = slug.startsWith('demo-') || url.searchParams.get('demo') === 'true';

  if (isDemoMode) {
    // Filter demo data based on params
    let filtered = [...DEMO_TICKETS];
    const visibility = url.searchParams.get('visibility');
    const clientId = url.searchParams.get('client_id');
    const internalOnly = url.searchParams.get('internal_only') === 'true';

    if (visibility) {
      filtered = filtered.filter(t => t.visibility === visibility);
    }
    if (clientId) {
      filtered = filtered.filter(t => t.client_id === clientId);
    }
    if (internalOnly) {
      filtered = filtered.filter(t => t.visibility === 'internal');
    }

    return new Response(JSON.stringify({
      success: true,
      data: filtered,
      counts: {
        total: DEMO_TICKETS.length,
        internal: DEMO_TICKETS.filter(t => t.visibility === 'internal').length,
        client_visible: DEMO_TICKETS.filter(t => t.visibility === 'client').length
      }
    }), {
      status: 200,
      headers: corsHeaders
    });
  }

  const auth = await verifyRepAuth(request, env, slug);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({
      success: false,
      error: auth.error
    }), {
      status: 401,
      headers: corsHeaders
    });
  }

  try {
    const db = env.DB;

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

    // Parse query params
    const visibility = url.searchParams.get('visibility');
    const clientId = url.searchParams.get('client_id');
    const internalOnly = url.searchParams.get('internal_only') === 'true';
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build query - get all tickets for assigned clients
    let query = `
      SELECT
        t.id,
        t.client_id,
        c.company as client_name,
        c.slug as client_slug,
        t.subject,
        t.description,
        t.status,
        t.priority,
        t.category,
        t.visibility,
        t.ticket_type,
        t.assigned_to,
        t.rep_id,
        t.due_date,
        t.target_date,
        t.target_date_label,
        t.is_upsell_opportunity,
        t.upsell_type,
        t.upsell_prompted_at,
        t.upsell_accepted,
        t.resolved_at,
        t.created_at,
        t.updated_at
      FROM tickets t
      JOIN clients c ON t.client_id = c.id
      WHERE t.client_id IN (
        SELECT client_id FROM client_rep_assignments WHERE rep_id = ?
      )
    `;
    const bindings = [rep.id];

    if (visibility) {
      query += ' AND t.visibility = ?';
      bindings.push(visibility);
    }

    if (internalOnly) {
      query += " AND t.visibility IN ('internal', 'rep_only')";
    }

    if (clientId) {
      query += ' AND t.client_id = ?';
      bindings.push(clientId);
    }

    if (status) {
      query += ' AND t.status = ?';
      bindings.push(status);
    }

    query += `
      ORDER BY
        CASE t.visibility WHEN 'internal' THEN 0 ELSE 1 END,
        CASE
          WHEN t.status = 'in_progress' THEN 1
          WHEN t.status = 'waiting' THEN 2
          WHEN t.status = 'open' THEN 3
          WHEN t.status = 'resolved' THEN 4
          ELSE 5
        END,
        CASE t.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        t.updated_at DESC
      LIMIT ? OFFSET ?
    `;
    bindings.push(limit, offset);

    const { results } = await db.prepare(query).bind(...bindings).all();

    // Get counts
    const countsResult = await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN visibility IN ('internal', 'rep_only') THEN 1 ELSE 0 END) as internal,
        SUM(CASE WHEN visibility = 'client' THEN 1 ELSE 0 END) as client_visible
      FROM tickets
      WHERE client_id IN (
        SELECT client_id FROM client_rep_assignments WHERE rep_id = ?
      )
    `).bind(rep.id).first();

    return new Response(JSON.stringify({
      success: true,
      data: results || [],
      counts: {
        total: countsResult?.total || 0,
        internal: countsResult?.internal || 0,
        client_visible: countsResult?.client_visible || 0
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Rep tickets error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * POST - Create a new ticket (with visibility option)
 */
export async function onRequestPost(context) {
  const { request, params, env } = context;
  const { slug } = params;
  const corsHeaders = getCorsHeaders(request);

  if (!slug) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing rep slug'
    }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const url = new URL(request.url);
  const isDemoMode = slug.startsWith('demo-') || url.searchParams.get('demo') === 'true';

  if (isDemoMode) {
    const body = await request.json();
    return new Response(JSON.stringify({
      success: true,
      data: {
        id: `demo-ticket-${Date.now()}`,
        ...body,
        visibility: body.visibility || 'client',
        status: 'open',
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      },
      message: 'Demo ticket created (not persisted)'
    }), {
      status: 201,
      headers: corsHeaders
    });
  }

  const auth = await verifyRepAuth(request, env, slug);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({
      success: false,
      error: auth.error
    }), {
      status: 401,
      headers: corsHeaders
    });
  }

  try {
    const db = env.DB;
    const body = await request.json();

    // Validate required fields
    if (!body.client_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client ID is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!body.subject || body.subject.trim() === '') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Subject is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get rep ID
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

    // Verify rep is assigned to this client
    const assignment = await db.prepare(`
      SELECT 1 FROM client_rep_assignments WHERE rep_id = ? AND client_id = ?
    `).bind(rep.id, body.client_id).first();

    if (!assignment) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You are not assigned to this client'
      }), {
        status: 403,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Default visibility to 'client' unless explicitly set to internal
    const visibility = ['internal', 'rep_only'].includes(body.visibility) ? body.visibility : 'client';
    const ticketType = body.ticket_type || (visibility === 'internal' ? 'internal' : 'support');

    await db.prepare(`
      INSERT INTO tickets (
        id, client_id, subject, description, priority, status, category,
        visibility, ticket_type, rep_id,
        is_upsell_opportunity, upsell_type,
        due_date, target_date, target_date_label,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      ticketId,
      body.client_id,
      body.subject.trim(),
      body.description?.trim() || null,
      body.priority || 'normal',
      body.category || 'other',
      visibility,
      ticketType,
      rep.id,
      body.is_upsell_opportunity ? 1 : 0,
      body.upsell_type || null,
      body.due_date || null,
      body.target_date || null,
      body.target_date_label || null,
      now,
      now
    ).run();

    const ticket = await db.prepare(`
      SELECT t.*, c.company as client_name
      FROM tickets t
      JOIN clients c ON t.client_id = c.id
      WHERE t.id = ?
    `).bind(ticketId).first();

    return new Response(JSON.stringify({
      success: true,
      data: ticket,
      message: visibility === 'internal'
        ? 'Internal ticket created (not visible to client)'
        : 'Ticket created successfully'
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

/**
 * PATCH - Update ticket status/details
 */
export async function onRequestPatch(context) {
  const { request, params, env } = context;
  const { slug } = params;
  const corsHeaders = getCorsHeaders(request);

  if (!slug) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing rep slug'
    }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const url = new URL(request.url);
  const isDemoMode = slug.startsWith('demo-') || url.searchParams.get('demo') === 'true';

  if (isDemoMode) {
    const body = await request.json();
    return new Response(JSON.stringify({
      success: true,
      message: 'Demo ticket updated (not persisted)'
    }), {
      status: 200,
      headers: corsHeaders
    });
  }

  const auth = await verifyRepAuth(request, env, slug);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({
      success: false,
      error: auth.error
    }), {
      status: 401,
      headers: corsHeaders
    });
  }

  try {
    const db = env.DB;
    const body = await request.json();

    if (!body.ticket_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Ticket ID is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get rep ID
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

    // Verify ticket belongs to an assigned client
    const ticket = await db.prepare(`
      SELECT t.* FROM tickets t
      WHERE t.id = ? AND t.client_id IN (
        SELECT client_id FROM client_rep_assignments WHERE rep_id = ?
      )
    `).bind(body.ticket_id, rep.id).first();

    if (!ticket) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Ticket not found or not accessible'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const updates = [];
    const values = [];

    // Build dynamic update
    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);
      if (body.status === 'resolved' && !ticket.resolved_at) {
        updates.push('resolved_at = ?');
        values.push(now);
      }
    }
    if (body.priority !== undefined) {
      updates.push('priority = ?');
      values.push(body.priority);
    }
    if (body.assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      values.push(body.assigned_to);
    }
    if (body.upsell_accepted !== undefined) {
      updates.push('upsell_accepted = ?');
      values.push(body.upsell_accepted ? 1 : 0);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No updates provided'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    updates.push('updated_at = ?');
    values.push(now, body.ticket_id);

    await db.prepare(`
      UPDATE tickets SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();

    const updatedTicket = await db.prepare(`
      SELECT t.*, c.company as client_name
      FROM tickets t
      JOIN clients c ON t.client_id = c.id
      WHERE t.id = ?
    `).bind(body.ticket_id).first();

    return new Response(JSON.stringify({
      success: true,
      data: updatedTicket
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Update ticket error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update ticket'
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
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
