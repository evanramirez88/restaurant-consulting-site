/**
 * Portal Ticket Comments API
 * GET /api/portal/:slug/tickets/:ticketId/comments - List client-visible comments
 * POST /api/portal/:slug/tickets/:ticketId/comments - Add comment from client
 */
import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../../../../_shared/auth.js';

const COOKIE_NAME = 'ccrc_client_token';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

async function verifyClient(request, env, slug) {
  // Demo mode
  if (slug.startsWith('demo-')) {
    return { authenticated: true, clientId: 'demo-client', clientName: 'Demo User', isDemo: true };
  }

  const cookies = request.headers.get('Cookie') || '';
  const tokenMatch = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!tokenMatch) return { authenticated: false };

  try {
    const valid = await jwt.verify(tokenMatch[1], env.JWT_SECRET || 'dev-secret');
    if (!valid) return { authenticated: false };
    const decoded = jwt.decode(tokenMatch[1]);
    if (decoded.payload.slug !== slug) return { authenticated: false };
    return { authenticated: true, clientId: decoded.payload.clientId, clientName: decoded.payload.name || 'Client' };
  } catch {
    return { authenticated: false };
  }
}

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const { slug, ticketId } = params;
  const headers = getCorsHeaders(request);

  try {
    const auth = await verifyClient(request, env, slug);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers });
    }

    if (auth.isDemo) {
      return new Response(JSON.stringify({
        success: true,
        data: [
          { id: 'demo-comment-1', ticket_id: ticketId, author_type: 'admin', author_name: 'Support Team', content: 'We\'ve received your request and are looking into it. We\'ll update you shortly.', visibility: 'all', created_at: Math.floor(Date.now() / 1000) - 3600 },
          { id: 'demo-comment-2', ticket_id: ticketId, author_type: 'client', author_name: 'You', content: 'Thank you for the quick response!', visibility: 'all', created_at: Math.floor(Date.now() / 1000) - 1800 }
        ]
      }), { headers });
    }

    // Only show comments visible to client (visibility = 'all' or 'client')
    const comments = await env.DB.prepare(`
      SELECT id, ticket_id, author_type, author_name, content, visibility, created_at
      FROM ticket_comments
      WHERE ticket_id = ? AND visibility IN ('all', 'client')
      ORDER BY created_at ASC
    `).bind(ticketId).all();

    return new Response(JSON.stringify({
      success: true,
      data: comments.results || []
    }), { headers });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers });
  }
}

export async function onRequestPost(context) {
  const { env, request, params } = context;
  const { slug, ticketId } = params;
  const headers = getCorsHeaders(request);

  try {
    const auth = await verifyClient(request, env, slug);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers });
    }

    if (auth.isDemo) {
      return new Response(JSON.stringify({
        success: true,
        data: { id: 'demo-new', ticket_id: ticketId, author_type: 'client', author_name: 'You', content: 'Demo comment', visibility: 'all', created_at: Math.floor(Date.now() / 1000) }
      }), { status: 201, headers });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'Comment content is required' }), { status: 400, headers });
    }

    // Verify ticket belongs to this client and is visible
    const ticket = await env.DB.prepare(`
      SELECT t.id FROM tickets t
      JOIN clients c ON t.client_id = c.id
      WHERE t.id = ? AND c.slug = ? AND t.visibility = 'client'
    `).bind(ticketId, slug).first();

    if (!ticket) {
      return new Response(JSON.stringify({ success: false, error: 'Ticket not found' }), { status: 404, headers });
    }

    const id = `comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await env.DB.prepare(`
      INSERT INTO ticket_comments (id, ticket_id, author_type, author_id, author_name, content, visibility)
      VALUES (?, ?, 'client', ?, ?, ?, 'all')
    `).bind(id, ticketId, auth.clientId, auth.clientName, content.trim()).run();

    // Update ticket status to open if it was waiting/resolved (client replied)
    await env.DB.prepare(`
      UPDATE tickets SET
        status = CASE WHEN status IN ('waiting', 'resolved') THEN 'open' ELSE status END,
        updated_at = unixepoch()
      WHERE id = ?
    `).bind(ticketId).run();

    const comment = await env.DB.prepare('SELECT * FROM ticket_comments WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({ success: true, data: comment }), { status: 201, headers });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers });
  }
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}
