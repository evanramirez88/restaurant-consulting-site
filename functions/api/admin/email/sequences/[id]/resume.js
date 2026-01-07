/**
 * Email Sequence Resume API
 *
 * POST /api/admin/email/sequences/:id/resume - Resume a paused or activate a draft sequence
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;
    const now = Math.floor(Date.now() / 1000);

    // Get the sequence
    const sequence = await db.prepare(`
      SELECT id, status FROM email_sequences WHERE id = ?
    `).bind(id).first();

    if (!sequence) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Sequence not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Check if sequence can be resumed/activated
    const validStatuses = ['paused', 'draft'];
    if (!validStatuses.includes(sequence.status)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Cannot activate a sequence with status '${sequence.status}'. Only paused or draft sequences can be activated.`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Check if sequence has at least one step (for activation)
    const { results: steps } = await db.prepare(`
      SELECT id FROM sequence_steps WHERE sequence_id = ? LIMIT 1
    `).bind(id).all();

    // For draft sequences, we require at least one step to activate
    // For paused sequences, we assume steps already existed
    if (sequence.status === 'draft' && (!steps || steps.length === 0)) {
      // For now, allow activation even without steps
      // In production, you might want to require at least one step
      console.log('Activating sequence without steps - steps can be added later');
    }

    // Update status to active
    await db.prepare(`
      UPDATE email_sequences
      SET status = 'active', updated_at = ?
      WHERE id = ?
    `).bind(now, id).run();

    // If resuming a paused sequence, also resume paused subscriber sequences
    if (sequence.status === 'paused') {
      await db.prepare(`
        UPDATE subscriber_sequences
        SET status = 'active', updated_at = ?
        WHERE sequence_id = ? AND status = 'paused'
      `).bind(now, id).run();
    }

    // Fetch updated sequence
    const updated = await db.prepare(`
      SELECT
        es.*,
        (SELECT COUNT(*) FROM subscriber_sequences ss WHERE ss.sequence_id = es.id) as subscriber_count,
        (SELECT COALESCE(SUM(total_sent), 0) FROM sequence_steps WHERE sequence_id = es.id) as total_sent,
        (SELECT COALESCE(SUM(total_opened), 0) FROM sequence_steps WHERE sequence_id = es.id) as total_opened,
        (SELECT COALESCE(SUM(total_clicked), 0) FROM sequence_steps WHERE sequence_id = es.id) as total_clicked
      FROM email_sequences es
      WHERE es.id = ?
    `).bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: updated,
      message: sequence.status === 'paused' ? 'Sequence resumed successfully' : 'Sequence activated successfully'
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Sequence Resume error:', error);
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
