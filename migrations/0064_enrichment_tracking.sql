-- Migration: 0064_enrichment_tracking.sql
-- Description: Add verification and gap analysis tracking to leads

-- 1. Verification Status
ALTER TABLE restaurant_leads ADD COLUMN verification_status TEXT DEFAULT 'unverified'; -- unverified, partial, verified, trusted
ALTER TABLE restaurant_leads ADD COLUMN gap_analysis_json TEXT; -- JSON object describing missing fields
ALTER TABLE restaurant_leads ADD COLUMN last_verified_at INTEGER;
ALTER TABLE restaurant_leads ADD COLUMN data_quality_score INTEGER DEFAULT 0;

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_leads_verification ON restaurant_leads(verification_status);
CREATE INDEX IF NOT EXISTS idx_leads_quality ON restaurant_leads(data_quality_score);
