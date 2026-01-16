-- Cape Cod Restaurant Consulting - Lead Intelligence Hints
-- Migration: 0029_lead_intelligence_hints.sql
-- Created: 2026-01-16
--
-- Adds intelligence hint columns to restaurant_leads for
-- Quote Builder DCI integration

-- ============================================
-- ADD HINT COLUMNS TO RESTAURANT_LEADS
-- ============================================

-- Service style hint (inferred from cuisine, category, or web scraping)
-- Values: fine_dining, upscale_casual, full_service, fast_casual, quick_service, counter, cafe, food_truck
ALTER TABLE restaurant_leads ADD COLUMN service_style_hint TEXT;

-- Bar program hint (detected from menu, liquor license, or web content)
-- Values: craft_cocktail, full_bar, wine_focus, beer_wine, none
ALTER TABLE restaurant_leads ADD COLUMN bar_program_hint TEXT;

-- Menu size hint (estimated item count from menu scraping)
ALTER TABLE restaurant_leads ADD COLUMN menu_size_hint INTEGER;

-- Seating capacity hint (from web scraping, business listings, or property records)
ALTER TABLE restaurant_leads ADD COLUMN seating_capacity_hint INTEGER;

-- Has bar flag (detected from various sources)
ALTER TABLE restaurant_leads ADD COLUMN has_bar INTEGER DEFAULT 0;

-- Has patio/outdoor seating
ALTER TABLE restaurant_leads ADD COLUMN has_patio INTEGER DEFAULT 0;

-- Price point estimate: budget, moderate, upscale, fine_dining
ALTER TABLE restaurant_leads ADD COLUMN price_point_hint TEXT;

-- Volume level estimate: low, medium, high, very_high
ALTER TABLE restaurant_leads ADD COLUMN volume_hint TEXT;

-- Hours pattern: breakfast_lunch, lunch_dinner, dinner_only, all_day, late_night
ALTER TABLE restaurant_leads ADD COLUMN hours_hint TEXT;

-- Liquor license type detected
ALTER TABLE restaurant_leads ADD COLUMN liquor_license_hint TEXT;

-- Online ordering detected
ALTER TABLE restaurant_leads ADD COLUMN has_online_ordering INTEGER DEFAULT 0;

-- Reservation system detected
ALTER TABLE restaurant_leads ADD COLUMN has_reservations INTEGER DEFAULT 0;

-- Intelligence last updated
ALTER TABLE restaurant_leads ADD COLUMN intelligence_updated_at INTEGER;

-- Intelligence confidence (0-100)
ALTER TABLE restaurant_leads ADD COLUMN intelligence_confidence INTEGER;

-- ============================================
-- INDEXES FOR INTELLIGENCE QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_leads_service_style ON restaurant_leads(service_style_hint);
CREATE INDEX IF NOT EXISTS idx_leads_bar_program ON restaurant_leads(bar_program_hint);
CREATE INDEX IF NOT EXISTS idx_leads_price_point ON restaurant_leads(price_point_hint);
CREATE INDEX IF NOT EXISTS idx_leads_intel_updated ON restaurant_leads(intelligence_updated_at);

-- ============================================
-- CLIENT PROFILES UPDATES
-- ============================================

-- Ensure client_profiles has the same fields for consistency
ALTER TABLE client_profiles ADD COLUMN menu_item_count INTEGER;
ALTER TABLE client_profiles ADD COLUMN has_full_bar INTEGER DEFAULT 0;
ALTER TABLE client_profiles ADD COLUMN has_craft_cocktails INTEGER DEFAULT 0;
ALTER TABLE client_profiles ADD COLUMN has_online_ordering INTEGER DEFAULT 0;
ALTER TABLE client_profiles ADD COLUMN has_reservations INTEGER DEFAULT 0;
ALTER TABLE client_profiles ADD COLUMN has_patio INTEGER DEFAULT 0;
ALTER TABLE client_profiles ADD COLUMN price_point TEXT;
ALTER TABLE client_profiles ADD COLUMN volume_level TEXT;
ALTER TABLE client_profiles ADD COLUMN hours_pattern TEXT;
ALTER TABLE client_profiles ADD COLUMN liquor_license_type TEXT;

