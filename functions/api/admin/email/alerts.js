/**
 * Email Alerts API
 *
 * GET /api/admin/email/alerts - Check for alert conditions
 * POST /api/admin/email/alerts - Configure alert thresholds
 *
 * Monitors:
 * - Bounce rate spikes
 * - Spam complaint rate
 * - Delivery failures
 * - High-value lead engagement
 * - Unsubscribe rate
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

// Default alert thresholds
const DEFAULT_THRESHOLDS = {
  bounce_rate_warning: 2.0,    // 2% bounce rate triggers warning
  bounce_rate_critical: 5.0,   // 5% bounce rate triggers critical
  complaint_rate_warning: 0.1, // 0.1% spam complaint triggers warning
  complaint_rate_critical: 0.3, // 0.3% triggers critical (industry standard)
  failure_rate_warning: 5.0,   // 5% failure rate
  failure_rate_critical: 10.0, // 10% failure rate
  unsubscribe_rate_warning: 2.0, // 2% unsubscribe rate
  high_value_engagement_score: 50 // Engagement score threshold for high-value alerts
};

/**
 * GET /api/admin/email/alerts
 * Check current alert conditions
 *
 * Query params:
 *   - hours: Time window in hours (default: 24)
 *   - include_resolved: Include resolved alerts (default: false)
 */
