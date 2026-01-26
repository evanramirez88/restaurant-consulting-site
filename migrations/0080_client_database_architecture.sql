-- =====================================================
-- MASTER CLIENT DATABASE ARCHITECTURE
-- =====================================================
-- Migration: 0080_client_database_architecture.sql
-- Created: 2026-01-26
-- Purpose: Unified client data model with lifecycle management
--
-- Entity Hierarchy:
--   Organizations (Master Company)
--   ├── Locations (Restaurant Addresses)
--   ├── Contacts (People at org)
--   └── Client_Accounts (Active clients)
-- =====================================================

-- =====================================================
-- PART 1: ORGANIZATIONS (Master Company Table)
-- =====================================================
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,

  -- Identity
  legal_name TEXT NOT NULL,
  dba_name TEXT,
  slug TEXT UNIQUE,

  -- Classification
  entity_type TEXT CHECK (entity_type IN ('single_location', 'multi_location', 'franchise', 'group')),
  industry TEXT DEFAULT 'restaurant',

  -- Lifecycle Stage
  lifecycle_stage TEXT NOT NULL DEFAULT 'lead' CHECK (lifecycle_stage IN (
    'lead',           -- Raw data, not validated
    'prospect',       -- Validated restaurant, not contacted
    'mql',            -- Marketing qualified (responded to outreach)
    'sql',            -- Sales qualified (expressed interest)
    'opportunity',    -- Active deal in progress
    'client',         -- Paying customer
    'churned',        -- Former client
    'blacklist'       -- Do not contact
  )),
  lifecycle_changed_at INTEGER,
  lifecycle_changed_by TEXT,

  -- Source Tracking
  source TEXT,  -- builtwith, hubspot, manual, referral, website
  source_id TEXT,
  source_campaign TEXT,

  -- External IDs
  hubspot_company_id TEXT UNIQUE,
  stripe_customer_id TEXT UNIQUE,
  square_customer_id TEXT,

  -- Metadata
  tags TEXT,  -- JSON array
  notes TEXT,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_organizations_lifecycle ON organizations(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_organizations_source ON organizations(source);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- =====================================================
-- PART 2: LOCATIONS (Restaurant Locations)
-- =====================================================
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  slug TEXT UNIQUE,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'US',
  latitude REAL,
  longitude REAL,

  -- Contact
  phone TEXT,
  email TEXT,
  website_url TEXT,

  -- Classification
  cuisine_primary TEXT,
  cuisine_secondary TEXT,
  service_style TEXT,
  bar_program TEXT,
  menu_complexity TEXT,

  -- Technology
  pos_system TEXT,
  pos_account_id TEXT,
  pos_version TEXT,
  online_ordering_provider TEXT,
  reservation_provider TEXT,

  -- Operations
  seating_capacity INTEGER,
  employee_count INTEGER,
  price_level INTEGER CHECK (price_level >= 1 AND price_level <= 4),

  -- Financials
  estimated_annual_revenue REAL,
  avg_check_size REAL,

  -- Status
  is_primary INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),

  -- Enrichment
  last_enriched_at INTEGER,
  data_completeness INTEGER DEFAULT 0,

  -- External IDs
  google_place_id TEXT,
  yelp_id TEXT,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_locations_org ON locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_locations_pos ON locations(pos_system);
CREATE INDEX IF NOT EXISTS idx_locations_state ON locations(state);
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);

-- =====================================================
-- PART 3: CONTACTS (People)
-- =====================================================
-- Note: We use org_contacts to avoid conflict with any existing contacts tables
CREATE TABLE IF NOT EXISTS org_contacts (
  id TEXT PRIMARY KEY,

  -- Linked entities
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,

  -- Identity
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,

  -- Role
  title TEXT,
  role_type TEXT CHECK (role_type IN ('owner', 'gm', 'manager', 'chef', 'accounting', 'other')),
  is_primary INTEGER DEFAULT 0,
  is_decision_maker INTEGER DEFAULT 0,

  -- Portal Access
  portal_enabled INTEGER DEFAULT 0,
  slug TEXT UNIQUE,
  password_hash TEXT,
  magic_link_token TEXT,
  magic_link_expires INTEGER,

  -- Communication
  preferred_contact_method TEXT CHECK (preferred_contact_method IN ('email', 'phone', 'text')),
  do_not_contact INTEGER DEFAULT 0,
  unsubscribed_at INTEGER,
  timezone TEXT DEFAULT 'America/New_York',

  -- External IDs
  hubspot_contact_id TEXT UNIQUE,

  -- Engagement
  last_contacted_at INTEGER,
  total_emails_received INTEGER DEFAULT 0,
  total_emails_opened INTEGER DEFAULT 0,
  total_emails_clicked INTEGER DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'bounced')),

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_org_contacts_org ON org_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_contacts_email ON org_contacts(email);
CREATE INDEX IF NOT EXISTS idx_org_contacts_slug ON org_contacts(slug);
CREATE INDEX IF NOT EXISTS idx_org_contacts_hubspot ON org_contacts(hubspot_contact_id);

