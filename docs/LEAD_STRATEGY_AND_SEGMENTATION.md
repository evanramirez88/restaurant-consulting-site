# Lead Strategy & Segmentation
## R&G Consulting LLC - Email Outreach & Data Architecture

---

## TWO PUSHES

### 1. NATIONAL PUSH (Active Now - Remote Only)
- Source: BuiltWith leads (cleaned)
- Service model: Remote-only / remote-predominant
- Segments target different restaurant situations (see below)
- Goal: Sell Toast support, menu audits, POS switching assistance, referral bonuses

### 2. LOCAL PUSH (Future - On-Site + Remote)
- Service area: Provincetown → Plymouth → Providence, RI
- Marketing for: Toast POS (on-site + remote) AND networking/cabling services
- Data source: Intelligence Researcher (local prospect profiles)
- Status: NOT active yet. Digital push coming soon.

---

## NATIONAL LEAD SEGMENTS

| Segment | Description | Angle | Sequence |
|---------|-------------|-------|----------|
| **POS Switchers (Clover)** | Restaurants on Clover considering switch | Pain points of current POS → Toast benefits | seq_pos_switcher_001 |
| **POS Switchers (Square)** | Restaurants on Square | Same angle, Square-specific pain | seq_pos_switcher_001 |
| **POS Switchers (Upserve)** | Restaurants on Upserve | Upserve end-of-life / limitations | seq_pos_switcher_001 |
| **Toast Existing** | Already on Toast, need support | Menu audit, optimization, ongoing support | seq_toast_support_001 |
| **Toast Upcoming** | Signed with Toast, not yet live | Implementation help, smooth transition | seq_toast_support_001 |
| **High Value** | High-score leads (any POS) | Personalized, high-touch outreach | Multiple sequences |
| **Contactable** | Has valid email, any segment | General awareness / intro | Multiple sequences |

---

## SEGMENT ANGLES (Why Different Restaurants, Different Pitches)

1. **Switching POS**: Restaurant has inferior POS → sell them on Toast + get referral bonus. Biggest hurdle = fear of transfer complexity. If confident I can handle it, they switch.

2. **New Restaurant**: Starting up, wants Toast → implementation services.

3. **Ownership Change**: Restaurant changing hands, keeping Toast → transfer handling.

4. **Existing Toast - Support**: Already has Toast, needs help → support plans, troubleshooting.

5. **Existing Toast - Menu Work**: Has Toast but menu is messy → menu audit, rebuild, optimization. Many don't know they need this.

6. **Referral Bonus Play**: Inferior POS (Clover, Square, etc.) → help switch to Toast → earn Toast referral bonus for each switch.

---

## DATA TIERS

| Tier | Count (Jan 2026) | Description | Action |
|------|-------------------|-------------|--------|
| **A+B (Clean)** | 3,437 | Verified restaurants with valid contact info | ACTIVE - import & sequence |
| **C (Review)** | 24,237 | Might be restaurants, needs manual verification | HOLD - review later |
| **D (Non-Restaurant)** | 27,431 | Not restaurants (shoe stores, tech cos, colleges) | ARCHIVE - never send |
| **Blacklist** | 21,241 | Known bad data (duplicates, invalid, spam traps) | BLOCK - validate against |

---

## CLEANED SEGMENT FILES

