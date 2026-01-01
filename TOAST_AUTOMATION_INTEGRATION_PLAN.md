# Toast Automation Integration Plan
## 400K Breakout Strategy - R&G Consulting

---

## STRATEGIC ANALYSIS

### The Core Value Proposition

The Toast Back-Office Automation AI Agent is **THE** differentiator that enables scaling from boutique consulting to high-volume lead processing. Without it:
- Each client requires 4-8 hours of manual Toast configuration
- Maximum capacity: ~20 clients/month
- Labor-intensive, doesn't scale

With automation:
- Each client requires 15-30 minutes of oversight
- Capacity: 100+ clients/month
- "PDF to Toast" pipeline handles the heavy lifting

### Integration with Existing Infrastructure

| Existing Component | Automation Integration Point |
|--------------------|------------------------------|
| **Menu Builder** | Output JSON feeds into Toast deployment pipeline |
| **Quote Builder** | Quote acceptance triggers automation queue |
| **Client Portal** | Displays automation status, allows PDF uploads |
| **Admin Portal** | Central control hub for all automation |
| **Cloudflare Workers** | API endpoints trigger automation workflows |
| **D1 Database** | Stores automation jobs, status, logs |

### Architecture Decision: Hybrid Approach

**Website (Cloudflare)**: Lead capture, client management, billing
**Automation (Local Server)**: Puppeteer/Playwright browser automation

Why separate:
1. Browser automation needs persistent sessions (not serverless-friendly)
2. Cloudflare Workers have 30-second timeout limits
3. Local server can run 5+ concurrent browser sessions
4. Visual AI/Observer needs GPU for inference

**Communication**: Webhooks and API calls between systems

---

## REPOSITORY STRUCTURE (Recommended)

```
restaurant-consulting-site/
├── src/                              # React frontend
│   ├── components/
│   │   ├── admin/
│   │   │   ├── automation/           # NEW: Automation dashboard
│   │   │   │   ├── AutomationDashboard.tsx
│   │   │   │   ├── JobQueue.tsx
│   │   │   │   ├── LiveSessionViewer.tsx
│   │   │   │   └── AutomationConfig.tsx
│   │   │   └── ...
│   └── pages/
├── functions/                        # Cloudflare Workers
│   └── api/
│       ├── automation/               # NEW: Automation API
│       │   ├── jobs.js              # Queue management
│       │   ├── trigger.js           # Trigger automation
│       │   ├── status.js            # Job status
│       │   └── webhook.js           # Receive callbacks
│       └── ...
├── automation/                       # NEW: Toast automation system
│   ├── package.json                 # Separate dependencies
│   ├── src/
│   │   ├── browser/
│   │   │   ├── playwright.config.ts
│   │   │   ├── toast-login.ts       # Login automation
│   │   │   ├── menu-deploy.ts       # Menu deployment
│   │   │   ├── kds-config.ts        # KDS routing
│   │   │   └── printer-setup.ts     # Printer configuration
│   │   ├── observer/
│   │   │   ├── visual-ai.ts         # Screenshot analysis
│   │   │   ├── dom-mapper.ts        # Dynamic selector mapping
│   │   │   └── self-heal.ts         # Auto-fix broken selectors
│   │   ├── ocr/
│   │   │   ├── ocr-space.ts         # OCR.space integration
│   │   │   └── menu-parser.ts       # Menu text to JSON
│   │   ├── llm/
│   │   │   ├── menu-architect.ts    # LLM structuring
│   │   │   └── prompts/
│   │   │       └── menu-schema.md   # JSON schema prompts
│   │   └── api/
│   │       └── server.ts            # Local API server
│   ├── data/
│   │   ├── toast-selectors.json     # DOM selector mappings
│   │   ├── config-patterns.json     # Configuration templates
│   │   └── martini-manhattan.json   # Cocktail logic encoding
│   ├── docker/
│   │   ├── Dockerfile
│   │   └── docker-compose.yml
│   └── scripts/
│       ├── health-check.ts          # Daily Toast UI verification
│       └── selector-update.ts       # Regenerate selectors
├── migrations/
├── hubspot-sequences/                # Existing HubSpot automation
└── docs/
    ├── DEPLOYMENT.md
    └── AUTOMATION_SETUP.md          # NEW: Automation documentation
```

---

## PHASE 1 MVP: "PDF to Toast" Pipeline

### Components Needed

```
[Client Upload] → [Cloudflare Worker] → [Webhook to Local Server]
                                               ↓
                                        [OCR Extraction]
                                               ↓
                                        [LLM Structuring]
                                               ↓
                                        [Validation]
                                               ↓
                                        [Human Review Queue] (if needed)
                                               ↓
                                        [Playwright Deployment]
                                               ↓
                                        [Visual Verification]
                                               ↓
                                        [Webhook Callback] → [Update D1 Status]
```

