/// <reference types="@cloudflare/workers-types" />

/**
 * Resend Webhook Handler
 *
 * Handles webhook events from Resend for email tracking:
 * - email.delivered: Email was delivered
 * - email.opened: Email was opened
 * - email.clicked: Link in email was clicked
 * - email.bounced: Email bounced (hard or soft)
 * - email.complained: Email marked as spam
 *
 * Webhook signatures are verified using svix.
 */

import { Webhook } from 'svix';

interface Env {
  DB: D1Database;
  RESEND_WEBHOOK_SECRET: string;
}

// Resend webhook event types
type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.opened'
  | 'email.clicked'
  | 'email.bounced'
  | 'email.complained';

interface ResendWebhookPayload {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // For clicked events
    click?: {
      link: string;
      timestamp: string;
      user_agent: string;
      ip_address: string;
    };
    // For bounced events
    bounce?: {
      type: 'hard' | 'soft';
      message: string;
    };
    // For opened events
    open?: {
      timestamp: string;
      user_agent: string;
      ip_address: string;
    };
  };
}

/**
 * Verify Resend webhook signature using svix
 */
async function verifyWebhookSignature(
  request: Request,
  secret: string
): Promise<{ valid: boolean; payload?: ResendWebhookPayload; error?: string }> {
  try {
    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return { valid: false, error: 'Missing svix headers' };
    }

    const body = await request.text();
    const wh = new Webhook(secret);

    const payload = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendWebhookPayload;

    return { valid: true, payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown verification error';
    return { valid: false, error: message };
  }
}

/**
 * Handle email.delivered event
 */
async function handleDelivered(env: Env, data: ResendWebhookPayload['data']): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  // Update email_logs
  await env.DB.prepare(`
    UPDATE email_logs
    SET status = 'delivered', delivered_at = ?
    WHERE message_id = ?
  `).bind(now, data.email_id).run();

  console.log(`[Resend Webhook] Email delivered: ${data.email_id}`);
}

/**
 * Handle email.opened event
 */
async function handleOpened(env: Env, data: ResendWebhookPayload['data']): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  // Update email_logs
  const logResult = await env.DB.prepare(`
    UPDATE email_logs
    SET status = CASE WHEN status = 'delivered' THEN 'opened' ELSE status END,
        first_opened_at = COALESCE(first_opened_at, ?),
        open_count = open_count + 1,
        user_agent = ?,
        ip_address = ?,
        updated_at = ?
    WHERE message_id = ?
    RETURNING subscriber_id, step_id
  `).bind(
    now,
    data.open?.user_agent || null,
    data.open?.ip_address || null,
    now,
    data.email_id
  ).first<{ subscriber_id: string; step_id: string }>();

  if (logResult?.subscriber_id) {
    // Update subscriber stats
    await env.DB.prepare(`
      UPDATE email_subscribers
      SET total_emails_opened = total_emails_opened + 1,
          last_email_first_opened_at = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(now, now, logResult.subscriber_id).run();
  }

  if (logResult?.step_id) {
    // Update step stats (only count first open)
    await env.DB.prepare(`
      UPDATE sequence_steps
      SET total_opens = total_opens + 1
      WHERE id = ? AND NOT EXISTS (
        SELECT 1 FROM email_logs
        WHERE step_id = ? AND message_id = ? AND open_count > 1
      )
    `).bind(logResult.step_id, logResult.step_id, data.email_id).run();
  }

  console.log(`[Resend Webhook] Email opened: ${data.email_id}`);
}

/**
 * Handle email.clicked event
 */
async function handleClicked(env: Env, data: ResendWebhookPayload['data']): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  // Get current clicked links
  const existingLog = await env.DB.prepare(`
    SELECT subscriber_id, step_id, clicks_json
    FROM email_logs WHERE message_id = ?
  `).bind(data.email_id).first<{
    subscriber_id: string;
    step_id: string;
    clicks_json: string | null;
  }>();

  // Update clicked links
  const existingLinks = existingLog?.clicks_json
    ? JSON.parse(existingLog.clicks_json)
    : [];
  if (data.click?.link && !existingLinks.includes(data.click.link)) {
    existingLinks.push(data.click.link);
  }

  // Update email_logs
  await env.DB.prepare(`
    UPDATE email_logs
    SET status = CASE WHEN status IN ('delivered', 'opened') THEN 'clicked' ELSE status END,
        first_clicked_at = COALESCE(first_clicked_at, ?),
        click_count = click_count + 1,
        clicks_json = ?,
        updated_at = ?
    WHERE message_id = ?
  `).bind(now, JSON.stringify(existingLinks), now, data.email_id).run();

  if (existingLog?.subscriber_id) {
    // Update subscriber stats
    await env.DB.prepare(`
      UPDATE email_subscribers
      SET total_emails_clicked = total_emails_clicked + 1,
          last_email_first_clicked_at = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(now, now, existingLog.subscriber_id).run();
  }

  if (existingLog?.step_id) {
    // Update step stats
    await env.DB.prepare(`
      UPDATE sequence_steps
      SET total_clicks = total_clicks + 1
      WHERE id = ?
    `).bind(existingLog.step_id).run();
  }

  console.log(`[Resend Webhook] Email clicked: ${data.email_id}, link: ${data.click?.link}`);
}

