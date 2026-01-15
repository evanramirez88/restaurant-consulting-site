# Stripe Billing Integration for Cloudflare Workers: Complete Implementation Guide

**This documentation provides everything needed to integrate Stripe Billing with a Cloudflare Workers website in a single day.** The guide covers account setup through production deployment, with complete code examples, SQL schemas, and CLI commands. The implementation handles recurring support plans with monthly, quarterly, and annual billing, 3-month minimum commitments, annual discounts (one month free), quarterly overage tracking, and custom/bespoke pricing via Stripe Quotes.

---

## 1. Stripe account setup and configuration

### Checking for an existing account

Visit **https://dashboard.stripe.com/login**. If you have an account, you'll see the login page; otherwise, you'll be redirected to registration. Stripe authenticates using email/password with optional 2FA.

### Creating a new account

1. Navigate to **https://dashboard.stripe.com/register**
2. Enter email address and create password
3. Verify email via confirmation link
4. Your account starts in **test mode** immediately

### Account activation for live payments

To accept live payments, complete account verification at **Settings → Account details**:

- **Business information**: Name, address, tax ID, business structure
- **Personal information**: Name, DOB, government ID of account representative  
- **Bank account**: For receiving payouts
- **Product description**: What you're selling

### Locating API keys

Navigate to **Developers → API Keys** (https://dashboard.stripe.com/test/apikeys for test mode):

| Key Type | Prefix | Usage |
|----------|--------|-------|
| Test Secret Key | `sk_test_` | Server-side test calls |
| Test Publishable Key | `pk_test_` | Client-side test calls |
| Live Secret Key | `sk_live_` | Server-side production |
| Live Publishable Key | `pk_live_` | Client-side production |

**Critical**: Secret keys are shown only once when created. Store immediately. Never expose secret keys in client-side code.

### Setting up webhook endpoints

Navigate to **Developers → Webhooks → Add endpoint**:

1. Enter endpoint URL: `https://yourdomain.com/api/stripe/webhook`
2. Select events (see webhook section below)
3. Click "Add endpoint"
4. Copy the webhook signing secret (`whsec_...`) — store securely

---

## 2. Products and prices configuration

### Creating products in the dashboard

Navigate to **More → Product catalog → +Add product**:

1. Enter **Name**: "Pro Support Plan", "Enterprise Support", etc.
2. Add **Description**: Appears in checkout, portal, and quotes
3. Set **Tax code** if using Stripe Tax
4. Add **Metadata** for internal tracking

### Recommended metadata structure

```json
{
  "tier": "pro",
  "internal_sku": "SUPPORT-PRO-2025",
  "included_hours": "10",
  "commitment_months": "3"
}
```

### Creating prices with different intervals

For each product, create prices for monthly, quarterly, and annual billing:

| Price Name | Amount | Interval | Implementation |
|------------|--------|----------|----------------|
| Monthly | $299/month | Monthly | Standard recurring |
| Quarterly | $849/quarter | Every 3 months | Standard recurring |
| Annual | $3,289/year | Yearly | 11 months × $299 |

### Implementing annual discount (one month free)

**Recommended approach**: Create a separate annual price at 11 months' value rather than using coupons:

- Monthly: $299/month = $3,588/year at full price
- Annual: $3,289/year (equivalent to 11 months — one month free)

This provides clearer pricing and simpler management than coupon-based discounts.

---

## 3. Payment Links setup

### Creating payment links

Navigate to **Payment Links → Create payment link**:

1. Select products/prices
2. Configure success URL: `https://yourdomain.com/success?session_id={CHECKOUT_SESSION_ID}`
3. Configure cancel URL: `https://yourdomain.com/pricing`
4. Enable "Allow promotion codes" if using coupons
5. Click "Create link"

### Pre-filling customer data via URL parameters

Append parameters to your Payment Link URL:

```
https://buy.stripe.com/your_link?prefilled_email=john@example.com&client_reference_id=client_456
```

| Parameter | Purpose |
|-----------|---------|
| `prefilled_email` | Pre-populate email field |
| `client_reference_id` | Link to your internal client ID |
| `prefilled_promo_code` | Apply a promotion code |

---

## 4. Cloudflare Workers integration

### Installation and initialization

```bash
npm install stripe
```

### Stripe client initialization for Workers

Create `src/stripe.ts`:

```typescript
import Stripe from 'stripe';

export interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  DB: D1Database;
}

// Create SubtleCrypto provider for webhook verification (Workers-compatible)
export const cryptoProvider = Stripe.createSubtleCryptoProvider();

/**
 * Initialize Stripe client for Cloudflare Workers
 * Uses Fetch API instead of Node.js http module
 */
export function getStripeClient(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    apiVersion: '2024-12-18.acacia',
    appInfo: {
      name: 'Support Billing System',
      version: '1.0.0',
    },
  });
}
```

### Complete wrangler.toml configuration

```toml
name = "stripe-billing-worker"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[vars]
APP_DOMAIN = "https://yourdomain.com"

[dev]
port = 8787
local_protocol = "http"

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "billing-db"
database_id = "your-d1-database-id"

# Production environment
[env.production]
name = "stripe-billing-worker-production"

[[env.production.routes]]
pattern = "api.yourdomain.com/*"
zone_name = "yourdomain.com"

[env.production.vars]
APP_DOMAIN = "https://yourdomain.com"
```

### Setting secrets via CLI

```bash
# Never put secrets in wrangler.toml!
wrangler secret put STRIPE_SECRET_KEY --env production
# Enter: sk_live_xxxxx

wrangler secret put STRIPE_WEBHOOK_SECRET --env production  
# Enter: whsec_xxxxx

# For local development, create .dev.vars file (add to .gitignore):
# STRIPE_SECRET_KEY=sk_test_xxxxx
# STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### Complete Worker with routing

Create `src/index.ts`:

```typescript
import Stripe from 'stripe';
import { Env, getStripeClient, cryptoProvider } from './stripe';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      switch (true) {
        case path === '/api/stripe/webhook' && request.method === 'POST':
          return handleWebhook(request, env, ctx);

        case path === '/api/stripe/create-checkout-session' && request.method === 'POST':
          return handleCreateCheckoutSession(request, env);

        case path === '/api/stripe/create-portal-session' && request.method === 'POST':
          return handleCreatePortalSession(request, env);

        case path === '/api/stripe/subscription-status' && request.method === 'GET':
          return handleGetSubscriptionStatus(request, env);

        case path === '/health':
          return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });

        default:
          return jsonResponse({ error: 'Not found' }, 404);
      }
    } catch (error) {
      console.error('Unhandled error:', error);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },
};

