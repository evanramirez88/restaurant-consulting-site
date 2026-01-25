-- Migration 0074: Intelligence Researcher Findings Pipeline
-- Agent findings, feed sources, territory intel, enrichment queue

-- 1. Agent Findings - discoveries from intelligence agents
CREATE TABLE IF NOT EXISTS agent_findings (
  id TEXT PRIMARY KEY,
  agent_type TEXT NOT NULL CHECK (agent_type IN (
    'web_scraper', 'social_monitor', 'review_analyzer',
    'market_researcher', 'competitor_tracker', 'lead_enricher',
    'territory_scout', 'news_monitor'
  )),
  finding_type TEXT NOT NULL CHECK (finding_type IN (
    'lead_opportunity', 'competitor_move', 'market_trend',
    'client_risk', 'upsell_signal', 'review_alert',
    'news_mention', 'technology_change', 'pricing_intel',
    'expansion_opportunity', 'partnership_lead'
  )),
  title TEXT NOT NULL,
  summary TEXT,
  details_json TEXT,
  confidence_score INTEGER DEFAULT 50 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'actionable', 'acted_on', 'dismissed')),

  -- Related entities
  client_id TEXT,
  lead_id TEXT,
  territory TEXT,

  -- Source tracking
  source_url TEXT,
  source_type TEXT,
  raw_data_json TEXT,

  -- Action tracking
  action_taken TEXT,
  action_by TEXT,
  action_at INTEGER,

  -- Metadata
  tags_json TEXT,
  expires_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_findings_status ON agent_findings(status, priority);
CREATE INDEX IF NOT EXISTS idx_findings_type ON agent_findings(finding_type);
CREATE INDEX IF NOT EXISTS idx_findings_client ON agent_findings(client_id);
CREATE INDEX IF NOT EXISTS idx_findings_territory ON agent_findings(territory);
CREATE INDEX IF NOT EXISTS idx_findings_created ON agent_findings(created_at DESC);

-- 2. Intel Feed Sources - RSS, Reddit, Google Alerts, etc.
CREATE TABLE IF NOT EXISTS intel_feed_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'rss', 'reddit', 'google_alerts', 'twitter',
    'yelp', 'google_reviews', 'news_api', 'custom_scraper'
  )),
  url TEXT NOT NULL,
  config_json TEXT,
  category TEXT,
  territory TEXT,
  is_active INTEGER DEFAULT 1,
  poll_interval_minutes INTEGER DEFAULT 60,
  last_polled_at INTEGER,
  last_item_at INTEGER,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_feed_sources_active ON intel_feed_sources(is_active, source_type);

-- 3. Intel Feed Items - raw items from sources
CREATE TABLE IF NOT EXISTS intel_feed_items (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  external_id TEXT,
  title TEXT NOT NULL,
  content TEXT,
  url TEXT,
  author TEXT,
  published_at INTEGER,
  fetched_at INTEGER DEFAULT (unixepoch()),

  -- AI triage
  relevance_score INTEGER DEFAULT 0 CHECK (relevance_score >= 0 AND relevance_score <= 100),
  triage_status TEXT DEFAULT 'pending' CHECK (triage_status IN ('pending', 'relevant', 'irrelevant', 'needs_review')),
  triage_reason TEXT,
  extracted_entities_json TEXT,

  -- Disposition
  converted_to_finding INTEGER DEFAULT 0,
  finding_id TEXT,

  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_feed_items_source ON intel_feed_items(source_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_items_triage ON intel_feed_items(triage_status);
CREATE INDEX IF NOT EXISTS idx_feed_items_relevance ON intel_feed_items(relevance_score DESC);

-- 4. Territory Intelligence
CREATE TABLE IF NOT EXISTS territory_intel (
  id TEXT PRIMARY KEY,
  territory TEXT NOT NULL,
  intel_type TEXT NOT NULL CHECK (intel_type IN (
    'market_size', 'competition_density', 'growth_rate',
    'avg_ticket_value', 'tech_adoption', 'seasonal_pattern',
    'demographic', 'regulation', 'opportunity_score'
  )),
  title TEXT NOT NULL,
  value TEXT,
  value_numeric REAL,
  trend TEXT CHECK (trend IN ('up', 'down', 'stable', 'emerging')),
  confidence INTEGER DEFAULT 50,
  source TEXT,
  notes TEXT,
  valid_until INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_territory_intel ON territory_intel(territory, intel_type);

-- 5. Enrichment Queue - items to be enriched by agents
CREATE TABLE IF NOT EXISTS enrichment_queue (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'client', 'prospect', 'competitor')),
  entity_id TEXT NOT NULL,
  enrichment_type TEXT NOT NULL CHECK (enrichment_type IN (
    'contact_info', 'social_profiles', 'tech_stack',
    'revenue_estimate', 'reviews', 'competitors',
    'decision_makers', 'recent_news', 'website_analysis'
  )),
  priority INTEGER DEFAULT 5,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'skipped')),
  result_json TEXT,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  queued_at INTEGER DEFAULT (unixepoch()),
  started_at INTEGER,
  completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue ON enrichment_queue(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_entity ON enrichment_queue(entity_type, entity_id);

-- 6. Competitor Tracking
CREATE TABLE IF NOT EXISTS competitor_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company_type TEXT CHECK (company_type IN ('pos_vendor', 'consultant', 'integrator', 'service_provider')),
  website TEXT,
  territory TEXT,
  strengths_json TEXT,
  weaknesses_json TEXT,
  pricing_json TEXT,
  target_market TEXT,
  market_share_estimate REAL,
  threat_level TEXT DEFAULT 'medium' CHECK (threat_level IN ('low', 'medium', 'high', 'critical')),
  last_activity TEXT,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_competitor_territory ON competitor_profiles(territory);

-- 7. Seed default feed sources for restaurant industry
INSERT OR IGNORE INTO intel_feed_sources (id, name, source_type, url, category, territory, poll_interval_minutes) VALUES
  ('feed_nra', 'National Restaurant Association', 'rss', 'https://restaurant.org/research-and-media/media/press-releases/feed/', 'industry_news', 'national', 360),
  ('feed_fsm', 'Food Service Magazine', 'rss', 'https://www.food-management.com/rss.xml', 'industry_news', 'national', 360),
  ('feed_reddit_restaurant', 'Reddit r/restaurant', 'reddit', 'https://www.reddit.com/r/restaurateur/.rss', 'community', 'national', 120),
  ('feed_reddit_pos', 'Reddit r/POS', 'reddit', 'https://www.reddit.com/r/pos/.rss', 'technology', 'national', 120),
  ('feed_toast_blog', 'Toast Blog', 'rss', 'https://pos.toasttab.com/blog/rss.xml', 'competitor', 'national', 720);
