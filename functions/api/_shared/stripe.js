/**
 * Stripe API Client Module for Cloudflare Workers
 *
 * Provides a unified interface for Stripe Billing operations including:
 * - Checkout Sessions (subscription signups)
 * - Customer Portal (self-service management)
 * - Subscriptions (support plans)
 * - Invoices (one-time and recurring)
 * - Quotes (custom/bespoke pricing)
 * - Webhook verification (Workers-compatible)
 *
 * ==========================================================================
 * STRIPE CONFIGURATION NOTES
 * ==========================================================================
 *
 * Support Plans (Toast Guardian):
 * - Core: $350/month, $1,050/quarter, $3,850/year (11 months)
 * - Professional: $500/month, $1,500/quarter, $5,500/year
 * - Premium: $800/month, $2,400/quarter, $8,800/year
 *
 * Required Environment Variables:
 * - STRIPE_SECRET_KEY: sk_live_xxx or sk_test_xxx
 * - STRIPE_WEBHOOK_SECRET: whsec_xxx
 * - STRIPE_PUBLISHABLE_KEY: pk_live_xxx or pk_test_xxx (for frontend)
 *
 * Stripe Dashboard Setup:
 * 1. Create Products for each support tier
 * 2. Create Prices for monthly/quarterly/annual
 * 3. Set up Webhook endpoint at /api/stripe/webhook
 * 4. Configure Customer Portal settings
 * 5. Enable test mode for development
 * ==========================================================================
 */

import Stripe from 'stripe';

/**
 * SubtleCrypto provider for Workers-compatible webhook verification
 */
export const cryptoProvider = Stripe.createSubtleCryptoProvider();

/**
 * Initialize Stripe client for Cloudflare Workers
 * Uses Fetch API instead of Node.js http module
 */
export function getStripeClient(env) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }

  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    apiVersion: '2024-12-18.acacia',
    appInfo: {
      name: 'R&G Consulting Toast Guardian',
      version: '1.0.0',
      url: 'https://ccrestaurantconsulting.com'
    },
  });
}

// ============================================
// SUPPORT PLAN PRICING (in cents)
// ============================================

export const STRIPE_PRICE_IDS = {
  // These should be set to actual Stripe Price IDs after creating in Dashboard
  // Format: price_xxxxxxxxxxxxx
  core: {
    monthly: null,    // $350/month - set after creating in Stripe
    quarterly: null,  // $1,050/quarter
    annual: null      // $3,850/year (11 months)
  },
  professional: {
    monthly: null,    // $500/month
    quarterly: null,  // $1,500/quarter
    annual: null      // $5,500/year
  },
  premium: {
    monthly: null,    // $800/month
    quarterly: null,  // $2,400/quarter
    annual: null      // $8,800/year
  }
};

export const SUPPORT_PLAN_PRICES_CENTS = {
  core: {
    monthly: 35000,
    quarterly: 105000,
    annual: 385000  // 11 months
  },
  professional: {
    monthly: 50000,
    quarterly: 150000,
    annual: 550000
  },
  premium: {
    monthly: 80000,
    quarterly: 240000,
    annual: 880000
  }
};

export const SUPPORT_PLAN_HOURS = {
  core: 5,
  professional: 10,
  premium: 20
};

// ============================================
// CUSTOMER OPERATIONS
// ============================================

/**
 * Get or create a Stripe customer from a client record
 */
export async function getOrCreateStripeCustomer(env, client) {
  const stripe = getStripeClient(env);

  // Search for existing customer by email
  const existing = await stripe.customers.list({
    email: client.email,
    limit: 1
  });

  if (existing.data.length > 0) {
    return existing.data[0];
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email: client.email,
    name: client.name || client.company,
    phone: client.phone || undefined,
    metadata: {
      client_id: String(client.id),
      company: client.company || '',
      source: 'ccrc-portal'
    }
  });

  return customer;
}

/**
 * Update Stripe customer metadata
 */
export async function updateStripeCustomer(env, customerId, updates) {
  const stripe = getStripeClient(env);
  return stripe.customers.update(customerId, updates);
}

// ============================================
// CHECKOUT SESSION OPERATIONS
// ============================================

/**
 * Create a Checkout Session for subscription signup
 */
