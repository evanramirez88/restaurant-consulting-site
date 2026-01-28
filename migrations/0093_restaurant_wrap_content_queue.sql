-- Restaurant Wrap Content Queue - SEO Pipeline Storage
-- Migration 0093
-- Implements: Content queue for aggregated and transformed content awaiting review

-- ============================================
-- CONTENT QUEUE TABLE
-- Stores transformed SEO briefs for human review
-- ============================================
CREATE TABLE IF NOT EXISTS content_queue (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  
  -- Source Content Reference
  source_content_title TEXT NOT NULL,
  source_content_url TEXT NOT NULL,
  source_content_source TEXT NOT NULL, -- e.g., "Nation's Restaurant News", "r/ToastPOS"
  source_content_excerpt TEXT,
  source_external_id TEXT, -- External reference for deduplication
  
  -- SEO Optimization Fields
  seo_primary_keyword TEXT NOT NULL,
  seo_secondary_keywords_json TEXT, -- JSON array of strings
  seo_long_tail_keywords_json TEXT, -- JSON array of strings
  seo_meta_title TEXT,
  seo_meta_description TEXT,
  seo_suggested_slug TEXT,
  seo_target_word_count_min INTEGER DEFAULT 1200,
  seo_target_word_count_max INTEGER DEFAULT 2000,
  seo_search_intent TEXT CHECK (seo_search_intent IN ('informational', 'commercial', 'transactional', 'navigational')),
  
  -- Content Structure
  structure_headline TEXT,
  structure_subheadlines_json TEXT, -- JSON array
  structure_sections_json TEXT, -- JSON array
  structure_cta_placement_json TEXT, -- JSON array
  structure_internal_links_json TEXT, -- JSON array of {anchor, targetPage}
  
  -- AI Summary
  summary_key_points_json TEXT, -- JSON array of strings
  summary_expert_angle TEXT,
  summary_unique_value TEXT,
  summary_target_audience TEXT,
  
  -- Publishing Metadata
  publishing_category TEXT,
  publishing_tags_json TEXT, -- JSON array
  publishing_priority TEXT CHECK (publishing_priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  publishing_estimated_effort TEXT CHECK (publishing_estimated_effort IN ('quick', 'standard', 'deep-dive')) DEFAULT 'standard',
  publishing_timeliness TEXT CHECK (publishing_timeliness IN ('evergreen', 'trending', 'time-sensitive')) DEFAULT 'evergreen',
  
  -- Scoring
  score_seo_opportunity INTEGER DEFAULT 50,
  score_content_gap INTEGER DEFAULT 50,
  score_competitive_difficulty INTEGER DEFAULT 50,
  score_overall_priority INTEGER DEFAULT 50,
  
  -- Workflow Status
  status TEXT CHECK (status IN ('pending', 'in_review', 'writing', 'editing', 'approved', 'published', 'rejected', 'archived')) DEFAULT 'pending',
  assigned_to TEXT, -- Admin user ID
  review_notes TEXT,
  rejection_reason TEXT,
  
  -- Published Post Link
  published_post_id TEXT, -- Reference to toast_hub_posts if published
  published_at INTEGER,
  
  -- Audit
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  created_by TEXT,
  updated_by TEXT,
  
  FOREIGN KEY (published_post_id) REFERENCES toast_hub_posts(id) ON DELETE SET NULL
);

-- Indexes for content queue
CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(status);
CREATE INDEX IF NOT EXISTS idx_content_queue_priority ON content_queue(publishing_priority, score_overall_priority DESC);
CREATE INDEX IF NOT EXISTS idx_content_queue_category ON content_queue(publishing_category);
CREATE INDEX IF NOT EXISTS idx_content_queue_assigned ON content_queue(assigned_to);
CREATE INDEX IF NOT EXISTS idx_content_queue_created ON content_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_queue_source ON content_queue(source_content_source);
CREATE INDEX IF NOT EXISTS idx_content_queue_external ON content_queue(source_external_id);
CREATE INDEX IF NOT EXISTS idx_content_queue_keyword ON content_queue(seo_primary_keyword);

-- ============================================
-- AGGREGATION SOURCES (Extended for Restaurant Wrap)
-- Adds more detailed source configuration
-- ============================================
CREATE TABLE IF NOT EXISTS restaurant_wrap_sources (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name TEXT NOT NULL,
  source_type TEXT CHECK (source_type IN ('rss', 'reddit', 'scrape', 'trends', 'api', 'manual')),
  url TEXT,
  category TEXT, -- toast_official, industry_news, competitors, community, trends
  relevance_weight INTEGER DEFAULT 5, -- 1-10, how relevant to consulting business
  fetch_frequency_minutes INTEGER DEFAULT 120,
  last_fetched_at INTEGER,
  last_error TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  items_fetched_total INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  config_json TEXT, -- Additional configuration (headers, auth, etc.)
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_wrap_sources_type ON restaurant_wrap_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_wrap_sources_active ON restaurant_wrap_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_wrap_sources_category ON restaurant_wrap_sources(category);

-- ============================================
-- AGGREGATION RUN LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS restaurant_wrap_runs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  run_started_at INTEGER NOT NULL,
  run_completed_at INTEGER,
  sources_processed INTEGER DEFAULT 0,
  items_fetched INTEGER DEFAULT 0,
  items_scored INTEGER DEFAULT 0,
  items_filtered INTEGER DEFAULT 0, -- Filtered due to low relevance
  items_queued INTEGER DEFAULT 0, -- Added to content_queue
  items_duplicated INTEGER DEFAULT 0,
  errors_json TEXT,
  run_config_json TEXT, -- What settings were used
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  triggered_by TEXT, -- 'cron', 'manual', 'api'
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_wrap_runs_status ON restaurant_wrap_runs(status);
CREATE INDEX IF NOT EXISTS idx_wrap_runs_started ON restaurant_wrap_runs(run_started_at DESC);

-- ============================================
-- KEYWORD TRACKING
-- Track which keywords are being targeted
-- ============================================
CREATE TABLE IF NOT EXISTS content_keywords (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  keyword TEXT NOT NULL UNIQUE,
  keyword_type TEXT CHECK (keyword_type IN ('primary', 'secondary', 'long_tail')),
  search_volume TEXT CHECK (search_volume IN ('low', 'medium', 'high')),
  difficulty TEXT CHECK (difficulty IN ('low', 'medium', 'high')),
  search_intent TEXT CHECK (search_intent IN ('informational', 'commercial', 'transactional', 'navigational')),
  topic_cluster TEXT, -- e.g., 'Toast Setup', 'Online Ordering', 'POS Comparison'
  posts_targeting INTEGER DEFAULT 0, -- How many posts target this keyword
  last_ranked_position INTEGER, -- SERP position if tracked
  last_checked_at INTEGER,
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_keywords_type ON content_keywords(keyword_type);
CREATE INDEX IF NOT EXISTS idx_keywords_cluster ON content_keywords(topic_cluster);
CREATE INDEX IF NOT EXISTS idx_keywords_active ON content_keywords(is_active);

-- ============================================
-- CONTENT PERFORMANCE TRACKING
-- Track how published content performs
-- ============================================
CREATE TABLE IF NOT EXISTS content_performance (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  post_id TEXT NOT NULL,
  queue_item_id TEXT, -- Original content_queue entry if exists
  
  -- Traffic Metrics
  pageviews_total INTEGER DEFAULT 0,
  pageviews_30d INTEGER DEFAULT 0,
  unique_visitors_30d INTEGER DEFAULT 0,
  avg_time_on_page INTEGER, -- seconds
  bounce_rate REAL,
  
  -- Engagement
  scroll_depth_avg REAL,
  cta_clicks INTEGER DEFAULT 0,
  form_submissions INTEGER DEFAULT 0,
  
  -- SEO Performance
  organic_traffic_30d INTEGER DEFAULT 0,
  keywords_ranking INTEGER DEFAULT 0, -- Number of keywords ranking
  avg_position REAL, -- Average SERP position
  impressions_30d INTEGER DEFAULT 0,
  clicks_30d INTEGER DEFAULT 0,
  ctr REAL,
  
  -- Social
  shares_total INTEGER DEFAULT 0,
  backlinks INTEGER DEFAULT 0,
  
  last_updated_at INTEGER DEFAULT (unixepoch()),
  created_at INTEGER DEFAULT (unixepoch()),
  
  FOREIGN KEY (post_id) REFERENCES toast_hub_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (queue_item_id) REFERENCES content_queue(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_performance_post ON content_performance(post_id);
CREATE INDEX IF NOT EXISTS idx_performance_updated ON content_performance(last_updated_at DESC);

-- ============================================
-- SEED RESTAURANT WRAP SOURCES
-- ============================================
INSERT OR IGNORE INTO restaurant_wrap_sources (id, name, source_type, url, category, relevance_weight, is_active) VALUES
  -- Toast Official
  ('wrap_toast_blog', 'Toast Official Blog', 'rss', 'https://pos.toasttab.com/blog/rss.xml', 'toast_official', 10, 1),
  ('wrap_toast_resources', 'Toast Resources', 'scrape', 'https://pos.toasttab.com/resources', 'toast_official', 10, 1),
  
  -- Industry News
  ('wrap_nrn', 'Nation''s Restaurant News', 'rss', 'https://www.nrn.com/rss.xml', 'industry_news', 8, 1),
  ('wrap_mrm', 'Modern Restaurant Management', 'rss', 'https://modernrestaurantmanagement.com/feed/', 'industry_news', 8, 1),
  ('wrap_rbo', 'Restaurant Business Online', 'rss', 'https://www.restaurantbusinessonline.com/rss.xml', 'industry_news', 7, 1),
  ('wrap_qsr', 'QSR Magazine', 'rss', 'https://www.qsrmagazine.com/rss.xml', 'industry_news', 7, 1),
  
  -- Competitors
  ('wrap_clover', 'Clover Blog', 'scrape', 'https://www.clover.com/blog', 'competitors', 9, 1),
  ('wrap_square', 'Square Restaurant Blog', 'scrape', 'https://squareup.com/us/en/townsquare/restaurants', 'competitors', 9, 1),
  ('wrap_lightspeed', 'Lightspeed Restaurant Blog', 'scrape', 'https://www.lightspeedhq.com/blog/restaurant/', 'competitors', 8, 1),
  
  -- Community
  ('wrap_reddit_toast', 'r/ToastPOS', 'reddit', 'https://www.reddit.com/r/ToastPOS/.json', 'community', 10, 1),
  ('wrap_reddit_rest', 'r/restaurateur', 'reddit', 'https://www.reddit.com/r/restaurateur/.json', 'community', 8, 1),
  ('wrap_reddit_kitchen', 'r/KitchenConfidential', 'reddit', 'https://www.reddit.com/r/KitchenConfidential/.json', 'community', 5, 1);

-- ============================================
-- SEED PRIMARY KEYWORDS
-- ============================================
INSERT OR IGNORE INTO content_keywords (id, keyword, keyword_type, search_volume, difficulty, search_intent, topic_cluster) VALUES
  ('kw_001', 'toast pos consultant', 'primary', 'low', 'low', 'commercial', 'Toast Setup'),
  ('kw_002', 'toast pos setup', 'primary', 'medium', 'medium', 'informational', 'Toast Setup'),
  ('kw_003', 'toast pos training', 'primary', 'medium', 'low', 'commercial', 'Toast Training'),
  ('kw_004', 'restaurant pos system', 'primary', 'high', 'high', 'commercial', 'POS Comparison'),
  ('kw_005', 'toast pos vs clover', 'primary', 'medium', 'medium', 'commercial', 'POS Comparison'),
  ('kw_006', 'toast pos vs square', 'primary', 'medium', 'medium', 'commercial', 'POS Comparison'),
  ('kw_007', 'toast online ordering', 'primary', 'medium', 'medium', 'informational', 'Online Ordering'),
  ('kw_008', 'toast kitchen display', 'primary', 'low', 'low', 'informational', 'Kitchen Operations'),
  ('kw_009', 'restaurant technology consulting', 'primary', 'low', 'low', 'commercial', 'Toast Setup'),
  ('kw_010', 'toast pos integration', 'primary', 'low', 'low', 'informational', 'Toast Setup'),
  
  -- Long-tail keywords
  ('kw_lt_001', 'how to set up toast pos for new restaurant', 'long_tail', 'low', 'low', 'informational', 'Toast Setup'),
  ('kw_lt_002', 'toast doordash integration setup guide', 'long_tail', 'low', 'low', 'informational', 'Online Ordering'),
  ('kw_lt_003', 'switching from square to toast pos', 'long_tail', 'low', 'low', 'commercial', 'POS Comparison'),
  ('kw_lt_004', 'toast kitchen display system troubleshooting', 'long_tail', 'low', 'low', 'informational', 'Kitchen Operations'),
  ('kw_lt_005', 'cape cod restaurant pos consultant', 'long_tail', 'low', 'low', 'commercial', 'Toast Setup');
