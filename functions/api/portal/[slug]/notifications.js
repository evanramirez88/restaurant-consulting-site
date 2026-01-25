/**
 * Portal Notifications API
 *
 * GET /api/portal/[slug]/notifications - List client's notifications
 * POST /api/portal/[slug]/notifications/[id]/read - Mark as read
 * POST /api/portal/[slug]/notifications/[id]/dismiss - Dismiss notification
 * POST /api/portal/[slug]/notifications/[id]/action - Take action (accept upsell, etc.)
 *
 * Supports filtering, pagination, and upsell tracking.
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../../_shared/auth.js';

const COOKIE_NAME = 'ccrc_client_token';

// Demo notifications data
const DEMO_NOTIFICATIONS = [
  {
    id: 'demo-notif-001',
    notification_type: 'upsell',
    title: 'Go-Live Support Available',
    body: 'Your installation is almost complete! Would you like on-site support for your go-live date?',
    action_url: '/portal/demo-seafood-shack/services/go-live-support',
    action_label: 'Learn More',
    upsell_product_id: 'go_live_support',
    upsell_amount: 1200,
    is_read: 0,
    is_dismissed: 0,
    created_at: Math.floor(Date.now() / 1000) - 2 * 60 * 60
  },
  {
    id: 'demo-notif-002',
    notification_type: 'milestone',
    title: 'Menu Setup Complete',
    body: 'Great news! Your menu has been fully configured in Toast. Your team can now start using it.',
    action_url: '/portal/demo-seafood-shack/projects',
    action_label: 'View Project',
    is_read: 0,
    is_dismissed: 0,
    created_at: Math.floor(Date.now() / 1000) - 24 * 60 * 60
  },
  {
    id: 'demo-notif-003',
    notification_type: 'action_required',
    title: 'Support Plan Renews Soon',
    body: 'Your Restaurant Guardian Professional plan renews in 30 days. Review your plan or upgrade?',
    action_url: '/portal/demo-seafood-shack/support-plan',
    action_label: 'Review Plan',
    is_read: 1,
    is_dismissed: 0,
    created_at: Math.floor(Date.now() / 1000) - 3 * 24 * 60 * 60
  },
  {
    id: 'demo-notif-004',
    notification_type: 'info',
    title: 'Issue Resolved',
    body: 'Your urgent support request regarding menu syncing has been resolved. Let us know if you need anything else!',
    action_url: '/portal/demo-seafood-shack/feedback',
    action_label: 'Give Feedback',
    is_read: 1,
    is_dismissed: 0,
    created_at: Math.floor(Date.now() / 1000) - 5 * 24 * 60 * 60
  }
];

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    const value = rest.join('=').trim();
    if (name) cookies[name.trim()] = value;
  });
  return cookies;
}

async function verifyClientAuth(request, env, slug) {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = parseCookies(cookieHeader);

  // 1. Try client-specific token
  const token = cookies[COOKIE_NAME];
  if (token) {
    const jwtSecret = env.CLIENT_JWT_SECRET || env.JWT_SECRET;
    if (jwtSecret) {
      try {
        const isValid = await jwt.verify(token, jwtSecret);
        if (isValid) {
          const { payload } = jwt.decode(token);
          const db = env.DB;
          const client = await db.prepare('SELECT id, slug FROM clients WHERE id = ?')
            .bind(payload.clientId)
            .first();
          if (client && client.slug === slug) {
            return { authenticated: true, clientId: payload.clientId };
          }
        }
      } catch (e) {
        // Fall through to admin check
      }
    }
  }

  // 2. Fall back to admin token (allows admin to view client portals)
  const adminToken = cookies['ccrc_admin_token'];
  if (adminToken) {
    const jwtSecret = env.JWT_SECRET || env.ADMIN_PASSWORD_HASH;
    if (jwtSecret) {
      try {
        const isValid = await jwt.verify(adminToken, jwtSecret);
        if (isValid) {
          // Get clientId from slug for admin access
          const db = env.DB;
          const client = await db.prepare('SELECT id FROM clients WHERE slug = ?')
            .bind(slug).first();
          return { authenticated: true, isAdmin: true, clientId: client?.id };
        }
      } catch (e) {
        // Fall through
      }
    }
  }

  return { authenticated: false, error: 'No session' };
}

/**
 * GET - List client's notifications
 */
