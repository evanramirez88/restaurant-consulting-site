# Schema Expansion: Comprehensive Profiling System

**Migration:** `0093_comprehensive_profiling.sql`  
**Created:** 2026-01-27  
**Status:** ✅ Validated locally, ready for remote deployment

## Overview

This migration adds 5 new tables to support comprehensive prospect/client profiling for the Admin Intelligence Researcher agent.

## New Tables

### 1. `prospect_profiles`
Deep company-level intelligence beyond basic organization data.

**Key Fields:**
- **Business Classification:** industry_segment, business_model, employee_count, location_count, annual_revenue
- **Technology Stack:** current_pos, pos_satisfaction, pos_pain_points, tech_stack_json, integrations_json
- **Operations:** hours_of_operation, seasonal_pattern, menu_complexity, price_tier
- **Financial Health:** funding_stage, growth_trajectory, is_profitable
- **Digital Presence:** website_url, social_profiles_json, review scores (Google, Yelp, TripAdvisor)
- **Buying Signals:** recent_tech_changes, job_postings, expansion_signals, pain_signals

### 2. `contact_profiles`
Person-level intelligence with LinkedIn integration and engagement tracking.

**Key Fields:**
- **Professional Identity:** linkedin_url/id, current_title, seniority_level, department, work_history
- **Social Profiles:** twitter, facebook, instagram handles
- **Communication Preferences:** preferred_contact_method, communication_style, response_speed
- **Engagement History:** emails_sent/opened/clicked/replied, meetings, calls, open rates
- **Decision-Making Profile:** is_decision_maker, buying_role, is_champion, is_blocker
- **Intelligence Notes:** pain_points, goals, objections, hot_buttons, vendor_relationships

### 3. `enrichment_data`
Raw scraped and API data storage for audit and reprocessing.

**Key Fields:**
- **Entity Reference:** entity_type, entity_id
- **Source Tracking:** 25+ source types (linkedin, google_places, builtwith, clearbit, etc.)
- **Data Storage:** raw_data_json, extracted_data_json
- **Quality Scoring:** data_quality_score, confidence_score, verification status
- **Processing Status:** raw → parsed → validated → applied → stale/invalid
- **Freshness Tracking:** data_captured_at, expires_at, refresh_priority

### 4. `research_notes`
Intelligence research notes and observations with full-text search.

**Key Fields:**
- **Classification:** 14 note types (observation, insight, hypothesis, finding, warning, opportunity, etc.)
- **Content:** title, content, summary, key_points_json, evidence_json, action_items_json
- **Quality:** confidence_level, verification_status, relevance_score
- **Relationships:** related_notes, parent_note_id, superseded_by
- **Full-Text Search:** FTS5 virtual table with auto-sync triggers

### 5. `profile_scores` (P-P-P Framework)
Problem, Pain, Priority scoring for sales qualification.

**Dimensions:**
- **Problem:** Is there a problem we can solve? (score, category, description, evidence)
- **Pain:** How much pain is it causing? (level, urgency, impact areas, quantified)
- **Priority:** How urgent is solving it? (level, active evaluation, budget, timeline)
- **Composite:** ppp_score (0-100), ppp_grade (A-F), sales_readiness

**Auto-Calculation Triggers:** PPP score and grade auto-calculated on insert/update.

## Helper Views

| View | Purpose |
|------|---------|
| `v_org_intel_360` | Complete organization intelligence with profile and scores |
| `v_contact_intel_360` | Contact intelligence with engagement and scoring |
| `v_hot_opportunities` | High-priority opportunities (ppp_score >= 60) |
| `v_research_activity` | Research activity dashboard by date |

## TypeScript Types

**File:** `src/types/profiling.ts`

Comprehensive type definitions including:
- All table interfaces
- Enums for all constrained fields
- Composite view DTOs
- API request types

## Deployment

### Local Testing (Completed ✅)
```bash
npx wrangler d1 execute DB --local --file="migrations/0093_comprehensive_profiling.sql"
```

### Remote Deployment
```bash
npx wrangler d1 execute DB --remote --file="migrations/0093_comprehensive_profiling.sql"
```

## Integration Points

This schema integrates with existing tables:
- `organizations` (organization_id foreign key)
- `org_contacts` (contact_id foreign key)
- Existing `agent_findings`, `enrichment_queue` for orchestration
- `competitive_intel` for competitor tracking

## Example Usage

### Create a Prospect Profile
```sql
INSERT INTO prospect_profiles (
  id, organization_id, industry_segment, current_pos, 
  pos_satisfaction, profile_completeness
) VALUES (
  'pp_' || hex(randomblob(8)),
  'org_123',
  'casual_dining',
  'Toast',
  'dissatisfied',
  25
);
```

### Score a Prospect
```sql
INSERT INTO profile_scores (
  id, entity_type, entity_id,
  problem_score, problem_category,
  pain_score, pain_level,
  priority_score, priority_level
) VALUES (
  'ps_' || hex(randomblob(8)),
  'organization',
  'org_123',
  75, 'pos_pain',
  60, 'moderate',
  80, 'high'
);
-- ppp_score and ppp_grade auto-calculated by trigger
```

### Find Hot Opportunities
```sql
SELECT * FROM v_hot_opportunities 
ORDER BY ppp_score DESC 
LIMIT 20;
```
