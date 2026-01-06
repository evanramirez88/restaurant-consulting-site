-- Cape Cod Restaurant Consulting - Missing Core Tables
-- Migration: 0008_missing_tables.sql
-- Created: 2026-01-06
-- Purpose: Add missing tables that were skipped due to migration conflicts

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
  password_hash TEXT,
  magic_link_token TEXT,
  magic_link_expires INTEGER,
  hubspot_contact_id TEXT,
  slug TEXT UNIQUE,
  google_drive_folder_id TEXT,
  portal_enabled INTEGER DEFAULT 0,
  avatar_url TEXT,
  notes TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  support_plan_tier TEXT CHECK (support_plan_tier IN ('none', 'essential', 'professional', 'premium')),
  support_plan_status TEXT DEFAULT 'inactive' CHECK (support_plan_status IN ('inactive', 'active', 'paused', 'cancelled')),
  support_plan_started INTEGER,
  support_plan_renews INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_hubspot ON clients(hubspot_contact_id);
CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug);

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
  slug TEXT UNIQUE,
  avatar_url TEXT,
  notes TEXT,
  portal_enabled INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_reps_email ON reps(email);
CREATE INDEX IF NOT EXISTS idx_reps_territory ON reps(territory);
CREATE INDEX IF NOT EXISTS idx_reps_slug ON reps(slug);

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('installation', 'menu_build', 'training', 'support', 'consulting', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'on_hold', 'completed', 'cancelled')),
  description TEXT,
  start_date INTEGER,
  end_date INTEGER,
  budget_estimate REAL,
  actual_cost REAL,
  hubspot_deal_id TEXT,
  progress_percentage INTEGER DEFAULT 0,
  milestone_json TEXT,
  timeline_json TEXT,
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
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  category TEXT CHECK (category IN ('technical', 'billing', 'feature', 'training', 'other')),
  assigned_to TEXT,
  resolved_at INTEGER,
  due_date INTEGER,
  target_date INTEGER,
  target_date_label TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tickets_client ON tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_due_date ON tickets(due_date);
CREATE INDEX IF NOT EXISTS idx_tickets_target_date ON tickets(target_date);

-- ============================================
-- CLIENT-REP ASSIGNMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS client_rep_assignments (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  rep_id TEXT NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'secondary', 'support', 'observer', 'consultant')),
  commission_rate REAL DEFAULT 0,
  permissions_json TEXT,
  notes TEXT,
  assigned_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(client_id, rep_id)
);

CREATE INDEX IF NOT EXISTS idx_cra_client ON client_rep_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_cra_rep ON client_rep_assignments(rep_id);

-- ============================================
-- RESTAURANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  email TEXT,
  pos_system TEXT DEFAULT 'toast',
  pos_account_id TEXT,
  location_type TEXT CHECK (location_type IN ('standalone', 'franchise', 'chain', 'food_truck', 'ghost_kitchen')),
  is_primary INTEGER DEFAULT 0,
  google_drive_folder_id TEXT,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_restaurants_client ON restaurants(client_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON restaurants(slug);

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
    'submitted', 'contacted', 'meeting_scheduled', 'quote_sent',
    'negotiating', 'won', 'lost', 'on_hold'
  )),
  milestone TEXT CHECK (milestone IN (
    'none', 'consultation_complete', 'contract_signed',
    'installation_complete', 'first_invoice_paid'
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
-- MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'client', 'rep', 'system')),
  sender_id TEXT,
  recipient_type TEXT CHECK (recipient_type IN ('admin', 'client', 'rep', 'all')),
  recipient_id TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  body_format TEXT DEFAULT 'text' CHECK (body_format IN ('text', 'html', 'markdown')),
  is_private INTEGER DEFAULT 0,
  visible_to_client INTEGER DEFAULT 1,
  visible_to_rep INTEGER DEFAULT 1,
  attachments_json TEXT,
  read_at INTEGER,
  archived_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_type, sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_type, recipient_id);

