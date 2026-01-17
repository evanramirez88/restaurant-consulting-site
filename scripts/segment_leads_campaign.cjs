/**
 * Lead Segmentation Script for R&G Consulting
 *
 * Parses BuiltWith CSV files into campaign-ready segment batches
 * Based on RG_Sales_Marketing_Blueprint_v2.md strategy
 *
 * SEGMENTS:
 * - A: POS Conversion (Clover, Square, Lightspeed, Upserve, Harbortouch) - National Remote
 * - B: Toast Optimization (Toast existing + Toast upcoming) - National Remote
 * - C: Transitions (ownership change signals) - National + Local
 * - D: Local Infrastructure (MA, Cape Cod, SE MA) - Local Regional
 *
 * Usage:
 *   node scripts/segment_leads_campaign.cjs --stats     # Show statistics only
 *   node scripts/segment_leads_campaign.cjs --parse     # Parse and create batches
 *   node scripts/segment_leads_campaign.cjs --batch 500 # Create 500-lead batches
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SOURCE_DIR = 'G:/My Drive/RG OPS/70_LEADS/71_BUILTWITH_LEADS';
const OUTPUT_DIR = 'G:/My Drive/RG OPS/70_LEADS/CAMPAIGN_BATCHES';
const BATCH_SIZE = parseInt(process.argv.find(a => a.startsWith('--batch='))?.split('=')[1] || '500');

// Source file mapping to segments
const SOURCE_FILES = {
  // Segment A - POS Switchers (National Remote)
  'A_CLOVER': { file: 'All-Live-Clover-WebSites.csv', segment: 'A', pos: 'Clover', sequence: 'seq_pos_switcher_001' },
  'A_SQUARE': { file: 'All-Live-Square-Sites.csv', segment: 'A', pos: 'Square', sequence: 'seq_pos_switcher_001' },
  'A_LIGHTSPEED': { file: 'All-Live-Lightspeed-WebSites.csv', segment: 'A', pos: 'Lightspeed', sequence: 'seq_pos_switcher_001' },
  'A_UPSERVE': { file: 'All-Live-Upserve-WebSites.csv', segment: 'A', pos: 'Upserve', sequence: 'seq_pos_switcher_001' },
  'A_HARBORTOUCH': { file: 'All-Harbortouch-Sites.csv', segment: 'A', pos: 'Harbortouch', sequence: 'seq_pos_switcher_001' },

  // Segment B - Toast Optimizers (National Remote)
  'B_TOAST_EXISTING': { file: 'All-Live-Toast-POS-WebSites.csv', segment: 'B', pos: 'Toast', sequence: 'seq_toast_support_001', subtype: 'existing' },
  'B_TOAST_UPCOMING': { file: 'Toast-POS-websites-filter-Upcoming-implementations.csv', segment: 'B', pos: 'Toast', sequence: 'seq_toast_support_001', subtype: 'upcoming', priority: 'HIGH' }
};

// Geographic filters for Segment D
const SEGMENT_D_STATES = ['MA', 'RI'];
const CAPE_COD_CITIES = [
  'Provincetown', 'Truro', 'Wellfleet', 'Eastham', 'Orleans', 'Brewster',
  'Harwich', 'Chatham', 'Dennis', 'Yarmouth', 'Barnstable', 'Hyannis',
  'Mashpee', 'Falmouth', 'Bourne', 'Sandwich'
];
const SOUTH_SHORE_CITIES = ['Plymouth', 'Wareham', 'Kingston', 'Duxbury', 'Marshfield'];
const SE_MA_CITIES = ['Fall River', 'New Bedford', 'Taunton', 'Attleboro', 'Brockton'];

// Parse BuiltWith CSV (handles compliance notice row)
function parseBuiltWithCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`  File not found: ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Skip compliance notice (row 1), get headers (row 2)
  const headerLine = lines[1];
  if (!headerLine) return [];

  const headers = parseCSVLine(headerLine);
  const leads = [];

  // Parse data rows (row 3+)
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length < 5) continue;

    const lead = {};
    headers.forEach((header, idx) => {
      lead[header.toLowerCase().replace(/ /g, '_')] = values[idx] || '';
    });

    // Only include if has domain
    if (lead.domain) {
      leads.push(lead);
    }
  }

  return leads;
}

// Parse CSV line handling quoted fields
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

// Calculate lead score (0-100)
function calculateScore(lead) {
  let score = 0;

  // Has email (+30)
  if (lead.emails && lead.emails.length > 0) score += 30;

  // Has phone (+20)
  if (lead.telephones && lead.telephones.length > 0) score += 20;

  // US based (+10)
  if (lead.country === 'US') score += 10;

  // Has company name (+10)
  if (lead.company && lead.company.length > 0) score += 10;

  // Food & Drink vertical (+15)
  if (lead.vertical && lead.vertical.toLowerCase().includes('food')) score += 15;

  // Has employees data (+5)
  if (lead.employees && parseInt(lead.employees) > 0) score += 5;

  // Has revenue data (+10)
  if (lead.sales_revenue_usd && lead.sales_revenue_usd !== '') score += 10;

  return Math.min(score, 100);
}

// Determine if lead qualifies for Segment D (Local)
function isLocalLead(lead) {
  const state = (lead.state || '').toUpperCase();
  const city = (lead.city || '').toLowerCase();

  if (!SEGMENT_D_STATES.includes(state)) return false;

  // Check specific regions
  const allLocalCities = [...CAPE_COD_CITIES, ...SOUTH_SHORE_CITIES, ...SE_MA_CITIES]
    .map(c => c.toLowerCase());

  return allLocalCities.some(localCity => city.includes(localCity)) || state === 'MA';
}

// Get local region
function getLocalRegion(lead) {
  const city = (lead.city || '').toLowerCase();

  if (CAPE_COD_CITIES.some(c => city.includes(c.toLowerCase()))) return 'Cape Cod';
  if (SOUTH_SHORE_CITIES.some(c => city.includes(c.toLowerCase()))) return 'South Shore';
  if (SE_MA_CITIES.some(c => city.includes(c.toLowerCase()))) return 'Southeastern MA';
  return 'Other MA';
}

// Extract first email from emails field
function extractEmail(emailsField) {
  if (!emailsField) return '';
  const emails = emailsField.split(';');
  return emails[0] || '';
}

// Extract first phone from telephones field
function extractPhone(phonesField) {
  if (!phonesField) return '';
  const match = phonesField.match(/ph:([^;]+)/);
  return match ? match[1].trim() : '';
}

// Main processing
async function main() {
  const args = process.argv.slice(2);
  const statsOnly = args.includes('--stats');
  const doParse = args.includes('--parse') || args.includes('--batch');

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  R&G Consulting - Lead Segmentation for Campaign Batches');
  console.log('  Based on: RG_Sales_Marketing_Blueprint_v2.md');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Storage for all leads by segment
  const segments = {
    A: { leads: [], description: 'POS Switchers (Clover/Square/etc) - National Remote' },
    B: { leads: [], description: 'Toast Optimizers (existing + upcoming) - National Remote' },
    B_UPCOMING: { leads: [], description: 'Toast Upcoming Implementations - HIGH PRIORITY' },
    C: { leads: [], description: 'Ownership Transitions - National + Local' },
    D: { leads: [], description: 'Local Infrastructure (MA/Cape Cod/SE MA)' },
    D_CAPECOD: { leads: [], description: 'Cape Cod Specific' },
    D_SOUTHSHORE: { leads: [], description: 'South Shore Specific' },
    D_SEMA: { leads: [], description: 'Southeastern MA Specific' }
  };

  // Track all domains for deduplication
  const seenDomains = new Set();
  let totalRaw = 0;
  let totalDedupe = 0;

  console.log('PHASE 1: Reading source files...\n');

  // Process each source file
  for (const [key, config] of Object.entries(SOURCE_FILES)) {
    const filePath = path.join(SOURCE_DIR, config.file);
    console.log(`  Processing: ${config.file}`);

    const leads = parseBuiltWithCSV(filePath);
    totalRaw += leads.length;
    console.log(`    Raw records: ${leads.length}`);

    let added = 0;
    for (const lead of leads) {
      // Deduplicate by domain
      const domain = lead.domain?.toLowerCase();
      if (!domain || seenDomains.has(domain)) continue;
      seenDomains.add(domain);

      // Enrich lead with segment info
      lead.source_file = config.file;
      lead.current_pos = config.pos;
      lead.segment = config.segment;
      lead.sequence_id = config.sequence;
      lead.lead_score = calculateScore(lead);
      lead.primary_email = extractEmail(lead.emails);
      lead.primary_phone = extractPhone(lead.telephones);
      lead.door = 'national_remote';

      // Add to primary segment
      if (config.segment === 'A') {
        segments.A.leads.push(lead);
      } else if (config.segment === 'B') {
        segments.B.leads.push(lead);
        if (config.subtype === 'upcoming') {
          segments.B_UPCOMING.leads.push(lead);
        }
      }

      // Also check for Segment D (Local) overlay
      if (isLocalLead(lead)) {
        const localLead = { ...lead, door: 'local_regional', sequence_id: 'seq_local_network_001' };
        segments.D.leads.push(localLead);

        const region = getLocalRegion(lead);
        if (region === 'Cape Cod') segments.D_CAPECOD.leads.push(localLead);
        if (region === 'South Shore') segments.D_SOUTHSHORE.leads.push(localLead);
        if (region === 'Southeastern MA') segments.D_SEMA.leads.push(localLead);
      }

      added++;
    }

    totalDedupe += added;
    console.log(`    After dedupe: ${added}\n`);
  }

  // Calculate contactable (has email OR phone)
  const contactable = {
    A: segments.A.leads.filter(l => l.primary_email || l.primary_phone),
    B: segments.B.leads.filter(l => l.primary_email || l.primary_phone),
    D: segments.D.leads.filter(l => l.primary_email || l.primary_phone)
  };

  // High value (score >= 80)
  const highValue = {
    A: segments.A.leads.filter(l => l.lead_score >= 80),
    B: segments.B.leads.filter(l => l.lead_score >= 80),
    D: segments.D.leads.filter(l => l.lead_score >= 80)
  };

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  SEGMENT SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log(`  Total Raw Records: ${totalRaw.toLocaleString()}`);
  console.log(`  After Deduplication: ${totalDedupe.toLocaleString()}`);
  console.log('');

  console.log('  ┌─────────────────────────────────────────────────────────────────┐');
  console.log('  │ SEGMENT A: POS SWITCHERS (National Remote)                      │');
  console.log('  │ Angle: "The Outage Insurance" - Switch as risk mitigation       │');
  console.log('  │ Sequence: seq_pos_switcher_001                                  │');
  console.log('  ├─────────────────────────────────────────────────────────────────┤');
  console.log(`  │ Total:       ${segments.A.leads.length.toLocaleString().padStart(6)} leads                                     │`);
  console.log(`  │ Contactable: ${contactable.A.length.toLocaleString().padStart(6)} leads (has email or phone)               │`);
  console.log(`  │ High Value:  ${highValue.A.length.toLocaleString().padStart(6)} leads (score >= 80)                       │`);
  console.log('  │                                                                 │');
  console.log('  │ By POS System:                                                  │');
  const posCounts = {};
  segments.A.leads.forEach(l => { posCounts[l.current_pos] = (posCounts[l.current_pos] || 0) + 1; });
  Object.entries(posCounts).sort((a,b) => b[1] - a[1]).forEach(([pos, count]) => {
    console.log(`  │   ${pos.padEnd(12)} ${count.toLocaleString().padStart(6)} leads                                 │`);
  });
  console.log('  └─────────────────────────────────────────────────────────────────┘\n');

  console.log('  ┌─────────────────────────────────────────────────────────────────┐');
  console.log('  │ SEGMENT B: TOAST OPTIMIZERS (National Remote)                   │');
  console.log('  │ Angle: "The 7-Minute Menu Teardown" - Show ROI fixes            │');
  console.log('  │ Sequence: seq_toast_support_001                                 │');
  console.log('  ├─────────────────────────────────────────────────────────────────┤');
  console.log(`  │ Total:       ${segments.B.leads.length.toLocaleString().padStart(6)} leads                                     │`);
  console.log(`  │ Contactable: ${contactable.B.length.toLocaleString().padStart(6)} leads (has email or phone)               │`);
  console.log(`  │ High Value:  ${highValue.B.length.toLocaleString().padStart(6)} leads (score >= 80)                       │`);
  console.log('  │                                                                 │');
  console.log(`  │ ★ UPCOMING:  ${segments.B_UPCOMING.leads.length.toLocaleString().padStart(6)} leads (HIGH PRIORITY - need support NOW)  │`);
  console.log('  └─────────────────────────────────────────────────────────────────┘\n');

  console.log('  ┌─────────────────────────────────────────────────────────────────┐');
  console.log('  │ SEGMENT D: LOCAL INFRASTRUCTURE (Cape Cod + SE MA)              │');
  console.log('  │ Angle: "I build for kitchens, not cubicles"                     │');
  console.log('  │ Sequence: seq_local_network_001                                 │');
  console.log('  ├─────────────────────────────────────────────────────────────────┤');
  console.log(`  │ Total MA:        ${segments.D.leads.length.toLocaleString().padStart(5)} leads                                  │`);
  console.log(`  │ Contactable:     ${contactable.D.length.toLocaleString().padStart(5)} leads                                  │`);
  console.log(`  │ High Value:      ${highValue.D.length.toLocaleString().padStart(5)} leads                                  │`);
  console.log('  │                                                                 │');
  console.log(`  │ Cape Cod:        ${segments.D_CAPECOD.leads.length.toLocaleString().padStart(5)} leads                                  │`);
  console.log(`  │ South Shore:     ${segments.D_SOUTHSHORE.leads.length.toLocaleString().padStart(5)} leads                                  │`);
  console.log(`  │ Southeastern MA: ${segments.D_SEMA.leads.length.toLocaleString().padStart(5)} leads                                  │`);
  console.log('  └─────────────────────────────────────────────────────────────────┘\n');

  if (statsOnly) {
    console.log('  Run with --parse to create campaign batch files.\n');
    return;
  }

  if (!doParse) {
    console.log('  Run with --parse to create campaign batch files.');
    console.log('  Run with --batch=500 to specify batch size (default 500).\n');
    return;
  }

  // Create output directory
  const timestamp = new Date().toISOString().split('T')[0];
  const batchDir = path.join(OUTPUT_DIR, `campaign_${timestamp}`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  if (!fs.existsSync(batchDir)) {
    fs.mkdirSync(batchDir, { recursive: true });
  }

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  PHASE 2: Creating Campaign Batch Files');
  console.log(`  Batch Size: ${BATCH_SIZE} leads per file`);
  console.log(`  Output: ${batchDir}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // CSV header for output files
  const outputHeaders = [
    'domain', 'company', 'city', 'state', 'zip', 'country',
    'primary_email', 'primary_phone', 'current_pos', 'segment', 'door',
    'sequence_id', 'lead_score', 'vertical', 'employees', 'source_file'
  ];

  function writeBatches(leads, prefix, description) {
    if (leads.length === 0) {
      console.log(`  ${prefix}: No leads to write`);
      return;
    }

    // Sort by score descending
    leads.sort((a, b) => b.lead_score - a.lead_score);

    const batches = [];
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      batches.push(leads.slice(i, i + BATCH_SIZE));
    }

    console.log(`  ${prefix}: ${leads.length} leads → ${batches.length} batch(es)`);

    batches.forEach((batch, idx) => {
      const filename = `${prefix}_batch_${String(idx + 1).padStart(2, '0')}_of_${batches.length}.csv`;
      const filepath = path.join(batchDir, filename);

      const rows = [outputHeaders.join(',')];
      batch.forEach(lead => {
        const row = outputHeaders.map(h => {
          let val = lead[h];
          // Convert to string
          if (val === null || val === undefined) val = '';
          if (typeof val !== 'string') val = String(val);
          // Escape commas and quotes
          if (val.includes(',') || val.includes('"')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        });
        rows.push(row.join(','));
      });

      fs.writeFileSync(filepath, rows.join('\n'));
    });
  }

  // Write priority batches first
  console.log('\n  HIGH PRIORITY BATCHES:');
  writeBatches(segments.B_UPCOMING.leads, 'SEG_B_TOAST_UPCOMING_PRIORITY', 'Toast Upcoming - HIGH PRIORITY');
  writeBatches(highValue.A, 'SEG_A_HIGH_VALUE', 'Segment A High Value (score >= 80)');
  writeBatches(highValue.B, 'SEG_B_HIGH_VALUE', 'Segment B High Value (score >= 80)');

  console.log('\n  SEGMENT A BATCHES (POS Switchers):');
  // Split Segment A by POS for targeted campaigns
  const cloverLeads = segments.A.leads.filter(l => l.current_pos === 'Clover');
  const squareLeads = segments.A.leads.filter(l => l.current_pos === 'Square');
  const lightspeedLeads = segments.A.leads.filter(l => l.current_pos === 'Lightspeed');
  const upserveLeads = segments.A.leads.filter(l => l.current_pos === 'Upserve');

  writeBatches(cloverLeads, 'SEG_A_CLOVER', 'Clover POS Users');
  writeBatches(squareLeads, 'SEG_A_SQUARE', 'Square POS Users');
  writeBatches(lightspeedLeads, 'SEG_A_LIGHTSPEED', 'Lightspeed POS Users');
  writeBatches(upserveLeads, 'SEG_A_UPSERVE', 'Upserve POS Users');

  console.log('\n  SEGMENT B BATCHES (Toast Optimizers):');
  const toastExisting = segments.B.leads.filter(l => !segments.B_UPCOMING.leads.includes(l));
  writeBatches(toastExisting, 'SEG_B_TOAST_EXISTING', 'Toast Existing Users');

  console.log('\n  SEGMENT D BATCHES (Local Infrastructure):');
  writeBatches(segments.D_CAPECOD.leads, 'SEG_D_CAPECOD', 'Cape Cod Local');
  writeBatches(segments.D_SOUTHSHORE.leads, 'SEG_D_SOUTHSHORE', 'South Shore Local');
  writeBatches(segments.D_SEMA.leads, 'SEG_D_SOUTHEASTERN_MA', 'Southeastern MA Local');

  // Write contactable lists for each segment
  console.log('\n  CONTACTABLE BATCHES (has email or phone):');
  writeBatches(contactable.A, 'SEG_A_CONTACTABLE', 'Segment A Contactable');
  writeBatches(contactable.B, 'SEG_B_CONTACTABLE', 'Segment B Contactable');
  writeBatches(contactable.D, 'SEG_D_CONTACTABLE', 'Segment D Contactable');

  // Write manifest
  const manifest = {
    created: new Date().toISOString(),
    batch_size: BATCH_SIZE,
    segments: {
      A: { total: segments.A.leads.length, contactable: contactable.A.length, high_value: highValue.A.length },
      B: { total: segments.B.leads.length, contactable: contactable.B.length, high_value: highValue.B.length, upcoming: segments.B_UPCOMING.leads.length },
      D: { total: segments.D.leads.length, contactable: contactable.D.length, cape_cod: segments.D_CAPECOD.leads.length }
    },
    campaign_strategy: {
      A: { angle: 'The Outage Insurance', sequence: 'seq_pos_switcher_001', door: 'national_remote' },
      B: { angle: 'The 7-Minute Menu Teardown', sequence: 'seq_toast_support_001', door: 'national_remote' },
      D: { angle: 'I build for kitchens', sequence: 'seq_local_network_001', door: 'local_regional' }
    }
  };

  fs.writeFileSync(path.join(batchDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`\n  Output directory: ${batchDir}`);
  console.log('  Manifest saved: MANIFEST.json\n');

  console.log('  LAUNCH PRIORITY ORDER:');
  console.log('  1. SEG_B_TOAST_UPCOMING_PRIORITY - These need support NOW');
  console.log('  2. SEG_A_HIGH_VALUE / SEG_B_HIGH_VALUE - Highest conversion potential');
  console.log('  3. SEG_D_CAPECOD - Your home turf, relationship-driven');
  console.log('  4. SEG_A_CLOVER - Largest switcher pool');
  console.log('  5. SEG_A_SQUARE - Second largest switcher pool\n');
}

main().catch(console.error);
