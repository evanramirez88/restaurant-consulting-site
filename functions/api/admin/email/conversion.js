/**
 * Email Conversion Tracking API
 *
 * POST /api/admin/email/conversion - Mark email as converted (call booked, subscription started)
 * GET /api/admin/email/conversion - Get conversion stats
 *
 * Tracks the full funnel: Email Click → Call Booking → Subscription
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

/**
 * POST /api/admin/email/conversion
 * Mark an email/subscriber as converted
 *
 * Body:
 *   - subscriber_id: Email subscriber ID (optional if email provided)
 *   - email: Subscriber email (optional if subscriber_id provided)
 *   - email_log_id: Specific email log ID (optional)
 *   - conversion_type: 'call_booked' | 'quote_requested' | 'subscription_started' | 'client_converted'
 *   - conversion_value: Dollar value (optional)
 *   - notes: Additional notes (optional)
 *   - source: 'cal_com' | 'stripe' | 'form' | 'manual' (optional)
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
      subscriber_id,
      email,
      email_log_id,
      conversion_type = 'call_booked',
      conversion_value,
      notes,
      source = 'manual'
    } = body;

    const now = Math.floor(Date.now() / 1000);

    // Find subscriber
    let subscriberId = subscriber_id;
    if (!subscriberId && email) {
      const subscriber = await db.prepare(
        'SELECT id FROM email_subscribers WHERE email = ?'
      ).bind(email.toLowerCase()).first();
      subscriberId = subscriber?.id;
    }

    if (!subscriberId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Subscriber not found. Provide subscriber_id or email.'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Update the most recent email log for this subscriber
    let emailLogUpdateQuery = `
      UPDATE email_logs
      SET converted_at = ?,
          conversion_type = ?,
          conversion_value = ?,
          conversion_notes = ?,
          conversion_source = ?,
          updated_at = ?
      WHERE subscriber_id = ?
    `;
    const params = [now, conversion_type, conversion_value || null, notes || null, source, now, subscriberId];

    if (email_log_id) {
      emailLogUpdateQuery += ' AND id = ?';
      params.push(email_log_id);
    } else {
      // Update the most recent clicked email if no specific log ID
      emailLogUpdateQuery += ' AND clicked_at IS NOT NULL ORDER BY clicked_at DESC LIMIT 1';
    }

    const logResult = await db.prepare(emailLogUpdateQuery).bind(...params).run();

    // Also update subscriber record with conversion info
    await db.prepare(`
      UPDATE email_subscribers
      SET converted_at = COALESCE(converted_at, ?),
          conversion_type = ?,
          conversion_value = COALESCE(conversion_value, 0) + COALESCE(?, 0),
          total_conversions = COALESCE(total_conversions, 0) + 1,
          last_conversion_at = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(now, conversion_type, conversion_value, now, now, subscriberId).run();

    // Log the conversion event
    const conversionId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    try {
      await db.prepare(`
        INSERT INTO email_conversions (
          id, subscriber_id, email_log_id, conversion_type, conversion_value,
          notes, source, converted_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        conversionId, subscriberId, email_log_id || null, conversion_type,
        conversion_value || null, notes || null, source, now, now
      ).run();
    } catch (e) {
      // Table might not exist yet, log but continue
      console.log('Could not insert conversion record:', e.message);
    }

    // Get subscriber details for response
    const subscriber = await db.prepare(`
      SELECT id, email, first_name, company, engagement_score, converted_at, conversion_type
      FROM email_subscribers WHERE id = ?
    `).bind(subscriberId).first();

    return new Response(JSON.stringify({
      success: true,
      data: {
        conversion_id: conversionId,
        subscriber: {
          id: subscriber.id,
          email: subscriber.email,
          name: subscriber.first_name,
          company: subscriber.company
        },
        conversion: {
          type: conversion_type,
          value: conversion_value,
          source,
          converted_at: now
        },
        message: `Subscriber marked as converted (${conversion_type})`
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Conversion POST error:', error);
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
 * GET /api/admin/email/conversion
 * Get conversion statistics
 *
 * Query params:
 *   - days: Number of days to look back (default: 30)
 *   - sequence_id: Filter by sequence (optional)
 */
