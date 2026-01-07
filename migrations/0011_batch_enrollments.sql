-- Migration: Batch Enrollments for Enrollment Wizard
-- Created: 2026-01-07
-- Description: Tables to track batch enrollment operations and errors

-- Batch enrollments table - tracks enrollment operations
CREATE TABLE IF NOT EXISTS batch_enrollments (
  id TEXT PRIMARY KEY,
  sequence_id TEXT NOT NULL,
  source TEXT NOT NULL, -- manual, segment, all
  source_details TEXT, -- JSON with segment_id, emails, filters
  schedule_type TEXT NOT NULL, -- immediate, scheduled, drip
  scheduled_at INTEGER, -- Unix timestamp for scheduled enrollments
  timezone TEXT DEFAULT 'America/New_York',
  drip_config TEXT, -- JSON with per_hour, per_day, start_at
  total_count INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, cancelled, failed
  started_at INTEGER,
  completed_at INTEGER,
  created_by TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (sequence_id) REFERENCES email_sequences(id)
);

-- Create indexes for batch_enrollments
CREATE INDEX IF NOT EXISTS idx_batch_enrollments_sequence ON batch_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_batch_enrollments_status ON batch_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_batch_enrollments_created ON batch_enrollments(created_at);
CREATE INDEX IF NOT EXISTS idx_batch_enrollments_scheduled ON batch_enrollments(scheduled_at);

-- Enrollment errors table - tracks individual failures
CREATE TABLE IF NOT EXISTS enrollment_errors (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL,
  subscriber_id TEXT,
  subscriber_email TEXT,
  error_message TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (enrollment_id) REFERENCES batch_enrollments(id)
);

-- Create indexes for enrollment_errors
CREATE INDEX IF NOT EXISTS idx_enrollment_errors_enrollment ON enrollment_errors(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_errors_subscriber ON enrollment_errors(subscriber_id);

-- Ensure sequence_enrollments table exists (for individual subscriber enrollments)
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id TEXT PRIMARY KEY,
  subscriber_id TEXT NOT NULL,
  sequence_id TEXT NOT NULL,
  batch_enrollment_id TEXT, -- Links to batch_enrollments if part of a batch
  status TEXT DEFAULT 'active', -- active, paused, completed, cancelled
  current_step INTEGER DEFAULT 1,
  enrolled_at INTEGER DEFAULT (unixepoch()),
  paused_at INTEGER,
  completed_at INTEGER,
  cancelled_at INTEGER,
  next_send_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (subscriber_id) REFERENCES email_subscribers(id),
  FOREIGN KEY (sequence_id) REFERENCES email_sequences(id),
  FOREIGN KEY (batch_enrollment_id) REFERENCES batch_enrollments(id)
);

-- Create indexes for sequence_enrollments
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_subscriber ON sequence_enrollments(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_sequence ON sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON sequence_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_batch ON sequence_enrollments(batch_enrollment_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_next_send ON sequence_enrollments(next_send_at);

-- Create unique constraint to prevent duplicate active enrollments
CREATE UNIQUE INDEX IF NOT EXISTS idx_sequence_enrollments_active_unique
ON sequence_enrollments(subscriber_id, sequence_id)
WHERE status IN ('active', 'paused');
