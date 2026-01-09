// Rep Logout API - Clear rep session
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

export async function onRequestPost(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const db = context.env.DB;
    const cookieHeader = context.request.headers.get('Cookie');
    const cookies = parseCookies(cookieHeader);
    const token = cookies[REP_COOKIE_NAME];

    if (token) {
      try {
        // Try to delete session from database
        const encoder = new TextEncoder();
        const data = encoder.encode(token);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        await db.prepare(`
          DELETE FROM portal_sessions WHERE token_hash = ? AND portal_type = 'rep'
        `).bind(tokenHash).run();
      } catch (e) {
        // Ignore errors when deleting session
        console.log('Session cleanup error:', e.message);
      }
    }

    // Clear cookie
    const cookie = `${REP_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

    return new Response(JSON.stringify({
      success: true,
      message: 'Logged out successfully'
    }), {
      headers: {
        ...corsHeaders,
        'Set-Cookie': cookie
      }
    });
  } catch (error) {
    console.error('Logout error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
