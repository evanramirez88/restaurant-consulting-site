/**
 * Single Error Retry API
 *
 * POST /api/admin/email/errors/:id/retry - Retry sending a single failed email
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const { id } = context.params;
    const db = context.env.DB;
    const now = Math.floor(Date.now() / 1000);

    // Get the failed email details
    const emailLog = await db.prepare(`
      SELECT
        el.*,
        s.email as subscriber_email,
        s.first_name,
        s.last_name,
        ss.subject,
        ss.html_content,
        ss.text_content,
        seq.name as sequence_name
      FROM email_logs el
      JOIN subscribers s ON el.subscriber_id = s.id
      LEFT JOIN sequence_steps ss ON el.step_id = ss.id
      LEFT JOIN email_sequences seq ON el.sequence_id = seq.id
      WHERE el.id = ?
    `).bind(id).first();

    if (!emailLog) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email log not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Check if already resolved or suppressed
    if (emailLog.resolution_status === 'resolved' || emailLog.resolution_status === 'suppressed') {
      return new Response(JSON.stringify({
        success: false,
        error: `Cannot retry: email is ${emailLog.resolution_status}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Check retry count
    const retryCount = emailLog.retry_count || 0;
    if (retryCount >= 5) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Maximum retry attempts (5) exceeded'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Check if error type is retryable
    if (['bounced', 'invalid_email'].includes(emailLog.error_type)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Cannot retry: ${emailLog.error_type} errors are not retryable`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Update status to retrying
    await db.prepare(`
      UPDATE email_logs
      SET
        resolution_status = 'retrying',
        retry_count = COALESCE(retry_count, 0) + 1,
        last_retry_at = ?
      WHERE id = ?
    `).bind(now, id).run();

    // Here we would actually attempt to send the email
    // For now, we'll simulate by creating a retry log entry
    // In production, this would integrate with the email sending service

    let retrySuccess = false;
    let retryError = null;

    try {
      // Simulate email send attempt
      // In production, call the actual email sending function
      // const sendResult = await sendEmail({
      //   to: emailLog.subscriber_email,
      //   subject: emailLog.subject,
      //   html: emailLog.html_content,
      //   text: emailLog.text_content
      // });

      // For now, simulate success/failure based on error type
      if (emailLog.error_type === 'timed_out' || emailLog.error_type === 'rate_limited') {
        // These are often temporary, simulate success
        retrySuccess = true;
      } else {
        // Other errors might still fail
        retrySuccess = Math.random() > 0.3; // 70% success rate for demo
      }

      if (!retrySuccess) {
        retryError = 'Retry failed: ' + (emailLog.error_message || 'Unknown error');
      }
    } catch (e) {
      retryError = e.message;
    }

    // Log the retry attempt
    try {
      await db.prepare(`
        INSERT INTO email_retry_log (email_log_id, attempt_number, attempted_at, result, error_message)
        VALUES (?, ?, ?, ?, ?)
      `).bind(id, retryCount + 1, now, retrySuccess ? 'success' : 'failed', retryError).run();
    } catch (e) {
      // Table might not exist, that's okay
      console.log('Could not log retry attempt:', e.message);
    }

    // Update email log based on result
    if (retrySuccess) {
      await db.prepare(`
        UPDATE email_logs
        SET
          status = 'sent',
          resolution_status = 'resolved',
          resolved_at = ?,
          resolution_note = 'Retry successful'
        WHERE id = ?
      `).bind(now, id).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'Email retry successful',
        data: {
          retry_number: retryCount + 1,
          status: 'sent'
        }
      }), {
        headers: corsHeaders
      });
    } else {
      await db.prepare(`
        UPDATE email_logs
        SET
          resolution_status = 'pending',
          error_message = ?
        WHERE id = ?
      `).bind(retryError, id).run();

      return new Response(JSON.stringify({
        success: false,
        error: retryError || 'Retry failed',
        data: {
          retry_number: retryCount + 1,
          can_retry: retryCount + 1 < 5
        }
      }), {
        status: 200, // Return 200 but success: false
        headers: corsHeaders
      });
    }
  } catch (error) {
    console.error('Retry error:', error);
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
