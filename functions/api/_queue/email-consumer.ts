/// <reference types="@cloudflare/workers-types" />

/**
 * Email Queue Consumer - Cloudflare Queue Handler
 *
 * Consumes messages from EMAIL_QUEUE and sends emails via Resend API
 * with rate limiting (max_batch_size: 2 matches Resend's 2/sec limit).
 *
 * Flow:
 * 1. Receive batch of messages from queue
 * 2. Send each email via Resend API with idempotency key
 * 3. On success: log to email_logs, advance subscriber to next step
 * 4. On rate_limit_exceeded: retry message
 * 5. On permanent failure: log error, mark sequence as failed after max retries
 */

interface Env {
  DB: D1Database;
  EMAIL_QUEUE: Queue;
  RESEND_API_KEY: string;
}

interface EmailQueueMessage {
  type: 'sequence_email';
  subscriberSequenceId: string;
  subscriberId: string;
  sequenceStepId: string;
  toEmail: string;
  fromEmail: string;
  fromName: string;
  replyTo: string | null;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  idempotencyKey: string;
  stepNumber: number;
  nextStepId: string | null;
  nextStepDelayMinutes: number | null;
}

interface ResendEmailResponse {
  id: string;
}

interface ResendErrorResponse {
  statusCode: number;
  message: string;
  name: string;
}

/**
 * Generate a unique ID for database records
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

/**
 * Send email via Resend API
 */
async function sendViaResend(
  env: Env,
  message: EmailQueueMessage
): Promise<{ success: boolean; resendId?: string; error?: string; retryable?: boolean }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': message.idempotencyKey,
      },
      body: JSON.stringify({
        from: `${message.fromName} <${message.fromEmail}>`,
        to: [message.toEmail],
        subject: message.subject,
        html: message.bodyHtml,
        text: message.bodyText || undefined,
        reply_to: message.replyTo || undefined,
      }),
    });

    if (response.ok) {
      const data = await response.json() as ResendEmailResponse;
      return { success: true, resendId: data.id };
    }

    const errorData = await response.json() as ResendErrorResponse;

    // Check for rate limit
    if (response.status === 429) {
      console.warn(`[Email Consumer] Rate limited for ${message.toEmail}`);
      return {
        success: false,
        error: 'rate_limit_exceeded',
        retryable: true,
      };
    }

    // Check for other retryable errors (5xx)
    if (response.status >= 500) {
      return {
        success: false,
        error: `Server error: ${errorData.message}`,
        retryable: true,
      };
    }

    // Non-retryable error (4xx except 429)
    return {
      success: false,
      error: errorData.message || `HTTP ${response.status}`,
      retryable: false,
    };
  } catch (error) {
    // Network error - retryable
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Email Consumer] Network error: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
      retryable: true,
    };
  }
}

/**
 * Log email to database
 */
