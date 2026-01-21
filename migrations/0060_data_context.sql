
-- Migration: 0060_data_context.sql
-- Description: Schema for syncing external data context (SMS, Calls, LimitlessAI)

-- 1. Synced Contacts (Bridge between external context and CRM)
CREATE TABLE IF NOT EXISTS synced_contacts (
  id TEXT PRIMARY KEY,               -- UUID or phone/email has
  external_id TEXT,                  -- HubSpot ID, Google ID, etc.
  name TEXT,
  phone TEXT,                        -- Normalized E.164
  email TEXT,
  company TEXT,
  source TEXT NOT NULL,              -- 'hubspot', 'google', 'device'
  last_interaction_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_synced_contacts_phone ON synced_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_synced_contacts_email ON synced_contacts(email);

-- 2. Synced Communications (SMS, Calls, Emails)
CREATE TABLE IF NOT EXISTS synced_communications (
  id TEXT PRIMARY KEY,
  contact_id TEXT,                   -- References synced_contacts(id)
  type TEXT NOT NULL,                -- 'sms', 'call', 'email', 'meeting'
  direction TEXT CHECK(direction IN ('inbound', 'outbound', 'unknown')),
  summary TEXT,                      -- AI summary of the interaction
  content_snippet TEXT,              -- First 500 chars or important subset
  occurred_at INTEGER NOT NULL,      -- UTC timestamp of event
  source_id TEXT,                    -- Original ID in source system (msg id)
  meta_json JSON,                    -- Extra data (duration, subject, etc)
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_synced_comms_contact ON synced_communications(contact_id);
CREATE INDEX IF NOT EXISTS idx_synced_comms_date ON synced_communications(occurred_at);

-- 3. Context Items (General knowledge, transcripts, facts)
CREATE TABLE IF NOT EXISTS context_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                -- 'transcript', 'document', 'fact', 'location'
  content TEXT NOT NULL,             -- Full text content
  summary TEXT,                      -- Short summary
  source TEXT,                       -- 'limitless', 'notion', 'file'
  embedding_json JSON,               -- Vector embedding (if we do simple cos sim in SQL or pass to external)
  relevance_score REAL,              -- Dynamic score update
  created_at INTEGER DEFAULT (unixepoch()),
  tags TEXT                          -- Comma separated tags
);

CREATE INDEX IF NOT EXISTS idx_context_items_type ON context_items(type);

-- 4. Ingestion Log (Audit trail for sync api)
CREATE TABLE IF NOT EXISTS context_ingestion_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT,
  source TEXT,
  items_processed INTEGER,
  status TEXT,
  error_message TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);
