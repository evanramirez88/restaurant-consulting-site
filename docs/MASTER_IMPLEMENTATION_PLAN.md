# Master Implementation Plan
## R&G Consulting Platform - Full Remediation Schedule
**Created:** January 26, 2026
**Status:** Ready for Execution

---

## Executive Summary

This plan addresses all 33 issues identified in the Platform Audit Report, organized into a phased implementation schedule. The plan prioritizes critical blockers first, followed by high-impact improvements.

**Total Issues:** 33
- CRITICAL: 7
- HIGH: 8
- MEDIUM: 12
- LOW: 6

---

## Related Plan Documents

| Document | Scope |
|----------|-------|
| [PLAN_DATABASE_FIXES.md](./PLAN_DATABASE_FIXES.md) | D1 schema corrections |
| [PLAN_EMAIL_MARKETING.md](./PLAN_EMAIL_MARKETING.md) | Email tracking and analytics |
| [PLAN_PORTAL_AUTH.md](./PLAN_PORTAL_AUTH.md) | Portal authentication |
| [PLAN_AI_CONSOLE_BRIEF.md](./PLAN_AI_CONSOLE_BRIEF.md) | AI Console and Brief fixes |
| [PLAN_CONFIG_UX_POLISH.md](./PLAN_CONFIG_UX_POLISH.md) | Config and UX improvements |
| [PLAN_TOAST_ABO.md](./PLAN_TOAST_ABO.md) | Toast ABO product plan |
| [PLAN_TOAST_HUB.md](./PLAN_TOAST_HUB.md) | Content platform plan |
| [PLAN_CLIENT_DATABASE.md](./PLAN_CLIENT_DATABASE.md) | Client data architecture |

---

## Phase 1: Critical Database Fixes (Days 1-2)

**Goal:** Unblock all D1 errors preventing page loads

### Day 1

| Issue | Task | File | Status |
|-------|------|------|--------|
| EM-2 | Add `geographic_tier` column | Migration 0080 | ⬜ |
| EM-3 | Create `subscribers` view | Migration 0081 | ⬜ |
| CF-1 | Fix business rates to $175/$250/$200 | Migration 0082 | ⬜ |
| BB-5 | Fix Feb 29 milestone (2026 not leap year) | Migration 0083 | ⬜ |

**Commands:**
```bash
cd D:/USER_DATA/Projects/restaurant-consulting-site
npx wrangler d1 migrations apply restaurant-consulting-db --remote
```

### Day 2

| Issue | Task | File | Status |
|-------|------|------|--------|
| EM-3 | Fix JOIN in errors/[id].js | `functions/api/admin/email/errors/[id].js` | ⬜ |
| - | Deploy and verify | `npx wrangler pages deploy` | ⬜ |

**Verification:**
- [ ] Subscribers tab loads without error
- [ ] Errors tab loads without error
- [ ] Config shows correct rates

---

## Phase 2: Portal Authentication (Days 3-5)

**Goal:** Enable rep and client portal access

### Day 3

| Issue | Task | Reference |
|-------|------|-----------|
| PT-1, PT-2 | Create magic link tables | PLAN_PORTAL_AUTH.md §1.1 |
| PT-1, PT-2 | Implement magic link request endpoint | PLAN_PORTAL_AUTH.md §1.2 |
| PT-1, PT-2 | Implement magic link verification | PLAN_PORTAL_AUTH.md §1.3 |

### Day 4

| Issue | Task | Reference |
|-------|------|-----------|
| PT-1 | Create portal auth middleware | PLAN_PORTAL_AUTH.md §2.1 |
| PT-1 | Update rep portal APIs | PLAN_PORTAL_AUTH.md §2.2 |
| PT-2, PT-3 | Update client portal APIs | PLAN_PORTAL_AUTH.md §2.3 |

### Day 5

| Issue | Task | Reference |
|-------|------|-----------|
| PT-4, CT-1 | Add "Send Invite" to admin | PLAN_PORTAL_AUTH.md §3.1, 3.2 |
| - | Create portal login pages | PLAN_PORTAL_AUTH.md §4.1 |

**Verification:**
- [ ] Rep can request magic link
- [ ] Rep can access portal via link
- [ ] Client can access portal
- [ ] Admin can send rep invites

---

## Phase 3: AI Console & Brief (Days 6-7)

**Goal:** Fix AI Console and data inconsistencies

### Day 6

| Issue | Task | Reference |
|-------|------|-----------|
| BB-9 | Fix ChatInterface.tsx state management | PLAN_AI_CONSOLE_BRIEF.md §1.2 |
| BB-9 | Ensure API returns consistent format | PLAN_AI_CONSOLE_BRIEF.md §1.3 |

### Day 7

| Issue | Task | Reference |
|-------|------|-----------|
| BB-2 | Fix Lead Database Health query | PLAN_AI_CONSOLE_BRIEF.md §2.1, 2.2 |
| BB-4 | Fix Scenario Planner labels | PLAN_AI_CONSOLE_BRIEF.md §3.1 |
| BB-7 | Change agent status to "Not configured" | PLAN_AI_CONSOLE_BRIEF.md §4.1 |
| BB-8 | Fix Data Context type classification | PLAN_AI_CONSOLE_BRIEF.md §5.1 |

**Verification:**
- [ ] AI Console receives and displays responses
- [ ] Lead Database Health shows ~3,598 leads
- [ ] Scenario labels: Conservative < Moderate < Optimistic

