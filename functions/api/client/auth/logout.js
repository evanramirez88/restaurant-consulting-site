/**
 * Client Logout Handler
 *
 * POST /api/client/auth/logout
 *
 * Clears the client session cookie.
 */

const COOKIE_NAME = 'ccrc_client_token';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export async function onRequestPost(context) {
  const { env } = context;

  // Clear cookie by setting expired date
  const isProduction = env.ENVIRONMENT === 'production' || !env.ENVIRONMENT;
  const cookieOptions = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'HttpOnly',
    'SameSite=Strict'
  ];

  if (isProduction) {
    cookieOptions.push('Secure');
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'Logged out successfully'
  }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Set-Cookie': cookieOptions.join('; ')
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
