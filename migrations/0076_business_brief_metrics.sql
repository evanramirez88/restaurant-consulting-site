-- Migration: 0076_business_brief_metrics.sql
-- Business Brief BI Dashboard Enhancements
-- Adds metrics tracking, revenue events, and pipeline history for trend analysis
-- Created: 2026-01-24

-- ============================================
-- METRICS SNAPSHOTS
-- Daily/periodic snapshots of key business metrics for trending
-- ============================================

CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_date TEXT NOT NULL, -- YYYY-MM-DD
  metric_type TEXT NOT NULL, -- 'revenue', 'clients', 'pipeline', 'engagement', 'email', 'support'
  metric_value REAL NOT NULL,
  metric_meta TEXT, -- JSON for additional context (breakdown, sources, etc.)
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(snapshot_date, metric_type)
);

CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_date ON metrics_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_type ON metrics_snapshots(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_date_type ON metrics_snapshots(snapshot_date, metric_type);

-- ============================================
-- REVENUE EVENTS
-- Individual revenue transactions for detailed tracking
-- ============================================

CREATE TABLE IF NOT EXISTS revenue_events (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  event_type TEXT NOT NULL, -- 'invoice_paid', 'subscription_started', 'subscription_cancelled', 'subscription_renewed', 'refund', 'project_payment'
  amount REAL NOT NULL,
  event_date INTEGER DEFAULT (unixepoch()),
  source TEXT, -- 'square', 'stripe', 'manual'
  reference_id TEXT, -- External ID from source system (Stripe invoice ID, Square payment ID, etc.)
  meta TEXT, -- JSON for additional details
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_revenue_events_date ON revenue_events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_events_type ON revenue_events(event_type);
CREATE INDEX IF NOT EXISTS idx_revenue_events_client ON revenue_events(client_id);
CREATE INDEX IF NOT EXISTS idx_revenue_events_source ON revenue_events(source);

-- ============================================
-- PIPELINE STAGE HISTORY
-- Track lead/deal progression through pipeline stages
-- ============================================

CREATE TABLE IF NOT EXISTS pipeline_stage_history (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  from_stage TEXT, -- NULL for initial creation
  to_stage TEXT NOT NULL,
  changed_at INTEGER DEFAULT (unixepoch()),
  changed_by TEXT, -- 'system', 'admin', email, etc.
  meta TEXT, -- JSON for additional context (reason, trigger, etc.)
  FOREIGN KEY (lead_id) REFERENCES restaurant_leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pipeline_history_lead ON pipeline_stage_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_history_date ON pipeline_stage_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_history_stage ON pipeline_stage_history(to_stage);

-- ============================================
-- HEALTH SCORE HISTORY
-- Daily tracking of weighted health score and components
-- ============================================

CREATE TABLE IF NOT EXISTS health_score_history (
  id TEXT PRIMARY KEY,
  score_date TEXT NOT NULL, -- YYYY-MM-DD
  overall_score REAL NOT NULL, -- 0-100 weighted score
  revenue_score REAL, -- 0-100 component score
  clients_score REAL,
  pipeline_score REAL,
  email_score REAL,
  retention_score REAL,
  component_weights TEXT, -- JSON: {"revenue": 0.35, "clients": 0.25, ...}
  component_details TEXT, -- JSON with calculation details
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(score_date)
);

CREATE INDEX IF NOT EXISTS idx_health_score_date ON health_score_history(score_date DESC);

-- ============================================
-- TREND CACHE
-- Pre-calculated trends for fast dashboard loading
-- ============================================

CREATE TABLE IF NOT EXISTS trend_cache (
  id TEXT PRIMARY KEY,
  trend_type TEXT NOT NULL, -- 'revenue_wow', 'revenue_mom', 'clients_wow', 'pipeline_wow', etc.
  trend_value REAL NOT NULL, -- Percentage change
  current_value REAL,
  previous_value REAL,
  period_start TEXT, -- YYYY-MM-DD
  period_end TEXT, -- YYYY-MM-DD
  calculated_at INTEGER DEFAULT (unixepoch()),
  expires_at INTEGER, -- When this cache entry should be refreshed
  UNIQUE(trend_type, period_end)
);

CREATE INDEX IF NOT EXISTS idx_trend_cache_type ON trend_cache(trend_type);
CREATE INDEX IF NOT EXISTS idx_trend_cache_expires ON trend_cache(expires_at);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
