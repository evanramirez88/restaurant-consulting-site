-- Migration 0072: Ticket Comments, SLA Policies, CSAT Surveys
-- Integrates Freshdesk-style ticket threading and service level tracking

-- Ticket Comments (threaded conversations)
CREATE TABLE IF NOT EXISTS ticket_comments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  author_type TEXT NOT NULL CHECK(author_type IN ('admin', 'rep', 'client', 'system')),
  author_id TEXT,
  author_name TEXT,
  content TEXT NOT NULL,
  visibility TEXT DEFAULT 'all' CHECK(visibility IN ('all', 'internal', 'client')),
  is_resolution_note INTEGER DEFAULT 0,
  attachments_json TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_author ON ticket_comments(author_type, author_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created ON ticket_comments(created_at);

-- SLA Policies
CREATE TABLE IF NOT EXISTS sla_policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
  first_response_hours INTEGER NOT NULL,
  resolution_hours INTEGER NOT NULL,
  business_hours_only INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Default SLA policies
INSERT OR IGNORE INTO sla_policies (id, name, priority, first_response_hours, resolution_hours, description) VALUES
  ('sla_urgent', 'Urgent Priority', 'urgent', 1, 4, 'Critical issues requiring immediate attention'),
  ('sla_high', 'High Priority', 'high', 4, 24, 'Important issues needing same-day response'),
  ('sla_normal', 'Normal Priority', 'normal', 8, 72, 'Standard support requests'),
  ('sla_low', 'Low Priority', 'low', 24, 168, 'Non-urgent inquiries and feature requests');

-- Add SLA tracking columns to tickets
ALTER TABLE tickets ADD COLUMN sla_policy_id TEXT REFERENCES sla_policies(id);
ALTER TABLE tickets ADD COLUMN first_response_at INTEGER;
ALTER TABLE tickets ADD COLUMN sla_response_breached INTEGER DEFAULT 0;
ALTER TABLE tickets ADD COLUMN sla_resolution_breached INTEGER DEFAULT 0;
ALTER TABLE tickets ADD COLUMN response_due_at INTEGER;
ALTER TABLE tickets ADD COLUMN resolution_due_at INTEGER;

-- CSAT (Customer Satisfaction) Surveys
CREATE TABLE IF NOT EXISTS ticket_satisfaction (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  feedback TEXT,
  categories_json TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_csat_ticket ON ticket_satisfaction(ticket_id);
CREATE INDEX IF NOT EXISTS idx_csat_client ON ticket_satisfaction(client_id);
CREATE INDEX IF NOT EXISTS idx_csat_rating ON ticket_satisfaction(rating);
