-- Migration: Intelligence Business Intel Fields
-- Adds fields from the demo prototype for comprehensive restaurant profiles
-- Includes: license info, health inspection, seasonality, location history

-- Add license and compliance fields
ALTER TABLE restaurant_leads ADD COLUMN license_number TEXT;
ALTER TABLE restaurant_leads ADD COLUMN license_type TEXT; -- Common Victualler, Liquor (Full), Liquor (Beer/Wine), Seasonal
ALTER TABLE restaurant_leads ADD COLUMN health_score INTEGER; -- 0-100 health inspection score
ALTER TABLE restaurant_leads ADD COLUMN last_inspection_date TEXT; -- ISO date string
ALTER TABLE restaurant_leads ADD COLUMN seasonal INTEGER DEFAULT 0; -- 0=year-round, 1=seasonal

-- Create location_history table to track past businesses at same address
CREATE TABLE IF NOT EXISTS location_history (
  id TEXT PRIMARY KEY,
  restaurant_lead_id TEXT NOT NULL,
  period TEXT NOT NULL, -- e.g., "1979-Present", "1940s-1978"
  name TEXT NOT NULL, -- Name of the business during that period
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (restaurant_lead_id) REFERENCES restaurant_leads(id)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_location_history_lead ON location_history(restaurant_lead_id);

-- Create intelligence_facts table for the triage/review system
CREATE TABLE IF NOT EXISTS intelligence_facts (
  id TEXT PRIMARY KEY,
  restaurant_lead_id TEXT, -- NULL if new restaurant
  field TEXT NOT NULL, -- The field being updated
  value TEXT, -- The new value (JSON for complex types)
  original_text TEXT, -- The raw source text
  confidence REAL DEFAULT 0.5, -- AI confidence score 0.0-1.0
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  source TEXT, -- Where this fact came from
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  reviewed_at INTEGER,
  reviewed_by TEXT,
  FOREIGN KEY (restaurant_lead_id) REFERENCES restaurant_leads(id)
);

-- Create index for pending facts queue
CREATE INDEX IF NOT EXISTS idx_intelligence_facts_status ON intelligence_facts(status);
CREATE INDEX IF NOT EXISTS idx_intelligence_facts_lead ON intelligence_facts(restaurant_lead_id);
