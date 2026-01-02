/**
 * PandaDoc Webhook Handler
 *
 * POST /api/webhooks/pandadoc
 *
 * Handles PandaDoc document events and triggers appropriate actions:
 * - document.completed → Create Square invoice
 * - document.viewed → Log activity
 * - document.declined → Notify admin
 *
 * Webhook Events:
 * https://developers.pandadoc.com/reference/webhooks
 */

import { verifyWebhookSignature, getDocument } from '../_shared/pandadoc.js';
import { getOrCreateCustomer, createInvoice, publishInvoice, getLocationId } from '../_shared/square.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-PandaDoc-Signature',
  'Content-Type': 'application/json'
};

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.text();

    // Verify webhook signature if secret is configured
    if (env.PANDADOC_WEBHOOK_SECRET) {
      const signature = request.headers.get('X-PandaDoc-Signature');
      if (!signature) {
        console.warn('PandaDoc webhook: Missing signature');
        return new Response(JSON.stringify({ error: 'Missing signature' }), {
          status: 401,
          headers: corsHeaders
        });
      }

      const isValid = await verifyWebhookSignature(signature, body, env.PANDADOC_WEBHOOK_SECRET);
      if (!isValid) {
        console.warn('PandaDoc webhook: Invalid signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: corsHeaders
        });
      }
    }

    const event = JSON.parse(body);
    console.log('PandaDoc webhook received:', event.event, event.data?.id);

    // Route based on event type
    switch (event.event) {
      case 'document_state_changed':
        await handleStateChange(env, event.data);
        break;

      case 'document_completed':
        await handleDocumentCompleted(env, event.data);
        break;

      case 'document_viewed':
        await handleDocumentViewed(env, event.data);
        break;

      case 'document_declined':
        await handleDocumentDeclined(env, event.data);
        break;

      default:
        console.log('Unhandled PandaDoc event:', event.event);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('PandaDoc webhook error:', error);

    // Always return 200 to prevent retries for parsing errors
    return new Response(JSON.stringify({
      received: true,
      error: error.message
    }), {
      status: 200,
      headers: corsHeaders
    });
  }
}

/**
 * Handle document state changes
 */
async function handleStateChange(env, data) {
  console.log(`Document ${data.id} state changed to: ${data.status}`);

  // Log to D1 if available
  if (env.DB) {
    try {
      await env.DB.prepare(`
        INSERT INTO contract_events (contract_id, event_type, status, created_at)
        VALUES (?, 'state_change', ?, ?)
      `).bind(data.id, data.status, Date.now()).run();
    } catch (e) {
      console.warn('Failed to log contract event:', e.message);
    }
  }
}

/**
 * Handle document completed (signed by all parties)
 * This is the trigger to create a Square invoice
 */
async function handleDocumentCompleted(env, data) {
  console.log(`Contract completed: ${data.id}`);

  try {
    // Get full document details including metadata
    const document = await getDocument(env, data.id);
    const metadata = document.metadata || {};

    // Only process if we have client info
    if (!metadata.client_id) {
      console.warn('No client_id in contract metadata, skipping invoice creation');
      return;
    }

    // Get client from database
    let client;
    if (env.DB) {
      client = await env.DB.prepare(
        'SELECT * FROM clients WHERE id = ?'
      ).bind(metadata.client_id).first();
    }

    if (!client) {
      // Try to extract from document recipients
      const recipient = document.recipients?.find(r => r.role === 'Client');
      if (recipient) {
        client = {
          id: metadata.client_id,
          email: recipient.email,
          name: `${recipient.first_name} ${recipient.last_name}`.trim()
        };
      }
    }

    if (!client) {
      console.error('Could not find client for invoice creation');
      return;
    }

    // Check if Square is configured
    if (!env.SQUARE_ACCESS_TOKEN) {
      console.log('Square not configured, skipping invoice creation');
      return;
    }

    // Create or get Square customer
    const customer = await getOrCreateCustomer(env, client);

    // Determine lane based on service type
    const lane = metadata.service_type === 'local' ? 'A' : 'B';
    const locationId = getLocationId(env, lane);

    // Extract pricing from document name or use default
    // In production, you'd store this in metadata or parse from document
    const description = `
Services as outlined in signed contract: ${document.name}

Contract ID: ${data.id}
Signed: ${new Date().toLocaleDateString()}

Thank you for choosing Cape Cod Restaurant Consulting!
    `.trim();

    // Create invoice
    // Note: You'll need to extract line items from the contract
    // For now, we create a basic invoice - enhance as needed
    const invoice = await createInvoice(env, {
      clientId: client.id,
      customerId: customer.id,
      locationId,
      title: `Invoice - ${document.name}`,
      description,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      deliveryMethod: 'EMAIL'
    });

    console.log('Square invoice created:', invoice.id);

    // Publish the invoice
    await publishInvoice(env, invoice.id, invoice.version);
    console.log('Square invoice published');

    // Update contract record in D1
    if (env.DB) {
      await env.DB.prepare(`
        INSERT INTO contract_events (contract_id, event_type, status, metadata, created_at)
        VALUES (?, 'invoice_created', 'completed', ?, ?)
      `).bind(data.id, JSON.stringify({ invoice_id: invoice.id }), Date.now()).run();
    }

  } catch (error) {
    console.error('Failed to create invoice from contract:', error);
    // Don't throw - we don't want to trigger webhook retries
  }
}

/**
 * Handle document viewed
 */
async function handleDocumentViewed(env, data) {
  console.log(`Contract viewed: ${data.id}`);

  // Log for analytics
  if (env.DB) {
    try {
      await env.DB.prepare(`
        INSERT INTO contract_events (contract_id, event_type, status, created_at)
        VALUES (?, 'viewed', 'active', ?)
      `).bind(data.id, Date.now()).run();
    } catch (e) {
      console.warn('Failed to log view event:', e.message);
    }
  }
}

/**
 * Handle document declined
 */
async function handleDocumentDeclined(env, data) {
  console.log(`Contract declined: ${data.id}`);

  // Log the event
  if (env.DB) {
    try {
      await env.DB.prepare(`
        INSERT INTO contract_events (contract_id, event_type, status, created_at)
        VALUES (?, 'declined', 'cancelled', ?)
      `).bind(data.id, Date.now()).run();
    } catch (e) {
      console.warn('Failed to log decline event:', e.message);
    }
  }

  // TODO: Send notification to admin
  // Could integrate with email service or HubSpot
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-PandaDoc-Signature',
      'Access-Control-Max-Age': '86400'
    }
  });
}
