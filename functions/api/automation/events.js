/**
 * Automation Events API
 *
 * GET /api/automation/events - List automation events (audit trail)
 *
 * Query Parameters:
 * - job_id: Filter by job ID
 * - event_type: Filter by event type
 * - limit: Number of results (default 50, max 200)
 * - offset: Pagination offset
 */

import { verifyAuth, unauthorizedResponse, getCorsHeaders, handleOptions } from '../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, context.request);
    }

    const db = context.env.DB;
    const url = new URL(context.request.url);

    // Parse query parameters
    const jobId = url.searchParams.get('job_id');
    const eventType = url.searchParams.get('event_type');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Build query
    let whereConditions = [];
    let params = [];

    if (jobId) {
      whereConditions.push('ae.job_id = ?');
      params.push(jobId);
    }

    if (eventType) {
      whereConditions.push('ae.event_type = ?');
      params.push(eventType);
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM automation_events ae ${whereClause}`;
    const countResult = await db.prepare(countQuery).bind(...params).first();
    const total = countResult?.total || 0;

    // Get events
    const query = `
      SELECT
        ae.id,
        ae.job_id,
        ae.step_id,
        ae.event_type,
        ae.event_data_json,
        ae.screenshot_key,
        ae.browser_session_id,
        ae.page_url,
        ae.created_at
      FROM automation_events ae
      ${whereClause}
      ORDER BY ae.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const { results } = await db.prepare(query).bind(...params, limit, offset).all();

    // Transform to response format
    const events = (results || []).map(event => ({
      id: event.id,
      job_id: event.job_id,
      step_id: event.step_id,
      event_type: event.event_type,
      event_data_json: event.event_data_json || '{}',
      screenshot_key: event.screenshot_key,
      browser_session_id: event.browser_session_id,
      page_url: event.page_url,
      created_at: event.created_at ? event.created_at * 1000 : Date.now()
    }));

    return new Response(JSON.stringify({
      success: true,
      data: events,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + events.length < total
      }
    }), {
      headers: getCorsHeaders(context.request)
    });
  } catch (error) {
    console.error('Automation events list error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: getCorsHeaders(context.request)
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
