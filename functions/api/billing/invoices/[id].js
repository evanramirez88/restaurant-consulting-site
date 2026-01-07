/**
 * Single Invoice API Endpoint
 *
 * GET /api/billing/invoices/[id] - Get single invoice detail
 *
 * Fetches invoice from both Square API and local D1 database
 */

import { verifyClientAuth, verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';
import { getInvoice, mapInvoiceStatus } from '../../_shared/square.js';

/**
 * GET /api/billing/invoices/[id]
 * Fetch a single invoice by ID
 */
export async function onRequestGet(context) {
  try {
    const { env, request, params } = context;
    const invoiceId = params.id;

    if (!invoiceId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invoice ID is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Verify authentication
    const adminAuth = await verifyAuth(request, env);
    let clientId = null;
    let isAdmin = false;

    if (adminAuth.authenticated) {
      isAdmin = true;
    } else {
      const clientAuth = await verifyClientAuth(request, env);
      if (!clientAuth.authenticated) {
        return unauthorizedResponse('Authentication required');
      }
      clientId = clientAuth.clientId;
    }

    // First, try to fetch from Square API if it looks like a Square invoice ID
    let squareInvoice = null;
    let localInvoice = null;

    // Square invoice IDs are typically long alphanumeric strings
    if (invoiceId.length > 20 && env.SQUARE_ACCESS_TOKEN) {
      try {
        squareInvoice = await getInvoice(env, invoiceId);
      } catch (squareError) {
        console.log('Square fetch failed, trying local DB:', squareError.message);
      }
    }

    // Also check local D1 database
    if (env.DB) {
      try {
        let query = 'SELECT * FROM invoices WHERE id = ? OR square_invoice_id = ?';
        const params = [invoiceId, invoiceId];

        // If client is fetching, ensure they can only see their own invoices
        if (!isAdmin && clientId) {
          query += ' AND client_id = ?';
          params.push(clientId);
        }

        localInvoice = await env.DB.prepare(query).bind(...params).first();
      } catch (dbError) {
        console.error('D1 query error:', dbError);
      }
    }

    // Merge data from both sources
    if (!squareInvoice && !localInvoice) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invoice not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // If we have Square data, transform it
    if (squareInvoice) {
      const paymentRequest = squareInvoice.payment_requests?.[0];
      const invoice = {
        id: squareInvoice.id,
        number: squareInvoice.invoice_number || squareInvoice.id.slice(0, 8).toUpperCase(),
        title: squareInvoice.title || 'Invoice',
        description: squareInvoice.description || '',
        status: mapInvoiceStatus(squareInvoice.status),
        square_status: squareInvoice.status,
        amount: paymentRequest?.computed_amount_money?.amount
          ? paymentRequest.computed_amount_money.amount / 100
          : 0,
        currency: paymentRequest?.computed_amount_money?.currency || 'USD',
        due_date: paymentRequest?.due_date || null,
        paid_date: squareInvoice.status === 'PAID' ? squareInvoice.updated_at : null,
        public_url: squareInvoice.public_url || null,
        customer_id: squareInvoice.primary_recipient?.customer_id || null,
        location_id: squareInvoice.location_id,
        created_at: squareInvoice.created_at,
        updated_at: squareInvoice.updated_at,
        version: squareInvoice.version,
        // Include line items if available
        line_items: squareInvoice.order?.line_items?.map(item => ({
          name: item.name,
          quantity: item.quantity,
          amount: item.base_price_money?.amount
            ? item.base_price_money.amount / 100
            : 0
        })) || [],
        // Merge with local data if available
        local_data: localInvoice ? {
          client_id: localInvoice.client_id,
          notes: localInvoice.notes,
          internal_status: localInvoice.status
        } : null,
        source: 'square'
      };

      return new Response(JSON.stringify({
        success: true,
        data: invoice
      }), {
        headers: corsHeaders
      });
    }

    // Return local data only
    return new Response(JSON.stringify({
      success: true,
      data: {
        id: localInvoice.id,
        number: localInvoice.invoice_number || localInvoice.id,
        title: localInvoice.title,
        description: localInvoice.description,
        status: localInvoice.status,
        amount: localInvoice.amount,
        currency: localInvoice.currency || 'USD',
        due_date: localInvoice.due_date,
        paid_date: localInvoice.paid_date,
        public_url: localInvoice.public_url,
        square_invoice_id: localInvoice.square_invoice_id,
        client_id: localInvoice.client_id,
        created_at: localInvoice.created_at,
        updated_at: localInvoice.updated_at,
        notes: localInvoice.notes,
        source: 'local'
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Get invoice error:', error);
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
