-- ============================================
-- TICKET ENHANCEMENTS MIGRATION
-- Migration: 0033_ticket_enhancements.sql
-- Created: 2026-01-16
--
-- This migration adds:
-- - Visibility controls for internal vs client-facing tickets
-- - Ticket type classification
-- - Rep association
-- - Upsell tracking fields
-- - Milestone automation tables
-- - Portal notification system
-- - Rep intel/lead submission system
-- ============================================

-- ============================================
-- ENHANCE TICKETS TABLE
-- ============================================

-- Add visibility control (client can see, internal admin/rep only, or rep only)
ALTER TABLE tickets ADD COLUMN visibility TEXT DEFAULT 'client'
  CHECK (visibility IN ('client', 'internal', 'rep_only'));

-- Add ticket type for categorization
ALTER TABLE tickets ADD COLUMN ticket_type TEXT DEFAULT 'support'
  CHECK (ticket_type IN ('support', 'project_work', 'internal', 'lead_intel'));

-- Add rep association (which rep is working this ticket)
ALTER TABLE tickets ADD COLUMN rep_id TEXT REFERENCES reps(id);

-- Upsell tracking fields
ALTER TABLE tickets ADD COLUMN is_upsell_opportunity INTEGER DEFAULT 0;
ALTER TABLE tickets ADD COLUMN upsell_type TEXT; -- 'go_live_support', 'training', 'optimization', 'support_plan', 'network_support'
ALTER TABLE tickets ADD COLUMN upsell_prompted_at INTEGER;
ALTER TABLE tickets ADD COLUMN upsell_accepted INTEGER; -- 0 = declined, 1 = accepted, NULL = not responded

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_tickets_visibility ON tickets(visibility);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_type ON tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_tickets_rep ON tickets(rep_id);
CREATE INDEX IF NOT EXISTS idx_tickets_upsell ON tickets(is_upsell_opportunity);

-- ============================================
-- MILESTONE TRIGGERS TABLE
-- Defines automation rules for milestone-based actions
-- ============================================
CREATE TABLE IF NOT EXISTS milestone_triggers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,

  -- Trigger conditions
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'project_status',    -- When project status changes
    'project_progress',  -- When project reaches % completion
    'ticket_status',     -- When ticket status changes
    'date_based',        -- X days before/after a date field
    'custom'             -- Custom condition (evaluated via API)
  )),
  trigger_condition_json TEXT NOT NULL,
  -- Examples:
  -- {"project_type": "installation", "status": "near_completion"}
  -- {"project_type": "menu_build", "progress_gte": 80}
  -- {"field": "support_plan_renews", "days_before": 30}

  -- Action configuration
  action_type TEXT NOT NULL CHECK (action_type IN (
    'email_sequence',       -- Enroll in email sequence
    'portal_notification',  -- Create portal notification
    'create_ticket',        -- Create internal ticket
    'schedule_prompt',      -- Prompt to schedule meeting
    'webhook'               -- Call external webhook
  )),
  action_config_json TEXT NOT NULL,
  -- Examples:
  -- {"sequence_id": "seq_training_upsell_001"}
  -- {"type": "upsell", "title": "Go-Live Support", "action_url": "/portal/{{slug}}/go-live"}
  -- {"ticket_type": "internal", "subject": "Follow up with {{client_name}}"}

  -- Filters
  client_segment TEXT,        -- Only apply to specific segment
  support_plan_tier TEXT,     -- Only apply to specific plan tier

  -- Settings
  enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0, -- Higher = processed first
  cooldown_days INTEGER DEFAULT 0, -- Don't re-trigger within X days

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_triggers_type ON milestone_triggers(trigger_type);
CREATE INDEX IF NOT EXISTS idx_triggers_enabled ON milestone_triggers(enabled);

-- ============================================
-- MILESTONE EVENTS TABLE
-- Tracks when triggers fire and actions taken
-- ============================================
CREATE TABLE IF NOT EXISTS milestone_events (
  id TEXT PRIMARY KEY,
  trigger_id TEXT NOT NULL REFERENCES milestone_triggers(id),

  -- Associated entities
  client_id TEXT REFERENCES clients(id),
  project_id TEXT REFERENCES projects(id),
  ticket_id TEXT REFERENCES tickets(id),

  -- Event details
  event_type TEXT NOT NULL,
  event_data_json TEXT, -- Snapshot of data at trigger time

  -- Action tracking
  action_type TEXT,
  action_taken TEXT,        -- What was actually done
  action_result TEXT,       -- success, failed, skipped
  action_result_detail TEXT,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'skipped')),
  processed_at INTEGER,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_events_trigger ON milestone_events(trigger_id);
