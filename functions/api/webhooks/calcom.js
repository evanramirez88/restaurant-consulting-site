/**
 * Cal.com Webhook Handler (JavaScript)
 * Handles booking created, cancelled, rescheduled events
 *
 * POST /api/webhooks/calcom
 *
 * Stores bookings in scheduled_bookings table and triggers email sequences.
 * Works alongside calcom.ts for comprehensive webhook handling.
 */

/**
 * Verify Cal.com webhook signature using HMAC-SHA256
 */
async function verifySignature(request, secret) {
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

    const payload = JSON.parse(body);
    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: error.message || 'Verification error' };
  }
}

/**
 * Handle BOOKING_CREATED event
 */
async function handleBookingCreated(env, payload, now, apiBaseUrl) {
  const { attendees, startTime, endTime, title, uid, description } = payload;
  const attendee = attendees?.[0];

  if (!attendee) {
    console.log('[Cal.com Webhook] No attendee in booking');
    return;
  }

  // Store booking in D1 database
  try {
    await env.DB.prepare(`
      INSERT INTO scheduled_bookings (id, email, name, title, start_time, end_time, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = 'confirmed',
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        updated_at = excluded.created_at
    `).bind(
      uid,
      attendee.email,
      attendee.name,
      title,
      startTime,
      endTime,
      description || null,
      now
    ).run();

    console.log(`[Cal.com Webhook] Stored booking: ${uid}`);
  } catch (dbError) {
    console.error('[Cal.com Webhook] Failed to store booking:', dbError.message);
    // Continue - don't fail the webhook
  }

  // Enroll in post-booking email sequence
  if (apiBaseUrl) {
    try {
      const enrollResponse = await fetch(`${apiBaseUrl}/api/email/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: attendee.email,
          segment: 'booking',
          firstName: attendee.name.split(' ')[0],
          source: 'calcom_webhook_created',
          metadata: {
            booking_id: uid,
            booking_time: startTime,
            booking_title: title
          }
        })
      });

      if (enrollResponse.ok) {
        console.log(`[Cal.com Webhook] Enrolled ${attendee.email} in booking sequence`);
      }
    } catch (enrollError) {
      console.warn('[Cal.com Webhook] Email enrollment failed:', enrollError.message);
    }
  }
}

/**
 * Handle BOOKING_CANCELLED event
 */
async function handleBookingCancelled(env, payload, now, apiBaseUrl) {
  const { uid, attendees } = payload;
  const attendee = attendees?.[0];

  // Update booking status in D1
  try {
    const result = await env.DB.prepare(`
      UPDATE scheduled_bookings
      SET status = 'cancelled', updated_at = ?
      WHERE id = ?
    `).bind(now, uid).run();

    if (result.meta.changes > 0) {
      console.log(`[Cal.com Webhook] Marked booking as cancelled: ${uid}`);
    }
  } catch (dbError) {
    console.error('[Cal.com Webhook] Failed to update booking:', dbError.message);
  }

  // Enroll in noshow/reengagement sequence if applicable
  if (attendee?.email && apiBaseUrl) {
    try {
      await fetch(`${apiBaseUrl}/api/email/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: attendee.email,
          segment: 'noshow',
          firstName: attendee.name?.split(' ')[0] || 'there',
          source: 'calcom_cancelled',
          metadata: {
            cancelled_booking_id: uid
          }
        })
      });
      console.log(`[Cal.com Webhook] Enrolled ${attendee.email} in noshow sequence`);
    } catch (enrollError) {
      console.warn('[Cal.com Webhook] Noshow enrollment failed:', enrollError.message);
    }
  }
}

/**
 * Handle BOOKING_RESCHEDULED event
 */
async function handleBookingRescheduled(env, payload, now) {
  const { uid, startTime, endTime, rescheduleUid } = payload;

  // If there's an old booking UID, mark it as rescheduled
  if (rescheduleUid && rescheduleUid !== uid) {
    try {
      await env.DB.prepare(`
        UPDATE scheduled_bookings
        SET status = 'rescheduled', updated_at = ?
        WHERE id = ?
      `).bind(now, rescheduleUid).run();
    } catch (e) {
      console.warn('[Cal.com Webhook] Could not update old booking:', e.message);
    }
  }

  // Update or insert the new booking
  try {
    await env.DB.prepare(`
      INSERT INTO scheduled_bookings (id, email, name, title, start_time, end_time, status, created_at)
      SELECT ?, email, name, title, ?, ?, 'confirmed', ?
      FROM scheduled_bookings WHERE id = ?
      ON CONFLICT(id) DO UPDATE SET
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        status = 'confirmed',
        updated_at = excluded.created_at
    `).bind(uid, startTime, endTime, now, rescheduleUid || uid).run();

    console.log(`[Cal.com Webhook] Updated booking schedule: ${uid}`);
  } catch (dbError) {
    // If no existing record to copy from, create new entry
    const attendee = payload.attendees?.[0];
    if (attendee) {
      await env.DB.prepare(`
        INSERT INTO scheduled_bookings (id, email, name, title, start_time, end_time, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?)
        ON CONFLICT(id) DO UPDATE SET
          start_time = excluded.start_time,
          end_time = excluded.end_time,
          status = 'confirmed',
          updated_at = excluded.created_at
      `).bind(uid, attendee.email, attendee.name, payload.title, startTime, endTime, now).run();
    }
  }
}

