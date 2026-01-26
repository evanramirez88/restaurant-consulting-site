-- Migration: 0083_fix_goal_milestones.sql
-- Fixes BB-5: Remove invalid Feb 29, 2026 (2026 is not a leap year)
-- Applied: 2026-01-26

-- 2026 Milestone Dates (Unix timestamps):
-- Feb 1, 2026 = 1769904000
-- Feb 28, 2026 = 1772236800 (NOT Feb 29!)
-- Mar 1, 2026 = 1772323200
-- Apr 1, 2026 = 1775001600
-- May 1, 2026 = 1777593600

-- Fix any Feb 29 dates (would be around 1772150400)
UPDATE goal_milestones
SET target_date = 1772236800,
    description = REPLACE(description, 'Feb 29', 'Feb 28')
WHERE target_date BETWEEN 1772140000 AND 1772200000;

-- Verify $400K goal deadline is May 1, 2026
UPDATE business_goals
SET deadline = 1777593600,
    updated_at = unixepoch()
WHERE id = 'goal_400k_may';
