// Lead Import Script for R&G Consulting
// Processes BuiltWith CSV files and imports to D1 email_subscribers
//
// Usage: node scripts/import_leads.cjs <csv_file> <segment> [--limit N] [--dry-run]
//
// Segments:
//   A - POS Switchers (Clover, Square, Lightspeed, etc.)
//   B - Toast Optimizers (existing Toast users)
//   C - Transitions (flagged for ownership change)
//   D - Local Network (Cape Cod + SE MA geo filter)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const csvFile = args[0];
const segment = args[1]?.toUpperCase();
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : null;
const dryRun = args.includes('--dry-run');

if (!csvFile || !segment || !['A', 'B', 'C', 'D'].includes(segment)) {
  console.log(`
Lead Import Script for R&G Consulting

Usage: node scripts/import_leads.cjs <csv_file> <segment> [--limit N] [--dry-run]

Segments:
  A - POS Switchers (Clover, Square, Lightspeed, etc.)
  B - Toast Optimizers (existing Toast users)
  C - Transitions (ownership change signals)
  D - Local Network (Cape Cod + SE MA)

Options:
  --limit N    Only import first N leads
  --dry-run    Parse and score without importing

Example:
  node scripts/import_leads.cjs "All-Live-Clover-WebSites.csv" A --limit 100
  node scripts/import_leads.cjs "All-Live-Toast-POS-WebSites.csv" B --dry-run
`);
  process.exit(1);
}

// Segment configurations
const SEGMENT_CONFIG = {
  A: {
    name: 'POS Switcher',
    sequence_id: 'seq_pos_switcher_001',
    door: 'national_remote',
    primary_pain: 'migration'
  },
  B: {
    name: 'Toast Optimizer',
    sequence_id: 'seq_toast_support_001',
    door: 'national_remote',
    primary_pain: 'support'
  },
  C: {
    name: 'Transition',
    sequence_id: 'seq_transition_001',
    door: 'national_remote',
    primary_pain: 'transition'
  },
  D: {
    name: 'Local Network',
    sequence_id: 'seq_local_network_001',
    door: 'local_regional',
    primary_pain: 'network'
  }
};

// Local territory for Segment D
const LOCAL_TERRITORIES = [
  // Cape Cod
  'Provincetown', 'Truro', 'Wellfleet', 'Eastham', 'Orleans', 'Brewster',
  'Chatham', 'Harwich', 'Dennis', 'Yarmouth', 'Barnstable', 'Hyannis',
  'Mashpee', 'Falmouth', 'Bourne', 'Sandwich',
  // South Shore
  'Plymouth', 'Wareham',
  // Southeastern MA
  'Fall River', 'New Bedford', 'Dartmouth', 'Fairhaven', 'Acushnet',
  'Freetown', 'Lakeville', 'Middleborough'
];

// Parse CSV file
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  // Skip compliance notice line if present
  let startLine = 0;
  if (lines[0].includes('Compliance Notice')) {
    startLine = 1;
  }

  const headers = parseCSVLine(lines[startLine]);
  const records = [];

  for (let i = startLine + 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= headers.length / 2) { // Allow some missing fields
      const record = {};
      headers.forEach((header, idx) => {
        record[header.toLowerCase().replace(/\s+/g, '_')] = values[idx] || '';
      });
      records.push(record);
    }
  }

  return records;
}

// Parse a single CSV line handling quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Extract email from record
function extractEmail(record) {
  const emailField = record.emails || record.email || '';
  // May contain multiple emails separated by semicolons
  const emails = emailField.split(';').map(e => e.trim()).filter(e => e.includes('@'));
  return emails[0] || null;
}

// Extract phone from record
function extractPhone(record) {
  const phoneField = record.telephones || record.telephone || record.phone || '';
  // Format: ph:+1-xxx-xxx-xxxx or similar
  const phones = phoneField.split(';').map(p => p.replace('ph:', '').trim()).filter(p => p);
  return phones[0] || null;
}

// Calculate lead score (0-100)
function calculateLeadScore(record, segment) {
  let score = 0;

  // Revenue potential (25 points)
  const revenue = parseInt(record.sales_revenue_usd?.replace(/[^0-9]/g, '') || '0');
  if (revenue > 1000000) score += 25;
  else if (revenue > 500000) score += 20;
  else if (revenue > 100000) score += 15;
  else if (revenue > 0) score += 10;

  // Employees (proxy for size) (15 points)
  const employees = parseInt(record.employees || '0');
  if (employees > 50) score += 15;
  else if (employees > 20) score += 12;
  else if (employees > 10) score += 8;
  else if (employees > 0) score += 5;

  // Has valid email (15 points)
  if (extractEmail(record)) score += 15;

  // Has phone (10 points)
  if (extractPhone(record)) score += 10;

  // Has company name (10 points)
  if (record.company && record.company.trim()) score += 10;

  // Geographic fit for segment D (15 points)
  if (segment === 'D') {
    const city = (record.city || '').toLowerCase();
    const state = (record.state || '').toUpperCase();
    if (state === 'MA' || state === 'RI') {
      if (LOCAL_TERRITORIES.some(t => city.includes(t.toLowerCase()))) {
        score += 15;
      } else {
        score += 5; // Still in region but not priority area
      }
    }
  } else {
    // For national segments, give points for being US-based
    if ((record.country || '').toUpperCase() === 'US') score += 10;
  }

  // Website presence (10 points)
  if (record.domain && record.domain.trim()) score += 10;

  return Math.min(score, 100);
}

