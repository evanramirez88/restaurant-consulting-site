# Stripe Billing Integration

**Last Updated:** 2026-01-15
**Status:** LIVE - All products and prices active in production

---

## Overview

R&G Consulting uses **Stripe** for all recurring subscription billing and **Square** for one-time invoices and project work. This document details the Stripe integration architecture, configuration, and usage.

---

## Why Stripe Over Square for Subscriptions?

### The Problem with Square Subscriptions

Square was initially considered for subscription billing because it was already integrated for one-time invoicing. However, several limitations made it unsuitable:

1. **Manual Catalog Setup Required**: Square required creating subscription catalog items manually through the dashboard - no API-first approach
2. **Complex Integration**: Square's subscription API required multiple steps (create plan → create subscription → handle invoicing)
3. **Limited Cloudflare Workers Support**: Square's SDK wasn't designed for edge runtime environments
4. **No Hosted Checkout**: Would require building and maintaining our own payment forms (PCI compliance burden)
5. **Poor Webhook Handling**: Square webhooks lacked idempotency keys and had limited event types

### Why Stripe Won

1. **Native Workers Support**: The `stripe` npm package includes `SubtleCryptoProvider` for edge runtime webhook verification
2. **Stripe Checkout (Hosted)**: Pre-built, PCI-compliant payment pages - no custom forms needed
3. **Customer Portal**: Built-in self-service subscription management
4. **Quotes API**: Create custom pricing proposals with PDF generation
5. **Superior Webhook System**: Idempotent event processing, comprehensive event types
6. **Better Developer Experience**: API-first design, excellent documentation

### Strategic Split: Square + Stripe

| Use Case | Platform | Rationale |
|----------|----------|-----------|
| **Recurring Subscriptions** | Stripe | Best-in-class subscription management |
| **One-time Invoices** | Square | Already integrated, simple invoicing |
| **Project Work** | Square | Flexible ad-hoc billing |
| **Support Plans** | Stripe | Automated recurring billing with commitment tracking |
| **Custom Quotes** | Stripe | Quotes API with PDF generation |
| **Customer Self-Service** | Stripe | Built-in Customer Portal |

---

## Products and Pricing

### Toast Guardian Plans (Lane B - Remote)

| Tier | Monthly | Quarterly | Annual | Hours/Month |
|------|---------|-----------|--------|-------------|
| Core | $350 | $1,050 | $3,850 | 5 |
| Professional | $500 | $1,500 | $5,500 | 10 |
| Premium | $800 | $2,400 | $8,800 | 20 |

### Network Support Plans (Lane A - Local)

| Tier | Monthly | Quarterly | Annual | Response Time |
|------|---------|-----------|--------|---------------|
| Basic | $150 | $450 | $1,650 | 48 hours |
| Premium | $300 | $900 | $3,300 | 24 hours |
| Enterprise | $500 | $1,500 | $5,500 | Emergency |

### Stripe Price IDs

#### Toast Guardian
| Tier | Interval | Price ID |
|------|----------|----------|
| Core | Monthly | price_1SpzcVGbzgCk7YTGENWMj4yH |
| Core | Quarterly | price_1SpzcVGbzgCk7YTG98DuYWYE |
| Core | Annual | price_1SpzcWGbzgCk7YTGtCk8OBTA |
| Professional | Monthly | price_1SpzcWGbzgCk7YTGhO5KqmBs |
| Professional | Quarterly | price_1SpzcWGbzgCk7YTGDqWtnw50 |
| Professional | Annual | price_1SpzcXGbzgCk7YTGSa1hi2Gz |
| Premium | Monthly | price_1SpzcXGbzgCk7YTGr7dHHKmg |
| Premium | Quarterly | price_1SpzcXGbzgCk7YTGbhrvxiEr |
| Premium | Annual | price_1SpzcYGbzgCk7YTGMOlJwavn |

