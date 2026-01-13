const https = require('https');

// HubSpot API configuration - read from environment or command line
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY || process.argv[2];

if (!HUBSPOT_API_KEY) {
  console.error('Error: HUBSPOT_API_KEY required');
  console.error('Usage: HUBSPOT_API_KEY=xxx node scripts/create_hubspot_sync_properties.cjs');
  console.error('   or: node scripts/create_hubspot_sync_properties.cjs <api_key>');
  process.exit(1);
}

async function createProperty(propertyData) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(propertyData);
    
    const options = {
      hostname: 'api.hubapi.com',
      port: 443,
      path: '/crm/v3/properties/contacts',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 201) {
          console.log(`Created: ${propertyData.name}`);
          resolve(JSON.parse(body));
        } else if (res.statusCode === 409) {
          console.log(`Already exists: ${propertyData.name}`);
          resolve({ exists: true });
        } else {
          console.log(`Failed: ${propertyData.name} - ${res.statusCode}: ${body}`);
          reject(new Error(body));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Creating HubSpot sync properties...\n');

  const properties = [
    {
      name: 'd1_lead_id',
      label: 'D1 Lead ID',
      type: 'string',
      fieldType: 'text',
      groupName: 'contactinformation',
      description: 'Platform sync ID linking to D1 restaurant_leads table'
    },
    {
      name: 'd1_synced_at',
      label: 'D1 Synced At',
      type: 'datetime',
      fieldType: 'date',
      groupName: 'contactinformation',
      description: 'Last sync timestamp with D1 database'
    },
    {
      name: 'square_customer_id',
      label: 'Square Customer ID',
      type: 'string',
      fieldType: 'text',
      groupName: 'contactinformation',
      description: 'Square payment platform customer ID'
    }
  ];

  for (const prop of properties) {
    try {
      await createProperty(prop);
    } catch (error) {
      console.error(`Error creating ${prop.name}:`, error.message);
    }
  }

  console.log('\nDone!');
}

main();
