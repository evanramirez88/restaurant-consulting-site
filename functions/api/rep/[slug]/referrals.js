// Rep Referrals API - View referral credits and earnings
// Supports demo mode for slugs starting with "demo-"
import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../../_shared/auth.js';

const REP_COOKIE_NAME = 'ccrc_rep_token';

const CREDIT_TYPES = [
  'referral_bonus',
  'project_commission',
  'support_plan_bonus',
  'upsell_commission',
  'lead_conversion',
  'recurring_bonus'
];

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

// Demo referrals data
const DEMO_REFERRALS = [
  {
    id: 'demo-credit-001',
    rep_id: 'demo-rep-001',
    client_id: 'demo-client-001',
    credit_type: 'referral_bonus',
    amount: 500,
    description: 'New client referral - Demo Seafood Shack',
    status: 'pending',
    approved_by: null,
    approved_at: null,
    paid_at: null,
    created_at: Date.now() - 5 * 24 * 60 * 60 * 1000,
    client_name: 'Demo User',
    client_company: 'Demo Seafood Shack'
  },
  {
    id: 'demo-credit-002',
    rep_id: 'demo-rep-001',
    client_id: 'demo-client-002',
    credit_type: 'support_plan_bonus',
    amount: 250,
    description: 'Professional plan signup bonus',
    status: 'approved',
    approved_by: 'admin',
    approved_at: Date.now() - 10 * 24 * 60 * 60 * 1000,
    paid_at: null,
    created_at: Date.now() - 15 * 24 * 60 * 60 * 1000,
    client_name: 'John Smith',
    client_company: 'Cape Cod Bistro'
  },
  {
    id: 'demo-credit-003',
    rep_id: 'demo-rep-001',
    client_id: null,
    credit_type: 'project_commission',
    amount: 800,
    description: 'Menu build commission - Chatham Grill',
    status: 'paid',
    approved_by: 'admin',
    approved_at: Date.now() - 45 * 24 * 60 * 60 * 1000,
    paid_at: Date.now() - 30 * 24 * 60 * 60 * 1000,
    created_at: Date.now() - 60 * 24 * 60 * 60 * 1000,
    client_name: null,
    client_company: 'Chatham Grill'
  },
  {
    id: 'demo-credit-004',
    rep_id: 'demo-rep-001',
    client_id: null,
    credit_type: 'referral_bonus',
    amount: 400,
    description: 'Q4 2025 referral - Old Harbor Inn',
    status: 'paid',
    approved_by: 'admin',
    approved_at: Date.now() - 90 * 24 * 60 * 60 * 1000,
    paid_at: Date.now() - 75 * 24 * 60 * 60 * 1000,
    created_at: Date.now() - 100 * 24 * 60 * 60 * 1000,
    client_name: null,
    client_company: 'Old Harbor Inn'
  }
];

const DEMO_SUMMARY = {
  pending: 500,
  approved: 250,
  paid: 1200,
  total: 1950,
  pendingCount: 1,
  approvedCount: 1,
  paidCount: 2,
  thisYear: {
    paid: 1200,
    projected: 1950
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

// GET /api/rep/[slug]/referrals - List referral credits
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
      const type = url.searchParams.get('type');
      let filtered = DEMO_REFERRALS;

      if (status) {
        filtered = filtered.filter(r => r.status === status);
      }
      if (type) {
        filtered = filtered.filter(r => r.credit_type === type);
      }

      return new Response(JSON.stringify({
        success: true,
        data: filtered,
        summary: DEMO_SUMMARY,
        creditTypes: CREDIT_TYPES
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
    const rep = await db.prepare('SELECT id, name FROM reps WHERE slug = ?').bind(slug).first();
    if (!rep) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rep not found'
      }), { status: 404, headers: corsHeaders });
    }

    // Build query with filters
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');

    let query = `
      SELECT
        rrc.*,
        c.name as client_name,
        c.company as client_company
      FROM rep_referral_credits rrc
      LEFT JOIN clients c ON rrc.client_id = c.id
      WHERE rrc.rep_id = ?
    `;
    const params = [rep.id];

    if (status) {
      query += ' AND rrc.status = ?';
      params.push(status);
    }
    if (type) {
      query += ' AND rrc.credit_type = ?';
      params.push(type);
    }

    query += ' ORDER BY rrc.created_at DESC';

    const { results } = await db.prepare(query).bind(...params).all();

    // Get summary
    const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime() / 1000;

    const summaryResult = await db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as approved,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
        COALESCE(SUM(CASE WHEN status = 'paid' AND paid_at >= ? THEN amount ELSE 0 END), 0) as paid_this_year
      FROM rep_referral_credits
      WHERE rep_id = ?
    `).bind(yearStart, rep.id).first();

    const summary = {
      pending: summaryResult?.pending || 0,
      approved: summaryResult?.approved || 0,
      paid: summaryResult?.paid || 0,
      total: (summaryResult?.pending || 0) + (summaryResult?.approved || 0) + (summaryResult?.paid || 0),
      pendingCount: summaryResult?.pending_count || 0,
      approvedCount: summaryResult?.approved_count || 0,
      paidCount: summaryResult?.paid_count || 0,
      thisYear: {
        paid: summaryResult?.paid_this_year || 0,
        projected: (summaryResult?.pending || 0) + (summaryResult?.approved || 0) + (summaryResult?.paid_this_year || 0)
      }
    };

    return new Response(JSON.stringify({
      success: true,
      data: results || [],
      summary,
      creditTypes: CREDIT_TYPES
    }), { headers: corsHeaders });
  } catch (error) {
    console.error('Rep referrals GET error:', error);
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
