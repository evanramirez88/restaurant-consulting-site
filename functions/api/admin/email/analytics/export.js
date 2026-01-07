/**
 * Email Analytics API - CSV Export
 *
 * GET /api/admin/email/analytics/export - Export analytics data as CSV
 *
 * Query params:
 *   - sequence_id: Filter by specific sequence (optional)
 *   - start_date: Start date in YYYY-MM-DD format
 *   - end_date: End date in YYYY-MM-DD format
 */

import { verifyAuth, unauthorizedResponse, handleOptions } from '../../../../_shared/auth.js';

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
    const sequenceId = url.searchParams.get('sequence_id');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    // Default to last 30 days if no dates provided
    const now = new Date();
    const defaultEnd = now.toISOString().split('T')[0];
    const defaultStart = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];

    const start = startDate || defaultStart;
    const end = endDate || defaultEnd;

    // Convert dates to Unix timestamps
    const startTs = Math.floor(new Date(start).getTime() / 1000);
    const endTs = Math.floor(new Date(end + 'T23:59:59').getTime() / 1000);

    // Build queries for all export data
    const params = [startTs, endTs];
    let sequenceFilter = '';
    if (sequenceId) {
      sequenceFilter = ' AND sequence_id = ?';
      params.push(sequenceId);
    }

    // Get summary statistics
    const summaryQuery = `
      SELECT
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'delivered' OR status = 'sent' OR opened_at IS NOT NULL THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
        SUM(CASE WHEN bounced_at IS NOT NULL OR status = 'bounced' THEN 1 ELSE 0 END) as bounced,
        SUM(CASE WHEN status = 'unsubscribed' THEN 1 ELSE 0 END) as unsubscribed
      FROM email_logs
      WHERE created_at >= ? AND created_at <= ?${sequenceFilter}
    `;

    // Get daily breakdown
    const dailyParams = [startTs, endTs];
    if (sequenceId) dailyParams.push(sequenceId);

    const dailyQuery = `
      SELECT
        strftime('%Y-%m-%d', datetime(created_at, 'unixepoch')) as date,
        COUNT(*) as sent,
        SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
        SUM(CASE WHEN bounced_at IS NOT NULL OR status = 'bounced' THEN 1 ELSE 0 END) as bounced
      FROM email_logs
      WHERE created_at >= ? AND created_at <= ?${sequenceFilter}
      GROUP BY strftime('%Y-%m-%d', datetime(created_at, 'unixepoch'))
      ORDER BY date ASC
    `;

    // Get by sequence breakdown (if not filtered to single sequence)
    let sequenceBreakdown = [];
    if (!sequenceId) {
      const seqParams = [startTs, endTs];
      const seqQuery = `
        SELECT
          es.name as sequence_name,
          COUNT(*) as sent,
          SUM(CASE WHEN el.opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
          SUM(CASE WHEN el.clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
          SUM(CASE WHEN el.bounced_at IS NOT NULL OR el.status = 'bounced' THEN 1 ELSE 0 END) as bounced
        FROM email_logs el
        LEFT JOIN email_sequences es ON el.sequence_id = es.id
        WHERE el.created_at >= ? AND el.created_at <= ?
        GROUP BY el.sequence_id
        ORDER BY sent DESC
      `;
      const seqResult = await db.prepare(seqQuery).bind(...seqParams).all();
      sequenceBreakdown = seqResult.results || [];
    }

    // Execute queries
    const [summaryResult, dailyResult] = await Promise.all([
      db.prepare(summaryQuery).bind(...params).first(),
      db.prepare(dailyQuery).bind(...dailyParams).all()
    ]);

    const summary = summaryResult || {};
    const dailyData = dailyResult.results || [];

    // Build CSV content
    let csv = '';

    // Summary Section
    csv += 'EMAIL ANALYTICS EXPORT\n';
    csv += `Report Period,${start} to ${end}\n`;
    csv += `Generated,${new Date().toISOString()}\n`;
    if (sequenceId) {
      csv += `Sequence Filter,${sequenceId}\n`;
    }
    csv += '\n';

    // Summary Stats
    csv += 'SUMMARY STATISTICS\n';
    csv += 'Metric,Value,Rate\n';
    csv += `Total Sent,${summary.total_sent || 0},\n`;
    csv += `Delivered,${summary.delivered || 0},${summary.total_sent > 0 ? ((summary.delivered / summary.total_sent) * 100).toFixed(2) + '%' : '0%'}\n`;
    csv += `Opened,${summary.opened || 0},${summary.total_sent > 0 ? ((summary.opened / summary.total_sent) * 100).toFixed(2) + '%' : '0%'}\n`;
    csv += `Clicked,${summary.clicked || 0},${summary.total_sent > 0 ? ((summary.clicked / summary.total_sent) * 100).toFixed(2) + '%' : '0%'}\n`;
    csv += `Bounced,${summary.bounced || 0},${summary.total_sent > 0 ? ((summary.bounced / summary.total_sent) * 100).toFixed(2) + '%' : '0%'}\n`;
    csv += `Unsubscribed,${summary.unsubscribed || 0},${summary.total_sent > 0 ? ((summary.unsubscribed / summary.total_sent) * 100).toFixed(2) + '%' : '0%'}\n`;
    csv += '\n';

    // Daily Breakdown
    csv += 'DAILY BREAKDOWN\n';
    csv += 'Date,Sent,Opened,Clicked,Bounced,Open Rate,Click Rate\n';
    for (const day of dailyData) {
      const openRate = day.sent > 0 ? ((day.opened / day.sent) * 100).toFixed(2) + '%' : '0%';
      const clickRate = day.sent > 0 ? ((day.clicked / day.sent) * 100).toFixed(2) + '%' : '0%';
      csv += `${day.date},${day.sent},${day.opened},${day.clicked},${day.bounced},${openRate},${clickRate}\n`;
    }
    csv += '\n';

    // Sequence Breakdown (if not filtered)
    if (sequenceBreakdown.length > 0) {
      csv += 'BY SEQUENCE\n';
      csv += 'Sequence,Sent,Opened,Clicked,Bounced,Open Rate,Click Rate\n';
      for (const seq of sequenceBreakdown) {
        const openRate = seq.sent > 0 ? ((seq.opened / seq.sent) * 100).toFixed(2) + '%' : '0%';
        const clickRate = seq.sent > 0 ? ((seq.clicked / seq.sent) * 100).toFixed(2) + '%' : '0%';
        const seqName = (seq.sequence_name || 'Unknown').replace(/,/g, ';');
        csv += `"${seqName}",${seq.sent},${seq.opened},${seq.clicked},${seq.bounced},${openRate},${clickRate}\n`;
      }
    }

    // Create filename
    const filename = `email_analytics_${start}_${end}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  } catch (error) {
    console.error('Export GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
