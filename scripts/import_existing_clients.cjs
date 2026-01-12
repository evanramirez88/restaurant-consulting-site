#!/usr/bin/env node
/**
 * Import Existing Clients Script
 *
 * Imports client data from CSV to D1 and creates local storage structure on Seagate
 *
 * Usage:
 *   node scripts/import_existing_clients.cjs [--dry-run] [--local-only]
 *
 * Options:
 *   --dry-run     Preview changes without applying
 *   --local-only  Only create local storage structure, don't import to D1
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  csvPath: 'G:/My Drive/RG OPS/CLIENTS_AND_REPS/Clients-and-Client_Info/Client Info 12_25 - Sheet1.csv',
  clientFoldersPath: 'G:/My Drive/RG OPS/CLIENTS_AND_REPS/Clients-and-Client_Info/',
  localStorageRoot: 'D:/RG_CONSULTING_DATA',
  d1DatabaseId: 'eb39c9a2-24ed-426e-9260-a1fb55d899cb',
  d1DatabaseName: 'rg-consulting-forms',
};

// Parse arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const localOnly = args.includes('--local-only');

// Client data from CSV (pre-parsed since we know the structure)
const CLIENTS_DATA = [
  { name: '11 Circuit', address: '11 Circuit Ave', town: 'Oak Bluffs', state: 'MA', zip: '' },
  { name: 'ACK Goia', address: '302 Underpass Rd', town: 'Brewster', state: 'MA', zip: '' },
  { name: 'Auld Triangle', address: '412 Main St', town: 'Hyannis', state: 'MA', zip: '02601' },
  { name: 'Babes Pie Co.', address: '258 Kenyon Ave', town: 'Pawtucket', state: 'RI', zip: '' },
  { name: 'Baedega', address: '14 C Truro Center Rd', town: 'Truro', state: 'MA', zip: '', owner: 'Tracy Foley' },
  { name: 'Bella Costa Ristorante', address: '147 Cochituate Rd', town: 'Framingham', state: 'MA', zip: '' },
  { name: 'Betsy\'s Diner', address: '457 Main St', town: 'Falmouth', state: 'MA', zip: '', owner: 'Elizabeth Lovati' },
  { name: 'Brewery 44', address: '2 Montello St', town: 'Carver', state: 'MA', zip: '', owner: 'Michael King/Mary King' },
  { name: 'Cafe Heaven', address: '199 Commercial St Unit 10', town: 'Provincetown', state: 'MA', zip: '' },
  { name: 'Chach', address: '73 Shank Painter Rd', town: 'Provincetown', state: 'MA', zip: '' },
  { name: 'Chapins Fish & Chips', address: '228 Lower County Rd', town: 'Dennis Port', state: 'MA', zip: '' },
  { name: 'Colombo\'s Cafe & Pastries', address: '544 Main St', town: 'Hyannis', state: 'MA', zip: '', owner: 'William Pane' },
  { name: 'Cornerstones Pub & Grill', address: '2352 Cranberry Highway', town: 'Wareham', state: 'MA', zip: '', owner: 'Scott Hathway' },
  { name: 'Crown & Anchor', address: '247 Commercial St', town: 'Provincetown', state: 'MA', zip: '' },
  { name: 'Dillon\'s Local', address: '21 South Park Ave', town: 'Plymouth', state: 'MA', zip: '' },
  { name: 'Easy Street', address: '31 Easy St', town: 'Nantucket', state: 'MA', zip: '' },
  { name: 'Helltown Kitchen', address: '386 Commercial St', town: 'Provincetown', state: 'MA', zip: '' },
  { name: 'Joey\'s Bag O\' Donuts', address: '518 Route 28', town: 'Yarmouth', state: 'MA', zip: '' },
  { name: 'KKaties Burger Bar - Hyannis', address: '334 Main St', town: 'Hyannis', state: 'MA', zip: '' },
  { name: 'KKaties Burger Bar - Marshfield', address: '1899 Ocean St', town: 'Marshfield', state: 'MA', zip: '' },
  { name: 'KKaties Burger Bar - Plymouth', address: '9 Samoset St', town: 'Plymouth', state: 'MA', zip: '' },
  { name: 'KKaties Burger Bar Express - Plympton', address: '286 Main St', town: 'Plympton', state: 'MA', zip: '' },
  { name: 'KKaties Burger Bar Express - West Bridgewater', address: '3 South Main St', town: 'West Bridgewater', state: 'MA', zip: '' },
  { name: 'La Bella Cuenca', address: '372 Main St', town: 'Hyannis', state: 'MA', zip: '', owner: 'Edy/Erik/Rocio Acuapina' },
  { name: 'Lambert\'s Farm Market', address: '271 Cotuit Rd', town: 'Sandwich', state: 'MA', zip: '' },
  { name: 'Larry\'s PX', address: '1595 Main St', town: 'Chatham', state: 'MA', zip: '', owner: 'Varney Group' },
  { name: 'Liz\'s Cafe', address: '31 Bradford St', town: 'Provincetown', state: 'MA', zip: '' },
  { name: 'Local Grounds Coffee House & Cafe', address: '1370 Route 28', town: 'Cataumet', state: 'MA', zip: '' },
  { name: 'NorEast Beer Garden', address: '206 Commercial St', town: 'Provincetown', state: 'MA', zip: '' },
  { name: 'Oliver & Planck\'s Tavern', address: '960 Main St', town: 'Yarmouth Port', state: 'MA', zip: '' },
  { name: 'Perks Coffee Shop & Beer Garden', address: '545 Route 28', town: 'Harwich', state: 'MA', zip: '' },
  { name: 'Pete\'s Point', address: '430 Massachusetts 134', town: 'South Dennis', state: 'MA', zip: '' },
  { name: 'PPapa\'s Pizza Bar', address: '38 Main St Ext', town: 'Plymouth', state: 'MA', zip: '' },
  { name: 'RWND Restaurant & Arcade', address: '176 Main St', town: 'Wareham', state: 'MA', zip: '' },
  { name: 'Sailing Cow', address: '170 Old Wharf Rd', town: 'Dennis Port', state: 'MA', zip: '' },
  { name: 'Sand Dollar Bar & Grill', address: '50 East-West Dennis Rd', town: 'South Dennis', state: 'MA', zip: '' },
  { name: 'Sons of Erin', address: '633 Route 28', town: 'West Yarmouth', state: 'MA', zip: '' },
  { name: 'Terry Brennan\'s Central Tavern', address: '50 Route 134 Unit 1', town: 'Dennis', state: 'MA', zip: '' },
  { name: 'The Catman Cafe', address: '16 Old Colony Rd', town: 'Mansfield', state: 'MA', zip: '' },
  { name: 'VFW Wareham', address: '4 Gibbs Ball Park Rd', town: 'Onset', state: 'MA', zip: '' },
  { name: 'Victor\'s', address: '175 Bradford St Ext', town: 'Provincetown', state: 'MA', zip: '', owner: 'Victor DePoalo' },
  { name: 'Viet Crave', address: '375 Putnam Pike Suite #25', town: 'Smithfield', state: 'RI', zip: '', owner: 'David Tran/Christina Huynh' },
  { name: 'Village Pizza & Ice Cream', address: '760 Main Rd', town: 'Westport', state: 'MA', zip: '' },
  { name: 'Marshside', address: '28 Bridge St', town: 'East Dennis', state: 'MA', zip: '' },
];

// Helper functions
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

function generateId() {
  return 'client_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

function determineRegion(town, state) {
  if (state !== 'MA') return 'out_of_state';

  const capeCodTowns = [
    'Provincetown', 'Truro', 'Wellfleet', 'Eastham', // Outer Cape
    'Orleans', 'Brewster', 'Harwich', 'Chatham', 'Dennis', 'Dennis Port', 'South Dennis', 'East Dennis', // Lower Cape
    'Yarmouth', 'Yarmouth Port', 'West Yarmouth', 'Barnstable', 'Hyannis', // Mid Cape
    'Sandwich', 'Bourne', 'Falmouth', 'Mashpee', 'Cataumet' // Upper Cape
  ];

  const southShoreTowns = ['Plymouth', 'Marshfield', 'Duxbury', 'Kingston', 'Carver', 'Plympton', 'West Bridgewater', 'Wareham', 'Onset'];
  const islandsTowns = ['Nantucket', 'Oak Bluffs', 'Edgartown', 'Vineyard Haven'];

  if (capeCodTowns.includes(town)) return 'cape_cod';
  if (southShoreTowns.includes(town)) return 'south_shore';
  if (islandsTowns.includes(town)) return 'islands';
  return 'greater_boston';
}

function createLocalFolders(client) {
  const slug = generateSlug(client.name);
  const clientPath = path.join(CONFIG.localStorageRoot, 'clients', slug);

  const folders = [
    clientPath,
    path.join(clientPath, 'documents'),
    path.join(clientPath, 'research'),
    path.join(clientPath, 'menus'),
    path.join(clientPath, 'communications'),
  ];

  for (const folder of folders) {
    if (!fs.existsSync(folder)) {
      if (!isDryRun) {
        fs.mkdirSync(folder, { recursive: true });
      }
      console.log(`  📁 ${isDryRun ? '[DRY RUN] Would create' : 'Created'}: ${folder}`);
    }
  }

  // Create profile.json
  const profilePath = path.join(clientPath, 'profile.json');
  const profile = {
    ...client,
    slug,
    region: determineRegion(client.town, client.state),
    portal_enabled: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    d1_synced: false,
  };

  if (!isDryRun) {
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
  }
  console.log(`  📄 ${isDryRun ? '[DRY RUN] Would create' : 'Created'}: ${profilePath}`);

  return { slug, clientPath };
}

function generateD1InsertSQL(clients) {
  let sql = '-- Client Import - Generated ' + new Date().toISOString() + '\n\n';

  for (const client of clients) {
    const id = generateId();
    const slug = generateSlug(client.name);
    const region = determineRegion(client.town, client.state);

    // Escape single quotes
    const escapeName = (s) => s.replace(/'/g, "''");

    // Insert into clients table
    sql += `INSERT OR IGNORE INTO clients (id, email, name, company, phone, slug, portal_enabled, created_at, updated_at)
VALUES ('${id}', NULL, '${escapeName(client.owner || client.name)}', '${escapeName(client.name)}', NULL, '${slug}', 0, unixepoch(), unixepoch());\n`;

    // Insert into client_profiles table
    const fullAddress = `${client.address}, ${client.town}, ${client.state} ${client.zip}`.trim();
    sql += `INSERT OR IGNORE INTO client_profiles (id, client_id, pos_system, created_at, updated_at)
SELECT 'profile_' || '${id}', id, 'Toast', unixepoch(), unixepoch()
FROM clients WHERE slug = '${slug}';\n`;

    // Insert into restaurants table (restaurant location)
    sql += `INSERT OR IGNORE INTO restaurants (id, client_id, name, slug, address, city, state, zip, pos_system, is_primary, created_at, updated_at)
SELECT 'rest_' || '${id}', id, '${escapeName(client.name)}', '${slug}', '${escapeName(client.address)}', '${escapeName(client.town)}', '${client.state}', '${client.zip || ''}', 'toast', 1, unixepoch(), unixepoch()
FROM clients WHERE slug = '${slug}';\n\n`;
  }

  return sql;
}

// Main execution
async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   EXISTING CLIENT IMPORT SCRIPT');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN' : '🚀 LIVE'}`);
  console.log(`Local Only: ${localOnly ? 'Yes' : 'No'}`);
  console.log(`Clients to import: ${CLIENTS_DATA.length}`);
  console.log('───────────────────────────────────────────────────────\n');

  // Step 1: Create local storage structure
  console.log('📂 STEP 1: Creating Local Storage Structure...\n');

  // Ensure root directories exist
  const rootDirs = [
    CONFIG.localStorageRoot,
    path.join(CONFIG.localStorageRoot, 'clients'),
    path.join(CONFIG.localStorageRoot, 'leads'),
    path.join(CONFIG.localStorageRoot, 'leads', 'segments'),
    path.join(CONFIG.localStorageRoot, 'restaurant_research'),
    path.join(CONFIG.localStorageRoot, 'imports'),
    path.join(CONFIG.localStorageRoot, 'imports', 'pending'),
    path.join(CONFIG.localStorageRoot, 'imports', 'processing'),
    path.join(CONFIG.localStorageRoot, 'imports', 'completed'),
    path.join(CONFIG.localStorageRoot, 'imports', 'failed'),
    path.join(CONFIG.localStorageRoot, 'exports'),
    path.join(CONFIG.localStorageRoot, 'backups'),
    path.join(CONFIG.localStorageRoot, 'config'),
  ];

  for (const dir of rootDirs) {
    if (!fs.existsSync(dir)) {
      if (!isDryRun) {
        fs.mkdirSync(dir, { recursive: true });
      }
      console.log(`📁 ${isDryRun ? '[DRY RUN] Would create' : 'Created'}: ${dir}`);
    }
  }

  console.log('\n📂 Creating client folders...\n');

  const createdClients = [];
  for (const client of CLIENTS_DATA) {
    console.log(`\n🏪 ${client.name}`);
    const result = createLocalFolders(client);
    createdClients.push({ ...client, ...result });
  }

  // Create clients index
  const indexPath = path.join(CONFIG.localStorageRoot, 'clients', '_index.json');
  const index = {
    generated_at: new Date().toISOString(),
    total_clients: createdClients.length,
    clients: createdClients.map(c => ({
      name: c.name,
      slug: c.slug,
      town: c.town,
      state: c.state,
    })),
  };

  if (!isDryRun) {
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  }
  console.log(`\n📄 ${isDryRun ? '[DRY RUN] Would create' : 'Created'}: ${indexPath}`);

  // Step 2: Generate and execute D1 SQL
  if (!localOnly) {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('📊 STEP 2: Importing to Cloudflare D1...\n');

    const sql = generateD1InsertSQL(CLIENTS_DATA);
    const sqlPath = path.join(CONFIG.localStorageRoot, 'imports', 'client_import_' + Date.now() + '.sql');

    if (!isDryRun) {
      fs.writeFileSync(sqlPath, sql);
      console.log(`📄 SQL file created: ${sqlPath}`);

      console.log('\n🚀 Executing D1 import...');
      try {
        const result = execSync(
          `npx wrangler d1 execute ${CONFIG.d1DatabaseName} --remote --file="${sqlPath}"`,
          {
            cwd: path.join(__dirname, '..'),
            encoding: 'utf-8',
            maxBuffer: 50 * 1024 * 1024,
          }
        );
        console.log(result);
        console.log('✅ D1 import completed successfully!');
      } catch (error) {
        console.error('❌ D1 import failed:', error.message);
        if (error.stdout) console.log(error.stdout);
        if (error.stderr) console.error(error.stderr);
      }
    } else {
      console.log('[DRY RUN] Would create SQL file and execute D1 import');
      console.log('\nPreview SQL (first 2000 chars):');
      console.log(sql.substring(0, 2000) + '...');
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   IMPORT SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total clients: ${CLIENTS_DATA.length}`);
  console.log(`Local storage: ${CONFIG.localStorageRoot}`);
  console.log(`D1 database: ${CONFIG.d1DatabaseName}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes made)' : 'LIVE'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Region breakdown
  const regionCounts = {};
  for (const client of CLIENTS_DATA) {
    const region = determineRegion(client.town, client.state);
    regionCounts[region] = (regionCounts[region] || 0) + 1;
  }
  console.log('Region breakdown:');
  for (const [region, count] of Object.entries(regionCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${region}: ${count}`);
  }
}

main().catch(console.error);
