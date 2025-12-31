-- Cape Cod Restaurant Consulting - Multi-Tenant Portal System
-- Migration: 0003_multi_tenant_system.sql
-- Created: 2025-12-31
--
-- This migration adds support for:
-- - Client Portals with unique URL slugs
-- - Rep Portals with unique URL slugs
-- - Multi-restaurant clients
-- - Rep-Client relationships with roles
-- - Communication/messaging system
-- - Enhanced availability scheduling
-- - Site content management
-- - API configuration management

-- ============================================
-- UPDATE CLIENTS TABLE - Add slug and Drive integration
-- ============================================
ALTER TABLE clients ADD COLUMN slug TEXT UNIQUE;
ALTER TABLE clients ADD COLUMN google_drive_folder_id TEXT;
ALTER TABLE clients ADD COLUMN portal_enabled INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN avatar_url TEXT;
ALTER TABLE clients ADD COLUMN notes TEXT;
ALTER TABLE clients ADD COLUMN timezone TEXT DEFAULT 'America/New_York';

CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug);

-- ============================================
-- UPDATE REPS TABLE - Add slug
-- ============================================
ALTER TABLE reps ADD COLUMN slug TEXT UNIQUE;
ALTER TABLE reps ADD COLUMN avatar_url TEXT;
ALTER TABLE reps ADD COLUMN notes TEXT;
ALTER TABLE reps ADD COLUMN portal_enabled INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_reps_slug ON reps(slug);

-- ============================================
-- RESTAURANTS TABLE - Clients can have multiple locations
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
-- RESTAURANT CONNECTIONS - For shared ownership/investment
-- ============================================
CREATE TABLE IF NOT EXISTS restaurant_connections (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  connected_client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('owner', 'co_owner', 'investor', 'partner', 'consultant', 'manager')),
  ownership_percentage REAL,
  role_description TEXT,
  access_level TEXT DEFAULT 'view' CHECK (access_level IN ('view', 'edit', 'admin')),
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(restaurant_id, connected_client_id)
);

CREATE INDEX IF NOT EXISTS idx_rest_conn_restaurant ON restaurant_connections(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_rest_conn_client ON restaurant_connections(connected_client_id);

-- ============================================
-- CLIENT-REP ASSIGNMENTS - Many-to-many with roles
-- ============================================
CREATE TABLE IF NOT EXISTS client_rep_assignments (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  rep_id TEXT NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'secondary', 'support', 'observer', 'consultant')),
  commission_rate REAL DEFAULT 0,
  permissions_json TEXT, -- JSON array of permission strings
  notes TEXT,
  assigned_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(client_id, rep_id)
);

CREATE INDEX IF NOT EXISTS idx_cra_client ON client_rep_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_cra_rep ON client_rep_assignments(rep_id);

-- ============================================
-- AVAILABILITY SCHEDULES - Enhanced scheduling system
-- ============================================
CREATE TABLE IF NOT EXISTS availability_schedules (
  id TEXT PRIMARY KEY,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'busy', 'offline', 'by_appointment')),
  location_type TEXT DEFAULT 'remote' CHECK (location_type IN ('remote', 'onsite', 'both')),

  -- Location details
  town TEXT,
  address TEXT,

  -- Service options
  walk_ins_accepted INTEGER DEFAULT 0,
  scheduling_available INTEGER DEFAULT 1,

  -- Scheduling link configuration
  scheduling_link TEXT,
  scheduling_link_type TEXT CHECK (scheduling_link_type IN ('email', 'phone', 'acuity', 'google', 'calendly', 'custom')),

  -- Availability window (when you're actually available)
  availability_start INTEGER, -- NULL = immediate/now
  availability_end INTEGER,   -- NULL = until further notice

  -- Display window (when this notice shows on site)
  display_start INTEGER,      -- NULL = show immediately
  display_end INTEGER,        -- NULL = show indefinitely

  -- Recurrence (for repeating schedules)
  is_recurring INTEGER DEFAULT 0,
  recurrence_pattern TEXT, -- JSON: {"type": "weekly", "days": [1,3,5], "until": timestamp}

  custom_message TEXT,
  priority INTEGER DEFAULT 0, -- Higher priority shows first if multiple active
  is_active INTEGER DEFAULT 1,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_avail_display ON availability_schedules(display_start, display_end);
CREATE INDEX IF NOT EXISTS idx_avail_active ON availability_schedules(is_active);

-- ============================================
-- MESSAGES - Communication system
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT, -- Groups related messages

  -- Sender info
  sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'client', 'rep', 'system')),
  sender_id TEXT, -- NULL for system messages

  -- Recipient info (NULL = broadcast to thread participants)
  recipient_type TEXT CHECK (recipient_type IN ('admin', 'client', 'rep', 'all')),
  recipient_id TEXT,

  -- Content
  subject TEXT,
  body TEXT NOT NULL,
  body_format TEXT DEFAULT 'text' CHECK (body_format IN ('text', 'html', 'markdown')),

  -- Privacy (for rep-admin only messages)
  is_private INTEGER DEFAULT 0,
  visible_to_client INTEGER DEFAULT 1,
  visible_to_rep INTEGER DEFAULT 1,

  -- Attachments
  attachments_json TEXT, -- JSON array of {name, url, type, size}

  -- Status
  read_at INTEGER,
  archived_at INTEGER,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_type, sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_type, recipient_id);

