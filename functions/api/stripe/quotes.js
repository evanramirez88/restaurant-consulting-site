/**
 * Stripe Quotes API
 *
 * POST /api/stripe/quotes - Create custom quote
 * GET /api/stripe/quotes?quote_id=xxx - Get quote details
 * POST /api/stripe/quotes/finalize - Finalize quote for acceptance
 * POST /api/stripe/quotes/accept - Accept quote (creates subscription)
 *
 * Handles custom/bespoke pricing via Stripe Quotes with:
 * - Ad-hoc price creation
 * - PDF generation
 * - Quote acceptance flow
 * - HubSpot deal integration
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';
import {
  getStripeClient,
  createStripeQuote,
  finalizeStripeQuote,
  acceptStripeQuote,
  getOrCreateStripeCustomer,
  dollarsToCents
} from '../_shared/stripe.js';

/**
 * POST /api/stripe/quotes
 * Create a new custom quote
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Handle sub-routes
  if (url.pathname.endsWith('/finalize')) {
    return handleFinalizeQuote(request, env);
  }
  if (url.pathname.endsWith('/accept')) {
    return handleAcceptQuote(request, env);
  }

  // Admin auth required for creating quotes
  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const body = await request.json();
    const {
      client_id,
      customer_id,
      customer_email,
      items,
      commitment_months = 3,
      expiration_days = 30,
      header,
      footer,
      hubspot_deal_id,
      hubspot_contact_id,
      notes
    } = body;

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'items array is required with at least one item'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get or create customer
    let customerId = customer_id;
    let email = customer_email;

    if (client_id && !customerId) {
      const client = await env.DB.prepare(
        'SELECT * FROM clients WHERE id = ?'
      ).bind(client_id).first();

      if (client) {
        email = client.email;
        if (client.stripe_customer_id) {
          customerId = client.stripe_customer_id;
        } else {
          const customer = await getOrCreateStripeCustomer(env, client);
          customerId = customer.id;

          await env.DB.prepare(
            'UPDATE clients SET stripe_customer_id = ? WHERE id = ?'
          ).bind(customerId, client_id).run();
        }
      }
    }

    if (!customerId && !email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'customer_id, customer_email, or client_id is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Process line items - convert dollar amounts to cents
    const processedItems = items.map(item => ({
      priceId: item.price_id,
      amount: item.amount ? dollarsToCents(item.amount) : undefined,
      description: item.description,
      recurring: item.recurring,
      interval: item.interval,
      quantity: item.quantity
    }));

    // Create quote
    const quote = await createStripeQuote(env, {
      customerId,
      customerEmail: customerId ? undefined : email,
      lineItems: processedItems,
      commitmentMonths: commitment_months,
      expirationDays: expiration_days,
      header: header || 'Restaurant Guardian Custom Support Quote',
      footer: footer || `Valid for ${expiration_days} days. Questions? Contact support@ccrestaurantconsulting.com`,
      metadata: {
        client_id: client_id || '',
        hubspot_deal_id: hubspot_deal_id || '',
        hubspot_contact_id: hubspot_contact_id || '',
        notes: notes || ''
      }
    });

    // Finalize quote immediately for PDF generation
    const { quote: finalizedQuote, pdfUrl } = await finalizeStripeQuote(env, quote.id);

    return new Response(JSON.stringify({
      success: true,
      data: {
        quote_id: finalizedQuote.id,
        quote_number: finalizedQuote.number,
        status: finalizedQuote.status,
        amount_subtotal: finalizedQuote.amount_subtotal,
        amount_total: finalizedQuote.amount_total,
        currency: finalizedQuote.currency,
        expires_at: finalizedQuote.expires_at,
        pdf_url: pdfUrl,
        customer_id: finalizedQuote.customer
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Create quote error:', error);
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
 * GET /api/stripe/quotes
 * Get quote details
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const quoteId = url.searchParams.get('quote_id');

  if (!quoteId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'quote_id query parameter is required'
    }), {
      status: 400,
      headers: corsHeaders
    });
  }

  try {
    const stripe = getStripeClient(env);
    const quote = await stripe.quotes.retrieve(quoteId, {
      expand: ['line_items', 'customer']
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: quote.id,
        number: quote.number,
        status: quote.status,
        amount_subtotal: quote.amount_subtotal,
        amount_total: quote.amount_total,
        currency: quote.currency,
        expires_at: quote.expires_at,
        pdf: quote.pdf,
        customer: {
          id: quote.customer?.id || quote.customer,
          email: quote.customer?.email
        },
        line_items: quote.line_items?.data.map(item => ({
          id: item.id,
          description: item.description,
          amount_total: item.amount_total,
          quantity: item.quantity
        })),
        subscription: quote.subscription,
        metadata: quote.metadata
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Get quote error:', error);
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
 * Handle quote finalization
 */
async function handleFinalizeQuote(request, env) {
  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const body = await request.json();
    const { quote_id } = body;

    if (!quote_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'quote_id is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const { quote, pdfUrl } = await finalizeStripeQuote(env, quote_id);

    return new Response(JSON.stringify({
      success: true,
      data: {
        quote_id: quote.id,
        status: quote.status,
        pdf_url: pdfUrl,
        expires_at: quote.expires_at
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Finalize quote error:', error);
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
 * Handle quote acceptance
 */
async function handleAcceptQuote(request, env) {
  // Quote acceptance can be done by customer (with proper auth)
  // or by admin

  try {
    const body = await request.json();
    const { quote_id } = body;

    if (!quote_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'quote_id is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const quote = await acceptStripeQuote(env, quote_id);

    // Update HubSpot deal if linked
    if (quote.metadata?.hubspot_deal_id && env.HUBSPOT_ACCESS_TOKEN) {
      try {
        await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${quote.metadata.hubspot_deal_id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.HUBSPOT_ACCESS_TOKEN}`
          },
          body: JSON.stringify({
            properties: {
              dealstage: 'closedwon',
              stripe_quote_id: quote.id,
              stripe_subscription_id: quote.subscription
            }
          })
        });
      } catch (hubspotError) {
        console.error('HubSpot deal update failed:', hubspotError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        quote_id: quote.id,
        status: quote.status,
        subscription_id: quote.subscription,
        invoice_id: quote.invoice
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Accept quote error:', error);
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
