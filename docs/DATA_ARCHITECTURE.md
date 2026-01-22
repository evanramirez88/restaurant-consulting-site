# Unified Data Architecture - R&G Consulting LLC
## Lead → Prospect → Client Data Flow and Storage

**Created:** 2026-01-21
**Purpose:** Define how data flows between systems and where it's stored

---

## CORE PRINCIPLE: LOCAL ENRICHMENT, CLOUD ACCESS

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SEAGATE 20TB (D:\rg_data\)                       │
│                    ═══════════════════════════                      │
│  Master data storage, enrichment, heavy processing                  │
│  - Raw leads, prospects, clients                                    │
│  - Enrichment data from all sources                                 │
│  - Limitless lifelogs via DATA_CONTEXT                              │
│  - SMS, calls, emails, location data                                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Sync/Query
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ADMIN PORTAL (Cloudflare D1)                     │
│                    ═══════════════════════════                      │
│  Operational data, portal-visible, lightweight                      │
│  - Active leads for email campaigns                                 │
│  - Client portal access                                             │
│  - Rep portal access                                                │
│  - Billing/subscriptions                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## DATA LIFECYCLE

### Stage 1: LEAD
**Definition:** A business that MIGHT be a prospect
**Source:** BuiltWith exports, scraped data, purchased lists
**Storage:** Local (D:\rg_data\leads\)
**Portal Storage:** Only when actively working

```
Lead → Validated (is it a restaurant?) → Enriched → Prospect OR Garbage
```

### Stage 2: PROSPECT
**Definition:** A VERIFIED restaurant in target market, not yet a client
**Source:** Validated leads, referrals, discovered businesses
**Storage:** Local (D:\rg_data\prospects\) + D1 (for outreach)
**Intelligence:** Prospect Intelligence Researcher maintains profiles

```
Prospect → Contacted → Qualified → Opportunity → Client OR Lost
```

### Stage 3: CLIENT
**Definition:** Has paid or signed agreement
**Source:** Converted prospects
**Storage:** Local (D:\rg_data\clients\) + D1 (full access)
**Intelligence:** Business Brief Intelligence Researcher maintains profiles

```
Client → Active → Ongoing relationship → Enriched continuously
```

---

## TWO INTELLIGENCE RESEARCHERS

### 1. PROSPECT INTELLIGENCE RESEARCHER
**Scope:** Provincetown → Plymouth → Providence (P2P2P) service area
**Purpose:** Catalog and profile every possible Toast POS merchant for on-site services
**Focus:** Local market intelligence, competitor analysis, opportunity identification

**Data Sources:**
- BuiltWith Toast merchant data (filtered to P2P2P area)
- Google Places / Yelp / TripAdvisor scraping
- Public licensing databases (MA, RI)
- DATA_CONTEXT engine (Limitless lifelogs, location data)
- Manual research and notes

**Output:**
- Validated prospect profiles
- Contact information
- Business characteristics
- Technology stack
- Ownership information
- Best time/method to contact

**Run Frequency:** Daily/Weekly automated enrichment

**Storage:** `D:\rg_data\prospects\intelligence\`

---

### 2. BUSINESS BRIEF INTELLIGENCE RESEARCHER
**Scope:** ALL clients, ALL activity, ALL time
**Purpose:** Master client profile database - know EVERYTHING about every client
**Focus:** Relationship intelligence, service history, communication patterns

**Data Sources:**
- ALL sources from Prospect Researcher PLUS:
- Client portal activity
- Support tickets and resolutions
- Billing and payment history
- SMS texts (via DATA_CONTEXT)
- Call logs (via DATA_CONTEXT)
- Email threads (via DATA_CONTEXT)
- Location data (via DATA_CONTEXT)
- Meeting notes and calendars
- Limitless AI lifelogs (conversations, meetings)

**Output:**
- Complete client profiles
- Relationship timeline
- Communication preferences
- Service usage patterns
- Upsell/cross-sell opportunities
- Risk indicators (churn prediction)
- Automated briefings for the User

**Run Frequency:** Continuous ingestion, real-time updates

**Storage:** `D:\rg_data\clients\intelligence\`

---

## BUSINESS BRIEF

**What It Is:** AI-driven operations center for User (Evan)
**Interface:** Own AI Chat + Dashboard
**Model:** Agnostic (Claude, Gemini, GPT, local models)
**Mode:** Multi-modal (text, voice, images, documents)

**Core Functions:**
1. **Daily Briefings** - What happened, what's coming, what needs attention
2. **Client Intelligence** - Deep profiles on every client
3. **Activity Aggregation** - All touchpoints across all channels
4. **Predictive Insights** - Churn risk, upsell opportunities, scheduling
5. **Operational Alerts** - Unusual activity, missed follow-ups, payment issues

**Data Flow:**
```
DATA_CONTEXT Engine
       │
       ├── Limitless Lifelogs
       ├── SMS/Call/Email
       ├── Location Data
       ├── Calendar/Meetings
       └── Browser/App Activity
       │
       ▼
