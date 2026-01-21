/**
 * One-time endpoint to create Village Pizza invoice
 * DELETE THIS FILE AFTER USE
 *
 * POST /api/admin/create-vp-invoice
 */

export async function onRequestPost(context) {
  const { env } = context;

  // Verify this is a legitimate request with a secret key
  const url = new URL(context.request.url);
  const key = url.searchParams.get('key');
  if (key !== 'vp2026invoice') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const SQUARE_ACCESS_TOKEN = env.SQUARE_ACCESS_TOKEN;
  const LOCATION_ID = 'L6GGMPCHFM6WR'; // Lane A - Local Cape Cod

  if (!SQUARE_ACCESS_TOKEN) {
    return new Response(JSON.stringify({ error: 'SQUARE_ACCESS_TOKEN not configured' }), { status: 500 });
  }

  const headers = {
    'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
    'Square-Version': '2024-12-18',
    'Content-Type': 'application/json'
  };

  const results = { steps: [] };

  try {
    // Step 1: Search/Create customer
    results.steps.push('Searching for customer...');

    const searchResp = await fetch('https://connect.squareup.com/v2/customers/search', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: { filter: { email_address: { exact: 'villagepizzawestportma@gmail.com' } } }
      })
    });
    const searchData = await searchResp.json();

    let customerId;
    if (searchData.customers && searchData.customers.length > 0) {
      customerId = searchData.customers[0].id;
      results.steps.push(`Found existing customer: ${customerId}`);
    } else {
      results.steps.push('Creating new customer...');
      const customerResp = await fetch('https://connect.squareup.com/v2/customers', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          idempotency_key: `village-pizza-${Date.now()}`,
          given_name: 'Neil',
          family_name: 'Village Pizza',
          email_address: 'villagepizzawestportma@gmail.com',
          phone_number: '+15086369900',
          company_name: 'Village Pizza & Ice Cream',
          reference_id: 'cl_village_pizza_001',
          address: {
            address_line_1: '760 Main Road',
            locality: 'Westport',
            administrative_district_level_1: 'MA',
            postal_code: '02790',
            country: 'US'
          }
        })
      });
      const customerData = await customerResp.json();
      if (customerData.errors) {
        return new Response(JSON.stringify({ error: 'Customer creation failed', details: customerData.errors }), { status: 500 });
      }
      customerId = customerData.customer.id;
      results.steps.push(`Created customer: ${customerId}`);
    }

    // Step 2: Create order
    results.steps.push('Creating order...');
    const orderResp = await fetch('https://connect.squareup.com/v2/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        idempotency_key: `order-village-pizza-${Date.now()}`,
        order: {
          location_id: LOCATION_ID,
          customer_id: customerId,
          line_items: [{
            name: 'Village Pizza Website & Integration Project',
            quantity: '1',
            base_price_money: { amount: 300000, currency: 'USD' },
            note: 'Custom website (6 pages), Toast integration, Toast Ads, Catering menu, SEO, Domain transfer. First month support included.'
          }],
          state: 'OPEN'
        }
      })
    });
    const orderData = await orderResp.json();
    if (orderData.errors) {
      return new Response(JSON.stringify({ error: 'Order creation failed', details: orderData.errors }), { status: 500 });
    }
    results.steps.push(`Created order: ${orderData.order.id}`);

    // Step 3: Create invoice
    results.steps.push('Creating invoice...');
    const invoiceResp = await fetch('https://connect.squareup.com/v2/invoices', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        idempotency_key: `inv-village-pizza-${Date.now()}`,
        invoice: {
          location_id: LOCATION_ID,
          order_id: orderData.order.id,
          primary_recipient: { customer_id: customerId },
          payment_requests: [{
            request_type: 'BALANCE',
            due_date: '2026-02-20',
            automatic_payment_source: 'NONE',
            reminders: [
              { relative_scheduled_days: -7, message: 'Your invoice for the Village Pizza website project is due in 7 days.' },
              { relative_scheduled_days: -3, message: 'Your invoice is due in 3 days.' },
              { relative_scheduled_days: 0, message: 'Your invoice is due today.' }
            ]
          }],
          delivery_method: 'EMAIL',
          invoice_number: 'VP-2026-001',
          title: 'Village Pizza Website & Integration Project',
          description: `Project Deliverables:
• Custom website build (6 pages, mobile-optimized)
• Toast Online Ordering integration
• Toast Ads setup
• Catering menu configuration (Toast back-office)
• SEO implementation
• Domain transfer coordination

Project Total: $3,000

Ongoing Support: $200/month
(GBP management + Toast support + Website maintenance)
First month included. Recurring billing begins February 2026.`,
          accepted_payment_methods: { card: true, bank_account: true }
        }
      })
    });
    const invoiceData = await invoiceResp.json();
    if (invoiceData.errors) {
      return new Response(JSON.stringify({ error: 'Invoice creation failed', details: invoiceData.errors }), { status: 500 });
    }

    results.steps.push(`Created invoice: ${invoiceData.invoice.id}`);
    results.success = true;
    results.invoice = {
      id: invoiceData.invoice.id,
      number: invoiceData.invoice.invoice_number,
      status: invoiceData.invoice.status,
      amount: '$3,000.00',
      dueDate: '2026-02-20'
    };
    results.customerId = customerId;
    results.orderId = orderData.order.id;
    results.message = 'Invoice created as DRAFT. Review and send from Square Dashboard.';
    results.dashboardUrl = 'https://squareup.com/dashboard/invoices';

    return new Response(JSON.stringify(results, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, steps: results.steps }), { status: 500 });
  }
}
