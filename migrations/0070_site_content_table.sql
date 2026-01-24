-- Migration 0070: Site Content Table
-- Provides editable site content storage for the admin portal CMS

CREATE TABLE IF NOT EXISTS site_content (
  id TEXT PRIMARY KEY,
  page TEXT NOT NULL,
  section TEXT NOT NULL,
  content_key TEXT NOT NULL,
  content_value TEXT,
  content_type TEXT DEFAULT 'text' CHECK(content_type IN ('text','html','markdown','json')),
  is_editable INTEGER DEFAULT 1,
  updated_by TEXT,
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(page, section, content_key)
);

CREATE INDEX IF NOT EXISTS idx_content_page ON site_content(page);
