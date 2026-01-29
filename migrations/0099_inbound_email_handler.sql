-- =====================================================
-- Migration: 0099_inbound_email_handler.sql
-- Purpose: Add tables for inbound email processing
-- Handles: Email storage, classification, menu processing queue, tasks
-- =====================================================

-- =====================================================
-- 1. INBOUND EMAILS TABLE
-- Stores all incoming emails with AI classification
-- =====================================================

CREATE TABLE IF NOT EXISTS inbound_emails (
  id TEXT PRIMARY KEY,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  cc_email TEXT,
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  headers_json TEXT,

  -- AI Classification
  classification TEXT NOT NULL DEFAULT 'general_inquiry',
  confidence REAL DEFAULT 0.5,
  sentiment TEXT DEFAULT 'neutral',
  summary TEXT,

  -- Reply tracking
  is_reply INTEGER DEFAULT 0,
  original_email_id TEXT,

  -- Link to existing records
  subscriber_id TEXT,
  lead_id TEXT,

  -- Attachments
  has_attachments INTEGER DEFAULT 0,
  attachment_count INTEGER DEFAULT 0,
  attachments_json TEXT,

  -- Processing status
  status TEXT DEFAULT 'received',
  processed_at INTEGER,
  error_message TEXT,

  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_inbound_emails_from ON inbound_emails(from_email);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_classification ON inbound_emails(classification);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_created ON inbound_emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_status ON inbound_emails(status);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_subscriber ON inbound_emails(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_lead ON inbound_emails(lead_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_is_reply ON inbound_emails(is_reply);

-- =====================================================
-- 2. MENU PROCESSING QUEUE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS menu_processing_queue (
  id TEXT PRIMARY KEY,
  inbound_email_id TEXT,
  from_email TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT,
  file_size INTEGER,
  status TEXT DEFAULT 'pending',
  processed_at INTEGER,
  error_message TEXT,
  ocr_text TEXT,
  extracted_menu_json TEXT,
  menu_type TEXT,
  item_count INTEGER,
  restaurant_id TEXT,
  lead_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_menu_queue_status ON menu_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_menu_queue_created ON menu_processing_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_menu_queue_email ON menu_processing_queue(from_email);

-- =====================================================
-- 3. TASKS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  assigned_to TEXT,
  related_id TEXT,
  related_type TEXT,
  due_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_related ON tasks(related_id, related_type);

-- =====================================================
-- 4. VIEWS FOR INBOUND EMAIL ANALYTICS
-- =====================================================

DROP VIEW IF EXISTS v_inbound_email_summary;
CREATE VIEW v_inbound_email_summary AS
SELECT
  classification,
  COUNT(*) as total_count,
  COUNT(CASE WHEN created_at > strftime('%s', 'now') - 86400 THEN 1 END) as last_24h,
  COUNT(CASE WHEN created_at > strftime('%s', 'now') - 604800 THEN 1 END) as last_7d,
  AVG(confidence) as avg_confidence
FROM inbound_emails
GROUP BY classification
ORDER BY total_count DESC;

DROP VIEW IF EXISTS v_positive_leads;
CREATE VIEW v_positive_leads AS
SELECT
  ie.id as inbound_email_id,
  ie.from_email,
  ie.from_name,
  ie.subject,
  ie.summary,
  ie.confidence,
  ie.created_at,
  datetime(ie.created_at, 'unixepoch') as received_at,
  rl.id as lead_id,
  rl.restaurant_name,
  rl.status as lead_status,
  rl.score as lead_score
FROM inbound_emails ie
LEFT JOIN restaurant_leads rl ON ie.lead_id = rl.id OR ie.from_email = rl.contact_email
WHERE ie.classification = 'positive_response'
ORDER BY ie.created_at DESC;

DROP VIEW IF EXISTS v_pending_tasks;
CREATE VIEW v_pending_tasks AS
SELECT
  t.id,
  t.type,
  t.title,
  t.description,
  t.priority,
  t.status,
  t.due_at,
  datetime(t.due_at, 'unixepoch') as due_at_readable,
  t.created_at,
  datetime(t.created_at, 'unixepoch') as created_at_readable,
  t.related_type,
  t.related_id,
  CASE
    WHEN t.due_at IS NOT NULL AND t.due_at < strftime('%s', 'now') THEN 'overdue'
    WHEN t.due_at IS NOT NULL AND t.due_at < strftime('%s', 'now') + 86400 THEN 'due_soon'
    ELSE 'on_track'
  END as urgency
FROM tasks t
WHERE t.status IN ('open', 'in_progress')
ORDER BY
  CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
  t.due_at ASC NULLS LAST,
  t.created_at ASC;

DROP VIEW IF EXISTS v_menu_queue_status;
CREATE VIEW v_menu_queue_status AS
SELECT
  status,
  COUNT(*) as count,
  GROUP_CONCAT(filename, ', ') as filenames
FROM menu_processing_queue
GROUP BY status;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