export async function createCheckoutSession(env, {
  priceId,
  customerId,
  customerEmail,
  successUrl,
  cancelUrl,
  clientId,
  commitmentMonths = 3,
  tier,
  billingInterval = 'monthly'
}) {
  const stripe = getStripeClient(env);

  const sessionParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: {
        client_id: clientId || '',
        commitment_months: String(commitmentMonths),
        commitment_start: new Date().toISOString(),
        tier: tier || '',
        billing_interval: billingInterval
      }
    },
    metadata: {
      client_id: clientId || '',
      tier: tier || ''
    }
  };

  // Set customer or email
  if (customerId) {
    sessionParams.customer = customerId;
  } else if (customerEmail) {
    sessionParams.customer_email = customerEmail;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return session;
}

/**
 * Retrieve a Checkout Session
 */
export async function getCheckoutSession(env, sessionId) {
  const stripe = getStripeClient(env);
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription', 'customer']
  });
}

// ============================================
// CUSTOMER PORTAL OPERATIONS
// ============================================

/**
 * Create a Customer Portal session for self-service management
 */
export async function createPortalSession(env, {
  customerId,
  returnUrl
}) {
  const stripe = getStripeClient(env);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl
  });

  return session;
}

// ============================================
// SUBSCRIPTION OPERATIONS
// ============================================

/**
 * Create a subscription directly (admin use)
 */
export async function createStripeSubscription(env, {
  customerId,
  priceId,
  clientId,
  tier,
  commitmentMonths = 3,
  trialDays
}) {
  const stripe = getStripeClient(env);

  const subscriptionParams = {
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
    metadata: {
      client_id: clientId || '',
      tier: tier || '',
      commitment_months: String(commitmentMonths),
      commitment_start: new Date().toISOString()
    }
  };

  if (trialDays) {
    subscriptionParams.trial_period_days = trialDays;
  }

  return stripe.subscriptions.create(subscriptionParams);
}

/**
 * Update a subscription (change plan, etc.)
 */
export async function updateStripeSubscription(env, subscriptionId, updates) {
  const stripe = getStripeClient(env);
  return stripe.subscriptions.update(subscriptionId, updates);
}

/**
 * Cancel a subscription
 */
export async function cancelStripeSubscription(env, subscriptionId, {
  atPeriodEnd = true,
  cancellationReason
} = {}) {
  const stripe = getStripeClient(env);

  if (atPeriodEnd) {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
      metadata: {
        cancellation_reason: cancellationReason || ''
      }
    });
  } else {
    return stripe.subscriptions.cancel(subscriptionId);
  }
}

/**
 * List subscriptions for a customer
 */
export async function listCustomerSubscriptions(env, customerId) {
  const stripe = getStripeClient(env);

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100
  });

  return subscriptions.data;
}

/**
 * Get a specific subscription
 */
export async function getStripeSubscription(env, subscriptionId) {
  const stripe = getStripeClient(env);
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['customer', 'items.data.price.product']
  });
}

// ============================================
// INVOICE OPERATIONS
// ============================================

/**
 * Create an invoice for overage or one-time charges
 */
export async function createStripeInvoice(env, {
  customerId,
  lineItems,
  description,
  daysUntilDue = 30,
  autoAdvance = true
}) {
  const stripe = getStripeClient(env);

  // Add invoice items first
  for (const item of lineItems) {
    await stripe.invoiceItems.create({
      customer: customerId,
      amount: item.amount,
      currency: 'usd',
      description: item.description
    });
  }

  // Create and optionally finalize invoice
  const invoice = await stripe.invoices.create({
    customer: customerId,
    description: description,
    days_until_due: daysUntilDue,
    auto_advance: autoAdvance,
    collection_method: 'send_invoice'
  });

  return invoice;
}

/**
 * Add overage charges to upcoming invoice
 */
export async function addOverageToUpcomingInvoice(env, customerId, overageItems) {
  const stripe = getStripeClient(env);

  const createdItems = [];
  for (const item of overageItems) {
    const invoiceItem = await stripe.invoiceItems.create({
      customer: customerId,
      amount: item.amount,
      currency: 'usd',
      description: item.description
    });
    createdItems.push(invoiceItem);
  }

  return createdItems;
}

// ============================================
// QUOTES API (Custom/Bespoke Pricing)
// ============================================

/**
 * Create a quote for custom pricing
 */
