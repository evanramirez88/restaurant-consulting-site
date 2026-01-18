/**
 * Email Sequence Enrollment Endpoint
 * Enrolls contacts into email sequences based on segment
 * 
 * POST /api/email/enroll
 * Body: { email, sequenceId?, segment?, firstName?, lastName?, company? }
 */

interface Env {
  DB: D1Database;
}

interface EnrollRequest {
  email: string;
  sequenceId?: string;
  segment?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  source?: string;
}

// Segment to sequence mapping
const SEGMENT_SEQUENCES: Record<string, string> = {
  'A': 'seq_pos_switcher_001',      // POS Switcher Outreach
  'B': 'seq_toast_support_001',     // Toast Support Plan Outreach
  'C': 'seq_transition_001',        // Ownership Transition Outreach
  'D': 'seq_local_network_001',     // Local Network Outreach
  'menu': 'seq_menu_work_001',      // Remote Menu Work
  'booking': 'seq_booking_confirm_001',  // Booking Confirmation
  'post_meeting': 'seq_post_meeting_001', // Post-Meeting Follow-up
  'noshow': 'seq_noshow_001',       // No-Show Re-engagement
  'welcome': 'seq_welcome_001',     // Welcome sequence for new subscribers
  'new_subscriber': 'seq_welcome_001',
  'subscription_created': 'seq_welcome_001',
  'payment_failed': 'seq_payment_failed_001' // Payment failure recovery
};

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  try {
    const body = await request.json() as EnrollRequest;
    
    // Validate required fields
    if (!body.email || !body.email.includes('@')) {
      return Response.json({ 
        success: false, 
        error: 'Valid email is required' 
      }, { status: 400 });
    }

    const email = body.email.toLowerCase().trim();

    // Determine sequence ID
    let sequenceId = body.sequenceId;
    if (!sequenceId && body.segment) {
      sequenceId = SEGMENT_SEQUENCES[body.segment.toUpperCase()] || SEGMENT_SEQUENCES[body.segment];
    }
    
    if (!sequenceId) {
      return Response.json({ 
        success: false, 
        error: 'Either sequenceId or valid segment is required',
        validSegments: Object.keys(SEGMENT_SEQUENCES)
      }, { status: 400 });
    }

    // Check if sequence exists and is active
    const sequence = await env.DB.prepare(
      'SELECT id, name, status FROM email_sequences WHERE id = ?'
    ).bind(sequenceId).first() as { id: string; name: string; status: string } | null;

    if (!sequence) {
      return Response.json({ 
        success: false, 
        error: `Sequence not found: ${sequenceId}` 
      }, { status: 404 });
    }

    if (sequence.status !== 'active') {
      return Response.json({ 
        success: false, 
        error: `Sequence is not active: ${sequence.name}` 
      }, { status: 400 });
    }

    // Check suppression list
    const suppressed = await env.DB.prepare(
      'SELECT 1 FROM email_suppression_list WHERE email = ?'
    ).bind(email).first();

    if (suppressed) {
      return Response.json({ 
        success: false, 
        enrolled: false, 
        reason: 'suppressed',
        message: 'Email is on suppression list'
      });
    }

    // Find or create subscriber
    let subscriber = await env.DB.prepare(
      'SELECT id, status FROM email_subscribers WHERE email = ?'
    ).bind(email).first() as { id: string; status: string } | null;

    if (!subscriber) {
      // Create new subscriber with UUID
      const subscriberId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO email_subscribers (
          id,
          email,
          first_name,
          last_name,
          company,
          status,
          segment,
          source,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, unixepoch(), unixepoch())
      `).bind(
        subscriberId,
        email,
        body.firstName || null,
        body.lastName || null,
        body.company || null,
        body.segment || null,
        body.source || 'api'
      ).run();

      subscriber = { id: subscriberId, status: 'active' };
    }

    // Check if subscriber is active
    if (subscriber.status !== 'active') {
      return Response.json({ 
        success: false, 
        enrolled: false, 
        reason: 'inactive',
        message: `Subscriber status is: ${subscriber.status}`
      });
    }

    // Check if already enrolled in this sequence
    const existingEnrollment = await env.DB.prepare(
      'SELECT id, status FROM subscriber_sequences WHERE subscriber_id = ? AND sequence_id = ?'
    ).bind(subscriber.id, sequenceId).first() as { id: number; status: string } | null;

    if (existingEnrollment) {
      return Response.json({ 
        success: true,
        enrolled: false, 
        reason: 'already_enrolled',
        enrollmentStatus: existingEnrollment.status,
        message: `Already enrolled in ${sequence.name}`
      });
    }

    // Get first step of sequence for scheduling
    const firstStep = await env.DB.prepare(`
      SELECT id, delay_value, delay_unit
      FROM sequence_steps
      WHERE sequence_id = ?
      ORDER BY step_number ASC
      LIMIT 1
    `).bind(sequenceId).first() as { id: string; delay_value: number; delay_unit: string } | null;

    if (!firstStep) {
      return Response.json({
        success: false,
        error: 'Sequence has no steps configured'
      }, { status: 500 });
    }

    // Calculate delay in milliseconds based on delay_value and delay_unit
    const delayValue = firstStep.delay_value || 0;
    const delayUnit = firstStep.delay_unit || 'hours';
    let delayMs = 0;
    switch (delayUnit) {
      case 'minutes': delayMs = delayValue * 60 * 1000; break;
      case 'hours': delayMs = delayValue * 60 * 60 * 1000; break;
      case 'days': delayMs = delayValue * 24 * 60 * 60 * 1000; break;
      default: delayMs = delayValue * 60 * 60 * 1000;
    }
    const nextStepScheduledAt = Math.floor((Date.now() + delayMs) / 1000); // Unix timestamp in seconds

    // Enroll subscriber in sequence
    await env.DB.prepare(`
      INSERT INTO subscriber_sequences (
        id,
        subscriber_id,
        sequence_id,
        status,
        current_step_number,
        current_step_id,
        next_step_scheduled_at,
        enrolled_at,
        updated_at
      )
      VALUES (?, ?, ?, 'queued', 1, ?, ?, unixepoch(), unixepoch())
    `).bind(
      crypto.randomUUID(),
      subscriber.id,
      sequenceId,
      firstStep.id,
      nextStepScheduledAt
    ).run();

    return Response.json({
      success: true,
      enrolled: true,
      subscriberId: subscriber.id,
      sequenceId: sequenceId,
      sequenceName: sequence.name,
      firstEmailScheduled: new Date(nextStepScheduledAt * 1000).toISOString() // Convert Unix seconds to Date
    });

  } catch (error: any) {
    console.error('Enrollment error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// GET endpoint to list available sequences
export async function onRequestGet({ env }: { env: Env }): Promise<Response> {
  try {
    const sequences = await env.DB.prepare(`
      SELECT id, name, sequence_type, status,
             (SELECT COUNT(*) FROM sequence_steps WHERE sequence_id = email_sequences.id) as step_count
      FROM email_sequences
      WHERE status = 'active'
      ORDER BY name
    `).all();

    return Response.json({
      success: true,
      sequences: sequences.results,
      segmentMapping: SEGMENT_SEQUENCES
    });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
