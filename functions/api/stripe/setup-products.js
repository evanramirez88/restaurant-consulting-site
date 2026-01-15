/**
 * Stripe Products Setup API (Admin Only - One-time use)
 *
 * POST /api/stripe/setup-products - Create Toast Guardian products and prices
 *
 * This endpoint creates the required Stripe products and prices for
 * Toast Guardian support plans, then updates the D1 database.
 *
 * IMPORTANT: This is a one-time setup endpoint. After products are created,
 * this endpoint can be deleted or disabled.
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';
import { getStripeClient } from '../_shared/stripe.js';

// Toast Guardian product definitions (Lane B - Remote Support)
const TOAST_GUARDIAN_PRODUCTS = [
  {
    name: 'Toast Guardian - Core',
    description: 'Essential Toast POS support for small restaurants. 5 hours/month included.',
    tier: 'core',
    prices: [
      { billing_interval: 'monthly', amount: 35000, interval: 'month', interval_count: 1 },
      { billing_interval: 'quarterly', amount: 105000, interval: 'month', interval_count: 3 },
      { billing_interval: 'annual', amount: 385000, interval: 'year', interval_count: 1 }
    ]
  },
  {
    name: 'Toast Guardian - Professional',
    description: 'Enhanced Toast POS support for growing restaurants. 10 hours/month included.',
    tier: 'professional',
    prices: [
      { billing_interval: 'monthly', amount: 50000, interval: 'month', interval_count: 1 },
      { billing_interval: 'quarterly', amount: 150000, interval: 'month', interval_count: 3 },
      { billing_interval: 'annual', amount: 550000, interval: 'year', interval_count: 1 }
    ]
  },
  {
    name: 'Toast Guardian - Premium',
    description: 'Priority Toast POS support for high-volume restaurants. 20 hours/month included.',
    tier: 'premium',
    prices: [
      { billing_interval: 'monthly', amount: 80000, interval: 'month', interval_count: 1 },
      { billing_interval: 'quarterly', amount: 240000, interval: 'month', interval_count: 3 },
      { billing_interval: 'annual', amount: 880000, interval: 'year', interval_count: 1 }
    ]
  }
];

// Local Networking Support product definitions (Lane A - Cape Cod Cable Contractors)
const NETWORKING_SUPPORT_PRODUCTS = [
  {
    name: 'Network Support - Basic',
    description: 'Essential network maintenance for Cape Cod restaurants. 48-hour response, business hours support.',
    tier: 'network_basic',
    prices: [
      { billing_interval: 'monthly', amount: 15000, interval: 'month', interval_count: 1 },
      { billing_interval: 'quarterly', amount: 45000, interval: 'month', interval_count: 3 },
      { billing_interval: 'annual', amount: 165000, interval: 'year', interval_count: 1 }
    ]
  },
  {
    name: 'Network Support - Premium',
    description: 'Enhanced network support with 24-hour response, after-hours availability, and on-site service.',
    tier: 'network_premium',
    prices: [
      { billing_interval: 'monthly', amount: 30000, interval: 'month', interval_count: 1 },
      { billing_interval: 'quarterly', amount: 90000, interval: 'month', interval_count: 3 },
      { billing_interval: 'annual', amount: 330000, interval: 'year', interval_count: 1 }
    ]
  },
  {
    name: 'Network Support - Enterprise',
    description: 'Full-service network management with 24/7 monitoring, emergency response, and dedicated account manager.',
    tier: 'network_enterprise',
    prices: [
      { billing_interval: 'monthly', amount: 50000, interval: 'month', interval_count: 1 },
      { billing_interval: 'quarterly', amount: 150000, interval: 'month', interval_count: 3 },
      { billing_interval: 'annual', amount: 550000, interval: 'year', interval_count: 1 }
    ]
  }
];

// Combined product definitions
const PRODUCT_DEFINITIONS = [...TOAST_GUARDIAN_PRODUCTS, ...NETWORKING_SUPPORT_PRODUCTS];

/**
 * POST /api/stripe/setup-products
 * Create all Toast Guardian products and prices in Stripe
 *
 * For initial setup, use header: X-Setup-Token: <first 8 chars of STRIPE_SECRET_KEY>
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  // Allow setup with either admin auth OR a one-time setup token
  const setupToken = request.headers.get('X-Setup-Token');
  const expectedToken = env.STRIPE_SECRET_KEY?.substring(0, 16); // First 16 chars of key

  if (setupToken && setupToken === expectedToken) {
    // Setup token matches - proceed
  } else {
    // Fall back to admin auth
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse('Admin auth required or valid X-Setup-Token header');
    }
  }

  try {
    const stripe = getStripeClient(env);
    const createdPrices = [];
    const results = [];

    // Check if products already exist
    const existingProducts = await stripe.products.list({
      limit: 100,
      active: true
    });

    const existingByTier = {};
    for (const product of existingProducts.data) {
      if (product.metadata?.tier && product.metadata?.type === 'support_plan') {
        existingByTier[product.metadata.tier] = product;
      }
    }

    for (const productDef of PRODUCT_DEFINITIONS) {
      let product;

      // Check if product already exists
      if (existingByTier[productDef.tier]) {
        product = existingByTier[productDef.tier];
        results.push({
          tier: productDef.tier,
          product_id: product.id,
          status: 'existing'
        });
      } else {
        // Create new product
        product = await stripe.products.create({
          name: productDef.name,
          description: productDef.description,
          metadata: {
            tier: productDef.tier,
            type: 'support_plan'
          }
        });
        results.push({
          tier: productDef.tier,
          product_id: product.id,
          status: 'created'
        });
      }

      // Get existing prices for this product
      const existingPrices = await stripe.prices.list({
        product: product.id,
        active: true,
        limit: 100
      });

      const existingPricesByInterval = {};
      for (const price of existingPrices.data) {
        let interval = price.metadata?.billing_interval;
        // Normalize 'yearly' to 'annual' for database consistency
        if (interval === 'yearly') interval = 'annual';
        if (interval) {
          existingPricesByInterval[interval] = price;
        }
      }

      // Create prices for this product
      for (const priceDef of productDef.prices) {
        let price;

        if (existingPricesByInterval[priceDef.billing_interval]) {
          price = existingPricesByInterval[priceDef.billing_interval];
        } else {
          const priceParams = {
            product: product.id,
            currency: 'usd',
            unit_amount: priceDef.amount,
            recurring: {
              interval: priceDef.interval,
              interval_count: priceDef.interval_count
            },
            metadata: {
              tier: productDef.tier,
              billing_interval: priceDef.billing_interval
            }
          };

          price = await stripe.prices.create(priceParams);
        }

        createdPrices.push({
          tier: productDef.tier,
          billing_interval: priceDef.billing_interval,
          product_id: product.id,
          price_id: price.id,
          amount: priceDef.amount
        });
      }
    }

    // Update D1 database with real price IDs
    // First, delete placeholder entries
    await env.DB.prepare(`
      DELETE FROM stripe_products WHERE stripe_price_id LIKE '%_TBD'
    `).run();

    // Insert real price IDs
    for (const price of createdPrices) {
      // Get included hours based on tier (Toast Guardian and Network Support)
      const includedHoursMap = {
        core: 5,
        professional: 10,
        premium: 20,
        network_basic: 2,
        network_premium: 4,
        network_enterprise: 8
      };
      const includedHours = includedHoursMap[price.tier] || 0;

      // Format tier name for description
      const tierNameMap = {
        core: 'Toast Guardian Core',
        professional: 'Toast Guardian Professional',
        premium: 'Toast Guardian Premium',
        network_basic: 'Network Support Basic',
        network_premium: 'Network Support Premium',
        network_enterprise: 'Network Support Enterprise'
      };
      const tierName = tierNameMap[price.tier] || price.tier;
      const description = `${tierName} - ${price.billing_interval.charAt(0).toUpperCase() + price.billing_interval.slice(1)}`;

      await env.DB.prepare(`
        INSERT OR REPLACE INTO stripe_products
        (tier, billing_interval, stripe_product_id, stripe_price_id, amount_cents, included_hours, description, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
      `).bind(
        price.tier,
        price.billing_interval,
        price.product_id,
        price.price_id,
        price.amount,
        includedHours,
        description
      ).run();
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Toast Guardian products and prices created successfully',
      data: {
        products: results,
        prices: createdPrices,
        database_updated: true
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Setup products error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * GET /api/stripe/setup-products
 * Check current product/price status
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  // Admin auth required
  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const stripe = getStripeClient(env);

    // Get products from Stripe
    const products = await stripe.products.list({
      limit: 100,
      active: true
    });

    const supportPlanProducts = products.data.filter(
      p => p.metadata?.type === 'support_plan'
    );

    // Get prices from D1
    const dbPrices = await env.DB.prepare(`
      SELECT * FROM stripe_products ORDER BY tier, billing_interval
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        stripe_products: supportPlanProducts.map(p => ({
          id: p.id,
          name: p.name,
          tier: p.metadata?.tier,
          active: p.active
        })),
        database_prices: dbPrices.results,
        needs_setup: dbPrices.results.some(p => p.stripe_price_id?.includes('_TBD'))
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Get products status error:', error);
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