Location: `G:\My Drive\RG OPS\70_LEADS\CLEANED_SEGMENTS\`

| File | Records | Segment |
|------|---------|---------|
| CLEAN_ALL_LEADS_MASTER_2026-01-22.csv | 3,437 | All clean leads combined |
| CLEAN_seg_toast_existing_2026-01-22.csv | 2,587 | Toast Existing |
| CLEAN_seg_switcher_clover_2026-01-22.csv | 455 | Clover Switchers |
| CLEAN_seg_contactable_2026-01-22.csv | 413 | Has valid email |
| CLEAN_seg_high_value_2026-01-22.csv | 401 | High lead score |
| CLEAN_seg_toast_upcoming_2026-01-22.csv | 317 | Toast Upcoming |
| CLEAN_seg_switcher_upserve_2026-01-22.csv | 50 | Upserve Switchers |
| CLEAN_seg_local_ma_2026-01-22.csv | 29 | Massachusetts Local |
| CLEAN_seg_switcher_square_2026-01-22.csv | 28 | Square Switchers |
| CLEAN_seg_local_capecod_2026-01-22.csv | 3 | Cape Cod Local |

---

## GARBAGE DATA STRATEGY

The garbage data (Tier C + D) serves two purposes:

1. **Validation Blacklist**: Known-bad data to check against. When importing new leads, cross-reference against this to avoid re-importing garbage.

2. **Future Segments**: Some of these might have reps, vendors, or adjacent businesses that could be useful for different campaigns later (e.g., restaurant suppliers, food distributors).

Storage: `G:\My Drive\RG OPS\70_LEADS\TIER_CD_FUTURE\`

---

## TESTING PHASE RULES

- **Resend Plan**: FREE tier (100 emails/day max)
- **Import Limit**: 100 leads at a time for testing
- **Purpose**: Manually track, observe, and validate each batch
- **When done testing**: Upgrade Resend plan, increase daily cap

---

## CRITICAL: NATIONAL vs LOCAL BOUNDARY

**THIS IS THE MOST IMPORTANT DISTINCTION IN THE ENTIRE SYSTEM:**

| | NATIONAL PUSH | LOCAL PUSH |
|--|---------------|------------|
| **Status** | ACTIVE NOW | NOT YET - FUTURE |
| **Service Model** | Remote-only / remote-predominant | On-site + remote |
| **Data Source** | BuiltWith clean leads (CLEANED_SEGMENTS) | Intelligence Researcher (local prospect profiles) |
| **Outreach** | Email sequences via Resend | NOT email yet - digital push TBD |
| **Geography** | US-wide | Provincetown → Plymouth → Providence, RI (P-P-P) |
| **Services Marketed** | Toast support, menu audits, POS switching | Toast POS (on-site + remote) + networking/cabling |
| **Lead Storage** | D1: email_subscribers + subscriber_sequences | D1: restaurant_leads (seed_import, manual_discovery sources) |

**RULES:**
- Local leads (Intelligence Researcher data) are NEVER for email outreach
- Local leads are for prospect profiling and on-site preparation ONLY
- The email engine uses ONLY the national cleaned segments
- When the local digital push starts, it will be a SEPARATE campaign with different angles

---

## DATA FLOW ACROSS SYSTEMS

The same lead/contact/prospect/client data flows through:

| System | Role | Storage | Scope |
|--------|------|---------|-------|
| **Email Engine** | Outreach sequences, delivery | D1 (email_subscribers, email_logs) | NATIONAL only |
| **Intelligence Researcher** | Local area prospect profiling | D1 (restaurant_leads) + Local SQLite | LOCAL P-P-P only |
| **Client Profiles** | Active client records | D1 (clients table) | All clients |
| **Prospect Profiles** | Pre-client records | D1 (restaurant_leads) | Both |
| **Business Brief** | AI-driven ops center, daily dashboard | D1 + DATA_CONTEXT | All business |
| **Toast Hub** (future) | Toast-specific client management | D1 | All Toast clients |
| **DATA_CONTEXT** | Enrichment from lifelogs, emails, etc. | Seagate 20TB local | All data |

**Key Principle**: Data can be STORED locally (Seagate) for enrichment, but must be AVAILABLE on the Admin Portal at all times.

---

## INTELLIGENCE RESEARCHER (LOCAL ONLY)

- Scope: ONLY the P-P-P service area (Provincetown → Plymouth → Providence, RI)
- Purpose: Catalog and profile every possible Toast POS merchant in service area
- Enriches/validates prospect profiles with each regular run
- Uses DATA_CONTEXT engine (LimitlessAI lifelogs, personal data) for enrichment
- NOT for email outreach. NOT for national push. NOT for sending emails.
- Needs: Floor plans, assessor records, liquor license info, menus, hours, volume, cuisine, service style, financial analysis
- Data sources: Google Maps, Yelp, County health, Board of Assessors, town registry
- Goal: Eventually have full profile on every hospitality/F&B business in service area, constantly updating

---

## BUSINESS BRIEF

- AI-driven (model-agnostic, multi-modal) operations center for business owner
- Has its own AI Chat interface (prototype: millstone-intelligence.zip from Google AI Studio)
- Has its own Intelligence Researcher (DIFFERENT from the main one - this is for ALL clients)
- Daily up-to-the-moment dashboard: what's happening, what needs to be done, across all clients/reps/activity
- Data sources: SMS, calls, LimitlessAI lifelogs (via DATA_CONTEXT), calendars, location data, emails
- Master Client profile database and enrichment system
- Configurable in admin portal settings
- Stores conversation/task/transcript history for every respective client
- Uses business data to analyze, automate, and systemize workflows

---

## CLIENT SERVICE PIPELINE

1. **Menu Intake**: Clients send menus (email, Google Drive upload, client portal) → feeds Menu Builder and/or Quote Builder
2. **Client Portal**: Each client gets a shared Google Drive folder with subfolders
3. **Toast ABO**: Worker/technician tool for ongoing remote/online support, maintenance, audits of installations/configurations
4. **Quote Builder + Menu Builder**: Proprietary tools that both attract new clients AND serve existing ones
5. **Automation Goal**: Analyze how work is done → create systemized automated workflows from patterns

---

## GOOGLE ACCOUNTS

| Account | Category | Primary Use |
|---------|----------|-------------|
| ramirezconsulting.rg@gmail.com | BUSINESS | Primary business email, HubSpot, platform |
| evanramirez88@gmail.com | PERSONAL | Personal, some business overlap |
| evan@ccrestaurantconsulting.com | BUSINESS | Client-facing domain email |
| capecodcablecontractors@gmail.com | BUSINESS | Cable/networking services (primary now) |
| capecodrestaurantconsulting@gmail.com | BUSINESS | Alternate to evan@ (future) |
| thewanderingardener@gmail.com | SIDE | Minor side hustle (future) |
| millstonecompound@gmail.com | PERSONAL | Smart home/household (future) |

**Integration**: All accounts → DATA_CONTEXT engine → parsed into client DBs + master business DB → available on Admin Portal

---

## OUTREACH PRIORITY ORDER

1. Toast Upcoming (317) - Highest conversion probability
2. High Value (401) - Best revenue potential
3. Contactable (413) - Valid emails, ready to send
4. Clover Switchers (455) - Referral bonus opportunity
5. Toast Existing (2,587) - Support plan upsell
6. Local MA (29) - Future on-site push prep (NOT for email yet)

---

## CAMPAIGN MANIFEST (Jan 17, 2026)

Location: `G:\My Drive\RG OPS\70_LEADS\CAMPAIGN_BATCHES\campaign_2026-01-17\MANIFEST.json`

**Batch Size**: 500 per file
**Segments Batched**: A (Clover, Contactable, High Value, Lightspeed, Square, Upserve), B (Contactable, High Value, Toast Existing), D (Cape Cod, Contactable, SE MA, South Shore)

**Campaign Angles**:
- Segment A: "The Outage Insurance" → seq_pos_switcher_001
- Segment B: "The 7-Minute Menu Teardown" → seq_toast_support_001
- Segment D: "I build for kitchens" → seq_local_network_001

---

## CURRENT STATE (Jan 22, 2026)

| Table | Count | Source | Purpose |
|-------|-------|--------|---------|
| restaurant_leads (national) | 77 | builtwith_clean | Email outreach |
| restaurant_leads (local) | 161 | seed_import + manual_discovery | Intelligence Researcher profiling ONLY |
| email_subscribers | 77 | From national leads | Active sequence recipients |
| subscriber_sequences | 77 | All active | Staggered 15 min apart |
| email_logs | 0 | Fresh start | Clean slate after garbage purge |

**Sequence Distribution:**
- seq_pos_switcher_001: 50 (High Value segment)
- seq_toast_support_001: 27 (Toast Upcoming segment, 23 deduped)

---

Last Updated: 2026-01-22