export async function onRequestGet(context) {
  const { request, params, env } = context;
  const { slug } = params;
  const corsHeaders = getCorsHeaders(request);

  if (!slug) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing client slug'
    }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const url = new URL(request.url);
  const isDemoMode = slug.startsWith('demo-') || url.searchParams.get('demo') === 'true';

  if (isDemoMode) {
    const unreadOnly = url.searchParams.get('unread') === 'true';
    let filtered = DEMO_NOTIFICATIONS;
    if (unreadOnly) {
      filtered = filtered.filter(n => !n.is_read && !n.is_dismissed);
    }
    return new Response(JSON.stringify({
      success: true,
      data: filtered,
      unreadCount: DEMO_NOTIFICATIONS.filter(n => !n.is_read && !n.is_dismissed).length
    }), {
      status: 200,
      headers: corsHeaders
    });
  }

  const auth = await verifyClientAuth(request, env, slug);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({
      success: false,
      error: auth.error || 'Unauthorized'
    }), {
      status: 401,
      headers: corsHeaders
    });
  }

  try {
    const db = env.DB;

    // Parse query params
    const unreadOnly = url.searchParams.get('unread') === 'true';
    const type = url.searchParams.get('type');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const now = Math.floor(Date.now() / 1000);

    // Build query
    let query = `
      SELECT
        id,
        notification_type,
        title,
        body,
        action_url,
        action_label,
        upsell_product_id,
        upsell_amount,
        upsell_discount_pct,
        is_read,
        read_at,
        is_dismissed,
        is_actioned,
        created_at
      FROM portal_notifications
      WHERE client_id = ?
        AND is_dismissed = 0
        AND (expires_at IS NULL OR expires_at > ?)
        AND (display_after IS NULL OR display_after <= ?)
    `;
    const bindings = [auth.clientId, now, now];

    if (unreadOnly) {
      query += ' AND is_read = 0';
    }

    if (type) {
      query += ' AND notification_type = ?';
      bindings.push(type);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const { results } = await db.prepare(query).bind(...bindings).all();

    // Get unread count
    const countResult = await db.prepare(`
      SELECT COUNT(*) as count FROM portal_notifications
      WHERE client_id = ?
        AND is_read = 0
        AND is_dismissed = 0
        AND (expires_at IS NULL OR expires_at > ?)
        AND (display_after IS NULL OR display_after <= ?)
    `).bind(auth.clientId, now, now).first();

    return new Response(JSON.stringify({
      success: true,
      data: results || [],
      unreadCount: countResult?.count || 0
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Portal notifications error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to load notifications'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * POST - Handle notification actions (read, dismiss, action)
 *
 * Body: { action: 'read' | 'dismiss' | 'action', notificationId: string }
 */
export async function onRequestPost(context) {
  const { request, params, env } = context;
  const { slug } = params;
  const corsHeaders = getCorsHeaders(request);

  if (!slug) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing client slug'
    }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const url = new URL(request.url);
  const isDemoMode = slug.startsWith('demo-') || url.searchParams.get('demo') === 'true';

  if (isDemoMode) {
    const body = await request.json();
    return new Response(JSON.stringify({
      success: true,
      message: `Demo: Notification ${body.action || 'updated'} (not persisted)`
    }), {
      status: 200,
      headers: corsHeaders
    });
  }

  const auth = await verifyClientAuth(request, env, slug);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({
      success: false,
      error: auth.error || 'Unauthorized'
    }), {
      status: 401,
      headers: corsHeaders
    });
  }

  try {
    const db = env.DB;
    const body = await request.json();
    const { action, notificationId } = body;

    if (!notificationId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Notification ID is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Verify notification belongs to this client
    const notification = await db.prepare(`
      SELECT * FROM portal_notifications WHERE id = ? AND client_id = ?
    `).bind(notificationId, auth.clientId).first();

    if (!notification) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Notification not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);

    switch (action) {
      case 'read':
        await db.prepare(`
          UPDATE portal_notifications SET is_read = 1, read_at = ? WHERE id = ?
        `).bind(now, notificationId).run();
        break;

      case 'dismiss':
        await db.prepare(`
          UPDATE portal_notifications SET is_dismissed = 1, dismissed_at = ? WHERE id = ?
        `).bind(now, notificationId).run();
        break;

      case 'action':
        // Mark as actioned and read
        await db.prepare(`
          UPDATE portal_notifications
          SET is_actioned = 1, actioned_at = ?, is_read = 1, read_at = COALESCE(read_at, ?)
          WHERE id = ?
        `).bind(now, now, notificationId).run();

        // If this is an upsell, track the acceptance
        if (notification.notification_type === 'upsell' && notification.upsell_product_id) {
          // Could create an internal ticket or log the interest
          console.log(`Upsell interest: Client ${auth.clientId} clicked on ${notification.upsell_product_id}`);
        }
        break;

      case 'mark_all_read':
        await db.prepare(`
          UPDATE portal_notifications
          SET is_read = 1, read_at = ?
          WHERE client_id = ? AND is_read = 0
        `).bind(now, auth.clientId).run();
        break;

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid action. Use: read, dismiss, action, or mark_all_read'
        }), {
          status: 400,
          headers: corsHeaders
        });
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Notification ${action} successful`
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Notification action error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update notification'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getCorsOrigin(context.request),
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
