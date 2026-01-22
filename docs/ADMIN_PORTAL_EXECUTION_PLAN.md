# Admin Portal Comprehensive Execution Plan
## Revenue Generation, Automation, and Data Coherence

**Created:** 2026-01-22
**Status:** ACTIVE EXECUTION
**Goal:** Full superhero-level development of Admin Portal

---

## EXECUTIVE SUMMARY

### Current State Assessment

| Component | Status | Completion |
|-----------|--------|------------|
| **Business Brief Dashboard** | WORKING | 80% |
| **AI Console (Chat Interface)** | WORKING | 70% |
| **Intelligence Researcher** | WORKING | 75% |
| **Email Marketing Engine** | WORKING | 85% |
| **Client/Lead Management** | WORKING | 80% |
| **Square API (Invoices)** | FULLY IMPLEMENTED | 100% |
| **Stripe Billing (Subscriptions)** | LIVE | 100% |
| **Quote Builder** | LIVE | 95% |
| **Automation Dashboard** | WORKING | 80% |

**Overall Admin Portal: ~80% Complete**

---

## PHASE 1: CRITICAL FIXES (Today)

### 1.1 Business Brief Integration with Millstone Chat

**Source:** `C:\Users\evanr\Desktop\millstone-intelligence-extracted\`

**Action:** Port the enhanced chat interface to Business Brief

| File | Target Location | Purpose |
|------|-----------------|---------|
| `App.tsx` | Reference only | Architecture pattern |
| `ChatInterface.tsx` | Enhance existing AI Console | Full chat UI |
| `SettingsModal.tsx` | Add to AI Console | Model settings |
| `ContextEditor.tsx` | Add to AI Console | Custom GPTs |
| `geminiService.ts` | Enhance existing | Gemini API integration |

**Integration Points:**
- Business Brief → "AI Chat" tab
- Connect to DATA_CONTEXT engine via API
- Model-agnostic: Support Gemini, Claude, OpenAI

### 1.2 Intelligence Researcher Fixes

**Broken Features to Fix:**

| Feature | Issue | Fix Required |
|---------|-------|--------------|
| "Research" button | API endpoint errors | Debug `/api/admin/intelligence/discover` |
| "Send email" button | No action handler | Connect to email sequence enrollment |
| "Add to campaign" | No campaign selection | Add sequence selector dropdown |
| "Convert to client" | Incomplete flow | Create client from prospect data |

**Data Integration Required:**
- Full address (no links, inline display)
- Liquor license details
- Floor plans/blueprints from Board of Assessors
- Town Registry data
- Google Maps, Yelp, County Health data

### 1.3 Square Invoice Integration

**Already Implemented in:** `functions/api/_shared/square.js`

**Expose via Admin Portal:**
- Create invoices from client profiles
- One-time charges (not subscriptions)
- Lane A (Local): L6GGMPCHFM6WR
- Lane B (National): LB8GE5HYZJYB7

---

## PHASE 2: DATA COHERENCE

### 2.1 Unified Data Model

All systems use the same data hierarchy:

```
LEAD → PROSPECT → CLIENT
  ↑        ↑         ↑
  │        │         │
