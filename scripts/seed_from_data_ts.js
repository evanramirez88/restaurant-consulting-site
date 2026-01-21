import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, '..', 'cape-cod-culinary-compass-pro-extracted', 'data.ts');
const content = fs.readFileSync(dataPath, 'utf8');

// Regex to find objects in the ESTABLISHMENTS array
const establishmentsMatch = content.match(/export const ESTABLISHMENTS: Restaurant\[] = \[(.*?)\];/s);
if (!establishmentsMatch) {
    console.error('Could not find ESTABLISHMENTS array');
    process.exit(1);
}

const establishmentsText = establishmentsMatch[1];

// This is very hacky but will get the job done for this specific file
const splitObjects = establishmentsText.split(/},\s*{/);

const leads = [];

splitObjects.forEach(objText => {
    const getVal = (key) => {
        // Updated regex to handle more variations and nested structures
        const regex = new RegExp(`${key}:\\s*(?:"(.*?)"|(\\d+\\.?\\d*)|(true|false)|null)`, 's');
        const match = objText.match(regex);
        if (!match) return null;
        return match[1] || match[2] || match[3];
    };

    const name = getVal('name');
    if (!name) return;

    leads.push({
        id: `lead_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${getVal('town')?.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        name: name,
        town: getVal('town'),
        region: getVal('region'),
        restaurant_type: getVal('type'),
        price_level: getVal('price'),
        rating: getVal('rating'),
        seasonal: getVal('seasonal') === 'true' ? 1 : 0,
        address: getVal('address'),
        license_number: getVal('licenseNumber'),
        license_type: getVal('licenseType'),
        seating_capacity: getVal('seatingCapacity'),
        health_score: getVal('healthScore'),
        last_inspection_date: getVal('lastInspectionDate'),
        pos_system: getVal('posSystem'),
        online_ordering: getVal('onlineOrdering'),
        website: getVal('website'),
        description: getVal('desc')
    });
});

console.log(`Extracted ${leads.length} leads.`);

// Generate SQL
let sql = '-- Seeded from data.ts\n';
leads.forEach(l => {
    sql += `INSERT OR REPLACE INTO restaurant_leads (
        id, name, dba_name, city, state, zip, 
        cuisine_primary, current_pos, online_ordering, website_url, 
        address_line1, actual_seat_count, license_number, license_type,
        health_score, last_inspection_date, price_level, google_rating,
        seasonal, region, notes, status
    ) VALUES (
        '${l.id}', 
        '${l.name.replace(/'/g, "''")}', 
        '${l.name.replace(/'/g, "''")}', 
        '${l.town || ''}', 
        'MA', 
        '', 
        '${l.restaurant_type || ''}', 
        '${l.pos_system || ''}', 
        '${l.online_ordering || 'None'}', 
        '${l.website || ''}', 
        '${(l.address || '').replace(/'/g, "''")}', 
        ${l.seating_capacity || 'NULL'}, 
        '${l.license_number || ''}', 
        '${l.license_type || ''}', 
        ${l.health_score || 'NULL'}, 
        '${l.last_inspection_date || ''}', 
        ${l.price_level || 'NULL'}, 
        ${l.rating || 'NULL'}, 
        ${l.seasonal}, 
        '${l.region || ''}', 
        '${(l.description || '').replace(/'/g, "''")}',
        'prospect'
    );\n`;
});

fs.writeFileSync(path.join(__dirname, '..', 'migrations', '0066_seed_all_cape_cod_data.sql'), sql);
console.log('Saved to migrations/0066_seed_all_cape_cod_data.sql');
