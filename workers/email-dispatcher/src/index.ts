/**
 * Email Dispatcher Worker
 *
 * Cloudflare Worker that handles scheduled email dispatch with rate limiting.
 * Uses direct Resend API calls with KV-based throttling (no queues required).
 *
 * Architecture:
 * - Cron trigger runs every 5 minutes
 * - Queries DB for pending emails (max 50 per run)
 * - Sends emails directly via Resend with delays for rate limiting
 * - Updates email_logs and subscriber stats
 * - Handles retries and failures gracefully
 */

interface Env {
  DB: D1Database;
  RATE_LIMIT_KV: KVNamespace;
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
  FROM_NAME: string;
  REPLY_TO: string;
  ENVIRONMENT: string;
  MAX_EMAILS_PER_RUN: string;
  MAX_EMAILS_PER_DAY: string; // Daily send cap (Resend free tier = 100)
  WORKER_API_KEY: string; // Required for /dispatch and /stats endpoints
}

interface SubscriberSequenceRow {
  ss_id: string;
  subscriber_id: string;
  sequence_id: string;
  current_step_number: number;
  ab_variant: string | null;
  sub_email: string;
  sub_first_name: string | null;
  sub_last_name: string | null;
  sub_company: string | null;
  sub_pos_system: string | null;
  step_id: string;
  step_number: number;
  step_subject_a: string;
  step_from_name_a: string | null;
  step_from_email_a: string | null;
  step_reply_to_a: string | null;
  step_body_html_a: string;
  step_body_text_a: string | null;
  step_delay_value: number;
  step_delay_unit: string;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

function personalizeContent(
  content: string,
  subscriber: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    posSystem: string | null;
  }
): string {
  return content
    .replace(/\{\{first_name\}\}/gi, subscriber.firstName || 'there')
    .replace(/\{\{last_name\}\}/gi, subscriber.lastName || '')
    .replace(/\{\{company\}\}/gi, subscriber.company || 'your restaurant')
    .replace(/\{\{email\}\}/gi, subscriber.email)
    .replace(/\{\{pos_system\}\}/gi, subscriber.posSystem || 'your POS')
    .replace(/\{\{full_name\}\}/gi,
      [subscriber.firstName, subscriber.lastName].filter(Boolean).join(' ') || 'there'
    );
}

function calculateDelaySeconds(value: number, unit: string): number {
  switch (unit) {
    case 'minutes': return value * 60;
    case 'hours': return value * 60 * 60;
    case 'days': return value * 60 * 60 * 24;
    case 'weeks': return value * 60 * 60 * 24 * 7;
    default: return value * 60 * 60;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function verifyApiKey(request: Request, env: Env): boolean {
  if (!env.WORKER_API_KEY) {
    console.error('[Auth] WORKER_API_KEY not configured');
    return false;
  }

  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token === env.WORKER_API_KEY) {
      return true;
    }
  }

  // Check X-API-Key header
  const apiKeyHeader = request.headers.get('X-API-Key');
  if (apiKeyHeader === env.WORKER_API_KEY) {
    return true;
  }

  return false;
}

function unauthorizedResponse(message: string = 'Unauthorized'): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================
// RESEND EMAIL SENDER
// ============================================

interface SendResult {
  success: boolean;
  resendId?: string;
  error?: string;
  retryable?: boolean;
}

async function sendEmail(
  env: Env,
  to: string,
  from: string,
  fromName: string,
  replyTo: string,
  subject: string,
  bodyHtml: string,
  bodyText: string | null,
  idempotencyKey: string
): Promise<SendResult> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        from: `${fromName} <${from}>`,
        to: [to],
        subject,
        html: bodyHtml,
        text: bodyText || undefined,
        reply_to: replyTo || undefined,
      }),
    });

    if (response.ok) {
      const data = await response.json() as { id: string };
      return { success: true, resendId: data.id };
    }

    const errorData = await response.json() as { message?: string };

    if (response.status === 429) {
      return { success: false, error: 'rate_limit_exceeded', retryable: true };
    }

    if (response.status >= 500) {
      return { success: false, error: `Server error: ${response.status}`, retryable: true };
    }

    return { success: false, error: errorData.message || `HTTP ${response.status}`, retryable: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage, retryable: true };
  }
}

// ============================================
// DATABASE HELPER FUNCTIONS
// ============================================