// Checkout Session Handler
async function handleCreateCheckoutSession(request: Request, env: Env): Promise<Response> {
  const stripe = getStripeClient(env);
  const body = await request.json() as {
    priceId: string;
    customerId?: string;
    customerEmail?: string;
    successUrl: string;
    cancelUrl: string;
    clientId?: string;
    commitmentMonths?: number;
  };

  if (!body.priceId || !body.successUrl || !body.cancelUrl) {
    return jsonResponse({ error: 'priceId, successUrl, and cancelUrl are required' }, 400);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: body.priceId, quantity: 1 }],
    success_url: body.successUrl,
    cancel_url: body.cancelUrl,
    customer: body.customerId,
    customer_email: body.customerId ? undefined : body.customerEmail,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: {
        client_id: body.clientId || '',
        commitment_months: String(body.commitmentMonths || 3),
        commitment_start: new Date().toISOString(),
      },
    },
  });

  return jsonResponse({ sessionId: session.id, url: session.url });
}

// Customer Portal Session Handler
async function handleCreatePortalSession(request: Request, env: Env): Promise<Response> {
  const stripe = getStripeClient(env);
  const body = await request.json() as { customerId: string; returnUrl: string };

  if (!body.customerId || !body.returnUrl) {
    return jsonResponse({ error: 'customerId and returnUrl are required' }, 400);
  }

  // Check commitment status before allowing portal access
  const commitment = await env.DB.prepare(`
    SELECT commitment_end_date, commitment_fulfilled 
    FROM commitment_tracking 
    WHERE stripe_customer_id = ? AND commitment_fulfilled = 0
  `).bind(body.customerId).first();

  // Create portal session (cancellation restrictions handled via portal configuration)
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: body.customerId,
    return_url: body.returnUrl,
  });

  return jsonResponse({ url: portalSession.url });
}

