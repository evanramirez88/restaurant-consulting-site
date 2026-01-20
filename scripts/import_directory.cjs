/**
 * Cape Cod Restaurant Directory Import Script
 *
 * Parses restaurant data from input files and inserts into cape_cod_restaurants table
 *
 * Usage:
 *   node scripts/import_directory.cjs --dry-run   # Preview only
 *   node scripts/import_directory.cjs --import    # Actually import to D1
 *   node scripts/import_directory.cjs --export    # Export to JSON for review
 */

const fs = require('fs');
const path = require('path');

// Town to region mapping
const TOWN_REGION_MAP = {
  'Provincetown': 'Outer Cape',
  'Truro': 'Outer Cape',
  'Wellfleet': 'Outer Cape',
  'Eastham': 'Outer Cape',
  'Orleans': 'Lower Cape',
  'Chatham': 'Lower Cape',
  'Brewster': 'Lower Cape',
  'Harwich': 'Lower Cape',
  'Dennis': 'Mid Cape',
  'Yarmouth': 'Mid Cape',
  'Barnstable': 'Mid Cape',
  'Mashpee': 'Upper Cape',
  'Falmouth': 'Upper Cape',
  'Sandwich': 'Upper Cape',
  'Bourne': 'Upper Cape',
};

// Village to town mapping
const VILLAGE_TOWN_MAP = {
  'Hyannis': 'Barnstable',
  'Centerville': 'Barnstable',
  'Osterville': 'Barnstable',
  'Cotuit': 'Barnstable',
  'Marstons Mills': 'Barnstable',
  'West Barnstable': 'Barnstable',
  'Barnstable Village': 'Barnstable',
  'Woods Hole': 'Falmouth',
  'Falmouth Heights': 'Falmouth',
  'East Falmouth': 'Falmouth',
  'West Falmouth': 'Falmouth',
  'North Falmouth': 'Falmouth',
  'Harwich Port': 'Harwich',
  'West Harwich': 'Harwich',
  'East Harwich': 'Harwich',
  'South Yarmouth': 'Yarmouth',
  'West Yarmouth': 'Yarmouth',
  'Yarmouth Port': 'Yarmouth',
  'South Dennis': 'Dennis',
  'East Dennis': 'Dennis',
  'West Dennis': 'Dennis',
  'Dennis Port': 'Dennis',
  'North Chatham': 'Chatham',
  'South Chatham': 'Chatham',
  'West Chatham': 'Chatham',
  'North Truro': 'Truro',
  'South Wellfleet': 'Wellfleet',
  'North Eastham': 'Eastham',
  'Buzzards Bay': 'Bourne',
  'Sagamore': 'Bourne',
  'Sagamore Beach': 'Bourne',
  'Monument Beach': 'Bourne',
  'Pocasset': 'Bourne',
  'Cataumet': 'Bourne',
  'East Sandwich': 'Sandwich',
  'Forestdale': 'Sandwich',
  'Mashpee Commons': 'Mashpee',
  'New Seabury': 'Mashpee',
  'Popponesset': 'Mashpee',
};

// Parse restaurant type from description
function parseType(description, name) {
  const types = {
    'Seafood': ['seafood', 'lobster', 'oyster', 'clam', 'fish', 'raw bar', 'shrimp', 'crab'],
    'Fine Dining': ['fine dining', 'upscale', 'prix fixe', 'tasting menu', 'elegant'],
    'Casual': ['casual', 'family', 'comfort', 'american', 'burgers'],
    'Bar/Pub': ['bar', 'pub', 'tavern', 'taproom', 'brewery', 'saloon'],
    'Cafe': ['cafe', 'coffee', 'bakery', 'pastry', 'breakfast', 'brunch'],
    'Pizza': ['pizza', 'pizzeria'],
    'Italian': ['italian', 'pasta', 'trattoria', 'ristorante'],
    'Mexican': ['mexican', 'tacos', 'taqueria', 'cantina', 'burrito'],
    'Asian': ['asian', 'chinese', 'japanese', 'sushi', 'thai', 'vietnamese', 'ramen'],
    'BBQ': ['bbq', 'barbecue', 'smokehouse', 'ribs', 'brisket'],
    'Ice Cream': ['ice cream', 'frozen', 'gelato', 'soft serve'],
    'Takeout': ['takeout', 'take-out', 'clam shack', 'shack'],
    'Food Truck': ['food truck', 'mobile', 'cart'],
  };

  const text = (description + ' ' + name).toLowerCase();

  for (const [type, keywords] of Object.entries(types)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return type;
      }
    }
  }

  return 'Other';
}

