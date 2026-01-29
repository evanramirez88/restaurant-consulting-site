# Cloudflare Infrastructure Status

**Last Updated:** 2026-01-29 13:11 EST
**Session:** Email inbound worker verified live - AI classification for inbound emails

---

## ACCOUNT INFORMATION

### Primary Account (USE THIS ONE)
- **Email:** ramirezconsulting.rg@gmail.com
- **Account ID:** 373a6cef1f9ccf5d26bfd9687a91c0a6
- **API Token:** `24aujAQSZ8JEky8IFrnk7MeUhOrcn_Yj6MnsCCAk`

### Legacy Account (Personal - DO NOT USE for business)
- **Email:** evanramirez88@gmail.com
- **Account ID:** 81ae379e7d54cfc02c9eaac2930fd21b
- **Contains:** millstonecompound.com (personal site only)

---

## DOMAIN STATUS

### Active on RG Account ✅

| Domain | Zone ID | Status | Purpose |
|--------|---------|--------|---------|
| ccrestaurantconsulting.com | 141091a76fe0026d42fb846391ad1851 | **ACTIVE** | Main business site |
| capecodcablecontractors.com | 0f0349b4a1eb3d6b74afb9b9f81356e6 | **ACTIVE + REDIRECT** | Redirects to /local-networking |

### capecodcablecontractors.com Configuration

| Component | Details |
|-----------|---------|
| DNS A Record | `@` → 192.0.2.1 (proxied) |
| DNS CNAME | `www` → capecodcablecontractors.com (proxied) |
| Page Rule ID | c6eec127be822b9340cb581bd14eca4f |
| Page Rule | `*capecodcablecontractors.com/*` → `https://ccrestaurantconsulting.com/#/local-networking` (301) |
| Configured | 2026-01-07 via API |

### Pending Activation (NS Update Needed)

| Domain | Zone ID | Required Nameservers |
|--------|---------|---------------------|
| capecodrestaurantconsulting.com | cded8b6b52a5a3ad9d1a1a0c4e1aa21a | devin.ns.cloudflare.com, linda.ns.cloudflare.com |
| thewanderinbartender.com | 911b9d3ba2e5d4ca71286b7cdae92583 | adel.ns.cloudflare.com, simon.ns.cloudflare.com |
| toastspecialist.com | deaa692543c037de789c6be5f48b4f43 | adel.ns.cloudflare.com, simon.ns.cloudflare.com |
| thewanderingardener.com | a9da2c0de0bea589a56bc130444191e8 | adel.ns.cloudflare.com, simon.ns.cloudflare.com |

