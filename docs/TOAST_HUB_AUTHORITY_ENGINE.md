# Toast Hub Authority Engine

**Created:** 2026-01-26
**Status:** DEPLOYED & OPERATIONAL
**Purpose:** Transform Toast Hub from a standard blog into an "Authority Engine" for AI citation and operational knowledge management

---

## Overview

The Toast Hub Authority Engine is a content aggregation, curation, and publishing system designed to:
1. **Aggregate** content from RSS feeds, Reddit, and internal sources
2. **Curate** via a Two-Gate approval system (pending → approved → visible)
3. **Optimize** for AI search engines (GEO - Generative Engine Optimization)
4. **Distribute** content across Public, Client Portal, and Rep Portal

---

## Architecture

### Database Schema (D1)

Migration: `migrations/0091_toast_hub_authority_engine.sql`

| Table | Purpose |
|-------|---------|
| `toast_hub_sources` | Content sources (RSS, Reddit, API, manual, DATA_CONTEXT) |
| `toast_hub_imports` | Curation queue with visibility toggles |
| `toast_hub_aggregator_logs` | Aggregation run history |
| `toast_hub_content_requests` | Content generation requests from tickets/briefs |

#### New Columns Added to `toast_hub_posts`
- `visible_public` - Show on public website
- `visible_client_portal` - Show in client Resources tab
- `visible_rep_portal` - Show in rep Sales Intel tab
- `tldr_summary` - 40-60 word summary for GEO
- `expert_commentary` - Evan's analysis section
- `fact_highlights_json` - Array of highlighted statistics
- `faq_json` - Auto-generated FAQs for schema.org
- `reading_time_minutes` - Calculated reading time
- `source_import_id` - Link to original import
- `source_type` - Origin type (import, manual)
- `source_url` - External source URL

### Worker: toast-hub-aggregator

**Location:** `workers/toast-hub-aggregator/`

**URL:** https://toast-hub-aggregator.ramirezconsulting-rg.workers.dev

**Features:**
- RSS feed parsing (Atom and RSS 2.0)
- Reddit RSS feed parsing with flair extraction
- Content scoring algorithm (Toast/POS keyword boost)
- Deduplication via external_id
- Auto-disable sources after 5 consecutive failures
- Manual trigger via HTTP POST /run

**Cron Trigger:** DISABLED (Cloudflare free tier limit of 5 cron triggers reached)

**Manual Trigger Options:**
1. Admin UI: Toast Hub → Aggregator → "Run Now" button
2. API: `POST /api/admin/toast-hub/aggregator`
3. Direct: `POST https://toast-hub-aggregator.ramirezconsulting-rg.workers.dev/run`

### API Endpoints

#### Public API
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/toast-hub/posts` | GET | List published posts (respects visibility) |
| `/api/toast-hub/[slug]` | GET | Single post with schema.org data |
| `/api/toast-hub/categories` | GET | List categories |
| `/api/toast-hub/faqs` | GET | Public FAQs |
| `/api/toast-hub/search` | GET | Full-text search |

**Query Parameters for `/api/toast-hub/posts`:**
- `portal=client` - Filter for client portal visibility
- `portal=rep` - Filter for rep portal visibility
- (no portal) - Filter for public visibility
- `category=<slug>` - Filter by category
- `featured=true` - Featured posts only

#### Admin API
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/toast-hub/imports` | GET | List curation queue |
| `/api/admin/toast-hub/imports` | POST | Create manual import |
| `/api/admin/toast-hub/imports` | PUT | Bulk status update |
| `/api/admin/toast-hub/imports/[id]` | GET | Single import details |
| `/api/admin/toast-hub/imports/[id]` | PUT | Update status/visibility |
| `/api/admin/toast-hub/imports/[id]` | POST | Actions (promote to post) |
| `/api/admin/toast-hub/imports/[id]` | DELETE | Delete import |
| `/api/admin/toast-hub/sources` | GET/POST | List/create sources |
| `/api/admin/toast-hub/sources/[id]` | GET/PUT/DELETE | Single source CRUD |
| `/api/admin/toast-hub/sources/[id]` | POST | Actions (test feed) |
| `/api/admin/toast-hub/aggregator` | GET | Aggregator stats |
| `/api/admin/toast-hub/aggregator` | POST | Trigger manual run |
| `/api/admin/toast-hub/content-requests` | GET/POST/PUT | Content generation requests |