CREATE INDEX IF NOT EXISTS idx_events_client ON milestone_events(client_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON milestone_events(status);
CREATE INDEX IF NOT EXISTS idx_events_created ON milestone_events(created_at);

-- ============================================
-- PORTAL NOTIFICATIONS TABLE
-- Client-facing notifications in their portal
-- ============================================
CREATE TABLE IF NOT EXISTS portal_notifications (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Notification content
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'info',            -- General information
    'action_required', -- Needs client action
    'upsell',          -- Service upgrade offer
    'milestone',       -- Project milestone reached
    'system',          -- System notification
    'reminder'         -- Scheduled reminder
  )),
  title TEXT NOT NULL,
  body TEXT,

  -- Action button (optional)
  action_url TEXT,
  action_label TEXT,

  -- Upsell-specific fields
  upsell_product_id TEXT,    -- Reference to product/service being offered
  upsell_amount REAL,        -- Price of the upsell
  upsell_discount_pct REAL,  -- Any discount being offered

  -- Status
  is_read INTEGER DEFAULT 0,
  read_at INTEGER,
  is_dismissed INTEGER DEFAULT 0,
  dismissed_at INTEGER,
  is_actioned INTEGER DEFAULT 0, -- Did they click the action?
  actioned_at INTEGER,

  -- Scheduling
  display_after INTEGER,     -- Don't show until this timestamp
  expires_at INTEGER,        -- Auto-dismiss after this timestamp

  -- Source tracking
  source_type TEXT,          -- 'trigger', 'manual', 'system'
  source_id TEXT,            -- Reference to trigger_id or admin who created

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_notif_client ON portal_notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_notif_type ON portal_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notif_read ON portal_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notif_expires ON portal_notifications(expires_at);

-- ============================================
-- REP INTEL SUBMISSIONS TABLE
-- Reps can submit leads, market intelligence, opportunities
-- ============================================
CREATE TABLE IF NOT EXISTS rep_intel_submissions (
  id TEXT PRIMARY KEY,
  rep_id TEXT NOT NULL REFERENCES reps(id),

  -- Submission type
  submission_type TEXT NOT NULL CHECK (submission_type IN (
    'lead',           -- New potential client
    'market_intel',   -- Market/competitor information
    'competitor_info',-- Specific competitor intel
    'opportunity',    -- Upsell opportunity for existing client
    'feedback'        -- General feedback/suggestions
  )),

  -- Basic info
  subject TEXT NOT NULL,
  body TEXT,

  -- Lead/opportunity details
  restaurant_name TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  location TEXT,
  city TEXT,
  state TEXT,

  -- Business intelligence
  current_pos TEXT,
  current_pos_issues TEXT,    -- Pain points with current system
  estimated_stations INTEGER,
  estimated_value REAL,

  -- Urgency/timing
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'hot')),
  best_time_to_contact TEXT,
  decision_timeline TEXT,     -- 'immediate', '30_days', '90_days', 'researching'

  -- Attachments
  attachments_json TEXT, -- Array of {name, url, type}

  -- For opportunities (existing client upsells)
  client_id TEXT REFERENCES clients(id),
  opportunity_type TEXT,      -- 'go_live_support', 'training', 'add_locations', etc.

  -- Admin review
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',    -- Awaiting review
    'reviewed',   -- Reviewed but not yet actioned
    'converted',  -- Converted to lead/ticket/opportunity
    'rejected',   -- Not valid or duplicate
    'archived'    -- Kept for reference but no action
  )),
  admin_notes TEXT,
  reviewed_by TEXT,
  reviewed_at INTEGER,

  -- Conversion tracking
  converted_to_lead_id TEXT,  -- If converted to restaurant_leads
  converted_to_client_id TEXT,-- If became a client
  converted_to_ticket_id TEXT,-- If created as internal ticket

  -- Rep attribution
  commission_eligible INTEGER DEFAULT 1,
  commission_rate REAL,
  commission_paid INTEGER DEFAULT 0,
  commission_paid_at INTEGER,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_intel_rep ON rep_intel_submissions(rep_id);
CREATE INDEX IF NOT EXISTS idx_intel_type ON rep_intel_submissions(submission_type);
CREATE INDEX IF NOT EXISTS idx_intel_status ON rep_intel_submissions(status);
CREATE INDEX IF NOT EXISTS idx_intel_urgency ON rep_intel_submissions(urgency);
CREATE INDEX IF NOT EXISTS idx_intel_created ON rep_intel_submissions(created_at);

-- ============================================
-- SEED DEFAULT MILESTONE TRIGGERS
-- ============================================

-- Trigger: Installation near completion - offer go-live support
INSERT OR IGNORE INTO milestone_triggers (
  id, name, description, trigger_type, trigger_condition_json,
  action_type, action_config_json, enabled
) VALUES (
  'trig_install_80pct',
  'Installation Near Completion',
  'When installation reaches 80%, prompt for go-live support',
  'project_progress',
  '{"project_type": "installation", "progress_gte": 80}',
  'portal_notification',
  '{"notification_type": "upsell", "title": "Go-Live Support Available", "body": "Your installation is almost complete! Would you like on-site support for your go-live date?", "action_label": "Learn More", "action_url": "/portal/{{slug}}/services/go-live-support", "upsell_product_id": "go_live_support"}',
  1
);

