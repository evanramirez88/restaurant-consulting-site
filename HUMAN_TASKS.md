# Human Required Tasks - Operation Breakout

**Last Updated:** 2026-01-07 09:00 EST
**Goal:** $400K by May 1, 2026 (116 days remaining)

---

## AI-LED DEVELOPMENT (In Progress)

**See:** `AI_EXECUTION_PLAN.md` for full details

The following critical development work will be completed by AI agents in **5-6 days** (compressed from 13-17 days):

| Component | AI Agent Responsibility | Human Action |
|-----------|------------------------|--------------|
| Email Admin UI | Build all 10 components + 30 API endpoints | Review & approve |
| Quote Builder Fixes | Move hardcoded contacts to env vars | None |
| Menu Builder Auth | Add JWT verification | None |
| Invoice Generation | Complete Square integration | None |
| PDF Processing | Complete OCR for Quote/Menu builders | Test with real PDFs |

**Estimated AI Completion:** 5-6 days with 4 parallel agents

### What Humans Still Need to Do

1. **Review AI-built components** - Approve before production deploy
2. **Test with real data** - Run email sequences with subset of leads
3. **Configure HubSpot sequences** - Create actual sequences in HubSpot UI
4. **Monitor first campaign** - Watch metrics, adjust copy if needed

---

## ✅ COMPLETED: Cloudflare Domain Migration (2026-01-06)

All business domains consolidated to the correct Cloudflare account.

| Task | Status |
|------|--------|
| Identify correct account (ramirezconsulting.rg@gmail.com) | ✅ Done |
| Add ccrestaurantconsulting.com to RG account | ✅ Done |
| Configure DNS records | ✅ Done |
| Connect domain to Pages project | ✅ Done |
| Verify GitHub auto-deploy | ✅ Done |
| Add 5 additional domains to RG account | ✅ Done |
| Activate capecodcablecontractors.com | ✅ Done |

**Full details:** See `CLOUDFLARE_STATUS.md`

---

## ✅ COMPLETED: Infrastructure Setup (All Configured)

| Item | Status | Details |
|------|--------|---------|
| D1 Database | ✅ | `rg-consulting-forms` - 40 tables |
| KV Namespace | ✅ | `rg-consulting-sessions` |
| R2 Bucket | ✅ | `ccrc-uploads` |
| Workers AI | ✅ | Bound as `AI` |
| GitHub Auto-Deploy | ✅ | Native Cloudflare Pages integration |
| Database Migrations | ✅ | All migrations applied 2026-01-06 |

---

## ✅ COMPLETED: Domain Status

| Domain | Status | Account |
|--------|--------|---------|
| ccrestaurantconsulting.com | **ACTIVE** ✅ | RG (connected to Pages) |
| capecodcablecontractors.com | **ACTIVE** ✅ | RG |
| capecodrestaurantconsulting.com | Pending NS | RG (needs devin/linda) |
| thewanderinbartender.com | Pending NS | RG (needs adel/simon) |
| toastspecialist.com | Pending NS | RG (needs adel/simon) |
| thewanderingardener.com | Pending NS | RG (needs adel/simon) |

---

## ✅ COMPLETED: API Keys Configured (2026-01-07)

All API keys have been set in Cloudflare Pages environment variables:

| Feature | Variable | Status | Key Format |
|---------|----------|--------|------------|
| Contact Form Emails | `RESEND_API_KEY` | ✅ ACTIVE | `re_*` |
| CRM Sync | `HUBSPOT_API_KEY` | ✅ ACTIVE | `pat-na2-*` (Panicky-Monkey app) |
| Billing/Invoices | `SQUARE_ACCESS_TOKEN` | ✅ ACTIVE | `EAAA*` (OAuth token) |
| Billing/Invoices | `SQUARE_APPLICATION_ID` | ✅ ACTIVE | `sq0idp-*` |

**All features now operational.** Deployment `aee4ba74` includes all keys.

### Contact Form Status (Verified 2026-01-07 05:45 EST)
| Integration | Status | Notes |
|-------------|--------|-------|
| Resend Email | **WORKING** | Using `onboarding@resend.dev` test sender → `ramirezconsulting.rg@gmail.com` |
| HubSpot CRM | **WORKING** | Creates/updates contacts with standard properties |

**Latest deployment:** `2c17c4e` - Both `emailSent: true` and `hubspotCreated: true` confirmed.

---

## PENDING: Configure capecodcablecontractors.com Redirect (HIGH PRIORITY)

The domain is active in Cloudflare but needs a redirect rule configured.

