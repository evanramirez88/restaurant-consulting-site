-- Cape Cod Restaurant Consulting - Cocktail Configuration System
-- Migration: 0030_cocktail_configuration.sql
-- Created: 2026-01-16
--
-- Implements the Martini/Manhattan inventory logic:
-- - Spirit State concept: cocktails are "states" of base spirits
-- - Volume-based pricing with upcharge modifiers
-- - Preserves inventory data integrity

-- ============================================
-- COCKTAIL CONFIGURATION TABLES
-- ============================================

-- Base Spirit Definitions (inventory items)
CREATE TABLE IF NOT EXISTS spirit_base_items (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,         -- vodka, gin, whiskey, tequila, rum, etc.
  brand TEXT NOT NULL,            -- Tito's, Grey Goose, Tanqueray, etc.
  base_price REAL NOT NULL,       -- Standard pour price (2oz)
  cost_per_oz REAL,               -- Pour cost for margin calculation
  standard_pour_oz REAL DEFAULT 2.0,
  is_well INTEGER DEFAULT 0,      -- Is this the well spirit for category
  is_premium INTEGER DEFAULT 0,   -- Premium tier
  is_top_shelf INTEGER DEFAULT 0, -- Top shelf tier
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Cocktail Style Configurations (Martini, Manhattan, etc.)
CREATE TABLE IF NOT EXISTS cocktail_styles (
  id TEXT PRIMARY KEY,
  style_name TEXT NOT NULL,       -- Martini, Manhattan, Old Fashioned, etc.
  description TEXT,
  volume_multiplier REAL DEFAULT 1.0,  -- Pour multiplier vs standard
  typical_oz REAL DEFAULT 2.0,    -- Typical spirit pour for this style
  style_upcharge REAL DEFAULT 0,  -- Base upcharge for style
  prep_complexity INTEGER DEFAULT 1,  -- 1=simple, 2=moderate, 3=complex
  category TEXT,                  -- stirred, shaken, built, etc.
  default_glass TEXT,             -- Martini glass, rocks, coupe, etc.
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Modifier Group Templates for Bar Programs
CREATE TABLE IF NOT EXISTS cocktail_modifier_templates (
  id TEXT PRIMARY KEY,
  template_name TEXT NOT NULL,    -- "Martini Style", "Whiskey Service", etc.
  group_name TEXT NOT NULL,       -- Name for POS modifier group
  group_type TEXT DEFAULT 'single',
  min_selections INTEGER DEFAULT 1,
  max_selections INTEGER DEFAULT 1,
  is_required INTEGER DEFAULT 0,
  spirit_categories TEXT,         -- JSON array of applicable spirit categories
  bar_program_type TEXT,          -- craft_cocktail, full_bar, wine_focus, etc.
  options_json TEXT,              -- JSON array of modifier options
  pricing_logic TEXT,             -- 'volume_multiplier' or 'fixed_upcharge'
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Generated Menu Item Mappings (spirit + style = menu item)
CREATE TABLE IF NOT EXISTS cocktail_menu_items (
  id TEXT PRIMARY KEY,
  spirit_id TEXT REFERENCES spirit_base_items(id),
  style_id TEXT REFERENCES cocktail_styles(id),
  item_name TEXT NOT NULL,        -- "Tito's Martini", "Maker's Manhattan"
  calculated_price REAL,          -- Auto-calculated from spirit + style
  override_price REAL,            -- Manual override if set
  final_price REAL,               -- Used price (override or calculated)
  menu_category TEXT DEFAULT 'Cocktails',
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_spirits_category ON spirit_base_items(category);
CREATE INDEX IF NOT EXISTS idx_spirits_brand ON spirit_base_items(brand);
CREATE INDEX IF NOT EXISTS idx_cocktail_styles_name ON cocktail_styles(style_name);
CREATE INDEX IF NOT EXISTS idx_cocktail_items_spirit ON cocktail_menu_items(spirit_id);
CREATE INDEX IF NOT EXISTS idx_cocktail_items_style ON cocktail_menu_items(style_id);

-- ============================================
-- SEED DATA: COCKTAIL STYLES
-- ============================================

INSERT OR IGNORE INTO cocktail_styles (id, style_name, description, volume_multiplier, typical_oz, style_upcharge, prep_complexity, category, default_glass, display_order, is_active) VALUES
-- Classic Cocktail Styles
('style_martini', 'Martini', 'Shaken or stirred with vermouth, served up', 2.0, 4.0, 2.00, 2, 'stirred', 'Martini Glass', 1, 1),
('style_manhattan', 'Manhattan', 'Whiskey with sweet vermouth and bitters, served up', 1.75, 3.5, 2.00, 2, 'stirred', 'Coupe', 2, 1),
('style_old_fashioned', 'Old Fashioned', 'Spirit with sugar, bitters, and orange peel', 1.25, 2.5, 1.50, 2, 'built', 'Rocks Glass', 3, 1),
('style_negroni', 'Negroni', 'Equal parts gin, Campari, and sweet vermouth', 1.5, 3.0, 1.50, 1, 'stirred', 'Rocks Glass', 4, 1),
('style_rocks', 'On the Rocks', 'Spirit served over ice', 1.0, 2.0, 0, 1, 'built', 'Rocks Glass', 5, 1),
('style_neat', 'Neat', 'Spirit served at room temperature without ice', 1.0, 2.0, 0, 1, 'poured', 'Snifter', 6, 1),
('style_margarita', 'Margarita', 'Tequila with lime and triple sec', 1.5, 3.0, 1.00, 2, 'shaken', 'Margarita Glass', 7, 1),
('style_daiquiri', 'Daiquiri', 'Rum with lime and simple syrup', 1.5, 3.0, 1.00, 2, 'shaken', 'Coupe', 8, 1),
('style_sour', 'Sour', 'Spirit with lemon/lime and simple syrup', 1.5, 3.0, 1.00, 2, 'shaken', 'Coupe', 9, 1),
('style_collins', 'Collins', 'Spirit with citrus, topped with soda', 1.5, 3.0, 0.50, 1, 'built', 'Collins Glass', 10, 1),
('style_highball', 'Highball', 'Spirit with mixer over ice in tall glass', 1.0, 2.0, 0, 1, 'built', 'Highball Glass', 11, 1),
('style_mule', 'Mule', 'Spirit with ginger beer and lime', 1.0, 2.0, 0.50, 1, 'built', 'Copper Mug', 12, 1);

-- ============================================
-- SEED DATA: COMMON SPIRIT BASE ITEMS
-- ============================================

INSERT OR IGNORE INTO spirit_base_items (id, category, brand, base_price, cost_per_oz, standard_pour_oz, is_well, is_premium, is_top_shelf, display_order, is_active) VALUES
-- Vodka
('spirit_well_vodka', 'vodka', 'Well Vodka', 8.00, 0.50, 2.0, 1, 0, 0, 1, 1),
('spirit_titos', 'vodka', 'Titos', 10.00, 0.75, 2.0, 0, 1, 0, 2, 1),
('spirit_ketel_one', 'vodka', 'Ketel One', 11.00, 0.85, 2.0, 0, 1, 0, 3, 1),
('spirit_grey_goose', 'vodka', 'Grey Goose', 14.00, 1.20, 2.0, 0, 0, 1, 4, 1),
('spirit_belvedere', 'vodka', 'Belvedere', 14.00, 1.20, 2.0, 0, 0, 1, 5, 1),

-- Gin
('spirit_well_gin', 'gin', 'Well Gin', 8.00, 0.50, 2.0, 1, 0, 0, 1, 1),
('spirit_beefeater', 'gin', 'Beefeater', 10.00, 0.70, 2.0, 0, 1, 0, 2, 1),
('spirit_tanqueray', 'gin', 'Tanqueray', 11.00, 0.80, 2.0, 0, 1, 0, 3, 1),
('spirit_hendricks', 'gin', 'Hendricks', 13.00, 1.10, 2.0, 0, 0, 1, 4, 1),
('spirit_bombay_sapphire', 'gin', 'Bombay Sapphire', 11.00, 0.85, 2.0, 0, 1, 0, 5, 1),

-- Bourbon/Whiskey
('spirit_well_bourbon', 'bourbon', 'Well Bourbon', 8.00, 0.50, 2.0, 1, 0, 0, 1, 1),
('spirit_makers_mark', 'bourbon', 'Makers Mark', 11.00, 0.85, 2.0, 0, 1, 0, 2, 1),
('spirit_buffalo_trace', 'bourbon', 'Buffalo Trace', 10.00, 0.75, 2.0, 0, 1, 0, 3, 1),
('spirit_woodford', 'bourbon', 'Woodford Reserve', 13.00, 1.05, 2.0, 0, 0, 1, 4, 1),
('spirit_blantons', 'bourbon', 'Blantons', 18.00, 1.80, 2.0, 0, 0, 1, 5, 1),

-- Rye
('spirit_well_rye', 'rye', 'Well Rye', 8.00, 0.50, 2.0, 1, 0, 0, 1, 1),
('spirit_bulleit_rye', 'rye', 'Bulleit Rye', 11.00, 0.85, 2.0, 0, 1, 0, 2, 1),
('spirit_rittenhouse', 'rye', 'Rittenhouse', 10.00, 0.75, 2.0, 0, 1, 0, 3, 1),
('spirit_whistlepig', 'rye', 'WhistlePig 10yr', 18.00, 1.70, 2.0, 0, 0, 1, 4, 1),

-- Tequila
('spirit_well_tequila', 'tequila', 'Well Tequila', 8.00, 0.50, 2.0, 1, 0, 0, 1, 1),
('spirit_espolon', 'tequila', 'Espolon Blanco', 10.00, 0.70, 2.0, 0, 1, 0, 2, 1),
('spirit_patron_silver', 'tequila', 'Patron Silver', 14.00, 1.20, 2.0, 0, 0, 1, 3, 1),
('spirit_casamigos', 'tequila', 'Casamigos Blanco', 15.00, 1.30, 2.0, 0, 0, 1, 4, 1),

-- Rum
('spirit_well_rum', 'rum', 'Well Rum', 8.00, 0.45, 2.0, 1, 0, 0, 1, 1),
('spirit_bacardi', 'rum', 'Bacardi Superior', 9.00, 0.55, 2.0, 0, 1, 0, 2, 1),
('spirit_mount_gay', 'rum', 'Mount Gay', 11.00, 0.80, 2.0, 0, 1, 0, 3, 1),
('spirit_flor_de_cana', 'rum', 'Flor de Cana 7yr', 12.00, 0.90, 2.0, 0, 0, 1, 4, 1),

-- Scotch
('spirit_well_scotch', 'scotch', 'Well Scotch', 9.00, 0.60, 2.0, 1, 0, 0, 1, 1),
('spirit_johnny_black', 'scotch', 'Johnnie Walker Black', 12.00, 0.95, 2.0, 0, 1, 0, 2, 1),
('spirit_glenlivet_12', 'scotch', 'Glenlivet 12', 14.00, 1.15, 2.0, 0, 0, 1, 3, 1),
('spirit_macallan_12', 'scotch', 'Macallan 12', 18.00, 1.70, 2.0, 0, 0, 1, 4, 1);

-- ============================================
-- SEED DATA: MODIFIER TEMPLATES FOR BAR PROGRAMS
-- ============================================

INSERT OR IGNORE INTO cocktail_modifier_templates (id, template_name, group_name, group_type, min_selections, max_selections, is_required, spirit_categories, bar_program_type, options_json, pricing_logic, is_active) VALUES
-- Vodka Service Styles
('tmpl_vodka_service', 'Vodka Service Style', 'How Would You Like It?', 'single', 0, 1, 0,
 '["vodka"]', 'full_bar',
 '[
   {"name": "Martini", "upcharge": 2.00, "volume_multiplier": 2.0},
   {"name": "On the Rocks", "upcharge": 0, "volume_multiplier": 1.0},
   {"name": "Neat", "upcharge": 0, "volume_multiplier": 1.0},
   {"name": "Highball", "upcharge": 0, "volume_multiplier": 1.0}
 ]', 'volume_multiplier', 1),

-- Gin Service Styles
('tmpl_gin_service', 'Gin Service Style', 'How Would You Like It?', 'single', 0, 1, 0,
 '["gin"]', 'full_bar',
 '[
   {"name": "Martini", "upcharge": 2.00, "volume_multiplier": 2.0},
   {"name": "Negroni", "upcharge": 1.50, "volume_multiplier": 1.5},
   {"name": "Collins", "upcharge": 0.50, "volume_multiplier": 1.5},
   {"name": "On the Rocks", "upcharge": 0, "volume_multiplier": 1.0},
   {"name": "Neat", "upcharge": 0, "volume_multiplier": 1.0}
 ]', 'volume_multiplier', 1),

-- Whiskey/Bourbon Service Styles
('tmpl_whiskey_service', 'Whiskey Service Style', 'How Would You Like It?', 'single', 0, 1, 0,
 '["bourbon", "rye", "scotch"]', 'full_bar',
 '[
   {"name": "Manhattan", "upcharge": 2.00, "volume_multiplier": 1.75},
   {"name": "Old Fashioned", "upcharge": 1.50, "volume_multiplier": 1.25},
   {"name": "Sour", "upcharge": 1.00, "volume_multiplier": 1.5},
   {"name": "On the Rocks", "upcharge": 0, "volume_multiplier": 1.0},
   {"name": "Neat", "upcharge": 0, "volume_multiplier": 1.0}
 ]', 'volume_multiplier', 1),

-- Tequila Service Styles
('tmpl_tequila_service', 'Tequila Service Style', 'How Would You Like It?', 'single', 0, 1, 0,
 '["tequila"]', 'full_bar',
 '[
   {"name": "Margarita", "upcharge": 1.00, "volume_multiplier": 1.5},
   {"name": "Paloma", "upcharge": 0.50, "volume_multiplier": 1.25},
   {"name": "On the Rocks", "upcharge": 0, "volume_multiplier": 1.0},
   {"name": "Neat", "upcharge": 0, "volume_multiplier": 1.0}
 ]', 'volume_multiplier', 1),

-- Rum Service Styles
('tmpl_rum_service', 'Rum Service Style', 'How Would You Like It?', 'single', 0, 1, 0,
 '["rum"]', 'full_bar',
 '[
   {"name": "Daiquiri", "upcharge": 1.00, "volume_multiplier": 1.5},
   {"name": "Mojito", "upcharge": 1.00, "volume_multiplier": 1.5},
   {"name": "Mule", "upcharge": 0.50, "volume_multiplier": 1.0},
   {"name": "Highball", "upcharge": 0, "volume_multiplier": 1.0}
 ]', 'volume_multiplier', 1),

-- Martini Customization (for craft cocktail programs)
('tmpl_martini_customize', 'Martini Customization', 'Martini Style', 'single', 0, 1, 0,
 '["vodka", "gin"]', 'craft_cocktail',
 '[
   {"name": "Dry", "upcharge": 0, "description": "Light vermouth"},
   {"name": "Extra Dry", "upcharge": 0, "description": "Hint of vermouth"},
   {"name": "Wet", "upcharge": 0, "description": "Extra vermouth"},
   {"name": "Perfect", "upcharge": 0, "description": "Equal parts dry & sweet"},
   {"name": "Dirty", "upcharge": 0.50, "description": "With olive brine"},
   {"name": "Filthy", "upcharge": 1.00, "description": "Extra olive brine"}
 ]', 'fixed_upcharge', 1),

-- Garnish Options (for craft cocktail)
('tmpl_martini_garnish', 'Martini Garnish', 'Garnish', 'single', 0, 1, 0,
 '["vodka", "gin"]', 'craft_cocktail',
 '[
   {"name": "Olives", "upcharge": 0},
   {"name": "Twist", "upcharge": 0},
   {"name": "Onion (Gibson)", "upcharge": 0},
   {"name": "Blue Cheese Olives", "upcharge": 1.00}
 ]', 'fixed_upcharge', 1);

-- ============================================
-- VIEW: COCKTAIL PRICING CALCULATOR
-- ============================================

-- Calculate cocktail prices using Martini/Manhattan formula:
-- Final Price = (Base Spirit Price * Volume Multiplier) + Style Upcharge
CREATE VIEW IF NOT EXISTS v_cocktail_pricing AS
SELECT
  sb.id as spirit_id,
  sb.category,
  sb.brand,
  sb.base_price,
  sb.standard_pour_oz,
  cs.id as style_id,
  cs.style_name,
  cs.volume_multiplier,
  cs.typical_oz,
  cs.style_upcharge,

  -- Martini/Manhattan Formula
  ROUND(
    (sb.base_price * cs.volume_multiplier) + cs.style_upcharge,
    2
  ) as calculated_price,

  -- Cost calculation
  ROUND(sb.cost_per_oz * cs.typical_oz, 2) as pour_cost,

  -- Margin calculation
  ROUND(
    (((sb.base_price * cs.volume_multiplier) + cs.style_upcharge) - (sb.cost_per_oz * cs.typical_oz)) /
    ((sb.base_price * cs.volume_multiplier) + cs.style_upcharge) * 100,
    1
  ) as margin_pct,

  -- Display name for menu
  sb.brand || ' ' || cs.style_name as menu_item_name

FROM spirit_base_items sb
CROSS JOIN cocktail_styles cs
WHERE sb.is_active = 1 AND cs.is_active = 1
ORDER BY sb.category, sb.display_order, cs.display_order;

-- ============================================
-- VIEW: SPIRIT INVENTORY SUMMARY
-- ============================================

CREATE VIEW IF NOT EXISTS v_spirit_inventory AS
SELECT
  category,
  COUNT(*) as brand_count,
  MIN(base_price) as min_price,
  MAX(base_price) as max_price,
  AVG(base_price) as avg_price,
  SUM(CASE WHEN is_well = 1 THEN 1 ELSE 0 END) as well_count,
  SUM(CASE WHEN is_premium = 1 THEN 1 ELSE 0 END) as premium_count,
  SUM(CASE WHEN is_top_shelf = 1 THEN 1 ELSE 0 END) as top_shelf_count
FROM spirit_base_items
WHERE is_active = 1
GROUP BY category;
