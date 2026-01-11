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

### Menu Builder
- Cuisine type → Category templates
- Menu complexity → Modifier depth
- Bar program → Beverage menu structure

## Future Enhancements

1. **Google Places Enrichment** - Add hours, reviews, photos
2. **Yelp API Integration** - Cuisine verification, price level
3. **AI Website Analysis** - Scrape menus for item counts
4. **HubSpot Sync** - Two-way lead sync with CRM
