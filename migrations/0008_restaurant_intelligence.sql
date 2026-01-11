-- =====================================================
-- RESTAURANT INTELLIGENCE SYSTEM
-- =====================================================
-- Purpose: Comprehensive restaurant classification and lead management
-- Connects: Leads → Classification → POS Config → Quote → Menu Builder
-- =====================================================

-- =====================================================
-- PART 1: CLASSIFICATION TAXONOMY
-- =====================================================

-- Cuisine Types (hierarchical)
CREATE TABLE IF NOT EXISTS cuisine_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES cuisine_types(id),
  keywords TEXT, -- JSON array of keywords for auto-classification
  description TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Service Styles
CREATE TABLE IF NOT EXISTS service_styles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE, -- FSR, QSR, FC, FD, etc.
  description TEXT,
  typical_check_avg_min REAL,
  typical_check_avg_max REAL,
  typical_seat_turnover REAL, -- turns per hour
  needs_table_service INTEGER DEFAULT 0,
  needs_reservations INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Bar Programs
CREATE TABLE IF NOT EXISTS bar_programs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE, -- FULL, BW, NONE, CRAFT
  description TEXT,
  typical_liquor_skus INTEGER,
  typical_beer_taps INTEGER,
  typical_wine_btg INTEGER, -- by the glass
  needs_age_verification INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Menu Complexity Profiles
CREATE TABLE IF NOT EXISTS menu_complexity_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE, -- SIMPLE, MODERATE, COMPLEX, ULTRA
  description TEXT,
  typical_item_count_min INTEGER,
  typical_item_count_max INTEGER,
  typical_modifier_depth INTEGER, -- levels of nested modifiers
  typical_category_count INTEGER,
  needs_coursing INTEGER DEFAULT 0,
  needs_seat_routing INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Restaurant Type Templates (combinations)
CREATE TABLE IF NOT EXISTS restaurant_type_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, -- "Fine Dining Italian"
  slug TEXT UNIQUE,

  -- Classification links
  primary_cuisine_id TEXT REFERENCES cuisine_types(id),
  secondary_cuisine_id TEXT REFERENCES cuisine_types(id),
  service_style_id TEXT REFERENCES service_styles(id),
  bar_program_id TEXT REFERENCES bar_programs(id),
  menu_complexity_id TEXT REFERENCES menu_complexity_profiles(id),

  -- Operational defaults
  typical_seats_min INTEGER,
  typical_seats_max INTEGER,
  typical_staff_foh INTEGER,
  typical_staff_boh INTEGER,
  typical_hours_open TEXT, -- JSON: {"Mon": "11-22", "Tue": "11-22", ...}
  typical_days_closed TEXT, -- JSON array: ["Mon"]

  -- Meal periods (boolean flags)
  serves_breakfast INTEGER DEFAULT 0,
  serves_lunch INTEGER DEFAULT 1,
  serves_dinner INTEGER DEFAULT 1,
  serves_brunch INTEGER DEFAULT 0,
  serves_late_night INTEGER DEFAULT 0,

  -- Common features
  has_patio_common INTEGER DEFAULT 0,
  has_private_dining_common INTEGER DEFAULT 0,
  has_catering_common INTEGER DEFAULT 0,
  has_delivery_common INTEGER DEFAULT 0,
  has_takeout_common INTEGER DEFAULT 1,

  -- Auto-classification hints
  name_keywords TEXT, -- JSON array for matching company names
  domain_keywords TEXT, -- JSON array for matching domains

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- =====================================================
-- PART 2: POS CONFIGURATION TEMPLATES
-- =====================================================