// Determine POS system from file name or record
function determinePOS(record, fileName) {
  const fileNameLower = fileName.toLowerCase();

  if (fileNameLower.includes('toast')) return 'toast';
  if (fileNameLower.includes('clover')) return 'clover';
  if (fileNameLower.includes('square')) return 'square';
  if (fileNameLower.includes('lightspeed')) return 'lightspeed';
  if (fileNameLower.includes('upserve')) return 'upserve';
  if (fileNameLower.includes('harbortouch')) return 'harbortouch';
  if (fileNameLower.includes('micros')) return 'micros';

  return 'unknown';
}

// Generate SQL for inserting subscriber
function generateInsertSQL(lead, segment, sourceFile) {
  const config = SEGMENT_CONFIG[segment];
  const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Math.floor(Date.now() / 1000);

  const sql = `INSERT OR IGNORE INTO email_subscribers (
    id, email, first_name, last_name, company, phone, status, source,
    segment, door, current_pos, lead_score, primary_pain, source_file,
    city, state, country, website, created_at, updated_at
  ) VALUES (
    '${id}',
    '${(lead.email || '').replace(/'/g, "''")}',
    '${(lead.first_name || '').replace(/'/g, "''")}',
    '${(lead.last_name || '').replace(/'/g, "''")}',
    '${(lead.company || '').replace(/'/g, "''")}',
    '${(lead.phone || '').replace(/'/g, "''")}',
    'active',
    'builtwith_import',
    '${segment}',
    '${config.door}',
    '${lead.current_pos}',
    ${lead.lead_score},
    '${config.primary_pain}',
    '${sourceFile.replace(/'/g, "''")}',
    '${(lead.city || '').replace(/'/g, "''")}',
    '${(lead.state || '').replace(/'/g, "''")}',
    '${(lead.country || '').replace(/'/g, "''")}',
    '${(lead.domain || '').replace(/'/g, "''")}',
    ${now},
    ${now}
  );`;

  return sql;
}

// Main import function
async function importLeads() {
  console.log(`\n📥 Lead Import Script`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`File: ${path.basename(csvFile)}`);
  console.log(`Segment: ${segment} (${SEGMENT_CONFIG[segment].name})`);
  console.log(`Sequence: ${SEGMENT_CONFIG[segment].sequence_id}`);
  if (limit) console.log(`Limit: ${limit} records`);
  if (dryRun) console.log(`Mode: DRY RUN (no database writes)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Parse CSV
  console.log('📄 Parsing CSV file...');
  const records = parseCSV(csvFile);
  console.log(`   Found ${records.length} records\n`);

  // Process records
  const leads = [];
  let skipped = 0;

  for (const record of records) {
    const email = extractEmail(record);
    if (!email) {
      skipped++;
      continue;
    }

    // For segment D, filter by geography
    if (segment === 'D') {
      const state = (record.state || '').toUpperCase();
      if (state !== 'MA' && state !== 'RI') {
        skipped++;
        continue;
      }
    }

    const lead = {
      email,
      first_name: '', // BuiltWith doesn't have first names typically
      last_name: '',
      company: record.company || record.domain || '',
      phone: extractPhone(record),
      city: record.city || '',
      state: record.state || '',
      country: record.country || 'US',
      domain: record.domain || '',
      current_pos: determinePOS(record, csvFile),
      lead_score: calculateLeadScore(record, segment)
    };

    leads.push(lead);

    if (limit && leads.length >= limit) break;
  }

  console.log(`✅ Processed ${leads.length} valid leads (skipped ${skipped})\n`);

  // Score distribution
  const scoreRanges = {
    '80-100 (Hot)': leads.filter(l => l.lead_score >= 80).length,
    '60-79 (Warm)': leads.filter(l => l.lead_score >= 60 && l.lead_score < 80).length,
    '40-59 (Cool)': leads.filter(l => l.lead_score >= 40 && l.lead_score < 60).length,
    '0-39 (Cold)': leads.filter(l => l.lead_score < 40).length
  };

  console.log('📊 Lead Score Distribution:');
  for (const [range, count] of Object.entries(scoreRanges)) {
    const pct = ((count / leads.length) * 100).toFixed(1);
    console.log(`   ${range}: ${count} (${pct}%)`);
  }
  console.log('');

  if (dryRun) {
    console.log('🔍 DRY RUN - Sample leads:');
    leads.slice(0, 5).forEach((lead, i) => {
      console.log(`   ${i + 1}. ${lead.email} | ${lead.company} | Score: ${lead.lead_score}`);
    });
    console.log('\n✋ Dry run complete. No data was imported.');
    return;
  }

  // Import to D1
  console.log('💾 Importing to D1 database...\n');

  let imported = 0;
  let errors = 0;
  const batchSize = 50;
  const sourceFile = path.basename(csvFile);

  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    const sqls = batch.map(lead => generateInsertSQL(lead, segment, sourceFile));

    for (const sql of sqls) {
      try {
        execSync(
          `npx wrangler d1 execute rg-consulting-forms --remote --command "${sql.replace(/"/g, '\\"')}"`,
          { cwd: path.join(__dirname, '..'), stdio: 'pipe' }
        );
        imported++;
      } catch (err) {
        errors++;
      }
    }

    const progress = Math.min(i + batchSize, leads.length);
    process.stdout.write(`\r   Progress: ${progress}/${leads.length} (${imported} imported, ${errors} errors)`);
  }

  console.log(`\n\n✅ Import complete!`);
  console.log(`   Imported: ${imported}`);
  console.log(`   Errors: ${errors}`);
}

// Run
importLeads().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
