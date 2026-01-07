/**
 * Email Analytics API - Real-Time Activity
 *
 * GET /api/admin/email/analytics/realtime - Get recent activity feed
 *
 * Query params:
 *   - limit: Number of items per category (default: 10, max: 50)
 *   - since: Unix timestamp to get activity since (optional)
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const url = new URL(context.request.url);

    // Get query parameters
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
    const since = url.searchParams.get('since');

    const now = Math.floor(Date.now() / 1000);
    const sinceTs = since ? parseInt(since) : now - 3600; // Default to last hour

    // Get recent opens
    const opensQuery = `
      SELECT
        el.id,
        el.opened_at as timestamp,
        es.email as subscriber_email,
        es.first_name || ' ' || COALESCE(es.last_name, '') as subscriber_name,
        st.subject as email_subject,
        eq.name as sequence_name
      FROM email_logs el
      JOIN email_subscribers es ON el.subscriber_id = es.id
      LEFT JOIN sequence_steps st ON el.step_id = st.id
      LEFT JOIN email_sequences eq ON el.sequence_id = eq.id
      WHERE el.opened_at IS NOT NULL AND el.opened_at >= ?
      ORDER BY el.opened_at DESC
      LIMIT ?
    `;

    // Get recent clicks
    const clicksQuery = `
      SELECT
        el.id,
        el.clicked_at as timestamp,
        es.email as subscriber_email,
        es.first_name || ' ' || COALESCE(es.last_name, '') as subscriber_name,
        st.subject as email_subject,
        eq.name as sequence_name,
        el.clicked_link as link_url
      FROM email_logs el
      JOIN email_subscribers es ON el.subscriber_id = es.id
      LEFT JOIN sequence_steps st ON el.step_id = st.id
      LEFT JOIN email_sequences eq ON el.sequence_id = eq.id
      WHERE el.clicked_at IS NOT NULL AND el.clicked_at >= ?
      ORDER BY el.clicked_at DESC
      LIMIT ?
    `;

    // Get recent bounces
    const bouncesQuery = `
      SELECT
        el.id,
        el.bounced_at as timestamp,
        es.email as subscriber_email,
        es.first_name || ' ' || COALESCE(es.last_name, '') as subscriber_name,
        st.subject as email_subject,
        eq.name as sequence_name,
        el.bounce_reason as reason
      FROM email_logs el
      JOIN email_subscribers es ON el.subscriber_id = es.id
      LEFT JOIN sequence_steps st ON el.step_id = st.id
      LEFT JOIN email_sequences eq ON el.sequence_id = eq.id
      WHERE el.bounced_at IS NOT NULL AND el.bounced_at >= ?
      ORDER BY el.bounced_at DESC
      LIMIT ?
    `;

    // Get recent sends
    const sendsQuery = `
      SELECT
        el.id,
        el.created_at as timestamp,
        es.email as subscriber_email,
        es.first_name || ' ' || COALESCE(es.last_name, '') as subscriber_name,
        st.subject as email_subject,
        eq.name as sequence_name
      FROM email_logs el
      JOIN email_subscribers es ON el.subscriber_id = es.id
      LEFT JOIN sequence_steps st ON el.step_id = st.id
      LEFT JOIN email_sequences eq ON el.sequence_id = eq.id
      WHERE el.created_at >= ?
      ORDER BY el.created_at DESC
      LIMIT ?
    `;

    // Get recent unsubscribes
    const unsubsQuery = `
      SELECT
        el.id,
        el.updated_at as timestamp,
        es.email as subscriber_email,
        es.first_name || ' ' || COALESCE(es.last_name, '') as subscriber_name,
        eq.name as sequence_name
      FROM email_logs el
      JOIN email_subscribers es ON el.subscriber_id = es.id
      LEFT JOIN email_sequences eq ON el.sequence_id = eq.id
      WHERE el.status = 'unsubscribed' AND el.updated_at >= ?
      ORDER BY el.updated_at DESC
      LIMIT ?
    `;

    // Execute queries in parallel
    const [opens, clicks, bounces, sends, unsubs] = await Promise.all([
      db.prepare(opensQuery).bind(sinceTs, limit).all(),
      db.prepare(clicksQuery).bind(sinceTs, limit).all(),
      db.prepare(bouncesQuery).bind(sinceTs, limit).all(),
      db.prepare(sendsQuery).bind(sinceTs, limit).all(),
      db.prepare(unsubsQuery).bind(sinceTs, limit).all()
    ]);

    // Get quick stats for the period
    const statsQuery = `
      SELECT
        COUNT(*) as total_sent,
        SUM(CASE WHEN opened_at IS NOT NULL AND opened_at >= ? THEN 1 ELSE 0 END) as opens,
        SUM(CASE WHEN clicked_at IS NOT NULL AND clicked_at >= ? THEN 1 ELSE 0 END) as clicks,
        SUM(CASE WHEN bounced_at IS NOT NULL AND bounced_at >= ? THEN 1 ELSE 0 END) as bounces,
        SUM(CASE WHEN status = 'unsubscribed' AND updated_at >= ? THEN 1 ELSE 0 END) as unsubscribes
      FROM email_logs
      WHERE created_at >= ?
    `;

    const stats = await db.prepare(statsQuery).bind(sinceTs, sinceTs, sinceTs, sinceTs, sinceTs).first();

    // Format results
    const formatActivity = (items, type) => (items.results || []).map(item => ({
      id: item.id,
      type,
      timestamp: item.timestamp,
      subscriber_email: item.subscriber_email,
      subscriber_name: item.subscriber_name?.trim() || item.subscriber_email,
      email_subject: item.email_subject,
      sequence_name: item.sequence_name,
      link_url: item.link_url,
      reason: item.reason,
      time_ago: formatTimeAgo(item.timestamp)
    }));

    // Combine all activity into a unified feed
    const allActivity = [
      ...formatActivity(opens, 'open'),
      ...formatActivity(clicks, 'click'),
      ...formatActivity(bounces, 'bounce'),
      ...formatActivity(sends, 'send'),
      ...formatActivity(unsubs, 'unsubscribe')
    ].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit * 2);

    return new Response(JSON.stringify({
      success: true,
      data: {
        recent_opens: formatActivity(opens, 'open'),
        recent_clicks: formatActivity(clicks, 'click'),
        recent_bounces: formatActivity(bounces, 'bounce'),
        recent_sends: formatActivity(sends, 'send'),
        recent_unsubscribes: formatActivity(unsubs, 'unsubscribe'),
        unified_feed: allActivity,
        stats: {
          sends: stats?.total_sent || 0,
          opens: stats?.opens || 0,
          clicks: stats?.clicks || 0,
          bounces: stats?.bounces || 0,
          unsubscribes: stats?.unsubscribes || 0
        },
        meta: {
          since: sinceTs,
          current_time: now
        }
      }
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Realtime analytics error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * Format timestamp as human-readable time ago
 */
function formatTimeAgo(timestamp) {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

export async function onRequestOptions() {
  return handleOptions();
}
