/**
 * Create Village Pizza Invoice via Square API
 *
 * Run with: node scripts/create_village_pizza_invoice.js
 *
 * This script creates:
 * 1. Square customer for Village Pizza
 * 2. Order with $3,000 project line item
 * 3. Draft invoice ready for review
 */

const LOCATION_ID = 'L6GGMPCHFM6WR'; // Lane A - Local Cape Cod

async function createInvoice(accessToken) {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Square-Version': '2024-12-18',
    'Content-Type': 'application/json'
  };

  console.log('Creating Village Pizza invoice...\n');

  // Step 1: Search for existing customer or create new
  console.log('Step 1: Checking for existing customer...');

  const searchResp = await fetch('https://connect.squareup.com/v2/customers/search', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: {
        filter: {
          email_address: { exact: 'villagepizzawestportma@gmail.com' }
        }
      }
    })
  });

  const searchData = await searchResp.json();
  let customerId;

  if (searchData.customers && searchData.customers.length > 0) {
    customerId = searchData.customers[0].id;
    console.log(`  Found existing customer: ${customerId}`);
  } else {
    console.log('  Creating new customer...');
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
        },
        note: 'Website build project client - January 2026'
      })
    });

    const customerData = await customerResp.json();
    if (customerData.errors) {
      console.error('Customer creation failed:', customerData.errors);
      return;
    }
    customerId = customerData.customer.id;
    console.log(`  Created customer: ${customerId}`);
  }

  // Step 2: Create order with line items
  console.log('\nStep 2: Creating order...');

  const orderResp = await fetch('https://connect.squareup.com/v2/orders', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      idempotency_key: `order-village-pizza-${Date.now()}`,
      order: {
        location_id: LOCATION_ID,
        customer_id: customerId,
        line_items: [
          {
            name: 'Village Pizza Website & Integration Project',
            quantity: '1',
            base_price_money: { amount: 300000, currency: 'USD' },
            note: 'Custom website build (6 pages, mobile-optimized), Toast Online Ordering integration, Toast Ads setup, Catering menu configuration, SEO implementation, Domain transfer coordination. First month of ongoing support ($200/mo) included.'
          }
        ],
        state: 'OPEN'
      }
    })
  });

  const orderData = await orderResp.json();
  if (orderData.errors) {
    console.error('Order creation failed:', orderData.errors);
    return;
  }
  console.log(`  Created order: ${orderData.order.id}`);

  // Step 3: Create invoice
  console.log('\nStep 3: Creating invoice...');

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
First month included with project.
Recurring billing begins February 2026.`,
        accepted_payment_methods: {
          card: true,
          bank_account: true,
          square_gift_card: false,
          buy_now_pay_later: false
        }
      }
    })
  });

  const invoiceData = await invoiceResp.json();
  if (invoiceData.errors) {
    console.error('Invoice creation failed:', invoiceData.errors);
    return;
  }

  console.log(`  Created invoice: ${invoiceData.invoice.id}`);
  console.log(`  Invoice number: ${invoiceData.invoice.invoice_number}`);
  console.log(`  Status: ${invoiceData.invoice.status}`);

  console.log('\n========================================');
  console.log('SUCCESS! Invoice created as DRAFT');
  console.log('========================================');
  console.log(`\nInvoice ID: ${invoiceData.invoice.id}`);
  console.log(`Amount: $3,000.00`);
  console.log(`Due Date: 2026-02-20`);
  console.log(`\nNext Steps:`);
  console.log(`1. Review invoice in Square Dashboard`);
  console.log(`2. Click "Send" to email to client`);
  console.log(`\nSquare Dashboard: https://squareup.com/dashboard/invoices`);

  return {
    customerId,
    orderId: orderData.order.id,
    invoiceId: invoiceData.invoice.id
  };
}

// Get token from environment or command line
const token = process.env.SQUARE_ACCESS_TOKEN || process.argv[2];

if (!token) {
  console.error('Error: SQUARE_ACCESS_TOKEN not provided');
  console.error('Usage: SQUARE_ACCESS_TOKEN=xxx node scripts/create_village_pizza_invoice.js');
  console.error('   or: node scripts/create_village_pizza_invoice.js <token>');
  process.exit(1);
}

createInvoice(token).catch(console.error);