// Subscription Status Handler
async function handleGetSubscriptionStatus(request: Request, env: Env): Promise<Response> {
  const stripe = getStripeClient(env);
  const url = new URL(request.url);
  const customerId = url.searchParams.get('customerId');

  if (!customerId) {
    return jsonResponse({ error: 'customerId query parameter is required' }, 400);
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  });

  return jsonResponse({
    customerId,
    subscriptions: subscriptions.data.map(sub => ({
      id: sub.id,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      priceId: sub.items.data[0]?.price.id,
    })),
  });
}
```

---

## 5. Webhook implementation

### Essential webhook events

Configure these events in your Stripe Dashboard webhook endpoint:

| Event | When to Handle |
|-------|----------------|
| `checkout.session.completed` | Initial subscription creation |
| `customer.subscription.created` | Provision access |
| `customer.subscription.updated` | Plan changes, renewals |
| `customer.subscription.deleted` | Revoke access |
| `customer.subscription.trial_will_end` | 3 days before trial ends |
| `invoice.paid` | Payment confirmed |
| `invoice.payment_failed` | Payment failed — notify customer |
| `invoice.upcoming` | Add overage charges |
| `customer.created` | Link to internal client |
| `quote.accepted` | Convert quote to subscription |

### Complete webhook handler with signature verification

Add to `src/index.ts`:

```typescript
async function handleWebhook(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const stripe = getStripeClient(env);
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return jsonResponse({ error: 'Missing stripe-signature header' }, 400);
  }

  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    // Use constructEventAsync with SubtleCrypto for Workers
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return jsonResponse({ error: 'Invalid signature' }, 400);
  }

  // Process in background, return 200 immediately
  ctx.waitUntil(processWebhookEvent(event, env));

  return jsonResponse({ received: true, type: event.type });
}

async function processWebhookEvent(event: Stripe.Event, env: Env): Promise<void> {
  const db = env.DB;

  // Idempotency check
  const existing = await db.prepare(
    'SELECT id FROM subscription_events WHERE stripe_event_id = ?'
  ).bind(event.id).first();

  if (existing) {
    console.log(`Event ${event.id} already processed, skipping`);
    return;
  }

  // Record event for idempotency
  await db.prepare(`
    INSERT INTO subscription_events (stripe_event_id, event_type, payload, processing_status)
    VALUES (?, ?, ?, 'processing')
  `).bind(event.id, event.type, JSON.stringify(event)).run();

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, env);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription, env);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, env);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, env);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice, env);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice, env);
        break;

      case 'invoice.upcoming':
        await handleInvoiceUpcoming(event.data.object as Stripe.Invoice, env);
        break;

      case 'quote.accepted':
        await handleQuoteAccepted(event.data.object as Stripe.Quote, env);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark as completed
    await db.prepare(
      `UPDATE subscription_events SET processing_status = 'completed', processed_at = datetime('now') WHERE stripe_event_id = ?`
    ).bind(event.id).run();

  } catch (error) {
    console.error(`Error processing ${event.type}:`, error);
    await db.prepare(
      `UPDATE subscription_events SET processing_status = 'failed', processing_error = ? WHERE stripe_event_id = ?`
    ).bind(String(error), event.id).run();
    throw error;
  }
}

