-- =====================================================
-- DEDUPLICATION & ENTITY RESOLUTION SYSTEM
-- =====================================================
-- Migration: 0092_deduplication_system.sql
-- Created: 2026-01-27
-- Purpose: Unified entity resolution for contact/lead deduplication
--
-- Target Tables for Deduplication:
--   - restaurant_leads
--   - clients
--   - client_profiles
--   - contact_submissions
--   - synced_contacts
--   - organizations
--   - org_contacts
-- =====================================================

-- =====================================================
-- PART 1: ENTITY RESOLUTION RULES
-- =====================================================
-- Configurable rules for matching entities across tables
CREATE TABLE IF NOT EXISTS entity_resolution_rules (
  id TEXT PRIMARY KEY,
  
  -- Rule Identity
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  
  -- Rule Configuration
  source_table TEXT NOT NULL,  -- Table to match against
  target_table TEXT NOT NULL,  -- Table to compare with
  
  -- Match Fields (JSON arrays)
  match_fields TEXT NOT NULL,  -- JSON: ["email", "phone", "company_name"]
  field_weights TEXT,          -- JSON: {"email": 1.0, "phone": 0.8, "company_name": 0.7}
  
  -- Thresholds
  auto_merge_threshold REAL DEFAULT 0.95,    -- >= this: auto-merge
  review_threshold REAL DEFAULT 0.70,        -- >= this: needs review
  ignore_threshold REAL DEFAULT 0.50,        -- < this: not a match
  
  -- Matching Options
  use_phonetic INTEGER DEFAULT 1,      -- Use Soundex/Metaphone
  use_fuzzy INTEGER DEFAULT 1,         -- Use Levenshtein distance
  normalize_phone INTEGER DEFAULT 1,   -- Strip formatting from phones
  normalize_email INTEGER DEFAULT 1,   -- Lowercase, trim whitespace
  
  -- Rule Status
  is_active INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 100,        -- Lower = higher priority
  
  -- Audit
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_resolution_rules_source ON entity_resolution_rules(source_table);
CREATE INDEX IF NOT EXISTS idx_resolution_rules_target ON entity_resolution_rules(target_table);
CREATE INDEX IF NOT EXISTS idx_resolution_rules_active ON entity_resolution_rules(is_active);

-- =====================================================
-- PART 2: DUPLICATE CANDIDATES
-- =====================================================
-- Potential duplicate pairs found by the system
CREATE TABLE IF NOT EXISTS duplicate_candidates (
  id TEXT PRIMARY KEY,
  
  -- Entities Being Compared
  entity1_table TEXT NOT NULL,
  entity1_id TEXT NOT NULL,
  entity2_table TEXT NOT NULL,
  entity2_id TEXT NOT NULL,
  
  -- Matching Details
  rule_id TEXT REFERENCES entity_resolution_rules(id),
  confidence_score REAL NOT NULL,      -- 0.0 to 1.0
  match_details TEXT,                  -- JSON: matching field details
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Awaiting review
    'confirmed',    -- Confirmed duplicate
    'rejected',     -- Not a duplicate (false positive)
    'merged',       -- Already merged
    'deferred'      -- Review later
  )),
  
  -- Review Info
  reviewed_by TEXT,
  reviewed_at INTEGER,
  review_notes TEXT,
  
  -- Audit
  found_at INTEGER DEFAULT (unixepoch()),
  batch_id TEXT,                       -- Group candidates found together
  
  UNIQUE(entity1_table, entity1_id, entity2_table, entity2_id)
);

CREATE INDEX IF NOT EXISTS idx_dup_candidates_status ON duplicate_candidates(status);
CREATE INDEX IF NOT EXISTS idx_dup_candidates_confidence ON duplicate_candidates(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_dup_candidates_entity1 ON duplicate_candidates(entity1_table, entity1_id);
CREATE INDEX IF NOT EXISTS idx_dup_candidates_entity2 ON duplicate_candidates(entity2_table, entity2_id);
CREATE INDEX IF NOT EXISTS idx_dup_candidates_batch ON duplicate_candidates(batch_id);

-- =====================================================
-- PART 3: MERGED ENTITIES
-- =====================================================
-- Track merge history for audit and potential rollback
CREATE TABLE IF NOT EXISTS merged_entities (
  id TEXT PRIMARY KEY,
  
  -- Merge Participants
  canonical_table TEXT NOT NULL,       -- Table of surviving record
  canonical_id TEXT NOT NULL,          -- ID of surviving record
  merged_table TEXT NOT NULL,          -- Table of merged-away record
  merged_id TEXT NOT NULL,             -- ID of merged-away record
  
  -- Merge Details
  duplicate_candidate_id TEXT REFERENCES duplicate_candidates(id),
  confidence_score REAL,
  merge_type TEXT DEFAULT 'manual' CHECK (merge_type IN ('auto', 'manual', 'bulk')),
  
  -- Data Preservation
  merged_data TEXT,                    -- JSON: full record before merge
  field_decisions TEXT,                -- JSON: which fields came from which record
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'rolled_back')),
  rolled_back_at INTEGER,
  rolled_back_by TEXT,
  rollback_reason TEXT,
  
  -- Audit
  merged_at INTEGER DEFAULT (unixepoch()),
  merged_by TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_merged_entities_canonical ON merged_entities(canonical_table, canonical_id);
