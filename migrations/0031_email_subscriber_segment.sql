-- Migration 0031: Add segment column to email_subscribers
-- Required for enrollment API to track lead segment assignment
-- Date: 2026-01-17

-- Add segment column to email_subscribers table
ALTER TABLE email_subscribers ADD COLUMN segment TEXT;

-- Add door column (national_remote vs local_regional)
ALTER TABLE email_subscribers ADD COLUMN door TEXT DEFAULT 'national_remote';

-- Add current_pos column for POS system tracking
ALTER TABLE email_subscribers ADD COLUMN current_pos TEXT;

-- Add lead_score column
ALTER TABLE email_subscribers ADD COLUMN lead_score INTEGER DEFAULT 0;

-- Add enrolled_at timestamp
ALTER TABLE email_subscribers ADD COLUMN enrolled_at DATETIME;

-- Add enrollment_source to track how they were enrolled
ALTER TABLE email_subscribers ADD COLUMN enrollment_source TEXT DEFAULT 'manual';

-- Create index for segment queries
CREATE INDEX IF NOT EXISTS idx_email_subscribers_segment ON email_subscribers(segment);

-- Create index for door queries
CREATE INDEX IF NOT EXISTS idx_email_subscribers_door ON email_subscribers(door);

-- Create index for current_pos queries
CREATE INDEX IF NOT EXISTS idx_email_subscribers_pos ON email_subscribers(current_pos);

-- Create index for lead_score queries
CREATE INDEX IF NOT EXISTS idx_email_subscribers_score ON email_subscribers(lead_score);

-- Create composite index for segment + door filtering
CREATE INDEX IF NOT EXISTS idx_email_subscribers_segment_door ON email_subscribers(segment, door);
