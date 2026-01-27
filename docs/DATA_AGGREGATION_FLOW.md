# Data Aggregation Flow Documentation

## Overview

The R&G Consulting Business Platform implements a multi-tier intelligence aggregation pipeline that collects, processes, and serves content to the Intelligence Researcher system for RAG (Retrieval Augmented Generation) queries.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL DATA SOURCES                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  RSS Feeds              │  Reddit               │  Manual/Internal           │
│  ├─ Nation's Rest News  │  ├─ r/ToastPOS       │  ├─ Support Tickets        │
│  ├─ Modern Rest Mgmt    │  └─ r/restaurateur   │  ├─ Business Briefs        │
│  ├─ Restaurant Business │                       │  └─ DATA_CONTEXT           │
│  └─ Foodservice Equip   │                       │                            │
└─────────────────────────┴───────────────────────┴────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TOAST HUB AGGREGATOR WORKER                            │
│                    (workers/toast-hub-aggregator/)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Fetches content from configured sources every 2 hours (cron disabled)     │
│  • Parses RSS/Atom feeds and Reddit RSS                                      │
│  • Scores content for relevance (Toast/POS/Restaurant keywords)              │
│  • Deduplicates via external_id                                              │
│  • Stores in toast_hub_imports with status='pending'                         │
│  • Auto-disables failing sources after 5 consecutive failures                │
│  • Manual trigger: POST /run or /api/admin/toast-hub/aggregator              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           D1 DATABASE STORAGE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  toast_hub_sources      │  toast_hub_imports    │  toast_hub_aggregator_logs │
│  ├─ id                  │  ├─ id                │  ├─ id                     │
│  ├─ name                │  ├─ source_id         │  ├─ run_started_at         │
│  ├─ source_type         │  ├─ external_id       │  ├─ sources_processed      │
│  ├─ feed_url            │  ├─ title             │  ├─ items_fetched          │
│  ├─ is_active           │  ├─ content_body      │  ├─ items_imported         │
│  └─ last_fetched_at     │  ├─ ai_score          │  └─ status                 │
│                         │  └─ status            │                            │
└─────────────────────────┴───────────────────────┴────────────────────────────┘
                                      │
                        ┌─────────────┴─────────────┐
                        ▼                           ▼
┌───────────────────────────────────┐  ┌───────────────────────────────────┐
│      CONTEXT ITEMS TABLE          │  │    INTEL FEED ITEMS TABLE         │
│      (For RAG Queries)            │  │    (For Intel Triage)             │
├───────────────────────────────────┤  ├───────────────────────────────────┤
│  context_items                    │  │  intel_feed_items                 │
│  ├─ id                            │  │  ├─ id                            │
│  ├─ source_id                     │  │  ├─ source_id                     │
│  ├─ item_type                     │  │  ├─ title                         │
│  ├─ title                         │  │  ├─ content                       │
│  ├─ content                       │  │  ├─ relevance_score               │
│  ├─ summary                       │  │  ├─ triage_status                 │
│  ├─ relevance_score               │  │  └─ converted_to_finding          │
│  └─ privacy_level                 │  │                                   │
└───────────────────────────────────┘  └───────────────────────────────────┘
                        │                           │
                        └─────────────┬─────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INTELLIGENCE RESEARCHER LAYER                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Endpoints:                                                                  │
│  ├─ GET /api/context/search?q=...         (Search context_items)            │
│  ├─ GET /api/admin/intelligence/feed      (Browse intel_feed_items)         │
│  ├─ GET /api/admin/intelligence-console/context?action=search               │
│  ├─ GET /api/admin/intelligence/research  (Run research sessions)           │
│  └─ GET /api/admin/intelligence/health    (Aggregation health check)        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Sources

### Configured RSS Sources (Active)

| ID | Name | Type | Feed URL | Status |
|----|------|------|----------|--------|
| src_nrn | Nation's Restaurant News | RSS | https://www.nrn.com/rss.xml | ✅ Active |
| src_mrm | Modern Restaurant Management | RSS | https://modernrestaurantmanagement.com/feed/ | ✅ Active |
| src_rbo | Restaurant Business Online | RSS | https://www.restaurantbusinessonline.com/rss.xml | ✅ Active |
| src_fsm | Foodservice Equipment Reports | RSS | https://fermag.com/feed/ | ✅ Active |
| src_reddit_toast | r/ToastPOS | Reddit | https://www.reddit.com/r/ToastPOS/.rss | ✅ Active |
| src_reddit_rest | r/restaurateur | Reddit | https://www.reddit.com/r/restaurateur/.rss | ✅ Active |

### Internal Sources

