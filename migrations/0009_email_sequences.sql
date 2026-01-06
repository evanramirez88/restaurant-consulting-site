-- Cape Cod Restaurant Consulting - Email Sequence Automation
-- Migration: 0009_email_sequences.sql
-- Created: 2026-01-06
-- Purpose: Add tables for automated email sequences with rate-limited dispatch

-- ============================================
-- EMAIL SUBSCRIBERS TABLE
-- People who receive automated email sequences
-- ============================================
CREATE TABLE IF NOT EXISTS email_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,

  -- Subscriber source tracking
  source TEXT CHECK (source IN ('contact_form', 'quote_builder', 'menu_builder', 'manual', 'import', 'api')),
  source_id TEXT,  -- Reference to original record (quote_id, menu_job_id, etc.)

  -- Status management
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',       -- Receiving emails
    'unsubscribed', -- User opted out
    'bounced',      -- Email bounced
    'complained',   -- Marked as spam
    'suppressed'    -- Admin suppressed
  )),

  -- Engagement tracking
  last_email_sent_at INTEGER,
  last_email_opened_at INTEGER,
  last_email_clicked_at INTEGER,
  total_emails_sent INTEGER DEFAULT 0,
  total_emails_opened INTEGER DEFAULT 0,
  total_emails_clicked INTEGER DEFAULT 0,

  -- Bounce/complaint tracking
  bounce_type TEXT CHECK (bounce_type IN ('hard', 'soft')),
  bounce_reason TEXT,
  bounced_at INTEGER,
  complained_at INTEGER,

  -- Unsubscribe tracking
  unsubscribed_at INTEGER,
  unsubscribe_reason TEXT,

  -- Metadata
  tags_json TEXT,  -- JSON array of tags for segmentation
  custom_fields_json TEXT,  -- Additional custom data

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_email_subs_email ON email_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_email_subs_status ON email_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_email_subs_source ON email_subscribers(source);

-- ============================================
-- EMAIL SEQUENCES TABLE
-- Defines a sequence of emails to send
-- ============================================
CREATE TABLE IF NOT EXISTS email_sequences (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,

  -- Sequence settings
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'signup',       -- When subscriber is added
    'manual',       -- Manually triggered
    'tag_added',    -- When a tag is added
    'quote_created',-- When a quote is created
    'menu_uploaded' -- When a menu is uploaded
  )),
  trigger_value TEXT,  -- e.g., specific tag name

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),

  -- Timing
  timezone TEXT DEFAULT 'America/New_York',
  send_window_start INTEGER,  -- Hour (0-23) to start sending
  send_window_end INTEGER,    -- Hour (0-23) to stop sending
  send_days_json TEXT,        -- JSON array of days to send (0-6, 0=Sunday)

  -- Stats
  total_subscribers INTEGER DEFAULT 0,
  total_completed INTEGER DEFAULT 0,
  total_cancelled INTEGER DEFAULT 0,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sequences_status ON email_sequences(status);
CREATE INDEX IF NOT EXISTS idx_sequences_trigger ON email_sequences(trigger_type);

