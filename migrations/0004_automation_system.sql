-- Cape Cod Restaurant Consulting - Toast Automation System
-- Migration: 0004_automation_system.sql
-- Created: 2026-01-02
--
-- This migration adds support for:
-- - Toast credential storage per client
-- - Automation job queue and tracking
-- - Job step progress with screenshots
-- - Observer AI selector mappings
-- - Automation event logging
-- - Domain expertise rule encoding

-- ============================================
-- TOAST CREDENTIALS TABLE
-- Stores encrypted Toast login credentials per client
-- ============================================
CREATE TABLE IF NOT EXISTS toast_credentials (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  restaurant_id TEXT REFERENCES restaurants(id) ON DELETE SET NULL,

  -- Encrypted credentials (AES-256-GCM)
  toast_username_encrypted TEXT NOT NULL,
  toast_password_encrypted TEXT NOT NULL,

  -- Toast account identifiers
  toast_guid TEXT,                    -- Toast restaurant GUID
  toast_location_id TEXT,             -- Toast location ID if applicable

  -- Status tracking
  last_login_success INTEGER DEFAULT 0,  -- Boolean: last login worked
  last_login_at INTEGER,
  last_verified_at INTEGER,
  status TEXT DEFAULT 'pending_verification' CHECK (status IN (
    'active',
    'invalid',
    'locked',
    'pending_verification',
    'expired'
  )),

  -- Metadata
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),

  UNIQUE(client_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_toast_creds_client ON toast_credentials(client_id);
CREATE INDEX IF NOT EXISTS idx_toast_creds_status ON toast_credentials(status);

-- ============================================
-- AUTOMATION JOBS TABLE
-- Main job queue for automation tasks
-- ============================================
CREATE TABLE IF NOT EXISTS automation_jobs (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  restaurant_id TEXT REFERENCES restaurants(id) ON DELETE SET NULL,
  toast_credential_id TEXT REFERENCES toast_credentials(id) ON DELETE SET NULL,

  -- Job type
  job_type TEXT NOT NULL CHECK (job_type IN (
    'menu_upload',        -- Upload menu from Menu Builder
    'menu_update',        -- Update existing menu items
    'kds_config',         -- Configure Kitchen Display System
    'printer_setup',      -- Set up printer routing
    'employee_setup',     -- Create employee profiles
    'tax_config',         -- Configure tax rules
    'modifier_sync',      -- Sync modifier groups
    'revenue_center',     -- Configure revenue centers
    'dining_options',     -- Set up dining options
    'full_setup',         -- Complete restaurant setup
    'health_check',       -- Verify configuration
    'backup',             -- Export current config
    'restore'             -- Restore from backup
  )),

  -- Job title for display
  title TEXT,

  -- Input/Output
  input_json TEXT,                    -- Job parameters
  output_json TEXT,                   -- Results/summary
  parsed_menu_job_id TEXT REFERENCES menu_jobs(id) ON DELETE SET NULL,

  -- Status tracking
  status TEXT DEFAULT 'queued' CHECK (status IN (
    'queued',             -- Waiting in queue
    'pending_credentials',-- Needs valid credentials
    'running',            -- Currently executing
    'paused',             -- Temporarily paused
    'awaiting_approval',  -- Needs human approval to proceed
    'completed',          -- Successfully finished
    'failed',             -- Failed with error
    'cancelled'           -- Manually cancelled
  )),

  -- Progress tracking
  progress_percentage INTEGER DEFAULT 0,
  current_step TEXT,
  current_step_number INTEGER DEFAULT 0,
  total_steps INTEGER,

  -- Timing
  scheduled_at INTEGER,               -- When to run (NULL = immediate)
  started_at INTEGER,
  completed_at INTEGER,
  estimated_duration_seconds INTEGER,
  actual_duration_seconds INTEGER,

  -- Error handling
  error_message TEXT,
  error_code TEXT,
  error_screenshot_key TEXT,          -- R2 key for error screenshot
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_retry_at INTEGER,

  -- Priority (higher = more important)
  priority INTEGER DEFAULT 0,

  -- Audit
  triggered_by TEXT CHECK (triggered_by IN ('admin', 'client', 'rep', 'webhook', 'scheduled', 'system')),
  triggered_by_id TEXT,
  approved_by TEXT,
  approved_at INTEGER,
  cancelled_by TEXT,
  cancelled_at INTEGER,
  cancelled_reason TEXT,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_auto_jobs_client ON automation_jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_auto_jobs_status ON automation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_auto_jobs_scheduled ON automation_jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_auto_jobs_type ON automation_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_auto_jobs_priority ON automation_jobs(priority DESC, created_at ASC);

-- ============================================
-- AUTOMATION JOB STEPS TABLE
-- Tracks individual steps within a job
-- ============================================
CREATE TABLE IF NOT EXISTS automation_job_steps (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES automation_jobs(id) ON DELETE CASCADE,

  -- Step identification
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  step_description TEXT,
  step_type TEXT CHECK (step_type IN (
    'navigation',         -- Navigate to page
    'input',              -- Enter data
    'click',              -- Click button/element
    'wait',               -- Wait for element/condition
    'verify',             -- Verify state
    'screenshot',         -- Take screenshot
    'data_extraction',    -- Extract data from page
    'api_call',           -- Internal API call
    'approval_gate'       -- Wait for human approval
  )),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'running',
    'completed',
    'failed',
    'skipped',
    'rolled_back'
  )),

  -- Visual verification
  screenshot_before_key TEXT,         -- R2 key
  screenshot_after_key TEXT,          -- R2 key
  expected_state_json TEXT,           -- What we expect to see
  actual_state_json TEXT,             -- What we actually saw

  -- Timing
  started_at INTEGER,
  completed_at INTEGER,
  duration_ms INTEGER,

  -- Error details
  error_message TEXT,
  error_screenshot_key TEXT,
  recovery_attempted INTEGER DEFAULT 0,
  recovery_successful INTEGER DEFAULT 0,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_steps_job ON automation_job_steps(job_id);
CREATE INDEX IF NOT EXISTS idx_steps_status ON automation_job_steps(status);

-- ============================================
-- TOAST SELECTORS TABLE
-- Observer AI managed DOM selectors (self-healing)
-- ============================================
CREATE TABLE IF NOT EXISTS toast_selectors (
  id TEXT PRIMARY KEY,

  -- Location in Toast UI
  page TEXT NOT NULL,                 -- 'login', 'menu_editor', 'kds_config', etc.
  element TEXT NOT NULL,              -- 'username_field', 'save_button', etc.

  -- Primary selector
  selector_type TEXT NOT NULL CHECK (selector_type IN ('css', 'xpath', 'text', 'aria', 'role')),
  selector_value TEXT NOT NULL,

  -- Backup selectors (JSON array)
  backup_selectors_json TEXT,         -- [{"type": "xpath", "value": "..."}, ...]

  -- Visual description for Observer AI
  visual_description TEXT,            -- "Blue button in top right corner with text 'Save'"
  visual_anchor_json TEXT,            -- {"nearText": "Menu Items", "position": "below"}

  -- Verification tracking
  last_verified_at INTEGER,
  verification_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_failure_at INTEGER,
  last_failure_reason TEXT,

  -- Auto-update tracking
  auto_updated INTEGER DEFAULT 0,     -- Boolean: was updated by Observer AI
  previous_selector_value TEXT,       -- What it was before auto-update
  auto_updated_at INTEGER,

  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),

  UNIQUE(page, element)
);