Email   Intelligence  Business Brief
Engine  Researcher    Client Profiles
```

**Storage:**
- **Local (D:\rg_data\):** Enrichment, heavy processing, DATA_CONTEXT
- **Cloud (D1):** Operational data, portal access

### 2.2 Data Isolation Rules

| Data Type | Can Flow To Business | Can Flow To Personal |
|-----------|---------------------|----------------------|
| Client data | YES (primary) | NO |
| Personal lifelogs | NO (enrichment only) | YES (primary) |
| SMS/Calls about work | YES (extracted context) | YES (full content) |
| Location data | NO | YES |

**Implementation:** DATA_CONTEXT engine filters personal vs business

---

## PHASE 3: INTELLIGENCE RESEARCHER ENHANCEMENT

### 3.1 P2P2P Service Area Catalog

**Geographic Scope:**
- Provincetown, MA (north)
- Plymouth, MA (west)
- Providence, RI (south)
- **EXCLUDE:** Boston metro (handled by national remote)

**Data Sources:**
1. BuiltWith Toast merchant data (filtered to area)
2. Google Places API scraping
3. Yelp Business API
4. MA Alcoholic Beverages Control Commission
5. RI Department of Business Regulation
6. Town assessor records (floor plans)
7. County health department inspections

### 3.2 Prospect Profile Requirements

| Field | Source | Auto-Enrich |
|-------|--------|-------------|
| Business name | BuiltWith/Google | Yes |
| Full address | Google Places | Yes |
| Phone | Google/Yelp | Yes |
| Email | Website scrape | Yes |
| Owner name | LinkedIn/Assessor | Yes |
| Liquor license | State database | Yes |
| Floor plan | Assessor records | Yes (if available) |
| Menu | Website/Toast | Yes |
| POS system | BuiltWith | Yes |
| Health inspection | County records | Yes |
| Hours of operation | Google | Yes |
| Service style | AI classification | Yes |
| Cuisine type | AI classification | Yes |

### 3.3 Prevent Duplicate Prospects

**Logic:**
```javascript
// Before creating new prospect:
const existing = await db.query(
  `SELECT * FROM clients WHERE domain = ? OR email = ?`,
  [prospect.domain, prospect.email]
);

if (existing) {
  // Enrich existing profile instead
  await enrichClientProfile(existing.id, prospect);
  return { action: 'enriched', client: existing };
} else {
  // Create new prospect
  return { action: 'created', prospect: await createProspect(prospect) };
}
```

---

## PHASE 4: EMAIL MARKETING AUTOMATION

### 4.1 Current State
- 100 leads imported and ready
- Email dispatcher running (cron every 5 min)
- Resend free tier: 100 emails/day limit
- 8 sequences with 22 steps (content complete)

### 4.2 Enable Automation

```sql
-- Run in D1:
UPDATE feature_flags SET enabled = 1 WHERE key = 'email_automation_enabled';
UPDATE feature_flags SET enabled = 1 WHERE key = 'email_sequences_enabled';
```

### 4.3 Connect Contact Form to Email Enrollment

**File:** `functions/api/contact.js`

**Add after HubSpot creation:**
```javascript
// Auto-enroll in email sequence based on service interest
const sequenceMap = {
  'toast-support': 'seq_toast_support_001',
  'menu-building': 'seq_menu_work_001',
  'pos-migration': 'seq_pos_switcher_001',
  'networking': 'seq_local_network_001',
  'default': 'seq_toast_support_001'
};

const sequenceId = sequenceMap[data.service] || sequenceMap.default;
await enrollInSequence(env, data.email, sequenceId);
```

---

## PHASE 5: WORKFLOW PIPELINES

### 5.1 Lead Conversion Sources

**Source 1: Email Marketing/Website**
```
Contact Form → HubSpot → D1 Subscriber → Email Sequence → Reply/Click → Qualify → Discovery Call → Client
```

**Source 2: Intelligence Researcher**
```
P2P2P Catalog → Prospect Profile → Manual Outreach → Discovery Call → Client
```

**Source 3: Networking Page**
```
capecodcablecontractors.com → /local-networking → Contact Form → Local Service Sequence → On-site Estimate → Client
```

### 5.2 Discovery Call Requirement

**CRITICAL:** Every pipeline MUST include scheduling a 30-60 minute discovery call.

**Implementation:**
- Cal.com integration for scheduling
- Embed booking widget on conversion points
- Automatic reminder sequences
- Post-call follow-up automation

---

## PHASE 6: BUSINESS BRIEF OPERATIONS CENTER

### 6.1 Daily Briefing Content

| Section | Data Source | Priority |
|---------|-------------|----------|
| Today's Actions | Automation jobs, tickets | HIGH |
| Pending Responses | Email replies, portal messages | HIGH |
| Revenue Status | Stripe MRR, Square invoices | MEDIUM |
| Pipeline Status | Prospects, opportunities | MEDIUM |
| Client Health | Support tickets, activity | MEDIUM |
| Intelligence Updates | New prospects, enrichment | LOW |

### 6.2 AI Chat Integration

**Model Support:**
- Primary: Gemini 2.0 Flash (fast, cheap)
- Fallback: Claude Sonnet (complex reasoning)
- Optional: GPT-4o, local models

**Context Sources:**
- Client profiles from D1
- Business metrics from APIs
- User context from DATA_CONTEXT (filtered)

### 6.3 DATA_CONTEXT Integration

**API Endpoints to Create:**
```
POST /api/admin/business-brief/context
GET /api/admin/business-brief/enrichment
POST /api/admin/business-brief/query
```

**Data Flow:**
```
DATA_CONTEXT (Local)
       │
       │ API Query
       ▼
