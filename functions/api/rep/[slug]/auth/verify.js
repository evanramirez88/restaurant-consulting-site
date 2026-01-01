// Rep Auth Verify API - Check if rep is authenticated
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

export async function onRequestGet(context) {
  try {
    const { slug } = context.params;
    const cookieHeader = context.request.headers.get('Cookie');
    const cookies = parseCookies(cookieHeader);
    const token = cookies[REP_COOKIE_NAME];

    if (!token) {
      return new Response(JSON.stringify({
        authenticated: false,
        error: 'No session found'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const jwtSecret = context.env.REP_JWT_SECRET || context.env.JWT_SECRET || context.env.ADMIN_PASSWORD_HASH;
    if (!jwtSecret) {
      return new Response(JSON.stringify({
        authenticated: false,
        error: 'Server configuration error'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const isValid = await jwt.verify(token, jwtSecret);
    if (!isValid) {
      return new Response(JSON.stringify({
        authenticated: false,
        error: 'Invalid or expired session'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { payload } = jwt.decode(token);

    // Verify the token is for this rep's slug
    if (payload.slug !== slug || payload.type !== 'rep') {
      return new Response(JSON.stringify({
        authenticated: false,
        error: 'Unauthorized'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      authenticated: true,
      repId: payload.repId,
      slug: payload.slug
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Rep auth verify error:', error);
    return new Response(JSON.stringify({
      authenticated: false,
      error: 'Authentication check failed'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
