-- Migration: 0065_mega_enrichment_schema.sql
-- Description: Comprehensive schema update for restaurant leads to support deep intelligence

-- 1. Identity & Business Details
ALTER TABLE restaurant_leads ADD COLUMN owner_name TEXT;
ALTER TABLE restaurant_leads ADD COLUMN owner_email TEXT;
ALTER TABLE restaurant_leads ADD COLUMN owner_phone TEXT;
ALTER TABLE restaurant_leads ADD COLUMN established_date TEXT;
ALTER TABLE restaurant_leads ADD COLUMN years_in_business INTEGER;
ALTER TABLE restaurant_leads ADD COLUMN seasonal INTEGER DEFAULT 0; -- 0=No, 1=Yes

-- 2. Menu Analysis Details
ALTER TABLE restaurant_leads ADD COLUMN menu_url TEXT;
ALTER TABLE restaurant_leads ADD COLUMN avg_menu_price REAL;
ALTER TABLE restaurant_leads ADD COLUMN menu_item_count INTEGER;
ALTER TABLE restaurant_leads ADD COLUMN menu_category_count INTEGER;
ALTER TABLE restaurant_leads ADD COLUMN price_level INTEGER; -- 1-4 ($ to $$$$)
ALTER TABLE restaurant_leads ADD COLUMN wine_list_complexity TEXT;
ALTER TABLE restaurant_leads ADD COLUMN cocktail_program TEXT;

-- 3. Operations & Financials
ALTER TABLE restaurant_leads ADD COLUMN hours_json TEXT;
ALTER TABLE restaurant_leads ADD COLUMN days_open INTEGER;
ALTER TABLE restaurant_leads ADD COLUMN seating_capacity INTEGER;
ALTER TABLE restaurant_leads ADD COLUMN estimated_annual_revenue REAL;
ALTER TABLE restaurant_leads ADD COLUMN estimated_daily_covers INTEGER;
ALTER TABLE restaurant_leads ADD COLUMN avg_check_size REAL;

-- 4. Public Records (Liquor & Health)
ALTER TABLE restaurant_leads ADD COLUMN license_number TEXT;
ALTER TABLE restaurant_leads ADD COLUMN license_type TEXT;
ALTER TABLE restaurant_leads ADD COLUMN health_score INTEGER;
ALTER TABLE restaurant_leads ADD COLUMN last_inspection_date TEXT;

-- 5. Property & Assessor Data
ALTER TABLE restaurant_leads ADD COLUMN parcel_id TEXT;
ALTER TABLE restaurant_leads ADD COLUMN property_owner TEXT;
ALTER TABLE restaurant_leads ADD COLUMN building_sqft INTEGER;
ALTER TABLE restaurant_leads ADD COLUMN property_value REAL;
ALTER TABLE restaurant_leads ADD COLUMN assessor_url TEXT;
ALTER TABLE restaurant_leads ADD COLUMN floor_plan_notes TEXT;

-- 6. Ratings & Reputation
ALTER TABLE restaurant_leads ADD COLUMN google_rating REAL;
ALTER TABLE restaurant_leads ADD COLUMN google_review_count INTEGER;
ALTER TABLE restaurant_leads ADD COLUMN yelp_rating REAL;
ALTER TABLE restaurant_leads ADD COLUMN yelp_review_count INTEGER;
ALTER TABLE restaurant_leads ADD COLUMN tripadvisor_rating REAL;

-- 7. Enrichment Progress & Quality
ALTER TABLE restaurant_leads ADD COLUMN data_completeness INTEGER DEFAULT 0;
ALTER TABLE restaurant_leads ADD COLUMN enrichment_confidence INTEGER DEFAULT 0;
ALTER TABLE restaurant_leads ADD COLUMN last_enriched_at INTEGER;
ALTER TABLE restaurant_leads ADD COLUMN gap_analysis_json TEXT; -- Duplicate of 0064 just in case
ALTER TABLE restaurant_leads ADD COLUMN verification_status TEXT DEFAULT 'unverified'; -- Duplicate of 0064 just in case

-- Add indexes for common searches
CREATE INDEX IF NOT EXISTS idx_leads_town ON restaurant_leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_score ON restaurant_leads(lead_score);
CREATE INDEX IF NOT EXISTS idx_leads_pos ON restaurant_leads(current_pos);
