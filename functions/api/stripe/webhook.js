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
 * - Email notifications via Resend for payment failures and cancellations
 * - Admin alerts for payment failures and subscription changes
 *
 * Required webhook events to configure in Stripe Dashboard:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted (sends cancellation confirmation email)
 * - invoice.paid
 * - invoice.payment_failed (sends payment failure notification + admin alert)
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

import {
  enrollFromStripeSubscription,
  enrollForPaymentFailure
} from '../_shared/email-enrollment.js';

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

  // Enroll new subscriber in welcome email sequence
  try {
    const stripe = getStripeClient(env);
    const customer = await stripe.customers.retrieve(customerId);

    if (customer && customer.email) {
      const enrollResult = await enrollFromStripeSubscription(env, subscription, customer);
      if (enrollResult.enrolled) {
        console.log(`New subscriber ${customer.email} enrolled in welcome sequence: ${enrollResult.sequenceName}`);
      } else if (enrollResult.reason) {
        console.log(`Subscriber ${customer.email} not enrolled: ${enrollResult.reason}`);
      }
    }
  } catch (enrollError) {
    console.error('Email enrollment failed for new subscription:', enrollError);
    // Non-critical - don't fail the webhook
  }

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
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

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
    'SELECT client_id, plan_tier FROM stripe_subscriptions WHERE subscription_id = ?'
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

  // Get customer email and send cancellation confirmation
  const customerEmail = await getCustomerEmail(env, customerId);
  const planName = subRecord?.plan_tier
    ? `Restaurant Guardian ${subRecord.plan_tier}`
    : 'your subscription';

  if (customerEmail) {
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #6b7280; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Subscription Cancelled</h1>
    </div>
    <div class="content">
      <p>Hi there,</p>

      <p>Your <strong>${planName}</strong> subscription has been cancelled as requested.</p>

      <p>We're sorry to see you go! If this was a mistake or you'd like to resubscribe in the future, you can always sign up again on our website.</p>

      <p><strong>What you'll miss:</strong></p>
      <ul>
        <li>Priority Toast POS support</li>
        <li>24/7 emergency assistance</li>
        <li>Quarterly system audits</li>
        <li>Dedicated account manager</li>
      </ul>

      <p>If you have any questions or feedback about your experience, we'd love to hear from you:</p>

      <a href="mailto:ramirezconsulting.rg@gmail.com" class="button">Contact Us</a>

      <p>Best regards,<br>R&G Consulting Team</p>
    </div>
    <div class="footer">
      <p>R&G Consulting LLC | Cape Cod Restaurant Consulting</p>
    </div>
  </div>
</body>
</html>
    `;

    const emailText = `
Subscription Cancelled

Hi there,

Your ${planName} subscription has been cancelled as requested.

We're sorry to see you go! If this was a mistake or you'd like to resubscribe in the future, you can always sign up again on our website.

If you have any questions or feedback about your experience, we'd love to hear from you.

Contact us at: ramirezconsulting.rg@gmail.com or 774-408-0083

Best regards,
R&G Consulting Team
    `;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'R&G Consulting <billing@ccrestaurantconsulting.com>',
        to: [customerEmail],
        subject: `Your ${planName} Subscription Has Been Cancelled`,
        html: emailHtml,
        text: emailText,
        reply_to: 'ramirezconsulting.rg@gmail.com'
      })
    });

    console.log('[Stripe] Cancellation confirmation email sent to:', customerEmail);

    // Notify admin of cancellation
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'R&G Consulting <alerts@ccrestaurantconsulting.com>',
        to: ['ramirezconsulting.rg@gmail.com'],
        subject: `[ALERT] Subscription Cancelled: ${customerEmail}`,
        text: `Subscription cancelled for ${customerEmail}\n\nPlan: ${planName}\nSubscription ID: ${subscription.id}\nCustomer ID: ${customerId}`
      })
    });
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
 * Notify customer, update status, send payment failure email
 */
async function handlePaymentFailed(invoice, env) {
  const customerId = invoice.customer;
  const invoiceId = invoice.id;
  const amountDue = invoice.amount_due;
  const attemptCount = invoice.attempt_count;

  console.log(`[Stripe] Payment failed for customer ${customerId}, invoice ${invoiceId}`);

  // Update subscription status if subscription exists
  if (invoice.subscription) {
    const subscriptionId = typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription.id;

    await env.DB.prepare(`
      UPDATE stripe_subscriptions SET
        status = 'past_due',
        updated_at = datetime('now')
      WHERE subscription_id = ?
    `).bind(subscriptionId).run();
  }

  // Get customer email from Stripe
  let customerEmail = invoice.customer_email;

  if (!customerEmail) {
    // Fetch from Stripe if not in invoice
    const customerResponse = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`
      }
    });
    const customer = await customerResponse.json();
    customerEmail = customer.email;
  }

  if (!customerEmail) {
    console.error('[Stripe] No email found for customer:', customerId);
    return;
  }

  // Get subscription details
  const subscriptionId = invoice.subscription
    ? (typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id)
    : null;
  let planName = 'your subscription';

  if (subscriptionId) {
    const sub = await env.DB.prepare(
      'SELECT plan_tier FROM stripe_subscriptions WHERE subscription_id = ?'
    ).bind(subscriptionId).first();
    if (sub && sub.plan_tier) planName = `Restaurant Guardian ${sub.plan_tier}`;
  }

  // Send payment failure email via Resend
  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Payment Failed</h1>
    </div>
    <div class="content">
      <p>Hi there,</p>

      <p>We were unable to process your payment for <strong>${planName}</strong>.</p>

      <p><strong>Amount:</strong> $${(amountDue / 100).toFixed(2)}</p>
      <p><strong>Attempt:</strong> ${attemptCount} of 4</p>

      <p>This could be due to:</p>
      <ul>
        <li>Insufficient funds</li>
        <li>Expired card</li>
        <li>Card declined by your bank</li>
      </ul>

      <p>Please update your payment method to avoid service interruption:</p>

      <a href="https://ccrestaurantconsulting.com/#/portal" class="button">Update Payment Method</a>

      <p>If you have any questions, reply to this email or call us at 774-408-0083.</p>

      <p>Best regards,<br>R&G Consulting Team</p>
    </div>
    <div class="footer">
      <p>R&G Consulting LLC | Cape Cod Restaurant Consulting</p>
    </div>
  </div>
