-- Scheduled Bookings Table
-- Migration: 0040_scheduled_bookings.sql
-- Created: 2026-01-17
-- Purpose: Store Cal.com bookings for tracking and follow-up

-- ============================================
-- SCHEDULED BOOKINGS TABLE
-- Stores booking events from Cal.com webhooks
-- ============================================
CREATE TABLE IF NOT EXISTS scheduled_bookings (
  id TEXT PRIMARY KEY,                    -- Cal.com booking UID

  -- Contact info
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  company TEXT,

  -- Booking details
  title TEXT,                             -- Meeting type/title
  start_time TEXT,                        -- ISO 8601 datetime
  end_time TEXT,                          -- ISO 8601 datetime
  timezone TEXT DEFAULT 'America/New_York',

  -- Status tracking
  status TEXT DEFAULT 'confirmed' CHECK (status IN (
    'confirmed',                          -- Booking confirmed
    'cancelled',                          -- Booking cancelled
    'rescheduled',                        -- Booking rescheduled (links to new booking)
    'completed',                          -- Meeting occurred
    'no_show'                             -- Attendee didn't show
  )),

  -- Related records
  rescheduled_to TEXT,                    -- ID of new booking if rescheduled
  lead_id TEXT,                           -- Link to restaurant_leads
  client_id TEXT,                         -- Link to clients table
  subscriber_id TEXT,                     -- Link to email_subscribers

  -- Metadata
  notes TEXT,                             -- Meeting description/notes
  calcom_event_type TEXT,                 -- Cal.com event type slug
  calcom_payload TEXT,                    -- Full webhook payload JSON

  -- Timestamps
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_email ON scheduled_bookings(email);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON scheduled_bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_start ON scheduled_bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON scheduled_bookings(created_at DESC);
