-- R&G Consulting - Resend Webhook Enhancements
-- Migration: 0039_resend_webhook_enhancements.sql
-- Created: 2026-01-17
-- Updated: 2026-01-17 (Fixed duplicate column issues)
--
-- This migration adds webhook event tracking table and indexes
-- for Resend webhook processing.

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
