# Restaurant Wrap - Content Aggregation & SEO Pipeline

A comprehensive content aggregation and SEO optimization pipeline for R&G Consulting's restaurant consulting website.

## Overview

Restaurant Wrap automates the process of:
1. **Aggregating** content from restaurant industry sources
2. **Scoring** content for relevance to the consulting business
3. **Transforming** content into SEO-optimized blog post briefs
4. **Queuing** content for human review and publishing

## Pipeline Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Content        │     │  Aggregator     │     │  SEO            │
│  Sources        │────▶│  (Fetch &       │────▶│  Transformer    │
│  (RSS/Reddit/   │     │  Score)         │     │  (Generate      │
│  Scrape)        │     │                 │     │  Briefs)        │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌─────────────────┐              │
                        │  Content        │◀─────────────┘
                        │  Queue          │
                        │  (D1 Database)  │
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │  Admin Review   │
                        │  (API/UI)       │
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │  Published      │
                        │  Blog Posts     │
                        └─────────────────┘
```

## Quick Start

### Run the Aggregator

```bash
# Aggregate from all sources
npx tsx scripts/restaurant-wrap/restaurant-wrap-aggregator.ts

# Aggregate from specific source type
npx tsx scripts/restaurant-wrap/restaurant-wrap-aggregator.ts --source=reddit

# Dry run (no database writes)
npx tsx scripts/restaurant-wrap/restaurant-wrap-aggregator.ts --dry-run
```

### Generate SEO Briefs

```bash
# Transform aggregated content to SEO briefs
npx tsx scripts/restaurant-wrap/content-to-seo.ts

# Use specific input file
npx tsx scripts/restaurant-wrap/content-to-seo.ts --input=./data/restaurant-wrap-2026-01-27.json
```

## Content Sources

### Toast Official (Weight: 10)
- Toast Blog RSS
- Toast Resources (scraped)

### Industry News (Weight: 7-8)
- Nation's Restaurant News
- Modern Restaurant Management
- Restaurant Business Online
- QSR Magazine

### Competitors (Weight: 8-9)
- Clover Blog
- Square Restaurant Blog
- Lightspeed Restaurant Blog
- TouchBistro Blog

### Community (Weight: 5-10)
- r/ToastPOS (highest relevance)
- r/restaurateur
- r/KitchenConfidential
- r/smallbusiness (restaurant posts)

## Scoring System

### Relevance Score (0-100)
Based on keyword matching:
- **Critical keywords** (+10): toast pos, kitchen display, payment processing, etc.
- **Important keywords** (+5): clover, square, delivery integration, etc.
- **Supporting keywords** (+2): restaurant, hospitality, food service, etc.

### SEO Score (0-100)
- Title length optimization (30-60 chars)
- Question/guide format bonus
- Numbers in title
- Content depth
- Target keyword presence

### Trending Score (0-100)
- Recency (< 24h = +30)
- Reddit engagement metrics
- News timeliness

### Overall Priority
```
Overall = (Relevance × 0.4) + (SEO × 0.35) + (Trending × 0.25)
```

## SEO Brief Structure

Each brief includes:

```typescript
interface SEOBlogBrief {
  // Source reference
  sourceContent: { title, url, source, excerpt }
  
  // SEO optimization
  seo: {
    primaryKeyword: string
    secondaryKeywords: string[]
    longTailKeywords: string[]
    metaTitle: string
    metaDescription: string
    suggestedSlug: string
    targetWordCount: { min, max }
    searchIntent: 'informational' | 'commercial' | 'transactional'
  }
  
  // Content structure
  structure: {
    headline: string
    subheadlines: string[]
    suggestedSections: string[]
    ctaPlacement: string[]
    internalLinks: { anchor, targetPage }[]
  }
  
  // AI summary
  summary: {
    keyPoints: string[]
    expertAngle: string
    uniqueValue: string
    targetAudience: string
  }
  
  // Publishing metadata
  publishing: {
    suggestedCategory: string
    suggestedTags: string[]
    priority: 'high' | 'medium' | 'low'
    estimatedEffort: 'quick' | 'standard' | 'deep-dive'
    timeliness: 'evergreen' | 'trending' | 'time-sensitive'
  }
  