Business Brief Intelligence Researcher
       │
       ▼
Client Profiles (Master DB on D:\)
       │
       ▼
Business Brief AI Chat Interface
       │
       ▼
Admin Portal (read access for User)
```

---

## LOCAL STORAGE STRUCTURE

```
D:\rg_data\
├── leads\
│   ├── raw\                    # Original BuiltWith exports
│   ├── cleaned\                # Validated restaurant leads
│   ├── garbage\                # Non-restaurant (Tier D)
│   └── review\                 # Needs manual review (Tier C)
│
├── prospects\
│   ├── profiles\               # Individual prospect JSON files
│   ├── intelligence\           # Enrichment data, research notes
│   ├── p2p2p_area\             # Local service area prospects
│   └── national\               # National remote prospects
│
├── clients\
│   ├── profiles\               # Individual client JSON files
│   ├── intelligence\           # All client intelligence data
│   ├── documents\              # Contracts, SOWs, invoices
│   ├── communications\         # SMS, email, call transcripts
│   └── activity\               # Service history, tickets, work
│
├── data_context\
│   ├── limitless\              # Lifelog imports
│   ├── sms\                    # Text message exports
│   ├── calls\                  # Call logs and transcripts
│   ├── emails\                 # Email archives
│   └── location\               # Location history
│
├── business_brief\
│   ├── briefings\              # Generated daily/weekly briefings
│   ├── alerts\                 # Automated alerts
│   ├── chat_history\           # AI chat conversations
│   └── models\                 # Local model configs
│
└── sync\
    ├── d1_export\              # Data exported to Cloudflare
    ├── d1_import\              # Data imported from Cloudflare
    └── sync_logs\              # Sync operation logs
```

---

## SYSTEMS THAT USE THIS DATA

| System | Data Needed | Access Pattern |
|--------|-------------|----------------|
| **Email Engine** | Active leads/prospects with email | Read from D1, batch sends |
| **Prospect Intelligence** | P2P2P area businesses | Read/Write local, sync summaries to D1 |
| **Client Profiles** | Full client data | Read/Write local + D1 |
| **Prospect Profiles** | Prospect data | Read/Write local + D1 |
| **Business Brief** | EVERYTHING | Read from all local sources |
| **Toast Hub** | Client Toast configurations | Read/Write D1 |
| **Admin Portal** | Operational subset | Read/Write D1 |
| **Client Portal** | Client's own data | Read D1 (filtered) |
| **Rep Portal** | Rep's assigned data | Read D1 (filtered) |

---

## DATA SYNC STRATEGY

### Local → D1 (Upload)
**Trigger:** Manual or scheduled
**What:** Active leads, prospects, clients needed for portal operations
**Volume:** Hundreds to thousands of records

### D1 → Local (Download)
**Trigger:** Portal activity, form submissions, billing events
**What:** New contacts, updated client info, activity logs
**Volume:** Real-time events, small batches

### Conflict Resolution
- **Client data:** D1 wins (portal is source of truth for client interactions)
- **Lead data:** Local wins (enrichment happens locally)
- **Activity data:** Merge (both sources valid)

---

## IMPLEMENTATION PHASES

### Phase 1: Foundation (Now)
- [x] Create local storage structure on D:\
- [ ] Import 100 leads to D1 for email testing
- [ ] Set up basic sync scripts

### Phase 2: Prospect Intelligence
- [ ] Build P2P2P area prospect database
- [ ] Implement automated enrichment
- [ ] Connect to DATA_CONTEXT engine

### Phase 3: Business Brief Core
- [ ] Set up AI chat interface
- [ ] Implement daily briefing generation
- [ ] Connect to client data

### Phase 4: Full Integration
- [ ] Connect all systems
- [ ] Implement real-time sync
- [ ] Build alert and notification system

---

## RELATED DOCUMENTS

- `LEAD_STRATEGY_AND_SEGMENTATION.md` - Lead tiers and national/local strategy
- `INTERNAL_TOOLS_ARCHITECTURE.md` - Email engine and tool details
- `MASTER_EXECUTION_PLAN.md` - Overall business execution
- `~/.claude/refs/NETWORK_CONFIG.md` - SageNode network details

---

**This document is the source of truth for data architecture. All systems must conform to this structure.**
