// Rep Referrals API - Get and create referrals for a rep
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

    // Get referrals - check if table exists first
    try {
      const { results } = await db.prepare(`
        SELECT *
        FROM rep_referrals
        WHERE rep_id = ?
        ORDER BY created_at DESC
      `).bind(rep.id).all();

      return new Response(JSON.stringify({
        success: true,
        data: results || []
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (tableError) {
      // Table might not exist yet, return empty array
      console.log('rep_referrals table may not exist:', tableError.message);
      return new Response(JSON.stringify({
        success: true,
        data: []
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Rep referrals error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
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

    const body = await context.request.json();
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Ensure referrals table exists
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS rep_referrals (
        id TEXT PRIMARY KEY,
        rep_id TEXT NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
        referral_name TEXT NOT NULL,
        referral_company TEXT NOT NULL,
        referral_email TEXT NOT NULL,
        referral_phone TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'converted', 'paid', 'rejected')),
        commission_amount REAL DEFAULT 0,
        client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
        approved_at INTEGER,
        converted_at INTEGER,
        paid_at INTEGER,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `).run();

    // Create referral
    await db.prepare(`
      INSERT INTO rep_referrals (
        id, rep_id, referral_name, referral_company, referral_email, referral_phone,
        notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).bind(
      id,
      rep.id,
      body.referral_name,
      body.referral_company,
      body.referral_email,
      body.referral_phone || null,
      body.notes || null,
      now,
      now
    ).run();

    const referral = await db.prepare('SELECT * FROM rep_referrals WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: referral
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Create referral error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
