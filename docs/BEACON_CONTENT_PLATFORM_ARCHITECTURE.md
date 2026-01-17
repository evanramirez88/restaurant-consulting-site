# Beacon - Content Aggregation & Curation Platform

**Working Name:** Beacon (pending final decision)
**Purpose:** Aggregate, curate, and publish authoritative Toast POS content to drive SEO traffic
**Created:** 2026-01-17

---

## Executive Summary

Beacon is a content aggregation and curation platform that:
1. **Aggregates** content from multiple sources (Reddit, Toast docs, web, owner's expertise)
2. **Curates** through admin review and approval workflow
3. **Publishes** to a public-facing feed that drives organic and AI traffic
4. **Creates** original content using AI tools and owner's extensive Toast knowledge

This replaces the previous "Toast Hub" concept (multi-location dashboard) with a content marketing/SEO platform.

---

## System Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CONTENT SOURCES                               │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤
│   Reddit    │Toast Central│  ToastTab   │  Classroom  │  Owner Data │
│ r/ToastPOS  │   Docs      │   Docs      │  Training   │ Transcripts │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┘
       │             │             │             │             │
       └─────────────┴─────────────┴─────────────┴─────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      AGGREGATOR ENGINE                               │
│  • Web Crawler/Spider                                                │
│  • Reddit API Integration                                            │
│  • NotebookLM Queries                                                │
│  • RSS/Feed Parsing                                                  │
│  • Scheduled Jobs (Cloudflare Cron)                                  │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CONTENT QUEUE (D1)                              │
│  • Raw aggregated items                                              │
│  • Source metadata                                                   │
│  • Status: pending | reviewed | approved | rejected | published      │
│  • AI-generated summaries/tags                                       │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   ADMIN DASHBOARD (Curation)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │  Feed View  │  │  Workshop   │  │  Analytics  │                  │
│  │ (Incoming)  │  │  (Create)   │  │ (Metrics)   │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
│                                                                      │
│  Actions: Approve | Reject | Edit | Transform | Schedule             │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   CONTENT TRANSFORMER                                │
│  • AI summarization                                                  │
│  • Infographic generation                                            │
│  • Blog post formatting                                              │
│  • SOP templates                                                     │
│  • Social media snippets                                             │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   PUBLIC FEED (Front-End)                            │
│  • Curated, approved content only                                    │
│  • SEO-optimized pages                                               │
│  • Structured data for AI crawlers                                   │
│  • Categories/Tags for filtering                                     │
│  • RSS feed for syndication                                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### D1 Database Schema

```sql
-- Content sources configuration
CREATE TABLE beacon_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'reddit' | 'rss' | 'web_scrape' | 'notebooklm' | 'manual'
  config_json TEXT, -- Source-specific config (subreddit, URL, notebook ID, etc.)
  enabled INTEGER DEFAULT 1,
  fetch_frequency_minutes INTEGER DEFAULT 60,
  last_fetched_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Raw aggregated content items
CREATE TABLE beacon_content_items (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES beacon_sources(id),
  external_id TEXT, -- ID from source (Reddit post ID, etc.)

  -- Content
  title TEXT NOT NULL,
  body TEXT,
  body_html TEXT,
  url TEXT,
  author TEXT,

  -- Metadata
  source_type TEXT NOT NULL,
  source_url TEXT,
  source_metadata_json TEXT, -- Reddit score, comments, etc.

  -- AI Processing
  ai_summary TEXT,
  ai_tags_json TEXT,
  ai_category TEXT,
  ai_sentiment TEXT,
  ai_action_suggestion TEXT, -- "solve", "respond", "infographic", "blog"

  -- Workflow
  status TEXT DEFAULT 'pending', -- pending | reviewed | approved | rejected | published | archived
  priority INTEGER DEFAULT 0, -- Higher = more important
  reviewed_by TEXT,
  reviewed_at INTEGER,
  rejection_reason TEXT,

  -- Publishing
  published_at INTEGER,
  publish_scheduled_at INTEGER,

  -- Timestamps
  fetched_at INTEGER DEFAULT (unixepoch()),
  source_created_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Transformed/created content (from workshop)
CREATE TABLE beacon_publications (
  id TEXT PRIMARY KEY,
  source_item_id TEXT REFERENCES beacon_content_items(id), -- Original item if transformed

  -- Content
  type TEXT NOT NULL, -- 'blog' | 'infographic' | 'sop' | 'social' | 'solution' | 'faq'
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  excerpt TEXT,
  body TEXT,
  body_html TEXT,

  -- Media
  featured_image_url TEXT,
  media_urls_json TEXT,

  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  keywords_json TEXT,
  structured_data_json TEXT, -- Schema.org JSON-LD

  -- Categorization
  category TEXT,
  tags_json TEXT,

  -- Publishing
  status TEXT DEFAULT 'draft', -- draft | scheduled | published | archived
  published_at INTEGER,
  scheduled_at INTEGER,

  -- Engagement
  view_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,

  -- Author
  author_id TEXT,

  -- Timestamps
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Templates for content transformation
CREATE TABLE beacon_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'blog' | 'infographic' | 'sop' | 'social' | 'email'
  description TEXT,
  template_content TEXT, -- Handlebars/Mustache template
  default_styles_json TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Toast template analysis (competitor templates to improve upon)
CREATE TABLE beacon_toast_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT, -- 'menu' | 'report' | 'sop' | 'training'
  source_url TEXT,
  original_content TEXT,

  -- Analysis
  issues_json TEXT, -- Problems with this template
  improvements_json TEXT, -- How we'd do it better
  our_alternative_id TEXT REFERENCES beacon_templates(id),

  analyzed_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX idx_beacon_items_status ON beacon_content_items(status);
CREATE INDEX idx_beacon_items_source ON beacon_content_items(source_id);
CREATE INDEX idx_beacon_items_fetched ON beacon_content_items(fetched_at);
CREATE INDEX idx_beacon_pubs_status ON beacon_publications(status);
CREATE INDEX idx_beacon_pubs_slug ON beacon_publications(slug);
CREATE INDEX idx_beacon_pubs_published ON beacon_publications(published_at);
```

---

## Content Sources

### 1. Reddit (r/ToastPOS)

**Config:**
```json
{
  "subreddit": "ToastPOS",
  "sort": "new",
  "limit": 25,
  "filter_keywords": ["help", "issue", "problem", "question", "how do I"],
  "min_score": 0
}
```

**Fetch Method:** Reddit JSON API (no auth required for public subreddits)
```
https://www.reddit.com/r/ToastPOS/new.json?limit=25
```

**What to capture:**
- Post title, body, author
- Score, comment count
- Created timestamp
- Post URL
- Flair (if any)

**AI Processing:**
- Categorize: Menu issue, hardware, integration, report, training
- Sentiment: Frustrated, confused, curious
- Suggest action: Can we solve this? Should we respond?

---

### 2. Toast Central (Official Documentation)

**URL:** https://central.toasttab.com/

**What to watch:**
- New articles
- Updated documentation
- Best practices guides
- Template downloads

**Capture:**
- Article title, URL
- Category
- Last updated date
- Content summary

---

### 3. ToastTab (Product Pages)

**URL:** https://pos.toasttab.com/

**What to watch:**
- Product updates
- Feature announcements
- Integration partner news
- Pricing changes

---

### 4. Toast Classroom (Training)

**URL:** https://classroom.toasttab.com/

**What to watch:**
- New training modules
- Certification updates
- Best practices

**Note:** May require authentication - capture what's publicly available

---

### 5. Owner's Data (NotebookLM Integration)

**Notebooks to query:**
- Training transcripts
- Client support tickets (anonymized)
- SOPs and procedures
- Menu build notes
- Implementation checklists

**Integration:** Use NotebookLM MCP/skill to query notebooks for:
- Solutions to specific problems
- Best practices
- Template improvements
- Training content

---

### 6. Toast Templates (Competitor Analysis)

**What to collect:**
- Menu templates
- Report templates
- SOP templates
- Training materials

**Analysis for each:**
- What's wrong with it?
- What would we do differently?
- Create our better alternative

---

## Admin Dashboard Components

### 1. Incoming Feed View

```
┌────────────────────────────────────────────────────────────────┐
│  BEACON - Incoming Content                    [Refresh] [Filters]
├────────────────────────────────────────────────────────────────┤
│  Source: [All ▼]  Status: [Pending ▼]  Category: [All ▼]       │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 🔴 Reddit • r/ToastPOS • 2 hours ago                     │  │
│  │ "KDS showing wrong items after menu update"               │  │
│  │ AI: Menu sync issue. HIGH priority. Action: SOLVE         │  │
│  │ [Approve] [Reject] [Transform →] [View Original]          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 📄 Toast Central • Documentation • 1 day ago             │  │
│  │ "New: Multi-location menu sync feature"                   │  │
│  │ AI: Feature update. MEDIUM priority. Action: BLOG         │  │
│  │ [Approve] [Reject] [Transform →] [View Original]          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 2. Workshop/Studio View

```
┌────────────────────────────────────────────────────────────────┐
│  BEACON - Content Workshop                                      │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Create New:                                                    │
│  [📝 Blog Post] [📊 Infographic] [📋 SOP] [🐦 Social Post]     │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Transform from source:                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Source: "KDS showing wrong items after menu update"       │  │
│  │                                                           │  │
│  │ Transform to: [Blog Post ▼]                               │  │
│  │                                                           │  │
│  │ Template: [Solution Article ▼]                            │  │
│  │                                                           │  │
│  │ [🤖 Generate with AI] [📓 Query NotebookLM]               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  AI Tools:                                                      │
│  [Generate Summary] [Create Infographic] [Write Solution]       │
│  [Make SOP] [Social Snippets] [Query My Data]                   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 3. Publication Queue

```
┌────────────────────────────────────────────────────────────────┐
│  BEACON - Publication Queue                                     │
├────────────────────────────────────────────────────────────────┤
│  [Drafts: 5] [Scheduled: 3] [Published: 47]                    │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SCHEDULED                                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 📝 "How to Fix KDS Display Issues After Menu Updates"    │  │
│  │ Type: Blog • Scheduled: Tomorrow 9:00 AM                  │  │
│  │ [Edit] [Reschedule] [Publish Now] [Cancel]                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  DRAFTS                                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 📊 "Toast Menu Sync: Quick Reference Infographic"        │  │
│  │ Type: Infographic • Created: 2 days ago                   │  │
│  │ [Edit] [Preview] [Schedule] [Delete]                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Public Front-End

### URL Structure

```
/beacon                    - Main feed page
/beacon/blog/:slug         - Individual blog posts
/beacon/solutions/:slug    - Problem/solution articles
/beacon/guides/:slug       - How-to guides
/beacon/sops/:slug         - Standard operating procedures
/beacon/category/:cat      - Category filtered view
/beacon/tag/:tag           - Tag filtered view
/beacon/feed.xml           - RSS feed
/beacon/feed.json          - JSON feed (for AI crawlers)
```

### SEO Optimization

Each published item includes:
- Semantic HTML (article, header, nav, etc.)
- Schema.org structured data (Article, HowTo, FAQPage)
- Open Graph tags
- Twitter Card tags
- Canonical URLs
- Sitemap entries
- robots.txt allowlist

### AI Crawler Optimization

Special considerations for AI training crawlers:
- Clean, well-structured content
- JSON-LD structured data
- Clear authorship attribution
- Source citations
- Comprehensive FAQ schema

---

## API Endpoints

### Admin Endpoints (Protected)

```
GET    /api/admin/beacon/sources          - List content sources
POST   /api/admin/beacon/sources          - Add new source
PUT    /api/admin/beacon/sources/:id      - Update source
DELETE /api/admin/beacon/sources/:id      - Remove source

GET    /api/admin/beacon/items            - List content items (with filters)
GET    /api/admin/beacon/items/:id        - Get single item
PUT    /api/admin/beacon/items/:id        - Update item (status, etc.)
POST   /api/admin/beacon/items/:id/approve - Approve item
POST   /api/admin/beacon/items/:id/reject  - Reject item

GET    /api/admin/beacon/publications     - List publications
POST   /api/admin/beacon/publications     - Create publication
PUT    /api/admin/beacon/publications/:id - Update publication
DELETE /api/admin/beacon/publications/:id - Delete publication
POST   /api/admin/beacon/publications/:id/publish - Publish now

POST   /api/admin/beacon/transform        - Transform item to publication
POST   /api/admin/beacon/ai/summarize     - AI summarization
POST   /api/admin/beacon/ai/generate      - AI content generation
GET    /api/admin/beacon/notebooklm/query - Query NotebookLM notebooks

GET    /api/admin/beacon/templates        - List templates
POST   /api/admin/beacon/templates        - Create template

POST   /api/admin/beacon/fetch            - Manually trigger fetch
GET    /api/admin/beacon/stats            - Dashboard statistics
```

### Public Endpoints

```
GET    /api/beacon/feed                   - Public feed (paginated)
GET    /api/beacon/posts/:slug            - Single publication
GET    /api/beacon/categories             - List categories
GET    /api/beacon/tags                   - List tags
GET    /api/beacon/search                 - Search publications
```

### Cron Jobs (Cloudflare Workers)

```
*/30 * * * *   - Fetch from Reddit (every 30 min)
0 */4 * * *    - Fetch from Toast docs (every 4 hours)
0 6 * * *      - Daily AI processing of pending items
0 9 * * *      - Publish scheduled items
```

---

## Implementation Phases

### Phase 1: Foundation (MVP)
- [ ] Database schema migration
- [ ] Basic source management (Reddit first)
- [ ] Reddit fetcher worker
- [ ] Content queue admin UI
- [ ] Manual approve/reject workflow
- [ ] Basic public feed page

### Phase 2: AI Enhancement
- [ ] AI summarization of incoming items
- [ ] AI categorization and tagging
- [ ] AI action suggestions
- [ ] NotebookLM integration for owner data queries

### Phase 3: Workshop/Studio
- [ ] Content transformation pipeline
- [ ] Blog post editor
- [ ] Infographic generator integration
- [ ] SOP template system
- [ ] Social media snippet generator

### Phase 4: Advanced Features
- [ ] Toast Central scraper
- [ ] Toast template analysis
- [ ] Better alternative templates
- [ ] Scheduled publishing
- [ ] Analytics dashboard

### Phase 5: SEO Optimization
- [ ] Schema.org structured data
- [ ] AI crawler optimization
- [ ] RSS/JSON feeds
- [ ] Sitemap integration
- [ ] Performance optimization

---

## File Structure

```
functions/
  api/
    admin/
      beacon/
        sources.js        - Source CRUD
        items.js          - Content item CRUD
        publications.js   - Publication CRUD
        transform.js      - Content transformation
        ai.js             - AI operations
        templates.js      - Template management
        stats.js          - Dashboard stats
        fetch.js          - Manual fetch trigger
    beacon/
      feed.js             - Public feed
      posts.js            - Public posts
      search.js           - Public search

workers/
  beacon-fetcher/
    src/
      index.ts            - Main worker
      sources/
        reddit.ts         - Reddit fetcher
        toast-central.ts  - Toast Central scraper
        rss.ts            - Generic RSS fetcher

src/
  components/
    admin/
      beacon/
        BeaconDashboard.tsx
        IncomingFeed.tsx
        ContentWorkshop.tsx
        PublicationQueue.tsx
        SourceManager.tsx
        TemplateEditor.tsx

pages/
  Beacon.tsx              - Public feed page
  BeaconPost.tsx          - Individual post page

migrations/
  0032_beacon_content_platform.sql
```

---

## Integration Points

### NotebookLM
- Query owner's notebooks for solutions
- Pull training transcripts
- Generate content from existing knowledge

### Cloudflare Workers AI
- Summarization
- Categorization
- Sentiment analysis
- Content generation

### Image Generation (Future)
- Infographic creation
- Social media graphics
- Diagram generation

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Content items processed | 100+/week | DB count |
| Publications created | 5+/week | DB count |
| Organic traffic | +50% in 3 months | Analytics |
| AI crawler visits | Track | Cloudflare logs |
| Time to publish | <30 min from source | Timestamps |

---

## Notes

- Toast templates are a key competitive advantage - we fix what they get wrong
- Owner's expertise (transcripts, SOPs) is the secret sauce
- AI traffic optimization is forward-thinking for SEO
- The feed should feel like a helpful resource, not marketing spam

---

**Document Status:** Architecture Draft
**Last Updated:** 2026-01-17
**Ready for Implementation:** Pending name confirmation