-- ============================================
-- MESSAGE THREADS
-- ============================================
CREATE TABLE IF NOT EXISTS message_threads (
  id TEXT PRIMARY KEY,
  title TEXT,
  thread_type TEXT NOT NULL CHECK (thread_type IN ('ticket', 'project', 'general', 'support', 'private')),
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  rep_id TEXT REFERENCES reps(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  participants_json TEXT,
  last_message_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_threads_client ON message_threads(client_id);
CREATE INDEX IF NOT EXISTS idx_threads_rep ON message_threads(rep_id);
CREATE INDEX IF NOT EXISTS idx_threads_status ON message_threads(status);

-- ============================================
-- PORTAL SESSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS portal_sessions (
  id TEXT PRIMARY KEY,
  portal_type TEXT NOT NULL CHECK (portal_type IN ('admin', 'client', 'rep')),
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  last_activity INTEGER DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON portal_sessions(portal_type, user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON portal_sessions(expires_at);

-- ============================================
-- TOAST HUB POSTS
-- ============================================
CREATE TABLE IF NOT EXISTS toast_hub_posts (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  content_format TEXT DEFAULT 'markdown' CHECK (content_format IN ('markdown', 'html')),
  category TEXT,
  tags_json TEXT,
  meta_title TEXT,
  meta_description TEXT,
  og_image_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  author TEXT,
  published_at INTEGER,
  scheduled_for INTEGER,
  view_count INTEGER DEFAULT 0,
  featured INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_posts_slug ON toast_hub_posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_status ON toast_hub_posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_category ON toast_hub_posts(category);

-- ============================================
-- TOAST HUB CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS toast_hub_categories (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Seed default categories
INSERT OR IGNORE INTO toast_hub_categories (id, slug, name, display_order) VALUES
  ('cat_tips', 'tips', 'Toast Tips & Tricks', 1),
  ('cat_guides', 'guides', 'Setup Guides', 2),
  ('cat_case', 'case-studies', 'Case Studies', 3),
  ('cat_news', 'news', 'Industry News', 4),
  ('cat_updates', 'updates', 'Product Updates', 5);

-- ============================================
-- DEMO SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS demo_settings (
  id TEXT PRIMARY KEY,
  tool TEXT NOT NULL UNIQUE,
  demo_client_id TEXT REFERENCES clients(id),
  demo_rep_id TEXT REFERENCES reps(id),
  settings_json TEXT,
  updated_at INTEGER DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO demo_settings (id, tool) VALUES
  ('demo_quote', 'quote_builder'),
  ('demo_menu', 'menu_builder'),
  ('demo_client', 'client_portal'),
  ('demo_rep', 'rep_portal');

-- ============================================
-- AUDIT LOGS
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
-- FILE UPLOADS
-- ============================================
CREATE TABLE IF NOT EXISTS file_uploads (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('admin', 'client', 'rep', 'system')),
  owner_id TEXT,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  restaurant_id TEXT REFERENCES restaurants(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_key TEXT NOT NULL,
  storage_provider TEXT DEFAULT 'r2',
  google_drive_file_id TEXT,
  google_drive_synced_at INTEGER,
  description TEXT,
  tags_json TEXT,
  is_public INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_files_owner ON file_uploads(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_files_client ON file_uploads(client_id);

-- ============================================
-- MENU JOBS
-- ============================================
CREATE TABLE IF NOT EXISTS menu_jobs (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  restaurant_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'processing', 'review', 'completed', 'failed')),
  file_key TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  ocr_result_json TEXT,
  parsed_menu_json TEXT,
  error_message TEXT,
  processing_started_at INTEGER,
  processing_completed_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_menu_jobs_client ON menu_jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_menu_jobs_status ON menu_jobs(status);

-- ============================================
-- SCHEDULED CALLS
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
