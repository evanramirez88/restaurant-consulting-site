# THE R&G BUSINESS PLATFORM - CANONICAL ARCHITECTURE
## Restaurant Business Operating System - "Mission Control"

**This is the master architecture document. All development follows this structure.**

---

## CORE OBJECTIVE

A Next.js/React Admin Portal that orchestrates three distinct workflows (pillars).

---

## PILLAR A: SALES (The Growth Engine)

### Intelligence Researcher
- Scrapes/ingests leads via Context Engine
- Catalogs every Toast POS merchant in P-P-P service area (local)
- Enriches with floor plans, assessor records, liquor licenses, menus, hours
- Uses DATA_CONTEXT as external API (black box)

### Email Engine
- Automated outreach sequences (Sequenzy clone logic)
- Ongoing communication and automated check-ins
- Systemized and automated client flows
- National push: BuiltWith clean leads → remote-only clients

### Quote Builder
- Proprietary pricing algorithms (Device Complexity Index)
- Hook for new clients, POS switchers, transition accounts
- **IS the Support Plan**: Quote = Support Plan pricing. Stays in Client Portal.
- Clients update their support plan by modifying their Quote Builder in their portal
- **Classification tool**: Slots restaurants into specific configurations
- Key insight: Two similar bars (speakeasy vs club) need COMPLETELY different Toast configs despite same traditional business variables (product, size, location)
- Short service vs counter service = different configs
- Floor plans + public records help discern configuration needs

### Toast Hub
- Content marketing/SEO aggregation feed
- Sources: client data, support calls, training transcripts, emails, Toast Central, Toast Classroom, blogs, articles, reddit.com/r/toastpos
- Reddit strategy: Pull content, post solutions, respond to issues, guerrilla marketing back to Toast Hub
- Eventually: Social media AI/bot across Reddit, X, Instagram, Discord, subreddit
- AI generates: info sheets, infographics, posts, articles, SOPs, templates, images, instructions
- ALL content requires HUMAN REVIEW before posting
- Creates backlog/library for scheduled posting
- Goal: Drive engagement, traffic to site, force website into AI search/chat results

### Menu Builder
- Hook for new clients, POS switchers, transition accounts
- Production tool for digitizing PDF menus
- Stays in Client Portal → relates to Client Profile and account management
- **Classification tool**: Same logic as Quote Builder for restaurant classification
- Available to: me, clients, reps (from their respective portals)

---

## PILLAR B: PRODUCTION (The Delivery Engine)

### Ticketing System (Internal)
- Internal task tracking for work being done
- Tasks, deadlines, client work items

### Menu Builder (Production Mode)
- The production tool for digitizing PDF menus into Toast-ready format

### Toast ABO (Automation Agent)
- Puppeteer/PyAutoGUI/Selenium automation
- Pushes configuration to Toast POS systems
- **NO OFFICIAL TOAST API** - all browser automation
- Remote/online installation, configuration, support, maintenance, audits

---

## PILLAR C: OPERATIONS (The Management Engine)

### Ticketing System (Client-Facing)
- Client-facing support tickets
- Reps can create tickets clients don't see (internal notes about clients)
- Reps can submit leads, intelligence, source info via tickets

### Admin Portal
- My view of everything (all three pillars)
- Central command for all business operations

### Business Brief
- Daily AI digest of business state
- Model-agnostic, multi-modal, configurable
- Sources: SMS, calls, LimitlessAI, calendars, location, emails
- Up-to-the-moment dashboard across all clients/reps/activity

### Client/Rep Portals
- External views for stakeholders
- Client portal: Quote Builder, Menu Builder, shared Drive folder, support tickets
- Rep portal: Lead submission, ticket creation, client management

---

## THE "BLACK BOX" INTEGRATION

The Data Context Engine (ANTIGRAVITY/SAGE project) is an EXTERNAL API:

- **DO NOT TOUCH** internal code
- **TREAT AS EXTERNAL API** - read only
- We fetch from it, we do not modify its core logic
- Location: `C:\Users\evanr\Desktop\ANTIGRAVITY\DATA_CONTEXT`

---

## DATA GOVERNANCE: THE "GATEKEEPER"

A Connector Module fetches data from the Context Engine with strict filtering:

```
IF data_tag == 'business' OR 'restaurant' OR 'lead' -> IMPORT
IF data_tag == 'personal' -> DISCARD
```

- Filter logic lives in the API route/middleware of The Platform
- Personal data NEVER enters the business database
- This is the data boundary enforcement layer

---

## TECH STACK

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js / React |
| Automation | Puppeteer (primary), Playwright/Selenium/PyAutoGUI (fallback) |
| Database | Cloudflare D1 (current), Supabase/PostgreSQL (future) |
| Orchestration | n8n, AI Agents, Python scripts |
| Email | Resend API (free tier: 100/day during testing) |
| Payments | Stripe (subscriptions) + Square (one-time) |
| Hosting | Cloudflare Pages + Workers |

---

## KEY ARCHITECTURAL PRINCIPLES

1. **Quote Builder = Support Plan**: Not just a calculator. It IS the plan. Lives in client portal.
2. **Classification Logic**: Restaurant type (speakeasy vs club vs counter service) determines entire Toast config, not just traditional business variables.
3. **Intelligence feeds Classification**: Floor plans, public records, menu analysis → proper restaurant classification → proper Toast configuration.
4. **Content requires Human Review**: Toast Hub generates content but NEVER auto-posts.
5. **Black Box Context Engine**: Read-only external API with gatekeeper filter.
6. **Dual-Purpose Tools**: Quote Builder, Menu Builder, Ticketing all serve multiple pillars.

---

Last Updated: 2026-01-22
