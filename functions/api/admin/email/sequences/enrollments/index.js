/**
 * Batch Enrollments List API
 *
 * GET /api/admin/email/sequences/enrollments
 *
 * Query parameters:
 * - sequence_id: Filter by sequence
 * - status: Filter by status (pending, processing, completed, cancelled, failed)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 *
 * Returns list of batch enrollment operations with their status and progress.
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const url = new URL(context.request.url);

    // Get query parameters
    const sequenceId = url.searchParams.get('sequence_id');
    const status = url.searchParams.get('status');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    // Build query
    const conditions = [];
    const params = [];

    if (sequenceId) {
      conditions.push('be.sequence_id = ?');
      params.push(sequenceId);
    }

    if (status && status !== 'all') {
      conditions.push('be.status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total FROM batch_enrollments be ${whereClause}
    `;
    const countResult = await db.prepare(countQuery).bind(...params).first();
    const total = countResult?.total || 0;

    // Get enrollments with sequence info
    const query = `
      SELECT
        be.*,
        es.name as sequence_name,
        es.type as sequence_type
      FROM batch_enrollments be
      LEFT JOIN email_sequences es ON es.id = be.sequence_id
      ${whereClause}
      ORDER BY be.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const { results } = await db.prepare(query)
      .bind(...params, limit, offset)
      .all();

    // Parse JSON fields
    const enrollments = (results || []).map(enrollment => ({
      ...enrollment,
      source_details: enrollment.source_details
        ? JSON.parse(enrollment.source_details)
        : null,
      drip_config: enrollment.drip_config
        ? JSON.parse(enrollment.drip_config)
        : null
    }));

    return new Response(JSON.stringify({
      success: true,
      data: enrollments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Enrollments GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
