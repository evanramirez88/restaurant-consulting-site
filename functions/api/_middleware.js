/**
 * API Rate Limiting Middleware
 *
 * Protects API endpoints from abuse using Cloudflare KV for state tracking.
 *
 * Rate limits:
 * - /api/contact: 5 requests per minute
 * - /api/quote/*: 10 requests per hour
 * - /api/menu/*: 10 requests per hour
 * - Default: 60 requests per minute
 */

// Rate limit configurations
const RATE_LIMITS = {
  '/api/contact': { limit: 5, windowSeconds: 60 },           // 5/min
  '/api/quote/calculate': { limit: 10, windowSeconds: 3600 }, // 10/hr
  '/api/quote/catalog': { limit: 60, windowSeconds: 60 },     // 60/min (less sensitive)
  '/api/menu/upload': { limit: 10, windowSeconds: 3600 },     // 10/hr
  '/api/menu/process': { limit: 10, windowSeconds: 3600 },    // 10/hr
  'default': { limit: 60, windowSeconds: 60 }                 // 60/min
};

// Paths that bypass rate limiting
const BYPASS_PATHS = [
  '/api/auth/',      // Auth endpoints need higher availability
  '/api/admin/',     // Admin is already protected by auth
  '/api/client/',    // Client portal is auth-protected
  '/api/config/',    // Config endpoints
  '/api/availability/' // Availability check
];

/**
 * Get client IP from request headers
 */
function getClientIP(request) {
  // Cloudflare provides the real IP
  return request.headers.get('CF-Connecting-IP') ||
         request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
         request.headers.get('X-Real-IP') ||
         'unknown';
}

/**
 * Get rate limit config for a path
 */
function getRateLimitConfig(pathname) {
  // Check for exact match first
  if (RATE_LIMITS[pathname]) {
    return RATE_LIMITS[pathname];
  }

  // Check for prefix match
  for (const [path, config] of Object.entries(RATE_LIMITS)) {
    if (path !== 'default' && pathname.startsWith(path)) {
      return config;
    }
  }

  return RATE_LIMITS['default'];
}

/**
 * Check if path should bypass rate limiting
 */
function shouldBypass(pathname) {
  return BYPASS_PATHS.some(prefix => pathname.startsWith(prefix));
}

/**
 * Create rate limit key for KV storage
 */
function createRateLimitKey(ip, pathname) {
  // Normalize pathname to route group
  let route = pathname;
  for (const path of Object.keys(RATE_LIMITS)) {
    if (path !== 'default' && pathname.startsWith(path)) {
      route = path;
      break;
    }
  }
  return `ratelimit:${ip}:${route}`;
}

/**
 * Rate limiting response
 */
function rateLimitResponse(retryAfter) {
  return new Response(JSON.stringify({
    success: false,
    error: 'Too many requests. Please try again later.',
    retryAfter
  }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfter),
      'X-RateLimit-Limit': '0',
      'X-RateLimit-Remaining': '0'
    }
  });
}

/**
 * Main middleware function
 */
export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Skip rate limiting for bypassed paths
  if (shouldBypass(pathname)) {
    return next();
  }

  // Skip rate limiting if KV is not configured
  if (!env.RATE_LIMIT_KV) {
    console.warn('RATE_LIMIT_KV not configured, skipping rate limiting');
    return next();
  }

  const clientIP = getClientIP(request);
  const config = getRateLimitConfig(pathname);
  const key = createRateLimitKey(clientIP, pathname);

  try {
    // Get current rate limit data from KV
    const now = Date.now();
    const windowStart = now - (config.windowSeconds * 1000);

    let rateLimitData = await env.RATE_LIMIT_KV.get(key, { type: 'json' });

    if (!rateLimitData) {
      rateLimitData = { requests: [], windowStart: now };
    }

    // Filter out expired requests
    rateLimitData.requests = rateLimitData.requests.filter(
      timestamp => timestamp > windowStart
    );

    // Check if over limit
    if (rateLimitData.requests.length >= config.limit) {
      const oldestRequest = Math.min(...rateLimitData.requests);
      const retryAfter = Math.ceil((oldestRequest + (config.windowSeconds * 1000) - now) / 1000);
      return rateLimitResponse(Math.max(1, retryAfter));
    }

    // Add current request
    rateLimitData.requests.push(now);

    // Store updated data with expiration
    await env.RATE_LIMIT_KV.put(key, JSON.stringify(rateLimitData), {
      expirationTtl: config.windowSeconds + 60 // Add buffer for clock skew
    });

    // Continue to the actual handler
    const response = await next();

    // Add rate limit headers to response
    const remaining = config.limit - rateLimitData.requests.length;
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-RateLimit-Limit', String(config.limit));
    newResponse.headers.set('X-RateLimit-Remaining', String(Math.max(0, remaining)));
    newResponse.headers.set('X-RateLimit-Reset', String(Math.ceil((windowStart + (config.windowSeconds * 1000)) / 1000)));

    return newResponse;

  } catch (error) {
    console.error('Rate limiting error:', error);
    // On error, allow the request through but log it
    return next();
  }
}
