/**
 * Resend Webhook Handler
 * 
 * Handles email delivery events from Resend:
 * - email.sent
 * - email.delivered
 * - email.delivery_delayed
 * - email.bounced
 * - email.complained
 * - email.opened
 * - email.clicked
 * 
 * @see https://resend.com/docs/dashboard/webhooks/introduction
 */

/**
 * Verify Resend webhook signature using HMAC-SHA256
 * @param {string} payload - Raw request body
 * @param {string} signature - Signature from svix-signature header
 * @param {string} secret - Webhook signing secret
 * @returns {Promise<boolean>}
 */
async function verifySignature(payload, signature, timestamp, secret) {
  if (!signature || !timestamp || !secret) {
    return false;
  }

  // Resend uses Svix for webhooks - signature format: v1,<signature>
  const signatureParts = signature.split(',');
  const signatures = signatureParts
    .filter(part => part.startsWith('v1,'))
    .map(part => part.slice(3));

  if (signatures.length === 0) {
    // Try parsing as simple signature
    const simpleSignature = signatureParts.find(p => !p.startsWith('v'));
    if (simpleSignature) {
      signatures.push(simpleSignature);
    }
  }

  // Create signed payload: timestamp.payload
  const signedPayload = `${timestamp}.${payload}`;

  // Import the secret key
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the payload
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signedPayload)
  );

  // Convert to hex
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Compare with provided signatures
  return signatures.some(sig => sig === expectedSignature);
}

/**
 * Generate a unique ID
 */