---

## Phase 4: Email Tracking (Days 8-10)

**Goal:** Fix 0% open/click rates

### Day 8

| Issue | Task | Reference |
|-------|------|-----------|
| EM-1 | Add tracking pixel to email templates | PLAN_EMAIL_MARKETING.md §1.1 |
| EM-1 | Implement open tracking endpoint | PLAN_EMAIL_MARKETING.md §1.1 |

### Day 9

| Issue | Task | Reference |
|-------|------|-----------|
| EM-1 | Wrap links for click tracking | PLAN_EMAIL_MARKETING.md §1.2 |
| EM-1 | Fix Resend webhook handler | PLAN_EMAIL_MARKETING.md §1.3 |

### Day 10

| Issue | Task | Reference |
|-------|------|-----------|
| EM-1 | Update campaign metrics API | PLAN_EMAIL_MARKETING.md §2.1 |
| EM-1 | Wire CampaignList.tsx to real metrics | PLAN_EMAIL_MARKETING.md §2.2 |
| - | Configure Resend webhooks | PLAN_EMAIL_MARKETING.md §verification |

**Verification:**
- [ ] Test email shows tracking pixel in source
- [ ] Open event recorded in email_logs
- [ ] Click event recorded and redirects properly
- [ ] Campaign list shows real percentages

---

## Phase 5: UX Polish (Days 11-12)

**Goal:** Fix remaining medium/low issues

### Day 11

| Issue | Task | Reference |
|-------|------|-----------|
| AO-1 | Add toast feedback to schedule form | PLAN_CONFIG_UX_POLISH.md §2 |
| AO-3 | Add diagnostic info to automation status | PLAN_CONFIG_UX_POLISH.md §3 |
| AO-4 | Connect activity feed to real events | PLAN_CONFIG_UX_POLISH.md §4 |

### Day 12

| Issue | Task | Reference |
|-------|------|-----------|
| TL-1 | Add feature flag descriptions | PLAN_CONFIG_UX_POLISH.md §6 |
| IN-2 | Default "Uncategorized" for blank categories | PLAN_CONFIG_UX_POLISH.md §5 |
| IN-3 | Add fallback for empty names | PLAN_CONFIG_UX_POLISH.md §5 |

**Verification:**
- [ ] Schedule form shows success toast
- [ ] Automation offline shows details
- [ ] Activity feed shows real events

---

## Phase 6: Content Foundation (Days 13-14)

**Goal:** Seed Toast Hub with initial content

### Day 13-14

| Issue | Task | Reference |
|-------|------|-----------|
| TH-1 | Create 6 content categories | PLAN_TOAST_HUB.md §1.1 |
| TH-1 | Write/generate 5 foundational articles | PLAN_TOAST_HUB.md §1.2 |
| TH-1 | Expand FAQ to 25+ questions | PLAN_TOAST_HUB.md §1.3 |

**Verification:**
- [ ] Toast Hub shows articles
- [ ] FAQs expanded
- [ ] Feature flag can be enabled

---

## Dependency Graph

```
Day 1-2: Database Fixes
    ↓
Day 3-5: Portal Auth ←── (depends on magic_links table)
    ↓
Day 6-7: AI Console ←── (depends on working APIs)
    ↓
Day 8-10: Email Tracking ←── (independent, can parallel)
    ↓
Day 11-12: UX Polish ←── (polish after core fixes)
    ↓
Day 13-14: Content ←── (independent, can parallel)
```

---

## Risk Mitigation

### If Migrations Fail

1. Check D1 migration status: `npx wrangler d1 migrations list`
2. Manual rollback SQL if needed
3. Contact Cloudflare support for D1 issues

### If Portal Auth Breaks

1. Keep existing session mechanism as fallback
2. Feature flag new auth system
3. Gradual rollout to test accounts first

### If Email Tracking Breaks Deliverability

1. Test with personal email first
2. Check Resend deliverability dashboard
3. Can disable tracking temporarily via feature flag

---

## Success Metrics

| Phase | Metric | Target |
|-------|--------|--------|
| 1 | D1 errors | 0 |
| 2 | Portal login success rate | 100% |
| 3 | AI Console response display | 100% |
| 4 | Email open tracking | >0% |
| 5 | UX issues remaining | 0 |
| 6 | Published articles | 5+ |

---

## Post-Implementation

After all phases complete:

1. **Full Platform Audit** - Retest all 33 issues
2. **Enable Feature Flags** - Gradually enable Toast ABO, Toast Hub
3. **Monitor** - Watch error logs for 72 hours
4. **Document** - Update CLAUDE.md with any new patterns

---

## Resource Requirements

| Resource | Requirement |
|----------|-------------|
| Time | 14 days (~2 weeks) |
| D1 Operations | ~20 migrations |
| API Deployments | ~15 endpoints |
| Component Updates | ~25 files |
| Test Accounts | 1 rep, 1 client |

---

## Execution Checklist

### Pre-Execution
- [ ] Read all PLAN_*.md documents
- [ ] Backup D1 database
- [ ] Note current git commit hash

### During Execution
- [ ] Commit after each phase
- [ ] Test in staging if possible
- [ ] Document any deviations

### Post-Execution
- [ ] Full platform retest
- [ ] Update CLAUDE.md
- [ ] Create SESSION_END handoff

---

*Author: Claude Opus 4.5*
*For: R&G Consulting Platform*
*Date: January 26, 2026*
