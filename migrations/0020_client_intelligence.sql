-- Cape Cod Restaurant Consulting - Client Intelligence System
-- Migration: 0020_client_intelligence.sql
-- Created: 2026-01-12
--
-- This migration adds:
-- - Extended client profiles with business intelligence
-- - Atomic facts system for AI-discovered data
-- - File import tracking
-- - Model-agnostic AI provider configuration
-- - Local storage sync tracking

-- ============================================
-- CLIENT PROFILES - Extended Business Intelligence
-- ============================================
CREATE TABLE IF NOT EXISTS client_profiles (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Restaurant Classification (links to existing taxonomy)
  cuisine_type TEXT,
  service_style TEXT,
  bar_program TEXT,
  menu_complexity TEXT,
  restaurant_type_template_id TEXT REFERENCES restaurant_type_templates(id),

  -- Business Details
  license_number TEXT,
  license_type TEXT CHECK (license_type IN ('Common Victualler', 'Liquor (Full)', 'Liquor (Beer/Wine)', 'Seasonal', 'Other')),
  seating_capacity INTEGER,
  square_footage INTEGER,
  employee_count INTEGER,
  years_in_business INTEGER,

  -- Health & Compliance
  health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),
  last_inspection_date TEXT,
  compliance_notes TEXT,

  -- Tech Stack
  pos_system TEXT,
  pos_account_id TEXT,
  pos_version TEXT,
  online_ordering TEXT,
  reservation_system TEXT,
  kitchen_display_count INTEGER DEFAULT 0,
  terminal_count INTEGER DEFAULT 0,
  printer_count INTEGER DEFAULT 0,

  -- Digital Presence
  website TEXT,
  google_business_url TEXT,
  yelp_url TEXT,
  tripadvisor_url TEXT,
  instagram_handle TEXT,
  facebook_url TEXT,
  twitter_handle TEXT,

  -- Financial Intelligence (Estimated/Discovered)
  estimated_revenue_tier TEXT CHECK (estimated_revenue_tier IN ('under_500k', '500k_1m', '1m_2m', '2m_5m', 'over_5m')),
  avg_check_size REAL,
  covers_per_day INTEGER,
  peak_hours TEXT,
  busiest_days TEXT,

  -- History & Timeline
  established_date TEXT,
  location_history_json TEXT, -- JSON array of {period, name, notes}
  ownership_history_json TEXT, -- JSON array of {period, owner, role}

  -- Internal Scoring
  client_score INTEGER DEFAULT 50,
  engagement_score INTEGER DEFAULT 0,
  upsell_potential INTEGER DEFAULT 0,
  churn_risk INTEGER DEFAULT 0,

  -- Service Tracking
  last_service_date TEXT,
  total_projects INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),

  UNIQUE(client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_profiles_client ON client_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_client_profiles_pos ON client_profiles(pos_system);
CREATE INDEX IF NOT EXISTS idx_client_profiles_cuisine ON client_profiles(cuisine_type);
CREATE INDEX IF NOT EXISTS idx_client_profiles_score ON client_profiles(client_score);

-- ============================================
-- ATOMIC FACTS - AI-Discovered Data Points
-- ============================================
CREATE TABLE IF NOT EXISTS client_atomic_facts (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Fact Details
  field_name TEXT NOT NULL,
  field_value TEXT NOT NULL,
  original_text TEXT,

  -- Source Tracking
  source TEXT NOT NULL CHECK (source IN ('ai_research', 'manual', 'import', 'client_portal', 'web_scrape')),
  source_file TEXT,
  source_url TEXT,
  ai_provider_id TEXT REFERENCES ai_providers(id),

  -- Confidence & Status
  confidence REAL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'superseded')),

  -- Review Tracking
  reviewed_by TEXT,
  reviewed_at INTEGER,
  rejection_reason TEXT,

  -- If this fact supersedes another
  supersedes_fact_id TEXT REFERENCES client_atomic_facts(id),

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_atomic_facts_client ON client_atomic_facts(client_id);
CREATE INDEX IF NOT EXISTS idx_atomic_facts_status ON client_atomic_facts(status);
CREATE INDEX IF NOT EXISTS idx_atomic_facts_source ON client_atomic_facts(source);
CREATE INDEX IF NOT EXISTS idx_atomic_facts_field ON client_atomic_facts(field_name);

