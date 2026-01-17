-- =====================================================
-- INTELLIGENCE SCHEDULER SCHEMA UPDATES
-- =====================================================
-- Purpose: Support scheduled intelligence agent runs and gap-filling
-- Date: 2026-01-17
-- =====================================================

-- Add gap_fill tracking columns to restaurant_leads
ALTER TABLE restaurant_leads ADD COLUMN gap_fill_attempted_at INTEGER;
ALTER TABLE restaurant_leads ADD COLUMN gap_fill_source TEXT;  -- 'brave', 'google', 'manual'

-- Add index for gap-fill queries
CREATE INDEX IF NOT EXISTS idx_leads_gap_fill ON restaurant_leads(gap_fill_attempted_at);

-- Table to store intelligence run history (detailed per-agent)
CREATE TABLE IF NOT EXISTS intelligence_runs (
  id TEXT PRIMARY KEY,
  agent TEXT NOT NULL,  -- hunter, analyst, operator, strategist
  run_type TEXT DEFAULT 'scheduled',  -- scheduled, manual

  -- Timing
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_ms INTEGER,

  -- Results summary
  tasks_completed INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,

  -- Stats (JSON by agent type)
  stats TEXT,
  -- hunter: {new_leads, stale_leads, permits_checked}
  -- analyst: {pos_audited, tech_trends}
  -- operator: {health_checks, alerts}
  -- strategist: {scored, gaps_filled, high_value_count}

  -- Errors (JSON array)
  errors TEXT,

  -- Status
  status TEXT DEFAULT 'running',  -- running, completed, failed

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_intelligence_runs_agent ON intelligence_runs(agent);
CREATE INDEX IF NOT EXISTS idx_intelligence_runs_status ON intelligence_runs(status);
CREATE INDEX IF NOT EXISTS idx_intelligence_runs_created ON intelligence_runs(created_at DESC);

-- Table to store gap-fill results
CREATE TABLE IF NOT EXISTS gap_fill_results (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES restaurant_leads(id) ON DELETE CASCADE,

  -- What was filled
  field_name TEXT NOT NULL,  -- email, phone, current_pos, etc.
  old_value TEXT,
  new_value TEXT NOT NULL,

  -- Source info
  source TEXT NOT NULL,  -- brave, google, yelp, manual
  search_query TEXT,
  source_url TEXT,
  confidence REAL DEFAULT 0.5,  -- 0-1

  -- Verification
  verified INTEGER DEFAULT 0,
  verified_at INTEGER,
  verified_by TEXT,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_gap_fill_lead ON gap_fill_results(lead_id);
CREATE INDEX IF NOT EXISTS idx_gap_fill_field ON gap_fill_results(field_name);

-- Table for daily briefs
CREATE TABLE IF NOT EXISTS daily_briefs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,  -- YYYY-MM-DD

  -- Summary stats
  new_leads INTEGER DEFAULT 0,
  scored_leads INTEGER DEFAULT 0,
  gaps_filled INTEGER DEFAULT 0,
  high_value_count INTEGER DEFAULT 0,

  -- Score distribution (JSON)
  score_distribution TEXT,

  -- Top leads (JSON array)
  high_value_leads TEXT,

  -- Recommendations (JSON array)
  recommendations TEXT,

  -- Agent summaries (JSON)
  agent_summaries TEXT,

  -- Email tracking
  email_sent INTEGER DEFAULT 0,
  email_sent_at INTEGER,
  email_id TEXT,  -- Resend email ID

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Lead conversion tracking table
CREATE TABLE IF NOT EXISTS lead_conversions (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES restaurant_leads(id),
  client_id TEXT NOT NULL REFERENCES clients(id),

  -- Conversion info
  converted_at INTEGER DEFAULT (unixepoch()),
  converted_by TEXT,  -- user ID or 'system'
  conversion_source TEXT,  -- direct, quote, referral

  -- Value tracking
  initial_deal_value REAL,
  deal_type TEXT,  -- support_plan, project, implementation

  -- Attribution
  lead_score_at_conversion INTEGER,
  segment_at_conversion TEXT,
  days_in_pipeline INTEGER,
  touchpoints_count INTEGER,

  notes TEXT,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_lead_conversions_lead ON lead_conversions(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_conversions_client ON lead_conversions(client_id);
CREATE INDEX IF NOT EXISTS idx_lead_conversions_date ON lead_conversions(converted_at DESC);

-- Add converted_to_client_id index if not exists
CREATE INDEX IF NOT EXISTS idx_leads_converted ON restaurant_leads(converted_to_client_id);

-- View for conversion funnel analysis
CREATE VIEW IF NOT EXISTS v_conversion_funnel AS
SELECT
  DATE(created_at, 'unixepoch') as cohort_date,
  COUNT(*) as total_leads,
  SUM(CASE WHEN status = 'lead' THEN 1 ELSE 0 END) as qualified_leads,
  SUM(CASE WHEN status = 'opportunity' THEN 1 ELSE 0 END) as opportunities,
  SUM(CASE WHEN converted_to_client_id IS NOT NULL THEN 1 ELSE 0 END) as converted,
  ROUND(AVG(lead_score), 1) as avg_lead_score,
  ROUND(100.0 * SUM(CASE WHEN converted_to_client_id IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 2) as conversion_rate
FROM restaurant_leads
WHERE created_at > unixepoch() - (86400 * 90)  -- Last 90 days
GROUP BY cohort_date
ORDER BY cohort_date DESC;

-- =====================================================
-- SAMPLE DATA: Create test intelligence run
-- =====================================================

INSERT OR IGNORE INTO intelligence_runs (id, agent, run_type, started_at, ended_at, duration_ms, tasks_completed, stats, status)
VALUES (
  'init_strategist_001',
  'strategist',
  'manual',
  unixepoch(),
  unixepoch(),
  0,
  0,
  '{"scored": 0, "gaps_identified": 0}',
  'completed'
);
