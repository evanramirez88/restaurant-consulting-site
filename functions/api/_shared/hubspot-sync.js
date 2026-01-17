/**
 * HubSpot Sync Helper
 *
 * Provides bidirectional sync between Stripe subscription events and HubSpot CRM.
 * Updates HubSpot contacts when Stripe events occur.
 *
 * Used by: /api/stripe/webhook.js
 *
 * HubSpot Custom Properties Used:
 * - subscription_status: active, cancelled, past_due, trialing
 * - subscription_plan: Core, Professional, Premium
 * - subscription_start_date: YYYY-MM-DD
 * - subscription_end_date: YYYY-MM-DD (when cancelled)
 * - subscription_renewal_date: YYYY-MM-DD
 * - mrr: Monthly recurring revenue as string
 * - stripe_customer_id: Stripe customer ID
 * - stripe_subscription_id: Stripe subscription ID
 * - last_payment_date: YYYY-MM-DD
 * - last_payment_amount: Amount as string
 * - lifecyclestage: customer (when subscribed)
 */

/**
 * Update a HubSpot contact by searching for their email
 * @param {Object} env - Environment with HUBSPOT_API_KEY
 * @param {string} email - Contact email to search for
 * @param {Object} properties - Properties to update
 * @returns {Object|null} Updated contact or null if not found/error
 */
export async function updateHubSpotContact(env, email, properties) {
  if (!env.HUBSPOT_API_KEY) {
    console.warn('[HubSpot] API key not configured, skipping sync');
    return null;
  }

  try {
    // Search for contact by email
    const searchResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'EQ',
            value: email
          }]
        }]
      })
    });

    if (!searchResponse.ok) {
      const error = await searchResponse.json();
      console.error('[HubSpot] Search failed:', error);
      return null;
    }

    const searchData = await searchResponse.json();
    const contact = searchData.results?.[0];

    if (!contact) {
      console.log(`[HubSpot] Contact not found for email: ${email}`);
      return null;
    }

    // Update contact properties
    const updateResponse = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${env.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties })
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      console.error('[HubSpot] Update failed:', error);
      return null;
    }

    console.log(`[HubSpot] Updated contact ${contact.id} with:`, properties);
    return await updateResponse.json();

  } catch (error) {
    console.error('[HubSpot] Sync error:', error);
    return null;
  }
}

/**
 * Create or update a HubSpot contact
 * Creates if not found, updates if exists
 * @param {Object} env - Environment with HUBSPOT_API_KEY
 * @param {string} email - Contact email
 * @param {Object} properties - Properties to set
 * @returns {Object|null} Created/updated contact or null on error
 */
export async function upsertHubSpotContact(env, email, properties) {
  if (!env.HUBSPOT_API_KEY) {
    console.warn('[HubSpot] API key not configured, skipping sync');
    return null;
  }

  try {
    // First try to update existing contact
    const result = await updateHubSpotContact(env, email, properties);
    if (result) return result;

    // Contact not found, create new one
    const createResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          email,
          ...properties
        }
      })
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      console.error('[HubSpot] Contact creation failed:', error);
      return null;
    }

    const contact = await createResponse.json();
    console.log(`[HubSpot] Created contact ${contact.id} for ${email}`);
    return contact;

  } catch (error) {
    console.error('[HubSpot] Upsert error:', error);
    return null;
  }
}

/**
 * Create a HubSpot deal associated with a contact
 * @param {Object} env - Environment with HUBSPOT_API_KEY
 * @param {string} contactEmail - Contact email to associate deal with
 * @param {Object} dealProperties - Deal properties
 * @returns {Object|null} Created deal or null on error
 */