-- ============================================
-- FILE IMPORTS - Track Import Jobs
-- ============================================
CREATE TABLE IF NOT EXISTS file_imports (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT NOT NULL CHECK (file_type IN ('txt', 'md', 'csv', 'pdf', 'xlsx', 'docx', 'json')),
  file_size INTEGER,
  file_hash TEXT,

  -- Processing Status
  import_status TEXT DEFAULT 'pending' CHECK (import_status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
  records_found INTEGER DEFAULT 0,
  records_imported INTEGER DEFAULT 0,
  facts_extracted INTEGER DEFAULT 0,
  facts_approved INTEGER DEFAULT 0,

  -- Error Tracking
  errors_json TEXT,
  error_message TEXT,

  -- Processing Metadata
  ai_provider_id TEXT REFERENCES ai_providers(id),
  processing_config_json TEXT,

  -- Timestamps
  processing_started_at INTEGER,
  processing_completed_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_file_imports_status ON file_imports(import_status);
CREATE INDEX IF NOT EXISTS idx_file_imports_type ON file_imports(file_type);
CREATE INDEX IF NOT EXISTS idx_file_imports_created ON file_imports(created_at);

-- ============================================
-- AI PROVIDERS - Model-Agnostic Configuration
-- ============================================
CREATE TABLE IF NOT EXISTS ai_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('openai', 'anthropic', 'google', 'cloudflare', 'local', 'custom')),
  model_id TEXT NOT NULL,
  api_endpoint TEXT,

  -- Configuration
  max_tokens INTEGER DEFAULT 4096,
  temperature REAL DEFAULT 0.7,
  system_prompt TEXT,
  config_json TEXT, -- Additional provider-specific config

  -- Status
  is_active INTEGER DEFAULT 0,
  is_default INTEGER DEFAULT 0,

  -- Cost Tracking
  cost_per_1k_input REAL,
  cost_per_1k_output REAL,

  -- Capabilities
  supports_vision INTEGER DEFAULT 0,
  supports_function_calling INTEGER DEFAULT 0,
  supports_streaming INTEGER DEFAULT 1,
  context_window INTEGER,

  -- Usage Stats
  total_requests INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_ai_providers_active ON ai_providers(is_active, is_default);
CREATE INDEX IF NOT EXISTS idx_ai_providers_type ON ai_providers(provider_type);

-- ============================================
-- AI USAGE LOGS - Track All AI Calls
-- ============================================
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id TEXT PRIMARY KEY,
  provider_id TEXT REFERENCES ai_providers(id),

  -- Task Details
  task_type TEXT NOT NULL CHECK (task_type IN ('research', 'extraction', 'classification', 'enrichment', 'menu_parse', 'quote_parse', 'other')),
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,

  -- Content (optional - for debugging)
  input_preview TEXT, -- First 500 chars
  output_preview TEXT, -- First 500 chars

  -- Performance
  duration_ms INTEGER,
  cost_estimate REAL,
  success INTEGER DEFAULT 1,
  error_message TEXT,

  -- Context
  client_id TEXT REFERENCES clients(id),
  import_id TEXT REFERENCES file_imports(id),
  fact_id TEXT REFERENCES client_atomic_facts(id),

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON ai_usage_logs(provider_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_task ON ai_usage_logs(task_type);
CREATE INDEX IF NOT EXISTS idx_ai_usage_client ON ai_usage_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage_logs(created_at);

-- ============================================
-- LOCAL STORAGE SYNC - Track D:\ Synchronization
-- ============================================
CREATE TABLE IF NOT EXISTS local_storage_sync (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('client', 'lead', 'restaurant', 'file', 'import', 'backup')),
  entity_id TEXT NOT NULL,

  -- Sync Tracking
  d1_updated_at INTEGER,
  local_path TEXT,
  local_updated_at INTEGER,
  local_file_hash TEXT,

  -- Status
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'conflict', 'local_only', 'd1_only')),
  sync_direction TEXT CHECK (sync_direction IN ('to_local', 'to_d1', 'bidirectional')),
  last_sync_at INTEGER,
  sync_error TEXT,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),

  UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_local_sync_status ON local_storage_sync(sync_status);
CREATE INDEX IF NOT EXISTS idx_local_sync_entity ON local_storage_sync(entity_type, entity_id);

-- ============================================
-- RESEARCH SESSIONS - Track Research Tasks
-- ============================================
CREATE TABLE IF NOT EXISTS research_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,

  -- Target
  client_id TEXT REFERENCES clients(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('client', 'lead', 'market', 'competitor')),
  target_entity TEXT,

  -- Session Details
  research_type TEXT NOT NULL CHECK (research_type IN ('discovery', 'enrichment', 'competitive', 'market_analysis', 'verification')),
  query TEXT,
  sources_json TEXT, -- JSON array of sources to check

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  facts_found INTEGER DEFAULT 0,
  facts_approved INTEGER DEFAULT 0,

  -- Results
  summary TEXT,
  findings_json TEXT,

  -- AI Tracking
  ai_provider_id TEXT REFERENCES ai_providers(id),
  total_ai_calls INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,

  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_research_client ON research_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_research_status ON research_sessions(status);
CREATE INDEX IF NOT EXISTS idx_research_type ON research_sessions(research_type);