async function logEmail(
  env: Env,
  subscriberId: string,
  sequenceId: string | null,
  stepId: string,
  subscriberSequenceId: string,
  toEmail: string,
  fromEmail: string,
  subject: string,
  status: string,
  resendId: string | null,
  error: string | null,
  now: number
): Promise<void> {
  const logId = generateId('log');
  await env.DB.prepare(`
    INSERT INTO email_logs (
      id, subscriber_id, sequence_id, step_id, subscriber_sequence_id,
      message_id, email_to, email_from, subject, send_type, status,
      esp_provider, failure_message, queued_at, sent_at, failed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sequence', ?, 'resend', ?, ?, ?, ?, ?)
  `).bind(
    logId,
    subscriberId,
    sequenceId,
    stepId,
    subscriberSequenceId,
    resendId,
    toEmail,
    fromEmail,
    subject,
    status,
    error,
    now,
    status === 'sent' ? now : null,
    status === 'failed' ? now : null,
    now
  ).run();
}

async function advanceToNextStep(
  env: Env,
  subscriberSequenceId: string,
  subscriberId: string,
  stepId: string,
  sequenceId: string,
  currentStepNumber: number,
  now: number
): Promise<void> {
  // Get next step info
  const nextStepResult = await env.DB.prepare(`
    SELECT id, delay_value, delay_unit
    FROM sequence_steps
    WHERE sequence_id = ?
      AND step_number = ?
      AND status = 'active'
  `).bind(sequenceId, currentStepNumber + 1)
    .first<{ id: string; delay_value: number; delay_unit: string }>();

  if (nextStepResult) {
    const nextExecutionTime = now + calculateDelaySeconds(
      nextStepResult.delay_value,
      nextStepResult.delay_unit
    );

    await env.DB.prepare(`
      UPDATE subscriber_sequences
      SET status = 'active',
          current_step_number = ?,
          current_step_id = ?,
          next_step_scheduled_at = ?,
          emails_sent = emails_sent + 1,
          retry_count = 0,
          failure_reason = NULL,
          updated_at = ?
      WHERE id = ?
    `).bind(
      currentStepNumber + 1,
      nextStepResult.id,
      nextExecutionTime,
      now,
      subscriberSequenceId
    ).run();

    console.log(`[Dispatcher] Advanced ${subscriberSequenceId} to step ${currentStepNumber + 1}`);
  } else {
    // No more steps - mark as completed
    await env.DB.prepare(`
      UPDATE subscriber_sequences
      SET status = 'completed',
          current_step_number = ?,
          current_step_id = NULL,
          next_step_scheduled_at = NULL,
          emails_sent = emails_sent + 1,
          completed_at = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(currentStepNumber, now, now, subscriberSequenceId).run();

    console.log(`[Dispatcher] Completed sequence ${subscriberSequenceId}`);
  }

  // Update step stats
  await env.DB.prepare(`
    UPDATE sequence_steps SET total_sent = total_sent + 1, updated_at = ? WHERE id = ?
  `).bind(now, stepId).run();

  // Update subscriber stats
  await env.DB.prepare(`
    UPDATE email_subscribers
    SET total_emails_sent = total_emails_sent + 1, last_email_sent_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(now, now, subscriberId).run();
}

async function handleEmailFailure(
  env: Env,
  subscriberSequenceId: string,
  error: string,
  retryable: boolean,
  now: number
): Promise<void> {
  if (retryable) {
    // Increment retry count, keep status as active for next run
    await env.DB.prepare(`
      UPDATE subscriber_sequences
      SET status = 'active',
          retry_count = retry_count + 1,
          failure_reason = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(error, now, subscriberSequenceId).run();
  } else {
    // Mark as failed permanently
    await env.DB.prepare(`
      UPDATE subscriber_sequences
      SET status = 'failed',
          failure_reason = ?,
          failed_at = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(error, now, now, subscriberSequenceId).run();
  }
}

// ============================================
// MAIN CRON HANDLER
// ============================================

// ============================================
// DAILY SEND LIMIT (KV-based)
// ============================================

function getDailyKey(): string {
  // Use UTC date as key for consistent daily reset
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `daily_send_count:${date}`;
}

async function getDailySendCount(env: Env): Promise<number> {
  const key = getDailyKey();
  const value = await env.RATE_LIMIT_KV.get(key);
  return value ? parseInt(value, 10) : 0;
}

async function incrementDailySendCount(env: Env, increment: number = 1): Promise<number> {
  const key = getDailyKey();
  const current = await getDailySendCount(env);
  const newCount = current + increment;
  // TTL of 48 hours so old keys auto-expire
  await env.RATE_LIMIT_KV.put(key, String(newCount), { expirationTtl: 172800 });
  return newCount;
}

async function getRemainingDailyQuota(env: Env): Promise<number> {
  const maxPerDay = parseInt(env.MAX_EMAILS_PER_DAY || '100', 10);
  const sentToday = await getDailySendCount(env);
  return Math.max(0, maxPerDay - sentToday);
}

// ============================================
// MAIN CRON HANDLER
// ============================================

async function handleScheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const maxPerRun = parseInt(env.MAX_EMAILS_PER_RUN || '25', 10);
  const maxPerDay = parseInt(env.MAX_EMAILS_PER_DAY || '100', 10);

  console.log(`[Email Dispatcher] Running at ${new Date().toISOString()}`);

  try {
    // Check daily send limit FIRST
    const remainingQuota = await getRemainingDailyQuota(env);
    if (remainingQuota <= 0) {
      const sentToday = await getDailySendCount(env);
      console.log(`[Email Dispatcher] Daily limit reached (${sentToday}/${maxPerDay}). Pausing until tomorrow.`);
      return;
    }

    // Effective limit for this run = min(per-run cap, remaining daily quota)
    const maxEmails = Math.min(maxPerRun, remainingQuota);
    console.log(`[Email Dispatcher] Quota: ${remainingQuota}/${maxPerDay} remaining today, processing up to ${maxEmails} this run`);

    // Check if email automation is enabled
    const flagResult = await env.DB.prepare(`
      SELECT enabled FROM feature_flags WHERE key = 'email_automation_enabled'
    `).first<{ enabled: number }>();

    if (!flagResult?.enabled) {
      console.log('[Email Dispatcher] Email automation is disabled');
      return;
    }

    // Query pending emails to dispatch
    const pendingQuery = `
      SELECT
        ss.id as ss_id,
        ss.subscriber_id,
        ss.sequence_id,
        ss.current_step_number,
        ss.ab_variant,
        ss.retry_count,
        sub.email as sub_email,
        sub.first_name as sub_first_name,
        sub.last_name as sub_last_name,
        sub.company as sub_company,
        sub.pos_system as sub_pos_system,
        step.id as step_id,
        step.step_number,
        step.subject_a as step_subject_a,
        step.from_name_a as step_from_name_a,
        step.from_email_a as step_from_email_a,
        step.reply_to_a as step_reply_to_a,
        step.body_html_a as step_body_html_a,
        step.body_text_a as step_body_text_a,
        step.delay_value as step_delay_value,
        step.delay_unit as step_delay_unit
      FROM subscriber_sequences ss
      INNER JOIN email_subscribers sub ON ss.subscriber_id = sub.id
      INNER JOIN sequence_steps step ON ss.current_step_id = step.id
      INNER JOIN email_sequences seq ON ss.sequence_id = seq.id
      WHERE ss.status IN ('active', 'queued')
        AND ss.next_step_scheduled_at <= ?
        AND ss.retry_count < 3
        AND sub.status = 'active'
        AND step.status = 'active'
        AND seq.status = 'active'
      ORDER BY ss.next_step_scheduled_at ASC
      LIMIT ?
    `;

    const { results } = await env.DB.prepare(pendingQuery)
      .bind(now, maxEmails)
      .all<SubscriberSequenceRow & { retry_count: number }>();

    if (!results || results.length === 0) {
      console.log('[Email Dispatcher] No pending emails to dispatch');
      return;
    }

    console.log(`[Email Dispatcher] Processing ${results.length} pending emails`);

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of results) {
      // Check suppression list
      const suppressed = await env.DB.prepare(`
        SELECT 1 FROM email_suppression_list WHERE email = ? LIMIT 1
      `).bind(row.sub_email).first();

      if (suppressed) {
        console.log(`[Dispatcher] Skipping suppressed: ${row.sub_email}`);
        skipped++;
        continue;
      }

      // Generate idempotency key
      const idempotencyKey = `seq_${row.ss_id}_step_${row.step_number}_${Date.now()}`;

      // Personalize content
      const subscriber = {
        email: row.sub_email,
        firstName: row.sub_first_name,
        lastName: row.sub_last_name,
        company: row.sub_company,
        posSystem: row.sub_pos_system,
      };

      const personalizedSubject = personalizeContent(row.step_subject_a, subscriber);
      const personalizedBodyHtml = personalizeContent(row.step_body_html_a, subscriber);
      const personalizedBodyText = row.step_body_text_a
        ? personalizeContent(row.step_body_text_a, subscriber)
        : null;

      // Send email
      const result = await sendEmail(
        env,
        row.sub_email,
        row.step_from_email_a || env.FROM_EMAIL,
        row.step_from_name_a || env.FROM_NAME,
        row.step_reply_to_a || env.REPLY_TO,
        personalizedSubject,
        personalizedBodyHtml,
        personalizedBodyText,
        idempotencyKey
      );

      if (result.success) {
        // Log success and advance
        await logEmail(
          env, row.subscriber_id, row.sequence_id, row.step_id,
          row.ss_id, row.sub_email, row.step_from_email_a || env.FROM_EMAIL,
          personalizedSubject, 'sent', result.resendId || null, null, now
        );

        await advanceToNextStep(
          env, row.ss_id, row.subscriber_id, row.step_id,
          row.sequence_id, row.step_number, now
        );

        // Increment daily send counter
        const dailyCount = await incrementDailySendCount(env);

        sent++;
        console.log(`[Dispatcher] Sent to ${row.sub_email} (${dailyCount}/${maxPerDay} today)`);

        // Stop if we hit daily limit mid-run
        if (dailyCount >= maxPerDay) {
          console.log(`[Dispatcher] Daily limit reached mid-run (${dailyCount}/${maxPerDay}). Stopping.`);
          break;
        }
      } else {
        // Log failure
        await logEmail(
          env, row.subscriber_id, row.sequence_id, row.step_id,
          row.ss_id, row.sub_email, row.step_from_email_a || env.FROM_EMAIL,
          personalizedSubject, 'failed', null, result.error || 'Unknown error', now
        );

        await handleEmailFailure(
          env, row.ss_id, result.error || 'Unknown error',
          result.retryable || false, now
        );

        failed++;
        console.error(`[Dispatcher] Failed to send to ${row.sub_email}: ${result.error}`);

        // If we hit Resend's rate limit, stop this run entirely
        if (result.error === 'rate_limit_exceeded') {
          console.log(`[Dispatcher] Resend rate limit hit. Stopping run, will retry next cycle.`);
          break;
        }
      }

      // Rate limiting: wait 1000ms between emails (1 email/second for free tier safety)
      await sleep(1000);
    }

    const dailyTotal = await getDailySendCount(env);
    console.log(`[Email Dispatcher] Complete: ${sent} sent, ${failed} failed, ${skipped} skipped | Daily total: ${dailyTotal}/${maxPerDay}`);
  } catch (error) {
    console.error('[Email Dispatcher] Error:', error);
    throw error;
  }
}

// ============================================
// WORKER EXPORTS
// ============================================

export default {
  // Cron trigger handler
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    return handleScheduled(event, env, ctx);
  },

  // HTTP handler (for manual triggers and webhooks)
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Manual dispatch trigger (admin only - requires API key)
    if (url.pathname === '/dispatch' && request.method === 'POST') {
      if (!verifyApiKey(request, env)) {
        return unauthorizedResponse('Invalid or missing API key');
      }

      try {
        await handleScheduled({} as ScheduledEvent, env, ctx);
        return new Response(JSON.stringify({ success: true, message: 'Dispatch triggered' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: String(error) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stats endpoint (admin only - requires API key)
    if (url.pathname === '/stats') {
      if (!verifyApiKey(request, env)) {
        return unauthorizedResponse('Invalid or missing API key');
      }

      try {
        const stats = await env.DB.prepare(`
          SELECT
            (SELECT COUNT(*) FROM email_subscribers WHERE status = 'active') as active_subscribers,
            (SELECT COUNT(*) FROM email_sequences WHERE status = 'active') as active_sequences,
            (SELECT COUNT(*) FROM subscriber_sequences WHERE status = 'active') as active_enrollments,
            (SELECT COUNT(*) FROM subscriber_sequences WHERE status = 'paused') as paused_enrollments,
            (SELECT COUNT(*) FROM email_logs WHERE sent_at > ?) as emails_sent_24h
        `).bind(Math.floor(Date.now() / 1000) - 86400).first();

        const dailySentCount = await getDailySendCount(env);
        const maxPerDay = parseInt(env.MAX_EMAILS_PER_DAY || '100', 10);

        return new Response(JSON.stringify({
          success: true,
          stats,
          daily_quota: {
            sent_today: dailySentCount,
            max_per_day: maxPerDay,
            remaining: Math.max(0, maxPerDay - dailySentCount),
            reset_at: new Date(new Date().setUTCHours(24, 0, 0, 0)).toISOString(),
          }
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: String(error) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('R&G Consulting Email Dispatcher Worker', { status: 200 });
  },
};
