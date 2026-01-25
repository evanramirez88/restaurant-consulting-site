-- Migration 0073: Contact Profiles CRM
-- Activity log, client notes, health scores, deals pipeline, rep performance

-- 1. Activity Log - unified touchpoint tracking
CREATE TABLE IF NOT EXISTS client_activity_log (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata_json TEXT,
  performed_by_type TEXT CHECK (performed_by_type IN ('admin', 'rep', 'client', 'system')),
  performed_by_id TEXT,
  performed_by_name TEXT,
  ticket_id TEXT,
  project_id TEXT,
  message_id TEXT,
  email_log_id TEXT,
  is_internal INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_activity_client ON client_activity_log(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_type ON client_activity_log(activity_type);

-- 2. Client Notes (internal commentary system)
CREATE TABLE IF NOT EXISTS client_notes (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  author_id TEXT,
  author_name TEXT NOT NULL,
  author_type TEXT DEFAULT 'admin' CHECK (author_type IN ('admin', 'rep', 'system')),
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'general' CHECK (note_type IN (
    'general', 'strategy', 'call_log', 'meeting_notes',
    'risk_alert', 'opportunity', 'follow_up', 'internal'
  )),
  is_pinned INTEGER DEFAULT 0,
  is_private INTEGER DEFAULT 0,
  attachments_json TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_notes_client ON client_notes(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON client_notes(client_id, is_pinned DESC);

-- 3. Client Health Score History
CREATE TABLE IF NOT EXISTS client_health_scores (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  engagement_score INTEGER DEFAULT 50,
  payment_score INTEGER DEFAULT 50,
  satisfaction_score INTEGER DEFAULT 50,
  activity_score INTEGER DEFAULT 50,
  relationship_score INTEGER DEFAULT 50,
  factors_json TEXT,
  score_change INTEGER DEFAULT 0,
  trend TEXT CHECK (trend IN ('improving', 'stable', 'declining')),
  calculated_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_health_client ON client_health_scores(client_id, calculated_at DESC);

-- 4. Deals / Opportunities Pipeline
CREATE TABLE IF NOT EXISTS client_deals (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  rep_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  deal_type TEXT NOT NULL CHECK (deal_type IN (
    'support_plan', 'project', 'installation', 'consulting',
    'training', 'upsell', 'cross_sell', 'renewal', 'expansion'
  )),
  stage TEXT NOT NULL DEFAULT 'discovery' CHECK (stage IN (
    'discovery', 'qualification', 'proposal', 'negotiation',
    'closed_won', 'closed_lost', 'on_hold'
  )),
  value REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  recurring_value REAL DEFAULT 0,
  probability INTEGER DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
  expected_close_date INTEGER,
  actual_close_date INTEGER,
  lead_id TEXT,
  quote_id TEXT,
  project_id TEXT,
  won_reason TEXT,
  lost_reason TEXT,
  next_step TEXT,
  next_step_date INTEGER,
  tags_json TEXT,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_deals_client ON client_deals(client_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON client_deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_rep ON client_deals(rep_id);

-- 5. Rep Performance Metrics (daily snapshots)
CREATE TABLE IF NOT EXISTS rep_performance_metrics (
  id TEXT PRIMARY KEY,
  rep_id TEXT NOT NULL,
  period_date TEXT NOT NULL,
  period_type TEXT DEFAULT 'daily' CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  calls_made INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  meetings_held INTEGER DEFAULT 0,
  quotes_sent INTEGER DEFAULT 0,
  deals_in_pipeline INTEGER DEFAULT 0,
  pipeline_value REAL DEFAULT 0,
  deals_won INTEGER DEFAULT 0,
  deals_lost INTEGER DEFAULT 0,
  won_value REAL DEFAULT 0,
  avg_response_time_minutes INTEGER,
  tickets_handled INTEGER DEFAULT 0,
  active_clients INTEGER DEFAULT 0,
  new_clients_acquired INTEGER DEFAULT 0,
  client_satisfaction_avg REAL,
  close_rate REAL,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_rep_perf ON rep_performance_metrics(rep_id, period_date DESC);

-- 6. Business Metrics Snapshots (daily for trending)
CREATE TABLE IF NOT EXISTS business_metrics_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_date TEXT NOT NULL,
  total_revenue REAL DEFAULT 0,
  monthly_revenue REAL DEFAULT 0,
  mrr REAL DEFAULT 0,
  active_clients INTEGER DEFAULT 0,
  active_subscriptions INTEGER DEFAULT 0,
  total_pipeline_value REAL DEFAULT 0,
  open_tickets INTEGER DEFAULT 0,
  avg_csat REAL,
  leads_contacted INTEGER DEFAULT 0,
  leads_converted INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  portal_logins INTEGER DEFAULT 0,
  metadata_json TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON business_metrics_snapshots(snapshot_date DESC);

-- 7. Add columns to clients table for health tracking
ALTER TABLE clients ADD COLUMN health_score INTEGER DEFAULT 50;
ALTER TABLE clients ADD COLUMN health_trend TEXT DEFAULT 'stable';
ALTER TABLE clients ADD COLUMN last_activity_at INTEGER;
ALTER TABLE clients ADD COLUMN total_revenue REAL DEFAULT 0;
ALTER TABLE clients ADD COLUMN active_mrr REAL DEFAULT 0;
ALTER TABLE clients ADD COLUMN churn_risk TEXT DEFAULT 'low';
ALTER TABLE clients ADD COLUMN client_since INTEGER;

-- 8. Client 360 Summary View
CREATE VIEW IF NOT EXISTS v_client_360 AS
SELECT
  c.*,
  cp.pos_system, cp.cuisine_type, cp.seating_capacity,
  cp.client_score, cp.engagement_score as profile_engagement_score,
  cp.estimated_revenue_tier,
  (SELECT COUNT(*) FROM tickets WHERE client_id = c.id AND status IN ('open', 'in_progress')) as open_tickets,
  (SELECT COUNT(*) FROM projects WHERE client_id = c.id AND status = 'active') as active_projects,
  (SELECT COUNT(*) FROM client_deals WHERE client_id = c.id AND stage NOT IN ('closed_won', 'closed_lost')) as open_deals,
  (SELECT SUM(value) FROM client_deals WHERE client_id = c.id AND stage = 'closed_won') as total_deal_value,
  (SELECT MAX(created_at) FROM client_activity_log WHERE client_id = c.id) as last_activity_timestamp,
  (SELECT COUNT(*) FROM client_notes WHERE client_id = c.id) as notes_count,
  (SELECT AVG(rating) FROM ticket_satisfaction WHERE client_id = c.id) as avg_csat
FROM clients c
LEFT JOIN client_profiles cp ON c.id = cp.client_id;
