-- Migration: 0042_business_brief.sql
-- Business Brief System - The Platform's Central Intelligence
-- Created: 2026-01-18

-- ============================================
-- BUSINESS BRIEF ACTION ITEMS
-- Priority action queue surfacing items needing attention
-- ============================================

CREATE TABLE IF NOT EXISTS business_brief_actions (
  id TEXT PRIMARY KEY,
  priority TEXT NOT NULL CHECK(priority IN ('critical', 'high', 'medium', 'low')),
  category TEXT NOT NULL CHECK(category IN ('revenue', 'support', 'leads', 'operations', 'compliance', 'email', 'automation')),
  title TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL,    -- 'ticket', 'lead', 'quote', 'email', 'automation', 'agent', 'client', 'system'
  source_id TEXT,               -- ID in source system
  source_link TEXT,             -- Deep link URL path (e.g., '/admin?tab=tickets')
  estimated_value INTEGER,      -- Dollar value if applicable
  deadline INTEGER,             -- Unix timestamp
  suggested_action TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'acknowledged', 'in_progress', 'completed', 'snoozed', 'dismissed')),
  acknowledged_at INTEGER,
  acknowledged_by TEXT,
  completed_at INTEGER,
  completed_by TEXT,
  snoozed_until INTEGER,
  auto_generated INTEGER DEFAULT 1,  -- 1 = system generated, 0 = manual
  expires_at INTEGER,           -- Auto-dismiss after this time
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_brief_actions_status ON business_brief_actions(status);
CREATE INDEX IF NOT EXISTS idx_brief_actions_priority ON business_brief_actions(priority);
CREATE INDEX IF NOT EXISTS idx_brief_actions_deadline ON business_brief_actions(deadline);
CREATE INDEX IF NOT EXISTS idx_brief_actions_category ON business_brief_actions(category);
CREATE INDEX IF NOT EXISTS idx_brief_actions_source ON business_brief_actions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_brief_actions_created ON business_brief_actions(created_at DESC);

-- ============================================
-- BUSINESS GOALS
-- Track strategic goals with milestones
-- ============================================

