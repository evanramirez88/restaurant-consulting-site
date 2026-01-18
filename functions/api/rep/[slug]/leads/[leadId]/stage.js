/**
 * Rep Lead Stage Update API
 *
 * PATCH /api/rep/[slug]/leads/[leadId]/stage
 * Updates the stage of a lead in the rep's pipeline
 */
import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../../../../_shared/auth.js';

const REP_COOKIE_NAME = 'ccrc_rep_token';
const LEAD_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
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

// PATCH /api/rep/[slug]/leads/[leadId]/stage - Update lead stage
export async function onRequestPatch(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const db = context.env.DB;
    const { slug, leadId } = context.params;
    const body = await context.request.json();

    // Check for demo mode
    const isDemoMode = slug.startsWith('demo-');
    if (isDemoMode) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          id: leadId,
          lead_stage: body.stage,
          updated_at: Date.now()
        },
        message: 'Demo mode - lead stage would be updated'
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

    // Validate stage
    if (!body.stage) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Stage is required'
      }), { status: 400, headers: corsHeaders });
    }

    if (!LEAD_STAGES.includes(body.stage)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid stage. Must be one of: ${LEAD_STAGES.join(', ')}`
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
    const lead = await db.prepare(
      'SELECT * FROM restaurant_leads WHERE id = ? AND source_rep_id = ?'
    ).bind(leadId, rep.id).first();

    if (!lead) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Lead not found or not authorized'
      }), { status: 404, headers: corsHeaders });
    }

    const now = Math.floor(Date.now() / 1000);
    const oldStage = lead.lead_stage;

    // Update the lead stage
    await db.prepare(`
      UPDATE restaurant_leads
      SET lead_stage = ?,
          stage_changed_at = ?,
          stage_changed_by = ?,
          days_in_stage = 0,
          updated_at = ?
      WHERE id = ?
    `).bind(body.stage, now, rep.id, now, leadId).run();

    // Log stage change activity if stage actually changed
    if (oldStage !== body.stage) {
      await db.prepare(`
        INSERT INTO rep_activity_log (
          id, rep_id, activity_type, lead_id, title, description, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        'ral_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
        rep.id,
        'lead_stage_changed',
        leadId,
        `Lead stage: ${oldStage} → ${body.stage}`,
        lead.name,
        JSON.stringify({ from: oldStage, to: body.stage }),
        now
      ).run();
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: leadId,
        lead_stage: body.stage,
        updated_at: now * 1000
      }
    }), { headers: corsHeaders });
  } catch (error) {
    console.error('Rep lead stage PATCH error:', error);
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
      'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
