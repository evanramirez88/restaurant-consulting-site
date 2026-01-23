-- Context Engine Tables Migration
-- Creates synced_contacts, synced_communications, context_ingestion_log
-- and adds missing columns to context_items for privacy filtering

-- Synced Contacts (from Data Context Engine)
CREATE TABLE IF NOT EXISTS synced_contacts (
    id TEXT PRIMARY KEY,
    external_id TEXT,
    name TEXT,
    phone TEXT,
    email TEXT,
    company TEXT,
    source TEXT DEFAULT 'api',
    last_interaction_at INTEGER,
    privacy_level TEXT DEFAULT 'business',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_synced_contacts_email ON synced_contacts(email);
CREATE INDEX IF NOT EXISTS idx_synced_contacts_privacy ON synced_contacts(privacy_level);
CREATE INDEX IF NOT EXISTS idx_synced_contacts_company ON synced_contacts(company);

-- Synced Communications (from Data Context Engine)
CREATE TABLE IF NOT EXISTS synced_communications (
    id TEXT PRIMARY KEY,
    contact_id TEXT,
    type TEXT NOT NULL, -- sms, call, email, meeting
    direction TEXT, -- inbound, outbound
    summary TEXT,
    content_snippet TEXT,
    occurred_at INTEGER,
    source_id TEXT,
    meta_json TEXT,
    privacy_level TEXT DEFAULT 'business',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (contact_id) REFERENCES synced_contacts(id)
);

CREATE INDEX IF NOT EXISTS idx_synced_comms_contact ON synced_communications(contact_id);
CREATE INDEX IF NOT EXISTS idx_synced_comms_occurred ON synced_communications(occurred_at);
CREATE INDEX IF NOT EXISTS idx_synced_comms_privacy ON synced_communications(privacy_level);
CREATE INDEX IF NOT EXISTS idx_synced_comms_type ON synced_communications(type);

-- Context Ingestion Log (sync batch tracking)
CREATE TABLE IF NOT EXISTS context_ingestion_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT,
    source TEXT,
    items_processed INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending', -- pending, success, partial, failed
    error_message TEXT,
    created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_ingestion_log_batch ON context_ingestion_log(batch_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_created ON context_ingestion_log(created_at);

-- Add missing columns to context_items for privacy filtering
-- (columns needed by the Context Engine Connector)
ALTER TABLE context_items ADD COLUMN privacy_level TEXT DEFAULT 'business';
ALTER TABLE context_items ADD COLUMN relevance_score REAL DEFAULT 1.0;
ALTER TABLE context_items ADD COLUMN tags TEXT;
ALTER TABLE context_items ADD COLUMN type TEXT;
ALTER TABLE context_items ADD COLUMN source TEXT;
ALTER TABLE context_items ADD COLUMN embedding_json TEXT;
