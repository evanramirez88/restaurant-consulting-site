/**
 * Portal CSAT Survey API
 * GET /api/portal/:slug/tickets/:ticketId/satisfaction - Check if survey exists
 * POST /api/portal/:slug/tickets/:ticketId/satisfaction - Submit satisfaction rating
 */
import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../../../../_shared/auth.js';

const COOKIE_NAME = 'ccrc_client_token';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

async function verifyClient(request, env, slug) {
  if (slug.startsWith('demo-')) {
    return { authenticated: true, clientId: 'demo-client', isDemo: true };
  }
  const cookies = request.headers.get('Cookie') || '';
  const tokenMatch = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!tokenMatch) return { authenticated: false };
  try {
    const valid = await jwt.verify(tokenMatch[1], env.JWT_SECRET || 'dev-secret');
    if (!valid) return { authenticated: false };
    const decoded = jwt.decode(tokenMatch[1]);
    if (decoded.payload.slug !== slug) return { authenticated: false };
    return { authenticated: true, clientId: decoded.payload.clientId };
  } catch { return { authenticated: false }; }
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
      return new Response(JSON.stringify({ success: true, data: null }), { headers });
    }

    const existing = await env.DB.prepare(
      'SELECT * FROM ticket_satisfaction WHERE ticket_id = ?'
    ).bind(ticketId).first();

    return new Response(JSON.stringify({ success: true, data: existing || null }), { headers });
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
      return new Response(JSON.stringify({ success: true, data: { rating: 5, feedback: 'Demo' } }), { status: 201, headers });
    }

    const body = await request.json();
    const { rating, feedback } = body;

    if (!rating || rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ success: false, error: 'Rating must be 1-5' }), { status: 400, headers });
    }

    // Verify ticket is resolved and belongs to client
    const ticket = await env.DB.prepare(`
      SELECT t.id FROM tickets t
      JOIN clients c ON t.client_id = c.id
      WHERE t.id = ? AND c.slug = ? AND t.status IN ('resolved', 'closed')
    `).bind(ticketId, slug).first();

    if (!ticket) {
      return new Response(JSON.stringify({ success: false, error: 'Ticket not found or not resolved' }), { status: 404, headers });
    }

    const id = `csat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await env.DB.prepare(`
      INSERT OR REPLACE INTO ticket_satisfaction (id, ticket_id, client_id, rating, feedback)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, ticketId, auth.clientId, rating, feedback || null).run();

    return new Response(JSON.stringify({ success: true, data: { id, rating, feedback } }), { status: 201, headers });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers });
  }
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}