### Database Schema Additions

```sql
-- Automation jobs table
CREATE TABLE IF NOT EXISTS automation_jobs (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id),
  job_type TEXT NOT NULL CHECK (job_type IN ('menu_deploy', 'kds_config', 'printer_setup', 'full_config')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'awaiting_review', 'deploying', 'verifying', 'completed', 'failed')),
  input_file_key TEXT,           -- R2 key for uploaded PDF
  parsed_json TEXT,              -- Structured menu data
  toast_credentials_id TEXT,     -- Reference to encrypted credentials
  started_at INTEGER,
  completed_at INTEGER,
  error_message TEXT,
  screenshots TEXT,              -- JSON array of screenshot URLs
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Toast credentials (encrypted)
CREATE TABLE IF NOT EXISTS toast_credentials (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
  encrypted_email TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  location_guid TEXT,            -- Toast location identifier
  last_verified INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Automation logs
CREATE TABLE IF NOT EXISTS automation_logs (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES automation_jobs(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug')),
  message TEXT NOT NULL,
  screenshot_url TEXT,
  selector_used TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Toast UI selectors (for Observer AI)
CREATE TABLE IF NOT EXISTS toast_selectors (
  id TEXT PRIMARY KEY,
  element_name TEXT NOT NULL UNIQUE,
  css_selector TEXT,
  xpath_selector TEXT,
  visual_description TEXT,       -- For AI fallback
  last_verified INTEGER,
  failure_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
```

### API Endpoints Needed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/automation/jobs` | GET | List automation jobs |
| `/api/automation/jobs` | POST | Create new job |
| `/api/automation/jobs/:id` | GET | Get job details |
| `/api/automation/jobs/:id/cancel` | POST | Cancel job |
| `/api/automation/trigger` | POST | Trigger job (webhook from local) |
| `/api/automation/callback` | POST | Receive status updates |
| `/api/automation/credentials` | POST | Store Toast credentials |
| `/api/automation/selectors` | GET | Get current selectors |
| `/api/automation/selectors` | PUT | Update selectors |

---

## ADMIN PORTAL AUTOMATION WIDGET

### Dashboard Components

```tsx
// AutomationDashboard.tsx - Main automation control panel

interface AutomationDashboardProps {}

const AutomationDashboard: React.FC = () => {
  // Sections:
  // 1. Active Sessions - Live browser session thumbnails
  // 2. Job Queue - Pending, processing, completed jobs
  // 3. Success Metrics - 24h/7d/30d success rates
  // 4. Manual Trigger - Start new automation
  // 5. Configuration - Timeouts, retries, notifications
  // 6. Log Viewer - Streaming logs with screenshots
};
```

### Key Features

1. **Real-Time Session Viewer**
   - Live screenshots from Playwright sessions
   - Progress indicators per step
   - Error highlighting

2. **Job Queue Management**
   - Drag-and-drop priority reordering
   - Bulk actions (pause, cancel, retry)
   - Filter by client, status, type

3. **Manual Trigger Interface**
   - Client dropdown (from D1 clients table)
   - Task type selector
   - File upload for PDFs
   - Toast credentials entry (first time only)

4. **Health Monitor**
   - Last successful Toast login
   - Selector health status
   - Observer AI confidence scores

---

## INTEGRATION WITH EXISTING MENU BUILDER

The current Menu Builder already has OCR capabilities. Integration points:

1. **Output Format**: Menu Builder outputs JSON → Same format feeds Toast automation
2. **File Storage**: Both use R2 for file storage
3. **Job Handoff**: Menu Builder "Deploy to Toast" button creates automation job

### Menu Builder Enhancement

```tsx
// Add to MenuBuilder.tsx

const handleDeployToToast = async () => {
  if (!parsedMenu) return;

  // Create automation job
  const response = await fetch('/api/automation/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      job_type: 'menu_deploy',
      client_id: selectedClient,
      parsed_json: JSON.stringify(parsedMenu),
      input_file_key: uploadedFileKey
    })
  });

  if (response.ok) {
    // Redirect to automation dashboard or show status
  }
};
```

---

## LOCAL AUTOMATION SERVER

### Technology Stack

- **Runtime**: Node.js 20+ or Bun
- **Browser Automation**: Playwright
- **API Framework**: Hono or Express
- **Queue**: BullMQ with Redis (or simple in-memory for MVP)
- **Container**: Docker for consistent environment

### Docker Compose (MVP)

