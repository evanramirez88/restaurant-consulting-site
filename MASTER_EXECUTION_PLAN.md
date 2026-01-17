# Master Execution Plan - R&G Consulting LLC
## Comprehensive Integration of All Business Initiatives

**Created:** 2026-01-07
**Target:** $400,000 Revenue by May 1, 2026 (116 days)
**Weekly Target:** $23,529/week
**Source Documents:** 10 BUSINESS_TO_DO files integrated

---

## EXECUTIVE SUMMARY

This plan consolidates all business planning documents into a single executable roadmap. The strategy follows four parallel tracks:

| Track | Focus | Revenue Impact | Timeline |
|-------|-------|----------------|----------|
| **Track A** | Email Automation + Lead Processing | $315K-$410K potential | Weeks 1-18 |
| **Track B** | Website Features + Admin Portal | Enables all tracks | Weeks 1-8 |
| **Track C** | AI Phone + Toast Automation | $50K-$100K efficiency | Weeks 3-12 |
| **Track D** | AI Search (GEO) + Visibility | Long-term growth | Ongoing |

---

## PHASE 0: FOUNDATION (COMPLETED)

### Days 1-5 Email Admin UI - COMPLETE

| Day | Focus | Status |
|-----|-------|--------|
| Day 1 | Campaign Dashboard + Subscribers | COMPLETE |
| Day 2 | Advanced Features + Segments | COMPLETE |
| Day 3 | A/B Testing + Enrollment | COMPLETE |
| Day 4 | PDF Processing + Polish | COMPLETE |
| Day 5 | Security + Documentation + Deploy | COMPLETE |

**Deliverables:**
- CORS vulnerability fixed
- Rate limiting implemented
- OpenAPI documentation created
- Admin user guide created
- All security changes deployed

---

## PHASE 1: EMAIL INFRASTRUCTURE (Weeks 1-3)

### 1.1 Database Migration

**File:** `migrations/0005_email_automation.sql`

Create tables:
- `email_sequences` - Campaign definitions
- `sequence_steps` - Individual emails in drip
- `email_subscribers` - 42,967 leads storage
- `subscriber_sequences` - Position tracking
- `email_logs` - Delivery tracking

**Priority indexes:**
```sql
CREATE INDEX idx_subscriber_sequences_due ON subscriber_sequences(next_execution_time, status);
CREATE INDEX idx_email_subscribers_pos ON email_subscribers(pos_system);
CREATE INDEX idx_email_subscribers_geo ON email_subscribers(geographic_tier);
```

### 1.2 Cron Worker Setup

**Files to create:**
- `functions/api/_scheduled/email-dispatcher.ts` - Query due emails, personalize, queue
- `functions/api/_queue/email-consumer.ts` - Rate-limited Resend dispatch
- `functions/api/webhooks/resend.ts` - Delivery event handling

**Wrangler.toml additions:**
```toml
[triggers]
crons = ["*/5 * * * *"]

[[queues.producers]]
queue = "rg-email-dispatch"
binding = "EMAIL_QUEUE"

[[queues.consumers]]
queue = "rg-email-dispatch"
max_batch_size = 2
```

### 1.3 Lead Scoring System

**100-point priority matrix:**

| Factor | Points | Scoring |
|--------|--------|---------|
| **POS System** | 40 | Toast=40, Clover/Square=25, Other=15 |
| **Geography** | 30 | Cape Cod=30, MA=20, New England=15, National=10 |
| **Tech Signals** | 30 | Integrations, online ordering, loyalty |

**Tier assignment:**
- Tier 1 Hot (80-100 points): ~4,000 leads
- Tier 2 Warm (60-79 points): ~10,000 leads
- Tier 3 Nurture (40-59 points): ~17,000 leads
- Tier 4 Long-tail (<40 points): ~12,000 leads

### 1.4 Domain Warming (Weeks 1-6)

**CRITICAL:** Never cold email from ccrestaurantconsulting.com

**Purchase 3-5 secondary domains:**
- rgconsulting.email
- toastconsulting.net
- rgrestaurant.email

**Warmup schedule:**
| Week | Daily Volume/Inbox | Total (10 inboxes) |
|------|-------------------|-------------------|
| 1-2 | 10 | 100 |
| 3-4 | 20 | 200 |
| 5-6 | 35 | 350 |
| 7+ | 50 (max) | 500 |

---

## PHASE 2: WEBSITE FEATURES (Weeks 2-6)

### 2.1 Quote Builder Enhancements

From `website-enhancements2.txt`:

**PDF Import parsing improvements:**
- Parse bundled hardware lines (e.g., "Toast Flex + Tap + Printer + Cash Drawer 5")
- Split into individual items with grouping metadata
- Auto-group on import to Quote Builder grid

**Grid improvements:**
- Remove invisible wall boundaries (infinite canvas)
- Implement proper scale with visual indicators
- Enable editing of imported data (restaurant name, etc.)
- Allow removal of default networking closet

### 2.2 Toast Auto-Back-Office (Toast ABO)

**IMPORTANT CLARIFICATION:** This is NOT Toast API integration.

Toast ABO = Puppeteer/Playwright automation that:
1. Logs into Toast back-office as consultant
2. Navigates to specific client's portal
3. Performs data entry from Menu Builder output
4. Handles ongoing maintenance and audits

**Architecture:**
```
Menu Builder → Parsed Data → Toast ABO Agent → Toast Back-Office Portal
```

**Implementation Status (2026-01-07):**

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Restaurant Classification Engine | ✅ COMPLETE |
| Phase 2 | Menu Builder Integration | ✅ COMPLETE |
| Phase 3 | Toast Navigation Scripts | ⏳ PENDING |
| Phase 4 | Observer AI / Self-Healing | ⏳ PENDING |
| Phase 5 | Support Ticket Integration | ⏳ PENDING |

**Phase 1 Deliverables (COMPLETE):**
- `toast_config_templates` table with 8 templates seeded
- `modifier_rules` table with 9 cocktail/food rules seeded
- `restaurant_classifications` table for AI results
- Classification API endpoint
- Admin UI for viewing classifications

**Phase 2 Deliverables (COMPLETE):**
- "Deploy to Toast" button in Menu Builder
- DeployToToastModal component with full workflow
- Modifier rule application and preview
- Automation job creation API

**Restaurant classification for config:**
- Cuisine type
- Service style (counter vs full-service)
- Business model (cafe, speakeasy, nightclub, etc.)
- Operating hours
- Location/surroundings

### 2.3 Admin Portal Enhancements

**Three portal views needed:**

| Portal | Purpose | Features |
|--------|---------|----------|
| **Admin** | Full data access | All clients, all reps, all data |
| **Rep Portal** | Sales rep view | Assigned clients only |
| **Client Portal** | Client self-service | Their data, progress, communication |

