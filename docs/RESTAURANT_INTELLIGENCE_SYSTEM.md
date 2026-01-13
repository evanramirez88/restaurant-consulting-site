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

## Future Enhancements

1. ~~**HubSpot Sync** - Two-way lead sync with CRM~~ ✅ COMPLETED
2. **Google Places Enrichment** - Add hours, reviews, photos
3. **Yelp API Integration** - Cuisine verification, price level
4. **AI Website Analysis** - Scrape menus for item counts
5. **Square Subscription Plans** - Automated billing for support plans
