/// <reference types="@cloudflare/workers-types" />

/**
 * Cal.com Webhook Handler
 *
 * Handles webhook events from Cal.com for booking-triggered email sequences:
 * - BOOKING_CREATED: New booking created - trigger confirmation sequence
 * - BOOKING_CANCELLED: Booking cancelled - send cancellation notice
 * - BOOKING_RESCHEDULED: Booking rescheduled - update reminders
 * - MEETING_ENDED: Meeting ended - trigger follow-up sequence
 *
 * Signature verification uses HMAC-SHA256.
 */

interface Env {
  DB: D1Database;
  RATE_LIMIT_KV: KVNamespace;
  CALCOM_WEBHOOK_SECRET: string;
}

// Cal.com webhook event types
type CalComEventType =
  | 'BOOKING_CREATED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_RESCHEDULED'
  | 'MEETING_ENDED'
  | 'AFTER_GUESTS_CAL_VIDEO_NO_SHOW';

interface CalComWebhookPayload {
  triggerEvent: CalComEventType;
  createdAt: string;
  payload: {
    uid: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    attendees: Array<{
      email: string;
      name: string;
      timeZone: string;
    }>;
    organizer: {
      email: string;
      name: string;
      timeZone: string;
    };
    location?: string;
    meetingUrl?: string;
    rescheduleUid?: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Verify Cal.com webhook signature using HMAC-SHA256
 */
async function verifySignature(
  request: Request,
  secret: string
): Promise<{ valid: boolean; payload?: CalComWebhookPayload; error?: string }> {
  try {
    const signature = request.headers.get('x-cal-signature-256');
    if (!signature) {
      return { valid: false, error: 'Missing x-cal-signature-256 header' };
    }

    const body = await request.text();

    // Create HMAC-SHA256 hash using Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(body);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }

    const payload = JSON.parse(body) as CalComWebhookPayload;
    return { valid: true, payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown verification error';
    return { valid: false, error: message };
  }
}

/**
 * Find or create email subscriber from attendee
 */
async function findOrCreateSubscriber(
  env: Env,
  attendee: { email: string; name: string; timeZone: string }
): Promise<string> {
  // Check if subscriber exists
  const existing = await env.DB.prepare(`
    SELECT id FROM email_subscribers WHERE email = ?
  `).bind(attendee.email).first<{ id: string }>();

  if (existing) {
    return existing.id;
  }

  // Create new subscriber
  const id = crypto.randomUUID();
  const nameParts = attendee.name.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  await env.DB.prepare(`
    INSERT INTO email_subscribers (id, email, first_name, last_name, timezone, source, status)
    VALUES (?, ?, ?, ?, ?, 'calcom_booking', 'active')
  `).bind(id, attendee.email, firstName, lastName, attendee.timeZone).run();

  return id;
}

/**
 * Enroll subscriber in a sequence
 */
async function enrollInSequence(
  env: Env,
  subscriberId: string,
  sequenceSlug: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  // Find sequence by slug
  const sequence = await env.DB.prepare(`
    SELECT id FROM email_sequences WHERE slug = ? AND status = 'active'
  `).bind(sequenceSlug).first<{ id: string }>();

  if (!sequence) {
    console.log(`[Cal.com Webhook] Sequence not found: ${sequenceSlug}`);
    return;
  }

  // Check if already enrolled
  const existing = await env.DB.prepare(`
    SELECT id FROM subscriber_sequences
    WHERE subscriber_id = ? AND sequence_id = ? AND status IN ('active', 'queued')
  `).bind(subscriberId, sequence.id).first<{ id: string }>();

  if (existing) {
    console.log(`[Cal.com Webhook] Already enrolled in sequence: ${sequenceSlug}`);
    return;
  }

  // Get first step
  const firstStep = await env.DB.prepare(`
    SELECT id, delay_value, delay_unit FROM sequence_steps
    WHERE sequence_id = ? ORDER BY step_number ASC LIMIT 1
  `).bind(sequence.id).first<{ id: string; delay_value: number; delay_unit: string }>();

  if (!firstStep) {
    console.log(`[Cal.com Webhook] No steps in sequence: ${sequenceSlug}`);
    return;
  }

  // Calculate next execution time
  const now = Math.floor(Date.now() / 1000);
  let delaySeconds = 0;
  switch (firstStep.delay_unit) {
    case 'minutes': delaySeconds = firstStep.delay_value * 60; break;
    case 'hours': delaySeconds = firstStep.delay_value * 3600; break;
    case 'days': delaySeconds = firstStep.delay_value * 86400; break;
    case 'weeks': delaySeconds = firstStep.delay_value * 604800; break;
  }

  // Create enrollment
  const enrollmentId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO subscriber_sequences (
      id, subscriber_id, sequence_id, current_step_id, current_step_number,
      status, enrolled_at, started_at, next_step_scheduled_at, enrollment_source, enrollment_data_json
    ) VALUES (?, ?, ?, ?, 1, 'active', ?, ?, ?, 'calcom_webhook', ?)
  `).bind(
    enrollmentId,
    subscriberId,
    sequence.id,
    firstStep.id,
    now,
    now,
    now + delaySeconds,
    JSON.stringify(metadata || {})
  ).run();

  console.log(`[Cal.com Webhook] Enrolled in sequence: ${sequenceSlug}`);
}

/**
 * Schedule a reminder email via KV
 */
async function scheduleReminder(
  env: Env,
  bookingUid: string,
  reminderType: string,
  sendAt: number,
  data: Record<string, unknown>
): Promise<void> {
  const key = `reminder:${bookingUid}:${reminderType}`;
  const ttl = Math.max(1, sendAt - Math.floor(Date.now() / 1000) + 3600);

  await env.RATE_LIMIT_KV.put(key, JSON.stringify({
    sendAt,
    ...data,
  }), { expirationTtl: ttl });

  console.log(`[Cal.com Webhook] Scheduled reminder: ${reminderType} at ${new Date(sendAt * 1000).toISOString()}`);
}

/**
 * Cancel scheduled reminders for a booking
 */
async function cancelReminders(env: Env, bookingUid: string): Promise<void> {
  const reminderTypes = ['24h', '1h', 'followup'];
  for (const type of reminderTypes) {
    const key = `reminder:${bookingUid}:${type}`;
    await env.RATE_LIMIT_KV.delete(key);
  }
  console.log(`[Cal.com Webhook] Cancelled reminders for booking: ${bookingUid}`);
}

/**
 * Handle BOOKING_CREATED event
 */
async function handleBookingCreated(
  env: Env,
  payload: CalComWebhookPayload['payload']
): Promise<void> {
  const attendee = payload.attendees[0];
  if (!attendee) return;

  const subscriberId = await findOrCreateSubscriber(env, attendee);
  const startTime = Math.floor(new Date(payload.startTime).getTime() / 1000);
  const now = Math.floor(Date.now() / 1000);

  // Schedule reminders
  const reminderData = {
    subscriberId,
    bookingUid: payload.uid,
    meetingTitle: payload.title,
    meetingTime: payload.startTime,
    meetingUrl: payload.meetingUrl,
    attendeeEmail: attendee.email,
    attendeeName: attendee.name,
  };

  // 24 hours before
  const reminder24h = startTime - (24 * 3600);
  if (reminder24h > now) {
    await scheduleReminder(env, payload.uid, '24h', reminder24h, reminderData);
  }

  // 1 hour before
  const reminder1h = startTime - 3600;
  if (reminder1h > now) {
    await scheduleReminder(env, payload.uid, '1h', reminder1h, reminderData);
  }

  // Enroll in booking confirmation sequence
  await enrollInSequence(env, subscriberId, 'booking-confirmation', {
    bookingUid: payload.uid,
    meetingTitle: payload.title,
    meetingTime: payload.startTime,
    meetingUrl: payload.meetingUrl,
  });

  console.log(`[Cal.com Webhook] Processed BOOKING_CREATED: ${payload.uid}`);
}

/**
 * Handle BOOKING_CANCELLED event
 */
async function handleBookingCancelled(
  env: Env,
  payload: CalComWebhookPayload['payload']
): Promise<void> {
  const attendee = payload.attendees[0];
  if (!attendee) return;

  // Cancel any scheduled reminders
  await cancelReminders(env, payload.uid);

  // Find subscriber
  const subscriber = await env.DB.prepare(`
    SELECT id FROM email_subscribers WHERE email = ?
  `).bind(attendee.email).first<{ id: string }>();

  if (subscriber) {
    const now = Math.floor(Date.now() / 1000);

    // Cancel any active sequences for this booking
    await env.DB.prepare(`
      UPDATE subscriber_sequences
      SET status = 'completed', completed_at = ?, failure_reason = 'Booking cancelled'
      WHERE subscriber_id = ?
        AND status IN ('active', 'queued')
        AND enrollment_data_json LIKE ?
    `).bind(now, subscriber.id, `%${payload.uid}%`).run();

    // Enroll in cancellation notification (optional sequence)
    await enrollInSequence(env, subscriber.id, 'booking-cancelled', {
      bookingUid: payload.uid,
      meetingTitle: payload.title,
    });
  }

  console.log(`[Cal.com Webhook] Processed BOOKING_CANCELLED: ${payload.uid}`);
}

/**
 * Handle BOOKING_RESCHEDULED event
 */
async function handleBookingRescheduled(
  env: Env,
  payload: CalComWebhookPayload['payload']
): Promise<void> {
  const attendee = payload.attendees[0];
  if (!attendee) return;

  // Cancel old reminders
  if (payload.rescheduleUid) {
    await cancelReminders(env, payload.rescheduleUid);
  }

  // Schedule new reminders
  const subscriberId = await findOrCreateSubscriber(env, attendee);
  const startTime = Math.floor(new Date(payload.startTime).getTime() / 1000);
  const now = Math.floor(Date.now() / 1000);

  const reminderData = {
    subscriberId,
    bookingUid: payload.uid,
    meetingTitle: payload.title,
    meetingTime: payload.startTime,
    meetingUrl: payload.meetingUrl,
    attendeeEmail: attendee.email,
    attendeeName: attendee.name,
    isReschedule: true,
  };

  // 24 hours before
  const reminder24h = startTime - (24 * 3600);
  if (reminder24h > now) {
    await scheduleReminder(env, payload.uid, '24h', reminder24h, reminderData);
  }

  // 1 hour before
  const reminder1h = startTime - 3600;
  if (reminder1h > now) {
    await scheduleReminder(env, payload.uid, '1h', reminder1h, reminderData);
  }

  console.log(`[Cal.com Webhook] Processed BOOKING_RESCHEDULED: ${payload.uid}`);
}

/**
 * Handle MEETING_ENDED event
 */
async function handleMeetingEnded(
  env: Env,
  payload: CalComWebhookPayload['payload']
): Promise<void> {
  const attendee = payload.attendees[0];
  if (!attendee) return;

  const subscriber = await env.DB.prepare(`
    SELECT id FROM email_subscribers WHERE email = ?
  `).bind(attendee.email).first<{ id: string }>();

  if (subscriber) {
    // Enroll in post-meeting follow-up sequence
    await enrollInSequence(env, subscriber.id, 'post-meeting-followup', {
      bookingUid: payload.uid,
      meetingTitle: payload.title,
      meetingEndTime: payload.endTime,
    });
  }

  console.log(`[Cal.com Webhook] Processed MEETING_ENDED: ${payload.uid}`);
}

/**
 * Handle NO_SHOW event
 */
async function handleNoShow(
  env: Env,
  payload: CalComWebhookPayload['payload']
): Promise<void> {
  const attendee = payload.attendees[0];
  if (!attendee) return;

  const subscriber = await env.DB.prepare(`
    SELECT id FROM email_subscribers WHERE email = ?
  `).bind(attendee.email).first<{ id: string }>();

  if (subscriber) {
    // Enroll in no-show re-engagement sequence
    await enrollInSequence(env, subscriber.id, 'noshow-reengagement', {
      bookingUid: payload.uid,
      meetingTitle: payload.title,
      originalTime: payload.startTime,
    });
  }

  console.log(`[Cal.com Webhook] Processed NO_SHOW: ${payload.uid}`);
}

/**
 * Main webhook handler
 */
export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // Verify webhook signature
    if (!env.CALCOM_WEBHOOK_SECRET) {
      console.error('[Cal.com Webhook] Missing CALCOM_WEBHOOK_SECRET');
      return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const verification = await verifySignature(request, env.CALCOM_WEBHOOK_SECRET);

    if (!verification.valid || !verification.payload) {
      console.error(`[Cal.com Webhook] Verification failed: ${verification.error}`);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const event = verification.payload;
    console.log(`[Cal.com Webhook] Received event: ${event.triggerEvent}`);

    // Handle event based on type
    switch (event.triggerEvent) {
      case 'BOOKING_CREATED':
        await handleBookingCreated(env, event.payload);
        break;

      case 'BOOKING_CANCELLED':
        await handleBookingCancelled(env, event.payload);
        break;

      case 'BOOKING_RESCHEDULED':
        await handleBookingRescheduled(env, event.payload);
        break;

      case 'MEETING_ENDED':
        await handleMeetingEnded(env, event.payload);
        break;

      case 'AFTER_GUESTS_CAL_VIDEO_NO_SHOW':
        await handleNoShow(env, event.payload);
        break;

      default:
        console.warn(`[Cal.com Webhook] Unknown event type: ${event.triggerEvent}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('[Cal.com Webhook] Error:', error);
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
      'Access-Control-Allow-Headers': 'Content-Type, x-cal-signature-256',
      'Access-Control-Max-Age': '86400',
    },
  });
}
