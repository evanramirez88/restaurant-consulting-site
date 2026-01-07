/**
 * Single Batch Enrollment API
 *
 * GET /api/admin/email/sequences/enrollments/[enrollmentId]
 *
 * Returns detailed information about a specific batch enrollment,
 * including progress, errors, and subscriber-level status.
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
    const enrollmentId = context.params.enrollmentId;

    // Get enrollment with sequence info
    const enrollment = await db.prepare(`
      SELECT
        be.*,
        es.name as sequence_name,
        es.type as sequence_type,
        es.status as sequence_status
      FROM batch_enrollments be
      LEFT JOIN email_sequences es ON es.id = be.sequence_id
      WHERE be.id = ?
    `).bind(enrollmentId).first();

    if (!enrollment) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Enrollment not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Parse JSON fields
    enrollment.source_details = enrollment.source_details
      ? JSON.parse(enrollment.source_details)
      : null;
    enrollment.drip_config = enrollment.drip_config
      ? JSON.parse(enrollment.drip_config)
      : null;

    // Get errors for this enrollment
    let errors = [];
    try {
      const { results: errorResults } = await db.prepare(`
        SELECT * FROM enrollment_errors
        WHERE enrollment_id = ?
        ORDER BY created_at DESC
        LIMIT 100
      `).bind(enrollmentId).all();

      errors = errorResults || [];
    } catch (err) {
      // Table might not exist yet
      console.error('Error fetching enrollment errors:', err);
    }

    // Calculate progress percentage
    const progressPercent = enrollment.total_count > 0
      ? Math.round((enrollment.processed_count / enrollment.total_count) * 100)
      : 0;

    // Estimate completion time for processing enrollments
    let estimatedCompletion = null;
    if (enrollment.status === 'processing' && enrollment.started_at) {
      const elapsed = Math.floor(Date.now() / 1000) - enrollment.started_at;
      const rate = enrollment.processed_count > 0
        ? elapsed / enrollment.processed_count
        : 1;
      const remaining = enrollment.total_count - enrollment.processed_count;
      const remainingSeconds = Math.ceil(remaining * rate);

      estimatedCompletion = new Date(Date.now() + remainingSeconds * 1000).toISOString();
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...enrollment,
        progress_percent: progressPercent,
        estimated_completion: estimatedCompletion,
        errors: errors.map(e => ({
          subscriber_email: e.subscriber_email,
          error_message: e.error_message,
          created_at: e.created_at
        }))
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Enrollment GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestDelete(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const enrollmentId = context.params.enrollmentId;

    // Get enrollment
    const enrollment = await db.prepare(
      'SELECT * FROM batch_enrollments WHERE id = ?'
    ).bind(enrollmentId).first();

    if (!enrollment) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Enrollment not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Only allow deletion of completed, cancelled, or failed enrollments
    if (enrollment.status === 'processing') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot delete an enrollment that is currently processing. Cancel it first.'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Delete errors
    try {
      await db.prepare('DELETE FROM enrollment_errors WHERE enrollment_id = ?')
        .bind(enrollmentId).run();
    } catch (err) {
      // Table might not exist
    }

    // Delete enrollment
    await db.prepare('DELETE FROM batch_enrollments WHERE id = ?')
      .bind(enrollmentId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Enrollment record deleted'
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Enrollment DELETE error:', error);
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