-- ============================================
-- SEQUENCE STEPS TABLE
-- Individual emails within a sequence
-- ============================================
CREATE TABLE IF NOT EXISTS sequence_steps (
  id TEXT PRIMARY KEY,
  sequence_id TEXT NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,

  -- Step order
  step_number INTEGER NOT NULL,

  -- Email content
  subject TEXT NOT NULL,
  from_name TEXT DEFAULT 'Cape Cod Restaurant Consulting',
  from_email TEXT DEFAULT 'noreply@ccrestaurantconsulting.com',
  reply_to TEXT,

  -- Content (supports personalization tokens)
  body_html TEXT NOT NULL,
  body_text TEXT,  -- Plain text fallback

  -- Timing
  delay_minutes INTEGER NOT NULL DEFAULT 0,  -- Minutes after previous step (or sequence start)
  delay_type TEXT NOT NULL DEFAULT 'after_previous' CHECK (delay_type IN (
    'after_previous',  -- Minutes after previous step completed
    'after_start',     -- Minutes after sequence started
    'specific_time'    -- Send at specific time of day
  )),
  specific_hour INTEGER,  -- For specific_time: hour (0-23)
  specific_minute INTEGER, -- For specific_time: minute (0-59)

  -- Conditions
  skip_if_opened_previous INTEGER DEFAULT 0,  -- Skip if previous email was opened
  skip_if_clicked_previous INTEGER DEFAULT 0, -- Skip if previous email was clicked

  -- Status
  is_active INTEGER DEFAULT 1,

  -- Stats
  total_sent INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_complained INTEGER DEFAULT 0,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),

  UNIQUE(sequence_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_steps_sequence ON sequence_steps(sequence_id);
CREATE INDEX IF NOT EXISTS idx_steps_active ON sequence_steps(is_active);

-- ============================================
-- SUBSCRIBER SEQUENCES TABLE
-- Tracks subscriber progress through sequences
-- ============================================
CREATE TABLE IF NOT EXISTS subscriber_sequences (
  id TEXT PRIMARY KEY,
  subscriber_id TEXT NOT NULL REFERENCES email_subscribers(id) ON DELETE CASCADE,
  sequence_id TEXT NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,

  -- Current position
  current_step_number INTEGER DEFAULT 0,  -- 0 = not started, 1+ = completed that step

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',      -- In progress
    'processing',  -- Currently being processed by dispatcher
    'paused',      -- Temporarily paused
    'completed',   -- All steps completed
    'cancelled',   -- Manually cancelled
    'bounced',     -- Stopped due to bounce
    'unsubscribed' -- Stopped due to unsubscribe
  )),

  -- Scheduling
  next_step_id TEXT REFERENCES sequence_steps(id) ON DELETE SET NULL,
  next_execution_time INTEGER,  -- Unix timestamp for next email

  -- Tracking
  started_at INTEGER DEFAULT (unixepoch()),
  last_step_sent_at INTEGER,
  completed_at INTEGER,
  cancelled_at INTEGER,
  cancel_reason TEXT,

  -- Error handling
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_at INTEGER,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),

  UNIQUE(subscriber_id, sequence_id)
);

CREATE INDEX IF NOT EXISTS idx_sub_seq_subscriber ON subscriber_sequences(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_sub_seq_sequence ON subscriber_sequences(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sub_seq_status ON subscriber_sequences(status);
CREATE INDEX IF NOT EXISTS idx_sub_seq_next_exec ON subscriber_sequences(next_execution_time)
  WHERE status = 'active';

-- ============================================
-- EMAIL LOGS TABLE
-- Detailed log of all sent emails
-- ============================================
CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,

  -- References
  subscriber_id TEXT REFERENCES email_subscribers(id) ON DELETE SET NULL,
  subscriber_sequence_id TEXT REFERENCES subscriber_sequences(id) ON DELETE SET NULL,
  sequence_step_id TEXT REFERENCES sequence_steps(id) ON DELETE SET NULL,

  -- Email details
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,

  -- Resend tracking
  resend_id TEXT,  -- Resend's email ID
  idempotency_key TEXT UNIQUE,  -- Prevents duplicate sends

  -- Status
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued',     -- In queue
    'sending',    -- Being sent
    'sent',       -- Successfully sent
    'delivered',  -- Confirmed delivered
    'opened',     -- Email opened
    'clicked',    -- Link clicked
    'bounced',    -- Bounced
    'complained', -- Marked as spam
    'failed'      -- Failed to send
  )),

  -- Timing
  queued_at INTEGER DEFAULT (unixepoch()),
  sent_at INTEGER,
  delivered_at INTEGER,
  opened_at INTEGER,
  clicked_at INTEGER,
  bounced_at INTEGER,
  complained_at INTEGER,

  -- Error tracking
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Engagement details
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  clicked_links_json TEXT,  -- JSON array of clicked links

  -- Metadata
  user_agent TEXT,
  ip_address TEXT,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_email_logs_subscriber ON email_logs(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sequence ON email_logs(subscriber_sequence_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_resend ON email_logs(resend_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_idempotency ON email_logs(idempotency_key);

-- ============================================
-- EMAIL TEMPLATES TABLE
-- Reusable email templates
-- ============================================
CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,

  -- Content
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,

  -- Personalization
  available_tokens_json TEXT,  -- JSON array of available tokens

  -- Status
  is_active INTEGER DEFAULT 1,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- ============================================
-- FEATURE FLAG FOR EMAIL SEQUENCES
-- ============================================
INSERT OR IGNORE INTO feature_flags (key, enabled, description) VALUES
  ('email_sequences_enabled', 0, 'Automated email sequence system');
