-- Migration: 0018_contract_events
-- Description: Create contract_events table for PandaDoc webhook logging
-- Created: 2026-01-08

-- ============================================
-- CONTRACT EVENTS TABLE
-- Logs PandaDoc document lifecycle events
-- ============================================

CREATE TABLE IF NOT EXISTS contract_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  contract_id TEXT NOT NULL,              -- PandaDoc document ID
  event_type TEXT NOT NULL,               -- state_change, invoice_created, viewed, declined
  status TEXT,                            -- Document status (completed, active, cancelled, etc.)
  metadata TEXT,                          -- JSON metadata (e.g., invoice_id for invoice_created)
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),

  -- Indexes for common queries
  CONSTRAINT valid_event_type CHECK (event_type IN ('state_change', 'invoice_created', 'viewed', 'declined', 'sent', 'signed'))
);

-- Index for looking up events by contract
CREATE INDEX IF NOT EXISTS idx_contract_events_contract_id ON contract_events(contract_id);

-- Index for filtering by event type
CREATE INDEX IF NOT EXISTS idx_contract_events_type ON contract_events(event_type);

-- Index for chronological queries
CREATE INDEX IF NOT EXISTS idx_contract_events_created ON contract_events(created_at DESC);
