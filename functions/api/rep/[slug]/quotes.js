// Rep Quotes API - CRUD for rep-created quotes
// Supports demo mode for slugs starting with "demo-"
import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../../_shared/auth.js';

const REP_COOKIE_NAME = 'ccrc_rep_token';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

function generateId() {
  return 'rq_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function generateQuoteNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `Q${year}${month}-${random}`;
}

// Demo quotes data
const DEMO_QUOTES = [
  {
    id: 'demo-quote-001',
    rep_id: 'demo-rep-001',
    client_id: 'demo-client-001',
    quote_data_json: JSON.stringify({
      locations: [{
        id: '1',
        name: 'Main Location',
        floors: [{
          id: '1',
          stations: [{ id: 's1', type: 'expo', name: 'Expo Station' }]
        }]
      }]
    }),
    quote_name: 'Demo Quote - Seafood Shack',
    quote_number: 'Q2601-DEMO',
    total_install_cost: 4500,
    total_monthly_cost: 500,
    location_count: 1,
    status: 'sent',
    sent_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
    viewed_at: Date.now() - 5 * 24 * 60 * 60 * 1000,
    expires_at: Date.now() + 23 * 24 * 60 * 60 * 1000,
    accepted_at: null,
    declined_at: null,
    notes: 'Standard installation package',
    created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
    client_name: 'Demo User',
    client_company: 'Demo Seafood Shack'
  },
  {
    id: 'demo-quote-002',
    rep_id: 'demo-rep-001',
    client_id: 'demo-client-002',
    quote_data_json: JSON.stringify({
      locations: [{
        id: '1',
        name: 'Main Location',
        floors: [{
          id: '1',
          stations: [
            { id: 's1', type: 'expo', name: 'Kitchen KDS' },
            { id: 's2', type: 'server', name: 'Server Station 1' }
          ]
        }]
      }]
    }),
    quote_name: 'Cape Cod Bistro Upgrade',
    quote_number: 'Q2601-DEM2',
    total_install_cost: 8200,
    total_monthly_cost: 800,
    location_count: 1,
    status: 'draft',
    sent_at: null,
    viewed_at: null,
    expires_at: null,
    accepted_at: null,
    declined_at: null,
    notes: 'Multi-station upgrade',
    created_at: Date.now() - 2 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 2 * 24 * 60 * 60 * 1000,
    client_name: 'John Smith',
    client_company: 'Cape Cod Bistro'
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

    // 1. Try rep-specific token
    const token = cookies[REP_COOKIE_NAME];
    if (token) {
      const jwtSecret = env.REP_JWT_SECRET || env.JWT_SECRET || env.ADMIN_PASSWORD_HASH;
      if (jwtSecret) {
        const isValid = await jwt.verify(token, jwtSecret);
        if (isValid) {
          const { payload } = jwt.decode(token);
          if (payload.slug === slug && payload.type === 'rep') {
            return { authenticated: true, repId: payload.repId };
          }
        }
      }
    }

    // 2. Fall back to admin token (allows admin to view rep portals)
    const adminToken = cookies['ccrc_admin_token'];
    if (adminToken) {
      const jwtSecret = env.JWT_SECRET || env.ADMIN_PASSWORD_HASH;
      if (jwtSecret) {
        const isValid = await jwt.verify(adminToken, jwtSecret);
        if (isValid) {
          return { authenticated: true, isAdmin: true };
        }
      }
    }

    return { authenticated: false, error: 'No session found' };
  } catch (error) {
    console.error('Rep auth error:', error);
    return { authenticated: false, error: 'Authentication failed' };
  }
}