CREATE INDEX IF NOT EXISTS idx_merged_entities_merged ON merged_entities(merged_table, merged_id);
CREATE INDEX IF NOT EXISTS idx_merged_entities_status ON merged_entities(status);
CREATE INDEX IF NOT EXISTS idx_merged_entities_type ON merged_entities(merge_type);

-- =====================================================
-- PART 4: CANONICAL CONTACTS
-- =====================================================
-- Single source of truth for contact information
CREATE TABLE IF NOT EXISTS canonical_contacts (
  id TEXT PRIMARY KEY,
  
  -- Primary Identity
  email TEXT,
  phone TEXT,
  
  -- Person Info
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  
  -- Company Info
  company_name TEXT,
  job_title TEXT,
  
  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'US',
  
  -- Additional Contact Methods
  secondary_email TEXT,
  secondary_phone TEXT,
  mobile_phone TEXT,
  fax TEXT,
  website TEXT,
  
  -- Linked Records (JSON arrays of {table, id} objects)
  linked_records TEXT,                 -- All records this canonical represents
  
  -- Data Quality
  email_verified INTEGER DEFAULT 0,
  phone_verified INTEGER DEFAULT 0,
  address_verified INTEGER DEFAULT 0,
  data_completeness INTEGER DEFAULT 0, -- 0-100 score
  
  -- Classification
  contact_type TEXT DEFAULT 'unknown' CHECK (contact_type IN (
    'lead', 'prospect', 'client', 'vendor', 'partner', 'unknown'
  )),
  
  -- Source Priority
  primary_source_table TEXT,
  primary_source_id TEXT,
  
  -- Audit
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  last_merged_at INTEGER
);

