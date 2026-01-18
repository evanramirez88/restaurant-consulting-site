/**
 * Daily Briefing / Command Center API
 *
 * GET /api/admin/briefing - Get daily briefing data
 *
 * Aggregates data from across the platform:
 * - New leads and conversions
 * - Pending tickets
 * - Email sequence activity
 * - Upcoming bookings
 * - Stale/lingering items
 * - Toast Hub updates
 * - Intelligence findings
 */

import { verifyAuth, unauthorizedResponse, getCorsOrigin, handleOptions } from '../../_shared/auth.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

/**
 * GET /api/admin/briefing
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    // Verify admin auth
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;
    const oneWeekAgo = now - 604800;
    const threeDaysAgo = now - 259200;

    // Parallel fetch all briefing data
    const [
      newLeads,
      leadsNeedingAction,
      pendingTickets,
      openTickets,
      emailStats,
      failedEmails,
      upcomingBookings,
      recentQuotes,
      clientActivity,
      staleLeads,
      recentConversions,
      toastHubUpdates,
      intelligenceFindings
    ] = await Promise.all([
      // New leads in last 24 hours
      env.DB.prepare(`
        SELECT COUNT(*) as count FROM restaurant_leads
        WHERE created_at > ?
      `).bind(oneDayAgo).first(),

      // Leads needing action (contacted but not followed up)
      env.DB.prepare(`
        SELECT COUNT(*) as count FROM restaurant_leads
        WHERE status = 'contacted' AND updated_at < ?
      `).bind(threeDaysAgo).first(),

      // Pending tickets
      env.DB.prepare(`
        SELECT COUNT(*) as count FROM tickets
        WHERE status IN ('pending', 'open') AND visibility = 'client'
      `).first().catch(() => ({ count: 0 })),

      // Open tickets (for detail)
      env.DB.prepare(`
        SELECT id, subject, priority, status, created_at, client_id
        FROM tickets
        WHERE status IN ('pending', 'open', 'in_progress')
        ORDER BY
          CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
          created_at ASC
        LIMIT 5
      `).all().catch(() => ({ results: [] })),

      // Email stats (last 24h)
      env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN first_opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened
        FROM email_logs
        WHERE created_at > ?
      `).bind(oneDayAgo).first().catch(() => ({ total: 0, sent: 0, delivered: 0, failed: 0, opened: 0 })),

      // Failed emails needing attention
      env.DB.prepare(`
        SELECT email_to, subject, failure_message, created_at
        FROM email_logs
        WHERE status = 'failed' AND created_at > ?
        ORDER BY created_at DESC
        LIMIT 5
      `).bind(oneWeekAgo).all().catch(() => ({ results: [] })),

      // Upcoming bookings (next 7 days)
      env.DB.prepare(`
        SELECT id, email, name, title, start_time, status
        FROM scheduled_bookings
        WHERE status = 'confirmed' AND start_time > datetime('now')
        ORDER BY start_time ASC
        LIMIT 5
      `).all().catch(() => ({ results: [] })),

      // Recent quote requests (last 7 days)
      env.DB.prepare(`
        SELECT id, name, email, restaurant_name, status, created_at
        FROM quote_requests
        WHERE created_at > ? AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 5
      `).bind(oneWeekAgo).all().catch(() => ({ results: [] })),

      // Recent client activity
      env.DB.prepare(`
        SELECT COUNT(DISTINCT client_id) as active_clients
        FROM tickets
        WHERE created_at > ?
      `).bind(oneWeekAgo).first().catch(() => ({ active_clients: 0 })),

      // Stale leads (not updated in 30 days, still prospect)
      env.DB.prepare(`
        SELECT COUNT(*) as count FROM restaurant_leads
        WHERE status = 'prospect' AND updated_at < ?
      `).bind(now - 2592000).first(),

      // Recent conversions
      env.DB.prepare(`
        SELECT rl.name, rl.converted_to_client_id, rl.updated_at
        FROM restaurant_leads rl
        WHERE rl.status = 'client' AND rl.updated_at > ?
        ORDER BY rl.updated_at DESC
        LIMIT 5
      `).bind(oneWeekAgo).all().catch(() => ({ results: [] })),

      // Toast Hub updates (latest Beacon content)
      env.DB.prepare(`
        SELECT id, title, source_name, category, published_at
        FROM beacon_content_items
        WHERE status = 'approved'
        ORDER BY published_at DESC
        LIMIT 5
      `).all().catch(() => ({ results: [] })),

      // Intelligence findings (agent tasks)
      env.DB.prepare(`
        SELECT id, agent_name, task_type, status, result_summary, completed_at
        FROM intelligence_tasks
        WHERE completed_at > ?
        ORDER BY completed_at DESC
        LIMIT 5
      `).bind(oneDayAgo).all().catch(() => ({ results: [] }))
    ]);

    // Build priority action items
    const actionItems = [];

    // Critical: Failed emails
    if ((emailStats?.failed || 0) > 0) {
      actionItems.push({
        priority: 'critical',
        category: 'email',
        title: `${emailStats.failed} emails failed to send`,
        description: 'Check Resend domain verification',
        action: '/admin?tab=email&subtab=errors'
      });
    }

    // High: Pending quotes
    if ((recentQuotes?.results?.length || 0) > 0) {
      actionItems.push({
        priority: 'high',
        category: 'sales',
        title: `${recentQuotes.results.length} quote requests pending`,
        description: 'Review and respond to quote requests',
        action: '/admin?tab=overview'
      });
    }

    // High: Urgent tickets
    const urgentTickets = (openTickets?.results || []).filter(t => t.priority === 'urgent' || t.priority === 'high');
    if (urgentTickets.length > 0) {
      actionItems.push({
        priority: 'high',
        category: 'support',
        title: `${urgentTickets.length} high-priority tickets`,
        description: 'Urgent support requests need attention',
        action: '/admin?tab=tickets'
      });
    }

    // Medium: Leads needing follow-up
    if ((leadsNeedingAction?.count || 0) > 0) {
      actionItems.push({
        priority: 'medium',
        category: 'leads',
        title: `${leadsNeedingAction.count} leads need follow-up`,
        description: 'Contacted leads with no recent activity',
        action: '/admin?tab=contacts&subtab=leads'
      });
    }

    // Low: Stale leads
    if ((staleLeads?.count || 0) > 10) {
      actionItems.push({
        priority: 'low',
        category: 'leads',
        title: `${staleLeads.count} stale leads`,
        description: 'Prospects not updated in 30+ days',
        action: '/admin?tab=contacts&subtab=leads'
      });
    }

    // Generate today's date string
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return new Response(JSON.stringify({
      success: true,
      generatedAt: now,
      date: dateStr,
      summary: {
        newLeads: newLeads?.count || 0,
        leadsNeedingAction: leadsNeedingAction?.count || 0,
        pendingTickets: pendingTickets?.count || 0,
        emailsSent: emailStats?.sent || 0,
        emailsFailed: emailStats?.failed || 0,
        emailsOpened: emailStats?.opened || 0,
        activeClients: clientActivity?.active_clients || 0,
        staleLeads: staleLeads?.count || 0
      },
      actionItems,
      details: {
        openTickets: openTickets?.results || [],
        failedEmails: failedEmails?.results || [],
        upcomingBookings: upcomingBookings?.results || [],
        pendingQuotes: recentQuotes?.results || [],
        recentConversions: recentConversions?.results || [],
        toastHubUpdates: toastHubUpdates?.results || [],
        intelligenceFindings: intelligenceFindings?.results || []
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Briefing error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
