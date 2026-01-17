// Rep Portfolio Activity API - Returns recent activity feed for dashboard
// Aggregates activity from quotes, tickets, leads, and messages
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

// Demo activity data
const DEMO_ACTIVITY = [
  {
    id: 'demo-act-001',
    activity_type: 'quote_sent',
    title: 'Quote sent to Demo Seafood Shack',
    description: 'Quote Q2601-DEMO for Toast POS implementation',
    client_name: 'Demo Seafood Shack',
    timestamp: Math.floor(Date.now() / 1000) - (2 * 60 * 60), // 2 hours ago
    icon: 'file-text',
    color: 'blue'
  },
  {
    id: 'demo-act-002',
    activity_type: 'ticket_opened',
    title: 'New support ticket opened',
    description: 'KDS not displaying orders correctly',
    client_name: 'Cape Cod Clam Bar',
    timestamp: Math.floor(Date.now() / 1000) - (8 * 60 * 60), // 8 hours ago
    icon: 'ticket',
    color: 'amber'
  },
  {
    id: 'demo-act-003',
    activity_type: 'lead_stage_changed',
    title: 'Lead advanced to Proposal',
    description: 'Beachside Grill moved from Qualified to Proposal',
    client_name: null,
    lead_name: 'Beachside Grill',
    timestamp: Math.floor(Date.now() / 1000) - (24 * 60 * 60), // 1 day ago
    icon: 'target',
    color: 'purple'
  },
  {
    id: 'demo-act-004',
    activity_type: 'ticket_resolved',
    title: 'Ticket resolved',
    description: 'Menu pricing update completed',
    client_name: 'Demo Seafood Shack',
    timestamp: Math.floor(Date.now() / 1000) - (2 * 24 * 60 * 60), // 2 days ago
    icon: 'check-circle',
    color: 'green'
  },
  {
    id: 'demo-act-005',
    activity_type: 'quote_accepted',
    title: 'Quote accepted!',
    description: 'Demo Seafood Shack accepted Quote Q2598-DEMO ($4,500)',
    client_name: 'Demo Seafood Shack',
    timestamp: Math.floor(Date.now() / 1000) - (3 * 24 * 60 * 60), // 3 days ago
    icon: 'dollar-sign',
    color: 'green'
  },
  {
    id: 'demo-act-006',
    activity_type: 'client_assigned',
    title: 'New client assigned',
    description: 'You have been assigned to Cape Cod Clam Bar',
    client_name: 'Cape Cod Clam Bar',
    timestamp: Math.floor(Date.now() / 1000) - (5 * 24 * 60 * 60), // 5 days ago
    icon: 'user-plus',
    color: 'green'
  },
  {
    id: 'demo-act-007',
    activity_type: 'intel_converted',
    title: 'Intel converted to lead',
    description: 'Beachside Grill opportunity converted to active lead',
    client_name: null,
    lead_name: 'Beachside Grill',
    timestamp: Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60), // 7 days ago
    icon: 'zap',
    color: 'cyan'
  },
  {
    id: 'demo-act-008',
    activity_type: 'message_received',
    title: 'New message from admin',
    description: 'Great job on the Demo Seafood Shack deal!',
    client_name: null,
    timestamp: Math.floor(Date.now() / 1000) - (10 * 24 * 60 * 60), // 10 days ago
    icon: 'message-square',
    color: 'blue'
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

// Helper to get icon and color for activity types
function getActivityMeta(type) {
  const meta = {
    'quote_created': { icon: 'file-text', color: 'gray' },
    'quote_sent': { icon: 'send', color: 'blue' },
    'quote_viewed': { icon: 'eye', color: 'amber' },
    'quote_accepted': { icon: 'check-circle', color: 'green' },
    'quote_declined': { icon: 'x-circle', color: 'red' },
    'ticket_opened': { icon: 'ticket', color: 'amber' },
    'ticket_updated': { icon: 'edit', color: 'blue' },
    'ticket_resolved': { icon: 'check-circle', color: 'green' },
    'ticket_closed': { icon: 'check', color: 'gray' },
    'lead_created': { icon: 'target', color: 'blue' },
    'lead_stage_changed': { icon: 'arrow-right', color: 'purple' },
    'lead_won': { icon: 'trophy', color: 'green' },
    'lead_lost': { icon: 'x-circle', color: 'red' },
    'intel_submitted': { icon: 'lightbulb', color: 'amber' },
    'intel_approved': { icon: 'check-circle', color: 'green' },
    'intel_converted': { icon: 'zap', color: 'cyan' },
    'client_assigned': { icon: 'user-plus', color: 'green' },
    'message_received': { icon: 'message-square', color: 'blue' },
    'referral_approved': { icon: 'dollar-sign', color: 'green' },
    'referral_paid': { icon: 'banknote', color: 'green' }
  };
  return meta[type] || { icon: 'activity', color: 'gray' };
}

// GET /api/rep/[slug]/portfolio/activity - Get recent activity feed
export async function onRequestGet(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const db = context.env.DB;
    const { slug } = context.params;
    const url = new URL(context.request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Check for demo mode
    const isDemoMode = slug.startsWith('demo-') || url.searchParams.get('demo') === 'true';

    if (isDemoMode) {
      const paginatedActivity = DEMO_ACTIVITY.slice(offset, offset + limit);
      return new Response(JSON.stringify({
        success: true,
        data: paginatedActivity,
        pagination: {
          total: DEMO_ACTIVITY.length,
          limit,
          offset,
          hasMore: offset + limit < DEMO_ACTIVITY.length
        }
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

    // First try the rep_activity_log table if it exists
    let activity = [];
    let total = 0;

    try {
      // Check if rep_activity_log table exists and has data
      const logResult = await db.prepare(`
        SELECT
          ral.id,
          ral.activity_type,
          ral.title,
          ral.description,
          ral.client_id,
          c.company as client_name,
          ral.created_at as timestamp
        FROM rep_activity_log ral
        LEFT JOIN clients c ON ral.client_id = c.id
        WHERE ral.rep_id = ?
        ORDER BY ral.created_at DESC
        LIMIT ? OFFSET ?
      `).bind(rep.id, limit, offset).all();

      const countResult = await db.prepare(`
        SELECT COUNT(*) as total FROM rep_activity_log WHERE rep_id = ?
      `).bind(rep.id).first();

      if (logResult?.results?.length > 0) {
        activity = logResult.results.map(a => ({
          ...a,
          ...getActivityMeta(a.activity_type)
        }));
        total = countResult?.total || 0;
      }
    } catch (e) {
      // Table doesn't exist or query failed, fall back to aggregation
      console.log('rep_activity_log not available, aggregating from sources');
    }

    // If no activity from log table, aggregate from source tables
    if (activity.length === 0) {
      const now = Math.floor(Date.now() / 1000);
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

      // Aggregate activities from multiple sources
      const [quotesActivity, ticketsActivity, leadsActivity] = await Promise.all([
        // Quote activity
        db.prepare(`
          SELECT
            rq.id,
            CASE
              WHEN rq.status = 'draft' THEN 'quote_created'
              WHEN rq.status = 'sent' THEN 'quote_sent'
              WHEN rq.status = 'viewed' THEN 'quote_viewed'
              WHEN rq.status = 'accepted' THEN 'quote_accepted'
              WHEN rq.status = 'declined' THEN 'quote_declined'
              ELSE 'quote_created'
            END as activity_type,
            CASE
              WHEN rq.status = 'draft' THEN 'Quote draft created'
              WHEN rq.status = 'sent' THEN 'Quote sent'
              WHEN rq.status = 'viewed' THEN 'Quote viewed by client'
              WHEN rq.status = 'accepted' THEN 'Quote accepted!'
              WHEN rq.status = 'declined' THEN 'Quote declined'
              ELSE 'Quote updated'
            END as title,
            c.company as client_name,
            rq.updated_at as timestamp
          FROM rep_quotes rq
          LEFT JOIN clients c ON rq.client_id = c.id
          WHERE rq.rep_id = ? AND rq.updated_at >= ?
          ORDER BY rq.updated_at DESC
          LIMIT 10
        `).bind(rep.id, thirtyDaysAgo).all(),

        // Ticket activity
        db.prepare(`
          SELECT
            t.id,
            CASE
              WHEN t.status = 'open' OR t.status = 'new' THEN 'ticket_opened'
              WHEN t.status = 'in_progress' THEN 'ticket_updated'
              WHEN t.status = 'resolved' THEN 'ticket_resolved'
              WHEN t.status = 'closed' THEN 'ticket_closed'
              ELSE 'ticket_updated'
            END as activity_type,
            CASE
              WHEN t.status = 'open' OR t.status = 'new' THEN 'Ticket opened: ' || t.title
              WHEN t.status = 'in_progress' THEN 'Ticket in progress: ' || t.title
              WHEN t.status = 'resolved' THEN 'Ticket resolved: ' || t.title
              WHEN t.status = 'closed' THEN 'Ticket closed: ' || t.title
              ELSE 'Ticket updated: ' || t.title
            END as title,
            c.company as client_name,
            t.updated_at as timestamp
          FROM tickets t
          JOIN clients c ON t.client_id = c.id
          JOIN client_rep_assignments cra ON c.id = cra.client_id
          WHERE cra.rep_id = ? AND t.updated_at >= ?
          ORDER BY t.updated_at DESC
          LIMIT 10
        `).bind(rep.id, thirtyDaysAgo).all(),

        // Lead activity
        db.prepare(`
          SELECT
            id,
            CASE
              WHEN lead_stage = 'won' THEN 'lead_won'
              WHEN lead_stage = 'lost' THEN 'lead_lost'
              ELSE 'lead_stage_changed'
            END as activity_type,
            CASE
              WHEN lead_stage = 'won' THEN 'Lead won: ' || restaurant_name
              WHEN lead_stage = 'lost' THEN 'Lead lost: ' || restaurant_name
              ELSE 'Lead updated: ' || restaurant_name || ' (' || lead_stage || ')'
            END as title,
            restaurant_name as lead_name,
            updated_at as timestamp
          FROM restaurant_leads
          WHERE source_rep_id = ? AND updated_at >= ?
          ORDER BY updated_at DESC
          LIMIT 10
        `).bind(rep.id, thirtyDaysAgo).all()
      ]);

      // Combine and sort all activities
      const allActivities = [
        ...(quotesActivity?.results || []),
        ...(ticketsActivity?.results || []),
        ...(leadsActivity?.results || [])
      ]
        .map(a => ({
          ...a,
          ...getActivityMeta(a.activity_type)
        }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, limit);

      activity = allActivities;
      total = allActivities.length;
    }

    return new Response(JSON.stringify({
      success: true,
      data: activity,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    }), { headers: corsHeaders });
  } catch (error) {
    console.error('Rep portfolio activity error:', error);
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