// Event handlers
async function handleCheckoutCompleted(session: Stripe.Checkout.Session, env: Env): Promise<void> {
  console.log(`Checkout completed: ${session.id}, subscription: ${session.subscription}`);
  // Subscription.created webhook handles the rest
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription, env: Env): Promise<void> {
  const customerId = typeof subscription.customer === 'string' 
    ? subscription.customer 
    : subscription.customer.id;

  const commitmentMonths = parseInt(subscription.metadata.commitment_months || '3');
  const commitmentStart = new Date();
  const commitmentEnd = new Date();
  commitmentEnd.setMonth(commitmentEnd.getMonth() + commitmentMonths);

  // Get billing interval from price
  const priceInterval = subscription.items.data[0]?.price.recurring?.interval || 'month';
  let billingInterval = 'monthly';
  if (priceInterval === 'year') billingInterval = 'annual';
  else if (priceInterval === 'month' && subscription.items.data[0]?.price.recurring?.interval_count === 3) {
    billingInterval = 'quarterly';
  }

  // Insert subscription record
  await env.DB.prepare(`
    INSERT INTO subscriptions (
      subscription_id, client_id, stripe_customer_id, status,
      current_period_start, current_period_end, price_id, billing_interval,
      commitment_start_date, commitment_end_date, commitment_months
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    subscription.id,
    subscription.metadata.client_id || null,
    customerId,
    subscription.status,
    new Date(subscription.current_period_start * 1000).toISOString(),
    new Date(subscription.current_period_end * 1000).toISOString(),
    subscription.items.data[0]?.price.id,
    billingInterval,
    commitmentStart.toISOString(),
    commitmentEnd.toISOString(),
    commitmentMonths
  ).run();

  // Create commitment tracking record
  await env.DB.prepare(`
    INSERT INTO commitment_tracking (
      subscription_id, client_id, stripe_customer_id,
      commitment_start_date, commitment_end_date, commitment_months,
      monthly_commitment_amount
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    subscription.id,
    subscription.metadata.client_id || null,
    customerId,
    commitmentStart.toISOString(),
    commitmentEnd.toISOString(),
    commitmentMonths,
    subscription.items.data[0]?.price.unit_amount || 0
  ).run();

  // Sync to HubSpot if configured
  await syncSubscriptionToHubSpot(subscription, 'created', env);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, env: Env): Promise<void> {
  await env.DB.prepare(`
    UPDATE subscriptions SET
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

  await syncSubscriptionToHubSpot(subscription, 'updated', env);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, env: Env): Promise<void> {
  await env.DB.prepare(`
    UPDATE subscriptions SET
      status = 'canceled',
      canceled_at = datetime('now'),
      ended_at = datetime('now'),
      updated_at = datetime('now')
    WHERE subscription_id = ?
  `).bind(subscription.id).run();

  // Mark commitment as fulfilled if within commitment period
  await env.DB.prepare(`
    UPDATE commitment_tracking SET
      commitment_fulfilled = CASE 
        WHEN datetime('now') >= datetime(commitment_end_date) THEN 1 
        ELSE 0 
      END,
      updated_at = datetime('now')
    WHERE subscription_id = ?
  `).bind(subscription.id).run();

  await syncSubscriptionToHubSpot(subscription, 'canceled', env);
}

async function handleInvoicePaid(invoice: Stripe.Invoice, env: Env): Promise<void> {
  if (!invoice.subscription) return;

  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription.id;

  await env.DB.prepare(`
    UPDATE subscriptions SET
      status = 'active',
      updated_at = datetime('now')
    WHERE subscription_id = ?
  `).bind(subscriptionId).run();

  console.log(`Invoice ${invoice.id} paid for subscription ${subscriptionId}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice, env: Env): Promise<void> {
  if (!invoice.subscription) return;

  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription.id;

  await env.DB.prepare(`
    UPDATE subscriptions SET
      status = 'past_due',
      updated_at = datetime('now')
    WHERE subscription_id = ?
  `).bind(subscriptionId).run();

  // TODO: Send notification email to customer
  console.log(`Payment failed for subscription ${subscriptionId}`);
}

async function handleInvoiceUpcoming(invoice: Stripe.Invoice, env: Env): Promise<void> {
  // Add overage charges if applicable
  if (!invoice.subscription) return;

  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription.id;

  // Check for unbilled overages
  const overages = await env.DB.prepare(`
    SELECT * FROM subscription_overages
    WHERE subscription_id = ? AND billed = 0 AND overage_units > 0
  `).bind(subscriptionId).all();

  if (overages.results.length > 0) {
    const stripe = getStripeClient(env);
    
    for (const overage of overages.results as any[]) {
      // Add overage as invoice item
      await stripe.invoiceItems.create({
        customer: invoice.customer as string,
        amount: overage.overage_amount,
        currency: 'usd',
        description: `Overage: ${overage.overage_units} ${overage.usage_type} units`,
      });

      // Mark as billed
      await env.DB.prepare(`
        UPDATE subscription_overages SET billed = 1, billed_at = datetime('now')
        WHERE id = ?
      `).bind(overage.id).run();
    }
  }
}

async function handleQuoteAccepted(quote: Stripe.Quote, env: Env): Promise<void> {
  console.log(`Quote ${quote.id} accepted, subscription: ${quote.subscription}`);
  // The subscription.created webhook will handle the subscription
  
  // Update HubSpot deal if linked
  if (quote.metadata?.hubspot_deal_id) {
    await updateHubSpotDeal(quote.metadata.hubspot_deal_id, {
      dealstage: 'closedwon',
      stripe_quote_id: quote.id,
      stripe_subscription_id: quote.subscription as string,
    }, env);
  }
}
```

---

## 6. D1 database schema

### Migration files

Create migrations in `migrations/` directory:

**0001_stripe_customers.sql**
```sql
CREATE TABLE IF NOT EXISTS stripe_customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL UNIQUE,
    stripe_customer_id TEXT NOT NULL UNIQUE,
    email TEXT,
    name TEXT,
    metadata TEXT,
    default_payment_method_id TEXT,
    currency TEXT DEFAULT 'usd',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE
);

CREATE INDEX idx_stripe_customers_client_id ON stripe_customers(client_id);
CREATE INDEX idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);
```

**0002_subscriptions.sql**
```sql
CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id TEXT NOT NULL UNIQUE,
    client_id INTEGER,
    stripe_customer_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'incomplete'
        CHECK (status IN ('incomplete', 'incomplete_expired', 'trialing', 
                         'active', 'past_due', 'canceled', 'unpaid', 'paused')),
    current_period_start TEXT,
    current_period_end TEXT,
    plan_id TEXT,
    price_id TEXT,
    quantity INTEGER DEFAULT 1,
    billing_interval TEXT NOT NULL DEFAULT 'monthly'
        CHECK (billing_interval IN ('monthly', 'quarterly', 'annual')),
    commitment_start_date TEXT,
    commitment_end_date TEXT,
    commitment_months INTEGER,
    cancel_at_period_end INTEGER DEFAULT 0,
    canceled_at TEXT,
    cancellation_reason TEXT,
    ended_at TEXT,
    trial_start TEXT,
    trial_end TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE
);

