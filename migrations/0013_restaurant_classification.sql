-- Migration: Restaurant Classification System for Toast ABO
-- Purpose: AI-powered restaurant classification to determine optimal Toast configurations
-- Created: 2026-01-07

-- ============================================
-- CONFIGURATION TEMPLATES
-- ============================================

-- Toast configuration templates per restaurant type
CREATE TABLE IF NOT EXISTS toast_config_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,

  -- Matching criteria (JSON)
  -- { "service_styles": ["counter", "quick_service"], "establishment_types": ["cafe", "fast_casual"] }
  applies_to_json TEXT NOT NULL,

  -- Menu structure configuration
  menu_structure_json TEXT NOT NULL,
  -- {
  --   "use_dayparts": false,
  --   "modifier_complexity": "simple|medium|complex",
  --   "default_categories": ["Drinks", "Food"],
  --   "use_size_variants": true,
  --   "use_temp_variants": true
  -- }

  -- KDS configuration
  kds_config_json TEXT NOT NULL,
  -- {
  --   "station_count": 2,
  --   "routing_logic": "simple|course_based|prep_station",
  --   "expo_station": true,
  --   "default_stations": ["Kitchen", "Expo"]
  -- }

  -- Order flow configuration
  order_flow_json TEXT NOT NULL,
  -- {
  --   "require_table_number": true,
  --   "require_guest_count": true,
  --   "use_coursing": true,
  --   "auto_close_tabs": false,
  --   "default_order_type": "dine_in"
  -- }

  -- Modifier rules (reference or embedded)
  modifier_rules_json TEXT,

  priority INTEGER DEFAULT 0,  -- Higher = matched first
  is_active INTEGER DEFAULT 1,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_config_templates_active ON toast_config_templates(is_active);

-- ============================================
-- RESTAURANT CLASSIFICATIONS
-- ============================================

-- AI-powered restaurant classification
CREATE TABLE IF NOT EXISTS restaurant_classifications (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  restaurant_id TEXT,

  -- Primary classification
  service_style TEXT CHECK (service_style IN ('counter', 'full_service', 'hybrid', 'quick_service')),
  establishment_type TEXT CHECK (establishment_type IN (
    'cafe', 'coffee_shop', 'bar', 'cocktail_bar', 'wine_bar', 'brewery', 'nightclub',
    'fine_dining', 'casual_dining', 'fast_casual', 'quick_service', 'food_truck',
    'pizzeria', 'deli', 'bakery', 'ice_cream', 'juice_bar', 'other'
  )),
  beverage_focus TEXT CHECK (beverage_focus IN ('coffee', 'cocktail', 'wine', 'beer', 'mixed', 'non_alcoholic', 'none')),

  -- Secondary attributes
  cuisine_types_json TEXT,  -- ["american", "italian", "mexican"]
  hours_pattern TEXT CHECK (hours_pattern IN ('breakfast_lunch', 'lunch_dinner', 'dinner_only', 'late_night', 'all_day', 'variable')),
  volume_level TEXT CHECK (volume_level IN ('low', 'medium', 'high', 'very_high')),
  price_point TEXT CHECK (price_point IN ('budget', 'moderate', 'upscale', 'fine_dining')),

  -- Service characteristics
  has_bar INTEGER DEFAULT 0,
  has_patio INTEGER DEFAULT 0,
  has_delivery INTEGER DEFAULT 0,
  has_takeout INTEGER DEFAULT 1,
  has_reservations INTEGER DEFAULT 0,
  avg_party_size REAL,
  avg_ticket_time_minutes INTEGER,

  -- AI analysis metadata
  classification_confidence INTEGER CHECK (classification_confidence BETWEEN 0 AND 100),
  data_sources_json TEXT,  -- ["website", "google_business", "menu_analysis", "user_input"]
  ai_analysis_json TEXT,   -- Full AI response for debugging/reference
  ai_model_used TEXT,      -- "claude-sonnet-4-20250514" etc.

  -- Resulting configuration
  config_template_id TEXT REFERENCES toast_config_templates(id),
  custom_overrides_json TEXT,  -- Any manual overrides to template

  -- Manual review
  is_manual_override INTEGER DEFAULT 0,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  review_notes TEXT,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),

  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_classifications_client ON restaurant_classifications(client_id);
