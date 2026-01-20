-- =====================================================
-- BUSINESS BRIEF SYSTEM
-- The brain/dashboard of R&G Consulting platform
-- Aggregates data from all systems into actionable intelligence
-- =====================================================

-- Business Brief snapshots - stored daily summaries
CREATE TABLE IF NOT EXISTS business_briefs (
  id TEXT PRIMARY KEY,
  brief_date TEXT NOT NULL, -- YYYY-MM-DD
  brief_type TEXT DEFAULT 'daily', -- 'daily', 'weekly', 'monthly', 'custom'

  -- Core metrics snapshot
  total_leads INTEGER,
  total_clients INTEGER,
  total_prospects INTEGER,
  active_tickets INTEGER,
  open_quotes INTEGER,

  -- Pipeline metrics
  pipeline_value REAL, -- Total value of open quotes
  mtd_revenue REAL, -- Month-to-date revenue
  ytd_revenue REAL, -- Year-to-date revenue

  -- Activity metrics
  leads_added_today INTEGER,
  leads_contacted_today INTEGER,
  emails_sent_today INTEGER,
  emails_opened_today INTEGER,

  -- Engagement metrics
  website_visits_today INTEGER,
  quote_requests_today INTEGER,
  calls_scheduled_today INTEGER,

  -- AI-generated insights (JSON array)
  insights TEXT, -- [{"type": "opportunity", "priority": "high", "message": "...", "action": "..."}]

  -- Recommendations (JSON array)
  recommendations TEXT, -- [{"category": "outreach", "action": "...", "expected_impact": "..."}]

  -- Risks and alerts (JSON array)
  alerts TEXT, -- [{"severity": "warning", "message": "...", "related_to": "..."}]

  -- Raw data for drill-down (JSON)
  detailed_data TEXT,

  -- Metadata
  generated_at INTEGER DEFAULT (unixepoch()),
  generated_by TEXT DEFAULT 'system',

  UNIQUE(brief_date, brief_type)
);

CREATE INDEX IF NOT EXISTS idx_brief_date ON business_briefs(brief_date DESC);
CREATE INDEX IF NOT EXISTS idx_brief_type ON business_briefs(brief_type);

-- KPI targets and thresholds
CREATE TABLE IF NOT EXISTS kpi_targets (
  id TEXT PRIMARY KEY,
  kpi_name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'revenue', 'leads', 'engagement', 'operations'
  target_value REAL NOT NULL,
  target_period TEXT DEFAULT 'monthly', -- 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
  warning_threshold REAL, -- Below this triggers warning
  critical_threshold REAL, -- Below this triggers critical alert
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Seed initial KPI targets
INSERT OR IGNORE INTO kpi_targets (id, kpi_name, category, target_value, target_period, warning_threshold, critical_threshold, description) VALUES
-- Revenue KPIs (based on $400K by May 1, 2026 goal)
('kpi_weekly_revenue', 'Weekly Revenue', 'revenue', 23529, 'weekly', 18000, 12000, 'Target: $23,529/week to hit $400K by May 1'),
('kpi_monthly_revenue', 'Monthly Revenue', 'revenue', 100000, 'monthly', 75000, 50000, 'Monthly revenue target'),
('kpi_support_plan_signups', 'Support Plan Signups', 'revenue', 4, 'monthly', 2, 1, 'New support plan subscriptions per month'),

-- Lead KPIs
('kpi_leads_contacted', 'Leads Contacted', 'leads', 50, 'weekly', 30, 15, 'Outreach contacts per week'),
('kpi_lead_response_rate', 'Lead Response Rate', 'leads', 15, 'weekly', 10, 5, 'Percentage of leads responding'),
('kpi_qualified_leads', 'Qualified Leads', 'leads', 10, 'weekly', 5, 2, 'High-quality leads identified per week'),

-- Engagement KPIs
('kpi_email_open_rate', 'Email Open Rate', 'engagement', 25, 'weekly', 18, 12, 'Email open rate percentage'),
('kpi_quote_requests', 'Quote Requests', 'engagement', 8, 'weekly', 4, 2, 'Quote requests per week'),
('kpi_calls_scheduled', 'Calls Scheduled', 'engagement', 6, 'weekly', 3, 1, 'Discovery calls scheduled per week'),

-- Operations KPIs
('kpi_ticket_resolution', 'Ticket Resolution Time', 'operations', 24, 'daily', 48, 72, 'Average hours to resolve tickets'),
('kpi_client_satisfaction', 'Client Satisfaction', 'operations', 90, 'monthly', 80, 70, 'Client satisfaction score percentage');

-- Daily metrics log (for trend analysis)
CREATE TABLE IF NOT EXISTS daily_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_date TEXT NOT NULL, -- YYYY-MM-DD
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  metric_category TEXT,
  source TEXT, -- 'stripe', 'hubspot', 'email', 'manual', etc.
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(metric_date, metric_name)
);

CREATE INDEX IF NOT EXISTS idx_metrics_date ON daily_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON daily_metrics(metric_name);

-- Action items generated from briefs
CREATE TABLE IF NOT EXISTS brief_action_items (
  id TEXT PRIMARY KEY,
  brief_id TEXT REFERENCES business_briefs(id),
  action_type TEXT NOT NULL, -- 'call', 'email', 'follow_up', 'research', 'quote', 'meeting'
  priority INTEGER DEFAULT 50, -- 1-100
  title TEXT NOT NULL,
  description TEXT,
  related_entity_type TEXT, -- 'lead', 'client', 'ticket', 'quote'
  related_entity_id TEXT,
  due_date TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'dismissed'
  completed_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_action_status ON brief_action_items(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_action_due ON brief_action_items(due_date);

-- System health checks
CREATE TABLE IF NOT EXISTS system_health (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  check_time INTEGER DEFAULT (unixepoch()),
  system_name TEXT NOT NULL, -- 'stripe', 'hubspot', 'email_dispatcher', 'cal_com', 'cloudflare'
  status TEXT NOT NULL, -- 'healthy', 'degraded', 'down', 'unknown'
  response_time_ms INTEGER,
  last_success INTEGER,
  error_message TEXT,
  details TEXT -- JSON with additional info
);

CREATE INDEX IF NOT EXISTS idx_health_system ON system_health(system_name, check_time DESC);