export async function createHubSpotDeal(env, contactEmail, dealProperties) {
  if (!env.HUBSPOT_API_KEY) {
    console.warn('[HubSpot] API key not configured, skipping deal creation');
    return null;
  }

  try {
    // First get contact ID
    const searchResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'EQ',
            value: contactEmail
          }]
        }]
      })
    });

    if (!searchResponse.ok) {
      const error = await searchResponse.json();
      console.error('[HubSpot] Contact search for deal failed:', error);
      return null;
    }

    const searchData = await searchResponse.json();
    const contact = searchData.results?.[0];

    // Create deal with or without contact association
    const dealPayload = {
      properties: dealProperties
    };

    // Add contact association if found
    if (contact) {
      dealPayload.associations = [{
        to: { id: contact.id },
        types: [{
          associationCategory: 'HUBSPOT_DEFINED',
          associationTypeId: 3  // Contact to Deal association
        }]
      }];
    }

    const dealResponse = await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dealPayload)
    });

    if (!dealResponse.ok) {
      const error = await dealResponse.json();
      console.error('[HubSpot] Deal creation failed:', error);
      return null;
    }

    const deal = await dealResponse.json();
    console.log(`[HubSpot] Created deal ${deal.id}: ${dealProperties.dealname}`);
    return deal;

  } catch (error) {
    console.error('[HubSpot] Deal creation error:', error);
    return null;
  }
}

/**
 * Update an existing HubSpot deal
 * @param {Object} env - Environment with HUBSPOT_API_KEY
 * @param {string} dealId - HubSpot deal ID
 * @param {Object} properties - Properties to update
 * @returns {Object|null} Updated deal or null on error
 */
export async function updateHubSpotDeal(env, dealId, properties) {
  if (!env.HUBSPOT_API_KEY) {
    console.warn('[HubSpot] API key not configured, skipping deal update');
    return null;
  }

  try {
    const response = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${env.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[HubSpot] Deal update failed:', error);
      return null;
    }

    const deal = await response.json();
    console.log(`[HubSpot] Updated deal ${dealId}`);
    return deal;

  } catch (error) {
    console.error('[HubSpot] Deal update error:', error);
    return null;
  }
}

/**
 * Search for deals by property value
 * @param {Object} env - Environment with HUBSPOT_API_KEY
 * @param {string} propertyName - Property to search by
 * @param {string} value - Value to search for
 * @returns {Array} Array of matching deals
 */
export async function searchHubSpotDeals(env, propertyName, value) {
  if (!env.HUBSPOT_API_KEY) return [];

  try {
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filterGroups: [{
          filters: [{
            propertyName,
            operator: 'EQ',
            value
          }]
        }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[HubSpot] Deal search failed:', error);
      return [];
    }

    const data = await response.json();
    return data.results || [];

  } catch (error) {
    console.error('[HubSpot] Deal search error:', error);
    return [];
  }
}

/**
 * Get Stripe customer email using Stripe API
 * @param {Object} env - Environment with STRIPE_SECRET_KEY
 * @param {string} customerId - Stripe customer ID
 * @returns {string|null} Customer email or null
 */
export async function getStripeCustomerEmail(env, customerId) {
  if (!env.STRIPE_SECRET_KEY) {
    console.error('[Stripe] Secret key not configured');
    return null;
  }

  try {
    const response = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Stripe] Failed to get customer:', error);
      return null;
    }

    const customer = await response.json();
    return customer.email || null;

  } catch (error) {
    console.error('[Stripe] Failed to get customer email:', error);
    return null;
  }
}

/**
 * Sync a subscription creation to HubSpot
 * Updates contact properties and creates a deal
 * @param {Object} env - Environment object
 * @param {Object} subscription - Stripe subscription object
 * @param {string} planName - Name of the plan (e.g., "Core", "Professional")
 * @param {string} customerEmail - Customer email (optional, will fetch if not provided)
 */