**Demo setup:**
- Add Evan as first client AND first rep
- Test all views with real data
- Back-office toggle for admin control

### 2.4 Menu Builder Multi-Page PDF

From Day 4 - already implemented:
- Client-side PDF text extraction via `unpdf`
- Text sent to `/api/menu/parse-text` for AI parsing
- Pattern matching fallback

---

## PHASE 3: EMAIL CAMPAIGN WAVES (Weeks 2-18)

### Wave 1: Warm Leads (Weeks 1-3)
- 25 existing clients for referrals
- 50-100 past inquiries
- **Expected:** 25-40% reply, 10-15% conversion
- **Revenue:** $15,000-$25,000

### Wave 2: Toast Users (Weeks 3-8)
- ~10,000-15,000 Toast users from BuiltWith
- Support plan upsell sequence (5 emails/21 days)
- **Expected:** 5-8% reply, 1-2% conversion
- **Revenue:** $60,000-$120,000

### Wave 3: Conversion Targets (Weeks 6-12)
- ~15,000-20,000 Clover/Square users
- Migration value proposition
- $1,000 referral incentive
- **Revenue:** $50,000-$100,000

### Wave 4: Cold Outreach (Weeks 8-18)
- Remaining database
- Remote Menu Work entry offer ($800-$1,500)
- **Revenue:** $100,000-$180,000

**Email Sequence Templates to Build:**

| Sequence | Emails | Days | Target |
|----------|--------|------|--------|
| Toast Support Plan | 5 | 21 | Toast users |
| Toast Referral | 4 | 14 | All contacts |
| Remote Menu Work | 4 | 10 | National leads |
| POS Conversion | 5 | 21 | Clover/Square users |
| Booking Confirmation | 3 | 1 | Cal.com bookings |
| Post-Meeting Follow-up | 3 | 7 | After meetings |
| No-Show Re-engagement | 2 | 2 | Missed appointments |

---

## PHASE 4: AI PHONE SYSTEM (Weeks 4-12)

### 4.1 Start with Retell.ai (Week 4-6)

**Cost:** $0.07-0.15/min
**Features:** 620ms latency, Cal.com integration, SOC 2 compliant

**Initial setup:**
1. Sign up for free tier ($10 credits)
2. Configure basic receptionist with FAQ
3. Test Twilio integration
4. Validate call quality

### 4.2 Integration Architecture (Weeks 6-8)

```
Incoming Call → Retell.ai → Webhook → n8n Workflow
                                    ↓
                            Intent Classification
                                    ↓
                    ┌───────────────┼───────────────┐
                    ↓               ↓               ↓
                Booking         Support         Inquiry
                    ↓               ↓               ↓
            Acuity/Cal.com    HubSpot Ticket  HubSpot Contact
                    ↓               ↓               ↓
                SMS Confirm    Team Notify    Lead Nurture
```

### 4.3 Self-Hosting Migration (Weeks 9-12)

**Stack:** Pipecat + Deepgram + GPT-4o-mini + Piper TTS

**Cost reduction:** $0.09-0.15/min → $0.03/min

**Docker setup on Windows PC:**
- Enable Docker auto-start
- Configure watchdog for recovery
- Use ngrok for Twilio webhooks

### 4.4 Restaurant-Specific Patterns

**Call classification:**
```javascript
- Emergency: "down", "broken", "not working" → Transfer to human
- Support: "toast", "pos", "menu" → AI support
- Sales: "pricing", "demo", "interested" → AI qualify
```

**AI prompt context:**
- Toast POS troubleshooting guides
- Pricing and service packages
- Client onboarding process
- FAQ about consulting services

---

## PHASE 5: AI SEARCH OPTIMIZATION (GEO) (Ongoing)

### 5.1 Content Structure for AI Citation

**Optimal format:**
- H2 sections: 300-800 words per major topic
- H3 sections: 100-200 words for breakdowns
- Question-format headings
- First 40-60 words = direct answer
- 1 statistic per 150-200 words

**Target improvement:** 40% visibility boost

### 5.2 Schema Markup (Server-Side)

**Priority schema types:**
- Article/BlogPosting for all content
- FAQPage for FAQ sections
- HowTo for step-by-step guides
- LocalBusiness for location content
- Organization with credentials

**CRITICAL:** AI crawlers cannot execute JavaScript. Server-side rendering required.

### 5.3 AI Crawler Configuration

**robots.txt additions:**
```
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /
```

### 5.4 Monitoring Setup

**Tools:**
- Otterly.AI ($29/month) - AI visibility tracking
- GA4 custom channel for AI referrals
- Server log analysis for crawler activity

**GA4 regex filter:**
```regex
chatgpt\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com
```

---

## PHASE 6: EMAIL INFRASTRUCTURE MIGRATION (Weeks 6-14)

### 6.1 Google Workspace Dual-Domain

**Architecture:** User alias domain (no extra cost)
- Primary: evan@ccrestaurantconsulting.com
- Alias: evan@capecodrestaurantconsulting.com

**Both deliver to same inbox, can send as either.**

### 6.2 DNS Configuration

**Combined SPF record:**
```
v=spf1 include:_spf.google.com include:XXXXXX.spf03.hubspotemail.net include:resend.com ~all
```

**DKIM:** Separate keys for both domains + HubSpot + Resend

**DMARC:** Start with `p=none`, progress to `p=reject`

### 6.3 Migration Timeline

| Days | Action |
|------|--------|
| 1-3 | DNS foundation |
| 3-5 | Google Workspace activation |
| 5-7 | Forwarding from old Gmail |
| 7-28 | Domain warming |
| 14 | Cal.com migration |
| 18 | HubSpot migration |
| 21 | Resend configuration |
| 28+ | Square migration (LAST) |

---

## PHASE 7: AI MODEL ROUTING (Immediate)

### 7.1 Sunk Cost Vampire Strategy

**Current subscriptions:** $140-240/month
- Claude Max: $100-200
- ChatGPT Plus: $20
- Gemini Advanced: $20

**Strategy:** Drain web interfaces first, then cheap API, then premium.

### 7.2 Role-Based Routing

| Role | Primary | Fallback |
|------|---------|----------|
| Architect | Claude Web → Claude Sonnet 4.5 | GPT-5.2 |
| Engineer | DeepSeek V3.2 ($0.28/M) | Claude Haiku 4.5 |
| Researcher | Gemini Deep Research | ChatGPT Deep Research |
| Speed | Groq Llama 4 Scout | Qwen3-32B |
| Context | Gemini 2.5 Flash Lite (1M) | Llama 4 Maverick |

