/**
 * Site Config API Endpoint
 *
 * GET /api/config - Public, returns all config values
 *
 * D1 Database Required:
 * - DB: D1 database binding with site_config table
 */

import { corsHeaders, handleOptions } from '../../_shared/auth.js';

/**
 * GET - Public endpoint to fetch all config values
 */
export async function onRequestGet(context) {
  const { env } = context;

  try {
    const results = await env.DB.prepare(`
      SELECT key, value, updated_at
      FROM site_config
      ORDER BY key
    `).all();

    // Transform array to object
    const config = {};
    const meta = {};

    for (const row of results.results || []) {
      config[row.key] = row.value;
      meta[row.key] = {
        updatedAt: row.updated_at ? row.updated_at * 1000 : null
      };
    }

    // Provide defaults for missing keys
    const defaults = {
      phone: '774-408-0083',
      email: 'evan@ccrestaurantconsulting.com',
      hourly_rate_remote: '110',
      hourly_rate_onsite: '165',
      business_hours: 'Mon-Sat 8am-6pm'
    };

    for (const [key, value] of Object.entries(defaults)) {
      if (!(key in config)) {
        config[key] = value;
        meta[key] = { updatedAt: null };
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: config,
      meta
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
