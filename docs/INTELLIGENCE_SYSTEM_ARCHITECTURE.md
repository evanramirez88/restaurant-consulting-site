# R&G Consulting Intelligence System - Comprehensive Architecture

**Version:** 2.0
**Last Updated:** 2026-01-19
**Status:** OPERATIONAL (Core System Live)

---

## Executive Summary

The R&G Consulting Intelligence System is an autonomous lead discovery, enrichment, and scoring platform designed to continuously identify restaurant prospects in the Cape Cod, South Shore, Boston, and Islands regions. The system integrates with HubSpot CRM, Cloudflare D1 database, and email automation to create a full-funnel lead management pipeline.

### Current State (Post-Audit)
- **254 leads** in database (215 from HubSpot sync, 39 test/discovered)
- **Prospects API** - OPERATIONAL (fixed 2026-01-19)
- **HubSpot Sync** - OPERATIONAL (bi-directional with ID generation)
- **Email Sequences** - 8 sequences with 22 steps configured
- **Lead Scoring** - Basic algorithm implemented
- **Core 4 Agents** - Architecture defined, partial implementation

---

## System Components

### 1. Database Layer (Cloudflare D1)

**Database:** `rg-consulting-forms`
**Database ID:** `eb39c9a2-24ed-426e-9260-a1fb55d899cb`

#### Primary Tables

| Table | Records | Purpose |
|-------|---------|---------|
| `restaurant_leads` | 254 | Master lead database |
| `intelligence_run_logs` | 1+ | Agent execution history |
| `email_sequences` | 8 | Automated email campaigns |
| `email_sequence_steps` | 22 | Individual email templates |
| `email_enrollments` | - | Contact-to-sequence assignments |
| `clients` | - | Converted leads |
| `lead_segments` | 9 | Dynamic segmentation |

#### restaurant_leads Schema (60 columns)

```sql
-- Core Identity
id TEXT PRIMARY KEY,           -- Format: lead_hs_{timestamp}_{random}
hubspot_id TEXT UNIQUE,        -- HubSpot contact ID
name TEXT,                     -- Business name
dba_name TEXT,                 -- DBA / trade name
domain TEXT,                   -- Website domain

-- Contact Info
primary_email TEXT,
primary_phone TEXT,
website_url TEXT,

-- Location
address TEXT,
city TEXT,
state TEXT,
zip TEXT,
country TEXT DEFAULT 'US',

-- Classification
cuisine_primary TEXT,
cuisine_secondary TEXT,
service_style TEXT,            -- Fine Dining, Casual, QSR, etc.
bar_program TEXT,              -- Full Bar, Beer/Wine, None

-- Technology
current_pos TEXT,              -- Toast, Square, Clover, etc.
pos_contract_end DATE,
tech_stack JSON,

-- Business Intelligence
lead_score INTEGER DEFAULT 0,
status TEXT DEFAULT 'prospect', -- prospect, lead, qualified, client
source TEXT,                   -- hubspot, builtwith, discovered, manual
revenue_estimate INTEGER,
employee_count INTEGER,
years_in_business INTEGER,

-- Sync Tracking
hubspot_synced_at INTEGER,
created_at INTEGER,
updated_at INTEGER
```

### 2. API Layer (Cloudflare Pages Functions)

**Base URL:** `https://ccrestaurantconsulting.com/api`

#### Intelligence Endpoints

| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `/admin/intelligence/prospects` | GET | **WORKING** | List/search prospects |
| `/admin/intelligence/enrich` | POST | WORKING | Enrich single lead |
| `/admin/intelligence/crawler` | POST | WORKING | Web scraping engine |
| `/admin/intelligence/runner` | POST | WORKING | Manual agent trigger |
| `/intelligence/agents` | GET/POST | PARTIAL | Core 4 agent system |
| `/sync/hubspot-contacts` | POST/GET | **WORKING** | HubSpot sync |
| `/email/enroll` | POST/GET | WORKING | Sequence enrollment |

#### API Code Inventory

```
functions/api/admin/intelligence/
├── prospects.js       # 170 lines - Lead listing with filters
├── enrich.js          # 580 lines - Tavily/web enrichment
├── crawler.js         # 700 lines - Website scraping
├── runner.js          # 180 lines - Manual agent trigger
├── schedule.js        # 120 lines - Scheduled runs
└── intelligence-runner.js  # 450 lines - Scheduled worker

functions/api/intelligence/
└── agents.js          # 600 lines - Core 4 agents

functions/api/sync/
└── hubspot-contacts.ts # 250 lines - HubSpot sync

functions/api/email/
└── enroll.js          # 200 lines - Sequence enrollment

functions/api/_shared/
├── email-enrollment.js # 150 lines - Shared enrollment logic
└── stripe.js          # Billing integration
```