### 7.3 Web Interface Priorities

**Gemini Advanced (drain first):**
- Deep Research for market analysis
- Workspace integration (Gmail, Drive, Calendar)
- NotebookLM for podcast summaries

**Claude Max:**
- Projects feature with client files
- MCP connectors (HubSpot, Square)
- Memory across sessions

**ChatGPT Plus:**
- Deep Research (25 queries/month)
- DALL-E 3 for marketing materials

---

## WEEKLY EXECUTION SCHEDULE

### Week 1
- [ ] Apply email automation migration (0005)
- [ ] Set up cron worker infrastructure
- [ ] Begin domain warming (secondary domains)
- [ ] Start lead scoring script

### Week 2
- [ ] Build email sequence templates
- [ ] Import Tier 1 leads (4,000)
- [ ] Quote Builder PDF improvements
- [ ] Begin GEO content optimization

### Week 3
- [ ] Launch Wave 1 (warm leads)
- [ ] Toast ABO architecture design
- [ ] Admin portal enhancements begin
- [ ] AI phone research/Retell signup

### Week 4
- [ ] Wave 2 begins (Toast users)
- [ ] Retell.ai basic setup
- [ ] HubSpot workflow automation
- [ ] Schema markup implementation

### Weeks 5-6
- [ ] AI phone integration (n8n workflows)
- [ ] Email Google Workspace migration
- [ ] Rep/Client portal development
- [ ] Cal.com webhook integration

### Weeks 7-8
- [ ] Wave 3 begins (conversion targets)
- [ ] AI phone self-hosting preparation
- [ ] Toast ABO MVP development
- [ ] Full portal system testing

### Weeks 9-12
- [ ] AI phone self-hosting migration
- [ ] Wave 4 begins (cold outreach)
- [ ] Square migration (email)
- [ ] Analytics dashboard refinement

### Weeks 13-18
- [ ] Full email campaign execution
- [ ] System optimization
- [ ] Revenue target tracking
- [ ] Q2 planning

---

## SUCCESS METRICS

### Revenue Milestones

| Date | Target | Cumulative |
|------|--------|------------|
| Week 4 | $25,000 | $25,000 |
| Week 8 | $60,000 | $85,000 |
| Week 12 | $90,000 | $175,000 |
| Week 16 | $110,000 | $285,000 |
| May 1 | $115,000 | $400,000 |

### System Metrics

| Metric | Target |
|--------|--------|
| Email deliverability | >95% |
| Open rate | >30% |
| Reply rate | >5% |
| AI phone handle rate | >70% |
| Lead-to-meeting conversion | >8% |

---

## CRITICAL PATH ITEMS

1. **Email infrastructure MUST be live by Week 2** - Blocks all revenue
2. **Domain warming MUST start Week 1** - 4-6 weeks to full capacity
3. **Retell.ai setup by Week 4** - Enables 24/7 lead capture
4. **Square migration LAST** - Protects invoice deliverability

---

## DOCUMENT REFERENCES

| Document | Key Content |
|----------|-------------|
| 400K_BREAKOUT_REPORT | Revenue targets, weekly milestones |
| Toast Back-Office Automation | Puppeteer automation architecture |
| AI Search Optimization (GEO) | Content structure, schema markup |
| Complete Email Marketing | Sequences, infrastructure, waves |
| AI Phone Secretary | Retell.ai, self-hosting, integrations |
| Implementation Blueprint | Local networking page copy |
| Website Enhancements 2 | Quote Builder, Toast ABO, portals |
| Email Infrastructure Migration | Google Workspace, DNS setup |
| AI Model Routing | Cost optimization, LiteLLM config |

---

---

## PHASE X: MISSION-CRITICAL GO-LIVE (THIS WEEK)

**Added:** 2026-01-09
**Mission:** ENROLL COLD LEADS → ANNUAL SUPPORT PLANS → CAPTURE PAYMENT
**Target:** Go live by January 12, 2026

---

### CRITICAL PATH: COLD LEAD TO PAYMENT

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MISSION-CRITICAL FLOW                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. COLD OUTREACH          2. LANDING PAGE         3. LEAD CAPTURE         │
│  ┌─────────────┐           ┌─────────────┐         ┌─────────────┐         │
│  │ HubSpot     │  ──────►  │ Website     │  ────►  │ Contact     │         │
│  │ Sequences   │           │ (LIVE ✅)   │         │ Form ✅     │         │
│  │ ⚠️ NOT DONE │           │             │         │             │         │
│  └─────────────┘           └─────────────┘         └─────────────┘         │
│                                                           │                 │
│                                                           ▼                 │
│  4. DISCOVERY CALL         5. PROPOSAL              6. ENROLLMENT          │
│  ┌─────────────┐           ┌─────────────┐         ┌─────────────┐         │
│  │ Cal.com     │  ◄─────   │ Quote       │  ────►  │ Support     │         │
│  │ Booking ✅  │           │ Builder     │         │ Plan Signup │         │
│  │             │           │ (flagged)   │         │ ⚠️ NO IDs   │         │
│  └─────────────┘           └─────────────┘         └─────────────┘         │
│                                                           │                 │
│                                                           ▼                 │
│                            7. PAYMENT CAPTURE                               │
│                            ┌─────────────┐                                  │
│                            │ Square      │                                  │
│                            │ Invoices ✅ │                                  │
│                            │ Subs ⚠️ NULL│                                  │
│                            └─────────────┘                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### BLOCKER #1: SQUARE SUBSCRIPTION CATALOG (HUMAN TASK)

**Status:** ❌ BLOCKING PAYMENT CAPTURE
**File:** `functions/api/_shared/square.js:311-315`
**Current Code:**
```javascript
export const SUPPORT_PLAN_CATALOG_IDS = {
  core: null,         // BROKEN - No subscription possible
  professional: null, // BROKEN - No subscription possible
  premium: null       // BROKEN - No subscription possible
};
```

**HUMAN TASK: Create Square Subscription Plans**

| Step | Action | Details |
|------|--------|---------|
| 1 | Log into Square Dashboard | https://squareup.com/dashboard |
| 2 | Navigate to Items & Orders → Subscriptions | Left sidebar |
| 3 | Click "Create Subscription Plan" | Top right button |
| 4 | Create "Restaurant Guardian Core" | Monthly: $350, Annual: $3,850 |
| 5 | Create "Restaurant Guardian Professional" | Monthly: $500, Annual: $5,500 |
| 6 | Create "Restaurant Guardian Premium" | Monthly: $800, Annual: $8,800 |
| 7 | Copy each Plan Variation ID | Found in plan details → URL or API response |
| 8 | Provide IDs to Claude | For code update |