**Location:** https://dash.cloudflare.com → capecodcablecontractors.com → Rules → Redirect Rules

1. Create new Redirect Rule
2. **When:** Hostname equals `capecodcablecontractors.com` OR `www.capecodcablecontractors.com`
3. **Then:** Static redirect to `https://ccrestaurantconsulting.com/#/local-networking`
4. **Status:** 301 (Permanent)
5. **Preserve query string:** ON

Also need DNS A record pointing to 192.0.2.1 (proxied) if not already configured.

**See:** `CLOUDFLARE_REDIRECT_SETUP.md` for detailed instructions.

---

## PENDING: Update Nameservers (Low Priority)

These domains need NS updated at Squarespace:

| Domain | Change NS To |
|--------|--------------|
| thewanderinbartender.com | adel.ns.cloudflare.com, simon.ns.cloudflare.com |
| toastspecialist.com | adel.ns.cloudflare.com, simon.ns.cloudflare.com |
| thewanderingardener.com | adel.ns.cloudflare.com, simon.ns.cloudflare.com |

**Location:** https://account.squarespace.com/domains

---

## Week 1 Tasks (Jan 1-7) - LAUNCH

### 1. HubSpot Email Sequences

**Location:** https://app.hubspot.com/sequences/243379742

| Sequence | Target | Emails |
|----------|--------|--------|
| Toast Upcoming Implementation | Active implementers (1,615) | 3 over 7 days |
| Toast Existing - Massachusetts | MA Toast users | 4 over 14 days |
| Toast Existing - National | Non-MA Toast users | 4 over 14 days |
| Competitor POS Conversion | Clover/Square/Upserve | 3 over 10 days |
| Menu Build Specialist | All Toast users | 3 over 7 days |
| Support Plan Nurture | Past clients | 2 over 5 days |

### 2. Import First Lead Batch

**Files in:** `G:\My Drive\RG OPS\70_LEADS_BUILTWITH\71_LEADS_ARCHIVE\`

- `top500_contactable.csv` - Best quality, all scored 100
- `Toast-POS-websites-filter-Upcoming-implementations.csv` - 1,615 active leads

### 3. Cal.com Availability

**Location:** https://app.cal.com/settings/my-account/availability

- Add evening hours (7pm-10pm)
- Add weekend slots if desired
- Configure buffer times

### 4. Square Catalog Products

**Location:** https://squareup.com/dashboard/catalog

| Product | Price |
|---------|-------|
| Toast Guardian Core - Quarterly | $1,050 |
| Toast Guardian Core - Annual | $3,850 |
| Toast Guardian Professional - Quarterly | $1,500 |
| Toast Guardian Professional - Annual | $5,500 |
| Toast Guardian Premium - Quarterly | $2,400 |
| Toast Guardian Premium - Annual | $8,800 |

---

## Week 2 Tasks (Jan 8-14) - VOLUME

- [ ] Send 500 outreach emails
- [ ] Call non-responders after 7 days
- [ ] Create proposal template in PandaDoc
- [ ] Target: 5+ proposals
- [ ] Close first support plan deals

---

## Quick Reference: System IDs

| System | ID |
|--------|-----|
| **Cloudflare Account** | **373a6cef1f9ccf5d26bfd9687a91c0a6** |
| **Cloudflare API Token** | **24aujAQSZ8JEky8IFrnk7MeUhOrcn_Yj6MnsCCAk** |
| Pages Project ID | bdb70a0d-367d-4f36-9363-d7dee4699f1b |
| ccrestaurantconsulting.com Zone | 141091a76fe0026d42fb846391ad1851 |
| Cloudflare D1 | eb39c9a2-24ed-426e-9260-a1fb55d899cb |
| Cloudflare KV | 57fda5bf0515423db01df17ed5b335e6 |
| Cloudflare R2 Bucket | ccrc-uploads |
| HubSpot Portal | 243379742 |
| Square Lane A (Local) | L6GGMPCHFM6WR |
| Square Lane B (National) | LB8GE5HYZJYB7 |
| Cal.com Username | r-g-consulting |
| Cal.com Schedule ID | 1148640 |

---

## Lead Prioritization Order

1. **Adam Holmes referrals** (warm) - Immediate
2. **Past/existing clients** - Week 1
3. **Toast Upcoming Implementations** - Week 1-2
4. **Massachusetts Toast users** - Week 1-2
5. **Massachusetts competitor POS** - Week 2-3
6. **Florida Toast users** (remote) - Week 3-4
7. **National Toast users** - Ongoing

---

**THE MATH WORKS. EXECUTE.**
