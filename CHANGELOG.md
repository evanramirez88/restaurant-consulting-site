# Changelog

All notable changes to R&G Consulting Website.

## [2026-01-28] - Intelligence Researcher & Content Pipeline

### Added

#### Schema Expansion (Comprehensive Profiling)
- `prospect_profiles` table - Company intelligence (tech stack, financials, buying signals)
- `contact_profiles` table - Person intelligence (LinkedIn, engagement, decision-making role)
- `enrichment_data` table - Raw data storage with 25+ source types
- `research_notes` table - Intelligence notes with FTS search
- `profile_scores` table - P-P-P scoring with auto-calculated grades
- 4 helper views: `v_org_intel_360`, `v_contact_intel_360`, `v_hot_opportunities`, `v_research_activity`
- TypeScript types: `src/types/profiling.ts`

#### Admin Intelligence Researcher UI
- P-P-P Framework interface (Problem-Pain-Priority scoring)
- `ProspectCard` component - Displays prospect info with score indicators
- `PPPScoreForm` component - Interactive sliders with helper suggestions
- `ResearchNotes` component - Tabbed interface for notes, web data, history
- `PriorityQueue` component - Sorted prospect list with tier visualization
- `IntelligenceResearcher` component - Main page tying everything together
- API endpoints: `/api/admin/intelligence/ppp/` (list + CRUD)
- Migration: `0040_ppp_scoring.sql`

#### Business Brief Enrichment Pipeline
- Cloudflare Worker: `workers/business-brief-enricher/`
- Recursive enrichment (loops until 75% completeness OR 5 rounds)
- FREE data sources: website scraping, Brave Search, Google Custom Search
- Opportunity scoring (0-100) based on tech gaps + pain signals
- Pages Function: `/api/admin/intelligence/enrich-full`
- Migration: `0093_opportunity_analysis.sql`

#### Restaurant Wrap SEO Pipeline
- Aggregator script: `scripts/restaurant-wrap/restaurant-wrap-aggregator.ts`
- Content transformer: `scripts/restaurant-wrap/content-to-seo.ts`
- 12 content sources (Toast, NRN, Reddit, competitors)
- Keyword extraction, meta generation, search intent detection
- Content queue API: `/api/content-queue/` (list, create, stats, CRUD)
- Sample SEO briefs: `data/sample-seo-briefs.json`
- Migration: `0093_restaurant_wrap_content_queue.sql`

### Changed
- Updated `ClientIntelligenceTab.tsx` to include P-P-P Research tab
- Updated `src/components/admin/intelligence/index.ts` exports
- README.md updated with new features and structure

---

## [2026-01-26] - Toast Hub Authority Engine

### Added
- Content aggregation from RSS feeds + Reddit
- Two-gate curation workflow
- GEO optimization features
- Cinematic frontend with parallax hero
- toast-hub-aggregator worker

---

## [2026-01-23] - Email Automation System

### Added
- Email dispatcher worker with cron scheduling
- 8 sequences, 22 steps
- D1-based daily counter
- 77 enrolled subscribers (national leads)

---

*For earlier changes, see git history.*
