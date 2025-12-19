/**
 * Availability API Endpoint
 *
 * GET /api/availability - Public, returns current availability
 * PUT /api/availability - Protected, updates availability
 *
 * D1 Database Required:
 * - DB: D1 database binding with availability table
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';

/**
 * GET - Public endpoint to fetch current availability
 */
export async function onRequestGet(context) {
  const { env } = context;

  try {
    const result = await env.DB.prepare(`
      SELECT
        status,
        location_type,
        town,
        address,
        walk_ins_accepted,
        scheduling_available,
        custom_message,
        updated_at
      FROM availability
      WHERE id = 1
    `).first();

    if (!result) {
      // Return default if no record exists
      return new Response(JSON.stringify({
        success: true,
        data: {
          status: 'offline',
          locationType: 'remote',
          town: null,
          address: null,
          walkInsAccepted: false,
          schedulingAvailable: true,
          customMessage: null,
          updatedAt: null
        }
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        status: result.status,
        locationType: result.location_type,
        town: result.town,
        address: result.address,
        walkInsAccepted: Boolean(result.walk_ins_accepted),
        schedulingAvailable: Boolean(result.scheduling_available),
        customMessage: result.custom_message,
        updatedAt: result.updated_at ? result.updated_at * 1000 : null // Convert to JS timestamp
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Availability GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch availability'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * PUT - Protected endpoint to update availability
 */
export async function onRequestPut(context) {
  const { request, env } = context;

  try {
    // Verify authentication
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    // Parse request body
    const data = await request.json();

    // Validate status
    const validStatuses = ['available', 'busy', 'offline'];
    if (data.status && !validStatuses.includes(data.status)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate location type
    const validLocationTypes = ['remote', 'onsite', 'both'];
    if (data.locationType && !validLocationTypes.includes(data.locationType)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid location type. Must be one of: ${validLocationTypes.join(', ')}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate custom message length
    if (data.customMessage && data.customMessage.length > 200) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Custom message must be 200 characters or less'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }

    if (data.locationType !== undefined) {
      updates.push('location_type = ?');
      values.push(data.locationType);
    }

    if (data.town !== undefined) {
      updates.push('town = ?');
      values.push(data.town || null);
    }

    if (data.address !== undefined) {
      updates.push('address = ?');
      values.push(data.address || null);
    }

    if (data.walkInsAccepted !== undefined) {
      updates.push('walk_ins_accepted = ?');
      values.push(data.walkInsAccepted ? 1 : 0);
    }

    if (data.schedulingAvailable !== undefined) {
      updates.push('scheduling_available = ?');
      values.push(data.schedulingAvailable ? 1 : 0);
    }

    if (data.customMessage !== undefined) {
      updates.push('custom_message = ?');
      values.push(data.customMessage || null);
    }

    // Always update the timestamp
    updates.push('updated_at = unixepoch()');

    if (updates.length === 1) {
      // Only updated_at, nothing else to update
      return new Response(JSON.stringify({
        success: false,
        error: 'No valid fields to update'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Ensure the record exists first (upsert pattern)
    await env.DB.prepare(`
      INSERT OR IGNORE INTO availability (id, status, location_type, scheduling_available)
      VALUES (1, 'offline', 'remote', 1)
    `).run();

    // Execute update
    const query = `UPDATE availability SET ${updates.join(', ')} WHERE id = 1`;
    await env.DB.prepare(query).bind(...values).run();

    // Fetch updated record
    const result = await env.DB.prepare(`
      SELECT
        status,
        location_type,
        town,
        address,
        walk_ins_accepted,
        scheduling_available,
        custom_message,
        updated_at
      FROM availability
      WHERE id = 1
    `).first();

    return new Response(JSON.stringify({
      success: true,
      message: 'Availability updated',
      data: {
        status: result.status,
        locationType: result.location_type,
        town: result.town,
        address: result.address,
        walkInsAccepted: Boolean(result.walk_ins_accepted),
        schedulingAvailable: Boolean(result.scheduling_available),
        customMessage: result.custom_message,
        updatedAt: result.updated_at ? result.updated_at * 1000 : null
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Availability PUT error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update availability'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
