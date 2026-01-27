# Restaurant Wrapper Intelligence Ecosystem

> **Four interconnected systems working in unison to dominate the Cape Cod restaurant consulting market and scale nationally.**

---

## System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        RESTAURANT WRAPPER PLATFORM                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐  │
│  │  EMAIL ENGINE   │    │  TOAST HUB /    │    │   DATA_CONTEXT ENGINE   │  │
│  │  (Marketing)    │    │  RESTAURANT     │    │   (Central Data Lake)   │  │
│  │                 │    │  WRAP           │    │                         │  │
│  │  Nationwide     │    │  (Content SEO)  │    │  Google APIs, Imports,  │  │
│  │  Lead Outreach  │    │                 │    │  Scrapers, Ingestion    │  │
│  └────────┬────────┘    └────────┬────────┘    └───────────┬─────────────┘  │
│           │                      │                         │                │
│           │                      │                         │                │
│           ▼                      ▼                         ▼                │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         INTELLIGENCE LAYER                             │ │
│  │                                                                        │ │
│  │   ┌────────────────────────┐    ┌────────────────────────────────┐    │ │
│  │   │  PROSPECT RESEARCHER   │    │  CLIENT ENRICHMENT RESEARCHER  │    │ │
│  │   │  (Admin Portal)        │    │  (Business Brief)              │    │ │
│  │   │                        │    │                                │    │ │
│  │   │  Scope: Service Area   │    │  Scope: Existing Clients/Reps  │    │ │
│  │   │  P-town → Plymouth →   │    │  Recursive profile deepening   │    │ │
│  │   │  Providence triangle   │    │  Career tracking, ownership    │    │ │
│  │   │                        │    │  changes, relationship web     │    │ │
│  │   │  Creates profiles of   │    │                                │    │ │
│  │   │  EVERYONE in industry  │    │  Uses DATA_CONTEXT to enrich   │    │ │
│  │   │  (prospects)           │    │  profiles continuously         │    │ │
│  │   └───────────┬────────────┘    └──────────────┬─────────────────┘    │ │
│  │               │                                │                       │ │
│  │               │     ┌──────────────────┐       │                       │ │
│  │               └────►│  CONVERSION      │◄──────┘                       │ │
│  │                     │  Prospect → Client                               │ │
│  │                     │  (Profile already                                │ │
│  │                     │   rich at convert)                               │ │
│  │                     └──────────────────┘                               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## System 1: Email Marketing Engine

**Location:** Admin Portal → Email Campaigns  
**Scope:** Nationwide (Lane B - National Remote Toast Consulting)  
**Purpose:** Cold/warm lead marketing automation

### Responsibilities
- Segment management (by industry, region, intent level)
- Sequence automation (drip campaigns)
- A/B testing
- Deliverability management
- Response tracking and routing

### Data Flow
```
Lead Sources → Email Engine → Nurture Sequences → Qualified Leads → Sales Pipeline
```

