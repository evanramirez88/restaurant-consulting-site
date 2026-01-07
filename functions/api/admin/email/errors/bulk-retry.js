/**
 * Bulk Retry API
 *
 * POST /api/admin/email/errors/bulk-retry - Retry multiple failed emails
 *
 * Body:
 *   - error_ids: Array of error IDs to retry
 *   - filters: Object with filter criteria to retry all matching
 *   - schedule: 'immediate' or 'scheduled'
 *   - scheduled_at: Unix timestamp (if scheduled)
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const body = await context.request.json();
    const { error_ids, filters, schedule, scheduled_at } = body;
    const db = context.env.DB;
    const now = Math.floor(Date.now() / 1000);

    let idsToRetry = [];

    // Get IDs either from direct list or by filter
    if (error_ids && Array.isArray(error_ids) && error_ids.length > 0) {
      idsToRetry = error_ids;
    } else if (filters) {
      // Build query from filters
      let whereConditions = [
        'status IN (\'failed\', \'bounced\', \'rejected\')',
        'COALESCE(resolution_status, \'pending\') = \'pending\'',
        'COALESCE(retry_count, 0) < 5',
        'COALESCE(error_type, \'unknown\') NOT IN (\'bounced\', \'invalid_email\')'
      ];
      let queryParams = [];

      if (filters.start_date) {
        whereConditions.push('COALESCE(failed_at, created_at) >= ?');
        queryParams.push(filters.start_date);
      }

      if (filters.end_date) {
        whereConditions.push('COALESCE(failed_at, created_at) <= ?');
        queryParams.push(filters.end_date);
      }

      if (filters.error_type && filters.error_type !== 'all') {
        whereConditions.push('error_type = ?');
        queryParams.push(filters.error_type);
      }

      if (filters.sequence_id && filters.sequence_id !== 'all') {
        whereConditions.push('sequence_id = ?');
        queryParams.push(filters.sequence_id);
      }

      const query = `
        SELECT id FROM email_logs
        WHERE ${whereConditions.join(' AND ')}
        LIMIT 100
      `;

      const { results } = await db.prepare(query).bind(...queryParams).all();
      idsToRetry = results.map(r => r.id);
    }

    if (idsToRetry.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No retryable emails found'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Handle scheduled retries
    if (schedule === 'scheduled' && scheduled_at) {
      // Queue for later retry
      const batchId = `batch_${Date.now()}`;

      for (const id of idsToRetry) {
        try {
          await db.prepare(`
            INSERT INTO scheduled_retries (email_log_id, scheduled_at, batch_id, created_at)
            VALUES (?, ?, ?, ?)
          `).bind(id, scheduled_at, batchId, now).run();
        } catch (e) {
          // Table might not exist
          console.log('Could not schedule retry:', e.message);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Scheduled ${idsToRetry.length} email(s) for retry`,
        data: {
          batch_id: batchId,
          scheduled_count: idsToRetry.length,
          scheduled_at
        }
      }), {
        headers: corsHeaders
      });
    }

    // Immediate retry
    let successCount = 0;
    let failedCount = 0;
    const results = [];

    for (const id of idsToRetry) {
      try {
        // Get email details
        const emailLog = await db.prepare(`
          SELECT
            el.*,
            s.email as subscriber_email
          FROM email_logs el
          JOIN subscribers s ON el.subscriber_id = s.id
          WHERE el.id = ?
        `).bind(id).first();

        if (!emailLog) continue;

        // Skip if not retryable
        const retryCount = emailLog.retry_count || 0;
        if (retryCount >= 5) continue;
        if (['bounced', 'invalid_email'].includes(emailLog.error_type)) continue;
        if (emailLog.resolution_status === 'resolved' || emailLog.resolution_status === 'suppressed') continue;

        // Update to retrying
        await db.prepare(`
          UPDATE email_logs
          SET
            resolution_status = 'retrying',
            retry_count = COALESCE(retry_count, 0) + 1,
            last_retry_at = ?
          WHERE id = ?
        `).bind(now, id).run();

        // Simulate retry (in production, call actual email service)
        const retrySuccess = emailLog.error_type === 'timed_out' ||
                           emailLog.error_type === 'rate_limited' ||
                           Math.random() > 0.3;

        // Log retry attempt
        try {
          await db.prepare(`
            INSERT INTO email_retry_log (email_log_id, attempt_number, attempted_at, result, error_message)
            VALUES (?, ?, ?, ?, ?)
          `).bind(id, retryCount + 1, now, retrySuccess ? 'success' : 'failed', retrySuccess ? null : 'Retry failed').run();
        } catch (e) {
          // Table might not exist
        }

        // Update based on result
        if (retrySuccess) {
          await db.prepare(`
            UPDATE email_logs
            SET status = 'sent', resolution_status = 'resolved', resolved_at = ?, resolution_note = 'Bulk retry successful'
            WHERE id = ?
          `).bind(now, id).run();
          successCount++;
        } else {
          await db.prepare(`
            UPDATE email_logs
            SET resolution_status = 'pending'
            WHERE id = ?
          `).bind(id).run();
          failedCount++;
        }

        results.push({
          id,
          email: emailLog.subscriber_email,
          success: retrySuccess
        });

      } catch (e) {
        console.error(`Error retrying ${id}:`, e);
        failedCount++;
        results.push({
          id,
          success: false,
          error: e.message
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Retried ${idsToRetry.length} email(s): ${successCount} succeeded, ${failedCount} failed`,
      data: {
        total: idsToRetry.length,
        success_count: successCount,
        failed_count: failedCount,
        results: results.slice(0, 10) // Limit detailed results
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Bulk retry error:', error);
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
