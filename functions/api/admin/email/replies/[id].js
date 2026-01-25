/**
 * Email Reply PATCH/GET by ID
 *
 * GET  /api/admin/email/replies/:id - Get single reply details
 * PATCH /api/admin/email/replies/:id - Update reply (enrichment, notes, processed)
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;

    const reply = await db.prepare(`
      SELECT
        r.*,
        es.first_name as subscriber_name,
        es.company as subscriber_company,
        es.engagement_score,
        rl.restaurant_name,
        rl.lead_score,
        rl.email as lead_email
      FROM email_replies r
      LEFT JOIN email_subscribers es ON r.subscriber_id = es.id
      LEFT JOIN restaurant_leads rl ON r.lead_id = rl.id
      WHERE r.id = ?
    `).bind(id).first();

    if (!reply) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Reply not found'
      }), { status: 404, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...reply,
        processed: !!reply.processed,
        extracted: {
          business_name: reply.extracted_business_name,
          phone: reply.extracted_phone,
          address: reply.extracted_address,
          business_type: reply.extracted_business_type
        }
      }
    }), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestPatch(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    // Build dynamic update
    const updates = [];
    const values = [];

    const allowedFields = [
      'processed', 'processed_by', 'notes', 'classification',
      'response_type', 'enrichment_status', 'rep_profile_id',
      'extracted_business_name', 'extracted_phone',
      'extracted_address', 'extracted_business_type',
      'sentiment', 'priority'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    // Handle 'processed' specially - set processed_at timestamp
    if (body.processed !== undefined) {
      if (body.processed && !updates.some(u => u.startsWith('processed_at'))) {
        updates.push('processed_at = ?');
        values.push(now);
      }
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No valid fields to update'
      }), { status: 400, headers: corsHeaders });
    }

    values.push(id);
    await db.prepare(`
      UPDATE email_replies SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();

    // If enrichment_status changed to 'enriched', update the lead too
    if (body.enrichment_status === 'enriched') {
      const reply = await db.prepare('SELECT lead_id, extracted_business_type FROM email_replies WHERE id = ?')
        .bind(id).first();
      if (reply?.lead_id) {
        await db.prepare(`
          UPDATE restaurant_leads
          SET business_type_detected = COALESCE(?, business_type_detected)
          WHERE id = ?
        `).bind(reply.extracted_business_type, reply.lead_id).run();
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Updated ${updates.length} field(s)`
    }), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