-- =====================================================
-- PART 4: CLIENT ACCOUNTS (Active Client Data)
-- =====================================================
CREATE TABLE IF NOT EXISTS client_accounts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Client Status
  client_since INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'churned')),

  -- Support Plan
  support_plan_tier TEXT CHECK (support_plan_tier IN ('none', 'core', 'professional', 'premium')),
  support_plan_status TEXT DEFAULT 'inactive' CHECK (support_plan_status IN ('inactive', 'active', 'paused', 'cancelled')),
  support_plan_started INTEGER,
  support_plan_renews INTEGER,
  support_hours_included INTEGER DEFAULT 0,
  support_hours_used REAL DEFAULT 0,

  -- Billing
  stripe_subscription_id TEXT,
  stripe_subscription_status TEXT,
  square_subscription_id TEXT,
  mrr INTEGER DEFAULT 0,  -- Cents
  total_revenue INTEGER DEFAULT 0,

  -- Health & Risk
  health_score INTEGER DEFAULT 50 CHECK (health_score >= 0 AND health_score <= 100),
  health_trend TEXT DEFAULT 'stable' CHECK (health_trend IN ('improving', 'stable', 'declining')),
  health_computed_at INTEGER,
  health_factors TEXT,  -- JSON
  churn_risk TEXT DEFAULT 'low' CHECK (churn_risk IN ('low', 'medium', 'high', 'critical')),
  nps_score INTEGER,

  -- Activity
  last_activity_at INTEGER,
  last_support_ticket_at INTEGER,
  portal_logins_count INTEGER DEFAULT 0,

  -- Service Lane
  service_lane TEXT DEFAULT 'B' CHECK (service_lane IN ('A', 'B')),

  -- Rep Assignment
  assigned_rep_id TEXT REFERENCES reps(id),

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),

  UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_client_accounts_org ON client_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_accounts_rep ON client_accounts(assigned_rep_id);
CREATE INDEX IF NOT EXISTS idx_client_accounts_status ON client_accounts(status);
CREATE INDEX IF NOT EXISTS idx_client_accounts_health ON client_accounts(health_score);

