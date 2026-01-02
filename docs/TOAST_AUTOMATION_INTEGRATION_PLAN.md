# Toast Back-Office Automation AI Agent - Integration Plan

## Executive Summary

This document outlines the complete integration plan for the Toast Back-Office Automation AI Agent into the existing restaurant-consulting-site codebase. The automation system uses browser automation (Playwright) with AI-powered visual perception to configure Toast POS back-office settings, deliberately bypassing Toast's API limitations.

**Architecture Decision**: Hybrid system - Cloudflare Workers for web frontend/APIs, local automation server (Windows PC / Lenovo m720q) running Playwright natively.

**Server Note**: The Lenovo m720q IS the current Windows development PC. Playwright runs directly on Windows without Docker for simplicity and direct browser control.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLOUDFLARE (Frontend & APIs)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Website   │  │ Admin Portal│  │Quote Builder│  │ Menu Builder│        │
│  │   (React)   │  │   (React)   │  │   (React)   │  │   (React)   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Cloudflare Workers (APIs)                        │   │
│  │  /api/automation/*  /api/menu/*  /api/contracts/*  /api/billing/*   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                         │
│  │ Cloudflare  │  │ Cloudflare  │  │ Cloudflare  │                         │
│  │     D1      │  │     R2      │  │     KV      │                         │
│  │ (Database)  │  │  (Storage)  │  │  (Cache)    │                         │
│  └─────────────┘  └─────────────┘  └─────────────┘                         │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                    Secure API Communication
                    (JWT + Webhook Callbacks)
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              AUTOMATION SERVER (Windows PC / Lenovo m720q - Native)          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Node.js Automation Service                        │   │
│  │  - Job Queue (polling Cloudflare D1 via API)                        │   │
│  │  - Retry Logic (built-in)                                           │   │
│  │  - Windows Task Scheduler for background runs                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐   │
│  │ Playwright Scripts │  │    Observer AI     │  │   Claude/Ollama    │   │
│  │ (Browser Control)  │  │ (Visual Perception)│  │   (AI Reasoning)   │   │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘   │
│                                                                              │
│  Storage: D:\AI_WORKSPACE\PROJECTS\toast-automation\                        │
│  Screenshots: D:\AI_WORKSPACE\PROJECTS\toast-automation\screenshots\        │
│  Logs: D:\AI_WORKSPACE\PROJECTS\toast-automation\logs\                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Additions

### New Tables

```sql
-- Toast credentials per client (encrypted)
CREATE TABLE IF NOT EXISTS toast_credentials (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  restaurant_id TEXT REFERENCES restaurants(id) ON DELETE SET NULL,
  toast_username_encrypted TEXT NOT NULL,
  toast_password_encrypted TEXT NOT NULL,
  toast_guid TEXT,
  last_login_success INTEGER,
  last_login_at INTEGER,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invalid', 'locked', 'pending_verification')),
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(client_id, restaurant_id)
);

-- Automation jobs queue
CREATE TABLE IF NOT EXISTS automation_jobs (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  restaurant_id TEXT REFERENCES restaurants(id) ON DELETE SET NULL,
  toast_credential_id TEXT REFERENCES toast_credentials(id) ON DELETE SET NULL,

  -- Job type
  job_type TEXT NOT NULL CHECK (job_type IN (
    'menu_upload',
    'kds_config',
    'printer_setup',
    'employee_setup',
    'tax_config',
    'modifier_sync',
    'full_setup',
    'health_check'
  )),

  -- Input/Output
  input_json TEXT,           -- Job parameters
  output_json TEXT,          -- Results
  parsed_menu_job_id TEXT REFERENCES menu_jobs(id),

  -- Status tracking
  status TEXT DEFAULT 'queued' CHECK (status IN (
    'queued',
    'pending_credentials',
    'running',
    'paused',
    'awaiting_approval',
    'completed',
    'failed',
    'cancelled'
  )),
  progress_percentage INTEGER DEFAULT 0,
  current_step TEXT,
  total_steps INTEGER,

  -- Timing
  scheduled_at INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  estimated_duration_seconds INTEGER,

  -- Error handling
  error_message TEXT,
  error_screenshot_key TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Audit
  triggered_by TEXT CHECK (triggered_by IN ('admin', 'client', 'rep', 'webhook', 'scheduled')),
  triggered_by_id TEXT,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_auto_jobs_client ON automation_jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_auto_jobs_status ON automation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_auto_jobs_scheduled ON automation_jobs(scheduled_at);

-- Automation job steps (for progress tracking)
CREATE TABLE IF NOT EXISTS automation_job_steps (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES automation_jobs(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  step_description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  screenshot_key TEXT,        -- R2 key for screenshot
  started_at INTEGER,
  completed_at INTEGER,
  error_message TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_steps_job ON automation_job_steps(job_id);

-- Observer AI selector mappings (self-healing)
CREATE TABLE IF NOT EXISTS toast_selectors (
  id TEXT PRIMARY KEY,
  page TEXT NOT NULL,         -- 'login', 'menu_editor', 'kds_config', etc.
  element TEXT NOT NULL,      -- 'username_field', 'save_button', etc.
  selector_type TEXT NOT NULL CHECK (selector_type IN ('css', 'xpath', 'text', 'aria')),
  selector_value TEXT NOT NULL,
  backup_selectors_json TEXT, -- Array of fallback selectors
  visual_description TEXT,    -- For Observer AI
  last_verified_at INTEGER,
  verification_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(page, element)
);

-- Automation event logs (detailed audit trail)
CREATE TABLE IF NOT EXISTS automation_events (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES automation_jobs(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,   -- 'browser_action', 'screenshot', 'error', 'recovery', etc.
  event_data_json TEXT,
  screenshot_key TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_auto_events_job ON automation_events(job_id);
CREATE INDEX IF NOT EXISTS idx_auto_events_type ON automation_events(event_type);

-- Toast domain expertise encoding (Martini/Manhattan logic, etc.)
CREATE TABLE IF NOT EXISTS automation_rules (
  id TEXT PRIMARY KEY,
  rule_category TEXT NOT NULL, -- 'cocktail_logic', 'kds_routing', 'tax_rules', etc.
  rule_name TEXT NOT NULL,
  rule_description TEXT,
  rule_logic_json TEXT NOT NULL, -- Encoded business logic
  applies_to TEXT,            -- Restaurant type filter
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
```

### Feature Flags Addition

```sql
INSERT OR IGNORE INTO feature_flags (key, enabled, description) VALUES
  ('toast_automation_enabled', 0, 'Toast back-office browser automation'),
  ('automation_self_healing', 0, 'Observer AI self-healing for UI changes'),
  ('automation_batch_mode', 0, 'Allow multiple simultaneous browser sessions');
```

---

## API Endpoints

### Automation API (`/api/automation/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/automation/jobs` | List automation jobs with filters |
| GET | `/api/automation/jobs/:id` | Get job details with steps |
| POST | `/api/automation/jobs` | Create new automation job |
| PUT | `/api/automation/jobs/:id` | Update job (pause, cancel) |
| POST | `/api/automation/jobs/:id/approve` | Approve awaiting job |
| GET | `/api/automation/jobs/:id/logs` | Get job event logs |
| GET | `/api/automation/jobs/:id/screenshot/:step` | Get step screenshot |
| GET | `/api/automation/status` | Get automation server status |
| POST | `/api/automation/trigger` | Trigger specific automation task |

### Toast Credentials API (`/api/automation/credentials/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/automation/credentials` | List client's Toast credentials |
| POST | `/api/automation/credentials` | Add new Toast credentials |
| PUT | `/api/automation/credentials/:id` | Update credentials |
| DELETE | `/api/automation/credentials/:id` | Remove credentials |
| POST | `/api/automation/credentials/:id/verify` | Test credential validity |

### Webhook Callbacks (from Automation Server)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/automation/status` | Job status updates |
| POST | `/api/webhooks/automation/screenshot` | Screenshot uploads |
| POST | `/api/webhooks/automation/complete` | Job completion |
| POST | `/api/webhooks/automation/error` | Error notifications |

---

## Admin Portal Integration

### New Admin Tab: "Automation"

Add to `AdminDashboard.tsx` tabs array:

```typescript
{ id: 'automation', label: 'Automation', icon: <Bot className="w-4 h-4" /> }
```

### Component Structure

```
src/components/admin/automation/
├── AutomationDashboard.tsx      # Main dashboard
├── JobQueue.tsx                 # Active/queued jobs
├── JobDetail.tsx                # Single job view with screenshots
├── ClientCredentials.tsx        # Manage Toast logins per client
├── ManualTrigger.tsx            # Trigger automation for client
├── AutomationLogs.tsx           # Event log viewer
├── SelectorManager.tsx          # DOM selector management
├── AutomationSettings.tsx       # Configuration panel
└── StatusWidget.tsx             # Server status indicator
```

### AutomationDashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Automation Dashboard                          [Server: ● Online] [⚙ Config]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌── Stats Row ─────────────────────────────────────────────────────────┐   │
│  │ [Queued: 3] [Running: 1] [Completed Today: 12] [Failed: 0] [Success%]│   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌── Active Job (if any) ───────────────────────────────────────────────┐   │
│  │ ┌──────────────────┐  Client: Village Pizza                          │   │
│  │ │   Live Browser   │  Task: Menu Upload (47 items)                   │   │
│  │ │   Screenshot     │  Step: 4/8 - Creating modifier groups           │   │
│  │ │   [thumbnail]    │  Progress: [████████░░░░░░░░░░░] 47%            │   │
│  │ └──────────────────┘  Started: 5 min ago | ETA: ~8 min               │   │
│  │                                                                       │   │
│  │  [⏸ Pause] [⏹ Cancel] [📸 View Full Screenshot] [📋 View Logs]      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌── Job Queue ─────────────────────────────────────────────────────────┐   │
│  │ Client            Task          Status      Scheduled    Actions     │   │
│  │ ─────────────────────────────────────────────────────────────────────│   │
│  │ Harbor Cafe       KDS Config    Queued      Now          [▶][✕]     │   │
│  │ Ocean Bistro      Menu Upload   Pending     2:00 PM      [▶][✕]     │   │
│  │ Pier 7            Full Setup    Scheduled   Tomorrow     [Edit][✕]  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌── Quick Actions ─────────────────────────────────────────────────────┐   │
│  │ [+ New Job] [📋 Import from Menu Builder] [🔄 Health Check All]      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Manual Trigger Interface

From the admin portal, you can:

1. **Select Client**: Dropdown populated from D1 clients table
2. **Select Task Type**: Menu Upload, KDS Config, Printer Setup, etc.
3. **Upload Input** (if applicable): Menu JSON from Menu Builder
4. **Configure Options**: Timeout, approval requirements
5. **Trigger Automation**: Queue job for processing

---

## Integration with Menu Builder

The existing Menu Builder produces parsed JSON. The automation system consumes this:

```
Menu Builder                      Automation System
─────────────────────────────────────────────────────────
1. User uploads PDF/image    ─┐
2. OCR extracts text          │
3. LLM structures to JSON     │
4. Export JSON/CSV            │
                              │
5. [NEW] "Deploy to Toast" ───┼──► Automation job created
   button                     │    with menu_job_id reference
                              │
                              └──► Playwright navigates Toast
                                   and creates menu items
```

Add to MenuBuilder export section:
```typescript
<button onClick={deployToToast} disabled={!parsedMenu}>
  <Upload /> Deploy to Toast
</button>
```

---

## Automation Server Setup (Windows Native)

The automation runs directly on the Windows PC (Lenovo m720q) without Docker for simplicity.

### Directory Structure

```
D:\AI_WORKSPACE\PROJECTS\toast-automation\
├── package.json           # Node.js project config
├── .env                   # Environment variables
├── src/
│   ├── index.ts          # Main entry point / job runner
│   ├── worker.ts         # Job processing loop
│   ├── toast/
│   │   ├── login.ts      # Toast login automation
│   │   ├── menuUpload.ts # Menu item creation
│   │   ├── kdsConfig.ts  # KDS routing setup
│   │   ├── printerSetup.ts
│   │   └── selectors.ts  # DOM selectors (self-healing)
│   ├── utils/
│   │   ├── api.ts        # Cloudflare API communication
│   │   ├── screenshot.ts # Screenshot capture
│   │   └── logger.ts     # Logging utility
│   └── observer/
│       ├── visual.ts     # Visual element detection
│       └── healing.ts    # Self-healing logic
├── screenshots/           # Step screenshots
├── logs/                  # Automation logs
└── config/
    └── selectors.json     # Toast DOM selectors backup
```

### Installation

```powershell
# Navigate to project directory
cd D:\AI_WORKSPACE\PROJECTS\toast-automation

# Initialize project
npm init -y
npm install playwright typescript ts-node @types/node dotenv

# Install Playwright browsers
npx playwright install chromium

# Create .env file
echo "CLOUDFLARE_API_URL=https://ccrestaurantconsulting.com" > .env
echo "AUTOMATION_SERVER_SECRET=your-secret-here" >> .env
echo "ADMIN_JWT_SECRET=your-jwt-secret" >> .env
```

### Running the Automation Service

```powershell
# Development mode (watch for changes)
npx ts-node src/index.ts

# Or use Windows Task Scheduler for background execution
# Create task: "Toast Automation Worker"
# Trigger: At startup / Every 5 minutes
# Action: powershell.exe -File "D:\AI_WORKSPACE\PROJECTS\toast-automation\run.ps1"
```

### run.ps1 (Windows Startup Script)

```powershell
$ErrorActionPreference = "Stop"
Set-Location "D:\AI_WORKSPACE\PROJECTS\toast-automation"
$env:NODE_ENV = "production"
npx ts-node src/index.ts 2>&1 | Tee-Object -FilePath "logs\worker-$(Get-Date -Format 'yyyy-MM-dd').log" -Append
```

### Optional: Ollama for Local LLM (if needed)

```powershell
# Install Ollama for Windows
winget install Ollama.Ollama

# Pull a model for visual analysis
ollama pull llava:7b

# Ollama will run as a Windows service on localhost:11434
```

---

## Implementation Phases

### Phase 1: Foundation (Immediate)

**Goal**: Basic automation pipeline with manual triggering

- [x] Add database schema (migration 0004_automation.sql) ✅ DONE
- [x] Create `/api/automation/` endpoints in Cloudflare Workers ✅ DONE
- [x] Build AutomationDashboard component in admin portal ✅ DONE (partial)
- [ ] Set up Windows automation project at D:\AI_WORKSPACE\PROJECTS\toast-automation
- [ ] Create basic Playwright scripts for Toast login
- [ ] Implement job queue polling and status callbacks

**Deliverable**: Admin can manually trigger menu upload job for a client

### Phase 2: Menu Builder Integration

**Goal**: Seamless PDF-to-Toast pipeline

- [ ] Add "Deploy to Toast" button to Menu Builder
- [ ] Create menu upload Playwright scripts
- [ ] Implement Martini/Manhattan cocktail logic
- [ ] Add step-by-step progress tracking with screenshots
- [ ] Build job detail view with visual feedback

**Deliverable**: Full PDF → OCR → LLM → Toast deployment working

### Phase 3: Observer AI & Self-Healing

**Goal**: Resilient automation that handles Toast UI changes

- [ ] Implement visual element detection
- [ ] Build selector self-healing system
- [ ] Create Golden Copy monitoring (daily health checks)
- [ ] Add Slack alerting for failures
- [ ] Implement automatic retry with visual verification

**Deliverable**: System recovers from minor Toast UI changes automatically

### Phase 4: Multi-Client & Scaling

**Goal**: Production-ready system for multiple simultaneous clients

- [ ] Implement Browser Contexts for isolation
- [ ] Add job scheduling and queuing
- [ ] Build client portal automation status view
- [ ] Create rep visibility into client automations
- [ ] Implement rate limiting and resource management

**Deliverable**: 5+ concurrent client sessions possible

### Phase 5: AI Agent Evolution

**Goal**: Intelligent assistant beyond just automation

- [ ] Deploy RAG knowledge base (Toast docs, Reddit, internal logs)
- [ ] Create Slack bot for agent interaction
- [ ] Implement proactive insights from client data
- [ ] Build autonomous menu optimization suggestions
- [ ] Add MCP server for tool integration

**Deliverable**: AI agent that can answer questions and suggest optimizations

---

## Security Considerations

### Toast Credentials

- Store encrypted in D1 using AES-256-GCM
- Encryption key stored in Cloudflare environment variable
- Decrypt only on automation server
- Auto-expire and require re-verification quarterly

### Automation Server Communication

- JWT authentication between Cloudflare and automation server
- Webhook signature verification
- IP allowlisting for automation server
- Rate limiting on all endpoints

### Audit Trail

- Log all automation actions
- Screenshot at key steps
- Track who triggered each job
- Retention policy for screenshots (30 days)

---

## Human Tasks (Add to HUMAN_TASKS.md)

### 14. Set Up Windows Automation Project
**Status**: PENDING
**Impact**: Required for browser automation

**Steps**:
1. Create directory: `D:\AI_WORKSPACE\PROJECTS\toast-automation`
2. Initialize Node.js project with Playwright
3. Configure environment variables in .env
4. Install Playwright browsers
5. Test basic script execution

### 15. Create Automation Server Secret
**Status**: PENDING
**Impact**: Secure communication between systems

**Steps**:
```powershell
# Generate a secure secret (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])

# Add to Cloudflare
npx wrangler pages secret put AUTOMATION_SERVER_SECRET

# Add to automation server .env
# AUTOMATION_SERVER_SECRET=your-generated-secret
```

### 16. Configure Toast Test Account
**Status**: PENDING
**Impact**: Required for development/testing

**Steps**:
1. Use YOUR Toast login (you toggle between client back-offices)
2. Document your login credentials securely in .env
3. Test login automation with your account
4. Verify you can switch between client GUIDs

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Menu deployment time | < 10 min for 100 items | Automation logs |
| Success rate | > 95% | Completed / Total jobs |
| Self-healing recovery | > 80% | Auto-recovered / Failed |
| Concurrent sessions | 5+ | Peak simultaneous jobs |
| Monthly automations | 50+ | Job count |

---

## Files to Create

### Cloudflare Workers

```
functions/api/automation/
├── jobs.js                     # List jobs
├── jobs/[id].js                # Job detail/update
├── jobs/[id]/approve.js        # Approve job
├── jobs/[id]/logs.js           # Get logs
├── credentials.js              # List credentials
├── credentials/[id].js         # Credential CRUD
├── credentials/[id]/verify.js  # Verify credentials
├── trigger.js                  # Trigger new job
├── status.js                   # Server status
└── _shared/
    └── automation.js           # Shared utilities
```

### React Components

```
src/components/admin/automation/
├── AutomationDashboard.tsx
├── JobQueue.tsx
├── JobDetail.tsx
├── ActiveJobCard.tsx
├── ClientCredentials.tsx
├── CredentialForm.tsx
├── ManualTrigger.tsx
├── AutomationLogs.tsx
├── SelectorManager.tsx
├── AutomationSettings.tsx
└── StatusWidget.tsx
```

### Automation Server Scripts

```
automation/
├── package.json
├── Dockerfile.playwright
├── scripts/
│   ├── worker.js              # Job processor
│   ├── toast/
│   │   ├── login.js           # Toast login
│   │   ├── menuUpload.js      # Menu creation
│   │   ├── kdsConfig.js       # KDS routing
│   │   └── printerSetup.js    # Printer mapping
│   └── utils/
│       ├── screenshot.js
│       ├── callback.js
│       └── errorHandler.js
├── observer/
│   ├── visualDetection.js
│   ├── selfHealing.js
│   └── selectorUpdater.js
└── prompts/
    └── menuArchitect.txt
```

---

## Estimated Resource Requirements (Windows Native)

| Component | RAM | CPU | Storage | Notes |
|-----------|-----|-----|---------|-------|
| Node.js Worker | 512MB | 1 core | 100MB | Job processor service |
| Playwright Browser | 2-4GB | 2 cores | 2GB | Per Chromium instance |
| Ollama (optional) | 8GB+ | 4 cores | 30GB | Local LLM for visual AI |
| Screenshots/Logs | - | - | 10GB | 30-day retention |

**Your PC Spec**: This Windows PC is suitable for running 2-3 concurrent browser sessions.

**Storage Locations**:
- Automation project: `D:\AI_WORKSPACE\PROJECTS\toast-automation\`
- Screenshots: `D:\AI_WORKSPACE\PROJECTS\toast-automation\screenshots\`
- Logs: `D:\AI_WORKSPACE\PROJECTS\toast-automation\logs\`

---

*Document Version: 1.1*
*Updated: January 2, 2026*
*Change: Converted from Docker to Windows-native setup*
*For: R&G Consulting / Cape Cod Restaurant Consulting*