**Total Intelligence Code:** ~4,200 lines across 19 files

### 3. Frontend Layer (React/TypeScript)

**Location:** `src/components/admin/intelligence/`

| Component | Purpose |
|-----------|---------|
| `ResearchPanel.tsx` | Main Intelligence dashboard |
| `IntelligenceStatus.tsx` | Agent status display |
| `AgentConfigPanel.tsx` | Agent configuration |
| `ProspectTable.tsx` | Lead grid display |

### 4. Core 4 Intelligence Agents

The system implements four specialized autonomous agents:

#### Hunter Agent
- **Schedule:** 4:00 AM daily
- **Tasks:**
  - Scan licensing boards for new permits
  - Monitor commercial real estate listings
  - Track Toast referral opportunities
  - Discover new restaurant openings
- **Status:** 70% implemented (simulated discovery)

#### Analyst Agent
- **Schedule:** 5:00 AM daily
- **Tasks:**
  - Audit POS systems via tech detection
  - Map LinkedIn networks for decision makers
  - Analyze support patterns and pain points
  - Score leads based on signals
- **Status:** 75% implemented

#### Operator Agent
- **Schedule:** 6:00 AM daily
- **Tasks:**
  - Audit communication history
  - Check automation health
  - Validate task completion
  - Clean stale data
- **Status:** 60% implemented

#### Strategist Agent
- **Schedule:** 7:00 AM daily
- **Tasks:**
  - Calculate composite lead scores
  - Identify coverage gaps
  - Generate daily brief
  - Prioritize outreach
- **Status:** 90% implemented

---

## Lead Scoring Algorithm

### Current Formula

```javascript
score = baseScore + signals;

// Base Score Components
baseScore = (
  (hasEmail ? 20 : 0) +
  (hasPhone ? 10 : 0) +
  (hasWebsite ? 10 : 0) +
  (inServiceArea ? 15 : 0) +
  (isPOSTarget ? 20 : 0)  // Toast, Clover, Square, Upserve
);

// Signal Bonuses
signals = (
  (recentPOSContract ? 15 : 0) +
  (multipleLocations ? 10 : 0) +
  (highRevenue ? 10 : 0) +
  (warmIntro ? 25 : 0) +
  (urgencySignal ? 15 : 0)
);
```

### Proposed Enhanced Formula (M2V Integration)

```javascript
// Menu-to-Venue composite assessment
M2V = w_M·Q̃ + w_P·CM̃ + w_O·Occ̃ - w_R·RevPASH̃ + w_L·(1-Labor%̃) - w_S·(1-TCÕ) + w_V·SI_peak

// Lead Score with M2V
finalScore = (
  (propertyOwnership * 3) +
  (techVulnerability * 2) +
  (warmIntro * 5) +
  revenueEstimate +
  urgencySignals +
  engagementHistory +
  (M2V * 0.5)  // When venue data available
);
```

### Lead Segments

| Segment | Criteria | Count | Priority |
|---------|----------|-------|----------|
| Toast Existing | current_pos = 'Toast' | 15,786* | Medium |
| Toast Upcoming | pos_contract_end < 6mo | 1,614* | HIGH |
| Clover Switchers | current_pos = 'Clover' | 12,397* | Medium |
| Square Switchers | current_pos = 'Square' | 12,080* | Medium |
| High Value | lead_score >= 80 | 477* | HIGH |
| Cape Cod Local | city IN cape_towns | Variable | HIGH |
| Contactable | has email AND phone | Variable | Medium |

*Counts from full BuiltWith dataset (not yet imported to D1)

---

## Data Sources & Enrichment

### Current Active Sources

| Source | Type | Cost | Data Retrieved |
|--------|------|------|----------------|
| HubSpot CRM | API | Included | Contacts, companies, properties |
| Tavily Search | API | ~$0.01/search | Web content, news |
| Direct Scraping | Crawler | Free | POS detection, menus, contacts |

### Recommended Additional Sources

| Source | Type | Cost | Data Retrieved |
|--------|------|------|----------------|
| Google Places | API | $0.017/request | Reviews, hours, photos |
| Yelp Fusion | API | Free tier | Reviews, categories |
| OpenCorporates | API | Free tier | Business registration |
| Health Inspections | Scraping | Free | Compliance scores |
| LinkedIn Sales Nav | Manual | $79/mo | Decision makers |
| Apollo.io | API | $49/mo | Contact enrichment |