export async function createStripeQuote(env, {
  customerId,
  customerEmail,
  lineItems,
  commitmentMonths = 3,
  expirationDays = 30,
  header,
  footer,
  metadata = {}
}) {
  const stripe = getStripeClient(env);

  // Create customer if needed
  let customer = customerId;
  if (!customer && customerEmail) {
    const newCustomer = await stripe.customers.create({ email: customerEmail });
    customer = newCustomer.id;
  }

  // Process line items - create ad-hoc prices for custom amounts
  const processedLineItems = [];
  for (const item of lineItems) {
    if (item.priceId) {
      processedLineItems.push({ price: item.priceId, quantity: item.quantity || 1 });
    } else if (item.amount) {
      // Create custom price
      const price = await stripe.prices.create({
        product_data: { name: item.description || 'Custom Service' },
        unit_amount: item.amount,
        currency: 'usd',
        recurring: item.recurring ? { interval: item.interval || 'month' } : undefined
      });
      processedLineItems.push({ price: price.id, quantity: item.quantity || 1 });
    }
  }

  const quote = await stripe.quotes.create({
    customer: customer,
    line_items: processedLineItems,
    expires_at: Math.floor(Date.now() / 1000) + (expirationDays * 24 * 60 * 60),
    header: header || 'Toast Guardian Support Quote',
    footer: footer || 'Valid for 30 days. Contact support@ccrestaurantconsulting.com with questions.',
    metadata: {
      ...metadata,
      commitment_months: String(commitmentMonths)
    }
  });

  return quote;
}

/**
 * Finalize a quote (makes it ready for acceptance)
 */
export async function finalizeStripeQuote(env, quoteId) {
  const stripe = getStripeClient(env);
  const quote = await stripe.quotes.finalizeQuote(quoteId);
  return { quote, pdfUrl: quote.pdf };
}

/**
 * Accept a quote (converts to subscription)
 */
export async function acceptStripeQuote(env, quoteId) {
  const stripe = getStripeClient(env);
  return stripe.quotes.accept(quoteId);
}

// ============================================
// WEBHOOK VERIFICATION
// ============================================

/**
 * Verify Stripe webhook signature (Workers-compatible)
 * Uses SubtleCrypto instead of Node.js crypto
 */
export async function verifyStripeWebhook(env, rawBody, signature) {
  const stripe = getStripeClient(env);

  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
  }

  try {
    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      cryptoProvider
    );
    return event;
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    throw new Error('Invalid webhook signature');
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert cents to dollars for display
 */
export function centsToDollars(cents) {
  return (cents / 100).toFixed(2);
}

/**
 * Convert dollars to cents for Stripe API
 */
export function dollarsToCents(dollars) {
  return Math.round(parseFloat(dollars) * 100);
}

/**
 * Format Stripe amount to display string
 */
export function formatStripeAmount(amount, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(amount / 100);
}

/**
 * Map Stripe subscription status to internal status
 */
export function mapSubscriptionStatus(stripeStatus) {
  const statusMap = {
    'incomplete': 'pending',
    'incomplete_expired': 'expired',
    'trialing': 'trialing',
    'active': 'active',
    'past_due': 'past_due',
    'canceled': 'cancelled',
    'unpaid': 'unpaid',
    'paused': 'paused'
  };
  return statusMap[stripeStatus] || stripeStatus;
}

/**
 * Calculate MRR from a subscription
 */
export function calculateMRR(subscription) {
  let mrr = 0;

  for (const item of subscription.items.data) {
    const price = item.price;
    let amount = (price.unit_amount || 0) * (item.quantity || 1);

    // Normalize to monthly
    if (price.recurring?.interval === 'year') {
      amount = amount / 12;
    } else if (price.recurring?.interval === 'quarter' ||
               (price.recurring?.interval === 'month' && price.recurring?.interval_count === 3)) {
      amount = amount / 3;
    }

    mrr += amount;
  }

  return Math.round(mrr) / 100; // Return in dollars
}

/**
 * Determine billing interval from Stripe price
 */
export function getBillingInterval(price) {
  if (!price.recurring) return 'one_time';

  const interval = price.recurring.interval;
  const intervalCount = price.recurring.interval_count || 1;

  if (interval === 'year') return 'annual';
  if (interval === 'month' && intervalCount === 3) return 'quarterly';
  if (interval === 'month' && intervalCount === 1) return 'monthly';

  return `${intervalCount}_${interval}`;
}
