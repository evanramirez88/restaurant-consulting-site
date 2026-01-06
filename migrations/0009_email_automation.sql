-- R&G Consulting - Email Automation System
-- Migration: 0009_email_automation.sql
-- Created: 2026-01-06
--
-- This migration adds support for:
-- - Email drip campaigns with multi-step sequences
-- - A/B testing capabilities with variant tracking
-- - Subscriber management with engagement scoring
-- - POS system and geographic tier segmentation
-- - State machine for sequence progression
-- - Comprehensive delivery tracking and logging

-- ============================================
-- EMAIL_SEQUENCES TABLE (Campaigns)
-- Defines drip campaigns/sequences
-- ============================================
CREATE TABLE IF NOT EXISTS email_sequences (
  id TEXT PRIMARY KEY,

  -- Sequence identification
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,

  -- Sequence settings
  sequence_type TEXT NOT NULL DEFAULT 'drip' CHECK (sequence_type IN (
    'drip',           -- Time-based drip campaign
    'behavior',       -- Triggered by subscriber actions
    'onboarding',     -- New subscriber welcome series
    'reengagement',   -- Win-back inactive subscribers
    'transactional',  -- Order/action confirmations
    'newsletter'      -- Regular scheduled sends
  )),

  -- Targeting criteria (JSON)
  -- {"pos_systems": ["toast", "square"], "geo_tiers": ["tier1", "tier2"], "tags": ["restaurant"]}
  targeting_criteria_json TEXT,

  -- A/B Testing
  ab_test_enabled INTEGER DEFAULT 0,
  ab_test_split_percentage INTEGER DEFAULT 50,  -- Percentage for variant A
  ab_test_winner_metric TEXT CHECK (ab_test_winner_metric IN (
    'open_rate',
    'click_rate',
    'conversion_rate',
    'revenue'
  )),
  ab_test_auto_select_winner INTEGER DEFAULT 0,
  ab_test_min_sample_size INTEGER DEFAULT 100,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'active',
    'paused',
    'completed',
    'archived'
  )),

  -- Scheduling
  start_at INTEGER,
  end_at INTEGER,
  timezone TEXT DEFAULT 'America/New_York',

  -- Send limits
  daily_send_limit INTEGER,
  hourly_send_limit INTEGER,

  -- Unsubscribe settings
  unsubscribe_redirect_url TEXT,

  -- Metadata
  tags_json TEXT,                         -- ["pos-leads", "cold-outreach"]
  notes TEXT,

  -- Audit
  created_by TEXT,
  updated_by TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sequences_status ON email_sequences(status);
CREATE INDEX IF NOT EXISTS idx_sequences_type ON email_sequences(sequence_type);
CREATE INDEX IF NOT EXISTS idx_sequences_slug ON email_sequences(slug);

