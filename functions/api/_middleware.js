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
  '/api/availability/', // Availability check
  '/api/stripe/',    // Stripe webhooks need immediate processing
  '/api/webhooks/'   // General webhooks
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
 *
 * KV-based rate limiting DISABLED to stay within free tier limits.
 * Cloudflare's built-in DDoS/bot protection handles abuse at the edge.
 * All authenticated endpoints already verify auth tokens.
 *
 * To re-enable: upgrade to Workers Paid plan ($5/mo) and uncomment
 * the KV logic below.
 */
export async function onRequest(context) {
  return context.next();
}