-- ============================================
-- MESSAGE THREADS - Conversation containers
-- ============================================
CREATE TABLE IF NOT EXISTS message_threads (
  id TEXT PRIMARY KEY,
  title TEXT,
  thread_type TEXT NOT NULL CHECK (thread_type IN ('ticket', 'project', 'general', 'support', 'private')),

  -- Associated entities
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  rep_id TEXT REFERENCES reps(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,

  -- Status
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Participants (JSON array of {type, id})
  participants_json TEXT,

  last_message_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_threads_client ON message_threads(client_id);
CREATE INDEX IF NOT EXISTS idx_threads_rep ON message_threads(rep_id);
CREATE INDEX IF NOT EXISTS idx_threads_status ON message_threads(status);

-- ============================================
-- SITE CONTENT - Editable website text blocks
-- ============================================
CREATE TABLE IF NOT EXISTS site_content (
  id TEXT PRIMARY KEY,
  page TEXT NOT NULL,        -- 'home', 'services', 'about', etc.
  section TEXT NOT NULL,     -- 'hero', 'features', 'cta', etc.
  content_key TEXT NOT NULL, -- 'title', 'subtitle', 'body', etc.
  content_value TEXT,
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'html', 'markdown', 'json')),
  is_editable INTEGER DEFAULT 1,
  updated_by TEXT,
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(page, section, content_key)
);

CREATE INDEX IF NOT EXISTS idx_content_page ON site_content(page);