**Each plan should have:**
- Monthly billing option
- Annual billing option (11 months = 1 month free)
- Description matching /services page
- Location: LB8GE5HYZJYB7 (Lane B - National/Toast)

**CLAUDE TASK: Update Code After Human Provides IDs**
```javascript
// Claude will update square.js with provided IDs:
export const SUPPORT_PLAN_CATALOG_IDS = {
  core: 'PROVIDED_BY_HUMAN',
  professional: 'PROVIDED_BY_HUMAN',
  premium: 'PROVIDED_BY_HUMAN'
};
```

---

### BLOCKER #2: HUBSPOT EMAIL SEQUENCES (CLAUDE TASK)

**Status:** ❌ BLOCKING COLD OUTREACH
**Templates exist but sequences NOT created in HubSpot**

**CLAUDE TASK: Create 6 Email Sequences via HubSpot API**

| Sequence | Target | Emails | Days | Priority |
|----------|--------|--------|------|----------|
| **toast-support-upsell** | Current Toast users | 3 | 10 | HIGH |
| **clover-switch** | Clover POS users | 3 | 10 | HIGH |
| **square-switch** | Square POS users | 3 | 10 | MEDIUM |
| **new-implementation** | Toast upcoming installs | 3 | 7 | HIGHEST |
| **referral-request** | Past clients | 2 | 14 | MEDIUM |
| **reengagement** | Non-responders (45+ days) | 2 | 21 | LOW |

**HubSpot API Endpoint:** `POST /automation/v4/sequences`
**API Key Location:** `C:\Users\evanr\.claude\.secrets.local.md`
**Portal ID:** 243379742

**Email Templates (Per Sequence):**

#### Sequence 1: Toast Support Upsell (3 emails)
```
Email 1 (Day 0): "Your Toast system running at peak efficiency?"
Email 2 (Day 4): "Toast optimization quick wins (5 min read)"
Email 3 (Day 10): "Limited: $800 Toast audit this month"
```

#### Sequence 2: Clover Switch (3 emails)
```
Email 1 (Day 0): "Clover vs Toast: Real cost comparison"
Email 2 (Day 4): "$1,000 referral credit for switching"
Email 3 (Day 10): "Free Toast demo for Clover users"
```

#### Sequence 3: Square Switch (3 emails)
```
Email 1 (Day 0): "Square restaurant limitations vs Toast"
Email 2 (Day 4): "Toast implementation: What to expect"
Email 3 (Day 10): "Free Toast demo for Square users"
```

#### Sequence 4: New Implementation (3 emails) - HIGHEST PRIORITY
```
Email 1 (Day 0): "Your upcoming Toast install - tips from a certified consultant"
Email 2 (Day 3): "Menu build before install = faster launch"
Email 3 (Day 7): "Implementation support: Core, Professional, or Premium?"
```

#### Sequence 5: Referral Request (2 emails)
```
Email 1 (Day 0): "Quick favor request + $1,000 for you"
Email 2 (Day 14): "Still open: $1,000 referral credit"
```

#### Sequence 6: Re-engagement (2 emails)
```
Email 1 (Day 0): "Still need Toast help?"
Email 2 (Day 21): "Last touch: Toast consulting availability"
```

**Execution Steps:**
1. Read API key from secrets file
2. Create each sequence via HubSpot Sequences API
3. Create email templates with merge fields
4. Associate templates with sequences
5. Verify sequences appear in HubSpot UI
6. Document sequence IDs for enrollment

---

### BLOCKER #3: LEAD IMPORT (CLAUDE TASK)

**Status:** ❌ BLOCKING OUTREACH
**Current HubSpot contacts:** 614
**Available leads:** 42,967 in BuiltWith export
**File location:** `G:\RG OPS\70_LEADS_BUILTWITH\hubspot_pos_leads_consolidated.csv`

**CLAUDE TASK: Batch Import Strategy**

**Import Priority Order:**

| Batch | Segment | Count | Day | Sequence |
|-------|---------|-------|-----|----------|
| 1 | Toast Upcoming Implementations | 1,600 | Day 1 | new-implementation |
| 2 | Current Toast Users (Tier 1) | 2,400 | Day 2 | toast-support-upsell |
| 3 | Current Toast Users (Tier 2) | 5,000 | Day 4 | toast-support-upsell |
| 4 | Clover Users (Tier 1) | 3,000 | Day 7 | clover-switch |
| 5 | Square Users (Tier 1) | 3,000 | Day 10 | square-switch |
| 6+ | Remaining leads | 28,000+ | Week 3+ | Appropriate sequence |

**Lead Properties to Import:**
```json
{
  "email": "required",
  "firstname": "from business name parsing",
  "lastname": "from business name parsing",
  "company": "restaurant name",
  "phone": "if available",
  "pos_system": "Toast|Clover|Square|Other",
  "geographic_tier": "Cape Cod|MA|New England|National",
  "lead_source": "BuiltWith",
  "lead_score": "calculated 0-100",
  "tier_classification": "Hot|Warm|Nurture|Long-tail",
  "hs_lead_status": "NEW"
}
```

**HubSpot Import API:** `POST /crm/v3/imports`
**Batch size limit:** 2,000 contacts per import
**Rate limit:** 10 imports per day

**Execution Steps:**
1. Read and parse CSV file
2. Score leads using 100-point matrix
3. Segment by POS system and tier
4. Create import files (max 2,000 each)
5. Upload via HubSpot Import API
6. Associate with appropriate sequence
7. Monitor import status and errors

---

### BLOCKER #4: QUOTE BUILDER FLAG (CLAUDE TASK)

**Status:** ⚠️ OPTIONAL - Not blocking go-live
**File:** `pages/QuoteBuilder.tsx:45`
**Current Code:**
```javascript
const SHOW_COMING_SOON = true; // Blocks quote builder
```

**CLAUDE TASK: Evaluate and optionally enable**
```javascript
const SHOW_COMING_SOON = false; // Enable quote builder
```

**Decision:** Enable after first 5 clients signed to ensure quote builder is stable.

---

### GO-LIVE EXECUTION CALENDAR

#### DAY 1 (January 9, 2026) - PLANNING ✅

| Time | Task | Owner | Status |
|------|------|-------|--------|
| AM | Analyze codebase | Claude | ✅ COMPLETE |
| AM | Analyze business docs | Claude | ✅ COMPLETE |
| AM | Analyze 400K plan | Claude | ✅ COMPLETE |
| PM | Update MASTER_EXECUTION_PLAN | Claude | ✅ IN PROGRESS |
| PM | Document all blockers | Claude | ✅ COMPLETE |

#### DAY 2 (January 10, 2026) - SQUARE SETUP

