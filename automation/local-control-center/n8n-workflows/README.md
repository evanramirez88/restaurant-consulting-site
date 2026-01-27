# Phase 4: n8n Operational Workflows

## Overview

Phase 4 implements operational automation workflows using n8n. These workflows orchestrate the Phase 3 APIs to create end-to-end business automation pipelines.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          n8n WORKFLOW ORCHESTRATION                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │  01-menu-intake  │  │  02-lead-valid   │  │  03-billing-automation   │  │
│  │  Email → OCR →   │  │  D1 → Validate   │  │  Trello → Square →       │  │
│  │  Claude → Job    │  │  → Score → D1    │  │  Invoice → Alert         │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────────┬─────────────┘  │
│           │                     │                          │                │
│  ┌────────▼─────────┐  ┌────────▼─────────┐  ┌────────────▼─────────────┐  │
│  │  04-daily-brief  │  │  05-health-check │  │  06-job-processor        │  │
│  │  Aggregate →     │  │  Every 6h →      │  │  Every 1m → Execute →    │  │
│  │  Slack Briefing  │  │  Check → Alert   │  │  Mark Complete/Failed    │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘  │
│                                                                              │
│                              ↓ All workflows call ↓                         │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Phase 3 Control Center API                       │   │
│  │  http://api:8000/api/automation/*  /api/intelligence/*  /api/toast/* │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Workflows

### 01 - Menu Intake Pipeline

**File:** `01-menu-intake-pipeline.json`
**Trigger:** Gmail - new email with attachment
**Tags:** `menu`, `automation`

Processes restaurant menu files received via email:

1. **Gmail Trigger** - Monitors inbox for emails with attachments
2. **Check Attachment** - Verifies multipart email (has attachment)
3. **Get Attachments** - Downloads attachment data
4. **Is Menu File?** - Checks if image or PDF
5. **OCR Extract** - Sends to OCR.space API for text extraction
6. **Claude Parse** - Uses Claude to structure menu into JSON
7. **Parse JSON** - Validates and extracts structured data
8. **Create Job** - Creates menu_build automation job
9. **Send Confirmation** - Replies to sender with job reference

**Flow Diagram:**
```
Email → Has Attachment? → Get Files → Is Menu? → OCR → Claude → Create Job → Confirm
                    ↓                      ↓
                   End                    End
```

**Environment Variables:**
- `OCR_SPACE_API_KEY` - OCR.space API key
- `ANTHROPIC_API_KEY` - Claude API key
- `DEFAULT_CLIENT_ID` - Fallback client ID

---

### 02 - Lead Validation Pipeline

**File:** `02-lead-validation.json`
**Trigger:** Schedule - Daily at 6 AM
**Tags:** `leads`, `validation`

Validates and scores leads stored in Cloudflare D1:

1. **Daily 6 AM** - Cron trigger
2. **Fetch Leads** - Query D1 for unvalidated leads (limit 100)
3. **Parse Results** - Extract lead array from D1 response
4. **Has Leads?** - Check if any leads to process
5. **Batch Process** - Process 10 leads at a time
6. **Validate Email** - Check format, disposable domains, business indicators
7. **Check MX** - Verify domain has MX records via DNS
8. **Calculate Score** - Apply scoring adjustments, assign segment (A-D)
9. **Update D1** - Write updated score and validation status
10. **Aggregate** - Summarize validation results
11. **Log Results** - Create alert with summary

**Scoring Factors:**
| Factor | Adjustment |
|--------|------------|
| Disposable email | -50 |
| Invalid format | -30 |
| No MX records | -20 |
| Generic domain (gmail, etc) | -5 |
| Restaurant domain | +10 |
| Valid MX records | +10 |

**Segments:**
| Segment | Score Range | Priority |
|---------|-------------|----------|
| A | 80-100 | High value |
| B | 60-79 | Medium-high |
| C | 40-59 | Medium-low |
| D | 0-39 | Low priority |

