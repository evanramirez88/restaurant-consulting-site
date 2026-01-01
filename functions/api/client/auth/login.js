/**
 * Client Password Login Handler
 *
 * POST /api/client/auth/login
 *
 * Authenticates a client with email and password.
 * Note: In production, passwords should be properly hashed.
 */

import jwt from '@tsndr/cloudflare-worker-jwt';

const COOKIE_NAME = 'ccrc_client_token';
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { email, password, slug } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email and password are required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const db = env.DB;

    // Find client by email (and slug if provided)
    let client;
    if (slug) {
      client = await db.prepare(`
        SELECT id, email, name, company, slug, portal_enabled, password_hash
        FROM clients
        WHERE LOWER(email) = LOWER(?) AND slug = ?
      `).bind(email, slug).first();
    } else {
      client = await db.prepare(`
        SELECT id, email, name, company, slug, portal_enabled, password_hash
        FROM clients
        WHERE LOWER(email) = LOWER(?)
      `).bind(email).first();
    }

    // Client not found or portal not enabled
    if (!client || !client.portal_enabled) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email or password'
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Verify password
    // In production, use proper password hashing (bcrypt, argon2, etc.)
    // For now, we'll use a simple comparison or accept if no password is set
    if (client.password_hash) {
      // Simple hash comparison - replace with proper crypto in production
      const inputHash = await hashPassword(password, env);
      if (inputHash !== client.password_hash) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid email or password'
        }), {
          status: 401,
          headers: corsHeaders
        });
      }
    } else {
      // No password set - this client should use magic link
      return new Response(JSON.stringify({
        success: false,
        error: 'Password login not enabled. Please use magic link.'
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Create session token
    const jwtSecret = env.CLIENT_JWT_SECRET || env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT secret not configured');
    }

    const now = Math.floor(Date.now() / 1000);
    const sessionToken = await jwt.sign({
      clientId: client.id,
      email: client.email,
      slug: client.slug,
      type: 'session',
      iat: now,
      exp: now + SESSION_DURATION
    }, jwtSecret);

    // Set cookie
    const isProduction = env.ENVIRONMENT === 'production' || !env.ENVIRONMENT;
    const cookieOptions = [
      `${COOKIE_NAME}=${sessionToken}`,
      'Path=/',
      `Max-Age=${SESSION_DURATION}`,
      'HttpOnly',
      'SameSite=Strict'
    ];

    if (isProduction) {
      cookieOptions.push('Secure');
    }

    return new Response(JSON.stringify({
      success: true,
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        slug: client.slug
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Set-Cookie': cookieOptions.join('; ')
      }
    });

  } catch (error) {
    console.error('Client login error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Login failed'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * Simple password hashing (replace with proper crypto in production)
 */
async function hashPassword(password, env) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + (env.PASSWORD_SALT || 'ccrc_salt'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