| Time | Task | Owner | Status |
|------|------|-------|--------|
| AM | Create Square subscription plans | HUMAN | ⏳ PENDING |
| AM | Copy catalog IDs | HUMAN | ⏳ PENDING |
| PM | Update square.js with IDs | Claude | ⏳ PENDING |
| PM | Test subscription creation | Claude | ⏳ PENDING |
| PM | Commit and deploy | Claude | ⏳ PENDING |

#### DAY 3 (January 11, 2026) - HUBSPOT SEQUENCES

| Time | Task | Owner | Status |
|------|------|-------|--------|
| AM | Create 6 email sequences | Claude | ⏳ PENDING |
| AM | Create email templates | Claude | ⏳ PENDING |
| AM | Import Batch 1 (1,600 leads) | Claude | ⏳ PENDING |
| PM | Enroll Batch 1 in sequences | Claude | ⏳ PENDING |
| PM | Monitor delivery metrics | Claude | ⏳ PENDING |

#### DAY 4 (January 12, 2026) - GO LIVE

| Time | Task | Owner | Status |
|------|------|-------|--------|
| AM | Import Batch 2 (2,400 leads) | Claude | ⏳ PENDING |
| AM | Verify email deliverability | Claude | ⏳ PENDING |
| PM | First discovery calls booked | HUMAN | ⏳ PENDING |
| PM | Official GO-LIVE announcement | HUMAN | ⏳ PENDING |

#### DAY 5-7 (January 13-15, 2026) - VOLUME RAMP

| Task | Owner | Target |
|------|-------|--------|
| Import remaining Tier 1 leads | Claude | 5,000+ |
| Monitor response rates | Claude | >5% |
| Book discovery calls | HUMAN | 3-5 |
| Send first proposals | HUMAN | 1-2 |

---

### FALLBACK: MANUAL INVOICING (IMMEDIATE)

**If Square subscription setup is delayed:**

The website can go live TODAY using manual Square invoicing:

1. Website collects leads via contact form ✅
2. Human books discovery calls via Cal.com ✅
3. Human sends manual quote via email
4. Human creates invoice in Square Dashboard
5. Client pays invoice via Square link
6. Subscription created manually after first payment

**Square Dashboard Manual Invoice:**
- Log in: https://squareup.com/dashboard/invoices
- Click "Create Invoice"
- Add line item: "Restaurant Guardian [Tier] - Quarterly"
- Set amount: $1,050 / $1,500 / $2,400
- Send to client email
- Payment captured on acceptance

**This approach works indefinitely while automation is configured.**

---

### PARALLEL TRACK: FEATURES TO ACTIVATE LATER

**Not blocking go-live - enable after first revenue:**

| Feature | Current State | Enable When |
|---------|---------------|-------------|
| Quote Builder | SHOW_COMING_SOON=true | After 5 clients |
| Menu Builder Auth | No API auth | After 10 clients |
| Rep Portal | Complete, unused | When hiring reps |
| Toast Hub Blog | Infrastructure only | Month 2 |
| AI Phone | Not started | After email traction |
| Toast Automation | Framework only | After 15 clients |
| PandaDoc Contracts | Webhook ready | When scaling |

---

### SUCCESS METRICS (Week 1)

| Metric | Target | Tracking |
|--------|--------|----------|
| Emails sent | 4,000+ | HubSpot dashboard |
| Open rate | >25% | HubSpot analytics |
| Reply rate | >3% | HubSpot inbox |
| Discovery calls booked | 5+ | Cal.com |
| Proposals sent | 3+ | Manual tracking |
| Deals closed | 1+ | Square invoice |
| Revenue captured | $1,500+ | Square dashboard |

---

### FILES TO UPDATE DURING GO-LIVE

| File | Update | Owner |
|------|--------|-------|
| `functions/api/_shared/square.js` | Add catalog IDs | Claude |
| `pages/QuoteBuilder.tsx` | Set SHOW_COMING_SOON=false | Claude (optional) |
| `CLAUDE.md` | Add go-live checklist | Claude |
| `wrangler.toml` | Verify secrets configured | Claude |
| HubSpot | 6 sequences created | Claude |
| HubSpot | 42,967 leads imported | Claude (batched) |

---

### GIT WORKFLOW FOR GO-LIVE

```bash
# Before any changes
cd /c/Users/evanr/projects/restaurant-consulting-site
git status
git pull origin main

# After each blocker resolved
git add -A
git commit -m "GO-LIVE: [description of change]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push origin main

# Verify Cloudflare deployment
# Check: https://restaurant-consulting-site.pages.dev
# Check: https://ccrestaurantconsulting.com
```

---

---

## PHASE Y: PLATFORM CONSOLIDATION (Post Go-Live)

**Added:** 2026-01-09
**Purpose:** Consolidate standalone automation components into unified platform
**Trigger:** After first 5 clients signed (estimated Week 3-4)

---

### PLATFORM COMPONENT INVENTORY

**Comprehensive analysis completed 2026-01-09 covering 4 major systems:**

| Component | Location | Files | Status | Decision |
|-----------|----------|-------|--------|----------|
| **TOAST-ABO** | `PLATFORM/80_AUTOMATION/TOAST-ABO/` | 49+ | 60% standalone | Consolidate into website |
| **QUOTE_BUILDING** | `PLATFORM/80_AUTOMATION/QUOTE_BUILDING/` | 12 | 80% frontend | Port data to website |
| **Toast_Hub** | `PLATFORM/80_AUTOMATION/Toast_Hub/` | 0 | Placeholder | Not needed - website is hub |
| **Website** | `projects/restaurant-consulting-site/` | 4,172 | 92% complete | PRIMARY PLATFORM |

---

### TOAST-ABO COMPONENT ANALYSIS

**Path:** `C:\Users\evanr\OneDrive\Desktop\PLATFORM\business_platform_parts\80_AUTOMATION\TOAST-ABO`

#### What Exists (Node.js CLI Application)

```
MENU_BUILDING/menu-builder/
├── src/
│   ├── index.js              # CLI entry point (MenuBuilder class)
│   ├── intake/ocr.js         # Tesseract.js OCR processing
│   ├── structuring/parser.js # Regex-based menu parsing
│   └── output/
│       ├── toast.js          # Toast CSV/JSON export (GUIDs, PLU codes)
│       ├── square.js         # Square Catalog API format
│       └── pdf.js            # PDFKit professional menu generation
└── package.json              # tesseract.js, pdf-parse, pdfkit, sharp
```

#### Capabilities
- 3-stage pipeline: OCR → Parse → Export
- Multi-format input: PDF, PNG, JPG, HEIC, TIFF, BMP, WEBP
- Tesseract.js OCR with confidence scoring
- Regex-based price/category/modifier extraction
- Toast export (GUIDs, PLU codes, cents pricing)
- Square Catalog export (idempotency keys)
- Professional PDF menu generation with branding

