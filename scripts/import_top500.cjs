/**
 * Import Top 500 Contactable Leads to D1 Database
 *
 * Run with: node scripts/import_top500.cjs [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parse } = require('csv-parse/sync');

const CONFIG = {
  inputFile: 'G:/My Drive/RG OPS/70_LEADS/71_BUILTWITH_LEADS/top500_contactable.csv',
  d1Database: 'rg-consulting-forms',
  batchSize: 50,
  projectDir: 'C:\\Users\\evanr\\projects\\restaurant-consulting-site'
};

function escapeSql(str) {
  if (!str) return '';
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

function generateId(domain) {
  return 'lead_' + domain.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('========================================');
  console.log('TOP 500 CONTACTABLE LEADS IMPORT');
  console.log('========================================\n');

  // Read CSV
  console.log(`Reading ${CONFIG.inputFile}...`);
  const content = fs.readFileSync(CONFIG.inputFile, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true
  });

  console.log(`Found ${records.length} records\n`);

  // Process records into leads
  const leads = records.map(record => ({
    id: generateId(record.domain || ''),
    domain: (record.domain || '').toLowerCase().trim(),
    name: record.Company || null,
    city: record.City || null,
    state: record.state_norm || null,
    zip: record.Zip || null,
    country: record.country_norm || 'US',
    primary_email: record.primary_email || null,
    primary_phone: record.primary_phone || null,
    current_pos: (record.providers || '').split(';')[0] || null, // Take first provider
    lead_score: parseInt(record.lead_score) || 0,
    source: 'builtwith',
    source_file: 'top500_contactable.csv',
    status: 'prospect',
    tags: JSON.stringify(['top500', 'contactable', 'high_quality'])
  }));

  console.log(`Prepared ${leads.length} leads for import\n`);

  if (dryRun) {
    console.log('[DRY RUN MODE - No changes will be made]\n');
    console.log('Sample leads:');
    leads.slice(0, 5).forEach((lead, i) => {
      console.log(`  ${i+1}. ${lead.name || lead.domain} (${lead.state}) - ${lead.current_pos} - Score: ${lead.lead_score}`);
    });
    return;
  }

  // Import in batches
  let imported = 0;
  let errors = 0;

  for (let i = 0; i < leads.length; i += CONFIG.batchSize) {
    const batch = leads.slice(i, i + CONFIG.batchSize);

    const values = batch.map(l => {
      return `('${escapeSql(l.id)}', '${escapeSql(l.domain)}', '${escapeSql(l.name)}', '${escapeSql(l.city)}', '${escapeSql(l.state)}', '${escapeSql(l.zip)}', '${escapeSql(l.country)}', '${escapeSql(l.primary_email)}', '${escapeSql(l.primary_phone)}', '${escapeSql(l.current_pos)}', ${l.lead_score}, '${escapeSql(l.source)}', '${escapeSql(l.source_file)}', '${escapeSql(l.status)}', '${escapeSql(l.tags)}')`;
    }).join(',\n');

    const sql = `INSERT OR REPLACE INTO restaurant_leads
(id, domain, name, city, state, zip, country, primary_email, primary_phone, current_pos, lead_score, source, source_file, status, tags)
VALUES ${values};`;

    try {
      const sqlFile = path.join(CONFIG.projectDir, 'data', 'batch_import_temp.sql');
      fs.mkdirSync(path.dirname(sqlFile), { recursive: true });
      fs.writeFileSync(sqlFile, sql);

      execSync(`npx wrangler d1 execute ${CONFIG.d1Database} --remote --file=${sqlFile}`, {
        cwd: CONFIG.projectDir,
        stdio: 'pipe'
      });

      imported += batch.length;
      fs.unlinkSync(sqlFile); // Clean up
    } catch (err) {
      errors += batch.length;
      console.error(`  Error in batch ${i}-${i + CONFIG.batchSize}: ${err.message}`);
    }

    // Progress
    if ((i + CONFIG.batchSize) % 100 === 0 || i + CONFIG.batchSize >= leads.length) {
      console.log(`  Progress: ${Math.min(i + CONFIG.batchSize, leads.length)}/${leads.length}`);
    }
  }

  console.log('\n========================================');
  console.log('IMPORT COMPLETE');
  console.log('========================================');
  console.log(`  Imported: ${imported}`);
  console.log(`  Errors: ${errors}`);
  console.log('\nNext steps:');
  console.log('  1. View leads in Admin Dashboard → Prospects tab');
  console.log('  2. Start email sequences via /api/email/enroll');
  console.log('  3. Sync to HubSpot via /api/sync/hubspot-contacts');
}

main().catch(console.error);
