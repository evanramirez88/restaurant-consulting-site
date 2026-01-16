# Restaurant Intelligence System

## Overview

A comprehensive database and classification system for restaurant leads, connecting:
- **Lead Management** → Classification → **POS Configuration** → **Quote Builder** → **Menu Builder**

## Database Schema

### Classification Taxonomy Tables

| Table | Purpose |
|-------|---------|
| `cuisine_types` | Cuisine categories with auto-classification keywords |
| `service_styles` | Service style definitions (FSR, QSR, Fast Casual, Fine Dining, etc.) |
| `bar_programs` | Bar/beverage program types (Full Bar, Beer/Wine, None, etc.) |
| `menu_complexity_profiles` | Menu complexity levels with typical item counts |
| `restaurant_type_templates` | Combined restaurant profiles linking all above |

### Lead Management Tables

| Table | Purpose |
|-------|---------|
| `restaurant_leads` | Master lead records (42,000+ records) |
| `lead_segments` | Dynamic segment definitions with criteria |
| `lead_segment_members` | Lead-to-segment assignments |
| `lead_contacts` | Contact persons for leads |
| `lead_activity_log` | Activity tracking (emails, calls, etc.) |

### POS Configuration Tables

| Table | Purpose |
|-------|---------|
| `pos_config_templates` | POS configuration recommendations by restaurant type |

## Segments

| Segment | Count | Description |
|---------|-------|-------------|
| `seg_toast_existing` | 15,786 | Active Toast users |
| `seg_switcher_clover` | 12,397 | Clover users (switcher targets) |
| `seg_switcher_square` | 12,080 | Square/Lightspeed users (switcher targets) |
| `seg_contactable` | 3,398 | Leads with email AND phone |
| `seg_toast_upcoming` | 1,614 | Toast implementations scheduled |
| `seg_switcher_upserve` | 1,045 | Upserve users |
| `seg_high_value` | 477 | Score 80+ leads |
| `seg_local_ma` | 251 | Massachusetts leads |
| `seg_local_capecod` | 3 | Cape Cod area leads |

## Lead Scoring

| Factor | Points |
|--------|--------|
| Has email | +30 |
| Has phone | +20 |
| US-based | +10 |
| Has company name | +10 |
| Food & Drink vertical | +15 |
| Recent activity (< 3 months) | +15 |
| Recent activity (3-6 months) | +10 |
| Recent activity (6-12 months) | +5 |

## Scripts

### Process Leads
```bash
# Show statistics only
node scripts/process_leads.cjs --stats

# Export segmented workbooks
node scripts/process_leads.cjs --export

# Import to D1 database
node scripts/process_leads.cjs --import

# Dry run import
node scripts/process_leads.cjs --import --dry-run
```

### Output Location
Workbooks exported to: `G:/My Drive/RG OPS/70_LEADS/SEGMENTED_WORKBOOKS/`

## Classification System

### Auto-Classification Keywords

The system auto-detects cuisine from company name and domain:

| Cuisine | Keywords |
|---------|----------|
| Italian | italian, pizza, pasta, trattoria, pizzeria |
| Mexican | mexican, taco, burrito, cantina, taqueria |
| Japanese | japanese, sushi, ramen, izakaya, hibachi |
| Seafood | seafood, oyster, lobster, fish, crab |
| BBQ | bbq, barbecue, smokehouse, ribs, brisket |
| Brewery | brewery, brewpub, taproom, craft beer |

### Restaurant Type Templates

Pre-defined templates map to POS configurations:

| Template | Service Style | Bar Program | Menu Complexity |
|----------|---------------|-------------|-----------------|
| Fine Dining Italian | Fine Dining | Full Bar | Complex |
| Casual Italian | Full Service | Beer/Wine | Moderate |
| Fast Casual Mexican | Fast Casual | Beer/Wine | Moderate |
| Upscale Steakhouse | Upscale Casual | Full Bar | Complex |
| QSR Burger | Quick Service | None | Simple |
| Brewpub | Full Service | Beer Only | Moderate |

## Integration Points

### Toast ABO
- Restaurant type → Menu structure template
- Bar program → Liquor modifiers
- Service style → Coursing/seat routing

### Quote Builder
- Restaurant type → Typical hardware needs
- Seat count estimates → Terminal recommendations
- Service style → KDS/printer requirements
- **DCI Algorithm** → Dynamic pricing based on complexity/discounts/industry

### Menu Builder
- Cuisine type → Category templates
- Menu complexity → Modifier depth
- Bar program → Beverage menu structure

## DCI Algorithm (Quote Builder)

The DCI (Discount/Complexity/Industry) algorithm applies intelligent pricing adjustments.