**Environment Variables:**
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_API_TOKEN`

---

### 03 - Billing Automation

**File:** `03-billing-automation.json`
**Trigger:** Trello webhook - card moved to Done
**Tags:** `billing`, `automation`

Creates Square invoices when Trello cards move to Done:

1. **Trello Webhook** - Triggers on card movement
2. **Moved to Done?** - Verify card went to Done list
3. **Get Card Details** - Fetch full card with custom fields
4. **Parse Billing Info** - Extract client, amount, email, service type
5. **Ready to Invoice?** - Check if amount > 0 and email present
6. **Create Invoice** - POST to Square Invoices API
7. **Publish Invoice** - Publish and send to client
8. **Update Trello** - Add invoice info to card description
9. **Log Invoice** - Create success alert

**Card Name Format:**
```
Client Name - $XXX - Description
```

**Card Description Fields:**
```
Email: client@example.com
Amount: $XXX (optional, if not in name)
```

**Labels for Service Type:**
- `installation` → installation
- `training` → training
- `menu` → menu_build
- `support` → support
- (default) → consulting

**Environment Variables:**
- `SQUARE_ACCESS_TOKEN`
- `SQUARE_LOCATION_ID`

---

### 04 - Daily Briefing Generator

**File:** `04-daily-briefing-generator.json`
**Trigger:** Schedule - Weekdays at 6 AM
**Tags:** `briefing`, `reporting`

Generates daily operational briefing sent to Slack:

1. **Weekday 6 AM** - Monday-Friday cron trigger
2. **Get Job Stats** - Fetch automation queue statistics
3. **Get Client Health** - Fetch client health summary
4. **Get Alerts** - Fetch active alerts (limit 20)
5. **Get Recommendations** - Fetch pending recommendations
6. **Get Lead Stats** - Query D1 for lead segment counts
7. **Merge Data** - Combine all data sources
8. **Send Slack** - Post formatted briefing to webhook
9. **Log Briefing** - Create info alert

**Briefing Contents:**
- Job queue status (pending, running, completed, failed)
- Client health distribution (healthy, at-risk, critical)
- Alert counts (critical, warning)
- Pending recommendations count
- Lead pipeline by segment

**Environment Variables:**
- `SLACK_BRIEFING_WEBHOOK`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_API_TOKEN`

---

### 05 - Health Check Runner

**File:** `05-health-check-runner.json`
**Trigger:** Schedule - Every 6 hours
**Tags:** `health`, `monitoring`

Runs health checks on all active Toast integrations:

1. **Every 6 Hours** - Interval trigger
2. **Get Integrations** - Fetch active Toast integrations
3. **Process One at a Time** - Sequential to avoid browser overload
4. **Run Health Check** - POST to integration health-check endpoint
5. **Login Successful?** - Check login status
6. **UI Changes?** - Check for selector/layout changes
7. **Alert UI Changes** - Warning alert if UI changed
8. **Alert Login Failed** - Error alert if auth failed
9. **Mark Error** - Update integration status to error
10. **Aggregate Results** - Summarize all checks
11. **Slack Alert** - Notify if any failures
12. **Log Healthy** - Log success if all passed

**Health Check Response:**
```json
{
  "login_success": true,
  "menu_accessible": true,
  "ui_changes_detected": false,
  "response_time_ms": 2500,
  "selector_health": { ... }
}
```

**Environment Variables:**
- `SLACK_ALERT_WEBHOOK`

---

### 06 - Automation Job Processor

**File:** `06-job-processor.json`
**Trigger:** Schedule - Every minute
**Tags:** `automation`, `jobs`

Processes queued automation jobs:

1. **Every Minute** - Poll trigger
2. **Get Queued Jobs** - Fetch up to 5 queued jobs
3. **Select Next Job** - Pick highest priority job
4. **Has Job?** - Check if any jobs to process
5. **Mark Running** - Update job status to running
6. **Route by Type** - Branch based on job_type
7. **Execute** - Call appropriate API endpoint
8. **Collect Result** - Gather execution result
9. **Check Success** - Determine if execution succeeded
10. **Mark Completed/Failed** - Update final job status
11. **Alert on Failure** - Create error alert for failed jobs

**Supported Job Types:**

| Job Type | Endpoint | Timeout |
|----------|----------|---------|
| `menu_build` | `browser-service:3000/api/toast/menu/build` | 5 min |
| `health_check` | `api:8000/api/toast/integrations/{id}/health-check` | 3 min |
| `menu_sync` | `api:8000/api/toast/integrations/{id}/sync-menus` | 10 min |
| `golden_copy` | `api:8000/api/toast/integrations/{id}/golden-copy/{action}` | 5 min |

**Job Priority:**
- Lower number = higher priority
- Jobs sorted by priority, then created_at

---

## Installation

### Import Workflows

1. Access n8n at `http://localhost:5678`
2. Go to **Workflows** → **Import from File**
3. Import each JSON file in order (01-06)
4. Configure credentials for each integration

### Required Credentials

Create these credentials in n8n:

| Credential Type | Name | Used By |
|-----------------|------|---------|
| Gmail OAuth2 | `Gmail - RG Business` | 01-menu-intake |
| Trello API | `Trello RG` | 03-billing |

### Environment Variables

Set these in n8n's environment or `.env` file:

