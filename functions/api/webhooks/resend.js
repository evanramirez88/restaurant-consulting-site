/**
 * Resend Webhook Handler
 *
 * Processes email events from Resend:
 * - email.bounced -> Add to suppression list
 * - email.complained -> Add to suppression list
 * - email.delivered -> Update delivery stats
 * - email.opened -> Track engagement
 * - email.clicked -> Track engagement
 *
 * POST /api/webhooks/resend
 */

import { getCorsOrigin } from '../../_shared/auth.js';

/**
 * Get CORS headers for webhook responses
 */
function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, svix-id, svix-timestamp, svix-signature',
    'Content-Type': 'application/json'
  };
}

/**
 * Verify Resend webhook signature (using Svix HMAC-SHA256)
 *
 * Resend uses Svix for webhook delivery which signs payloads with HMAC-SHA256.
 * The signature is base64-encoded and may include multiple versions.
 */
async function verifyWebhookSignature(request, secret) {
  if (!secret) {
    console.warn('[Resend Webhook] No secret configured, skipping verification');
    return { valid: true, body: await request.text() };
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return { valid: false, error: 'Missing svix headers' };
  }

  // Check timestamp to prevent replay attacks (5 minute tolerance)
  const timestampSeconds = parseInt(svixTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampSeconds) > 300) {
    return { valid: false, error: 'Timestamp out of tolerance' };
  }

  const body = await request.text();
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;

  try {
    // Extract the secret (remove whsec_ prefix if present)
    const secretKey = secret.startsWith('whsec_') ? secret.slice(6) : secret;

    // Decode the secret from base64
    const secretBytes = Uint8Array.from(atob(secretKey), c => c.charCodeAt(0));

    // Import the key for HMAC-SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Generate our signature
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedContent));
    const expectedSig = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    // Svix sends multiple signatures separated by space, each as "v1,<base64>"
    const signatures = svixSignature.split(' ');
    for (const sig of signatures) {
      const [version, sigValue] = sig.split(',');
      if (version === 'v1' && sigValue === expectedSig) {
        return { valid: true, body };
      }
    }

    return { valid: false, error: 'Signature mismatch' };
  } catch (error) {
    console.error('[Resend Webhook] Signature verification error:', error);
    return { valid: false, error: error.message };
  }
}

/**
 * Handle email.bounced event
 * - Add to suppression list
 * - Update subscriber status
 * - Cancel active sequences
 */
