// Setup HubSpot Custom Properties for Lead Segmentation
// Run with: node scripts/setup_hubspot_properties.cjs

const https = require('https');

// API key should be passed as environment variable or command line argument
// Usage: HUBSPOT_API_KEY=your_key node scripts/setup_hubspot_properties.cjs
// Or: node scripts/setup_hubspot_properties.cjs --key your_key

const keyArgIndex = process.argv.indexOf('--key');
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY ||
                        (keyArgIndex !== -1 ? process.argv[keyArgIndex + 1] : null);

if (!HUBSPOT_API_KEY) {
  console.error('Error: HubSpot API key required.');
  console.error('Usage: HUBSPOT_API_KEY=your_key node scripts/setup_hubspot_properties.cjs');
  console.error('   Or: node scripts/setup_hubspot_properties.cjs --key your_key');
  process.exit(1);
}

const properties = [
  {
    name: 'rg_segment',
    label: 'RG Segment',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'contactinformation',
    description: 'Lead segment classification (A=Switcher, B=Toast Optimizer, C=Transition, D=Local Network)',
    options: [
      { label: 'A - POS Switcher', value: 'A', displayOrder: 1 },
      { label: 'B - Toast Optimizer', value: 'B', displayOrder: 2 },
      { label: 'C - Transition/New Owner', value: 'C', displayOrder: 3 },
      { label: 'D - Local Network', value: 'D', displayOrder: 4 }
    ]
  },
  {
    name: 'rg_door',
    label: 'RG Door',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'contactinformation',
    description: 'Service lane (National Remote or Local Regional)',
    options: [
      { label: 'National Remote', value: 'national_remote', displayOrder: 1 },
      { label: 'Local Regional', value: 'local_regional', displayOrder: 2 }
    ]
  },
  {
    name: 'rg_current_pos',
    label: 'Current POS System',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'contactinformation',
    description: 'Current point of sale system in use',
    options: [
      { label: 'Toast', value: 'toast', displayOrder: 1 },
      { label: 'Clover', value: 'clover', displayOrder: 2 },
      { label: 'Square', value: 'square', displayOrder: 3 },
      { label: 'Lightspeed', value: 'lightspeed', displayOrder: 4 },
      { label: 'Upserve', value: 'upserve', displayOrder: 5 },
      { label: 'Harbortouch', value: 'harbortouch', displayOrder: 6 },
      { label: 'TouchBistro', value: 'touchbistro', displayOrder: 7 },
      { label: 'Micros', value: 'micros', displayOrder: 8 },
      { label: 'Other', value: 'other', displayOrder: 9 },
      { label: 'Unknown', value: 'unknown', displayOrder: 10 }
    ]
  },
  {
    name: 'rg_urgency_window',
    label: 'Urgency Window',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'contactinformation',
    description: 'Decision timeline',
    options: [
      { label: 'Now (Immediate)', value: 'now', displayOrder: 1 },
      { label: '30-60 Days', value: '30-60', displayOrder: 2 },
      { label: '90+ Days', value: '90+', displayOrder: 3 }
    ]
  },
  {
    name: 'rg_ownership_change',
    label: 'Ownership Change',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'contactinformation',
    description: 'Is there a pending or recent ownership change?',
    options: [
      { label: 'Yes', value: 'yes', displayOrder: 1 },
      { label: 'No', value: 'no', displayOrder: 2 },
      { label: 'Unknown', value: 'unknown', displayOrder: 3 }
    ]
  },
  {
    name: 'rg_primary_pain',
    label: 'Primary Pain Point',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'contactinformation',
    description: 'Main challenge or need',
    options: [
      { label: 'POS Migration', value: 'migration', displayOrder: 1 },
      { label: 'Support Issues', value: 'support', displayOrder: 2 },
      { label: 'Menu Configuration', value: 'menu', displayOrder: 3 },
      { label: 'Network/Infrastructure', value: 'network', displayOrder: 4 },
      { label: 'Ownership Transition', value: 'transition', displayOrder: 5 }
    ]
  },
  {
    name: 'rg_lead_score',
    label: 'RG Lead Score',
    type: 'number',
    fieldType: 'number',
    groupName: 'contactinformation',
    description: 'Lead score from 0-100 based on fit, urgency, pain, and access'
  },
  {
    name: 'rg_source_file',
    label: 'RG Source File',
    type: 'string',
    fieldType: 'text',
    groupName: 'contactinformation',
    description: 'Original BuiltWith CSV file this lead came from'
  }
];

function createProperty(property) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(property);

    const options = {
      hostname: 'api.hubapi.com',
      port: 443,
      path: '/crm/v3/properties/contacts',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          resolve({ success: true, property: property.name });
        } else if (res.statusCode === 409) {
          // Property already exists
          resolve({ success: true, property: property.name, exists: true });
        } else {
          resolve({
            success: false,
            property: property.name,
            status: res.statusCode,
            error: responseData
          });
        }
      });
    });

    req.on('error', (e) => {
      reject({ success: false, property: property.name, error: e.message });
    });

    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Setting up HubSpot custom properties for R&G Consulting...\n');

  for (const property of properties) {
    try {
      const result = await createProperty(property);
      if (result.success) {
        if (result.exists) {
          console.log(`  ⚠ ${property.label} (${property.name}) - already exists`);
        } else {
          console.log(`  ✓ ${property.label} (${property.name}) - created`);
        }
      } else {
        console.log(`  ✗ ${property.label} (${property.name}) - failed`);
        console.log(`    Status: ${result.status}`);
        console.log(`    Error: ${result.error}`);
      }
    } catch (err) {
      console.log(`  ✗ ${property.label} - error: ${err.error || err.message}`);
    }
  }

  console.log('\nDone!');
}

main();
