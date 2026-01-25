// Rep Portfolio Stats API - Returns portfolio metrics for dashboard
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

// Demo stats
const DEMO_STATS = {
  totalClients: 2,
  activeClients: 2,
  activeSupportClients: 1,
  activeProjects: 1,
  openTickets: 3,
  pendingQuotes: 1,
  draftQuotes: 1,
  leadsInPipeline: 2,
  leadsWonThisMonth: 0,
  referralCredits: {
    pending: 500,
    approved: 250,
    paid: 1200,
    total: 1950
  },
  recentActivity: [
    {
      id: 'demo-act-001',
      activity_type: 'quote_sent',
      title: 'Quote Q2601-DEMO sent',
      description: 'Demo Seafood Shack',
      created_at: Date.now() - 7 * 24 * 60 * 60 * 1000
    },
    {
      id: 'demo-act-002',
      activity_type: 'lead_created',
      title: 'Lead created: Beachside Grill',
      description: 'Direct lead entry',
      created_at: Date.now() - 1 * 24 * 60 * 60 * 1000
    }
  ]
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

// GET /api/rep/[slug]/portfolio/stats - Get portfolio statistics
export async function onRequestGet(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const db = context.env.DB;
    const { slug } = context.params;
    const url = new URL(context.request.url);

    // Check for demo mode
    const isDemoMode = slug.startsWith('demo-') || url.searchParams.get('demo') === 'true';

    if (isDemoMode) {
      return new Response(JSON.stringify({
        success: true,
        data: DEMO_STATS
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

    // Execute all stat queries in parallel
    const now = Math.floor(Date.now() / 1000);
    const monthStart = now - (30 * 24 * 60 * 60);

    const [
      clientsResult,
      projectsResult,
      ticketsResult,
      quotesResult,
      leadsResult,
      creditsResult,
      activityResult
    ] = await Promise.all([
      // Client counts
      db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN c.support_plan_status = 'active' THEN 1 ELSE 0 END) as active_support
        FROM client_rep_assignments cra
        JOIN clients c ON cra.client_id = c.id
        WHERE cra.rep_id = ?
      `).bind(rep.id).first(),

      // Active projects count
      db.prepare(`
        SELECT COUNT(*) as count
        FROM projects p
        JOIN clients c ON p.client_id = c.id
        JOIN client_rep_assignments cra ON c.id = cra.client_id
        WHERE cra.rep_id = ? AND p.status NOT IN ('completed', 'cancelled')
      `).bind(rep.id).first(),

      // Open tickets count
      db.prepare(`
        SELECT COUNT(*) as count
        FROM tickets t
        JOIN clients c ON t.client_id = c.id
        JOIN client_rep_assignments cra ON c.id = cra.client_id
        WHERE cra.rep_id = ? AND t.status NOT IN ('resolved', 'closed')
      `).bind(rep.id).first(),

      // Quotes counts
      db.prepare(`
        SELECT
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
          SUM(CASE WHEN status = 'sent' OR status = 'viewed' THEN 1 ELSE 0 END) as pending
        FROM rep_quotes
        WHERE rep_id = ?
      `).bind(rep.id).first(),

      // Leads counts
      db.prepare(`
        SELECT
          SUM(CASE WHEN lead_stage NOT IN ('won', 'lost') THEN 1 ELSE 0 END) as pipeline,
          SUM(CASE WHEN lead_stage = 'won' AND stage_changed_at >= ? THEN 1 ELSE 0 END) as won_this_month
        FROM restaurant_leads
        WHERE source_rep_id = ?
      `).bind(monthStart, rep.id).first(),

      // Referral credits
      db.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending,
          COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as approved,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid
        FROM rep_referral_credits
        WHERE rep_id = ?
      `).bind(rep.id).first(),

      // Recent activity (last 10)
      db.prepare(`
        SELECT id, activity_type, title, description, client_id, created_at
        FROM rep_activity_log
        WHERE rep_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `).bind(rep.id).all()
    ]);

    const stats = {
      totalClients: clientsResult?.total || 0,
      activeClients: clientsResult?.total || 0,
      activeSupportClients: clientsResult?.active_support || 0,
      activeProjects: projectsResult?.count || 0,
      openTickets: ticketsResult?.count || 0,
      pendingQuotes: quotesResult?.pending || 0,
      draftQuotes: quotesResult?.draft || 0,
      leadsInPipeline: leadsResult?.pipeline || 0,
      leadsWonThisMonth: leadsResult?.won_this_month || 0,
      referralCredits: {
        pending: creditsResult?.pending || 0,
        approved: creditsResult?.approved || 0,
        paid: creditsResult?.paid || 0,
        total: (creditsResult?.pending || 0) + (creditsResult?.approved || 0) + (creditsResult?.paid || 0)
      },
      recentActivity: activityResult?.results || []
    };

    return new Response(JSON.stringify({
      success: true,
      data: stats
    }), { headers: corsHeaders });
  } catch (error) {
    console.error('Rep portfolio stats error:', error);
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