-- ============================================
-- VIEW: LEADS WITH DCI FACTORS
-- ============================================

CREATE VIEW IF NOT EXISTS v_leads_dci_factors AS
SELECT
  id,
  company_name,
  city,
  state,
  current_pos,
  lead_score,

  -- DCI Factors
  COALESCE(service_style_hint, 'full_service') as service_style,
  COALESCE(bar_program_hint, 'none') as bar_program,
  CASE
    WHEN menu_size_hint > 200 THEN 'ultra'
    WHEN menu_size_hint > 100 THEN 'complex'
    WHEN menu_size_hint > 50 THEN 'moderate'
    WHEN menu_size_hint > 0 THEN 'simple'
    ELSE 'unknown'
  END as menu_complexity,
  seating_capacity_hint,
  price_point_hint,

  -- Calculated DCI modifier (simplified)
  ROUND(
    (CASE service_style_hint
      WHEN 'fine_dining' THEN 1.25
      WHEN 'upscale_casual' THEN 1.15
      WHEN 'full_service' THEN 1.10
      WHEN 'fast_casual' THEN 1.05
      WHEN 'counter' THEN 0.95
      WHEN 'cafe' THEN 0.90
      ELSE 1.0
    END) *
    (CASE bar_program_hint
      WHEN 'craft_cocktail' THEN 1.25
      WHEN 'full_bar' THEN 1.15
      WHEN 'wine_focus' THEN 1.10
      WHEN 'beer_wine' THEN 1.05
      ELSE 1.0
    END) *
    (CASE
      WHEN menu_size_hint > 200 THEN 1.30
      WHEN menu_size_hint > 100 THEN 1.15
      WHEN menu_size_hint > 50 THEN 1.05
      WHEN menu_size_hint > 0 THEN 0.90
      ELSE 1.0
    END),
    2
  ) as dci_modifier,

  intelligence_confidence,
  intelligence_updated_at

FROM restaurant_leads
WHERE service_style_hint IS NOT NULL
   OR bar_program_hint IS NOT NULL
   OR menu_size_hint IS NOT NULL;

-- ============================================
-- VIEW: QUOTE BUILDER READY LEADS
-- ============================================

-- Leads with enough intelligence data for Quote Builder pre-population
CREATE VIEW IF NOT EXISTS v_quote_ready_leads AS
SELECT
  rl.id,
  rl.company_name,
  rl.contact_name,
  rl.email,
  rl.phone,
  rl.website,
  rl.full_address,
  rl.city,
  rl.state,
  rl.current_pos,
  rl.lead_score,

  -- Intelligence data
  rl.service_style_hint,
  rl.cuisine_hint,
  rl.bar_program_hint,
  rl.menu_size_hint,
  rl.seating_capacity_hint,
  rl.price_point_hint,
  rl.has_bar,
  rl.has_patio,
  rl.has_online_ordering,
  rl.has_reservations,
  rl.intelligence_confidence,

  -- Calculate readiness score
  (
    (CASE WHEN rl.service_style_hint IS NOT NULL THEN 20 ELSE 0 END) +
    (CASE WHEN rl.bar_program_hint IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE WHEN rl.menu_size_hint IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE WHEN rl.seating_capacity_hint IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE WHEN rl.full_address IS NOT NULL THEN 10 ELSE 0 END) +
    (CASE WHEN rl.email IS NOT NULL THEN 10 ELSE 0 END) +
    (CASE WHEN rl.phone IS NOT NULL THEN 5 ELSE 0 END) +
    (CASE WHEN rl.website IS NOT NULL THEN 10 ELSE 0 END)
  ) as quote_readiness_score

FROM restaurant_leads rl
WHERE rl.lead_score >= 50
  AND (rl.service_style_hint IS NOT NULL OR rl.current_pos IS NOT NULL)
ORDER BY lead_score DESC, quote_readiness_score DESC;
