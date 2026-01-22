-- ============================================
-- CONVERSION TRACKING SCHEMA
-- Migration: 0067_conversion_tracking.sql
-- Adds conversion tracking columns and table
-- ============================================

-- Create email_conversions table for detailed conversion tracking
CREATE TABLE IF NOT EXISTS email_conversions (
  id TEXT PRIMARY KEY,
  subscriber_id TEXT NOT NULL,
  email_log_id TEXT,

  -- Conversion details
  conversion_type TEXT NOT NULL,
  conversion_value REAL,
  notes TEXT,
  source TEXT,

  -- Attribution
  sequence_id TEXT,
  step_id TEXT,
  campaign_id TEXT,

  -- Timestamps
  converted_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),

  FOREIGN KEY (subscriber_id) REFERENCES email_subscribers(id),
  FOREIGN KEY (email_log_id) REFERENCES email_logs(id)
);

-- Create indexes for conversion queries
CREATE INDEX IF NOT EXISTS idx_email_conversions_subscriber ON email_conversions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_email_conversions_type ON email_conversions(conversion_type);
CREATE INDEX IF NOT EXISTS idx_email_conversions_date ON email_conversions(converted_at);
