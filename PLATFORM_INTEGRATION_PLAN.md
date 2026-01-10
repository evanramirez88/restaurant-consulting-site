# Platform Integration Plan
## R&G Consulting - Toast Automation Platform

**Created:** 2026-01-09
**Status:** Planning Phase
**Purpose:** Consolidate standalone automation components into the unified web platform

---

## EXECUTIVE SUMMARY

This document outlines the integration strategy for bringing three standalone automation systems into the `restaurant-consulting-site` platform:

| Component | Location | Current State | Target State |
|-----------|----------|---------------|--------------|
| **Menu Builder (TOAST-ABO)** | `PLATFORM/80_AUTOMATION/TOAST-ABO/MENU_BUILDING/` | Node.js CLI (60% complete) | Integrated into website (75% complete) |
| **Quote Builder** | `PLATFORM/80_AUTOMATION/QUOTE_BUILDING/` | React SPA (80% frontend) | Integrated into website (80% complete) |
| **Toast Automation Engine** | Website `automation/src/toast/` | Puppeteer framework | Execute via job queue |

**Key Insight:** The website already has significant Toast automation infrastructure built (Phases 1-4 complete). The standalone TOAST-ABO and QUOTE_BUILDING components need to be consolidated.

---

## 1. CURRENT STATE ANALYSIS

### 1.1 Website (restaurant-consulting-site) - 92% Complete

**Already Built:**
- Menu Builder UI (`/menu-builder`) - OCR processing via Cloudflare AI
- Quote Builder UI (`/quote-builder`) - Visual floor planner
- Toast Automation Framework (Phases 1-4 complete):
  - Phase 1: Restaurant Classification Engine
  - Phase 2: Menu Builder Integration (Deploy to Toast modal)
  - Phase 3: Toast Navigation Scripts (Puppeteer/Playwright)
  - Phase 4: Observer AI / Self-Healing

**Database Tables (40+):**
- `toast_config_templates` - 8 restaurant type templates
- `restaurant_classifications` - AI classification results
- `modifier_rules` - 9 cocktail/food rules
- `automation_jobs` - Job queue for Puppeteer execution
- `automation_job_steps` - Step progress tracking
- `toast_selectors` - Self-healing UI selectors

### 1.2 TOAST-ABO (Standalone) - 60% Complete

**What Exists:**
```
MENU_BUILDING/menu-builder/
├── src/
│   ├── index.js              # CLI entry point
│   ├── intake/ocr.js         # Tesseract.js OCR
│   ├── structuring/parser.js # Regex-based menu parser
│   └── output/
│       ├── toast.js          # Toast CSV/JSON export
│       ├── square.js         # Square Catalog export
│       └── pdf.js            # PDFKit menu generation
└── package.json              # tesseract.js, pdf-parse, pdfkit, sharp
```

**Capabilities:**
- Multi-format file support (PDF, PNG, JPG, HEIC, TIFF, BMP, WEBP)
- Tesseract.js OCR with confidence scoring
- Regex-based price/category/modifier extraction
- Toast format export (GUIDs, PLU codes, cents pricing)
- Square format export (Catalog API structure)
- Professional PDF menu generation

**Not Implemented:**
- LLM-powered structuring (regex only)
- Puppeteer Toast UI automation
- n8n workflow integration
- Human-in-the-loop validation UI

### 1.3 QUOTE_BUILDING (Standalone) - 80% Frontend Complete

**What Exists:**
```
quote-builder/
├── quote_builder_pos_networking_canvas_test_v_4.html  # Complete React SPA (789 lines)
├── toast_quote_builder_spec.md                        # Full system spec (925 lines)
├── Point of Sale Install Costing*.xlsx/csv           # Hardware catalog (45 devices)
└── StationTemplates_Info.txt                          # 12 pre-built station templates
```

**Capabilities (Frontend):**
- Visual canvas with drag-drop stations
- 16 pre-built station templates
- 17 hardware devices with TTI (Time-to-Install)
- Cable run visualization with distance calculation
- Real-time cost estimation
- Travel zone pricing (Cape Cod, South Shore, Islands)
- Support plan tier selection (10%/20%/30%)
- localStorage persistence
- JSON export