-- =====================================================
-- PART 5: UNIFIED ACTIVITY LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS unified_activity_log (
  id TEXT PRIMARY KEY,

  -- Entity references
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES org_contacts(id) ON DELETE SET NULL,
  client_account_id TEXT REFERENCES client_accounts(id) ON DELETE SET NULL,
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,

  -- Activity type
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    -- Email
    'email_sent', 'email_opened', 'email_clicked', 'email_replied', 'email_bounced',
    -- Communication
    'call_outbound', 'call_inbound', 'meeting_scheduled', 'meeting_completed',
    -- Sales
    'quote_sent', 'quote_viewed', 'quote_accepted', 'quote_rejected',
    'deal_created', 'deal_stage_changed', 'deal_won', 'deal_lost',
    -- Support
    'ticket_created', 'ticket_updated', 'ticket_resolved',
    -- Portal
    'portal_login', 'document_downloaded', 'document_uploaded',
    -- Lifecycle
    'stage_changed', 'note_added', 'tag_added', 'tag_removed',
    -- System
    'data_enriched', 'subscription_started', 'subscription_cancelled', 'payment_received'
  )),

  -- Details
  title TEXT NOT NULL,
  description TEXT,
  metadata_json TEXT,

  -- Related entities
  ticket_id TEXT,
  project_id TEXT,
  deal_id TEXT,
  email_log_id TEXT,
  quote_id TEXT,

  -- Attribution
  performed_by_type TEXT CHECK (performed_by_type IN ('admin', 'rep', 'client', 'system', 'api')),
  performed_by_id TEXT,
  performed_by_name TEXT,

  -- Visibility
  is_internal INTEGER DEFAULT 0,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_unified_activity_org ON unified_activity_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_activity_contact ON unified_activity_log(contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_activity_type ON unified_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_unified_activity_created ON unified_activity_log(created_at DESC);

-- =====================================================
-- PART 6: LIFECYCLE STAGE TRANSITIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS lifecycle_transitions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  from_stage TEXT,
  to_stage TEXT NOT NULL,

  reason TEXT,
  notes TEXT,

  triggered_by_type TEXT CHECK (triggered_by_type IN ('auto', 'manual', 'system')),
  triggered_by_id TEXT,
  triggered_by_name TEXT,

  -- What triggered the transition
  trigger_event TEXT,  -- email_opened, email_replied, quote_sent, payment_received, etc.
  trigger_entity_id TEXT,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_transitions_org ON lifecycle_transitions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lifecycle_transitions_stage ON lifecycle_transitions(to_stage);

-- =====================================================
-- PART 7: DATA MIGRATION - Existing Clients
-- =====================================================

-- Migrate existing clients to organizations
INSERT OR IGNORE INTO organizations (
  id, legal_name, dba_name, slug, entity_type, lifecycle_stage,
  lifecycle_changed_at, source, hubspot_company_id, stripe_customer_id,
  square_customer_id, notes, created_at, updated_at
)
SELECT
  c.id,
  COALESCE(c.name, 'Unknown'),
  c.company,
  c.slug,
  'single_location',
  'client',
  c.updated_at,
  'legacy_import',
  NULL,  -- hubspot_company_id
  c.stripe_customer_id,
  c.square_customer_id,
  c.notes,
  c.created_at,
  c.updated_at
FROM clients c
WHERE c.support_plan_status IN ('active', 'paused', 'cancelled')
   OR c.support_plan_tier IS NOT NULL;

-- Migrate clients to contacts
INSERT OR IGNORE INTO org_contacts (
  id, organization_id, first_name, email, phone, title,
  role_type, is_primary, is_decision_maker, portal_enabled,
  slug, password_hash, magic_link_token, magic_link_expires,
  timezone, hubspot_contact_id, created_at, updated_at
)
SELECT
  c.id || '_contact',
  c.id,
  c.name,
  c.email,
  c.phone,
  'Owner',
  'owner',
  1,
  1,
  COALESCE(c.portal_enabled, 0),
  c.slug,
  c.password_hash,
  c.magic_link_token,
  c.magic_link_expires,
  COALESCE(c.timezone, 'America/New_York'),
  c.hubspot_contact_id,
  c.created_at,
  c.updated_at
FROM clients c
WHERE c.support_plan_status IN ('active', 'paused', 'cancelled')
   OR c.support_plan_tier IS NOT NULL;

-- Migrate clients to locations
INSERT OR IGNORE INTO locations (
  id, organization_id, name, slug, address_line1, city, state, zip,
  is_primary, status, created_at, updated_at
)
SELECT
  c.id || '_location',
  c.id,
  COALESCE(c.company, c.name, 'Primary Location'),
  c.slug || '-main',
  c.address,
  c.city,
  c.state,
  c.zip,
  1,
  'active',
  c.created_at,
  c.updated_at
FROM clients c
WHERE c.support_plan_status IN ('active', 'paused', 'cancelled')
   OR c.support_plan_tier IS NOT NULL;

-- Create client_accounts for active clients
INSERT OR IGNORE INTO client_accounts (
  id, organization_id, client_since, status,
  support_plan_tier, support_plan_status, support_plan_started, support_plan_renews,
  support_hours_used, stripe_subscription_id, stripe_subscription_status,
  square_subscription_id, mrr, health_score, health_trend, churn_risk,
  service_lane, last_activity_at, created_at, updated_at
)
SELECT
  c.id || '_account',
  c.id,
  COALESCE(c.support_plan_started, c.client_since, c.created_at),
  CASE
    WHEN c.support_plan_status = 'active' THEN 'active'
    WHEN c.support_plan_status = 'paused' THEN 'paused'
    WHEN c.support_plan_status = 'cancelled' THEN 'cancelled'
    ELSE 'active'
  END,
  CASE
    WHEN c.support_plan_tier = 'essential' THEN 'core'
    ELSE c.support_plan_tier
  END,
  COALESCE(c.support_plan_status, 'inactive'),
  c.support_plan_started,
  c.support_plan_renews,
  COALESCE(c.support_hours_used, 0),
  c.stripe_subscription_id,
  c.stripe_subscription_status,
  c.square_subscription_id,
  COALESCE(c.stripe_mrr, 0),
  COALESCE(c.health_score, 50),
  COALESCE(c.health_trend, 'stable'),
  COALESCE(c.churn_risk, 'low'),
  COALESCE(c.service_lane, 'B'),
  c.last_activity_at,
  c.created_at,
  c.updated_at
FROM clients c
WHERE c.support_plan_status IN ('active', 'paused', 'cancelled')
   OR c.support_plan_tier IS NOT NULL;

-- =====================================================
-- PART 8: DATA MIGRATION - Restaurant Leads
-- =====================================================

-- Migrate restaurant_leads to organizations (prospects/leads)
INSERT OR IGNORE INTO organizations (
  id, legal_name, dba_name, slug, entity_type, lifecycle_stage,
  lifecycle_changed_at, source, source_id, hubspot_company_id,
  tags, notes, created_at, updated_at
)
SELECT
  rl.id,
  COALESCE(rl.name, rl.dba_name, 'Unknown'),
  rl.dba_name,
  LOWER(REPLACE(REPLACE(COALESCE(rl.domain, rl.id), '.', '-'), ' ', '-')),
  'single_location',
  CASE
    WHEN rl.status = 'opportunity' THEN 'opportunity'
    WHEN rl.status = 'qualified' THEN 'sql'
    WHEN rl.status = 'lead' THEN 'mql'
    WHEN rl.status = 'prospect' THEN 'prospect'
    WHEN rl.status = 'churned' THEN 'churned'
    ELSE 'lead'
  END,
  rl.updated_at,
  rl.source,
  rl.source_id,
  rl.hubspot_id,
  rl.tags,
  rl.notes,
  rl.created_at,
  rl.updated_at
FROM restaurant_leads rl
WHERE rl.converted_to_client_id IS NULL;

-- Migrate restaurant_leads to locations
INSERT OR IGNORE INTO locations (
  id, organization_id, name, address_line1, address_line2, city, state, zip,
  country, latitude, longitude, phone, email, website_url,
  cuisine_primary, cuisine_secondary, service_style, bar_program, menu_complexity,
  pos_system, pos_account_id, online_ordering_provider, reservation_provider,
  seating_capacity, employee_count, price_level, estimated_annual_revenue,
  google_place_id, yelp_id, is_primary, status, last_enriched_at,
  created_at, updated_at
)
SELECT
  rl.id || '_loc',
  rl.id,
  COALESCE(rl.name, rl.dba_name, 'Unknown'),
  rl.address_line1,
  rl.address_line2,
  rl.city,
  rl.state,
  rl.zip,
  COALESCE(rl.country, 'US'),
  rl.latitude,
  rl.longitude,
  rl.primary_phone,
  rl.primary_email,
  rl.website_url,
  rl.cuisine_primary,
  rl.cuisine_secondary,
  rl.service_style,
  rl.bar_program,
  rl.menu_complexity,
  rl.current_pos,
  NULL,
  rl.online_ordering_provider,
  rl.reservation_provider,
  rl.actual_seat_count,
  rl.actual_staff_count,
  rl.price_level,
  rl.actual_annual_revenue,
  rl.google_place_id,
  rl.yelp_id,
  1,
  CASE WHEN rl.status = 'churned' THEN 'inactive' ELSE 'active' END,
  rl.enriched_at,
  rl.created_at,
  rl.updated_at
FROM restaurant_leads rl
WHERE rl.converted_to_client_id IS NULL;

-- Migrate restaurant lead contacts
INSERT OR IGNORE INTO org_contacts (
  id, organization_id, email, phone, is_primary,
  do_not_contact, last_contacted_at, created_at, updated_at
)
SELECT
  rl.id || '_contact',
  rl.id,
  rl.primary_email,
  rl.primary_phone,
  1,
  0,
  rl.last_contacted_at,
  rl.created_at,
  rl.updated_at
FROM restaurant_leads rl
WHERE rl.primary_email IS NOT NULL
  AND rl.converted_to_client_id IS NULL;

-- =====================================================
-- PART 9: BACKWARD COMPATIBILITY VIEW
-- =====================================================
DROP VIEW IF EXISTS clients_legacy;
CREATE VIEW clients_legacy AS
SELECT
  o.id,
  COALESCE(c.first_name, c.last_name, o.legal_name) as name,
  o.dba_name as company,
  c.email,
  c.phone,
  l.address_line1 as address,
  l.city,
  l.state,
  l.zip,
  c.password_hash,
  c.magic_link_token,
  c.magic_link_expires,
  c.hubspot_contact_id,
  c.slug,
  NULL as google_drive_folder_id,
  c.portal_enabled,
  NULL as avatar_url,
  o.notes,
  c.timezone,
  ca.support_plan_tier,
  ca.support_plan_status,
  ca.support_plan_started,
  ca.support_plan_renews,
  o.square_customer_id,
  ca.square_subscription_id,
  ca.support_hours_used,
  ca.service_lane,
  NULL as hubspot_synced_at,
  o.stripe_customer_id,
  ca.stripe_subscription_id,
  ca.stripe_subscription_status,
  ca.mrr as stripe_mrr,
  ca.health_score,
  ca.health_computed_at,
  ca.health_factors,
  ca.churn_risk,
  NULL as clv_estimate,
  ca.health_trend,
  ca.last_activity_at,
  ca.total_revenue,
  ca.mrr as active_mrr,
  ca.client_since,
  o.created_at,
  o.updated_at
FROM organizations o
LEFT JOIN org_contacts c ON c.organization_id = o.id AND c.is_primary = 1
LEFT JOIN locations l ON l.organization_id = o.id AND l.is_primary = 1
LEFT JOIN client_accounts ca ON ca.organization_id = o.id
WHERE o.lifecycle_stage = 'client';

-- =====================================================
-- PART 10: ORGANIZATION 360 VIEW
-- =====================================================
DROP VIEW IF EXISTS v_organization_360;
CREATE VIEW v_organization_360 AS
SELECT
  o.id,
  o.legal_name,
  o.dba_name,
  o.slug,
  o.lifecycle_stage,
  o.entity_type,
  o.source,
  o.tags,
  o.notes,
  -- Primary contact
  c.id as primary_contact_id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.portal_enabled,
  c.slug as contact_slug,
  -- Primary location
  l.id as primary_location_id,
  l.name as location_name,
  l.address_line1,
  l.city,
  l.state,
  l.zip,
  l.pos_system,
  l.cuisine_primary,
  l.seating_capacity,
  -- Client account (if exists)
  ca.id as client_account_id,
  ca.status as account_status,
  ca.support_plan_tier,
  ca.support_plan_status,
  ca.health_score,
  ca.health_trend,
  ca.churn_risk,
  ca.mrr,
  ca.client_since,
  -- Counts
  (SELECT COUNT(*) FROM locations WHERE organization_id = o.id) as location_count,
  (SELECT COUNT(*) FROM org_contacts WHERE organization_id = o.id) as contact_count,
  (SELECT COUNT(*) FROM unified_activity_log WHERE organization_id = o.id) as activity_count,
  (SELECT MAX(created_at) FROM unified_activity_log WHERE organization_id = o.id) as last_activity_at,
  -- Timestamps
  o.created_at,
  o.updated_at
FROM organizations o
LEFT JOIN org_contacts c ON c.organization_id = o.id AND c.is_primary = 1
LEFT JOIN locations l ON l.organization_id = o.id AND l.is_primary = 1
LEFT JOIN client_accounts ca ON ca.organization_id = o.id;

-- =====================================================
-- PART 11: TRIGGERS FOR AUTO-UPDATE
-- =====================================================

-- Update organizations.updated_at on change
CREATE TRIGGER IF NOT EXISTS trg_organizations_updated
AFTER UPDATE ON organizations
BEGIN
  UPDATE organizations SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Update locations.updated_at on change
CREATE TRIGGER IF NOT EXISTS trg_locations_updated
AFTER UPDATE ON locations
BEGIN
  UPDATE locations SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Update org_contacts.updated_at on change
CREATE TRIGGER IF NOT EXISTS trg_org_contacts_updated
AFTER UPDATE ON org_contacts
BEGIN
  UPDATE org_contacts SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Update client_accounts.updated_at on change
CREATE TRIGGER IF NOT EXISTS trg_client_accounts_updated
AFTER UPDATE ON client_accounts
BEGIN
  UPDATE client_accounts SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Log lifecycle stage changes automatically
CREATE TRIGGER IF NOT EXISTS trg_lifecycle_stage_change
AFTER UPDATE OF lifecycle_stage ON organizations
WHEN OLD.lifecycle_stage != NEW.lifecycle_stage
BEGIN
  INSERT INTO lifecycle_transitions (
    id, organization_id, from_stage, to_stage, triggered_by_type, created_at
  ) VALUES (
    'lt_' || hex(randomblob(8)),
    NEW.id,
    OLD.lifecycle_stage,
    NEW.lifecycle_stage,
    'system',
    unixepoch()
  );

  UPDATE organizations
  SET lifecycle_changed_at = unixepoch()
  WHERE id = NEW.id;
END;

-- =====================================================
-- COMPLETE
-- =====================================================
