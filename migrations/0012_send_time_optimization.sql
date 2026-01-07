-- Send Time Optimization Tables
-- Day 3: Email Admin UI Build

-- Send time configuration per sequence
CREATE TABLE IF NOT EXISTS send_time_configs (
  id TEXT PRIMARY KEY,
  sequence_id TEXT,
  mode TEXT NOT NULL DEFAULT 'optimal' CHECK (mode IN ('fixed', 'optimal', 'subscriber_timezone', 'custom')),
  fixed_time TEXT,
  fixed_days TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  custom_schedule TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (sequence_id) REFERENCES email_sequences(id) ON DELETE CASCADE
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_send_time_configs_sequence ON send_time_configs(sequence_id);

-- Quiet hours configuration
CREATE TABLE IF NOT EXISTS quiet_hours_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  enabled INTEGER NOT NULL DEFAULT 1,
  start_hour INTEGER NOT NULL DEFAULT 22,
  end_hour INTEGER NOT NULL DEFAULT 8,
  skip_weekends INTEGER NOT NULL DEFAULT 0,
  weekend_start_hour INTEGER,
  weekend_end_hour INTEGER,
  holidays TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Scheduled emails queue (for send time optimization)
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id TEXT PRIMARY KEY,
  subscriber_id TEXT NOT NULL,
  sequence_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  scheduled_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  send_time_mode TEXT,
  timezone TEXT,
  original_scheduled_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (subscriber_id) REFERENCES email_subscribers(id) ON DELETE CASCADE,
  FOREIGN KEY (sequence_id) REFERENCES email_sequences(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES sequence_steps(id) ON DELETE CASCADE
);

-- Indexes for scheduled emails
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_scheduled_at ON scheduled_emails(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status ON scheduled_emails(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_subscriber ON scheduled_emails(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_sequence ON scheduled_emails(sequence_id);

-- Add user_agent and clicked_link columns to email_logs if not exist
-- These are needed for device analytics and link tracking
-- Note: D1 doesn't support IF NOT EXISTS for ALTER TABLE, so wrap in try/catch in migration runner

-- Add user_agent column for device tracking
-- ALTER TABLE email_logs ADD COLUMN user_agent TEXT;

-- Add clicked_link column for link tracking
-- ALTER TABLE email_logs ADD COLUMN clicked_link TEXT;

-- Insert default quiet hours config
INSERT OR IGNORE INTO quiet_hours_config (id, enabled, start_hour, end_hour, skip_weekends, holidays, created_at, updated_at)
VALUES ('default', 1, 22, 8, 0, '[]', unixepoch(), unixepoch());
