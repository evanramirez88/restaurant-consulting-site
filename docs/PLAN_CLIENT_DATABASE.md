# Master Client Database Architecture Plan
## Unified Client Data Model and Lifecycle Management
**Created:** January 26, 2026
**Priority:** HIGH (Foundation for all client operations)

---

## Executive Summary

This plan defines a comprehensive data architecture for managing client relationships across the entire lifecycle: Lead → Prospect → Opportunity → Client → Active Account. Currently, data is fragmented across multiple tables with inconsistent relationships.

**Current State:**
- 3 clients in `clients` table
- 3,437 leads in `restaurant_leads` table
- 215 HubSpot contacts synced
- No clear conversion path between tables

---

## Problems Identified

| ID | Issue | Impact |
|----|-------|--------|
| PT-2/PT-3 | Client Portal APIs broken | Clients can't access their portal |
| - | Fragmented journey | No lead-to-client tracking |
| - | Duplicate fields | Health scores in multiple tables |
| - | Missing relationships | email_subscribers not linked to clients |
| - | HubSpot sync gap | 215 contacts not mapped to clients |

---

## Proposed Data Model

### Entity Hierarchy

```
                    ┌─────────────────────┐
                    │   ORGANIZATIONS     │
                    │  (Master Company)   │
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│    LOCATIONS    │  │    CONTACTS     │  │ CLIENT_ACCOUNTS │
│ (Restaurant     │  │ (People at org) │  │ (Active clients)│
│  Addresses)     │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Core Tables

### 1. `organizations` (Master Company Table)

```sql
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,

  -- Identity
  legal_name TEXT NOT NULL,
  dba_name TEXT,
  slug TEXT UNIQUE,

  -- Classification
  entity_type TEXT CHECK (entity_type IN ('single_location', 'multi_location', 'franchise', 'group')),
  industry TEXT DEFAULT 'restaurant',

  -- Lifecycle
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

  -- Source tracking
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

CREATE INDEX idx_organizations_lifecycle ON organizations(lifecycle_stage);
CREATE INDEX idx_organizations_source ON organizations(source);
```

### 2. `locations` (Restaurant Locations)

```sql
CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  slug TEXT UNIQUE,

  -- Address
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  latitude REAL,
  longitude REAL,

  -- Contact
  phone TEXT,
  email TEXT,
  website_url TEXT,

  -- Classification
  cuisine_primary TEXT,
  service_style TEXT,
  menu_complexity TEXT,

  -- Technology
  pos_system TEXT,
  pos_account_id TEXT,

  -- Operations
  seating_capacity INTEGER,
  employee_count INTEGER,

  -- Financials
  estimated_annual_revenue REAL,
  avg_check_size REAL,

  -- Status
  is_primary INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',

  -- Enrichment
  last_enriched_at INTEGER,
  data_completeness INTEGER DEFAULT 0,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_locations_org ON locations(organization_id);