CREATE INDEX IF NOT EXISTS idx_selectors_page ON toast_selectors(page);
CREATE INDEX IF NOT EXISTS idx_selectors_failures ON toast_selectors(failure_count DESC);

-- ============================================
-- AUTOMATION EVENTS TABLE
-- Detailed audit trail of all automation actions
-- ============================================
CREATE TABLE IF NOT EXISTS automation_events (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES automation_jobs(id) ON DELETE SET NULL,
  step_id TEXT REFERENCES automation_job_steps(id) ON DELETE SET NULL,

  -- Event classification
  event_type TEXT NOT NULL CHECK (event_type IN (
    'job_created',
    'job_started',
    'job_completed',
    'job_failed',
    'job_cancelled',
    'job_paused',
    'job_resumed',
    'step_started',
    'step_completed',
    'step_failed',
    'browser_action',
    'screenshot_taken',
    'data_extracted',
    'selector_failed',
    'selector_healed',
    'approval_requested',
    'approval_granted',
    'approval_denied',
    'retry_attempted',
    'error_recovered',
    'credential_issue',
    'system_error'
  )),

  -- Event details
  event_data_json TEXT,

  -- Visual evidence
  screenshot_key TEXT,                -- R2 key

  -- Context
  browser_session_id TEXT,
  page_url TEXT,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_auto_events_job ON automation_events(job_id);
CREATE INDEX IF NOT EXISTS idx_auto_events_step ON automation_events(step_id);
CREATE INDEX IF NOT EXISTS idx_auto_events_type ON automation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_auto_events_created ON automation_events(created_at DESC);

-- ============================================
-- AUTOMATION RULES TABLE
-- Domain expertise encoding (Martini/Manhattan logic, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS automation_rules (
  id TEXT PRIMARY KEY,

  -- Rule categorization
  rule_category TEXT NOT NULL CHECK (rule_category IN (
    'cocktail_logic',     -- Martini/Manhattan upcharge system
    'kds_routing',        -- Kitchen display routing patterns
    'printer_routing',    -- Printer assignment rules
    'tax_rules',          -- State/locality tax configurations
    'modifier_hierarchy', -- Modifier group structures
    'inventory_logic',    -- Inventory deduction rules
    'pricing_rules',      -- Dynamic pricing logic
    'station_weights',    -- KDS station criticality
    'menu_structure'      -- Menu organization patterns
  )),

  rule_name TEXT NOT NULL,
  rule_description TEXT,

  -- Rule definition (JSON)
  rule_logic_json TEXT NOT NULL,      -- The actual logic/configuration

  -- Applicability
  applies_to_restaurant_type TEXT,    -- 'bar', 'casual', 'fine_dining', etc.
  applies_to_pos_version TEXT,        -- Toast version compatibility

  -- Status
  is_active INTEGER DEFAULT 1,
  is_default INTEGER DEFAULT 0,       -- Use if no specific rule matches

  -- Audit
  created_by TEXT,
  updated_by TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_rules_category ON automation_rules(rule_category);
CREATE INDEX IF NOT EXISTS idx_rules_active ON automation_rules(is_active);

-- ============================================
-- AUTOMATION SERVER STATUS TABLE
-- Track automation server health
-- ============================================
CREATE TABLE IF NOT EXISTS automation_server_status (
  id INTEGER PRIMARY KEY CHECK (id = 1),

  -- Connection status
  last_heartbeat INTEGER,
  is_online INTEGER DEFAULT 0,
  server_version TEXT,

  -- Capacity
  current_sessions INTEGER DEFAULT 0,
  max_sessions INTEGER DEFAULT 5,
  queue_depth INTEGER DEFAULT 0,

  -- Health metrics
  cpu_usage_percent REAL,
  memory_usage_percent REAL,
  disk_usage_percent REAL,

  -- Browser status
  browser_version TEXT,
  browser_healthy INTEGER DEFAULT 1,
  last_browser_restart INTEGER,

  updated_at INTEGER DEFAULT (unixepoch())
);

-- Seed initial status
INSERT OR IGNORE INTO automation_server_status (id, is_online)
VALUES (1, 0);

-- ============================================
-- FEATURE FLAGS ADDITIONS
-- ============================================
INSERT OR IGNORE INTO feature_flags (key, enabled, description) VALUES
  ('toast_automation_enabled', 0, 'Toast back-office browser automation system'),
  ('automation_self_healing', 0, 'Observer AI self-healing for Toast UI changes'),
  ('automation_batch_mode', 0, 'Allow multiple simultaneous browser sessions'),
  ('automation_client_visible', 0, 'Show automation status in client portal'),
  ('automation_auto_approve', 0, 'Auto-approve low-risk automation jobs');

-- ============================================
-- API CONFIGS ADDITIONS
-- ============================================
INSERT OR IGNORE INTO api_configs (id, service, provider, display_name, is_active) VALUES
  ('api_automation', 'automation', 'windmill', 'Windmill Orchestration', 0),
  ('api_observer', 'observer', 'ollama', 'Observer AI (Local LLM)', 0);

-- ============================================
-- SEED DEFAULT AUTOMATION RULES
-- ============================================

-- Martini/Manhattan cocktail logic
INSERT OR IGNORE INTO automation_rules (id, rule_category, rule_name, rule_description, rule_logic_json, is_active, is_default) VALUES
(
  'rule_cocktail_martini',
  'cocktail_logic',
  'Martini/Manhattan Upcharge System',
  'Creates base spirit items with upcharge modifiers for Martini, Manhattan, Rocks, and Neat pours',
  '{
    "base_spirits": ["Vodka", "Gin", "Rum", "Whiskey", "Tequila", "Bourbon", "Scotch"],
    "upcharge_modifiers": {
      "Martini": {"volume_oz": 3.5, "upcharge_multiplier": 1.75},
      "Manhattan": {"volume_oz": 3.5, "upcharge_multiplier": 1.75},
      "Rocks": {"volume_oz": 2.0, "upcharge_multiplier": 1.0},
      "Neat": {"volume_oz": 2.0, "upcharge_multiplier": 1.0}
    },
    "modifier_group_name": "Pour Style",
    "default_pour_oz": 2.0
  }',
  1,
  1
);

-- KDS routing for standard restaurant
INSERT OR IGNORE INTO automation_rules (id, rule_category, rule_name, rule_description, rule_logic_json, is_active, is_default) VALUES
(
  'rule_kds_standard',
  'kds_routing',
  'Standard Kitchen/Bar Routing',
  'Default KDS routing with Hot Line, Cold Line, Expo, and Bar stations',
  '{
    "stations": [
      {"name": "Hot Line", "categories": ["Entrees", "Appetizers", "Soups"], "criticality": 1.5},
      {"name": "Cold Line", "categories": ["Salads", "Cold Appetizers"], "criticality": 1.2},
      {"name": "Expo", "categories": ["*"], "is_expo": true, "criticality": 1.8},
      {"name": "Bar", "categories": ["Beverages", "Cocktails", "Beer", "Wine"], "criticality": 1.3}
    ],
    "bump_rules": {
      "require_expo_bump": true,
      "auto_bump_timeout_minutes": 30
    }
  }',
  1,
  1
);

-- Station criticality weights
INSERT OR IGNORE INTO automation_rules (id, rule_category, rule_name, rule_description, rule_logic_json, is_active, is_default) VALUES
(
  'rule_station_weights',
  'station_weights',
  'Station Criticality Weights',
  'Default criticality weights for different station types',
  '{
    "weights": {
      "KDS": 1.5,
      "Printer": 1.3,
      "Expo": 1.8,
      "Bar": 1.2,
      "Prep": 1.0
    },
    "failure_threshold": 0.7,
    "warning_threshold": 0.85
  }',
  1,
  1
);

