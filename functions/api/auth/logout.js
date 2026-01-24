/**
 * Admin Logout Handler
 *
 * POST /api/auth/logout
 *
 * Clears the admin authentication cookie
 */

import { getCorsOrigin } from '../../_shared/auth.js';

const COOKIE_NAME = 'ccrc_admin_token';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

export async function onRequestPost(context) {
  const { request } = context;
  const corsHeaders = getCorsHeaders(request);

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

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request)
  });
}
