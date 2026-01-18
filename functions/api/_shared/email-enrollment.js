/**
 * Email Enrollment Helper
 *
 * Reusable functions for enrolling contacts into email sequences
 * from various triggers (contact form, HubSpot sync, Stripe webhook, etc.)
 */

// Segment to sequence mapping - maps form/trigger inputs to sequence IDs
const SEGMENT_SEQUENCES = {
  // Primary segments (from contact form services)
  'pos_switcher': 'seq_pos_switcher_001',
  'pos-switcher': 'seq_pos_switcher_001',
  'toast_support': 'seq_toast_support_001',
  'toast-support': 'seq_toast_support_001',
  'transition': 'seq_transition_001',
  'local_network': 'seq_local_network_001',
  'local-network': 'seq_local_network_001',
  'menu_work': 'seq_menu_work_001',
  'menu-work': 'seq_menu_work_001',

  // Letter-based segments (legacy support)
  'A': 'seq_pos_switcher_001',
  'B': 'seq_toast_support_001',
  'C': 'seq_transition_001',
  'D': 'seq_local_network_001',

  // Event-triggered sequences
  'booking': 'seq_booking_confirm_001',
  'booking_confirm': 'seq_booking_confirm_001',
  'post_meeting': 'seq_post_meeting_001',
  'post-meeting': 'seq_post_meeting_001',
  'noshow': 'seq_noshow_001',
  'no_show': 'seq_noshow_001',

  // Subscription-triggered sequences
  'welcome': 'seq_welcome_001',
  'new_subscriber': 'seq_welcome_001',
  'subscription_created': 'seq_welcome_001',
  'payment_failed': 'seq_payment_failed_001',

  // Contact form service mappings
  'toast-pos-consulting': 'seq_toast_support_001',
  'toast-optimization': 'seq_toast_support_001',
  'toast-implementation': 'seq_toast_support_001',
  'restaurant-consulting': 'seq_pos_switcher_001',
  'menu-engineering': 'seq_menu_work_001',
  'network-services': 'seq_local_network_001',
  'general': 'seq_pos_switcher_001'  // Default for general inquiries
};

/**
 * Map a contact form service field to a segment ID
 * @param {string} service - Service selected in contact form
 * @returns {string} - Segment identifier
 */
export function mapServiceToSegment(service) {
  if (!service) return 'general';

  const normalized = service.toLowerCase().trim().replace(/\s+/g, '-');

  // Direct service mappings
  if (normalized.includes('toast')) return 'toast_support';
  if (normalized.includes('pos') || normalized.includes('switch')) return 'pos_switcher';
  if (normalized.includes('menu')) return 'menu_work';
  if (normalized.includes('network') || normalized.includes('cable') || normalized.includes('it')) return 'local_network';
  if (normalized.includes('transition') || normalized.includes('sale') || normalized.includes('owner')) return 'transition';

  return 'general';
}

/**
 * Get the sequence ID for a given segment
 * @param {string} segment - Segment identifier
 * @returns {string|null} - Sequence ID or null if not found
 */
export function getSequenceForSegment(segment) {
  if (!segment) return null;

  // Check direct mapping
  const direct = SEGMENT_SEQUENCES[segment];
  if (direct) return direct;

  // Try normalized versions
  const normalized = segment.toLowerCase().trim().replace(/\s+/g, '_');
  return SEGMENT_SEQUENCES[normalized] || null;
}

/**
 * Enroll a contact in an email sequence
 *
 * @param {Object} env - Cloudflare environment with DB binding
 * @param {Object} params - Enrollment parameters
 * @param {string} params.email - Contact's email address (required)
 * @param {string} params.segment - Segment identifier (optional if sequenceId provided)
 * @param {string} params.sequenceId - Direct sequence ID (optional if segment provided)
 * @param {string} params.firstName - Contact's first name (optional)
 * @param {string} params.lastName - Contact's last name (optional)
 * @param {string} params.company - Contact's company name (optional)
 * @param {string} params.source - Enrollment source (e.g., 'contact_form', 'hubspot_sync', 'stripe_webhook')
 * @returns {Promise<Object>} - Enrollment result
 */