-- Indexes for fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_canonical_email ON canonical_contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_canonical_phone ON canonical_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_canonical_company ON canonical_contacts(company_name);
CREATE INDEX IF NOT EXISTS idx_canonical_name ON canonical_contacts(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_canonical_type ON canonical_contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_canonical_completeness ON canonical_contacts(data_completeness DESC);

-- Full-text search on canonical contacts
CREATE VIRTUAL TABLE IF NOT EXISTS canonical_contacts_fts USING fts5(
  email,
  phone,
  full_name,
  company_name,
  city,
  state,
  content='canonical_contacts',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS canonical_contacts_ai AFTER INSERT ON canonical_contacts BEGIN
  INSERT INTO canonical_contacts_fts(rowid, email, phone, full_name, company_name, city, state)
  VALUES (NEW.rowid, NEW.email, NEW.phone, NEW.full_name, NEW.company_name, NEW.city, NEW.state);
END;

CREATE TRIGGER IF NOT EXISTS canonical_contacts_ad AFTER DELETE ON canonical_contacts BEGIN
  INSERT INTO canonical_contacts_fts(canonical_contacts_fts, rowid, email, phone, full_name, company_name, city, state)
  VALUES ('delete', OLD.rowid, OLD.email, OLD.phone, OLD.full_name, OLD.company_name, OLD.city, OLD.state);
END;

CREATE TRIGGER IF NOT EXISTS canonical_contacts_au AFTER UPDATE ON canonical_contacts BEGIN
  INSERT INTO canonical_contacts_fts(canonical_contacts_fts, rowid, email, phone, full_name, company_name, city, state)
  VALUES ('delete', OLD.rowid, OLD.email, OLD.phone, OLD.full_name, OLD.company_name, OLD.city, OLD.state);
  INSERT INTO canonical_contacts_fts(rowid, email, phone, full_name, company_name, city, state)
  VALUES (NEW.rowid, NEW.email, NEW.phone, NEW.full_name, NEW.company_name, NEW.city, NEW.state);
END;

-- =====================================================
-- PART 5: ENTITY ALIASES
-- =====================================================
-- Track alternate identifiers for entities
CREATE TABLE IF NOT EXISTS entity_aliases (
  id TEXT PRIMARY KEY,
  
  -- Canonical Reference
  canonical_contact_id TEXT REFERENCES canonical_contacts(id) ON DELETE CASCADE,
  
  -- Alias Type and Value
  alias_type TEXT NOT NULL CHECK (alias_type IN (
    'email',
    'phone',
    'name',
    'company_name',
    'domain',
    'social_handle',
    'external_id'
  )),
  alias_value TEXT NOT NULL,
  normalized_value TEXT,               -- Lowercase, cleaned version
  
  -- Source Info
  source_table TEXT,
  source_id TEXT,
  
  -- Status
  is_primary INTEGER DEFAULT 0,        -- Primary alias for this type
  is_verified INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  
  -- Audit
  created_at INTEGER DEFAULT (unixepoch()),
  verified_at INTEGER,
  
  UNIQUE(canonical_contact_id, alias_type, normalized_value)
);

CREATE INDEX IF NOT EXISTS idx_aliases_canonical ON entity_aliases(canonical_contact_id);
CREATE INDEX IF NOT EXISTS idx_aliases_type ON entity_aliases(alias_type);
CREATE INDEX IF NOT EXISTS idx_aliases_value ON entity_aliases(normalized_value);
CREATE INDEX IF NOT EXISTS idx_aliases_lookup ON entity_aliases(alias_type, normalized_value);

-- =====================================================
-- PART 6: DEDUPLICATION RUNS
-- =====================================================
-- Track batch deduplication operations
CREATE TABLE IF NOT EXISTS deduplication_runs (
  id TEXT PRIMARY KEY,
  
  -- Run Configuration
  rule_ids TEXT,                       -- JSON: rules used
  source_tables TEXT,                  -- JSON: tables scanned
  
  -- Results
  records_scanned INTEGER DEFAULT 0,
  candidates_found INTEGER DEFAULT 0,
  auto_merged INTEGER DEFAULT 0,
  pending_review INTEGER DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'running' CHECK (status IN (
    'running', 'completed', 'failed', 'cancelled'
  )),
  error_message TEXT,
  
  -- Timing
  started_at INTEGER DEFAULT (unixepoch()),
  completed_at INTEGER,
  duration_seconds INTEGER,
  
  -- Audit
  triggered_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_dedup_runs_status ON deduplication_runs(status);
CREATE INDEX IF NOT EXISTS idx_dedup_runs_started ON deduplication_runs(started_at DESC);

-- =====================================================
-- PART 7: SEED DEFAULT RULES
-- =====================================================
INSERT OR IGNORE INTO entity_resolution_rules (
  id, name, description, source_table, target_table,
  match_fields, field_weights,
  auto_merge_threshold, review_threshold, ignore_threshold
) VALUES
  -- Email exact match (highest confidence)
  (
    'rule_email_exact',
    'Email Exact Match',
    'Match records with identical email addresses',
    'restaurant_leads',
    'restaurant_leads',
    '["email"]',
    '{"email": 1.0}',
    0.99, 0.80, 0.50
  ),
  -- Phone + Company match
  (
    'rule_phone_company',
    'Phone and Company Match',
    'Match records with same phone and similar company name',
    'restaurant_leads',
    'org_contacts',
    '["phone", "company_name"]',
    '{"phone": 0.6, "company_name": 0.4}',
    0.90, 0.70, 0.50
  ),
  -- Cross-table lead to client
  (
    'rule_lead_to_client',
    'Lead to Client Match',
    'Match leads with existing clients',
    'restaurant_leads',
    'clients',
    '["email", "phone", "company_name"]',
    '{"email": 0.5, "phone": 0.3, "company_name": 0.2}',
    0.92, 0.75, 0.55
  ),
  -- Organization matching
  (
    'rule_org_match',
    'Organization Match',
    'Match organizations by name and address',
    'organizations',
    'organizations',
    '["company_name", "address", "phone"]',
    '{"company_name": 0.5, "address": 0.3, "phone": 0.2}',
    0.90, 0.72, 0.50
  ),
  -- Contact submission matching
  (
    'rule_contact_submission',
    'Contact Form to Lead Match',
    'Match contact form submissions with existing leads',
    'contact_submissions',
    'restaurant_leads',
    '["email", "phone", "name"]',
    '{"email": 0.5, "phone": 0.3, "name": 0.2}',
    0.88, 0.70, 0.50
  );

-- =====================================================
-- PART 8: HELPER VIEWS
-- =====================================================

-- View: Pending duplicates needing review
CREATE VIEW IF NOT EXISTS v_pending_duplicates AS
SELECT 
  dc.id,
  dc.entity1_table,
  dc.entity1_id,
  dc.entity2_table,
  dc.entity2_id,
  dc.confidence_score,
  dc.match_details,
  dc.found_at,
  err.name as rule_name
FROM duplicate_candidates dc
LEFT JOIN entity_resolution_rules err ON dc.rule_id = err.id
WHERE dc.status = 'pending'
ORDER BY dc.confidence_score DESC;

-- View: Recent merge activity
CREATE VIEW IF NOT EXISTS v_recent_merges AS
SELECT 
  me.id,
  me.canonical_table,
  me.canonical_id,
  me.merged_table,
  me.merged_id,
  me.merge_type,
  me.confidence_score,
  me.merged_at,
  me.merged_by,
  me.status
FROM merged_entities me
WHERE me.merged_at > unixepoch() - (86400 * 30)  -- Last 30 days
ORDER BY me.merged_at DESC;

-- View: Data quality scores by source
CREATE VIEW IF NOT EXISTS v_canonical_quality AS
SELECT 
  contact_type,
  primary_source_table,
  COUNT(*) as total_contacts,
  AVG(data_completeness) as avg_completeness,
  SUM(CASE WHEN email_verified = 1 THEN 1 ELSE 0 END) as verified_emails,
  SUM(CASE WHEN phone_verified = 1 THEN 1 ELSE 0 END) as verified_phones
FROM canonical_contacts
GROUP BY contact_type, primary_source_table;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
