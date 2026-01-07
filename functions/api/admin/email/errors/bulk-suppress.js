/**
 * Bulk Suppress API
 *
 * POST /api/admin/email/errors/bulk-suppress - Suppress multiple email addresses
 *
 * Body:
 *   - error_ids: Array of error IDs to suppress
 *   - reason: 'bounced' | 'complained' | 'manual'
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
    const { error_ids, reason } = body;
    const db = context.env.DB;
    const now = Math.floor(Date.now() / 1000);

    if (!error_ids || !Array.isArray(error_ids) || error_ids.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'error_ids array is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const validReasons = ['bounced', 'complained', 'manual'];
    const suppressionReason = validReasons.includes(reason) ? reason : 'bounced';

    // Limit to 100 at a time
    const idsToSuppress = error_ids.slice(0, 100);
    let suppressedCount = 0;
    const suppressedEmails = [];

    for (const id of idsToSuppress) {
      try {
        // Get subscriber info
        const emailLog = await db.prepare(`
          SELECT s.id as subscriber_id, s.email
          FROM email_logs el
          JOIN subscribers s ON el.subscriber_id = s.id
          WHERE el.id = ?
        `).bind(id).first();

        if (!emailLog) continue;

        // Update email log
        await db.prepare(`
          UPDATE email_logs
          SET
            resolution_status = 'suppressed',
            resolved_at = ?,
            resolved_by = 'admin',
            resolution_note = ?
          WHERE id = ?
        `).bind(now, `Suppressed: ${suppressionReason}`, id).run();

        // Add to suppression list
        try {
          await db.prepare(`
            INSERT OR REPLACE INTO email_suppressions (email, subscriber_id, reason, suppressed_at, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).bind(emailLog.email, emailLog.subscriber_id, suppressionReason, now, now).run();
        } catch (e) {
          // Table might not exist, create it
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS email_suppressions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT NOT NULL UNIQUE,
              subscriber_id TEXT,
              reason TEXT NOT NULL,
              suppressed_at INTEGER NOT NULL,
              created_at INTEGER NOT NULL
            )
          `).run();

          // Try again
          await db.prepare(`
            INSERT OR REPLACE INTO email_suppressions (email, subscriber_id, reason, suppressed_at, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).bind(emailLog.email, emailLog.subscriber_id, suppressionReason, now, now).run();
        }

        // Update subscriber status
        await db.prepare(`
          UPDATE subscribers
          SET status = ?, updated_at = ?
          WHERE id = ?
        `).bind(suppressionReason === 'bounced' ? 'bounced' : 'unsubscribed', now, emailLog.subscriber_id).run();

        suppressedCount++;
        suppressedEmails.push(emailLog.email);

      } catch (e) {
        console.error(`Error suppressing ${id}:`, e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Suppressed ${suppressedCount} email address(es)`,
      data: {
        requested: idsToSuppress.length,
        suppressed: suppressedCount,
        reason: suppressionReason,
        emails: suppressedEmails.slice(0, 10) // Limit for response size
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Bulk suppress error:', error);
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