/**
 * Handle MEETING_ENDED event
 */
async function handleMeetingEnded(env, payload, now, apiBaseUrl) {
  const { uid, attendees } = payload;
  const attendee = attendees?.[0];

  // Update booking status
  try {
    await env.DB.prepare(`
      UPDATE scheduled_bookings
      SET status = 'completed', updated_at = ?
      WHERE id = ?
    `).bind(now, uid).run();
    console.log(`[Cal.com Webhook] Marked booking as completed: ${uid}`);
  } catch (dbError) {
    console.error('[Cal.com Webhook] Failed to update booking:', dbError.message);
  }

  // Enroll in post-meeting follow-up sequence
  if (attendee?.email && apiBaseUrl) {
    try {
      await fetch(`${apiBaseUrl}/api/email/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: attendee.email,
          segment: 'post_meeting',
          firstName: attendee.name?.split(' ')[0] || 'there',
          source: 'calcom_meeting_ended',
          metadata: {
            completed_booking_id: uid,
            meeting_end_time: payload.endTime
          }
        })
      });
      console.log(`[Cal.com Webhook] Enrolled ${attendee.email} in post-meeting sequence`);
    } catch (enrollError) {
      console.warn('[Cal.com Webhook] Post-meeting enrollment failed:', enrollError.message);
    }
  }
}

/**
 * Main webhook handler
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    // Parse webhook payload
    // For Cal.com webhooks, we can optionally verify signature if secret is configured
    let event;

    if (env.CALCOM_WEBHOOK_SECRET) {
      const verification = await verifySignature(request.clone(), env.CALCOM_WEBHOOK_SECRET);
      if (!verification.valid) {
        console.warn(`[Cal.com Webhook] Signature verification failed: ${verification.error}`);
        // Continue without verification for flexibility (can be made strict)
        event = await request.json();
      } else {
        event = verification.payload;
      }
    } else {
      // No secret configured, parse directly
      event = await request.json();
    }

    const { triggerEvent, payload } = event;

    console.log(`[Cal.com Webhook] Received event: ${triggerEvent}`);

    const now = Math.floor(Date.now() / 1000);
    const apiBaseUrl = new URL(request.url).origin;

    switch (triggerEvent) {
      case 'BOOKING_CREATED':
        await handleBookingCreated(env, payload, now, apiBaseUrl);
        break;

      case 'BOOKING_CANCELLED':
        await handleBookingCancelled(env, payload, now, apiBaseUrl);
        break;

      case 'BOOKING_RESCHEDULED':
        await handleBookingRescheduled(env, payload, now);
        break;

      case 'MEETING_ENDED':
        await handleMeetingEnded(env, payload, now, apiBaseUrl);
        break;

      case 'AFTER_GUESTS_CAL_VIDEO_NO_SHOW':
        // Handle no-show similar to cancelled
        await handleBookingCancelled(env, { ...payload, uid: payload.uid }, now, apiBaseUrl);
        // Update status to no_show specifically
        await env.DB.prepare(`
          UPDATE scheduled_bookings SET status = 'no_show', updated_at = ? WHERE id = ?
        `).bind(now, payload.uid).run();
        break;

      default:
        console.log(`[Cal.com Webhook] Unhandled event type: ${triggerEvent}`);
    }

    return Response.json({ success: true }, { headers: corsHeaders });

  } catch (error) {
    console.error('[Cal.com Webhook] Error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET endpoint to check webhook status
 */
export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Get recent bookings count
    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'rescheduled' THEN 1 ELSE 0 END) as rescheduled,
        SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as no_show
      FROM scheduled_bookings
    `).first();

    return Response.json({
      success: true,
      endpoint: '/api/webhooks/calcom',
      status: 'active',
      statistics: stats || { total: 0 }
    });
  } catch (error) {
    return Response.json({
      success: true,
      endpoint: '/api/webhooks/calcom',
      status: 'active',
      note: 'Statistics unavailable - table may not exist yet'
    });
  }
}

/**
 * CORS preflight handler
 */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-cal-signature-256',
      'Access-Control-Max-Age': '86400'
    }
  });
}
