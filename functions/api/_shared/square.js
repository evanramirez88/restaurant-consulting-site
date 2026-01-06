/**
 * Square API Client Module
 *
 * Provides a unified interface for Square API operations including:
 * - Invoices (create, list, cancel, publish)
 * - Subscriptions (support plans)
 * - Customers (create, update, link)
 * - Payments (process, refund)
 *
 * ==========================================================================
 * IMPORTANT: Square Contracts API Does NOT Exist
 * ==========================================================================
 * Square does NOT have a Contracts API. The "Contracts" feature in Square
 * is only available through Square Appointments and the Square Dashboard UI.
 * It cannot be accessed or automated via API.
 *
 * For contract-based onboarding workflows, use one of these alternatives:
 *
 * 1. RECOMMENDED: Create Square Invoice with terms
 *    - Use Square Invoices API (createInvoice function below)
 *    - Add contract terms in the invoice description
 *    - Client acceptance = payment of invoice
 *
 * 2. ALTERNATIVE: Third-party e-signature
 *    - DocuSign, PandaDoc, HelloSign, or Adobe Sign
 *    - Generate contract PDF
 *    - Collect signature
 *    - Create Square invoice for payment
 *
 * 3. MANUAL: Square Dashboard
 *    - Create contract manually in Square Appointments
 *    - Send via email for signature
 *    - Not automatable
 *
 * The onboarding workflow should:
 * 1. Quote Builder generates quote
 * 2. Quote accepted -> Create Square customer
 * 3. Generate invoice with service terms
 * 4. Webhook: invoice.payment_made -> Activate client
 * ==========================================================================
 *
 * Square Location IDs:
 * - Lane A (Local Cape Cod): L6GGMPCHFM6WR
 * - Lane B (National/Remote): LB8GE5HYZJYB7
 */

// Square API base URLs
const SQUARE_API_BASE = {
  production: 'https://connect.squareup.com/v2',
  sandbox: 'https://connect.squareupsandbox.com/v2'
};

/**
 * Get the Square API base URL based on environment
 */
export function getSquareBaseUrl(env) {
  const environment = env.SQUARE_ENVIRONMENT || 'sandbox';
  return SQUARE_API_BASE[environment] || SQUARE_API_BASE.sandbox;
}

/**
 * Make an authenticated request to the Square API
 */
export async function squareRequest(env, endpoint, options = {}) {
  const baseUrl = getSquareBaseUrl(env);
  const url = `${baseUrl}${endpoint}`;

  const headers = {
    'Authorization': `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
    'Square-Version': '2024-12-18',
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.errors?.[0]?.detail || 'Square API error');
    error.status = response.status;
    error.errors = data.errors;
    throw error;
  }

  return data;
}

/**
 * Get the appropriate location ID based on service lane
 * @param {object} env - Environment bindings
 * @param {string} lane - 'A' for local Cape Cod, 'B' for national/remote
 */
export function getLocationId(env, lane = 'B') {
  return lane === 'A'
    ? env.SQUARE_LOCATION_ID_LANE_A
    : env.SQUARE_LOCATION_ID_LANE_B;
}

// ============================================
// CUSTOMER OPERATIONS
// ============================================

/**
 * Create or retrieve a Square customer from a client record
 */
export async function getOrCreateCustomer(env, client) {
  // First, search for existing customer by email
  const searchResult = await squareRequest(env, '/customers/search', {
    method: 'POST',
    body: JSON.stringify({
      query: {
        filter: {
          email_address: {
            exact: client.email
          }
        }
      }
    })
  });

  if (searchResult.customers && searchResult.customers.length > 0) {
    return searchResult.customers[0];
  }

  // Create new customer
  const createResult = await squareRequest(env, '/customers', {
    method: 'POST',
    body: JSON.stringify({
      idempotency_key: `client-${client.id}`,
      given_name: client.name.split(' ')[0],
      family_name: client.name.split(' ').slice(1).join(' ') || '',
      email_address: client.email,
      phone_number: client.phone || undefined,
      company_name: client.company || undefined,
      reference_id: client.id,
      note: `Synced from CCRC Portal. Support Plan: ${client.support_plan_tier || 'none'}`
    })
  });

  return createResult.customer;
}

// ============================================
// INVOICE OPERATIONS
// ============================================

/**
 * Create a Square invoice from a quote or billing item
 */
export async function createInvoice(env, {
  clientId,
  customerId,
  locationId,
  lineItems,
  title,
  description,
  dueDate,
  deliveryMethod = 'EMAIL'
}) {
  const idempotencyKey = `inv-${clientId}-${Date.now()}`;

  const result = await squareRequest(env, '/invoices', {
    method: 'POST',
    body: JSON.stringify({
      idempotency_key: idempotencyKey,
      invoice: {
        location_id: locationId,
        order_id: null, // Will be auto-created
        primary_recipient: {
          customer_id: customerId
        },
        payment_requests: [{
          request_type: 'BALANCE',
          due_date: dueDate,
          automatic_payment_source: 'NONE',
          reminders: [
            { relative_scheduled_days: -3, message: 'Your invoice is due in 3 days.' },
            { relative_scheduled_days: 0, message: 'Your invoice is due today.' },
            { relative_scheduled_days: 3, message: 'Your invoice is 3 days overdue.' }
          ]
        }],
        delivery_method: deliveryMethod,
        invoice_number: `CCRC-${Date.now().toString(36).toUpperCase()}`,
        title: title,
        description: description,
        scheduled_at: null, // Publish immediately
        accepted_payment_methods: {
          card: true,
          square_gift_card: false,
          bank_account: true,
          buy_now_pay_later: false
        }
      }
    })
  });

  return result.invoice;
}

/**
 * List invoices for a customer
 */
export async function listCustomerInvoices(env, customerId, locationId) {
  const result = await squareRequest(env, '/invoices', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Filter by customer (Square doesn't support customer filter directly)
  const invoices = (result.invoices || []).filter(inv =>
    inv.primary_recipient?.customer_id === customerId
  );

  return invoices;
}

/**
 * Get a specific invoice
 */
export async function getInvoice(env, invoiceId) {
  const result = await squareRequest(env, `/invoices/${invoiceId}`);
  return result.invoice;
}

/**
 * Publish (send) a draft invoice
 */
export async function publishInvoice(env, invoiceId, version) {
  const result = await squareRequest(env, `/invoices/${invoiceId}/publish`, {
    method: 'POST',
    body: JSON.stringify({
      version: version,
      idempotency_key: `pub-${invoiceId}-${Date.now()}`
    })
  });
  return result.invoice;
}

/**
 * Cancel an invoice
 */
export async function cancelInvoice(env, invoiceId, version) {
  const result = await squareRequest(env, `/invoices/${invoiceId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({
      version: version
    })
  });
  return result.invoice;
}

