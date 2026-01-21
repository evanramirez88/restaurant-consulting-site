import { execSync } from 'child_process';

const columns = [
    'owner_name', 'owner_email', 'owner_phone', 'established_date', 'years_in_business', 'seasonal',
    'menu_url', 'avg_menu_price', 'menu_item_count', 'menu_category_count', 'price_level',
    'wine_list_complexity', 'cocktail_program', 'hours_json', 'days_open', 'seating_capacity',
    'estimated_annual_revenue', 'estimated_daily_covers', 'avg_check_size',
    'license_number', 'license_type', 'health_score', 'last_inspection_date',
    'parcel_id', 'property_owner', 'building_sqft', 'property_value', 'assessor_url', 'floor_plan_notes',
    'google_rating', 'google_review_count', 'yelp_rating', 'yelp_review_count', 'tripadvisor_rating',
    'data_completeness', 'enrichment_confidence', 'last_enriched_at', 'gap_analysis_json', 'verification_status'
];

const dbName = 'rg-consulting-forms';

console.log(`Starting safe schema update for ${dbName}...`);

for (const col of columns) {
    try {
        console.log(`Adding column ${col}...`);
        const type = (col.includes('count') || col.includes('status') || col.includes('json') || col.includes('date') || col.includes('at') || col.includes('id') || col.includes('name') || col.includes('email') || col.includes('phone') || col.includes('url') || col.includes('notes') || col.includes('type') || col.includes('complexity') || col.includes('program')) ? 'TEXT' : (col.includes('rating') || col.includes('revenue') || col.includes('price') || col.includes('size') || col.includes('value')) ? 'REAL' : 'INTEGER';

        // Wrap in a command that ignores the "duplicate column" error
        execSync(`npx wrangler d1 execute ${dbName} --local --command="ALTER TABLE restaurant_leads ADD COLUMN ${col} ${type};"`, { stdio: 'inherit' });
    } catch (e) {
        console.log(`Column ${col} likely already exists, skipping.`);
    }
}

console.log('Schema update complete.');