export async function onRequestGet(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const url = new URL(context.request.url);

    const hours = parseInt(url.searchParams.get('hours') || '24');
    const includeResolved = url.searchParams.get('include_resolved') === 'true';

    const now = Math.floor(Date.now() / 1000);
    const startTs = now - (hours * 3600);

    // Get email metrics for the time window
    const metricsQuery = `
      SELECT
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'bounced' OR bounced_at IS NOT NULL THEN 1 ELSE 0 END) as bounced,
        SUM(CASE WHEN status = 'complained' OR complained_at IS NOT NULL THEN 1 ELSE 0 END) as complained,
        SUM(CASE WHEN status IN ('failed', 'rejected') THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked
      FROM email_logs
      WHERE created_at >= ?
    `;

    const metrics = await db.prepare(metricsQuery).bind(startTs).first();

    // Get unsubscribe count
    const unsubQuery = `
      SELECT COUNT(*) as count
      FROM subscriber_sequences
      WHERE status = 'unsubscribed' AND cancelled_at >= ?
    `;
    const unsubs = await db.prepare(unsubQuery).bind(startTs).first();

    // Calculate rates
    const totalSent = metrics?.total_sent || 0;
    const bounceRate = totalSent > 0 ? (metrics.bounced / totalSent) * 100 : 0;
    const complaintRate = totalSent > 0 ? (metrics.complained / totalSent) * 100 : 0;
    const failureRate = totalSent > 0 ? (metrics.failed / totalSent) * 100 : 0;
    const unsubRate = totalSent > 0 ? ((unsubs?.count || 0) / totalSent) * 100 : 0;

    // Build alerts array
    const alerts = [];

    // Bounce rate alerts
    if (bounceRate >= DEFAULT_THRESHOLDS.bounce_rate_critical) {
      alerts.push({
        id: `bounce_critical_${now}`,
        type: 'bounce_rate',
        severity: 'critical',
        title: 'Critical: High Bounce Rate',
        message: `Bounce rate is ${bounceRate.toFixed(2)}% (threshold: ${DEFAULT_THRESHOLDS.bounce_rate_critical}%). This can damage sender reputation. Review email list quality immediately.`,
        metric_value: bounceRate,
        threshold: DEFAULT_THRESHOLDS.bounce_rate_critical,
        created_at: now,
        actions: [
          { label: 'View Bounced Emails', url: '/admin/email/errors?status=bounced' },
          { label: 'Review Suppression List', url: '/admin/email/suppression' }
        ]
      });
    } else if (bounceRate >= DEFAULT_THRESHOLDS.bounce_rate_warning) {
      alerts.push({
        id: `bounce_warning_${now}`,
        type: 'bounce_rate',
        severity: 'warning',
        title: 'Warning: Elevated Bounce Rate',
        message: `Bounce rate is ${bounceRate.toFixed(2)}% (threshold: ${DEFAULT_THRESHOLDS.bounce_rate_warning}%). Consider cleaning email list.`,
        metric_value: bounceRate,
        threshold: DEFAULT_THRESHOLDS.bounce_rate_warning,
        created_at: now,
        actions: [
          { label: 'View Bounced Emails', url: '/admin/email/errors?status=bounced' }
        ]
      });
    }

    // Complaint rate alerts
    if (complaintRate >= DEFAULT_THRESHOLDS.complaint_rate_critical) {
      alerts.push({
        id: `complaint_critical_${now}`,
        type: 'complaint_rate',
        severity: 'critical',
        title: 'Critical: Spam Complaints',
        message: `Spam complaint rate is ${complaintRate.toFixed(3)}% (threshold: ${DEFAULT_THRESHOLDS.complaint_rate_critical}%). Risk of being blocklisted. Pause email campaigns.`,
        metric_value: complaintRate,
        threshold: DEFAULT_THRESHOLDS.complaint_rate_critical,
        created_at: now,
        actions: [
          { label: 'View Complaints', url: '/admin/email/errors?status=complained' },
          { label: 'Pause All Sequences', url: '/admin/email/sequences' }
        ]
      });
    } else if (complaintRate >= DEFAULT_THRESHOLDS.complaint_rate_warning) {
      alerts.push({
        id: `complaint_warning_${now}`,
        type: 'complaint_rate',
        severity: 'warning',
        title: 'Warning: Spam Complaints Detected',
        message: `Spam complaint rate is ${complaintRate.toFixed(3)}% (threshold: ${DEFAULT_THRESHOLDS.complaint_rate_warning}%). Review email content and targeting.`,
        metric_value: complaintRate,
        threshold: DEFAULT_THRESHOLDS.complaint_rate_warning,
        created_at: now,
        actions: [
          { label: 'View Complaints', url: '/admin/email/errors?status=complained' }
        ]
      });
    }

    // Failure rate alerts
    if (failureRate >= DEFAULT_THRESHOLDS.failure_rate_critical) {
      alerts.push({
        id: `failure_critical_${now}`,
        type: 'failure_rate',
        severity: 'critical',
        title: 'Critical: High Email Failure Rate',
        message: `${failureRate.toFixed(2)}% of emails are failing to send. Check email service configuration.`,
        metric_value: failureRate,
        threshold: DEFAULT_THRESHOLDS.failure_rate_critical,
        created_at: now,
        actions: [
          { label: 'View Failed Emails', url: '/admin/email/errors?status=failed' },
          { label: 'Check Resend Status', url: 'https://resend.com/dashboard' }
        ]
      });
    } else if (failureRate >= DEFAULT_THRESHOLDS.failure_rate_warning) {
      alerts.push({
        id: `failure_warning_${now}`,
        type: 'failure_rate',
        severity: 'warning',
        title: 'Warning: Elevated Email Failures',
        message: `${failureRate.toFixed(2)}% of emails are failing. Review error logs.`,
        metric_value: failureRate,
        threshold: DEFAULT_THRESHOLDS.failure_rate_warning,
        created_at: now,
        actions: [
          { label: 'View Failed Emails', url: '/admin/email/errors?status=failed' }
        ]
      });
    }

    // Unsubscribe rate alerts
    if (unsubRate >= DEFAULT_THRESHOLDS.unsubscribe_rate_warning) {
      alerts.push({
        id: `unsub_warning_${now}`,
        type: 'unsubscribe_rate',
        severity: 'warning',
        title: 'Warning: High Unsubscribe Rate',
        message: `${unsubRate.toFixed(2)}% unsubscribe rate. Review email content, frequency, and targeting.`,
        metric_value: unsubRate,
        threshold: DEFAULT_THRESHOLDS.unsubscribe_rate_warning,
        created_at: now,
        actions: [
          { label: 'View Unsubscribes', url: '/admin/email/subscribers?status=unsubscribed' }
        ]
      });
    }

    // Get high-value lead engagement alerts
    const highValueQuery = `
      SELECT
        es.id,
        es.email,
        es.first_name,
        es.company,
        es.engagement_score,
        es.last_email_clicked_at,
        eq.name as sequence_name
      FROM email_subscribers es
      LEFT JOIN subscriber_sequences ss ON es.id = ss.subscriber_id AND ss.status = 'active'
      LEFT JOIN email_sequences eq ON ss.sequence_id = eq.id
      WHERE es.engagement_score >= ?
        AND es.last_email_clicked_at >= ?
        AND es.converted_at IS NULL
      ORDER BY es.engagement_score DESC, es.last_email_clicked_at DESC
      LIMIT 10
    `;

    const { results: highValueLeads } = await db.prepare(highValueQuery)
      .bind(DEFAULT_THRESHOLDS.high_value_engagement_score, startTs)
      .all();

    if (highValueLeads && highValueLeads.length > 0) {
      alerts.push({
        id: `high_value_${now}`,
        type: 'high_value_engagement',
        severity: 'info',
        title: `${highValueLeads.length} High-Value Leads Engaged`,
        message: `${highValueLeads.length} leads with high engagement scores have clicked emails recently. Consider immediate follow-up.`,
        leads: highValueLeads.map(l => ({
          id: l.id,
          email: l.email,
          name: l.first_name,
          company: l.company,
          engagement_score: l.engagement_score,
          sequence: l.sequence_name,
          last_clicked: l.last_email_clicked_at
        })),
        created_at: now,
        actions: [
          { label: 'View High-Value Leads', url: '/admin/leads?sort=engagement_score&order=desc' }
        ]
      });
    }

    // Sort alerts by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return new Response(JSON.stringify({
      success: true,
      data: {
        alerts,
        metrics: {
          total_sent: totalSent,
          bounced: metrics?.bounced || 0,
          complained: metrics?.complained || 0,
          failed: metrics?.failed || 0,
          unsubscribed: unsubs?.count || 0,
          bounce_rate: parseFloat(bounceRate.toFixed(3)),
          complaint_rate: parseFloat(complaintRate.toFixed(4)),
          failure_rate: parseFloat(failureRate.toFixed(3)),
          unsubscribe_rate: parseFloat(unsubRate.toFixed(3))
        },
        thresholds: DEFAULT_THRESHOLDS,
        meta: {
          hours,
          checked_at: now
        }
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Alerts GET error:', error);
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
 * POST /api/admin/email/alerts
 * Configure alert thresholds (stored in KV)
 */
export async function onRequestPost(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const body = await context.request.json();
    const { thresholds } = body;

    if (!thresholds || typeof thresholds !== 'object') {
      return new Response(JSON.stringify({
        success: false,
        error: 'thresholds object is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate threshold values
    const validKeys = Object.keys(DEFAULT_THRESHOLDS);
    const invalidKeys = Object.keys(thresholds).filter(k => !validKeys.includes(k));

    if (invalidKeys.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid threshold keys: ${invalidKeys.join(', ')}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Store in KV if available
    if (context.env.RATE_LIMIT_KV) {
      const merged = { ...DEFAULT_THRESHOLDS, ...thresholds };
      await context.env.RATE_LIMIT_KV.put('email_alert_thresholds', JSON.stringify(merged));
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        thresholds: { ...DEFAULT_THRESHOLDS, ...thresholds },
        message: 'Alert thresholds updated'
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Alerts POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
