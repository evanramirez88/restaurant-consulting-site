-- =====================================================
-- CAPE COD CULINARY COMPASS - RESTAURANT DIRECTORY
-- Part A: Tables and Indexes
-- =====================================================

-- Main directory table
CREATE TABLE IF NOT EXISTS cape_cod_restaurants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dba_name TEXT,
  domain TEXT,
  address TEXT,
  village TEXT,
  town TEXT NOT NULL,
  region TEXT NOT NULL,
  state TEXT DEFAULT 'MA',
  zip TEXT,
  latitude REAL,
  longitude REAL,
  type TEXT,
  cuisine_primary TEXT,
  cuisine_secondary TEXT,
  service_style TEXT,
  price_level INTEGER CHECK(price_level IS NULL OR (price_level >= 1 AND price_level <= 4)),
  seasonal INTEGER DEFAULT 0,
  season_open TEXT,
  hours_json TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  socials TEXT,
  online_ordering TEXT,
  online_ordering_url TEXT,
  pos_system TEXT,
  pos_confidence REAL,
  pos_detected_at INTEGER,
  license_number TEXT,
  license_type TEXT,
  license_expiry TEXT,
  seating_capacity INTEGER,
  health_score INTEGER CHECK(health_score IS NULL OR (health_score >= 0 AND health_score <= 100)),
  last_inspection_date TEXT,
  health_violations_count INTEGER,
  rating REAL CHECK(rating IS NULL OR (rating >= 1.0 AND rating <= 5.0)),
  review_count INTEGER,
  estimated_revenue TEXT,
  employee_count INTEGER,
  description TEXT,
  notable_features TEXT,
  data_source TEXT,
  data_confidence REAL,
  last_verified_at INTEGER,
  last_enriched_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Location History table
CREATE TABLE IF NOT EXISTS restaurant_location_history (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  town TEXT NOT NULL,
  restaurant_name TEXT NOT NULL,
  restaurant_type TEXT,
  period_start TEXT,
  period_end TEXT,
  notes TEXT,
  closure_reason TEXT,
  current_restaurant_id TEXT REFERENCES cape_cod_restaurants(id),
  source TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Public Records Links table
CREATE TABLE IF NOT EXISTS public_records_links (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  town TEXT,
  url_template TEXT NOT NULL,
  search_url TEXT,
  description TEXT,
  last_verified_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Data Refresh Schedule table
CREATE TABLE IF NOT EXISTS data_refresh_schedule (
  id TEXT PRIMARY KEY,
  schedule_name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  refresh_type TEXT NOT NULL,
  last_run_at INTEGER,
  next_run_at INTEGER,
  status TEXT DEFAULT 'active',
  config_json TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Import Validation Rules table
CREATE TABLE IF NOT EXISTS import_validation_rules (
  id TEXT PRIMARY KEY,
  field_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  rule_config TEXT NOT NULL,
  error_message TEXT,
  severity TEXT DEFAULT 'error',
  active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ccr_town ON cape_cod_restaurants(town);
CREATE INDEX IF NOT EXISTS idx_ccr_region ON cape_cod_restaurants(region);
CREATE INDEX IF NOT EXISTS idx_ccr_pos ON cape_cod_restaurants(pos_system);
CREATE INDEX IF NOT EXISTS idx_ccr_type ON cape_cod_restaurants(type);
CREATE INDEX IF NOT EXISTS idx_ccr_seasonal ON cape_cod_restaurants(seasonal);
CREATE INDEX IF NOT EXISTS idx_ccr_name ON cape_cod_restaurants(name);
CREATE INDEX IF NOT EXISTS idx_rlh_address ON restaurant_location_history(address);
CREATE INDEX IF NOT EXISTS idx_rlh_town ON restaurant_location_history(town);
CREATE INDEX IF NOT EXISTS idx_rlh_restaurant ON restaurant_location_history(current_restaurant_id);
