/**
 * Client Password Login Handler
 *
 * POST /api/client/auth/login
 *
 * Authenticates a client with email and password using secure PBKDF2 hashing.
 */

import jwt from '@tsndr/cloudflare-worker-jwt';

const COOKIE_NAME = 'ccrc_client_token';
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days

// PBKDF2 configuration - secure password hashing
const PBKDF2_ITERATIONS = 100000;
const HASH_ALGORITHM = 'SHA-256';
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

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

    // Rate limiting check using KV (if available)
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = `login_attempts:${clientIP}:${email.toLowerCase()}`;

    if (env.KV) {
      const attempts = await env.KV.get(rateLimitKey);
      if (attempts && parseInt(attempts) >= 5) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Too many login attempts. Please try again in 15 minutes.'
        }), {
          status: 429,
          headers: corsHeaders
        });
      }
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
      await incrementLoginAttempts(env.KV, rateLimitKey);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email or password'
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Verify password
    if (client.password_hash) {
      const isValid = await verifyPassword(password, client.password_hash);
      if (!isValid) {
        await incrementLoginAttempts(env.KV, rateLimitKey);
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

    // Clear rate limit on successful login
    if (env.KV) {
      await env.KV.delete(rateLimitKey);
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
 * Hash a password using PBKDF2 with a random salt
 * Format: <iterations>:<salt_base64>:<hash_base64>
 */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGORITHM
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  const hashArray = new Uint8Array(derivedBits);
  const saltBase64 = btoa(String.fromCharCode(...salt));
  const hashBase64 = btoa(String.fromCharCode(...hashArray));

  return `${PBKDF2_ITERATIONS}:${saltBase64}:${hashBase64}`;
}

/**
 * Verify a password against a stored hash
 */
async function verifyPassword(password, storedHash) {
  // Handle legacy SHA-256 hashes (they don't have colons)
  if (!storedHash.includes(':')) {
    // Legacy hash - gradually migrate by prompting password reset
    // For now, still verify but log a warning
    console.warn('Legacy password hash detected - should migrate to PBKDF2');
    return await verifyLegacyPassword(password, storedHash);
  }

  const [iterations, saltBase64, hashBase64] = storedHash.split(':');
  const iterationCount = parseInt(iterations);

  // Decode salt from base64
  const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
  const expectedHash = Uint8Array.from(atob(hashBase64), c => c.charCodeAt(0));

  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterationCount,
      hash: HASH_ALGORITHM
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  const computedHash = new Uint8Array(derivedBits);

  // Constant-time comparison to prevent timing attacks
  if (computedHash.length !== expectedHash.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < computedHash.length; i++) {
    result |= computedHash[i] ^ expectedHash[i];
  }
  return result === 0;
}

/**
 * Verify legacy SHA-256 password (for backwards compatibility)
 */
async function verifyLegacyPassword(password, storedHash) {
  const encoder = new TextEncoder();
  // Legacy salt - keeping for backwards compatibility
  const data = encoder.encode(password + 'ccrc_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return computedHash === storedHash;
}

/**
 * Increment login attempts for rate limiting
 */
async function incrementLoginAttempts(kv, key) {
  if (!kv) return;

  const attempts = await kv.get(key);
  const newCount = (parseInt(attempts) || 0) + 1;
  // Expire after 15 minutes
  await kv.put(key, newCount.toString(), { expirationTtl: 900 });
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
