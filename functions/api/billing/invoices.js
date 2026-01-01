/**
 * Billing Invoices API
 *
 * GET /api/billing/invoices - List invoices for authenticated client
 * POST /api/billing/invoices - Create invoice (admin only)
 *
 * Integrates with Square Invoices API
 */

import { verifyClientAuth, verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';
import {
  getOrCreateCustomer,
  listCustomerInvoices,
  createInvoice,
  publishInvoice,
  getLocationId,
  formatMoney,
  mapInvoiceStatus
} from '../_shared/square.js';

/**
 * GET /api/billing/invoices
 * List invoices for the authenticated client (client portal)
 * Query params: ?status=paid|pending|overdue
 */
export async function onRequestGet(context) {
  try {
    const { env, request } = context;
    const url = new URL(request.url);

    // Check for admin auth first (admin can view any client's invoices)
    const adminAuth = await verifyAuth(request, env);
    let clientId = url.searchParams.get('client_id');

    if (!adminAuth.authenticated) {
      // Try client auth
      const clientAuth = await verifyClientAuth(request, env);
      if (!clientAuth.authenticated) {
        return unauthorizedResponse('Authentication required');
      }
      clientId = clientAuth.clientId;
    }

    if (!clientId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'client_id required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get client info
    const client = await env.DB.prepare(
      'SELECT * FROM clients WHERE id = ?'
    ).bind(clientId).first();

    if (!client) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // If client has Square customer ID, fetch from Square
    if (client.square_customer_id) {
      try {
        const locationId = getLocationId(env, client.service_lane || 'B');
        const squareInvoices = await listCustomerInvoices(env, client.square_customer_id, locationId);

        // Transform Square invoices to our format
        const invoices = squareInvoices.map(inv => ({
          id: inv.id,
          number: inv.invoice_number || inv.id.slice(0, 8).toUpperCase(),
          amount: inv.payment_requests?.[0]?.computed_amount_money?.amount
            ? inv.payment_requests[0].computed_amount_money.amount / 100
            : 0,
          status: mapInvoiceStatus(inv.status),
          due_date: inv.payment_requests?.[0]?.due_date || null,
          paid_date: inv.status === 'PAID' ? inv.updated_at : null,
          pdf_url: inv.public_url || null,
          square_status: inv.status,
          created_at: inv.created_at
        }));

        // Apply status filter if provided
        const statusFilter = url.searchParams.get('status');
        const filteredInvoices = statusFilter
          ? invoices.filter(inv => inv.status === statusFilter)
          : invoices;

        return new Response(JSON.stringify({
          success: true,
          data: filteredInvoices,
          source: 'square'
        }), {
          headers: corsHeaders
        });
      } catch (squareError) {
        console.error('Square API error:', squareError);
        // Fall through to local data
      }
    }

    // Fallback: Return invoices from local database
    let query = 'SELECT * FROM invoices WHERE client_id = ?';
    const params = [clientId];

    const statusFilter = url.searchParams.get('status');
    if (statusFilter) {
      query += ' AND status = ?';
      params.push(statusFilter);
    }

    query += ' ORDER BY created_at DESC';

    const result = await env.DB.prepare(query).bind(...params).all();

    return new Response(JSON.stringify({
      success: true,
      data: result.results || [],
      source: 'local'
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Get invoices error:', error);
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
 * POST /api/billing/invoices
 * Create a new invoice (admin only)
 */
export async function onRequestPost(context) {
  try {
    const { env, request } = context;

    // Admin auth required for creating invoices
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();
    const {
      client_id,
      line_items,
      title,
      description,
      due_date,
      auto_publish = true,
      delivery_method = 'EMAIL'
    } = body;

    if (!client_id || !line_items || line_items.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'client_id and line_items are required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get client info
    const client = await env.DB.prepare(
      'SELECT * FROM clients WHERE id = ?'
    ).bind(client_id).first();

    if (!client) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Ensure client has Square customer ID
    let squareCustomerId = client.square_customer_id;
    if (!squareCustomerId) {
      // Create Square customer
      const squareCustomer = await getOrCreateCustomer(env, client);
      squareCustomerId = squareCustomer.id;

      // Store Square customer ID
      await env.DB.prepare(
        'UPDATE clients SET square_customer_id = ?, updated_at = unixepoch() WHERE id = ?'
      ).bind(squareCustomerId, client_id).run();
    }

    const locationId = getLocationId(env, client.service_lane || 'B');

    // Calculate due date (default: 30 days from now)
    const invoiceDueDate = due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    // Create invoice in Square
    const invoice = await createInvoice(env, {
      clientId: client_id,
      customerId: squareCustomerId,
      locationId: locationId,
      lineItems: line_items,
      title: title || 'Invoice from Cape Cod Restaurant Consulting',
      description: description || '',
      dueDate: invoiceDueDate,
      deliveryMethod: delivery_method
    });

    // Auto-publish if requested
    if (auto_publish && invoice.status === 'DRAFT') {
      const publishedInvoice = await publishInvoice(env, invoice.id, invoice.version);

      return new Response(JSON.stringify({
        success: true,
        data: {
          id: publishedInvoice.id,
          number: publishedInvoice.invoice_number,
          status: mapInvoiceStatus(publishedInvoice.status),
          public_url: publishedInvoice.public_url
        }
      }), {
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: invoice.id,
        number: invoice.invoice_number,
        status: mapInvoiceStatus(invoice.status)
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Create invoice error:', error);
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
