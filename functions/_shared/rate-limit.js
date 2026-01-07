/**
 * Rate Limiting Utility
 *
 * Uses Cloudflare KV for distributed rate limiting across workers.
 * Implements a sliding window approach.
 */

/**
 * Rate limit configuration presets
 */
export const RATE_LIMITS = {
  // Public form endpoints - stricter limits
  CONTACT_FORM: { maxRequests: 5, windowSeconds: 300 },     // 5 per 5 min
  QUOTE_FORM: { maxRequests: 10, windowSeconds: 300 },      // 10 per 5 min

  // API endpoints - moderate limits
  API_READ: { maxRequests: 100, windowSeconds: 60 },        // 100 per min
  API_WRITE: { maxRequests: 30, windowSeconds: 60 },        // 30 per min

  // Auth endpoints - strict limits
  AUTH_LOGIN: { maxRequests: 5, windowSeconds: 900 },       // 5 per 15 min
  AUTH_MAGIC_LINK: { maxRequests: 3, windowSeconds: 600 },  // 3 per 10 min
};

/**
 * Get client IP from request
 */
function getClientIP(request) {
  // Cloudflare provides the real IP in CF-Connecting-IP header
  return request.headers.get('CF-Connecting-IP') ||
         request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
         request.headers.get('X-Real-IP') ||
         'unknown';
}

/**
 * Generate rate limit key
 */
function getRateLimitKey(request, endpoint) {
  const ip = getClientIP(request);
  return `ratelimit:${endpoint}:${ip}`;
}

/**
 * Check rate limit for a request
 *
 * @param {Request} request - The incoming request
 * @param {KVNamespace} kv - KV namespace for rate limit storage
 * @param {string} endpoint - Endpoint identifier (e.g., 'contact', 'quote')
 * @param {Object} config - Rate limit config { maxRequests, windowSeconds }
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number}>}
 */
export async function checkRateLimit(request, kv, endpoint, config) {
  const key = getRateLimitKey(request, endpoint);
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.windowSeconds;

  try {
    // Get existing record
    const existing = await kv.get(key, 'json');

    if (!existing) {
      // First request - create new record
      const record = {
        requests: [now],
        firstRequest: now
      };

      await kv.put(key, JSON.stringify(record), {
        expirationTtl: config.windowSeconds + 60 // Add buffer
      });

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: now + config.windowSeconds
      };
    }

    // Filter out old requests outside the window
    const validRequests = (existing.requests || []).filter(ts => ts > windowStart);

    if (validRequests.length >= config.maxRequests) {
      // Rate limited
      const oldestInWindow = Math.min(...validRequests);
      return {
        allowed: false,
        remaining: 0,
        resetAt: oldestInWindow + config.windowSeconds
      };
    }

    // Add new request
    validRequests.push(now);

    await kv.put(key, JSON.stringify({
      requests: validRequests,
      firstRequest: existing.firstRequest
    }), {
      expirationTtl: config.windowSeconds + 60
    });

    return {
      allowed: true,
      remaining: config.maxRequests - validRequests.length,
      resetAt: now + config.windowSeconds
    };

  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open - allow request if KV fails
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: now + config.windowSeconds
    };
  }
}

/**
 * Create rate limit headers for response
 */
export function getRateLimitHeaders(result, config) {
  return {
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': String(result.resetAt)
  };
}

/**
 * Create rate limit exceeded response
 */
export function rateLimitExceededResponse(result, corsHeaders = {}) {
  const retryAfter = Math.max(1, result.resetAt - Math.floor(Date.now() / 1000));

  return new Response(JSON.stringify({
    success: false,
    error: 'Too many requests. Please try again later.',
    retryAfter
  }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfter),
      ...corsHeaders
    }
  });
}

/**
 * Middleware-style rate limiter
 * Returns null if allowed, or a Response if rate limited
 */
export async function rateLimit(request, kv, endpoint, config, corsHeaders = {}) {
  if (!kv) {
    // KV not configured - skip rate limiting
    console.warn('Rate limit KV not configured');
    return null;
  }

  const result = await checkRateLimit(request, kv, endpoint, config);

  if (!result.allowed) {
    return rateLimitExceededResponse(result, corsHeaders);
  }

  // Return rate limit info for adding to successful response headers
  return null;
}
