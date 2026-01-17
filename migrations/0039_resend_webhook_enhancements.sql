-- R&G Consulting - Resend Webhook Enhancements
-- Migration: 0039_resend_webhook_enhancements.sql
-- Created: 2026-01-17
--
-- This migration adds/ensures columns needed for Resend webhook processing:
-- - email_suppression_list enhancements
-- - email_subscribers engagement tracking
-- - email_logs tracking columns
--
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
-- so these statements may fail silently if columns already exist.

-- ============================================
-- EMAIL_SUPPRESSION_LIST ENHANCEMENTS
-- ============================================

-- Ensure source column exists (tracks where suppression originated)
-- Note: This column should already exist from 0009_email_automation.sql
-- but adding for safety in case older deployments are missing it

-- Add last_updated_at for tracking when suppression was last modified
ALTER TABLE email_suppression_list ADD COLUMN last_updated_at INTEGER;

-- Add original_email_id to track which message caused the suppression
ALTER TABLE email_suppression_list ADD COLUMN original_email_id TEXT;

-- Add suppression_count for tracking repeated bounces/complaints
ALTER TABLE email_suppression_list ADD COLUMN suppression_count INTEGER DEFAULT 1;

-- ============================================
-- EMAIL_SUBSCRIBERS ENGAGEMENT TRACKING
-- ============================================

-- Add last_engaged_at to track most recent any engagement (open or click)
ALTER TABLE email_subscribers ADD COLUMN last_engaged_at INTEGER;

-- Add total_opens and total_clicks as aliases/additional tracking
-- (The existing columns are total_emails_opened and total_emails_clicked)
-- These new columns can be used for aggregate tracking across all email types
ALTER TABLE email_subscribers ADD COLUMN total_opens INTEGER DEFAULT 0;
ALTER TABLE email_subscribers ADD COLUMN total_clicks INTEGER DEFAULT 0;

-- ============================================
-- EMAIL_LOGS TRACKING ENHANCEMENTS
-- ============================================

-- Add opened_at as alias for first_opened_at (some code may use this name)
ALTER TABLE email_logs ADD COLUMN opened_at INTEGER;

-- Add clicked_at as alias for first_clicked_at (some code may use this name)
ALTER TABLE email_logs ADD COLUMN clicked_at INTEGER;

-- Add failure_message for detailed error tracking
ALTER TABLE email_logs ADD COLUMN failure_message TEXT;

-- ============================================
-- WEBHOOK EVENTS LOG TABLE
-- Track all incoming webhook events for debugging
-- ============================================
CREATE TABLE IF NOT EXISTS resend_webhook_events (
  id TEXT PRIMARY KEY,

  -- Event details
  event_type TEXT NOT NULL,
  email_id TEXT,
  email_to TEXT,
  email_from TEXT,
  subject TEXT,

  -- Raw payload for debugging
  payload_json TEXT,

  -- Processing status
  processed INTEGER DEFAULT 0,
  processed_at INTEGER,
  error_message TEXT,

  -- Metadata
  svix_id TEXT,
  svix_timestamp INTEGER,
  ip_address TEXT,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_resend_events_type ON resend_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_resend_events_email_id ON resend_webhook_events(email_id);
CREATE INDEX IF NOT EXISTS idx_resend_events_created ON resend_webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_resend_events_processed ON resend_webhook_events(processed);

-- ============================================
-- UPDATE TRIGGERS
-- Automatically update last_engaged_at when opens/clicks occur
-- ============================================

-- Trigger to update last_engaged_at on email_subscribers
-- when total_emails_opened or total_emails_clicked changes
CREATE TRIGGER IF NOT EXISTS tr_update_last_engaged
AFTER UPDATE OF total_emails_opened, total_emails_clicked ON email_subscribers
WHEN NEW.total_emails_opened > OLD.total_emails_opened
   OR NEW.total_emails_clicked > OLD.total_emails_clicked
BEGIN
  UPDATE email_subscribers
  SET last_engaged_at = unixepoch()
  WHERE id = NEW.id AND last_engaged_at IS NULL;
END;

-- ============================================
-- SUPPRESSION LIST INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_suppression_source ON email_suppression_list(source);
CREATE INDEX IF NOT EXISTS idx_suppression_created ON email_suppression_list(created_at);

-- ============================================
-- COMMENTS/DOCUMENTATION
-- ============================================
-- Resend webhook events to handle:
-- - email.sent: Email accepted by Resend
-- - email.delivered: Email delivered to recipient's server
-- - email.delivery_delayed: Temporary delivery failure
-- - email.opened: Email opened (pixel tracking)
-- - email.clicked: Link in email clicked
-- - email.bounced: Email bounced (hard or soft)
-- - email.complained: Email marked as spam
--
-- Webhook URL: https://ccrestaurantconsulting.com/api/webhooks/resend
-- Environment variable needed: RESEND_WEBHOOK_SECRET (from Resend dashboard)
