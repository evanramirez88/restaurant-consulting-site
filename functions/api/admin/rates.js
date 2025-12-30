/**
 * Business Rates API Endpoint
 *
 * GET /api/admin/rates - Get current rates (public)
 * POST /api/admin/rates - Update rates (protected)
 *
 * D1 Database Required:
 * - DB: D1 database binding with business_rates table
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';

// Default rate values
const DEFAULT_RATES = {
  hourly_rate: 110,
  remote_rate: 80,
  onsite_rate: 100,
  emergency_rate: 150,
  after_hours_multiplier: 1.25,
  travel_cape_cod: 0,
  travel_south_shore: 100,
  travel_islands: 300,
  support_tier_1_percent: 10,
  support_tier_2_percent: 20,
  support_tier_3_percent: 30
};

// Allowed rate keys with validation rules
const RATE_CONFIG = {
  hourly_rate: { min: 0, max: 1000, type: 'number' },
  remote_rate: { min: 0, max: 1000, type: 'number' },
  onsite_rate: { min: 0, max: 1000, type: 'number' },
  emergency_rate: { min: 0, max: 1000, type: 'number' },
  after_hours_multiplier: { min: 1, max: 5, type: 'number' },
  travel_cape_cod: { min: 0, max: 1000, type: 'number' },
  travel_south_shore: { min: 0, max: 1000, type: 'number' },
  travel_islands: { min: 0, max: 2000, type: 'number' },
  support_tier_1_percent: { min: 0, max: 100, type: 'number' },
  support_tier_2_percent: { min: 0, max: 100, type: 'number' },
  support_tier_3_percent: { min: 0, max: 100, type: 'number' }
};

const ALLOWED_RATES = Object.keys(DEFAULT_RATES);

/**
 * GET - Public endpoint to fetch all business rates
 */
export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Start with defaults
    const rates = { ...DEFAULT_RATES };

    try {
      const results = await env.DB.prepare(
        'SELECT key, value, updated_at FROM business_rates'
      ).all();

      if (results.results) {
        results.results.forEach(row => {
          if (ALLOWED_RATES.includes(row.key)) {
            rates[row.key] = parseFloat(row.value);
          }
        });
      }
    } catch (dbError) {
      // If table doesn't exist, return defaults
      console.log('Business rates table may not exist, using defaults:', dbError.message);
    }

    // Get last updated timestamp
    let lastUpdated = null;
    try {
      const lastUpdate = await env.DB.prepare(
        'SELECT MAX(updated_at) as max_updated FROM business_rates'
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
        rates,
        lastUpdated
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Rates GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch rates'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * POST - Protected endpoint to update business rates
 * Can update single rate or multiple rates at once
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
    const { rates: newRates } = data;

    if (!newRates || typeof newRates !== 'object') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rates object is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate all rates before updating
    const errors = [];
    const validRates = {};

    for (const [key, value] of Object.entries(newRates)) {
      if (!ALLOWED_RATES.includes(key)) {
        errors.push(`Invalid rate key: ${key}`);
        continue;
      }

      const config = RATE_CONFIG[key];
      const numValue = parseFloat(value);

      if (isNaN(numValue)) {
        errors.push(`${key}: must be a number`);
        continue;
      }

      if (numValue < config.min || numValue > config.max) {
        errors.push(`${key}: must be between ${config.min} and ${config.max}`);
        continue;
      }

      validRates[key] = numValue;
    }

    if (errors.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Validation failed',
        details: errors
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (Object.keys(validRates).length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No valid rates to update'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Ensure table exists
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS business_rates (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `).run();

    // Update each rate
    for (const [key, value] of Object.entries(validRates)) {
      await env.DB.prepare(`
        INSERT INTO business_rates (key, value, updated_at)
        VALUES (?, ?, unixepoch())
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = unixepoch()
      `).bind(key, value.toString()).run();
    }

    // Fetch all updated rates
    const rates = { ...DEFAULT_RATES };
    const results = await env.DB.prepare(
      'SELECT key, value, updated_at FROM business_rates'
    ).all();

    let lastUpdated = null;
    if (results.results) {
      results.results.forEach(row => {
        if (ALLOWED_RATES.includes(row.key)) {
          rates[row.key] = parseFloat(row.value);
        }
        if (row.updated_at && (!lastUpdated || row.updated_at > lastUpdated / 1000)) {
          lastUpdated = row.updated_at * 1000;
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Updated ${Object.keys(validRates).length} rate(s)`,
      data: {
        rates,
        lastUpdated
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Rates POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update rates'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
