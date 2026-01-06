/**
 * Billing Subscriptions API (Support Plans)
 *
 * GET /api/billing/subscriptions - Get client's active subscription
 * POST /api/billing/subscriptions - Create new support plan subscription
 * DELETE /api/billing/subscriptions/:id - Cancel subscription
 *
 * Integrates with Square Subscriptions API for recurring billing
 */

import { verifyClientAuth, verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';
import {
  getOrCreateCustomer,
  createSubscription,
  cancelSubscription,
  listCustomerSubscriptions,
  getLocationId,
  SUPPORT_PLAN_CATALOG_IDS
} from '../_shared/square.js';

// Support plan pricing (in cents for Square)
// MUST match website pricing in pages/Services.tsx
const SUPPORT_PLAN_PRICES = {
  core: 35000,         // $350/month
  professional: 50000, // $500/month
  premium: 80000       // $800/month
};

// Quarterly prices (for reference)
const SUPPORT_PLAN_QUARTERLY = {
  core: 105000,        // $1,050/quarter
  professional: 150000, // $1,500/quarter
  premium: 240000      // $2,400/quarter
};

// Annual prepay (11 months - 1 month free)
const SUPPORT_PLAN_ANNUAL = {
  core: 385000,        // $3,850/year (saves $350)
  professional: 550000, // $5,500/year (saves $500)
  premium: 880000      // $8,800/year (saves $800)
};

const SUPPORT_PLAN_HOURS = {
  core: 1.5,
  professional: 3,
  premium: 5
};

/**
 * GET /api/billing/subscriptions
 * Get subscription info for authenticated client
 */
export async function onRequestGet(context) {
  try {
    const { env, request } = context;
    const url = new URL(request.url);

    // Check for admin auth first
    const adminAuth = await verifyAuth(request, env);
    let clientId = url.searchParams.get('client_id');

    if (!adminAuth.authenticated) {
      // Try client auth
      const clientAuth = await verifyClientAuth(request, env);
      if (!clientAuth.authenticated) {
        return unauthorizedResponse('Authentication required');
      }
      clientId = clientAuth.clientId;
    }

    if (!clientId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'client_id required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get client info
    const client = await env.DB.prepare(
      'SELECT * FROM clients WHERE id = ?'
    ).bind(clientId).first();

    if (!client) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Build subscription response from client data
    const subscription = {
      active: client.support_plan_status === 'active',
      tier: client.support_plan_tier,
      status: client.support_plan_status,
      started_at: client.support_plan_started,
      renews_at: client.support_plan_renews,
      square_subscription_id: client.square_subscription_id,
      price: client.support_plan_tier ? SUPPORT_PLAN_PRICES[client.support_plan_tier] / 100 : null,
      hours: {
        total: client.support_plan_tier ? SUPPORT_PLAN_HOURS[client.support_plan_tier] : 0,
        used: client.support_hours_used || 0,
        remaining: client.support_plan_tier
          ? SUPPORT_PLAN_HOURS[client.support_plan_tier] - (client.support_hours_used || 0)
          : 0
      }
    };

    // If Square subscription exists, verify it's still active
    if (client.square_subscription_id && client.square_customer_id) {
      try {
        const squareSubscriptions = await listCustomerSubscriptions(env, client.square_customer_id);
        const activeSub = squareSubscriptions.find(
          sub => sub.id === client.square_subscription_id && sub.status === 'ACTIVE'
        );

        if (!activeSub && client.support_plan_status === 'active') {
          // Subscription was cancelled in Square, update local
          await env.DB.prepare(`
            UPDATE clients
            SET support_plan_status = 'cancelled', updated_at = unixepoch()
            WHERE id = ?
          `).bind(clientId).run();
          subscription.active = false;
          subscription.status = 'cancelled';
        }
      } catch (squareError) {
        console.error('Square subscription check failed:', squareError);
        // Continue with local data
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: subscription
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Get subscription error:', error);
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
 * POST /api/billing/subscriptions
 * Create a new support plan subscription
 */
export async function onRequestPost(context) {
  try {
    const { env, request } = context;

    // Admin auth required for creating subscriptions
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();
    const { client_id, tier, start_date } = body;

    if (!client_id || !tier) {
      return new Response(JSON.stringify({
        success: false,
        error: 'client_id and tier are required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!['core', 'professional', 'premium'].includes(tier)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid tier. Must be: core, professional, or premium'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get client info
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

    // Check if client already has active subscription
    if (client.support_plan_status === 'active') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client already has an active subscription. Cancel existing first.'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const locationId = getLocationId(env, client.service_lane || 'B');
    const startDateStr = start_date || new Date().toISOString().split('T')[0];
    const now = Math.floor(Date.now() / 1000);

    // Calculate next renewal date (1 month from start)
    const renewDate = new Date(startDateStr);
    renewDate.setMonth(renewDate.getMonth() + 1);
    const renewsAt = Math.floor(renewDate.getTime() / 1000);

    let squareSubscriptionId = null;

    // Ensure client has Square customer ID
    let squareCustomerId = client.square_customer_id;
    if (!squareCustomerId) {
      try {
        const squareCustomer = await getOrCreateCustomer(env, client);
        squareCustomerId = squareCustomer.id;
        await env.DB.prepare(
          'UPDATE clients SET square_customer_id = ? WHERE id = ?'
        ).bind(squareCustomerId, client_id).run();
      } catch (squareError) {
        console.error('Failed to create Square customer:', squareError);
      }
    }

    // Create Square subscription if catalog IDs are configured
    const planVariationId = SUPPORT_PLAN_CATALOG_IDS[tier];
    if (planVariationId && squareCustomerId) {
      try {
        const subscription = await createSubscription(env, {
          customerId: squareCustomerId,
          locationId: locationId,
          planVariationId: planVariationId,
          startDate: startDateStr
        });
        squareSubscriptionId = subscription.id;
      } catch (squareError) {
        console.error('Failed to create Square subscription:', squareError);
        // Continue without Square - can be manually invoiced
      }
    }

    // Update client record with subscription info
    await env.DB.prepare(`
      UPDATE clients SET
        support_plan_tier = ?,
        support_plan_status = 'active',
        support_plan_started = ?,
        support_plan_renews = ?,
        support_hours_used = 0,
        square_subscription_id = ?,
        updated_at = unixepoch()
      WHERE id = ?
    `).bind(tier, now, renewsAt, squareSubscriptionId, client_id).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        tier: tier,
        status: 'active',
        started_at: now,
        renews_at: renewsAt,
        square_subscription_id: squareSubscriptionId,
        price: SUPPORT_PLAN_PRICES[tier] / 100,
        hours: SUPPORT_PLAN_HOURS[tier]
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
 * DELETE /api/billing/subscriptions
 * Cancel a subscription
 */
export async function onRequestDelete(context) {
  try {
    const { env, request } = context;
    const url = new URL(request.url);

    // Admin auth required
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const clientId = url.searchParams.get('client_id');
    if (!clientId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'client_id required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get client info
    const client = await env.DB.prepare(
      'SELECT * FROM clients WHERE id = ?'
    ).bind(clientId).first();

    if (!client) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Cancel Square subscription if exists
    if (client.square_subscription_id) {
      try {
        await cancelSubscription(env, client.square_subscription_id);
      } catch (squareError) {
        console.error('Failed to cancel Square subscription:', squareError);
        // Continue - update local state anyway
      }
    }

    // Update client record
    await env.DB.prepare(`
      UPDATE clients SET
        support_plan_status = 'cancelled',
        square_subscription_id = NULL,
        updated_at = unixepoch()
      WHERE id = ?
    `).bind(clientId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Subscription cancelled successfully'
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
