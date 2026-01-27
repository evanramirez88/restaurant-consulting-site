-- Toast Hub Authority Engine - Content Aggregation & GEO Optimization
-- Migration 0091
-- Implements: Content Sources, Curation Queue (Two-Gate System), Portal Visibility

-- ============================================
-- CONTENT SOURCES (RSS, Reddit, APIs, Internal)
-- ============================================
CREATE TABLE IF NOT EXISTS toast_hub_sources (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name TEXT NOT NULL,
  source_type TEXT CHECK (source_type IN ('rss', 'reddit', 'api', 'manual', 'data_context')),
  feed_url TEXT, -- Nullable for manual/data_context sources
  category_id TEXT,
  fetch_frequency_minutes INTEGER DEFAULT 120,
  last_fetched_at INTEGER,
  last_error TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (category_id) REFERENCES toast_hub_categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sources_type ON toast_hub_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_sources_active ON toast_hub_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_sources_next_fetch ON toast_hub_sources(is_active, last_fetched_at);

-- ============================================
-- CURATION QUEUE (The Two-Gate System)
-- ============================================
CREATE TABLE IF NOT EXISTS toast_hub_imports (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  source_id TEXT,
  external_id TEXT, -- Unique ID from the source (e.g., Reddit Post ID)
  external_url TEXT,
  title TEXT NOT NULL,
  excerpt TEXT,
  content_body TEXT, -- Raw content before processing
  author TEXT,
  published_at INTEGER,
  -- CURATION STATUS (Gate 1)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  review_notes TEXT,
  -- VISIBILITY TOGGLES (Gate 2) - Default 0/False
  visible_public INTEGER DEFAULT 0,
  visible_client_portal INTEGER DEFAULT 0,
  visible_rep_portal INTEGER DEFAULT 0,
  -- PUBLISHING
  post_id TEXT, -- Link to final published post if promoted
  promoted_at INTEGER,
  -- GEO OPTIMIZATION FIELDS
  tldr_summary TEXT, -- 40-60 word summary for AI citation
  expert_commentary TEXT, -- Evan's analysis
  fact_highlights_json TEXT, -- Array of highlighted statistics
  -- METADATA
  tags_json TEXT,
  category_suggestion TEXT,
  ai_score REAL, -- Quality/relevance score from AI
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (source_id) REFERENCES toast_hub_sources(id) ON DELETE SET NULL,
  FOREIGN KEY (post_id) REFERENCES toast_hub_posts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_imports_status ON toast_hub_imports(status);
CREATE INDEX IF NOT EXISTS idx_imports_visibility ON toast_hub_imports(visible_public, visible_client_portal, visible_rep_portal);
CREATE INDEX IF NOT EXISTS idx_imports_source ON toast_hub_imports(source_id);
CREATE INDEX IF NOT EXISTS idx_imports_external ON toast_hub_imports(external_id);
CREATE INDEX IF NOT EXISTS idx_imports_created ON toast_hub_imports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imports_pending ON toast_hub_imports(status, created_at DESC) WHERE status = 'pending';

-- ============================================
-- ADD AUTHORITY ENGINE FIELDS TO POSTS
-- ============================================
-- Add portal visibility to existing posts
ALTER TABLE toast_hub_posts ADD COLUMN visible_public INTEGER DEFAULT 1;
ALTER TABLE toast_hub_posts ADD COLUMN visible_client_portal INTEGER DEFAULT 0;
ALTER TABLE toast_hub_posts ADD COLUMN visible_rep_portal INTEGER DEFAULT 0;

-- Add GEO optimization fields
ALTER TABLE toast_hub_posts ADD COLUMN tldr_summary TEXT;
ALTER TABLE toast_hub_posts ADD COLUMN expert_commentary TEXT;
ALTER TABLE toast_hub_posts ADD COLUMN fact_highlights_json TEXT;
ALTER TABLE toast_hub_posts ADD COLUMN faq_json TEXT; -- Auto-generated FAQs for schema
ALTER TABLE toast_hub_posts ADD COLUMN reading_time_minutes INTEGER;

-- Add source tracking
ALTER TABLE toast_hub_posts ADD COLUMN source_import_id TEXT;
ALTER TABLE toast_hub_posts ADD COLUMN source_type TEXT;
ALTER TABLE toast_hub_posts ADD COLUMN source_url TEXT;

-- ============================================
-- AGGREGATOR RUN LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS toast_hub_aggregator_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  run_started_at INTEGER NOT NULL,
  run_completed_at INTEGER,
  sources_processed INTEGER DEFAULT 0,
  items_fetched INTEGER DEFAULT 0,
  items_imported INTEGER DEFAULT 0,
  items_duplicated INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  errors_json TEXT,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_aggregator_logs_status ON toast_hub_aggregator_logs(status);
CREATE INDEX IF NOT EXISTS idx_aggregator_logs_started ON toast_hub_aggregator_logs(run_started_at DESC);

-- ============================================
-- CONTENT GENERATION REQUESTS (from tickets/briefs)
-- ============================================
CREATE TABLE IF NOT EXISTS toast_hub_content_requests (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  request_type TEXT NOT NULL CHECK (request_type IN ('ticket', 'brief', 'manual', 'ai_suggestion')),
  source_reference TEXT, -- ticket_id, brief_id, etc.
  title TEXT NOT NULL,
  description TEXT,
  requested_by TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'draft_ready', 'published', 'rejected')),
  generated_import_id TEXT, -- Links to toast_hub_imports if AI generates draft
  generated_post_id TEXT, -- Links to toast_hub_posts if published
  priority INTEGER DEFAULT 0,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (generated_import_id) REFERENCES toast_hub_imports(id) ON DELETE SET NULL,
  FOREIGN KEY (generated_post_id) REFERENCES toast_hub_posts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_content_requests_status ON toast_hub_content_requests(status);
CREATE INDEX IF NOT EXISTS idx_content_requests_type ON toast_hub_content_requests(request_type);

-- ============================================
-- SEED DEFAULT CONTENT SOURCES
-- ============================================
INSERT OR IGNORE INTO toast_hub_sources (id, name, source_type, feed_url, fetch_frequency_minutes, is_active) VALUES
  -- Industry News (RSS)
  ('src_nrn', 'Nation''s Restaurant News', 'rss', 'https://www.nrn.com/rss.xml', 120, 1),
  ('src_mrm', 'Modern Restaurant Management', 'rss', 'https://modernrestaurantmanagement.com/feed/', 120, 1),
  ('src_rbo', 'Restaurant Business Online', 'rss', 'https://www.restaurantbusinessonline.com/rss.xml', 120, 1),
  ('src_fsm', 'Foodservice Equipment Reports', 'rss', 'https://fermag.com/feed/', 180, 1),

  -- Community (Reddit)
  ('src_reddit_toast', 'r/ToastPOS', 'reddit', 'https://www.reddit.com/r/ToastPOS/.rss', 60, 1),
  ('src_reddit_rest', 'r/restaurateur', 'reddit', 'https://www.reddit.com/r/restaurateur/.rss', 60, 1),

  -- Internal Sources
  ('src_data_context', 'DATA_CONTEXT Knowledge', 'data_context', NULL, 0, 1),
  ('src_tickets', 'Support Ticket Insights', 'manual', NULL, 0, 1),
  ('src_briefs', 'Business Brief Reports', 'manual', NULL, 0, 1);

-- ============================================
-- SEED EXAMPLE IMPORT (for testing workflow)
-- ============================================
INSERT OR IGNORE INTO toast_hub_imports (
  id, source_id, title, excerpt, content_body, author, status,
  visible_public, visible_client_portal, visible_rep_portal,
  tldr_summary, expert_commentary
) VALUES (
  'imp_demo_001',
  'src_tickets',
  'Network Loop Fix: Marshside Mama''s Toast Outage',
  'How we resolved a critical network loop causing Toast POS outages at a high-volume Cape Cod restaurant.',
  '## The Problem

Marshside Mama''s was experiencing intermittent Toast POS freezes during peak hours. The system would become unresponsive for 30-60 seconds, causing significant service disruptions.

## Root Cause Analysis

After reviewing network logs, we identified a broadcast storm caused by a misconfigured switch port mirroring setup. The network loop was amplifying traffic during high-volume periods.

## The Fix

1. Disabled port mirroring on the affected switch
2. Implemented Spanning Tree Protocol (STP) on all switches
3. Added a dedicated VLAN for Toast POS traffic
4. Configured QoS to prioritize POS packets

## Results

- Zero network-related outages since implementation
- Average transaction time reduced by 15%
- Kitchen ticket throughput improved by 22%',
  'Evan Ramirez',
  'approved',
  1, 1, 1,
  'A misconfigured switch caused network loops at Marshside Mama''s, leading to Toast POS freezes during peak hours. Implementing STP and dedicated VLANs eliminated outages and improved transaction speed by 15%.',
  'This is a classic case of network infrastructure being overlooked during POS installations. Many Toast implementations fail because the existing network wasn''t designed for the consistent low-latency traffic POS systems require. Always audit the network before go-live.'
);

-- ============================================
-- UPDATE EXISTING POST VISIBILITY (make all public by default)
-- ============================================
UPDATE toast_hub_posts SET visible_public = 1 WHERE visible_public IS NULL;
