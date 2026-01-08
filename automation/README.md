# Toast Auto-Back-Office (Toast ABO) Automation System

A comprehensive browser automation system for Toast POS back-office operations, featuring AI-powered self-healing and support ticket automation.

## System Overview

Toast ABO automates repetitive tasks in the Toast POS back-office by:
- Logging into Toast partner portal as an administrator
- Navigating to specific client restaurant accounts
- Performing menu, KDS, and configuration operations
- Self-healing when UI elements change
- Processing support tickets automatically

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare (Frontend & APIs)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │Admin Portal │  │Menu Builder │  │Quote Builder│              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         └────────────────┴────────────────┘                      │
│                          │                                       │
│  ┌───────────────────────▼───────────────────────┐              │
│  │ Cloudflare Workers APIs (/api/automation/*)   │              │
│  └───────────────────────┬───────────────────────┘              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                          │
│  │   D1    │  │   R2    │  │   KV    │                          │
│  │  (Jobs) │  │(Screens)│  │(Session)│                          │
│  └─────────┘  └─────────┘  └─────────┘                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
            Secure API (JWT + Webhooks)
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│              Automation Server (Windows PC - Lenovo m720q)       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    JobExecutor.js                           │ │
│  │  - Polls for queued jobs from API                          │ │
│  │  - Decrypts credentials, manages browser sessions          │ │
│  └──────────────────────────┬─────────────────────────────────┘ │
│                             │                                    │
│  ┌──────────────────────────▼─────────────────────────────────┐ │
│  │                 ToastBrowserClient.js                       │ │
│  │  - Launches Puppeteer, handles login + navigation          │ │
│  │  - Executes automation tasks with self-healing             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────┐  ┌────────────────────┐                 │
│  │ Restaurant         │  │ Observer AI        │                 │
│  │ Classifier         │  │ (Self-Healing)     │                 │
│  └────────────────────┘  └────────────────────┘                 │
└──────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
automation/
├── src/
│   ├── config.js              # Worker configuration
│   ├── JobExecutor.js         # Main job execution engine
│   ├── ToastBrowserClient.js  # Browser automation client
│   ├── worker.js              # Worker entry point
│   │
│   ├── utils/                 # Shared utilities
│   │   ├── index.js           # Central exports
│   │   ├── ai.js              # Anthropic client, AI helpers
│   │   └── browser.js         # Browser automation helpers
│   │
│   ├── observer/              # Self-healing system (Phase 4)
│   │   ├── index.js           # Module exports
│   │   ├── visualDetection.js # Claude Vision element detection
│   │   ├── selfHealing.js     # Selector recovery + learning
│   │   ├── goldenCopy.js      # Baseline screenshot comparison
│   │   ├── healthCheck.js     # Daily health checks
│   │   └── alerting.js        # Multi-channel alerts
│   │
│   ├── support/               # Ticket automation (Phase 5)
│   │   ├── index.js           # Module exports
│   │   ├── ticketAnalysis.js  # AI ticket analysis
│   │   ├── decisionEngine.js  # Automation decisions
│   │   ├── approvalWorkflow.js# Approval management
│   │   └── ticketProcessor.js # Full pipeline orchestrator
│   │
│   └── toast/                 # Toast operations (Phase 3)
│       ├── index.js           # High-level workflows
│       ├── login.js           # Login with 2FA
│       ├── switchClient.js    # Restaurant switching
│       ├── selectors.js       # Self-healing selectors
│       ├── menu/              # Menu operations
│       │   ├── createCategory.js
│       │   ├── createItem.js
│       │   ├── createModifier.js
│       │   └── navigation.js
│       └── kds/               # KDS operations
│           ├── createStation.js
│           ├── configureRouting.js
│           └── navigation.js
│
└── README.md
```

## Implementation Phases

### Phase 1: Restaurant Classification Engine
AI-powered classification system that determines optimal Toast configuration based on restaurant type, service style, and menu analysis.

- **API**: `POST /api/admin/automation/classify`
- **Templates**: 8 pre-configured templates (Cafe, Bar, Fine Dining, etc.)
- **Data Sources**: Website analysis, menu data, user input

### Phase 2: Menu Builder Integration
"Deploy to Toast" feature in Menu Builder that applies modifier rules and creates automation jobs.

- **API**: `POST /api/admin/automation/apply-modifiers`
- **Rules**: 9 built-in modifier rules (Martini, Manhattan, Coffee, etc.)
- **UI**: DeployToToastModal component

### Phase 3: Toast Navigation Scripts
Complete browser automation for all Toast operations with self-healing selectors.

- **Login**: 2FA support (TOTP), session persistence
- **Menu**: Categories, items, modifiers (bulk operations)
- **KDS**: Stations, routing rules, templates

### Phase 4: Observer AI / Self-Healing
Resilient automation that handles Toast UI changes automatically.

- **Visual Detection**: Claude Vision API finds elements when selectors fail
- **Learning System**: Tracks successful recoveries for future use
- **Health Checks**: Daily verification of selector validity
- **Alerting**: Email, webhook, and API notifications

### Phase 5: Support Ticket Integration
Automated support ticket processing with approval workflows.

- **Analysis**: AI determines task type, confidence, risk level
- **Decisions**: AUTO_EXECUTE, NEEDS_APPROVAL, MANUAL_ONLY
- **17+ Task Types**: Menu ops, KDS ops, config changes
- **Approvals**: Priority-based with expiration

## Setup

### Prerequisites

- Node.js 20+
- npm or yarn
- Chrome/Chromium (installed automatically by Puppeteer)

### Installation

```bash
cd automation
npm install
```

### Configuration

Create a `.env` file with:

```env
# API
API_BASE_URL=https://ccrestaurantconsulting.com
WORKER_API_KEY=your_worker_key

# AI
ANTHROPIC_API_KEY=your_anthropic_key

# Browser
HEADLESS=true
SLOW_MO=50
MAX_SESSIONS=2

# Security
ENCRYPTION_KEY=your_encryption_key
```

### Running

```bash
# Production mode
npm start

# Development mode (auto-reload)
npm run dev
```

## API Reference

### Classification
```http
POST /api/admin/automation/classify
Authorization: Bearer <token>
Content-Type: application/json

{
  "client_id": "uuid",
  "restaurant_id": "uuid",
  "data_sources": {
    "website_url": "https://...",
    "menu_data": {...},
    "user_input": {...}
  }
}
```

### Support Ticket Processing
```http
POST /api/admin/automation/support
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "analyze" | "process" | "approvals" | "approve" | "reject",
  "ticket": { "subject": "...", "body": "..." },
  "client_id": "uuid"
}
```

## Usage Examples

### Analyze a Support Ticket
```javascript
import { analyzeTicket } from './src/support/ticketAnalysis.js';

const analysis = await analyzeTicket({
  subject: "Add new appetizers",
  body: "Please add Buffalo Wings $12, Mozzarella Sticks $9"
});

console.log(analysis.task_type);      // 'menu_add_items'
console.log(analysis.confidence);     // 0.92
console.log(analysis.can_automate);   // true
```

### Self-Healing Element Click
```javascript
import { clickElement } from './src/observer/selfHealing.js';

const result = await clickElement(page, 'menu.addItemButton');
console.log(result.method);  // 'selector' | 'visual_with_selector' | 'visual_coordinates'
```

### Batch Process Tickets
```javascript
import { analyzeTicketBatch } from './src/support/ticketAnalysis.js';

const results = await analyzeTicketBatch(tickets, {
  concurrency: 3  // Process 3 tickets in parallel
});
```

## Database Tables

### Core Tables (migration 0004)
- `automation_jobs` - Job queue and status
- `automation_steps` - Step execution history
- `toast_credentials` - Encrypted login credentials
- `automation_event_logs` - Comprehensive audit trail

### Classification Tables (migration 0013)
- `restaurant_classifications` - Restaurant type data
- `toast_config_templates` - Configuration templates
- `modifier_rules` - Automatic modifier rules

### Support Tables (migration 0014)
- `support_ticket_logs` - Processing history
- `automation_approvals` - Approval requests
- `support_automation_settings` - Per-client settings
- `automation_alerts` - Observer alert history

## AI Configuration

Models are centralized in `src/utils/ai.js`:

| Purpose | Model | Token Limit |
|---------|-------|-------------|
| Ticket Analysis | claude-sonnet-4-20250514 | 2048 |
| Data Extraction | claude-sonnet-4-20250514 | 1024 |
| Visual Detection | claude-sonnet-4-20250514 | 1024 |
| Classification | claude-sonnet-4-20250514 | 2048 |

## Security

- Toast credentials are AES-256-GCM encrypted in D1
- Credentials only decrypted on the automation server
- JWT authentication between Cloudflare and automation server
- Full audit trail with screenshots
- Approval workflow for high-risk operations

## Performance Metrics

| Metric | Target |
|--------|--------|
| Classification accuracy | > 85% |
| Menu deployment success | > 95% |
| Self-healing recovery | > 80% |
| Time to deploy 100 items | < 15 min |
| Support automation rate | > 60% |

## Troubleshooting

### Browser won't launch
```bash
npx puppeteer browsers install chrome
```

### Connection errors
1. Check `API_BASE_URL` is correct
2. Verify `WORKER_API_KEY` is set
3. Run `node src/test-connection.js` to diagnose

### Job failures
1. Check screenshots in `./screenshots`
2. Review worker logs
3. Verify Toast credentials are valid

## License

Proprietary - R&G Consulting LLC

---

*Version 2.0 - January 2026*
*All 5 Phases Complete*