-- ============================================
-- SEED DEFAULT TOAST SELECTORS
-- Initial DOM selector mappings for Toast web interface
-- ============================================

-- Login page selectors
INSERT OR IGNORE INTO toast_selectors (id, page, element, selector_type, selector_value, visual_description) VALUES
('sel_login_email', 'login', 'email_field', 'css', 'input[name="email"]', 'Email input field on login page'),
('sel_login_password', 'login', 'password_field', 'css', 'input[name="password"]', 'Password input field on login page'),
('sel_login_submit', 'login', 'submit_button', 'css', 'button[type="submit"]', 'Orange "Sign In" button'),
('sel_login_error', 'login', 'error_message', 'css', '.error-message, [role="alert"]', 'Error message display area');

-- Menu editor selectors
INSERT OR IGNORE INTO toast_selectors (id, page, element, selector_type, selector_value, visual_description) VALUES
('sel_menu_add_item', 'menu_editor', 'add_item_button', 'css', '[data-testid="add-menu-item"], button:contains("Add Item")', 'Button to add new menu item'),
('sel_menu_item_name', 'menu_editor', 'item_name_input', 'css', 'input[name="name"], input[placeholder*="name"]', 'Menu item name input field'),
('sel_menu_item_price', 'menu_editor', 'item_price_input', 'css', 'input[name="price"], input[placeholder*="price"]', 'Menu item price input field'),
('sel_menu_save', 'menu_editor', 'save_button', 'css', 'button[type="submit"], button:contains("Save")', 'Save button for menu item');

-- KDS config selectors
INSERT OR IGNORE INTO toast_selectors (id, page, element, selector_type, selector_value, visual_description) VALUES
('sel_kds_add_station', 'kds_config', 'add_station_button', 'css', '[data-testid="add-station"], button:contains("Add Station")', 'Button to add new KDS station'),
('sel_kds_station_name', 'kds_config', 'station_name_input', 'css', 'input[name="stationName"]', 'Station name input field'),
('sel_kds_category_select', 'kds_config', 'category_multiselect', 'css', '[data-testid="category-select"]', 'Multi-select for routing categories');

-- Navigation selectors
INSERT OR IGNORE INTO toast_selectors (id, page, element, selector_type, selector_value, visual_description) VALUES
('sel_nav_menu', 'navigation', 'menu_nav_link', 'css', 'a[href*="menu"], nav li:contains("Menu")', 'Menu section navigation link'),
('sel_nav_kds', 'navigation', 'kds_nav_link', 'css', 'a[href*="kds"], nav li:contains("Kitchen")', 'Kitchen/KDS section navigation link'),
('sel_nav_settings', 'navigation', 'settings_nav_link', 'css', 'a[href*="settings"], nav li:contains("Settings")', 'Settings section navigation link');
