/**
 * Single Error API
 *
 * GET /api/admin/email/errors/:id - Get full error details
 * PUT /api/admin/email/errors/:id - Update error status (resolve, suppress)
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const { id } = context.params;
    const db = context.env.DB;

    // Get error details
    const errorQuery = `
      SELECT
        el.id,
        el.subscriber_id,
        s.email as subscriber_email,
        s.first_name || ' ' || COALESCE(s.last_name, '') as subscriber_name,
        el.sequence_id,
        seq.name as sequence_name,
        el.step_id,
        ss.step_number,
        ss.subject as step_subject,
        COALESCE(el.error_type, 'unknown') as error_type,
        el.error_message,
        el.error_details,
        COALESCE(el.failed_at, el.created_at) as failed_at,
        COALESCE(el.retry_count, 0) as retry_count,
        el.last_retry_at,
        COALESCE(el.resolution_status, 'pending') as status,
        el.resolved_at,
        el.resolved_by,
        el.resolution_note,
        el.email_content
      FROM email_logs el
      LEFT JOIN email_subscribers s ON el.subscriber_id = s.id
      LEFT JOIN email_sequences seq ON el.sequence_id = seq.id
      LEFT JOIN sequence_steps ss ON el.step_id = ss.id
      WHERE el.id = ?
    `;

    const error = await db.prepare(errorQuery).bind(id).first();

    if (!error) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Error not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Get retry history
    const retryQuery = `
      SELECT
        attempt_number as attempt,
        attempted_at as timestamp,
        result,
        error_message
      FROM email_retry_log
      WHERE email_log_id = ?
      ORDER BY attempt_number ASC
    `;

    let retryHistory = [];
    try {
      const { results } = await db.prepare(retryQuery).bind(id).all();
      retryHistory = results || [];
    } catch (e) {
      // Table might not exist yet
      console.log('Retry log table may not exist:', e.message);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        error,
        retry_history: retryHistory
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Error GET error:', error);
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

    const { id } = context.params;
    const body = await context.request.json();
    const db = context.env.DB;

    const { status, resolution_note } = body;

    if (!['resolved', 'suppressed'].includes(status)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid status. Must be "resolved" or "suppressed"'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);

    // Update the error
    await db.prepare(`
      UPDATE email_logs
      SET
        resolution_status = ?,
        resolved_at = ?,
        resolved_by = 'admin',
        resolution_note = ?
      WHERE id = ?
    `).bind(status, now, resolution_note || null, id).run();

    // If suppressing, also add to suppression list
    if (status === 'suppressed') {
      // Get subscriber email
      const emailLog = await db.prepare(`
        SELECT s.email, s.id as subscriber_id
        FROM email_logs el
        JOIN subscribers s ON el.subscriber_id = s.id
        WHERE el.id = ?
      `).bind(id).first();

      if (emailLog?.email) {
        // Add to suppression list
        try {
          await db.prepare(`
            INSERT OR IGNORE INTO email_suppressions (email, subscriber_id, reason, suppressed_at)
            VALUES (?, ?, ?, ?)
          `).bind(emailLog.email, emailLog.subscriber_id, body.reason || 'bounced', now).run();

          // Also update subscriber status
          await db.prepare(`
            UPDATE subscribers
            SET status = 'bounced', updated_at = ?
            WHERE id = ?
          `).bind(now, emailLog.subscriber_id).run();
        } catch (e) {
          console.log('Suppression table may not exist:', e.message);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Error marked as ${status}`
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Error PUT error:', error);
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
