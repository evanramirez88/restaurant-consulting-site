-- =====================================================
-- DATA QUALITY & PROVENANCE TRACKING
-- Enables continuous data improvement and verification
-- =====================================================

-- Data Sources Registry - track where data comes from
CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'api', 'scrape', 'manual', 'import', 'enrichment'
  reliability_score INTEGER DEFAULT 70, -- 0-100
  api_endpoint TEXT,
  rate_limit_per_hour INTEGER,
  cost_per_call REAL DEFAULT 0,
  fields_provided TEXT, -- JSON array of fields this source provides
  is_active INTEGER DEFAULT 1,
  last_used_at INTEGER,
  total_records_sourced INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Seed core data sources
INSERT OR IGNORE INTO data_sources (id, name, type, reliability_score, fields_provided) VALUES
('src_google_places', 'Google Places API', 'api', 95, '["name","address","phone","website","hours","rating","review_count","price_level","types"]'),
('src_yelp', 'Yelp Fusion API', 'api', 90, '["name","address","phone","rating","review_count","price","categories","transactions"]'),
('src_abcc', 'MA ABCC License Database', 'scrape', 98, '["license_number","license_type","dba_name","address","seating_capacity"]'),
('src_assessor', 'Town Assessor Records', 'scrape', 95, '["owner_name","property_value","building_sqft","year_built","zoning"]'),
('src_health_dept', 'Health Department Inspections', 'scrape', 98, '["health_score","last_inspection_date","violations"]'),
('src_secretary_state', 'MA Secretary of State', 'scrape', 99, '["legal_name","registered_agent","incorporation_date","status"]'),
('src_builtwith', 'BuiltWith Tech Lookup', 'api', 85, '["pos_system","online_ordering","website_tech"]'),
('src_web_scrape', 'Website Scraping', 'scrape', 75, '["menu_url","hours","about","social_links"]'),
('src_manual', 'Manual Entry', 'manual', 100, '["*"]'),
('src_user_research', 'User Research/Discovery', 'manual', 90, '["*"]');

-- Field-level provenance tracking
CREATE TABLE IF NOT EXISTS field_provenance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL, -- 'lead', 'client', 'prospect'
  entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_value TEXT,
  source_id TEXT REFERENCES data_sources(id),
  confidence_score INTEGER DEFAULT 50, -- 0-100
  verified_at INTEGER,
  verified_by TEXT, -- 'auto', 'manual', 'cross_reference'
  is_current INTEGER DEFAULT 1, -- soft delete for history
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(entity_id, field_name, source_id, is_current)
);

