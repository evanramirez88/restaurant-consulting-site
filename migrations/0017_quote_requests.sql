-- Quote Requests Table
-- Migration: 0017_quote_requests.sql
-- Created: 2026-01-08
-- Purpose: Formalize quote_requests table that was previously created inline

-- ============================================
-- QUOTE REQUESTS TABLE
-- Stores quote submissions from the Quote Builder
-- ============================================
CREATE TABLE IF NOT EXISTS quote_requests (
  id TEXT PRIMARY KEY,

  -- Contact info
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  restaurant_name TEXT,
  phone TEXT,

  -- Quote data (JSON)
  quote_data TEXT,           -- Full quote configuration
  locations_data TEXT,       -- Locations array JSON
  estimate_data TEXT,        -- Calculated estimate JSON

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',               -- New request, not reviewed
    'contacted',             -- Initial contact made
    'proposal_sent',         -- Formal proposal sent
    'negotiating',           -- In negotiation
    'won',                   -- Converted to client
    'lost',                  -- Did not convert
    'spam'                   -- Marked as spam
  )),

  -- Admin notes
  notes TEXT,
  assigned_to TEXT,          -- Admin user handling the request

  -- Timestamps
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  contacted_at INTEGER,      -- When first contact was made
  closed_at INTEGER          -- When status changed to won/lost
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quote_requests_email ON quote_requests(email);
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_created ON quote_requests(created_at DESC);