CREATE INDEX idx_subscriptions_client_id ON subscriptions(client_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_commitment_end ON subscriptions(commitment_end_date);
```

**0003_subscription_events.sql**
```sql
CREATE TABLE IF NOT EXISTS subscription_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stripe_event_id TEXT NOT NULL UNIQUE,
    subscription_id TEXT,
    client_id INTEGER,
    event_type TEXT NOT NULL,
    api_version TEXT,
    payload TEXT NOT NULL,
    processed_at TEXT,
    processing_status TEXT DEFAULT 'pending'
        CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    processing_error TEXT,
    retry_count INTEGER DEFAULT 0,
    received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_events_stripe_event_id ON subscription_events(stripe_event_id);
CREATE INDEX idx_events_type ON subscription_events(event_type);
CREATE INDEX idx_events_status ON subscription_events(processing_status);
```

**0004_commitment_tracking.sql**
```sql
CREATE TABLE IF NOT EXISTS commitment_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id TEXT NOT NULL UNIQUE,
    client_id INTEGER,
    stripe_customer_id TEXT,
    commitment_start_date TEXT NOT NULL,
    commitment_end_date TEXT NOT NULL,
    commitment_months INTEGER NOT NULL,
    monthly_commitment_amount INTEGER,
    commitment_fulfilled INTEGER DEFAULT 0,
    commitment_fulfilled_at TEXT,
    early_termination_requested INTEGER DEFAULT 0,
    early_termination_requested_at TEXT,
    early_termination_fee_calculated INTEGER,
    early_termination_fee_charged INTEGER DEFAULT 0,
    early_termination_fee_charged_at TEXT,
    early_termination_invoice_id TEXT,
    cancellation_blocked INTEGER DEFAULT 0,
    cancellation_blocked_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(subscription_id) ON DELETE CASCADE
);

CREATE INDEX idx_commitment_subscription_id ON commitment_tracking(subscription_id);
CREATE INDEX idx_commitment_end_date ON commitment_tracking(commitment_end_date);
```

**0005_subscription_overages.sql**
```sql
CREATE TABLE IF NOT EXISTS subscription_overages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id TEXT NOT NULL,
    client_id INTEGER,
    usage_period_start TEXT NOT NULL,
    usage_period_end TEXT NOT NULL,
    period_type TEXT DEFAULT 'quarterly'
        CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
    included_units INTEGER NOT NULL DEFAULT 0,
    used_units INTEGER NOT NULL DEFAULT 0,
    overage_units INTEGER GENERATED ALWAYS AS (
        CASE WHEN used_units > included_units 
             THEN used_units - included_units 
             ELSE 0 END
    ) STORED,
    overage_rate INTEGER NOT NULL DEFAULT 0,
    overage_amount INTEGER GENERATED ALWAYS AS (
        CASE WHEN used_units > included_units 
             THEN (used_units - included_units) * overage_rate 
             ELSE 0 END
    ) STORED,
    billed INTEGER DEFAULT 0,
    billed_at TEXT,
    stripe_invoice_id TEXT,
    stripe_invoice_item_id TEXT,
    usage_type TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(subscription_id) ON DELETE CASCADE,
    UNIQUE(subscription_id, usage_period_start, usage_period_end, usage_type)
);