async function handleBounce(db, data, now) {
  const email = data.to?.[0] || data.email;
  if (!email) {
    console.warn('[Resend Webhook] Bounce event missing email address');
    return;
  }

  const bounceType = data.bounce?.type || 'hard';
  const bounceMessage = data.bounce?.message || 'Unknown bounce reason';
  const messageId = data.email_id;

  console.log(`[Resend Webhook] Bounce for: ${email} (${bounceType})`);

  // Add to suppression list (only for hard bounces)
  if (bounceType === 'hard') {
    try {
      await db.prepare(`
        INSERT INTO email_suppression_list (id, email, reason, source, notes, suppressed_at, created_at)
        VALUES (?, ?, 'hard_bounce', 'resend_webhook', ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
          reason = 'hard_bounce',
          source = 'resend_webhook',
          notes = excluded.notes,
          suppressed_at = excluded.suppressed_at
      `).bind(
        crypto.randomUUID(),
        email.toLowerCase(),
        bounceMessage,
        now,
        now
      ).run();
    } catch (error) {
      console.error('[Resend Webhook] Error adding to suppression list:', error);
    }
  }

  // Update email_logs if we have a message ID
  if (messageId) {
    const logResult = await db.prepare(`
      UPDATE email_logs
      SET status = 'bounced',
          bounced_at = ?,
          bounce_type = ?,
          bounce_message = ?,
          updated_at = ?
      WHERE message_id = ? OR resend_id = ?
      RETURNING subscriber_id, step_id, sequence_step_id
    `).bind(now, bounceType, bounceMessage, now, messageId, messageId).first();

    if (logResult?.subscriber_id) {
      // Update subscriber status
      await db.prepare(`
        UPDATE email_subscribers
        SET status = 'bounced',
            bounce_type = ?,
            bounce_reason = ?,
            bounced_at = ?,
            bounce_count = COALESCE(bounce_count, 0) + 1,
            last_bounce_at = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(bounceType, bounceMessage, now, now, now, logResult.subscriber_id).run();

      // Cancel all active sequences for this subscriber
      await db.prepare(`
        UPDATE subscriber_sequences
        SET status = 'bounced',
            cancelled_at = ?,
            cancel_reason = 'Email bounced',
            updated_at = ?
        WHERE subscriber_id = ? AND status IN ('active', 'processing', 'paused', 'queued')
      `).bind(now, now, logResult.subscriber_id).run();
    }

    // Update step stats
    const stepId = logResult?.step_id || logResult?.sequence_step_id;
    if (stepId) {
      await db.prepare(`
        UPDATE sequence_steps
        SET total_bounces = COALESCE(total_bounces, 0) + 1
        WHERE id = ?
      `).bind(stepId).run();
    }
  } else {
    // No message ID - try to find subscriber by email
    await db.prepare(`
      UPDATE email_subscribers
      SET status = 'bounced',
          bounce_type = ?,
          bounce_reason = ?,
          bounced_at = ?,
          bounce_count = COALESCE(bounce_count, 0) + 1,
          last_bounce_at = ?,
          updated_at = ?
      WHERE email = ?
    `).bind(bounceType, bounceMessage, now, now, now, email.toLowerCase()).run();
  }
}

/**
 * Handle email.complained event (spam complaint)
 * - Add to suppression list
 * - Update subscriber status
 * - Cancel active sequences
 */
async function handleComplaint(db, data, now) {
  const email = data.to?.[0] || data.email;
  if (!email) {
    console.warn('[Resend Webhook] Complaint event missing email address');
    return;
  }

  const messageId = data.email_id;

  console.log(`[Resend Webhook] Spam complaint for: ${email}`);

  // Add to suppression list
  try {
    await db.prepare(`
      INSERT INTO email_suppression_list (id, email, reason, source, notes, suppressed_at, created_at)
      VALUES (?, ?, 'complaint', 'resend_webhook', 'Marked as spam via Resend webhook', ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        reason = 'complaint',
        source = 'resend_webhook',
        notes = 'Marked as spam via Resend webhook',
        suppressed_at = excluded.suppressed_at
    `).bind(
      crypto.randomUUID(),
      email.toLowerCase(),
      now,
      now
    ).run();
  } catch (error) {
    console.error('[Resend Webhook] Error adding to suppression list:', error);
  }

  // Update email_logs if we have a message ID
  if (messageId) {
    const logResult = await db.prepare(`
      UPDATE email_logs
      SET status = 'complained',
          complained_at = ?,
          updated_at = ?
      WHERE message_id = ? OR resend_id = ?
      RETURNING subscriber_id, step_id, sequence_step_id
    `).bind(now, now, messageId, messageId).first();

    if (logResult?.subscriber_id) {
      // Update subscriber status
      await db.prepare(`
        UPDATE email_subscribers
        SET status = 'complained',
            complained_at = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(now, now, logResult.subscriber_id).run();

      // Cancel all active sequences for this subscriber
      await db.prepare(`
        UPDATE subscriber_sequences
        SET status = 'unsubscribed',
            cancelled_at = ?,
            cancel_reason = 'Marked as spam',
            updated_at = ?
        WHERE subscriber_id = ? AND status IN ('active', 'processing', 'paused', 'queued')
      `).bind(now, now, logResult.subscriber_id).run();
    }

    // Update step stats
    const stepId = logResult?.step_id || logResult?.sequence_step_id;
    if (stepId) {
      await db.prepare(`
        UPDATE sequence_steps
        SET total_complaints = COALESCE(total_complaints, 0) + 1
        WHERE id = ?
      `).bind(stepId).run();
    }
  } else {
    // No message ID - try to find subscriber by email
    await db.prepare(`
      UPDATE email_subscribers
      SET status = 'complained',
          complained_at = ?,
          updated_at = ?
      WHERE email = ?
    `).bind(now, now, email.toLowerCase()).run();
  }
}

/**
 * Handle email.delivered event
 * - Update delivery status
 */
async function handleDelivered(db, data, now) {
  const messageId = data.email_id;
  if (!messageId) return;

  console.log(`[Resend Webhook] Email delivered: ${messageId}`);

  // Update email log
  await db.prepare(`
    UPDATE email_logs
    SET status = CASE WHEN status IN ('queued', 'sending', 'sent') THEN 'delivered' ELSE status END,
        delivered_at = COALESCE(delivered_at, ?),
        updated_at = ?
    WHERE message_id = ? OR resend_id = ?
  `).bind(now, now, messageId, messageId).run();
}

/**
 * Handle email.opened event
 * - Track open engagement
 * - Update subscriber stats
 */
async function handleOpened(db, data, now) {
  const messageId = data.email_id;
  const email = data.to?.[0];

  if (!messageId) return;

  console.log(`[Resend Webhook] Email opened: ${messageId}`);

  // Get open metadata
  const userAgent = data.open?.user_agent || null;
  const ipAddress = data.open?.ip_address || null;

  // Update email log
  const logResult = await db.prepare(`
    UPDATE email_logs
    SET status = CASE WHEN status = 'delivered' THEN 'opened' ELSE status END,
        first_opened_at = COALESCE(first_opened_at, ?),
        last_opened_at = ?,
        open_count = COALESCE(open_count, 0) + 1,
        user_agent = COALESCE(user_agent, ?),
        ip_address = COALESCE(ip_address, ?),
        updated_at = ?
    WHERE message_id = ? OR resend_id = ?
    RETURNING subscriber_id, step_id, sequence_step_id
  `).bind(now, now, userAgent, ipAddress, now, messageId, messageId).first();

  // Update subscriber engagement
  if (logResult?.subscriber_id) {
    await db.prepare(`
      UPDATE email_subscribers
      SET total_emails_opened = COALESCE(total_emails_opened, 0) + 1,
          last_email_opened_at = ?,
          engagement_score = MIN(100, COALESCE(engagement_score, 0) + 5),
          engagement_score_updated_at = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(now, now, now, logResult.subscriber_id).run();
  } else if (email) {
    // Try to find subscriber by email
    await db.prepare(`
      UPDATE email_subscribers
      SET total_emails_opened = COALESCE(total_emails_opened, 0) + 1,
          last_email_opened_at = ?,
          engagement_score = MIN(100, COALESCE(engagement_score, 0) + 5),
          engagement_score_updated_at = ?,
          updated_at = ?
      WHERE email = ?
    `).bind(now, now, now, email.toLowerCase()).run();
  }

  // Update step stats (only count first open per message)
  const stepId = logResult?.step_id || logResult?.sequence_step_id;
  if (stepId) {
    // Only increment if this is the first open for this message
    await db.prepare(`
      UPDATE sequence_steps
      SET total_opens = COALESCE(total_opens, 0) + 1
      WHERE id = ?
        AND NOT EXISTS (
          SELECT 1 FROM email_logs
          WHERE (step_id = ? OR sequence_step_id = ?)
            AND (message_id = ? OR resend_id = ?)
            AND open_count > 1
        )
    `).bind(stepId, stepId, stepId, messageId, messageId).run();
  }
}

/**
 * Handle email.clicked event
 * - Track click engagement
 * - Update subscriber stats
 * - Log clicked URLs
 */
async function handleClicked(db, data, now) {
  const messageId = data.email_id;
  const email = data.to?.[0];
  const clickedUrl = data.click?.link;

  if (!messageId) return;

  console.log(`[Resend Webhook] Email clicked: ${messageId}${clickedUrl ? ` -> ${clickedUrl}` : ''}`);

  // Get current clicks for this message
  const existingLog = await db.prepare(`
    SELECT subscriber_id, step_id, sequence_step_id, clicks_json
    FROM email_logs
    WHERE message_id = ? OR resend_id = ?
  `).bind(messageId, messageId).first();

  // Build updated clicks array
  let clicksArray = [];
  if (existingLog?.clicks_json) {
    try {
      clicksArray = JSON.parse(existingLog.clicks_json);
    } catch (e) {
      clicksArray = [];
    }
  }

  // Add new click if URL provided and not already recorded
  if (clickedUrl) {
    const existingClick = clicksArray.find(c => c.url === clickedUrl);
    if (existingClick) {
      existingClick.count = (existingClick.count || 1) + 1;
      existingClick.last_clicked_at = now;
    } else {
      clicksArray.push({
        url: clickedUrl,
        clicked_at: now,
        count: 1
      });
    }
  }

  // Update email log
  await db.prepare(`
    UPDATE email_logs
    SET status = CASE WHEN status IN ('delivered', 'opened') THEN 'clicked' ELSE status END,
        first_clicked_at = COALESCE(first_clicked_at, ?),
        last_clicked_at = ?,
        click_count = COALESCE(click_count, 0) + 1,
        clicks_json = ?,
        updated_at = ?
    WHERE message_id = ? OR resend_id = ?
  `).bind(now, now, JSON.stringify(clicksArray), now, messageId, messageId).run();

  // Update subscriber engagement
  if (existingLog?.subscriber_id) {
    await db.prepare(`
      UPDATE email_subscribers
      SET total_emails_clicked = COALESCE(total_emails_clicked, 0) + 1,
          last_email_clicked_at = ?,
          engagement_score = MIN(100, COALESCE(engagement_score, 0) + 10),
          engagement_score_updated_at = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(now, now, now, existingLog.subscriber_id).run();
  } else if (email) {
    // Try to find subscriber by email
    await db.prepare(`
      UPDATE email_subscribers
      SET total_emails_clicked = COALESCE(total_emails_clicked, 0) + 1,
          last_email_clicked_at = ?,
          engagement_score = MIN(100, COALESCE(engagement_score, 0) + 10),
          engagement_score_updated_at = ?,
          updated_at = ?
      WHERE email = ?
    `).bind(now, now, now, email.toLowerCase()).run();
  }

  // Update step stats
  const stepId = existingLog?.step_id || existingLog?.sequence_step_id;
  if (stepId) {
    await db.prepare(`
      UPDATE sequence_steps
      SET total_clicks = COALESCE(total_clicks, 0) + 1
      WHERE id = ?
    `).bind(stepId).run();
  }
}

/**
 * Main webhook handler - POST /api/webhooks/resend
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    // Clone request for signature verification (consumes body)
    const clonedRequest = request.clone();

    // Verify webhook signature
    const verification = await verifyWebhookSignature(clonedRequest, env.RESEND_WEBHOOK_SECRET);

    if (!verification.valid) {
      console.error(`[Resend Webhook] Invalid signature: ${verification.error}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid signature'
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Parse the event payload
    const event = JSON.parse(verification.body);
    const { type, data } = event;

    console.log(`[Resend Webhook] Received event: ${type}`);

    const now = Math.floor(Date.now() / 1000);

    // Route to appropriate handler
    switch (type) {
      case 'email.bounced':
        await handleBounce(env.DB, data, now);
        break;

      case 'email.complained':
        await handleComplaint(env.DB, data, now);
        break;

      case 'email.delivered':
        await handleDelivered(env.DB, data, now);
        break;

      case 'email.opened':
        await handleOpened(env.DB, data, now);
        break;

      case 'email.clicked':
        await handleClicked(env.DB, data, now);
        break;

      case 'email.sent':
      case 'email.delivery_delayed':
        // Acknowledge but don't process these events
        console.log(`[Resend Webhook] Acknowledged event: ${type}`);
        break;

      default:
        console.log(`[Resend Webhook] Unhandled event type: ${type}`);
    }

    return new Response(JSON.stringify({
      success: true,
      received: type
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('[Resend Webhook] Error:', error);
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
 * Handle CORS preflight requests - OPTIONS /api/webhooks/resend
 */
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getCorsOrigin(context.request),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, svix-id, svix-timestamp, svix-signature',
      'Access-Control-Max-Age': '86400'
    }
  });
}
