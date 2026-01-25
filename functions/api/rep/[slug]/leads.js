// Rep Leads API - Manage leads sourced by rep
// Supports demo mode for slugs starting with "demo-"
import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../../_shared/auth.js';

const REP_COOKIE_NAME = 'ccrc_rep_token';

const LEAD_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

function generateId() {
  return 'lead_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Demo leads data - field names match frontend Lead interface
const DEMO_LEADS = [
  {
    id: 'demo-lead-001',
    restaurant_name: 'The Lobster Pot',
    dba_name: 'Lobster Pot Restaurant',
    domain: 'lobsterpot.com',
    restaurant_address: '321 Commercial St',
    city: 'Provincetown',
    state: 'MA',
    phone: '508-555-2345',
    email: 'info@lobsterpot.com',
    contact_name: 'Mike Peterson',
    contact_role: 'Owner',
    lead_stage: 'qualified',
    source_rep_id: 'demo-rep-001',
    converted_from_intel_id: 'demo-intel-001',
    stage_changed_at: Math.floor(Date.now() / 1000) - 3 * 24 * 60 * 60,
    days_in_stage: 3,
    estimated_value: 12000,
    current_pos: 'Toast',
    notes: 'Interested in menu optimization and staff training',
    created_at: Math.floor(Date.now() / 1000) - 10 * 24 * 60 * 60,
    updated_at: Math.floor(Date.now() / 1000) - 3 * 24 * 60 * 60,
    rep_name: 'Demo Rep',
    intel_subject: 'Needs menu rebuild'
  },
  {
    id: 'demo-lead-002',
    restaurant_name: 'Beachside Grill',
    dba_name: null,
    domain: 'beachsidegrill.com',
    restaurant_address: '45 Ocean Ave',
    city: 'Chatham',
    state: 'MA',
    phone: '508-555-6789',
    email: 'contact@beachsidegrill.com',
    contact_name: 'Sarah Williams',
    contact_role: 'General Manager',
    lead_stage: 'new',
    source_rep_id: 'demo-rep-001',
    converted_from_intel_id: null,
    stage_changed_at: Math.floor(Date.now() / 1000) - 1 * 24 * 60 * 60,
    days_in_stage: 1,
    estimated_value: 8500,
    current_pos: 'Square',
    notes: 'Looking to switch from Square to Toast',
    created_at: Math.floor(Date.now() / 1000) - 1 * 24 * 60 * 60,
    updated_at: Math.floor(Date.now() / 1000) - 1 * 24 * 60 * 60,
    rep_name: 'Demo Rep',
    intel_subject: null
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

// GET /api/rep/[slug]/leads - List rep's leads
export async function onRequestGet(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const db = context.env.DB;
    const { slug } = context.params;
    const url = new URL(context.request.url);

    // Check for demo mode
    const isDemoMode = slug.startsWith('demo-') || url.searchParams.get('demo') === 'true';

    if (isDemoMode) {
      const stage = url.searchParams.get('stage');
      let filtered = DEMO_LEADS;

      if (stage) {
        filtered = filtered.filter(l => l.lead_stage === stage);
      }

      return new Response(JSON.stringify({
        success: true,
        data: filtered,
        stages: LEAD_STAGES
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
    const stage = url.searchParams.get('stage');
    const excludeClosed = url.searchParams.get('excludeClosed') === 'true';

    let query = `
      SELECT
        rl.id,
        rl.name as restaurant_name,
        rl.dba_name,
        rl.domain,
        rl.address_line1 as restaurant_address,
        rl.city,
        rl.state,
        rl.zip,
        rl.primary_phone as phone,
        rl.primary_email as email,
        rl.website_url,
        rl.cuisine_primary,
        rl.service_style,
        rl.current_pos,
        rl.lead_stage,
        rl.lead_score,
        rl.notes,
        rl.source_rep_id,
        rl.converted_from_intel_id,
        rl.converted_to_client_id,
        rl.stage_changed_at,
        rl.stage_changed_by,
        rl.days_in_stage,
        rl.created_at,
        rl.updated_at,
        COALESCE(ris.estimated_value, 0) as estimated_value,
        lc.first_name || ' ' || COALESCE(lc.last_name, '') as contact_name,
        lc.role as contact_role,
        r.name as rep_name,
        r.email as rep_email,
        ris.subject as intel_subject,
        (unixepoch() - COALESCE(rl.stage_changed_at, rl.created_at)) / 86400 as calculated_days_in_stage
      FROM restaurant_leads rl
      JOIN reps r ON rl.source_rep_id = r.id
      LEFT JOIN rep_intel_submissions ris ON rl.converted_from_intel_id = ris.id
      LEFT JOIN lead_contacts lc ON rl.id = lc.lead_id AND lc.is_primary = 1
      WHERE rl.source_rep_id = ?
    `;
    const params = [rep.id];

    if (stage) {
      query += ' AND rl.lead_stage = ?';
      params.push(stage);
    }

    if (excludeClosed) {
      query += " AND rl.lead_stage NOT IN ('won', 'lost')";
    }

    query += ' ORDER BY rl.created_at DESC';

    const { results } = await db.prepare(query).bind(...params).all();

    // Calculate stage counts
    const { results: stageCounts } = await db.prepare(`
      SELECT lead_stage, COUNT(*) as count
      FROM restaurant_leads
      WHERE source_rep_id = ?
      GROUP BY lead_stage
    `).bind(rep.id).all();

    const stageCountMap = {};
    LEAD_STAGES.forEach(s => stageCountMap[s] = 0);
    stageCounts?.forEach(sc => {
      stageCountMap[sc.lead_stage] = sc.count;
    });

    return new Response(JSON.stringify({
      success: true,
      data: results || [],
      stages: LEAD_STAGES,
      stageCounts: stageCountMap
    }), { headers: corsHeaders });
  } catch (error) {
    console.error('Rep leads GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

// POST /api/rep/[slug]/leads - Convert intel submission to lead
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
          id: 'demo-lead-new',
          lead_stage: 'new',
          ...body,
          created_at: Date.now()
        },
        message: 'Demo mode - lead would be created'
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

    const now = Math.floor(Date.now() / 1000);
    let leadId;
    let intel = null;

    // If converting from intel submission
    if (body.intelId) {
      // Get the intel submission
      intel = await db.prepare(`
        SELECT * FROM rep_intel_submissions WHERE id = ? AND rep_id = ?
      `).bind(body.intelId, rep.id).first();

      if (!intel) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Intel submission not found or not authorized'
        }), { status: 404, headers: corsHeaders });
      }

      if (intel.status !== 'reviewed' && intel.status !== 'pending') {
        return new Response(JSON.stringify({
          success: false,
          error: 'Intel submission already converted or invalid status'
        }), { status: 400, headers: corsHeaders });
      }

      leadId = generateId();

      // Create lead from intel data
      await db.prepare(`
        INSERT INTO restaurant_leads (
          id, name, dba_name, city, state,
          primary_phone, primary_email,
          cuisine_primary, service_style,
          source_rep_id, converted_from_intel_id,
          lead_stage, stage_changed_at, stage_changed_by,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        leadId,
        intel.restaurant_name || body.name || 'Unknown',
        null,
        intel.city || body.city || null,
        intel.state || body.state || null,
        intel.contact_phone || body.phone || null,
        intel.contact_email || body.email || null,
        body.cuisine || null,
        body.serviceStyle || null,
        rep.id,
        body.intelId,
        'new',
        now,
        rep.id,
        now,
        now
      ).run();

      // Update intel submission as converted
      await db.prepare(`
        UPDATE rep_intel_submissions
        SET status = 'converted', converted_to_lead_id = ?, updated_at = ?
        WHERE id = ?
      `).bind(leadId, now, body.intelId).run();

    } else {
      // Create lead directly (not from intel)
      if (!body.name) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Restaurant name is required'
        }), { status: 400, headers: corsHeaders });
      }

      leadId = generateId();

      await db.prepare(`
        INSERT INTO restaurant_leads (
          id, name, dba_name, domain, city, state, zip,
          primary_phone, primary_email, website_url,
          cuisine_primary, service_style,
          source_rep_id, lead_stage, stage_changed_at, stage_changed_by,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        leadId,
        body.name,
        body.dbaName || null,
        body.domain || null,
        body.city || null,
        body.state || null,
        body.zip || null,
        body.phone || null,
        body.email || null,
        body.website || null,
        body.cuisine || null,
        body.serviceStyle || null,
        rep.id,
        'new',
        now,
        rep.id,
        now,
        now
      ).run();
    }

    // Log activity
    await db.prepare(`
      INSERT INTO rep_activity_log (
        id, rep_id, activity_type, lead_id, intel_id, title, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      'ral_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      rep.id,
      'lead_created',
      leadId,
      body.intelId || null,
      `Lead created: ${body.name || intel?.restaurant_name || 'New Lead'}`,
      body.intelId ? 'Converted from intel submission' : 'Direct lead entry',
      now
    ).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: leadId,
        lead_stage: 'new',
        converted_from_intel_id: body.intelId || null
      }
    }), { status: 201, headers: corsHeaders });
  } catch (error) {
    console.error('Rep leads POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

// PATCH /api/rep/[slug]/leads - Update lead stage
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
        message: 'Demo mode - lead would be updated'
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

    if (!body.leadId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Lead ID is required'
      }), { status: 400, headers: corsHeaders });
    }

    // Get rep
    const rep = await db.prepare('SELECT id, name FROM reps WHERE slug = ?').bind(slug).first();
    if (!rep) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rep not found'
      }), { status: 404, headers: corsHeaders });
    }

    // Verify rep owns this lead
    const lead = await db.prepare('SELECT * FROM restaurant_leads WHERE id = ? AND source_rep_id = ?')
      .bind(body.leadId, rep.id).first();

    if (!lead) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Lead not found or not authorized'
      }), { status: 404, headers: corsHeaders });
    }

    const now = Math.floor(Date.now() / 1000);
    const updates = [];
    const params = [];

    // Update stage
    if (body.stage !== undefined) {
      if (!LEAD_STAGES.includes(body.stage)) {
        return new Response(JSON.stringify({
          success: false,
          error: `Invalid stage. Must be one of: ${LEAD_STAGES.join(', ')}`
        }), { status: 400, headers: corsHeaders });
      }

      updates.push('lead_stage = ?');
      params.push(body.stage);
      updates.push('stage_changed_at = ?');
      params.push(now);
      updates.push('stage_changed_by = ?');
      params.push(rep.id);
      updates.push('days_in_stage = 0');

      // Log stage change
      if (body.stage !== lead.lead_stage) {
        await db.prepare(`
          INSERT INTO rep_activity_log (
            id, rep_id, activity_type, lead_id, title, description, metadata_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          'ral_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
          rep.id,
          'lead_stage_changed',
          body.leadId,
          `Lead stage: ${lead.lead_stage} → ${body.stage}`,
          lead.name,
          JSON.stringify({ from: lead.lead_stage, to: body.stage }),
          now
        ).run();
      }
    }

    // Update other fields if provided
    if (body.notes !== undefined) {
      updates.push('notes = ?');
      params.push(body.notes);
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(body.leadId);

    if (updates.length > 1) {
      await db.prepare(`
        UPDATE restaurant_leads SET ${updates.join(', ')} WHERE id = ?
      `).bind(...params).run();
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: body.leadId,
        lead_stage: body.stage || lead.lead_stage,
        updated_at: now * 1000
      }
    }), { headers: corsHeaders });
  } catch (error) {
    console.error('Rep leads PATCH error:', error);
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
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
