# Master Execution Plan - R&G Consulting LLC
## Comprehensive Integration of All Business Initiatives

**Created:** 2026-01-07
**Target:** $400,000 Revenue by May 1, 2026 (116 days)
**Weekly Target:** $23,529/week
**Source Documents:** 10 BUSINESS_TO_DO files integrated

---

## EXECUTIVE SUMMARY

This plan consolidates all business planning documents into a single executable roadmap. The strategy follows four parallel tracks:

| Track | Focus | Revenue Impact | Timeline |
|-------|-------|----------------|----------|
| **Track A** | Email Automation + Lead Processing | $315K-$410K potential | Weeks 1-18 |
| **Track B** | Website Features + Admin Portal | Enables all tracks | Weeks 1-8 |
| **Track C** | AI Phone + Toast Automation | $50K-$100K efficiency | Weeks 3-12 |
| **Track D** | AI Search (GEO) + Visibility | Long-term growth | Ongoing |

---

## PHASE 0: FOUNDATION (COMPLETED)

### Days 1-5 Email Admin UI - COMPLETE

| Day | Focus | Status |
|-----|-------|--------|
| Day 1 | Campaign Dashboard + Subscribers | COMPLETE |
| Day 2 | Advanced Features + Segments | COMPLETE |
| Day 3 | A/B Testing + Enrollment | COMPLETE |
| Day 4 | PDF Processing + Polish | COMPLETE |
| Day 5 | Security + Documentation + Deploy | COMPLETE |

**Deliverables:**
- CORS vulnerability fixed
- Rate limiting implemented
- OpenAPI documentation created
- Admin user guide created
- All security changes deployed

---

## PHASE 1: EMAIL INFRASTRUCTURE (Weeks 1-3)

### 1.1 Database Migration

**File:** `migrations/0005_email_automation.sql`

Create tables:
- `email_sequences` - Campaign definitions
- `sequence_steps` - Individual emails in drip
- `email_subscribers` - 42,967 leads storage
- `subscriber_sequences` - Position tracking
- `email_logs` - Delivery tracking

**Priority indexes:**
```sql
CREATE INDEX idx_subscriber_sequences_due ON subscriber_sequences(next_execution_time, status);
CREATE INDEX idx_email_subscribers_pos ON email_subscribers(pos_system);
CREATE INDEX idx_email_subscribers_geo ON email_subscribers(geographic_tier);
```

### 1.2 Cron Worker Setup

**Files to create:**
- `functions/api/_scheduled/email-dispatcher.ts` - Query due emails, personalize, queue
- `functions/api/_queue/email-consumer.ts` - Rate-limited Resend dispatch
- `functions/api/webhooks/resend.ts` - Delivery event handling

**Wrangler.toml additions:**
```toml
[triggers]
crons = ["*/5 * * * *"]

[[queues.producers]]
queue = "rg-email-dispatch"
binding = "EMAIL_QUEUE"

[[queues.consumers]]
queue = "rg-email-dispatch"
max_batch_size = 2
```

### 1.3 Lead Scoring System

**100-point priority matrix:**

| Factor | Points | Scoring |
|--------|--------|---------|
| **POS System** | 40 | Toast=40, Clover/Square=25, Other=15 |
| **Geography** | 30 | Cape Cod=30, MA=20, New England=15, National=10 |
| **Tech Signals** | 30 | Integrations, online ordering, loyalty |

**Tier assignment:**
- Tier 1 Hot (80-100 points): ~4,000 leads
- Tier 2 Warm (60-79 points): ~10,000 leads
- Tier 3 Nurture (40-59 points): ~17,000 leads
- Tier 4 Long-tail (<40 points): ~12,000 leads

### 1.4 Domain Warming (Weeks 1-6)

**CRITICAL:** Never cold email from ccrestaurantconsulting.com

**Purchase 3-5 secondary domains:**
- rgconsulting.email
- toastconsulting.net
- rgrestaurant.email

**Warmup schedule:**
| Week | Daily Volume/Inbox | Total (10 inboxes) |
|------|-------------------|-------------------|
| 1-2 | 10 | 100 |
| 3-4 | 20 | 200 |
| 5-6 | 35 | 350 |
| 7+ | 50 (max) | 500 |

---

## PHASE 2: WEBSITE FEATURES (Weeks 2-6)