**To activate:** Update nameservers at Squarespace (https://account.squarespace.com/domains)

---

## PAGES PROJECT

### restaurant-consulting-site

| Setting | Value |
|---------|-------|
| Project ID | bdb70a0d-367d-4f36-9363-d7dee4699f1b |
| Account | ramirezconsulting.rg@gmail.com |
| Production URL | https://restaurant-consulting-site.pages.dev |
| GitHub Repo | evanramirez88/restaurant-consulting-site |
| Branch | main |
| Auto-deploy | ✅ Enabled (native GitHub integration) |
| Build Command | npm run build |
| Output Directory | dist |

### Custom Domains Connected

| Domain | Status |
|--------|--------|
| ccrestaurantconsulting.com | **ACTIVE** ✅ |
| www.ccrestaurantconsulting.com | **ACTIVE** ✅ |

---

## RESOURCE BINDINGS (All Configured)

| Binding | Variable | Resource ID/Name |
|---------|----------|------------------|
| D1 Database | `DB` | rg-consulting-forms (eb39c9a2-24ed-426e-9260-a1fb55d899cb) |
| KV Namespace | `RATE_LIMIT_KV` | rg-consulting-sessions (57fda5bf0515423db01df17ed5b335e6) |
| R2 Bucket | `R2_BUCKET` | ccrc-uploads |
| Workers AI | `AI` | Enabled |

---

## ENVIRONMENT VARIABLES

### All Configured ✅ (Updated 2026-01-07)

#### Authentication & Security
| Variable | Status | Notes |
|----------|--------|-------|
| ADMIN_PASSWORD_HASH | ✅ | Admin dashboard auth |
| JWT_SECRET | ✅ | Session tokens |
| CLIENT_JWT_SECRET | ✅ | Client portal auth |
| CREDENTIAL_ENCRYPTION_KEY | ✅ | Stored credentials |
| WORKER_API_KEY | ✅ | Internal API auth |

#### External Service API Keys
| Variable | Status | Service | Key Format |
|----------|--------|---------|------------|
| RESEND_API_KEY | ✅ | Contact form emails | `re_*` |
| HUBSPOT_API_KEY | ✅ | CRM sync (Panicky-Monkey app) | `pat-na2-*` |
| SQUARE_ACCESS_TOKEN | ✅ | One-time invoices | `EAAA*` (OAuth token) |
| SQUARE_APPLICATION_ID | ✅ | One-time invoices | `sq0idp-*` |
| **STRIPE_SECRET_KEY** | ✅ | Subscription billing | `sk_live_*` |
| **STRIPE_PUBLISHABLE_KEY** | ✅ | Checkout integration | `pk_live_*` |
| **STRIPE_WEBHOOK_SECRET** | ✅ | Webhook verification | `whsec_*` |

#### Contact Information (Quote Emails)
| Variable | Status | Notes | Default Value |
|----------|--------|-------|---------------|
| CONTACT_PHONE | NEEDS_CONFIG | Phone for quote confirmation emails | `17744080083` |
| CONTACT_EMAIL | NEEDS_CONFIG | Email for quote confirmation emails | `ramirezconsulting.rg@gmail.com` |

**Note:** CONTACT_PHONE and CONTACT_EMAIL have fallback defaults but should be configured in Cloudflare Pages environment variables for production use.

#### Phone Number Usage (IMPORTANT)
| Number | Purpose | Public/Private |
|--------|---------|----------------|
| (508) 247-4936 | **PUBLIC** business line - website, marketing, general inquiries | Public |
| (774) 408-0083 | **PRIVATE** - Local Cape Cod clients only | Private |

**DO NOT display 774-408-0083 on the website.** The website correctly uses (508) 247-4936.

#### API Key Storage
**Actual key values are stored securely in:**
- Cloudflare Pages → Settings → Environment Variables (encrypted)
- NOT in this repository (GitHub secret scanning enforced)

#### Where to Get New Keys (if expired/rotated)
| Service | URL |
|---------|-----|
| Resend | https://resend.com/api-keys |
| HubSpot | https://app.hubspot.com/private-apps/243379742 |
| Square | https://developer.squareup.com/apps |

---

## DNS RECORDS (ccrestaurantconsulting.com)

| Type | Name | Content | Proxied |
|------|------|---------|---------|
| CNAME | @ | restaurant-consulting-site.pages.dev | Yes |
| CNAME | www | restaurant-consulting-site.pages.dev | Yes |
| TXT | @ | v=spf1 -all | - |
| TXT | @ | google-site-verification=m-J4dOl2fBNUniO5sNLYsLi7eCSoVmDnHTXj3_tAnYQ | - |
| TXT | _dmarc | v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s | - |

---

## WHAT WAS COMPLETED

### 2026-01-06 - Domain Migration
1. ✅ Identified correct Cloudflare account (ramirezconsulting.rg@gmail.com)
2. ✅ Added ccrestaurantconsulting.com to RG account
3. ✅ Configured all DNS records for main site
4. ✅ Connected domain to Pages project
5. ✅ Verified GitHub auto-deployment working
6. ✅ Added 5 additional domains to RG account
7. ✅ Activated capecodcablecontractors.com
8. ✅ Documented all zone IDs and nameservers

### 2026-01-07 - API Keys Configured
1. ✅ Set RESEND_API_KEY for contact form emails
2. ✅ Set HUBSPOT_API_KEY for CRM sync (Panicky-Monkey private app)
3. ✅ Set SQUARE_ACCESS_TOKEN (OAuth token format EAAA*)
4. ✅ Set SQUARE_APPLICATION_ID (sq0idp-*)
5. ✅ Triggered new deployment to apply all keys
6. ✅ Verified deployment successful (aee4ba74)

### 2026-01-07 - Contact Form Fixed (Commit 2c17c4e)
1. ✅ Fixed Resend email recipient (changed to ramirezconsulting.rg@gmail.com)
2. ✅ Fixed HubSpot contact creation (removed invalid properties)
   - Removed `message` and `service_interest` properties (don't exist in HubSpot schema)
3. ✅ Verified both integrations working:
   - `emailSent: true` - Resend delivering emails
   - `hubspotCreated: true` - HubSpot creating/updating contacts

### 2026-01-07 - Email Sender Domain Updated
1. ✅ Updated contact form to use verified domain (`noreply@ccrestaurantconsulting.com`)
   - Previously used test domain (`onboarding@resend.dev`)
2. ✅ All email senders now use verified ccrestaurantconsulting.com domain:
   - Contact form: `noreply@ccrestaurantconsulting.com`
   - Quote emails: `noreply@ccrestaurantconsulting.com`
   - Magic links: `portal@ccrestaurantconsulting.com`
   - Admin emails: `noreply@ccrestaurantconsulting.com`

### 2026-01-07 - Integration Audit Complete
1. ✅ HubSpot CRM - Contact form creates/updates contacts (Portal ID: 243379742)
2. ✅ Square Billing - Invoice and subscription APIs configured
3. ✅ Resend Email - All senders using verified domain
4. ✅ Cal.com Scheduling - Iframe embed + new webhook handler for automated sequences
5. ✅ Email Sequences - Pre-built sequences for Toast outreach, bookings, follow-ups

---

## INTEGRATION STATUS

### Active Integrations

| Service | Status | Configuration |
|---------|--------|---------------|
| **Stripe** | ✅ ACTIVE | Live mode, 6 products, 18 prices |
| HubSpot | ✅ ACTIVE | Portal 243379742, Panicky-Monkey app |
| Square | ✅ ACTIVE | Lane B (LB8GE5HYZJYB7) for one-time invoices |
| Resend | ✅ ACTIVE | Verified domain ccrestaurantconsulting.com |
| Cal.com | ✅ ACTIVE | User: r-g-consulting, webhook integration |
| Cloudflare D1 | ✅ ACTIVE | 80+ tables, Stripe billing tables added |
| Cloudflare R2 | ✅ ACTIVE | ccrc-uploads bucket |
| Workers AI | ✅ ACTIVE | Bound as `AI` |

### Billing Strategy (Square + Stripe)

| Use Case | Platform | Notes |
|----------|----------|-------|
| Recurring Subscriptions | **Stripe** | Restaurant Guardian + Network Support plans |
| One-time Invoices | Square | Project work, hourly billing |
| Custom Quotes | **Stripe Quotes** | Bespoke pricing with PDF generation |
| Customer Portal | **Stripe** | Self-service subscription management |

### Support Plan Flow (Updated 2026-01-15)

1. **Visitor** → /services or /local-networking → sees support plan pricing
2. **Subscribe** → Click "Subscribe Now" → **Stripe Checkout** (hosted)
3. **Payment** → Customer enters payment info on Stripe-hosted page
4. **Webhook** → Stripe sends `checkout.session.completed` event
5. **Processing** → `/api/stripe/webhook` creates subscription records in D1
6. **HubSpot Sync** → Deal stage updated, subscription linked
7. **Customer Portal** → `/api/stripe/portal` for self-service management

### Email Sequences (Pre-built)

| Sequence | Trigger | Emails | Days |
|----------|---------|--------|------|
| toast-support-plan | Manual enrollment | 5 | 21 |
| remote-menu-work | Manual enrollment | 4 | 10 |
| booking-confirmation | Cal.com BOOKING_CREATED | 1 | 0 |
| post-meeting-followup | Cal.com MEETING_ENDED | 1 | 0 |
| noshow-reengagement | Cal.com NO_SHOW | 1 | 0 |

### Pending Configuration (Human Tasks)

| Task | Location | Priority |
|------|----------|----------|
| ~~Create Square catalog items~~ | ~~Square Dashboard~~ | ~~DONE - Using Stripe~~ |
| Create HubSpot sequences | HubSpot → Sequences | MEDIUM |
| Configure Cal.com webhook | Cal.com → Webhooks | MEDIUM |
| Test Stripe Checkout end-to-end | Live site | LOW |

---

## CLOUDFLARE WORKERS

### Deployed Workers

| Worker Name | URL | Purpose | Bindings |
|-------------|-----|---------|----------|
| **rg-email-dispatcher** | - | Cron-based email dispatch | DB, RATE_LIMIT_KV |
| **rg-email-inbound** | https://rg-email-inbound.ramirezconsulting-rg.workers.dev | Resend inbound webhook + AI classification | DB, KV, R2_BUCKET, AI |
| **toast-hub-aggregator** | https://toast-hub-aggregator.ramirezconsulting-rg.workers.dev | Content aggregation (RSS/Reddit) | DB, CACHE_KV |

### toast-hub-aggregator (NEW 2026-01-26)

| Setting | Value |
|---------|-------|
| Worker URL | https://toast-hub-aggregator.ramirezconsulting-rg.workers.dev |
| Version ID | 16fb81f7-09b6-4f31-8196-fc64ab7359fd |
| Cron Trigger | **DISABLED** (free tier limit - 5 max) |
| Manual Trigger | POST /run or Admin UI → Toast Hub → Aggregator |

#### Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| /health | GET | Health check |
| /status | GET | Aggregator stats and recent runs |
| /run | POST | Manual aggregation trigger |

#### Bindings
| Binding | Variable | Resource |
|---------|----------|----------|
| D1 Database | DB | rg-consulting-forms |
| KV Namespace | CACHE_KV | rg-consulting-sessions |

#### Environment Variables
| Variable | Value |
|----------|-------|
| ENVIRONMENT | production |
| MAX_ITEMS_PER_SOURCE | 50 |
| MAX_CONSECUTIVE_FAILURES | 5 |
| FETCH_TIMEOUT_MS | 10000 |

#### First Run Results (2026-01-26)
- Sources Processed: 6 (RSS + Reddit feeds)
- Items Fetched: 120
- Items Imported: 120
- Errors: 0

### rg-email-inbound (2026-01-29)

| Setting | Value |
|---------|-------|
| Worker URL | https://rg-email-inbound.ramirezconsulting-rg.workers.dev |
| Status | **LIVE** ✅ |
| Purpose | Resend inbound webhook processing with AI classification |

#### Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| /health | GET | Health check |
| /inbound | POST | Resend webhook endpoint |
| /stats | GET | Email statistics (API key required) |
| /recent | GET | Recent inbound emails (API key required) |

#### Bindings
| Binding | Variable | Resource |
|---------|----------|----------|
| D1 Database | DB | rg-consulting-forms |
| KV Namespace | KV | rg-consulting-sessions |
| R2 Bucket | R2_BUCKET | ccrc-uploads |
| Workers AI | AI | Cloudflare AI |

#### Environment Variables
| Variable | Value |
|----------|-------|
| ENVIRONMENT | production |
| ALLOWED_TO_ADDRESSES | ramirezconsulting.rg@gmail.com, support@ccrestaurantconsulting.com, hello@ccrestaurantconsulting.com |

#### Required Secrets (set via `wrangler secret put`)
| Secret | Purpose |
|--------|---------|
| RESEND_INBOUND_WEBHOOK_SECRET | Webhook signature verification |
| WORKER_API_KEY | Admin endpoint authentication |

#### Features
- **AI Classification**: Uses Cloudflare AI (LLaMA 3.1 8B) to classify emails into: positive_response, negative_response, unsubscribe, menu_attachment, general_inquiry, out_of_office, spam
- **Attachment Handling**: Stores attachments in R2, detects menu files
- **Lead Tracking**: Links inbound emails to existing subscribers and leads
- **Automation**: Creates follow-up tasks for positive responses, handles unsubscribes automatically

---

## TROUBLESHOOTING

### If site goes down
1. Check https://restaurant-consulting-site.pages.dev (Pages direct URL)
2. If Pages works but domain doesn't, check DNS in Cloudflare dashboard
3. Verify zone is on RG account (373a6cef1f9ccf5d26bfd9687a91c0a6)

### If deployment fails
1. Check GitHub Actions / Cloudflare Pages build logs
2. Verify GitHub integration is connected to RG account
3. Run `git push origin main` to trigger new deploy

### API commands for checking status
```bash
# List all zones
curl -s -H "Authorization: Bearer 24aujAQSZ8JEky8IFrnk7MeUhOrcn_Yj6MnsCCAk" \
  "https://api.cloudflare.com/client/v4/zones"

# Check Pages project
curl -s -H "Authorization: Bearer 24aujAQSZ8JEky8IFrnk7MeUhOrcn_Yj6MnsCCAk" \
  "https://api.cloudflare.com/client/v4/accounts/373a6cef1f9ccf5d26bfd9687a91c0a6/pages/projects/restaurant-consulting-site"

# Check custom domains
curl -s -H "Authorization: Bearer 24aujAQSZ8JEky8IFrnk7MeUhOrcn_Yj6MnsCCAk" \
  "https://api.cloudflare.com/client/v4/accounts/373a6cef1f9ccf5d26bfd9687a91c0a6/pages/projects/restaurant-consulting-site/domains"
```

---

## IMPORTANT: Future Domain Work

When adding new domains:
1. ALWAYS add to ramirezconsulting.rg@gmail.com account
2. Use API token: 24aujAQSZ8JEky8IFrnk7MeUhOrcn_Yj6MnsCCAk
3. Account ID: 373a6cef1f9ccf5d26bfd9687a91c0a6
4. Check assigned nameservers (varies per domain!)
5. Update NS at registrar (Squarespace) to match Cloudflare-assigned NS
