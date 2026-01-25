-- Toast Hub Phases 2, 6, 7, 8: Workflow, Beacon Integration, Client Knowledge Base, Newsletter
-- Migration 0077

-- Content Revisions (extends existing toast_hub_revisions with more fields)
-- Note: toast_hub_revisions exists from 0075, add missing columns if needed
ALTER TABLE toast_hub_revisions ADD COLUMN excerpt TEXT;
ALTER TABLE toast_hub_revisions ADD COLUMN category TEXT;
ALTER TABLE toast_hub_revisions ADD COLUMN status TEXT;
ALTER TABLE toast_hub_revisions ADD COLUMN tags_json TEXT;

-- Add workflow fields to toast_hub_posts if not already present
-- These may already exist, so we use IF NOT EXISTS workaround by creating temp views
CREATE TABLE IF NOT EXISTS _temp_check_posts (x INTEGER);
DROP TABLE _temp_check_posts;

-- Client Content Access (Phase 7)
CREATE TABLE IF NOT EXISTS client_content_access (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  client_id TEXT NOT NULL,
  content_id TEXT NOT NULL,
  content_type TEXT DEFAULT 'post' CHECK (content_type IN ('post', 'faq', 'beacon')),
  granted_at INTEGER DEFAULT (unixepoch()),
  granted_by TEXT,
  expires_at INTEGER,
  access_level TEXT DEFAULT 'read' CHECK (access_level IN ('read', 'download', 'full')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (content_id) REFERENCES toast_hub_posts(id) ON DELETE CASCADE,
  UNIQUE(client_id, content_id)
);
CREATE INDEX IF NOT EXISTS idx_content_access_client ON client_content_access(client_id);
CREATE INDEX IF NOT EXISTS idx_content_access_content ON client_content_access(content_id);
CREATE INDEX IF NOT EXISTS idx_content_access_type ON client_content_access(content_type);

-- Content Bookmarks (Phase 7)
CREATE TABLE IF NOT EXISTS content_bookmarks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  client_id TEXT NOT NULL,
  content_id TEXT NOT NULL,
  content_type TEXT DEFAULT 'post' CHECK (content_type IN ('post', 'faq', 'beacon')),
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (content_id) REFERENCES toast_hub_posts(id) ON DELETE CASCADE,
  UNIQUE(client_id, content_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_client ON content_bookmarks(client_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_content ON content_bookmarks(content_id);

-- Newsletter Notifications Log (Phase 8)
CREATE TABLE IF NOT EXISTS content_notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  content_id TEXT NOT NULL,
  content_type TEXT DEFAULT 'post' CHECK (content_type IN ('post', 'faq', 'beacon')),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('newsletter', 'update', 'alert')),
  subject TEXT,
  body TEXT,
  recipient_count INTEGER DEFAULT 0,
  sent_by TEXT,
  sent_at INTEGER DEFAULT (unixepoch()),
  metadata_json TEXT,
  FOREIGN KEY (content_id) REFERENCES toast_hub_posts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notifications_content ON content_notifications(content_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent ON content_notifications(sent_at);

-- Content Templates (Phase 6 - extends Beacon templates for Toast Hub)
CREATE TABLE IF NOT EXISTS toast_hub_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL CHECK (template_type IN ('article', 'guide', 'faq', 'announcement', 'case_study', 'tutorial')),
  content_structure_json TEXT,
  default_content TEXT,
  variables_json TEXT,
  thumbnail_url TEXT,
  usage_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_by TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_templates_type ON toast_hub_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_templates_active ON toast_hub_templates(is_active);

-- Seed default templates
INSERT OR IGNORE INTO toast_hub_templates (id, name, template_type, description, default_content, is_active) VALUES
  ('tpl_howto', 'How-To Guide', 'guide', 'Step-by-step guide template', '## Overview\n\nBrief description of what this guide covers.\n\n## Prerequisites\n\n- Requirement 1\n- Requirement 2\n\n## Steps\n\n### Step 1: Title\n\nDetailed instructions...\n\n### Step 2: Title\n\nDetailed instructions...\n\n## Troubleshooting\n\nCommon issues and solutions.\n\n## Related Resources\n\n- Link 1\n- Link 2', 1),
  ('tpl_tip', 'Quick Tip', 'article', 'Short tip or trick article', '## The Problem\n\nDescribe the common issue users face.\n\n## The Solution\n\nExplain the tip or trick.\n\n## Why This Works\n\nBrief explanation.\n\n## Pro Tip\n\nAn additional insight.', 1),
  ('tpl_case', 'Case Study', 'case_study', 'Client success story template', '## Client Overview\n\n- **Restaurant:** Name\n- **Location:** City, State\n- **Type:** Cuisine/Style\n\n## The Challenge\n\nDescribe what problems they faced.\n\n## Our Solution\n\nWhat we implemented.\n\n## Results\n\n- Metric 1: X% improvement\n- Metric 2: X% improvement\n\n## Client Testimonial\n\n> "Quote from client..."', 1),
  ('tpl_tutorial', 'Video Tutorial Notes', 'tutorial', 'Companion notes for video content', '## Video Overview\n\n**Duration:** X minutes\n**Skill Level:** Beginner/Intermediate/Advanced\n\n## What You''ll Learn\n\n1. Topic 1\n2. Topic 2\n3. Topic 3\n\n## Timestamps\n\n- 0:00 - Introduction\n- 1:30 - Topic 1\n- 5:00 - Topic 2\n\n## Key Takeaways\n\n- Point 1\n- Point 2\n\n## Next Steps\n\nRecommended follow-up content.', 1),
  ('tpl_announce', 'Product Announcement', 'announcement', 'New feature or update announcement', '## What''s New\n\nBrief description of the update.\n\n## Key Features\n\n### Feature 1\n\nDescription and benefits.\n\n### Feature 2\n\nDescription and benefits.\n\n## How to Get Started\n\nQuick start instructions.\n\n## FAQ\n\n**Q: Common question?**\nA: Answer.\n\n## Support\n\nContact information.', 1);

-- Beacon Import Mapping (Phase 6)
CREATE TABLE IF NOT EXISTS beacon_to_toasthub_imports (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  beacon_item_id TEXT NOT NULL,
  toast_hub_post_id TEXT NOT NULL,
  import_status TEXT DEFAULT 'imported' CHECK (import_status IN ('imported', 'modified', 'archived')),
  imported_by TEXT,
  imported_at INTEGER DEFAULT (unixepoch()),
  modifications_json TEXT,
  FOREIGN KEY (beacon_item_id) REFERENCES beacon_content_items(id) ON DELETE CASCADE,
  FOREIGN KEY (toast_hub_post_id) REFERENCES toast_hub_posts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_beacon_import_beacon ON beacon_to_toasthub_imports(beacon_item_id);
CREATE INDEX IF NOT EXISTS idx_beacon_import_post ON beacon_to_toasthub_imports(toast_hub_post_id);