</body>
</html>
  `;

  const emailText = `
Payment Failed

Hi there,

We were unable to process your payment for ${planName}.

Amount: $${(amountDue / 100).toFixed(2)}
Attempt: ${attemptCount} of 4

Please update your payment method at: https://ccrestaurantconsulting.com/#/portal

If you have any questions, reply to this email or call us at 774-408-0083.

Best regards,
R&G Consulting Team
  `;

  // Send via Resend
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'R&G Consulting <billing@ccrestaurantconsulting.com>',
      to: [customerEmail],
      subject: `Action Required: Payment Failed for ${planName}`,
      html: emailHtml,
      text: emailText,
      reply_to: 'ramirezconsulting.rg@gmail.com'
    })
  });

  if (!resendResponse.ok) {
    const error = await resendResponse.json();
    console.error('[Stripe] Failed to send payment failure email:', error);
  } else {
    console.log('[Stripe] Payment failure email sent to:', customerEmail);
  }

  // Log in database
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT INTO stripe_subscription_events (stripe_event_id, event_type, payload, processing_status, api_version)
    VALUES (?, 'payment_failed_notification', ?, 'completed', '')
  `).bind(
    `notif_${invoiceId}_${now}`,
    JSON.stringify({ amountDue, attemptCount, email: customerEmail, customerId })
  ).run();

  // Also notify admin
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'R&G Consulting <alerts@ccrestaurantconsulting.com>',
      to: ['ramirezconsulting.rg@gmail.com'],
      subject: `[ALERT] Payment Failed: ${customerEmail}`,
      text: `Payment failed for ${customerEmail}\n\nAmount: $${(amountDue / 100).toFixed(2)}\nAttempt: ${attemptCount}\nPlan: ${planName}\nCustomer ID: ${customerId}\nInvoice ID: ${invoiceId}`
    })
  });

  console.log(`[Stripe] Admin notification sent for payment failure: ${customerEmail}`);
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
            dealname: `Restaurant Guardian - ${customer.email}`,
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

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get customer email from Stripe API
 * @param {Object} env - Environment variables
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<string|null>} Customer email or null
 */
async function getCustomerEmail(env, customerId) {
  try {
    const customerResponse = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`
      }
    });

    if (!customerResponse.ok) {
      console.error('[Stripe] Failed to fetch customer:', customerId, customerResponse.status);
      return null;
    }

    const customer = await customerResponse.json();
    return customer.email || null;
  } catch (error) {
    console.error('[Stripe] Error fetching customer email:', error);
    return null;
  }
}
