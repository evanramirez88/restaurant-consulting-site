/**
 * Rep Intel Submission API
 *
 * GET /api/rep/[slug]/intel - List rep's submissions
 * POST /api/rep/[slug]/intel - Submit new lead/intel
 *
 * Allows reps to submit:
 * - New leads (potential clients)
 * - Market intelligence
 * - Competitor information
 * - Upsell opportunities for existing clients
 * - General feedback
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../../_shared/auth.js';

const REP_COOKIE_NAME = 'ccrc_rep_token';

// Demo intel submissions
const DEMO_INTEL = [
  {
    id: 'demo-intel-001',
    submission_type: 'lead',
    subject: 'New Italian restaurant opening in Hyannis',
    body: 'Met the owner at a networking event. They are looking for a POS system and mentioned frustration with Square.',
    restaurant_name: 'Bella Vista Trattoria',
    contact_name: 'Marco Benedetti',
    contact_email: 'marco@bellavista.com',
    contact_phone: '508-555-9876',
    location: 'Hyannis, MA',
    current_pos: 'None (opening soon)',
    estimated_value: 15000,
    urgency: 'high',
    status: 'pending',
    created_at: Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60
  },
  {
    id: 'demo-intel-002',
    submission_type: 'opportunity',
    subject: 'Demo Seafood Shack - Go-Live Support',
    body: 'Client mentioned they are nervous about the launch. Strong candidate for go-live support package.',
    client_id: 'demo-client-001',
    opportunity_type: 'go_live_support',
    estimated_value: 3000,
    urgency: 'normal',
    status: 'reviewed',
    admin_notes: 'Good catch! Created internal ticket for follow-up.',
    reviewed_at: Math.floor(Date.now() / 1000) - 1 * 24 * 60 * 60,
    created_at: Math.floor(Date.now() / 1000) - 3 * 24 * 60 * 60
  },
  {
    id: 'demo-intel-003',
    submission_type: 'competitor_info',
    subject: 'Toast rep offering steep discounts',
    body: 'Heard from a prospect that Toast is offering 50% off first year to win back accounts. Might affect our pricing strategy.',
    urgency: 'normal',
    status: 'archived',
    admin_notes: 'Good intel. Shared with leadership.',
    reviewed_at: Math.floor(Date.now() / 1000) - 5 * 24 * 60 * 60,
    created_at: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60
  }
];

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
 * GET - List rep's intel submissions
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
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    let filtered = [...DEMO_INTEL];

    if (status) {
      filtered = filtered.filter(i => i.status === status);
    }
    if (type) {
      filtered = filtered.filter(i => i.submission_type === type);
    }

    return new Response(JSON.stringify({
      success: true,
      data: filtered,
      counts: {
        total: DEMO_INTEL.length,
        pending: DEMO_INTEL.filter(i => i.status === 'pending').length,
        converted: DEMO_INTEL.filter(i => i.status === 'converted').length
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
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build query
    let query = `
      SELECT
        ris.*,
        c.company as client_name
      FROM rep_intel_submissions ris
      LEFT JOIN clients c ON ris.client_id = c.id
      WHERE ris.rep_id = ?
    `;
    const bindings = [rep.id];

    if (status) {
      query += ' AND ris.status = ?';
      bindings.push(status);
    }

    if (type) {
      query += ' AND ris.submission_type = ?';
      bindings.push(type);
    }

    query += `
      ORDER BY
        CASE ris.status WHEN 'pending' THEN 0 ELSE 1 END,
        CASE ris.urgency
          WHEN 'hot' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        ris.created_at DESC
      LIMIT ? OFFSET ?
    `;
    bindings.push(limit, offset);

    const { results } = await db.prepare(query).bind(...bindings).all();

    // Get counts
    const countsResult = await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted
      FROM rep_intel_submissions
      WHERE rep_id = ?
    `).bind(rep.id).first();

    return new Response(JSON.stringify({
      success: true,
      data: results || [],
      counts: {
        total: countsResult?.total || 0,
        pending: countsResult?.pending || 0,
        converted: countsResult?.converted || 0
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Rep intel error:', error);
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
 * POST - Submit new lead/intel
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
        id: `demo-intel-${Date.now()}`,
        ...body,
        status: 'pending',
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      },
      message: 'Demo submission created (not persisted)'
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
    if (!body.submission_type) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Submission type is required'
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

    // Validate submission type
    const validTypes = ['lead', 'market_intel', 'competitor_info', 'opportunity', 'feedback'];
    if (!validTypes.includes(body.submission_type)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid submission type. Valid types: ${validTypes.join(', ')}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // For opportunity type, client_id is required
    if (body.submission_type === 'opportunity' && !body.client_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client ID is required for opportunity submissions'
      }), {
        status: 400,
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

    const now = Math.floor(Date.now() / 1000);
    const intelId = `intel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await db.prepare(`
      INSERT INTO rep_intel_submissions (
        id, rep_id, submission_type, subject, body,
        restaurant_name, contact_name, contact_email, contact_phone,
        location, city, state,
        current_pos, current_pos_issues, estimated_stations, estimated_value,
        urgency, best_time_to_contact, decision_timeline,
        attachments_json,
        client_id, opportunity_type,
        status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?,
        ?, ?,
        'pending', ?, ?
      )
    `).bind(
      intelId,
      rep.id,
      body.submission_type,
      body.subject.trim(),
      body.body?.trim() || null,
      body.restaurant_name || null,
      body.contact_name || null,
      body.contact_email || null,
      body.contact_phone || null,
      body.location || null,
      body.city || null,
      body.state || null,
      body.current_pos || null,
      body.current_pos_issues || null,
      body.estimated_stations || null,
      body.estimated_value || null,
      body.urgency || 'normal',
      body.best_time_to_contact || null,
      body.decision_timeline || null,
      body.attachments_json ? JSON.stringify(body.attachments_json) : null,
      body.client_id || null,
      body.opportunity_type || null,
      now,
      now
    ).run();

    const submission = await db.prepare(`
      SELECT ris.*, c.company as client_name
      FROM rep_intel_submissions ris
      LEFT JOIN clients c ON ris.client_id = c.id
      WHERE ris.id = ?
    `).bind(intelId).first();

    // Get submission type label for message
    const typeLabels = {
      lead: 'Lead',
      market_intel: 'Market intelligence',
      competitor_info: 'Competitor information',
      opportunity: 'Opportunity',
      feedback: 'Feedback'
    };

    return new Response(JSON.stringify({
      success: true,
      data: submission,
      message: `${typeLabels[body.submission_type]} submitted successfully. Admin will review shortly.`
    }), {
      status: 201,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Intel submission error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to submit intel'
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