```bash
# OCR Service
OCR_SPACE_API_KEY=your-ocr-api-key

# AI
ANTHROPIC_API_KEY=your-anthropic-key

# Square
SQUARE_ACCESS_TOKEN=your-square-token
SQUARE_LOCATION_ID=your-location-id

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_D1_DATABASE_ID=your-database-id
CLOUDFLARE_API_TOKEN=your-api-token

# Slack
SLACK_ALERT_WEBHOOK=https://hooks.slack.com/services/...
SLACK_BRIEFING_WEBHOOK=https://hooks.slack.com/services/...

# Defaults
DEFAULT_CLIENT_ID=default-client-uuid
```

### Docker Network

Ensure all services are on the same Docker network:

```yaml
services:
  n8n:
    networks:
      - rg-network
  api:
    networks:
      - rg-network
  browser-service:
    networks:
      - rg-network

networks:
  rg-network:
    driver: bridge
```

## Activation

After import and configuration:

1. **01-menu-intake** - Activate (webhook always listening)
2. **02-lead-validation** - Activate (runs at 6 AM daily)
3. **03-billing** - Activate (webhook listening for Trello)
4. **04-daily-briefing** - Activate (runs 6 AM weekdays)
5. **05-health-check** - Activate (runs every 6 hours)
6. **06-job-processor** - Activate (runs every minute)

## Creating Custom Workflows

Use the browser-service API for Toast automation:

```javascript
// Create session
const session = await $http.request({
  method: 'POST',
  url: 'http://browser-service:3000/session/create',
  body: { clientId: 'my-client' }
});

// Navigate
await $http.request({
  method: 'POST',
  url: `http://browser-service:3000/session/${session.sessionId}/navigate`,
  body: { url: 'https://pos.toasttab.com' }
});

// Take screenshot
const screenshot = await $http.request({
  method: 'POST',
  url: `http://browser-service:3000/session/${session.sessionId}/screenshot`,
  body: { fullPage: true }
});
```

## Webhook Endpoints

All webhooks are accessible via nginx at:
- `http://localhost/webhook/{workflow-path}`
- Or externally via Cloudflare Tunnel

Configure webhook trigger nodes to use relative paths like `/hubspot/contact-updated`.

## Monitoring

### n8n Dashboard

- View execution history per workflow
- Check error logs for failed executions
- Monitor webhook activity

### API Endpoints

```bash
# Check job queue
curl http://localhost:8000/api/automation/jobs/stats

# View recent alerts
curl http://localhost:8000/api/intelligence/alerts?limit=10

# System health
curl http://localhost:8000/api/intelligence/system/health
```

### Slack Channels

Configure webhooks to post to:
- `#alerts` - Critical/warning alerts from health checks
- `#briefings` - Daily operational briefings
- `#automation` - Job completion notifications

## Troubleshooting

### Workflow Not Triggering

1. Check workflow is active (toggle on)
2. Verify webhook URL is correct
3. Check n8n logs: `docker logs rg-n8n`

### API Connection Failed

1. Verify services are on same network
2. Check API is running: `curl http://api:8000/health`
3. Review Docker network: `docker network inspect rg-network`

### Job Stuck in Running

1. Check browser-service logs
2. Verify Playwright browser is available
3. Manual job update:
```bash
curl -X PATCH http://localhost:8000/api/automation/jobs/{id} \
  -H "Content-Type: application/json" \
  -d '{"status": "failed", "error_message": "Manual reset"}'
```

## Integration Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SYSTEM INTEGRATION                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  External Services                                                           │
│  ├── Gmail ←────────── 01-menu-intake (email trigger)                       │
│  ├── Trello ←───────── 03-billing (webhook trigger)                         │
│  ├── Square ←───────── 03-billing (invoice creation)                        │
│  ├── Slack ←────────── 04-daily-briefing, 05-health-check (notifications)   │
│  ├── OCR.space ←────── 01-menu-intake (text extraction)                     │
│  └── Claude API ←───── 01-menu-intake (menu parsing)                        │
│                                                                              │
│  Phase 3 APIs                                                                │
│  ├── /api/automation/* ←── 04-briefing, 06-processor (jobs)                │
│  ├── /api/intelligence/* ←─ 04-briefing, all (alerts)                       │
│  └── /api/toast/* ←──────── 05-health-check, 06-processor (integrations)   │
│                                                                              │
│  Phase 2 Services                                                            │
│  └── browser-service ←───── 06-processor (menu builds, automation)          │
│                                                                              │
│  Cloudflare                                                                  │
│  └── D1 Database ←───────── 02-lead-validation, 04-briefing (leads)        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Next Steps

After Phase 4:
1. **Phase 5**: QA Center of Excellence - Test automation, regression detection
2. **Integration**: Connect Menu Builder for full end-to-end automation