#### Valuable Business Logic Files
- `bar_menu_logic.txt` - Cocktail pricing (bottle-to-pour math, 80% margins)
- `menu-2-venue_equation.txt` - 9-domain financial analysis framework
- `logicofquestion.txt` - Restaurant complexity classification
- `Toast automation vision.txt` - Full n8n/Puppeteer architecture spec

#### Integration Decision
| Feature | Website Status | TOAST-ABO Status | Action |
|---------|---------------|------------------|--------|
| OCR Processing | Cloudflare AI (superior) | Tesseract.js | Keep Cloudflare |
| PDF Text Extraction | unpdf (client-side) | pdf-parse | Keep unpdf |
| Menu Parsing | LLaMA 3.1 AI (flexible) | Regex (brittle) | Keep AI |
| Toast Export | Integrated with automation | CSV/JSON generation | Already done |
| Square Export | Not present | Full implementation | **PORT TO WEBSITE** |
| PDF Export | Not present | PDFKit generation | **PORT TO WEBSITE** |

#### Files to Port
1. `output/square.js` → `functions/api/menu/export-square.js`
2. `output/pdf.js` → `functions/api/menu/export-pdf.js`
3. Bar pricing logic → Modifier rules in database

---

### QUOTE_BUILDING COMPONENT ANALYSIS

**Path:** `C:\Users\evanr\OneDrive\Desktop\PLATFORM\business_platform_parts\80_AUTOMATION\QUOTE_BUILDING`

#### What Exists (Self-Contained React SPA)

```
quote-builder/
├── quote_builder_pos_networking_canvas_test_v_4.html  # 789-line React SPA
├── toast_quote_builder_spec.md                        # Full system spec (925 lines)
├── Point of Sale Install Costing*.xlsx/csv           # Hardware catalog (45 devices)
├── StationTemplates_Info.txt                          # 12 pre-built station templates
└── CORRECTED INSTALLATION COSTING AL.txt             # Business logic documentation
```

#### Hardware Catalog (45 Devices)
| Category | Devices | TTI Range |
|----------|---------|-----------|
| Terminals | Toast Flex, Go 2, Self-Service | 20-45 min |
| Printers | Thermal, Impact, Label | 30-45 min |
| Network | Router, PoE Switch, AP | 15-45 min |
| Accessories | Cash Drawer, Card Readers, Scale | 10-45 min |

#### Station Templates (12 Pre-Built)
| Template | TTI | Devices |
|----------|-----|---------|
| Server Station | 85 min | Terminal + Printer + Card Reader |
| Bar Station | 120 min | Terminal + Printer + 2 Card Readers + Drawer |
| Full Kitchen | 50 min | KDS + Kitchen Printer |
| Host Stand | 75 min | Terminal + Printer + Card Reader + Drawer |
| Takeout Station | 130 min | Terminal + Printer + Guest Pay + Drawer + Display |
| Barista Station | 190 min | Terminal + Printer + Guest Pay + Drawer + Display + Label |
| Network Area | 75 min | Router + Switch + Access Point |

#### Integration Decision
| Feature | Website Status | Standalone Status | Action |
|---------|---------------|-------------------|--------|
| Visual Canvas | Implemented | Implemented | Keep website |
| Station Templates | Basic (16) | Rich (12 w/TTI) | **IMPORT DATA** |
| Hardware Catalog | ~17 devices | 45 devices w/TTI | **IMPORT DATA** |
| Cabling Specs | Basic | Comprehensive | **IMPORT DATA** |
| Travel Zones | Implemented | Detailed | Already aligned |
| PDF Export | Not present | Spec only | **IMPLEMENT** |

#### Data to Import
1. Hardware catalog (45 devices) → `migrations/0015_hardware_catalog.sql`
2. Station templates (12) → Database seed
3. Cabling specifications → Pricing constants

---

### WEBSITE TOAST AUTOMATION STATUS

**Already Built (Phases 1-4 COMPLETE):**

| Phase | Description | Files | Status |
|-------|-------------|-------|--------|
| Phase 1 | Restaurant Classification Engine | 8 templates, 9 modifier rules | ✅ COMPLETE |
| Phase 2 | Menu Builder Integration | Deploy to Toast modal | ✅ COMPLETE |
| Phase 3 | Toast Navigation Scripts | `automation/src/toast/` (13 files) | ✅ COMPLETE |
| Phase 4 | Observer AI / Self-Healing | `automation/src/observer/` (6 files) | ✅ COMPLETE |
| Phase 5 | Support Ticket Integration | Not started | ⏳ PENDING |

**Phase 3 Capabilities (4,539 lines):**
- Self-healing CSS selectors with fallbacks
- 2FA/TOTP handling for login
- Partner portal client switching
- Menu CRUD (categories, items, modifiers)
- KDS station management and routing
- Bulk creation with progress callbacks
- Screenshot capture throughout

**Phase 4 Capabilities (2,694 lines):**
- Claude Vision API for visual element detection
- Automatic selector recovery when CSS fails
- Golden copy baseline screenshot comparison
- Daily health check verification
- Multi-channel alerts (email, webhook, API)

---

### CONSOLIDATION TASKS (Priority Order)

#### Sprint Y1: Data Migration (1-2 days)
| Task | Effort | Impact |
|------|--------|--------|
| Create `0015_hardware_catalog.sql` migration | 2 hrs | High |
| Seed 45 hardware devices with TTI | 1 hr | High |
| Seed 12 station templates | 1 hr | High |
| Update Quote Builder to fetch from API | 4 hrs | High |