### POS Detection Methods

```javascript
// Tech stack detection via website scraping
const posSignatures = {
  'Toast': ['toasttab.com', 'toast-restaurant', 'pos.toasttab'],
  'Square': ['squareup.com', 'square-online', 'weebly'],
  'Clover': ['clover.com', 'clover.pos'],
  'TouchBistro': ['touchbistro.com'],
  'Lightspeed': ['lightspeedhq.com'],
  'Revel': ['revelsystems.com'],
  'Upserve': ['upserve.com', 'breadcrumb']
};
```

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SOURCES                             │
├─────────────┬──────────────┬──────────────┬────────────────────┤
│  HubSpot    │   Tavily     │   Google     │   Direct Scraping  │
│  CRM API    │   Search     │   Places     │   (Crawler.js)     │
└──────┬──────┴──────┬───────┴──────┬───────┴─────────┬──────────┘
       │             │              │                 │
       ▼             ▼              ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   INTELLIGENCE LAYER                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  Hunter  │ │ Analyst  │ │ Operator │ │Strategist│          │
│  │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   │          │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │
│       └────────────┴────────────┴────────────┘                  │
│                         │                                        │
│              ┌──────────▼──────────┐                            │
│              │   Lead Scoring &    │                            │
│              │   Enrichment Engine │                            │
│              └──────────┬──────────┘                            │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER (D1)                               │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ restaurant_leads │  │  intelligence_   │                    │
│  │     (254+)       │  │   run_logs       │                    │
│  └────────┬─────────┘  └──────────────────┘                    │
│           │                                                      │
│  ┌────────┴─────────┐  ┌──────────────────┐                    │
│  │  lead_segments   │  │ email_sequences  │                    │
│  │      (9)         │  │      (8)         │                    │
│  └──────────────────┘  └────────┬─────────┘                    │
└─────────────────────────────────┼───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ACTION LAYER                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    Email     │  │    Quote     │  │   HubSpot    │          │
│  │  Sequences   │  │   Builder    │  │    Sync      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Scheduled Operations

### Cron Schedule

| Time (EST) | Agent/Task | Frequency |
|------------|------------|-----------|
| 4:00 AM | Hunter Agent | Daily |
| 5:00 AM | Analyst Agent | Daily |
| 6:00 AM | Operator Agent | Daily |
| 7:00 AM | Strategist Agent | Daily |
| */5 min | Email Dispatcher | Every 5 min |
| 8:00 AM | Daily Brief Generation | Daily |

### Cloudflare Cron Triggers

```toml
# wrangler.toml
[triggers]
crons = [
  "0 9 * * *",   # 4 AM EST (9 UTC) - Hunter
  "0 10 * * *",  # 5 AM EST - Analyst
  "0 11 * * *",  # 6 AM EST - Operator
  "0 12 * * *",  # 7 AM EST - Strategist
  "*/5 * * * *"  # Every 5 min - Email Dispatcher
]
```

---

## Budget Management

### Current Budget Allocation

| Service | Monthly Budget | Usage Rate | Status |
|---------|---------------|------------|--------|
| Tavily Search | ~$30 | ~30 searches/day | Active |
| HubSpot | Free tier | Unlimited | Active |
| Cloudflare | Free tier | Under limits | Active |

### Search Budget Logic

```javascript
// Daily budget calculation
const DAILY_BUDGET = 1.00;  // $1/day = ~30 searches
const SEARCH_COST = 0.033;  // ~$0.033 per search

async function checkBudget(env) {
  const today = new Date().toISOString().split('T')[0];
  const spent = await env.DB.prepare(
    `SELECT SUM(cost) as total FROM intelligence_run_logs
     WHERE date(created_at/1000, 'unixepoch') = ?`
  ).bind(today).first();

  return (spent?.total || 0) < DAILY_BUDGET;
}
```

---

## Known Issues & Gaps

### Critical (Fixed 2026-01-19)
- [x] ~~prospects.js referenced non-existent `location_count` column~~
- [x] ~~HubSpot sync not generating lead IDs~~
- [x] ~~215 leads had NULL IDs~~

### High Priority (Pending)
- [ ] Hunter agent discovery is mostly simulated
- [ ] No Google Places API integration
- [ ] No health inspection data source
- [ ] Lead import from BuiltWith CSVs not executed (42,000+ leads waiting)

