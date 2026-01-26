# Database Fixes Plan
## D1 Schema Corrections and Data Integrity
**Created:** January 26, 2026
**Priority:** CRITICAL

---

## Issues Addressed

| ID | Severity | Issue | Root Cause |
|----|----------|-------|------------|
| EM-2 | CRITICAL | `no such column: geographic_tier` in Subscribers tab | Column exists as `geo_tier`, API queries `geographic_tier` |
| EM-3 | CRITICAL | `no such table: subscribers` in Errors tab | Query references `subscribers` but table is `email_subscribers` |
| CF-1 | HIGH | Business rates mismatch ($110/$80/$100 vs $175/$250/$200) | `business_rates` table has wrong values |
| BB-5 | MEDIUM | Feb 29 milestone in non-leap year 2026 | `goal_milestones` has invalid dates |

---

## Migration 1: Email Column Fixes (0080)

**File:** `migrations/0080_email_schema_fixes.sql`

```sql
-- Migration: 0080_email_schema_fixes.sql
-- Fixes EM-2: Add geographic_tier alias column
-- Applied: 2026-01-26

-- EM-2: The API queries geographic_tier but schema has geo_tier
-- Add the column as alias (migration 0071 already added but may not have run)
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS geographic_tier TEXT;

-- Backfill from geo_tier
UPDATE email_subscribers
SET geographic_tier = geo_tier
WHERE geographic_tier IS NULL AND geo_tier IS NOT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_email_subscribers_geo_tier ON email_subscribers(geographic_tier);
```

---

## Migration 2: Create Subscribers View (0081)

**File:** `migrations/0081_subscribers_view.sql`

```sql
-- Migration: 0081_subscribers_view.sql
-- Fixes EM-3: Create view to alias email_subscribers as subscribers
-- Applied: 2026-01-26

-- EM-3: Errors tab queries non-existent 'subscribers' table
-- Create a view that aliases email_subscribers
CREATE VIEW IF NOT EXISTS subscribers AS
SELECT
  id,
  email,
  first_name,
  last_name,
  status,
  lead_source,
  geographic_tier,
  geo_tier,
  subscribed_at,
  created_at,
  updated_at,
  bounced_at,
  complained_at,
  converted_at
FROM email_subscribers;
```

---

## Migration 3: Fix Business Rates (0082)

**File:** `migrations/0082_fix_business_rates.sql`

```sql
-- Migration: 0082_fix_business_rates.sql
-- Fixes CF-1: Correct business rates to match CLAUDE.md documented values
-- Applied: 2026-01-26

-- CF-1: Config shows wrong rates
-- Correct values per CLAUDE.md:
-- - Non-plan: $175/hr
-- - On-site: $200/hr (2hr min)
-- - Emergency: $250/hr

UPDATE business_rates SET value = '175', updated_at = unixepoch() WHERE key = 'standard_hourly';
UPDATE business_rates SET value = '250', updated_at = unixepoch() WHERE key = 'emergency_rate';
UPDATE business_rates SET value = '200', updated_at = unixepoch() WHERE key = 'onsite_rate';
UPDATE business_rates SET value = '175', updated_at = unixepoch() WHERE key = 'consultation';

-- Also add Plan Overage rate
INSERT OR REPLACE INTO business_rates (key, value, updated_at)
VALUES ('plan_overage', '100', unixepoch());
```

---

## Migration 4: Fix Goal Milestones (0083)

**File:** `migrations/0083_fix_goal_milestones.sql`

```sql
-- Migration: 0083_fix_goal_milestones.sql
-- Fixes BB-5: Remove invalid Feb 29, 2026 (2026 is not a leap year)
-- Applied: 2026-01-26

-- 2026 Milestone Dates (Unix timestamps):
-- Feb 1, 2026 = 1769904000
-- Feb 28, 2026 = 1772236800 (NOT Feb 29!)
-- Mar 1, 2026 = 1772323200
-- Apr 1, 2026 = 1775001600
-- May 1, 2026 = 1777593600

-- Fix any Feb 29 dates (would be ~1772150400)
UPDATE goal_milestones
SET target_date = 1772236800, -- Feb 28, 2026
    description = REPLACE(description, 'Feb 29', 'Feb 28')
WHERE target_date BETWEEN 1772140000 AND 1772200000;

-- Verify $400K goal deadline is May 1, 2026
UPDATE business_goals
SET deadline = 1777593600,
    updated_at = unixepoch()
WHERE id = 'goal_400k_may';
```

---

## API Fixes Required

### 1. Subscribers Tab Query Fix

**File:** `functions/api/admin/email/subscribers/index.js`

**Current Issue:** Queries `geographic_tier` column directly

**Fix:** After migration runs, no code change needed. Column will exist.

### 2. Errors Tab Query Fix

**File:** `functions/api/admin/email/errors/index.js`

**Current Issue (line 98-99):**
```javascript
LEFT JOIN email_subscribers s ON el.subscriber_id = s.id
```

**Already Correct!** The query uses `email_subscribers` (correct table name). The issue is the JOIN in the [id].js file:

**File:** `functions/api/admin/email/errors/[id].js` (lines 147-149)

**Current (WRONG):**
```javascript
JOIN subscribers s ON el.subscriber_id = s.id
```

**Fix:**
```javascript
JOIN email_subscribers s ON el.subscriber_id = s.id
```

---

## Execution Order

1. **Backup current D1 state**
   ```bash
   npx wrangler d1 execute restaurant-consulting-db --command="SELECT * FROM email_subscribers LIMIT 5" --remote
   ```

2. **Apply migrations in order**
   ```bash
   cd restaurant-consulting-site
   npx wrangler d1 migrations apply restaurant-consulting-db --remote
   ```

3. **Verify fixes**
   ```bash
   # Test geographic_tier column
   npx wrangler d1 execute restaurant-consulting-db --command="SELECT id, email, geographic_tier FROM email_subscribers LIMIT 3" --remote

   # Test subscribers view
   npx wrangler d1 execute restaurant-consulting-db --command="SELECT COUNT(*) FROM subscribers" --remote

   # Test business rates
   npx wrangler d1 execute restaurant-consulting-db --command="SELECT * FROM business_rates" --remote
   ```

4. **Update errors/[id].js JOIN**
   - Edit file to use `email_subscribers` instead of `subscribers`
   - Deploy: `npx wrangler pages deploy dist`

---

## Verification Checklist

- [ ] Subscribers tab loads without D1 error
- [ ] Errors tab loads without D1 error
- [ ] Business rates in Config show: $175, $250, $200
- [ ] Strategy milestones don't show Feb 29

---

## Rollback Plan

If migrations fail:

```sql
-- Rollback 0080: Drop column if causes issues
ALTER TABLE email_subscribers DROP COLUMN geographic_tier;

-- Rollback 0081: Drop view
DROP VIEW IF EXISTS subscribers;

-- Rollback 0082: Restore old rates (not recommended)
-- Keep documented rates

-- Rollback 0083: Manual milestone date fixes
-- Keep corrected dates
```

---

*Author: Claude Opus 4.5*
*For: R&G Consulting Platform*