export async function syncSubscriptionCreatedToHubSpot(env, subscription, planName, customerEmail = null) {
  // Get customer email if not provided
  const email = customerEmail || await getStripeCustomerEmail(env, subscription.customer);
  if (!email) {
    console.warn('[HubSpot] No email available for subscription sync');
    return;
  }

  const priceAmount = subscription.items?.data?.[0]?.price?.unit_amount || 0;
  const mrr = (priceAmount / 100).toString();
  const startDate = new Date(subscription.current_period_start * 1000).toISOString().split('T')[0];
  const renewalDate = new Date(subscription.current_period_end * 1000).toISOString().split('T')[0];

  // Update contact
  await updateHubSpotContact(env, email, {
    subscription_status: 'active',
    subscription_plan: planName,
    subscription_start_date: startDate,
    subscription_renewal_date: renewalDate,
    mrr: mrr,
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: subscription.id,
    lifecyclestage: 'customer'
  });

  // Create deal for subscription
  await createHubSpotDeal(env, email, {
    dealname: `${planName} Subscription - ${email}`,
    amount: mrr,
    dealstage: 'closedwon',
    pipeline: 'default',
    closedate: new Date().toISOString().split('T')[0],
    stripe_subscription_id: subscription.id
  });

  console.log(`[HubSpot] Synced subscription creation for ${email}`);
}

/**
 * Sync a subscription update to HubSpot
 * @param {Object} env - Environment object
 * @param {Object} subscription - Stripe subscription object
 * @param {string} customerEmail - Customer email (optional)
 */
export async function syncSubscriptionUpdatedToHubSpot(env, subscription, customerEmail = null) {
  const email = customerEmail || await getStripeCustomerEmail(env, subscription.customer);
  if (!email) return;

  const priceAmount = subscription.items?.data?.[0]?.price?.unit_amount || 0;
  const mrr = (priceAmount / 100).toString();
  const planName = subscription.metadata?.tier ||
                   subscription.items?.data?.[0]?.price?.nickname ||
                   'Standard';
  const renewalDate = new Date(subscription.current_period_end * 1000).toISOString().split('T')[0];

  await updateHubSpotContact(env, email, {
    subscription_status: subscription.status,
    subscription_plan: planName,
    subscription_renewal_date: renewalDate,
    mrr: mrr
  });

  console.log(`[HubSpot] Synced subscription update for ${email}`);
}

/**
 * Sync a subscription cancellation to HubSpot
 * @param {Object} env - Environment object
 * @param {Object} subscription - Stripe subscription object
 * @param {string} customerEmail - Customer email (optional)
 */
export async function syncSubscriptionCancelledToHubSpot(env, subscription, customerEmail = null) {
  const email = customerEmail || await getStripeCustomerEmail(env, subscription.customer);
  if (!email) return;

  await updateHubSpotContact(env, email, {
    subscription_status: 'cancelled',
    subscription_end_date: new Date().toISOString().split('T')[0],
    mrr: '0'
  });

  console.log(`[HubSpot] Synced subscription cancellation for ${email}`);
}

/**
 * Sync a successful payment to HubSpot
 * @param {Object} env - Environment object
 * @param {Object} invoice - Stripe invoice object
 */
export async function syncPaymentSucceededToHubSpot(env, invoice) {
  const email = invoice.customer_email;
  if (!email) return;

  await updateHubSpotContact(env, email, {
    last_payment_date: new Date().toISOString().split('T')[0],
    last_payment_amount: (invoice.amount_paid / 100).toString()
  });

  console.log(`[HubSpot] Synced payment success for ${email}`);
}

/**
 * Sync a failed payment to HubSpot
 * @param {Object} env - Environment object
 * @param {Object} invoice - Stripe invoice object
 */
export async function syncPaymentFailedToHubSpot(env, invoice) {
  const email = invoice.customer_email;
  if (!email) return;

  await updateHubSpotContact(env, email, {
    subscription_status: 'past_due',
    payment_failed_date: new Date().toISOString().split('T')[0]
  });

  console.log(`[HubSpot] Synced payment failure for ${email}`);
}
