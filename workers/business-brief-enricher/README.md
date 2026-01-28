# Business Brief Enricher

Recursive profile enrichment worker for restaurant leads. Takes leads from D1 and enriches them using FREE data sources until profile completeness threshold is met.

## Features

- **Recursive Enrichment**: Continues filling gaps until 75% completeness achieved
- **Rate Limited**: Stays within free tier limits (100 Brave searches/day, 100 Google searches/day)
- **Opportunity Scoring**: Calculates sales opportunity score based on tech gaps and pain signals
- **Pain Signal Detection**: Identifies operational issues from reviews and web content
- **Decision Maker Extraction**: Finds owner/manager names from websites and searches

## Data Sources (All FREE)

1. **Website Scraping** (unlimited)
   - Tech stack detection (POS, online ordering, reservations)
   - Contact extraction (phone, email)
   - Social media links
   - Cuisine/service style detection

2. **Brave Search API** (100/day free)
   - Fill contact info gaps
   - Find Yelp/social profiles
   - Discover owner names
   - Research tech stack

3. **Google Custom Search** (100/day free)
   - Fallback when Brave limits reached
   - Same enrichment capabilities

## Business Brief Fields

### Core Identity
- Company name, website, address, city, state, zip
- Phone, email

### Decision Makers
- Owner name, email, phone
- Manager contacts
- LinkedIn profiles (when found)

### Tech Stack
- POS System (Toast, Square, Clover, etc.)
- Online Ordering platform
- Reservation system
- Website platform
- Payment processor

### Online Presence
- Facebook, Instagram, Twitter
- Yelp, Google Maps, TripAdvisor URLs
- Ratings and review counts

### Pain Signals
- Tech-related issues
- Service complaints
- Staffing problems
- Financial indicators

### Opportunity Score (0-100)
Derived from:
- Missing/outdated POS (+15 points)
- No online ordering (+12 points)
- Pain signals detected (+5 per signal, max 15)
- Below-average ratings (+8 points)
- Basic/missing website (+5 points)

## API Endpoints

### Health Check
```bash
GET /health
Authorization: Bearer <WORKER_API_KEY>
```

### Enrich Single Lead
```bash
POST /enrich
Authorization: Bearer <WORKER_API_KEY>
Content-Type: application/json

{
  "lead_id": "lead_abc123",
  "max_rounds": 5
}
```

### Batch Process
```bash
POST /batch
Authorization: Bearer <WORKER_API_KEY>
Content-Type: application/json

{
  "batch_size": 10,
  "min_completeness": 0,
  "max_completeness": 74
}
```

### Get Statistics
```bash
GET /stats
Authorization: Bearer <WORKER_API_KEY>
```

### Gap Analysis
```bash
GET /gaps
Authorization: Bearer <WORKER_API_KEY>
```

## Scheduled Runs

The worker runs automatically on a cron schedule:
- **14:00 UTC** (9 AM EST)
- **17:00 UTC** (12 PM EST)
- **20:00 UTC** (3 PM EST)
- **23:00 UTC** (6 PM EST)

Each run processes up to 15 leads, prioritizing:
1. High-scoring leads (lead_score >= 70)
2. Leads with lowest completeness
3. Leads not enriched in the past week

## Environment Variables

Required:
- `WORKER_API_KEY` - API authentication key

Optional:
- `BRAVE_API_KEY` - Brave Search API key
- `GOOGLE_CUSTOM_SEARCH_KEY` - Google Custom Search API key
- `GOOGLE_CUSTOM_SEARCH_CX` - Custom Search Engine ID

## Deployment

```bash
cd workers/business-brief-enricher
npm install
npx wrangler deploy
```

## Database Schema

The enricher uses these tables:
- `restaurant_leads` - Main lead data (updates completeness, gap analysis)
- `lead_opportunity_analysis` - Opportunity scores and factors
- `lead_decision_makers` - Extracted contacts
- `lead_pain_signals` - Detected issues
- `enrichment_runs` - Run logs
- `api_usage_log` - Rate limit tracking

Run migration `0093_opportunity_analysis.sql` to create supporting tables.

## Completeness Calculation

Fields are weighted by importance:
- Company Name: 10
- POS System: 9
- Website, Phone, Email: 8 each
- Owner Name: 7
- Owner Email: 6
- Address: 5
- Online Ordering, Reservation: 5, 4
- Cuisine, Service Style: 4, 3
- Ratings, Social: 2-3 each

Completeness = (filled weights / total weights) × 100

## Rate Limit Strategy

1. Brave Search is primary (faster, cleaner results)
2. Falls back to Google when Brave exhausted
3. Rate limits reset daily at midnight UTC
4. Each enrichment round limited to 3 searches
5. Batch processing stops when limits reached

## Integration with Pages Functions

The main site has `/api/admin/intelligence/enrich-full` which provides:
- Single-lead enrichment (inline, no API keys needed for basic scraping)
- Enrichment status queries
- Overall statistics

For heavy batch processing, use this dedicated worker.
