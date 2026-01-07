/**
 * Cancel Batch Enrollment API
 *
 * POST /api/admin/email/sequences/enrollments/[enrollmentId]/cancel
 *
 * Cancels an in-progress or pending batch enrollment.
 * Already processed subscribers will remain enrolled.
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../../../_shared/auth.js';

export async function onRequestPost(context) {
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

    // Check if can be cancelled
    if (enrollment.status === 'completed') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot cancel a completed enrollment'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (enrollment.status === 'cancelled') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Enrollment is already cancelled'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (enrollment.status === 'failed') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot cancel a failed enrollment'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Update status to cancelled
    const now = Math.floor(Date.now() / 1000);

    await db.prepare(`
      UPDATE batch_enrollments
      SET status = 'cancelled',
          completed_at = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(now, now, enrollmentId).run();

    // Get updated enrollment
    const updatedEnrollment = await db.prepare(
      'SELECT * FROM batch_enrollments WHERE id = ?'
    ).bind(enrollmentId).first();

    // Parse JSON fields
    if (updatedEnrollment) {
      updatedEnrollment.source_details = updatedEnrollment.source_details
        ? JSON.parse(updatedEnrollment.source_details)
        : null;
      updatedEnrollment.drip_config = updatedEnrollment.drip_config
        ? JSON.parse(updatedEnrollment.drip_config)
        : null;
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Enrollment cancelled',
      data: updatedEnrollment
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Enrollment cancel error:', error);
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