CREATE INDEX idx_locations_pos ON locations(pos_system);
```

### 3. `contacts` (People)

```sql
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,

  -- Linked entities
  organization_id TEXT REFERENCES organizations(id),
  location_id TEXT REFERENCES locations(id),

  -- Identity
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE,
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
  preferred_contact_method TEXT,
  do_not_contact INTEGER DEFAULT 0,
  unsubscribed_at INTEGER,

  -- External IDs
  hubspot_contact_id TEXT UNIQUE,

  -- Engagement
  last_contacted_at INTEGER,
  total_emails_received INTEGER DEFAULT 0,
  total_emails_opened INTEGER DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'active',

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_contacts_org ON contacts(organization_id);
CREATE INDEX idx_contacts_email ON contacts(email);
```

### 4. `client_accounts` (Active Client Data)

```sql
CREATE TABLE client_accounts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),

  -- Client status
  client_since INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'churned')),

  -- Support Plan
  support_plan_tier TEXT CHECK (support_plan_tier IN ('none', 'core', 'professional', 'premium')),
  support_plan_status TEXT DEFAULT 'inactive',
  support_plan_started INTEGER,
  support_hours_included INTEGER DEFAULT 0,
  support_hours_used INTEGER DEFAULT 0,

  -- Billing
  stripe_subscription_id TEXT,
  mrr INTEGER DEFAULT 0,  -- Cents
  total_revenue INTEGER DEFAULT 0,

  -- Health & Risk
  health_score INTEGER DEFAULT 50,
  health_trend TEXT DEFAULT 'stable',
  churn_risk TEXT DEFAULT 'low',
  nps_score INTEGER,

  -- Activity
  last_activity_at INTEGER,
  last_support_ticket_at INTEGER,

  -- Rep assignment
  assigned_rep_id TEXT REFERENCES reps(id),

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_client_accounts_org ON client_accounts(organization_id);
CREATE INDEX idx_client_accounts_rep ON client_accounts(assigned_rep_id);
```

---

## Lifecycle Stage Definitions

| Stage | Description | Trigger |
|-------|-------------|---------|
| **lead** | Raw imported data | Initial import |
| **prospect** | Validated restaurant | Data enrichment complete |
| **mql** | Marketing qualified | Email opened/clicked |
| **sql** | Sales qualified | Replied to outreach |
| **opportunity** | Active deal | Quote sent or call scheduled |
| **client** | Paying customer | First payment |
| **churned** | Former client | Subscription cancelled |
| **blacklist** | Do not contact | Manual flag |

### Stage Transition Triggers

```javascript
// Auto-progression rules
const stageTransitions = {
  'lead_to_prospect': {
    condition: (org) => org.email_valid && (org.phone || org.website),
    auto: true
  },
  'prospect_to_mql': {
    condition: (org) => org.email_opened_count > 0 || org.link_clicked,
    auto: true
  },
  'mql_to_sql': {
    condition: (org) => org.replied_to_email || org.requested_callback,
    auto: true
  },
  'sql_to_opportunity': {
    condition: (org) => org.has_active_deal,
    auto: false  // Rep creates deal manually
  },
  'opportunity_to_client': {
    condition: (org) => org.first_payment_at !== null,
    auto: true
  }
};
```

---

## Activity Tracking

### `unified_activity_log`

```sql
CREATE TABLE unified_activity_log (
  id TEXT PRIMARY KEY,

  -- Entity references
  organization_id TEXT REFERENCES organizations(id),
  contact_id TEXT REFERENCES contacts(id),
  client_account_id TEXT REFERENCES client_accounts(id),

  -- Activity type
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'email_sent', 'email_opened', 'email_clicked', 'email_replied',
    'call_outbound', 'call_inbound', 'meeting_scheduled', 'meeting_completed',
    'quote_sent', 'quote_viewed', 'quote_accepted',
    'deal_created', 'deal_stage_changed', 'deal_won', 'deal_lost',
    'ticket_created', 'ticket_resolved',
    'portal_login', 'document_downloaded',
    'stage_changed', 'note_added'
  )),

  -- Details
  title TEXT NOT NULL,
  description TEXT,
  metadata_json TEXT,

  -- Attribution
  performed_by_type TEXT,
  performed_by_id TEXT,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_activity_org ON unified_activity_log(organization_id);
CREATE INDEX idx_activity_type ON unified_activity_log(activity_type);
```

---

## Client Health Scoring

### Score Components (0-100 each)

```
OVERALL_HEALTH = (
  Engagement × 0.25 +
  Payment × 0.25 +
  Satisfaction × 0.20 +
  Activity × 0.15 +
  Relationship × 0.15
)
```

| Component | Calculation |
|-----------|-------------|
| **Engagement** | Email opens + Portal logins + Response rate |
| **Payment** | On-time payments + No disputes |
| **Satisfaction** | NPS score + Ticket CSAT |
| **Activity** | Days since last touch + Support frequency |
| **Relationship** | Account tenure + Referrals |

### Churn Risk Levels

| Risk | Health Score | Indicators |
|------|-------------|------------|
| **Low** | 70-100 | Active, engaged |
| **Medium** | 50-69 | Some disengagement |
| **High** | 30-49 | Significant issues |
| **Critical** | 0-29 | Immediate attention needed |

---

## Migration Strategy

### Phase 1: Create New Tables (No Data Loss)

```sql
-- Create new schema without dropping old tables
CREATE TABLE organizations (...);
CREATE TABLE locations (...);
-- etc.
```

### Phase 2: Data Migration

```sql
-- Migrate existing clients
INSERT INTO organizations (id, legal_name, dba_name, slug, lifecycle_stage, ...)
SELECT
  id,
  name as legal_name,
  company as dba_name,
  slug,
  'client',
  ...
FROM clients
WHERE support_plan_status IS NOT NULL;

-- Migrate restaurant_leads
INSERT INTO organizations (id, legal_name, lifecycle_stage, source, ...)
SELECT
  id,
  business_name,
  CASE
    WHEN status = 'active' THEN 'prospect'
    ELSE 'lead'
  END,
  'builtwith',
  ...
FROM restaurant_leads;

-- Create locations from leads
INSERT INTO locations (id, organization_id, name, address_line1, city, state, ...)
SELECT
  id || '_loc',
  id,
  business_name,
  address,
  city,
  state,
  ...
FROM restaurant_leads;

-- Create contacts
INSERT INTO contacts (id, organization_id, email, first_name, ...)
SELECT
  id || '_contact',
  id,
  email,
  contact_name,
  ...
FROM restaurant_leads
WHERE email IS NOT NULL;

-- Create client_accounts for active clients
INSERT INTO client_accounts (id, organization_id, client_since, ...)
SELECT
  id || '_account',
  id,
  support_plan_started,
  ...