CREATE INDEX IF NOT EXISTS idx_classifications_template ON restaurant_classifications(config_template_id);
CREATE INDEX IF NOT EXISTS idx_classifications_type ON restaurant_classifications(establishment_type);

-- ============================================
-- MODIFIER RULES
-- ============================================

-- Modifier rules for automatic modifier creation (Martini/Manhattan logic)
CREATE TABLE IF NOT EXISTS modifier_rules (
  id TEXT PRIMARY KEY,
  template_id TEXT REFERENCES toast_config_templates(id) ON DELETE CASCADE,

  -- Rule identification
  rule_name TEXT NOT NULL,  -- "Martini Spirit Choice"
  rule_description TEXT,
  rule_category TEXT CHECK (rule_category IN ('cocktail', 'coffee', 'food', 'general')),

  -- Trigger conditions
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('item_name', 'category', 'tag', 'ingredient')),
  trigger_pattern TEXT NOT NULL,  -- Regex or keywords: "martini|dirty martini|classic martini"
  trigger_case_sensitive INTEGER DEFAULT 0,

  -- Modifier group to create
  modifier_group_name TEXT NOT NULL,  -- "Spirit Choice"
  modifier_group_type TEXT DEFAULT 'single' CHECK (modifier_group_type IN ('single', 'multi', 'quantity')),
  modifier_min_selections INTEGER DEFAULT 1,
  modifier_max_selections INTEGER DEFAULT 1,

  -- Modifier options (JSON array)
  modifier_options_json TEXT NOT NULL,
  -- [
  --   { "name": "Gin", "price": 0, "is_default": true },
  --   { "name": "Vodka", "price": 0, "is_default": false },
  --   { "name": "Premium Gin (+$3)", "price": 3.00, "is_default": false }
  -- ]

  -- Pricing rules
  price_inclusion TEXT DEFAULT 'included' CHECK (price_inclusion IN ('included', 'add_on', 'replacement')),

  -- Application rules
  priority INTEGER DEFAULT 0,  -- Higher = applied first (for conflict resolution)
  is_required INTEGER DEFAULT 1,
  apply_to_variants INTEGER DEFAULT 1,  -- Apply to size variants too

  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_modifier_rules_template ON modifier_rules(template_id);
CREATE INDEX IF NOT EXISTS idx_modifier_rules_category ON modifier_rules(rule_category);
CREATE INDEX IF NOT EXISTS idx_modifier_rules_active ON modifier_rules(is_active);

-- ============================================
-- CLASSIFICATION HISTORY
-- ============================================

-- Track classification changes over time
CREATE TABLE IF NOT EXISTS classification_history (
  id TEXT PRIMARY KEY,
  classification_id TEXT NOT NULL REFERENCES restaurant_classifications(id) ON DELETE CASCADE,

  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'ai_updated', 'manual_override', 'template_changed')),
  previous_values_json TEXT,
  new_values_json TEXT,

  changed_by TEXT,  -- 'ai' or user ID
  change_reason TEXT,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_classification_history_class ON classification_history(classification_id);

-- ============================================
-- SEED CONFIGURATION TEMPLATES
-- ============================================

-- Counter Service Cafe (Coffee shops, juice bars)
INSERT OR IGNORE INTO toast_config_templates (
  id, name, description, applies_to_json, menu_structure_json, kds_config_json, order_flow_json, priority
) VALUES (
  'tmpl_counter_cafe',
  'Counter Service Cafe',
  'Coffee shops, juice bars, bakeries with counter service',
  '{"service_styles": ["counter", "quick_service"], "establishment_types": ["cafe", "coffee_shop", "juice_bar", "bakery"]}',
  '{"use_dayparts": false, "modifier_complexity": "medium", "default_categories": ["Hot Drinks", "Cold Drinks", "Pastries", "Food"], "use_size_variants": true, "use_temp_variants": true}',
  '{"station_count": 1, "routing_logic": "simple", "expo_station": false, "default_stations": ["Bar"]}',
  '{"require_table_number": false, "require_guest_count": false, "use_coursing": false, "auto_close_tabs": true, "default_order_type": "counter"}',
  100
);