/**
 * Handle email.bounced event
 */
async function handleBounced(env: Env, data: ResendWebhookPayload['data']): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const bounceType = data.bounce?.type || 'hard';
  const bounceMessage = data.bounce?.message || 'Unknown bounce reason';

  // Update email_logs
  const logResult = await env.DB.prepare(`
    UPDATE email_logs
    SET status = 'bounced', bounced_at = ?, bounce_message = ?
    WHERE message_id = ?
    RETURNING subscriber_id, step_id
  `).bind(now, bounceMessage, data.email_id).first<{
    subscriber_id: string;
    step_id: string;
  }>();

  if (logResult?.subscriber_id) {
    // Mark subscriber as bounced
    await env.DB.prepare(`
      UPDATE email_subscribers
      SET status = 'bounced',
          bounce_type = ?,
          bounce_reason = ?,
          bounced_at = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(bounceType, bounceMessage, now, now, logResult.subscriber_id).run();

    // Cancel all pending sequences for this subscriber
    await env.DB.prepare(`
      UPDATE subscriber_sequences
      SET status = 'bounced',
          cancelled_at = ?,
          cancel_reason = 'Email bounced',
          updated_at = ?
      WHERE subscriber_id = ? AND status IN ('active', 'processing', 'paused')
    `).bind(now, now, logResult.subscriber_id).run();

    console.log(`[Resend Webhook] Subscriber bounced: ${logResult.subscriber_id}`);
  }

  if (logResult?.step_id) {
    // Update step stats
    await env.DB.prepare(`
      UPDATE sequence_steps
      SET total_bounces = total_bounces + 1
      WHERE id = ?
    `).bind(logResult.step_id).run();
  }

  console.log(`[Resend Webhook] Email bounced: ${data.email_id}, type: ${bounceType}`);
}

/**
 * Handle email.complained event (marked as spam)
 */
async function handleComplained(env: Env, data: ResendWebhookPayload['data']): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  // Update email_logs
  const logResult = await env.DB.prepare(`
    UPDATE email_logs
    SET status = 'complained', complained_at = ?
    WHERE message_id = ?
    RETURNING subscriber_id, step_id
  `).bind(now, data.email_id).first<{
    subscriber_id: string;
    step_id: string;
  }>();

  if (logResult?.subscriber_id) {
    // Mark subscriber as complained
    await env.DB.prepare(`
      UPDATE email_subscribers
      SET status = 'complained',
          complained_at = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(now, now, logResult.subscriber_id).run();

    // Cancel all pending sequences for this subscriber
    await env.DB.prepare(`
      UPDATE subscriber_sequences
      SET status = 'unsubscribed',
          cancelled_at = ?,
          cancel_reason = 'Marked as spam',
          updated_at = ?
      WHERE subscriber_id = ? AND status IN ('active', 'processing', 'paused')
    `).bind(now, now, logResult.subscriber_id).run();

    console.log(`[Resend Webhook] Subscriber complained: ${logResult.subscriber_id}`);
  }

  if (logResult?.step_id) {
    // Update step stats
    await env.DB.prepare(`
      UPDATE sequence_steps
      SET total_complaints = total_complaints + 1
      WHERE id = ?
    `).bind(logResult.step_id).run();
  }

  console.log(`[Resend Webhook] Email complained: ${data.email_id}`);
}

/**
 * Main webhook handler
 */
export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // Verify webhook signature
    if (!env.RESEND_WEBHOOK_SECRET) {
      console.error('[Resend Webhook] Missing RESEND_WEBHOOK_SECRET');
      return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const verification = await verifyWebhookSignature(request, env.RESEND_WEBHOOK_SECRET);

    if (!verification.valid || !verification.payload) {
      console.error(`[Resend Webhook] Verification failed: ${verification.error}`);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const event = verification.payload;
    console.log(`[Resend Webhook] Received event: ${event.type}`);

    // Handle event based on type
    switch (event.type) {
      case 'email.delivered':
        await handleDelivered(env, event.data);
        break;

      case 'email.opened':
        await handleOpened(env, event.data);
        break;

      case 'email.clicked':
        await handleClicked(env, event.data);
        break;

      case 'email.bounced':
        await handleBounced(env, event.data);
        break;

      case 'email.complained':
        await handleComplained(env, event.data);
        break;

      case 'email.sent':
      case 'email.delivery_delayed':
        // Log but don't process these events
        console.log(`[Resend Webhook] Ignored event: ${event.type}`);
        break;

      default:
        console.warn(`[Resend Webhook] Unknown event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('[Resend Webhook] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

/**
 * Handle CORS preflight requests
 */
export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, svix-id, svix-timestamp, svix-signature',
      'Access-Control-Max-Age': '86400',
    },
  });
}