-- ============================================
-- API CONFIGURATIONS - Service provider settings
-- ============================================
CREATE TABLE IF NOT EXISTS api_configs (
  id TEXT PRIMARY KEY,
  service TEXT NOT NULL UNIQUE, -- 'ocr', 'email', 'sms', 'drive', etc.
  provider TEXT NOT NULL,       -- 'cloudflare_ai', 'google_vision', 'sendgrid', etc.
  display_name TEXT,
  config_json TEXT,             -- Encrypted settings (API keys stored in env vars)
  is_active INTEGER DEFAULT 1,
  fallback_provider TEXT,
  rate_limit_per_hour INTEGER,
  notes TEXT,
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Seed default API configurations
INSERT OR IGNORE INTO api_configs (id, service, provider, display_name, is_active) VALUES
  ('api_ocr', 'ocr', 'cloudflare_ai', 'Cloudflare AI (LLaVA)', 1),
  ('api_email', 'email', 'resend', 'Resend Email', 1),
  ('api_storage', 'storage', 'cloudflare_r2', 'Cloudflare R2', 1),
  ('api_drive', 'drive', 'google_drive', 'Google Drive', 0);

-- ============================================
-- PORTAL SESSIONS - Track active sessions
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
-- FILE UPLOADS - Track all uploaded files
-- ============================================
CREATE TABLE IF NOT EXISTS file_uploads (
  id TEXT PRIMARY KEY,

  -- Owner info
  owner_type TEXT NOT NULL CHECK (owner_type IN ('admin', 'client', 'rep', 'system')),
  owner_id TEXT,

  -- Associated entities
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  restaurant_id TEXT REFERENCES restaurants(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,

  -- File info
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_key TEXT NOT NULL, -- R2 key
  storage_provider TEXT DEFAULT 'r2',

  -- Google Drive sync
  google_drive_file_id TEXT,
  google_drive_synced_at INTEGER,

  -- Metadata
  description TEXT,
  tags_json TEXT, -- JSON array of tags
  is_public INTEGER DEFAULT 0,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_files_owner ON file_uploads(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_files_client ON file_uploads(client_id);

-- ============================================
-- DEMO MODE SETTINGS - For testing tools in admin
-- ============================================
CREATE TABLE IF NOT EXISTS demo_settings (
  id TEXT PRIMARY KEY,
  tool TEXT NOT NULL UNIQUE, -- 'quote_builder', 'menu_builder', 'client_portal', 'rep_portal'
  demo_client_id TEXT REFERENCES clients(id),
  demo_rep_id TEXT REFERENCES reps(id),
  settings_json TEXT,
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Seed demo settings
INSERT OR IGNORE INTO demo_settings (id, tool) VALUES
  ('demo_quote', 'quote_builder'),
  ('demo_menu', 'menu_builder'),
  ('demo_client', 'client_portal'),
  ('demo_rep', 'rep_portal');

-- ============================================
-- TOAST HUB CONTENT - Blog/Content management
-- ============================================
CREATE TABLE IF NOT EXISTS toast_hub_posts (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  content_format TEXT DEFAULT 'markdown' CHECK (content_format IN ('markdown', 'html')),

  -- Categorization
  category TEXT,
  tags_json TEXT, -- JSON array

  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  og_image_url TEXT,

  -- Publishing
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  author TEXT,
  published_at INTEGER,
  scheduled_for INTEGER,

  -- Engagement
  view_count INTEGER DEFAULT 0,

  -- Display options
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
-- Update existing tables with new columns
-- ============================================

-- Add project tracking fields to projects
ALTER TABLE projects ADD COLUMN progress_percentage INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN milestone_json TEXT; -- JSON array of milestones
ALTER TABLE projects ADD COLUMN timeline_json TEXT; -- JSON with start, end, phases

-- Add support plan fields to clients
ALTER TABLE clients ADD COLUMN support_plan_tier TEXT CHECK (support_plan_tier IN ('none', 'essential', 'professional', 'premium'));
ALTER TABLE clients ADD COLUMN support_plan_status TEXT DEFAULT 'inactive' CHECK (support_plan_status IN ('inactive', 'active', 'paused', 'cancelled'));
ALTER TABLE clients ADD COLUMN support_plan_started INTEGER;
ALTER TABLE clients ADD COLUMN support_plan_renews INTEGER;

-- ============================================
-- SEED INITIAL DEMO DATA
-- ============================================

-- Create a demo client for testing
INSERT OR IGNORE INTO clients (id, email, name, company, slug, portal_enabled)
VALUES ('demo_client_001', 'demo@example.com', 'Demo Restaurant Owner', 'Demo Seafood Shack', 'demo-seafood-shack', 1);

-- Create a demo rep for testing
INSERT OR IGNORE INTO reps (id, email, name, territory, slug, portal_enabled, status)
VALUES ('demo_rep_001', 'rep@example.com', 'Demo Sales Rep', 'Cape Cod', 'demo-rep', 1, 'active');

-- Create demo assignment
INSERT OR IGNORE INTO client_rep_assignments (id, client_id, rep_id, role)
VALUES ('demo_assign_001', 'demo_client_001', 'demo_rep_001', 'primary');

-- Link demo settings
UPDATE demo_settings SET demo_client_id = 'demo_client_001' WHERE tool = 'client_portal';
UPDATE demo_settings SET demo_rep_id = 'demo_rep_001' WHERE tool = 'rep_portal';
