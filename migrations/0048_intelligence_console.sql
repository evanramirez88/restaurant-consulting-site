-- =====================================================
-- INTELLIGENCE CONSOLE SYSTEM
-- Millstone Intelligence + Data Context Integration
-- Model-agnostic AI with multi-source data synthesis
-- =====================================================

-- =====================================================
-- AI MODEL CONFIGURATION (Model Agnostic)
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_model_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL, -- 'openai', 'anthropic', 'google', 'openrouter', 'workers_ai', 'custom'
  base_url TEXT,
  api_key_encrypted TEXT, -- Encrypted storage
  is_active INTEGER DEFAULT 1,
  is_default INTEGER DEFAULT 0,
  supports_streaming INTEGER DEFAULT 1,
  supports_vision INTEGER DEFAULT 0,
  supports_function_calling INTEGER DEFAULT 0,
  max_context_window INTEGER,
  cost_per_1k_input REAL,
  cost_per_1k_output REAL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS ai_models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES ai_model_providers(id),
  model_id TEXT NOT NULL, -- e.g., 'gpt-4o', 'claude-3-sonnet', 'gemini-2.5-flash'
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general', -- 'general', 'fast', 'reasoning', 'vision', 'code'
  is_active INTEGER DEFAULT 1,
  is_default INTEGER DEFAULT 0,
  max_tokens INTEGER,
  supports_streaming INTEGER DEFAULT 1,
  supports_vision INTEGER DEFAULT 0,
  temperature_default REAL DEFAULT 0.7,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Seed default providers
INSERT OR IGNORE INTO ai_model_providers (id, name, provider_type, is_active, is_default) VALUES
  ('workers_ai', 'Cloudflare Workers AI', 'workers_ai', 1, 1),
  ('openai', 'OpenAI', 'openai', 0, 0),
  ('anthropic', 'Anthropic', 'anthropic', 0, 0),
  ('google', 'Google AI', 'google', 0, 0),
  ('openrouter', 'OpenRouter', 'openrouter', 0, 0);

-- Seed Workers AI models
INSERT OR IGNORE INTO ai_models (id, provider_id, model_id, display_name, description, category, is_default) VALUES
  ('llama-3.1-70b', 'workers_ai', '@cf/meta/llama-3.1-70b-instruct', 'Llama 3.1 70B', 'Meta Llama 3.1 70B - Best for complex reasoning', 'reasoning', 1),
  ('llama-3.1-8b', 'workers_ai', '@cf/meta/llama-3.1-8b-instruct', 'Llama 3.1 8B', 'Meta Llama 3.1 8B - Fast responses', 'fast', 0),
  ('gemma-7b', 'workers_ai', '@cf/google/gemma-7b-it', 'Gemma 7B', 'Google Gemma 7B', 'fast', 0),
  ('mistral-7b', 'workers_ai', '@cf/mistral/mistral-7b-instruct-v0.1', 'Mistral 7B', 'Mistral 7B Instruct', 'general', 0);

-- =====================================================
-- CUSTOM ASSISTANTS (GPTs)
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_assistants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  system_instructions TEXT NOT NULL,
  persona TEXT, -- Character/personality
  model_id TEXT REFERENCES ai_models(id),
  temperature REAL DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2048,

  -- Context settings
  include_business_context INTEGER DEFAULT 1, -- Include R&G business data
  include_leads_context INTEGER DEFAULT 0,
  include_clients_context INTEGER DEFAULT 0,
  include_tickets_context INTEGER DEFAULT 0,
  include_calendar_context INTEGER DEFAULT 0,

  -- Libraries/tools
  tools TEXT, -- JSON array of tool IDs
  speaking_style_id TEXT,

  -- Ownership
  is_system INTEGER DEFAULT 0, -- 1 = built-in assistant
  created_by TEXT DEFAULT 'admin',
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Seed R&G Business Assistant
INSERT OR IGNORE INTO ai_assistants (
  id, name, description, system_instructions, persona, is_system,
  include_business_context, include_leads_context, include_clients_context, include_tickets_context
) VALUES (
  'rg_business_advisor',
  'R&G Business Advisor',
  'AI advisor for R&G Consulting business operations',
  'You are the AI Business Advisor for R&G Consulting LLC, a restaurant technology consulting firm specializing in Toast POS systems.

CORE MISSION: Help Evan achieve $400,000 revenue by May 1, 2026.

CAPABILITIES:
- Analyze business metrics and KPIs
- Review leads and suggest outreach strategies
- Monitor client health and retention
- Track support tickets and prioritize issues
- Generate reports and insights
- Draft communications and proposals

GUIDELINES:
1. Be concise but thorough - restaurant owners are busy
2. Always tie recommendations to the $400K goal
3. Prioritize revenue-generating activities
4. Identify quick wins when possible
5. Be specific with numbers and actionable steps
6. Flag concerning trends proactively
7. Consider both Lane A (local) and Lane B (national) strategies',
  'Professional, strategic, data-driven. Speaks directly with actionable insights.',
  1,
  1, 1, 1, 1
);