### Complexity Multipliers

| Factor | Value | Adjustment |
|--------|-------|------------|
| **Service Style** | | |
| Fine Dining | 1.25 | +25% |
| Upscale Casual | 1.15 | +15% |
| Full Service | 1.10 | +10% |
| Fast Casual | 1.05 | +5% |
| Quick Service | 1.00 | baseline |
| Counter | 0.95 | -5% |
| Cafe | 0.90 | -10% |
| Food Truck | 0.85 | -15% |
| **Menu Complexity** | | |
| Ultra (200+ items) | 1.30 | +30% |
| Complex (100-200) | 1.15 | +15% |
| Moderate (50-100) | 1.05 | +5% |
| Simple (<50) | 0.90 | -10% |
| **Bar Program** | | |
| Craft Cocktail | 1.25 | +25% |
| Full Bar | 1.15 | +15% |
| Wine Focus | 1.10 | +10% |
| Beer/Wine | 1.05 | +5% |
| None | 1.00 | baseline |

### Hardware Complexity Factors

| Factor | Threshold | Adjustment |
|--------|-----------|------------|
| Station count | >5 stations | +3% per extra station |
| KDS present | Any | +10% |
| Multi-printer | >2 printers | +8% |

### Discount Tiers

| Type | Condition | Discount |
|------|-----------|----------|
| Volume | 50+ devices | 15% |
| Volume | 30-49 devices | 10% |
| Volume | 15-29 devices | 5% |
| Multi-location | Per additional location | 5% (max 20%) |
| Loyalty | Existing client | 10% |
| Referral | Toast referral | $1,000 credit |

*Maximum total discount capped at 30%*

## HubSpot Integration

**Status: ACTIVE** (215 contacts synced)

### Sync Endpoint
`POST /api/sync/hubspot-contacts`

### Custom Properties
| Property | Internal Name | Description |
|----------|---------------|-------------|
| D1 Lead ID | `d1_lead_id` | Links HubSpot to D1 record |
| D1 Synced At | `d1_synced_at` | Last sync timestamp |
| Square Customer ID | `square_customer_id` | Links to Square billing |

### Database Columns Added
- `restaurant_leads.hubspot_synced_at` - Sync tracking
- `clients.hubspot_synced_at` - Sync tracking
- `clients.square_customer_id` - Square integration
- `quotes.square_customer_id` - Quote tracking

## Email Enrollment

**Endpoint:** `POST /api/email/enroll`

### Available Sequences
| ID | Segment | Steps |
|----|---------|-------|
| 1 | Segment A (Switchers) | 3 |
| 2 | Segment B (Toast) | 3 |
| 3 | Segment C (Transitions) | 2 |
| 4 | Segment D (Local) | 2 |
| 5 | Menu Builder Launch | 3 |
| 6 | Quote Follow-up | 3 |
| 7 | Booking Confirmation | 3 |
| 8 | Onboarding | 3 |

## M2V Scoring Equation (NEW - 2026-01-16)

Menu-to-Venue composite assessment formula that evaluates fit across 7 dimensions.

### Formula
```
M2V = w_M·Q̃ + w_P·CM̃ + w_O·Occ̃ - w_R·RevPASH̃ + w_L·(1-Labor%̃) - w_S·(1-TCÕ) + w_V·SI_peak
```

### Components
| Symbol | Metric | Description |
|--------|--------|-------------|
| Q̃ | Quality Score | Menu quality assessment (0-100) |
| CM̃ | Contribution Margin | Pricing effectiveness |
| Occ̃ | Occupancy Rate | Table/seat utilization |
| RevPASH̃ | Revenue Per Available Seat Hour | Efficiency metric |
| Labor%̃ | Labor Percentage | Cost efficiency |
| TCÕ | Total Cost of Ownership | Technology cost burden |
| SI_peak | Seasonality Index | Peak period performance |

### Weights by Category
| Category | Q | CM | Occ | RevPASH | Labor | TCO | Volume |
|----------|---|----|----|---------|-------|-----|--------|
| Fine Dining | 0.20 | 0.25 | 0.15 | 0.10 | 0.10 | 0.10 | 0.10 |
| Casual Dining | 0.15 | 0.15 | 0.20 | 0.15 | 0.15 | 0.10 | 0.10 |
| Fast Casual | 0.10 | 0.10 | 0.15 | 0.20 | 0.20 | 0.10 | 0.15 |
| QSR | 0.05 | 0.05 | 0.10 | 0.25 | 0.20 | 0.15 | 0.20 |

### Endpoint
`POST /api/quote/m2v-score` - Calculate M2V score for venue

