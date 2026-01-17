-- Migration 0032: Beacon Content Aggregation & Curation Platform
-- Replaces Toast Hub with content marketing/SEO platform
-- Date: 2026-01-17

-- =====================================================
-- CONTENT SOURCES
-- =====================================================

-- Content sources configuration
CREATE TABLE IF NOT EXISTS beacon_sources (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('reddit', 'rss', 'web_scrape', 'notebooklm', 'manual', 'toast_central', 'toast_classroom')),
  config_json TEXT, -- Source-specific config (subreddit, URL, notebook ID, etc.)
  enabled INTEGER DEFAULT 1,
  fetch_frequency_minutes INTEGER DEFAULT 60,
  last_fetched_at INTEGER,
  items_fetched_total INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- =====================================================
-- CONTENT ITEMS (Aggregated)
-- =====================================================

-- Raw aggregated content items
CREATE TABLE IF NOT EXISTS beacon_content_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  source_id TEXT REFERENCES beacon_sources(id) ON DELETE SET NULL,
  external_id TEXT, -- ID from source (Reddit post ID, etc.)

  -- Content
  title TEXT NOT NULL,
  body TEXT,
  body_html TEXT,
  url TEXT,
  author TEXT,

  -- Metadata
  source_type TEXT NOT NULL,
  source_url TEXT,
  source_metadata_json TEXT, -- Reddit score, comments, etc.

  -- AI Processing
  ai_summary TEXT,
  ai_tags_json TEXT,
  ai_category TEXT, -- 'menu' | 'hardware' | 'integration' | 'report' | 'training' | 'general'
  ai_sentiment TEXT, -- 'positive' | 'negative' | 'neutral' | 'frustrated' | 'confused'
  ai_action_suggestion TEXT, -- 'solve' | 'respond' | 'infographic' | 'blog' | 'sop' | 'ignore'
  ai_priority_score INTEGER DEFAULT 50, -- 0-100, higher = more important
  ai_processed_at INTEGER,

  -- Workflow
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected', 'transformed', 'published', 'archived')),
  priority INTEGER DEFAULT 0,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  rejection_reason TEXT,
  notes TEXT,

  -- Publishing (if published directly without transformation)
  published_at INTEGER,
  publish_scheduled_at INTEGER,

  -- Deduplication
  content_hash TEXT, -- For detecting duplicates

  -- Timestamps
  fetched_at INTEGER DEFAULT (unixepoch()),
  source_created_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- =====================================================
-- PUBLICATIONS (Transformed/Created Content)
-- =====================================================

-- Transformed/created content (from workshop)
CREATE TABLE IF NOT EXISTS beacon_publications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  source_item_id TEXT REFERENCES beacon_content_items(id) ON DELETE SET NULL, -- Original item if transformed

  -- Content
  type TEXT NOT NULL CHECK (type IN ('blog', 'infographic', 'sop', 'social', 'solution', 'faq', 'guide', 'checklist', 'comparison')),
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  excerpt TEXT,
  body TEXT,
  body_html TEXT,
  body_markdown TEXT,

  -- Media
  featured_image_url TEXT,
  featured_image_alt TEXT,
  media_urls_json TEXT,
  attachments_json TEXT,

  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  keywords_json TEXT,
  structured_data_json TEXT, -- Schema.org JSON-LD
  canonical_url TEXT,

  -- Categorization
  category TEXT,
  subcategory TEXT,
  tags_json TEXT,
  related_publications_json TEXT,

  -- Publishing
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived', 'unpublished')),
  published_at INTEGER,
  scheduled_at INTEGER,
  unpublished_at INTEGER,

  -- Engagement tracking
  view_count INTEGER DEFAULT 0,
  unique_view_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  avg_time_on_page INTEGER,
  bounce_rate REAL,

  -- Author
  author_id TEXT,
  author_name TEXT DEFAULT 'R&G Consulting',

  -- Versioning
  version INTEGER DEFAULT 1,
  previous_version_id TEXT,

  -- Timestamps
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- =====================================================
-- TEMPLATES
-- =====================================================

-- Templates for content transformation
CREATE TABLE IF NOT EXISTS beacon_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('blog', 'infographic', 'sop', 'social', 'email', 'solution', 'faq', 'guide', 'checklist')),
  description TEXT,
  template_content TEXT, -- Handlebars/Mustache template
  template_css TEXT,
  default_styles_json TEXT,
  variables_json TEXT, -- Expected variables for template
  preview_image_url TEXT,
  is_default INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Toast template analysis (competitor templates to improve upon)
CREATE TABLE IF NOT EXISTS beacon_toast_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('menu', 'report', 'sop', 'training', 'checklist', 'form', 'other')),
  source_url TEXT,
  original_content TEXT,
  original_file_url TEXT,

  -- Analysis
  issues_json TEXT, -- Problems with this template
  improvements_json TEXT, -- How we'd do it better
  our_alternative_id TEXT REFERENCES beacon_templates(id),
  competitor_rating INTEGER, -- 1-5, how good is theirs?
  our_rating INTEGER, -- 1-5, how good is ours?

  analyzed_at INTEGER,
  analyzed_by TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- =====================================================
-- CATEGORIES & TAGS
-- =====================================================

