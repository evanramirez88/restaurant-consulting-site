-- Migration: 0079_email_tracking_columns.sql
-- Adds missing columns for webhook tracking and conversion tracking
-- Applied: 2026-01-25

-- ============================================
-- EMAIL_LOGS TABLE ADDITIONS
-- ============================================

-- Add resend_id for webhook lookups (Resend sends email_id in webhook events)
ALTER TABLE email_logs ADD COLUMN resend_id TEXT;
CREATE INDEX IF NOT EXISTS idx_email_logs_resend ON email_logs(resend_id);

-- Add updated_at for tracking last modification
ALTER TABLE email_logs ADD COLUMN updated_at INTEGER;

-- Add conversion tracking columns
ALTER TABLE email_logs ADD COLUMN converted_at INTEGER;
ALTER TABLE email_logs ADD COLUMN conversion_type TEXT;
ALTER TABLE email_logs ADD COLUMN conversion_value REAL;
ALTER TABLE email_logs ADD COLUMN conversion_notes TEXT;
ALTER TABLE email_logs ADD COLUMN conversion_source TEXT;

-- Backfill resend_id from message_id
UPDATE email_logs SET resend_id = message_id WHERE resend_id IS NULL AND message_id IS NOT NULL;

-- ============================================
-- EMAIL_SUBSCRIBERS TABLE ADDITIONS
-- ============================================

-- Add conversion tracking columns
ALTER TABLE email_subscribers ADD COLUMN converted_at INTEGER;
ALTER TABLE email_subscribers ADD COLUMN conversion_type TEXT;
ALTER TABLE email_subscribers ADD COLUMN conversion_value REAL DEFAULT 0;
ALTER TABLE email_subscribers ADD COLUMN total_conversions INTEGER DEFAULT 0;
ALTER TABLE email_subscribers ADD COLUMN last_conversion_at INTEGER;

-- Add timestamp columns for bounce/complaint tracking
ALTER TABLE email_subscribers ADD COLUMN bounced_at INTEGER;
ALTER TABLE email_subscribers ADD COLUMN complained_at INTEGER;
