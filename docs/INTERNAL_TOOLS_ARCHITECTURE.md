# Internal Tools Architecture
## Unified System Design for Client Acquisition & Service Automation
**R&G Consulting LLC** | **Generated: 2026-01-17**

---

## EXECUTIVE SUMMARY

This document synthesizes the architecture of four critical internal systems designed for **immediate client acquisition and service delivery**. These tools are operational internally and NOT exposed to the public market.

### System Readiness Matrix

| System | Completion | Blocking Revenue? | Priority |
|--------|------------|-------------------|----------|
| **Email Engine** | 85% | **YES** - No automated lead nurturing | CRITICAL |
| **Restaurant Intelligence** | 75% | **YES** - No automated enrichment | HIGH |
| **Menu Builder** | 90% | No - Fully usable internally | MEDIUM |
| **Toast ABO** | 55% | No - Can use manually | LOW |

### Critical Path to Revenue

```
LEAD ACQUISITION → EMAIL NURTURING → QUALIFICATION → SERVICE DELIVERY
       ↓                 ↓                ↓              ↓
  Intelligence       Email Engine      Quote Builder   Menu Builder
   (Hunter)         (Dispatcher)        (DCI)          Toast ABO
```

---

## 1. EMAIL ENGINE

### 1.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      EMAIL ENGINE                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  ENROLLMENT  │───▶│   SEQUENCES  │───▶│  DISPATCHER  │      │
│  │    /api/     │    │   (D1 DB)    │    │   (Worker)   │      │
│  │email/enroll  │    └──────────────┘    └──────────────┘      │
│  └──────────────┘           │                   │               │
│         ▲                   │                   ▼               │
│         │                   │           ┌──────────────┐        │
│  ┌──────────────┐          │           │   RESEND API │        │
│  │   TRIGGERS   │          ▼           │   (2/sec)    │        │
│  │ - Contact    │    ┌──────────────┐  └──────────────┘        │
│  │   Form       │    │ SUBSCRIBERS  │         │                 │
│  │ - HubSpot    │    │   & LOGS     │         ▼                 │
│  │ - Stripe     │    └──────────────┘  ┌──────────────┐        │
│  │ - Manual     │                      │  SUPPRESSION │        │
│  └──────────────┘                      │     LIST     │        │
│                                        └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Components

| Component | File | Status | Purpose |
|-----------|------|--------|---------|
| **Enrollment API** | `functions/api/email/enroll.ts` | COMPLETE | Enroll contacts into sequences |
| **Dispatcher Worker** | `workers/email-dispatcher/src/index.ts` | COMPLETE | Process queue every 5 min |
| **Sequence Schema** | `migrations/0009_email_sequences.sql` | DEPLOYED | 8 sequences, 22 steps |
| **Rate Limiting** | KV-based | COMPLETE | 2 emails/second max |

### 1.3 Segment-to-Sequence Mapping

```typescript
const SEGMENT_SEQUENCES = {
  'A': 'seq_pos_switcher_001',      // POS Switcher Outreach
  'B': 'seq_toast_support_001',     // Toast Support Plan Outreach
  'C': 'seq_transition_001',        // Ownership Transition Outreach
  'D': 'seq_local_network_001',     // Local Network Outreach
  'menu': 'seq_menu_work_001',      // Remote Menu Work
  'booking': 'seq_booking_confirm_001',
  'post_meeting': 'seq_post_meeting_001',
  'noshow': 'seq_noshow_001'
};
```

### 1.4 GAPS - Email Engine

| Gap | Impact | Fix Required | Effort |
|-----|--------|--------------|--------|
| **Contact Form → Enrollment** | Leads not auto-enrolled | Add enrollment call after HubSpot sync in `/api/contact.js` | 2 hours |
| **HubSpot Sync → Enrollment** | Synced contacts not enrolled | Add enrollment trigger in sync webhook handler | 2 hours |
| **Stripe → Welcome Sequence** | New subscribers not welcomed | Add enrollment trigger in Stripe webhook | 1 hour |
| **Dispatcher Cron** | Worker exists but verify deployment | Confirm `*/5 * * * *` cron active in Cloudflare | 30 min |