-- Categories for organization
CREATE TABLE IF NOT EXISTS beacon_categories (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  color TEXT,
  parent_id TEXT REFERENCES beacon_categories(id),
  sort_order INTEGER DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Tags for flexible categorization
CREATE TABLE IF NOT EXISTS beacon_tags (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  usage_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- =====================================================
-- ANALYTICS
-- =====================================================

-- Page view tracking
CREATE TABLE IF NOT EXISTS beacon_page_views (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  publication_id TEXT REFERENCES beacon_publications(id) ON DELETE CASCADE,
  visitor_id TEXT, -- Anonymous visitor tracking
  referrer TEXT,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  time_on_page INTEGER, -- seconds
  scroll_depth INTEGER, -- percentage
  created_at INTEGER DEFAULT (unixepoch())
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Sources
CREATE INDEX IF NOT EXISTS idx_beacon_sources_type ON beacon_sources(type);
CREATE INDEX IF NOT EXISTS idx_beacon_sources_enabled ON beacon_sources(enabled);

-- Content Items
CREATE INDEX IF NOT EXISTS idx_beacon_items_status ON beacon_content_items(status);
CREATE INDEX IF NOT EXISTS idx_beacon_items_source ON beacon_content_items(source_id);
CREATE INDEX IF NOT EXISTS idx_beacon_items_fetched ON beacon_content_items(fetched_at);
CREATE INDEX IF NOT EXISTS idx_beacon_items_external ON beacon_content_items(external_id);
CREATE INDEX IF NOT EXISTS idx_beacon_items_category ON beacon_content_items(ai_category);
CREATE INDEX IF NOT EXISTS idx_beacon_items_priority ON beacon_content_items(ai_priority_score);
CREATE INDEX IF NOT EXISTS idx_beacon_items_hash ON beacon_content_items(content_hash);

-- Publications
CREATE INDEX IF NOT EXISTS idx_beacon_pubs_status ON beacon_publications(status);
CREATE INDEX IF NOT EXISTS idx_beacon_pubs_slug ON beacon_publications(slug);
CREATE INDEX IF NOT EXISTS idx_beacon_pubs_published ON beacon_publications(published_at);
CREATE INDEX IF NOT EXISTS idx_beacon_pubs_type ON beacon_publications(type);
CREATE INDEX IF NOT EXISTS idx_beacon_pubs_category ON beacon_publications(category);
CREATE INDEX IF NOT EXISTS idx_beacon_pubs_scheduled ON beacon_publications(scheduled_at);

-- Templates
CREATE INDEX IF NOT EXISTS idx_beacon_templates_type ON beacon_templates(type);
CREATE INDEX IF NOT EXISTS idx_beacon_templates_default ON beacon_templates(is_default);

-- Categories
CREATE INDEX IF NOT EXISTS idx_beacon_categories_slug ON beacon_categories(slug);
CREATE INDEX IF NOT EXISTS idx_beacon_categories_parent ON beacon_categories(parent_id);

-- Tags
CREATE INDEX IF NOT EXISTS idx_beacon_tags_slug ON beacon_tags(slug);

-- Analytics
CREATE INDEX IF NOT EXISTS idx_beacon_views_pub ON beacon_page_views(publication_id);
CREATE INDEX IF NOT EXISTS idx_beacon_views_time ON beacon_page_views(created_at);

-- =====================================================
-- SEED DATA
-- =====================================================

-- Default Reddit source
INSERT OR IGNORE INTO beacon_sources (id, name, type, config_json, enabled, fetch_frequency_minutes)
VALUES (
  'src_reddit_toastpos',
  'Reddit r/ToastPOS',
  'reddit',
  '{"subreddit": "ToastPOS", "sort": "new", "limit": 25, "filter_keywords": ["help", "issue", "problem", "question", "how"]}',
  1,
  30
);

-- Default categories
INSERT OR IGNORE INTO beacon_categories (id, name, slug, description, icon, color, sort_order)
VALUES
  ('cat_menu', 'Menu & Items', 'menu', 'Menu setup, items, modifiers, pricing', '🍽️', '#10B981', 1),
  ('cat_hardware', 'Hardware & Devices', 'hardware', 'Terminals, KDS, printers, networking', '🖥️', '#3B82F6', 2),
  ('cat_integrations', 'Integrations', 'integrations', 'Third-party integrations and APIs', '🔗', '#8B5CF6', 3),
  ('cat_reports', 'Reports & Analytics', 'reports', 'Reporting, analytics, data export', '📊', '#F59E0B', 4),
  ('cat_labor', 'Labor & Scheduling', 'labor', 'Employee management, scheduling, payroll', '👥', '#EF4444', 5),
  ('cat_training', 'Training & Onboarding', 'training', 'Staff training, best practices', '📚', '#06B6D4', 6),
  ('cat_general', 'General', 'general', 'General Toast questions and topics', '💡', '#6B7280', 7);

-- Default templates
INSERT OR IGNORE INTO beacon_templates (id, name, type, description, is_default)
VALUES
  ('tpl_solution', 'Solution Article', 'solution', 'Problem/solution format for common issues', 1),
  ('tpl_guide', 'How-To Guide', 'guide', 'Step-by-step guide format', 1),
  ('tpl_faq', 'FAQ Entry', 'faq', 'Question and answer format', 1),
  ('tpl_blog', 'Blog Post', 'blog', 'Standard blog post format', 1),
  ('tpl_sop', 'Standard Operating Procedure', 'sop', 'Formal SOP document format', 1),
  ('tpl_checklist', 'Checklist', 'checklist', 'Actionable checklist format', 1);