CREATE TABLE IF NOT EXISTS business_goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK(category IN ('revenue', 'clients', 'operations', 'growth', 'marketing', 'custom')),
  target_value REAL NOT NULL,
  current_value REAL DEFAULT 0,
  unit TEXT NOT NULL,           -- '$', 'clients', '%', 'count', 'hours'
  start_date INTEGER,           -- When goal tracking started
  deadline INTEGER,             -- Target completion date
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'on_track', 'at_risk', 'behind', 'completed', 'paused', 'archived')),
  priority INTEGER DEFAULT 1,   -- For ordering
  parent_goal_id TEXT,          -- For sub-goals/OKRs
  calculation_method TEXT,      -- 'manual', 'auto_stripe_mrr', 'auto_client_count', 'auto_lead_count', etc.
  calculation_config TEXT,      -- JSON config for auto calculations
  color TEXT,                   -- Display color
  icon TEXT,                    -- Lucide icon name
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (parent_goal_id) REFERENCES business_goals(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_goals_status ON business_goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_category ON business_goals(category);
CREATE INDEX IF NOT EXISTS idx_goals_deadline ON business_goals(deadline);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON business_goals(parent_goal_id);

-- ============================================
-- GOAL MILESTONES
-- Checkpoint tracking for goals
-- ============================================

CREATE TABLE IF NOT EXISTS goal_milestones (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  title TEXT,
  target_date INTEGER NOT NULL,
  target_value REAL NOT NULL,
  actual_value REAL,
  achieved_at INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (goal_id) REFERENCES business_goals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_milestones_goal ON goal_milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_milestones_date ON goal_milestones(target_date);

-- ============================================
-- GOAL HISTORY
-- Track changes to goal values over time
-- ============================================

CREATE TABLE IF NOT EXISTS goal_value_history (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  recorded_value REAL NOT NULL,
  recorded_at INTEGER NOT NULL DEFAULT (unixepoch()),
  change_type TEXT CHECK(change_type IN ('manual', 'auto', 'milestone', 'adjustment')),
  change_reason TEXT,
  FOREIGN KEY (goal_id) REFERENCES business_goals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_goal_history_goal ON goal_value_history(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_history_date ON goal_value_history(recorded_at DESC);

-- ============================================
-- AI GENERATED SUMMARIES
-- Cached AI insights and analysis
-- ============================================

CREATE TABLE IF NOT EXISTS ai_summaries (
  id TEXT PRIMARY KEY,
  summary_type TEXT NOT NULL,   -- 'daily_brief', 'weekly_analysis', 'client_health', 'pipeline_analysis', 'recommendations'
  context_key TEXT,             -- For scoped summaries: client_id, lead_segment, etc.
  summary_text TEXT NOT NULL,
  recommendations TEXT,         -- JSON array of recommendations
  key_metrics TEXT,             -- JSON of metrics used to generate
  confidence_score REAL,        -- 0-1 confidence in analysis
  generated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  model_used TEXT,
  input_token_count INTEGER,
  output_token_count INTEGER,
  generation_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_summaries_type ON ai_summaries(summary_type, context_key);
CREATE INDEX IF NOT EXISTS idx_summaries_expires ON ai_summaries(expires_at);
CREATE INDEX IF NOT EXISTS idx_summaries_generated ON ai_summaries(generated_at DESC);

-- ============================================
-- BUSINESS BRIEF SESSIONS
-- AI conversation context for the AI Console
-- ============================================

CREATE TABLE IF NOT EXISTS brief_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'admin',
  session_type TEXT DEFAULT 'chat' CHECK(session_type IN ('chat', 'analysis', 'report', 'planning')),
  title TEXT,
  context_snapshot TEXT,        -- JSON of business state at session start
  messages TEXT,                -- JSON array of chat messages
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_activity INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON brief_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON brief_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_activity ON brief_sessions(last_activity DESC);

-- ============================================
-- BUSINESS METRICS SNAPSHOTS
-- Point-in-time captures of key metrics for trending
-- ============================================

CREATE TABLE IF NOT EXISTS business_metrics_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_date INTEGER NOT NULL,  -- Date (unix timestamp, start of day)
  snapshot_type TEXT NOT NULL CHECK(snapshot_type IN ('daily', 'weekly', 'monthly')),

  -- Revenue metrics
  mrr REAL DEFAULT 0,
  arr REAL DEFAULT 0,
  revenue_mtd REAL DEFAULT 0,
  revenue_ytd REAL DEFAULT 0,

  -- Client metrics
  total_clients INTEGER DEFAULT 0,
  active_clients INTEGER DEFAULT 0,
  clients_core INTEGER DEFAULT 0,
  clients_professional INTEGER DEFAULT 0,
  clients_premium INTEGER DEFAULT 0,
  new_clients_period INTEGER DEFAULT 0,
  churned_clients_period INTEGER DEFAULT 0,

  -- Lead metrics
  total_leads INTEGER DEFAULT 0,
  leads_by_status TEXT,         -- JSON breakdown
  leads_contacted_period INTEGER DEFAULT 0,
  leads_converted_period INTEGER DEFAULT 0,
  avg_lead_score REAL DEFAULT 0,

  -- Quote metrics
  quotes_active INTEGER DEFAULT 0,
  quotes_active_value REAL DEFAULT 0,
  quotes_sent_period INTEGER DEFAULT 0,
  quotes_accepted_period INTEGER DEFAULT 0,
  quote_acceptance_rate REAL DEFAULT 0,

  -- Support metrics
  tickets_open INTEGER DEFAULT 0,
  tickets_created_period INTEGER DEFAULT 0,
  tickets_resolved_period INTEGER DEFAULT 0,
  avg_resolution_time_hours REAL DEFAULT 0,

  -- Email metrics
  emails_sent_period INTEGER DEFAULT 0,
  email_open_rate REAL DEFAULT 0,
  email_click_rate REAL DEFAULT 0,
  email_bounce_rate REAL DEFAULT 0,

  -- Engagement metrics
  portal_logins_period INTEGER DEFAULT 0,
  active_portal_users INTEGER DEFAULT 0,

  -- Full data blob for flexibility
  full_metrics TEXT,            -- JSON with all metrics

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(snapshot_date, snapshot_type)
);

CREATE INDEX IF NOT EXISTS idx_metrics_date ON business_metrics_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON business_metrics_snapshots(snapshot_type);

-- ============================================
-- BUSINESS BRIEF NOTIFICATIONS
-- Notifications generated by the Business Brief system
-- ============================================

CREATE TABLE IF NOT EXISTS brief_notifications (
  id TEXT PRIMARY KEY,
  notification_type TEXT NOT NULL CHECK(notification_type IN ('action_created', 'goal_milestone', 'metric_alert', 'ai_insight', 'system')),
  title TEXT NOT NULL,
  message TEXT,
  severity TEXT DEFAULT 'info' CHECK(severity IN ('info', 'warning', 'critical', 'success')),
  action_id TEXT,               -- Link to action item if applicable
  goal_id TEXT,                 -- Link to goal if applicable
  link TEXT,                    -- Deep link
  read_at INTEGER,
  dismissed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (action_id) REFERENCES business_brief_actions(id) ON DELETE SET NULL,
  FOREIGN KEY (goal_id) REFERENCES business_goals(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_read ON brief_notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON brief_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON brief_notifications(created_at DESC);

-- ============================================
-- SEED PRIMARY GOAL: $400K by May 1, 2026
-- ============================================

INSERT OR IGNORE INTO business_goals (
  id, title, description, category, target_value, current_value, unit,
  start_date, deadline, status, priority, calculation_method, color, icon
) VALUES (
  'goal_revenue_400k_2026',
  '$400K Revenue by May 1, 2026',
  'Primary revenue target: $400,000 by May 1, 2026. Target mix: 15 Core, 25 Professional, 5 Premium support plans.',
  'revenue',
  400000,
  0,
  '$',
  1704067200,  -- Jan 1, 2026
  1714521600,  -- May 1, 2026
  'active',
  1,
  'auto_combined_revenue',
  '#f59e0b',
  'target'
);

-- Milestones for the primary goal
INSERT OR IGNORE INTO goal_milestones (id, goal_id, title, target_date, target_value) VALUES
  ('ms_400k_feb', 'goal_revenue_400k_2026', 'February Checkpoint', 1706745600, 100000),
  ('ms_400k_mar', 'goal_revenue_400k_2026', 'March Checkpoint', 1709251200, 200000),
  ('ms_400k_apr', 'goal_revenue_400k_2026', 'April Checkpoint', 1711929600, 300000),
  ('ms_400k_may', 'goal_revenue_400k_2026', 'May Target', 1714521600, 400000);

-- Support Plan Mix sub-goal
INSERT OR IGNORE INTO business_goals (
  id, title, description, category, target_value, current_value, unit,
  deadline, status, priority, parent_goal_id, calculation_method, color, icon
) VALUES (
  'goal_clients_45_plans',
  '45 Support Plan Clients',
  'Target client mix: 15 Core ($350/mo), 25 Professional ($500/mo), 5 Premium ($800/mo) = $23,400 MRR',
  'clients',
  45,
  0,
  'clients',
  1714521600,
  'active',
  2,
  'goal_revenue_400k_2026',
  'auto_support_plan_count',
  '#8b5cf6',
  'users'
);

-- Lane B National Remote sub-goal
INSERT OR IGNORE INTO business_goals (
  id, title, description, category, target_value, current_value, unit,
  deadline, status, priority, parent_goal_id, calculation_method, color, icon
) VALUES (
  'goal_lane_b_clients',
  'Lane B: 40 National Remote Clients',
  'Primary revenue driver: National remote Toast consulting and support plans',
  'growth',
  40,
  0,
  'clients',
  1714521600,
  'active',
  3,
  'goal_revenue_400k_2026',
  'manual',
  '#06b6d4',
  'globe'
);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