FROM clients
WHERE support_plan_status = 'active';
```

### Phase 3: Update APIs

| Old Endpoint | New Endpoint | Changes |
|--------------|--------------|---------|
| `/api/portal/{slug}/info` | Same | Query `organizations` + `contacts` + `client_accounts` |
| `/api/rep/{slug}/clients` | Same | Query `rep_assignments` + `organizations` |
| `/api/admin/contacts` | Same | Query from new schema |

### Phase 4: Deprecation

After 30 days, add views for backward compatibility:

```sql
CREATE VIEW clients_legacy AS
SELECT
  o.id, o.dba_name as name, o.legal_name as company,
  c.email, c.phone, c.slug,
  ca.support_plan_tier, ca.support_plan_status, ca.health_score
FROM organizations o
LEFT JOIN contacts c ON c.organization_id = o.id AND c.is_primary = 1
LEFT JOIN client_accounts ca ON ca.organization_id = o.id
WHERE o.lifecycle_stage = 'client';
```

---

## Integration Points

### HubSpot Sync

```
Direction: Bidirectional
Objects:
  - Companies ↔ organizations
  - Contacts ↔ contacts
  - Deals ↔ client_deals
Trigger: Webhook + nightly reconciliation
```

### Stripe

```
Direction: Stripe → D1
Objects:
  - Customers → client_accounts.stripe_customer_id
  - Subscriptions → support plan fields
Trigger: Webhook events
```

### Email System

```
Link: contacts.id → email_subscribers.contact_id
Track: Opens, clicks, replies → unified_activity_log
```

---

## API Design

### Organization Endpoints

```
GET    /api/organizations
GET    /api/organizations/:id
POST   /api/organizations
PATCH  /api/organizations/:id

GET    /api/organizations/:id/locations
POST   /api/organizations/:id/locations

GET    /api/organizations/:id/contacts
POST   /api/organizations/:id/contacts

GET    /api/organizations/:id/activity
POST   /api/organizations/:id/convert-to-client
POST   /api/organizations/:id/stage-change
```

### Client Account Endpoints

```
GET    /api/client-accounts
GET    /api/client-accounts/:id
GET    /api/client-accounts/:id/health
GET    /api/client-accounts/:id/billing
```

---

## Verification Checklist

### Schema ✅ COMPLETE
- [x] All new tables created (organizations, locations, org_contacts, client_accounts, unified_activity_log, lifecycle_transitions)
- [x] Indexes in place (lifecycle, source, slug, email, org_id, etc.)
- [x] Foreign keys working (CASCADE and SET NULL as appropriate)

### Migration ✅ COMPLETE
- [x] Existing clients migrated to organizations
- [x] Leads migrated to organizations
- [x] Contacts extracted and linked
- [x] No data loss (INSERT OR IGNORE pattern)

### APIs ✅ COMPLETE
- [x] Organization CRUD works (index.js, [id].js)
- [x] Client portal uses new schema (info.js updated with fallback)
- [x] Activity logging works (activity.js endpoint)
- [x] Health scoring works (health.js with recommendations)

### Integrations (Not in Scope - Future Work)
- [ ] HubSpot sync updated
- [ ] Stripe webhooks updated
- [ ] Email system linked

---

## Critical Files

| File | Purpose |
|------|---------|
| `migrations/0080_client_database_architecture.sql` | **NEW** - Master unified schema |
| `functions/api/organizations/index.js` | **NEW** - Organization list/create |
| `functions/api/organizations/[id].js` | **NEW** - Organization get/update |
| `functions/api/organizations/[id]/locations.js` | **NEW** - Location management |
| `functions/api/organizations/[id]/contacts.js` | **NEW** - Contact management |
| `functions/api/organizations/[id]/activity.js` | **NEW** - Activity logging |
| `functions/api/organizations/[id]/stage-change.js` | **NEW** - Lifecycle transitions |
| `functions/api/organizations/[id]/convert-to-client.js` | **NEW** - Conversion workflow |
| `functions/api/client-accounts/index.js` | **NEW** - Client accounts list |
| `functions/api/client-accounts/[id].js` | **NEW** - Client account detail |
| `functions/api/client-accounts/[id]/health.js` | **NEW** - Health scoring |
| `functions/api/portal/[slug]/info.js` | **MODIFIED** - Uses new schema with fallback |
| `migrations/0002_full_schema.sql` | Legacy clients table (preserved) |

---

## Implementation Complete

**Status:** ✅ COMPLETED January 26, 2026

**Deployment Required:**
```bash
cd D:/USER_DATA/Projects/restaurant-consulting-site
npx wrangler d1 migrations apply restaurant-consulting-db --remote
npx vite build
CLOUDFLARE_ACCOUNT_ID=373a6cef1f9ccf5d26bfd9687a91c0a6 npx wrangler pages deploy dist --project-name=restaurant-consulting-site --branch=main
```

---

*Author: Claude Opus 4.5*
*For: R&G Consulting Platform*
*Completed: January 26, 2026*
