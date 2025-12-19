/**
 * Admin Login Handler
 *
 * POST /api/auth/login
 * Body: { password: string }
 *
 * Environment Variables Required:
 * - ADMIN_PASSWORD_HASH: SHA-256 hash of the admin password
 * - JWT_SECRET (optional): Secret for signing JWTs, defaults to ADMIN_PASSWORD_HASH
 *
 * D1 Database Required:
 * - DB: D1 database binding with login_attempts table
 */

import jwt from '@tsndr/cloudflare-worker-jwt';

// Rate limiting constants
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 60; // 1 minute in seconds

// Cookie settings
const COOKIE_NAME = 'ccrc_admin_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

/**
 * Hash a string using SHA-256
 */
async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check rate limiting for an IP address
 */
async function checkRateLimit(db, ipAddress) {
  const now = Math.floor(Date.now() / 1000);

  try {
    // Get existing attempts
    const result = await db.prepare(
      'SELECT attempts, first_attempt, last_attempt FROM login_attempts WHERE ip_address = ?'
    ).bind(ipAddress).first();

    if (!result) {
      // First attempt from this IP
      await db.prepare(
        'INSERT INTO login_attempts (ip_address, attempts, first_attempt, last_attempt) VALUES (?, 1, ?, ?)'
      ).bind(ipAddress, now, now).run();
      return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
    }

    // Check if window has expired
    if (now - result.first_attempt >= RATE_LIMIT_WINDOW) {
      // Reset the counter
      await db.prepare(
        'UPDATE login_attempts SET attempts = 1, first_attempt = ?, last_attempt = ? WHERE ip_address = ?'
      ).bind(now, now, ipAddress).run();
      return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
    }

    // Within window, check attempts
    if (result.attempts >= MAX_ATTEMPTS) {
      const retryAfter = RATE_LIMIT_WINDOW - (now - result.first_attempt);
      return { allowed: false, retryAfter, remaining: 0 };
    }

    // Increment attempts
    await db.prepare(
      'UPDATE login_attempts SET attempts = attempts + 1, last_attempt = ? WHERE ip_address = ?'
    ).bind(now, ipAddress).run();

    return { allowed: true, remaining: MAX_ATTEMPTS - result.attempts - 1 };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Allow on error but log it
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }
}

/**
 * Clear rate limit on successful login
 */
async function clearRateLimit(db, ipAddress) {
  try {
    await db.prepare('DELETE FROM login_attempts WHERE ip_address = ?').bind(ipAddress).run();
  } catch (error) {
    console.error('Clear rate limit error:', error);
  }
}

/**
 * Get client IP address
 */
function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') ||
         request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
         'unknown';
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const ipAddress = getClientIP(request);

  try {
    // Validate environment
    if (!env.ADMIN_PASSWORD_HASH) {
      console.error('ADMIN_PASSWORD_HASH not configured');
      return new Response(JSON.stringify({
        success: false,
        error: 'Server configuration error'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    // Check rate limit
    const rateLimit = await checkRateLimit(env.DB, ipAddress);
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Too many login attempts. Please try again later.',
        retryAfter: rateLimit.retryAfter
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Retry-After': String(rateLimit.retryAfter)
        }
      });
    }

    // Parse request body
    const data = await request.json();

    if (!data.password || typeof data.password !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Password is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Hash the provided password and compare
    const passwordHash = await sha256(data.password);

    if (passwordHash !== env.ADMIN_PASSWORD_HASH.toLowerCase()) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid password',
        attemptsRemaining: rateLimit.remaining
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Password correct - clear rate limit and generate JWT
    await clearRateLimit(env.DB, ipAddress);

    const jwtSecret = env.JWT_SECRET || env.ADMIN_PASSWORD_HASH;
    const now = Math.floor(Date.now() / 1000);

    const token = await jwt.sign({
      sub: 'admin',
      iat: now,
      exp: now + COOKIE_MAX_AGE,
      iss: 'ccrc-admin'
    }, jwtSecret);

    // Build Set-Cookie header
    const isSecure = new URL(request.url).protocol === 'https:';
    const cookieValue = [
      `${COOKIE_NAME}=${token}`,
      `Max-Age=${COOKIE_MAX_AGE}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      isSecure ? 'Secure' : ''
    ].filter(Boolean).join('; ');

    return new Response(JSON.stringify({
      success: true,
      message: 'Login successful'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Set-Cookie': cookieValue
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'An error occurred during login'
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
