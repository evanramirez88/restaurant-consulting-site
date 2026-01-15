/**
 * Stripe Webhook Handler
 *
 * POST /api/stripe/webhook
 *
 * Handles all Stripe webhook events with:
 * - Workers-compatible signature verification
 * - Idempotent event processing
 * - Background processing via waitUntil
 * - HubSpot sync for subscription changes
 *
 * Required webhook events to configure in Stripe Dashboard:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.paid
 * - invoice.payment_failed
 * - invoice.upcoming
 * - quote.accepted
 * - customer.created
 */

import {
  getStripeClient,
  verifyStripeWebhook,
  calculateMRR,
  getBillingInterval,
  mapSubscriptionStatus
} from '../_shared/stripe.js';

// CORS headers for webhook responses
const corsHeaders = {
  'Content-Type': 'application/json'
};

/**
 * POST /api/stripe/webhook
 */
export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;

  // Get signature header
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new Response(JSON.stringify({
      error: 'Missing stripe-signature header'
    }), {
      status: 400,
      headers: corsHeaders
    });
  }

  // Get raw body for signature verification
  const rawBody = await request.text();

  let event;
  try {
    event = await verifyStripeWebhook(env, rawBody, signature);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response(JSON.stringify({
      error: 'Invalid signature'
    }), {
      status: 400,
      headers: corsHeaders
    });
  }

  // Process webhook in background, return 200 immediately
  // This prevents Stripe from retrying due to timeout
  waitUntil(processWebhookEvent(event, env));

  return new Response(JSON.stringify({
    received: true,
    type: event.type,
    id: event.id
  }), {
    status: 200,
    headers: corsHeaders
  });
}

/**
 * Process webhook event with idempotency
 */
async function processWebhookEvent(event, env) {
  const db = env.DB;

  // Idempotency check - skip if already processed
  const existing = await db.prepare(
    'SELECT id FROM stripe_subscription_events WHERE stripe_event_id = ?'
  ).bind(event.id).first();

  if (existing) {
    console.log(`Event ${event.id} already processed, skipping`);
    return;
  }

  // Record event for idempotency (before processing)
  await db.prepare(`
    INSERT INTO stripe_subscription_events (stripe_event_id, event_type, payload, processing_status, api_version)
    VALUES (?, ?, ?, 'processing', ?)
  `).bind(event.id, event.type, JSON.stringify(event), event.api_version || '').run();

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object, env);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object, env);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, env);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, env);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object, env);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object, env);
        break;

      case 'invoice.upcoming':
        await handleInvoiceUpcoming(event.data.object, env);
        break;

      case 'quote.accepted':
        await handleQuoteAccepted(event.data.object, env);
        break;

      case 'customer.created':
        await handleCustomerCreated(event.data.object, env);
        break;

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

    // Mark as completed
    await db.prepare(`
      UPDATE stripe_subscription_events
      SET processing_status = 'completed', processed_at = datetime('now')
      WHERE stripe_event_id = ?
    `).bind(event.id).run();

  } catch (error) {
    console.error(`Error processing ${event.type}:`, error);

    // Mark as failed
    await db.prepare(`
      UPDATE stripe_subscription_events
      SET processing_status = 'failed', processing_error = ?
      WHERE stripe_event_id = ?
    `).bind(String(error.message || error), event.id).run();

    throw error;
  }
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Handle checkout.session.completed
 * Initial subscription creation via Checkout
 */
