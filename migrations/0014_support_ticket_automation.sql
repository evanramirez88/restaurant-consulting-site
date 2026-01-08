-- Phase 5: Support Ticket Automation Tables
-- Created: 2026-01-07

-- Support ticket processing logs
CREATE TABLE IF NOT EXISTS support_ticket_logs (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  client_id TEXT,
  restaurant_id TEXT,
  analysis TEXT,  -- JSON: { task_type, confidence, can_automate, extracted_data }
  decision TEXT,  -- JSON: { decision, risk, reasons }
  status TEXT CHECK (status IN ('analyzed', 'success', 'queued_for_approval', 'needs_info', 'manual_required', 'failed')),
  job_id TEXT,
  approval_id TEXT,
  customer_response TEXT,
  processing_time_ms INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),

  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (job_id) REFERENCES automation_jobs(id)
);

-- Automation approval requests
CREATE TABLE IF NOT EXISTS automation_approvals (
  id TEXT PRIMARY KEY,
  ticket_id TEXT,
  client_id TEXT NOT NULL,
  restaurant_id TEXT,
  task_type TEXT NOT NULL,
  summary TEXT,
  analysis TEXT NOT NULL,  -- JSON: full analysis result
  job_data TEXT,  -- JSON: data to create job with
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  risk_level TEXT,

  -- Timing
  created_at INTEGER DEFAULT (unixepoch()),
  expires_at INTEGER,

  -- Review
  reviewed_by TEXT,
  reviewed_at INTEGER,
  review_notes TEXT,

  -- Result
  automation_job_id TEXT,

  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (automation_job_id) REFERENCES automation_jobs(id)
);

-- Support automation settings per client
CREATE TABLE IF NOT EXISTS support_automation_settings (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,

  -- Auto-execution settings
  auto_execute_enabled INTEGER DEFAULT 0,
  auto_execute_risk_threshold TEXT DEFAULT 'low',  -- low, medium, high
  max_items_auto_execute INTEGER DEFAULT 10,

  -- Approval settings
  require_approval_for_prices INTEGER DEFAULT 1,
  require_approval_for_deletions INTEGER DEFAULT 1,
  auto_approve_after_hours INTEGER DEFAULT 0,  -- 0 = disabled

  -- Notification settings
  notify_on_auto_execute INTEGER DEFAULT 1,
  notify_on_approval_needed INTEGER DEFAULT 1,
  notification_email TEXT,

  -- Allowed task types (JSON array, null = all allowed)
  allowed_task_types TEXT,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_logs_client ON support_ticket_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_status ON support_ticket_logs(status);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_created ON support_ticket_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_approvals_status ON automation_approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_client ON automation_approvals(client_id);
CREATE INDEX IF NOT EXISTS idx_approvals_priority ON automation_approvals(priority);
CREATE INDEX IF NOT EXISTS idx_approvals_expires ON automation_approvals(expires_at);

-- Add source column to automation_jobs if not exists
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE
-- This will fail silently if column exists

-- Alerts table for observer system
CREATE TABLE IF NOT EXISTS automation_alerts (
  id TEXT PRIMARY KEY,
  level TEXT CHECK (level IN ('info', 'warning', 'critical', 'resolved')),
  title TEXT NOT NULL,
  message TEXT,
  details TEXT,  -- JSON
  health_check_id TEXT,
  acknowledged INTEGER DEFAULT 0,
  acknowledged_by TEXT,
  acknowledged_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_alerts_level ON automation_alerts(level);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON automation_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON automation_alerts(acknowledged);
