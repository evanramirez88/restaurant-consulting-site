-- Migration 0050: Dashboard Cache and Performance Optimization
-- Purpose: Add caching layer for expensive dashboard queries
-- Date: 2026-01-20

-- ============================================
-- Dashboard metrics caching table
-- ============================================
CREATE TABLE IF NOT EXISTS dashboard_metrics_cache (
  id TEXT PRIMARY KEY,
  cache_key TEXT NOT NULL,
  data JSON NOT NULL,
  computed_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dashboard_cache_key ON dashboard_metrics_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_expires ON dashboard_metrics_cache(expires_at);

-- ============================================
-- Lead score caching columns
-- ============================================
-- Add score computation tracking to leads
ALTER TABLE restaurant_leads ADD COLUMN score_computed_at INTEGER;
ALTER TABLE restaurant_leads ADD COLUMN score_factors JSON;
ALTER TABLE restaurant_leads ADD COLUMN predicted_conversion_prob DECIMAL(5,2);

-- Index for finding stale scores
CREATE INDEX IF NOT EXISTS idx_leads_score_stale ON restaurant_leads(score_computed_at)
  WHERE score_computed_at IS NOT NULL;

-- ============================================
-- Client health tracking columns
-- ============================================
ALTER TABLE clients ADD COLUMN health_score INTEGER DEFAULT 50;
ALTER TABLE clients ADD COLUMN health_computed_at INTEGER;
ALTER TABLE clients ADD COLUMN health_factors JSON;
ALTER TABLE clients ADD COLUMN churn_risk TEXT DEFAULT 'low';
ALTER TABLE clients ADD COLUMN clv_estimate DECIMAL(10,2);

-- Index for at-risk clients
CREATE INDEX IF NOT EXISTS idx_clients_health ON clients(health_score)
  WHERE health_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_churn_risk ON clients(churn_risk)
  WHERE churn_risk IN ('high', 'critical');

-- ============================================
-- Query optimization indexes
-- ============================================
-- Lead scoring and status queries
CREATE INDEX IF NOT EXISTS idx_leads_score_status ON restaurant_leads(lead_score DESC, status);
CREATE INDEX IF NOT EXISTS idx_leads_last_contact ON restaurant_leads(last_contacted_at);

-- Ticket resolution queries
CREATE INDEX IF NOT EXISTS idx_tickets_resolution ON tickets(status, priority, created_at);

-- Email engagement queries
CREATE INDEX IF NOT EXISTS idx_email_recipient ON email_logs(recipient_id, first_opened_at, first_clicked_at);

-- ============================================
-- Anomaly detection tracking
-- ============================================
CREATE TABLE IF NOT EXISTS anomaly_detections (
  id TEXT PRIMARY KEY,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'high', 'critical')),
  metric_name TEXT NOT NULL,
  current_value DECIMAL(15,2),
  baseline_value DECIMAL(15,2),
  deviation_percent DECIMAL(8,2),
  message TEXT NOT NULL,
  context JSON,
  detected_at INTEGER NOT NULL DEFAULT (unixepoch()),
  acknowledged_at INTEGER,
  acknowledged_by TEXT,
  resolved_at INTEGER,
  resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_anomaly_type ON anomaly_detections(anomaly_type, severity);
CREATE INDEX IF NOT EXISTS idx_anomaly_unresolved ON anomaly_detections(detected_at)
  WHERE resolved_at IS NULL;

-- ============================================
-- Health score history for trend analysis
-- ============================================
CREATE TABLE IF NOT EXISTS client_health_history (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  health_score INTEGER NOT NULL,
  factors JSON,
  recorded_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_health_history_client ON client_health_history(client_id, recorded_at DESC);

-- Trigger to record health history on update
CREATE TRIGGER IF NOT EXISTS record_health_history
AFTER UPDATE OF health_score ON clients
WHEN NEW.health_score IS NOT NULL AND (OLD.health_score IS NULL OR OLD.health_score != NEW.health_score)
BEGIN
  INSERT INTO client_health_history (id, client_id, health_score, factors, recorded_at)
  VALUES (
    'hh_' || lower(hex(randomblob(8))),
    NEW.id,
    NEW.health_score,
    NEW.health_factors,
    unixepoch()
  );
END;

-- ============================================
-- Cleanup job tracking
-- ============================================
CREATE TABLE IF NOT EXISTS cache_cleanup_log (
  id TEXT PRIMARY KEY,
  cache_type TEXT NOT NULL,
  records_deleted INTEGER NOT NULL DEFAULT 0,
  executed_at INTEGER NOT NULL DEFAULT (unixepoch())
);
