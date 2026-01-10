# Development Roadmap
## R&G Consulting - Restaurant Consulting Platform

**Created:** 2026-01-09
**Target:** $400K Revenue by May 1, 2026 (Operation Breakout)
**Days Remaining:** 112

---

## CURRENT PLATFORM STATUS

| Component | Completion | Revenue Impact |
|-----------|------------|----------------|
| Public Website | 100% | Lead generation |
| Admin Dashboard | 98% | Operations |
| Email Automation | 95% | Outreach ($315K-$410K potential) |
| Client Portal | 95% | Client retention |
| Rep Portal | 100% | Sales team |
| Quote Builder | 80% | Sales conversion |
| Menu Builder | 75% | Service delivery |
| Toast Automation | 60% | Efficiency (Phase 5 pending) |
| Billing Integration | 50% | Revenue collection |
| **Overall** | **92%** | |

---

## PRIORITY TIERS

### TIER 0: REVENUE BLOCKERS (Do First)

These items directly block revenue generation or collection.

| Task | Impact | Effort | Dependencies |
|------|--------|--------|--------------|
| **Complete billing/invoicing** | High | 2-3 days | Square configured |
| **Quote Builder PDF import** | High | 1 day | None |
| **PDF quote export** | High | 2 days | None |

**Why P0:**
- Can't collect money without invoicing
- Can't close sales without professional quotes
- Direct path to revenue

### TIER 1: EFFICIENCY MULTIPLIERS (Next)

These items multiply capacity to serve more clients.

| Task | Impact | Effort | Dependencies |
|------|--------|--------|--------------|
| **Hardware catalog migration** | Medium | 1 day | None |
| **Station templates seed** | Medium | 0.5 days | Hardware catalog |
| **Menu Builder Square export** | Medium | 1 day | None |
| **Menu Builder PDF export** | Medium | 1.5 days | None |

**Why P1:**
- More accurate quotes = higher close rate
- Square export expands addressable market
- PDF menus = professional deliverables

### TIER 2: AUTOMATION DEPTH (Then)

These items reduce manual work per client.

| Task | Impact | Effort | Dependencies |
|------|--------|--------|--------------|
| **Phase 5: Ticket Integration** | Medium | 3-4 days | None |
| **Stripe checkout for quotes** | Medium | 2 days | PDF export |
| **HubSpot deal creation on quote** | Medium | 1 day | Stripe checkout |

**Why P2:**
- Automated ticket handling = scale support
- Stripe checkout = instant deposits
- CRM sync = no manual data entry

### TIER 3: INFRASTRUCTURE (Later)

These items enable future capabilities.

| Task | Impact | Effort | Dependencies |
|------|--------|--------|--------------|
| **Puppeteer execution worker** | High | 3-4 days | Browserless account |
| **Toast automation execution** | High | 2-3 days | Puppeteer worker |
| **Real-time job progress** | Medium | 1-2 days | Execution worker |

**Why P3:**
- Enables fully automated Toast configuration
- High effort, requires external service setup

### TIER 4: CONSOLIDATION (Maintenance)

Clean up and consolidate parallel systems.

| Task | Impact | Effort | Dependencies |
|------|--------|--------|--------------|
| **Archive TOAST-ABO CLI** | Low | 0.5 days | Features ported |
| **Archive QUOTE_BUILDING standalone** | Low | 0.5 days | Data migrated |
| **Consolidate documentation** | Low | 1 day | None |

---

## SPRINT PLAN

### Sprint 1: Revenue Enablement (Week of Jan 13)

**Goal:** Enable billing and professional quote delivery

**Tasks:**
1. Complete Square billing integration
   - `/api/billing/create-invoice` endpoint
   - Invoice UI in admin dashboard
   - Client portal invoice view

2. Quote Builder PDF import completion
   - Fix OCR processing for bundled line items
   - Parse Toast quote PDFs into hardware list

3. PDF quote export
   - Professional PDF with branding
   - Hardware breakdown, labor, travel
   - Support plan options

**Deliverables:**
- Functional invoicing
- Quote import working
- Professional PDF quotes

### Sprint 2: Data Foundation (Week of Jan 20)

**Goal:** Migrate hardware catalog and templates

**Tasks:**
1. Database migration (0015_hardware_catalog.sql)
   - 45 hardware devices with TTI
   - 12 station templates
   - Cabling specifications

