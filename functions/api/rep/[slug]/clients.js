// Rep Clients API - Get assigned clients for a rep
// Supports demo mode for slugs starting with "demo-"
import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../../_shared/auth.js';

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

// Demo clients data
const DEMO_CLIENTS = [
  {
    id: 'demo-client-001',
    name: 'Demo User',
    company: 'Demo Seafood Shack',
    email: 'demo@example.com',
    phone: '508-555-1234',
    slug: 'demo-seafood-shack',
    portal_enabled: true,
    support_plan_tier: 'professional',
    support_plan_status: 'active',
    avatar_url: null,
    timezone: 'America/New_York',
    updated_at: Date.now() - 1 * 24 * 60 * 60 * 1000,
    assignment_role: 'primary',
    commission_rate: 0.10,
    assigned_at: Date.now() - 30 * 24 * 60 * 60 * 1000,
    city: 'Provincetown',
    state: 'MA'
  },
  {
    id: 'demo-client-002',
    name: 'John Smith',
    company: 'Cape Cod Bistro',
    email: 'john@capebistro.com',
    phone: '508-555-5678',
    slug: 'cape-cod-bistro',
    portal_enabled: true,
    support_plan_tier: 'core',
    support_plan_status: 'active',
    avatar_url: null,
    timezone: 'America/New_York',
    updated_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
    assignment_role: 'secondary',
    commission_rate: 0.05,
    assigned_at: Date.now() - 60 * 24 * 60 * 60 * 1000,
    city: 'Hyannis',
    state: 'MA'
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
        data: DEMO_CLIENTS
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

    // Get assigned clients
    const { results } = await db.prepare(`
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
        cra.role as assignment_role,
        cra.commission_rate,
        cra.assigned_at,
        cra.notes as assignment_notes,
        (SELECT city FROM restaurants WHERE client_id = c.id AND is_primary = 1 LIMIT 1) as city,
        (SELECT state FROM restaurants WHERE client_id = c.id AND is_primary = 1 LIMIT 1) as state
      FROM clients c
      INNER JOIN client_rep_assignments cra ON c.id = cra.client_id
      WHERE cra.rep_id = ?
      ORDER BY c.company ASC
    `).bind(rep.id).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Rep clients error:', error);
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
