-- Migration: 0093_opportunity_analysis.sql
-- Description: Tables for Business Brief Enricher opportunity tracking

-- Lead opportunity analysis results
CREATE TABLE IF NOT EXISTS lead_opportunity_analysis (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  opportunity_score INTEGER DEFAULT 50,
  factors_json TEXT, -- JSON array of OpportunityFactor objects
  recommendations_json TEXT, -- JSON array of recommended actions
  pain_signals_json TEXT, -- JSON array of PainSignal objects
  created_at INTEGER DEFAULT (unixepoch()),
  
  FOREIGN KEY (lead_id) REFERENCES restaurant_leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_opp_lead ON lead_opportunity_analysis(lead_id);
CREATE INDEX IF NOT EXISTS idx_opp_score ON lead_opportunity_analysis(opportunity_score DESC);

-- Enrichment run logs for tracking and debugging
CREATE TABLE IF NOT EXISTS enrichment_runs (
  id TEXT PRIMARY KEY,
  lead_id TEXT,
  run_type TEXT DEFAULT 'single', -- 'single', 'batch'
  batch_id TEXT,
  
  -- Results
  fields_enriched INTEGER DEFAULT 0,
  fields_attempted INTEGER DEFAULT 0,
  rounds_completed INTEGER DEFAULT 0,
  previous_completeness INTEGER,
  new_completeness INTEGER,
  
  -- Sources used
  sources_used TEXT, -- JSON array
  gaps_remaining TEXT, -- JSON array
  errors TEXT, -- JSON array
  
  -- Timing
  started_at INTEGER DEFAULT (unixepoch()),
  completed_at INTEGER,
  duration_ms INTEGER,
  
  -- Status
  status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed'
  
  FOREIGN KEY (lead_id) REFERENCES restaurant_leads(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_enrich_run_lead ON enrichment_runs(lead_id);
CREATE INDEX IF NOT EXISTS idx_enrich_run_status ON enrichment_runs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrich_run_batch ON enrichment_runs(batch_id);

-- Rate limit tracking (alternative to KV for audit trail)
CREATE TABLE IF NOT EXISTS api_usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usage_date TEXT NOT NULL, -- YYYY-MM-DD
  api_source TEXT NOT NULL, -- 'brave', 'google', 'website_scrape'
  requests_made INTEGER DEFAULT 0,
  requests_succeeded INTEGER DEFAULT 0,
  requests_failed INTEGER DEFAULT 0,
  last_request_at INTEGER,
  
  UNIQUE(usage_date, api_source)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage_log(usage_date DESC);

-- Decision makers extracted during enrichment
CREATE TABLE IF NOT EXISTS lead_decision_makers (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  source TEXT, -- 'website', 'search', 'linkedin', 'manual'
  confidence INTEGER DEFAULT 50, -- 0-100
  verified INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  
  FOREIGN KEY (lead_id) REFERENCES restaurant_leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dm_lead ON lead_decision_makers(lead_id);
CREATE INDEX IF NOT EXISTS idx_dm_email ON lead_decision_makers(email);

-- Pain signals tracking
CREATE TABLE IF NOT EXISTS lead_pain_signals (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  pain_type TEXT NOT NULL, -- 'tech', 'service', 'operations', 'staffing', 'financial'
  description TEXT NOT NULL,
  severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  source TEXT, -- 'review', 'news', 'website', 'manual'
  source_url TEXT,
  detected_at INTEGER DEFAULT (unixepoch()),
  resolved INTEGER DEFAULT 0,
  resolved_at INTEGER,
  
  FOREIGN KEY (lead_id) REFERENCES restaurant_leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pain_lead ON lead_pain_signals(lead_id);
CREATE INDEX IF NOT EXISTS idx_pain_type ON lead_pain_signals(pain_type);
CREATE INDEX IF NOT EXISTS idx_pain_severity ON lead_pain_signals(severity);
