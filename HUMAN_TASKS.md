# Human Required Tasks - Operation Breakout

**Last Updated:** 2026-01-26 22:30 EST
**Goal:** $400K by May 1, 2026 (107 days remaining)

---

## ✅ COMPLETED: Toast Hub Authority Engine (2026-01-26)

| Component | Status | Details |
|-----------|--------|---------|
| D1 Migration | ✅ 0091 deployed | Sources, imports, visibility, GEO fields |
| Aggregator Worker | ✅ LIVE | toast-hub-aggregator.ramirezconsulting-rg.workers.dev |
| Admin UI | ✅ Complete | Curation Queue, Sources, Aggregator tabs |
| Cinematic Frontend | ✅ Complete | ToastHub.tsx, ToastHubPost.tsx redesigned |
| API Endpoints | ✅ 12 new endpoints | Imports, sources, aggregator, content-requests |
| First Aggregation | ✅ 120 items | 6 sources processed, 0 errors |

**Note:** Cron trigger disabled (free tier limit). Use Admin UI "Run Now" button for manual aggregation.

**Docs:** [docs/TOAST_HUB_AUTHORITY_ENGINE.md](docs/TOAST_HUB_AUTHORITY_ENGINE.md)

---

## ✅ COMPLETED: Restaurant Intelligence System (2026-01-11)

| Component | Status | Details |
|-----------|--------|---------|
| Database Schema | ✅ 11 tables deployed | Classification + Lead management |
| Lead Processing Script | ✅ process_leads.cjs | Parses, dedupes, classifies |
| Segmented Workbooks | ✅ 9 segments exported | G:/My Drive/RG OPS/70_LEADS/SEGMENTED_WORKBOOKS/ |
| Master Lead File | ✅ 42,969 leads | ALL_LEADS_MASTER_2026-01-11.csv |

**Lead Segments Generated:**
| Segment | Leads | Ready for Outreach |
|---------|-------|-------------------|
| Toast Existing | 15,786 | Yes |
| Clover Switchers | 12,397 | Yes |
| Square Switchers | 12,080 | Yes |
| Contactable (Email+Phone) | 3,398 | **Priority** |
| Toast Upcoming | 1,614 | **Priority** |
| Upserve Switchers | 1,045 | Yes |
| High Value (80+) | 477 | **Priority** |
| Massachusetts | 251 | Yes |
| Cape Cod | 3 | Yes |

---

## ✅ COMPLETED: Email Sequences (2026-01-10/11)

| Sequence | Steps | Content Status |
|----------|-------|----------------|
| Toast Support | 5 | ✅ Full HTML content |
| Menu Work | 2 | ✅ Full HTML content |
| POS Switcher | 4 | ✅ Full HTML content |
| Transition | 4 | ✅ Full HTML content |
| Local Network | 4 | ✅ Full HTML content |
| Booking Confirm | 1 | ✅ Full HTML content |
| Post-Meeting | 1 | ✅ Full HTML content |
| No-Show | 1 | ✅ Full HTML content |

**All 22 email steps now have complete content.**

---

## IMMEDIATE HUMAN TASKS (Priority Order)

### ~~0. Google Cloud Project + OAuth Setup~~ ✅ COMPLETED (2026-01-22)

