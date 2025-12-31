-- Cape Cod Restaurant Consulting - Full Schema
-- Migration: 0002_full_schema.sql
-- Created: 2025-12-30

-- ============================================
-- CLIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  password_hash TEXT, -- For client portal login
  magic_link_token TEXT,
  magic_link_expires INTEGER,
  hubspot_contact_id TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_hubspot ON clients(hubspot_contact_id);

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('installation', 'menu_build', 'training', 'support', 'consulting', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'on_hold', 'completed', 'cancelled')),
  description TEXT,
  start_date INTEGER,
  end_date INTEGER,
  budget_estimate REAL,
  actual_cost REAL,
  hubspot_deal_id TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- ============================================
-- TICKETS TABLE (Support tickets)
-- ============================================
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  category TEXT CHECK (category IN ('technical', 'billing', 'feature', 'training', 'other')),
  assigned_to TEXT,
  resolved_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tickets_client ON tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);

-- ============================================
-- QUOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  restaurant_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')),
  config_json TEXT NOT NULL, -- Full floor plan configuration
  summary_json TEXT, -- Calculated pricing summary (server-side only)
  install_cost REAL,
  travel_cost REAL,
  support_tier INTEGER,
  total_quote REAL,
  valid_until INTEGER,
  notes TEXT,
  sent_at INTEGER,
  viewed_at INTEGER,
  responded_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_quotes_client ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_email ON quotes(email);

-- ============================================
-- MENU_JOBS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS menu_jobs (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  restaurant_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'processing', 'review', 'completed', 'failed')),
  file_key TEXT, -- R2 storage key
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  ocr_result_json TEXT, -- Extracted menu data
  parsed_menu_json TEXT, -- Structured menu output
  error_message TEXT,
  processing_started_at INTEGER,
  processing_completed_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_menu_jobs_client ON menu_jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_menu_jobs_status ON menu_jobs(status);

-- ============================================
-- REPS TABLE (Toast Sales Reps)
-- ============================================
CREATE TABLE IF NOT EXISTS reps (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  territory TEXT,
  region TEXT,
  company TEXT DEFAULT 'Toast',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  magic_link_token TEXT,
  magic_link_expires INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_reps_email ON reps(email);
CREATE INDEX IF NOT EXISTS idx_reps_territory ON reps(territory);

-- ============================================
-- REFERRALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  rep_id TEXT NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  restaurant_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  location TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted',        -- Just received
    'contacted',        -- We reached out
    'meeting_scheduled', -- Consultation scheduled
    'quote_sent',       -- Quote provided
    'negotiating',      -- In discussions
    'won',              -- Deal closed
    'lost',             -- Did not proceed
    'on_hold'           -- Paused
  )),
  milestone TEXT CHECK (milestone IN (
    'none',
    'consultation_complete',
    'contract_signed',
    'installation_complete',
    'first_invoice_paid'
  )) DEFAULT 'none',
  commission_status TEXT DEFAULT 'pending' CHECK (commission_status IN ('pending', 'eligible', 'paid', 'ineligible')),
  commission_amount REAL,
  won_at INTEGER,
  lost_reason TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_referrals_rep ON referrals(rep_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_client ON referrals(client_id);

-- ============================================
-- AUDIT_LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'client', 'rep', 'system', 'api')),
  actor_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details_json TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ============================================
-- FEATURE_FLAGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 0,
  description TEXT,
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Seed default feature flags
INSERT OR IGNORE INTO feature_flags (key, enabled, description) VALUES
  ('quote_builder_enabled', 0, 'Quote Builder floor plan editor'),
  ('menu_builder_enabled', 0, 'Menu Builder OCR system'),
  ('client_portal_enabled', 0, 'Client portal login and dashboard'),
  ('rep_portal_enabled', 0, 'Toast rep referral portal'),
  ('blog_enabled', 0, 'Content hub / blog system');

-- ============================================
-- CONTACT_SUBMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS contact_submissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  message TEXT,
  source TEXT DEFAULT 'contact_form',
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
  hubspot_contact_id TEXT,
  ip_address TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_submissions(status);
CREATE INDEX IF NOT EXISTS idx_contact_email ON contact_submissions(email);

-- ============================================
-- SCHEDULED_CALLS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scheduled_calls (
  id TEXT PRIMARY KEY,
  acuity_appointment_id TEXT,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  scheduled_time INTEGER NOT NULL,
  duration_minutes INTEGER DEFAULT 15,
  type TEXT DEFAULT 'discovery' CHECK (type IN ('discovery', 'consultation', 'followup', 'support')),
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  outcome TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_calls_scheduled ON scheduled_calls(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_calls_client ON scheduled_calls(client_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON scheduled_calls(status);
