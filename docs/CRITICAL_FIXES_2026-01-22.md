# Critical Fixes and Improvement Plan
**Date**: 2026-01-22
**Session**: Lead Data Quality Remediation

---

## CRITICAL FAILURES IDENTIFIED

### 1. Lost Credentials
**Impact**: User wasted 4 hours finding Square API key, had to send invoice manually
**Root Cause**: Credentials used but not stored in persistent files
**Fix**: Added mandatory credential protocol to CLAUDE.md

### 2. Resend Webhook 401 Errors
**Impact**: Email tracking non-functional for 4 days
**Root Cause**: Webhook secret not properly deployed/persisted
**Fix**: Deployed secret, stored in .secrets.local.md

### 3. Lead Data Quality (CATASTROPHIC)
**Impact**: ~80-90% of enrolled leads are NOT restaurants
**Root Cause**: Processing script didn't filter by BuiltWith "Vertical" column
**Fix**: Updated process_leads.cjs with restaurant vertical filter

---

## FIXES APPLIED

### process_leads.cjs
Added restaurant vertical filtering:
```javascript
const RESTAURANT_VERTICALS = [
  'Food And Drink',
  'Food and Drink',
  'food and drink',
  'Restaurants',
  'restaurants'
];

// Skip non-restaurant businesses
if (!RESTAURANT_VERTICALS.includes(vertical)) {
  skipped.nonRestaurant++;
  continue;
}
```

### Email Campaigns
- Paused all 481 active/queued sequences
- No emails will send until data is cleaned

### Credential Management
Added to CLAUDE.md:
1. Store FULL credential value in .secrets.local.md
2. Deploy to appropriate service
3. Verify it works
4. Document in CLAUDE.md

---

## DATABASE STATUS

### email_subscribers (Segment A+B)
- Total: 479 records
- Actual restaurants: ~10-15%
- Garbage data: ~85-90%

### subscriber_sequences
- Paused: 516 (all)
- Active: 0
- Queued: 0

---

## RECOMMENDED NEXT STEPS

### Option A: Full Database Purge (Recommended)
1. Delete all records from email_subscribers where segment IN ('A', 'B')
2. Delete all records from restaurant_leads where source_file = 'top500_contactable.csv'
3. Re-run process_leads.cjs with the new filter
4. Import clean leads
5. Manual verification before any email sends

### Option B: Data Cleaning
1. Query for leads where vertical != 'Food And Drink'
2. Mark them as 'invalid' or delete
3. Keep legitimate restaurant leads
4. Resume email campaigns for valid leads only

### Execution Commands
```bash
# Check current database state
npx wrangler d1 execute rg-consulting-forms --remote --command "SELECT COUNT(*) FROM email_subscribers WHERE segment IN ('A', 'B')"

# Option A: Purge bad data
npx wrangler d1 execute rg-consulting-forms --remote --command "DELETE FROM subscriber_sequences WHERE subscriber_id IN (SELECT id FROM email_subscribers WHERE segment IN ('A', 'B'))"
npx wrangler d1 execute rg-consulting-forms --remote --command "DELETE FROM email_subscribers WHERE segment IN ('A', 'B')"

# Re-process leads with new filter
cd D:\USER_DATA\Desktop\BUSI_GRAVITY\BUSINESS_WEBSITE\restaurant-consulting-site
node scripts/process_leads.cjs --stats
node scripts/process_leads.cjs --import --dry-run
node scripts/process_leads.cjs --import
```

---

## CREDENTIALS TO RECOVER

| Credential | Status | Notes |
|------------|--------|-------|
| SQUARE_ACCESS_TOKEN | MISSING | Need full value from user |
| RESEND_API_KEY | ✅ Stored | In .secrets.local.md |
| RESEND_WEBHOOK_SECRET | ✅ Stored | In .secrets.local.md |
| STRIPE_SECRET_KEY | ✅ Stored | Partial - full in Cloudflare |
| HUBSPOT_API_KEY | ✅ Stored | In .secrets.local.md |

---

## FILES MODIFIED

1. `scripts/process_leads.cjs` - Added restaurant vertical filter
2. `C:\Users\evanr\.claude\CLAUDE.md` - Added credential protocol
3. `C:\Users\evanr\.claude\.secrets.local.md` - Added Resend webhook secret
4. `workers/email-dispatcher/wrangler.toml` - Reduced MAX_EMAILS_PER_RUN to 10
5. `functions/api/admin/email/conversion.js` - Created
6. `functions/api/admin/email/alerts.js` - Created
7. `functions/api/admin/email/replies.js` - Created
8. `migrations/0067_conversion_tracking.sql` - Created and deployed
9. `migrations/0068_email_replies.sql` - Created and deployed

---

## PREVENTION MEASURES

1. **Always filter by Vertical column** when importing BuiltWith data
2. **Never use processed files** (top500_contactable.csv, master_deduped_leads.csv)
3. **Sample verification** before any bulk import (check 50 random records)
4. **Store all credentials immediately** in .secrets.local.md with FULL values
5. **No auto-enrollment** until leads are verified as restaurants
