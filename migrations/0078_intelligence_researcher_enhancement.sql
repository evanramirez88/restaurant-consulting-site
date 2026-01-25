-- Migration 0078: Intelligence Researcher Enhancement
-- Additional seed data and indexes for the Intelligence Researcher feature

-- Additional feed sources (only insert if not exists)
INSERT OR IGNORE INTO intel_feed_sources (id, name, source_type, url, category, territory, poll_interval_minutes) VALUES
  ('feed_toast_pos_reddit', 'Reddit r/ToastPOS', 'reddit', 'https://www.reddit.com/r/ToastPOS.json', 'community', 'national', 120),
  ('feed_restaurant_biz', 'Restaurant Business Magazine', 'rss', 'https://www.restaurantbusinessonline.com/rss.xml', 'industry_news', 'national', 360),
  ('feed_nrn', 'Nations Restaurant News', 'rss', 'https://www.nrn.com/rss.xml', 'industry_news', 'national', 360),
  ('feed_modern_rest', 'Modern Restaurant Management', 'rss', 'https://modernrestaurantmanagement.com/feed/', 'industry_news', 'national', 360);

-- Add index for faster lookups on feed items by URL (for deduplication)
CREATE INDEX IF NOT EXISTS idx_feed_items_url ON intel_feed_items(url);

-- Add index for faster source polling queries
CREATE INDEX IF NOT EXISTS idx_feed_sources_poll ON intel_feed_sources(is_active, last_polled_at);

-- Add index for finding lookups by source
CREATE INDEX IF NOT EXISTS idx_findings_source ON agent_findings(source_type, source_url);