**Not Implemented:**
- Backend API (FastAPI spec exists)
- Database storage (PostgreSQL schema defined)
- Authentication/user accounts
- Stripe payment integration
- HubSpot CRM sync
- PDF quote generation
- Calendly booking integration

---

## 2. INTEGRATION STRATEGY

### 2.1 Menu Builder Consolidation

**Decision:** Use website's Menu Builder as primary, enhance with TOAST-ABO features.

| Feature | Website Status | TOAST-ABO Status | Action |
|---------|---------------|------------------|--------|
| OCR Processing | Cloudflare AI | Tesseract.js | Keep Cloudflare (better accuracy) |
| PDF Text Extraction | unpdf (client-side) | pdf-parse | Keep unpdf |
| Menu Parsing | LLaMA 3.1 AI | Regex patterns | Keep AI (more flexible) |
| Toast Export | Integrated with automation | CSV/JSON generation | Merge export logic |
| Square Export | Not present | Full implementation | Port to website |
| PDF Export | Not present | PDFKit generation | Port to website |
| Deploy to Toast | Modal + job queue | Not present | Already done |

**Files to Port:**
1. `output/square.js` - Square Catalog export format
2. `output/pdf.js` - Professional menu PDF generation
3. Bar menu logic from `BAR/bar_menu_logic.txt` - Cocktail pricing rules

### 2.2 Quote Builder Consolidation

**Decision:** Website's Quote Builder is the primary. Port missing backend from spec.

| Feature | Website Status | Standalone Status | Action |
|---------|---------------|-------------------|--------|
| Visual Canvas | Implemented | Implemented | Keep website version |
| Station Templates | Basic | 16 templates | Enhance website |
| Hardware Catalog | ~17 devices | 45 devices | Import full catalog |
| TTI Calculations | Basic | Comprehensive | Update pricing logic |
| Travel Zones | Basic | Detailed | Already aligned |
| PDF Import | WIP (incomplete) | Not present | Complete OCR logic |
| PDF Export | Not present | Spec only | Implement |
| Stripe Integration | Not present | Spec only | Implement |
| CRM Sync | Via HubSpot | Spec only | Already integrated |

**Files to Port:**
1. Hardware catalog from `Point of Sale Install Costing.xlsx` (45 devices)
2. Station templates from `StationTemplates_Info.txt` (12 templates)
3. Cabling specification database

### 2.3 Toast Automation Enhancement

**Current Status (Website):**
```
automation/src/
├── observer/
│   ├── visualDetection.js    # Claude Vision API
│   ├── selfHealing.js        # Selector recovery
│   ├── goldenCopy.js         # Screenshot comparison
│   ├── healthCheck.js        # Daily verification
│   └── alerting.js           # Multi-channel alerts
└── toast/
    ├── login.js              # 2FA/TOTP handling
    ├── switchClient.js       # Partner portal
    ├── menu/                 # Full menu CRUD
    └── kds/                  # KDS configuration
```

**Phase 5 (Pending):** Support Ticket Integration
- Ticket analysis AI
- Automation decision engine
- Approval workflows
- Client portal integration

---

## 3. IMPLEMENTATION PHASES

### Phase A: Data Consolidation (1-2 days)

**Tasks:**
1. Create database migration for hardware catalog (45 devices)
2. Seed station templates (12 templates from StationTemplates_Info.txt)
3. Import cabling specifications
4. Update Quote Builder to use database instead of hardcoded data

**Deliverables:**
- `migrations/0015_hardware_catalog.sql`
- Updated `/api/quote/hardware` endpoint
- Updated `/api/quote/templates` endpoint

### Phase B: Quote Builder Completion (2-3 days)

**Tasks:**
1. Complete PDF import OCR logic
2. Implement PDF quote export
3. Add Stripe checkout for deposits
4. Wire up HubSpot deal creation on quote submission

**Deliverables:**
- `/api/quote/import-pdf` - Complete PDF parsing
- `/api/quote/export-pdf` - Professional quote PDF
- `/api/quote/checkout` - Stripe session creation
- Updated Quote Builder UI

### Phase C: Menu Builder Enhancement (1-2 days)