// Parse price level from description
function parsePriceLevel(description) {
  const text = description.toLowerCase();

  if (text.includes('$$$$') || text.includes('fine dining') || text.includes('prix fixe')) return 4;
  if (text.includes('$$$') || text.includes('upscale')) return 3;
  if (text.includes('$$') || text.includes('moderate')) return 2;
  if (text.includes('$') || text.includes('budget') || text.includes('cheap') || text.includes('shack')) return 1;

  return 2; // Default to moderate
}

// Check if seasonal
function isSeasonal(description) {
  const text = description.toLowerCase();
  return text.includes('seasonal') || text.includes('summer only') ||
         text.includes('may-oct') || text.includes('april-oct') ||
         text.includes('memorial day') || text.includes('labor day');
}

// Generate unique ID
function generateId() {
  return 'ccr_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

// Parse restaurant data from text files
function parseRestaurantsFromText(content) {
  const restaurants = [];
  let currentTown = null;

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if this is a town header (usually all caps or followed by specific patterns)
    const townMatch = Object.keys(TOWN_REGION_MAP).find(town =>
      trimmed.toUpperCase() === town.toUpperCase() ||
      trimmed.match(new RegExp(`^${town}\\s*$`, 'i')) ||
      trimmed.match(new RegExp(`^## ${town}`, 'i')) ||
      trimmed.match(new RegExp(`^### ${town}`, 'i')) ||
      trimmed.match(new RegExp(`^\\*\\*${town}\\*\\*`, 'i'))
    );

    if (townMatch) {
      currentTown = townMatch;
      continue;
    }

    // Check for village headers
    const villageMatch = Object.keys(VILLAGE_TOWN_MAP).find(village =>
      trimmed.toUpperCase() === village.toUpperCase() ||
      trimmed.match(new RegExp(`^${village}\\s*$`, 'i'))
    );

    if (villageMatch) {
      currentTown = VILLAGE_TOWN_MAP[villageMatch];
      continue;
    }

    // Parse restaurant entries
    // Common patterns:
    // - Name - Description
    // - Name: Description
    // - **Name** - Description
    // - Name (Type) - Description

    let match = trimmed.match(/^\*\*([^*]+)\*\*\s*[-–—:]\s*(.+)$/);  // **Name** - Description
    if (!match) match = trimmed.match(/^([^-–—:]+)\s*[-–—:]\s*(.+)$/);  // Name - Description
    if (!match) match = trimmed.match(/^(\d+\.\s*)?([^-–—:]+)\s*[-–—:]\s*(.+)$/);  // 1. Name - Description

    if (match && currentTown) {
      const name = (match[2] || match[1]).trim().replace(/^\*\*|\*\*$/g, '').replace(/^\d+\.\s*/, '');
      const description = (match[3] || match[2]).trim();

      // Skip if name is too short or looks like a header
      if (name.length < 3 || name.match(/^(the|a|an)$/i)) continue;
      if (name.match(/^(restaurants|establishments|dining|food)/i)) continue;

      restaurants.push({
        id: generateId(),
        name: name,
        town: currentTown,
        region: TOWN_REGION_MAP[currentTown],
        type: parseType(description, name),
        price_level: parsePriceLevel(description),
        seasonal: isSeasonal(description) ? 1 : 0,
        description: description,
        data_source: 'imported',
      });
    }
  }

  return restaurants;
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const doImport = args.includes('--import');
  const doExport = args.includes('--export');

  console.log('='.repeat(60));
  console.log('Cape Cod Restaurant Directory Import');
  console.log('='.repeat(60));

  // Input files directory
  const inputDir = 'C:\\Users\\evanr\\Desktop\\New folder';

  // Files to process
  const inputFiles = [
    'Restaurants on Cape Cod (Mainland) by Town.txt',
    'Restaurants on Cape Cod (Mainland)_continued.txt',
    'Restaurants on Cape Cod (Mainland)_continued (1).txt',
    'The Shadow Gastronomy of Barnstable.txt',
  ];

  let allRestaurants = [];

  for (const fileName of inputFiles) {
    const filePath = path.join(inputDir, fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${fileName}`);
      continue;
    }

    console.log(`\n📄 Processing: ${fileName}`);

    const content = fs.readFileSync(filePath, 'utf-8');
    const restaurants = parseRestaurantsFromText(content);

    console.log(`   Found ${restaurants.length} restaurants`);
    allRestaurants = allRestaurants.concat(restaurants);
  }

  // Deduplicate by name + town
  const seen = new Set();
  const unique = [];

  for (const r of allRestaurants) {
    const key = `${r.name.toLowerCase()}|${r.town.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Total parsed: ${allRestaurants.length}`);
  console.log(`After dedup:  ${unique.length}`);

  // Stats by town
  const byTown = {};
  for (const r of unique) {
    byTown[r.town] = (byTown[r.town] || 0) + 1;
  }

  console.log(`\nBy Town:`);
  for (const [town, count] of Object.entries(byTown).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${town}: ${count}`);
  }

  // Stats by region
  const byRegion = {};
  for (const r of unique) {
    byRegion[r.region] = (byRegion[r.region] || 0) + 1;
  }

  console.log(`\nBy Region:`);
  for (const [region, count] of Object.entries(byRegion).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${region}: ${count}`);
  }

  // Stats by type
  const byType = {};
  for (const r of unique) {
    byType[r.type] = (byType[r.type] || 0) + 1;
  }

  console.log(`\nBy Type:`);
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  if (doExport) {
    const outputPath = path.join(__dirname, '../data/cape_cod_restaurants.json');
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(unique, null, 2));
    console.log(`\n✅ Exported ${unique.length} restaurants to: ${outputPath}`);
  }

  if (doImport) {
    console.log(`\n📥 Importing to D1 database...`);
    console.log(`   Run: npx wrangler d1 execute ccrc-db --remote --command "..."`);

    // Generate SQL INSERT statements
    const sqlPath = path.join(__dirname, '../data/cape_cod_restaurants_import.sql');
    const outputDir = path.dirname(sqlPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let sql = '-- Cape Cod Restaurant Directory Import\n';
    sql += `-- Generated: ${new Date().toISOString()}\n`;
    sql += `-- Total records: ${unique.length}\n\n`;

    for (const r of unique) {
      const name = r.name.replace(/'/g, "''");
      const desc = (r.description || '').replace(/'/g, "''");

      sql += `INSERT OR IGNORE INTO cape_cod_restaurants (id, name, town, region, type, price_level, seasonal, description, data_source, created_at, updated_at) VALUES ('${r.id}', '${name}', '${r.town}', '${r.region}', '${r.type}', ${r.price_level}, ${r.seasonal}, '${desc}', 'imported', unixepoch(), unixepoch());\n`;
    }

    fs.writeFileSync(sqlPath, sql);
    console.log(`\n✅ Generated SQL file: ${sqlPath}`);
    console.log(`   Run: npx wrangler d1 execute ccrc-db --remote --file=${sqlPath}`);
  }

  if (dryRun) {
    console.log(`\n🔍 Dry run - no changes made`);
    console.log(`   Use --import to import to D1`);
    console.log(`   Use --export to export to JSON`);
  }

  console.log(`\n${'='.repeat(60)}`);
}

main().catch(console.error);