async function handleCheckoutCompleted(session, env) {
  console.log(`Checkout completed: ${session.id}, subscription: ${session.subscription}`);

  // The subscription.created webhook handles the actual provisioning
  // Here we can link the checkout session to any pre-existing client record

  if (session.client_reference_id || session.metadata?.client_id) {
    const clientId = session.client_reference_id || session.metadata.client_id;

    // Update client with Stripe customer ID if not already set
    await env.DB.prepare(`
      UPDATE clients SET
        stripe_customer_id = COALESCE(stripe_customer_id, ?),
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(session.customer, clientId).run();
  }
}

/**
 * Handle customer.subscription.created
 * Provision access for new subscription
 */
async function handleSubscriptionCreated(subscription, env) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

  // Extract metadata
  const clientId = subscription.metadata?.client_id || null;
  const tier = subscription.metadata?.tier || null;
  const commitmentMonths = parseInt(subscription.metadata?.commitment_months || '3');

  // Calculate commitment dates
  const commitmentStart = new Date();
  const commitmentEnd = new Date();
  commitmentEnd.setMonth(commitmentEnd.getMonth() + commitmentMonths);

  // Determine billing interval from price
  const billingInterval = getBillingInterval(subscription.items.data[0]?.price);

  // Insert subscription record
  await env.DB.prepare(`
    INSERT INTO stripe_subscriptions (
      subscription_id, client_id, stripe_customer_id, status,
      current_period_start, current_period_end, price_id, billing_interval,
      plan_tier, commitment_start_date, commitment_end_date, commitment_months
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    subscription.id,
    clientId,
    customerId,
    subscription.status,
    new Date(subscription.current_period_start * 1000).toISOString(),
    new Date(subscription.current_period_end * 1000).toISOString(),
    subscription.items.data[0]?.price.id,
    billingInterval,
    tier,
    commitmentStart.toISOString(),
    commitmentEnd.toISOString(),
    commitmentMonths
  ).run();

  // Create commitment tracking record
  await env.DB.prepare(`
    INSERT INTO stripe_commitment_tracking (
      subscription_id, client_id, stripe_customer_id,
      commitment_start_date, commitment_end_date, commitment_months,
      monthly_commitment_amount
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    subscription.id,
    clientId,
    customerId,
    commitmentStart.toISOString(),
    commitmentEnd.toISOString(),
    commitmentMonths,
    subscription.items.data[0]?.price.unit_amount || 0
  ).run();

  // Update client record if linked
  if (clientId) {
    const mrr = calculateMRR(subscription);
    await env.DB.prepare(`
      UPDATE clients SET
        stripe_customer_id = ?,
        stripe_subscription_id = ?,
        stripe_subscription_status = ?,
        stripe_mrr = ?,
        support_plan_tier = ?,
        support_plan_status = 'active',
        support_plan_started = unixepoch(),
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      customerId,
      subscription.id,
      subscription.status,
      Math.round(mrr * 100),
      tier,
      clientId
    ).run();
  }

  // Sync to HubSpot
  await syncSubscriptionToHubSpot(subscription, 'created', env);

  console.log(`Subscription created: ${subscription.id} for customer ${customerId}`);
}

/**
 * Handle customer.subscription.updated
 * Plan changes, renewals, cancellation scheduling
 */
async function handleSubscriptionUpdated(subscription, env) {
  await env.DB.prepare(`
    UPDATE stripe_subscriptions SET
      status = ?,
      current_period_start = ?,
      current_period_end = ?,
      cancel_at_period_end = ?,
      updated_at = datetime('now')
    WHERE subscription_id = ?
  `).bind(
    subscription.status,
    new Date(subscription.current_period_start * 1000).toISOString(),
    new Date(subscription.current_period_end * 1000).toISOString(),
    subscription.cancel_at_period_end ? 1 : 0,
    subscription.id
  ).run();

  // Update client record
  const subRecord = await env.DB.prepare(
    'SELECT client_id FROM stripe_subscriptions WHERE subscription_id = ?'
  ).bind(subscription.id).first();

  if (subRecord?.client_id) {
    await env.DB.prepare(`
      UPDATE clients SET
        stripe_subscription_status = ?,
        support_plan_status = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      subscription.status,
      mapSubscriptionStatus(subscription.status),
      subRecord.client_id
    ).run();
  }

  // Handle cancellation attempt within commitment period
  if (subscription.cancel_at_period_end) {
    await handleCancellationAttempt(subscription, env);
  }

  await syncSubscriptionToHubSpot(subscription, 'updated', env);
}

/**
 * Handle customer.subscription.deleted
 * Revoke access, mark commitment status
 */
async function handleSubscriptionDeleted(subscription, env) {
  await env.DB.prepare(`
    UPDATE stripe_subscriptions SET
      status = 'canceled',
      canceled_at = datetime('now'),
      ended_at = datetime('now'),
      updated_at = datetime('now')
    WHERE subscription_id = ?
  `).bind(subscription.id).run();

  // Update commitment tracking
  await env.DB.prepare(`
    UPDATE stripe_commitment_tracking SET
      commitment_fulfilled = CASE
        WHEN datetime('now') >= datetime(commitment_end_date) THEN 1
        ELSE 0
      END,
      updated_at = datetime('now')
    WHERE subscription_id = ?
  `).bind(subscription.id).run();

  // Update client record
  const subRecord = await env.DB.prepare(
    'SELECT client_id FROM stripe_subscriptions WHERE subscription_id = ?'
  ).bind(subscription.id).first();

  if (subRecord?.client_id) {
    await env.DB.prepare(`
      UPDATE clients SET
        stripe_subscription_status = 'canceled',
        stripe_subscription_id = NULL,
        stripe_mrr = 0,
        support_plan_status = 'cancelled',
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(subRecord.client_id).run();
  }

  await syncSubscriptionToHubSpot(subscription, 'canceled', env);
}

/**
 * Handle invoice.paid
 * Confirm payment, update status
 */
async function handleInvoicePaid(invoice, env) {
  if (!invoice.subscription) return;

  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription.id;

  await env.DB.prepare(`
    UPDATE stripe_subscriptions SET
      status = 'active',
      updated_at = datetime('now')
    WHERE subscription_id = ?
  `).bind(subscriptionId).run();

  console.log(`Invoice ${invoice.id} paid for subscription ${subscriptionId}`);
}

/**
 * Handle invoice.payment_failed
 * Notify customer, update status
 */
async function handlePaymentFailed(invoice, env) {
  if (!invoice.subscription) return;

  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription.id;

  await env.DB.prepare(`
    UPDATE stripe_subscriptions SET
      status = 'past_due',
      updated_at = datetime('now')
    WHERE subscription_id = ?
  `).bind(subscriptionId).run();

  // TODO: Send notification email to customer via Resend
  console.log(`Payment failed for subscription ${subscriptionId}, invoice ${invoice.id}`);
}

/**
 * Handle invoice.upcoming
 * Add overage charges before invoice finalizes
 */
async function handleInvoiceUpcoming(invoice, env) {
  if (!invoice.subscription) return;

  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription.id;

  // Check for unbilled overages
  const overages = await env.DB.prepare(`
    SELECT * FROM stripe_subscription_overages
    WHERE subscription_id = ? AND billed = 0 AND overage_units > 0
  `).bind(subscriptionId).all();

  if (overages.results.length > 0) {
    const stripe = getStripeClient(env);

    for (const overage of overages.results) {
      // Add overage as invoice item
      const invoiceItem = await stripe.invoiceItems.create({
        customer: invoice.customer,
        amount: overage.overage_amount,
        currency: 'usd',
        description: `Overage: ${overage.overage_units} ${overage.usage_type || 'support hours'} @ $${(overage.overage_rate / 100).toFixed(2)}/unit`
      });

      // Mark as billed
      await env.DB.prepare(`
        UPDATE stripe_subscription_overages SET
          billed = 1,
          billed_at = datetime('now'),
          stripe_invoice_item_id = ?
        WHERE id = ?
      `).bind(invoiceItem.id, overage.id).run();
    }

    console.log(`Added ${overages.results.length} overage items to upcoming invoice for ${subscriptionId}`);
  }
}

/**
 * Handle quote.accepted
 * Quote converted to subscription
 */
async function handleQuoteAccepted(quote, env) {
  console.log(`Quote ${quote.id} accepted, subscription: ${quote.subscription}`);

  // The subscription.created webhook handles the subscription
  // Update HubSpot deal if linked
  if (quote.metadata?.hubspot_deal_id && env.HUBSPOT_ACCESS_TOKEN) {
    await updateHubSpotDeal(quote.metadata.hubspot_deal_id, {
      dealstage: 'closedwon',
      stripe_quote_id: quote.id,
      stripe_subscription_id: quote.subscription
    }, env);
  }
}

/**
 * Handle customer.created
 * Link Stripe customer to internal client
 */
async function handleCustomerCreated(customer, env) {
  // Check if there's a client with matching email
  if (customer.email) {
    await env.DB.prepare(`
      UPDATE clients SET
        stripe_customer_id = ?
      WHERE email = ? AND stripe_customer_id IS NULL
    `).bind(customer.id, customer.email).run();
  }

  // Also check for client_id in metadata
  if (customer.metadata?.client_id) {
    await env.DB.prepare(`
      UPDATE clients SET
        stripe_customer_id = ?
      WHERE id = ?
    `).bind(customer.id, customer.metadata.client_id).run();
  }

  // Create stripe_customers record
  await env.DB.prepare(`
    INSERT OR IGNORE INTO stripe_customers (client_id, stripe_customer_id, email, name)
    SELECT id, ?, ?, ?
    FROM clients
    WHERE email = ? OR id = ?
    LIMIT 1
  `).bind(
    customer.id,
    customer.email,
    customer.name,
    customer.email,
    customer.metadata?.client_id || -1
  ).run();
}

// ============================================
// COMMITMENT ENFORCEMENT
// ============================================

/**
 * Handle cancellation attempt within commitment period
 * Creates early termination fee invoice if needed
 */
async function handleCancellationAttempt(subscription, env) {
  const commitment = await env.DB.prepare(`
    SELECT commitment_end_date, commitment_fulfilled, monthly_commitment_amount
    FROM stripe_commitment_tracking
    WHERE subscription_id = ? AND commitment_fulfilled = 0
  `).bind(subscription.id).first();

  if (!commitment) return;

  const commitmentEnd = new Date(commitment.commitment_end_date);
  if (new Date() >= commitmentEnd) {
    // Commitment fulfilled, allow cancellation
    return;
  }

  // Calculate early termination fee
  const monthsRemaining = Math.ceil(
    (commitmentEnd.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)
  );
  const etfAmount = monthsRemaining * commitment.monthly_commitment_amount;

  console.log(`Early termination detected: ${monthsRemaining} months remaining, ETF: $${etfAmount / 100}`);

  // Create invoice for early termination fee
  const stripe = getStripeClient(env);
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

  await stripe.invoiceItems.create({
    customer: customerId,
    amount: etfAmount,
    currency: 'usd',
    description: `Early termination fee - ${monthsRemaining} months remaining in commitment`
  });

  const invoice = await stripe.invoices.create({
    customer: customerId,
    auto_advance: true,
    collection_method: 'charge_automatically'
  });

  await stripe.invoices.finalizeInvoice(invoice.id);

  // Update tracking
  await env.DB.prepare(`
    UPDATE stripe_commitment_tracking SET
      early_termination_requested = 1,
      early_termination_requested_at = datetime('now'),
      early_termination_fee_calculated = ?,
      early_termination_invoice_id = ?
    WHERE subscription_id = ?
  `).bind(etfAmount, invoice.id, subscription.id).run();
}

// ============================================
// HUBSPOT SYNC
// ============================================

/**
 * Sync subscription changes to HubSpot
 */
async function syncSubscriptionToHubSpot(subscription, action, env) {
  if (!env.HUBSPOT_ACCESS_TOKEN) return;

  try {
    const stripe = getStripeClient(env);
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.email) return;

    const mrr = calculateMRR(subscription);
    const tier = subscription.metadata?.tier || subscription.items.data[0]?.price.nickname || 'Standard';

    // Update HubSpot contact
    const updateUrl = `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(customer.email)}?idProperty=email`;

    await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.HUBSPOT_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        properties: {
          stripe_customer_id: customer.id,
          subscription_status: subscription.status,
          subscription_plan: tier,
          subscription_start_date: new Date(subscription.start_date * 1000).toISOString().split('T')[0],
          subscription_renewal_date: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
          mrr: String(mrr)
        }
      })
    });

    // Create deal for new subscriptions
    if (action === 'created') {
      await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.HUBSPOT_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          properties: {
            dealname: `Toast Guardian - ${customer.email}`,
            amount: String(mrr * 12),
            dealstage: 'closedwon',
            pipeline: 'default',
            stripe_subscription_id: subscription.id,
            closedate: new Date().toISOString()
          }
        })
      });
    }

    console.log(`HubSpot synced for ${customer.email}: ${action}`);
  } catch (error) {
    console.error('HubSpot sync failed:', error);
    // Don't throw - HubSpot sync is non-critical
  }
}

/**
 * Update HubSpot deal
 */
async function updateHubSpotDeal(dealId, properties, env) {
  if (!env.HUBSPOT_ACCESS_TOKEN) return;

  try {
    await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.HUBSPOT_ACCESS_TOKEN}`
      },
      body: JSON.stringify({ properties })
    });
  } catch (error) {
    console.error('HubSpot deal update failed:', error);
  }
}