CREATE INDEX idx_overages_subscription_id ON subscription_overages(subscription_id);
CREATE INDEX idx_overages_billed ON subscription_overages(billed);
```

### Running migrations

```bash
# Create database
wrangler d1 create billing-db

# Run migrations
wrangler d1 migrations apply billing-db --local  # Local testing
wrangler d1 migrations apply billing-db          # Production
```

---

## 7. Customer Portal configuration

### Dashboard configuration

Navigate to **Settings → Billing → Customer portal**:

1. **Activate the portal** by clicking "Activate link"
2. Configure subscription management options:
   - **Switch plan**: Enable if offering multiple tiers
   - **Update quantities**: Enable for seat-based pricing
   - **Cancel subscription**: **Disable for minimum commitment enforcement**
3. Configure billing information customers can update:
   - Name, Email, Billing address, Phone: Enable
   - Payment methods: Enable
4. Add business information:
   - Terms of service URL
   - Privacy policy URL
   - Support email/phone

### Restricting cancellation for minimum commitments

**Option 1: Disable cancellation in portal** (recommended for strict enforcement)

Turn off "Cancel subscription" in portal settings. Customers must contact support to cancel, allowing you to enforce minimum commitment terms.

**Option 2: Handle cancellation programmatically**

If you need to allow some cancellations, intercept via webhooks and check commitment status:

```typescript
// Add to webhook handler for subscription.updated with cancel_at_period_end = true
async function handleCancellationAttempt(subscription: Stripe.Subscription, env: Env): Promise<void> {
  if (!subscription.cancel_at_period_end) return;

  const commitment = await env.DB.prepare(`
    SELECT commitment_end_date, commitment_fulfilled
    FROM commitment_tracking
    WHERE subscription_id = ? AND commitment_fulfilled = 0
  `).bind(subscription.id).first();

  if (commitment && new Date() < new Date(commitment.commitment_end_date as string)) {
    // Within commitment period — calculate early termination fee
    const stripe = getStripeClient(env);
    const monthsRemaining = Math.ceil(
      (new Date(commitment.commitment_end_date as string).getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)
    );
    
    const etfAmount = monthsRemaining * (commitment.monthly_commitment_amount as number);

    // Create invoice for early termination fee
    await stripe.invoiceItems.create({
      customer: subscription.customer as string,
      amount: etfAmount,
      currency: 'usd',
      description: `Early termination fee - ${monthsRemaining} months remaining`,
    });

    const invoice = await stripe.invoices.create({
      customer: subscription.customer as string,
      auto_advance: true,
    });

    await stripe.invoices.finalizeInvoice(invoice.id);

    // Update tracking
    await env.DB.prepare(`
      UPDATE commitment_tracking SET
        early_termination_requested = 1,
        early_termination_requested_at = datetime('now'),
        early_termination_fee_calculated = ?,
        early_termination_invoice_id = ?
      WHERE subscription_id = ?
    `).bind(etfAmount, invoice.id, subscription.id).run();
  }
}
```

---

## 8. Stripe Quotes API for custom pricing

### Creating quotes programmatically

```typescript
async function createCustomQuote(
  customerId: string,
  lineItems: Array<{ priceId?: string; amount?: number; description?: string; recurring?: boolean }>,
  metadata: Record<string, string>,
  env: Env
): Promise<Stripe.Quote> {
  const stripe = getStripeClient(env);

  // For custom pricing, create ad-hoc prices
  const processedLineItems: Stripe.QuoteCreateParams.LineItem[] = [];

  for (const item of lineItems) {
    if (item.priceId) {
      processedLineItems.push({ price: item.priceId, quantity: 1 });
    } else if (item.amount) {
      // Create custom price for bespoke pricing
      const price = await stripe.prices.create({
        product_data: { name: item.description || 'Custom Service' },
        unit_amount: item.amount,
        currency: 'usd',
        recurring: item.recurring ? { interval: 'month' } : undefined,
      });
      processedLineItems.push({ price: price.id, quantity: 1 });
    }
  }

  const quote = await stripe.quotes.create({
    customer: customerId,
    line_items: processedLineItems,
    expires_at: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
    header: 'Custom Support Plan Quote',
    footer: 'Valid for 30 days. Contact sales@yourcompany.com with questions.',
    metadata: {
      ...metadata,
      commitment_months: '12',
    },
  });

  return quote;
}

