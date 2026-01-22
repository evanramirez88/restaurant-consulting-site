/**
 * Admin Lead Individual API
 *
 * GET /api/admin/leads/[id] - Get single lead details
 * PATCH /api/admin/leads/[id] - Update lead fields
 * DELETE /api/admin/leads/[id] - Delete lead
 */

import { verifyAuth, unauthorizedResponse, getCorsOrigin, handleOptions } from '../../../_shared/auth.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

export async function onRequestOptions(context) {
  return handleOptions();
}

/**
 * GET /api/admin/leads/[id]
 */
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const lead = await env.DB.prepare(`
      SELECT * FROM restaurant_leads WHERE id = ?
    `).bind(params.id).first();

    if (!lead) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Lead not found'
      }), { status: 404, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      success: true,
      lead
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Get lead error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

/**
 * PATCH /api/admin/leads/[id]
 * Update lead fields
 */
export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();
    const leadId = params.id;

    // Allowed fields to update
    const allowedFields = [
      'status', 'segment', 'lead_score', 'notes', 'tags',
      'primary_email', 'primary_phone', 'secondary_email', 'secondary_phone',
      'address_line1', 'city', 'state', 'zip',
      'current_pos', 'service_style', 'cuisine_primary',
      'bar_program', 'menu_complexity', 'hubspot_id'
    ];

    // Build update query
    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No valid fields to update'
      }), { status: 400, headers: corsHeaders });
    }

    // Add updated_at timestamp
    updates.push('updated_at = ?');
    values.push(Math.floor(Date.now() / 1000));

    // Add lead ID for WHERE clause
    values.push(leadId);

    const query = `UPDATE restaurant_leads SET ${updates.join(', ')} WHERE id = ?`;
    await env.DB.prepare(query).bind(...values).run();

    // Get updated lead
    const updatedLead = await env.DB.prepare(
      'SELECT * FROM restaurant_leads WHERE id = ?'
    ).bind(leadId).first();

    return new Response(JSON.stringify({
      success: true,
      message: 'Lead updated successfully',
      lead: updatedLead
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Update lead error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

/**
 * DELETE /api/admin/leads/[id]
 */
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const leadId = params.id;

    // Check if lead exists
    const lead = await env.DB.prepare(
      'SELECT id, name FROM restaurant_leads WHERE id = ?'
    ).bind(leadId).first();

    if (!lead) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Lead not found'
      }), { status: 404, headers: corsHeaders });
    }

    // Delete the lead
    await env.DB.prepare(
      'DELETE FROM restaurant_leads WHERE id = ?'
    ).bind(leadId).run();

    return new Response(JSON.stringify({
      success: true,
      message: `Deleted lead: ${lead.name}`
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Delete lead error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}