export async function enrollContact(env, params) {
  const {
    email,
    segment,
    sequenceId: providedSequenceId,
    firstName,
    lastName,
    company,
    source = 'api'
  } = params;

  // Validate email
  if (!email || !email.includes('@')) {
    return {
      success: false,
      enrolled: false,
      error: 'Valid email is required'
    };
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Determine sequence ID
  let sequenceId = providedSequenceId;
  if (!sequenceId && segment) {
    sequenceId = getSequenceForSegment(segment);
  }

  if (!sequenceId) {
    return {
      success: false,
      enrolled: false,
      error: `Could not determine sequence for segment: ${segment}`
    };
  }

  try {
    // Check if sequence exists and is active
    const sequence = await env.DB.prepare(
      'SELECT id, name, status FROM email_sequences WHERE id = ?'
    ).bind(sequenceId).first();

    if (!sequence) {
      console.log(`Sequence not found: ${sequenceId} - skipping enrollment`);
      return {
        success: true,  // Not a fatal error
        enrolled: false,
        reason: 'sequence_not_found',
        message: `Sequence ${sequenceId} not configured yet`
      };
    }

    if (sequence.status !== 'active') {
      return {
        success: true,
        enrolled: false,
        reason: 'sequence_inactive',
        message: `Sequence ${sequence.name} is not active`
      };
    }

    // Check suppression list
    const suppressed = await env.DB.prepare(
      'SELECT 1 FROM email_suppression_list WHERE email = ?'
    ).bind(normalizedEmail).first();

    if (suppressed) {
      return {
        success: true,
        enrolled: false,
        reason: 'suppressed',
        message: 'Email is on suppression list'
      };
    }

    // Find or create subscriber
    let subscriber = await env.DB.prepare(
      'SELECT id, status FROM email_subscribers WHERE email = ?'
    ).bind(normalizedEmail).first();

    if (!subscriber) {
      // Create new subscriber
      const result = await env.DB.prepare(`
        INSERT INTO email_subscribers (
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
        VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)
      `).bind(
        normalizedEmail,
        firstName || null,
        lastName || null,
        company || null,
        segment || null,
        source,
        Date.now(),
        Date.now()
      ).run();

      subscriber = { id: result.meta.last_row_id, status: 'active' };
    } else if (subscriber.status !== 'active') {
      return {
        success: true,
        enrolled: false,
        reason: 'subscriber_inactive',
        message: `Subscriber status is: ${subscriber.status}`
      };
    }

    // Check if already enrolled in this sequence
    const existingEnrollment = await env.DB.prepare(
      'SELECT id, status FROM subscriber_sequences WHERE subscriber_id = ? AND sequence_id = ?'
    ).bind(subscriber.id, sequenceId).first();

    if (existingEnrollment) {
      return {
        success: true,
        enrolled: false,
        reason: 'already_enrolled',
        enrollmentStatus: existingEnrollment.status,
        message: `Already enrolled in ${sequence.name}`
      };
    }

    // Get first step of sequence for scheduling
    const firstStep = await env.DB.prepare(`
      SELECT id, delay_value, delay_unit
      FROM sequence_steps
      WHERE sequence_id = ?
      ORDER BY step_number ASC
      LIMIT 1
    `).bind(sequenceId).first();

    if (!firstStep) {
      return {
        success: true,
        enrolled: false,
        reason: 'no_steps',
        message: 'Sequence has no steps configured'
      };
    }

    // Calculate delay in milliseconds based on delay_value and delay_unit
    const delayValue = firstStep.delay_value || 0;
    const delayUnit = firstStep.delay_unit || 'hours';
    let delayMs = 0;
    switch (delayUnit) {
      case 'minutes': delayMs = delayValue * 60 * 1000; break;
      case 'hours': delayMs = delayValue * 60 * 60 * 1000; break;
      case 'days': delayMs = delayValue * 24 * 60 * 60 * 1000; break;
      default: delayMs = delayValue * 60 * 60 * 1000; // default to hours
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

    console.log(`Enrolled ${normalizedEmail} in ${sequence.name} (${sequenceId}) from ${source}`);

    return {
      success: true,
      enrolled: true,
      subscriberId: subscriber.id,
      sequenceId: sequenceId,
      sequenceName: sequence.name,
      firstEmailScheduled: new Date(nextExecutionTime).toISOString()
    };

  } catch (error) {
    console.error(`Email enrollment error for ${normalizedEmail}:`, error);
    return {
      success: false,
      enrolled: false,
      error: error.message || String(error)
    };
  }
}

/**
 * Enroll a contact from a contact form submission
 * Maps the service field to appropriate segment
 *
 * @param {Object} env - Cloudflare environment
 * @param {Object} formData - Contact form data
 * @returns {Promise<Object>} - Enrollment result
 */
export async function enrollFromContactForm(env, formData) {
  const segment = mapServiceToSegment(formData.service);
  const nameParts = (formData.name || '').trim().split(' ');

  return enrollContact(env, {
    email: formData.email,
    segment: segment,
    firstName: nameParts[0] || null,
    lastName: nameParts.slice(1).join(' ') || null,
    company: formData.businessName || formData.company || null,
    source: 'contact_form'
  });
}

/**
 * Enroll a contact from HubSpot sync
 *
 * @param {Object} env - Cloudflare environment
 * @param {Object} contact - HubSpot contact data
 * @returns {Promise<Object>} - Enrollment result
 */
export async function enrollFromHubSpotSync(env, contact) {
  // Determine segment from HubSpot properties
  let segment = contact.properties?.rg_segment;

  // Map current POS to segment if no explicit segment
  if (!segment && contact.properties?.rg_current_pos) {
    const pos = contact.properties.rg_current_pos.toLowerCase();
    if (pos.includes('toast')) {
      segment = 'toast_support';
    } else if (pos.includes('square') || pos.includes('clover') || pos.includes('upserve')) {
      segment = 'pos_switcher';
    }
  }

  // Default segment for HubSpot contacts
  if (!segment) {
    segment = 'pos_switcher';
  }

  return enrollContact(env, {
    email: contact.properties?.email,
    segment: segment,
    firstName: contact.properties?.firstname || null,
    lastName: contact.properties?.lastname || null,
    company: contact.properties?.company || null,
    source: 'hubspot_sync'
  });
}

/**
 * Enroll a customer from Stripe subscription creation
 *
 * @param {Object} env - Cloudflare environment
 * @param {Object} subscription - Stripe subscription object
 * @param {Object} customer - Stripe customer object (optional)
 * @returns {Promise<Object>} - Enrollment result
 */
export async function enrollFromStripeSubscription(env, subscription, customer = null) {
  // Get customer email from subscription or customer object
  const email = customer?.email || subscription.metadata?.email;

  if (!email) {
    return {
      success: false,
      enrolled: false,
      error: 'No email found for subscription'
    };
  }

  // Determine tier/plan from subscription metadata
  const tier = subscription.metadata?.tier || 'standard';

  return enrollContact(env, {
    email: email,
    segment: 'welcome',  // Welcome sequence for new subscribers
    firstName: customer?.name?.split(' ')[0] || subscription.metadata?.firstName || null,
    lastName: customer?.name?.split(' ').slice(1).join(' ') || subscription.metadata?.lastName || null,
    company: customer?.metadata?.company || subscription.metadata?.company || null,
    source: 'stripe_subscription'
  });
}

/**
 * Enroll a contact in payment failure recovery sequence
 *
 * @param {Object} env - Cloudflare environment
 * @param {string} email - Customer email
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} - Enrollment result
 */
export async function enrollForPaymentFailure(env, email, metadata = {}) {
  return enrollContact(env, {
    email: email,
    segment: 'payment_failed',
    firstName: metadata.firstName || null,
    lastName: metadata.lastName || null,
    company: metadata.company || null,
    source: 'stripe_payment_failed'
  });
}

// Export the segment mapping for reference
export { SEGMENT_SEQUENCES };
