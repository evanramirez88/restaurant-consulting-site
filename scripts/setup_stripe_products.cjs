/**
 * Setup Stripe Products and Prices
 *
 * Creates Toast Guardian support plan products and prices in Stripe,
 * then updates the D1 database with the real price IDs.
 *
 * Usage: node scripts/setup_stripe_products.cjs
 *
 * Requires STRIPE_SECRET_KEY environment variable or --key flag
 */

const https = require('https');

// Get Stripe key from environment or command line
const args = process.argv.slice(2);
let stripeKey = process.env.STRIPE_SECRET_KEY;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--key' && args[i + 1]) {
    stripeKey = args[i + 1];
    break;
  }
}

if (!stripeKey) {
  console.error('Error: STRIPE_SECRET_KEY environment variable or --key flag required');
  console.error('Usage: node scripts/setup_stripe_products.cjs --key sk_live_xxx');
  process.exit(1);
}

// Product definitions based on Toast Guardian pricing
const products = [
  {
    name: 'Toast Guardian - Core',
    description: 'Essential Toast POS support for small restaurants. 5 hours/month included.',
    tier: 'core',
    prices: [
      { interval: 'month', amount: 35000 },      // $350/month
      { interval: 'month', amount: 105000, interval_count: 3 }, // $1,050/quarter
      { interval: 'year', amount: 385000 }       // $3,850/year (11 months)
    ]
  },
  {
    name: 'Toast Guardian - Professional',
    description: 'Enhanced Toast POS support for growing restaurants. 10 hours/month included.',
    tier: 'professional',
    prices: [
      { interval: 'month', amount: 50000 },      // $500/month
      { interval: 'month', amount: 150000, interval_count: 3 }, // $1,500/quarter
      { interval: 'year', amount: 550000 }       // $5,500/year (11 months)
    ]
  },
  {
    name: 'Toast Guardian - Premium',
    description: 'Priority Toast POS support for high-volume restaurants. 20 hours/month included.',
    tier: 'premium',
    prices: [
      { interval: 'month', amount: 80000 },      // $800/month
      { interval: 'month', amount: 240000, interval_count: 3 }, // $2,400/quarter
      { interval: 'year', amount: 880000 }       // $8,800/year (11 months)
    ]
  }
];

// Helper to make Stripe API requests
function stripeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.stripe.com',
      port: 443,
      path: `/v1${path}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(`Stripe API error: ${parsed.error?.message || body}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

// URL encode object for form data
function encodeFormData(obj, prefix = '') {
  const pairs = [];
  for (const key in obj) {
    if (obj[key] === undefined || obj[key] === null) continue;
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      pairs.push(encodeFormData(obj[key], fullKey));
    } else {
      pairs.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(obj[key])}`);
    }
  }
  return pairs.join('&');
}

async function createProduct(productDef) {
  console.log(`\nCreating product: ${productDef.name}`);

  // Create the product
  const productData = encodeFormData({
    name: productDef.name,
    description: productDef.description,
    'metadata[tier]': productDef.tier,
    'metadata[type]': 'support_plan'
  });

  const product = await stripeRequest('POST', '/products', productData);
  console.log(`  Product created: ${product.id}`);

  const prices = [];

  // Create prices for this product
  for (const priceDef of productDef.prices) {
    let billingInterval;
    if (priceDef.interval === 'year') {
      billingInterval = 'yearly';
    } else if (priceDef.interval_count === 3) {
      billingInterval = 'quarterly';
    } else {
      billingInterval = 'monthly';
    }

    const priceData = {
      product: product.id,
      currency: 'usd',
      unit_amount: priceDef.amount,
      'recurring[interval]': priceDef.interval,
      'metadata[tier]': productDef.tier,
      'metadata[billing_interval]': billingInterval
    };

    if (priceDef.interval_count) {
      priceData['recurring[interval_count]'] = priceDef.interval_count;
    }

    const price = await stripeRequest('POST', '/prices', encodeFormData(priceData));
    console.log(`  Price created (${billingInterval}): ${price.id} - $${priceDef.amount / 100}`);

    prices.push({
      id: price.id,
      tier: productDef.tier,
      billing_interval: billingInterval,
      amount: priceDef.amount
    });
  }

  return { product, prices };
}

async function main() {
  console.log('='.repeat(60));
  console.log('Toast Guardian - Stripe Products Setup');
  console.log('='.repeat(60));

  const allPrices = [];

  try {
    for (const productDef of products) {
      const result = await createProduct(productDef);
      allPrices.push(...result.prices);
    }

    console.log('\n' + '='.repeat(60));
    console.log('SETUP COMPLETE');
    console.log('='.repeat(60));

    console.log('\nSQL to update stripe_products table:\n');
    console.log('-- First, clear placeholder data');
    console.log('DELETE FROM stripe_products WHERE stripe_price_id LIKE \'%_TBD\';');
    console.log('');
    console.log('-- Insert real price IDs');

    for (const price of allPrices) {
      const amount = price.amount / 100;
      console.log(`INSERT INTO stripe_products (tier, billing_interval, stripe_price_id, price_cents, active) VALUES ('${price.tier}', '${price.billing_interval}', '${price.id}', ${price.amount}, 1);`);
    }

    console.log('\n-- Run this SQL with:');
    console.log('-- npx wrangler d1 execute rg-consulting-forms --remote --command="<SQL>"');

    // Output as JSON for easy reference
    console.log('\n\nPrice IDs JSON:');
    console.log(JSON.stringify(allPrices, null, 2));

  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

main();
