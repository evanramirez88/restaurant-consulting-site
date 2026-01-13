const https = require('https');

// HubSpot API configuration - read from environment or command line
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY || process.argv[2];

if (!HUBSPOT_API_KEY) {
  console.error('Error: HUBSPOT_API_KEY required');
  console.error('Usage: HUBSPOT_API_KEY=xxx node scripts/test_hubspot.cjs');
  console.error('   or: node scripts/test_hubspot.cjs <api_key>');
  process.exit(1);
}

function hubspotRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.hubapi.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('HUBSPOT API CONNECTIVITY TEST');
  console.log('='.repeat(60));
  console.log('');

  // 1. Test basic connectivity - get account info
  console.log('1. Testing API Connectivity...');
  try {
    const accountInfo = await hubspotRequest('GET', '/account-info/v3/api-usage/daily/private-apps');
    if (accountInfo.status === 200) {
      console.log('   [OK] API connection successful');
    } else {
      console.log(`   [WARN] Status: ${accountInfo.status}`);
    }
  } catch (e) {
    console.log(`   [ERROR] ${e.message}`);
  }

  // 2. Count total contacts
  console.log('');
  console.log('2. Counting Total Contacts...');
  try {
    const contacts = await hubspotRequest('POST', '/crm/v3/objects/contacts/search', {
      filterGroups: [],
      limit: 1
    });
    if (contacts.status === 200) {
      console.log(`   [OK] Total contacts: ${contacts.data.total}`);
    } else {
      console.log(`   [ERROR] Status: ${contacts.status}`, contacts.data);
    }
  } catch (e) {
    console.log(`   [ERROR] ${e.message}`);
  }

  // 3. List custom properties starting with rg_
  console.log('');
  console.log('3. Custom Properties (rg_* prefix)...');
  try {
    const props = await hubspotRequest('GET', '/crm/v3/properties/contacts');
    if (props.status === 200) {
      const rgProps = props.data.results.filter(p => p.name.startsWith('rg_'));
      console.log(`   [OK] Found ${rgProps.length} properties with rg_ prefix:`);
      rgProps.forEach(p => {
        console.log(`        - ${p.name} (${p.type}): ${p.label}`);
      });
    } else {
      console.log(`   [ERROR] Status: ${props.status}`, props.data);
    }
  } catch (e) {
    console.log(`   [ERROR] ${e.message}`);
  }

  // 4. Check for d1_lead_id and d1_synced_at properties
  console.log('');
  console.log('4. Checking D1 Sync Properties...');
  try {
    const props = await hubspotRequest('GET', '/crm/v3/properties/contacts');
    if (props.status === 200) {
      const d1LeadId = props.data.results.find(p => p.name === 'd1_lead_id');
      const d1SyncedAt = props.data.results.find(p => p.name === 'd1_synced_at');
      
      if (d1LeadId) {
        console.log(`   [OK] d1_lead_id exists (${d1LeadId.type}): ${d1LeadId.label}`);
      } else {
        console.log('   [MISSING] d1_lead_id property NOT found');
      }
      
      if (d1SyncedAt) {
        console.log(`   [OK] d1_synced_at exists (${d1SyncedAt.type}): ${d1SyncedAt.label}`);
      } else {
        console.log('   [MISSING] d1_synced_at property NOT found');
      }
    } else {
      console.log(`   [ERROR] Status: ${props.status}`, props.data);
    }
  } catch (e) {
    console.log(`   [ERROR] ${e.message}`);
  }

  // 5. Count contacts with email addresses
  console.log('');
  console.log('5. Contacts with Email Addresses...');
  try {
    const withEmail = await hubspotRequest('POST', '/crm/v3/objects/contacts/search', {
      filterGroups: [{
        filters: [{
          propertyName: 'email',
          operator: 'HAS_PROPERTY'
        }]
      }],
      limit: 1
    });
    if (withEmail.status === 200) {
      console.log(`   [OK] Contacts with email: ${withEmail.data.total}`);
    } else {
      console.log(`   [ERROR] Status: ${withEmail.status}`, withEmail.data);
    }
  } catch (e) {
    console.log(`   [ERROR] ${e.message}`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error);