### 1.5 Email Dispatcher Internals

**Process Flow:**
1. Cron triggers every 5 minutes
2. Query `subscriber_sequences` WHERE `next_step_scheduled_at <= NOW()` AND `status = 'active'`
3. For each pending email:
   - Check suppression list
   - Personalize content (`{{first_name}}`, `{{company}}`, etc.)
   - Send via Resend API with idempotency key
   - On success: advance to next step, update `next_step_scheduled_at`
   - On failure: increment `retry_count`, mark failed after 3 retries
4. Rate limit: 500ms between emails (2/sec max)

---

## 2. RESTAURANT INTELLIGENCE

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  RESTAURANT INTELLIGENCE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │    HUNTER    │    │   ANALYST    │    │   OPERATOR   │      │
│  │   (4:00 AM)  │    │   (5:00 AM)  │    │   (6:00 AM)  │      │
│  │ - Licensing  │    │ - POS Audit  │    │ - Health     │      │
│  │ - Real Estate│    │ - LinkedIn   │    │   Checks     │      │
│  │ - Permits    │    │ - Tech Stack │    │ - Cleanup    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             ▼                                   │
│                    ┌──────────────┐                             │
│                    │  STRATEGIST  │                             │
│                    │   (7:00 AM)  │                             │
│                    │ - Lead Score │                             │
│                    │ - Daily Brief│                             │
│                    │ - Gap Fill   │                             │
│                    └──────────────┘                             │
│                             │                                   │
│                             ▼                                   │
│  ┌─────────────────────────────────────────────────────┐       │
│  │               LEAD DATABASE (D1)                     │       │
│  │  42,969 leads | 100-point scoring | 9 segments       │       │
│  └─────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Lead Scoring Formula

```
Score = (Property Ownership × 3) + (Tech Vulnerability × 2) + (Warm Intro × 5)
      + (Revenue Estimate × 1) + (Employee Count × 0.5) + (Website Quality × 1)
      + (Review Volume × 0.5) + (Review Sentiment × 1) + (POS Age × 1.5)
      + (Growth Signals × 2)
```

**Tech Vulnerability Detection:**
- Square, Clover, Micros, Aloha, None → +20 points
- Legacy systems → +15 points

**Warm Intro Detection:**
- Referral source present → +50 points
- Prior contact history → +25 points

### 2.3 Key Components

| Component | File | Status | Purpose |
|-----------|------|--------|---------|
| **Core 4 Agents** | `functions/api/intelligence/agents.js` | DEFINED | Daily intelligence pipeline |
| **Lead Processing** | `scripts/process_leads.cjs` | COMPLETE | Import/classify/score leads |
| **Lead Database** | `migrations/0008, 0020, 0028, 0029` | DEPLOYED | 42,969 lead capacity |
| **Atomic Facts** | `client_atomic_facts` table | DEPLOYED | Structured enrichment data |

### 2.4 Gap Filling Logic

```javascript
const REQUIRED_FIELDS = ['company_name', 'contact_name', 'email', 'phone',
                         'city', 'state', 'current_pos', 'website'];

const DESIRED_FIELDS = ['full_address', 'employee_estimate', 'revenue_estimate',
                        'seating_capacity_hint', 'cuisine_hint', 'service_style_hint'];

// Gaps generate search queries like:
// "<<NEED:email>>" → `"${company_name}" contact email` via Google/LinkedIn/Yelp
// "<<NEED:current_pos>>" → `site:${website} powered by OR checkout` via BuiltWith
```

### 2.5 GAPS - Restaurant Intelligence