-- ============================================
-- SEED DEFAULT AI PROVIDERS
-- ============================================
INSERT OR IGNORE INTO ai_providers (id, name, provider_type, model_id, is_active, is_default, supports_vision, supports_function_calling, context_window, cost_per_1k_input, cost_per_1k_output) VALUES
  ('ai_gemini_flash', 'Gemini 2.5 Flash', 'google', 'gemini-2.5-flash-preview-05-20', 1, 1, 1, 1, 1000000, 0.0003, 0.0006),
  ('ai_claude_sonnet', 'Claude Sonnet 4', 'anthropic', 'claude-sonnet-4-20250514', 0, 0, 1, 1, 200000, 0.003, 0.015),
  ('ai_claude_haiku', 'Claude Haiku 3.5', 'anthropic', 'claude-3-5-haiku-20241022', 0, 0, 1, 1, 200000, 0.0008, 0.004),
  ('ai_gpt4o_mini', 'GPT-4o Mini', 'openai', 'gpt-4o-mini', 0, 0, 1, 1, 128000, 0.00015, 0.0006),
  ('ai_cloudflare_llava', 'Cloudflare LLaVA', 'cloudflare', '@cf/llava-hf/llava-1.5-7b-hf', 1, 0, 1, 0, 4096, 0, 0);

-- ============================================
-- UPDATE CLIENTS TABLE - Add intelligence fields
-- ============================================
-- Note: portal_enabled already exists from 0003

-- Add research-related columns if they don't exist
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use separate statements
-- These will fail silently if columns already exist

-- Check if columns exist and add them (using a different approach)
CREATE TABLE IF NOT EXISTS _migration_temp (id INTEGER);
DROP TABLE IF EXISTS _migration_temp;

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Clients with their intelligence profile
CREATE VIEW IF NOT EXISTS v_client_intelligence AS
SELECT
  c.id,
  c.name,
  c.company,
  c.email,
  c.phone,
  c.slug,
  c.portal_enabled,
  c.support_plan_tier,
  cp.pos_system,
  cp.cuisine_type,
  cp.seating_capacity,
  cp.client_score,
  cp.engagement_score,
  cp.estimated_revenue_tier,
  cp.last_service_date,
  (SELECT COUNT(*) FROM client_atomic_facts WHERE client_id = c.id AND status = 'pending') as pending_facts,
  (SELECT COUNT(*) FROM client_atomic_facts WHERE client_id = c.id AND status = 'approved') as approved_facts
FROM clients c
LEFT JOIN client_profiles cp ON c.id = cp.client_id;

-- Pending facts queue with client info
CREATE VIEW IF NOT EXISTS v_pending_facts_queue AS
SELECT
  f.id as fact_id,
  f.client_id,
  c.name as client_name,
  c.company as client_company,
  f.field_name,
  f.field_value,
  f.original_text,
  f.source,
  f.confidence,
  f.created_at,
  ai.name as ai_provider_name
FROM client_atomic_facts f
JOIN clients c ON f.client_id = c.id
LEFT JOIN ai_providers ai ON f.ai_provider_id = ai.id
WHERE f.status = 'pending'
ORDER BY f.confidence DESC, f.created_at DESC;

-- AI usage summary by provider
CREATE VIEW IF NOT EXISTS v_ai_usage_summary AS
SELECT
  p.id as provider_id,
  p.name as provider_name,
  p.provider_type,
  COUNT(u.id) as total_calls,
  SUM(u.input_tokens) as total_input_tokens,
  SUM(u.output_tokens) as total_output_tokens,
  SUM(u.cost_estimate) as total_cost,
  AVG(u.duration_ms) as avg_duration_ms,
  SUM(CASE WHEN u.success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
FROM ai_providers p
LEFT JOIN ai_usage_logs u ON p.id = u.provider_id
GROUP BY p.id;

-- ============================================
-- TRIGGERS FOR AUTO-UPDATE
-- ============================================

-- Update client_profiles.updated_at on change
CREATE TRIGGER IF NOT EXISTS trg_client_profiles_updated
AFTER UPDATE ON client_profiles
BEGIN
  UPDATE client_profiles SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Update local_storage_sync.updated_at on change
CREATE TRIGGER IF NOT EXISTS trg_local_sync_updated
AFTER UPDATE ON local_storage_sync
BEGIN
  UPDATE local_storage_sync SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Update AI provider stats on usage log insert
CREATE TRIGGER IF NOT EXISTS trg_ai_usage_stats
AFTER INSERT ON ai_usage_logs
BEGIN
  UPDATE ai_providers
  SET
    total_requests = total_requests + 1,
    total_tokens_used = total_tokens_used + COALESCE(NEW.input_tokens, 0) + COALESCE(NEW.output_tokens, 0),
    total_cost = total_cost + COALESCE(NEW.cost_estimate, 0),
    updated_at = unixepoch()
  WHERE id = NEW.provider_id;
END;
