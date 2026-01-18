-- Business Brief Reports System
-- Migration: 0033_business_brief_reports.sql
-- Created: 2026-01-18

-- Generated Reports Storage
CREATE TABLE IF NOT EXISTS generated_reports (
  id TEXT PRIMARY KEY,
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  parameters TEXT,                    -- JSON parameters used
  format TEXT DEFAULT 'dashboard',    -- dashboard, pdf, excel, email
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'generating', 'completed', 'failed')),
  report_data TEXT,                   -- JSON report content
  file_url TEXT,                      -- R2 URL if exported
  file_size INTEGER,
  recipient_count INTEGER DEFAULT 0,
  error_message TEXT,
  generated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER                  -- Auto-cleanup timestamp
);

CREATE INDEX IF NOT EXISTS idx_generated_reports_type ON generated_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_generated_reports_status ON generated_reports(status);
CREATE INDEX IF NOT EXISTS idx_generated_reports_date ON generated_reports(generated_at DESC);

-- Scheduled Reports
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id TEXT PRIMARY KEY,
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly', 'quarterly')),
  format TEXT DEFAULT 'email',
  recipients TEXT,                    -- JSON array of email addresses
  parameters TEXT,                    -- JSON parameters
  schedule_config TEXT,               -- JSON cron-like config
  next_run_at INTEGER,
  last_run_at INTEGER,
  last_status TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active ON scheduled_reports(is_active, next_run_at);

-- AI Query Log (for audit and analytics)
CREATE TABLE IF NOT EXISTS ai_query_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  response_preview TEXT,              -- First 200 chars of response
  action_type TEXT,                   -- quick_action ID if used
  model_used TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  response_time_ms INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_ai_query_log_date ON ai_query_log(created_at DESC);

-- AI Conversation Sessions (optional future use)
CREATE TABLE IF NOT EXISTS ai_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  context_snapshot TEXT,              -- JSON business context at session start
  message_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_activity INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Report Templates (for custom reports)
CREATE TABLE IF NOT EXISTS report_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  data_sources TEXT,                  -- JSON array of table/API sources
  metrics TEXT,                       -- JSON metric definitions
  visualizations TEXT,                -- JSON chart configs
  is_system INTEGER DEFAULT 0,        -- 1 = built-in, 0 = user-created
  created_by TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Insert default system report templates
INSERT OR IGNORE INTO report_templates (id, name, description, category, is_system, created_at)
VALUES
  ('daily-executive', 'Daily Executive Brief', 'AI-generated daily summary with key metrics', 'financial', 1, unixepoch()),
  ('weekly-pipeline', 'Weekly Pipeline Report', 'Lead funnel and quote analysis', 'sales', 1, unixepoch()),
  ('monthly-revenue', 'Monthly Revenue Analysis', 'Revenue breakdown by service and client', 'financial', 1, unixepoch()),
  ('client-health', 'Client Health Scorecard', 'Health scores and risk indicators', 'operations', 1, unixepoch()),
  ('email-performance', 'Email Campaign Performance', 'Sequence analytics and optimization', 'marketing', 1, unixepoch()),
  ('intelligence-digest', 'Intelligence Agent Digest', 'Core 4 agent findings summary', 'sales', 1, unixepoch());