**Migration Schema:**
```sql
CREATE TABLE hardware_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,  -- terminal, printer, network, accessory
  sku TEXT,
  tti_minutes INTEGER NOT NULL,
  cost_estimate REAL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE station_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  hardware_ids TEXT NOT NULL,  -- JSON array
  total_tti_minutes INTEGER NOT NULL,
  use_cases TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Sprint Y2: Export Features (2-3 days)
| Task | Effort | Impact |
|------|--------|--------|
| Port Square export to Menu Builder | 4 hrs | Medium |
| Port PDF menu generation | 6 hrs | Medium |
| Implement PDF quote export | 6 hrs | High |

#### Sprint Y3: Phase 5 Ticket Integration (3-4 days)
| Task | Effort | Impact |
|------|--------|--------|
| Ticket analysis AI | 6 hrs | Medium |
| Automation decision engine | 8 hrs | Medium |
| Approval workflows | 4 hrs | Medium |
| Client portal integration | 4 hrs | Low |

#### Sprint Y4: Puppeteer Execution (3-4 days)
| Task | Effort | Impact |
|------|--------|--------|
| Set up Browserless.io account | 1 hr | High |
| Create execution worker | 8 hrs | High |
| Wire up job queue execution | 4 hrs | High |
| Real-time progress reporting | 6 hrs | Medium |

---

### ARCHITECTURAL DECISIONS (2026-01-09)

| Decision | Rationale |
|----------|-----------|
| **OCR:** Cloudflare AI over Tesseract.js | Better accuracy, already integrated, no bundle bloat |
| **Parsing:** LLaMA 3.1 AI over regex | Handles edge cases, more flexible, learns patterns |
| **Puppeteer:** Browserless.io for production | Managed service, reliable, no Docker maintenance |
| **Job Queue:** D1 polling short-term | Simple, already working, migrate to Queues later |
| **Platform:** Website as primary | Avoid maintaining parallel systems, single source of truth |

---

### FILES TO DEPRECATE (After Porting)

| File | Reason |
|------|--------|
| `TOAST-ABO/MENU_BUILDING/menu-builder/` | CLI not needed, features in website |
| `QUOTE_BUILDING/quote_builder_*.html` | Standalone SPA replaced by website |

**Keep as Reference:**
- `bar_menu_logic.txt` - Cocktail pricing formulas
- `menu-2-venue_equation.txt` - Financial analysis framework
- `Toast automation vision.txt` - n8n architecture reference
- `toast_quote_builder_spec.md` - Backend specification reference

---

### RELATED DOCUMENTATION

| Document | Purpose |
|----------|---------|
| `PLATFORM_INTEGRATION_PLAN.md` | Detailed technical integration strategy |
| `DEVELOPMENT_ROADMAP.md` | 6-sprint plan with revenue priorities |
| `CODEBASE_DOCUMENTATION.md` | Technical reference with platform context |
| `CONTINUITY_LEDGER.md` | Session history including this analysis |

---

**Plan Created:** 2026-01-07
**Last Updated:** 2026-01-10 (Phase Z Sales & Marketing Blueprint COMPLETE)
**Status:** ACTIVE - Lead Import Infrastructure Ready
**Next Action:** Run lead imports, configure PandaDocs, enable subscriptions

---

## PHASE Z: SALES & MARKETING BLUEPRINT EXECUTION (COMPLETE)

**Completed:** 2026-01-10
**Reference:** `G:\My Drive\RG OPS\70_LEADS\RG_Sales_Marketing_Blueprint_v2.md`

### Overview

4-Phase execution of lead segmentation and outreach infrastructure:

| Phase | Description | Status |
|-------|-------------|--------|
| **Phase 1** | Email Sequences (D1) | ✅ COMPLETE |
| **Phase 2** | Website Content | ✅ COMPLETE |
| **Phase 3** | HubSpot Properties | ✅ COMPLETE |
| **Phase 4** | Lead Import Script | ✅ COMPLETE |

---

### PHASE Z.1: Email Sequences (D1 Database)

**Files Created:**
- `migrations/0019_segment_email_sequences.sql` - 3 new sequences
- `scripts/deploy_sequences.cjs` - Deployment helper

**Sequences Deployed:**

| Sequence ID | Name | Emails | Days | Target Segment |
|-------------|------|--------|------|----------------|
| `seq_pos_switcher_001` | POS Switcher Outreach | 4 | 15 | Segment A (Clover/Square) |
| `seq_transition_001` | Ownership Transition | 4 | 14 | Segment C (New Owners) |
| `seq_local_network_001` | Local Network Outreach | 4 | 14 | Segment D (Cape Cod/SE MA) |

**Email Step Structure:**

| Step | Segment A Theme | Segment C Theme | Segment D Theme |
|------|-----------------|-----------------|-----------------|
| 1 | Switch Anxiety Intro | Systems Gap Intro | Local Intro |
| 2 | Outage Insurance | Horror Story Prevention | Kitchen Environment |
| 3 | Speed Differentiator | Zero Downtime Promise | Local Case Study |
| 4 | Breakup Email | Breakup Email | Breakup Email |

**Total in D1:** 8 sequences, 22 email steps

---

### PHASE Z.2: Website Content Updates

**Files Modified:**

**`pages/Services.tsx`:**
- Added Segment A callout card (POS Switchers - orange theme)
  - "Switching from Clover or Square?" messaging
  - 48-hour menu build promise
  - "Get a Switch Readiness Audit" CTA
- Added Segment C callout card (Transitions - violet theme)
  - "Taking Over a Restaurant?" messaging
  - Zero-downtime checklist promise
  - "Schedule Transition Consultation" CTA

**`pages/LocalNetworking.tsx`:**
- Expanded service area grid from 3 to 4 columns
- Added "Southeastern MA" card (Fall River, New Bedford)
- Added "Providence Area" card

---

### PHASE Z.3: HubSpot Custom Properties

**Script:** `scripts/setup_hubspot_properties.cjs`

**8 Properties Created (verified via API):**

| Property | Type | Purpose |
|----------|------|---------|
| `rg_segment` | Enumeration | A/B/C/D segment classification |
| `rg_door` | Enumeration | National Remote / Local Regional |
| `rg_current_pos` | Enumeration | Toast/Clover/Square/Lightspeed/etc. |
| `rg_urgency_window` | Enumeration | Now / 30-60 days / 90+ days |
| `rg_ownership_change` | Enumeration | Yes / No / Unknown |
| `rg_primary_pain` | Enumeration | Migration/Support/Menu/Network/Transition |
| `rg_lead_score` | Number | 0-100 calculated score |
| `rg_source_file` | String | Original BuiltWith CSV filename |

**Cloudflare Environment Variable:** Updated with new HubSpot token (2026-01-10)

---

### PHASE Z.4: Lead Import Infrastructure

**Script:** `scripts/import_leads.cjs`

**Features:**
- Parses BuiltWith CSV format (handles compliance notice, quoted fields)
- Scores leads 0-100 based on:
  - Revenue potential (25 pts)
  - Employee count (15 pts)
  - Email presence (15 pts)
  - Phone presence (10 pts)
  - Company name (10 pts)
  - Geographic fit (15 pts for Segment D)
  - Website presence (10 pts)
- Assigns segment configuration (sequence ID, door, primary pain)
- Geographic filtering for Segment D (Cape Cod + SE MA)
- Dry run mode for testing
- Batch insertion with progress reporting

**Usage:**
```bash
# Dry run to preview
node scripts/import_leads.cjs "path/to/file.csv" A --dry-run

# Import with limit
node scripts/import_leads.cjs "path/to/file.csv" B --limit 100

