-- Migration: 0088_email_unsubscribe_enhancements.sql
-- Adds unsubscribe token and engagement scoring enhancements
-- Applied: 2026-01-26

-- ============================================
-- UNSUBSCRIBE TOKENS
-- Unique token per subscriber for secure unsubscribe links
-- ============================================

-- Add unsubscribe_token column to email_subscribers
ALTER TABLE email_subscribers ADD COLUMN unsubscribe_token TEXT;

-- Create unique index for token lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_unsubscribe_token ON email_subscribers(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;

-- Add unsubscribe tracking columns
ALTER TABLE email_subscribers ADD COLUMN unsubscribe_reason TEXT;
ALTER TABLE email_subscribers ADD COLUMN unsubscribe_source TEXT;
ALTER TABLE email_subscribers ADD COLUMN unsubscribe_email_log_id TEXT;

-- Backfill tokens for existing subscribers using hex(randomblob(16))
UPDATE email_subscribers
SET unsubscribe_token = lower(hex(randomblob(16)))
WHERE unsubscribe_token IS NULL AND status = 'active';

-- ============================================
-- ENGAGEMENT SCORE ENHANCEMENTS
-- Track engagement scoring updates
-- ============================================

-- Add engagement tracking columns if not exist
ALTER TABLE email_subscribers ADD COLUMN engagement_score_updated_at INTEGER;
ALTER TABLE email_subscribers ADD COLUMN last_engagement_at INTEGER;

-- ============================================
-- EMAIL_LOGS ENHANCEMENTS
-- Track unsubscribe events
-- ============================================

-- Add unsubscribe tracking to email_logs
ALTER TABLE email_logs ADD COLUMN unsubscribed_at INTEGER;

-- ============================================
-- EMAIL UNSUBSCRIBE LOG TABLE
-- Full audit trail of unsubscribe events
-- ============================================

CREATE TABLE IF NOT EXISTS email_unsubscribe_log (
  id TEXT PRIMARY KEY,
  subscriber_id TEXT NOT NULL REFERENCES email_subscribers(id),
  email TEXT NOT NULL,
  unsubscribe_token TEXT,
  email_log_id TEXT REFERENCES email_logs(id),
  sequence_id TEXT REFERENCES email_sequences(id),

  -- Unsubscribe details
  reason TEXT,
  source TEXT CHECK (source IN ('link', 'manual', 'webhook', 'admin', 'bounce', 'complaint')),
  ip_address TEXT,
  user_agent TEXT,

  -- Timestamps
  unsubscribed_at INTEGER DEFAULT (unixepoch()),
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_unsubscribe_log_subscriber ON email_unsubscribe_log(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_unsubscribe_log_email ON email_unsubscribe_log(email);
CREATE INDEX IF NOT EXISTS idx_unsubscribe_log_token ON email_unsubscribe_log(unsubscribe_token);
CREATE INDEX IF NOT EXISTS idx_unsubscribe_log_sequence ON email_unsubscribe_log(sequence_id);