-- ============================================
-- SEQUENCE_STEPS TABLE (Individual Emails)
-- Each step in a drip campaign
-- ============================================
CREATE TABLE IF NOT EXISTS sequence_steps (
  id TEXT PRIMARY KEY,
  sequence_id TEXT NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,

  -- Step ordering
  step_number INTEGER NOT NULL,
  step_name TEXT,

  -- Delay configuration
  delay_value INTEGER NOT NULL DEFAULT 0,    -- Numeric delay amount
  delay_unit TEXT NOT NULL DEFAULT 'hours' CHECK (delay_unit IN (
    'minutes',
    'hours',
    'days',
    'weeks'
  )),

  -- Trigger conditions (JSON)
  -- {"trigger": "previous_opened", "condition": "equals", "value": true}
  trigger_conditions_json TEXT,

  -- Email content - Variant A (primary)
  subject_a TEXT NOT NULL,
  preview_text_a TEXT,
  body_html_a TEXT,
  body_text_a TEXT,
  from_name_a TEXT DEFAULT 'R&G Consulting',
  from_email_a TEXT,
  reply_to_a TEXT,

  -- Email content - Variant B (A/B testing)
  subject_b TEXT,
  preview_text_b TEXT,
  body_html_b TEXT,
  body_text_b TEXT,
  from_name_b TEXT,
  from_email_b TEXT,
  reply_to_b TEXT,

  -- Template reference (if using templates)
  template_id TEXT,
  template_variables_json TEXT,

  -- Personalization tokens supported
  -- {{first_name}}, {{company}}, {{pos_system}}, {{geo_tier}}, etc.

  -- Send time optimization
  send_time_optimization INTEGER DEFAULT 0,   -- Boolean: optimize send time per subscriber
  preferred_send_hour INTEGER,                -- 0-23, preferred hour to send
  preferred_send_days_json TEXT,              -- ["monday", "tuesday", "wednesday"]

  -- Goal tracking
  goal_type TEXT CHECK (goal_type IN (
    'open',
    'click',
    'reply',
    'conversion',
    'custom'
  )),
  goal_url TEXT,                              -- URL to track for conversion

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',
    'paused',
    'skipped'
  )),

  -- Performance stats (denormalized for quick access)
  total_sent INTEGER DEFAULT 0,
  total_sent_a INTEGER DEFAULT 0,
  total_sent_b INTEGER DEFAULT 0,
  total_opens INTEGER DEFAULT 0,
  total_opens_a INTEGER DEFAULT 0,
  total_opens_b INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_clicks_a INTEGER DEFAULT 0,
  total_clicks_b INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  total_bounces INTEGER DEFAULT 0,
  total_unsubscribes INTEGER DEFAULT 0,
  total_complaints INTEGER DEFAULT 0,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),

  UNIQUE(sequence_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_steps_sequence ON sequence_steps(sequence_id);
CREATE INDEX IF NOT EXISTS idx_steps_status ON sequence_steps(status);

-- ============================================
-- EMAIL_SUBSCRIBERS TABLE (Lead Database)
-- 42,967 leads will be stored here
-- ============================================
CREATE TABLE IF NOT EXISTS email_subscribers (
  id TEXT PRIMARY KEY,

  -- Contact information
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  phone TEXT,

  -- Business details
  restaurant_name TEXT,
  restaurant_type TEXT,               -- 'bar', 'casual', 'fine_dining', 'fast_casual', 'qsr', 'cafe'

  -- POS segmentation
  pos_system TEXT,                    -- 'toast', 'square', 'clover', 'lightspeed', 'aloha', 'micros', 'none', 'unknown'
  pos_satisfaction TEXT CHECK (pos_satisfaction IN ('happy', 'neutral', 'unhappy', 'unknown')),

  -- Geographic segmentation
  city TEXT,
  state TEXT,
  zip TEXT,
  geo_tier TEXT CHECK (geo_tier IN (
    'tier1',          -- Cape Cod / Primary market
    'tier2',          -- Greater Boston / Secondary market
    'tier3',          -- New England / Tertiary market
    'tier4',          -- National / Outside core market
    'unknown'
  )),
  timezone TEXT DEFAULT 'America/New_York',

  -- Lead source tracking
  source TEXT,                        -- 'website', 'referral', 'import', 'event', 'cold', 'toast_rep'
  source_detail TEXT,                 -- More specific: 'toast_abo_scrape', 'trade_show_2024', etc.
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  -- Engagement scoring (0-100)
  engagement_score INTEGER DEFAULT 0,
  engagement_score_updated_at INTEGER,

  -- Engagement metrics (for score calculation)
  total_emails_sent INTEGER DEFAULT 0,
  total_emails_opened INTEGER DEFAULT 0,
  total_emails_clicked INTEGER DEFAULT 0,
  total_emails_replied INTEGER DEFAULT 0,
  last_email_sent_at INTEGER,
  last_email_opened_at INTEGER,
  last_email_clicked_at INTEGER,
  last_email_replied_at INTEGER,

  -- Website activity tracking
  last_website_visit_at INTEGER,
  total_website_visits INTEGER DEFAULT 0,
  pages_viewed_json TEXT,             -- ["quote-builder", "pricing", "about"]

  -- Subscription status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',           -- Receiving emails
    'unsubscribed',     -- Opted out
    'bounced',          -- Hard bounce
    'complained',       -- Marked as spam
    'cleaned',          -- Removed due to inactivity
    'pending'           -- Pending confirmation
  )),

  -- Double opt-in
  confirmed_at INTEGER,
  confirmation_token TEXT,

  -- Unsubscribe tracking
  unsubscribed_at INTEGER,
  unsubscribe_reason TEXT,
  unsubscribe_feedback TEXT,

  -- Bounce tracking
  bounce_type TEXT CHECK (bounce_type IN ('hard', 'soft')),
  bounce_count INTEGER DEFAULT 0,
  last_bounce_at INTEGER,
  bounce_reason TEXT,

  -- Lead qualification
  lead_status TEXT DEFAULT 'new' CHECK (lead_status IN (
    'new',
    'contacted',
    'qualified',
    'opportunity',
    'customer',
    'lost',
    'do_not_contact'
  )),
  lead_score INTEGER DEFAULT 0,       -- Sales-ready score (different from engagement)

  -- CRM linkage
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  hubspot_contact_id TEXT,

  -- Custom fields (JSON)
  custom_fields_json TEXT,            -- Flexible extension point

  -- Tags for segmentation
  tags_json TEXT,                     -- ["pos-interested", "menu-builder-user", "event-attendee"]

  -- Import tracking
  import_batch_id TEXT,
  import_source_file TEXT,
  imported_at INTEGER,

  -- Notes
  notes TEXT,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON email_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON email_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_pos ON email_subscribers(pos_system);