### Medium Priority
- [ ] LinkedIn network mapping not implemented
- [ ] POS contract end date tracking incomplete
- [ ] Multi-location detection needs improvement
- [ ] Agent scheduling not yet deployed to production crons

### Low Priority
- [ ] Apollo.io integration for contact enrichment
- [ ] Yelp Fusion API integration
- [ ] Restaurant review sentiment analysis

---

## Deployment Checklist

### For Full Production Deployment

```bash
# 1. Apply any pending migrations
npx wrangler d1 execute rg-consulting-forms --remote --file=migrations/XXXX_latest.sql

# 2. Deploy Pages Functions
git add . && git commit -m "Deploy intelligence system" && git push origin main

# 3. Set environment variables (if new)
npx wrangler pages secret put TAVILY_API_KEY
npx wrangler pages secret put GOOGLE_PLACES_KEY

# 4. Verify deployment
curl https://ccrestaurantconsulting.com/api/admin/intelligence/prospects?limit=1

# 5. Configure cron triggers (in Cloudflare dashboard or wrangler.toml)
```

---

## API Usage Examples

### List Prospects with Filters

```bash
# Basic listing
curl "https://ccrestaurantconsulting.com/api/admin/intelligence/prospects?limit=50"

# Search by name
curl "https://ccrestaurantconsulting.com/api/admin/intelligence/prospects?search=seafood"

# Filter by region
curl "https://ccrestaurantconsulting.com/api/admin/intelligence/prospects?region=Cape%20Cod"

# Filter by POS
curl "https://ccrestaurantconsulting.com/api/admin/intelligence/prospects?pos=toast"

# Combined filters
curl "https://ccrestaurantconsulting.com/api/admin/intelligence/prospects?region=MA&pos=square&status=prospect&limit=25"
```

### Enrich a Lead

```bash
curl -X POST "https://ccrestaurantconsulting.com/api/admin/intelligence/enrich" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "lead_hs_abc123",
    "sources": ["tavily", "scrape"]
  }'
```

### Trigger Manual Agent Run

```bash
curl -X POST "https://ccrestaurantconsulting.com/api/admin/intelligence/runner" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "discover",
    "region": "Cape Cod",
    "limit": 10
  }'
```

### Sync HubSpot Contacts

```bash
curl -X POST "https://ccrestaurantconsulting.com/api/sync/hubspot-contacts" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "incremental",
    "limit": 100,
    "enrollInSequences": true
  }'
```

---

## Next Steps / Roadmap

### Phase 1: Stabilization (Current)
- [x] Fix critical bugs (prospects API, null IDs)
- [x] Verify HubSpot sync working
- [ ] Import BuiltWith leads to D1
- [ ] Enable production cron triggers

### Phase 2: Enhancement
- [ ] Integrate Google Places API
- [ ] Add health inspection scraping (MA DPH)
- [ ] Improve POS detection accuracy
- [ ] Build decision maker identification

### Phase 3: Automation
- [ ] Full Hunter agent implementation
- [ ] Automated email sequence enrollment
- [ ] Lead scoring refinement with ML
- [ ] Daily brief generation to Slack/email

### Phase 4: Scale
- [ ] Apollo.io integration
- [ ] LinkedIn Sales Navigator integration
- [ ] Multi-region expansion
- [ ] White-label for partners

---

## Support & Maintenance

### Log Locations
- **D1 Logs:** `intelligence_run_logs` table
- **Cloudflare Logs:** Dashboard > Pages > restaurant-consulting-site > Functions
- **Real-time:** `wrangler pages deployment tail`

### Common Issues

| Issue | Solution |
|-------|----------|
| Prospects not loading | Check API response, verify D1 connection |
| HubSpot sync failing | Verify HUBSPOT_API_KEY, check rate limits |
| Enrichment timeout | Reduce batch size, check Tavily quota |
| Agent not running | Check cron trigger configuration |

### Health Check

```bash
# Full system health
curl "https://ccrestaurantconsulting.com/api/admin/intelligence/prospects?limit=1"
curl "https://ccrestaurantconsulting.com/api/sync/hubspot-contacts"
curl "https://ccrestaurantconsulting.com/api/email/enroll"
```

---

**Document Maintained By:** Claude Code (Opus 4.5)
**Project Repository:** https://github.com/evanramirez88/restaurant-consulting-site
**Production URL:** https://ccrestaurantconsulting.com
