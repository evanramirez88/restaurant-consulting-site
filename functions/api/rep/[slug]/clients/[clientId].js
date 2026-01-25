// Rep Client Detail API - Get a specific client's details
// Supports demo mode for slugs starting with "demo-"
import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../../../_shared/auth.js';

const REP_COOKIE_NAME = 'ccrc_rep_token';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

// Demo client data
const DEMO_CLIENTS = {
  'demo-client-001': {
    id: 'demo-client-001',
    name: 'Demo User',
    company: 'Demo Seafood Shack',
    email: 'demo@example.com',
    phone: '508-555-1234',
    slug: 'demo-seafood-shack',
    portal_enabled: true,
    support_plan_tier: 'professional',
    support_plan_status: 'active',
    address_line1: '123 Harbor Way',
    address_line2: null,
    city: 'Provincetown',
    state: 'MA',
    zip: '02657',
    assignment_role: 'primary',
    commission_rate: 0.10,
    assigned_at: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60,
    updated_at: Math.floor(Date.now() / 1000) - 1 * 24 * 60 * 60,
    can_quote: true,
    can_menu_build: true,
    can_create_tickets: true,
    can_view_billing: false
  },
  'demo-client-002': {
    id: 'demo-client-002',
    name: 'John Smith',
    company: 'Cape Cod Bistro',
    email: 'john@capebistro.com',
    phone: '508-555-5678',
    slug: 'cape-cod-bistro',
    portal_enabled: true,
    support_plan_tier: 'core',
    support_plan_status: 'active',
    address_line1: '456 Main Street',
    address_line2: 'Suite 100',
    city: 'Hyannis',
    state: 'MA',
    zip: '02601',
    assignment_role: 'secondary',
    commission_rate: 0.05,
    assigned_at: Math.floor(Date.now() / 1000) - 60 * 24 * 60 * 60,
    updated_at: Math.floor(Date.now() / 1000) - 3 * 24 * 60 * 60,
    can_quote: true,
    can_menu_build: false,
    can_create_tickets: true,
    can_view_billing: false
  }
};

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

// GET /api/rep/[slug]/clients/[clientId] - Get client details
export async function onRequestGet(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const db = context.env.DB;
    const { slug, clientId } = context.params;

    // Check for demo mode
    const url = new URL(context.request.url);
    const isDemoMode = slug.startsWith('demo-') || url.searchParams.get('demo') === 'true';

    if (isDemoMode) {
      const client = DEMO_CLIENTS[clientId];
      if (!client) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Client not found'
        }), { status: 404, headers: corsHeaders });
      }
      return new Response(JSON.stringify({
        success: true,
        data: client
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

    // Get client details with assignment info
    const client = await db.prepare(`
      SELECT
        c.id,
        c.name,
        c.company,
        c.email,
        c.phone,
        c.slug,
        c.portal_enabled,
        c.support_plan_tier,
        c.support_plan_status,
        c.avatar_url,
        c.timezone,
        c.updated_at,
        c.created_at,
        cra.role as assignment_role,
        cra.commission_rate,
        cra.assigned_at,
        cra.notes as assignment_notes,
        COALESCE(cra.can_quote, 1) as can_quote,
        COALESCE(cra.can_menu_build, 1) as can_menu_build,
        COALESCE(cra.can_create_tickets, 1) as can_create_tickets,
        COALESCE(cra.can_view_billing, 0) as can_view_billing,
        (SELECT address_line1 FROM restaurants WHERE client_id = c.id AND is_primary = 1 LIMIT 1) as address_line1,
        (SELECT address_line2 FROM restaurants WHERE client_id = c.id AND is_primary = 1 LIMIT 1) as address_line2,
        (SELECT city FROM restaurants WHERE client_id = c.id AND is_primary = 1 LIMIT 1) as city,
        (SELECT state FROM restaurants WHERE client_id = c.id AND is_primary = 1 LIMIT 1) as state,
        (SELECT zip FROM restaurants WHERE client_id = c.id AND is_primary = 1 LIMIT 1) as zip
      FROM clients c
      INNER JOIN client_rep_assignments cra ON c.id = cra.client_id
      WHERE c.id = ? AND cra.rep_id = ?
    `).bind(clientId, rep.id).first();

    if (!client) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client not found or not assigned to you'
      }), { status: 404, headers: corsHeaders });
    }

    // Convert SQLite integers to booleans
    client.can_quote = Boolean(client.can_quote);
    client.can_menu_build = Boolean(client.can_menu_build);
    client.can_create_tickets = Boolean(client.can_create_tickets);
    client.can_view_billing = Boolean(client.can_view_billing);
    client.portal_enabled = Boolean(client.portal_enabled);

    return new Response(JSON.stringify({
      success: true,
      data: client
    }), { headers: corsHeaders });
  } catch (error) {
    console.error('Rep client detail error:', error);
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