CREATE INDEX IF NOT EXISTS idx_subscribers_geo_tier ON email_subscribers(geo_tier);
CREATE INDEX IF NOT EXISTS idx_subscribers_lead_status ON email_subscribers(lead_status);
CREATE INDEX IF NOT EXISTS idx_subscribers_engagement ON email_subscribers(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_subscribers_source ON email_subscribers(source);
CREATE INDEX IF NOT EXISTS idx_subscribers_state ON email_subscribers(state);
CREATE INDEX IF NOT EXISTS idx_subscribers_client ON email_subscribers(client_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_import ON email_subscribers(import_batch_id);

-- ============================================
-- SUBSCRIBER_SEQUENCES TABLE (Campaign Progress)
-- Tracks each subscriber's position in campaigns
-- ============================================
CREATE TABLE IF NOT EXISTS subscriber_sequences (
  id TEXT PRIMARY KEY,
  subscriber_id TEXT NOT NULL REFERENCES email_subscribers(id) ON DELETE CASCADE,
  sequence_id TEXT NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,

  -- Current position
  current_step_id TEXT REFERENCES sequence_steps(id) ON DELETE SET NULL,
  current_step_number INTEGER DEFAULT 0,

  -- State machine
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued',           -- Waiting to start
    'active',           -- Currently in progress
    'paused',           -- Temporarily paused
    'completed',        -- Finished all steps
    'failed',           -- Error occurred
    'unsubscribed',     -- Subscriber opted out
    'goal_achieved'     -- Conversion goal met
  )),

  -- A/B test assignment
  ab_variant TEXT CHECK (ab_variant IN ('A', 'B')),

  -- Timing
  enrolled_at INTEGER DEFAULT (unixepoch()),
  started_at INTEGER,
  paused_at INTEGER,
  resumed_at INTEGER,
  completed_at INTEGER,
  failed_at INTEGER,

  -- Next step scheduling
  next_step_scheduled_at INTEGER,

  -- Performance tracking
  emails_sent INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  emails_replied INTEGER DEFAULT 0,

  -- Goal tracking
  goal_achieved INTEGER DEFAULT 0,
  goal_achieved_at INTEGER,
  goal_value REAL,                    -- Revenue or custom value

  -- Failure tracking
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at INTEGER,

  -- Metadata
  enrollment_source TEXT,             -- 'manual', 'automation', 'import', 'api'
  enrollment_data_json TEXT,          -- Context at time of enrollment

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),

  UNIQUE(subscriber_id, sequence_id)
);

