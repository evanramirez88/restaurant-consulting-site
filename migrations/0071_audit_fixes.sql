-- Migration 0071: Platform Audit Fixes
-- Fixes: EM-2 (geographic_tier column), BB-5 (milestone dates), CF-1 (business_rates table)

-- CF-1: Create business_rates table (API references it but it didn't exist)
CREATE TABLE IF NOT EXISTS business_rates (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch())
);

-- EM-2: Add geographic_tier column to email_subscribers
-- The API code uses geographic_tier but the schema has geo_tier
ALTER TABLE email_subscribers ADD COLUMN geographic_tier TEXT;

-- Copy any existing geo_tier data to the new column
UPDATE email_subscribers SET geographic_tier = geo_tier WHERE geo_tier IS NOT NULL AND geographic_tier IS NULL;

-- BB-5: Fix goal milestone dates (were 2024, should be 2026)
-- Feb 1, 2026 = 1769904000
-- Mar 1, 2026 = 1772323200
-- Apr 1, 2026 = 1775001600
-- May 1, 2026 = 1777593600
UPDATE goal_milestones SET target_date = 1769904000 WHERE id = 'ms_400k_feb';
UPDATE goal_milestones SET target_date = 1772323200 WHERE id = 'ms_400k_mar';
UPDATE goal_milestones SET target_date = 1775001600 WHERE id = 'ms_400k_apr';
UPDATE goal_milestones SET target_date = 1777593600 WHERE id = 'ms_400k_may';

-- Also fix the goal deadline itself to May 1, 2026
UPDATE business_goals SET deadline = 1777593600, updated_at = unixepoch() WHERE deadline IN (1706745600, 1709251200, 1711929600, 1714521600);