// Finalize and send quote
async function finalizeQuote(quoteId: string, env: Env): Promise<{ quote: Stripe.Quote; pdfUrl: string }> {
  const stripe = getStripeClient(env);
  const quote = await stripe.quotes.finalizeQuote(quoteId);
  return { quote, pdfUrl: quote.pdf! };
}

// Accept quote (converts to subscription)
async function acceptQuote(quoteId: string, env: Env): Promise<Stripe.Quote> {
  const stripe = getStripeClient(env);
  return stripe.quotes.accept(quoteId);
}
```

### Quote Builder API endpoint

Add to your Worker:

```typescript
case path === '/api/stripe/create-quote' && request.method === 'POST':
  return handleCreateQuote(request, env);

// Handler
async function handleCreateQuote(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as {
    customerId: string;
    customerEmail?: string;
    items: Array<{ priceId?: string; amount?: number; description?: string; recurring?: boolean }>;
    commitmentMonths?: number;
    hubspotDealId?: string;
    hubspotContactId?: string;
  };

  const stripe = getStripeClient(env);

  // Create or find customer
  let customerId = body.customerId;
  if (!customerId && body.customerEmail) {
    const customer = await stripe.customers.create({
      email: body.customerEmail,
      metadata: {
        hubspot_contact_id: body.hubspotContactId || '',
      },
    });
    customerId = customer.id;
  }

  const quote = await createCustomQuote(
    customerId,
    body.items,
    {
      commitment_months: String(body.commitmentMonths || 3),
      hubspot_deal_id: body.hubspotDealId || '',
      hubspot_contact_id: body.hubspotContactId || '',
    },
    env
  );

  // Finalize immediately if ready
  const finalized = await finalizeQuote(quote.id, env);

  return jsonResponse({
    quoteId: finalized.quote.id,
    quoteNumber: finalized.quote.number,
    pdfUrl: finalized.pdfUrl,
    amountTotal: finalized.quote.amount_total,
    expiresAt: finalized.quote.expires_at,
  });
}
```

---

## 9. HubSpot integration

### HubSpot sync helper functions

```typescript
interface HubSpotEnv extends Env {
  HUBSPOT_ACCESS_TOKEN: string;
}

async function syncSubscriptionToHubSpot(
  subscription: Stripe.Subscription,
  action: 'created' | 'updated' | 'canceled',
  env: HubSpotEnv
): Promise<void> {
  if (!env.HUBSPOT_ACCESS_TOKEN) return;

  const stripe = getStripeClient(env);
  const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
  
  if (!customer.email) return;

  const mrr = calculateMRR(subscription);

  // Update contact properties
  await updateHubSpotContact(customer.email, {
    stripe_customer_id: customer.id,
    subscription_status: subscription.status,
    subscription_plan: subscription.items.data[0]?.price.nickname || 'Standard',
    subscription_start_date: new Date(subscription.start_date * 1000).toISOString().split('T')[0],
    subscription_renewal_date: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
    mrr: String(mrr),
  }, env);

  // Create deal for new subscriptions
  if (action === 'created') {
    await createHubSpotDeal({
      name: `Subscription - ${customer.email}`,
      amount: mrr * 12,
      stage: 'closedwon',
      subscriptionId: subscription.id,
    }, env);
  }
}

async function updateHubSpotContact(
  email: string,
  properties: Record<string, string>,
  env: HubSpotEnv
): Promise<void> {
  const url = `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`;
  
  await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.HUBSPOT_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ properties }),
  });
}

async function createHubSpotDeal(
  data: { name: string; amount: number; stage: string; subscriptionId: string },
  env: HubSpotEnv
): Promise<void> {
  await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.HUBSPOT_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      properties: {
        dealname: data.name,
        amount: String(data.amount),
        dealstage: data.stage,
        pipeline: 'default',
        stripe_subscription_id: data.subscriptionId,
        closedate: new Date().toISOString(),
      },
    }),
  });
}

async function updateHubSpotDeal(
  dealId: string,
  properties: Record<string, string>,
  env: HubSpotEnv
): Promise<void> {
  await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.HUBSPOT_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ properties }),
  });
}

