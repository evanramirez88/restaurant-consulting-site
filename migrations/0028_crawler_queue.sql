-- Cape Cod Restaurant Consulting - Crawler Queue System
-- Migration: 0028_crawler_queue.sql
-- Created: 2026-01-16
--
-- This migration adds:
-- - Persistent crawler/spider queue table
-- - Lead verification tracking
-- - Research job history

-- ============================================
-- CRAWLER QUEUE - Background Processing Queue
-- ============================================
CREATE TABLE IF NOT EXISTS crawler_queue (
  id TEXT PRIMARY KEY,
  queue_type TEXT NOT NULL CHECK (queue_type IN (
    'website_scrape', 'enrich_lead', 'verify_data',
    'public_records', 'social_scan', 'discovery'
  )),
  target_url TEXT,
  target_id TEXT,
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  result_json TEXT,
  error_message TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  started_at INTEGER,
  completed_at INTEGER,
  scheduled_for INTEGER
);

CREATE INDEX IF NOT EXISTS idx_crawler_queue_status ON crawler_queue(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_crawler_queue_target ON crawler_queue(target_id);
CREATE INDEX IF NOT EXISTS idx_crawler_queue_type ON crawler_queue(queue_type, status);
CREATE INDEX IF NOT EXISTS idx_crawler_queue_scheduled ON crawler_queue(scheduled_for);

-- ============================================
-- LEAD VERIFICATION TRACKING
-- ============================================
-- Add verification columns to restaurant_leads if they don't exist
-- (SQLite doesn't support IF NOT EXISTS for columns, so we create a temp approach)

-- Store verification results
CREATE TABLE IF NOT EXISTS lead_verifications (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  verification_type TEXT NOT NULL CHECK (verification_type IN (
    'email', 'phone', 'website', 'address', 'business_status'
  )),
  verified_value TEXT,
  is_valid INTEGER,
  confidence REAL DEFAULT 0.5,
  verification_source TEXT,
  verification_data_json TEXT,
  verified_at INTEGER DEFAULT (unixepoch()),
  expires_at INTEGER,

  UNIQUE(lead_id, verification_type)
);

CREATE INDEX IF NOT EXISTS idx_lead_verifications_lead ON lead_verifications(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_verifications_valid ON lead_verifications(is_valid, expires_at);

-- ============================================
-- RESEARCH JOB HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS research_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL CHECK (job_type IN (
    'single_lead', 'bulk_enrich', 'discovery', 'competitor_analysis',
    'market_research', 'public_records', 'website_scan'
  )),
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'queued', 'processing', 'completed', 'failed', 'cancelled'
  )),

  -- Input parameters
  input_params_json TEXT,
  target_count INTEGER DEFAULT 0,

  -- Progress tracking
  processed_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  progress_pct INTEGER DEFAULT 0,

  -- Results
  results_summary_json TEXT,
  leads_created INTEGER DEFAULT 0,
  leads_enriched INTEGER DEFAULT 0,
  facts_discovered INTEGER DEFAULT 0,

  -- Timing
  created_at INTEGER DEFAULT (unixepoch()),
  started_at INTEGER,
  completed_at INTEGER,
  estimated_completion INTEGER,

  -- User tracking
  created_by TEXT,
  priority INTEGER DEFAULT 3
);

CREATE INDEX IF NOT EXISTS idx_research_jobs_status ON research_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_research_jobs_type ON research_jobs(job_type, status);

-- ============================================
-- SCRAPED DATA CACHE
-- ============================================
-- Cache scraped website data to avoid re-scraping too frequently
CREATE TABLE IF NOT EXISTS scraped_data_cache (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  scrape_type TEXT DEFAULT 'website',
  scraped_data_json TEXT,
  tech_stack_json TEXT,
  contacts_json TEXT,
  social_json TEXT,
  http_status INTEGER,
  scrape_duration_ms INTEGER,
  scraped_at INTEGER DEFAULT (unixepoch()),
  expires_at INTEGER,

  UNIQUE(url_hash)
);

CREATE INDEX IF NOT EXISTS idx_scraped_cache_url ON scraped_data_cache(url_hash);
CREATE INDEX IF NOT EXISTS idx_scraped_cache_expires ON scraped_data_cache(expires_at);

-- ============================================
-- DISCOVERY TARGETS
-- ============================================
-- Track areas/topics to continuously discover leads from
CREATE TABLE IF NOT EXISTS discovery_targets (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN (
    'location', 'technology', 'cuisine', 'competitor', 'directory'
  )),
  target_value TEXT NOT NULL,
  target_params_json TEXT,

  -- Scheduling
  is_active INTEGER DEFAULT 1,
  frequency_hours INTEGER DEFAULT 168, -- Weekly by default
  last_run_at INTEGER,
  next_run_at INTEGER,

  -- Stats
  total_runs INTEGER DEFAULT 0,
  total_leads_found INTEGER DEFAULT 0,
  last_leads_found INTEGER DEFAULT 0,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_discovery_active ON discovery_targets(is_active, next_run_at);

-- ============================================
-- SEED DEFAULT DISCOVERY TARGETS
-- ============================================
INSERT OR IGNORE INTO discovery_targets (id, target_type, target_value, target_params_json, frequency_hours) VALUES
  ('disc_cape_cod', 'location', 'Cape Cod, MA', '{"radius": "50mi", "categories": ["restaurant", "bar", "cafe"]}', 168),
  ('disc_boston', 'location', 'Boston, MA', '{"radius": "25mi", "categories": ["restaurant"]}', 336),
  ('disc_toast_users', 'technology', 'Toast POS', '{"existing_users": true, "support_potential": true}', 168),
  ('disc_clover_switch', 'technology', 'Clover', '{"switch_targets": true}', 336),
  ('disc_square_switch', 'technology', 'Square', '{"switch_targets": true}', 336);

-- ============================================
-- VIEWS FOR CRAWLER MONITORING
-- ============================================

-- Active queue summary
CREATE VIEW IF NOT EXISTS v_crawler_queue_summary AS
SELECT
  queue_type,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
  SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  AVG(CASE WHEN completed_at IS NOT NULL THEN completed_at - started_at ELSE NULL END) as avg_duration_sec
FROM crawler_queue
WHERE created_at > unixepoch() - 604800 -- Last 7 days
GROUP BY queue_type;

-- Leads needing enrichment
CREATE VIEW IF NOT EXISTS v_leads_needing_enrichment AS
SELECT
  id, company_name, email, website, current_pos, lead_score,
  CASE
    WHEN website IS NOT NULL AND current_pos IS NULL THEN 'website_scrape'
    WHEN email IS NOT NULL AND website IS NULL THEN 'discovery'
    ELSE 'verify_data'
  END as suggested_action
FROM restaurant_leads
WHERE (
  (website IS NOT NULL AND current_pos IS NULL) OR
  (email IS NOT NULL AND (updated_at IS NULL OR updated_at < unixepoch() - 2592000))
)
ORDER BY lead_score DESC
LIMIT 1000;

-- Research job progress
CREATE VIEW IF NOT EXISTS v_research_job_progress AS
SELECT
  id,
  job_type,
  status,
  target_count,
  processed_count,
  success_count,
  CASE
    WHEN target_count > 0 THEN ROUND(100.0 * processed_count / target_count, 1)
    ELSE 0
  END as progress_pct,
  leads_created,
  facts_discovered,
  CASE
    WHEN started_at IS NOT NULL AND status = 'processing' THEN
      (unixepoch() - started_at) / 60
    ELSE NULL
  END as running_minutes,
  created_at
FROM research_jobs
ORDER BY created_at DESC;
