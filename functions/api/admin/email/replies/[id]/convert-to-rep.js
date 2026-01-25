/**
 * Convert Email Reply to Rep Profile
 *
 * POST /api/admin/email/replies/:id/convert-to-rep
 *
 * Creates a rep profile from response data (for business partners,
 * vendors, referral sources detected in replies).
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    // Get the reply data
    const reply = await db.prepare(`
      SELECT * FROM email_replies WHERE id = ?
    `).bind(id).first();

    if (!reply) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Reply not found'
      }), { status: 404, headers: corsHeaders });
    }

    // Build rep profile from reply data + any overrides from body
    const repId = `rep_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const repName = body.name || reply.extracted_business_name || reply.email.split('@')[0];
    const repEmail = reply.email;
    const territory = body.territory || 'National';
    const repSlug = repName.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30);

    // Create rep profile
    try {
      await db.prepare(`
        INSERT INTO reps (
          id, email, name, territory, slug, phone,
          portal_enabled, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?, ?)
      `).bind(
        repId,
        repEmail,
        repName,
        territory,
        repSlug,
        reply.extracted_phone || body.phone || null,
        `Converted from email reply. Business type: ${reply.extracted_business_type || 'unknown'}. Original subject: ${reply.subject || 'N/A'}`,
        now,
        now
      ).run();
    } catch (e) {
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to create rep: ${e.message}`
      }), { status: 500, headers: corsHeaders });
    }

    // Update the reply to link to the new rep profile
    await db.prepare(`
      UPDATE email_replies
      SET rep_profile_id = ?,
          enrichment_status = 'enriched',
          processed = 1,
          processed_at = ?
      WHERE id = ?
    `).bind(repId, now, id).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        rep_id: repId,
        name: repName,
        email: repEmail,
        slug: repSlug,
        territory,
        message: `Rep profile created from reply: ${repName}`
      }
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