| Gap | Impact | Fix Required | Effort |
|-----|--------|--------------|--------|
| **Agents Not Scheduled** | No daily intelligence runs | Deploy cron jobs for agents | 4 hours |
| **Hunter External APIs** | No real licensing board integration | Mock data only | 8+ hours |
| **Gap Fill Execution** | Search queries generated but not executed | Integrate with Brave Search | 6 hours |
| **Client Profile Trigger** | No auto-profile creation on lead conversion | Add trigger in lead → client flow | 2 hours |

### 2.6 Lead Segments (Current State)

| Segment | Count | Enrollment Sequence |
|---------|-------|---------------------|
| Toast Existing | 15,786 | `seq_toast_support_001` |
| Clover Switchers | 12,397 | `seq_pos_switcher_001` |
| Square Switchers | 12,080 | `seq_pos_switcher_001` |
| Contactable (has email) | 3,398 | Manual assignment |
| Toast Upcoming | 1,614 | `seq_toast_support_001` |
| High Value (80+ score) | 477 | Priority manual outreach |
| Massachusetts | 251 | `seq_local_network_001` |

---

## 3. MENU BUILDER

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       MENU BUILDER                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   UPLOAD     │───▶│   PROCESS    │───▶│    EXPORT    │      │
│  │   (R2)       │    │   (AI OCR)   │    │ (JSON/CSV)   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         │                   ▼                   │               │
│         │          ┌──────────────┐            │               │
│         │          │   PARSING    │            │               │
│         │          │ - Categories │            │               │
│         │          │ - Items      │            │               │
│         │          │ - Modifiers  │            │               │
│         │          │ - Prices     │            │               │
│         │          └──────────────┘            │               │
│         │                   │                   │               │
│         │                   ▼                   │               │
│         │          ┌──────────────┐            │               │
│         │          │  COCKTAIL    │            │               │
│         │          │   CONFIG     │            │               │
│         │          │ (Martini/    │            │               │
│         │          │  Manhattan)  │            │               │
│         │          └──────────────┘            │               │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             ▼                                   │
│                    ┌──────────────┐                             │
│                    │  TOAST ABO   │                             │
│                    │  DEPLOYMENT  │                             │
│                    │   (Future)   │                             │
│                    └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Key Components

| Component | File | Status | Purpose |
|-----------|------|--------|---------|
| **Frontend** | `pages/MenuBuilder.tsx` | COMPLETE | 1,284 lines, full UI |
| **Upload API** | `functions/api/menu/upload.js` | COMPLETE | R2 storage + job creation |
| **Process API** | `functions/api/menu/process.js` | COMPLETE | AI OCR + parsing |
| **Parse Text** | `functions/api/menu/parse-text.js` | COMPLETE | LLaMA 3.1 + regex fallback |
| **Cocktail Config** | `functions/api/menu/cocktail-config.js` | COMPLETE | Martini/Manhattan pricing |

### 3.3 OCR + Parsing Pipeline

**AI Model Flow:**
```
Image/PDF → Cloudflare AI (LLaVA 1.5 / LLaMA 3.2 Vision) → Raw Text
                                    ↓
Raw Text → parseMenuText() → Structured Menu
                                    ↓
{
  items: [{ name, description, price, category, modifiers }],
  categories: ['Appetizers', 'Entrees', ...],
  modifierGroups: ['Protein Add-Ons', 'Sauce Options', ...]
}
```

**Price Detection Patterns:**
```javascript
const pricePatterns = [
  /\$\d+\.\d{2}/,           // $14.99
  /\$\d+(?:\s|$)/,          // $14
  /\d+\.\d{2}(?:\s|$)/,     // 14.99
  /(?:^|\s)\d{1,3}(?:\s|$)/ // Just "14"
];
```

**Category Detection:**
- 25+ category patterns (Appetizers, Entrees, Salads, Seafood, etc.)
- ALL CAPS detection for headers
- Auto-categorization based on item keywords

### 3.4 Martini/Manhattan Cocktail Logic

**Core Concept:** Cocktails are "states" of base spirits with volume multipliers

