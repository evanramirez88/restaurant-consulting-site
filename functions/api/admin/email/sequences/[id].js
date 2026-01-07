/**
 * Email Sequence API - Get, Update, Delete
 *
 * GET /api/admin/email/sequences/:id - Get single sequence
 * PUT /api/admin/email/sequences/:id - Update sequence
 * DELETE /api/admin/email/sequences/:id - Delete sequence
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;

    const sequence = await db.prepare(`
      SELECT
        es.*,
        (SELECT COUNT(*) FROM subscriber_sequences ss WHERE ss.sequence_id = es.id) as subscriber_count,
        (SELECT COALESCE(SUM(total_sent), 0) FROM sequence_steps WHERE sequence_id = es.id) as total_sent,
        (SELECT COALESCE(SUM(total_opened), 0) FROM sequence_steps WHERE sequence_id = es.id) as total_opened,
        (SELECT COALESCE(SUM(total_clicked), 0) FROM sequence_steps WHERE sequence_id = es.id) as total_clicked
      FROM email_sequences es
      WHERE es.id = ?
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

    // Also get the sequence steps
    const { results: steps } = await db.prepare(`
      SELECT * FROM sequence_steps
      WHERE sequence_id = ?
      ORDER BY step_number ASC
    `).bind(id).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...sequence,
        steps: steps || []
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Sequence GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPut(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    // Check if sequence exists
    const existing = await db.prepare('SELECT id FROM email_sequences WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Sequence not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Validate type if provided
    const validTypes = ['drip', 'behavior', 'onboarding', 'reengagement', 'transactional', 'newsletter'];
    if (body.type && !validTypes.includes(body.type)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid sequence type'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate status if provided
    const validStatuses = ['draft', 'active', 'paused', 'completed', 'archived'];
    if (body.status && !validStatuses.includes(body.status)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid sequence status'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    await db.prepare(`
      UPDATE email_sequences SET
        name = COALESCE(?, name),
        description = ?,
        type = COALESCE(?, type),
        status = COALESCE(?, status),
        trigger_type = COALESCE(?, trigger_type),
        trigger_config = ?,
        settings = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
      body.name?.trim() || null,
      body.description !== undefined ? body.description : null,
      body.type || null,
      body.status || null,
      body.trigger_type || null,
      body.trigger_config !== undefined ? body.trigger_config : null,
      body.settings !== undefined ? body.settings : null,
      now,
      id
    ).run();

    // Fetch updated sequence
    const sequence = await db.prepare(`
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
      data: sequence
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Sequence PUT error:', error);
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
    const { id } = context.params;

    // Check if sequence exists
    const existing = await db.prepare('SELECT id, status FROM email_sequences WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Sequence not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Prevent deleting active sequences
    if (existing.status === 'active') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot delete an active sequence. Please pause or archive it first.'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Delete associated steps first (cascade)
    await db.prepare('DELETE FROM sequence_steps WHERE sequence_id = ?').bind(id).run();

    // Delete the sequence
    await db.prepare('DELETE FROM email_sequences WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Sequence deleted successfully'
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Sequence DELETE error:', error);
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