CREATE TABLE IF NOT EXISTS pos_config_templates (
  id TEXT PRIMARY KEY,
  restaurant_type_id TEXT REFERENCES restaurant_type_templates(id),
  name TEXT NOT NULL,
  description TEXT,

  -- Hardware recommendations
  recommended_terminals_min INTEGER DEFAULT 1,
  recommended_terminals_max INTEGER DEFAULT 3,
  recommended_kds_screens INTEGER DEFAULT 1,
  recommended_kitchen_printers INTEGER DEFAULT 1,
  recommended_handhelds INTEGER DEFAULT 0,
  recommended_kiosks INTEGER DEFAULT 0,
  recommended_guest_display INTEGER DEFAULT 0,

  -- Software modules
  online_ordering_recommended INTEGER DEFAULT 1,
  loyalty_recommended INTEGER DEFAULT 0,
  gift_cards_recommended INTEGER DEFAULT 0,
  reservations_recommended INTEGER DEFAULT 0,
  catering_recommended INTEGER DEFAULT 0,
  inventory_recommended INTEGER DEFAULT 0,
  scheduling_recommended INTEGER DEFAULT 0,

  -- Configuration flags
  coursing_enabled INTEGER DEFAULT 0,
  seat_numbers_enabled INTEGER DEFAULT 0,
  table_management_enabled INTEGER DEFAULT 0,
  split_checks_enabled INTEGER DEFAULT 1,
  tips_enabled INTEGER DEFAULT 1,
  auto_gratuity_enabled INTEGER DEFAULT 0,

  -- Menu structure template
  default_menu_structure TEXT, -- JSON template for menu categories
  default_modifier_groups TEXT, -- JSON template for common modifiers

  -- Pricing guidance
  typical_implementation_cost_min REAL,
  typical_implementation_cost_max REAL,
  typical_monthly_software_cost REAL,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- =====================================================
-- PART 3: MASTER LEAD RECORDS (Prospects/Leads Database)
-- =====================================================
-- Note: Separate from 'restaurants' table which is for actual clients

CREATE TABLE IF NOT EXISTS restaurant_leads (
  id TEXT PRIMARY KEY,

  -- Basic identity
  name TEXT,
  dba_name TEXT, -- "doing business as"
  domain TEXT,

  -- Location
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'US',
  latitude REAL,
  longitude REAL,

  -- Contact
  primary_phone TEXT,
  primary_email TEXT,
  website_url TEXT,

  -- Social media (JSON object)
  social_links TEXT, -- {"facebook": "...", "instagram": "...", ...}

  -- Classification (links to templates)
  restaurant_type_id TEXT REFERENCES restaurant_type_templates(id),
  -- Override fields (when different from type template)
  cuisine_primary TEXT,
  cuisine_secondary TEXT,
  service_style TEXT,
  bar_program TEXT,
  menu_complexity TEXT,

  -- Actual operational data (when known)
  actual_seat_count INTEGER,
  actual_menu_item_count INTEGER,
  actual_staff_count INTEGER,
  actual_annual_revenue REAL,
  price_level INTEGER, -- 1-4 ($ to $$$$)

  -- Technology stack
  current_pos TEXT, -- Current POS provider
  current_pos_confidence REAL, -- 0-1 confidence in detection
  current_pos_detected_at INTEGER,
  online_ordering_provider TEXT,
  reservation_provider TEXT,
  loyalty_provider TEXT,
  payroll_provider TEXT,

  -- Lead/Client status
  status TEXT DEFAULT 'prospect', -- prospect, lead, qualified, opportunity, client, former_client, churned
  lead_score INTEGER DEFAULT 0,
  lead_temperature TEXT, -- cold, warm, hot

  -- Source tracking
  source TEXT, -- builtwith, hubspot, manual, referral, website, etc.
  source_id TEXT, -- ID in source system
  source_file TEXT, -- Original import file

  -- Enrichment tracking
  enriched_at INTEGER,
  enrichment_source TEXT, -- google_places, yelp, manual, ai
  enrichment_confidence REAL,

  -- External IDs
  hubspot_id TEXT,
  google_place_id TEXT,
  yelp_id TEXT,

  -- Conversion tracking
  converted_to_client_id TEXT, -- Links to clients table when converted

  -- Metadata
  notes TEXT,
  tags TEXT, -- JSON array of tags

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  last_contacted_at INTEGER,
  last_activity_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_leads_domain ON restaurant_leads(domain);
CREATE INDEX IF NOT EXISTS idx_leads_state ON restaurant_leads(state);
CREATE INDEX IF NOT EXISTS idx_leads_status ON restaurant_leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_current_pos ON restaurant_leads(current_pos);
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON restaurant_leads(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_type ON restaurant_leads(restaurant_type_id);

-- =====================================================
-- PART 4: LEAD SEGMENTS (DYNAMIC)
-- =====================================================

CREATE TABLE IF NOT EXISTS lead_segments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,

  -- Segment criteria (flexible JSON)
  criteria TEXT NOT NULL, -- JSON: {"current_pos": ["Clover", "Square"], "state": ["MA", "RI"]}

  -- Auto-assignment rules
  auto_assign INTEGER DEFAULT 1,
  assignment_priority INTEGER DEFAULT 0, -- Higher = checked first

  -- Linked email sequence
  email_sequence_id TEXT REFERENCES email_sequences(id),

  -- Stats (updated by triggers/jobs)
  member_count INTEGER DEFAULT 0,
  last_calculated_at INTEGER,

  -- Status
  status TEXT DEFAULT 'active',

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Segment membership (many-to-many)
CREATE TABLE IF NOT EXISTS lead_segment_members (
  id TEXT PRIMARY KEY,
  segment_id TEXT NOT NULL REFERENCES lead_segments(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL REFERENCES restaurant_leads(id) ON DELETE CASCADE,

  -- Assignment info
  assigned_at INTEGER DEFAULT (unixepoch()),
  assigned_by TEXT, -- 'auto', 'manual', or user_id

  -- Segment-specific score
  segment_score INTEGER DEFAULT 0,

  -- Status within segment
  status TEXT DEFAULT 'active', -- active, paused, completed, unsubscribed

  -- Email sequence progress
  sequence_step INTEGER DEFAULT 0,
  last_email_at INTEGER,
  next_email_at INTEGER,

  UNIQUE(segment_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_segment_members_segment ON lead_segment_members(segment_id);
CREATE INDEX IF NOT EXISTS idx_lead_segment_members_lead ON lead_segment_members(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_segment_members_status ON lead_segment_members(status);

-- =====================================================
-- PART 5: LEAD CONTACTS
-- =====================================================

CREATE TABLE IF NOT EXISTS lead_contacts (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES restaurant_leads(id) ON DELETE CASCADE,

  -- Identity
  first_name TEXT,
  last_name TEXT,
  title TEXT, -- Owner, GM, Manager, etc.

  -- Contact info
  email TEXT,
  phone TEXT,
  preferred_contact_method TEXT, -- email, phone, text

  -- Relationship
  is_primary INTEGER DEFAULT 0,
  is_decision_maker INTEGER DEFAULT 0,

  -- External IDs
  hubspot_contact_id TEXT,

  -- Status
  status TEXT DEFAULT 'active',

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_lead_contacts_lead ON lead_contacts(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_contacts_email ON lead_contacts(email);

-- =====================================================
-- PART 6: LEAD ACTIVITY LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS lead_activity_log (
  id TEXT PRIMARY KEY,
  lead_id TEXT REFERENCES restaurant_leads(id),
  contact_id TEXT REFERENCES lead_contacts(id),

  -- Activity type
  activity_type TEXT NOT NULL, -- email_sent, email_opened, call, meeting, note, status_change, etc.

  -- Details
  subject TEXT,
  description TEXT,
  metadata TEXT, -- JSON for additional data

  -- Attribution
  performed_by TEXT,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_lead_activity_lead ON lead_activity_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_type ON lead_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_lead_activity_created ON lead_activity_log(created_at DESC);

-- =====================================================
-- SEED DATA: Classification Taxonomy
-- =====================================================

-- Cuisine Types (primary level)
INSERT OR IGNORE INTO cuisine_types (id, name, keywords) VALUES
('american', 'American', '["american","burgers","sandwiches","comfort food","diner"]'),
('italian', 'Italian', '["italian","pizza","pasta","trattoria","ristorante"]'),
('mexican', 'Mexican', '["mexican","tacos","burritos","cantina","taqueria"]'),
('asian', 'Asian', '["asian","fusion"]'),
('chinese', 'Chinese', '["chinese","dim sum","szechuan","cantonese"]'),
('japanese', 'Japanese', '["japanese","sushi","ramen","izakaya","hibachi"]'),
('thai', 'Thai', '["thai"]'),
('indian', 'Indian', '["indian","curry","tandoor"]'),
('mediterranean', 'Mediterranean', '["mediterranean","greek","lebanese","turkish"]'),
('french', 'French', '["french","bistro","brasserie","cafe"]'),
('seafood', 'Seafood', '["seafood","oyster","fish","lobster","crab","shrimp"]'),
('steakhouse', 'Steakhouse', '["steakhouse","steak","chophouse","grill"]'),
('bbq', 'BBQ/Smokehouse', '["bbq","barbecue","smokehouse","ribs","brisket"]'),
('southern', 'Southern/Soul', '["southern","soul food","cajun","creole"]'),
('cafe', 'Cafe/Coffee', '["cafe","coffee","espresso","bakery"]'),
('brewery', 'Brewery/Brewpub', '["brewery","brewpub","taproom","craft beer"]'),
('bar', 'Bar/Pub', '["bar","pub","tavern","saloon","lounge"]'),
('wine_bar', 'Wine Bar', '["wine bar","wine","enoteca"]'),
('food_truck', 'Food Truck', '["food truck","mobile"]'),
('catering', 'Catering', '["catering","events"]');

-- Service Styles
INSERT OR IGNORE INTO service_styles (id, name, code, description, typical_check_avg_min, typical_check_avg_max, typical_seat_turnover, needs_table_service, needs_reservations) VALUES
('fine_dining', 'Fine Dining', 'FD', 'High-end, formal service with extensive wine program', 75, 250, 0.5, 1, 1),
('upscale_casual', 'Upscale Casual', 'UC', 'Quality food and service in relaxed atmosphere', 35, 75, 1.0, 1, 1),
('full_service', 'Full Service Casual', 'FSR', 'Traditional sit-down restaurant with table service', 15, 40, 1.5, 1, 0),
('fast_casual', 'Fast Casual', 'FC', 'Counter order, food brought to table or pickup', 12, 25, 3.0, 0, 0),
('quick_service', 'Quick Service/QSR', 'QSR', 'Counter service, self-service, high volume', 8, 15, 6.0, 0, 0),
('counter', 'Counter Service', 'CTR', 'Order at counter, minimal table service', 10, 20, 4.0, 0, 0),
('bar', 'Bar/Lounge', 'BAR', 'Primarily beverage service with food options', 20, 50, 2.0, 1, 0),
('food_hall', 'Food Hall/Court', 'FH', 'Multiple vendors, shared seating', 12, 25, 4.0, 0, 0);

-- Bar Programs
INSERT OR IGNORE INTO bar_programs (id, name, code, description, typical_liquor_skus, typical_beer_taps, typical_wine_btg, needs_age_verification) VALUES
('full_bar', 'Full Bar', 'FULL', 'Complete liquor, beer, and wine program', 100, 12, 15, 1),
('craft_bar', 'Craft/Cocktail Bar', 'CRAFT', 'Specialty cocktails, extensive spirits', 150, 8, 20, 1),
('beer_wine', 'Beer & Wine Only', 'BW', 'No hard liquor', 0, 16, 20, 1),
('beer_only', 'Beer Only', 'BEER', 'Brewery or beer-focused venue', 0, 24, 0, 1),
('wine_focus', 'Wine Focused', 'WINE', 'Extensive wine program, limited beer/spirits', 20, 4, 40, 1),
('none', 'No Alcohol', 'NONE', 'Non-alcoholic only', 0, 0, 0, 0);

-- Menu Complexity
INSERT OR IGNORE INTO menu_complexity_profiles (id, name, code, description, typical_item_count_min, typical_item_count_max, typical_modifier_depth, typical_category_count, needs_coursing, needs_seat_routing) VALUES
('simple', 'Simple', 'SIMPLE', 'Limited menu, few modifiers', 15, 40, 1, 5, 0, 0),
('moderate', 'Moderate', 'MOD', 'Standard restaurant menu', 40, 100, 2, 10, 0, 0),
('complex', 'Complex', 'COMPLEX', 'Extensive menu with many options', 100, 200, 3, 15, 1, 0),
('ultra', 'Ultra Complex', 'ULTRA', 'Fine dining or highly customizable', 80, 150, 4, 12, 1, 1);

-- Restaurant Type Templates (common combinations)
INSERT OR IGNORE INTO restaurant_type_templates (id, name, slug, primary_cuisine_id, service_style_id, bar_program_id, menu_complexity_id, typical_seats_min, typical_seats_max, serves_breakfast, serves_lunch, serves_dinner, name_keywords) VALUES
('fine_italian', 'Fine Dining Italian', 'fine-dining-italian', 'italian', 'fine_dining', 'full_bar', 'complex', 60, 120, 0, 0, 1, '["ristorante","trattoria fine"]'),
('casual_italian', 'Casual Italian', 'casual-italian', 'italian', 'full_service', 'beer_wine', 'moderate', 80, 150, 0, 1, 1, '["italian","pizza","pasta"]'),
('fast_casual_mexican', 'Fast Casual Mexican', 'fast-casual-mexican', 'mexican', 'fast_casual', 'beer_wine', 'moderate', 40, 80, 0, 1, 1, '["taqueria","tacos","burrito"]'),
('upscale_steakhouse', 'Upscale Steakhouse', 'upscale-steakhouse', 'steakhouse', 'upscale_casual', 'full_bar', 'complex', 100, 200, 0, 0, 1, '["steakhouse","chophouse","prime"]'),
('casual_american', 'Casual American', 'casual-american', 'american', 'full_service', 'full_bar', 'moderate', 80, 150, 0, 1, 1, '["grill","american","tavern"]'),
('qsr_burger', 'QSR Burger Joint', 'qsr-burger', 'american', 'quick_service', 'none', 'simple', 30, 60, 0, 1, 1, '["burger","burgers"]'),
('sushi_bar', 'Sushi Bar', 'sushi-bar', 'japanese', 'full_service', 'beer_wine', 'complex', 40, 80, 0, 1, 1, '["sushi","japanese","ramen"]'),
('brewpub', 'Brewpub', 'brewpub', 'brewery', 'full_service', 'beer_only', 'moderate', 100, 200, 0, 1, 1, '["brewery","brewing","brewpub","taproom"]'),
('wine_bistro', 'Wine Bistro', 'wine-bistro', 'french', 'upscale_casual', 'wine_focus', 'moderate', 50, 100, 0, 1, 1, '["wine bar","bistro","enoteca"]'),
('seafood_casual', 'Casual Seafood', 'casual-seafood', 'seafood', 'full_service', 'full_bar', 'moderate', 100, 200, 0, 1, 1, '["seafood","oyster","fish","lobster"]'),
('bbq_smokehouse', 'BBQ/Smokehouse', 'bbq-smokehouse', 'bbq', 'counter', 'beer_wine', 'simple', 80, 150, 0, 1, 1, '["bbq","smokehouse","ribs","brisket"]'),
('coffee_cafe', 'Coffee/Cafe', 'coffee-cafe', 'cafe', 'counter', 'none', 'simple', 20, 50, 1, 1, 0, '["cafe","coffee","bakery","espresso"]'),
('sports_bar', 'Sports Bar', 'sports-bar', 'bar', 'bar', 'full_bar', 'simple', 100, 200, 0, 1, 1, '["sports bar","sports grill","wings"]');

-- POS Configuration Templates
INSERT OR IGNORE INTO pos_config_templates (id, restaurant_type_id, name, recommended_terminals_min, recommended_terminals_max, recommended_kds_screens, recommended_kitchen_printers, recommended_handhelds, coursing_enabled, seat_numbers_enabled, table_management_enabled, online_ordering_recommended, reservations_recommended, typical_implementation_cost_min, typical_implementation_cost_max) VALUES
('config_fine_dining', 'fine_italian', 'Fine Dining Standard', 2, 4, 2, 2, 4, 1, 1, 1, 0, 1, 5000, 12000),
('config_casual_fsr', 'casual_italian', 'Casual FSR Standard', 2, 3, 1, 2, 2, 0, 0, 1, 1, 0, 3500, 7000),
('config_fast_casual', 'fast_casual_mexican', 'Fast Casual Standard', 2, 3, 1, 1, 0, 0, 0, 0, 1, 0, 2500, 5000),
('config_qsr', 'qsr_burger', 'QSR High Volume', 3, 5, 2, 2, 0, 0, 0, 0, 1, 0, 4000, 8000),
('config_bar', 'sports_bar', 'Bar/Lounge Standard', 2, 4, 1, 1, 2, 0, 0, 0, 0, 0, 3000, 6000),
('config_cafe', 'coffee_cafe', 'Cafe Minimal', 1, 2, 0, 1, 0, 0, 0, 0, 1, 0, 1500, 3000);

-- Pre-defined Lead Segments
INSERT OR IGNORE INTO lead_segments (id, name, slug, description, criteria, assignment_priority, email_sequence_id) VALUES
('seg_switcher_clover', 'Clover Switchers', 'clover-switchers', 'Restaurants currently using Clover POS', '{"current_pos": ["Clover"]}', 100, 'seq_pos_switcher_001'),
('seg_switcher_square', 'Square Switchers', 'square-switchers', 'Restaurants currently using Square POS', '{"current_pos": ["Square", "Square Point of Sale"]}', 100, 'seq_pos_switcher_001'),
('seg_switcher_upserve', 'Upserve Switchers', 'upserve-switchers', 'Restaurants currently using Upserve POS', '{"current_pos": ["Upserve"]}', 100, 'seq_pos_switcher_001'),
('seg_toast_upcoming', 'Toast Upcoming', 'toast-upcoming', 'Restaurants with Toast implementations scheduled', '{"current_pos": ["Toast (upcoming)", "Toast;Toast (upcoming)"]}', 90, 'seq_toast_support_001'),
('seg_toast_existing', 'Toast Existing', 'toast-existing', 'Active Toast users', '{"current_pos": ["Toast"]}', 80, 'seq_toast_support_001'),
('seg_local_ma', 'Massachusetts Local', 'massachusetts-local', 'All MA-based restaurants', '{"state": ["MA"]}', 70, NULL),
('seg_local_capecod', 'Cape Cod Local', 'cape-cod-local', 'Cape Cod area restaurants (Barnstable County)', '{"state": ["MA"], "zip_prefix": ["025", "026"]}', 95, 'seq_local_network_001'),
('seg_high_value', 'High Value Leads', 'high-value', 'Leads with score >= 80', '{"lead_score_min": 80}', 85, NULL),
('seg_contactable', 'Contactable', 'contactable', 'Leads with valid email and phone', '{"has_email": true, "has_phone": true}', 60, NULL);
