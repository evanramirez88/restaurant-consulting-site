/**
 * Quiet Hours Configuration API
 *
 * GET /api/admin/email/send-times/quiet-hours - Get quiet hours configuration
 * PUT /api/admin/email/send-times/quiet-hours - Update quiet hours configuration
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

const DEFAULT_QUIET_HOURS = {
  enabled: true,
  start_hour: 22,
  end_hour: 8,
  skip_weekends: false,
  weekend_start_hour: null,
  weekend_end_hour: null,
  holidays: []
};

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;

    // Get quiet hours config
    const config = await db.prepare(`
      SELECT * FROM quiet_hours_config WHERE id = 'default'
    `).first();

    if (!config) {
      return new Response(JSON.stringify({
        success: true,
        data: DEFAULT_QUIET_HOURS
      }), { headers: corsHeaders });
    }

    // Parse JSON fields
    const result = {
      enabled: Boolean(config.enabled),
      start_hour: config.start_hour,
      end_hour: config.end_hour,
      skip_weekends: Boolean(config.skip_weekends),
      weekend_start_hour: config.weekend_start_hour,
      weekend_end_hour: config.weekend_end_hour,
      holidays: config.holidays ? JSON.parse(config.holidays) : []
    };

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Quiet hours GET error:', error);
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
      enabled,
      start_hour,
      end_hour,
      skip_weekends,
      weekend_start_hour,
      weekend_end_hour,
      holidays
    } = body;

    // Validate hours
    if (start_hour !== undefined && (start_hour < 0 || start_hour > 23)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'start_hour must be between 0 and 23'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (end_hour !== undefined && (end_hour < 0 || end_hour > 23)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'end_hour must be between 0 and 23'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);

    // Check if config exists
    const existing = await db.prepare(`
      SELECT id FROM quiet_hours_config WHERE id = 'default'
    `).first();

    if (existing) {
      // Update existing config
      await db.prepare(`
        UPDATE quiet_hours_config
        SET enabled = ?,
            start_hour = ?,
            end_hour = ?,
            skip_weekends = ?,
            weekend_start_hour = ?,
            weekend_end_hour = ?,
            holidays = ?,
            updated_at = ?
        WHERE id = 'default'
      `).bind(
        enabled !== undefined ? (enabled ? 1 : 0) : 1,
        start_hour ?? 22,
        end_hour ?? 8,
        skip_weekends ? 1 : 0,
        weekend_start_hour ?? null,
        weekend_end_hour ?? null,
        holidays ? JSON.stringify(holidays) : '[]',
        now
      ).run();
    } else {
      // Insert new config
      await db.prepare(`
        INSERT INTO quiet_hours_config (id, enabled, start_hour, end_hour, skip_weekends, weekend_start_hour, weekend_end_hour, holidays, created_at, updated_at)
        VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        enabled !== undefined ? (enabled ? 1 : 0) : 1,
        start_hour ?? 22,
        end_hour ?? 8,
        skip_weekends ? 1 : 0,
        weekend_start_hour ?? null,
        weekend_end_hour ?? null,
        holidays ? JSON.stringify(holidays) : '[]',
        now,
        now
      ).run();
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Quiet hours configuration saved successfully'
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Quiet hours PUT error:', error);
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
