// Rep Verify Magic Link API - Verify magic link token and create session
import jwt from '@tsndr/cloudflare-worker-jwt';

const REP_COOKIE_NAME = 'ccrc_rep_token';

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    const { slug } = context.params;
    const body = await context.request.json();
    const { token } = body;

    if (!token) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Token is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const jwtSecret = context.env.REP_JWT_SECRET || context.env.JWT_SECRET || context.env.ADMIN_PASSWORD_HASH;
    if (!jwtSecret) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Server configuration error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify the magic link token
    let isValid;
    try {
      isValid = await jwt.verify(token, jwtSecret);
    } catch (e) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or expired token'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!isValid) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or expired token'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { payload } = jwt.decode(token);

    // Verify token type and slug match
    if (payload.type !== 'magic-link' || payload.slug !== slug) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid token'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify rep exists and portal is enabled
    const rep = await db.prepare(`
      SELECT id, email, name, slug
      FROM reps
      WHERE id = ? AND slug = ? AND portal_enabled = 1
    `).bind(payload.repId, slug).first();

    if (!rep) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rep not found or portal not enabled'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create session token
    const sessionToken = await jwt.sign({
      repId: rep.id,
      email: rep.email,
      slug: rep.slug,
      type: 'rep',
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    }, jwtSecret);

    // Create session in database
    const sessionId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + (7 * 24 * 60 * 60);

    // Hash the token for storage
    const encoder = new TextEncoder();
    const data = encoder.encode(sessionToken);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    await db.prepare(`
      INSERT INTO portal_sessions (id, portal_type, user_id, token_hash, ip_address, user_agent, last_activity, expires_at, created_at)
      VALUES (?, 'rep', ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sessionId,
      rep.id,
      tokenHash,
      context.request.headers.get('CF-Connecting-IP') || 'unknown',
      context.request.headers.get('User-Agent') || 'unknown',
      now,
      expiresAt,
      now
    ).run();

    // Set cookie
    const cookie = `${REP_COOKIE_NAME}=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`;

    return new Response(JSON.stringify({
      success: true,
      message: 'Login successful'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie
      }
    });
  } catch (error) {
    console.error('Verify magic link error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