-- Toast Specialist Assistant
INSERT OR IGNORE INTO ai_assistants (
  id, name, description, system_instructions, persona, is_system
) VALUES (
  'toast_specialist',
  'Toast POS Specialist',
  'Expert on Toast POS systems, menus, and configurations',
  'You are a Toast POS expert with deep knowledge of:
- Toast hardware and software setup
- Menu configuration and modifiers
- Kitchen display system optimization
- Online ordering setup
- Reporting and analytics
- Common troubleshooting
- Integration capabilities

Help users with Toast-related questions, menu builds, and configuration advice.',
  'Technical expert, patient teacher, solution-focused.',
  1
);

-- =====================================================
-- CHAT SESSIONS & MESSAGES
-- =====================================================

CREATE TABLE IF NOT EXISTS intelligence_sessions (
  id TEXT PRIMARY KEY,
  title TEXT,
  assistant_id TEXT REFERENCES ai_assistants(id),
  model_id TEXT REFERENCES ai_models(id),
  secondary_model_id TEXT, -- For dual-model conversations

  -- Context at session start
  context_snapshot TEXT, -- JSON of business state
  speaking_style_id TEXT,
  builder_mode TEXT DEFAULT 'none', -- 'none', 'code', 'write', 'research', 'analysis'

  -- Organization
  folder_id TEXT,
  is_pinned INTEGER DEFAULT 0,
  is_archived INTEGER DEFAULT 0,

  -- Metadata
  message_count INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS intelligence_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES intelligence_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,

  -- Attachments
  attachments TEXT, -- JSON array of {name, mimeType, url, size}

  -- Metadata
  model_used TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  generation_time_ms INTEGER,

  -- For tool calls
  tool_calls TEXT, -- JSON array of tool call results

  -- Builder mode context
  builder_mode TEXT,
  speaking_style_id TEXT,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON intelligence_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON intelligence_sessions(updated_at DESC);

-- =====================================================
-- SPEAKING STYLES & LIBRARIES
-- =====================================================

CREATE TABLE IF NOT EXISTS intelligence_styles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT NOT NULL, -- System prompt addition
  category TEXT DEFAULT 'general', -- 'general', 'business', 'technical', 'creative'
  is_system INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Seed default styles
INSERT OR IGNORE INTO intelligence_styles (id, name, description, instructions, is_system) VALUES
  ('concise', 'Concise', 'Direct and to the point', 'Be direct and to the point. No fluff. Use bullet points when helpful.', 1),
  ('detailed', 'Detailed', 'Thorough explanations', 'Provide detailed explanations with examples. Be comprehensive.', 1),
  ('executive', 'Executive Summary', 'High-level business focus', 'Write as executive summaries. Lead with key insights and recommendations. Use business language.', 1),
  ('technical', 'Technical', 'Technical depth', 'Use technical language appropriate for developers/engineers. Include code examples when relevant.', 1),
  ('friendly', 'Friendly', 'Warm and approachable', 'Be warm and approachable. Use conversational language while remaining professional.', 1);

-- =====================================================
-- DATA CONTEXT SOURCES
-- =====================================================

CREATE TABLE IF NOT EXISTS context_data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'limitless', 'sms', 'calls', 'email', 'calendar', 'location', 'hubspot', 'internal'
  tier INTEGER DEFAULT 2, -- 1=crucial, 2=daily, 3=financial, 4=periodic, 5=system, 6=archive

  -- Connection config
  endpoint_url TEXT,
  api_key_encrypted TEXT,
  oauth_config TEXT, -- JSON for OAuth settings

  -- Sync settings
  sync_enabled INTEGER DEFAULT 0,
  sync_interval_minutes INTEGER DEFAULT 60,
  last_sync_at INTEGER,
  last_sync_status TEXT,
  last_sync_count INTEGER,

  -- Data retention
  retention_days INTEGER DEFAULT 365,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Seed data sources
INSERT OR IGNORE INTO context_data_sources (id, name, source_type, tier, sync_enabled) VALUES
  ('limitless', 'Limitless AI', 'limitless', 1, 0),
  ('sms', 'SMS Messages', 'sms', 1, 0),
  ('calls', 'Phone Calls', 'calls', 1, 0),
  ('gmail', 'Gmail', 'email', 2, 0),
  ('calendar', 'Google Calendar', 'calendar', 2, 0),
  ('location', 'Location History', 'location', 1, 0),
  ('hubspot', 'HubSpot CRM', 'hubspot', 2, 1),
  ('internal', 'Internal Data', 'internal', 1, 1);

-- =====================================================
-- CONTEXT ITEMS (Ingested Data)
-- =====================================================

CREATE TABLE IF NOT EXISTS context_items (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES context_data_sources(id),
  item_type TEXT NOT NULL, -- 'transcript', 'message', 'call', 'email', 'event', 'location', 'contact', 'note'

  -- Content
  title TEXT,
  content TEXT NOT NULL,
  summary TEXT, -- AI-generated summary

  -- Metadata
  external_id TEXT, -- ID from source system
  timestamp INTEGER NOT NULL, -- When the item occurred
  duration_seconds INTEGER, -- For calls/meetings

  -- Participants
  participants TEXT, -- JSON array of {name, email, phone, role}

  -- Location
  latitude REAL,
  longitude REAL,
  place_name TEXT,

  -- Relationships
  related_lead_id TEXT,
  related_client_id TEXT,
  related_contact_id TEXT,

  -- Embedding
  embedding_id TEXT, -- Reference to vector store

  -- Processing
  is_processed INTEGER DEFAULT 0,
  processed_at INTEGER,

  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(source_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_context_source ON context_items(source_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_context_type ON context_items(item_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_context_lead ON context_items(related_lead_id);
CREATE INDEX IF NOT EXISTS idx_context_client ON context_items(related_client_id);

-- =====================================================
-- SESSION FOLDERS
-- =====================================================

CREATE TABLE IF NOT EXISTS intelligence_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  parent_id TEXT REFERENCES intelligence_folders(id),
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Seed default folders
INSERT OR IGNORE INTO intelligence_folders (id, name, description, icon) VALUES
  ('business', 'Business', 'Business analysis and planning', 'briefcase'),
  ('leads', 'Lead Research', 'Lead analysis and outreach planning', 'users'),
  ('clients', 'Client Support', 'Client-related queries', 'heart'),
  ('technical', 'Technical', 'Technical questions and debugging', 'code');

-- =====================================================
-- FILE ATTACHMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS intelligence_files (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES intelligence_sessions(id) ON DELETE SET NULL,
  assistant_id TEXT REFERENCES ai_assistants(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER,

  -- Storage
  storage_type TEXT DEFAULT 'r2', -- 'r2', 'base64', 'url'
  storage_url TEXT,
  storage_key TEXT,

  -- Context
  is_global INTEGER DEFAULT 0, -- Available to all sessions
  description TEXT,

  created_at INTEGER DEFAULT (unixepoch())
);

-- =====================================================
-- CONNECTIONS (External APIs)
-- =====================================================

CREATE TABLE IF NOT EXISTS intelligence_connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  connection_type TEXT NOT NULL, -- 'model_provider', 'tool', 'data_source', 'webhook'

  -- Config
  base_url TEXT,
  api_key_encrypted TEXT,
  additional_config TEXT, -- JSON

  -- Status
  is_active INTEGER DEFAULT 1,
  last_tested_at INTEGER,
  last_test_status TEXT,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- =====================================================
-- USAGE TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS intelligence_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  model_id TEXT,
  provider_id TEXT,

  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  cost_estimate REAL DEFAULT 0,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_usage_date ON intelligence_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_model ON intelligence_usage(model_id, created_at DESC);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
