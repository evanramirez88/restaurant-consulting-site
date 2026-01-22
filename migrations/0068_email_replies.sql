-- ============================================
-- EMAIL REPLIES TRACKING
-- Migration: 0068_email_replies.sql
-- Tracks replies to campaign emails
-- ============================================

-- Create email_replies table
CREATE TABLE IF NOT EXISTS email_replies (
  id TEXT PRIMARY KEY,
  subscriber_id TEXT,
  lead_id TEXT,

  -- Reply details
  email TEXT NOT NULL,
  subject TEXT,
  body_preview TEXT,

  -- Classification
  sentiment TEXT DEFAULT 'neutral', -- 'positive', 'negative', 'neutral', 'question'
  priority TEXT DEFAULT 'medium',   -- 'high', 'medium', 'low'
  source TEXT DEFAULT 'manual',     -- 'gmail', 'zapier', 'manual', 'webhook'

  -- Status
  processed INTEGER DEFAULT 0,
  processed_at INTEGER,
  processed_by TEXT,
  notes TEXT,

  -- Attribution
  original_email_id TEXT,
  sequence_id TEXT,
  campaign_id TEXT,

  -- Timestamps
  received_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),

  FOREIGN KEY (subscriber_id) REFERENCES email_subscribers(id),
  FOREIGN KEY (lead_id) REFERENCES restaurant_leads(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_replies_email ON email_replies(email);
CREATE INDEX IF NOT EXISTS idx_email_replies_subscriber ON email_replies(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_lead ON email_replies(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_received ON email_replies(received_at);
CREATE INDEX IF NOT EXISTS idx_email_replies_processed ON email_replies(processed);
CREATE INDEX IF NOT EXISTS idx_email_replies_priority ON email_replies(priority);

-- Add total_replies column to email_subscribers
ALTER TABLE email_subscribers ADD COLUMN total_replies INTEGER DEFAULT 0;
ALTER TABLE email_subscribers ADD COLUMN replied_at INTEGER;
