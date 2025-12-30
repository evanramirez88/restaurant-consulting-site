/**
 * Admin Audit Log API
 *
 * GET /api/admin/audit - Get audit log entries
 * POST /api/admin/audit - Log a new admin action
 *
 * Environment Variables Required:
 * - D1 Database with audit_log table (future implementation)
 *
 * Authentication Required: Yes (admin session)
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';

// Mock audit log data (placeholder until D1 implementation)
const MOCK_AUDIT_LOG = [
  {
    id: '1',
    action: 'Login',
    details: 'Admin logged in successfully',
    timestamp: Date.now() - 1000 * 60 * 5,
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome/120'
  },
  {
    id: '2',
    action: 'Availability Update',
    details: 'Changed status to Available',
    timestamp: Date.now() - 1000 * 60 * 30,
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome/120'
  },
  {
    id: '3',
    action: 'Config Update',
    details: 'Updated business hours',
    timestamp: Date.now() - 1000 * 60 * 60 * 2,
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome/120'
  },
  {
    id: '4',
    action: 'Login',
    details: 'Admin logged in successfully',
    timestamp: Date.now() - 1000 * 60 * 60 * 24,
    ipAddress: '192.168.1.105',
    userAgent: 'Safari/17'
  },
  {
    id: '5',
    action: 'Availability Update',
    details: 'Changed location to Hyannis',
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 2,
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome/120'
  }
];

/**
 * GET /api/admin/audit
 * Returns audit log entries
 *
 * Query Parameters:
 * - limit (optional): Number of entries to return (default: 50, max: 100)
 * - offset (optional): Number of entries to skip (default: 0)
 * - action (optional): Filter by action type
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    // Verify authentication
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    // Parse query parameters
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const actionFilter = url.searchParams.get('action');

    // TODO: Replace with D1 database query when implemented
    // Example future implementation:
    // const result = await env.DB.prepare(
    //   `SELECT id, action, details, timestamp, ip_address, user_agent
    //    FROM audit_log
    //    WHERE ($1 IS NULL OR action = $1)
    //    ORDER BY timestamp DESC
    //    LIMIT $2 OFFSET $3`
    // ).bind(actionFilter, limit, offset).all();

    // For now, return mock data
    let entries = [...MOCK_AUDIT_LOG];

    // Apply filter if specified
    if (actionFilter) {
      entries = entries.filter(e => e.action.toLowerCase().includes(actionFilter.toLowerCase()));
    }

    // Apply pagination
    const total = entries.length;
    entries = entries.slice(offset, offset + limit);

    return new Response(JSON.stringify({
      success: true,
      data: {
        entries,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + entries.length < total
        }
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Audit log GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to retrieve audit log'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * POST /api/admin/audit
 * Log a new admin action
 *
 * Request Body:
 * {
 *   action: string,    // Required: Action type (e.g., "Login", "Config Update")
 *   details: string    // Required: Human-readable description
 * }
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Verify authentication
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    // Parse request body
    const data = await request.json();

    if (!data.action || !data.details) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: action, details'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get client info
    const ipAddress = request.headers.get('CF-Connecting-IP') ||
                      request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
                      'unknown';
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    const timestamp = Date.now();
    const id = crypto.randomUUID();

    // TODO: Replace with D1 database insert when implemented
    // Example future implementation:
    // await env.DB.prepare(
    //   `INSERT INTO audit_log (id, action, details, timestamp, ip_address, user_agent)
    //    VALUES (?, ?, ?, ?, ?, ?)`
    // ).bind(id, data.action, data.details, timestamp, ipAddress, userAgent).run();

    // For now, just return success (mock implementation)
    const newEntry = {
      id,
      action: data.action,
      details: data.details,
      timestamp,
      ipAddress,
      userAgent
    };

    console.log('Audit log entry (placeholder):', newEntry);

    return new Response(JSON.stringify({
      success: true,
      message: 'Audit log entry recorded',
      data: newEntry
    }), {
      status: 201,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Audit log POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to record audit log entry'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * Handle CORS preflight
 */
export async function onRequestOptions() {
  return handleOptions();
}