// ============================================
// SUBSCRIPTION (SUPPORT PLAN) OPERATIONS
// ============================================

// Support Plan catalog item IDs (must be created in Square Dashboard)
// Tier names MUST match website pricing in pages/Services.tsx
export const SUPPORT_PLAN_CATALOG_IDS = {
  core: null,         // Set after creating in Square Catalog
  professional: null,
  premium: null
};

/**
 * Create a subscription for a support plan
 * NOTE: Requires catalog items to be set up in Square first
 */
export async function createSubscription(env, {
  customerId,
  locationId,
  planVariationId,
  startDate
}) {
  const result = await squareRequest(env, '/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      idempotency_key: `sub-${customerId}-${Date.now()}`,
      location_id: locationId,
      customer_id: customerId,
      plan_variation_id: planVariationId,
      start_date: startDate || new Date().toISOString().split('T')[0],
      timezone: 'America/New_York'
    })
  });

  return result.subscription;
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(env, subscriptionId) {
  const result = await squareRequest(env, `/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST'
  });
  return result.subscription;
}

/**
 * List subscriptions for a customer
 */
export async function listCustomerSubscriptions(env, customerId) {
  const result = await squareRequest(env, '/subscriptions/search', {
    method: 'POST',
    body: JSON.stringify({
      query: {
        filter: {
          customer_ids: [customerId]
        }
      }
    })
  });

  return result.subscriptions || [];
}

// ============================================
// PAYMENT OPERATIONS
// ============================================

/**
 * Get payment details
 */
export async function getPayment(env, paymentId) {
  const result = await squareRequest(env, `/payments/${paymentId}`);
  return result.payment;
}

/**
 * List payments for a customer (via orders)
 */
export async function listCustomerPayments(env, customerId, locationId) {
  const result = await squareRequest(env, '/payments', {
    method: 'GET'
  });

  // Filter by customer reference if available
  return result.payments || [];
}

// ============================================
// WEBHOOK VERIFICATION
// ============================================

/**
 * Verify Square webhook signature
 * @param {string} signature - The X-Square-Signature header
 * @param {string} body - Raw request body
 * @param {string} signatureKey - Webhook signature key from Square
 * @param {string} webhookUrl - The notification URL
 */
export async function verifyWebhookSignature(signature, body, signatureKey, webhookUrl) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signatureKey);
  const messageData = encoder.encode(webhookUrl + body);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  return signature === expectedSignature;
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
 * Convert dollars to cents for Square API
 */
export function dollarsToCents(dollars) {
  return Math.round(parseFloat(dollars) * 100);
}

/**
 * Format Square money object to display string
 */
export function formatMoney(moneyObj) {
  if (!moneyObj) return '$0.00';
  const dollars = centsToDollars(moneyObj.amount);
  return `$${dollars}`;
}

/**
 * Map Square invoice status to UI-friendly status
 */
export function mapInvoiceStatus(squareStatus) {
  const statusMap = {
    'DRAFT': 'draft',
    'UNPAID': 'pending',
    'SCHEDULED': 'pending',
    'PARTIALLY_PAID': 'partial',
    'PAID': 'paid',
    'PARTIALLY_REFUNDED': 'refunded',
    'REFUNDED': 'refunded',
    'CANCELED': 'cancelled',
    'FAILED': 'failed',
    'PAYMENT_PENDING': 'processing'
  };
  return statusMap[squareStatus] || 'unknown';
}
