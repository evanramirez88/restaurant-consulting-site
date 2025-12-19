-- Cape Cod Restaurant Consulting - Admin Backend Schema
-- Migration: 0001_init.sql

-- Site configuration key-value store
CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Availability status (singleton table with id=1 constraint)
CREATE TABLE IF NOT EXISTS availability (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('available', 'busy', 'offline')),
  location_type TEXT NOT NULL DEFAULT 'remote' CHECK (location_type IN ('remote', 'onsite', 'both')),
  town TEXT,
  address TEXT,
  walk_ins_accepted INTEGER DEFAULT 0,
  scheduling_available INTEGER DEFAULT 1,
  custom_message TEXT,
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Rate limiting table for login attempts
CREATE TABLE IF NOT EXISTS login_attempts (
  ip_address TEXT PRIMARY KEY,
  attempts INTEGER DEFAULT 0,
  first_attempt INTEGER DEFAULT (unixepoch()),
  last_attempt INTEGER DEFAULT (unixepoch())
);

-- Seed default site configuration values
INSERT OR IGNORE INTO site_config (key, value) VALUES
  ('phone', '774-408-0083'),
  ('email', 'evan@ccrestaurantconsulting.com'),
  ('hourly_rate_remote', '110'),
  ('hourly_rate_onsite', '165'),
  ('business_hours', 'Mon-Sat 8am-6pm');

-- Seed default availability (offline, remote only, scheduling available)
INSERT OR IGNORE INTO availability (id, status, location_type, scheduling_available)
VALUES (1, 'offline', 'remote', 1);
