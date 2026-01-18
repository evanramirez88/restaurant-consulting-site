-- Lead Conversions Tracking Table
-- Migration: 0041_lead_conversions.sql
-- Created: 2026-01-17
-- Purpose: Track lead-to-client conversion metrics

-- ============================================
-- LEAD CONVERSIONS TABLE
-- Records conversion events for analytics
-- ============================================
CREATE TABLE IF NOT EXISTS lead_conversions (
  id TEXT PRIMARY KEY,

  -- Related records
  lead_id TEXT NOT NULL,                  -- Original lead ID
  client_id TEXT NOT NULL,                -- Created client ID
  converted_by TEXT,                      -- User who performed conversion

  -- Conversion metadata
  conversion_source TEXT DEFAULT 'direct' CHECK (conversion_source IN (
    'direct',                             -- Admin converted manually
    'rep_portal',                         -- Rep converted
    'automation',                         -- Auto-converted by system
    'stripe_checkout'                     -- Converted via Stripe checkout
  )),

  -- Deal information
  initial_deal_value REAL DEFAULT 0,      -- Initial deal value
  deal_type TEXT,                         -- Type of deal (support_plan, project, etc.)

  -- Metrics at time of conversion
  lead_score_at_conversion INTEGER,       -- Lead score when converted
  segment_at_conversion TEXT,             -- Segment lead was in
  days_in_pipeline INTEGER,               -- Days from lead creation to conversion
  touchpoints_count INTEGER DEFAULT 0,    -- Number of interactions before conversion

  -- Notes
  notes TEXT,

  -- Timestamps
  converted_at INTEGER DEFAULT (unixepoch()),
  created_at INTEGER DEFAULT (unixepoch())
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_conversions_lead ON lead_conversions(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversions_client ON lead_conversions(client_id);
CREATE INDEX IF NOT EXISTS idx_conversions_converted_at ON lead_conversions(converted_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversions_source ON lead_conversions(conversion_source);
