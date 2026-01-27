# Phase 4: n8n Operational Workflows

## Overview

Phase 4 implements business automation workflows using n8n that orchestrate the Phase 3 Control Center APIs. These workflows create end-to-end automation pipelines for menu intake, lead management, billing, monitoring, and job processing.

## Workflow Summary

| # | Workflow | Trigger | Purpose |
|---|----------|---------|---------|
| 01 | Menu Intake Pipeline | Gmail (email) | Email → OCR → Claude → Automation Job |
| 02 | Lead Validation | Daily 6 AM | Validate/score D1 leads |
| 03 | Billing Automation | Trello webhook | Card → Square Invoice |
| 04 | Daily Briefing | Weekdays 6 AM | Aggregate → Slack report |
| 05 | Health Check Runner | Every 6 hours | Toast integration health |
| 06 | Job Processor | Every minute | Execute queued jobs |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PHASE 4 LAYER                                   │
│                         n8n Workflow Orchestration                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  External Services          n8n Workflows            Phase 3 APIs            │
│  ┌─────────────┐           ┌─────────────┐          ┌─────────────┐         │
│  │ Gmail       │──trigger──│ 01 Menu     │──create──│ /automation │         │
│  │ Trello      │──trigger──│ 03 Billing  │──alert───│ /intelligence│        │
│  │ Square      │◄─invoice──│             │          │             │         │
│  │ Slack       │◄─notify───│ 04 Briefing │──query───│             │         │
│  │ OCR.space   │◄─extract──│ 05 Health   │──check───│ /toast      │         │
│  │ Claude      │◄─parse────│ 06 Processor│──execute─│             │         │
│  └─────────────┘           └─────────────┘          └─────────────┘         │
│                                   │                        │                │
│                                   └────────────────────────┘                │
│                                          Phase 2                            │
│                                   ┌─────────────┐                           │
│                                   │browser-srv  │                           │
│                                   │(Playwright) │                           │
│                                   └─────────────┘                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
n8n-workflows/
├── README.md                       # Detailed documentation
├── 01-menu-intake-pipeline.json    # Email → OCR → Claude → Job
├── 02-lead-validation.json         # Daily lead scoring
├── 03-billing-automation.json      # Trello → Square invoice
├── 04-daily-briefing-generator.json # Morning Slack report
├── 05-health-check-runner.json     # Toast health monitoring
└── 06-job-processor.json           # Job queue executor
```

## Key Features

### 01 - Menu Intake Pipeline
- Gmail trigger for new emails with attachments
- OCR.space text extraction from images/PDFs
- Claude AI for structured menu parsing
- Automatic job creation in Phase 3 queue
- Confirmation email to sender

### 02 - Lead Validation
- Daily batch validation of D1 leads
- Email format and disposable domain checks
- MX record verification via Google DNS
- Score adjustments and segment assignment (A-D)
- Summary alerts logged to intelligence API

### 03 - Billing Automation
- Trello webhook on card move to "Done"
- Parse client/amount/email from card
- Create and publish Square invoice
- Update Trello card with invoice ID
- Alerts for incomplete billing info

### 04 - Daily Briefing
- Weekday 6 AM Slack briefing
- Job queue statistics
- Client health summary
- Active alerts count
- Lead pipeline by segment

### 05 - Health Check Runner
- Every 6 hours for all active Toast integrations
- Login validation
- UI change detection (selector drift)
- Error alerts with Slack notifications
- Auto-mark integrations as error status

### 06 - Job Processor
- Polls queue every minute
- Priority-based job selection
- Supports: menu_build, health_check, menu_sync, golden_copy
- Routes to appropriate API endpoint
- Success/failure status updates
- Failure alerts with retry tracking

## Environment Variables

```bash
# Required for n8n workflows
OCR_SPACE_API_KEY=
ANTHROPIC_API_KEY=
SQUARE_ACCESS_TOKEN=
SQUARE_LOCATION_ID=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_D1_DATABASE_ID=
CLOUDFLARE_API_TOKEN=
SLACK_ALERT_WEBHOOK=
SLACK_BRIEFING_WEBHOOK=
DEFAULT_CLIENT_ID=
```

## Integration with Previous Phases

### Phase 1 (Docker Infrastructure)
- n8n runs as Docker container on rg-network
- Shares network with api, postgres, redis, minio

### Phase 2 (Toast ABO Engine)
- Job processor calls browser-service for menu builds
- Health checks use session manager and self-healer

### Phase 3 (Admin Portal Brain)
- All workflows call Phase 3 REST APIs
- Jobs created via /api/automation/jobs
- Alerts logged via /api/intelligence/alerts
- Toast integrations managed via /api/toast/*

## Activation Order

1. **06-job-processor** - Start first (processes queued work)
2. **05-health-check** - Enable monitoring
3. **04-daily-briefing** - Enable reporting
4. **02-lead-validation** - Enable lead scoring
5. **03-billing** - Enable billing automation
6. **01-menu-intake** - Enable email intake

## Quick Start

```bash
# 1. Import workflows to n8n
# Open http://localhost:5678 → Import from File

# 2. Configure credentials
# Gmail OAuth2, Trello API, Slack webhooks

# 3. Set environment variables
# In n8n settings or docker-compose

# 4. Activate workflows
# Toggle on in n8n dashboard
```

## Monitoring

```bash
# View job queue status
curl http://localhost:8000/api/automation/jobs/stats

# Check active alerts
curl http://localhost:8000/api/intelligence/alerts?status=active

# System health
curl http://localhost:8000/api/intelligence/system/health
```

## Next: Phase 5

Phase 5 will implement the QA Center of Excellence:
- Automated test suites for Toast UI
- Regression detection
- Visual diff testing
- Performance benchmarks
