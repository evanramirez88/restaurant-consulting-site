/**
 * Email Subscriber API - Single Subscriber Operations
 *
 * GET /api/admin/email/subscribers/:id - Get subscriber with history
 * PUT /api/admin/email/subscribers/:id - Update subscriber
 * DELETE /api/admin/email/subscribers/:id - Delete subscriber
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
    const { id } = context.params;

    // Get subscriber
    const subscriber = await db.prepare(`
      SELECT * FROM email_subscribers WHERE id = ?
    `).bind(id).first();

    if (!subscriber) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Subscriber not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Get sequence enrollments
    let enrollments = [];
    try {
      const enrollmentsResult = await db.prepare(`
        SELECT
          se.id,
          se.sequence_id,
          es.name as sequence_name,
          se.status,
          se.current_step,
          se.enrolled_at,
          se.completed_at
        FROM sequence_enrollments se
        LEFT JOIN email_sequences es ON se.sequence_id = es.id
        WHERE se.subscriber_id = ?
        ORDER BY se.enrolled_at DESC
      `).bind(id).all();
      enrollments = enrollmentsResult.results || [];
    } catch (e) {
      // Table might not exist yet
      console.log('Enrollments query skipped:', e.message);
    }

    // Get email log
    let emailLog = [];
    try {
      const emailLogResult = await db.prepare(`
        SELECT
          id,
          subject,
          sent_at,
          opened_at,
          clicked_at,
          bounced
        FROM email_log
        WHERE subscriber_id = ?
        ORDER BY sent_at DESC
        LIMIT 50
      `).bind(id).all();
      emailLog = emailLogResult.results || [];
    } catch (e) {
      // Table might not exist yet
      console.log('Email log query skipped:', e.message);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        subscriber,
        enrollments,
        email_log: emailLog
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Subscriber GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPut(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;
    const body = await context.request.json();

    // Check subscriber exists
    const existing = await db.prepare('SELECT * FROM email_subscribers WHERE id = ?').bind(id).first();

    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Subscriber not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);

    // Build update query dynamically based on provided fields
    const updates = [];
    const params = [];

    const allowedFields = [
      'first_name', 'last_name', 'company', 'phone', 'pos_system',
      'geographic_tier', 'lead_source', 'status', 'engagement_score'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(body[field] === '' ? null : body[field]);
      }
    }

    // Handle tags separately (needs JSON stringify)
    if (body.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(body.tags));
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No fields to update'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    await db.prepare(`
      UPDATE email_subscribers SET ${updates.join(', ')} WHERE id = ?
    `).bind(...params).run();

    const subscriber = await db.prepare('SELECT * FROM email_subscribers WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: subscriber
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Subscriber PUT error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestDelete(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;

    // Check subscriber exists
    const existing = await db.prepare('SELECT id FROM email_subscribers WHERE id = ?').bind(id).first();

    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Subscriber not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Delete related records first (if tables exist)
    try {
      await db.prepare('DELETE FROM sequence_enrollments WHERE subscriber_id = ?').bind(id).run();
    } catch (e) {}

    try {
      await db.prepare('DELETE FROM email_log WHERE subscriber_id = ?').bind(id).run();
    } catch (e) {}

    // Delete subscriber
    await db.prepare('DELETE FROM email_subscribers WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({
      success: true
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Subscriber DELETE error:', error);
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