```javascript
Final Price = (Base Spirit Price × Volume Multiplier) + Style Upcharge

| Style        | Volume Multiplier | Upcharge |
|--------------|-------------------|----------|
| Martini      | 2.0               | $2.00    |
| Manhattan    | 1.8               | $2.00    |
| Old Fashioned| 1.25              | $1.50    |
| Neat/Rocks   | 1.0               | $0.00    |
```

### 3.5 GAPS - Menu Builder

| Gap | Impact | Fix Required | Effort |
|-----|--------|--------------|--------|
| **Data Persistence** | Menu lost on page refresh | Save to D1 `parsed_menus` table | 4 hours |
| **Item-Level Editor** | Can't edit individual items before export | Add inline editing UI | 6 hours |
| **Toast Deploy Button** | Modal exists but doesn't execute | Connect to Toast ABO job | 2 hours |
| **Batch Processing** | No bulk menu upload | Add folder upload support | 4 hours |

---

## 4. TOAST AUTO-BACK-OFFICE (ABO)

### 4.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     TOAST ABO                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   TRIGGER    │───▶│    QUEUE     │───▶│   EXECUTOR   │      │
│  │    /api/     │    │   (D1 DB)    │    │   (Worker)   │      │
│  │ automation/  │    └──────────────┘    └──────────────┘      │
│  │  trigger     │           │                   │               │
│  └──────────────┘           │                   ▼               │
│         ▲                   │          ┌──────────────┐         │
│         │                   │          │   BROWSER    │         │
│  ┌──────────────┐          │          │   CLIENT     │         │
│  │  JOB TYPES   │          ▼          │ (Puppeteer)  │         │
│  │ - menu_deploy│    ┌──────────────┐ └──────────────┘         │
│  │ - kds_config │    │ CREDENTIALS  │        │                  │
│  │ - price_upd  │    │  (Encrypted) │        ▼                  │
│  │ - health_chk │    └──────────────┘ ┌──────────────┐         │
│  │ + 10 more    │                     │ TOAST POS    │         │
│  └──────────────┘                     │ Back-Office  │         │
│                                       └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Key Components

| Component | File | Status | Purpose |
|-----------|------|--------|---------|
| **Trigger API** | `functions/api/automation/trigger.js` | COMPLETE | Create automation jobs |
| **Job Executor** | `automation/src/JobExecutor.js` | PARTIAL | Process jobs from queue |
| **Browser Client** | `automation/src/ToastBrowserClient.js` | COMPLETE | Puppeteer automation |
| **Worker Entry** | `automation/src/worker.js` | COMPLETE | Worker process entry point |
| **Poll Endpoint** | `functions/api/automation/worker/poll.js` | COMPLETE | Worker claims jobs |

### 4.3 Supported Job Types

```javascript
const VALID_JOB_TYPES = [
  'menu_deployment',       // Menu Builder → Toast (IMPLEMENTED)
  'menu_import',           // PDF/image → Toast
  'menu_export',           // Toast → export
  'pos_sync',              // Sync POS data
  'report_generation',     // Generate reports
  'price_update',          // Bulk price updates
  'item_availability',     // Update availability
  'employee_sync',         // Sync employees
  'sales_report',          // Pull sales data
  'inventory_check',       // Check inventory
  'modifier_update',       // Update modifiers
  'category_reorganize',   // Reorganize menu
  'toast_backup',          // Backup config
  'toast_restore',         // Restore config
  'custom'                 // Custom tasks
];
```

### 4.4 Browser Client Features

**Self-Healing Selectors:**
```javascript
const SELECTORS = {
  login: {
    email: ['input[name="email"]', 'input[type="email"]', '#email', '[data-testid="email-input"]'],
    password: ['input[name="password"]', 'input[type="password"]', '#password'],
    submit: ['button[type="submit"]', 'button:contains("Sign in")', '.login-button']
  },
  // ... multiple fallbacks for each element
};
```