**All 4 accounts authenticated. Tokens stored at `D:\MILLSTONE_STAGING\google_creds\tokens\`**
- token_rg_business.json (ramirezconsulting.rg@gmail.com)
- token_evan_personal.json (evanramirez88@gmail.com)
- token_evan_ccrc.json (evan@ccrestaurantconsulting.com)
- token_cccc_business.json (capecodcablecontractors@gmail.com)

**Unblocks:** Gmail inbox in Admin Portal, DATA_CONTEXT harvesting, Calendar sync, Drive integration

---

### 1. Square Subscription Catalog IDs (BLOCKING)

**Status:** ❌ REQUIRED FOR AUTOMATED BILLING
**Location:** https://squareup.com/dashboard/items

Create these subscription plans in Square Dashboard:

| Plan | Monthly | Annual | Location |
|------|---------|--------|----------|
| Restaurant Guardian Core | $350 | $3,850 | LB8GE5HYZJYB7 |
| Restaurant Guardian Professional | $500 | $5,500 | LB8GE5HYZJYB7 |
| Restaurant Guardian Premium | $800 | $8,800 | LB8GE5HYZJYB7 |

**After creation:** Provide catalog IDs to Claude for code update

---

### 2. PandaDoc Contract Templates

**Status:** ⏳ PENDING
**Location:** https://app.pandadoc.com/

Create templates for:
- Support Plan Agreement (Core/Professional/Premium)
- Menu Build SOW
- Implementation Agreement
- NDA (for Toast credentials)

---

### 3. Cal.com Availability

**Status:** ⚠️ VERIFY CURRENT
**Location:** https://app.cal.com/settings/my-account/availability

---

### 4. Domain Nameserver Updates (Low Priority)

**Status:** ⏳ PENDING (not blocking)

---

## AI READY TASKS (Claude Executes When Evan Approves)

### ✅ Lead Import to D1 (DONE 2026-01-23)

3,437 validated restaurant leads imported. Stats:
- Toast Existing: 2,587 | Clover: 455 | Toast Upcoming: 317
- With Email: 1,626 (47%) | With Both: 413 (12%)
- High Value (80+): 401

### Enrollment (USER CONTROLS PACE)

77 currently enrolled. Auto-enroll API ready for controlled rollout:
```
POST /api/admin/email/auto-enroll
{ segment: "B", minScore: 70, limit: 50, dryRun: true }
```

### HubSpot Sync

Sync high-value segment to HubSpot:
- 401 leads with score 80+
- 413 contactable leads (email + phone)

---

## ✅ COMPLETED: Infrastructure

| Item | Status | Details |
|------|--------|---------|
| D1 Database | ✅ | ~130 tables, 5.2 MB / 5 GB |
| KV Namespace | ✅ | Rate limiting DISABLED (free tier conservation) |
| R2 Bucket | ✅ | File storage |
| Email Dispatcher | ✅ | Cron */5 min, D1-based daily cap |
| Google OAuth | ✅ | 4 accounts, token refresh working |
| Gmail Pipeline | ✅ | scripts/gmail_pipeline.cjs |
| Calendar Sync | ✅ | scripts/google_calendar_sync.cjs |
| Drive Sync | ✅ | scripts/google_drive_sync.cjs (306 docs indexed) |
| DATA_CONTEXT Sync | ✅ | scripts/data_context_sync.py (64 items) |
| Context Engine | ✅ | D1 tables + Data Gatekeeper privacy filter |

---

## Outreach Priority (Validated Restaurant Counts)

| Priority | Segment | D1 Count | Enrolled |
|----------|---------|----------|----------|
| 1 | Toast Upcoming | 317 | 0 |
| 2 | High Value (80+) | 401 | 0 |
| 3 | Contactable (email+phone) | 413 | 0 |
| 4 | Clover Switchers | 455 | ~50 |
| 5 | Massachusetts | 29 | 0 |

---

## ⚠️ FREE TIER AWARENESS

| Resource | Daily Limit | Status |
|----------|-------------|--------|
| KV Reads | 1,000/day | FIXED: middleware disabled, dispatcher uses D1 |
| KV Writes | 1,000/day | FIXED: same |
| D1 Reads | 5,000,000/day | Safe |
| D1 Writes | 100,000/day | Safe |
| Workers Requests | 100,000/day | Safe |
| Resend Emails | 100/day (free) | Capped in dispatcher |

---

**CONTROLLED ROLLOUT. FREE TIER AWARE. ASK BEFORE BULK OPS.**