  // Scores
  scores: {
    seoOpportunity: number
    contentGap: number
    competitiveDifficulty: number
    overallPriority: number
  }
}
```

## API Endpoints

### Content Queue Management

```bash
# List queue items
GET /api/content-queue
GET /api/content-queue?status=pending&priority=high&limit=10

# Get queue statistics
GET /api/content-queue/stats

# Get single item
GET /api/content-queue/:id

# Add to queue
POST /api/content-queue
{
  "source_content_title": "...",
  "source_content_url": "...",
  "seo_primary_keyword": "..."
}

# Update item
PATCH /api/content-queue/:id
{
  "status": "in_review",
  "assigned_to": "admin",
  "review_notes": "Good opportunity"
}

# Delete item
DELETE /api/content-queue/:id
```

## Database Schema

### content_queue
Main table for storing SEO briefs awaiting review.

Key fields:
- `source_content_*` - Original content reference
- `seo_*` - SEO optimization data
- `structure_*` - Content structure suggestions
- `summary_*` - AI-generated summary data
- `publishing_*` - Publishing metadata
- `score_*` - Priority scores
- `status` - Workflow status

### restaurant_wrap_sources
Configuration for content sources.

### restaurant_wrap_runs
Aggregation run logs and statistics.

### content_keywords
Keyword tracking and performance.

### content_performance
Published content performance metrics.

## Workflow States

```
pending → in_review → writing → editing → approved → published
            ↓
         rejected
            ↓
         archived
```

## Output Files

| File | Location | Description |
|------|----------|-------------|
| Aggregated content | `./data/restaurant-wrap-{date}.json` | Raw aggregated and scored content |
| Content queue | `./data/content-queue-{date}.json` | Transformed SEO briefs |
| Sample briefs | `./data/sample-seo-briefs.json` | Example output for reference |

## Integration with Toast Hub

The Restaurant Wrap pipeline integrates with the existing Toast Hub system:

1. **Sources sync**: Shares source configuration with `toast_hub_sources`
2. **Publishing**: Approved briefs can be promoted to `toast_hub_posts`
3. **Deduplication**: Checks against `toast_hub_imports` for duplicates

## Configuration

### Environment Variables

```env
# Optional: AI enhancement (requires API key)
OPENAI_API_KEY=sk-...

# Database (uses existing Cloudflare D1)
# Automatically uses DB binding from wrangler.toml
```

### Keyword Configuration

Edit `RELEVANCE_KEYWORDS` in `restaurant-wrap-aggregator.ts` to adjust scoring:

```typescript
export const RELEVANCE_KEYWORDS = {
  critical: ['toast pos', 'kitchen display', ...],
  important: ['clover pos', 'square pos', ...],
  supporting: ['restaurant', 'dining', ...]
}
```

## Sample Output

See `./data/sample-seo-briefs.json` for three example briefs:

1. **Toast KDS 2026 Features** (Priority: 82/100)
   - Category: Toast Guides
   - Effort: Standard
   - Timeliness: Trending

2. **Square to Toast Migration** (Priority: 79/100)
   - Category: POS Comparisons
   - Effort: Deep-dive
   - Timeliness: Evergreen

3. **DoorDash Commission Changes** (Priority: 81/100)
   - Category: Industry News
   - Effort: Standard
   - Timeliness: Time-sensitive

## Development

### Adding New Sources

1. Add source config to `CONTENT_SOURCES` array
2. Implement fetcher if new type (RSS/Reddit/scrape supported)
3. Add to `restaurant_wrap_sources` table via migration

### Customizing SEO Rules

1. Update `KEYWORD_DATABASE` for target keywords
2. Modify scoring functions in `content-to-seo.ts`
3. Adjust `CONTENT_CATEGORIES` for categorization rules

### Testing

```bash
# Test aggregator with dry run
npx tsx scripts/restaurant-wrap/restaurant-wrap-aggregator.ts --dry-run

# Test single source
npx tsx scripts/restaurant-wrap/restaurant-wrap-aggregator.ts --source=reddit --dry-run
```

## Roadmap

- [ ] AI-powered content summarization (OpenAI/Claude)
- [ ] Google Trends API integration
- [ ] Automated SERP position tracking
- [ ] Content calendar suggestions
- [ ] Automated internal linking recommendations
- [ ] Social media post generation

## License

Internal use only - R&G Consulting
