// Rep Clients API - Get assigned clients for a rep
import jwt from '@tsndr/cloudflare-worker-jwt';

const REP_COOKIE_NAME = 'ccrc_rep_token';

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
  try {
    const db = context.env.DB;
    const { slug } = context.params;

    // Verify authentication
    const auth = await verifyRepAuth(context.request, context.env, slug);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
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
        headers: { 'Content-Type': 'application/json' }
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
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Rep clients error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
