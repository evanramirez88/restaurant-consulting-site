/**
 * Admin Activity Feed API
 *
 * GET /api/admin/activity/recent - Get recent activity across the platform
 *
 * Aggregates activities from:
 * - Email sends (email_logs)
 * - Portal logins (portal_sessions)
 * - Ticket updates (tickets)
 * - Contact form submissions (contact_form_submissions)
 *
 * Environment Variables Required:
 * - D1 Database (env.DB)
 *
 * Authentication Required: Yes (admin session)
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

/**
 * GET /api/admin/activity/recent
 * Returns recent activity across all tracked sources
 *
 * Query Parameters:
 * - limit (optional): Number of entries to return (default: 20, max: 50)
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
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

    const db = env.DB;
    const activities = [];

    // Aggregate activities from multiple sources using individual queries
    // (UNION ALL approach can cause issues with D1, so we aggregate in JS)

    try {
      // 1. Email sends
      const emailResult = await db.prepare(`
        SELECT
          el.id,
          'email' as type,
          CASE
            WHEN el.status = 'sent' THEN 'Email sent to ' || COALESCE(s.email, 'unknown')
            WHEN el.status = 'delivered' THEN 'Email delivered to ' || COALESCE(s.email, 'unknown')
            WHEN el.status = 'opened' THEN 'Email opened by ' || COALESCE(s.email, 'unknown')
            WHEN el.status = 'clicked' THEN 'Email clicked by ' || COALESCE(s.email, 'unknown')
            ELSE 'Email ' || el.status || ' for ' || COALESCE(s.email, 'unknown')
          END as description,
          el.created_at as timestamp
        FROM email_logs el
        LEFT JOIN email_subscribers s ON el.subscriber_id = s.id
        WHERE el.status IN ('sent', 'delivered', 'opened', 'clicked')
        ORDER BY el.created_at DESC
        LIMIT 10
      `).all();

      if (emailResult.results) {
        activities.push(...emailResult.results.map(r => ({
          ...r,
          type: 'email'
        })));
      }
    } catch (e) {
      console.error('Email activity query failed:', e);
    }

    try {
      // 2. Portal sessions (client and rep logins)
      const sessionResult = await db.prepare(`
        SELECT
          ps.id,
          'login' as type,
          CASE
            WHEN ps.portal_type = 'client' THEN 'Client portal login: ' || COALESCE(c.company, c.name, 'unknown')
            WHEN ps.portal_type = 'rep' THEN 'Rep portal login: ' || COALESCE(r.name, 'unknown')
            ELSE 'Portal login'
          END as description,
          ps.created_at as timestamp
        FROM portal_sessions ps
        LEFT JOIN clients c ON ps.user_id = c.id AND ps.portal_type = 'client'
        LEFT JOIN reps r ON ps.user_id = r.id AND ps.portal_type = 'rep'
        ORDER BY ps.created_at DESC
        LIMIT 5
      `).all();

      if (sessionResult.results) {
        activities.push(...sessionResult.results.map(r => ({
          ...r,
          type: 'login'
        })));
      }
    } catch (e) {
      console.error('Portal session activity query failed:', e);
    }

    try {
      // 3. Ticket updates
      const ticketResult = await db.prepare(`
        SELECT
          t.id,
          'ticket' as type,
          'Ticket ' || CASE
            WHEN t.status = 'open' THEN 'opened'
            WHEN t.status = 'closed' THEN 'closed'
            ELSE 'updated'
          END || ': ' || COALESCE(t.subject, 'Untitled') as description,
          COALESCE(t.updated_at, t.created_at) as timestamp
        FROM tickets t
        ORDER BY COALESCE(t.updated_at, t.created_at) DESC
        LIMIT 5
      `).all();

      if (ticketResult.results) {
        activities.push(...ticketResult.results.map(r => ({
          ...r,
          type: 'ticket'
        })));
      }
    } catch (e) {
      console.error('Ticket activity query failed:', e);
    }

    try {
      // 4. Contact form submissions
      const formResult = await db.prepare(`
        SELECT
          cf.id,
          'form' as type,
          'Contact form: ' || COALESCE(cf.name, 'Anonymous') as description,
          cf.created_at as timestamp
        FROM contact_form_submissions cf
        ORDER BY cf.created_at DESC
        LIMIT 5
      `).all();

      if (formResult.results) {
        activities.push(...formResult.results.map(r => ({
          ...r,
          type: 'form'
        })));
      }
    } catch (e) {
      console.error('Contact form activity query failed:', e);
    }

    // Sort all activities by timestamp descending and limit
    activities.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const limitedActivities = activities.slice(0, limit);

    return new Response(JSON.stringify({
      success: true,
      data: limitedActivities
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Activity feed GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to retrieve activity feed'
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
