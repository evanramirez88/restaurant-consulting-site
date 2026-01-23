/**
 * Import Clean Leads Batch - First 100 from priority segments
 *
 * Imports validated restaurant leads from CLEANED_SEGMENTS into:
 * 1. restaurant_leads table
 * 2. email_subscribers table
 * 3. subscriber_sequences (enrolled in appropriate sequence)
 *
 * Priority: Toast Upcoming (all 50) + High Value (first 50) = 100 total
 *
 * Run with: node scripts/import_clean_batch.cjs [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG = {
  segments: [
    {
      file: 'G:/My Drive/RG OPS/70_LEADS/CLEANED_SEGMENTS/CLEAN_seg_toast_upcoming_2026-01-22.csv',
      sequence: 'seq_toast_support_001',
      segment_tag: 'toast_upcoming',
      max: 50, // Take first 50 from this segment
    },
    {
      file: 'G:/My Drive/RG OPS/70_LEADS/CLEANED_SEGMENTS/CLEAN_seg_high_value_2026-01-22.csv',
      sequence: 'seq_pos_switcher_001',
      segment_tag: 'high_value',
      max: 50, // Take first 50 from this segment
    },
  ],
  d1Database: 'rg-consulting-forms',
  projectDir: 'C:\\Users\\evanr\\projects\\restaurant-consulting-site',
  batchSize: 25,
};

function escapeSql(str) {
  if (!str) return '';
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const record = {};
    headers.forEach((h, idx) => {
      record[h.trim()] = values[idx] || '';
    });
    records.push(record);
  }

  return records;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('==========================================');
  console.log('CLEAN LEADS BATCH IMPORT');
  console.log('==========================================\n');

  if (dryRun) console.log('[DRY RUN MODE]\n');

  const allLeads = [];

  // Read and combine leads from priority segments
  for (const seg of CONFIG.segments) {
    console.log(`Reading: ${path.basename(seg.file)}`);
    const content = fs.readFileSync(seg.file, 'utf-8');
    const records = parseCSV(content);
    console.log(`  Found ${records.length} leads, taking first ${seg.max}`);

    const batch = records.slice(0, seg.max).map(r => ({
      ...r,
      sequence: seg.sequence,
      segment_tag: seg.segment_tag,
    }));

    allLeads.push(...batch);
  }

  console.log(`\nTotal leads to import: ${allLeads.length}\n`);

  if (dryRun) {
    console.log('Sample leads:');
    allLeads.slice(0, 10).forEach((l, i) => {
      console.log(`  ${i+1}. ${l.name} (${l.city}, ${l.state}) - ${l.current_pos} - Score: ${l.lead_score} → ${l.sequence}`);
    });
    console.log('\n[DRY RUN] No changes made.');
    return;
  }

  // Step 1: Import into restaurant_leads
  console.log('Step 1: Importing restaurant_leads...');
  let leadsImported = 0;

  for (let i = 0; i < allLeads.length; i += CONFIG.batchSize) {
    const batch = allLeads.slice(i, i + CONFIG.batchSize);

    const values = batch.map(l => {
      const id = 'lead_' + (l.domain || '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      return `('${escapeSql(id)}', '${escapeSql(l.domain)}', '${escapeSql(l.name)}', '${escapeSql(l.city)}', '${escapeSql(l.state)}', '${escapeSql(l.zip)}', 'US', '${escapeSql(l.email)}', '${escapeSql(l.phone)}', '${escapeSql(l.current_pos)}', ${parseInt(l.lead_score) || 0}, 'builtwith_clean', '${escapeSql(l.segment_tag)}', 'prospect', '${escapeSql(l.cuisine)}', '${escapeSql(l.vertical)}')`;
    }).join(',\n');

    const sql = `INSERT OR REPLACE INTO restaurant_leads
(id, domain, name, city, state, zip, country, primary_email, primary_phone, current_pos, lead_score, source, source_file, status, cuisine_primary, notes)
VALUES ${values};`;

    const sqlFile = path.join(CONFIG.projectDir, 'data', 'batch_clean_temp.sql');
    fs.mkdirSync(path.dirname(sqlFile), { recursive: true });
    fs.writeFileSync(sqlFile, sql);

    try {
      execSync(`npx wrangler d1 execute ${CONFIG.d1Database} --remote --file=${sqlFile}`, {
        cwd: CONFIG.projectDir, stdio: 'pipe'
      });
      leadsImported += batch.length;
    } catch (err) {
      console.error(`  Error in leads batch ${i}: ${err.message}`);
    }

    fs.unlinkSync(sqlFile);
  }
  console.log(`  Imported: ${leadsImported} restaurant_leads\n`);

  // Step 2: Create email_subscribers
  console.log('Step 2: Creating email_subscribers...');
  let subscribersCreated = 0;

  for (let i = 0; i < allLeads.length; i += CONFIG.batchSize) {
    const batch = allLeads.slice(i, i + CONFIG.batchSize);
    const now = Math.floor(Date.now() / 1000);

    const values = batch.map(l => {
      const subId = generateUUID();
      l._subscriberId = subId; // Store for sequence enrollment
      const firstName = (l.name || '').split(/[\s']/)[0] || '';
      return `('${subId}', '${escapeSql(l.email)}', '${escapeSql(firstName)}', NULL, '${escapeSql(l.name)}', '${escapeSql(l.current_pos)}', '${escapeSql(l.segment_tag)}', 'active', 'builtwith_clean', ${now}, ${now})`;
    }).join(',\n');

    const sql = `INSERT OR REPLACE INTO email_subscribers
(id, email, first_name, last_name, company, pos_system, segment, status, source, created_at, updated_at)
VALUES ${values};`;

    const sqlFile = path.join(CONFIG.projectDir, 'data', 'batch_sub_temp.sql');
    fs.writeFileSync(sqlFile, sql);

    try {
      execSync(`npx wrangler d1 execute ${CONFIG.d1Database} --remote --file=${sqlFile}`, {
        cwd: CONFIG.projectDir, stdio: 'pipe'
      });
      subscribersCreated += batch.length;
    } catch (err) {
      console.error(`  Error in subscriber batch ${i}: ${err.message}`);
    }

    fs.unlinkSync(sqlFile);
  }
  console.log(`  Created: ${subscribersCreated} email_subscribers\n`);

  // Step 3: Get sequence step IDs for enrollment
  console.log('Step 3: Enrolling in sequences...');

  const sequences = ['seq_toast_support_001', 'seq_pos_switcher_001'];
  const stepInfo = {};

  for (const seqId of sequences) {
    try {
      const result = execSync(
        `npx wrangler d1 execute ${CONFIG.d1Database} --remote --command="SELECT id, step_number, delay_value, delay_unit FROM sequence_steps WHERE sequence_id = '${seqId}' AND step_number = 1 AND status = 'active' LIMIT 1" --json`,
        { cwd: CONFIG.projectDir, stdio: 'pipe' }
      );
      const parsed = JSON.parse(result.toString());
      const step = parsed[0]?.results?.[0];
      if (step) {
        stepInfo[seqId] = step;
        console.log(`  Found step 1 for ${seqId}: ${step.id}`);
      } else {
        console.log(`  WARNING: No step 1 found for ${seqId}`);
      }
    } catch (err) {
      console.error(`  Error getting step for ${seqId}: ${err.message}`);
    }
  }

  // Step 4: Enroll subscribers in sequences
  let enrolled = 0;
  const now = Math.floor(Date.now() / 1000);
  // Stagger sends: first send starts 1 hour from now, each subsequent 30 min apart
  // This spreads 100 emails over ~50 hours (within 100/day cap)
  let scheduleOffset = 3600; // Start 1 hour from now

  for (let i = 0; i < allLeads.length; i += CONFIG.batchSize) {
    const batch = allLeads.slice(i, i + CONFIG.batchSize);

    const values = batch.map((l, idx) => {
      const ssId = generateUUID();
      const seqId = l.sequence;
      const step = stepInfo[seqId];
      if (!step) return null;

      // Stagger each email: distribute across days (100/day limit)
      // Batch of 100: send 90-100 per day over ~1 day
      const scheduledAt = now + scheduleOffset + ((i + idx) * 900); // 15 min apart

      return `('${ssId}', '${l._subscriberId || generateUUID()}', '${seqId}', '${step.id}', 1, 'active', ${scheduledAt}, 0, ${now}, ${now})`;
    }).filter(Boolean).join(',\n');

    if (!values) continue;

    const sql = `INSERT INTO subscriber_sequences
(id, subscriber_id, sequence_id, current_step_id, current_step_number, status, next_step_scheduled_at, emails_sent, created_at, updated_at)
VALUES ${values};`;

    const sqlFile = path.join(CONFIG.projectDir, 'data', 'batch_seq_temp.sql');
    fs.writeFileSync(sqlFile, sql);

    try {
      execSync(`npx wrangler d1 execute ${CONFIG.d1Database} --remote --file=${sqlFile}`, {
        cwd: CONFIG.projectDir, stdio: 'pipe'
      });
      enrolled += batch.length;
    } catch (err) {
      console.error(`  Error in sequence batch ${i}: ${err.message}`);
    }

    fs.unlinkSync(sqlFile);
  }
  console.log(`  Enrolled: ${enrolled} in sequences\n`);

  // Summary
  console.log('==========================================');
  console.log('IMPORT COMPLETE');
  console.log('==========================================');
  console.log(`  Restaurant Leads: ${leadsImported}`);
  console.log(`  Subscribers: ${subscribersCreated}`);
  console.log(`  Sequence Enrollments: ${enrolled}`);
  console.log(`\n  Sends will begin in ~1 hour, staggered 15 min apart`);
  console.log(`  At 100/day cap, all 100 emails will send within ~1 day`);
  console.log('\nMonitor via:');
  console.log('  Admin Portal → Email tab');
  console.log('  curl https://rg-email-dispatcher.ramirezconsulting-rg.workers.dev/stats');
}

main().catch(console.error);
