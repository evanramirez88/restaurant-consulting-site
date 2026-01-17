-- ============================================
-- REP PORTAL ENHANCEMENTS MIGRATION
-- Migration: 0034_rep_portal_enhancements.sql
-- Created: 2026-01-17
--
-- This migration adds:
-- - Tool permissions on client_rep_assignments
-- - rep_quotes table for quotes created by reps
-- - Lead source tracking on restaurant_leads
-- - rep_referral_credits table
-- ============================================

-- ============================================
-- ENHANCE CLIENT_REP_ASSIGNMENTS WITH PERMISSIONS
-- ============================================

-- Add explicit permission columns for common tools
-- Note: permissions_json column already exists for custom permissions
ALTER TABLE client_rep_assignments ADD COLUMN can_quote INTEGER DEFAULT 1;
ALTER TABLE client_rep_assignments ADD COLUMN can_menu_build INTEGER DEFAULT 1;
ALTER TABLE client_rep_assignments ADD COLUMN can_create_tickets INTEGER DEFAULT 1;
ALTER TABLE client_rep_assignments ADD COLUMN can_view_billing INTEGER DEFAULT 0;

-- ============================================
-- REP QUOTES TABLE
-- Stores quotes created by reps for their clients
-- ============================================
CREATE TABLE IF NOT EXISTS rep_quotes (
  id TEXT PRIMARY KEY,
  rep_id TEXT NOT NULL REFERENCES reps(id),
  client_id TEXT REFERENCES clients(id),

  -- Quote data (serialized QuoteState from Quote Builder)
  quote_data_json TEXT NOT NULL,

  -- Quote metadata
  quote_name TEXT,                    -- Optional friendly name
  quote_number TEXT,                  -- Auto-generated quote number
  total_install_cost REAL,            -- Cached total for quick display
  total_monthly_cost REAL,            -- Cached monthly support cost
  location_count INTEGER DEFAULT 1,   -- Number of locations in quote

  -- Status workflow
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',      -- Being edited
    'sent',       -- Sent to client
    'viewed',     -- Client has viewed
    'accepted',   -- Client accepted
    'declined',   -- Client declined
    'expired',    -- Quote expired
    'superseded'  -- Replaced by newer quote
  )),

  -- Timestamps
  sent_at INTEGER,
  viewed_at INTEGER,
  expires_at INTEGER,
  accepted_at INTEGER,
  declined_at INTEGER,

  -- Client response
  client_response_notes TEXT,         -- Notes from client when accepting/declining

  -- Rep notes
  notes TEXT,

  -- Superseded tracking
  supersedes_quote_id TEXT,           -- If this replaces an older quote
  superseded_by_quote_id TEXT,        -- If this was replaced by newer quote

  -- Email tracking
  last_email_sent_at INTEGER,
  email_send_count INTEGER DEFAULT 0,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_rep_quotes_rep ON rep_quotes(rep_id);
CREATE INDEX IF NOT EXISTS idx_rep_quotes_client ON rep_quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_rep_quotes_status ON rep_quotes(status);
CREATE INDEX IF NOT EXISTS idx_rep_quotes_created ON rep_quotes(created_at);

-- ============================================
-- ADD LEAD SOURCE TRACKING TO RESTAURANT_LEADS
-- ============================================

-- Track which rep sourced this lead
ALTER TABLE restaurant_leads ADD COLUMN source_rep_id TEXT REFERENCES reps(id);

-- Track if converted from intel submission
ALTER TABLE restaurant_leads ADD COLUMN converted_from_intel_id TEXT;

-- Add lead stage for pipeline tracking
ALTER TABLE restaurant_leads ADD COLUMN lead_stage TEXT DEFAULT 'new';
-- Note: SQLite doesn't support CHECK on ALTER TABLE, so we'll enforce in app:
-- ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost')

-- Track stage changes
ALTER TABLE restaurant_leads ADD COLUMN stage_changed_at INTEGER;
ALTER TABLE restaurant_leads ADD COLUMN stage_changed_by TEXT;  -- rep_id or 'admin'

-- Days in current stage (computed, but useful to store)
ALTER TABLE restaurant_leads ADD COLUMN days_in_stage INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_leads_source_rep ON restaurant_leads(source_rep_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON restaurant_leads(lead_stage);
CREATE INDEX IF NOT EXISTS idx_leads_converted_intel ON restaurant_leads(converted_from_intel_id);

-- ============================================
-- REP REFERRAL CREDITS TABLE
-- Tracks bonuses, commissions, and credits earned by reps
-- ============================================
CREATE TABLE IF NOT EXISTS rep_referral_credits (
  id TEXT PRIMARY KEY,
  rep_id TEXT NOT NULL REFERENCES reps(id),

  -- Associated entities
  client_id TEXT REFERENCES clients(id),
  lead_id TEXT,                       -- Reference to restaurant_leads if applicable
  quote_id TEXT REFERENCES rep_quotes(id),
  project_id TEXT,                    -- Reference to projects if applicable

  -- Credit details
  credit_type TEXT NOT NULL CHECK (credit_type IN (
    'referral_bonus',       -- New client referral bonus
    'project_commission',   -- Commission on project work
    'support_plan_bonus',   -- Bonus for client signing support plan
    'upsell_commission',    -- Commission on upsells
    'lead_conversion',      -- Bonus for converting lead to client
    'recurring_bonus'       -- Monthly/quarterly recurring bonus
  )),

  amount REAL NOT NULL,
  description TEXT,

  -- Status workflow
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',    -- Awaiting approval
    'approved',   -- Approved, awaiting payment
    'paid',       -- Payment sent
    'voided'      -- Cancelled/reversed
  )),

  -- Approval tracking
  approved_by TEXT,
  approved_at INTEGER,
  approval_notes TEXT,

  -- Payment tracking
  invoice_id TEXT,                    -- Square/Stripe invoice if applicable
  payment_method TEXT,                -- 'check', 'ach', 'credit_balance', etc.
  paid_at INTEGER,
  payment_reference TEXT,             -- Check number, transaction ID, etc.

  -- For recurring bonuses
  period_start INTEGER,
  period_end INTEGER,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_referral_credits_rep ON rep_referral_credits(rep_id);
