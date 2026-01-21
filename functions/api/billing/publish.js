/**
 * Publish Invoice API
 *
 * POST /api/billing/publish - Publish a draft invoice (admin only)
 * GET /api/billing/publish - List draft invoices (admin only)
 *
 * This endpoint is used to publish invoices that were created as drafts.
 *
 * Authentication: JWT cookie OR WORKER_API_KEY header/query
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';
import { squareRequest, publishInvoice, getInvoice, mapInvoiceStatus, centsToDollars } from '../_shared/square.js';

/**
 * Check if request is authorized via WORKER_API_KEY
 */
function verifyWorkerApiKey(request, env) {
  const url = new URL(request.url);
  const apiKey = request.headers.get('X-Worker-API-Key') || url.searchParams.get('api_key');

  if (!apiKey || !env.WORKER_API_KEY) {
    return { authenticated: false };
  }

  return { authenticated: apiKey === env.WORKER_API_KEY };
}

/**
 * GET /api/billing/publish
 * List all draft invoices from Square
 */
export async function onRequestGet(context) {
  try {
    const { env, request } = context;

    // Check WORKER_API_KEY first, then fall back to JWT auth
    const apiKeyAuth = verifyWorkerApiKey(request, env);
    if (!apiKeyAuth.authenticated) {
      const auth = await verifyAuth(request, env);
      if (!auth.authenticated) {
        return unauthorizedResponse(auth.error || 'Unauthorized');
      }
    }

    // List all invoices and filter for DRAFT status
    const result = await squareRequest(env, '/invoices?limit=100');

    const draftInvoices = (result.invoices || [])
      .filter(inv => inv.status === 'DRAFT')
      .map(inv => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        title: inv.title,
        status: inv.status,
        version: inv.version,
        amount: inv.payment_requests?.[0]?.computed_amount_money?.amount
          ? centsToDollars(inv.payment_requests[0].computed_amount_money.amount)
          : '0.00',
        due_date: inv.payment_requests?.[0]?.due_date,
        recipient_email: inv.primary_recipient?.email_address,
        recipient_name: inv.primary_recipient?.given_name || inv.primary_recipient?.company_name,
        created_at: inv.created_at
      }));

    return new Response(JSON.stringify({
      success: true,
      data: draftInvoices,
      count: draftInvoices.length
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('List draft invoices error:', error);
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
 * POST /api/billing/publish
 * Publish a draft invoice
 * Body: { invoice_id: string }
 */
export async function onRequestPost(context) {
  try {
    const { env, request } = context;

    // Check WORKER_API_KEY first, then fall back to JWT auth
    const apiKeyAuth = verifyWorkerApiKey(request, env);
    if (!apiKeyAuth.authenticated) {
      const auth = await verifyAuth(request, env);
      if (!auth.authenticated) {
        return unauthorizedResponse(auth.error || 'Unauthorized');
      }
    }

    const body = await request.json();
    const { invoice_id } = body;

    if (!invoice_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'invoice_id is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get the invoice first to retrieve its version
    const invoice = await getInvoice(env, invoice_id);

    if (!invoice) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invoice not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    if (invoice.status !== 'DRAFT') {
      return new Response(JSON.stringify({
        success: false,
        error: `Invoice is not in DRAFT status. Current status: ${invoice.status}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Publish the invoice
    const publishedInvoice = await publishInvoice(env, invoice_id, invoice.version);

    return new Response(JSON.stringify({
      success: true,
      message: 'Invoice published successfully',
      data: {
        id: publishedInvoice.id,
        invoice_number: publishedInvoice.invoice_number,
        status: publishedInvoice.status,
        public_url: publishedInvoice.public_url
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Publish invoice error:', error);
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
// Trigger redeploy Wed, Jan 21, 2026  3:58:37 PM
