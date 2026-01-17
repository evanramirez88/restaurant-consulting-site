/**
 * Cal.com Booking Endpoint
 * Create a booking via Cal.com
 *
 * POST /api/scheduling/book
 * Body: {
 *   eventTypeId: number,      // Required - Cal.com event type ID
 *   start: string,            // Required - ISO datetime for booking start
 *   name: string,             // Required - Attendee full name
 *   email: string,            // Required - Attendee email
 *   notes?: string,           // Optional - Additional notes
 *   timeZone?: string,        // Optional - Default: America/New_York
 *   phone?: string,           // Optional - Attendee phone
 *   company?: string          // Optional - Company name
 * }
 *
 * Cal.com Username: r-g-consulting
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // Validate API key exists
  if (!env.CALCOM_API_KEY) {
    console.error('[Cal.com] Missing CALCOM_API_KEY environment variable');
    return Response.json({
      success: false,
      error: 'Calendar service not configured'
    }, { status: 503 });
  }

  try {
    const body = await request.json();
    const {
      eventTypeId,
      start,
      name,
      email,
      notes,
      timeZone,
      phone,
      company
    } = body;

    // Validate required fields
    const missingFields = [];
    if (!eventTypeId) missingFields.push('eventTypeId');
    if (!start) missingFields.push('start');
    if (!name) missingFields.push('name');
    if (!email) missingFields.push('email');

    if (missingFields.length > 0) {
      return Response.json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json({
        success: false,
        error: 'Invalid email format'
      }, { status: 400 });
    }

    // Build booking request
    const bookingPayload = {
      eventTypeId: parseInt(eventTypeId, 10),
      start,
      responses: {
        name,
        email,
        notes: notes || ''
      },
      timeZone: timeZone || 'America/New_York',
      language: 'en',
      metadata: {
        source: 'website',
        created_at: new Date().toISOString()
      }
    };

    // Add optional fields to responses if provided
    if (phone) {
      bookingPayload.responses.phone = phone;
    }
    if (company) {
      bookingPayload.responses.company = company;
    }

    console.log('[Cal.com] Creating booking:', JSON.stringify({
      eventTypeId,
      start,
      email,
      timeZone: bookingPayload.timeZone
    }));

    // Create booking via Cal.com API
    const bookingResponse = await fetch('https://api.cal.com/v1/bookings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CALCOM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bookingPayload)
    });

    const bookingData = await bookingResponse.json();

    if (!bookingResponse.ok) {
      console.error('[Cal.com] Booking failed:', bookingResponse.status, JSON.stringify(bookingData));
      return Response.json({
        success: false,
        error: bookingData.message || bookingData.error || 'Booking failed'
      }, { status: bookingResponse.status });
    }

    console.log('[Cal.com] Booking created successfully:', bookingData.uid);

    // Store booking in D1 database
    const now = Math.floor(Date.now() / 1000);
    try {
      await env.DB.prepare(`
        INSERT INTO scheduled_bookings (
          id, email, name, title, start_time, end_time, status, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)
      `).bind(
        bookingData.uid,
        email,
        name,
        bookingData.title || 'Consultation',
        bookingData.startTime,
        bookingData.endTime,
        notes || null,
        now
      ).run();
    } catch (dbError) {
      // Log but don't fail - booking was still created in Cal.com
      console.error('[Cal.com] Failed to store booking in D1:', dbError.message);
    }

    // Enroll in post-booking email sequence
    try {
      const enrollResponse = await fetch(`${new URL(request.url).origin}/api/email/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          segment: 'booking',
          firstName: name.split(' ')[0],
          source: 'calcom_booking',
          metadata: {
            booking_id: bookingData.uid,
            booking_time: bookingData.startTime
          }
        })
      });

      if (!enrollResponse.ok) {
        console.warn('[Cal.com] Email enrollment failed, continuing anyway');
      }
    } catch (enrollError) {
      // Log but don't fail - booking was still created
      console.warn('[Cal.com] Failed to enroll in email sequence:', enrollError.message);
    }

    // Return success response
    return Response.json({
      success: true,
      booking: {
        id: bookingData.id,
        uid: bookingData.uid,
        title: bookingData.title,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        status: bookingData.status || 'confirmed',
        attendees: bookingData.attendees?.map(a => ({
          name: a.name,
          email: a.email
        })) || [{ name, email }]
      },
      message: 'Booking confirmed! You will receive a confirmation email shortly.'
    });

  } catch (error) {
    console.error('[Cal.com] Booking error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Get booking details by UID
 * GET /api/scheduling/book?uid=<booking_uid>
 */
export async function onRequestGet(context) {
  const { env } = context;
  const url = new URL(context.request.url);
  const uid = url.searchParams.get('uid');

  if (!uid) {
    return Response.json({
      success: false,
      error: 'Missing uid parameter'
    }, { status: 400 });
  }

  if (!env.CALCOM_API_KEY) {
    return Response.json({
      success: false,
      error: 'Calendar service not configured'
    }, { status: 503 });
  }

  try {
    const bookingResponse = await fetch(`https://api.cal.com/v1/bookings/${uid}`, {
      headers: {
        'Authorization': `Bearer ${env.CALCOM_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!bookingResponse.ok) {
      if (bookingResponse.status === 404) {
        return Response.json({
          success: false,
          error: 'Booking not found'
        }, { status: 404 });
      }
      throw new Error(`Cal.com API error: ${bookingResponse.status}`);
    }

    const booking = await bookingResponse.json();

    return Response.json({
      success: true,
      booking: {
        id: booking.id,
        uid: booking.uid,
        title: booking.title,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status
      }
    });

  } catch (error) {
    console.error('[Cal.com] Get booking error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
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
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
