# Lead Strategy and Segmentation - R&G Consulting LLC
## Permanent Business Context Document

**Created:** 2026-01-21
**Purpose:** This document captures the lead organization strategy and business context so it never needs to be repeated.

---

## CORE PRINCIPLE: NEVER DELETE ORIGINALS

All lead processing must:
1. **Preserve original spreadsheets** - Never modify or delete source files
2. **Create new cleaned/validated segment files** - Output to new files
3. **Store "garbage" data as C/D tier** - Repurpose, don't discard
4. **Build validation database** - Known-bad data prevents future re-validation of garbage

---

## TWO DISTINCT MARKETING PUSHES

### 1. NATIONAL PUSH (Active Now)
**Target:** Remote-only or remote-predominant clients
**Source:** BuiltWith leads (42,969 total)
**Geography:** Nationwide USA
**Services:** Toast POS consulting, menu building, support (ALL REMOTE)

### 2. LOCAL PUSH (Future - Not Started Yet)
**Target:** On-site service area clients
**Geography:** Provincetown → Plymouth → Providence RI triangle
**Services:**
- Toast POS services (on-site AND remote)
- **Networking and cabling services** (Cape Cod Cable Contractors)
**Status:** Will launch separately with different marketing approach

---

## NATIONAL LEAD SEGMENTS (Remote Push)

### Segment A: POS Switchers
**Profile:** Restaurants currently using Clover, Square, Upserve, Lightspeed, or other subpar POS systems
**Pain Point:** Transfer complexity - they don't want to spend time on the switch
**Value Proposition:** "I handle the entire transfer so you don't have to"
**Revenue Model:**
- Toast referral bonus ($1,000+ per referral)
- Implementation consulting
- Menu build for new system

**Why They Convert:** If they feel CONFIDENT you can handle the transfer, they'll switch. The barrier isn't convincing them Toast is better - it's convincing them the switch won't be painful.

### Segment B: Toast Existing - Support Needed
**Profile:** Current Toast merchants who need ongoing support
**Pain Point:** Don't know how to optimize their system, menu issues, need audits
**Value Proposition:** Restaurant Guardian support plans, menu audits, optimization
**Revenue Model:**
- Monthly/quarterly/annual support plans ($350-$800/month)
- One-time menu audits
- Hourly consulting

**Sub-segments:**
- Know they need help (active seekers)
- Don't know they need help yet (education required)

### Segment C: New Toast Implementations
**Profile:** Restaurants getting Toast for the first time (upcoming installs)
**Pain Point:** Need menu built, system configured before go-live
**Value Proposition:** "Menu built before install = faster launch"
**Revenue Model:**
- Menu building packages ($800-$2,500)
- Implementation support
- Training

**Source:** BuiltWith "Upcoming Implementations" list (1,614 leads)

### Segment D: Ownership Transitions
**Profile:** Restaurants changing hands that already have Toast
**Pain Point:** Transfer of Toast account, menu updates, system reconfiguration
**Value Proposition:** Zero-downtime transition, keep what works, fix what doesn't
**Revenue Model:**
- Transition consulting
- Menu audit and cleanup
- Support plan enrollment

### Segment E: Menu Building/Auditing (Cross-Segment)
**Profile:** ANY existing Toast merchant
**Pain Point:** Menu is a mess, modifiers wrong, pricing inconsistent
**Value Proposition:** Professional menu audit and rebuild
**Revenue Model:**
- Menu audit ($500-$1,000)
- Full menu rebuild ($1,500-$3,500)
- Ongoing menu management

**Note:** This is a MASSIVE need that cuts across all Toast users.

---

## LEAD TIER CLASSIFICATION

### Tier 1: Hot Leads (Score 80-100)
- Has email AND phone
- Restaurant vertical confirmed
- Toast or switching-ready POS
- Geographic fit (if local segment)

### Tier 2: Warm Leads (Score 60-79)
- Has email OR phone
- Restaurant vertical confirmed
- Any POS system

### Tier 3: Nurture Leads (Score 40-59)
- Has email
- Restaurant vertical confirmed
- May need education