**Tasks:**
1. Port Square export format from TOAST-ABO
2. Port PDF menu generation from TOAST-ABO
3. Add bar menu pricing rules

**Deliverables:**
- `/api/menu/export-square` - Square Catalog format
- `/api/menu/export-pdf` - Professional menu PDF
- Updated Menu Builder UI with export options

### Phase D: Toast Automation Phase 5 (3-4 days)

**Tasks:**
1. Build ticket analysis AI
2. Create automation decision engine
3. Add approval workflows
4. Integrate with client portal

**Deliverables:**
- `automation/src/tickets/` - Ticket analysis module
- `/api/admin/tickets/analyze` - AI ticket classification
- Updated ticketing dashboard with automation suggestions

### Phase E: Backend Execution Infrastructure (2-3 days)

**Tasks:**
1. Create Cloudflare Worker for Puppeteer execution
2. Set up Browserless.io or self-hosted Chromium
3. Wire up job queue execution
4. Implement progress reporting via WebSocket

**Deliverables:**
- `workers/toast-executor/` - Puppeteer execution worker
- Real-time job progress in admin UI
- Screenshot storage in R2

---

## 4. ARCHITECTURE DECISIONS

### 4.1 OCR Strategy

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Cloudflare AI (current)** | Fast, no cold start, integrated | Limited models | Use for images |
| **Tesseract.js (TOAST-ABO)** | Client-side, no API calls | Large bundle, slow | Deprecated |
| **unpdf (current)** | Client-side PDF text | No image OCR | Use for text PDFs |

**Decision:** Keep Cloudflare AI for image OCR, unpdf for text-based PDFs.

### 4.2 Menu Parsing Strategy

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **LLaMA 3.1 (current)** | Flexible, handles edge cases | API cost, latency | Primary |
| **Regex (TOAST-ABO)** | Fast, no API cost | Brittle, limited | Fallback |

**Decision:** Use AI parsing with regex fallback for simple menus.

### 4.3 Puppeteer Execution

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Cloudflare Worker** | Integrated, scales | 10 second timeout | Not viable |
| **Browserless.io** | Managed, reliable | Monthly cost | For production |
| **Self-hosted (Docker)** | Control, no cost | Maintenance | For development |

**Decision:** Use Browserless.io for production, Docker for development.

### 4.4 Job Queue

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **D1 polling (current)** | Simple, integrated | Polling overhead | Short-term |
| **Cloudflare Queues** | Native, scalable | Limited features | Mid-term |
| **Durable Objects** | State, WebSocket | Complex | Long-term |

**Decision:** Continue D1 polling, migrate to Queues when traffic increases.

---

## 5. DATA MODELS

### 5.1 Hardware Catalog (New)

```sql
CREATE TABLE hardware_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'terminal', 'printer', 'network', 'accessory'
  sku TEXT,
  tti_minutes INTEGER NOT NULL,  -- Time to install
  cost_estimate REAL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed example:
INSERT INTO hardware_catalog (name, category, tti_minutes, cost_estimate) VALUES
('Toast Flex Terminal', 'terminal', 45, 799.00),
('Toast Go 2', 'terminal', 20, 389.00),
('Thermal Receipt Printer', 'printer', 30, 299.00),
('Kitchen Impact Printer', 'printer', 30, 399.00),
('Toast Router', 'network', 45, 199.00),
-- ... 40 more devices
```

### 5.2 Station Templates (New)

```sql
CREATE TABLE station_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  hardware_ids TEXT NOT NULL,  -- JSON array of hardware_catalog IDs
  total_tti_minutes INTEGER NOT NULL,
  use_cases TEXT,  -- JSON array of use case strings
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed example:
INSERT INTO station_templates (name, hardware_ids, total_tti_minutes) VALUES
('Server Station', '[1, 5, 10]', 85),
('Bar Station', '[1, 5, 10, 12, 6]', 120),
('Full Kitchen', '[4, 6]', 50),
-- ... 9 more templates
```

### 5.3 Quote Quotes (Existing - Enhancement)

