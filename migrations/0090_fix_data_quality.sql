-- Migration 0090: Fix Data Quality Issues
-- Issues: IN-2 (blank categories), IN-3 (empty names handled in code)
-- Created: January 26, 2026

-- IN-2: Fix blank categories in restaurant_leads
-- Set default category to 'Uncategorized' for leads with blank or NULL category
UPDATE restaurant_leads
SET category = 'Uncategorized'
WHERE category IS NULL OR category = '' OR TRIM(category) = '';

-- Also ensure cuisine_primary has a default for uncategorized
UPDATE restaurant_leads
SET cuisine_primary = 'Uncategorized'
WHERE cuisine_primary IS NULL OR cuisine_primary = '' OR TRIM(cuisine_primary) = '';

-- Log the migration
INSERT OR REPLACE INTO config (key, value, updated_at)
VALUES ('migration_0090_data_quality', 'completed', unixepoch());