-- Cocktail Bar
INSERT OR IGNORE INTO toast_config_templates (
  id, name, description, applies_to_json, menu_structure_json, kds_config_json, order_flow_json, priority
) VALUES (
  'tmpl_cocktail_bar',
  'Cocktail Bar',
  'Upscale cocktail bars, speakeasies with complex drink modifiers',
  '{"service_styles": ["full_service", "hybrid"], "establishment_types": ["bar", "cocktail_bar"], "beverage_focus": ["cocktail"]}',
  '{"use_dayparts": false, "modifier_complexity": "complex", "default_categories": ["Cocktails", "Spirits", "Wine", "Beer", "Non-Alcoholic", "Snacks"], "use_size_variants": false, "use_temp_variants": false}',
  '{"station_count": 2, "routing_logic": "simple", "expo_station": false, "default_stations": ["Bar", "Kitchen"]}',
  '{"require_table_number": true, "require_guest_count": false, "use_coursing": false, "auto_close_tabs": false, "default_order_type": "bar_tab"}',
  90
);

-- Casual Dining Restaurant
INSERT OR IGNORE INTO toast_config_templates (
  id, name, description, applies_to_json, menu_structure_json, kds_config_json, order_flow_json, priority
) VALUES (
  'tmpl_casual_dining',
  'Casual Dining Restaurant',
  'Full-service casual restaurants with moderate complexity',
  '{"service_styles": ["full_service"], "establishment_types": ["casual_dining", "pizzeria"]}',
  '{"use_dayparts": true, "modifier_complexity": "medium", "default_categories": ["Appetizers", "Salads", "Entrees", "Desserts", "Drinks"], "use_size_variants": true, "use_temp_variants": true}',
  '{"station_count": 3, "routing_logic": "course_based", "expo_station": true, "default_stations": ["Hot Line", "Cold Prep", "Expo"]}',
  '{"require_table_number": true, "require_guest_count": true, "use_coursing": true, "auto_close_tabs": false, "default_order_type": "dine_in"}',
  80
);

-- Fine Dining
INSERT OR IGNORE INTO toast_config_templates (
  id, name, description, applies_to_json, menu_structure_json, kds_config_json, order_flow_json, priority
) VALUES (
  'tmpl_fine_dining',
  'Fine Dining',
  'Upscale restaurants with coursing, complex service flow',
  '{"service_styles": ["full_service"], "establishment_types": ["fine_dining"], "price_point": ["upscale", "fine_dining"]}',
  '{"use_dayparts": true, "modifier_complexity": "complex", "default_categories": ["Amuse", "First Course", "Second Course", "Main", "Dessert", "Cheese", "Cocktails", "Wine"], "use_size_variants": false, "use_temp_variants": true}',
  '{"station_count": 4, "routing_logic": "course_based", "expo_station": true, "default_stations": ["Hot Line", "Cold Prep", "Pastry", "Expo"]}',
  '{"require_table_number": true, "require_guest_count": true, "use_coursing": true, "auto_close_tabs": false, "default_order_type": "dine_in"}',
  95
);