async function logEmail(
  env: Env,
  message: EmailQueueMessage,
  status: string,
  resendId?: string,
  error?: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const logId = generateId('log');

  await env.DB.prepare(`
    INSERT INTO email_logs (
      id, subscriber_id, subscriber_sequence_id, sequence_step_id,
      to_email, from_email, subject, resend_id, idempotency_key,
      status, queued_at, sent_at, error_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    logId,
    message.subscriberId,
    message.subscriberSequenceId,
    message.sequenceStepId,
    message.toEmail,
    message.fromEmail,
    message.subject,
    resendId || null,
    message.idempotencyKey,
    status,
    now,
    status === 'sent' ? now : null,
    error || null,
    now,
    now
  ).run();

  return logId;
}

/**
 * Advance subscriber to next step in sequence
 */
async function advanceToNextStep(
  env: Env,
  message: EmailQueueMessage
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  if (message.nextStepId && message.nextStepDelayMinutes !== null) {
    // Calculate next execution time
    const nextExecutionTime = now + (message.nextStepDelayMinutes * 60);

    await env.DB.prepare(`
      UPDATE subscriber_sequences
      SET status = 'active',
          current_step_number = ?,
          next_step_id = ?,
          next_execution_time = ?,
          last_step_sent_at = ?,
          retry_count = 0,
          last_error = NULL,
          last_error_at = NULL,
          updated_at = ?
      WHERE id = ?
    `).bind(
      message.stepNumber,
      message.nextStepId,
      nextExecutionTime,
      now,
      now,
      message.subscriberSequenceId
    ).run();

    console.log(`[Email Consumer] Advanced ${message.subscriberSequenceId} to step ${message.stepNumber + 1}`);
  } else {
    // No more steps - mark sequence as completed
    await env.DB.prepare(`
      UPDATE subscriber_sequences
      SET status = 'completed',
          current_step_number = ?,
          next_step_id = NULL,
          next_execution_time = NULL,
          last_step_sent_at = ?,
          completed_at = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(
      message.stepNumber,
      now,
      now,
      now,
      message.subscriberSequenceId
    ).run();

    console.log(`[Email Consumer] Completed sequence ${message.subscriberSequenceId}`);
  }

  // Update step stats
  await env.DB.prepare(`
    UPDATE sequence_steps
    SET total_sent = total_sent + 1, updated_at = ?
    WHERE id = ?
  `).bind(now, message.sequenceStepId).run();

  // Update subscriber stats
  await env.DB.prepare(`
    UPDATE email_subscribers
    SET total_emails_sent = total_emails_sent + 1,
        last_email_sent_at = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(now, now, message.subscriberId).run();
}

/**
 * Handle permanent failure
 */
async function handlePermanentFailure(
  env: Env,
  message: EmailQueueMessage,
  error: string
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(`
    UPDATE subscriber_sequences
    SET status = 'active',
        retry_count = retry_count + 1,
        last_error = ?,
        last_error_at = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(error, now, now, message.subscriberSequenceId).run();

  console.error(`[Email Consumer] Permanent failure for ${message.subscriberSequenceId}: ${error}`);
}

/**
 * Main queue handler
 */
export async function queue(
  batch: MessageBatch<EmailQueueMessage>,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  console.log(`[Email Consumer] Processing batch of ${batch.messages.length} messages`);

  for (const msg of batch.messages) {
    const message = msg.body;

    // Validate message type
    if (message.type !== 'sequence_email') {
      console.warn(`[Email Consumer] Unknown message type: ${message.type}`);
      msg.ack();
      continue;
    }

    console.log(`[Email Consumer] Sending email to ${message.toEmail} (step ${message.stepNumber})`);

    // Check if we've exceeded max retries (3 retries = 4 total attempts)
    if (msg.attempts > 3) {
      console.error(`[Email Consumer] Max retries exceeded for ${message.subscriberSequenceId}`);
      await logEmail(env, message, 'failed', undefined, 'Max retries exceeded');
      await handlePermanentFailure(env, message, 'Max retries exceeded after 3 attempts');
      msg.ack();
      continue;
    }

    // Send email via Resend
    const result = await sendViaResend(env, message);

    if (result.success) {
      // Success - log and advance
      await logEmail(env, message, 'sent', result.resendId);
      await advanceToNextStep(env, message);
      msg.ack();
      console.log(`[Email Consumer] Successfully sent to ${message.toEmail}`);
    } else if (result.retryable) {
      // Retryable error - retry with exponential backoff
      const delaySeconds = Math.pow(2, msg.attempts) * 5; // 5s, 10s, 20s, 40s
      console.warn(`[Email Consumer] Retrying ${message.toEmail} in ${delaySeconds}s (attempt ${msg.attempts + 1})`);
      msg.retry({ delaySeconds });
    } else {
      // Permanent failure
      await logEmail(env, message, 'failed', undefined, result.error);
      await handlePermanentFailure(env, message, result.error || 'Unknown error');
      msg.ack();
    }
  }

  console.log(`[Email Consumer] Batch processing complete`);
}

// Export for Cloudflare Workers
export default {
  async queue(
    batch: MessageBatch<EmailQueueMessage>,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    return queue(batch, env, ctx);
  },
};