CREATE INDEX IF NOT EXISTS idx_sub_seq_subscriber ON subscriber_sequences(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_sub_seq_sequence ON subscriber_sequences(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sub_seq_status ON subscriber_sequences(status);
CREATE INDEX IF NOT EXISTS idx_sub_seq_next_step ON subscriber_sequences(next_step_scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sub_seq_current ON subscriber_sequences(current_step_id);

-- ============================================
-- EMAIL_LOGS TABLE (Delivery Tracking)
-- Individual email send records
-- ============================================
CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,

  -- References
  subscriber_id TEXT NOT NULL REFERENCES email_subscribers(id) ON DELETE CASCADE,
  sequence_id TEXT REFERENCES email_sequences(id) ON DELETE SET NULL,
  step_id TEXT REFERENCES sequence_steps(id) ON DELETE SET NULL,
  subscriber_sequence_id TEXT REFERENCES subscriber_sequences(id) ON DELETE SET NULL,

  -- Email identifiers
  message_id TEXT UNIQUE,             -- ESP message ID
  email_to TEXT NOT NULL,
  email_from TEXT,

  -- Content tracking
  subject TEXT,
  ab_variant TEXT CHECK (ab_variant IN ('A', 'B')),

  -- Send type
  send_type TEXT NOT NULL DEFAULT 'sequence' CHECK (send_type IN (
    'sequence',         -- Part of automated sequence
    'broadcast',        -- One-time send to segment
    'transactional',    -- Order confirmation, etc.
    'test'              -- Test/preview send
  )),

  -- Delivery status
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued',           -- Waiting to send
    'sending',          -- Currently being sent
    'sent',             -- Successfully sent
    'delivered',        -- Confirmed delivery
    'opened',           -- Email opened
    'clicked',          -- Link clicked
    'replied',          -- Reply received
    'bounced',          -- Bounced (hard or soft)
    'complained',       -- Marked as spam
    'failed',           -- Send failed
    'suppressed'        -- Not sent due to suppression
  )),

  -- ESP provider tracking
  esp_provider TEXT,                  -- 'sendgrid', 'ses', 'postmark', 'resend'
  esp_batch_id TEXT,
  esp_response_json TEXT,

  -- Timing
  queued_at INTEGER DEFAULT (unixepoch()),
  sent_at INTEGER,
  delivered_at INTEGER,
  first_opened_at INTEGER,
  last_opened_at INTEGER,
  first_clicked_at INTEGER,
  last_clicked_at INTEGER,
  replied_at INTEGER,
  bounced_at INTEGER,
  complained_at INTEGER,
  failed_at INTEGER,

  -- Engagement metrics
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,

  -- Click tracking (JSON array)
  -- [{"url": "https://...", "clicked_at": 1704067200, "count": 2}]
  clicks_json TEXT,

  -- Bounce details
  bounce_type TEXT CHECK (bounce_type IN ('hard', 'soft')),
  bounce_code TEXT,
  bounce_message TEXT,

  -- Failure details
  failure_code TEXT,
  failure_message TEXT,

  -- Device/client tracking
  user_agent TEXT,
  ip_address TEXT,
  email_client TEXT,                  -- 'gmail', 'outlook', 'apple_mail', etc.
  device_type TEXT,                   -- 'desktop', 'mobile', 'tablet'

  -- Unsubscribe tracking
  unsubscribed INTEGER DEFAULT 0,
  unsubscribed_at INTEGER,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_email_logs_subscriber ON email_logs(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sequence ON email_logs(sequence_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_step ON email_logs(step_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_message ON email_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_queued ON email_logs(queued_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(send_type);

-- ============================================
-- EMAIL_TEMPLATES TABLE (Reusable Templates)
-- ============================================
CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,

  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,

  -- Template content
  subject TEXT,
  preview_text TEXT,
  body_html TEXT,
  body_text TEXT,

  -- Default sender
  from_name TEXT DEFAULT 'R&G Consulting',
  from_email TEXT,
  reply_to TEXT,

  -- Template type
  template_type TEXT DEFAULT 'marketing' CHECK (template_type IN (
    'marketing',
    'transactional',
    'notification',
    'system'
  )),

  -- Variables documentation (JSON)
  -- [{"name": "first_name", "required": false, "default": "there"}]
  variables_json TEXT,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),

  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  last_used_at INTEGER,

  -- Audit
  created_by TEXT,
  updated_by TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_templates_slug ON email_templates(slug);
CREATE INDEX IF NOT EXISTS idx_templates_type ON email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_templates_status ON email_templates(status);

-- ============================================
-- EMAIL_SUPPRESSION_LIST TABLE
-- Global suppression for compliance
-- ============================================
CREATE TABLE IF NOT EXISTS email_suppression_list (
  id TEXT PRIMARY KEY,

  email TEXT UNIQUE NOT NULL,

  reason TEXT NOT NULL CHECK (reason IN (
    'unsubscribe',      -- User unsubscribed
    'hard_bounce',      -- Email doesn't exist
    'complaint',        -- Marked as spam
    'manual',           -- Manually added
    'legal',            -- Legal/compliance request
    'role_address'      -- Generic role address (info@, sales@)
  )),

  source TEXT,                        -- Where suppression originated
  notes TEXT,

  suppressed_at INTEGER DEFAULT (unixepoch()),
  expires_at INTEGER,                 -- NULL = permanent

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_suppression_email ON email_suppression_list(email);
CREATE INDEX IF NOT EXISTS idx_suppression_reason ON email_suppression_list(reason);

-- ============================================
-- EMAIL_SEGMENTS TABLE (Subscriber Segments)
-- Dynamic and static subscriber segments
-- ============================================
CREATE TABLE IF NOT EXISTS email_segments (
  id TEXT PRIMARY KEY,

  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,

  -- Segment type
  segment_type TEXT NOT NULL DEFAULT 'dynamic' CHECK (segment_type IN (
    'dynamic',          -- Query-based, recalculated
    'static'            -- Fixed list, manual membership
  )),

  -- Dynamic segment query (JSON)
  -- {"conditions": [{"field": "pos_system", "operator": "equals", "value": "toast"}]}
  query_json TEXT,

  -- Cached count (for dynamic segments)
  cached_count INTEGER DEFAULT 0,
  cached_at INTEGER,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),

  -- Audit
  created_by TEXT,
  updated_by TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_segments_slug ON email_segments(slug);
CREATE INDEX IF NOT EXISTS idx_segments_type ON email_segments(segment_type);

-- ============================================
-- EMAIL_SEGMENT_MEMBERS TABLE (Static Segment Members)
-- ============================================
CREATE TABLE IF NOT EXISTS email_segment_members (
  id TEXT PRIMARY KEY,
  segment_id TEXT NOT NULL REFERENCES email_segments(id) ON DELETE CASCADE,
  subscriber_id TEXT NOT NULL REFERENCES email_subscribers(id) ON DELETE CASCADE,

  added_at INTEGER DEFAULT (unixepoch()),
  added_by TEXT,

  UNIQUE(segment_id, subscriber_id)
);

CREATE INDEX IF NOT EXISTS idx_segment_members_segment ON email_segment_members(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_members_subscriber ON email_segment_members(subscriber_id);

-- ============================================
-- EMAIL_IMPORT_BATCHES TABLE
-- Track bulk imports
-- ============================================
CREATE TABLE IF NOT EXISTS email_import_batches (
  id TEXT PRIMARY KEY,

  name TEXT,
  file_name TEXT,
  file_key TEXT,                      -- R2 storage key

  -- Import stats
  total_rows INTEGER DEFAULT 0,
  successful_imports INTEGER DEFAULT 0,
  failed_imports INTEGER DEFAULT 0,
  duplicate_skips INTEGER DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
  )),

  -- Field mapping (JSON)
  -- {"email": "Email Address", "first_name": "First Name", ...}
  field_mapping_json TEXT,

  -- Default values for imported subscribers
  default_source TEXT DEFAULT 'import',
  default_tags_json TEXT,
  default_geo_tier TEXT,

  -- Error log
  errors_json TEXT,                   -- Array of row errors

  -- Timing
  started_at INTEGER,
  completed_at INTEGER,

  -- Audit
  imported_by TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_import_batches_status ON email_import_batches(status);

-- ============================================
-- FEATURE FLAGS FOR EMAIL SYSTEM
-- ============================================
INSERT OR IGNORE INTO feature_flags (key, enabled, description) VALUES
  ('email_automation_enabled', 0, 'Email automation and drip campaign system'),
  ('email_ab_testing', 0, 'A/B testing for email campaigns'),
  ('email_send_time_optimization', 0, 'AI-powered send time optimization'),
  ('email_engagement_scoring', 1, 'Subscriber engagement scoring system'),
  ('email_import_enabled', 1, 'Bulk email list import functionality');

-- ============================================
-- API CONFIGS FOR EMAIL SERVICES
-- ============================================
INSERT OR IGNORE INTO api_configs (id, service, provider, display_name, is_active) VALUES
  ('api_email_sendgrid', 'email', 'sendgrid', 'SendGrid Email API', 0),
  ('api_email_ses', 'email', 'aws_ses', 'AWS SES Email', 0),
  ('api_email_resend', 'email', 'resend', 'Resend Email API', 0),
  ('api_email_postmark', 'email', 'postmark', 'Postmark Transactional', 0);
