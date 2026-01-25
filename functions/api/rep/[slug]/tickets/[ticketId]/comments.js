/**
 * Rep Ticket Comments API
 * GET /api/rep/:slug/tickets/:ticketId/comments - List comments (includes internal)
 * POST /api/rep/:slug/tickets/:ticketId/comments - Add comment from rep
 */
import jwt from '@tsndr/cloudflare-worker-jwt';
import { verifyAuth, getCorsOrigin } from '../../../../../_shared/auth.js';

const REP_COOKIE = 'ccrc_rep_token';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

async function verifyRep(request, env, slug) {
  if (slug.startsWith('demo-')) {
    return { authenticated: true, repId: 'demo-rep', repName: 'Demo Rep', isDemo: true };
  }

  // Try rep token first
  const cookies = request.headers.get('Cookie') || '';
  const repMatch = cookies.match(new RegExp(`${REP_COOKIE}=([^;]+)`));
  if (repMatch) {
    try {
      const valid = await jwt.verify(repMatch[1], env.JWT_SECRET || 'dev-secret');
      if (valid) {
        const decoded = jwt.decode(repMatch[1]);
        if (decoded.payload.slug === slug) {
          return { authenticated: true, repId: decoded.payload.repId, repName: decoded.payload.name || 'Rep' };
        }
      }
    } catch {}
  }

  // Fallback to admin token
  const auth = await verifyAuth(request, env);
  if (auth.authenticated) {
    return { authenticated: true, repId: 'admin', repName: 'Admin' };
  }

  return { authenticated: false };
}

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const { slug, ticketId } = params;
  const headers = getCorsHeaders(request);

  try {
    const auth = await verifyRep(request, env, slug);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers });
    }

    if (auth.isDemo) {
      return new Response(JSON.stringify({
        success: true,
        data: [
          { id: 'demo-c1', ticket_id: ticketId, author_type: 'client', author_name: 'Restaurant Owner', content: 'Our Toast tablets are running slow during lunch rush.', visibility: 'all', created_at: Math.floor(Date.now() / 1000) - 7200 },
          { id: 'demo-c2', ticket_id: ticketId, author_type: 'rep', author_name: 'You', content: 'I\'ll check the network configuration. Can you tell me how many tablets are affected?', visibility: 'all', created_at: Math.floor(Date.now() / 1000) - 5400 },
          { id: 'demo-c3', ticket_id: ticketId, author_type: 'rep', author_name: 'You', content: 'Internal: This might be a firmware issue. Check with Toast support on version.', visibility: 'internal', created_at: Math.floor(Date.now() / 1000) - 3600 }
        ]
      }), { headers });
    }

    // Reps can see all comments including internal ones
    const comments = await env.DB.prepare(`
      SELECT * FROM ticket_comments
      WHERE ticket_id = ?
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
    const auth = await verifyRep(request, env, slug);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers });
    }

    if (auth.isDemo) {
      return new Response(JSON.stringify({
        success: true,
        data: { id: 'demo-new', ticket_id: ticketId, author_type: 'rep', author_name: 'You', content: 'Demo reply', visibility: 'all', created_at: Math.floor(Date.now() / 1000) }
      }), { status: 201, headers });
    }

    const body = await request.json();
    const { content, visibility = 'all' } = body;

    if (!content || !content.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'Comment content is required' }), { status: 400, headers });
    }

    const id = `comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await env.DB.prepare(`
      INSERT INTO ticket_comments (id, ticket_id, author_type, author_id, author_name, content, visibility)
      VALUES (?, ?, 'rep', ?, ?, ?, ?)
    `).bind(id, ticketId, auth.repId, auth.repName, content.trim(), visibility).run();

    // Update ticket
    await env.DB.prepare(`
      UPDATE tickets SET updated_at = unixepoch() WHERE id = ?
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
