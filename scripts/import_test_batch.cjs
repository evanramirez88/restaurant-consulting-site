/**
 * Import Test Batch - 100 Leads for Email Testing
 *
 * Selects the top 100 leads from cleaned data for Resend free tier testing.
 * Prioritizes leads with email + phone (contactable).
 *
 * Usage: node scripts/import_test_batch.cjs [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parse } = require('csv-parse/sync');

const CONFIG = {
  // Source from local Seagate storage
  sourceFile: 'D:/rg_data/leads/cleaned/CLEAN_seg_high_value_2026-01-22.csv',
  fallbackFile: 'D:/rg_data/leads/cleaned/CLEAN_seg_contactable_2026-01-22.csv',
  d1Database: 'rg-consulting-forms',
  batchSize: 100,
  localOutputDir: 'D:/rg_data/sync/d1_export'
};

function loadLeads(filePath) {
  console.log(`Loading leads from ${filePath}...`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true });
  console.log(`  Loaded ${records.length} records`);
  return records;
}

function selectBestLeads(leads, count) {
  console.log(`\nSelecting top ${count} leads...`);

  // Filter for leads with email (required for testing)
  const withEmail = leads.filter(l => l.email && l.email.includes('@'));
  console.log(`  With valid email: ${withEmail.length}`);

  // Sort by lead_score descending
  withEmail.sort((a, b) => (parseInt(b.lead_score) || 0) - (parseInt(a.lead_score) || 0));

  // Take top N
  const selected = withEmail.slice(0, count);

  console.log(`  Selected ${selected.length} leads`);
  console.log(`  Score range: ${selected[selected.length-1]?.lead_score || 0} - ${selected[0]?.lead_score || 0}`);

  return selected;
}

async function importToD1(leads, dryRun = false) {
  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Importing ${leads.length} leads to D1...`);

  // Build SQL INSERT
  const values = leads.map(l => {
    const id = `lead_${l.domain.replace(/[^a-z0-9]/g, '_')}`;
    const escapedName = (l.name || '').replace(/'/g, "''");
    const escapedCity = (l.city || '').replace(/'/g, "''");

    return `('${id}', '${l.domain}', '${escapedName}', '${escapedCity}', '${l.state || ''}', '${l.zip || ''}', 'US', '${l.email || ''}', '${l.phone || ''}', '${l.current_pos || ''}', ${l.lead_score || 0}, '${l.cuisine || ''}', 'builtwith', 'test_batch_100')`;
  }).join(',\n');

  const sql = `INSERT OR REPLACE INTO restaurant_leads (id, domain, name, city, state, zip, country, primary_email, primary_phone, current_pos, lead_score, cuisine_primary, source, source_file) VALUES\n${values};`;

  // Save SQL file
  const sqlFile = path.join(CONFIG.localOutputDir, 'test_batch_100.sql');
  fs.mkdirSync(path.dirname(sqlFile), { recursive: true });
  fs.writeFileSync(sqlFile, sql);
  console.log(`  SQL file saved: ${sqlFile}`);

  if (dryRun) {
    console.log('  [DRY RUN] Would execute SQL against D1');
    return;
  }

  try {
    execSync(`npx wrangler d1 execute ${CONFIG.d1Database} --remote --file="${sqlFile}"`, {
      cwd: 'D:\\USER_DATA\\Desktop\\BUSI_GRAVITY\\BUSINESS_WEBSITE\\restaurant-consulting-site',
      stdio: 'inherit'
    });
    console.log(`  Successfully imported ${leads.length} leads to D1`);
  } catch (err) {
    console.error(`  Error importing to D1: ${err.message}`);
  }
}

async function createEmailSubscribers(leads, dryRun = false) {
  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Creating email subscribers...`);

  // Assign segments based on POS
  const values = leads.map(l => {
    const id = `sub_${l.domain.replace(/[^a-z0-9]/g, '_')}`;
    const escapedName = (l.name || '').replace(/'/g, "''").substring(0, 50);
    const firstName = escapedName.split(' ')[0] || 'Restaurant';

    // Determine segment
    let segment = 'B'; // Default: Toast existing
    if (l.current_pos === 'Clover' || l.current_pos === 'Square' || l.current_pos === 'Upserve' || l.current_pos === 'Lightspeed') {
      segment = 'A'; // Switcher
    } else if (l.current_pos === 'Toast (upcoming)') {
      segment = 'C'; // New implementation
    }

    return `('${id}', '${l.email}', '${firstName}', '${escapedName}', 'active', '${segment}', 'builtwith', '${new Date().toISOString()}')`;
  }).join(',\n');

  const sql = `INSERT OR REPLACE INTO email_subscribers (id, email, first_name, company, status, segment, source, created_at) VALUES\n${values};`;

  const sqlFile = path.join(CONFIG.localOutputDir, 'test_batch_subscribers.sql');
  fs.writeFileSync(sqlFile, sql);
  console.log(`  SQL file saved: ${sqlFile}`);

  if (dryRun) {
    console.log('  [DRY RUN] Would execute SQL against D1');
    return;
  }

  try {
    execSync(`npx wrangler d1 execute ${CONFIG.d1Database} --remote --file="${sqlFile}"`, {
      cwd: 'D:\\USER_DATA\\Desktop\\BUSI_GRAVITY\\BUSINESS_WEBSITE\\restaurant-consulting-site',
      stdio: 'inherit'
    });
    console.log(`  Successfully created ${leads.length} email subscribers`);
  } catch (err) {
    console.error(`  Error creating subscribers: ${err.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('========================================');
  console.log('IMPORT TEST BATCH - 100 LEADS');
  console.log('For Resend Free Tier Email Testing');
  console.log('========================================\n');

  // Load leads
  let leads;
  if (fs.existsSync(CONFIG.sourceFile)) {
    leads = loadLeads(CONFIG.sourceFile);
  } else if (fs.existsSync(CONFIG.fallbackFile)) {
    leads = loadLeads(CONFIG.fallbackFile);
  } else {
    console.error('No source file found!');
    process.exit(1);
  }

  // Select best 100
  const selected = selectBestLeads(leads, CONFIG.batchSize);

  // Show sample
  console.log('\nSample of selected leads:');
  selected.slice(0, 5).forEach((l, i) => {
    console.log(`  ${i+1}. ${l.name || l.domain} (${l.current_pos}) - Score: ${l.lead_score}`);
  });

  // Summary by segment
  const byPOS = {};
  selected.forEach(l => {
    byPOS[l.current_pos] = (byPOS[l.current_pos] || 0) + 1;
  });
  console.log('\nBy POS:');
  Object.entries(byPOS).forEach(([pos, count]) => {
    console.log(`  ${pos}: ${count}`);
  });

  // Import to D1
  await importToD1(selected, dryRun);

  // Create email subscribers
  await createEmailSubscribers(selected, dryRun);

  // Save selected list locally
  const selectedFile = path.join(CONFIG.localOutputDir, 'test_batch_100_selected.json');
  fs.writeFileSync(selectedFile, JSON.stringify(selected, null, 2));
  console.log(`\nSelected leads saved: ${selectedFile}`);

  console.log('\n========================================');
  console.log('COMPLETE');
  console.log('========================================');
  console.log(`\nNext steps:`);
  console.log(`1. Verify in Admin Portal: /admin → Email → Subscribers`);
  console.log(`2. Create test sequence with 1-2 emails`);
  console.log(`3. Enroll batch and monitor (100 emails/day limit)`);
}

main().catch(console.error);