2. API endpoints
   - `/api/quote/hardware` - GET catalog
   - `/api/quote/templates` - GET templates
   - `/api/quote/calculate` - Server-side pricing

3. Update Quote Builder UI
   - Fetch hardware from API
   - Use templates from database

**Deliverables:**
- Hardware catalog in database
- Templates seeded
- Quote Builder uses database

### Sprint 3: Menu Builder Enhancement (Week of Jan 27)

**Goal:** Complete menu export capabilities

**Tasks:**
1. Square Catalog export
   - Port logic from TOAST-ABO
   - `/api/menu/export-square` endpoint
   - UI button in Menu Builder

2. PDF menu generation
   - Port PDFKit logic from TOAST-ABO
   - `/api/menu/export-pdf` endpoint
   - Customizable colors/branding

**Deliverables:**
- Square export functional
- PDF menus generatable

### Sprint 4: Automation Depth (Week of Feb 3)

**Goal:** Phase 5 ticket integration

**Tasks:**
1. Ticket analysis AI
   - Classify ticket intent
   - Extract actionable items
   - Suggest automation

2. Automation decision engine
   - Match tickets to automation scripts
   - Risk scoring for auto-execution

3. Approval workflows
   - Human-in-the-loop for high-risk
   - Auto-execute low-risk

**Deliverables:**
- AI ticket classification
- Automation suggestions in UI
- Approval flow for automation

### Sprint 5: Payment Automation (Week of Feb 10)

**Goal:** Automated payment flow for quotes

**Tasks:**
1. Stripe checkout integration
   - Create checkout session from quote
   - 50% deposit collection
   - Webhook for payment confirmation

2. Post-payment automation
   - Auto-create HubSpot deal
   - Trigger Cal.com booking email
   - Update quote status

**Deliverables:**
- Stripe checkout working
- Automated post-payment flow

### Sprint 6: Toast Execution (Week of Feb 17)

**Goal:** Puppeteer automation execution

**Tasks:**
1. Set up Browserless.io account
2. Create execution worker
3. Wire up job queue execution
4. Real-time progress reporting

**Deliverables:**
- Toast automation actually executes
- Progress visible in admin

---

## METRICS TRACKING

### Weekly Check-ins

| Week | Target | Measure |
|------|--------|---------|
| Jan 13 | Invoicing works | Can send invoice |
| Jan 20 | Hardware catalog live | 45 devices in DB |
| Jan 27 | Menu exports work | PDF + Square |
| Feb 3 | Ticket AI classifies | 80% accuracy |
| Feb 10 | Payments automated | Stripe checkout works |
| Feb 17 | Toast executes | Job completes successfully |

### Revenue Milestones (Operation Breakout)

| Date | Weekly Target | Cumulative |
|------|---------------|------------|
| Jan 20 | $23,529 | $47,058 |
| Feb 3 | $23,529 | $94,116 |
| Feb 17 | $23,529 | $141,174 |
| Mar 3 | $23,529 | $188,232 |
| Mar 17 | $23,529 | $235,290 |
| Apr 1 | $23,529 | $282,348 |
| Apr 15 | $23,529 | $329,406 |
| May 1 | $23,529 | $400,000 |

---

## RISK REGISTER

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Browserless.io setup delays | Medium | High | Start account setup early |
| Toast UI changes break automation | Medium | High | Observer AI self-healing |
| Stripe integration complexity | Low | Medium | Use prebuilt components |
| Hardware catalog incomplete | Low | Low | Start with 17, expand |

---

## DECISION LOG

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-09 | Use Cloudflare AI over Tesseract.js | Better accuracy, already integrated |
| 2026-01-09 | Use website as primary platform | Avoid maintaining parallel systems |
| 2026-01-09 | Browserless.io for Puppeteer | Managed service, reliable |
| 2026-01-09 | D1 polling for job queue | Simple, already working |

---

## REFERENCE DOCUMENTS

| Document | Purpose |
|----------|---------|
| `PLATFORM_INTEGRATION_PLAN.md` | Technical integration strategy |
| `CODEBASE_DOCUMENTATION.md` | Technical reference |
| `CONTINUITY_LEDGER.md` | Session history |
| `CLOUDFLARE_STATUS.md` | Infrastructure state |
| `CLAUDE.md` | System IDs and credentials |

---

**Document Version:** 1.0
**Next Review:** Jan 13, 2026 (Sprint 1 kickoff)
