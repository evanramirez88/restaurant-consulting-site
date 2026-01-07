/**
 * Send Time Configuration API
 *
 * GET /api/admin/email/send-times/config - Get send time configuration
 * PUT /api/admin/email/send-times/config - Update send time configuration
 *
 * Query params:
 *   - sequence_id: Get/update config for specific sequence (optional)
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
    const url = new URL(context.request.url);
    const sequenceId = url.searchParams.get('sequence_id');

    // Try to get sequence-specific config first, then fall back to global
    let config = null;

    if (sequenceId) {
      const result = await db.prepare(`
        SELECT * FROM send_time_configs WHERE sequence_id = ?
      `).bind(sequenceId).first();
      config = result;
    }

    // If no sequence-specific config, get global default
    if (!config) {
      const result = await db.prepare(`
        SELECT * FROM send_time_configs WHERE sequence_id IS NULL
      `).first();
      config = result;
    }

    // Return default config if none exists
    if (!config) {
      config = {
        mode: 'optimal',
        timezone: 'America/New_York',
        fixed_time: '09:00',
        fixed_days: [1, 2, 3, 4, 5], // Mon-Fri
        custom_schedule: null
      };
    } else {
      // Parse JSON fields
      if (config.fixed_days && typeof config.fixed_days === 'string') {
        config.fixed_days = JSON.parse(config.fixed_days);
      }
      if (config.custom_schedule && typeof config.custom_schedule === 'string') {
        config.custom_schedule = JSON.parse(config.custom_schedule);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: config
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Send time config GET error:', error);
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
    const body = await context.request.json();

    const {
      sequence_id,
      mode,
      fixed_time,
      fixed_days,
      timezone,
      custom_schedule
    } = body;

    // Validate mode
    const validModes = ['fixed', 'optimal', 'subscriber_timezone', 'custom'];
    if (mode && !validModes.includes(mode)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid mode. Must be one of: ${validModes.join(', ')}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);

    // Check if config exists
    let existingConfig;
    if (sequence_id) {
      existingConfig = await db.prepare(`
        SELECT id FROM send_time_configs WHERE sequence_id = ?
      `).bind(sequence_id).first();
    } else {
      existingConfig = await db.prepare(`
        SELECT id FROM send_time_configs WHERE sequence_id IS NULL
      `).first();
    }

    if (existingConfig) {
      // Update existing config
      await db.prepare(`
        UPDATE send_time_configs
        SET mode = ?,
            fixed_time = ?,
            fixed_days = ?,
            timezone = ?,
            custom_schedule = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(
        mode || 'optimal',
        fixed_time || '09:00',
        JSON.stringify(fixed_days || [1, 2, 3, 4, 5]),
        timezone || 'America/New_York',
        custom_schedule ? JSON.stringify(custom_schedule) : null,
        now,
        existingConfig.id
      ).run();
    } else {
      // Insert new config
      const id = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO send_time_configs (id, sequence_id, mode, fixed_time, fixed_days, timezone, custom_schedule, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        sequence_id || null,
        mode || 'optimal',
        fixed_time || '09:00',
        JSON.stringify(fixed_days || [1, 2, 3, 4, 5]),
        timezone || 'America/New_York',
        custom_schedule ? JSON.stringify(custom_schedule) : null,
        now,
        now
      ).run();
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Send time configuration saved successfully'
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Send time config PUT error:', error);
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
