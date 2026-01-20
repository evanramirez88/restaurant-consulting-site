-- Migration 0053: Competitive Intelligence
-- Purpose: Track competitors and competitive landscape
-- Date: 2026-01-20

-- ============================================
-- Competitor profiles
-- ============================================
CREATE TABLE IF NOT EXISTS competitive_intel (
  id TEXT PRIMARY KEY,

  -- Basic info
  competitor_name TEXT NOT NULL,
  category TEXT CHECK(category IN (
    'pos_integrator',    -- Direct competitors
    'it_services',       -- IT service providers
    'consultant',        -- Restaurant consultants
    'reseller',          -- POS resellers
    'software',          -- Software vendors
    'agency',            -- Marketing agencies
    'other'
  )),

  -- Details
  website TEXT,
  headquarters TEXT,
  region TEXT, -- Geographic focus
  company_size TEXT CHECK(company_size IN ('solo', 'small', 'medium', 'large', 'enterprise')),
  founded_year INTEGER,

  -- Competitive analysis
  pricing_info JSON,
  services_offered JSON,
  target_market TEXT,
  unique_selling_points TEXT,
  strengths TEXT,
  weaknesses TEXT,
  market_position TEXT CHECK(market_position IN ('leader', 'challenger', 'follower', 'niche', 'emerging')),

  -- POS partnerships
  pos_partnerships JSON, -- List of POS systems they work with

  -- Intelligence
  win_loss_notes TEXT,
  battle_card TEXT, -- How to compete against them
  threat_level TEXT CHECK(threat_level IN ('low', 'medium', 'high', 'critical')),

  -- Sources
  research_sources JSON,
  last_researched_at INTEGER,
  research_confidence TEXT CHECK(research_confidence IN ('low', 'medium', 'high')),

  -- Metadata
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_competitor_category ON competitive_intel(category);
CREATE INDEX IF NOT EXISTS idx_competitor_region ON competitive_intel(region);
CREATE INDEX IF NOT EXISTS idx_competitor_threat ON competitive_intel(threat_level);
CREATE INDEX IF NOT EXISTS idx_competitor_position ON competitive_intel(market_position);

-- ============================================
-- Competitor mentions in deals/leads
-- ============================================
CREATE TABLE IF NOT EXISTS competitor_mentions (
  id TEXT PRIMARY KEY,
  competitor_id TEXT REFERENCES competitive_intel(id),

  -- Where mentioned
  lead_id TEXT REFERENCES restaurant_leads(id),
  client_id TEXT REFERENCES clients(id),
  quote_id TEXT REFERENCES quotes(id),
  ticket_id TEXT REFERENCES tickets(id),

  -- Context
  mention_type TEXT CHECK(mention_type IN (
    'current_vendor',    -- They currently use this competitor
    'considering',       -- They're also considering this competitor
    'past_vendor',       -- They previously used this competitor
    'comparison',        -- They asked us to compare
    'referral_from',     -- They came from this competitor
    'lost_to',           -- We lost this deal to competitor
    'won_from'           -- We won this deal from competitor
  )),

  context TEXT,
  sentiment TEXT CHECK(sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
  competitive_advantage TEXT, -- What advantage we have/had

  -- Source
  source TEXT CHECK(source IN ('call', 'email', 'form', 'research', 'meeting', 'other')),
  source_details TEXT,

  -- Deal impact
  deal_value DECIMAL(10,2),
  outcome TEXT CHECK(outcome IN ('won', 'lost', 'pending', 'abandoned')),

  -- Metadata
  mentioned_at INTEGER DEFAULT (unixepoch()),
  recorded_by TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_mention_competitor ON competitor_mentions(competitor_id);
CREATE INDEX IF NOT EXISTS idx_mention_lead ON competitor_mentions(lead_id);
CREATE INDEX IF NOT EXISTS idx_mention_client ON competitor_mentions(client_id);
CREATE INDEX IF NOT EXISTS idx_mention_type ON competitor_mentions(mention_type);
CREATE INDEX IF NOT EXISTS idx_mention_outcome ON competitor_mentions(outcome);
CREATE INDEX IF NOT EXISTS idx_mention_date ON competitor_mentions(mentioned_at);

-- ============================================
-- Competitor pricing intelligence
-- ============================================
CREATE TABLE IF NOT EXISTS competitor_pricing (
  id TEXT PRIMARY KEY,
  competitor_id TEXT NOT NULL REFERENCES competitive_intel(id),

  -- Service/product
  service_name TEXT NOT NULL,
  service_category TEXT,

  -- Pricing
  price_low DECIMAL(10,2),
  price_high DECIMAL(10,2),
  price_type TEXT CHECK(price_type IN ('hourly', 'fixed', 'monthly', 'annual', 'per_item')),
  currency TEXT DEFAULT 'USD',

  -- Comparison
  our_price DECIMAL(10,2),
  price_difference_percent DECIMAL(8,2),
  value_proposition TEXT,

  -- Intelligence
  source TEXT,
  confidence TEXT CHECK(confidence IN ('confirmed', 'estimated', 'rumored')),
  collected_at INTEGER DEFAULT (unixepoch()),
  valid_until INTEGER,

  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_pricing_competitor ON competitor_pricing(competitor_id);
CREATE INDEX IF NOT EXISTS idx_pricing_service ON competitor_pricing(service_category);

-- ============================================
-- Win/Loss analysis
-- ============================================
CREATE TABLE IF NOT EXISTS win_loss_analysis (
  id TEXT PRIMARY KEY,
  lead_id TEXT REFERENCES restaurant_leads(id),
  quote_id TEXT REFERENCES quotes(id),

  -- Outcome
  outcome TEXT NOT NULL CHECK(outcome IN ('won', 'lost', 'no_decision')),
  outcome_date INTEGER,

  -- Competition
  competitors_involved JSON, -- List of competitor IDs
  primary_competitor_id TEXT REFERENCES competitive_intel(id),

  -- Analysis
  decision_factors JSON, -- What mattered to the customer
  our_strengths TEXT,
  our_weaknesses TEXT,
  competitor_strengths TEXT,
  competitor_weaknesses TEXT,

  -- Key reasons
  primary_win_reason TEXT,
  primary_loss_reason TEXT,

  -- Deal details
  deal_value DECIMAL(10,2),
  customer_segment TEXT,
  sales_cycle_days INTEGER,

  -- Feedback
  customer_feedback TEXT,
  lessons_learned TEXT,

  -- Metadata
  analyzed_by TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_winloss_outcome ON win_loss_analysis(outcome);
CREATE INDEX IF NOT EXISTS idx_winloss_competitor ON win_loss_analysis(primary_competitor_id);
CREATE INDEX IF NOT EXISTS idx_winloss_date ON win_loss_analysis(outcome_date);

-- ============================================
-- Competitive landscape summary view
-- ============================================
CREATE VIEW IF NOT EXISTS vw_competitive_landscape AS
SELECT
  ci.id,
  ci.competitor_name,
  ci.category,
  ci.market_position,
  ci.threat_level,
  COUNT(cm.id) as total_mentions,
  COUNT(CASE WHEN cm.mention_type = 'current_vendor' THEN 1 END) as current_vendor_mentions,
  COUNT(CASE WHEN cm.mention_type = 'considering' THEN 1 END) as considering_mentions,
  COUNT(CASE WHEN cm.outcome = 'won' THEN 1 END) as deals_won_from,
  COUNT(CASE WHEN cm.outcome = 'lost' THEN 1 END) as deals_lost_to,
  SUM(CASE WHEN cm.outcome = 'won' THEN cm.deal_value ELSE 0 END) as revenue_won,
  SUM(CASE WHEN cm.outcome = 'lost' THEN cm.deal_value ELSE 0 END) as revenue_lost,
  ROUND(
    COUNT(CASE WHEN cm.outcome = 'won' THEN 1 END) * 100.0 /
    NULLIF(COUNT(CASE WHEN cm.outcome IN ('won', 'lost') THEN 1 END), 0),
    2
  ) as win_rate_percent
FROM competitive_intel ci
LEFT JOIN competitor_mentions cm ON ci.id = cm.competitor_id
GROUP BY ci.id;

-- ============================================
-- Seed known competitors
-- ============================================
INSERT OR IGNORE INTO competitive_intel (id, competitor_name, category, market_position, threat_level, services_offered)
VALUES
  ('comp_toast_direct', 'Toast Support Team', 'pos_integrator', 'leader', 'medium',
   '["Basic support", "Implementation", "Training"]'),

  ('comp_restaurant_magic', 'Restaurant Magic', 'pos_integrator', 'challenger', 'medium',
   '["Toast integration", "Menu builds", "Consulting"]'),

  ('comp_pos_specialists', 'POS Specialists Inc', 'pos_integrator', 'niche', 'low',
   '["Multi-POS support", "Hardware"]'),

  ('comp_local_it', 'Cape Cod IT Services', 'it_services', 'niche', 'low',
   '["Network setup", "General IT", "Hardware support"]'),

  ('comp_restaurant_consultants', 'Restaurant Growth Consultants', 'consultant', 'challenger', 'medium',
   '["Operations consulting", "Menu engineering", "Staff training"]'),

  ('comp_fiverr_freelancers', 'Fiverr/Upwork Freelancers', 'other', 'follower', 'low',
   '["Menu data entry", "Basic setup"]');

-- ============================================
-- Intelligence tasks for competitive research
-- ============================================
INSERT OR IGNORE INTO intelligence_tasks (id, agent_name, task_type, priority, status, scheduled_at, parameters)
VALUES
  ('intel_comp_weekly', 'Analyst', 'competitive_research', 'medium', 'scheduled',
   unixepoch() + 604800, '{"scope": "all_competitors", "depth": "summary"}');
