/**
 * Admin Logout Handler
 *
 * POST /api/auth/logout
 *
 * Clears the admin authentication cookie
 */

const COOKIE_NAME = 'ccrc_admin_token';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export async function onRequestPost(context) {
  const { request } = context;

  try {
    // Build cookie to clear (expire immediately)
    const isSecure = new URL(request.url).protocol === 'https:';
    const cookieValue = [
      `${COOKIE_NAME}=`,
      'Max-Age=0',
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      isSecure ? 'Secure' : ''
    ].filter(Boolean).join('; ');

    return new Response(JSON.stringify({
      success: true,
      message: 'Logged out successfully'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Set-Cookie': cookieValue
      }
    });

  } catch (error) {
    console.error('Logout error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'An error occurred during logout'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
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
