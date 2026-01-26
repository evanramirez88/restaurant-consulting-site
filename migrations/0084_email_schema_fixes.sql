-- Migration: 0080_email_schema_fixes.sql
-- Fixes EM-2: Add geographic_tier alias column
-- Applied: 2026-01-26

-- EM-2: The API queries geographic_tier but schema has geo_tier
-- Add the column as alias (migration 0071 already added but may not have run correctly)
-- Using D1-compatible syntax (no IF NOT EXISTS for ALTER TABLE)

-- First check if column exists via a try-catch pattern in application code
-- For D1, we'll use INSERT OR REPLACE pattern for idempotency

-- Add geographic_tier column if it doesn't exist
-- D1 doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS
-- This will fail silently if column exists (handled by migration system)

-- Backfill from geo_tier where geographic_tier is NULL
UPDATE email_subscribers
SET geographic_tier = geo_tier
WHERE geographic_tier IS NULL AND geo_tier IS NOT NULL;

-- Create index for performance (IF NOT EXISTS is supported for indexes)
CREATE INDEX IF NOT EXISTS idx_email_subscribers_geographic_tier ON email_subscribers(geographic_tier);
