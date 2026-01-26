# Toast ABO (Auto-Back-Office) Product Plan
## Comprehensive Automation System for Toast POS
**Created:** January 26, 2026
**Priority:** MEDIUM (Feature flagged OFF)

---

## Executive Summary

Toast ABO is an AI-powered browser automation system for configuring and managing Toast POS back-office operations. **It is NOT a Toast API integration** - it automates browser interactions with the Toast partner portal, mimicking human operator actions for menu deployment, KDS configuration, and ongoing support tasks.

**Current State:** All 5 implementation phases are documented as complete in `TOAST_ABO_REDESIGN_PLAN.md`, but:
- Feature flag is OFF
- UI displays hardcoded seed data (run counts 127, 45, 52, 18)
- No real execution logs visible

---

## Issues from Platform Audit

| ID | Severity | Issue |
|----|----------|-------|
| TA-1 | MEDIUM | Run counts appear to be seed data |
| TA-2 | LOW | Rules not connected to real Toast POS data |
| AO-3 | MEDIUM | Automation shows "Offline" |

---

## Architecture Overview

```
Cloudflare (Frontend + API)          Automation Server (Local)
+---------------------------+         +-----------------------------+
| Admin Portal UI           |         | JobExecutor.js              |
| - AutomationDashboard.tsx | <---->  | - Polls /api/automation/... |
| - ToastAutomate.tsx       |   JWT   | - Decrypts credentials      |
|                           |         | - Manages Puppeteer sessions|
| Cloudflare Workers APIs   |         +-----------------------------+
| - /api/automation/jobs    |                    |
| - /api/automation/worker  |                    v
|                           |         +-----------------------------+
| D1 (Jobs, Credentials)    |         | ToastBrowserClient.js       |
| R2 (Screenshots)          |         | - Login to pos.toasttab.com |
| KV (Sessions)             |         | - Navigate to clients       |
+---------------------------+         | - Execute automation tasks  |
                                      +-----------------------------+
```

---

## Core Components

### 1. Job Types (Implemented)

| Job Type | Handler | Status |
|----------|---------|--------|
| `menu_deployment` | Full implementation | Ready |
| `menu_upload` | Full implementation | Ready |
| `menu_update` | Stub | Pending |
| `kds_config` | Stub | Pending |
| `printer_setup` | Stub | Pending |
| `employee_setup` | Stub | Pending |
| `health_check` | Full implementation | Ready |
| `full_setup` | Orchestrator | Ready |

### 2. Rule Builder Categories

| Category | Description | Example Rules |
|----------|-------------|---------------|
| Reporting | Automated report generation | Daily sales report at 6 AM |
| Inventory | Stock monitoring | Alert when item 86'd |
| Menu Sync | Multi-location sync | Sync prices across locations |
| Labor | Schedule management | Clock-out reminder at shift end |
| Pricing | Dynamic pricing | Happy hour price changes |
| Integrations | Third-party sync | Sync orders to accounting |

### 3. Trigger Types

```typescript
type TriggerType =
  | 'schedule'    // Cron-based (daily, weekly, monthly)
  | 'event'       // Toast system events
  | 'threshold'   // Metric-based (stock < 20, sales > $5000)
  | 'webhook'     // External system triggers
  | 'manual';     // Admin-initiated
```

### 4. Action Types

```typescript
type ActionType =
  | 'email'         // Send notification
  | 'webhook'       // Call external endpoint
  | 'update'        // Modify Toast configuration
  | 'notification'  // In-app alert
  | 'export'        // Generate report
  | 'browser_task'; // Execute Puppeteer automation
```

---

## Phase 1: Wire UI to Real Data (Week 1)

### 1.1 Remove Hardcoded SAMPLE_RULES

**File:** `pages/ToastAutomate.tsx`

**Current:**
```typescript
const SAMPLE_RULES = [
  { id: '1', name: 'Daily Sales Report', runCount: 127, ... },
  // ... hardcoded data
];
```

**Fix:**
```typescript
const [rules, setRules] = useState<AutomationRule[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch('/api/automation/rules', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setRules(data.data);
      }
    })
    .finally(() => setLoading(false));
}, []);
```

