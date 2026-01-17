// Rep Client Creation API - Create a new client from a lead
// Auto-assigns the creating rep with full permissions
import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../../../_shared/auth.js';

const REP_COOKIE_NAME = 'ccrc_rep_token';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function generateId() {
  return 'cli_' + crypto.randomUUID().replace(/-/g, '').substring(0, 20);
}

function generateSlug(company) {
  return company
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}

// POST /api/rep/[slug]/clients/create - Create a new client
export async function onRequestPost(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const db = context.env.DB;
    const { slug } = context.params;
    const url = new URL(context.request.url);

    // Check for demo mode
    const isDemoMode = slug.startsWith('demo-') || url.searchParams.get('demo') === 'true';

    if (isDemoMode) {
      // Return a mock created client for demo mode
      const body = await context.request.json();
      const demoClientId = 'demo-client-' + Date.now();
      return new Response(JSON.stringify({
        success: true,
        data: {
          id: demoClientId,
          name: body.name || 'Demo Contact',
          company: body.company || 'Demo Restaurant',
          email: body.email || 'demo@example.com',
          phone: body.phone,
          slug: generateSlug(body.company || 'demo-restaurant'),
          created_at: Math.floor(Date.now() / 1000)
        },
        message: 'Client created successfully (demo mode)'
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

    // Get rep info
    const rep = await db.prepare('SELECT id, name FROM reps WHERE slug = ?').bind(slug).first();
    if (!rep) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rep not found'
      }), { status: 404, headers: corsHeaders });
    }

    const body = await context.request.json();
    const { leadId, name, company, email, phone, city, state, address } = body;

    // Validate required fields
    if (!company) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Company name is required'
      }), { status: 400, headers: corsHeaders });
    }

    if (!email && !phone) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email or phone is required'
      }), { status: 400, headers: corsHeaders });
    }

    // Check for existing client with same email
    if (email) {
      const existingClient = await db.prepare(
        'SELECT id, company FROM clients WHERE email = ?'
      ).bind(email).first();

      if (existingClient) {
        return new Response(JSON.stringify({
          success: false,
          error: `A client with this email already exists: ${existingClient.company}`
        }), { status: 409, headers: corsHeaders });
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const clientId = generateId();
    const clientSlug = generateSlug(company);

    // Check for slug collision and make unique if needed
    let finalSlug = clientSlug;
    let slugCounter = 1;
    while (true) {
      const existingSlug = await db.prepare(
        'SELECT id FROM clients WHERE slug = ?'
      ).bind(finalSlug).first();
      if (!existingSlug) break;
      finalSlug = `${clientSlug}-${slugCounter}`;
      slugCounter++;
    }

    // Start a batch of operations
    const statements = [];

    // Create the client
    statements.push(
      db.prepare(`
        INSERT INTO clients (
          id, name, company, email, phone, slug,
          portal_enabled, support_plan_status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 'prospect', ?, ?)
      `).bind(
        clientId,
        name || 'Owner',
        company,
        email || null,
        phone || null,
        finalSlug,
        now,
        now
      )
    );

    // Create rep assignment with full permissions
    const assignmentId = 'cra_' + crypto.randomUUID().replace(/-/g, '').substring(0, 20);
    statements.push(
      db.prepare(`
        INSERT INTO client_rep_assignments (
          id, client_id, rep_id, role, commission_rate,
          can_quote, can_menu_build, can_create_tickets, can_view_billing,
          assigned_at, updated_at
        ) VALUES (?, ?, ?, 'primary', 0.10, 1, 1, 1, 0, ?, ?)
      `).bind(assignmentId, clientId, rep.id, now, now)
    );

    // If there's a lead ID, update the lead to mark it as converted
    if (leadId) {
      statements.push(
        db.prepare(`
          UPDATE restaurant_leads
          SET lead_stage = 'won',
              converted_to_client_id = ?,
              stage_changed_at = ?,
              updated_at = ?
          WHERE id = ? AND source_rep_id = ?
        `).bind(clientId, now, now, leadId, rep.id)
      );
    }

    // Create activity log entry
    const activityId = 'act_' + crypto.randomUUID().replace(/-/g, '').substring(0, 20);
    statements.push(
      db.prepare(`
        INSERT INTO rep_activity_log (
          id, rep_id, activity_type, title, description, client_id, created_at
        ) VALUES (?, ?, 'client_created', ?, ?, ?, ?)
      `).bind(
        activityId,
        rep.id,
        `Client created: ${company}`,
        leadId ? 'Converted from lead' : 'New client created',
        clientId,
        now
      )
    );

    // If city/state provided, create a restaurant record
    if (city || state || address) {
      const restaurantId = 'rst_' + crypto.randomUUID().replace(/-/g, '').substring(0, 20);
      statements.push(
        db.prepare(`
          INSERT INTO restaurants (
            id, client_id, name, address, city, state, is_primary, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        `).bind(
          restaurantId,
          clientId,
          company,
          address || null,
          city || null,
          state || null,
          now,
          now
        )
      );
    }

    // Execute all statements in batch
    await db.batch(statements);

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: clientId,
        name: name || 'Owner',
        company,
        email,
        phone,
        slug: finalSlug,
        created_at: now
      },
      message: 'Client created successfully'
    }), { headers: corsHeaders });
  } catch (error) {
    console.error('Rep client creation error:', error);
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