### Admin UI Components

**Location:** `src/components/admin/toasthub/`

| Component | Purpose |
|-----------|---------|
| `ToastHubManager.tsx` | Main container with tab navigation |
| `PendingQueueUI.tsx` | Two-Gate curation interface |
| `SourcesManager.tsx` | RSS/Reddit source management |
| `AggregatorStatus.tsx` | Aggregator monitoring dashboard |
| `ContentEditor.tsx` | Post editing (existing) |
| `FAQManager.tsx` | FAQ management (existing) |
| `ContentAnalytics.tsx` | View analytics (existing) |

**Admin UI Tabs:**
1. **Curation Queue** - Pending imports, approve/reject, visibility toggles
2. **Articles** - Published posts management
3. **FAQs** - FAQ content management
4. **Sources** - Content source configuration
5. **Aggregator** - Run stats, manual trigger
6. **Analytics** - View counts, engagement

### Frontend Components

**Location:** `pages/`

| File | Route | Description |
|------|-------|-------------|
| `ToastHub.tsx` | /toast-hub | Cinematic hub with bento grid |
| `ToastHubPost.tsx` | /toast-hub/[slug] | Article reading experience |

**Design Features:**
- Dark mode primary (#0c0c0f) with amber accent (#ea580c)
- Typography: Playfair Display (display), DM Sans (body), JetBrains Mono (stats)
- Parallax hero with animated gradient
- Animated stat counters (articles, views, years)
- Glass-morphism search bar
- Bento grid for featured content
- Reading progress bar
- TL;DR summary blocks
- Expert Commentary sections
- Table of contents with scroll-spy
- Visibility badges (Public, Client, Rep)
- Schema.org structured data injection

---

## Two-Gate Curation System

### Gate 1: Status Approval
| Status | Description |
|--------|-------------|
| `pending` | New imports awaiting review |
| `approved` | Reviewed and approved for publishing |
| `rejected` | Reviewed and rejected (archived) |

**Rules:**
- Content CANNOT have visibility toggled while `pending`
- Only `approved` content can be toggled visible
- Only `approved` content can be promoted to a post

### Gate 2: Visibility Toggles
| Toggle | Target | Purpose |
|--------|--------|---------|
| `visible_public` | Public website | SEO, GEO, general audience |
| `visible_client_portal` | Client Resources tab | Support guides, configurations |
| `visible_rep_portal` | Rep Sales Intel tab | Win stories, differentiators |

**Rules:**
- Each toggle is independent (content can be visible in multiple places)
- Visibility requires `status = 'approved'`
- Toggling is instant (no additional approval)

### Promotion Workflow
1. Import arrives in queue (status: `pending`)
2. Admin reviews and approves (status: `approved`)
3. Admin toggles visibility (Gate 2)
4. Admin clicks "Promote" to create a `toast_hub_posts` record
5. Post is now live on selected portals

---

## GEO Optimization

### What is GEO?
Generative Engine Optimization (GEO) is optimizing content to be cited by AI search engines (ChatGPT, Perplexity, Gemini).

### Implementation

#### TL;DR Summary Block
Every post MUST have a 40-60 word summary at the top:
```
**TL;DR:** A misconfigured switch caused network loops at Marshside Mama's,
leading to Toast POS freezes during peak hours. Implementing STP and
dedicated VLANs eliminated outages and improved transaction speed by 15%.
```

#### Fact Density
- Statistics highlighted every 150-200 words
- Stored in `fact_highlights_json` array
- Rendered with visual emphasis

#### Expert Commentary
Dedicated section for Evan's analysis:
```
**Expert Analysis:**
This is a classic case of network infrastructure being overlooked during
POS installations. Many Toast implementations fail because the existing
network wasn't designed for the consistent low-latency traffic POS systems
require. Always audit the network before go-live.
```

#### Schema.org Markup
Injected into every post:
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{title}",
  "author": {
    "@type": "Person",
    "name": "Evan Ramirez",
    "jobTitle": "Restaurant Technology Consultant"
  },
  "mainEntity": {
    "@type": "FAQPage",
    "mainEntity": [/* Auto-generated Q&A from headers */]
  }
}
```

**Note:** FAQPage schema increases AI citation by ~28%

### robots.txt Configuration
Already configured to allow AI bots:
```
User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /
```

---

## Content Sources (Seeded)

| Source ID | Name | Type | Feed URL |
|-----------|------|------|----------|
| src_nrn | Nation's Restaurant News | rss | https://www.nrn.com/rss.xml |
| src_mrm | Modern Restaurant Management | rss | https://modernrestaurantmanagement.com/feed/ |
| src_rbo | Restaurant Business Online | rss | https://www.restaurantbusinessonline.com/rss.xml |
| src_fsm | Foodservice Equipment Reports | rss | https://fermag.com/feed/ |
| src_reddit_toast | r/ToastPOS | reddit | https://www.reddit.com/r/ToastPOS/.rss |
| src_reddit_rest | r/restaurateur | reddit | https://www.reddit.com/r/restaurateur/.rss |
| src_data_context | DATA_CONTEXT Knowledge | data_context | (internal) |
| src_tickets | Support Ticket Insights | manual | (internal) |
| src_briefs | Business Brief Reports | manual | (internal) |

---

## Portal Integration

### Client Portal (/portal/*)
- **Tab:** Resources
- **Query:** `visible_client_portal = 1`
- **Content Types:** Survival guides, golden copy configurations, hardware specs

### Rep Portal (/rep/*)
- **Tab:** Sales Intel
- **Query:** `visible_rep_portal = 1`
- **Content Types:** Win stories, technical differentiators, objection handlers

---

## Commands & Operations

### Trigger Aggregation (Manual)
```bash
# Via worker endpoint
curl -X POST https://toast-hub-aggregator.ramirezconsulting-rg.workers.dev/run

