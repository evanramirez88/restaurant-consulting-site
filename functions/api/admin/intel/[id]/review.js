/**
 * Admin Intel Review API
 *
 * POST /api/admin/intel/[id]/review - Review and take action on a submission
 *
 * Actions:
 * - reviewed: Mark as reviewed with admin notes
 * - converted: Convert to lead/client/ticket
 * - rejected: Reject as invalid or duplicate
 * - archived: Archive for reference
 */

import { verifyAuth, unauthorizedResponse, getCorsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestPost(context) {
  const { request, params, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    // Verify admin authentication
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const db = env.DB;
    const { id } = params;
    const body = await request.json();

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Submission ID is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get the submission
    const submission = await db.prepare(`
      SELECT ris.*, r.name as rep_name, r.email as rep_email
      FROM rep_intel_submissions ris
      JOIN reps r ON ris.rep_id = r.id
      WHERE ris.id = ?
    `).bind(id).first();

    if (!submission) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Submission not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const action = body.action || 'reviewed';

    // Validate action
    const validActions = ['reviewed', 'converted', 'rejected', 'archived'];
    if (!validActions.includes(action)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid action. Valid actions: ${validActions.join(', ')}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    let convertedToId = null;
    let conversionType = null;

    // Handle conversion actions
    if (action === 'converted') {
      const convertTo = body.convert_to || 'lead';

      switch (convertTo) {
        case 'lead':
          // Create entry in restaurant_leads table
          const leadId = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          await db.prepare(`
            INSERT INTO restaurant_leads (
              id, restaurant_name, contact_name, contact_email, contact_phone,
              city, state, current_pos, lead_score,
              source, source_detail, notes,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'rep_referral', ?, ?, ?, ?)
          `).bind(
            leadId,
            submission.restaurant_name || 'Unknown',
            submission.contact_name || null,
            submission.contact_email || null,
            submission.contact_phone || null,
            submission.city || null,
            submission.state || null,
            submission.current_pos || null,
            submission.urgency === 'hot' ? 90 : submission.urgency === 'high' ? 75 : 50,
            `Rep: ${submission.rep_name}`,
            `${submission.subject}\n\n${submission.body || ''}\n\nEstimated value: $${submission.estimated_value || 'unknown'}`,
            now,
            now
          ).run();

          convertedToId = leadId;
          conversionType = 'lead';
          break;

        case 'ticket':
          // Create internal ticket
          const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          await db.prepare(`
            INSERT INTO tickets (
              id, client_id, subject, description, priority, status, category,
              visibility, ticket_type, rep_id,
              is_upsell_opportunity, upsell_type,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'open', 'other', 'internal', 'internal', ?, ?, ?, ?, ?)
          `).bind(
            ticketId,
            submission.client_id,
            `[From Intel] ${submission.subject}`,
            `${submission.body || ''}\n\n---\nSubmitted by: ${submission.rep_name}\nEstimated value: $${submission.estimated_value || 'unknown'}`,
            submission.urgency === 'hot' ? 'urgent' : submission.urgency === 'high' ? 'high' : 'normal',
            submission.rep_id,
            submission.opportunity_type ? 1 : 0,
            submission.opportunity_type || null,
            now,
            now
          ).run();

          convertedToId = ticketId;
          conversionType = 'ticket';
          break;

        case 'client':
          // Create new client
          const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const slug = (submission.restaurant_name || 'new-client')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

          await db.prepare(`
            INSERT INTO clients (
              id, email, name, company, slug, phone, portal_enabled,
              notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
          `).bind(
            clientId,
            submission.contact_email || `${slug}@placeholder.com`,
            submission.contact_name || 'Contact Name',
            submission.restaurant_name || 'New Client',
            `${slug}-${Date.now()}`,
            submission.contact_phone || null,
            `Converted from rep intel submission by ${submission.rep_name}`,
            now,
            now
          ).run();

          // Create rep assignment
          await db.prepare(`
            INSERT INTO client_rep_assignments (
              id, client_id, rep_id, role, assigned_at, updated_at
            ) VALUES (?, ?, ?, 'primary', ?, ?)
          `).bind(
            `cra_${Date.now()}`,
            clientId,
            submission.rep_id,
            now,
            now
          ).run();

          convertedToId = clientId;
          conversionType = 'client';
          break;

        default:
          return new Response(JSON.stringify({
            success: false,
            error: `Invalid conversion type. Valid types: lead, ticket, client`
          }), {
            status: 400,
            headers: corsHeaders
          });
      }
    }

    // Update the submission
    const updateQuery = `
      UPDATE rep_intel_submissions
      SET
        status = ?,
        admin_notes = ?,
        reviewed_by = 'admin',
        reviewed_at = ?,
        converted_to_lead_id = CASE WHEN ? = 'lead' THEN ? ELSE converted_to_lead_id END,
        converted_to_client_id = CASE WHEN ? = 'client' THEN ? ELSE converted_to_client_id END,
        converted_to_ticket_id = CASE WHEN ? = 'ticket' THEN ? ELSE converted_to_ticket_id END,
        updated_at = ?
      WHERE id = ?
    `;

    await db.prepare(updateQuery).bind(
      action,
      body.admin_notes || submission.admin_notes || null,
      now,
      conversionType, convertedToId,
      conversionType, convertedToId,
      conversionType, convertedToId,
      now,
      id
    ).run();

    // Get updated submission
    const updated = await db.prepare(`
      SELECT ris.*, r.name as rep_name, r.email as rep_email
      FROM rep_intel_submissions ris
      JOIN reps r ON ris.rep_id = r.id
      WHERE ris.id = ?
    `).bind(id).first();

    // Build response message
    let message = '';
    switch (action) {
      case 'reviewed':
        message = 'Submission marked as reviewed';
        break;
      case 'converted':
        message = `Submission converted to ${conversionType} (ID: ${convertedToId})`;
        break;
      case 'rejected':
        message = 'Submission rejected';
        break;
      case 'archived':
        message = 'Submission archived';
        break;
    }

    return new Response(JSON.stringify({
      success: true,
      data: updated,
      conversion: convertedToId ? {
        type: conversionType,
        id: convertedToId
      } : null,
      message
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Admin intel review error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