export async function onRequestGet(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const url = new URL(context.request.url);

    const days = parseInt(url.searchParams.get('days') || '30');
    const sequenceId = url.searchParams.get('sequence_id');

    const now = Math.floor(Date.now() / 1000);
    const startTs = now - (days * 24 * 60 * 60);

    // Get conversion stats by type
    const byTypeQuery = `
      SELECT
        conversion_type,
        COUNT(*) as count,
        SUM(COALESCE(conversion_value, 0)) as total_value
      FROM email_logs
      WHERE converted_at IS NOT NULL AND converted_at >= ?
      ${sequenceId ? 'AND sequence_id = ?' : ''}
      GROUP BY conversion_type
    `;

    const byTypeParams = sequenceId ? [startTs, sequenceId] : [startTs];
    const { results: byType } = await db.prepare(byTypeQuery).bind(...byTypeParams).all();

    // Get overall funnel stats
    const funnelQuery = `
      SELECT
        COUNT(*) as total_sent,
        SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
        SUM(CASE WHEN converted_at IS NOT NULL THEN 1 ELSE 0 END) as converted,
        SUM(CASE WHEN conversion_type = 'call_booked' THEN 1 ELSE 0 END) as calls_booked,
        SUM(CASE WHEN conversion_type = 'subscription_started' THEN 1 ELSE 0 END) as subscriptions
      FROM email_logs
      WHERE created_at >= ?
      ${sequenceId ? 'AND sequence_id = ?' : ''}
    `;

    const funnelParams = sequenceId ? [startTs, sequenceId] : [startTs];
    const funnel = await db.prepare(funnelQuery).bind(...funnelParams).first();

    // Get recent conversions
    const recentQuery = `
      SELECT
        el.id,
        el.converted_at,
        el.conversion_type,
        el.conversion_value,
        es.email,
        es.first_name,
        es.company,
        eq.name as sequence_name
      FROM email_logs el
      JOIN email_subscribers es ON el.subscriber_id = es.id
      LEFT JOIN email_sequences eq ON el.sequence_id = eq.id
      WHERE el.converted_at IS NOT NULL AND el.converted_at >= ?
      ORDER BY el.converted_at DESC
      LIMIT 20
    `;

    const { results: recent } = await db.prepare(recentQuery).bind(startTs).all();

    // Calculate conversion rates
    const clickToConvert = funnel?.clicked > 0
      ? ((funnel.converted / funnel.clicked) * 100).toFixed(2)
      : 0;
    const overallConvert = funnel?.total_sent > 0
      ? ((funnel.converted / funnel.total_sent) * 100).toFixed(2)
      : 0;

    return new Response(JSON.stringify({
      success: true,
      data: {
        summary: {
          total_conversions: funnel?.converted || 0,
          calls_booked: funnel?.calls_booked || 0,
          subscriptions_started: funnel?.subscriptions || 0,
          click_to_conversion_rate: parseFloat(clickToConvert),
          overall_conversion_rate: parseFloat(overallConvert)
        },
        by_type: byType.reduce((acc, row) => {
          acc[row.conversion_type || 'unknown'] = {
            count: row.count,
            total_value: row.total_value || 0
          };
          return acc;
        }, {}),
        funnel: {
          sent: funnel?.total_sent || 0,
          clicked: funnel?.clicked || 0,
          converted: funnel?.converted || 0
        },
        recent_conversions: (recent || []).map(c => ({
          id: c.id,
          email: c.email,
          name: c.first_name,
          company: c.company,
          sequence: c.sequence_name,
          type: c.conversion_type,
          value: c.conversion_value,
          converted_at: c.converted_at
        })),
        meta: {
          days,
          sequence_id: sequenceId || 'all'
        }
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Conversion GET error:', error);
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