### 1.2 Create Rules API

**File:** `functions/api/automation/rules.js`

```javascript
export async function onRequestGet(context) {
  const auth = await verifyAuth(context.request, context.env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error);
  }

  const db = context.env.DB;

  const { results: rules } = await db.prepare(`
    SELECT
      ar.*,
      (SELECT COUNT(*) FROM automation_events ae
       WHERE ae.rule_id = ar.id AND ae.event_type = 'job_completed') as run_count,
      (SELECT MAX(created_at) FROM automation_events ae
       WHERE ae.rule_id = ar.id) as last_run_at
    FROM automation_rules ar
    WHERE ar.is_active = 1
    ORDER BY ar.created_at DESC
  `).all();

  return Response.json({ success: true, data: rules });
}

export async function onRequestPost(context) {
  const auth = await verifyAuth(context.request, context.env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error);
  }

  const body = await context.request.json();
  const { name, description, category, trigger, actions } = body;

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await context.env.DB.prepare(`
    INSERT INTO automation_rules
    (id, name, description, category, trigger_type, trigger_config, actions_config, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).bind(
    id, name, description, category,
    trigger.type, JSON.stringify(trigger),
    JSON.stringify(actions), now
  ).run();

  return Response.json({ success: true, data: { id } });
}
```

### 1.3 Display Real Execution Logs

**File:** `src/components/admin/automation/AutomationLogs.tsx`

```typescript
const [logs, setLogs] = useState<AutomationEvent[]>([]);

