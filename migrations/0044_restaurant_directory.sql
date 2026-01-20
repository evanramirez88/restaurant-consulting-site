-- =====================================================
-- CAPE COD CULINARY COMPASS - RESTAURANT DIRECTORY
-- =====================================================
-- Purpose: Complete Cape Cod restaurant directory with location history
-- Features: Data validation, public records links, daily refresh
-- =====================================================

-- =====================================================
-- PART 1: MAIN DIRECTORY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS cape_cod_restaurants (
  id TEXT PRIMARY KEY,

  -- Basic Identity
  name TEXT NOT NULL,
  dba_name TEXT,
  domain TEXT,

  -- Location
  address TEXT,
  village TEXT, -- Cape Cod villages (Hyannis, Woods Hole, etc.)
  town TEXT NOT NULL,
  region TEXT NOT NULL, -- Outer Cape, Lower Cape, Mid Cape, Upper Cape
  state TEXT DEFAULT 'MA',
  zip TEXT,
  latitude REAL,
  longitude REAL,

  -- Classification
  type TEXT, -- Seafood, Fine Dining, Casual, Bar/Pub, Cafe, etc.
  cuisine_primary TEXT,
  cuisine_secondary TEXT,
  service_style TEXT, -- FSR, QSR, Counter, etc.
  price_level INTEGER CHECK(price_level IS NULL OR (price_level >= 1 AND price_level <= 4)),

  -- Operations
  seasonal INTEGER DEFAULT 0,
  season_open TEXT, -- e.g., "April-October"
  hours_json TEXT, -- JSON: {"Mon": "11-22", ...}

  -- Contact & Digital
  phone TEXT,
  email TEXT,
  website TEXT,

  -- Social Media (JSON)
  socials TEXT, -- {"instagram": "...", "facebook": "...", "yelp": "..."}

  -- Online Ordering
  online_ordering TEXT, -- Toast, Grubhub, UberEats, DoorDash, Direct, None
  online_ordering_url TEXT,

  -- Tech Stack
  pos_system TEXT,
  pos_confidence REAL,
  pos_detected_at INTEGER,

  -- Licensure & Compliance
  license_number TEXT,
  license_type TEXT, -- Common Victualler, Liquor (Full), Liquor (Beer/Wine), Seasonal
  license_expiry TEXT,
  seating_capacity INTEGER,

  -- Health & Safety
  health_score INTEGER CHECK(health_score IS NULL OR (health_score >= 0 AND health_score <= 100)),
  last_inspection_date TEXT,
  health_violations_count INTEGER,

  -- Business Intelligence
  rating REAL CHECK(rating IS NULL OR (rating >= 1.0 AND rating <= 5.0)),
  review_count INTEGER,
  estimated_revenue TEXT,
  employee_count INTEGER,

  -- Description
  description TEXT,
  notable_features TEXT, -- JSON array: ["waterfront", "live music", "raw bar"]

  -- Data Quality
  data_source TEXT, -- manual, scraped, imported, enriched
  data_confidence REAL,
  last_verified_at INTEGER,
  last_enriched_at INTEGER,

  -- Metadata
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- =====================================================
-- PART 2: LOCATION HISTORY (Flip-book backwards in time)
-- =====================================================

CREATE TABLE IF NOT EXISTS restaurant_location_history (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  town TEXT NOT NULL,

  -- The restaurant at this location during this period
  restaurant_name TEXT NOT NULL,
  restaurant_type TEXT,

  -- Time period
  period_start TEXT, -- "2018" or "2018-03" or exact date
  period_end TEXT, -- NULL if still operating

  -- Notes about this period
  notes TEXT,
  closure_reason TEXT, -- Closed, Renamed, Relocated, Seasonal

  -- Link to current directory entry (if exists)
  current_restaurant_id TEXT REFERENCES cape_cod_restaurants(id),

  -- Source of this historical data
  source TEXT,

  created_at INTEGER DEFAULT (unixepoch())
);

-- =====================================================
-- PART 3: PUBLIC RECORDS LINKS
-- =====================================================

CREATE TABLE IF NOT EXISTS public_records_links (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL, -- abcc_license, health_inspection, business_certificate
  town TEXT,

  -- URL template with placeholders
  url_template TEXT NOT NULL,

  -- Search URL (for manual lookup)
  search_url TEXT,

  -- Metadata
  description TEXT,
  last_verified_at INTEGER,

  created_at INTEGER DEFAULT (unixepoch())
);

-- =====================================================
-- PART 4: DATA REFRESH SCHEDULE
-- =====================================================

CREATE TABLE IF NOT EXISTS data_refresh_schedule (
  id TEXT PRIMARY KEY,
  schedule_name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  refresh_type TEXT NOT NULL, -- full_directory, enrichment, health_scores
  last_run_at INTEGER,
  next_run_at INTEGER,
  status TEXT DEFAULT 'active',
  config_json TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- =====================================================
-- PART 5: IMPORT VALIDATION RULES
-- =====================================================

CREATE TABLE IF NOT EXISTS import_validation_rules (
  id TEXT PRIMARY KEY,
  field_name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- required, format, range, enum, custom
  rule_config TEXT NOT NULL, -- JSON config
  error_message TEXT,
  severity TEXT DEFAULT 'error', -- error, warning, info
  active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ccr_town ON cape_cod_restaurants(town);
CREATE INDEX IF NOT EXISTS idx_ccr_region ON cape_cod_restaurants(region);
CREATE INDEX IF NOT EXISTS idx_ccr_pos ON cape_cod_restaurants(pos_system);
CREATE INDEX IF NOT EXISTS idx_ccr_type ON cape_cod_restaurants(type);
CREATE INDEX IF NOT EXISTS idx_ccr_seasonal ON cape_cod_restaurants(seasonal);
CREATE INDEX IF NOT EXISTS idx_ccr_name ON cape_cod_restaurants(name);
CREATE INDEX IF NOT EXISTS idx_rlh_address ON restaurant_location_history(address);
CREATE INDEX IF NOT EXISTS idx_rlh_town ON restaurant_location_history(town);
CREATE INDEX IF NOT EXISTS idx_rlh_restaurant ON restaurant_location_history(current_restaurant_id);

-- =====================================================
-- SEED: PUBLIC RECORDS LINKS (All 15 Cape Cod Towns)
-- =====================================================

INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
-- Massachusetts ABCC (Alcoholic Beverages Control Commission)
('abcc_search', 'abcc_license', NULL,
 'https://www.google.com/search?q=site:mass.gov+ABCC+"{license_number}"',
 'https://www.mass.gov/orgs/alcoholic-beverages-control-commission',
 'MA Alcoholic Beverages Control Commission'),

-- Barnstable (includes Hyannis, Centerville, Osterville, Cotuit, Marstons Mills, West Barnstable)
('barnstable_biz', 'business_certificate', 'Barnstable',
 'https://www.google.com/search?q=site:townofbarnstable.us+"{business_name}"+license',
 'https://www.townofbarnstable.us/Departments/TownClerk/Business-Certificates.asp',
 'Town of Barnstable Business Certificates'),

('barnstable_health', 'health_inspection', 'Barnstable',
 'https://www.google.com/search?q="{business_name}"+Barnstable+MA+health+inspection',
 'https://www.townofbarnstable.us/Departments/Health/',
 'Town of Barnstable Health Department'),

-- Bourne
('bourne_biz', 'business_certificate', 'Bourne',
 'https://www.google.com/search?q=site:townofbourne.com+"{business_name}"',
 'https://www.townofbourne.com/town-clerk/pages/business-certificates',
 'Town of Bourne Business Certificates'),

-- Brewster
('brewster_biz', 'business_certificate', 'Brewster',
 'https://www.google.com/search?q=site:brewster-ma.gov+"{business_name}"',
 'https://www.brewster-ma.gov/town-clerk',
 'Town of Brewster Business Certificates'),

-- Chatham
('chatham_biz', 'business_certificate', 'Chatham',
 'https://www.google.com/search?q=site:chatham-ma.gov+"{business_name}"',
 'https://www.chatham-ma.gov/town-clerk',
 'Town of Chatham Business Certificates'),

-- Dennis
('dennis_biz', 'business_certificate', 'Dennis',
 'https://www.google.com/search?q=site:town.dennis.ma.us+"{business_name}"',
 'https://www.town.dennis.ma.us/town-clerk',
 'Town of Dennis Business Certificates'),

-- Eastham
('eastham_biz', 'business_certificate', 'Eastham',
 'https://www.google.com/search?q=site:eastham-ma.gov+"{business_name}"',
 'https://www.eastham-ma.gov/town-clerk',
 'Town of Eastham Business Certificates'),

-- Falmouth (includes Woods Hole, Falmouth Heights, East Falmouth)
('falmouth_biz', 'business_certificate', 'Falmouth',
 'https://www.google.com/search?q=site:falmouthma.gov+"{business_name}"',
 'https://www.falmouthma.gov/150/Town-Clerk',
 'Town of Falmouth Business Certificates'),

-- Harwich (includes Harwich Port, West Harwich)
('harwich_biz', 'business_certificate', 'Harwich',
 'https://www.google.com/search?q=site:harwich-ma.gov+"{business_name}"',
 'https://www.harwich-ma.gov/town-clerk',
 'Town of Harwich Business Certificates'),

-- Mashpee
('mashpee_biz', 'business_certificate', 'Mashpee',
 'https://www.google.com/search?q=site:mashpeema.gov+"{business_name}"',
 'https://www.mashpeema.gov/town-clerk',
 'Town of Mashpee Business Certificates'),

-- Orleans
('orleans_biz', 'business_certificate', 'Orleans',
 'https://www.google.com/search?q=site:town.orleans.ma.us+"{business_name}"',
 'https://www.town.orleans.ma.us/town-clerk',
 'Town of Orleans Business Certificates'),

-- Provincetown
('provincetown_biz', 'business_certificate', 'Provincetown',
 'https://www.google.com/search?q=site:provincetown-ma.gov+"{business_name}"',
 'https://www.provincetown-ma.gov/154/Town-Clerk',
 'Town of Provincetown Business Certificates'),

-- Sandwich
('sandwich_biz', 'business_certificate', 'Sandwich',
 'https://www.google.com/search?q=site:sandwichmass.org+"{business_name}"',
 'https://www.sandwichmass.org/189/Town-Clerk',
 'Town of Sandwich Business Certificates'),

-- Truro
('truro_biz', 'business_certificate', 'Truro',
 'https://www.google.com/search?q=site:truro-ma.gov+"{business_name}"',
 'https://www.truro-ma.gov/town-clerk',
 'Town of Truro Business Certificates'),

-- Wellfleet
('wellfleet_biz', 'business_certificate', 'Wellfleet',
 'https://www.google.com/search?q=site:wellfleet-ma.gov+"{business_name}"',
 'https://www.wellfleet-ma.gov/town-clerk',
 'Town of Wellfleet Business Certificates'),

-- Yarmouth (includes South Yarmouth, West Yarmouth, Yarmouth Port)
('yarmouth_biz', 'business_certificate', 'Yarmouth',
 'https://www.google.com/search?q=site:yarmouth.ma.us+"{business_name}"',
 'https://www.yarmouth.ma.us/141/Town-Clerk',
 'Town of Yarmouth Business Certificates'),

-- Barnstable County Health (serves all Cape Cod towns)
('barnstable_county_health', 'health_inspection', NULL,
 'https://www.google.com/search?q="{business_name}"+"{town}"+MA+health+inspection',
 'https://www.barnstablecountyhealth.org/',
 'Barnstable County Department of Health and Environment'),

-- Google Maps for address verification
('google_maps', 'address_verify', NULL,
 'https://www.google.com/maps/search/{business_name}+{address}+{town}+MA',
 'https://www.google.com/maps',
 'Google Maps Address Verification'),

-- Yelp Business Page
('yelp_business', 'reviews', NULL,
 'https://www.yelp.com/search?find_desc={business_name}&find_loc={town}%2C+MA',
 'https://www.yelp.com',
 'Yelp Business Listings');

-- =====================================================
-- SEED: IMPORT VALIDATION RULES
-- =====================================================

INSERT OR IGNORE INTO import_validation_rules (id, field_name, rule_type, rule_config, error_message, severity) VALUES
-- Required fields
('val_name_required', 'name', 'required', '{}', 'Restaurant name is required', 'error'),
('val_town_required', 'town', 'required', '{}', 'Town is required', 'error'),
('val_region_required', 'region', 'required', '{}', 'Region is required', 'error'),

-- Cape Cod towns only (the 15 official towns)
('val_town_enum', 'town', 'enum',
 '{"values": ["Barnstable", "Bourne", "Brewster", "Chatham", "Dennis", "Eastham", "Falmouth", "Harwich", "Mashpee", "Orleans", "Provincetown", "Sandwich", "Truro", "Wellfleet", "Yarmouth"]}',
 'Town must be one of the 15 Cape Cod towns',
 'error'),

-- Region validation
('val_region_enum', 'region', 'enum',
 '{"values": ["Outer Cape", "Lower Cape", "Mid Cape", "Upper Cape"]}',
 'Region must be Outer Cape, Lower Cape, Mid Cape, or Upper Cape',
 'error'),

-- Block non-Cape Cod locations
('val_no_boston', 'town', 'custom',
 '{"type": "blocklist", "values": ["Boston", "Cambridge", "Somerville", "Quincy", "Brookline", "Newton", "Worcester", "Springfield", "Brockton", "Fall River", "New Bedford", "Lynn", "Lawrence", "Lowell"]}',
 'Only Cape Cod towns allowed - metro Boston and other MA cities are excluded',
 'error'),

-- Range validations
('val_price_range', 'price_level', 'range', '{"min": 1, "max": 4}', 'Price level must be 1-4 ($-$$$$)', 'warning'),
('val_rating_range', 'rating', 'range', '{"min": 1.0, "max": 5.0}', 'Rating must be between 1.0 and 5.0', 'warning'),
('val_health_range', 'health_score', 'range', '{"min": 0, "max": 100}', 'Health score must be between 0 and 100', 'warning'),

-- Known POS systems
('val_pos_enum', 'pos_system', 'enum',
 '{"values": ["Toast", "Square", "Clover", "Aloha", "Micros", "Lightspeed", "Upserve", "TouchBistro", "Revel", "SpotOn", "NCR", "Heartland", "Lavu", "Unknown"]}',
 'Unrecognized POS system - verify spelling or use "Unknown"',
 'info'),

-- Online ordering platforms
('val_online_ordering_enum', 'online_ordering', 'enum',
 '{"values": ["Toast", "Grubhub", "UberEats", "DoorDash", "Slice", "ChowNow", "Direct", "None"]}',
 'Unrecognized online ordering platform',
 'info'),

-- License types
('val_license_type_enum', 'license_type', 'enum',
 '{"values": ["Common Victualler", "Liquor (Full)", "Liquor (Beer/Wine)", "Seasonal", "Retail Food", "Catering"]}',
 'Unrecognized license type',
 'info'),

-- Service styles
('val_service_style_enum', 'service_style', 'enum',
 '{"values": ["Fine Dining", "Upscale Casual", "Full Service", "Fast Casual", "Quick Service", "Counter Service", "Bar/Lounge", "Food Truck", "Takeout Only"]}',
 'Unrecognized service style',
 'info');

-- =====================================================
-- SEED: DATA REFRESH SCHEDULE
-- =====================================================

INSERT OR IGNORE INTO data_refresh_schedule (id, schedule_name, cron_expression, refresh_type, status, config_json) VALUES
('refresh_5am', 'Morning Directory Refresh', '0 5 * * *', 'full_directory', 'active',
 '{"tasks": ["validate_data", "check_websites", "update_pos_detection"]}'),

('refresh_5pm', 'Evening Directory Refresh', '0 17 * * *', 'full_directory', 'active',
 '{"tasks": ["validate_data", "sync_external_sources"]}'),

('enrich_daily', 'Daily AI Enrichment', '0 6 * * *', 'enrichment', 'active',
 '{"model": "mistral-7b", "max_records": 50, "priority": "missing_data"}'),

('health_weekly', 'Weekly Health Score Check', '0 3 * * 1', 'health_scores', 'active',
 '{"source": "barnstable_county_health"}');

-- =====================================================
-- TOWN-TO-REGION MAPPING VIEW
-- =====================================================

CREATE VIEW IF NOT EXISTS v_town_region_map AS
SELECT 'Provincetown' as town, 'Outer Cape' as region UNION ALL
SELECT 'Truro', 'Outer Cape' UNION ALL
SELECT 'Wellfleet', 'Outer Cape' UNION ALL
SELECT 'Eastham', 'Outer Cape' UNION ALL
SELECT 'Orleans', 'Lower Cape' UNION ALL
SELECT 'Chatham', 'Lower Cape' UNION ALL
SELECT 'Brewster', 'Lower Cape' UNION ALL
SELECT 'Harwich', 'Lower Cape' UNION ALL
SELECT 'Dennis', 'Mid Cape' UNION ALL
SELECT 'Yarmouth', 'Mid Cape' UNION ALL
SELECT 'Barnstable', 'Mid Cape' UNION ALL
SELECT 'Mashpee', 'Upper Cape' UNION ALL
SELECT 'Falmouth', 'Upper Cape' UNION ALL
SELECT 'Sandwich', 'Upper Cape' UNION ALL
SELECT 'Bourne', 'Upper Cape';

-- =====================================================
-- DIRECTORY STATS VIEW
-- =====================================================

CREATE VIEW IF NOT EXISTS v_directory_stats AS
SELECT
  (SELECT COUNT(*) FROM cape_cod_restaurants) as total_restaurants,
  (SELECT COUNT(*) FROM cape_cod_restaurants WHERE seasonal = 1) as seasonal_count,
  (SELECT COUNT(*) FROM cape_cod_restaurants WHERE pos_system IS NOT NULL AND pos_system != 'Unknown') as known_pos_count,
  (SELECT COUNT(*) FROM cape_cod_restaurants WHERE online_ordering IS NOT NULL AND online_ordering != 'None') as online_ordering_count,
  (SELECT COUNT(DISTINCT town) FROM cape_cod_restaurants) as towns_covered,
  (SELECT COUNT(*) FROM restaurant_location_history) as historical_records;
