// Business Brief Pulse API - Real-time business health monitoring
// GET: Returns all pulse metrics (revenue, pipeline, operations, market)

import { verifyAuth, unauthorizedResponse, getCorsOrigin, handleOptions } from '../../../_shared/auth.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}

export async function onRequestGet(context) {
  const { env, request } = context;

  // Verify authentication
  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error, request);
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const todayStart = now - (now % 86400); // Start of today UTC
    const thirtyDaysAgo = now - (30 * 86400);
    const ninetyDaysAgo = now - (90 * 86400);

    // Parallel fetch all pulse data
    const [
      // Revenue metrics
      stripeSubscriptions,
      stripePayments,
      squareInvoices,
      recentChurn,

      // Pipeline metrics
      leadFunnel,
      quotesByStatus,
      recentConversions,

      // Operations metrics
      ticketMetrics,
      automationJobs,
      emailQueue,
      emailsSentToday,
      portalSessions,

      // Market metrics
      leadStats,
      segmentPerformance,
      beaconContent
    ] = await Promise.all([
      // Stripe subscriptions (MRR/ARR)
      env.DB.prepare(`
        SELECT
          COUNT(*) as active_count,
          COALESCE(SUM(CASE WHEN billing_interval = 'month' THEN amount ELSE amount / 12 END), 0) as mrr
        FROM stripe_subscriptions
        WHERE status = 'active'
      `).first().catch(() => ({ active_count: 0, mrr: 0 })),

      // Stripe payments last 30 days
      env.DB.prepare(`
        SELECT
          COALESCE(SUM(amount), 0) as total,
          COUNT(*) as count
        FROM stripe_events
        WHERE event_type = 'payment_intent.succeeded'
        AND created_at > ?
      `).bind(thirtyDaysAgo).first().catch(() => ({ total: 0, count: 0 })),

      // Square invoices
      env.DB.prepare(`
        SELECT
          COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_count,
          COUNT(CASE WHEN status = 'UNPAID' THEN 1 END) as pending_count,
          COALESCE(SUM(CASE WHEN status = 'PAID' AND created_at > ? THEN total END), 0) as paid_last_30
        FROM invoices
        WHERE created_at > ?
      `).bind(thirtyDaysAgo, ninetyDaysAgo).first().catch(() => ({ paid_count: 0, pending_count: 0, paid_last_30: 0 })),

      // Churn - canceled subscriptions last 30 days
      env.DB.prepare(`
        SELECT COUNT(*) as churned
        FROM stripe_subscriptions
        WHERE status = 'canceled'
        AND updated_at > ?
      `).bind(thirtyDaysAgo).first().catch(() => ({ churned: 0 })),

      // Lead funnel counts
      env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'new' OR status IS NULL THEN 1 END) as prospects,
          COUNT(CASE WHEN status = 'lead' THEN 1 END) as leads,
          COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified,
          COUNT(CASE WHEN status = 'opportunity' THEN 1 END) as opportunities,
          COUNT(CASE WHEN status = 'client' OR status = 'converted' THEN 1 END) as clients
        FROM restaurant_leads
      `).first().catch(() => ({ total: 0, prospects: 0, leads: 0, qualified: 0, opportunities: 0, clients: 0 })),

      // Quotes by status
      env.DB.prepare(`
        SELECT
          status,
          COUNT(*) as count,
          COALESCE(SUM(total_amount), 0) as value
        FROM quotes
        GROUP BY status
      `).all().catch(() => ({ results: [] })),

      // Recent conversions (last 30 days)
      env.DB.prepare(`
        SELECT
          COUNT(*) as count,
          COALESCE(SUM(q.total_amount), 0) as value
        FROM quotes q
        WHERE q.status = 'accepted'
        AND q.updated_at > ?
      `).bind(thirtyDaysAgo).first().catch(() => ({ count: 0, value: 0 })),

      // Ticket metrics
      env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'open' THEN 1 END) as open,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'resolved' AND resolved_at > ? THEN 1 END) as resolved_today,
          COUNT(CASE WHEN priority IN ('high', 'urgent', 'critical') AND status != 'resolved' THEN 1 END) as urgent,
          AVG(CASE WHEN status != 'resolved' THEN (? - created_at) / 3600.0 END) as avg_age_hours
        FROM tickets
        WHERE created_at > ?
      `).bind(todayStart, now, ninetyDaysAgo).first().catch(() => ({
        total: 0, open: 0, in_progress: 0, resolved_today: 0, urgent: 0, avg_age_hours: 0
      })),

      // Automation job health
      env.DB.prepare(`
        SELECT
          COUNT(*) as total_jobs,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          COUNT(CASE WHEN status = 'pending' OR status = 'queued' THEN 1 END) as queued
        FROM automation_jobs
        WHERE created_at > ?
      `).bind(todayStart).first().catch(() => ({ total_jobs: 0, completed: 0, failed: 0, queued: 0 })),

      // Email queue depth
      env.DB.prepare(`
        SELECT COUNT(*) as queued
        FROM email_queue
        WHERE status = 'pending'
      `).first().catch(() => ({ queued: 0 })),

      // Emails sent today
      env.DB.prepare(`
        SELECT
          COUNT(*) as sent,
          COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced,
          COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened
        FROM email_queue
        WHERE sent_at > ?
        AND status IN ('sent', 'delivered', 'bounced', 'opened')
      `).bind(todayStart).first().catch(() => ({ sent: 0, bounced: 0, opened: 0 })),

      // Portal sessions (approximate from activity)
      env.DB.prepare(`
        SELECT
          COUNT(DISTINCT CASE WHEN portal_type = 'client' THEN user_id END) as client_logins,
          COUNT(DISTINCT CASE WHEN portal_type = 'rep' THEN user_id END) as rep_logins
        FROM portal_activity_log
        WHERE created_at > ?
      `).bind(todayStart).first().catch(() => ({ client_logins: 0, rep_logins: 0 })),

      // Lead database stats
      env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as with_email,
          COUNT(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 END) as with_phone,
          COUNT(CASE WHEN lead_score >= 80 THEN 1 END) as hot_leads,
          COUNT(CASE WHEN enriched_at > ? THEN 1 END) as enriched_30d
        FROM restaurant_leads
      `).bind(thirtyDaysAgo).first().catch(() => ({
        total: 0, with_email: 0, with_phone: 0, hot_leads: 0, enriched_30d: 0
      })),

      // Segment performance
      env.DB.prepare(`
        SELECT
          ls.name,
          ls.segment_key,
          COUNT(lsm.lead_id) as lead_count,
          AVG(rl.lead_score) as avg_score
        FROM lead_segments ls
        LEFT JOIN lead_segment_members lsm ON ls.id = lsm.segment_id
        LEFT JOIN restaurant_leads rl ON lsm.lead_id = rl.id
        GROUP BY ls.id, ls.name, ls.segment_key
        ORDER BY lead_count DESC
        LIMIT 10
      `).all().catch(() => ({ results: [] })),

      // Beacon content stats
      env.DB.prepare(`
        SELECT
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
          COUNT(CASE WHEN status = 'published' THEN 1 END) as published,
          COUNT(CASE WHEN created_at > ? THEN 1 END) as new_today
        FROM beacon_items
      `).bind(todayStart).first().catch(() => ({ pending: 0, approved: 0, published: 0, new_today: 0 }))
    ]);

    // Calculate MRR/ARR
    const mrr = stripeSubscriptions?.mrr || 0;
    const arr = mrr * 12;

    // Calculate churn rate
    const activeSubscriptions = stripeSubscriptions?.active_count || 0;
    const churnedCount = recentChurn?.churned || 0;
    const churnRate = activeSubscriptions > 0
      ? ((churnedCount / (activeSubscriptions + churnedCount)) * 100).toFixed(1)
      : 0;

    // Process quotes by status
    const quoteStatusMap = {};
    (quotesByStatus?.results || []).forEach(q => {
      quoteStatusMap[q.status || 'draft'] = { count: q.count, value: q.value };
    });

    // Calculate conversion rates
    const totalQuotes = Object.values(quoteStatusMap).reduce((sum, q) => sum + q.count, 0);
    const acceptedQuotes = quoteStatusMap['accepted']?.count || 0;
    const quoteToCloseRate = totalQuotes > 0 ? ((acceptedQuotes / totalQuotes) * 100).toFixed(1) : 0;

    // Automation success rate
    const automationTotal = automationJobs?.total_jobs || 0;
    const automationCompleted = automationJobs?.completed || 0;
    const automationSuccessRate = automationTotal > 0
      ? ((automationCompleted / automationTotal) * 100).toFixed(1)
      : 100;

    // Email metrics
    const emailsSent = emailsSentToday?.sent || 0;
    const emailsBounced = emailsSentToday?.bounced || 0;
    const emailsOpened = emailsSentToday?.opened || 0;
    const bounceRate = emailsSent > 0 ? ((emailsBounced / emailsSent) * 100).toFixed(1) : 0;
    const openRate = emailsSent > 0 ? ((emailsOpened / emailsSent) * 100).toFixed(1) : 0;

    // Build pulse response
    const pulse = {
      timestamp: now,
      lastUpdated: new Date().toISOString(),

      revenue: {
        mrr: mrr,
        arr: arr,
        mrrFormatted: formatCurrency(mrr),
        arrFormatted: formatCurrency(arr),
        churnRate: parseFloat(churnRate),
        activeSubscriptions: activeSubscriptions,

        // Last 30 days
        stripeRevenue30d: (stripePayments?.total || 0) / 100, // Convert from cents
        squareRevenue30d: squareInvoices?.paid_last_30 || 0,
        totalRevenue30d: ((stripePayments?.total || 0) / 100) + (squareInvoices?.paid_last_30 || 0),

        // By service line (would need more detailed data)
        byServiceLine: {
          toastGuardian: { active: 0, mrr: 0 },
          networkSupport: { active: 0, mrr: 0 },
          projectWork: {
            revenue: squareInvoices?.paid_last_30 || 0,
            pending: (squareInvoices?.pending_count || 0)
          }
        },

        // Projections (simple linear)
        projected30Day: mrr + ((stripePayments?.total || 0) / 100) * 0.1,
        projected90Day: (mrr * 3) + ((stripePayments?.total || 0) / 100) * 0.3
      },

      pipeline: {
        funnel: {
          prospects: leadFunnel?.prospects || leadFunnel?.total || 0,
          leads: leadFunnel?.leads || 0,
          qualified: leadFunnel?.qualified || 0,
          opportunities: leadFunnel?.opportunities || 0,
          clients: leadFunnel?.clients || 0
        },

        quotes: {
          draft: quoteStatusMap['draft'] || { count: 0, value: 0 },
          sent: quoteStatusMap['sent'] || { count: 0, value: 0 },
          viewed: quoteStatusMap['viewed'] || { count: 0, value: 0 },
          accepted: quoteStatusMap['accepted'] || { count: 0, value: 0 },
          declined: quoteStatusMap['declined'] || { count: 0, value: 0 },
          expired: quoteStatusMap['expired'] || { count: 0, value: 0 }
        },

        // Conversion metrics
        leadToQuoteRate: 0, // Would need historical tracking
        quoteToCloseRate: parseFloat(quoteToCloseRate),
        avgSalesCycle: 0, // Would need timestamp tracking
        avgDealSize: acceptedQuotes > 0
          ? (quoteStatusMap['accepted']?.value || 0) / acceptedQuotes
          : 0,

        // Recent activity
        recentConversions: {
          count: recentConversions?.count || 0,
          value: recentConversions?.value || 0
        }
      },

      operations: {
        tickets: {
          total: ticketMetrics?.total || 0,
          open: ticketMetrics?.open || 0,
          inProgress: ticketMetrics?.in_progress || 0,
          resolvedToday: ticketMetrics?.resolved_today || 0,
          urgent: ticketMetrics?.urgent || 0,
          avgAgeHours: Math.round(ticketMetrics?.avg_age_hours || 0),
          slaBreaches: 0 // Would need SLA tracking
        },

        automation: {
          jobsToday: automationTotal,
          completed: automationCompleted,
          failed: automationJobs?.failed || 0,
          queued: automationJobs?.queued || 0,
          successRate: parseFloat(automationSuccessRate)
        },

        email: {
          queueDepth: emailQueue?.queued || 0,
          sentToday: emailsSent,
          bounceRate: parseFloat(bounceRate),
          openRate: parseFloat(openRate),
          deliverabilityScore: 100 - parseFloat(bounceRate)
        },

        portals: {
          clientLoginsToday: portalSessions?.client_logins || 0,
          repLoginsToday: portalSessions?.rep_logins || 0,
          activeClientSessions: 0, // Would need real-time tracking
          activeRepSessions: 0
        }
      },

      market: {
        leads: {
          total: leadStats?.total || 0,
          withValidEmail: leadStats?.with_email || 0,
          withValidPhone: leadStats?.with_phone || 0,
          hotLeads: leadStats?.hot_leads || 0,
          enrichedLast30Days: leadStats?.enriched_30d || 0,
          emailCoverage: leadStats?.total > 0
            ? ((leadStats.with_email / leadStats.total) * 100).toFixed(1)
            : 0,
          phoneCoverage: leadStats?.total > 0
            ? ((leadStats.with_phone / leadStats.total) * 100).toFixed(1)
            : 0
        },

        segments: (segmentPerformance?.results || []).map(s => ({
          name: s.name,
          key: s.segment_key,
          count: s.lead_count || 0,
          avgScore: Math.round(s.avg_score || 0)
        })),

        beacon: {
          pendingReview: beaconContent?.pending || 0,
          approved: beaconContent?.approved || 0,
          published: beaconContent?.published || 0,
          newToday: beaconContent?.new_today || 0
        }
      }
    };

    return new Response(JSON.stringify({
      success: true,
      ...pulse
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Pulse API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}
