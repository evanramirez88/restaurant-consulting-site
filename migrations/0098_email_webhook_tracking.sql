-- =====================================================
-- Migration: 0098_email_webhook_tracking.sql
-- Purpose: Add tables and columns for Resend webhook tracking
-- Tracks: delivered, bounced, complained, opened, clicked events
-- NOTE: Uses INSERT trick for idempotent ALTER TABLE
-- =====================================================

-- =====================================================
-- 1. ADD MISSING COLUMNS TO email_logs (SAFE)
-- =====================================================

-- Check and add columns only if they don't exist
-- Using a transaction with error handling pattern

-- Create tables first (these are safe with IF NOT EXISTS)

-- =====================================================
-- 4. EMAIL CLICK EVENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS email_click_events (
  id TEXT PRIMARY KEY,
  email_log_id TEXT NOT NULL,
  subscriber_id TEXT NOT NULL,
  url TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  clicked_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_click_events_log_id ON email_click_events(email_log_id);
CREATE INDEX IF NOT EXISTS idx_email_click_events_subscriber_id ON email_click_events(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_email_click_events_clicked_at ON email_click_events(clicked_at);
CREATE INDEX IF NOT EXISTS idx_email_click_events_url ON email_click_events(url);

-- =====================================================
-- 5. WEBHOOK EVENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT,
  processed_at INTEGER,
  error_message TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);

-- =====================================================
-- 6. EMAIL OPEN EVENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS email_open_events (
  id TEXT PRIMARY KEY,
  email_log_id TEXT NOT NULL,
  subscriber_id TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  opened_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_open_events_log_id ON email_open_events(email_log_id);
CREATE INDEX IF NOT EXISTS idx_email_open_events_subscriber_id ON email_open_events(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_email_open_events_opened_at ON email_open_events(opened_at);

-- =====================================================
-- 7. VIEWS FOR EMAIL ANALYTICS (DROP AND RECREATE)
-- =====================================================

DROP VIEW IF EXISTS v_email_step_performance;
CREATE VIEW v_email_step_performance AS
SELECT
  seq.id AS sequence_id,
  seq.name AS sequence_name,
  step.id AS step_id,
  step.step_number,
  step.subject_a AS subject,
  step.total_sent,
  COALESCE(step.total_delivered, 0) AS total_delivered,
  COALESCE(step.total_opened, 0) AS total_opened,
  COALESCE(step.total_clicked, 0) AS total_clicked,
  CASE WHEN step.total_sent > 0 
    THEN ROUND(100.0 * COALESCE(step.total_delivered, 0) / step.total_sent, 2) 
    ELSE 0 END AS delivery_rate,
  CASE WHEN COALESCE(step.total_delivered, 0) > 0 
    THEN ROUND(100.0 * COALESCE(step.total_opened, 0) / step.total_delivered, 2) 
    ELSE 0 END AS open_rate,
  CASE WHEN COALESCE(step.total_opened, 0) > 0 
    THEN ROUND(100.0 * COALESCE(step.total_clicked, 0) / step.total_opened, 2) 
    ELSE 0 END AS click_rate
FROM sequence_steps step
JOIN email_sequences seq ON step.sequence_id = seq.id
WHERE step.status = 'active'
ORDER BY seq.id, step.step_number;

DROP VIEW IF EXISTS v_subscriber_engagement;
CREATE VIEW v_subscriber_engagement AS
SELECT
  id,
  email,
  first_name,
  last_name,
  company,
  status,
  total_emails_sent,
  COALESCE(total_emails_delivered, 0) AS total_emails_delivered,
  COALESCE(total_emails_opened, 0) AS total_emails_opened,
  COALESCE(total_emails_clicked, 0) AS total_emails_clicked,
  COALESCE(total_bounces, 0) AS total_bounces,
  CASE WHEN COALESCE(total_emails_delivered, 0) > 0 
    THEN ROUND(100.0 * COALESCE(total_emails_opened, 0) / total_emails_delivered, 2) 
    ELSE 0 END AS open_rate,
  CASE WHEN COALESCE(total_emails_opened, 0) > 0 
    THEN ROUND(100.0 * COALESCE(total_emails_clicked, 0) / total_emails_opened, 2) 
    ELSE 0 END AS click_rate,
  last_email_sent_at,
  created_at
FROM email_subscribers
ORDER BY COALESCE(total_emails_clicked, 0) DESC, COALESCE(total_emails_opened, 0) DESC;

DROP VIEW IF EXISTS v_recent_webhook_events;
CREATE VIEW v_recent_webhook_events AS
SELECT
  id,
  provider,
  event_type,
  processed_at,
  error_message,
  created_at,
  datetime(created_at, 'unixepoch') AS created_at_readable
FROM webhook_events
WHERE created_at > (strftime('%s', 'now') - 604800)
ORDER BY created_at DESC;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