function calculateMRR(subscription: Stripe.Subscription): number {
  let mrr = 0;
  for (const item of subscription.items.data) {
    const price = item.price;
    let amount = (price.unit_amount || 0) * (item.quantity || 1);
    
    if (price.recurring?.interval === 'year') amount = amount / 12;
    else if (price.recurring?.interval === 'quarter') amount = amount / 3;
    
    mrr += amount / 100;
  }
  return Math.round(mrr * 100) / 100;
}
```

### Recommended HubSpot custom properties

Create these in HubSpot for Stripe sync:

| Property Name | Internal Name | Type |
|---------------|---------------|------|
| Stripe Customer ID | `stripe_customer_id` | Single-line text |
| Subscription Status | `subscription_status` | Dropdown (active, canceled, past_due, trialing) |
| Subscription Plan | `subscription_plan` | Single-line text |
| Subscription Start | `subscription_start_date` | Date |
| Renewal Date | `subscription_renewal_date` | Date |
| MRR | `mrr` | Number |

---

## 10. Testing strategy

### Test card numbers

| Scenario | Card Number | Use Case |
|----------|-------------|----------|
| **Success** | `4242424242424242` | Standard successful payment |
| **Decline** | `4000000000000002` | Test decline handling |
| **Insufficient funds** | `4000000000009995` | Test specific decline reason |
| **3D Secure required** | `4000002500003155` | Test authentication flow |
| **Decline after attach** | `4000000000000341` | Test renewal failures |

Use any future expiry date (e.g., 12/34), any 3-digit CVC, and any postal code.

### Stripe CLI for local webhook testing

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# Or download from https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local development
stripe listen --forward-to localhost:8787/api/stripe/webhook
# Copy the whsec_... secret to your .dev.vars file

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

### Test scenarios checklist

- [ ] Create subscription via checkout
- [ ] Verify webhook received for subscription.created
- [ ] Test payment failure with declined card
- [ ] Test Customer Portal access
- [ ] Test subscription cancellation flow
- [ ] Test minimum commitment enforcement
- [ ] Test quote creation and acceptance
- [ ] Verify HubSpot sync (if configured)
- [ ] Test overage billing with invoice.upcoming

---

## 11. Go-live checklist

### Pre-deployment verification

- [ ] Stripe account activated with business information complete
- [ ] Bank account connected for payouts
- [ ] Live API keys generated and securely stored
- [ ] Live webhook endpoint created with correct URL
- [ ] Live webhook signing secret updated in environment
- [ ] Products/prices recreated in live mode
- [ ] Customer Portal configured in live mode
- [ ] 2FA enabled on Stripe account

### Environment variable updates

```bash
# Update secrets for production
wrangler secret put STRIPE_SECRET_KEY --env production
# Enter: sk_live_xxxxx

wrangler secret put STRIPE_WEBHOOK_SECRET --env production
# Enter: whsec_xxxxx (from live webhook endpoint)

# If using HubSpot
wrangler secret put HUBSPOT_ACCESS_TOKEN --env production
```

### Deploy to production

```bash
# Deploy Worker
wrangler deploy --env production

# Verify deployment
curl https://api.yourdomain.com/health

# Test webhook connectivity (Stripe Dashboard → Webhooks → Send test webhook)
```

### Post-deployment verification

1. Make a small real test transaction ($0.50)
2. Verify webhook received and processed
3. Check database for subscription record
4. Verify HubSpot sync if configured
5. **Refund the test transaction**

```bash
# Via CLI with live key
stripe payment_intents create --amount=50 --currency=usd \
  --payment-method=pm_card_visa --confirm --api-key sk_live_...

# Then refund
stripe refunds create --payment-intent=pi_xxx --api-key sk_live_...
```

---

## Conclusion

This implementation provides a complete Stripe Billing integration for Cloudflare Workers with **subscription management**, **minimum commitment enforcement**, **quarterly overage tracking**, **custom quote pricing**, and **HubSpot CRM synchronization**. The key architectural decisions include using `constructEventAsync` with `SubtleCryptoProvider` for Workers-compatible webhook verification, storing commitment data both in Stripe metadata and local D1 for flexible enforcement, and implementing idempotent webhook processing to handle Stripe's at-least-once delivery guarantee.

For minimum commitments, the recommended approach disables cancellation in the Customer Portal and handles early termination fees programmatically through webhooks. The D1 schema includes computed columns for automatic overage calculations, and the `invoice.upcoming` webhook handler automatically adds overage charges to the next invoice. This architecture scales well within Cloudflare Workers' execution limits while maintaining full audit trails and HubSpot synchronization for sales team visibility.