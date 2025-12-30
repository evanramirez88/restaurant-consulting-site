/**
 * Feature Flags API Endpoint
 *
 * GET /api/admin/feature-flags - Get current flag states (public)
 * POST /api/admin/feature-flags - Update a flag (protected)
 *
 * D1 Database Required:
 * - DB: D1 database binding with feature_flags table
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';

// Default feature flag values
const DEFAULT_FLAGS = {
  quote_builder_enabled: false,
  menu_builder_enabled: false,
  client_portal_enabled: false,
  maintenance_mode: false
};

// Allowed flag keys (whitelist for security)
const ALLOWED_FLAGS = Object.keys(DEFAULT_FLAGS);

/**
 * GET - Public endpoint to fetch all feature flags
 */
export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Try to get flags from database
    const flags = { ...DEFAULT_FLAGS };

    try {
      const results = await env.DB.prepare(
        'SELECT key, value, updated_at FROM feature_flags'
      ).all();

      if (results.results) {
        results.results.forEach(row => {
          if (ALLOWED_FLAGS.includes(row.key)) {
            // Parse boolean values
            flags[row.key] = row.value === 'true' || row.value === '1' || row.value === true;
          }
        });
      }
    } catch (dbError) {
      // If table doesn't exist, return defaults
      console.log('Feature flags table may not exist, using defaults:', dbError.message);
    }

    // Get last updated timestamp
    let lastUpdated = null;
    try {
      const lastUpdate = await env.DB.prepare(
        'SELECT MAX(updated_at) as max_updated FROM feature_flags'
      ).first();
      if (lastUpdate?.max_updated) {
        lastUpdated = lastUpdate.max_updated * 1000;
      }
    } catch (e) {
      // Ignore
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        flags,
        lastUpdated
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Feature flags GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch feature flags'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * POST - Protected endpoint to update a feature flag
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Verify authentication
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    // Parse request body
    const data = await request.json();
    const { key, value } = data;

    // Validate key
    if (!key || !ALLOWED_FLAGS.includes(key)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid flag key. Allowed keys: ${ALLOWED_FLAGS.join(', ')}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate value is boolean
    if (typeof value !== 'boolean') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Value must be a boolean (true or false)'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Ensure table exists
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS feature_flags (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `).run();

    // Upsert the flag value
    await env.DB.prepare(`
      INSERT INTO feature_flags (key, value, updated_at)
      VALUES (?, ?, unixepoch())
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = unixepoch()
    `).bind(key, value.toString()).run();

    // Fetch all updated flags
    const flags = { ...DEFAULT_FLAGS };
    const results = await env.DB.prepare(
      'SELECT key, value, updated_at FROM feature_flags'
    ).all();

    let lastUpdated = null;
    if (results.results) {
      results.results.forEach(row => {
        if (ALLOWED_FLAGS.includes(row.key)) {
          flags[row.key] = row.value === 'true' || row.value === '1';
        }
        if (row.updated_at && (!lastUpdated || row.updated_at > lastUpdated / 1000)) {
          lastUpdated = row.updated_at * 1000;
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Feature flag "${key}" updated to ${value}`,
      data: {
        flags,
        lastUpdated
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Feature flags POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update feature flag'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