### 2.1 Quote Builder Enhancements

From `website-enhancements2.txt`:

**PDF Import parsing improvements:**
- Parse bundled hardware lines (e.g., "Toast Flex + Tap + Printer + Cash Drawer 5")
- Split into individual items with grouping metadata
- Auto-group on import to Quote Builder grid

**Grid improvements:**
- Remove invisible wall boundaries (infinite canvas)
- Implement proper scale with visual indicators
- Enable editing of imported data (restaurant name, etc.)
- Allow removal of default networking closet

### 2.2 Toast Auto-Back-Office (Toast ABO)

**IMPORTANT CLARIFICATION:** This is NOT Toast API integration.

Toast ABO = Puppeteer/Playwright automation that:
1. Logs into Toast back-office as consultant
2. Navigates to specific client's portal
3. Performs data entry from Menu Builder output
4. Handles ongoing maintenance and audits

**Architecture:**
```
Menu Builder → Parsed Data → Toast ABO Agent → Toast Back-Office Portal
```

**Implementation Status (2026-01-07):**

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Restaurant Classification Engine | ✅ COMPLETE |
| Phase 2 | Menu Builder Integration | ✅ COMPLETE |
| Phase 3 | Toast Navigation Scripts | ⏳ PENDING |
| Phase 4 | Observer AI / Self-Healing | ⏳ PENDING |
| Phase 5 | Support Ticket Integration | ⏳ PENDING |

**Phase 1 Deliverables (COMPLETE):**
- `toast_config_templates` table with 8 templates seeded
- `modifier_rules` table with 9 cocktail/food rules seeded
- `restaurant_classifications` table for AI results
- Classification API endpoint
- Admin UI for viewing classifications

**Phase 2 Deliverables (COMPLETE):**
- "Deploy to Toast" button in Menu Builder
- DeployToToastModal component with full workflow
- Modifier rule application and preview
- Automation job creation API

**Restaurant classification for config:**
- Cuisine type
- Service style (counter vs full-service)
- Business model (cafe, speakeasy, nightclub, etc.)
- Operating hours
- Location/surroundings

### 2.3 Admin Portal Enhancements

**Three portal views needed:**

| Portal | Purpose | Features |
|--------|---------|----------|
| **Admin** | Full data access | All clients, all reps, all data |
| **Rep Portal** | Sales rep view | Assigned clients only |
| **Client Portal** | Client self-service | Their data, progress, communication |

**Demo setup:**
- Add Evan as first client AND first rep
- Test all views with real data
- Back-office toggle for admin control

### 2.4 Menu Builder Multi-Page PDF

From Day 4 - already implemented:
- Client-side PDF text extraction via `unpdf`
- Text sent to `/api/menu/parse-text` for AI parsing
- Pattern matching fallback

---

## PHASE 3: EMAIL CAMPAIGN WAVES (Weeks 2-18)

### Wave 1: Warm Leads (Weeks 1-3)
- 25 existing clients for referrals
- 50-100 past inquiries
- **Expected:** 25-40% reply, 10-15% conversion
- **Revenue:** $15,000-$25,000

### Wave 2: Toast Users (Weeks 3-8)
- ~10,000-15,000 Toast users from BuiltWith
- Support plan upsell sequence (5 emails/21 days)
- **Expected:** 5-8% reply, 1-2% conversion
- **Revenue:** $60,000-$120,000

### Wave 3: Conversion Targets (Weeks 6-12)
- ~15,000-20,000 Clover/Square users
- Migration value proposition
- $1,000 referral incentive
- **Revenue:** $50,000-$100,000

### Wave 4: Cold Outreach (Weeks 8-18)
- Remaining database
- Remote Menu Work entry offer ($800-$1,500)
- **Revenue:** $100,000-$180,000

**Email Sequence Templates to Build:**

| Sequence | Emails | Days | Target |
|----------|--------|------|--------|
| Toast Support Plan | 5 | 21 | Toast users |
| Toast Referral | 4 | 14 | All contacts |
| Remote Menu Work | 4 | 10 | National leads |
| POS Conversion | 5 | 21 | Clover/Square users |
| Booking Confirmation | 3 | 1 | Cal.com bookings |
| Post-Meeting Follow-up | 3 | 7 | After meetings |
| No-Show Re-engagement | 2 | 2 | Missed appointments |