**Credential Security:**
- AES-256-GCM encryption for stored credentials
- Credentials fetched per-job, decrypted in worker memory
- Restaurant GUID-based routing

### 4.5 Job Execution Flow

```
1. Poll: Worker calls /api/automation/worker/poll
2. Claim: Job status → 'in_progress', worker receives job
3. Credentials: Worker fetches encrypted credentials
4. Decrypt: Decrypt password using ENCRYPTION_KEY
5. Browser: Initialize Puppeteer, login to Toast
6. Execute: Run job-specific handler
7. Progress: Update progress via PATCH /api/automation/worker/jobs/:id
8. Complete: Update status to 'completed' with output
9. Cleanup: Close browser, release session
```

### 4.6 GAPS - Toast ABO

| Gap | Impact | Fix Required | Effort |
|-----|--------|--------------|--------|
| **Worker Not Running** | Jobs queue but don't execute | Deploy worker to Lenovo m720q | 2 hours |
| **menu_update Handler** | Only stub implementation | Implement find-and-modify logic | 8 hours |
| **kds_config Handler** | Only stub implementation | Implement KDS station creation | 6 hours |
| **printer_setup Handler** | Only stub implementation | Implement printer routing | 6 hours |
| **employee_setup Handler** | Only stub implementation | Implement employee creation | 6 hours |
| **Vision Self-Healing** | No Claude Vision integration yet | Add screenshot → selector recovery | 12 hours |

---

## 5. INTEGRATION POINTS

### 5.1 System Interconnections

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTEGRATION MAP                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                         ┌──────────────┐      │
│  │   CONTACT    │────────────────────────▶│    EMAIL     │      │
│  │    FORM      │  (MISSING: enrollment)  │   ENGINE     │      │
│  └──────────────┘                         └──────────────┘      │
│         │                                        ▲               │
│         ▼                                        │               │
│  ┌──────────────┐                                │               │
│  │   HUBSPOT    │────────────────────────────────┘               │
│  │    SYNC      │  (MISSING: enrollment trigger)                │
│  └──────────────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐       ┌──────────────┐                        │
│  │ RESTAURANT   │──────▶│    QUOTE     │                        │
│  │ INTELLIGENCE │       │   BUILDER    │                        │
│  │   (Leads)    │       │    (DCI)     │                        │
│  └──────────────┘       └──────────────┘                        │
│         │                      │                                 │
│         ▼                      ▼                                 │
│  ┌──────────────┐       ┌──────────────┐       ┌──────────────┐ │
│  │    MENU      │──────▶│  TOAST ABO   │◀──────│   STRIPE     │ │
│  │   BUILDER    │       │ (Deployment) │       │  (Billing)   │ │
│  └──────────────┘       └──────────────┘       └──────────────┘ │
│                                                       │          │
│                                                       ▼          │
│                                                ┌──────────────┐  │
│                                                │    EMAIL     │  │
│                                                │   ENGINE     │  │
│                                                │ (Welcome)    │  │
│                                                └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Missing Integration Triggers

| Source | Target | Gap | Fix |
|--------|--------|-----|-----|
| Contact Form | Email Engine | No enrollment after HubSpot sync | Add `enrollInSequence()` call |
| HubSpot Sync | Email Engine | Synced contacts not enrolled | Add webhook handler trigger |
| Stripe Subscription | Email Engine | No welcome sequence | Add enrollment in webhook handler |
| Lead Conversion | Client Profile | No auto-profile creation | Add trigger in conversion flow |
| Menu Builder | Toast ABO | Deploy button not wired | Connect modal to job trigger |
| Intelligence Agents | Lead Database | Agents not scheduled | Deploy cron jobs |

---

## 6. IMPLEMENTATION ROADMAP

### Phase 1: Revenue-Blocking Fixes (This Week)