#### Network Support
| Tier | Interval | Price ID |
|------|----------|----------|
| Basic | Monthly | price_1SpzqAGbzgCk7YTGQ3gfBBVY |
| Basic | Quarterly | price_1SpzqAGbzgCk7YTGVXkyzhEC |
| Basic | Annual | price_1SpzqAGbzgCk7YTGwv7K8ffp |
| Premium | Monthly | price_1SpzqBGbzgCk7YTGxSG61vmU |
| Premium | Quarterly | price_1SpzqBGbzgCk7YTGWIqAikhw |
| Premium | Annual | price_1SpzqBGbzgCk7YTGH1E7Ht90 |
| Enterprise | Monthly | price_1SpzqCGbzgCk7YTGc5lm8FIY |
| Enterprise | Quarterly | price_1SpzqCGbzgCk7YTGfm8tL9Ux |
| Enterprise | Annual | price_1SpzqCGbzgCk7YTGOoooTlO6 |

---

## API Endpoints

### Checkout Session

**Create Checkout Session**
```
POST /api/stripe/checkout
Content-Type: application/json

{
  "tier": "core",                    // or "network_basic", etc.
  "billing_interval": "monthly",     // "monthly", "quarterly", "annual"
  "customer_email": "client@example.com",
  "client_id": 123,                  // optional - links to existing client
  "success_url": "https://...",
  "cancel_url": "https://...",
  "commitment_months": 3             // default: 3
}

Response:
{
  "success": true,
  "data": {
    "session_id": "cs_live_...",
    "url": "https://checkout.stripe.com/..."
  }
}
```

**Get Checkout Session**
```
GET /api/stripe/checkout?session_id=cs_live_xxx
```

### Subscriptions

**List Subscriptions**
```
GET /api/stripe/subscriptions?client_id=123
Authorization: Bearer <admin_jwt> or client auth
```

**Get Subscription**
```
GET /api/stripe/subscriptions?subscription_id=sub_xxx
```

**Create Subscription (Admin)**
```
POST /api/stripe/subscriptions
Authorization: Bearer <admin_jwt>

{
  "client_id": 123,
  "tier": "professional",
  "billing_interval": "monthly",
  "commitment_months": 3,
  "trial_days": 14  // optional
}
```

**Cancel Subscription**
```
DELETE /api/stripe/subscriptions?subscription_id=sub_xxx&immediate=false&reason=...
Authorization: Bearer <admin_jwt>
```

### Customer Portal

**Create Portal Session**
```
POST /api/stripe/portal
Authorization: Bearer <jwt>

{
  "client_id": 123,        // or customer_id
  "return_url": "https://..."
}

Response:
{
  "success": true,
  "data": {
    "url": "https://billing.stripe.com/...",
    "commitment": {
      "active": true,
      "end_date": "2026-04-15",
      "message": "..."
    }
  }
}
```

### Quotes

**Create Quote**
```
POST /api/stripe/quotes
Authorization: Bearer <admin_jwt>

{
  "client_id": 123,
  "items": [
    {
      "description": "Custom Implementation",
      "amount": 3500,
      "recurring": true,
      "interval": "month"
    }
  ],
  "commitment_months": 6,
  "expiration_days": 30,
  "hubspot_deal_id": "123456"
}
```

**Accept Quote**
```
POST /api/stripe/quotes/accept

{
  "quote_id": "qt_xxx"
}
```

### Webhook

```
POST /api/stripe/webhook
Stripe-Signature: <signature>

Events handled:
- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- invoice.paid
- invoice.payment_failed
- invoice.upcoming
- quote.accepted
```

### Health Check

```
GET /api/stripe/health

Response:
{
  "timestamp": "2026-01-15T...",
  "stripe_configured": true,
  "stripe_connected": true,
  "webhook_secret_configured": true,
  "database_tables": true,
  "products_configured": true,
  "stripe_account_id": "acct_xxx",
  "stripe_mode": "live",
  "active_products": 18,
  "healthy": true
}
```

---

## Database Schema

### Tables Created

| Table | Purpose |
|-------|---------|
| `stripe_customers` | Links clients to Stripe customer records |
| `stripe_subscriptions` | Subscription lifecycle tracking |
| `stripe_subscription_events` | Idempotent webhook event log |
| `stripe_commitment_tracking` | Minimum commitment enforcement |
| `stripe_subscription_overages` | Quarterly overage billing |
| `stripe_products` | Price ID reference (18 prices) |

### Key Columns Added to `clients`

- `stripe_customer_id` - Stripe customer reference
- `stripe_subscription_id` - Active subscription reference
- `stripe_subscription_status` - Current status
- `stripe_mrr` - Monthly recurring revenue in cents

---

## Frontend Integration

### LocalNetworking Page