---

## PHASE 4: AI PHONE SYSTEM (Weeks 4-12)

### 4.1 Start with Retell.ai (Week 4-6)

**Cost:** $0.07-0.15/min
**Features:** 620ms latency, Cal.com integration, SOC 2 compliant

**Initial setup:**
1. Sign up for free tier ($10 credits)
2. Configure basic receptionist with FAQ
3. Test Twilio integration
4. Validate call quality

### 4.2 Integration Architecture (Weeks 6-8)

```
Incoming Call → Retell.ai → Webhook → n8n Workflow
                                    ↓
                            Intent Classification
                                    ↓
                    ┌───────────────┼───────────────┐
                    ↓               ↓               ↓
                Booking         Support         Inquiry
                    ↓               ↓               ↓
            Acuity/Cal.com    HubSpot Ticket  HubSpot Contact
                    ↓               ↓               ↓
                SMS Confirm    Team Notify    Lead Nurture
```

### 4.3 Self-Hosting Migration (Weeks 9-12)

**Stack:** Pipecat + Deepgram + GPT-4o-mini + Piper TTS

**Cost reduction:** $0.09-0.15/min → $0.03/min

**Docker setup on Windows PC:**
- Enable Docker auto-start
- Configure watchdog for recovery
- Use ngrok for Twilio webhooks

### 4.4 Restaurant-Specific Patterns

**Call classification:**
```javascript
- Emergency: "down", "broken", "not working" → Transfer to human
- Support: "toast", "pos", "menu" → AI support
- Sales: "pricing", "demo", "interested" → AI qualify
```

**AI prompt context:**
- Toast POS troubleshooting guides
- Pricing and service packages
- Client onboarding process
- FAQ about consulting services

---

## PHASE 5: AI SEARCH OPTIMIZATION (GEO) (Ongoing)

### 5.1 Content Structure for AI Citation

**Optimal format:**
- H2 sections: 300-800 words per major topic
- H3 sections: 100-200 words for breakdowns
- Question-format headings
- First 40-60 words = direct answer
- 1 statistic per 150-200 words

**Target improvement:** 40% visibility boost

### 5.2 Schema Markup (Server-Side)

**Priority schema types:**
- Article/BlogPosting for all content
- FAQPage for FAQ sections
- HowTo for step-by-step guides
- LocalBusiness for location content
- Organization with credentials

**CRITICAL:** AI crawlers cannot execute JavaScript. Server-side rendering required.

### 5.3 AI Crawler Configuration

**robots.txt additions:**
```
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /
```

### 5.4 Monitoring Setup

**Tools:**
- Otterly.AI ($29/month) - AI visibility tracking
- GA4 custom channel for AI referrals
- Server log analysis for crawler activity

**GA4 regex filter:**
```regex
chatgpt\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com
```

---

## PHASE 6: EMAIL INFRASTRUCTURE MIGRATION (Weeks 6-14)

### 6.1 Google Workspace Dual-Domain

**Architecture:** User alias domain (no extra cost)
- Primary: evan@ccrestaurantconsulting.com
- Alias: evan@capecodrestaurantconsulting.com

**Both deliver to same inbox, can send as either.**

### 6.2 DNS Configuration

**Combined SPF record:**
```
v=spf1 include:_spf.google.com include:XXXXXX.spf03.hubspotemail.net include:resend.com ~all
```

**DKIM:** Separate keys for both domains + HubSpot + Resend

**DMARC:** Start with `p=none`, progress to `p=reject`

### 6.3 Migration Timeline

| Days | Action |
|------|--------|
| 1-3 | DNS foundation |
| 3-5 | Google Workspace activation |
| 5-7 | Forwarding from old Gmail |
| 7-28 | Domain warming |
| 14 | Cal.com migration |
| 18 | HubSpot migration |
| 21 | Resend configuration |
| 28+ | Square migration (LAST) |

---

## PHASE 7: AI MODEL ROUTING (Immediate)

### 7.1 Sunk Cost Vampire Strategy

**Current subscriptions:** $140-240/month
- Claude Max: $100-200
- ChatGPT Plus: $20
- Gemini Advanced: $20

**Strategy:** Drain web interfaces first, then cheap API, then premium.

### 7.2 Role-Based Routing