| Priority | Task | System | Effort | Impact |
|----------|------|--------|--------|--------|
| 1 | Wire Contact Form → Email Enrollment | Email | 2h | Leads auto-nurtured |
| 2 | Wire HubSpot Sync → Email Enrollment | Email | 2h | Bulk imports enrolled |
| 3 | Verify Email Dispatcher Cron Active | Email | 30m | Queue processing |
| 4 | Wire Stripe → Welcome Sequence | Email | 1h | New customers welcomed |
| 5 | Test End-to-End Lead Pipeline | All | 2h | Verify flow works |

**Total: ~8 hours**

### Phase 2: Internal Tool Improvements (Next 2 Weeks)

| Priority | Task | System | Effort | Impact |
|----------|------|--------|--------|--------|
| 6 | Add Menu Persistence (D1) | Menu Builder | 4h | Menus saved |
| 7 | Wire Deploy Button → Toast ABO | Menu Builder | 2h | One-click deploy |
| 8 | Deploy Toast ABO Worker | Toast ABO | 2h | Jobs execute |
| 9 | Schedule Intelligence Agents | Intelligence | 4h | Daily insights |
| 10 | Add Item-Level Editor | Menu Builder | 6h | Better editing |

**Total: ~18 hours**

### Phase 3: Advanced Automation (Month 2+)

| Priority | Task | System | Effort | Impact |
|----------|------|--------|--------|--------|
| 11 | Implement menu_update Handler | Toast ABO | 8h | Edit existing menus |
| 12 | Implement kds_config Handler | Toast ABO | 6h | KDS automation |
| 13 | Integrate Gap Fill with Brave Search | Intelligence | 6h | Auto-enrich data |
| 14 | Add Claude Vision Self-Healing | Toast ABO | 12h | Resilient automation |
| 15 | Deploy Hunter External APIs | Intelligence | 8h+ | Real-time intel |

**Total: ~40+ hours**

---

## 7. QUICK REFERENCE

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/email/enroll` | POST | Enroll contact in sequence |
| `/api/email/enroll` | GET | List available sequences |
| `/api/intelligence/agents` | POST | Run intelligence agents |
| `/api/intelligence/agents/status` | GET | Get agent status |
| `/api/menu/upload` | POST | Upload menu file |
| `/api/menu/process` | POST | Process uploaded menu |
| `/api/automation/trigger` | POST | Create automation job |
| `/api/automation/jobs` | GET | List automation jobs |
| `/api/automation/worker/poll` | GET | Worker claims job |

### Database Tables

| Table | Purpose |
|-------|---------|
| `email_subscribers` | Contact records for email |
| `email_sequences` | Sequence definitions |
| `sequence_steps` | Individual email steps |
| `subscriber_sequences` | Enrollment tracking |
| `email_logs` | Send history |
| `restaurant_leads` | 42,969 lead records |
| `client_atomic_facts` | Enrichment data |
| `menu_jobs` | Menu processing jobs |
| `automation_jobs` | Toast automation queue |
| `automation_credentials` | Encrypted Toast credentials |

### Worker Locations

| Worker | URL | Status |
|--------|-----|--------|
| Email Dispatcher | `rg-email-dispatcher.workers.dev` | DEPLOYED |
| Toast ABO | Local (Lenovo m720q) | NOT RUNNING |

---

## 8. NEXT ACTIONS

### Immediate (Today)

1. **Verify Email Dispatcher** - Check Cloudflare dashboard for cron activity
2. **Test Enrollment API** - `POST /api/email/enroll` with test email
3. **Wire Contact Form** - Add enrollment call to `/api/contact.js`

### This Week

4. **Wire HubSpot Sync** - Add enrollment trigger
5. **Wire Stripe Webhook** - Add welcome sequence enrollment
6. **Test Full Pipeline** - Contact form → HubSpot → Email → Sequence

### Ongoing

7. **Monitor Email Stats** - Check `/api/email/stats` daily
8. **Review Lead Scores** - Run Strategist agent weekly
9. **Process Menu Jobs** - Use Menu Builder for client work

---

*Document Version: 1.0*
*Generated: 2026-01-17*
*Author: Claude Opus 4.5*
