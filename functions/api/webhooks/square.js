/**
 * Square Webhook Handler
 *
 * POST /api/webhooks/square - Receive Square webhook events
 *
 * Handles:
 * - invoice.payment_made - Update invoice status
 * - subscription.updated - Sync subscription status
 * - payment.completed - Log payment receipt
 * - customer.updated - Sync customer info
 */

import { verifyWebhookSignature } from '../_shared/square.js';

// CORS headers for webhook responses
const webhookHeaders = {
  'Content-Type': 'application/json'
};

/**
 * POST /api/webhooks/square
 * Handle incoming Square webhook events
 */
export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-square-hmacsha256-signature');
    const webhookUrl = request.url;

    // Verify webhook signature
    if (env.SQUARE_WEBHOOK_SIGNATURE_KEY && signature) {
      const isValid = await verifyWebhookSignature(
        signature,
        rawBody,
        env.SQUARE_WEBHOOK_SIGNATURE_KEY,
        webhookUrl
      );

      if (!isValid) {
        console.error('Invalid Square webhook signature');
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid signature'
        }), {
          status: 401,
          headers: webhookHeaders
        });
      }
    }

    // Parse the webhook payload
    const payload = JSON.parse(rawBody);
    const { type, data } = payload;

    console.log(`Square webhook received: ${type}`);

    // Route to appropriate handler
    switch (type) {
      case 'invoice.payment_made':
        await handleInvoicePayment(env, data);
        break;

      case 'invoice.updated':
        await handleInvoiceUpdate(env, data);
        break;

      case 'subscription.created':
      case 'subscription.updated':
        await handleSubscriptionUpdate(env, data);
        break;

      case 'subscription.canceled':
        await handleSubscriptionCancelled(env, data);
        break;

      case 'payment.completed':
        await handlePaymentCompleted(env, data);
        break;

      case 'customer.created':
      case 'customer.updated':
        await handleCustomerUpdate(env, data);
        break;

      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    return new Response(JSON.stringify({
      success: true,
      received: type
    }), {
      status: 200,
      headers: webhookHeaders
    });

  } catch (error) {
    console.error('Square webhook error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: webhookHeaders
    });
  }
}

/**
 * Handle invoice payment event
 */
async function handleInvoicePayment(env, data) {
  const invoice = data.object?.invoice;
  if (!invoice) return;

  console.log(`Invoice payment received: ${invoice.id}`);

  // Find client by Square customer ID
  const customerId = invoice.primary_recipient?.customer_id;
  if (!customerId) return;

  const client = await env.DB.prepare(
    'SELECT id FROM clients WHERE square_customer_id = ?'
  ).bind(customerId).first();

  if (client) {
    // Log payment in local database
    await env.DB.prepare(`
      INSERT INTO payment_logs (id, client_id, square_invoice_id, amount, status, created_at)
      VALUES (?, ?, ?, ?, 'paid', unixepoch())
    `).bind(
      crypto.randomUUID(),
      client.id,
      invoice.id,
      invoice.payment_requests?.[0]?.computed_amount_money?.amount || 0
    ).run();
  }
}

/**
 * Handle invoice status update
 */
async function handleInvoiceUpdate(env, data) {
  const invoice = data.object?.invoice;
  if (!invoice) return;

  console.log(`Invoice updated: ${invoice.id} - Status: ${invoice.status}`);

  // Could sync to local invoices table if needed
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdate(env, data) {
  const subscription = data.object?.subscription;
  if (!subscription) return;

  console.log(`Subscription updated: ${subscription.id} - Status: ${subscription.status}`);

  // Find client by subscription ID
  const client = await env.DB.prepare(
    'SELECT id FROM clients WHERE square_subscription_id = ?'
  ).bind(subscription.id).first();

  if (client) {
    // Map Square subscription status to our status
    const statusMap = {
      'ACTIVE': 'active',
      'CANCELED': 'cancelled',
      'PENDING': 'pending',
      'PAUSED': 'paused'
    };

    const newStatus = statusMap[subscription.status] || 'unknown';

    await env.DB.prepare(`
      UPDATE clients SET
        support_plan_status = ?,
        updated_at = unixepoch()
      WHERE id = ?
    `).bind(newStatus, client.id).run();
  }
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCancelled(env, data) {
  const subscription = data.object?.subscription;
  if (!subscription) return;

  console.log(`Subscription cancelled: ${subscription.id}`);

  // Find and update client
  await env.DB.prepare(`
    UPDATE clients SET
      support_plan_status = 'cancelled',
      updated_at = unixepoch()
    WHERE square_subscription_id = ?
  `).bind(subscription.id).run();
}

/**
 * Handle payment completed
 */
async function handlePaymentCompleted(env, data) {
  const payment = data.object?.payment;
  if (!payment) return;

  console.log(`Payment completed: ${payment.id} - ${payment.amount_money?.amount}`);

  // Log payment if we can identify the customer
  const customerId = payment.customer_id;
  if (!customerId) return;

  const client = await env.DB.prepare(
    'SELECT id FROM clients WHERE square_customer_id = ?'
  ).bind(customerId).first();

  if (client) {
    await env.DB.prepare(`
      INSERT INTO payment_logs (id, client_id, square_payment_id, amount, status, created_at)
      VALUES (?, ?, ?, ?, 'completed', unixepoch())
    `).bind(
      crypto.randomUUID(),
      client.id,
      payment.id,
      payment.amount_money?.amount || 0
    ).run();
  }
}

/**
 * Handle customer updates from Square
 */
async function handleCustomerUpdate(env, data) {
  const customer = data.object?.customer;
  if (!customer) return;

  console.log(`Customer updated: ${customer.id}`);

  // Update client info if email/phone changed
  const client = await env.DB.prepare(
    'SELECT id FROM clients WHERE square_customer_id = ?'
  ).bind(customer.id).first();

  if (client) {
    await env.DB.prepare(`
      UPDATE clients SET
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        updated_at = unixepoch()
      WHERE id = ?
    `).bind(
      customer.email_address,
      customer.phone_number,
      client.id
    ).run();
  }
}

// No OPTIONS needed - webhooks are server-to-server