CREATE INDEX IF NOT EXISTS idx_referral_credits_client ON rep_referral_credits(client_id);
CREATE INDEX IF NOT EXISTS idx_referral_credits_status ON rep_referral_credits(status);
CREATE INDEX IF NOT EXISTS idx_referral_credits_type ON rep_referral_credits(credit_type);
CREATE INDEX IF NOT EXISTS idx_referral_credits_created ON rep_referral_credits(created_at);

-- ============================================
-- REP ACTIVITY LOG TABLE
-- Tracks important rep actions for the activity feed
-- ============================================
CREATE TABLE IF NOT EXISTS rep_activity_log (
  id TEXT PRIMARY KEY,
  rep_id TEXT NOT NULL REFERENCES reps(id),

  -- Activity type
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'quote_created',
    'quote_sent',
    'quote_accepted',
    'quote_declined',
    'lead_created',
    'lead_stage_changed',
    'lead_converted',
    'client_assigned',
    'ticket_created',
    'ticket_resolved',
    'intel_submitted',
    'credit_earned',
    'credit_paid'
  )),

  -- Associated entities (one or more)
  client_id TEXT REFERENCES clients(id),
  quote_id TEXT REFERENCES rep_quotes(id),
  lead_id TEXT,
  ticket_id TEXT,
  intel_id TEXT,
  credit_id TEXT REFERENCES rep_referral_credits(id),

  -- Activity details
  title TEXT NOT NULL,
  description TEXT,
  metadata_json TEXT,                 -- Additional context

  -- For display
  icon TEXT,                          -- Icon name for UI
  color TEXT,                         -- Color for UI

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_rep_activity_rep ON rep_activity_log(rep_id);
CREATE INDEX IF NOT EXISTS idx_rep_activity_client ON rep_activity_log(client_id);
CREATE INDEX IF NOT EXISTS idx_rep_activity_type ON rep_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_rep_activity_created ON rep_activity_log(created_at DESC);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Rep portfolio stats
CREATE VIEW IF NOT EXISTS v_rep_portfolio_stats AS
SELECT
  r.id as rep_id,
  r.name as rep_name,
  r.slug as rep_slug,
  COUNT(DISTINCT cra.client_id) as total_clients,
  COUNT(DISTINCT CASE WHEN c.support_plan_status = 'active' THEN c.id END) as active_support_clients,
  (SELECT COUNT(*) FROM rep_quotes rq WHERE rq.rep_id = r.id AND rq.status = 'draft') as draft_quotes,
  (SELECT COUNT(*) FROM rep_quotes rq WHERE rq.rep_id = r.id AND rq.status = 'sent') as pending_quotes,
  (SELECT COUNT(*) FROM restaurant_leads rl WHERE rl.source_rep_id = r.id AND rl.lead_stage NOT IN ('won', 'lost')) as leads_in_pipeline,
  (SELECT COALESCE(SUM(rrc.amount), 0) FROM rep_referral_credits rrc WHERE rrc.rep_id = r.id AND rrc.status = 'pending') as pending_credits,
  (SELECT COALESCE(SUM(rrc.amount), 0) FROM rep_referral_credits rrc WHERE rrc.rep_id = r.id AND rrc.status = 'paid') as total_paid_credits
FROM reps r
LEFT JOIN client_rep_assignments cra ON r.id = cra.rep_id
LEFT JOIN clients c ON cra.client_id = c.id
GROUP BY r.id;

-- View: Rep's quote summary
CREATE VIEW IF NOT EXISTS v_rep_quotes_summary AS
SELECT
  rq.*,
  r.name as rep_name,
  r.email as rep_email,
  c.name as client_name,
  c.company as client_company,
  c.slug as client_slug
FROM rep_quotes rq
JOIN reps r ON rq.rep_id = r.id
LEFT JOIN clients c ON rq.client_id = c.id;

-- View: Rep's leads with stage info
CREATE VIEW IF NOT EXISTS v_rep_leads AS
SELECT
  rl.*,
  r.name as rep_name,
  r.email as rep_email,
  ris.subject as intel_subject,
  (unixepoch() - COALESCE(rl.stage_changed_at, rl.created_at)) / 86400 as calculated_days_in_stage
FROM restaurant_leads rl
JOIN reps r ON rl.source_rep_id = r.id
LEFT JOIN rep_intel_submissions ris ON rl.converted_from_intel_id = ris.id
WHERE rl.source_rep_id IS NOT NULL;

-- View: Rep referral credits summary
CREATE VIEW IF NOT EXISTS v_rep_credits_summary AS
SELECT
  rep_id,
  SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
  SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as approved_amount,
  SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount,
  SUM(CASE WHEN status IN ('pending', 'approved', 'paid') THEN amount ELSE 0 END) as total_amount,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count
FROM rep_referral_credits
GROUP BY rep_id;

-- ============================================
-- UPDATE EXISTING DEMO/SEED DATA
-- ============================================

-- Update demo rep assignments with new permissions
UPDATE client_rep_assignments
SET can_quote = 1, can_menu_build = 1, can_create_tickets = 1, can_view_billing = 0
WHERE can_quote IS NULL;
