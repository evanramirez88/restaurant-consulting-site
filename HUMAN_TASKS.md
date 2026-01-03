# Human Required Tasks - Operation Breakout

**Last Updated:** January 3, 2026
**Goal:** $400K by May 1, 2026 (119 days remaining)

---

## CRITICAL: Week 1 Tasks (Jan 1-7)

### 1. Cloudflare Dashboard Configuration

**Location:** https://dash.cloudflare.com → Pages → restaurant-consulting-site → Settings → Functions

#### D1 Database Binding - ✅ AUTOMATED
Configured via API:
- **Variable name:** `DB`
- **D1 database:** `rg-consulting-forms` (ID: `eb39c9a2-24ed-426e-9260-a1fb55d899cb`)

#### KV Namespace Binding - ✅ AUTOMATED
Configured via API:
- **Variable name:** `RATE_LIMIT_KV`
- **KV namespace:** `rg-consulting-sessions` (ID: `57fda5bf0515423db01df17ed5b335e6`)

#### Environment Variables - PARTIALLY AUTOMATED

**✅ Already Set (via API):**
| Variable | Value |
|----------|-------|
| `SQUARE_ENVIRONMENT` | `production` |
| `SQUARE_LOCATION_ID_LANE_A` | `L6GGMPCHFM6WR` |
| `SQUARE_LOCATION_ID_LANE_B` | `LB8GE5HYZJYB7` |

**⚠️ STILL NEED TO SET (requires secrets):**
| Variable | How to Get |
|----------|------------|
| `ADMIN_PASSWORD_HASH` | Run: `echo -n "YOUR_PASSWORD" \| openssl dgst -sha256` |
| `SQUARE_ACCESS_TOKEN` | From https://developer.squareup.com → Applications → Credentials |

---

### 2. HubSpot Email Sequences

**Location:** https://app.hubspot.com/sequences/243379742

Create 6 email sequences for Operation Breakout:

#### Sequence 1: Toast Upcoming Implementation
- **Target:** Restaurants actively implementing Toast (1,615 leads)
- **Angle:** "Need help with your Toast implementation?"
- **Emails:** 3-email sequence over 7 days

#### Sequence 2: Toast Existing User - Massachusetts
- **Target:** MA Toast users needing support
- **Angle:** Local expert, on-site available
- **Emails:** 4-email sequence over 14 days

#### Sequence 3: Toast Existing User - National
- **Target:** Toast users outside MA
- **Angle:** Remote support specialist
- **Emails:** 4-email sequence over 14 days

#### Sequence 4: Competitor POS Conversion
- **Target:** Clover/Square/Upserve users
- **Angle:** Toast referral opportunity
- **Emails:** 3-email sequence over 10 days

#### Sequence 5: Menu Build Specialist
- **Target:** All Toast users
- **Angle:** Menu optimization/cleanup
- **Emails:** 3-email sequence over 7 days

#### Sequence 6: Support Plan Nurture
- **Target:** Past service clients
- **Angle:** Ongoing support value
- **Emails:** 2-email sequence over 5 days

---

### 3. Import First Lead Batch

**Ready files in:** `G:\My Drive\RG OPS\70_LEADS_BUILTWITH\71_LEADS_ARCHIVE\`

#### Option A: Top 500 (Highest Probability)
- **File:** `top500_contactable.csv`
- **All leads scored 100** - best quality
- **Columns ready for HubSpot import**

#### Option B: Toast Upcoming Implementations
- **File:** `Toast-POS-websites-filter-Upcoming-implementations.csv`
- **1,615 leads** actively implementing Toast
- **Needs column mapping** (raw BuiltWith format)

#### Import Steps:
1. Go to HubSpot → Contacts → Import
2. Upload CSV file
3. Map columns:
   - `domain` → Website URL
   - `Company` → Company name
   - `primary_email` → Email
   - `primary_phone` → Phone
   - `City`, `state_norm`, `Zip` → Address fields
   - `providers` → Custom property: Current POS
   - `lead_score` → Custom property: Lead Score
4. Assign to appropriate list for sequence enrollment

---

### 4. Cal.com Availability Fine-Tuning

**Location:** https://app.cal.com/settings/my-account/availability

The schedule has been created (ID: 1148640) with base 9am-5pm Mon-Fri hours. Fine-tune to add:

- **Evening hours:** 7pm-10pm (restaurant owner friendly)
- **Weekend slots:** Saturday mornings if desired
- **Buffer times:** Between meetings

---

### 5. Square Catalog Products (Support Plans)

**Location:** https://squareup.com/dashboard/catalog

Create catalog items for support plans:

| Product | Price | Billing |
|---------|-------|---------|
| Toast Guardian Core - Quarterly | $1,050 | One-time |
| Toast Guardian Core - Annual | $3,850 | One-time |
| Toast Guardian Professional - Quarterly | $1,500 | One-time |
| Toast Guardian Professional - Annual | $5,500 | One-time |
| Toast Guardian Premium - Quarterly | $2,400 | One-time |
| Toast Guardian Premium - Annual | $8,800 | One-time |

---

## Week 2 Tasks (Jan 8-14)

### Phone Follow-Up Campaign
- [ ] Call non-responders after 7 days
- [ ] Use discovery call script
- [ ] Book via Cal.com

### First Proposals
- [ ] Create proposal template in PandaDoc
- [ ] Target: 5+ proposals by end of week
- [ ] Include quarterly billing options

---

## Lead Prioritization Order

1. **Adam Holmes referrals** (warm) - Immediate
2. **Past/existing clients** (referral requests) - Week 1
3. **Toast Upcoming Implementations** - Week 1-2
4. **Massachusetts Toast users** - Week 1-2
5. **Massachusetts competitor POS** - Week 2-3
6. **Florida Toast users** (remote) - Week 3-4
7. **National Toast users** - Ongoing

---

## Quick Reference: System IDs

| System | ID |
|--------|-----|
| HubSpot Portal | 243379742 |
| Square Lane A (Local) | L6GGMPCHFM6WR |
| Square Lane B (National) | LB8GE5HYZJYB7 |
| Cal.com Username | r-g-consulting |
| Cal.com Schedule ID | 1148640 |
| Cloudflare D1 | c2fdafac-bc84-4ad7-974e-312dceb28263 |
| Cloudflare KV | a922ece9ad7c42e08a3c1fe88e81db7b |

---

**THE MATH WORKS. EXECUTE.**
