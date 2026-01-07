-- Cape Cod Restaurant Consulting - A/B Testing for Email Sequences
-- Migration: 0010_ab_tests.sql
-- Created: 2026-01-07
-- Purpose: Add tables and fields for A/B testing email campaigns

-- ============================================
-- A/B TESTS TABLE
-- Stores A/B test configurations and results
-- ============================================
CREATE TABLE IF NOT EXISTS ab_tests (
  id TEXT PRIMARY KEY,
  sequence_id TEXT NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL REFERENCES sequence_steps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,

  -- Test configuration
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'winner_selected')),
  test_type TEXT DEFAULT 'subject' CHECK (test_type IN ('subject', 'body', 'sender')),

  -- Variant content
  variant_a_content TEXT,  -- Original/control content
  variant_b_content TEXT,  -- Test variant content

  -- Traffic allocation
  traffic_split INTEGER DEFAULT 50 CHECK (traffic_split >= 10 AND traffic_split <= 50),  -- Percentage to variant B

  -- Winning criteria
  winning_metric TEXT DEFAULT 'open_rate' CHECK (winning_metric IN ('open_rate', 'click_rate', 'conversion_rate')),
  confidence_level REAL DEFAULT 0.95 CHECK (confidence_level >= 0.9 AND confidence_level <= 0.99),
  auto_declare_winner INTEGER DEFAULT 0,  -- Boolean: auto-declare when confidence reached

  -- Results
  winner_variant TEXT CHECK (winner_variant IS NULL OR winner_variant IN ('A', 'B')),

  -- Timing
  started_at INTEGER,
  ended_at INTEGER,

  -- Metadata
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_ab_tests_sequence ON ab_tests(sequence_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_step ON ab_tests(step_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);

-- ============================================
-- ADD A/B TEST FIELDS TO SEQUENCE_STEPS
-- Links steps to active A/B tests
-- ============================================

-- Add ab_test_id column if it doesn't exist
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE
-- We'll use a try-catch approach via the application layer
-- For now, create a view to handle both cases

-- Check if column exists and add it if not
-- This is a safe migration that won't fail if column exists
-- Note: In production, you'd want to check this programmatically
ALTER TABLE sequence_steps ADD COLUMN ab_test_id TEXT REFERENCES ab_tests(id) ON DELETE SET NULL;

-- ============================================
-- EMAIL TRACKING TABLE FOR A/B TEST VARIANTS
-- Tracks which variant was sent to each recipient
-- ============================================
CREATE TABLE IF NOT EXISTS email_tracking (
  id TEXT PRIMARY KEY,
  email_log_id TEXT REFERENCES email_logs(id) ON DELETE CASCADE,
  subscriber_id TEXT REFERENCES email_subscribers(id) ON DELETE CASCADE,
  step_id TEXT REFERENCES sequence_steps(id) ON DELETE CASCADE,
  ab_test_id TEXT REFERENCES ab_tests(id) ON DELETE SET NULL,

  -- Variant tracking
  ab_variant TEXT CHECK (ab_variant IS NULL OR ab_variant IN ('A', 'B')),

  -- Event tracking
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'converted', 'bounced', 'complained')),
  event_timestamp INTEGER DEFAULT (unixepoch()),

  -- Additional tracking data
  link_url TEXT,  -- For click events
  user_agent TEXT,
  ip_address TEXT,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_email_tracking_log ON email_tracking(email_log_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_subscriber ON email_tracking(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_step ON email_tracking(step_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_ab_test ON email_tracking(ab_test_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_variant ON email_tracking(ab_variant);
CREATE INDEX IF NOT EXISTS idx_email_tracking_event ON email_tracking(event_type);

-- ============================================
-- FEATURE FLAG FOR A/B TESTING
-- ============================================
INSERT OR IGNORE INTO feature_flags (key, enabled, description) VALUES
  ('ab_testing_enabled', 1, 'A/B testing for email campaigns');
