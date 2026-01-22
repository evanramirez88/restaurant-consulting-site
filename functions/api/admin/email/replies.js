/**
 * Email Reply Tracking API
 *
 * POST /api/admin/email/replies - Log an email reply
 * GET /api/admin/email/replies - Get recent replies
 *
 * Replies to campaign emails go to Gmail (ramirezconsulting.rg@gmail.com).
 * This endpoint logs reply data for tracking and lead scoring.
 *
 * Can be called:
 * 1. Manually from admin dashboard
 * 2. Via Google Apps Script automation
 * 3. Via Zapier/Make integration
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

/**
 * POST /api/admin/email/replies
 * Log an email reply
 *
 * Body:
 *   - email: Sender email (required)
 *   - subject: Email subject (optional)
 *   - body: Reply body text (optional)
 *   - received_at: Unix timestamp (optional, defaults to now)
 *   - sentiment: 'positive' | 'negative' | 'neutral' | 'question' (optional)
 *   - priority: 'high' | 'medium' | 'low' (optional)
 *   - source: 'gmail' | 'zapier' | 'manual' (optional)
 */
export async function onRequestPost(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const body = await context.request.json();
    const {
      email,
      subject,
      body: replyBody,
      received_at,
      sentiment = 'neutral',
      priority = 'medium',
      source = 'manual'
    } = body;

    if (!email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'email is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const receivedAt = received_at || now;

    // Find subscriber by email
    const subscriber = await db.prepare(
      'SELECT id, first_name, company, engagement_score FROM email_subscribers WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    // Find matching lead
    const lead = await db.prepare(
      'SELECT id, restaurant_name, lead_score FROM restaurant_leads WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    // Create reply record
    const replyId = `reply_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    try {
      await db.prepare(`
        INSERT INTO email_replies (
          id, subscriber_id, lead_id, email, subject, body_preview,
          sentiment, priority, source, received_at, processed, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).bind(
        replyId,
        subscriber?.id || null,
        lead?.id || null,
        email.toLowerCase(),
        subject || null,
        replyBody ? replyBody.substring(0, 500) : null,
        sentiment,
        priority,
        source,
        receivedAt,
        now
      ).run();
    } catch (e) {
      // Table might not exist, log but continue
      console.log('Could not insert reply record:', e.message);
    }

    // Update subscriber engagement score if found (+15 for reply)
    if (subscriber) {
      await db.prepare(`
        UPDATE email_subscribers
        SET replied_at = COALESCE(replied_at, ?),
            total_replies = COALESCE(total_replies, 0) + 1,
            engagement_score = MIN(100, COALESCE(engagement_score, 0) + 15),
            engagement_score_updated_at = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(receivedAt, now, now, subscriber.id).run();
    }

    // Log activity if lead found
    if (lead) {
      try {
        await db.prepare(`
          INSERT INTO lead_activity_log (id, lead_id, activity_type, activity_data, created_at)
          VALUES (?, ?, 'email_reply', ?, ?)
        `).bind(
          `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          lead.id,
          JSON.stringify({ subject, sentiment, priority, source }),
          now
        ).run();
      } catch (e) {
        console.log('Could not log lead activity:', e.message);
      }
    }

    // Determine if this needs immediate attention
    const isHighPriority = priority === 'high' ||
      sentiment === 'positive' ||
      (subscriber?.engagement_score || 0) >= 50 ||
      (lead?.lead_score || 0) >= 70;

    return new Response(JSON.stringify({
      success: true,
      data: {
        reply_id: replyId,
        subscriber: subscriber ? {
          id: subscriber.id,
          name: subscriber.first_name,
          company: subscriber.company,
          engagement_score: subscriber.engagement_score
        } : null,
        lead: lead ? {
          id: lead.id,
          restaurant: lead.restaurant_name,
          lead_score: lead.lead_score
        } : null,
        priority: isHighPriority ? 'high' : priority,
        action_needed: isHighPriority,
        message: isHighPriority
          ? 'High-priority reply! Follow up immediately.'
          : 'Reply logged successfully'
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Reply POST error:', error);
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
 * GET /api/admin/email/replies
 * Get recent replies
 *
 * Query params:
 *   - days: Number of days to look back (default: 7)
 *   - priority: Filter by priority (optional)
 *   - processed: Filter by processed status (optional)
 */
export async function onRequestGet(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const url = new URL(context.request.url);

    const days = parseInt(url.searchParams.get('days') || '7');
    const priority = url.searchParams.get('priority');
    const processed = url.searchParams.get('processed');

    const now = Math.floor(Date.now() / 1000);
    const startTs = now - (days * 24 * 60 * 60);

    // Try to get replies from the table
    try {
      let query = `
        SELECT
          r.id,
          r.email,
          r.subject,
          r.body_preview,
          r.sentiment,
          r.priority,
          r.source,
          r.received_at,
          r.processed,
          es.first_name as subscriber_name,
          es.company as subscriber_company,
          es.engagement_score,
          rl.restaurant_name,
          rl.lead_score
        FROM email_replies r
        LEFT JOIN email_subscribers es ON r.subscriber_id = es.id
        LEFT JOIN restaurant_leads rl ON r.lead_id = rl.id
        WHERE r.received_at >= ?
      `;

      const params = [startTs];

      if (priority) {
        query += ' AND r.priority = ?';
        params.push(priority);
      }

      if (processed !== null && processed !== undefined) {
        query += ' AND r.processed = ?';
        params.push(processed === 'true' || processed === '1' ? 1 : 0);
      }

      query += ' ORDER BY r.received_at DESC LIMIT 50';

      const { results } = await db.prepare(query).bind(...params).all();

      // Get summary stats
      const statsQuery = `
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_priority,
          SUM(CASE WHEN processed = 0 THEN 1 ELSE 0 END) as unprocessed,
          SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive
        FROM email_replies
        WHERE received_at >= ?
      `;

      const stats = await db.prepare(statsQuery).bind(startTs).first();

      return new Response(JSON.stringify({
        success: true,
        data: {
          replies: (results || []).map(r => ({
            id: r.id,
            email: r.email,
            subject: r.subject,
            body_preview: r.body_preview,
            sentiment: r.sentiment,
            priority: r.priority,
            source: r.source,
            received_at: r.received_at,
            processed: !!r.processed,
            subscriber: r.subscriber_name ? {
              name: r.subscriber_name,
              company: r.subscriber_company,
              engagement_score: r.engagement_score
            } : null,
            lead: r.restaurant_name ? {
              restaurant: r.restaurant_name,
              lead_score: r.lead_score
            } : null
          })),
          stats: {
            total: stats?.total || 0,
            high_priority: stats?.high_priority || 0,
            unprocessed: stats?.unprocessed || 0,
            positive: stats?.positive || 0
          },
          meta: {
            days,
            filters: { priority, processed }
          }
        }
      }), {
        headers: corsHeaders
      });

    } catch (e) {
      // Table doesn't exist yet
      return new Response(JSON.stringify({
        success: true,
        data: {
          replies: [],
          stats: {
            total: 0,
            high_priority: 0,
            unprocessed: 0,
            positive: 0
          },
          meta: {
            days,
            message: 'No replies recorded yet'
          }
        }
      }), {
        headers: corsHeaders
      });
    }

  } catch (error) {
    console.error('Reply GET error:', error);
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