# Via admin API
curl -X POST https://ccrestaurantconsulting.com/api/admin/toast-hub/aggregator \
  -H "Cookie: session=..."
```

### Check Aggregator Status
```bash
curl https://toast-hub-aggregator.ramirezconsulting-rg.workers.dev/status
```

### Deploy Worker
```bash
cd workers/toast-hub-aggregator
CLOUDFLARE_ACCOUNT_ID=373a6cef1f9ccf5d26bfd9687a91c0a6 npx wrangler deploy
```

### View Pending Queue
Admin UI: https://ccrestaurantconsulting.com/#/admin → Toast Hub → Curation Queue

---

## Deployment History

### 2026-01-26 - Initial Deployment
- Created D1 migration 0091_toast_hub_authority_engine.sql
- Deployed toast-hub-aggregator worker
- Created admin UI components (PendingQueueUI, SourcesManager, AggregatorStatus)
- Updated ToastHubManager with new tabs
- Redesigned ToastHub.tsx and ToastHubPost.tsx with cinematic design
- Created API endpoints for imports, sources, aggregator
- Updated public API with visibility filtering and GEO data
- First aggregation run: 120 items imported from 6 sources

---

## Next Steps (Optional Enhancements)

1. **AI Scoring Integration** - Use Workers AI to score content quality
2. **Auto-Summarization** - Generate TL;DR summaries automatically
3. **Scheduled Cron** - Upgrade Cloudflare plan for cron triggers, or use external cron service
4. **Content Generation** - Integrate with support tickets for automatic article drafts
5. **Analytics Dashboard** - Track AI citation sources (when Perplexity/ChatGPT cite)