-- Fast Casual
INSERT OR IGNORE INTO toast_config_templates (
  id, name, description, applies_to_json, menu_structure_json, kds_config_json, order_flow_json, priority
) VALUES (
  'tmpl_fast_casual',
  'Fast Casual',
  'Build-your-own style restaurants (Chipotle, Sweetgreen model)',
  '{"service_styles": ["counter", "quick_service", "hybrid"], "establishment_types": ["fast_casual"]}',
  '{"use_dayparts": false, "modifier_complexity": "complex", "default_categories": ["Bowls", "Wraps", "Salads", "Sides", "Drinks"], "use_size_variants": true, "use_temp_variants": false}',
  '{"station_count": 2, "routing_logic": "prep_station", "expo_station": true, "default_stations": ["Make Line", "Expo"]}',
  '{"require_table_number": false, "require_guest_count": false, "use_coursing": false, "auto_close_tabs": true, "default_order_type": "counter"}',
  85
);

-- Brewery/Taproom
INSERT OR IGNORE INTO toast_config_templates (
  id, name, description, applies_to_json, menu_structure_json, kds_config_json, order_flow_json, priority
) VALUES (
  'tmpl_brewery',
  'Brewery / Taproom',
  'Breweries and taprooms with beer focus',
  '{"service_styles": ["counter", "hybrid"], "establishment_types": ["brewery"], "beverage_focus": ["beer"]}',
  '{"use_dayparts": false, "modifier_complexity": "simple", "default_categories": ["On Tap", "Cans/Bottles", "Flights", "Food", "Merch"], "use_size_variants": true, "use_temp_variants": false}',
  '{"station_count": 2, "routing_logic": "simple", "expo_station": false, "default_stations": ["Bar", "Kitchen"]}',
  '{"require_table_number": false, "require_guest_count": false, "use_coursing": false, "auto_close_tabs": false, "default_order_type": "bar_tab"}',
  75
);

-- Quick Service / Fast Food
INSERT OR IGNORE INTO toast_config_templates (
  id, name, description, applies_to_json, menu_structure_json, kds_config_json, order_flow_json, priority
) VALUES (
  'tmpl_quick_service',
  'Quick Service',
  'Traditional fast food operations',
  '{"service_styles": ["counter", "quick_service"], "establishment_types": ["quick_service"]}',
  '{"use_dayparts": true, "modifier_complexity": "simple", "default_categories": ["Combos", "Burgers", "Sides", "Drinks", "Desserts"], "use_size_variants": true, "use_temp_variants": false}',
  '{"station_count": 2, "routing_logic": "simple", "expo_station": true, "default_stations": ["Kitchen", "Expo"]}',
  '{"require_table_number": false, "require_guest_count": false, "use_coursing": false, "auto_close_tabs": true, "default_order_type": "counter"}',
  70
);

-- Wine Bar
INSERT OR IGNORE INTO toast_config_templates (
  id, name, description, applies_to_json, menu_structure_json, kds_config_json, order_flow_json, priority
) VALUES (
  'tmpl_wine_bar',
  'Wine Bar',
  'Wine-focused establishments',
  '{"service_styles": ["full_service", "hybrid"], "establishment_types": ["wine_bar"], "beverage_focus": ["wine"]}',
  '{"use_dayparts": false, "modifier_complexity": "medium", "default_categories": ["Wine by Glass", "Wine by Bottle", "Flights", "Cheese & Charcuterie", "Small Plates"], "use_size_variants": false, "use_temp_variants": false}',
  '{"station_count": 2, "routing_logic": "simple", "expo_station": false, "default_stations": ["Bar", "Kitchen"]}',
  '{"require_table_number": true, "require_guest_count": false, "use_coursing": false, "auto_close_tabs": false, "default_order_type": "dine_in"}',
  85
);

-- ============================================
-- SEED MODIFIER RULES (Cocktail Logic)
-- ============================================

-- Martini - Spirit Choice
INSERT OR IGNORE INTO modifier_rules (
  id, template_id, rule_name, rule_description, rule_category,
  trigger_type, trigger_pattern,
  modifier_group_name, modifier_group_type,
  modifier_options_json, is_required, priority
) VALUES (
  'rule_martini_spirit',
  'tmpl_cocktail_bar',
  'Martini Spirit Choice',
  'Adds Gin/Vodka selection for martini variations',
  'cocktail',
  'item_name',
  '(?i)martini|dirty martini|classic martini|vesper',
  'Spirit',
  'single',
  '[{"name": "Gin", "price": 0, "is_default": true}, {"name": "Vodka", "price": 0, "is_default": false}]',
  1,
  100
);

