/// <reference types="@cloudflare/workers-types" />

/**
 * Email Sequence Dispatcher - Cloudflare Cron Handler
 *
 * Runs every 5 minutes to check for pending emails and dispatch them
 * to the EMAIL_QUEUE for rate-limited processing via Resend.
 *
 * Flow:
 * 1. Query subscriber_sequences where next_execution_time <= now AND status = 'active'
 * 2. Join with email_subscribers (check status = 'active') and sequence_steps
 * 3. Mark records as 'processing' before queue send
 * 4. Personalize content using {{first_name}}, {{company}}, {{email}} tokens
 * 5. Send to EMAIL_QUEUE for rate-limited delivery
 */

interface Env {
  DB: D1Database;
  EMAIL_QUEUE: Queue;
  RESEND_API_KEY: string;
}

interface SubscriberSequenceRow {
  ss_id: string;
  subscriber_id: string;
  sequence_id: string;
  next_step_id: string;
  current_step_number: number;
  // Subscriber fields
  sub_email: string;
  sub_first_name: string | null;
  sub_last_name: string | null;
  sub_company: string | null;
  // Step fields
  step_id: string;
  step_number: number;
  step_subject: string;
  step_from_name: string;
  step_from_email: string;
  step_reply_to: string | null;
  step_body_html: string;
  step_body_text: string | null;
  step_delay_minutes: number;
  step_delay_type: string;
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

/**
 * Personalize email content by replacing tokens with subscriber data
 */
function personalizeContent(
  content: string,
  subscriber: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
  }
): string {
  return content
    .replace(/\{\{first_name\}\}/gi, subscriber.firstName || 'there')
    .replace(/\{\{last_name\}\}/gi, subscriber.lastName || '')
    .replace(/\{\{company\}\}/gi, subscriber.company || 'your business')
    .replace(/\{\{email\}\}/gi, subscriber.email)
    .replace(/\{\{full_name\}\}/gi,
      [subscriber.firstName, subscriber.lastName].filter(Boolean).join(' ') || 'there'
    );
}

/**
 * Generate a unique idempotency key for this email send
 */
function generateIdempotencyKey(
  subscriberSequenceId: string,
  stepNumber: number
): string {
  return `seq_${subscriberSequenceId}_step_${stepNumber}_${Date.now()}`;
}

/**
 * Main scheduled handler - runs every 5 minutes
 */
export async function onScheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  console.log(`[Email Dispatcher] Running at ${new Date().toISOString()}`);

  try {
    // Query pending emails to dispatch
    // Joins subscriber_sequences with email_subscribers and sequence_steps
    const pendingQuery = `
      SELECT
        ss.id as ss_id,
        ss.subscriber_id,
        ss.sequence_id,
        ss.next_step_id,
        ss.current_step_number,
        sub.email as sub_email,
        sub.first_name as sub_first_name,
        sub.last_name as sub_last_name,
        sub.company as sub_company,
        step.id as step_id,
        step.step_number,
        step.subject as step_subject,
        step.from_name as step_from_name,
        step.from_email as step_from_email,
        step.reply_to as step_reply_to,
        step.body_html as step_body_html,
        step.body_text as step_body_text,
        step.delay_minutes as step_delay_minutes,
        step.delay_type as step_delay_type
      FROM subscriber_sequences ss
      INNER JOIN email_subscribers sub ON ss.subscriber_id = sub.id
      INNER JOIN sequence_steps step ON ss.next_step_id = step.id
      WHERE ss.status = 'active'
        AND ss.next_execution_time <= ?
        AND sub.status = 'active'
        AND step.is_active = 1
      ORDER BY ss.next_execution_time ASC
      LIMIT 100
    `;

    const { results } = await env.DB.prepare(pendingQuery)
      .bind(now)
      .all<SubscriberSequenceRow>();

    if (!results || results.length === 0) {
      console.log('[Email Dispatcher] No pending emails to dispatch');
      return;
    }

    console.log(`[Email Dispatcher] Found ${results.length} pending emails`);

    // Process each pending email
    const queueMessages: MessageSendRequest<EmailQueueMessage>[] = [];
    const subscriberSequenceIds: string[] = [];

    for (const row of results) {
      // Generate idempotency key
      const idempotencyKey = generateIdempotencyKey(row.ss_id, row.step_number);

      // Personalize content
      const subscriber = {
        email: row.sub_email,
        firstName: row.sub_first_name,
        lastName: row.sub_last_name,
        company: row.sub_company,
      };

      const personalizedSubject = personalizeContent(row.step_subject, subscriber);
      const personalizedBodyHtml = personalizeContent(row.step_body_html, subscriber);
      const personalizedBodyText = row.step_body_text
        ? personalizeContent(row.step_body_text, subscriber)
        : null;

      // Get next step info for scheduling
      const nextStepQuery = `
        SELECT id, delay_minutes
        FROM sequence_steps
        WHERE sequence_id = ?
          AND step_number = ?
          AND is_active = 1
      `;
      const nextStepResult = await env.DB.prepare(nextStepQuery)
        .bind(row.sequence_id, row.step_number + 1)
        .first<{ id: string; delay_minutes: number }>();

      // Create queue message
      const message: EmailQueueMessage = {
        type: 'sequence_email',
        subscriberSequenceId: row.ss_id,
        subscriberId: row.subscriber_id,
        sequenceStepId: row.step_id,
        toEmail: row.sub_email,
        fromEmail: row.step_from_email,
        fromName: row.step_from_name,
        replyTo: row.step_reply_to,
        subject: personalizedSubject,
        bodyHtml: personalizedBodyHtml,
        bodyText: personalizedBodyText,
        idempotencyKey,
        stepNumber: row.step_number,
        nextStepId: nextStepResult?.id || null,
        nextStepDelayMinutes: nextStepResult?.delay_minutes || null,
      };

      queueMessages.push({ body: message });
      subscriberSequenceIds.push(row.ss_id);
    }

    // Mark all records as 'processing' before sending to queue
    if (subscriberSequenceIds.length > 0) {
      const placeholders = subscriberSequenceIds.map(() => '?').join(',');
      const updateQuery = `
        UPDATE subscriber_sequences
        SET status = 'processing', updated_at = ?
        WHERE id IN (${placeholders})
      `;
      await env.DB.prepare(updateQuery)
        .bind(now, ...subscriberSequenceIds)
        .run();

      console.log(`[Email Dispatcher] Marked ${subscriberSequenceIds.length} sequences as processing`);
    }

    // Send messages to queue in batches
    const BATCH_SIZE = 25;
    for (let i = 0; i < queueMessages.length; i += BATCH_SIZE) {
      const batch = queueMessages.slice(i, i + BATCH_SIZE);
      await env.EMAIL_QUEUE.sendBatch(batch);
      console.log(`[Email Dispatcher] Queued batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} messages)`);
    }

    console.log(`[Email Dispatcher] Successfully queued ${queueMessages.length} emails`);
  } catch (error) {
    console.error('[Email Dispatcher] Error:', error);
    throw error;
  }
}

// Export for Cloudflare Pages Functions
export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    return onScheduled(event, env, ctx);
  },
};
