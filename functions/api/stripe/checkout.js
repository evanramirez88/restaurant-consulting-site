/**
 * Stripe Checkout Session API
 *
 * POST /api/stripe/checkout - Create checkout session for subscription
 * GET /api/stripe/checkout?session_id=xxx - Get checkout session details
 *
 * Creates Stripe Checkout sessions for support plan subscriptions with:
 * - Pre-filled customer email
 * - Commitment period metadata
 * - Success/cancel URL handling
 * - Promotion code support
 */

import { verifyAuth, verifyClientAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';
import {
  createCheckoutSession,
  getCheckoutSession,
  getOrCreateStripeCustomer,
  STRIPE_PRICE_IDS
} from '../_shared/stripe.js';

/**
 * POST /api/stripe/checkout
 * Create a new checkout session
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const {
      price_id,
      tier,
      billing_interval = 'monthly',
      client_id,
      customer_email,
      success_url,
      cancel_url,
      commitment_months = 3
    } = body;

    // Validate required fields
    if (!success_url || !cancel_url) {
      return new Response(JSON.stringify({
        success: false,
        error: 'success_url and cancel_url are required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Determine price ID
    let priceId = price_id;
    if (!priceId && tier && billing_interval) {
      // Look up from database or config
      const product = await env.DB.prepare(`
        SELECT stripe_price_id FROM stripe_products
        WHERE tier = ? AND billing_interval = ? AND active = 1
      `).bind(tier, billing_interval).first();

      if (product) {
        priceId = product.stripe_price_id;
      } else if (STRIPE_PRICE_IDS[tier]?.[billing_interval]) {
        priceId = STRIPE_PRICE_IDS[tier][billing_interval];
      }
    }

    if (!priceId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'price_id is required, or provide tier and billing_interval'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get or create Stripe customer if client_id provided
    let customerId = null;
    let email = customer_email;

    if (client_id) {
      const client = await env.DB.prepare(
        'SELECT * FROM clients WHERE id = ?'
      ).bind(client_id).first();

      if (client) {
        email = client.email;
        if (client.stripe_customer_id) {
          customerId = client.stripe_customer_id;
        } else {
          const customer = await getOrCreateStripeCustomer(env, client);
          customerId = customer.id;

          // Update client with Stripe customer ID
          await env.DB.prepare(
            'UPDATE clients SET stripe_customer_id = ? WHERE id = ?'
          ).bind(customerId, client_id).run();
        }
      }
    }

    // Create checkout session
    const session = await createCheckoutSession(env, {
      priceId,
      customerId,
      customerEmail: customerId ? undefined : email,
      successUrl: success_url,
      cancelUrl: cancel_url,
      clientId: client_id,
      commitmentMonths: commitment_months,
      tier,
      billingInterval: billing_interval
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        session_id: session.id,
        url: session.url
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Create checkout session error:', error);
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
 * GET /api/stripe/checkout
 * Get checkout session details (for success page)
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'session_id query parameter is required'
    }), {
      status: 400,
      headers: corsHeaders
    });
  }

  try {
    const session = await getCheckoutSession(env, sessionId);

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        customer_email: session.customer_email || session.customer_details?.email,
        subscription_id: session.subscription?.id || session.subscription,
        customer_id: session.customer?.id || session.customer,
        amount_total: session.amount_total,
        currency: session.currency,
        metadata: session.metadata
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Get checkout session error:', error);
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
