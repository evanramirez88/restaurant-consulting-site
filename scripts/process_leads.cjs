/**
 * Lead Processing & Segmentation System
 *
 * Processes BuiltWith CSV files, deduplicates, classifies, and exports segments
 *
 * Usage:
 *   node scripts/process_leads.cjs [--import] [--export] [--dry-run]
 *
 * Options:
 *   --import    Import leads to D1 database
 *   --export    Export segment workbooks to G: drive
 *   --dry-run   Show what would happen without making changes
 *   --stats     Show statistics only
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

// Configuration
const CONFIG = {
  leadsDir: 'G:/My Drive/RG OPS/70_LEADS/71_BUILTWITH_LEADS',
  outputDir: 'G:/My Drive/RG OPS/70_LEADS/SEGMENTED_WORKBOOKS',
  cleanedDir: 'G:/My Drive/RG OPS/70_LEADS/CLEANED_SEGMENTS',      // NEW: Validated restaurant-only leads
  tierCDDir: 'G:/My Drive/RG OPS/70_LEADS/TIER_CD_FUTURE',         // NEW: Non-restaurant data for future use
  localOutputDir: 'C:/Users/evanr/projects/restaurant-consulting-site/data/leads',
  cloudflareAccountId: '373a6cef1f9ccf5d26bfd9687a91c0a6',
  d1Database: 'rg-consulting-forms',

  // Source files to process (ONLY original BuiltWith exports with Vertical column)
  // NEVER use processed/filtered files - they don't have proper restaurant filtering
  sourceFiles: [
    { file: 'All-Live-Toast-POS-WebSites.csv', provider: 'Toast' },
    { file: 'Toast-POS-websites-filter-Upcoming-implementations.csv', provider: 'Toast (upcoming)' },
    { file: 'All-Live-Clover-WebSites.csv', provider: 'Clover' },
    { file: 'All-Live-Square-Sites.csv', provider: 'Square' },
    { file: 'All-Live-Lightspeed-WebSites.csv', provider: 'Lightspeed' },
    { file: 'All-Live-Upserve-WebSites.csv', provider: 'Upserve' },
    { file: 'All-Harbortouch-Sites.csv', provider: 'Harbortouch' },
    { file: 'All-Micros-Sites.csv', provider: 'Micros' },
    { file: 'All-Live-Cafe-Bistro-WebSites.csv', provider: 'Cafe/Bistro' },
  ],

  // DO NOT USE THESE FILES - they contain unfiltered non-restaurant data
  excludedFiles: [
    'top500_contactable.csv',      // Contains all business types, not just restaurants
    'master_deduped_leads.csv',    // May contain non-restaurant data
    'ma_restaurant_priority.csv',  // Manual list, needs separate validation
  ],

  // Segment definitions
  segments: {
    'seg_switcher_clover': {
      name: 'Clover Switchers',
      filter: (lead) => lead.current_pos === 'Clover',
      sequence: 'seq_pos_switcher_001'
    },
    'seg_switcher_square': {
      name: 'Square Switchers',
      filter: (lead) => lead.current_pos === 'Square' || lead.current_pos === 'Lightspeed',
      sequence: 'seq_pos_switcher_001'
    },
    'seg_switcher_upserve': {
      name: 'Upserve Switchers',
      filter: (lead) => lead.current_pos === 'Upserve',
      sequence: 'seq_pos_switcher_001'
    },
    'seg_toast_upcoming': {
      name: 'Toast Upcoming',
      filter: (lead) => lead.current_pos === 'Toast (upcoming)',
      sequence: 'seq_toast_support_001'
    },
    'seg_toast_existing': {
      name: 'Toast Existing',
      filter: (lead) => lead.current_pos === 'Toast',
      sequence: 'seq_toast_support_001'
    },
    'seg_local_ma': {
      name: 'Massachusetts',
      filter: (lead) => lead.state === 'MA',
      sequence: null
    },
    'seg_local_capecod': {
      name: 'Cape Cod',
      filter: (lead) => lead.state === 'MA' && lead.zip && (lead.zip.startsWith('025') || lead.zip.startsWith('026')),
      sequence: 'seq_local_network_001'
    },
    'seg_high_value': {
      name: 'High Value (Score 80+)',
      filter: (lead) => lead.lead_score >= 80,
      sequence: null
    },
    'seg_contactable': {
      name: 'Contactable (Email + Phone)',
      filter: (lead) => lead.primary_email && lead.primary_phone,
      sequence: null
    }
  },

  // Classification keywords for auto-detecting cuisine
  cuisineKeywords: {
    'italian': ['italian', 'pizza', 'pasta', 'trattoria', 'ristorante', 'pizzeria'],
    'mexican': ['mexican', 'taco', 'burrito', 'cantina', 'taqueria', 'tex-mex'],
    'chinese': ['chinese', 'dim sum', 'szechuan', 'cantonese', 'wok'],
    'japanese': ['japanese', 'sushi', 'ramen', 'izakaya', 'hibachi', 'teriyaki'],
    'thai': ['thai'],
    'indian': ['indian', 'curry', 'tandoor'],
    'seafood': ['seafood', 'oyster', 'lobster', 'crab', 'fish', 'shrimp'],
    'steakhouse': ['steakhouse', 'steak', 'chophouse', 'prime'],
    'bbq': ['bbq', 'barbecue', 'smokehouse', 'ribs', 'brisket'],
    'cafe': ['cafe', 'coffee', 'espresso', 'bakery'],
    'brewery': ['brewery', 'brewpub', 'brewing', 'taproom', 'craft beer'],
    'bar': ['bar', 'pub', 'tavern', 'saloon', 'lounge', 'sports bar']
  }
};

// State code normalization map
const STATE_CODES = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC'
};

function normalizeState(state) {
  if (!state) return null;
  const s = state.trim();
  if (s.length === 2) return s.toUpperCase();
  const lower = s.toLowerCase();
  return STATE_CODES[lower] || s;
}

function extractPrimaryEmail(emails) {
  if (!emails) return null;
  const list = emails.split(';').map(e => e.trim()).filter(e => e && e.includes('@'));
  // Prefer emails that look like contact/info
  const preferred = list.find(e => /^(info|contact|hello|general|admin|owner|manager)@/i.test(e));
  return preferred || list[0] || null;
}

function extractPrimaryPhone(phones) {
  if (!phones) return null;
  const match = phones.match(/ph:\+?[\d-]+/);
  if (match) {
    return match[0].replace('ph:', '').replace(/[^\d+]/g, '');
  }
  return null;
}

function calculateLeadScore(lead) {
  let score = 0;

  // Has contact info
  if (lead.primary_email) score += 30;
  if (lead.primary_phone) score += 20;

  // US-based
  if (lead.country === 'US') score += 10;

  // Has company name
  if (lead.name) score += 10;

  // Food & Drink vertical
  if (lead.vertical === 'Food And Drink') score += 15;

  // Recent activity (detected in last year)
  if (lead.last_found) {
    const lastFound = new Date(lead.last_found);
    const monthsAgo = (new Date() - lastFound) / (1000 * 60 * 60 * 24 * 30);
    if (monthsAgo < 3) score += 15;
    else if (monthsAgo < 6) score += 10;
    else if (monthsAgo < 12) score += 5;
  }

  return Math.min(score, 100);
}

function detectCuisine(name, domain) {
  if (!name && !domain) return null;
  const text = ((name || '') + ' ' + (domain || '')).toLowerCase();

  for (const [cuisine, keywords] of Object.entries(CONFIG.cuisineKeywords)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return cuisine;
      }
    }
  }
  return null;
}

// Valid restaurant-related verticals from BuiltWith
const RESTAURANT_VERTICALS = [
  'Food And Drink',
  'Food and Drink',
  'food and drink',
  'Restaurants',
  'restaurants'
];

function parseBuiltWithCSV(filePath, provider) {
  console.log(`  Parsing ${path.basename(filePath)}...`);

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Skip compliance notice (first line) if present
  let dataStart = 0;
  if (lines[0].includes('Compliance Notice')) {
    dataStart = 1;
  }

  // Find header row
  const headerLine = lines[dataStart];
  if (!headerLine) return { restaurants: [], nonRestaurants: [], needsReview: [] };

  const records = parse(lines.slice(dataStart).join('\n'), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true
  });

  const restaurants = [];
  const nonRestaurants = [];    // Tier D: Known non-restaurants (validation DB)
  const needsReview = [];       // Tier C: No vertical, needs manual review

  for (const record of records) {
    const domain = record['Domain'] || record['domain'];
    if (!domain || domain === 'Domain') continue;

    const leadData = {
      domain: domain.toLowerCase().trim(),
      name: record['Company'] || null,
      vertical: record['Vertical'] || null,
      city: record['City'] || null,
      state: normalizeState(record['State'] || record['state_norm']),
      zip: record['Zip'] || null,
      country: record['Country'] || 'US',
      primary_email: extractPrimaryEmail(record['Emails'] || record['primary_email']),
      primary_phone: extractPrimaryPhone(record['Telephones'] || record['primary_phone']),
      social_links: JSON.stringify({
        twitter: record['Twitter'] || null,
        facebook: record['Facebook'] || null,
        instagram: record['Instagram'] || null,
        linkedin: record['LinkedIn'] || null
      }),
      current_pos: provider,
      first_detected: record['First Detected'] || null,
      last_found: record['Last Found'] || null,
      source: 'builtwith',
      source_file: path.basename(filePath)
    };

    // CRITICAL: Classify by vertical
    const vertical = record['Vertical'] || record['vertical'];
    if (!vertical) {
      needsReview.push(leadData);
    } else if (RESTAURANT_VERTICALS.includes(vertical)) {
      restaurants.push(leadData);
    } else {
      // Non-restaurant: store for validation DB and potential future use
      leadData.rejection_reason = `Non-restaurant vertical: ${vertical}`;
      nonRestaurants.push(leadData);
    }
  }

  console.log(`    Restaurants: ${restaurants.length} | Non-Restaurant (Tier D): ${nonRestaurants.length} | Needs Review (Tier C): ${needsReview.length}`);
  return { restaurants, nonRestaurants, needsReview };
}

function deduplicateLeads(allLeads) {
  console.log('\nDeduplicating leads...');
  const byDomain = new Map();

  for (const lead of allLeads) {
    if (!lead.domain) continue;

    const existing = byDomain.get(lead.domain);
    if (existing) {
      // Merge: prefer non-null values, combine POS providers
      existing.name = existing.name || lead.name;
      existing.city = existing.city || lead.city;
      existing.state = existing.state || lead.state;
      existing.zip = existing.zip || lead.zip;
      existing.primary_email = existing.primary_email || lead.primary_email;
      existing.primary_phone = existing.primary_phone || lead.primary_phone;

      // Track multiple POS providers
      if (!existing.all_providers) {
        existing.all_providers = [existing.current_pos];
      }
      if (!existing.all_providers.includes(lead.current_pos)) {
        existing.all_providers.push(lead.current_pos);
      }
    } else {
      byDomain.set(lead.domain, { ...lead, all_providers: [lead.current_pos] });
    }
  }

  const deduped = Array.from(byDomain.values());
  console.log(`  Reduced from ${allLeads.length} to ${deduped.length} unique domains`);
  return deduped;
}

function enrichLeads(leads) {
  console.log('\nEnriching leads...');

  for (const lead of leads) {
    // Calculate lead score
    lead.lead_score = calculateLeadScore(lead);

    // Detect cuisine from name/domain
    lead.cuisine_primary = detectCuisine(lead.name, lead.domain);

    // Generate ID
    lead.id = `lead_${lead.domain.replace(/[^a-z0-9]/g, '_')}`;

    // Determine primary POS (prefer Toast upcoming, then Toast)
    if (lead.all_providers) {
      if (lead.all_providers.includes('Toast (upcoming)')) {
        lead.current_pos = 'Toast (upcoming)';
      } else if (lead.all_providers.includes('Toast')) {
        lead.current_pos = 'Toast';
      }
    }
  }

  return leads;
}

function assignSegments(leads) {
  console.log('\nAssigning segments...');

  const segmentCounts = {};

  for (const lead of leads) {
    lead.segments = [];

    for (const [segId, segDef] of Object.entries(CONFIG.segments)) {
      if (segDef.filter(lead)) {
        lead.segments.push(segId);
        segmentCounts[segId] = (segmentCounts[segId] || 0) + 1;
      }
    }
  }

  console.log('  Segment counts:');
  for (const [segId, count] of Object.entries(segmentCounts).sort((a, b) => b[1] - a[1])) {
    const segName = CONFIG.segments[segId]?.name || segId;
    console.log(`    ${segName}: ${count.toLocaleString()}`);
  }

  return leads;
}

function generateStats(leads) {
  console.log('\n========================================');
  console.log('LEAD STATISTICS');
  console.log('========================================\n');

  // Total
  console.log(`Total Unique Leads: ${leads.length.toLocaleString()}`);

  // By POS
  const byPOS = {};
  for (const lead of leads) {
    byPOS[lead.current_pos] = (byPOS[lead.current_pos] || 0) + 1;
  }
  console.log('\nBy Current POS:');
  for (const [pos, count] of Object.entries(byPOS).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pos}: ${count.toLocaleString()}`);
  }

  // By State (top 20)
  const byState = {};
  for (const lead of leads) {
    if (lead.state) {
      byState[lead.state] = (byState[lead.state] || 0) + 1;
    }
  }
  console.log('\nBy State (Top 20):');
  const topStates = Object.entries(byState).sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [state, count] of topStates) {
    console.log(`  ${state}: ${count.toLocaleString()}`);
  }

  // Contactability
  const withEmail = leads.filter(l => l.primary_email).length;
  const withPhone = leads.filter(l => l.primary_phone).length;
  const withBoth = leads.filter(l => l.primary_email && l.primary_phone).length;
  console.log('\nContactability:');
  console.log(`  With Email: ${withEmail.toLocaleString()} (${(withEmail/leads.length*100).toFixed(1)}%)`);
  console.log(`  With Phone: ${withPhone.toLocaleString()} (${(withPhone/leads.length*100).toFixed(1)}%)`);
  console.log(`  With Both: ${withBoth.toLocaleString()} (${(withBoth/leads.length*100).toFixed(1)}%)`);

  // Lead Score Distribution
  const scoreBuckets = { '90-100': 0, '70-89': 0, '50-69': 0, '30-49': 0, '0-29': 0 };
  for (const lead of leads) {
    if (lead.lead_score >= 90) scoreBuckets['90-100']++;
    else if (lead.lead_score >= 70) scoreBuckets['70-89']++;
    else if (lead.lead_score >= 50) scoreBuckets['50-69']++;
    else if (lead.lead_score >= 30) scoreBuckets['30-49']++;
    else scoreBuckets['0-29']++;
  }
  console.log('\nLead Score Distribution:');
  for (const [bucket, count] of Object.entries(scoreBuckets)) {
    console.log(`  ${bucket}: ${count.toLocaleString()}`);
  }

  // Segment Summary
  console.log('\nSegment Summary:');
  for (const [segId, segDef] of Object.entries(CONFIG.segments)) {
    const count = leads.filter(l => l.segments.includes(segId)).length;
    console.log(`  ${segDef.name}: ${count.toLocaleString()}`);
  }
}

function exportSegmentWorkbooks(leads, outputDir, isCleanedOutput = false) {
  const label = isCleanedOutput ? 'CLEANED SEGMENTS' : 'segment workbooks';
  console.log(`\nExporting ${label} to ${outputDir}...`);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const prefix = isCleanedOutput ? 'CLEAN_' : '';

  for (const [segId, segDef] of Object.entries(CONFIG.segments)) {
    const segmentLeads = leads.filter(l => l.segments.includes(segId));
    if (segmentLeads.length === 0) continue;

    // Sort by lead score descending
    segmentLeads.sort((a, b) => b.lead_score - a.lead_score);

    const filename = `${prefix}${segId}_${timestamp}.csv`;
    const filepath = path.join(outputDir, filename);

    // Prepare CSV data
    const csvData = segmentLeads.map(l => ({
      domain: l.domain,
      name: l.name || '',
      city: l.city || '',
      state: l.state || '',
      zip: l.zip || '',
      email: l.primary_email || '',
      phone: l.primary_phone || '',
      current_pos: l.current_pos,
      lead_score: l.lead_score,
      cuisine: l.cuisine_primary || '',
      vertical: l.vertical || ''
    }));

    const csv = stringify(csvData, { header: true });
    fs.writeFileSync(filepath, csv);

    console.log(`  ${segDef.name}: ${segmentLeads.length.toLocaleString()} leads -> ${filename}`);
  }

  // Export master file
  const masterFilename = `${prefix}ALL_LEADS_MASTER_${timestamp}.csv`;
  const masterData = leads.map(l => ({
    id: l.id,
    domain: l.domain,
    name: l.name || '',
    city: l.city || '',
    state: l.state || '',
    zip: l.zip || '',
    country: l.country || '',
    email: l.primary_email || '',
    phone: l.primary_phone || '',
    current_pos: l.current_pos,
    all_providers: (l.all_providers || []).join(';'),
    lead_score: l.lead_score,
    cuisine: l.cuisine_primary || '',
    vertical: l.vertical || '',
    segments: l.segments.join(';')
  }));

  const masterCsv = stringify(masterData.sort((a, b) => b.lead_score - a.lead_score), { header: true });
  fs.writeFileSync(path.join(outputDir, masterFilename), masterCsv);
  console.log(`\n  MASTER FILE: ${leads.length.toLocaleString()} leads -> ${masterFilename}`);
}

function exportTierCDData(nonRestaurants, needsReview, outputDir) {
  console.log(`\nExporting Tier C/D data to ${outputDir}...`);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];

  // TIER D: Non-restaurant businesses (validation database)
  // These are KNOWN to NOT be restaurants - use to prevent re-importing bad data
  if (nonRestaurants.length > 0) {
    const tierDFilename = `TIER_D_non_restaurant_${timestamp}.csv`;
    const tierDData = nonRestaurants.map(l => ({
      domain: l.domain,
      name: l.name || '',
      vertical: l.vertical || '',
      rejection_reason: l.rejection_reason || 'Non-restaurant vertical',
      city: l.city || '',
      state: l.state || '',
      email: l.primary_email || '',
      phone: l.primary_phone || '',
      current_pos: l.current_pos,
      source_file: l.source_file
    }));

    const tierDCsv = stringify(tierDData, { header: true });
    fs.writeFileSync(path.join(outputDir, tierDFilename), tierDCsv);
    console.log(`  TIER D (Non-Restaurant): ${nonRestaurants.length.toLocaleString()} -> ${tierDFilename}`);

    // Also update/append to validation blacklist
    const blacklistFile = path.join(outputDir, 'VALIDATION_BLACKLIST.csv');
    const blacklistData = nonRestaurants.map(l => ({
      domain: l.domain,
      reason: l.rejection_reason || 'Non-restaurant',
      added_date: timestamp
    }));

    let existingBlacklist = [];
    if (fs.existsSync(blacklistFile)) {
      const content = fs.readFileSync(blacklistFile, 'utf-8');
      existingBlacklist = parse(content, { columns: true, skip_empty_lines: true });
    }

    // Dedupe by domain
    const blacklistMap = new Map(existingBlacklist.map(b => [b.domain, b]));
    for (const item of blacklistData) {
      if (!blacklistMap.has(item.domain)) {
        blacklistMap.set(item.domain, item);
      }
    }

    const updatedBlacklist = stringify(Array.from(blacklistMap.values()), { header: true });
    fs.writeFileSync(blacklistFile, updatedBlacklist);
    console.log(`  VALIDATION_BLACKLIST.csv updated: ${blacklistMap.size.toLocaleString()} total domains`);
  }

  // TIER C: Needs manual review (no vertical info)
  // These could be restaurants but need human verification
  if (needsReview.length > 0) {
    const tierCFilename = `TIER_C_needs_review_${timestamp}.csv`;
    const tierCData = needsReview.map(l => ({
      domain: l.domain,
      name: l.name || '',
      vertical: l.vertical || '[MISSING]',
      city: l.city || '',
      state: l.state || '',
      email: l.primary_email || '',
      phone: l.primary_phone || '',
      current_pos: l.current_pos,
      source_file: l.source_file,
      review_status: 'pending'
    }));

    const tierCCsv = stringify(tierCData, { header: true });
    fs.writeFileSync(path.join(outputDir, tierCFilename), tierCCsv);
    console.log(`  TIER C (Needs Review): ${needsReview.length.toLocaleString()} -> ${tierCFilename}`);
  }

  // Summary by vertical for Tier D
  const verticalCounts = {};
  for (const lead of nonRestaurants) {
    const v = lead.vertical || 'Unknown';
    verticalCounts[v] = (verticalCounts[v] || 0) + 1;
  }

  if (Object.keys(verticalCounts).length > 0) {
    console.log('\n  Non-Restaurant Verticals Found:');
    const sorted = Object.entries(verticalCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [vertical, count] of sorted) {
      console.log(`    ${vertical}: ${count.toLocaleString()}`);
    }
  }
}

async function importToD1(leads, dryRun = false) {
  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Importing to D1 database...`);

  // Import in batches
  const batchSize = 100;
  let imported = 0;
  let errors = 0;

  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);

    if (dryRun) {
      imported += batch.length;
      continue;
    }

    // Create SQL INSERT statements
    const values = batch.map(l => {
      const escapedName = (l.name || '').replace(/'/g, "''");
      const escapedCity = (l.city || '').replace(/'/g, "''");

      return `('${l.id}', '${l.domain}', '${escapedName}', '${escapedCity}', '${l.state || ''}', '${l.zip || ''}', '${l.country || 'US'}', '${l.primary_email || ''}', '${l.primary_phone || ''}', '${l.current_pos}', ${l.lead_score}, '${l.cuisine_primary || ''}', 'builtwith', '${l.source_file || ''}')`;
    }).join(',\n');

    const sql = `INSERT OR REPLACE INTO restaurant_leads (id, domain, name, city, state, zip, country, primary_email, primary_phone, current_pos, lead_score, cuisine_primary, source, source_file) VALUES ${values};`;

    try {
      const sqlFile = path.join(CONFIG.localOutputDir, 'batch_import.sql');
      fs.mkdirSync(path.dirname(sqlFile), { recursive: true });
      fs.writeFileSync(sqlFile, sql);

      execSync(`npx wrangler d1 execute ${CONFIG.d1Database} --remote --file=${sqlFile}`, {
        cwd: 'C:\\Users\\evanr\\projects\\restaurant-consulting-site',
        stdio: 'pipe',
        env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: CONFIG.cloudflareAccountId }
      });

      imported += batch.length;
    } catch (err) {
      errors += batch.length;
      console.error(`  Error in batch ${i}-${i+batchSize}: ${err.message}`);
    }

    // Progress
    if ((i + batchSize) % 1000 === 0 || i + batchSize >= leads.length) {
      console.log(`  Progress: ${Math.min(i + batchSize, leads.length).toLocaleString()}/${leads.length.toLocaleString()}`);
    }
  }

  console.log(`  Imported: ${imported.toLocaleString()}, Errors: ${errors}`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const doImport = args.includes('--import');
  const doExport = args.includes('--export');
  const dryRun = args.includes('--dry-run');
  const statsOnly = args.includes('--stats');

  console.log('========================================');
  console.log('LEAD PROCESSING & SEGMENTATION SYSTEM');
  console.log('========================================');
  console.log('Strategy: docs/LEAD_STRATEGY_AND_SEGMENTATION.md');
  console.log('========================================\n');

  // Step 1: Parse all source files (now returns tiered data)
  console.log('Step 1: Parsing source files with tiered classification...');
  const allRestaurants = [];
  const allNonRestaurants = [];
  const allNeedsReview = [];

  for (const source of CONFIG.sourceFiles) {
    const filepath = path.join(CONFIG.leadsDir, source.file);
    if (fs.existsSync(filepath)) {
      const { restaurants, nonRestaurants, needsReview } = parseBuiltWithCSV(filepath, source.provider);
      allRestaurants.push(...restaurants);
      allNonRestaurants.push(...nonRestaurants);
      allNeedsReview.push(...needsReview);
    } else {
      console.log(`  [SKIP] ${source.file} not found`);
    }
  }

  console.log('\n  TIER SUMMARY:');
  console.log(`    Tier 1/2 (Restaurants): ${allRestaurants.length.toLocaleString()}`);
  console.log(`    Tier C (Needs Review): ${allNeedsReview.length.toLocaleString()}`);
  console.log(`    Tier D (Non-Restaurant): ${allNonRestaurants.length.toLocaleString()}`);
  console.log(`    Total Records Processed: ${(allRestaurants.length + allNonRestaurants.length + allNeedsReview.length).toLocaleString()}`);

  // Step 2: Deduplicate (restaurants only for main processing)
  const dedupedLeads = deduplicateLeads(allRestaurants);

  // Step 3: Enrich
  const enrichedLeads = enrichLeads(dedupedLeads);

  // Step 4: Assign segments
  const segmentedLeads = assignSegments(enrichedLeads);

  // Step 5: Generate stats
  generateStats(segmentedLeads);

  if (statsOnly) {
    console.log('\n[Stats only mode - no export or import]');
    return;
  }

  // Check if G: drive is available
  const gDriveAvailable = fs.existsSync(path.dirname(CONFIG.outputDir));

  // Step 6: Export CLEANED segments (validated restaurant-only)
  if (doExport || (!doImport && !dryRun)) {
    let cleanedDir = CONFIG.cleanedDir;
    if (!gDriveAvailable) {
      console.log(`\n[Note: G: drive not available, using local output]`);
      cleanedDir = path.join(CONFIG.localOutputDir, 'CLEANED_SEGMENTS');
    }
    exportSegmentWorkbooks(segmentedLeads, cleanedDir, true);

    // Step 6b: Export Tier C/D data (for validation DB and future use)
    let tierCDDir = CONFIG.tierCDDir;
    if (!gDriveAvailable) {
      tierCDDir = path.join(CONFIG.localOutputDir, 'TIER_CD_FUTURE');
    }
    exportTierCDData(allNonRestaurants, allNeedsReview, tierCDDir);

    // Also export to legacy location for backwards compatibility
    if (gDriveAvailable) {
      exportSegmentWorkbooks(segmentedLeads, CONFIG.outputDir, false);
    }
  }

  // Step 7: Import to D1 (only validated restaurants)
  if (doImport) {
    console.log('\n[IMPORTANT: Only importing VALIDATED RESTAURANT leads to D1]');
    await importToD1(segmentedLeads, dryRun);
  }

  console.log('\n========================================');
  console.log('COMPLETE');
  console.log('========================================');
  console.log('\nOutput Locations:');
  if (gDriveAvailable) {
    console.log(`  CLEANED (restaurants): ${CONFIG.cleanedDir}`);
    console.log(`  TIER C/D (future use): ${CONFIG.tierCDDir}`);
    console.log(`  Legacy workbooks: ${CONFIG.outputDir}`);
  } else {
    console.log(`  All output: ${CONFIG.localOutputDir}`);
  }
}

main().catch(console.error);