-- Martini - Style
INSERT OR IGNORE INTO modifier_rules (
  id, template_id, rule_name, rule_description, rule_category,
  trigger_type, trigger_pattern,
  modifier_group_name, modifier_group_type,
  modifier_options_json, is_required, priority
) VALUES (
  'rule_martini_style',
  'tmpl_cocktail_bar',
  'Martini Style',
  'Dry/wet/dirty preferences for martinis',
  'cocktail',
  'item_name',
  '(?i)martini',
  'Style',
  'single',
  '[{"name": "Classic", "price": 0, "is_default": true}, {"name": "Dry", "price": 0, "is_default": false}, {"name": "Extra Dry", "price": 0, "is_default": false}, {"name": "Wet", "price": 0, "is_default": false}, {"name": "Dirty", "price": 1.00, "is_default": false}, {"name": "Filthy", "price": 2.00, "is_default": false}]',
  0,
  90
);

-- Manhattan - Whiskey Choice
INSERT OR IGNORE INTO modifier_rules (
  id, template_id, rule_name, rule_description, rule_category,
  trigger_type, trigger_pattern,
  modifier_group_name, modifier_group_type,
  modifier_options_json, is_required, priority
) VALUES (
  'rule_manhattan_whiskey',
  'tmpl_cocktail_bar',
  'Manhattan Whiskey Choice',
  'Rye/Bourbon selection for Manhattan',
  'cocktail',
  'item_name',
  '(?i)manhattan|perfect manhattan',
  'Whiskey',
  'single',
  '[{"name": "Rye", "price": 0, "is_default": true}, {"name": "Bourbon", "price": 0, "is_default": false}]',
  1,
  100
);

-- Old Fashioned - Whiskey Choice
INSERT OR IGNORE INTO modifier_rules (
  id, template_id, rule_name, rule_description, rule_category,
  trigger_type, trigger_pattern,
  modifier_group_name, modifier_group_type,
  modifier_options_json, is_required, priority
) VALUES (
  'rule_oldfashioned_whiskey',
  'tmpl_cocktail_bar',
  'Old Fashioned Whiskey',
  'Whiskey selection for Old Fashioned',
  'cocktail',
  'item_name',
  '(?i)old fashioned|oldfashioned',
  'Whiskey',
  'single',
  '[{"name": "Bourbon", "price": 0, "is_default": true}, {"name": "Rye", "price": 0, "is_default": false}, {"name": "Scotch (+$2)", "price": 2.00, "is_default": false}]',
  1,
  100
);

-- Margarita - Style
INSERT OR IGNORE INTO modifier_rules (
  id, template_id, rule_name, rule_description, rule_category,
  trigger_type, trigger_pattern,
  modifier_group_name, modifier_group_type,
  modifier_options_json, is_required, priority
) VALUES (
  'rule_margarita_style',
  'tmpl_cocktail_bar',
  'Margarita Style',
  'Rocks/frozen/up for margaritas',
  'cocktail',
  'item_name',
  '(?i)margarita',
  'Style',
  'single',
  '[{"name": "On the Rocks", "price": 0, "is_default": true}, {"name": "Frozen", "price": 0, "is_default": false}, {"name": "Up", "price": 0, "is_default": false}]',
  1,
  100
);

-- Margarita - Salt Rim
INSERT OR IGNORE INTO modifier_rules (
  id, template_id, rule_name, rule_description, rule_category,
  trigger_type, trigger_pattern,
  modifier_group_name, modifier_group_type,
  modifier_options_json, is_required, priority
) VALUES (
  'rule_margarita_rim',
  'tmpl_cocktail_bar',
  'Margarita Rim',
  'Salt rim options for margaritas',
  'cocktail',
  'item_name',
  '(?i)margarita',
  'Rim',
  'single',
  '[{"name": "Salt Rim", "price": 0, "is_default": true}, {"name": "No Salt", "price": 0, "is_default": false}, {"name": "Tajin Rim", "price": 0.50, "is_default": false}]',
  0,
  80
);