Business Brief Backend
       │
       │ Filtered Results
       ▼
AI Chat Interface
```

---

## IMMEDIATE EXECUTION CHECKLIST

### End of Day Requirements

- [ ] Audit all website pages (visual check)
- [ ] Test contact form end-to-end
- [ ] Test quote builder with PDF import
- [ ] Verify Stripe checkout flow
- [ ] Test client portal login
- [ ] Test rep portal login
- [ ] Review Cloudflare workers status
- [ ] Check D1 database health
- [ ] Verify email dispatcher running
- [ ] Test Square invoice creation

### Code Changes Required

1. **Contact Form → Email Enrollment** (High Priority)
   - File: `functions/api/contact.js`
   - Add sequence enrollment after HubSpot

2. **Intelligence Researcher Button Fixes** (High Priority)
   - File: `src/components/admin/intelligence/ResearchPanel.tsx`
   - Fix Research, Email, Add to Campaign handlers

3. **Square Invoice UI** (Medium Priority)
   - File: `src/components/admin/billing/InvoiceModal.tsx`
   - Add "Create Invoice" action to client profiles

4. **Business Brief Chat Enhancement** (Medium Priority)
   - Port Millstone Intelligence components
   - Connect to DATA_CONTEXT API

---

## API ENDPOINTS STATUS

### Working Endpoints
- `/api/admin/briefing` - Daily briefing ✅
- `/api/admin/business-brief/dashboard` - KPIs ✅
- `/api/admin/intelligence/runner` - Intelligence status ✅
- `/api/admin/intelligence/crawler` - Crawler queue ✅
- `/api/admin/email/sequences` - Email campaigns ✅
- `/api/admin/clients` - Client management ✅

### Needs Testing
- `/api/admin/intelligence/discover` - Lead discovery
- `/api/admin/intelligence/enrich` - Lead enrichment
- `/api/admin/billing/invoices` - Invoice management

### Needs Creation
- `/api/admin/business-brief/context` - DATA_CONTEXT query
- `/api/admin/scheduling/book` - Cal.com booking

---

## DOCUMENTATION OUTPUT

If session must end before completion, output:

1. Current progress status
2. Remaining tasks with priorities
3. File paths and line numbers for in-progress work
4. Handoff context for next session
5. This document path: `docs/ADMIN_PORTAL_EXECUTION_PLAN.md`

---

## REVENUE GENERATION FOCUS

### Immediate Revenue Actions
1. **Enable email automation** - Start nurturing 100 leads
2. **Test Stripe checkout** - Ensure payment works
3. **Test Square invoices** - Enable one-time billing
4. **Publish quote builder** - Enable client self-service

### Revenue Metrics to Track
- Email open rate (target: 25%+)
- Email reply rate (target: 5%+)
- Discovery call bookings
- Quote requests
- Conversion rate

---

**This document is the execution roadmap. Follow it sequentially.**