# Full import
node scripts/import_leads.cjs "path/to/file.csv" A
```

**Segment Configuration:**

| Segment | Name | Sequence ID | Door | Primary Pain |
|---------|------|-------------|------|--------------|
| A | POS Switcher | seq_pos_switcher_001 | national_remote | migration |
| B | Toast Optimizer | seq_toast_support_001 | national_remote | support |
| C | Transition | seq_transition_001 | national_remote | transition |
| D | Local Network | seq_local_network_001 | local_regional | network |

---

### REMAINING WORK (Post-Phase Z)

| Category | Task | Priority | Owner |
|----------|------|----------|-------|
| **Lead Import** | Run imports for Segment A/B leads | HIGH | Claude |
| **Website Text** | Minor copy improvements | MEDIUM | Claude |
| **Contracts** | Set up PandaDoc templates | HIGH | Human |
| **Subscriptions** | Create Square subscription catalog IDs | HIGH | Human |
| **Email Bodies** | Populate sequence step body_html_a | MEDIUM | Human/Claude |

---

### LEAD IMPORT PRIORITY ORDER

| Batch | File | Segment | Count | Priority |
|-------|------|---------|-------|----------|
| 1 | Toast-POS-websites-filter-Upcoming-implementations.csv | B | ~1,600 | HIGHEST |
| 2 | All-Live-Toast-POS-WebSites.csv | B | ~15,000 | HIGH |
| 3 | All-Live-Clover-WebSites.csv | A | ~10,000 | HIGH |
| 4 | All-Live-Square-Point-of-Sale-WebSites.csv | A | ~8,000 | MEDIUM |
| 5 | MA/RI geographic filter | D | Varies | MEDIUM |

---

### SESSION SUMMARY (2026-01-10)

**Completed Tasks:**
1. ✅ Created 3 email sequences with 12 steps in D1
2. ✅ Added segment callout cards to Services.tsx
3. ✅ Added SE MA + Providence to LocalNetworking.tsx
4. ✅ Created 8 HubSpot custom properties via API
5. ✅ Built lead import script with scoring logic
6. ✅ Updated Cloudflare HUBSPOT_API_KEY env var
7. ✅ All changes committed and deployed

**Git Commits:**
- `6e9b255`: feat: add lead import and HubSpot setup scripts

**Infrastructure Status:**
- D1 Database: 8 sequences, 22 steps
- HubSpot: 8 custom properties, 614+ contacts
- Cloudflare: All env vars current
- Website: Live at ccrestaurantconsulting.com

---

## PHASE Z.5: RESTAURANT INTELLIGENCE SYSTEM (2026-01-11)

**Completed:** 2026-01-11
**Documentation:** `docs/RESTAURANT_INTELLIGENCE_SYSTEM.md`

### Overview

Comprehensive database and classification system connecting:
**Leads → Classification → POS Config → Quote Builder → Menu Builder**

### Database Schema (11 new tables in D1)

| Table | Records | Purpose |
|-------|---------|---------|
| `cuisine_types` | 20 | Cuisine categories with keywords |
| `service_styles` | 8 | Fine Dining → QSR |
| `bar_programs` | 6 | Full Bar, Beer/Wine, None |
| `menu_complexity_profiles` | 4 | Simple → Ultra Complex |
| `restaurant_type_templates` | 13 | Combined restaurant profiles |
| `pos_config_templates` | 6 | POS config by restaurant type |
| `restaurant_leads` | 42,969 capacity | Master lead database |
| `lead_segments` | 9 | Dynamic segment definitions |
| `lead_segment_members` | - | Lead-to-segment assignments |
| `lead_contacts` | - | Contact persons |
| `lead_activity_log` | - | Activity tracking |

### Lead Processing System

**Script:** `scripts/process_leads.cjs`

**Capabilities:**
- Parses all BuiltWith CSV files
- Deduplicates 55,594 → 42,969 unique domains
- Auto-classifies cuisine from company names
- Calculates lead scores (0-100)
- Assigns to 9 segments
- Exports workbooks to G: drive

**Usage:**
```bash
node scripts/process_leads.cjs --stats    # Statistics only
node scripts/process_leads.cjs --export   # Export workbooks
node scripts/process_leads.cjs --import   # Import to D1
```

### Lead Segments Generated

| Segment | Count | Email Sequence |
|---------|-------|----------------|
| Toast Existing | 15,786 | seq_toast_support_001 |
| Clover Switchers | 12,397 | seq_pos_switcher_001 |
| Square Switchers | 12,080 | seq_pos_switcher_001 |
| Contactable | 3,398 | - |
| Toast Upcoming | 1,614 | seq_toast_support_001 |
| Upserve Switchers | 1,045 | seq_pos_switcher_001 |
| High Value (80+) | 477 | - |
| Massachusetts | 251 | - |
| Cape Cod | 3 | seq_local_network_001 |

### Workbooks Exported

Location: `G:/My Drive/RG OPS/70_LEADS/SEGMENTED_WORKBOOKS/`

| File | Leads |
|------|-------|
| ALL_LEADS_MASTER_2026-01-11.csv | 42,969 |
| seg_toast_existing_2026-01-11.csv | 15,786 |
| seg_switcher_clover_2026-01-11.csv | 12,397 |
| seg_switcher_square_2026-01-11.csv | 12,080 |
| seg_contactable_2026-01-11.csv | 3,398 |
| seg_toast_upcoming_2026-01-11.csv | 1,614 |
| seg_high_value_2026-01-11.csv | 477 |
| seg_local_ma_2026-01-11.csv | 251 |

### Email Content Completed (2026-01-11)

All 22 email steps now have full HTML content:

| Sequence | Steps | Status |
|----------|-------|--------|
| Toast Support | 5 | ✅ Full content |
| Menu Work | 2 | ✅ Full content |
| POS Switcher | 4 | ✅ Full content |
| Transition | 4 | ✅ Full content |
| Local Network | 4 | ✅ Full content |
| Booking/Post-Meeting/No-Show | 3 | ✅ Full content |

### Git Commits (2026-01-11)

1. `9dbd810` - Add email sequence content for Switcher, Transition, and Network sequences
2. `3260cfb` - Add Restaurant Intelligence System for lead classification and segmentation

---

### NEXT ACTIONS (Post-Phase Z.5)

| Priority | Task | Command/Action |
|----------|------|----------------|
| 1 | Import leads to D1 | `node scripts/process_leads.cjs --import` |
| 2 | Sync high-value to HubSpot | Export seg_high_value + seg_contactable |
| 3 | Begin outreach | Activate sequences for Toast Upcoming |
| 4 | Square subscriptions | **HUMAN: Create catalog IDs** |
| 5 | PandaDoc templates | **HUMAN: Set up contracts** |

---