function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const now = Math.floor(Date.now() / 1000);

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Verify webhook signature (if secret is configured)
    if (env.RESEND_WEBHOOK_SECRET) {
      const svixId = request.headers.get('svix-id');
      const svixTimestamp = request.headers.get('svix-timestamp');
      const svixSignature = request.headers.get('svix-signature');

      const isValid = await verifySignature(
        rawBody,
        svixSignature,
        svixTimestamp,
        env.RESEND_WEBHOOK_SECRET
      );

      if (!isValid) {
        console.error('[Resend Webhook] Invalid signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Parse the webhook payload
    const payload = JSON.parse(rawBody);
    const { type, data } = payload;

    console.log(`[Resend Webhook] Received event: ${type}`);

    // Extract email ID from the payload
    const resendId = data?.email_id || data?.id;
    const toEmail = Array.isArray(data?.to) ? data.to[0] : data?.to;

    if (!resendId) {
      console.warn('[Resend Webhook] No email_id in payload');
      return new Response(JSON.stringify({ received: true, skipped: 'no_email_id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find the email log entry by resend_id
    const emailLog = await env.DB.prepare(`
      SELECT id, subscriber_id, sequence_id, step_id, status, email_to
      FROM email_logs
      WHERE resend_id = ?
      LIMIT 1
    `).bind(resendId).first();

    if (!emailLog) {
      console.warn(`[Resend Webhook] Email log not found for resend_id: ${resendId}`);
      // Still return 200 to acknowledge receipt
      return new Response(JSON.stringify({ received: true, skipped: 'log_not_found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle different event types
    switch (type) {
      case 'email.sent':
        // Already tracked at send time, but update if needed
        await env.DB.prepare(`
          UPDATE email_logs
          SET status = CASE WHEN status = 'queued' THEN 'sent' ELSE status END,
              sent_at = COALESCE(sent_at, ?),
              updated_at = ?
          WHERE id = ?
        `).bind(now, now, emailLog.id).run();
        break;

      case 'email.delivered':
        await env.DB.prepare(`
          UPDATE email_logs
          SET status = 'delivered',
              delivered_at = ?,
              updated_at = ?
          WHERE id = ?
        `).bind(now, now, emailLog.id).run();

        // Update subscriber stats
        await env.DB.prepare(`
          UPDATE email_subscribers
          SET total_emails_delivered = total_emails_delivered + 1,
              updated_at = ?
          WHERE id = ?
        `).bind(now, emailLog.subscriber_id).run();

        // Update step stats
        if (emailLog.step_id) {
          await env.DB.prepare(`
            UPDATE sequence_steps
            SET total_delivered = total_delivered + 1,
                updated_at = ?
            WHERE id = ?
          `).bind(now, emailLog.step_id).run();
        }
        break;

      case 'email.delivery_delayed':
        await env.DB.prepare(`
          UPDATE email_logs
          SET status = 'delayed',
              failure_message = ?,
              updated_at = ?
          WHERE id = ?
        `).bind(data?.reason || 'Delivery delayed', now, emailLog.id).run();
        break;

      case 'email.bounced':
        const bounceType = data?.bounce?.type || 'unknown'; // hard, soft
        const bounceReason = data?.bounce?.message || data?.reason || 'Bounced';

        await env.DB.prepare(`
          UPDATE email_logs
          SET status = 'bounced',
              bounce_type = ?,
              bounced_at = ?,
              failure_message = ?,
              updated_at = ?
          WHERE id = ?
        `).bind(bounceType, now, bounceReason, now, emailLog.id).run();

        // Update subscriber
        await env.DB.prepare(`
          UPDATE email_subscribers
          SET total_bounces = total_bounces + 1,
              updated_at = ?
          WHERE id = ?
        `).bind(now, emailLog.subscriber_id).run();

        // On hard bounce, add to suppression list and deactivate subscriber
        if (bounceType === 'hard') {
          const email = emailLog.email_to || toEmail;
          if (email) {
            await env.DB.prepare(`
              INSERT OR IGNORE INTO email_suppression_list (id, email, reason, source, created_at)
              VALUES (?, ?, 'hard_bounce', 'resend_webhook', ?)
            `).bind(generateId('sup'), email, now).run();

            await env.DB.prepare(`
              UPDATE email_subscribers
              SET status = 'bounced',
                  updated_at = ?
              WHERE id = ?
            `).bind(now, emailLog.subscriber_id).run();

            // Cancel any active sequences
            await env.DB.prepare(`
              UPDATE subscriber_sequences
              SET status = 'failed',
                  failure_reason = 'hard_bounce',
                  failed_at = ?,
                  updated_at = ?
              WHERE subscriber_id = ? AND status IN ('active', 'queued', 'paused')
            `).bind(now, now, emailLog.subscriber_id).run();
          }
        }
        break;

      case 'email.complained':
        const complaintReason = data?.complaint?.feedback_type || 'spam';

        await env.DB.prepare(`
          UPDATE email_logs
          SET status = 'complained',
              complained_at = ?,
              failure_message = ?,
              updated_at = ?
          WHERE id = ?
        `).bind(now, `Complaint: ${complaintReason}`, now, emailLog.id).run();

        // Add to suppression list
        const complainEmail = emailLog.email_to || toEmail;
        if (complainEmail) {
          await env.DB.prepare(`
            INSERT OR IGNORE INTO email_suppression_list (id, email, reason, source, created_at)
            VALUES (?, ?, 'complaint', 'resend_webhook', ?)
          `).bind(generateId('sup'), complainEmail, now).run();

          // Unsubscribe the user
          await env.DB.prepare(`
            UPDATE email_subscribers
            SET status = 'unsubscribed',
                unsubscribed_at = ?,
                unsubscribe_reason = 'spam_complaint',
                updated_at = ?
            WHERE id = ?
          `).bind(now, now, emailLog.subscriber_id).run();

          // Cancel sequences
          await env.DB.prepare(`
            UPDATE subscriber_sequences
            SET status = 'failed',
                failure_reason = 'spam_complaint',
                failed_at = ?,
                updated_at = ?
            WHERE subscriber_id = ? AND status IN ('active', 'queued', 'paused')
          `).bind(now, now, emailLog.subscriber_id).run();
        }
        break;

      case 'email.opened':
        // Track first open and total opens
        const existingOpen = await env.DB.prepare(`
          SELECT first_opened_at, total_opens FROM email_logs WHERE id = ?
        `).bind(emailLog.id).first();

        await env.DB.prepare(`
          UPDATE email_logs
          SET status = CASE WHEN status IN ('sent', 'delivered') THEN 'opened' ELSE status END,
              first_opened_at = COALESCE(first_opened_at, ?),
              last_opened_at = ?,
              total_opens = COALESCE(total_opens, 0) + 1,
              updated_at = ?
          WHERE id = ?
        `).bind(now, now, now, emailLog.id).run();

        // Only increment subscriber/step stats on first open
        if (!existingOpen?.first_opened_at) {
          await env.DB.prepare(`
            UPDATE email_subscribers
            SET total_emails_opened = total_emails_opened + 1,
                updated_at = ?
            WHERE id = ?
          `).bind(now, emailLog.subscriber_id).run();

          if (emailLog.step_id) {
            await env.DB.prepare(`
              UPDATE sequence_steps
              SET total_opened = total_opened + 1,
                  updated_at = ?
              WHERE id = ?
            `).bind(now, emailLog.step_id).run();
          }
        }
        break;

      case 'email.clicked':
        const clickUrl = data?.click?.link || data?.link || 'unknown';

        // Track first click and total clicks
        const existingClick = await env.DB.prepare(`
          SELECT first_clicked_at, total_clicks FROM email_logs WHERE id = ?
        `).bind(emailLog.id).first();

        await env.DB.prepare(`
          UPDATE email_logs
          SET status = 'clicked',
              first_clicked_at = COALESCE(first_clicked_at, ?),
              last_clicked_at = ?,
              total_clicks = COALESCE(total_clicks, 0) + 1,
              updated_at = ?
          WHERE id = ?
        `).bind(now, now, now, emailLog.id).run();

        // Log individual click event
        await env.DB.prepare(`
          INSERT INTO email_click_events (id, email_log_id, subscriber_id, url, clicked_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          generateId('clk'),
          emailLog.id,
          emailLog.subscriber_id,
          clickUrl,
          now,
          now
        ).run();

        // Only increment subscriber/step stats on first click
        if (!existingClick?.first_clicked_at) {
          await env.DB.prepare(`
            UPDATE email_subscribers
            SET total_emails_clicked = total_emails_clicked + 1,
                updated_at = ?
            WHERE id = ?
          `).bind(now, emailLog.subscriber_id).run();

          if (emailLog.step_id) {
            await env.DB.prepare(`
              UPDATE sequence_steps
              SET total_clicked = total_clicked + 1,
                  updated_at = ?
              WHERE id = ?
            `).bind(now, emailLog.step_id).run();
          }
        }
        break;

      default:
        console.log(`[Resend Webhook] Unhandled event type: ${type}`);
    }

    // Log the webhook event for debugging
    await env.DB.prepare(`
      INSERT INTO webhook_events (id, provider, event_type, payload, processed_at, created_at)
      VALUES (?, 'resend', ?, ?, ?, ?)
    `).bind(
      generateId('whk'),
      type,
      rawBody.substring(0, 4000), // Truncate to 4KB
      now,
      now
    ).run();

    return new Response(JSON.stringify({ received: true, event: type }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Resend Webhook] Error:', error);
    
    // Return 200 to prevent retries for parsing errors
    return new Response(JSON.stringify({ 
      received: true, 
      error: error.message 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Health check / verification endpoint
export async function onRequestGet(context) {
  return new Response(JSON.stringify({
    status: 'ok',
    endpoint: 'resend-webhook',
    timestamp: new Date().toISOString(),
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