-- Coffee - Size (for cafe template)
INSERT OR IGNORE INTO modifier_rules (
  id, template_id, rule_name, rule_description, rule_category,
  trigger_type, trigger_pattern,
  modifier_group_name, modifier_group_type,
  modifier_options_json, is_required, priority
) VALUES (
  'rule_coffee_size',
  'tmpl_counter_cafe',
  'Coffee Size',
  'Size options for coffee drinks',
  'coffee',
  'category',
  '(?i)hot drinks|cold drinks|espresso|coffee',
  'Size',
  'single',
  '[{"name": "Small (12oz)", "price": 0, "is_default": false}, {"name": "Medium (16oz)", "price": 0.75, "is_default": true}, {"name": "Large (20oz)", "price": 1.50, "is_default": false}]',
  1,
  100
);

-- Coffee - Milk Choice
INSERT OR IGNORE INTO modifier_rules (
  id, template_id, rule_name, rule_description, rule_category,
  trigger_type, trigger_pattern,
  modifier_group_name, modifier_group_type,
  modifier_options_json, is_required, priority
) VALUES (
  'rule_coffee_milk',
  'tmpl_counter_cafe',
  'Milk Choice',
  'Milk options for lattes, cappuccinos, etc.',
  'coffee',
  'item_name',
  '(?i)latte|cappuccino|flat white|cortado|macchiato|mocha',
  'Milk',
  'single',
  '[{"name": "Whole Milk", "price": 0, "is_default": true}, {"name": "2% Milk", "price": 0, "is_default": false}, {"name": "Skim Milk", "price": 0, "is_default": false}, {"name": "Oat Milk", "price": 0.75, "is_default": false}, {"name": "Almond Milk", "price": 0.75, "is_default": false}, {"name": "Soy Milk", "price": 0.50, "is_default": false}]',
  1,
  90
);

-- Temperature modifier for food
INSERT OR IGNORE INTO modifier_rules (
  id, template_id, rule_name, rule_description, rule_category,
  trigger_type, trigger_pattern,
  modifier_group_name, modifier_group_type,
  modifier_options_json, is_required, priority
) VALUES (
  'rule_steak_temp',
  'tmpl_casual_dining',
  'Steak Temperature',
  'Temperature for steaks and burgers',
  'food',
  'item_name',
  '(?i)steak|ribeye|filet|sirloin|burger|patty melt',
  'Temperature',
  'single',
  '[{"name": "Rare", "price": 0, "is_default": false}, {"name": "Medium Rare", "price": 0, "is_default": true}, {"name": "Medium", "price": 0, "is_default": false}, {"name": "Medium Well", "price": 0, "is_default": false}, {"name": "Well Done", "price": 0, "is_default": false}]',
  1,
  100
);

-- ============================================
-- FEATURE FLAGS
-- ============================================

INSERT OR IGNORE INTO feature_flags (key, enabled, description, updated_at) VALUES
  ('restaurant_classification_enabled', 1, 'AI-powered restaurant classification system', unixepoch()),
  ('modifier_rules_enabled', 1, 'Automatic modifier rule application', unixepoch()),
  ('classification_auto_apply', 0, 'Automatically apply classification to new clients', unixepoch());

-- ============================================
-- CLASSIFICATION SETTINGS (stored in feature_flags for simplicity)
-- ============================================

INSERT OR IGNORE INTO feature_flags (key, enabled, description, updated_at) VALUES
  ('classification_ai_model', 1, 'claude-sonnet-4-20250514', unixepoch()),
  ('classification_confidence_threshold', 1, '70', unixepoch()),
  ('google_places_api_enabled', 0, 'Enable Google Places API for classification data', unixepoch());