// GET /api/rep/[slug]/quotes - List rep's quotes
export async function onRequestGet(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const db = context.env.DB;
    const { slug } = context.params;
    const url = new URL(context.request.url);

    // Check for demo mode
    const isDemoMode = slug.startsWith('demo-') || url.searchParams.get('demo') === 'true';

    if (isDemoMode) {
      const status = url.searchParams.get('status');
      const clientId = url.searchParams.get('clientId');
      let filtered = DEMO_QUOTES;

      if (status) {
        filtered = filtered.filter(q => q.status === status);
      }
      if (clientId) {
        filtered = filtered.filter(q => q.client_id === clientId);
      }

      return new Response(JSON.stringify({
        success: true,
        data: filtered
      }), { headers: corsHeaders });
    }

    // Verify authentication
    const auth = await verifyRepAuth(context.request, context.env, slug);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error
      }), { status: 401, headers: corsHeaders });
    }

    // Get rep ID from slug
    const rep = await db.prepare('SELECT id FROM reps WHERE slug = ?').bind(slug).first();
    if (!rep) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rep not found'
      }), { status: 404, headers: corsHeaders });
    }

    // Build query with filters
    const status = url.searchParams.get('status');
    const clientId = url.searchParams.get('clientId');

    let query = `
      SELECT
        rq.*,
        c.name as client_name,
        c.company as client_company,
        c.slug as client_slug
      FROM rep_quotes rq
      LEFT JOIN clients c ON rq.client_id = c.id
      WHERE rq.rep_id = ?
    `;
    const params = [rep.id];

    if (status) {
      query += ' AND rq.status = ?';
      params.push(status);
    }
    if (clientId) {
      query += ' AND rq.client_id = ?';
      params.push(clientId);
    }

    query += ' ORDER BY rq.created_at DESC';

    const { results } = await db.prepare(query).bind(...params).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), { headers: corsHeaders });
  } catch (error) {
    console.error('Rep quotes GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

// POST /api/rep/[slug]/quotes - Create or send quote
export async function onRequestPost(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const db = context.env.DB;
    const { slug } = context.params;
    const body = await context.request.json();

    // Check for demo mode
    const isDemoMode = slug.startsWith('demo-');
    if (isDemoMode) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          id: 'demo-quote-new',
          ...body,
          quote_number: generateQuoteNumber(),
          status: body.status || 'draft',
          created_at: Date.now(),
          updated_at: Date.now()
        },
        message: 'Demo mode - quote would be created'
      }), { headers: corsHeaders });
    }

    // Verify authentication
    const auth = await verifyRepAuth(context.request, context.env, slug);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error
      }), { status: 401, headers: corsHeaders });
    }

    // Get rep
    const rep = await db.prepare('SELECT id, name, email FROM reps WHERE slug = ?').bind(slug).first();
    if (!rep) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rep not found'
      }), { status: 404, headers: corsHeaders });
    }

    // Validate required fields
    if (!body.quote_data_json) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Quote data is required'
      }), { status: 400, headers: corsHeaders });
    }

    // Check if rep has permission for this client (if client specified)
    if (body.client_id) {
      const assignment = await db.prepare(`
        SELECT can_quote FROM client_rep_assignments
        WHERE rep_id = ? AND client_id = ?
      `).bind(rep.id, body.client_id).first();

      if (!assignment) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Not assigned to this client'
        }), { status: 403, headers: corsHeaders });
      }

      if (!assignment.can_quote) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Quote creation not permitted for this client'
        }), { status: 403, headers: corsHeaders });
      }
    }

    const quoteId = generateId();
    const quoteNumber = generateQuoteNumber();
    const now = Math.floor(Date.now() / 1000);
    const status = body.status || 'draft';
    const sentAt = status === 'sent' ? now : null;
    const expiresAt = status === 'sent' ? now + (30 * 24 * 60 * 60) : null; // 30 days

    await db.prepare(`
      INSERT INTO rep_quotes (
        id, rep_id, client_id, quote_data_json, quote_name, quote_number,
        total_install_cost, total_monthly_cost, location_count,
        status, sent_at, expires_at, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      quoteId,
      rep.id,
      body.client_id || null,
      typeof body.quote_data_json === 'string' ? body.quote_data_json : JSON.stringify(body.quote_data_json),
      body.quote_name || null,
      quoteNumber,
      body.total_install_cost || null,
      body.total_monthly_cost || null,
      body.location_count || 1,
      status,
      sentAt,
      expiresAt,
      body.notes || null,
      now,
      now
    ).run();

    // Log activity
    await db.prepare(`
      INSERT INTO rep_activity_log (
        id, rep_id, activity_type, client_id, quote_id, title, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      'ral_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      rep.id,
      status === 'sent' ? 'quote_sent' : 'quote_created',
      body.client_id || null,
      quoteId,
      status === 'sent' ? `Quote ${quoteNumber} sent` : `Quote ${quoteNumber} created`,
      body.quote_name || null,
      now
    ).run();

    // If status is 'sent', send email notification (TODO: implement via Resend)
    // This would also create a portal notification for the client

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: quoteId,
        quote_number: quoteNumber,
        status,
        sent_at: sentAt ? sentAt * 1000 : null,
        expires_at: expiresAt ? expiresAt * 1000 : null
      }
    }), { status: 201, headers: corsHeaders });
  } catch (error) {
    console.error('Rep quotes POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

// PATCH /api/rep/[slug]/quotes - Update quote (expects quoteId in body)
export async function onRequestPatch(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const db = context.env.DB;
    const { slug } = context.params;
    const body = await context.request.json();

    // Check for demo mode
    const isDemoMode = slug.startsWith('demo-');
    if (isDemoMode) {
      return new Response(JSON.stringify({
        success: true,
        data: { ...body, updated_at: Date.now() },
        message: 'Demo mode - quote would be updated'
      }), { headers: corsHeaders });
    }

    // Verify authentication
    const auth = await verifyRepAuth(context.request, context.env, slug);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error
      }), { status: 401, headers: corsHeaders });
    }

    if (!body.quoteId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Quote ID is required'
      }), { status: 400, headers: corsHeaders });
    }

    // Get rep
    const rep = await db.prepare('SELECT id FROM reps WHERE slug = ?').bind(slug).first();
    if (!rep) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rep not found'
      }), { status: 404, headers: corsHeaders });
    }

    // Verify rep owns this quote
    const quote = await db.prepare('SELECT * FROM rep_quotes WHERE id = ? AND rep_id = ?')
      .bind(body.quoteId, rep.id).first();

    if (!quote) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Quote not found or not authorized'
      }), { status: 404, headers: corsHeaders });
    }

    // Build update
    const updates = [];
    const params = [];
    const now = Math.floor(Date.now() / 1000);

    if (body.status !== undefined) {
      updates.push('status = ?');
      params.push(body.status);

      if (body.status === 'sent' && quote.status !== 'sent') {
        updates.push('sent_at = ?');
        params.push(now);
        updates.push('expires_at = ?');
        params.push(now + (30 * 24 * 60 * 60));
        updates.push('email_send_count = email_send_count + 1');
        updates.push('last_email_sent_at = ?');
        params.push(now);
      }
    }

    if (body.quote_data_json !== undefined) {
      updates.push('quote_data_json = ?');
      params.push(typeof body.quote_data_json === 'string' ? body.quote_data_json : JSON.stringify(body.quote_data_json));
    }

    if (body.quote_name !== undefined) {
      updates.push('quote_name = ?');
      params.push(body.quote_name);
    }

    if (body.total_install_cost !== undefined) {
      updates.push('total_install_cost = ?');
      params.push(body.total_install_cost);
    }

    if (body.total_monthly_cost !== undefined) {
      updates.push('total_monthly_cost = ?');
      params.push(body.total_monthly_cost);
    }

    if (body.notes !== undefined) {
      updates.push('notes = ?');
      params.push(body.notes);
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(body.quoteId);

    await db.prepare(`
      UPDATE rep_quotes SET ${updates.join(', ')} WHERE id = ?
    `).bind(...params).run();

    // Log activity if status changed to sent
    if (body.status === 'sent' && quote.status !== 'sent') {
      await db.prepare(`
        INSERT INTO rep_activity_log (
          id, rep_id, activity_type, client_id, quote_id, title, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        'ral_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
        rep.id,
        'quote_sent',
        quote.client_id,
        body.quoteId,
        `Quote ${quote.quote_number} sent`,
        now
      ).run();
    }

    return new Response(JSON.stringify({
      success: true,
      data: { id: body.quoteId, updated_at: now * 1000 }
    }), { headers: corsHeaders });
  } catch (error) {
    console.error('Rep quotes PATCH error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

// DELETE /api/rep/[slug]/quotes - Delete draft quote (expects quoteId in query or body)
export async function onRequestDelete(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const db = context.env.DB;
    const { slug } = context.params;
    const url = new URL(context.request.url);
    const quoteId = url.searchParams.get('quoteId');

    // Check for demo mode
    const isDemoMode = slug.startsWith('demo-');
    if (isDemoMode) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Demo mode - quote would be deleted'
      }), { headers: corsHeaders });
    }

    // Verify authentication
    const auth = await verifyRepAuth(context.request, context.env, slug);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error
      }), { status: 401, headers: corsHeaders });
    }

    if (!quoteId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Quote ID is required'
      }), { status: 400, headers: corsHeaders });
    }

    // Get rep
    const rep = await db.prepare('SELECT id FROM reps WHERE slug = ?').bind(slug).first();
    if (!rep) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rep not found'
      }), { status: 404, headers: corsHeaders });
    }

    // Verify rep owns this quote and it's a draft
    const quote = await db.prepare('SELECT * FROM rep_quotes WHERE id = ? AND rep_id = ?')
      .bind(quoteId, rep.id).first();

    if (!quote) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Quote not found or not authorized'
      }), { status: 404, headers: corsHeaders });
    }

    if (quote.status !== 'draft') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Only draft quotes can be deleted'
      }), { status: 400, headers: corsHeaders });
    }

    await db.prepare('DELETE FROM rep_quotes WHERE id = ?').bind(quoteId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Quote deleted'
    }), { headers: corsHeaders });
  } catch (error) {
    console.error('Rep quotes DELETE error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getCorsOrigin(context.request),
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
