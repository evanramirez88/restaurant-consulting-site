/**
 * Cal.com Availability Endpoint
 * Get available time slots from Cal.com
 *
 * GET /api/scheduling/availability?eventType=consultation&dateFrom=2026-01-20&dateTo=2026-01-27
 *
 * Query Parameters:
 * - eventType: The event type slug (default: 'consultation')
 * - dateFrom: Start date in ISO format (optional)
 * - dateTo: End date in ISO format (optional)
 *
 * Cal.com Username: r-g-consulting
 */

export async function onRequestGet(context) {
  const { env } = context;
  const url = new URL(context.request.url);

  const eventTypeSlug = url.searchParams.get('eventType') || 'consultation';
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');

  // Validate API key exists
  if (!env.CALCOM_API_KEY) {
    console.error('[Cal.com] Missing CALCOM_API_KEY environment variable');
    return Response.json({
      success: false,
      error: 'Calendar service not configured'
    }, { status: 503 });
  }

  try {
    // Get event types to find the matching one
    const eventTypesResponse = await fetch('https://api.cal.com/v1/event-types', {
      headers: {
        'Authorization': `Bearer ${env.CALCOM_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!eventTypesResponse.ok) {
      const errorText = await eventTypesResponse.text();
      console.error('[Cal.com] Failed to fetch event types:', eventTypesResponse.status, errorText);
      return Response.json({
        success: false,
        error: 'Failed to fetch event types from calendar service'
      }, { status: eventTypesResponse.status });
    }

    const eventTypesData = await eventTypesResponse.json();
    const eventTypes = eventTypesData.event_types || [];

    // Find the requested event type by slug
    const eventType = eventTypes.find(et => et.slug === eventTypeSlug);

    if (!eventType) {
      // Return available event types for debugging
      const availableSlugs = eventTypes.map(et => et.slug);
      return Response.json({
        success: false,
        error: `Event type '${eventTypeSlug}' not found`,
        availableEventTypes: availableSlugs
      }, { status: 404 });
    }

    // Build availability query URL
    const availabilityUrl = new URL('https://api.cal.com/v1/availability');
    availabilityUrl.searchParams.set('eventTypeId', eventType.id.toString());

    // Add date range if provided
    if (dateFrom) {
      availabilityUrl.searchParams.set('dateFrom', dateFrom);
    }
    if (dateTo) {
      availabilityUrl.searchParams.set('dateTo', dateTo);
    }

    // Fetch availability
    const availabilityResponse = await fetch(availabilityUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${env.CALCOM_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!availabilityResponse.ok) {
      const errorText = await availabilityResponse.text();
      console.error('[Cal.com] Failed to fetch availability:', availabilityResponse.status, errorText);
      return Response.json({
        success: false,
        error: 'Failed to fetch availability from calendar service'
      }, { status: availabilityResponse.status });
    }

    const availabilityData = await availabilityResponse.json();

    // Format the response
    return Response.json({
      success: true,
      eventType: {
        id: eventType.id,
        title: eventType.title,
        slug: eventType.slug,
        length: eventType.length,
        description: eventType.description || null
      },
      availability: availabilityData.slots || availabilityData.busy || [],
      dateRange: {
        from: dateFrom || 'default',
        to: dateTo || 'default'
      }
    });

  } catch (error) {
    console.error('[Cal.com] Availability error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * List all available event types
 * GET /api/scheduling/availability (without eventType param returns list)
 */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