CREATE INDEX IF NOT EXISTS idx_provenance_entity ON field_provenance(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_provenance_field ON field_provenance(field_name);

-- Verification queue - items needing human review
CREATE TABLE IF NOT EXISTS verification_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_name TEXT,
  proposed_value TEXT,
  current_value TEXT,
  source_id TEXT,
  confidence_score INTEGER,
  reason TEXT, -- 'conflict', 'low_confidence', 'stale', 'missing'
  priority INTEGER DEFAULT 50, -- 0-100, higher = more urgent
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'merged'
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_verification_status ON verification_queue(status, priority DESC);

-- Discovery queue - places to research
CREATE TABLE IF NOT EXISTS discovery_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  address TEXT,
  town TEXT NOT NULL,
  region TEXT,
  source TEXT, -- where we heard about this place
  source_url TEXT,
  discovery_type TEXT, -- 'new_restaurant', 'name_change', 'closure_check', 'data_gap'
  priority INTEGER DEFAULT 50,
  status TEXT DEFAULT 'pending', -- 'pending', 'researching', 'imported', 'rejected', 'duplicate'
  matched_lead_id TEXT, -- if it matches an existing lead
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  processed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_discovery_status ON discovery_queue(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_town ON discovery_queue(town);

-- Add data quality columns to restaurant_leads if not exist
-- These track overall record quality

-- Check if columns exist before adding (SQLite workaround)
-- We'll use INSERT OR IGNORE pattern for safety

-- Data quality score (computed from field completeness + verification)
-- verification_status: 'unverified', 'partial', 'verified', 'stale'
-- last_verified_at: timestamp of last verification
-- data_completeness: 0-100 based on filled fields
-- source_count: number of sources contributing data

-- Since ALTER TABLE ADD COLUMN IF NOT EXISTS doesn't work in SQLite,
-- we'll create a view that handles this gracefully

-- Lead scoring factors table
CREATE TABLE IF NOT EXISTS lead_scoring_factors (
  id TEXT PRIMARY KEY,
  factor_name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'contact', 'business', 'tech', 'engagement', 'fit'
  weight REAL DEFAULT 1.0,
  max_points INTEGER DEFAULT 10,
  description TEXT,
  is_active INTEGER DEFAULT 1
);

INSERT OR IGNORE INTO lead_scoring_factors (id, factor_name, category, weight, max_points, description) VALUES
-- Contact completeness
('has_email', 'Has Email', 'contact', 1.5, 15, 'Primary email address available'),
('has_phone', 'Has Phone', 'contact', 1.0, 10, 'Phone number available'),
('has_website', 'Has Website', 'contact', 1.0, 10, 'Website URL available'),
('has_address', 'Has Address', 'contact', 0.8, 8, 'Physical address available'),
('has_owner_contact', 'Has Owner Contact', 'contact', 2.0, 20, 'Owner/decision maker contact'),

-- Business intelligence
('has_pos_system', 'Known POS', 'tech', 1.5, 15, 'Current POS system identified'),
('pos_is_target', 'Target POS (Clover/Square/Upserve)', 'tech', 2.0, 20, 'Using a POS we can replace'),
('pos_is_toast', 'Already Toast', 'tech', 1.0, 10, 'Already Toast customer'),
('has_online_ordering', 'Online Ordering Identified', 'tech', 0.5, 5, 'Online ordering platform known'),

-- Business fit
('is_independent', 'Independent Restaurant', 'fit', 1.5, 15, 'Not a chain/franchise'),
('has_liquor_license', 'Has Liquor License', 'fit', 1.0, 10, 'Full liquor or beer/wine license'),
('est_revenue_high', 'High Revenue Estimate', 'fit', 1.5, 15, 'Estimated revenue > $1M'),
('multi_location', 'Multi-Location', 'fit', 2.0, 20, 'Multiple locations potential'),

-- Engagement signals
('recently_contacted', 'Recent Contact', 'engagement', -0.5, -5, 'Contacted in last 30 days (avoid spam)'),
('opened_email', 'Opened Email', 'engagement', 1.0, 10, 'Has opened marketing email'),
('visited_website', 'Website Visitor', 'engagement', 1.5, 15, 'Visited our website'),
('requested_quote', 'Quote Requested', 'engagement', 3.0, 30, 'Has requested a quote');

-- Cape Cod establishment types (for discovery)
CREATE TABLE IF NOT EXISTS establishment_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  toast_fit_score INTEGER DEFAULT 50, -- 0-100, how good a fit for Toast
  typical_pos_needs TEXT, -- JSON array
  description TEXT
);

INSERT OR IGNORE INTO establishment_types (id, name, toast_fit_score, typical_pos_needs, description) VALUES
('fine_dining', 'Fine Dining', 95, '["full_pos","tableside","reservations","wine_inventory"]', 'High-end restaurants'),
('casual_dining', 'Casual Dining', 90, '["full_pos","online_ordering","loyalty"]', 'Sit-down casual restaurants'),
('fast_casual', 'Fast Casual', 85, '["counter_service","kds","online_ordering"]', 'Counter service with quality food'),
('qsr', 'Quick Service/Fast Food', 70, '["speed","drive_thru","kds"]', 'Fast food and drive-thru'),
('bar_pub', 'Bar/Pub', 90, '["bar_tabs","happy_hour","age_verify"]', 'Bars and pubs'),
('brewery_winery', 'Brewery/Winery', 85, '["tasting_room","retail","events"]', 'Breweries and wineries'),
('cafe_coffee', 'Cafe/Coffee Shop', 80, '["quick_service","mobile_ordering","loyalty"]', 'Coffee shops and cafes'),
('bakery', 'Bakery', 75, '["retail","pre_order","inventory"]', 'Bakeries'),
('seafood_market', 'Seafood Market', 80, '["retail","restaurant_hybrid","scale_integration"]', 'Seafood markets with prepared food'),
('food_truck', 'Food Truck', 70, '["mobile","cash_drawer","simple"]', 'Mobile food vendors'),
('catering', 'Catering', 85, '["events","invoicing","large_orders"]', 'Catering operations'),
('hotel_restaurant', 'Hotel Restaurant', 90, '["pms_integration","room_charge","events"]', 'Hotel dining'),
('country_club', 'Country/Yacht Club', 95, '["member_charging","events","golf_integration"]', 'Private clubs'),
('seasonal', 'Seasonal Operation', 85, '["flexible_licensing","quick_setup","seasonal_staff"]', 'Summer-only operations');