| ID | Name | Type | Description |
|----|------|------|-------------|
| src_data_context | DATA_CONTEXT Knowledge | data_context | Headless sync from DATA_CONTEXT engine |
| src_tickets | Support Ticket Insights | manual | Curated insights from support interactions |
| src_briefs | Business Brief Reports | manual | Weekly business intelligence reports |

## Refresh Schedules

### Toast Hub Aggregator

- **Cron Schedule**: `0 */2 * * *` (Every 2 hours) - **DISABLED** due to Cloudflare free tier limits
- **Manual Trigger**: Available via Admin UI or API
- **Worker URL**: `https://toast-hub-aggregator.ramirezconsulting-rg.workers.dev`

### Intelligence Scheduler

| Agent | Schedule (EST) | UTC | Purpose |
|-------|----------------|-----|---------|
| Hunter | 4:00 AM | 09:00 UTC | Licensing scans, real estate monitoring |
| Analyst | 5:00 AM | 10:00 UTC | Tech stack auditing, LinkedIn mapping |
| Operator | 6:00 AM | 11:00 UTC | Automation health checks |
| Strategist | 7:00 AM | 12:00 UTC | Lead scoring, daily brief |

## API Endpoints

### Toast Hub Aggregator

```bash
# Get aggregator status
GET /api/admin/toast-hub/aggregator

# Trigger manual aggregation run
POST /api/admin/toast-hub/aggregator

# Direct worker endpoint (manual run)
POST https://toast-hub-aggregator.ramirezconsulting-rg.workers.dev/run
```

### Context Search (RAG)

```bash
# Search context items
GET /api/context/search?q=toast+integration&type=all&limit=20

# Intelligence console context search
GET /api/admin/intelligence-console/context?action=search&q=pos+system

# Get context summary
GET /api/admin/intelligence-console/context
```

### Intelligence Feed

```bash
# Get feed items
GET /api/admin/intelligence/feed?status=pending&limit=50

# Triage a feed item
POST /api/admin/intelligence/feed
{
  "id": "item_id",
  "action": "mark_relevant"
}

# Convert to finding
POST /api/admin/intelligence/feed
{
  "id": "item_id",
  "action": "convert_to_finding"
}
```

### Health Check

```bash
# Get aggregation pipeline health
GET /api/admin/intelligence/health
```

## Content Scoring

The aggregator scores each item for relevance (0-100):

- **Base Score**: 50 points
- **Title length (20-100 chars)**: +10 points
- **Contains "toast"**: +15 points
- **Contains "pos"**: +10 points
- **Contains "restaurant"**: +5 points
- **Content > 200 chars**: +10 points
- **Content > 500 chars**: +5 points
- **Valuable keywords**: +5 points each
  - guide, tutorial, how to, tips, fix, solution
  - issue, problem, help, setup, configure, integration

## Data Flow: Aggregator → Intelligence Researcher

1. **Aggregation**: Toast Hub Aggregator fetches from RSS/Reddit sources
2. **Storage**: Items stored in `toast_hub_imports` with `status='pending'`
3. **Bridge**: `/api/admin/intelligence/sync-aggregated` syncs approved items to:
   - `context_items` (for RAG queries)
   - `intel_feed_items` (for triage workflow)
4. **Consumption**: Intelligence Researcher queries via:
   - `/api/context/search` (keyword search)
   - `/api/admin/intelligence-console/context` (semantic search)

## Database Tables

### toast_hub_imports
Primary aggregation storage with Two-Gate System:
- `pending` → `approved` → Published to portals
- `pending` → `rejected` → Archived

### context_items
RAG-optimized storage with:
- `privacy_level`: 'business' or 'public' only (never 'personal')
- `relevance_score`: For ranking results
- `embedding_json`: Future vector embeddings

### intel_feed_items
Triage workflow storage with:
- `triage_status`: pending/relevant/irrelevant/needs_review
- `converted_to_finding`: Boolean for actionable items
- `finding_id`: Links to agent_findings table

## Troubleshooting

### Aggregator Not Running
1. Check worker deployment: `wrangler deploy` in workers/toast-hub-aggregator/
2. Verify D1 binding in wrangler.toml
3. Check source health via `/api/admin/toast-hub/sources`

### No Results in Context Search
1. Verify context_items has data: Check via D1 console
2. Run sync: POST to `/api/admin/intelligence/sync-aggregated`
3. Check privacy_level filter (only 'business'/'public' returned)

### Source Auto-Disabled
Sources auto-disable after 5 consecutive failures:
```sql
UPDATE toast_hub_sources SET is_active = 1, consecutive_failures = 0 WHERE id = 'source_id'
```

---

*Last Updated: January 27, 2026*