---

## Core 4 Intelligence Agents (NEW - 2026-01-16)

Autonomous intelligence gathering running on daily schedule.

### Agent Schedule
| Agent | Time | Focus |
|-------|------|-------|
| **Hunter** | 4:00 AM | Lead discovery, licensing boards, real estate |
| **Analyst** | 5:00 AM | Data enrichment, POS audits, network mapping |
| **Operator** | 6:00 AM | Operations audit, automation health, task validation |
| **Strategist** | 7:00 AM | Lead scoring, gap analysis, daily briefing |

### Lead Scoring Formula
```
Score = (Property Ownership × 3) + (Tech Vulnerability × 2) + (Warm Intro × 5)
      + Revenue Estimate + Urgency Signals + Engagement History
```

### Recursive Gap Filling
System identifies missing data with `<<NEED>>` markers and generates search queries:
```javascript
{
  gaps: [
    { field: 'phone', marker: '<<NEED:PHONE>>', searchQuery: 'Joes Pizza Hyannis phone' },
    { field: 'owner', marker: '<<NEED:OWNER>>', searchQuery: 'Joes Pizza Hyannis owner' }
  ]
}
```

### Endpoint
`POST /api/intelligence/agents` - Execute agent task

---

## Martini/Manhattan Inventory Logic (NEW - 2026-01-16)

Bar inventory tracking treating cocktails as "states" of base spirits.

### Formula
```
Final Price = (Base Spirit Price × Volume Multiplier) + Style Upcharge
```

### Cocktail Styles
| Style | Volume Multiplier | Upcharge | Typical Oz |
|-------|-------------------|----------|------------|
| Martini | 2.0 | $2.00 | 4.0 |
| Manhattan | 1.8 | $2.00 | 3.5 |
| Old Fashioned | 1.25 | $1.50 | 2.5 |
| Neat | 1.0 | $0.00 | 2.0 |
| On the Rocks | 1.0 | $0.00 | 2.0 |
| Highball | 0.75 | $0.50 | 1.5 |

### Example Calculation
- Tito's base price: $10
- Martini style: 2.0 multiplier, $2 upcharge
- Result: ($10 × 2.0) + $2 = **$22**

### Database Tables
- `spirit_base_items` - 30+ spirits with cost/pricing
- `cocktail_styles` - 12 styles with multipliers
- `cocktail_modifier_templates` - Garnish, temp, size options
- `cocktail_menu_items` - Generated combinations

### Endpoints
| Endpoint | Purpose |
|----------|---------|
| `GET /api/menu/cocktail-config` | Get configuration |
| `GET /api/menu/cocktail-config?action=pricing` | Full pricing matrix |
| `POST /api/menu/cocktail-config/calculate` | Custom calculation |
| `POST /api/menu/cocktail-config/generate` | Generate menu items |

---

## DCI Variability Database (ENHANCED - 2026-01-16)

Time-motion intelligence with real-world variance data.

### Hardware Items (17 total)
```javascript
{
  'toast-flex': { expected: 45, min: 35, max: 60, failureRate: 0.02, recoveryMin: 20 },
  'toast-kds': { expected: 30, min: 20, max: 45, failureRate: 0.04, recoveryMin: 25 },
  'receipt-printer': { expected: 15, min: 10, max: 25, failureRate: 0.05, recoveryMin: 10 },
  // ... 14 more
}
```

### Station Criticality Weights
| Hardware | Weight | Reason |
|----------|--------|--------|
| KDS | 1.5 | Mission-critical for kitchen |
| Router | 1.5 | Entire system depends on network |
| Receipt Printer | 1.3 | Customer-facing impact |
| Toast Flex | 1.2 | Primary POS terminal |

### Environmental Multipliers
| Condition | Multiplier | Reason |
|-----------|------------|--------|
| Standard | 1.0 | Baseline |
| Historic Building | 1.5 | Difficult cabling |
| Grease Heavy | 1.25 | Kitchen areas |
| Outdoor Patio | 1.3 | Weatherproofing |

---

## Future Enhancements

1. ~~**HubSpot Sync** - Two-way lead sync with CRM~~ ✅ COMPLETED
2. ~~**M2V Scoring** - Menu-to-venue assessment~~ ✅ COMPLETED
3. ~~**Core 4 Agents** - Autonomous intelligence~~ ✅ COMPLETED
4. ~~**Martini/Manhattan Logic** - Bar inventory tracking~~ ✅ COMPLETED
5. **Google Places Enrichment** - Add hours, reviews, photos
6. **Yelp API Integration** - Cuisine verification, price level
7. **AI Website Analysis** - Scrape menus for item counts
