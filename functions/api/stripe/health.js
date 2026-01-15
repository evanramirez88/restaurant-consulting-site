/**
 * Stripe Integration Health Check
 *
 * GET /api/stripe/health
 *
 * Verifies Stripe API connectivity and configuration
 */

import { getStripeClient } from '../_shared/stripe.js';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

/**
 * GET /api/stripe/health
 */
export async function onRequestGet(context) {
  const { env } = context;

  const checks = {
    timestamp: new Date().toISOString(),
    stripe_configured: false,
    stripe_connected: false,
    webhook_secret_configured: false,
    database_tables: false,
    products_configured: false
  };

  try {
    // Check if Stripe secret key is configured
    if (env.STRIPE_SECRET_KEY) {
      checks.stripe_configured = true;

      // Test Stripe connectivity
      try {
        const stripe = getStripeClient(env);
        const account = await stripe.accounts.retrieve();
        checks.stripe_connected = true;
        checks.stripe_account_id = account.id;
        checks.stripe_mode = env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'live' : 'test';
      } catch (stripeError) {
        checks.stripe_error = stripeError.message;
      }
    }

    // Check webhook secret
    checks.webhook_secret_configured = !!env.STRIPE_WEBHOOK_SECRET;

    // Check database tables
    try {
      const tables = await env.DB.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name LIKE 'stripe_%'
      `).all();

      checks.database_tables = tables.results.length >= 5;
      checks.table_names = tables.results.map(t => t.name);
    } catch (dbError) {
      checks.database_error = dbError.message;
    }

    // Check products configuration
    try {
      const products = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM stripe_products WHERE active = 1
      `).first();

      checks.products_configured = products.count > 0;
      checks.active_products = products.count;
    } catch (productError) {
      // Table might not exist yet
      checks.products_error = productError.message;
    }

    // Overall health status
    checks.healthy = checks.stripe_configured &&
                     checks.stripe_connected &&
                     checks.webhook_secret_configured;

    const status = checks.healthy ? 200 : 503;

    return new Response(JSON.stringify(checks, null, 2), {
      status,
      headers: corsHeaders
    });

  } catch (error) {
    return new Response(JSON.stringify({
      ...checks,
      healthy: false,
      error: error.message
    }, null, 2), {
      status: 500,
      headers: corsHeaders
    });
  }
}