### Tier C: Cold/Future Leads
- Missing contact info
- Restaurant vertical confirmed
- Store for future enrichment
- Can be assigned to reps for manual research

### Tier D: Garbage/Validation Database
- NOT restaurant vertical
- Invalid/bounce emails
- Wrong business type
- **PURPOSE:**
  - Prevent re-importing same bad data
  - Fact-check against future imports
  - "Already known bad" database

---

## LEAD PROCESSING RULES

### When Importing BuiltWith Data:
1. **ALWAYS filter by Vertical column** - Only "Food And Drink", "Restaurants"
2. **Never use pre-processed files** - Always start from source CSVs
3. **Sample verification** - Check 50 random records before bulk import
4. **Preserve originals** - Output to new files only

### Output File Structure:
```
G:/My Drive/RG OPS/70_LEADS/
├── ORIGINAL_BUILTWITH/           # Never modify these
│   ├── All-Live-Toast-POS-WebSites.csv
│   ├── All-Live-Clover-WebSites.csv
│   └── ...
├── CLEANED_SEGMENTS/             # Validated restaurant-only leads
│   ├── seg_toast_existing_CLEAN_[date].csv
│   ├── seg_switcher_clover_CLEAN_[date].csv
│   └── ...
├── TIER_CD_FUTURE/               # Non-restaurant and garbage data
│   ├── tier_c_needs_enrichment_[date].csv
│   ├── tier_d_non_restaurant_[date].csv
│   └── tier_d_validation_blacklist.csv
└── SEGMENTED_WORKBOOKS/          # Previous outputs (may have bad data)
```

---

## WHY DIFFERENT SEGMENTS EXIST

> "I don't want to just hammer away at the same exact perspective or the same exact type of selling in the same way."

Different restaurants have different needs:

| Restaurant Situation | Their Need | Your Offer |
|---------------------|------------|------------|
| On subpar POS, considering switch | Confidence in painless transfer | Handle entire migration |
| New restaurant, chose Toast | Menu built before opening | Menu building package |
| Existing Toast, struggling | Support and optimization | Guardian support plan |
| Changing ownership | Smooth transition | Transition consulting |
| Any Toast user | Menu is a mess | Menu audit/rebuild |

**Each segment gets different messaging, different sequences, different value props.**

---

## REFERRAL BONUS STRATEGY

**Toast Referral Program:**
- Earn $1,000+ per successful referral
- Target: Restaurants on inferior POS systems
- Easy targets: Clover, Square (known limitations for restaurants)

**Sales Approach:**
1. Identify pain points with current system
2. Show Toast advantages (not hard - Toast IS better for restaurants)
3. **KEY:** Make them confident YOU can handle the transfer
4. Close the switch, earn referral bonus
5. Optionally: Sell them a support plan after migration

---

## SERVICE AREA REFERENCE

### Local Service Area (Cape Cod Cable Contractors)
```
Northern Boundary: Provincetown, MA
Southern Boundary: Providence, RI
Eastern Boundary: Cape Cod coastline
Western Boundary: Plymouth, MA → Providence, RI line

Includes:
- All of Cape Cod
- South Shore (Plymouth, Marshfield, Duxbury)
- Fall River / New Bedford
- Southeastern MA
- Providence metro area
```

### National Service Area (R&G Consulting)
- All 50 states
- Remote-only services
- Toast POS consulting, menu building, support

---

## IMPORTANT: SAVE THIS CONTEXT

This document exists because the user is tired of repeating this information. Any AI agent working on this project MUST:

1. **Read this document** before working on leads
2. **Follow the tier classification** when processing
3. **Never delete original files**
4. **Store garbage data for validation**
5. **Understand the different segment purposes**

---

## RELATED DOCUMENTS

- `MASTER_EXECUTION_PLAN.md` - Overall business execution plan
- `HUMAN_TASKS.md` - Tasks requiring human action
- `scripts/process_leads.cjs` - Lead processing script
- `docs/RESTAURANT_INTELLIGENCE_SYSTEM.md` - Database schema for leads

---

**This document is the source of truth for lead strategy. Reference it, don't ask the user to repeat it.**