### NOT Responsible For
- Deep profile enrichment (that's Intelligence)
- Service area prospect discovery (that's Prospect Researcher)
- Content aggregation (that's Toast Hub)

---

## System 2: Prospect Intelligence Researcher

**Location:** Admin Portal → Intelligence Dashboard  
**Scope:** On-site service area ONLY
- Provincetown (tip of Cape)
- Plymouth (north boundary)  
- Providence, RI (west boundary)

**Purpose:** Know EVERYONE in the restaurant industry in your territory before they know you

### Data Sources to Aggregate
| Category | Sources |
|----------|---------|
| **Government Records** | Town Assessors maps, health dept inspections, liquor licenses, food service permits, zoning records |
| **Business Records** | Secretary of State filings, DBA registrations, ownership transfers, bankruptcy filings |
| **Certifications** | ServSafe, alcohol training, health certifications |
| **Digital Presence** | Websites, social media (FB, Instagram, LinkedIn), Google Business Profile, Yelp |
| **Contact Info** | Phone numbers, emails, physical addresses |
| **Operational Data** | Menus, menu prices, avg check, seating capacity, hours, seasonality patterns |
| **Market Intelligence** | POS system in use, cuisine type, service style, peak periods |
| **Events/News** | Openings, closings, ownership changes, renovations, press coverage |
| **Personnel** | Owners, managers, key staff, career movements |

### Profile Schema (Prospect)
```typescript
interface ProspectProfile {
  // Identity
  id: string;
  business_name: string;
  dba_names: string[];
  address: Address;
  coordinates: [lat, lng];
  
  // Ownership
  owners: Person[];
  ownership_history: OwnershipChange[];
  entity_type: 'sole_prop' | 'llc' | 'corp' | 'partnership';
  
  // Operations
  cuisine_type: string[];
  service_style: 'quick_service' | 'fast_casual' | 'casual' | 'fine_dining';
  seating_capacity: number;
  hours: OperatingHours;
  seasonality: 'year_round' | 'seasonal' | 'summer_only';
  peak_periods: string[];
  
  // Financials (estimated)
  avg_check: number;
  estimated_annual_revenue: number;
  
  // Technology
  current_pos: string; // 'toast' | 'square' | 'clover' | 'unknown' | etc.
  pos_pain_points: string[]; // from reviews, conversations
  
  // Compliance
  health_score: number;
  last_inspection: Date;
  violations: Violation[];
  licenses: License[];
  
  // Digital
  website: string;
  social_profiles: SocialProfile[];
  google_rating: number;
  review_count: number;
  
  // Enrichment Meta
  last_enriched: Date;
  enrichment_sources: string[];
  confidence_score: number;
  
  // Sales Status
  status: 'discovered' | 'researching' | 'qualified' | 'contacted' | 'converted';
  outreach_history: Outreach[];
  notes: Note[];
}
```

### Enrichment Loop
```
Discovery → Initial Profile → Source 1 Enrichment → Source 2 Enrichment → ... → Validate → Score → Prioritize
     ↑                                                                                              │
     └──────────────────────────── Continuous Re-enrichment ────────────────────────────────────────┘
```

---

## System 3: Client Enrichment Researcher

**Location:** Business Brief → Intelligence Panel  
**Scope:** Existing clients, reps, and known contacts ONLY  
**Purpose:** Continuously deepen understanding of people you work with

### Why This Matters
- People leave restaurants, start their own, move to different roles
- Career trajectory tracking → future opportunity detection
- The deeper you know someone, the better you serve them
- Relationship web mapping (who knows who)

### Enrichment Sources
- DATA_CONTEXT Engine (central data lake)
- Client communications (emails, tickets, messages)
- Meeting notes and call logs
- Social media updates
- News/press about their business
- Industry events they attend
- Their own client reviews and feedback

### Profile Schema (Client/Contact)
```typescript
interface ClientProfile extends ProspectProfile {
  // Relationship
  client_since: Date;
  lifetime_value: number;
  support_plan: SupportPlan;
  
  // History
  projects: Project[];
  tickets: Ticket[];
  communications: Communication[];
  
  // Preferences
  communication_style: string;
  preferred_contact_method: string;
  timezone: string;
  availability_patterns: string;
  
  // Business Context
  current_challenges: string[];
  goals: string[];
  success_metrics: string[];
  
  // Relationship Web
  connected_to: RelationshipLink[]; // other clients, reps, industry contacts
  referral_source: string;
  referrals_made: Referral[];
  
  // Career Tracking (for individuals)
  career_history: CareerPosition[];
  current_role: CareerPosition;
  
  // Health
  health_score: number;
  churn_risk: 'low' | 'medium' | 'high';
  last_touchpoint: Date;
}
```

### The Conversion Advantage
When a Prospect converts to a Client:
- Profile is already 80% complete
- No "getting to know you" period
- Immediately add relationship-specific data
- Hit the ground running

---

## System 4: Toast Hub / Restaurant Wrap

**Location:** Admin Portal → Toast Hub  
**Scope:** Content aggregation for SEO/GEO/Authority  
**Purpose:** Make ccrestaurantconsulting.com THE authority that AI systems cite

### Content Sources
| Source | Type | Value |
|--------|------|-------|
| Reddit r/toastPOS | Community Q&A | Real user problems/solutions |
| Client Conversations | First-party | Unique insights no one else has |
| Client Feedback | First-party | Pain points, feature requests |
| Industry Blogs | Third-party | News, updates, analysis |
| Toast Official | Documentation | Reference material |
| Competitor Analysis | Research | Gap identification |

### Workflow
```
Sources → Aggregator → AI Filter/Relevance → Moderation Queue → Edit/Enhance → Publish
                                                                        │
                                                                        ▼
                                                              Website Content
                                                              ├── Articles
                                                              ├── Guides
                                                              ├── FAQ
                                                              ├── Troubleshooting
                                                              └── News
```

### SEO/GEO Goals
- **SEO:** Rank for Toast POS related queries nationally
- **GEO:** Rank for "restaurant consultant near me" in service area
- **AI Citation:** Structure content so LLMs reference/cite it
- **Authority Building:** Become THE source for Toast knowledge

### Content Schema
```typescript
interface ToastHubContent {
  id: string;
  source_type: 'reddit' | 'client' | 'article' | 'internal' | 'documentation';
  source_url?: string;
  source_date: Date;
  
  // Raw
  raw_content: string;
  
  // Processed
  title: string;
  summary: string;
  category: string[];
  tags: string[];
  
  // Moderation
  status: 'pending' | 'approved' | 'rejected' | 'published';
  moderated_by?: string;
  moderation_notes?: string;
  
  // Publishing
  publish_as?: 'article' | 'faq' | 'guide' | 'snippet';
  published_url?: string;
  published_at?: Date;
  
  // Metrics
  views?: number;
  engagement?: number;
}
```

---

## How They Work Together

### Daily Operations Loop
```
Morning:
├── Prospect Researcher runs overnight enrichment batch
├── Client Researcher updates profiles from yesterday's activity
├── Toast Hub aggregates overnight content from sources
└── Business Brief synthesizes all into daily executive view

Throughout Day:
├── Email Engine sends scheduled campaigns
├── New interactions feed into Client profiles
├── New content discovered → queued in Toast Hub
└── Real-time alerts for significant changes (ownership, closings, etc.)

Evening:
├── Prospect Researcher queues next batch of enrichment tasks
├── Client Researcher identifies gaps needing fill
├── Toast Hub content reviewed and scheduled for publish
└── System health checks and data validation
```

### Conversion Flow
```
PROSPECT (Intelligence Researcher)
         │
         │ Qualified + Outreach
         ▼
    EMAIL ENGINE (Nurture)
         │
         │ Responds/Engages
         ▼
    SALES PIPELINE
         │
         │ Closes
         ▼
CLIENT (Client Enrichment Researcher)
         │
         │ Happy Client
         ▼
    REFERRAL → Back to Prospect
```

### Content Authority Flow
```
Client Conversations → Unique Insights → Toast Hub → Published Content → AI Citations → Inbound Leads → Prospects
```

---

## Implementation Priority

### Phase 1: Foundation (Current)
- [x] Basic Intelligence Dashboard structure
- [x] Toast Hub content aggregation
- [ ] Source connectors (Reddit, RSS)
- [ ] Basic enrichment pipeline

### Phase 2: Prospect Intelligence
- [ ] Service area boundary definition
- [ ] Government data connectors
- [ ] Business record scrapers
- [ ] Profile schema implementation
- [ ] Enrichment queue system

### Phase 3: Client Enrichment
- [ ] DATA_CONTEXT integration
- [ ] Communication analysis
- [ ] Relationship mapping
- [ ] Career tracking

### Phase 4: AI Automation
- [ ] Automated enrichment loops
- [ ] AI content filtering
- [ ] Anomaly detection (ownership changes, etc.)
- [ ] Predictive scoring

---

## Success Metrics

| System | KPI | Target |
|--------|-----|--------|
| Prospect Intelligence | Profiles in service area | 500+ restaurants |
| Prospect Intelligence | Profile completeness avg | >70% |
| Client Enrichment | Profile completeness avg | >90% |
| Toast Hub | Published articles/month | 20+ |
| Toast Hub | AI citation rate | Track via analytics |
| Email Engine | Deliverability | >95% |
| Overall | Prospect → Client conversion | >5% |

---

*Last Updated: 2025-01-27*
*Version: 1.0*