```yaml
version: '3.8'
services:
  automation-server:
    build: ./automation
    ports:
      - "3001:3001"
    environment:
      - CLOUDFLARE_WEBHOOK_SECRET=${CLOUDFLARE_WEBHOOK_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    volumes:
      - ./automation/data:/app/data
      - ./automation/screenshots:/app/screenshots
    depends_on:
      - redis

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

### Lenovo m720q Server Setup

Per the spec, the Lenovo m720q will host:
- Docker stack (this automation server)
- Windmill (for advanced orchestration - Phase 2)
- Qdrant (for RAG knowledge base - Phase 2)
- Ollama (for local LLM inference - Phase 2)

---

## PROPRIETARY LOGIC ENCODING

### Martini/Manhattan System

```json
// data/martini-manhattan.json
{
  "base_spirits": ["vodka", "gin", "rum", "whiskey", "tequila", "bourbon", "scotch"],
  "drink_types": {
    "martini": { "volume_oz": 3, "multiplier": 1.5 },
    "manhattan": { "volume_oz": 3, "multiplier": 1.5 },
    "rocks": { "volume_oz": 2, "multiplier": 1.0 },
    "neat": { "volume_oz": 2, "multiplier": 1.0 }
  },
  "upcharge_modifiers": {
    "premium": 2.00,
    "top_shelf": 4.00,
    "reserve": 6.00
  },
  "pricing_formula": "base_price * volume_multiplier + tier_upgrade"
}
```

### KDS Routing Patterns

```json
// data/kds-patterns.json
{
  "restaurant_types": {
    "full_service": {
      "stations": ["expo", "grill", "saute", "fry", "salad", "dessert"],
      "routing": {
        "appetizers": ["fry", "saute"],
        "entrees": ["grill", "saute"],
        "salads": ["salad"],
        "desserts": ["dessert"]
      }
    },
    "quick_service": {
      "stations": ["kitchen", "expo"],
      "routing": {
        "all": ["kitchen"]
      }
    }
  }
}
```

---

## SUCCESS METRICS

### Phase 1 MVP Success Criteria

- [ ] Successfully process menu PDF → structured JSON for 3 test clients
- [ ] Playwright script logs into Toast and creates 1 menu item
- [ ] Admin dashboard shows job queue with real-time status
- [ ] End-to-end: PDF upload → Toast deployment in < 10 minutes (with human review)

### Phase 2 Success Criteria

- [ ] Observer AI detects and adapts to Toast UI change
- [ ] RAG chatbot answers Toast configuration questions
- [ ] 5 concurrent browser sessions without issues
- [ ] < 5% job failure rate

### Phase 3 Success Criteria

- [ ] Proactive menu optimization suggestions generated
- [ ] Automated "Toast Health Check" reports for all clients
- [ ] Self-healing scripts require no manual intervention for 30 days

---

## TIMELINE ALIGNMENT WITH 400K BREAKOUT

### Week 1 (Immediate)
- Website go-live (public pages, Quote Builder, Contact)
- HubSpot: Deploy email sequences + import FIRST lead batch (500-2,000 highest-probability leads)
- **Automation**: Database schema, API stubs, admin widget skeleton

> **NOTE**: Leads are imported in segmented batches, NOT all at once. See CLAUDE.md for strategy.

### Week 2
- Client portal enabled
- Square billing active
- **Automation**: Basic Playwright scripts, "PDF to Toast" flow working

### Week 3
- Rep portal enabled
- Full client onboarding flow
- **Automation**: Observer AI integration, health checks

### Month 2
- Scaling operations
- **Automation**: Full autonomous mode, proactive insights

---

## RISK MITIGATION

### Toast UI Changes
- **Risk**: Toast updates break selectors
- **Mitigation**: Observer AI + daily health checks + rapid response protocol

### Credential Security
- **Risk**: Client Toast credentials compromised
- **Mitigation**: AES-256 encryption at rest, never log credentials, rotate encryption keys

### Rate/Usage Limits
- **Risk**: Toast detects automation, blocks account
- **Mitigation**: Human-like delays, randomized timing, respect session limits

### Scalability
- **Risk**: Single server can't handle load
- **Mitigation**: Queue-based architecture, horizontal scaling ready

---

## APPENDIX: Key System IDs

| System | ID | Notes |
|--------|-----|-------|
| Cloudflare D1 | c2fdafac-bc84-4ad7-974e-312dceb28263 | rg-consulting-db |
| Cloudflare KV | a922ece9ad7c42e08a3c1fe88e81db7b | rg-consulting-sessions |
| HubSpot Portal | 243379742 | 614+ contacts |
| Square Lane A | L6GGMPCHFM6WR | Local Cape Cod |
| Square Lane B | LB8GE5HYZJYB7 | National/Remote |
| Acuity | 34242148 | Scheduling |
| GitHub | evanramirez88/restaurant-consulting-site | Main repo |

---

*Document created: 2025-12-31*
*For: R&G Consulting LLC / Cape Cod Restaurant Consulting*
