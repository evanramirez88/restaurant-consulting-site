/**
 * Stripe Subscriptions API
 *
 * GET /api/stripe/subscriptions - List subscriptions for client
 * GET /api/stripe/subscriptions?subscription_id=xxx - Get specific subscription
 * POST /api/stripe/subscriptions - Create subscription directly (admin)
 * DELETE /api/stripe/subscriptions?subscription_id=xxx - Cancel subscription
 *
 * Manages Stripe subscription lifecycle with commitment tracking
 */

import { verifyAuth, verifyClientAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../_shared/auth.js';
import {
  getStripeClient,
  getOrCreateStripeCustomer,
  createStripeSubscription,
  cancelStripeSubscription,
  getStripeSubscription,
  listCustomerSubscriptions,
  mapSubscriptionStatus,
  calculateMRR,
  STRIPE_PRICE_IDS
} from '../_shared/stripe.js';

/**
 * GET /api/stripe/subscriptions
 * Get subscription(s) for client or specific subscription
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    // Check admin auth first
    const adminAuth = await verifyAuth(request, env);
    let clientId = url.searchParams.get('client_id');
    let subscriptionId = url.searchParams.get('subscription_id');

    if (!adminAuth.authenticated) {
      // Try client auth
      const clientAuth = await verifyClientAuth(request, env);
      if (!clientAuth.authenticated) {
        return unauthorizedResponse('Authentication required');
      }
      clientId = clientAuth.clientId;
    }

    // Get specific subscription
    if (subscriptionId) {
      const subscription = await getStripeSubscription(env, subscriptionId);

      // Get local data
      const localSub = await env.DB.prepare(`
        SELECT * FROM stripe_subscriptions WHERE subscription_id = ?
      `).bind(subscriptionId).first();

      const commitment = await env.DB.prepare(`
        SELECT * FROM stripe_commitment_tracking WHERE subscription_id = ?
      `).bind(subscriptionId).first();

      return new Response(JSON.stringify({
        success: true,
        data: {
          id: subscription.id,
          status: subscription.status,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          cancel_at_period_end: subscription.cancel_at_period_end,
          canceled_at: subscription.canceled_at,
          tier: localSub?.plan_tier,
          billing_interval: localSub?.billing_interval,
          price_id: subscription.items.data[0]?.price.id,
          mrr: calculateMRR(subscription),
          commitment: commitment ? {
            start_date: commitment.commitment_start_date,
            end_date: commitment.commitment_end_date,
            months: commitment.commitment_months,
            fulfilled: commitment.commitment_fulfilled === 1
          } : null,
          customer: {
            id: subscription.customer.id || subscription.customer,
            email: subscription.customer.email
          }
        }
      }), {
        headers: corsHeaders
      });
    }

    // List subscriptions for client
    if (!clientId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'client_id or subscription_id is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get client's Stripe customer ID
    const client = await env.DB.prepare(
      'SELECT stripe_customer_id FROM clients WHERE id = ?'
    ).bind(clientId).first();

    if (!client?.stripe_customer_id) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          subscriptions: [],
          message: 'No Stripe customer found'
        }
      }), {
        headers: corsHeaders
      });
    }

    // Get subscriptions from Stripe
    const subscriptions = await listCustomerSubscriptions(env, client.stripe_customer_id);

    // Enrich with local data
    const enrichedSubs = await Promise.all(subscriptions.map(async (sub) => {
      const localSub = await env.DB.prepare(`
        SELECT * FROM stripe_subscriptions WHERE subscription_id = ?
      `).bind(sub.id).first();

      return {
        id: sub.id,
        status: sub.status,
        current_period_end: sub.current_period_end,
        cancel_at_period_end: sub.cancel_at_period_end,
        tier: localSub?.plan_tier,
        billing_interval: localSub?.billing_interval,
        mrr: calculateMRR(sub)
      };
    }));

    return new Response(JSON.stringify({
      success: true,
      data: {
        subscriptions: enrichedSubs
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Get subscriptions error:', error);
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
 * POST /api/stripe/subscriptions
 * Create subscription directly (admin only)
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  // Admin auth required
  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const body = await request.json();
    const {
      client_id,
      price_id,
      tier,
      billing_interval = 'monthly',
      commitment_months = 3,
      trial_days
    } = body;

    if (!client_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'client_id is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get client
    const client = await env.DB.prepare(
      'SELECT * FROM clients WHERE id = ?'
    ).bind(client_id).first();

    if (!client) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Check for existing active subscription
    if (client.stripe_subscription_id) {
      const existingSub = await env.DB.prepare(`
        SELECT status FROM stripe_subscriptions WHERE subscription_id = ?
      `).bind(client.stripe_subscription_id).first();

      if (existingSub?.status === 'active') {
        return new Response(JSON.stringify({
          success: false,
          error: 'Client already has an active subscription'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
    }

    // Get or create Stripe customer
    let customerId = client.stripe_customer_id;
    if (!customerId) {
      const customer = await getOrCreateStripeCustomer(env, client);
      customerId = customer.id;

      await env.DB.prepare(
        'UPDATE clients SET stripe_customer_id = ? WHERE id = ?'
      ).bind(customerId, client_id).run();
    }

    // Determine price ID
    let priceId = price_id;
    if (!priceId && tier && billing_interval) {
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

    // Create subscription
    const subscription = await createStripeSubscription(env, {
      customerId,
      priceId,
      clientId: client_id,
      tier,
      commitmentMonths: commitment_months,
      trialDays: trial_days
    });

    // Update client record
    await env.DB.prepare(`
      UPDATE clients SET
        stripe_subscription_id = ?,
        stripe_subscription_status = ?,
        support_plan_tier = ?,
        support_plan_status = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      subscription.id,
      subscription.status,
      tier,
      mapSubscriptionStatus(subscription.status),
      client_id
    ).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        subscription_id: subscription.id,
        status: subscription.status,
        tier: tier,
        billing_interval: billing_interval,
        current_period_end: subscription.current_period_end,
        client_secret: subscription.latest_invoice?.payment_intent?.client_secret
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Create subscription error:', error);
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
 * DELETE /api/stripe/subscriptions
 * Cancel subscription
 */
export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Admin auth required for direct cancellation
  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error);
  }

  const subscriptionId = url.searchParams.get('subscription_id');
  const clientId = url.searchParams.get('client_id');
  const immediate = url.searchParams.get('immediate') === 'true';
  const reason = url.searchParams.get('reason');

  try {
    let subId = subscriptionId;

    // Get subscription ID from client if not provided
    if (!subId && clientId) {
      const client = await env.DB.prepare(
        'SELECT stripe_subscription_id FROM clients WHERE id = ?'
      ).bind(clientId).first();

      if (client?.stripe_subscription_id) {
        subId = client.stripe_subscription_id;
      }
    }

    if (!subId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'subscription_id or client_id is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Check commitment status
    const commitment = await env.DB.prepare(`
      SELECT * FROM stripe_commitment_tracking
      WHERE subscription_id = ? AND commitment_fulfilled = 0
    `).bind(subId).first();

    let earlyTerminationWarning = null;
    if (commitment) {
      const endDate = new Date(commitment.commitment_end_date);
      if (new Date() < endDate) {
        const monthsRemaining = Math.ceil(
          (endDate.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)
        );
        const etfAmount = monthsRemaining * (commitment.monthly_commitment_amount || 0);

        earlyTerminationWarning = {
          months_remaining: monthsRemaining,
          fee_amount: etfAmount / 100,
          message: `Cancellation within commitment period. Early termination fee of $${(etfAmount / 100).toFixed(2)} will be charged.`
        };
      }
    }

    // Cancel subscription
    const canceledSub = await cancelStripeSubscription(env, subId, {
      atPeriodEnd: !immediate,
      cancellationReason: reason
    });

    // Update local records
    await env.DB.prepare(`
      UPDATE stripe_subscriptions SET
        cancel_at_period_end = ?,
        cancellation_reason = ?,
        updated_at = datetime('now')
      WHERE subscription_id = ?
    `).bind(immediate ? 0 : 1, reason || null, subId).run();

    if (immediate) {
      await env.DB.prepare(`
        UPDATE stripe_subscriptions SET
          status = 'canceled',
          canceled_at = datetime('now'),
          ended_at = datetime('now')
        WHERE subscription_id = ?
      `).bind(subId).run();
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        subscription_id: subId,
        status: canceledSub.status,
        cancel_at_period_end: canceledSub.cancel_at_period_end,
        current_period_end: canceledSub.current_period_end,
        early_termination: earlyTerminationWarning
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
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