-- Trigger: Menu build complete - offer training
INSERT OR IGNORE INTO milestone_triggers (
  id, name, description, trigger_type, trigger_condition_json,
  action_type, action_config_json, enabled
) VALUES (
  'trig_menu_complete',
  'Menu Build Complete',
  'When menu build is marked complete, offer staff training',
  'project_status',
  '{"project_type": "menu_build", "status": "completed"}',
  'portal_notification',
  '{"notification_type": "upsell", "title": "Staff Training Available", "body": "Your menu is ready! Want us to train your team on the new system?", "action_label": "Schedule Training", "action_url": "/portal/{{slug}}/services/training", "upsell_product_id": "staff_training"}',
  1
);

-- Trigger: Support plan renewal 30 days out
INSERT OR IGNORE INTO milestone_triggers (
  id, name, description, trigger_type, trigger_condition_json,
  action_type, action_config_json, enabled, cooldown_days
) VALUES (
  'trig_renewal_30d',
  'Support Plan Renewal 30 Days',
  'Notify client 30 days before support plan renews',
  'date_based',
  '{"field": "support_plan_renews", "days_before": 30}',
  'portal_notification',
  '{"notification_type": "action_required", "title": "Support Plan Renews Soon", "body": "Your Restaurant Guardian support plan renews in 30 days. Review your plan or upgrade?", "action_label": "Review Plan", "action_url": "/portal/{{slug}}/support-plan"}',
  1,
  30
);

-- Trigger: Support plan renewal 7 days out - create follow-up ticket
INSERT OR IGNORE INTO milestone_triggers (
  id, name, description, trigger_type, trigger_condition_json,
  action_type, action_config_json, enabled, cooldown_days
) VALUES (
  'trig_renewal_7d_ticket',
  'Support Plan Renewal 7 Days - Internal Ticket',
  'Create internal ticket to follow up with client before renewal',
  'date_based',
  '{"field": "support_plan_renews", "days_before": 7}',
  'create_ticket',
  '{"visibility": "internal", "ticket_type": "internal", "subject": "Renewal follow-up: {{client_name}}", "description": "Support plan renews in 7 days. Check if client has questions or wants to upgrade.", "priority": "normal", "category": "billing"}',
  1,
  30
);

-- Trigger: Project completed - satisfaction check
INSERT OR IGNORE INTO milestone_triggers (
  id, name, description, trigger_type, trigger_condition_json,
  action_type, action_config_json, enabled
) VALUES (
  'trig_project_complete',
  'Project Completed - Satisfaction Check',
  'When any project is marked completed, send satisfaction survey',
  'project_status',
  '{"status": "completed"}',
  'email_sequence',
  '{"sequence_id": "seq_satisfaction_survey_001"}',
  1
);

-- Trigger: High-value ticket resolved - follow-up
INSERT OR IGNORE INTO milestone_triggers (
  id, name, description, trigger_type, trigger_condition_json,
  action_type, action_config_json, enabled
) VALUES (
  'trig_ticket_resolved_followup',
  'Ticket Resolved Follow-up',
  'When urgent ticket is resolved, create follow-up notification',
  'ticket_status',
  '{"priority": "urgent", "status": "resolved"}',
  'portal_notification',
  '{"notification_type": "info", "title": "Issue Resolved", "body": "Your urgent support request has been resolved. Please let us know if you need anything else!", "action_label": "Give Feedback", "action_url": "/portal/{{slug}}/feedback"}',
  1
);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Client-visible tickets only
CREATE VIEW IF NOT EXISTS v_client_tickets AS
SELECT t.*, c.name as client_name, c.company as client_company, c.slug as client_slug
FROM tickets t
JOIN clients c ON t.client_id = c.id
WHERE t.visibility = 'client';

-- View: Internal tickets (admin/rep only)
CREATE VIEW IF NOT EXISTS v_internal_tickets AS
SELECT t.*, c.name as client_name, c.company as client_company, c.slug as client_slug,
       r.name as rep_name, r.email as rep_email
FROM tickets t
LEFT JOIN clients c ON t.client_id = c.id
LEFT JOIN reps r ON t.rep_id = r.id
WHERE t.visibility IN ('internal', 'rep_only');

-- View: Unread notifications by client
CREATE VIEW IF NOT EXISTS v_unread_notifications AS
SELECT pn.*, c.name as client_name, c.slug as client_slug
FROM portal_notifications pn
JOIN clients c ON pn.client_id = c.id
WHERE pn.is_read = 0
  AND pn.is_dismissed = 0
  AND (pn.expires_at IS NULL OR pn.expires_at > unixepoch())
  AND (pn.display_after IS NULL OR pn.display_after <= unixepoch());

-- View: Pending intel submissions
CREATE VIEW IF NOT EXISTS v_pending_intel AS
SELECT ris.*, r.name as rep_name, r.email as rep_email, r.territory as rep_territory
FROM rep_intel_submissions ris
JOIN reps r ON ris.rep_id = r.id
WHERE ris.status = 'pending'
ORDER BY
  CASE ris.urgency
    WHEN 'hot' THEN 1
    WHEN 'high' THEN 2
    WHEN 'normal' THEN 3
    WHEN 'low' THEN 4
  END,
  ris.created_at ASC;