| Role | Primary | Fallback |
|------|---------|----------|
| Architect | Claude Web → Claude Sonnet 4.5 | GPT-5.2 |
| Engineer | DeepSeek V3.2 ($0.28/M) | Claude Haiku 4.5 |
| Researcher | Gemini Deep Research | ChatGPT Deep Research |
| Speed | Groq Llama 4 Scout | Qwen3-32B |
| Context | Gemini 2.5 Flash Lite (1M) | Llama 4 Maverick |

### 7.3 Web Interface Priorities

**Gemini Advanced (drain first):**
- Deep Research for market analysis
- Workspace integration (Gmail, Drive, Calendar)
- NotebookLM for podcast summaries

**Claude Max:**
- Projects feature with client files
- MCP connectors (HubSpot, Square)
- Memory across sessions

**ChatGPT Plus:**
- Deep Research (25 queries/month)
- DALL-E 3 for marketing materials

---

## WEEKLY EXECUTION SCHEDULE

### Week 1
- [ ] Apply email automation migration (0005)
- [ ] Set up cron worker infrastructure
- [ ] Begin domain warming (secondary domains)
- [ ] Start lead scoring script

### Week 2
- [ ] Build email sequence templates
- [ ] Import Tier 1 leads (4,000)
- [ ] Quote Builder PDF improvements
- [ ] Begin GEO content optimization

### Week 3
- [ ] Launch Wave 1 (warm leads)
- [ ] Toast ABO architecture design
- [ ] Admin portal enhancements begin
- [ ] AI phone research/Retell signup

### Week 4
- [ ] Wave 2 begins (Toast users)
- [ ] Retell.ai basic setup
- [ ] HubSpot workflow automation
- [ ] Schema markup implementation

### Weeks 5-6
- [ ] AI phone integration (n8n workflows)
- [ ] Email Google Workspace migration
- [ ] Rep/Client portal development
- [ ] Cal.com webhook integration

### Weeks 7-8
- [ ] Wave 3 begins (conversion targets)
- [ ] AI phone self-hosting preparation
- [ ] Toast ABO MVP development
- [ ] Full portal system testing

### Weeks 9-12
- [ ] AI phone self-hosting migration
- [ ] Wave 4 begins (cold outreach)
- [ ] Square migration (email)
- [ ] Analytics dashboard refinement

### Weeks 13-18
- [ ] Full email campaign execution
- [ ] System optimization
- [ ] Revenue target tracking
- [ ] Q2 planning

---

## SUCCESS METRICS

### Revenue Milestones

| Date | Target | Cumulative |
|------|--------|------------|
| Week 4 | $25,000 | $25,000 |
| Week 8 | $60,000 | $85,000 |
| Week 12 | $90,000 | $175,000 |
| Week 16 | $110,000 | $285,000 |
| May 1 | $115,000 | $400,000 |

### System Metrics

| Metric | Target |
|--------|--------|
| Email deliverability | >95% |
| Open rate | >30% |
| Reply rate | >5% |
| AI phone handle rate | >70% |
| Lead-to-meeting conversion | >8% |

---

## CRITICAL PATH ITEMS

1. **Email infrastructure MUST be live by Week 2** - Blocks all revenue
2. **Domain warming MUST start Week 1** - 4-6 weeks to full capacity
3. **Retell.ai setup by Week 4** - Enables 24/7 lead capture
4. **Square migration LAST** - Protects invoice deliverability

---

## DOCUMENT REFERENCES

| Document | Key Content |
|----------|-------------|
| 400K_BREAKOUT_REPORT | Revenue targets, weekly milestones |
| Toast Back-Office Automation | Puppeteer automation architecture |
| AI Search Optimization (GEO) | Content structure, schema markup |
| Complete Email Marketing | Sequences, infrastructure, waves |
| AI Phone Secretary | Retell.ai, self-hosting, integrations |
| Implementation Blueprint | Local networking page copy |
| Website Enhancements 2 | Quote Builder, Toast ABO, portals |
| Email Infrastructure Migration | Google Workspace, DNS setup |
| AI Model Routing | Cost optimization, LiteLLM config |

---

**Plan Created:** 2026-01-07
**Last Updated:** 2026-01-07 23:30 EST
**Status:** ACTIVE - Phase 0 Complete, Phase 2 (Toast ABO) In Progress
