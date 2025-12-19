/**
 * Single Config Key API Endpoint
 *
 * PUT /api/config/:key - Protected, updates a single config value
 *
 * D1 Database Required:
 * - DB: D1 database binding with site_config table
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';

// Allowed config keys (whitelist for security)
const ALLOWED_KEYS = [
  'phone',
  'email',
  'hourly_rate_remote',
  'hourly_rate_onsite',
  'business_hours'
];

/**
 * PUT - Protected endpoint to update a single config value
 */
export async function onRequestPut(context) {
  const { request, env, params } = context;
  const key = params.key;

  try {
    // Verify authentication
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    // Validate key
    if (!ALLOWED_KEYS.includes(key)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid config key. Allowed keys: ${ALLOWED_KEYS.join(', ')}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Parse request body
    const data = await request.json();

    if (data.value === undefined || data.value === null) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Value is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const value = String(data.value).trim();

    // Validate value based on key type
    if (key === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid email address format'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
    }

    if (key === 'phone') {
      // Allow various phone formats, just check for digits
      const digitsOnly = value.replace(/\D/g, '');
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid phone number format'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
    }

    if (key === 'hourly_rate_remote' || key === 'hourly_rate_onsite') {
      const rate = parseFloat(value);
      if (isNaN(rate) || rate < 0 || rate > 10000) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Rate must be a valid number between 0 and 10000'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
    }

    if (value.length > 500) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Value must be 500 characters or less'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Upsert the config value
    await env.DB.prepare(`
      INSERT INTO site_config (key, value, updated_at)
      VALUES (?, ?, unixepoch())
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = unixepoch()
    `).bind(key, value).run();

    // Fetch updated record
    const result = await env.DB.prepare(
      'SELECT value, updated_at FROM site_config WHERE key = ?'
    ).bind(key).first();

    return new Response(JSON.stringify({
      success: true,
      message: `Config "${key}" updated`,
      data: {
        key,
        value: result.value,
        updatedAt: result.updated_at ? result.updated_at * 1000 : null
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Config PUT error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update configuration'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * GET - Public endpoint to fetch a single config value
 */
export async function onRequestGet(context) {
  const { env, params } = context;
  const key = params.key;

  try {
    // Validate key
    if (!ALLOWED_KEYS.includes(key)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid config key'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    const result = await env.DB.prepare(
      'SELECT value, updated_at FROM site_config WHERE key = ?'
    ).bind(key).first();

    if (!result) {
      // Return default
      const defaults = {
        phone: '774-408-0083',
        email: 'evan@ccrestaurantconsulting.com',
        hourly_rate_remote: '110',
        hourly_rate_onsite: '165',
        business_hours: 'Mon-Sat 8am-6pm'
      };

      return new Response(JSON.stringify({
        success: true,
        data: {
          key,
          value: defaults[key] || null,
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
        key,
        value: result.value,
        updatedAt: result.updated_at ? result.updated_at * 1000 : null
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Config GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch configuration'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