The `/local-networking` page has "Subscribe Now" buttons that:

1. Call `POST /api/stripe/checkout` with the selected tier
2. Redirect to Stripe's hosted Checkout page
3. Return to success/cancel URL after completion

```tsx
const handleSubscribe = async (tier: string) => {
  const response = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tier: `network_${tier.toLowerCase()}`,
      billing_interval: 'monthly',
      success_url: `${window.location.origin}/#/local-networking?success=true`,
      cancel_url: `${window.location.origin}/#/local-networking`,
      commitment_months: 3
    })
  });
  const data = await response.json();
  if (data.success) {
    window.location.href = data.data.url;
  }
};
```

### SupportPlans Page

Similar integration for Toast Guardian plans at `/support-plans`.

---

## Environment Variables

| Variable | Purpose | Format |
|----------|---------|--------|
| `STRIPE_SECRET_KEY` | API authentication | `sk_live_...` |
| `STRIPE_PUBLISHABLE_KEY` | Client-side checkout | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | `whsec_...` |

**Configured in:** Cloudflare Pages → Settings → Environment Variables

---

## Webhook Configuration

### Stripe Dashboard Settings

- **Endpoint URL:** `https://ccrestaurantconsulting.com/api/stripe/webhook`
- **Events to send:**
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `invoice.upcoming`
  - `quote.accepted`

### Webhook Security

Signature verification uses Stripe's `SubtleCryptoProvider` for Workers compatibility:

```javascript
import Stripe from 'stripe';

const cryptoProvider = Stripe.createSubtleCryptoProvider();

await stripe.webhooks.constructEventAsync(
  rawBody,
  signature,
  webhookSecret,
  undefined,
  cryptoProvider
);
```

---

## Commitment Tracking

All subscriptions have a default 3-month minimum commitment:

1. **Commitment Period**: Tracked in `stripe_commitment_tracking` table
2. **Early Termination**: Calculated fee based on remaining months
3. **Portal Restrictions**: Customer Portal can show commitment warning
4. **Fulfillment**: Marked complete when commitment period ends

---

## HubSpot Integration

When subscriptions are created/updated, the webhook handler:

1. Updates HubSpot deal stage to `closedwon` on subscription activation
2. Stores `stripe_subscription_id` in deal properties
3. Syncs subscription status changes

---

## Testing

### Test Checkout Flow

```bash
# Create test checkout session
curl -s -X POST "https://ccrestaurantconsulting.com/api/stripe/checkout" \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "core",
    "billing_interval": "monthly",
    "customer_email": "test@example.com",
    "success_url": "https://ccrestaurantconsulting.com/success",
    "cancel_url": "https://ccrestaurantconsulting.com/pricing"
  }'
```

### Health Check

```bash
curl -s "https://ccrestaurantconsulting.com/api/stripe/health"
```

---

## Troubleshooting

### Common Issues

1. **"No such price"**: Run `/api/stripe/setup-products` to create products
2. **Webhook signature failure**: Verify `STRIPE_WEBHOOK_SECRET` matches dashboard
3. **Database constraint error**: Check tier is in allowed values

### Logs

- Cloudflare Dashboard → Workers & Pages → Functions → Logs
- Filter by `/api/stripe/` paths

---

## Files Reference

| File | Purpose |
|------|---------|
| `functions/api/_shared/stripe.js` | Stripe client and helpers |
| `functions/api/stripe/checkout.js` | Checkout session management |
| `functions/api/stripe/subscriptions.js` | Subscription CRUD |
| `functions/api/stripe/portal.js` | Customer Portal sessions |
| `functions/api/stripe/quotes.js` | Custom quote creation |
| `functions/api/stripe/webhook.js` | Event processing |
| `functions/api/stripe/health.js` | Health check endpoint |
| `functions/api/stripe/setup-products.js` | One-time product setup |
| `migrations/0026_stripe_billing.sql` | Core schema |
| `migrations/0027_networking_products.sql` | Extended tier support |

---

## Next Steps

1. **Integrate Toast Guardian page** with Stripe Checkout (same pattern as LocalNetworking)
2. **Set up Stripe Customer Portal** configuration in dashboard
3. **Configure commitment period portal restrictions** in Stripe
4. **Add overage billing** automation for exceeded hours
5. **Build admin dashboard** for subscription management
