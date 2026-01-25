-- Toast Hub FAQs + Search/Analytics infrastructure
-- Migration 0075

-- FAQ Management Table
CREATE TABLE IF NOT EXISTS toast_hub_faqs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  view_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_faqs_active ON toast_hub_faqs(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_faqs_category ON toast_hub_faqs(category);

-- Page View Analytics
CREATE TABLE IF NOT EXISTS toast_hub_page_views (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  visitor_hash TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  time_on_page INTEGER,
  scroll_depth INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_pageviews_post ON toast_hub_page_views(post_id);
CREATE INDEX IF NOT EXISTS idx_pageviews_time ON toast_hub_page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_pageviews_visitor ON toast_hub_page_views(visitor_hash);

-- Content Revisions for version history
CREATE TABLE IF NOT EXISTS toast_hub_revisions (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  title TEXT,
  content TEXT,
  content_format TEXT,
  changed_by TEXT,
  change_summary TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_revisions_post ON toast_hub_revisions(post_id, version DESC);

-- Seed default FAQs (from current hardcoded data)
INSERT OR IGNORE INTO toast_hub_faqs (id, question, answer, category, display_order, is_active) VALUES
  ('faq_001', 'What is Toast POS and why should I consider it for my restaurant?', 'Toast POS is a cloud-based restaurant point-of-sale system built specifically for the food service industry. It offers integrated payment processing, online ordering, kitchen display systems, and robust reporting. Unlike generic POS systems, Toast understands restaurant workflows like coursing, modifiers, and table management.', 'general', 1, 1),
  ('faq_002', 'How long does it take to implement Toast POS?', 'A typical Toast POS implementation takes 1-3 weeks from contract signing to go-live. This includes hardware setup, menu configuration, staff training, and integration with your existing systems. Complex multi-location setups may take longer.', 'implementation', 2, 1),
  ('faq_003', 'Can I migrate my existing menu to Toast?', 'Yes, your existing menu can be migrated to Toast. The process involves exporting your current menu data, reformatting it for Toast''s structure, and uploading it to the system. Our menu builder tool can help with this process, handling complex modifier groups and pricing rules.', 'implementation', 3, 1),
  ('faq_004', 'What support options are available for Toast POS users?', 'Toast offers 24/7 phone and email support. Additionally, certified Toast consultants like R&G Consulting provide hands-on implementation support, custom menu configuration, and ongoing maintenance through Restaurant Guardian support plans starting at $350/month.', 'support', 4, 1);
