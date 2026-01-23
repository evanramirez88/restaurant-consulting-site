# Human Required Tasks - Operation Breakout

**Last Updated:** 2026-01-11 00:30 EST
**Goal:** $400K by May 1, 2026 (110 days remaining)

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

## AI READY TASKS (Claude Can Execute)

### Lead Import to D1 (Ready Now)

```bash
node scripts/process_leads.cjs --import
```

### HubSpot Sync

Sync high-value segment to HubSpot:
- 477 leads with score 80+
- 3,398 contactable leads

---

## ✅ COMPLETED: Infrastructure (All Configured)

| Item | Status | Details |
|------|--------|---------|
| D1 Database | ✅ | 68 tables |
| KV Namespace | ✅ | Rate limiting |
| R2 Bucket | ✅ | File storage |
| Email Dispatcher | ✅ | Cron every 5 min |

---

## Outreach Priority

| Priority | Segment | Count |
|----------|---------|-------|
| 1 | Toast Upcoming | 1,614 |
| 2 | High Value (80+) | 477 |
| 3 | Contactable | 3,398 |
| 4 | Massachusetts | 251 |

---

**EXECUTE. THE MATH WORKS.**