```sql
-- Add columns to existing quotes table
ALTER TABLE quotes ADD COLUMN hardware_config TEXT;  -- JSON of selected hardware
ALTER TABLE quotes ADD COLUMN station_config TEXT;   -- JSON of station placements
ALTER TABLE quotes ADD COLUMN cabling_config TEXT;   -- JSON of cable runs
ALTER TABLE quotes ADD COLUMN travel_zone TEXT;
ALTER TABLE quotes ADD COLUMN support_tier INTEGER DEFAULT 0;
ALTER TABLE quotes ADD COLUMN stripe_session_id TEXT;
ALTER TABLE quotes ADD COLUMN deposit_paid_at DATETIME;
```

---

## 6. API ENDPOINTS (New/Updated)

### Quote Builder Enhancements

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/quote/hardware` | GET | List hardware catalog |
| `/api/quote/templates` | GET | List station templates |
| `/api/quote/calculate` | POST | Calculate pricing server-side |
| `/api/quote/export-pdf` | POST | Generate professional PDF |
| `/api/quote/checkout` | POST | Create Stripe session |

### Menu Builder Enhancements

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/menu/export-square` | POST | Export Square Catalog format |
| `/api/menu/export-pdf` | POST | Generate professional menu PDF |

### Automation Enhancements

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/automation/jobs/[id]/execute` | POST | Trigger Puppeteer execution |
| `/api/automation/jobs/[id]/status` | GET | Real-time status (SSE) |
| `/api/admin/tickets/analyze` | POST | AI ticket classification |

---

## 7. PRIORITY MATRIX

| Priority | Task | Impact | Effort | Dependencies |
|----------|------|--------|--------|--------------|
| **P0** | Complete Quote Builder PDF import | High | Low | None |
| **P0** | Complete billing/invoicing | High | Medium | Square configured |
| **P1** | Hardware catalog migration | Medium | Low | None |
| **P1** | PDF quote export | High | Medium | Hardware catalog |
| **P2** | Square menu export | Medium | Low | None |
| **P2** | PDF menu export | Medium | Medium | None |
| **P3** | Stripe checkout integration | Medium | Medium | Quote PDF |
| **P3** | Phase 5 ticket integration | Medium | High | None |
| **P4** | Puppeteer execution worker | High | High | Browserless account |

---

## 8. FILE CONSOLIDATION PLAN

### Files to Deprecate (TOAST-ABO)

After porting functionality to website:

| File | Reason | Action |
|------|--------|--------|
| `menu-builder/src/intake/ocr.js` | Cloudflare AI superior | Archive |
| `menu-builder/src/structuring/parser.js` | LLaMA 3.1 superior | Archive |
| `menu-builder/src/index.js` | CLI not needed | Archive |

### Files to Keep (Reference)

| File | Purpose |
|------|---------|
| `menu_extractor_pro.txt` | Requirements documentation |
| `menu-2-venue_equation.txt` | Financial modeling reference |
| `bar_menu_logic.txt` | Cocktail pricing rules |
| `Toast automation vision.txt` | Architecture reference |

### Files to Port

| Source | Destination | Purpose |
|--------|-------------|---------|
| `output/square.js` | `functions/api/menu/export-square.js` | Square export |
| `output/pdf.js` | `functions/api/menu/export-pdf.js` | Menu PDF |
| `Point of Sale Install Costing.xlsx` | `migrations/0015_*.sql` | Hardware catalog |
| `StationTemplates_Info.txt` | `migrations/0015_*.sql` | Station templates |

---

## 9. SUCCESS METRICS

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Quote Builder completion | 80% | 95% | Feature checklist |
| Menu Builder completion | 75% | 90% | Feature checklist |
| Toast Automation completion | 60% | 80% | Phase completion |
| Overall platform completion | 92% | 96% | Weighted average |

---

## 10. NEXT SESSION TASKS

**Immediate (This Session):**
1. Update CONTINUITY_LEDGER.md with this planning session
2. Create hardware catalog migration (0015)
3. Seed station templates

**Short-term (Next 2-3 Sessions):**
1. Complete Quote Builder PDF import
2. Implement PDF quote export
3. Port Square export to Menu Builder

**Medium-term (Next Week):**
1. Phase 5 ticket integration
2. Puppeteer execution infrastructure
3. Stripe checkout integration

---

**Document Version:** 1.0
**Last Updated:** 2026-01-09