useEffect(() => {
  fetch('/api/automation/events?limit=50', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(data => setLogs(data.data));
}, []);

// Display real timestamps, job types, outcomes
```

---

## Phase 2: Complete Job Handlers (Week 2)

### 2.1 Implement menu_update Handler

**File:** `automation/src/JobExecutor.js`

```javascript
async executeMenuUpdate(job) {
  const { client_id, updates } = job.payload;

  await this.ensureLoggedIn();
  await this.switchToClient(client_id);
  await this.navigateToMenuEditor();

  for (const update of updates) {
    switch (update.type) {
      case 'price_change':
        await this.updateItemPrice(update.item_id, update.new_price);
        break;
      case 'availability':
        await this.toggleItemAvailability(update.item_id, update.available);
        break;
      case 'modifier_update':
        await this.updateModifier(update.modifier_id, update.changes);
        break;
    }
    await this.takeScreenshot(`update_${update.type}`);
  }

  return { updated: updates.length };
}
```

### 2.2 Implement kds_config Handler

```javascript
async executeKDSConfig(job) {
  const { client_id, stations } = job.payload;

  await this.ensureLoggedIn();
  await this.switchToClient(client_id);
  await this.navigateToKDSSettings();

  for (const station of stations) {
    await this.createOrUpdateStation(station);
    await this.configureRouting(station.id, station.routing_rules);
  }

  return { stations_configured: stations.length };
}
```

---

## Phase 3: Observer AI & Self-Healing (Existing)

The system already has self-healing selectors that use Claude Vision API when CSS selectors fail:

**Files:**
- `automation/src/observer/visualDetection.js`
- `automation/src/observer/selfHealing.js`
- `automation/src/toast/selectors.js`

### Self-Healing Flow

```
1. Try primary CSS selector
   ↓ (fails)
2. Try fallback selectors
   ↓ (fails)
3. Take screenshot
4. Send to Claude Vision API
5. Get new selector from visual analysis
6. Cache and use new selector
```

---

## Phase 4: Cron Integration (Week 3)

### 4.1 Cloudflare Cron Trigger

**File:** `wrangler.toml`

```toml
[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes
```

**File:** `functions/cron/automation-scheduler.js`

```javascript
export async function scheduled(event, env, ctx) {
  const db = env.DB;
  const now = Math.floor(Date.now() / 1000);

  // Find rules due to run
  const { results: dueRules } = await db.prepare(`
    SELECT * FROM automation_rules
    WHERE is_active = 1
    AND trigger_type = 'schedule'
    AND (last_run_at IS NULL OR last_run_at + interval_seconds <= ?)
  `).bind(now).all();

  for (const rule of dueRules) {
    // Create job for each due rule
    const jobId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO automation_jobs
      (id, rule_id, job_type, payload, status, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).bind(jobId, rule.id, rule.job_type, rule.actions_config, now).run();

    // Update last_run_at
    await db.prepare(`
      UPDATE automation_rules SET last_run_at = ? WHERE id = ?
    `).bind(now, rule.id).run();
  }
}
```

---

## Phase 5: Security Considerations

### 5.1 Credential Storage (Implemented)

- Toast credentials encrypted with AES-256-GCM in D1
- `ENCRYPTION_KEY` stored in Cloudflare secrets
- Decryption only on automation server (never in browser)

### 5.2 API Key Rotation

```javascript
// Monthly key rotation reminder
if (credential.created_at < thirtyDaysAgo) {
  createNotification({
    type: 'security',
    message: `Toast credentials for ${client.name} are 30+ days old. Consider rotating.`
  });
}
```

### 5.3 Approval Workflow

For high-risk operations:
- Price changes over threshold
- Bulk deletions
- Integration modifications

Require admin approval before execution.

---

## Database Tables

**Existing (from migrations):**
- `automation_rules` - Rule definitions
- `automation_jobs` - Job queue
- `automation_events` - Audit trail
- `automation_job_steps` - Step-by-step tracking
- `toast_credentials` - Encrypted credentials

---

## MVP Scope vs Full Feature Set

### MVP (Current Phase)
1. ✅ Menu deployment automation
2. ✅ Health check automation
3. ⏳ Wire UI to real D1 data
4. ⏳ Display real execution logs
5. ⏳ Enable feature flag for testing

### Full Feature Set (Future)
| Feature | Complexity | Business Value |
|---------|------------|----------------|
| Visual rule builder | Medium | High |
| Multi-location sync | High | High |
| Proactive menu optimization | High | Medium |
| Toast API integration (read) | Medium | Medium |
| White-label client portal | High | High |

---

## Verification Checklist

### Phase 1 ✅ COMPLETED (Jan 26, 2026)
- [x] Rules API returns real data from D1 (`/api/automation/rules.js`)
- [x] ToastAutomate.tsx displays actual rules (fetches from API)
- [x] Run counts from automation_events table (via events API)
- [x] "Create Rule" saves to D1 (POST to rules API)
- [x] Events API created (`/api/automation/events.js`)
- [x] AutomationLogs.tsx updated to use events API

### Phase 2 ✅ COMPLETED (Jan 26, 2026)
- [x] menu_update handler works (price_change, availability, modifier_update, item_update)
- [x] kds_config handler works (station creation, routing configuration)
- [x] ToastBrowserClient extended with updateMenuItem, toggleItemAvailability, updateModifier
- [x] ToastBrowserClient extended with createOrUpdateStation, configureRouting
- [ ] Screenshots uploaded to R2 (existing implementation)

### Phase 3
- [ ] Cron trigger fires every 5 minutes
- [ ] Due rules create pending jobs
- [ ] Jobs picked up by automation server

### Phase 4
- [ ] Feature flag ON in test environment
- [ ] End-to-end test with real Toast account
- [ ] Monitor self-healing in production

---

## Critical Files

| File | Purpose |
|------|---------|
| `pages/ToastAutomate.tsx` | Public rule builder UI (fetches from API) |
| `automation/src/JobExecutor.js` | Core execution engine (menu_update, kds_config implemented) |
| `automation/src/ToastBrowserClient.js` | Browser automation (extended with update methods) |
| `automation/src/toast/login.js` | Toast portal login |
| `automation/src/observer/selfHealing.js` | Selector recovery |
| `functions/api/automation/jobs.js` | Job CRUD API (job types aligned) |
| `functions/api/automation/rules.js` | Rules CRUD API (NEW - Phase 1) |
| `functions/api/automation/rules/[id].js` | Individual rule operations (NEW) |
| `functions/api/automation/events.js` | Automation events API (NEW) |
| `src/components/admin/automation/AutomationLogs.tsx` | Real-time event log display |
| `docs/TOAST_ABO_REDESIGN_PLAN.md` | Architecture reference |

---

*Author: Claude Opus 4.5*
*For: R&G Consulting Platform*
