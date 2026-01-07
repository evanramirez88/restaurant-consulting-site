/**
 * Send Queue API
 *
 * GET /api/admin/email/send-times/queue - Get upcoming scheduled emails
 *
 * Query params:
 *   - hours: Number of hours to look ahead (default: 24, max: 168 for 7 days)
 *   - sequence_id: Filter by sequence (optional)
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
    const hours = Math.min(parseInt(url.searchParams.get('hours') || '24'), 168);
    const sequenceId = url.searchParams.get('sequence_id');

    const now = Math.floor(Date.now() / 1000);
    const endTs = now + (hours * 3600);

    // Build query for scheduled emails
    let query = `
      SELECT
        se.id,
        se.scheduled_at,
        es.email as subscriber_email,
        es.first_name || ' ' || COALESCE(es.last_name, '') as subscriber_name,
        eq.name as sequence_name,
        st.subject as step_subject,
        st.id as step_id
      FROM scheduled_emails se
      JOIN email_subscribers es ON se.subscriber_id = es.id
      JOIN email_sequences eq ON se.sequence_id = eq.id
      JOIN sequence_steps st ON se.step_id = st.id
      WHERE se.scheduled_at >= ? AND se.scheduled_at <= ?
        AND se.status = 'pending'
    `;

    const params = [now, endTs];

    if (sequenceId) {
      query += ' AND se.sequence_id = ?';
      params.push(sequenceId);
    }

    query += ' ORDER BY se.scheduled_at ASC LIMIT 100';

    // Execute query
    const { results: emails } = await db.prepare(query).bind(...params).all();

    // Get stats
    const stats24h = await db.prepare(`
      SELECT COUNT(*) as count FROM scheduled_emails
      WHERE scheduled_at >= ? AND scheduled_at <= ? AND status = 'pending'
    `).bind(now, now + 86400).first();

    const stats7d = await db.prepare(`
      SELECT COUNT(*) as count FROM scheduled_emails
      WHERE scheduled_at >= ? AND scheduled_at <= ? AND status = 'pending'
    `).bind(now, now + 604800).first();

    // Get hourly distribution for the requested timeframe
    const distributionQuery = `
      SELECT
        CAST(strftime('%H', datetime(scheduled_at, 'unixepoch')) AS INTEGER) as hour,
        COUNT(*) as count
      FROM scheduled_emails
      WHERE scheduled_at >= ? AND scheduled_at <= ? AND status = 'pending'
      GROUP BY hour
      ORDER BY hour ASC
    `;

    const { results: distribution } = await db.prepare(distributionQuery).bind(now, endTs).all();

    // Fill in missing hours
    const hourlyDistribution = [];
    for (let h = 0; h < 24; h++) {
      const hourData = distribution?.find(d => d.hour === h);
      hourlyDistribution.push({
        hour: h,
        count: hourData?.count || 0
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        emails: (emails || []).map(e => ({
          id: e.id,
          subscriber_email: e.subscriber_email,
          subscriber_name: e.subscriber_name?.trim() || e.subscriber_email,
          sequence_name: e.sequence_name,
          step_subject: e.step_subject,
          scheduled_at: e.scheduled_at
        })),
        stats: {
          next_24h: stats24h?.count || 0,
          next_7d: stats7d?.count || 0,
          hourly_distribution: hourlyDistribution
        }
      }
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Send queue GET error:', error);
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
