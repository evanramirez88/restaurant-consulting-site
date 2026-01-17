// Rep Client Menu API - Get and save menu data for a client
// Supports demo mode for slugs starting with "demo-"
import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../../../../_shared/auth.js';

const REP_COOKIE_NAME = 'ccrc_rep_token';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

// Demo menu data
const DEMO_MENU = {
  id: 'demo-menu-001',
  client_id: 'demo-client-001',
  status: 'completed',
  parsed_menu_json: JSON.stringify({
    items: [
      { id: '1', name: 'Lobster Roll', description: 'Fresh Maine lobster with butter', price: '24.99', category: 'Entrees', modifiers: ['Side Choices'] },
      { id: '2', name: 'Clam Chowder', description: 'New England style creamy chowder', price: '8.99', category: 'Starters', modifiers: ['Size'] },
      { id: '3', name: 'Fish & Chips', description: 'Beer-battered cod with fries', price: '18.99', category: 'Entrees', modifiers: ['Side Choices'] },
      { id: '4', name: 'Caesar Salad', description: 'Romaine, parmesan, croutons', price: '12.99', category: 'Starters', modifiers: ['Add Protein'] },
      { id: '5', name: 'Key Lime Pie', description: 'House-made with graham crust', price: '7.99', category: 'Desserts', modifiers: [] }
    ],
    categories: ['Starters', 'Entrees', 'Desserts'],
    modifierGroups: ['Side Choices', 'Size', 'Add Protein']
  }),
  created_at: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60,
  updated_at: Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60,
  rep_id: 'demo-rep-001',
  rep_name: 'Demo Rep'
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

// GET /api/rep/[slug]/clients/[clientId]/menu - Get client's menu
export async function onRequestGet(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const db = context.env.DB;
    const { slug, clientId } = context.params;
    const url = new URL(context.request.url);

    // Check for demo mode
    const isDemoMode = slug.startsWith('demo-') || url.searchParams.get('demo') === 'true';

    if (isDemoMode) {
      return new Response(JSON.stringify({
        success: true,
        data: DEMO_MENU
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

    // Verify rep has access to this client
    const assignment = await db.prepare(`
      SELECT cra.*, c.name as client_name, c.company as client_company
      FROM client_rep_assignments cra
      JOIN clients c ON cra.client_id = c.id
      WHERE cra.rep_id = ? AND cra.client_id = ?
    `).bind(rep.id, clientId).first();

    if (!assignment) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client not found or not assigned to you'
      }), { status: 404, headers: corsHeaders });
    }

    // Check menu build permission
    if (!assignment.can_menu_build) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You do not have permission to access Menu Builder for this client'
      }), { status: 403, headers: corsHeaders });
    }

    // Get the most recent menu job for this client
    const menuJob = await db.prepare(`
      SELECT mj.*, r.name as rep_name
      FROM menu_jobs mj
      LEFT JOIN reps r ON mj.rep_id = r.id
      WHERE mj.client_id = ?
      ORDER BY mj.updated_at DESC
      LIMIT 1
    `).bind(clientId).first();

    if (!menuJob) {
      return new Response(JSON.stringify({
        success: true,
        data: null,
        message: 'No menu found for this client'
      }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      success: true,
      data: menuJob
    }), { headers: corsHeaders });
  } catch (error) {
    console.error('Get client menu error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

// POST /api/rep/[slug]/clients/[clientId]/menu - Save menu for client
export async function onRequestPost(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const db = context.env.DB;
    const { slug, clientId } = context.params;

    // Check for demo mode
    const isDemoMode = slug.startsWith('demo-');

    if (isDemoMode) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          ...DEMO_MENU,
          updated_at: Math.floor(Date.now() / 1000)
        },
        message: 'Menu saved (demo mode)'
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

    // Verify rep has access to this client
    const assignment = await db.prepare(`
      SELECT cra.*, c.name as client_name, c.company as client_company
      FROM client_rep_assignments cra
      JOIN clients c ON cra.client_id = c.id
      WHERE cra.rep_id = ? AND cra.client_id = ?
    `).bind(rep.id, clientId).first();

    if (!assignment) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client not found or not assigned to you'
      }), { status: 404, headers: corsHeaders });
    }

    // Check menu build permission
    if (!assignment.can_menu_build) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You do not have permission to use Menu Builder for this client'
      }), { status: 403, headers: corsHeaders });
    }

    // Parse request body
    const body = await context.request.json();
    const { parsed_menu_json } = body;

    if (!parsed_menu_json) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing parsed_menu_json'
      }), { status: 400, headers: corsHeaders });
    }

    // Check if there's an existing menu job for this client
    const existingJob = await db.prepare(`
      SELECT id FROM menu_jobs WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1
    `).bind(clientId).first();

    const now = Math.floor(Date.now() / 1000);

    if (existingJob) {
      // Update existing menu job
      await db.prepare(`
        UPDATE menu_jobs
        SET parsed_menu_json = ?, status = 'completed', updated_at = ?, rep_id = ?
        WHERE id = ?
      `).bind(parsed_menu_json, now, rep.id, existingJob.id).run();

      // Log activity
      await db.prepare(`
        INSERT INTO rep_activity_log (id, rep_id, activity_type, client_id, title, description, created_at)
        VALUES (?, ?, 'menu_updated', ?, ?, ?, ?)
      `).bind(
        `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        rep.id,
        clientId,
        `Menu updated for ${assignment.client_company}`,
        `Updated menu with parsed data`,
        now
      ).run();

      return new Response(JSON.stringify({
        success: true,
        data: {
          id: existingJob.id,
          client_id: clientId,
          parsed_menu_json,
          status: 'completed',
          updated_at: now,
          rep_id: rep.id,
          rep_name: rep.name
        },
        message: 'Menu updated successfully'
      }), { headers: corsHeaders });
    } else {
      // Create new menu job
      const jobId = `menu-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      await db.prepare(`
        INSERT INTO menu_jobs (id, client_id, parsed_menu_json, status, restaurant_name, created_at, updated_at, rep_id)
        VALUES (?, ?, ?, 'completed', ?, ?, ?, ?)
      `).bind(jobId, clientId, parsed_menu_json, assignment.client_company, now, now, rep.id).run();

      // Log activity
      await db.prepare(`
        INSERT INTO rep_activity_log (id, rep_id, activity_type, client_id, title, description, created_at)
        VALUES (?, ?, 'menu_created', ?, ?, ?, ?)
      `).bind(
        `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        rep.id,
        clientId,
        `Menu created for ${assignment.client_company}`,
        `Created new menu with parsed data`,
        now
      ).run();

      return new Response(JSON.stringify({
        success: true,
        data: {
          id: jobId,
          client_id: clientId,
          parsed_menu_json,
          status: 'completed',
          created_at: now,
          updated_at: now,
          rep_id: rep.id,
          rep_name: rep.name
        },
        message: 'Menu created successfully'
      }), { headers: corsHeaders });
    }
  } catch (error) {
    console.error('Save client menu error:', error);
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
