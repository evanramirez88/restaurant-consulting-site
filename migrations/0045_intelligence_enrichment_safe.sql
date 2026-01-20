-- =====================================================
-- INTELLIGENCE ENRICHMENT - SAFE MIGRATION
-- Only creates new tables, skips existing columns
-- =====================================================

-- EMAIL CAMPAIGNS TABLE (for campaign selection)
CREATE TABLE IF NOT EXISTS email_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sequence_id TEXT,
  target_segment TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Seed default campaigns
INSERT OR IGNORE INTO email_campaigns (id, name, description, sequence_id, target_segment) VALUES
('camp_toast_support', 'Toast Support Outreach', 'For existing Toast users who may need support', 'seq_toast_support_001', 'toast_existing'),
('camp_pos_switcher', 'POS Switcher Campaign', 'For restaurants using Clover, Square, or other POS looking to switch', 'seq_pos_switcher_001', 'switchers'),
('camp_local_network', 'Local Network Campaign', 'For Cape Cod and South Shore restaurants', 'seq_local_network_001', 'local'),
('camp_new_opening', 'New Restaurant Opening', 'For new restaurants opening soon', 'seq_new_opening_001', 'new_opening'),
('camp_menu_builder', 'Menu Builder Launch', 'Promoting menu builder tool', 'seq_menu_builder_001', 'all'),
('camp_quote_followup', 'Quote Follow-up', 'Following up on quote requests', 'seq_quote_followup_001', 'quoted');

-- ENRICHMENT SOURCES TABLE
CREATE TABLE IF NOT EXISTS enrichment_sources (
  id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  api_endpoint TEXT,
  rate_limit INTEGER,
  cost_per_request REAL,
  fields_provided TEXT,
  is_active INTEGER DEFAULT 1,
  last_used_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Seed enrichment sources
INSERT OR IGNORE INTO enrichment_sources (id, source_name, source_type, fields_provided, is_active) VALUES
('src_google_places', 'Google Places API', 'api', '["hours_json","google_rating","google_review_count","phone","address","website"]', 1),
('src_yelp', 'Yelp Fusion API', 'api', '["yelp_rating","yelp_review_count","price_level","category"]', 1),
('src_assessor', 'Town Assessor Records', 'scrape', '["parcel_id","property_owner","building_sqft","property_value","assessor_url"]', 1),
('src_abcc', 'MA ABCC License Lookup', 'scrape', '["license_number","license_type","seating_capacity"]', 1),
('src_menu_scrape', 'Menu Website Scraper', 'scrape', '["menu_item_count","menu_category_count","avg_menu_price","menu_url"]', 1),
('src_web_search', 'Web Search (Tavily/Google)', 'search', '["owner_name","established_date","competitive_notes"]', 1),
('src_linkedin', 'LinkedIn (Manual)', 'manual', '["owner_name","owner_email","owner_phone"]', 0);

-- ENRICHMENT JOBS TABLE
CREATE TABLE IF NOT EXISTS enrichment_jobs (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  source_id TEXT,
  status TEXT DEFAULT 'pending',
  fields_updated TEXT,
  raw_response TEXT,
  error_message TEXT,
  cost REAL DEFAULT 0,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_lead ON enrichment_jobs(lead_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_status ON enrichment_jobs(status);

-- MENU ANALYSIS TABLE
CREATE TABLE IF NOT EXISTS menu_analysis (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  menu_url TEXT,
  total_items INTEGER,
  appetizers INTEGER,
  entrees INTEGER,
  desserts INTEGER,
  beverages INTEGER,
  cocktails INTEGER,
  wines INTEGER,
  beers INTEGER,
  price_min REAL,
  price_max REAL,
  price_avg REAL,
  cuisine_detected TEXT,
  dietary_options TEXT,
  modifier_complexity TEXT,
  raw_menu_text TEXT,
  analyzed_at INTEGER DEFAULT (unixepoch()),
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_menu_analysis_lead ON menu_analysis(lead_id);

-- ASSESSOR DATA TABLE
CREATE TABLE IF NOT EXISTS assessor_data (
  id TEXT PRIMARY KEY,
  lead_id TEXT,
  town TEXT NOT NULL,
  parcel_id TEXT,
  address TEXT,
  owner_name TEXT,
  owner_address TEXT,
  building_style TEXT,
  year_built INTEGER,
  total_sqft INTEGER,
  first_floor_sqft INTEGER,
  land_area_sqft INTEGER,
  assessed_value INTEGER,
  land_value INTEGER,
  building_value INTEGER,
  zoning TEXT,
  use_code TEXT,
  floor_plan_url TEXT,
  last_sale_date TEXT,
  last_sale_price INTEGER,
  source_url TEXT,
  fetched_at INTEGER DEFAULT (unixepoch()),
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_assessor_town ON assessor_data(town);
CREATE INDEX IF NOT EXISTS idx_assessor_parcel ON assessor_data(parcel_id);
CREATE INDEX IF NOT EXISTS idx_assessor_lead ON assessor_data(lead_id);
