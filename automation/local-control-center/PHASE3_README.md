# Phase 3: Admin Portal "Brain" Enhancements

## Overview

Phase 3 adds intelligent decision-making capabilities ("The Brain") to the Autonomous Architect system. This includes automation job orchestration, real-time status updates via WebSocket, client health scoring, and Toast integration management.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ADMIN PORTAL "BRAIN"                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     FastAPI Control Center API                          │ │
│  │                        (localhost:8000)                                 │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                          │ │
│  │  /api/automation/*         /api/intelligence/*      /api/toast/*        │ │
│  │  ├── jobs                  ├── clients/health       ├── integrations    │ │
│  │  ├── jobs/stats            ├── system/health        ├── health-check    │ │
│  │  ├── sessions              ├── alerts               ├── menus           │ │
│  │  └── ws/{client_id}        ├── recommendations      ├── golden-copy     │ │
│  │                            └── decide               └── jobs            │ │
│  │                                                                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │   Job Queue      │  │  Health Scoring  │  │  Recommendation Engine   │  │
│  │   (Redis)        │  │   (PostgreSQL)   │  │       (AI-powered)       │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## New API Routers

### 1. Automation Router (`/api/automation`)

Job queue management with real-time WebSocket updates.

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/jobs` | List automation jobs with filtering |
| GET | `/jobs/{job_id}` | Get specific job details |
| POST | `/jobs` | Create new automation job |
| PATCH | `/jobs/{job_id}` | Update job status/config |
| POST | `/jobs/{job_id}/cancel` | Cancel a pending/running job |
| POST | `/jobs/{job_id}/retry` | Retry a failed job |
| GET | `/jobs/stats` | Get queue statistics |
| GET | `/sessions` | List browser sessions |
| POST | `/sessions/{client_id}/terminate` | Terminate browser session |
| WS | `/ws/{client_id}` | WebSocket for real-time updates |

**Job Types:**
- `menu_build` - Build menu in Toast
- `menu_sync` - Sync menu data
- `item_create` - Create menu item
- `item_update` - Update menu item
- `modifier_sync` - Sync modifier groups
- `health_check` - Run integration health check
- `golden_copy` - Capture/compare UI baselines
- `classification` - AI menu classification
- `report_generation` - Generate reports
- `backup` - Data backup

**WebSocket Events:**
```javascript
// Connect
const ws = new WebSocket('ws://localhost:8000/api/automation/ws/client-123');

// Subscribe to job updates
ws.send(JSON.stringify({ type: 'subscribe', job_id: 'job-uuid' }));

// Receive updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // { type: 'job_update', job_id: '...', status: 'running', progress: 50 }
};
```

### 2. Intelligence Router (`/api/intelligence`)

Decision engine and health scoring.

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clients/{id}/health` | Get client health score |
| GET | `/clients/health-summary` | All clients health summary |
| GET | `/system/health` | System-wide health report |
| GET | `/alerts` | List system alerts |
| POST | `/alerts/{id}/acknowledge` | Acknowledge an alert |
| GET | `/recommendations` | List recommendations |
| POST | `/recommendations/{id}/accept` | Accept recommendation |
| POST | `/recommendations/{id}/decline` | Decline recommendation |
| POST | `/decide` | Make an intelligent decision |
| GET | `/schedule/recommendations` | Get scheduling suggestions |

**Health Scoring Factors:**
- `engagement` (25%) - Recent client activity
- `automation_success` (20%) - Job success rate
- `support_responsiveness` (15%) - Ticket response times
- `payment_health` (15%) - Payment status
- `system_stability` (15%) - Error rates
- `growth_potential` (10%) - Expansion indicators

**Decision Engine:**
```python
# Request
POST /api/intelligence/decide
{
  "context": "When should we schedule the menu sync?",
  "client_id": "uuid",
  "constraints": {
    "preferred_times": ["09:00", "14:00"],
    "avoid_times": ["12:00-13:00"]
  }
}

# Response
{
  "decision": "Schedule for 2024-01-15 09:00 UTC",
  "confidence": 0.85,
  "reasoning": "Low queue load at this time, matches preferred window",
  "alternatives": [...],
  "risk_factors": [...],
  "recommended_actions": [...]
}
```

### 3. Toast Router (`/api/toast`)

Toast POS integration management.

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/integrations` | Create Toast integration |
| GET | `/integrations` | List integrations |
| GET | `/integrations/{id}` | Get integration details |
| PATCH | `/integrations/{id}` | Update credentials/status |
| DELETE | `/integrations/{id}` | Delete integration |
| POST | `/integrations/{id}/health-check` | Run health check |
| GET | `/integrations/{id}/health-history` | Health check history |
| GET | `/integrations/{id}/menus` | Get menu summary |
| POST | `/integrations/{id}/sync-menus` | Trigger menu sync |
| POST | `/integrations/{id}/golden-copy/capture` | Capture UI baselines |
| POST | `/integrations/{id}/golden-copy/compare` | Compare to baselines |
| POST | `/jobs` | Create Toast-specific job |

**Credential Security:**
- Passwords encrypted with Fernet (AES-128)
- TOTP secrets encrypted
- Credentials never returned in API responses
- Decrypted only when needed for automation

## Database Schema

New tables added in `migrations/003_phase3_brain.sql`:

| Table | Purpose |
|-------|---------|
| `automation_jobs` | Job queue with status, priority, dependencies |
| `toast_integrations` | Client Toast credentials (encrypted) |
| `toast_menus` | Synced menu data |
| `toast_items` | Synced menu items |
| `toast_modifier_groups` | Synced modifiers |
| `toast_health_checks` | Health check history |
| `toast_golden_copies` | UI baseline screenshots |
| `alerts` | System alerts |
| `recommendations` | AI-generated recommendations |
| `activity_log` | User/system activity |
| `sync_queue` | Cloudflare sync queue |
| `tickets` | Support tickets |
| `projects` | Client projects |
| `quotes` | Service quotes |

## Configuration

Add to `.env`:

```bash
# Encryption for Toast credentials
ENCRYPTION_KEY=your-32-byte-fernet-key

# Database
DATABASE_URL=postgresql://rg_admin:password@localhost:5432/rg_consulting

# Redis for job queues
REDIS_URL=redis://:password@localhost:6379/0

# MinIO for file storage
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=rg_admin
MINIO_SECRET_KEY=password
MINIO_BUCKET=rg-files
```

## Running Migrations

```bash
# Connect to PostgreSQL
docker exec -it rg-postgres psql -U rg_admin -d rg_consulting

# Run migration
\i /migrations/003_phase3_brain.sql
```

Or via the API container:
```bash
docker exec -it rg-api python -c "
import asyncio
import asyncpg

async def migrate():
    conn = await asyncpg.connect('postgresql://rg_admin:password@postgres:5432/rg_consulting')
    with open('/app/migrations/003_phase3_brain.sql') as f:
        await conn.execute(f.read())
    await conn.close()

asyncio.run(migrate())
"
```

## Usage Examples

### Creating an Automation Job

```python
import httpx

async def create_menu_sync_job(client_id: str, integration_id: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/automation/jobs",
            json={
                "client_id": client_id,
                "job_type": "menu_sync",
                "priority": 2,
                "config": {
                    "integration_id": integration_id,
                    "full_sync": True
                }
            }
        )
        return response.json()
```

### Getting Client Health

```python
async def get_client_health(client_id: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://localhost:8000/api/intelligence/clients/{client_id}/health"
        )
        health = response.json()
        print(f"Health Score: {health['overall_score']}")
        print(f"Status: {health['health_status']}")
        print(f"Recommendations: {len(health['recommendations'])}")
```

### Setting Up Toast Integration

```python
async def create_toast_integration(
    client_id: str,
    restaurant_id: str,
    toast_guid: str,
    username: str,
    password: str,
    totp_secret: str = None
):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/toast/integrations",
            json={
                "client_id": client_id,
                "restaurant_id": restaurant_id,
                "toast_guid": toast_guid,
                "username": username,
                "password": password,
                "totp_secret": totp_secret
            }
        )
        return response.json()
```

### WebSocket Real-Time Updates

```javascript
// Frontend JavaScript
const ws = new WebSocket('ws://localhost:8000/api/automation/ws/my-client');

ws.onopen = () => {
  console.log('Connected to job updates');
};

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);

  if (update.type === 'job_update') {
    updateJobProgress(update.job_id, update.progress, update.status);
  }
};

function subscribeToJob(jobId) {
  ws.send(JSON.stringify({
    type: 'subscribe',
    job_id: jobId
  }));
}
```

## Integration with Phase 1 & 2

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SYSTEM INTEGRATION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Phase 1: Docker Infrastructure                                            │
│   ├── PostgreSQL ←──── Phase 3 stores job data, health scores              │
│   ├── Redis ←───────── Phase 3 uses for job queue                          │
│   ├── MinIO ←───────── Phase 3 stores screenshots, reports                 │
│   └── n8n ←─────────── Phase 4 workflows call Phase 3 APIs                 │
│                                                                              │
│   Phase 2: Toast ABO Engine                                                 │
│   ├── SessionManager ←─ Phase 3 manages via /api/toast/integrations        │
│   ├── SelfHealer ←───── Phase 3 triggers health checks                     │
│   ├── GoldenCopy ←───── Phase 3 captures/compares via /api/toast/golden-*  │
│   └── AutomationController ←── Phase 3 jobs execute via browser-service    │
│                                                                              │
│   Phase 3: Admin Portal "Brain"                                             │
│   ├── Job Queue ────────► Executes via browser-service                     │
│   ├── Intelligence ─────► Scores clients, recommends actions               │
│   └── Toast Manager ────► Stores credentials, triggers automation          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## API Documentation

With the server running, access:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Monitoring

### Job Queue Dashboard

```bash
# Get queue stats
curl http://localhost:8000/api/automation/jobs/stats

# Response:
{
  "total_jobs": 150,
  "pending": 5,
  "queued": 12,
  "running": 3,
  "completed_today": 45,
  "failed_today": 2,
  "avg_duration_seconds": 125.5,
  "by_type": { "menu_sync": 8, "health_check": 6 },
  "by_priority": { "2": 10, "1": 7 }
}
```

### System Health

```bash
# Get system health report
curl http://localhost:8000/api/intelligence/system/health

# Response includes:
# - Database status & latency
# - Redis status & queue sizes
# - Browser service status & session count
# - Job queue health (failed/stale jobs)
# - Active alerts
```

## Next Steps

After Phase 3:
1. **Phase 4**: Build n8n operational workflows that use these APIs
2. **Phase 5**: QA Center of Excellence
3. **Integration**: Connect Menu Builder with full system
