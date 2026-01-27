-- Toast Hub Content Foundation
-- Migration 0089: Seed initial content for Toast Hub
-- Implements: PLAN_TOAST_HUB.md Phase 1

-- ============================================
-- 1.1 ADD MISSING CATEGORIES
-- ============================================
-- Plan calls for 6 categories: toast-tips, troubleshooting, menu-engineering, operations, case-studies, industry-news
-- 5 already exist (tips, guides, case-studies, news, updates)
-- Adding troubleshooting and menu-engineering, renaming for consistency

INSERT OR IGNORE INTO toast_hub_categories (id, slug, name, description, display_order, is_active) VALUES
  ('cat_troubleshooting', 'troubleshooting', 'Troubleshooting', 'Fix common Toast POS issues and errors', 6, 1),
  ('cat_menu_engineering', 'menu-engineering', 'Menu Engineering', 'Design menus that maximize profits and customer satisfaction', 7, 1),
  ('cat_operations', 'operations', 'Operations', 'Run your restaurant efficiently with best practices', 8, 1);

-- ============================================
-- 1.2 SEED FOUNDATIONAL ARTICLES (5)
-- ============================================

-- Article 1: Complete Guide to Toast Menu Setup (Pillar Content ~2000 words)
INSERT OR IGNORE INTO toast_hub_posts (
  id, slug, title, excerpt, content, content_format, category, tags_json,
  meta_title, meta_description, status, author, published_at, featured, display_order
) VALUES (
  'post_001',
  'complete-guide-toast-menu-setup',
  'Complete Guide to Toast Menu Setup',
  'Master Toast POS menu configuration with this comprehensive guide covering menu structure, modifiers, pricing strategies, and advanced features.',
  '# Complete Guide to Toast Menu Setup

**Reading time:** 12 minutes
**Last updated:** January 2026

Setting up your menu in Toast POS is one of the most critical steps in your implementation. A well-structured menu improves order accuracy, speeds up service, and can even increase average ticket size. This guide walks you through everything you need to know.

## What You''ll Learn

- How to structure your menu hierarchy effectively
- Setting up modifier groups that make sense
- Pricing strategies that work in Toast
- Advanced features most restaurants miss
- Common mistakes to avoid

## Understanding Toast Menu Structure

Toast organizes menus in a logical hierarchy:

```
Restaurant
└── Menus (Lunch, Dinner, Happy Hour)
    └── Menu Groups (Appetizers, Entrees, Drinks)
        └── Menu Items (Burger, Steak, Beer)
            └── Modifier Groups (Cooking Temp, Toppings)
                └── Modifiers (Rare, Medium, Well Done)
```

### Revenue Centers vs. Menus

Before diving into menu items, understand the difference:

- **Revenue Centers** define where sales happen (Bar, Dining Room, Patio)
- **Menus** define what''s available and when
- **Menu Groups** organize items logically for servers

> **Pro Tip:** Create separate menus for different dayparts (Lunch, Dinner) rather than one massive menu. This keeps screens clean and allows automatic switching based on time of day.

## Setting Up Menu Groups

Menu groups should match how your staff thinks about orders:

### Best Practices for Menu Groups

1. **Keep it intuitive** - Name groups exactly as staff refer to them
2. **Limit items per group** - 10-15 items maximum for quick navigation
3. **Use colors strategically** - Color-code by category (blue for drinks, green for salads)
4. **Order matters** - Put high-sellers at the top

### Creating Effective Menu Groups

```
STARTERS
├── Soups & Salads
├── Shareables
└── Raw Bar

MAINS
├── From the Grill
├── Seafood
├── Pasta
└── Vegetarian

SIDES
├── Hot Sides
└── Cold Sides
```

## Modifier Groups: The Secret to Accuracy

Modifier groups are where Toast really shines - and where most restaurants make mistakes.

### Types of Modifiers

| Type | Use Case | Example |
|------|----------|---------|
| **Required** | Must select one | Cooking temperature |
| **Optional** | Can skip or select | Extra toppings |
| **Multi-Select** | Choose multiple | Pizza toppings |
| **Nested** | Modifiers with modifiers | Salad → Dressing → On the side |

### Building Smart Modifier Groups

**Example: Burger Modifier Setup**

```
COOKING TEMPERATURE (Required, Pick 1)
├── Rare
├── Medium Rare
├── Medium (Default)
├── Medium Well
└── Well Done

CHEESE SELECTION (Optional, Pick 1, +$1.50)
├── American
├── Cheddar
├── Swiss
├── Blue Cheese (+$0.50)
└── No Cheese

PREMIUM TOPPINGS (Optional, Multi-Select)
├── Bacon (+$2.00)
├── Avocado (+$2.50)
├── Fried Egg (+$1.50)
└── Caramelized Onions (+$1.00)
```

> **Pro Tip:** Use "Default" selections strategically. If 80% of customers want their burger medium, set it as default to speed up ordering.

## Pricing Strategies in Toast

Toast offers flexible pricing options that many restaurants underutilize.

### Price Levels

Set different prices for the same item based on:
- Time of day (Happy Hour pricing)
- Order type (Dine-in vs. Takeout)
- Revenue center (Bar vs. Dining Room)

### Size Variations

Use size pricing for items that come in multiple sizes:

```
House Salad
├── Side ($8.99)
├── Half ($12.99)
└── Full ($16.99)
```

### Menu Item Combos

Create combo pricing to increase average ticket:

```
Lunch Special ($15.99)
├── Choose an Entree
├── Choose a Side
└── Choose a Drink
    └── (Individual items would total $22+)
```

## Advanced Features Most Miss

### Quick Order Mode

Enable for high-volume items like drinks. Staff can add multiple items with single taps instead of going through full modifier flows.

### Menu Item Availability

- **86''d Items** - Temporarily unavailable (shows strikethrough)
- **Scheduled Availability** - Only show during certain hours
- **Inventory Tracking** - Auto-86 when stock runs out

### KDS Routing

Configure where items print/display:
- Appetizers → Expo Station
- Entrees → Hot Line
- Desserts → Pastry Station
- Drinks → Bar Printer

### Course Firing

Set up coursing so the kitchen knows timing:

```
Course 1: Appetizers (Fire immediately)
Course 2: Salads (Fire on command)
Course 3: Entrees (Fire on command)
Course 4: Desserts (Fire on command)
```

## Common Mistakes to Avoid

### 1. Too Many Modifier Groups

Don''t make servers tap 10 times to order a burger. Consolidate where possible.

**Bad:**
- Cooking Temp (Required)
- Bun Choice (Required)
- Lettuce (Optional)
- Tomato (Optional)
- Onion (Optional)
- Pickle (Optional)
- Sauce (Optional)

**Better:**
- Cooking Temp (Required)
- Customize (Optional, Multi-Select with defaults checked)

### 2. Inconsistent Naming

Pick a convention and stick to it:
- "Add Bacon" vs "Bacon" vs "Extra Bacon"
- "$2" vs "+$2" vs "$2.00"

### 3. Missing Void Reasons

Configure void/comp reasons that match your policies for accurate reporting.

### 4. No Test Orders

Always run test orders before go-live. Send items to every station, modify everything, and verify prints look correct.

## Menu Optimization Checklist

Before going live, verify:

- [ ] All items have correct prices
- [ ] Modifier groups are assigned properly
- [ ] Required modifiers are truly required
- [ ] Default selections make sense
- [ ] Item availability is configured
- [ ] KDS routing is correct
- [ ] Tax rates are applied correctly
- [ ] Combo pricing works as expected
- [ ] 86''d items show appropriately
- [ ] Menu switches at correct times

## Next Steps

A well-configured menu is just the start. Consider:

1. **Menu engineering analysis** - Identify your stars, plowhorses, puzzles, and dogs
2. **Regular reviews** - Update pricing and items quarterly
3. **Staff training** - Ensure everyone knows the menu structure

---

**Need help with your Toast menu setup?** [Schedule a free consultation](/contact) with our Toast certified experts. We''ve configured menus for 100+ restaurants and can have you optimized in days, not weeks.',
  'markdown',
  'tips',
  '["toast-pos", "menu-setup", "configuration", "modifiers", "pricing"]',
  'Complete Guide to Toast Menu Setup | R&G Consulting',
  'Master Toast POS menu configuration with our comprehensive guide covering menu structure, modifier groups, pricing strategies, and advanced features.',
  'published',
  'R&G Consulting',
  unixepoch(),
  1,
  1
);

-- Article 2: 10 Toast Features You're Not Using (List Article ~1500 words)
INSERT OR IGNORE INTO toast_hub_posts (
  id, slug, title, excerpt, content, content_format, category, tags_json,
  meta_title, meta_description, status, author, published_at, featured, display_order
) VALUES (
  'post_002',
  '10-toast-features-not-using',
  '10 Toast Features You''re Probably Not Using',
  'Unlock the full potential of your Toast POS with these underutilized features that can save time, reduce errors, and boost revenue.',
  '# 10 Toast Features You''re Probably Not Using

**Reading time:** 8 minutes
**Last updated:** January 2026

After working with hundreds of Toast restaurants, we''ve noticed a pattern: most operators use about 40% of what Toast can do. Here are 10 features that could transform your operations.

## What You''ll Learn

- Hidden features that save hours weekly
- Revenue-boosting capabilities
- Time-saving automations
- Reporting tools for better decisions

## 1. Guest Feedback Surveys

**What it does:** Automatically sends satisfaction surveys after orders.

**Why you''re missing out:** Real-time feedback catches problems before they become Yelp reviews. Toast aggregates responses into actionable reports.

**How to enable:** Toast Web → Marketing → Guest Feedback

> **Pro Tip:** Set triggers for specific order types. Online orders benefit most from post-delivery surveys.

## 2. Scheduled Menu Switching

**What it does:** Automatically changes menus based on time of day.

**Why you''re missing out:** Manual menu switches get forgotten. Scheduled switching ensures Happy Hour prices activate at exactly 4pm and deactivate at 7pm.

**Setup:**
1. Create separate menus (Lunch, Dinner, Happy Hour)
2. Set availability windows for each
3. Assign to revenue centers

## 3. Labor Cost Reporting

**What it does:** Calculates real-time labor percentage against sales.

**Why you''re missing out:** Most operators check labor weekly. Toast can show labor-to-sales ratio in real-time, enabling same-day adjustments.

**Access:** Toast Web → Labor → Labor Summary → Real-time view

**Ideal targets:**
- Full Service: 28-32%
- Quick Service: 25-28%
- Fine Dining: 32-38%

## 4. Combo Meals with Forced Modifiers

**What it does:** Creates true combo pricing where customers must select from each category.

**Why you''re missing out:** Most restaurants use discounts instead of proper combos. True combos guarantee every component is selected and properly fired to kitchen.

**Example Setup:**
```
Lunch Combo ($14.99)
├── Pick an Entree [Required]
│   ├── Burger
│   ├── Chicken Sandwich
│   └── Grilled Cheese
├── Pick a Side [Required]
│   ├── Fries
│   ├── Salad
│   └── Soup
└── Pick a Drink [Required]
    ├── Fountain Drink
    ├── Iced Tea
    └── Lemonade
```

## 5. Quick Edit Mode for Managers

**What it does:** Edit menu items directly from the POS without going to Toast Web.

**Why you''re missing out:** Need to 86 an item or change a price? Quick Edit lets managers make changes in seconds without a computer.

**Enable:** Manager Passcode → Quick Edit → Toggle items and prices

## 6. Pre-Authorization for Tabs

**What it does:** Authorizes cards when tabs are opened without charging.

**Why you''re missing out:** Walk-outs cost hundreds annually. Pre-auth ensures every tab has a valid payment method.

**Benefits:**
- Reduce walkouts by 95%+
- Faster checkout (card already on file)
- Better cash flow management

## 7. Kitchen Display System Prep Times

**What it does:** Tracks how long each item takes to prepare.

**Why you''re missing out:** This data reveals bottlenecks. If steaks average 18 minutes but chicken averages 8 minutes, you know why tables with both items wait.

**View:** Toast Web → Kitchen → Prep Time Analysis

## 8. Automated 86 Notifications

**What it does:** Sends alerts when items are 86''d.

**Why you''re missing out:** Servers keep trying to sell items that are out. Automated notifications ensure everyone knows instantly.

**Setup:** Toast Web → Notifications → 86 Alerts → Add recipients

## 9. Employee Meal Discounts

**What it does:** Applies automatic discounts for employee purchases.

**Why you''re missing out:** Manual comps are inconsistent and hard to track. Automatic employee discounts apply correctly every time and appear in reports.

**Configure:**
1. Create "Employee Meal" discount
2. Set percentage or dollar amount
3. Assign to employee meal jobs

## 10. Order Throttling for Online

**What it does:** Limits orders when kitchen is overwhelmed.

**Why you''re missing out:** Friday rush + 50 online orders = disaster. Order throttling automatically extends prep times or pauses online orders when volume spikes.

**Settings:**
- Max orders per 15-minute window
- Extended prep times when busy
- Automatic pause threshold

## Bonus: Toast Reporting You Should Run Weekly

| Report | Why It Matters |
|--------|---------------|
| Product Mix | Know your top and bottom sellers |
| Void Summary | Catch training issues or theft |
| Labor vs Sales | Optimize scheduling |
| Server Sales | Identify top performers |
| Discount Summary | Track coupon usage |

## How to Get Started

1. Pick ONE feature from this list
2. Enable it this week
3. Train staff on the change
4. Measure impact for 2 weeks
5. Move to the next feature

Trying to implement everything at once leads to chaos. Steady improvement beats dramatic overhaul.

---

**Want a full Toast optimization audit?** [Schedule a consultation](/contact) and we''ll review your setup, identify gaps, and create an implementation roadmap.',
  'markdown',
  'tips',
  '["toast-features", "optimization", "hidden-features", "restaurant-efficiency"]',
  '10 Toast POS Features You''re Not Using | R&G Consulting',
  'Discover 10 underutilized Toast POS features that can save time, reduce errors, and boost revenue at your restaurant.',
  'published',
  'R&G Consulting',
  unixepoch(),
  1,
  2
);

-- Article 3: Troubleshooting Toast Printer Issues (How-To ~1000 words)
INSERT OR IGNORE INTO toast_hub_posts (
  id, slug, title, excerpt, content, content_format, category, tags_json,
  meta_title, meta_description, status, author, published_at, featured, display_order
) VALUES (
  'post_003',
  'troubleshooting-toast-printer-issues',
  'Troubleshooting Toast Printer Issues: Complete Fix Guide',
  'Fix Toast printer problems fast with this step-by-step troubleshooting guide covering connection issues, paper jams, and configuration errors.',
  '# Troubleshooting Toast Printer Issues: Complete Fix Guide

**Reading time:** 6 minutes
**Last updated:** January 2026

Printer problems are the #1 support call we receive. When the kitchen can''t see tickets, everything stops. This guide helps you fix 90% of printer issues without calling support.

## What You''ll Learn

- Quick fixes for common problems
- Network troubleshooting steps
- When to replace vs. repair
- Preventive maintenance tips

## Quick Diagnostic

Before diving deep, try these in order:

1. **Power cycle the printer** - Turn off, wait 10 seconds, turn on
2. **Check the paper** - Is it loaded correctly? Thermal side up?
3. **Print a test ticket** - From Toast Web, not the terminal
4. **Check connections** - Ethernet cable secure? Router powered?

> **Pro Tip:** 70% of printer issues resolve with a simple power cycle. Always try this first.

## Problem: Printer Not Printing

### Check 1: Is it online?

Look at the printer status light:
- **Green** = Online, ready
- **Blinking** = Processing or error
- **Red/Orange** = Error state
- **Off** = No power

### Check 2: Network connection

1. Unplug Ethernet cable from printer
2. Plug into a laptop
3. Can you access Toast Web? If no, router issue
4. If yes, printer network card may be faulty

### Check 3: Toast Configuration

Toast Web → Hardware → Printers
- Is the printer showing "Online"?
- Is the IP address correct?
- Try "Print Test Page"

### Check 4: Firewall/Network

Toast printers need these ports open:
- Port 9100 (RAW printing)
- Port 631 (IPP)

## Problem: Printing Garbled Text

This usually indicates:

1. **Wrong driver** - Ensure Toast is set for your printer model
2. **Firmware issue** - Update printer firmware
3. **Cable damage** - Try a different Ethernet cable

**Fix:**
```
1. Note printer IP address
2. Toast Web → Hardware → Delete printer
3. Re-add printer with correct model
4. Print test page
```

## Problem: Partial Tickets

Tickets cut off mid-print:

1. **Paper width mismatch** - 80mm paper in 58mm printer
2. **Template too wide** - Adjust ticket template margins
3. **Memory overflow** - Printer buffer full from large order

**Fix:**
- Verify paper matches printer spec
- Toast Web → Templates → Reduce font size or margins
- Power cycle to clear buffer

## Problem: Tickets Going to Wrong Printer

Kitchen tickets printing at bar? Check:

1. **Routing rules** - Toast Web → Routing → Review item assignments
2. **Printer assignments** - Each station needs correct printer
3. **Revenue center settings** - Different areas may have different routing

## Problem: Intermittent Connection

Printer works sometimes, fails randomly:

### Network Issues
- IP conflict (two devices same IP)
- Weak WiFi signal (if using WiFi adapter)
- Router overloaded
- Ethernet cable intermittently failing

### Fix: Static IP Assignment

1. Find printer MAC address (on label or network config)
2. Router admin → DHCP → Reserve IP for MAC
3. Toast Web → Update printer IP if changed

## Preventive Maintenance

### Daily
- Check paper levels before service
- Clear paper dust from cutter

### Weekly
- Clean print head with alcohol wipe
- Check cable connections
- Verify test print works

### Monthly
- Update firmware if available
- Review error logs in Toast Web
- Clean interior with compressed air

## When to Replace

Replace the printer if:
- Print head produces faded output despite cleaning
- Network card fails repeatedly
- Physical damage to cutter mechanism
- Age > 5 years with heavy use

**Recommended:** Epson TM-T88VI or Star TSP143III

## Emergency Workarounds

Kitchen printer dies during rush:

### Option 1: Redirect to another printer
Toast Web → Hardware → Edit routing to backup printer

### Option 2: Use KDS
If you have Kitchen Display, tickets continue there

### Option 3: Verbal fire
Assign one server to verbally communicate orders (last resort)

## Printer Quick Reference

| Model | Paper | Port | Reset |
|-------|-------|------|-------|
| Epson TM-T88 | 80mm | 9100 | Hold Feed + Power |
| Star TSP100 | 80mm/58mm | 9100 | Hold Feed + Power |
| Star SP700 | 76mm | 9100 | Switch on back |
| Epson TM-U220 | 76mm | 9100 | Hold Feed + Power |

---

**Still stuck?** [Contact us](/contact) for same-day Toast support. Our technicians can remote-diagnose printer issues in minutes.',
  'markdown',
  'troubleshooting',
  '["toast-printer", "troubleshooting", "printer-issues", "technical-support"]',
  'Toast Printer Troubleshooting Guide | Fix Common Issues | R&G Consulting',
  'Fix Toast POS printer problems quickly with our step-by-step troubleshooting guide covering connection issues, paper jams, and configuration errors.',
  'published',
  'R&G Consulting',
  unixepoch(),
  0,
  3
);

-- Article 4: Menu Engineering - Psychology of Pricing (Educational ~1500 words)
INSERT OR IGNORE INTO toast_hub_posts (
  id, slug, title, excerpt, content, content_format, category, tags_json,
  meta_title, meta_description, status, author, published_at, featured, display_order
) VALUES (
  'post_004',
  'menu-engineering-psychology-pricing',
  'Menu Engineering: The Psychology of Restaurant Pricing',
  'Learn how menu psychology influences customer decisions and how to engineer your menu for higher profits using proven strategies.',
  '# Menu Engineering: The Psychology of Restaurant Pricing

**Reading time:** 9 minutes
**Last updated:** January 2026

Menu engineering is the science of designing menus that maximize profitability while improving guest satisfaction. It combines psychology, data analysis, and design principles to guide customer choices.

## What You''ll Learn

- How customers actually read menus
- The menu engineering matrix (Stars, Plowhorses, Puzzles, Dogs)
- Pricing psychology that works
- Layout strategies that boost profits

## How Customers Read Menus

Eye-tracking studies reveal customers don''t read menus left-to-right like books. Instead:

### The Golden Triangle

On a single-page menu, eyes go:
1. **Middle** (first look)
2. **Top right** (second look)
3. **Top left** (third look)

This "golden triangle" is premium real estate. Place your highest-margin items here.

### Two-Panel Menus

1. **Top right of right panel** (prime spot)
2. **Top left of left panel**
3. **Bottom of either panel** (least viewed)

> **Pro Tip:** Never put your best items at the bottom of a list. Customers rarely scroll past item 7 on any section.

## The Menu Engineering Matrix

Classify every item by two metrics:
- **Popularity:** How often it sells
- **Profitability:** Contribution margin (price - food cost)

This creates four categories:

### Stars (High Popularity, High Profit)
Your winners. Protect and promote these.
- Feature prominently
- Never discount
- Train servers to suggest

### Plowhorses (High Popularity, Low Profit)
Customers love them, but they hurt margins.
- Raise prices gradually
- Reduce portion slightly
- Pair with high-margin add-ons

### Puzzles (Low Popularity, High Profit)
Great margins, but nobody orders them.
- Improve descriptions
- Rename if necessary
- Have servers actively sell
- Consider repositioning on menu

### Dogs (Low Popularity, Low Profit)
Neither popular nor profitable.
- Remove from menu
- Replace with new items
- Keep only if operationally necessary (kids menu staple)

## Pricing Psychology Tactics

### 1. Remove Dollar Signs

**$12.00** vs **12**

Studies show removing currency symbols makes prices feel less painful. Guests spend 8% more on average.

### 2. Use Charm Pricing Strategically

- **$9.99** signals value/discount
- **$10.00** signals quality
- **$10** (no decimals) signals premium

Match pricing style to your brand positioning.

### 3. Price Anchoring

Place a very high-priced item near items you want to sell:

```
Wagyu Ribeye   $89
NY Strip       $42  ← Looks reasonable by comparison
Filet Mignon   $48
```

The $89 steak makes $42 seem like a deal.

### 4. Decoy Pricing

Offer three sizes where the middle option is the best deal:

```
Small   $8  (12 oz)
Medium  $10 (20 oz)  ← Best value, most ordered
Large   $14 (24 oz)
```

The large makes medium look smart. The small makes medium look generous.

### 5. Bundle to Obscure

When customers can''t calculate individual item prices, they focus on overall value:

```
Date Night for Two: $79
(Includes: 2 appetizers, 2 entrees, 1 dessert, bottle of wine)
```

Individual items might total $65, but the "experience" justifies the premium.

## Description Psychology

### Use Sensory Language

**Bad:** "Grilled Salmon"
**Better:** "Wild-Caught Atlantic Salmon, Cedar-Planked, with Lemon-Dill Butter"

Sensory words (cedar-planked, wild-caught) increase perceived value and willingness to pay.

### Invoke Nostalgia

"Grandma''s Recipe" or "Family Secret" creates emotional connection.

### Name the Source

"Snake River Farms Beef" or "Local Cape Cod Oysters" justifies premium pricing.

### Keep It Scannable

- 2-3 lines maximum per item
- Bold the item name
- Price at end of description (not aligned in column)

## Layout Optimization

### Box the Stars

Put a subtle box or border around high-margin items. This draws attention without feeling salesy.

### Use Photos Sparingly

- Fine dining: No photos (looks cheap)
- Casual dining: 1-2 photos maximum
- QSR: Photos can increase sales 30%

### White Space Matters

Cluttered menus overwhelm. Give each section breathing room.

### Strategic Placement

| Position | Best For |
|----------|----------|
| First item in category | High margin |
| Last item in category | Second-highest margin |
| Middle items | Plowhorses (will sell anyway) |

## Implementing in Toast

Toast makes menu engineering actionable:

### Pull the Data
Toast Web → Product Mix Report
- Sort by quantity sold (popularity)
- Export to calculate contribution margin

### Make Changes
Once you identify Stars, Plowhorses, Puzzles, Dogs:
1. Update item descriptions
2. Adjust pricing
3. Change display order
4. Remove Dogs

### Measure Results
Wait 4-6 weeks, then:
- Run Product Mix again
- Compare item movement
- Calculate new margins

## Common Mistakes

### 1. Price Increases Too Dramatic
Raise prices 3-5% twice rather than 10% once.

### 2. Ignoring Food Costs
Great sales mean nothing if margin is 15%. Target 28-32% food cost.

### 3. Too Many Items
More choices = decision paralysis. 7-10 items per category maximum.

### 4. Emotion-Free Descriptions
"Chicken Parmesan - $18" doesn''t sell. Tell a story.

---

**Ready to engineer your menu?** [Schedule a menu analysis](/contact) with our consultants. We''ll review your sales data, calculate true margins, and redesign for profit.',
  'markdown',
  'menu-engineering',
  '["menu-engineering", "pricing-strategy", "restaurant-psychology", "profitability"]',
  'Menu Engineering: Psychology of Restaurant Pricing | R&G Consulting',
  'Learn proven menu engineering strategies including pricing psychology, the menu matrix, and layout optimization to increase restaurant profits.',
  'published',
  'R&G Consulting',
  unixepoch(),
  1,
  4
);

-- Article 5: Why We Started R&G Consulting (Story ~800 words)
INSERT OR IGNORE INTO toast_hub_posts (
  id, slug, title, excerpt, content, content_format, category, tags_json,
  meta_title, meta_description, status, author, published_at, featured, display_order
) VALUES (
  'post_005',
  'why-we-started-rg-consulting',
  'Why We Started R&G Consulting',
  'The story behind R&G Consulting: from restaurant floors to Toast expertise, and why we''re passionate about helping restaurant operators succeed.',
  '# Why We Started R&G Consulting

**Reading time:** 5 minutes
**Last updated:** January 2026

Every consulting firm has an origin story. Ours starts with frustration.

## The Problem We Saw

After years working in restaurants and technology, one pattern became painfully clear: **restaurant operators were being underserved**.

The POS industry had a gap. On one side, you had sales reps pushing hardware and disappearing after installation. On the other, you had expensive consultants charging $300/hour for basic advice.

Nobody was offering:
- **Ongoing support** at reasonable rates
- **Deep technical expertise** with operational understanding
- **A partner** invested in the restaurant''s success

## The Breaking Point

The final straw came watching a friend''s restaurant struggle with their Toast implementation. They''d paid thousands for installation, but:

- Menu was configured by someone who''d never worked a service
- Modifiers made ordering confusing, not easier
- Kitchen routing sent tickets to wrong stations
- Reports were set up but nobody knew how to read them

Six months in, they were still using Toast like a glorified cash register. All that capability, sitting unused.

We fixed their setup in a weekend. Order accuracy improved immediately. Ticket times dropped. Servers stopped calling managers for every modification.

That''s when it clicked: **restaurants need ongoing optimization, not just installation**.

## Our Approach

R&G Consulting was built on three principles:

### 1. Operational Experience Matters

Our team has worked restaurants - front and back of house. When we configure a modifier group, we think about the server tapping through it during a Friday rush. When we set up KDS routing, we think about the line cook''s sight lines.

Technology configured by technologists misses these details. Technology configured by operators gets them right.

### 2. Relationships Over Transactions

The big POS vendors treat restaurants as revenue metrics. Close the sale, move on, upsell next quarter.

We treat restaurants as partners. Our Restaurant Guardian support plans mean we''re accountable monthly. If your Toast isn''t working well, we feel it in retention. That alignment creates better outcomes.

### 3. Honest Guidance

We''ll tell you when Toast isn''t the right fit. We''ll tell you when your problem is operational, not technological. We''ll recommend competitors if they''re better for your situation.

Our reputation depends on trust, not closing deals.

## Who We Help

Our clients tend to share characteristics:

- **Toast users** who want more from their investment
- **Restaurants preparing for Toast** who want it done right the first time
- **Operators drowning in complexity** who need someone to simplify
- **Multi-location groups** who need consistent configuration across sites

We work with everyone from single-unit independents to regional chains with 20+ locations.

## The Restaurant Guardian Program

Our signature offering is Restaurant Guardian - monthly support plans that include:

- **Unlimited configuration changes** - Menu updates, routing changes, new hardware
- **Proactive optimization** - We review your reports and suggest improvements
- **Priority support** - Same-day response, often same-hour
- **Training resources** - Staff turnover? We help onboard new team members

Plans start at $495/month. Most clients see ROI within weeks through improved efficiency and reduced errors.

## Based on Cape Cod, Serving Nationwide

We''re headquartered on Cape Cod, Massachusetts, but work with restaurants across the country. Remote support handles 95% of needs. For implementations and major projects, we travel.

The Cape Cod restaurant community shaped our approach. Seasonal businesses with extreme swings. Independent operators competing against chains. Tight margins where every optimization matters.

If we can help a Cape Cod seasonal restaurant thrive, we can help anyone.

## What''s Next

We''re building more than a consulting firm. Toast Hub (this site) shares our knowledge freely. We believe education should be accessible, and clients who understand their tools become better partners.

Our vision: every Toast restaurant operating at its full potential. Not because they''re paying premium consultants, but because best practices are widely known and easily implemented.

---

**Ready to talk?** [Schedule a free discovery call](/contact) and let''s discuss how we can help your restaurant.',
  'markdown',
  'case-studies',
  '["about-us", "rg-consulting", "company-story", "toast-consulting"]',
  'Why We Started R&G Consulting | Toast POS Experts',
  'Learn the story behind R&G Consulting - from restaurant operations to Toast POS expertise, and our mission to help restaurants succeed.',
  'published',
  'R&G Consulting',
  unixepoch(),
  1,
  5
);

-- ============================================
-- 1.3 EXPAND FAQ SECTION (25+ Total)
-- ============================================
-- 4 FAQs exist, adding 21+ more

-- Toast Basics (IDs faq_005 - faq_014)
INSERT OR IGNORE INTO toast_hub_faqs (id, question, answer, category, display_order, is_active) VALUES
  ('faq_005', 'What hardware does Toast POS require?', 'Toast runs on proprietary Android-based terminals including the Toast Flex, Toast Go handheld, and Toast Tap payment devices. You''ll also need receipt printers (thermal recommended), and optionally Kitchen Display Systems (KDS), customer-facing displays, and kiosk stations. Toast hardware is purpose-built for restaurants and includes spill resistance and enterprise-grade durability.', 'general', 5, 1),
  ('faq_006', 'Is Toast POS cloud-based or local?', 'Toast is a hybrid system. Data syncs to the cloud for reporting and remote access, but terminals can continue operating during internet outages using local caching. This means you can still take orders and payments even when offline - data syncs automatically when connectivity returns.', 'general', 6, 1),
  ('faq_007', 'What''s the difference between Toast POS and Toast Payroll?', 'Toast POS handles front-of-house operations (ordering, payments, menu management), while Toast Payroll is a separate add-on for managing employee pay, tax withholdings, and compliance. They integrate seamlessly - clock-in data from POS flows directly into payroll calculations.', 'general', 7, 1),
  ('faq_008', 'Can Toast handle multiple locations?', 'Yes, Toast is built for multi-location operations. You can manage all locations from a single Toast Web dashboard, maintain consistent menus across sites or customize per-location, run consolidated reports, and control user permissions by location. Enterprise features include centralized purchasing and inventory.', 'general', 8, 1),
  ('faq_009', 'Does Toast work for food trucks and pop-ups?', 'Toast offers mobile solutions including Toast Go handhelds with integrated payment processing, and can operate on cellular connections or WiFi hotspots. For temporary locations, portable setups can be configured for events, farmers markets, or seasonal operations.', 'general', 9, 1),
  ('faq_010', 'What integrations does Toast support?', 'Toast integrates with major platforms including DoorDash, Uber Eats, Grubhub for delivery; 7shifts, HotSchedules for scheduling; Quickbooks, Xero for accounting; Resy, OpenTable for reservations; and many more through the Toast Partner Ecosystem. Custom API integrations are also available.', 'general', 10, 1);

-- Implementation Questions (IDs faq_011 - faq_015)
INSERT OR IGNORE INTO toast_hub_faqs (id, question, answer, category, display_order, is_active) VALUES
  ('faq_011', 'Do I need to shut down during Toast installation?', 'A full shutdown isn''t required. Most installations are completed during off-hours or slow periods. Hardware can be staged in advance, and the actual switchover typically happens between lunch and dinner service. We recommend planning for a 2-4 hour window for final go-live.', 'implementation', 11, 1),
  ('faq_012', 'Can I keep my existing payment processor with Toast?', 'Toast requires using Toast Payments for credit card processing - you cannot use an outside processor. However, Toast Payments offers competitive rates, next-day funding, and integrated reporting. The all-in-one approach eliminates reconciliation headaches between separate POS and payment systems.', 'implementation', 12, 1),
  ('faq_013', 'How do I train my staff on Toast?', 'Toast includes online training modules (Toast University), and most operators supplement with hands-on training during soft launch periods. R&G Consulting offers comprehensive staff training sessions covering both front and back of house operations, including managers and administrators.', 'implementation', 13, 1),
  ('faq_014', 'What data can I migrate from my old POS?', 'Menu items, modifier groups, and pricing can usually be migrated. Historical sales data migration is limited - Toast starts fresh for sales reporting. Customer data, gift card balances, and loyalty points may be transferable depending on your previous system. We recommend exporting detailed reports from your old system before switchover.', 'implementation', 14, 1),
  ('faq_015', 'Can Toast import my menu from a PDF or spreadsheet?', 'While Toast doesn''t have direct PDF import, menu data can be prepared in spreadsheets and imported using Toast''s menu import tools. R&G Consulting offers menu digitization services where we convert your PDF menu into a properly structured Toast menu complete with modifiers, pricing, and routing.', 'implementation', 15, 1);

-- Pricing & Services (IDs faq_016 - faq_020)
INSERT OR IGNORE INTO toast_hub_faqs (id, question, answer, category, display_order, is_active) VALUES
  ('faq_016', 'What does Toast POS cost per month?', 'Toast offers several tiers: Starter (free software, pay-as-you-go processing), Essentials ($69/month), Growth ($165/month), and custom Enterprise pricing. Hardware is additional - expect $500-$2000 per terminal depending on configuration. Total cost varies significantly based on features and hardware needs.', 'pricing', 16, 1),
  ('faq_017', 'What are R&G Consulting''s rates?', 'Our Restaurant Guardian support plans range from $350/month (Core) to $800/month (Premium) with annual discounts available. One-time project work is billed at $175/hour standard, $200/hour on-site (2-hour minimum), or $250/hour for emergencies. Volume discounts apply for multi-location groups.', 'pricing', 17, 1),
  ('faq_018', 'Is there a contract for R&G support plans?', 'Monthly plans require no long-term commitment - cancel anytime with 30-day notice. Quarterly and annual prepaid plans offer discounts of 5% and 15% respectively, but are non-refundable for unused months. We''re confident you''ll stay because of value, not contract obligations.', 'pricing', 18, 1),
  ('faq_019', 'Do you offer a la carte services or only monthly plans?', 'Both. Monthly plans provide the best value for ongoing optimization needs. One-time projects like menu rebuilds, implementation support, or training sessions can be scoped separately. Many clients start with a project and transition to monthly support afterward.', 'pricing', 19, 1),
  ('faq_020', 'What''s included in the Toast implementation package?', 'Our implementation support includes menu configuration, hardware setup assistance, modifier and routing optimization, staff training (virtual or on-site), and 30 days of post-launch support. We coordinate with Toast directly but don''t resell hardware - you purchase through Toast or authorized dealers.', 'pricing', 20, 1);

-- Support Plans (IDs faq_021 - faq_025)
INSERT OR IGNORE INTO toast_hub_faqs (id, question, answer, category, display_order, is_active) VALUES
  ('faq_021', 'What''s the response time for support requests?', 'Core plan: Next business day. Professional plan: Same business day. Premium plan: 2-hour response during business hours, 4-hour after hours. Emergency issues (system down, can''t take payments) receive priority regardless of plan tier.', 'support', 21, 1),
  ('faq_022', 'Can you make changes remotely or do you need to visit?', 'About 95% of our work is done remotely through Toast Web and secure screen sharing. Menu changes, reporting, user management, and most troubleshooting require no on-site visit. Hardware issues, network problems, and initial installations may require on-site support.', 'support', 22, 1),
  ('faq_023', 'Do you provide after-hours support?', 'Professional and Premium plans include after-hours support for urgent issues. Core plan provides business hours support only (Mon-Fri 9am-6pm EST). All plans can request emergency support outside normal hours at the emergency hourly rate ($250/hour).', 'support', 23, 1),
  ('faq_024', 'What if I have an issue Toast should handle under warranty?', 'We''ll diagnose and determine whether the issue is configuration (we handle), hardware warranty (Toast handles), or requires Toast engineering. We can coordinate with Toast support on your behalf and often resolve issues faster than going through general support channels.', 'support', 24, 1),
  ('faq_025', 'How do I submit a support request?', 'Email support@ccrestaurantconsulting.com, call 774-408-0083, or use the client portal for ticket submission and tracking. Premium clients receive a dedicated Slack channel for real-time communication during business hours.', 'support', 25, 1);

-- Troubleshooting FAQs (IDs faq_026 - faq_030)
INSERT OR IGNORE INTO toast_hub_faqs (id, question, answer, category, display_order, is_active) VALUES
  ('faq_026', 'My Toast terminal is frozen - what should I do?', 'First, try a soft reset by pressing and holding the power button for 10 seconds. If that doesn''t work, unplug the power cable, wait 30 seconds, and plug back in. If the terminal repeatedly freezes, it may need a factory reset or hardware replacement - contact support.', 'troubleshooting', 26, 1),
  ('faq_027', 'Orders aren''t printing to the kitchen - how do I fix this?', 'Check these in order: 1) Is the printer powered on and online? 2) Is there paper loaded correctly? 3) In Toast Web, is the printer showing "Online"? 4) Are routing rules configured correctly for those menu items? Most kitchen printing issues are routing misconfigurations or network problems.', 'troubleshooting', 27, 1),
  ('faq_028', 'Why aren''t my credit card payments going through?', 'Check your internet connection first - payments require connectivity. If connected, verify the payment terminal is properly paired. Common causes: merchant account holds (call Toast Payments), card reader needs cleaning, or terminal needs restart. For persistent issues, contact Toast Payments directly.', 'troubleshooting', 28, 1),
  ('faq_029', 'How do I void or refund a transaction in Toast?', 'To void (same day, not settled): Open the check, tap Void, select reason, enter manager code. To refund (already settled): Toast Web → Orders → Find order → Refund → Enter amount → Process. Refunds take 3-5 business days to appear on customer statements.', 'troubleshooting', 29, 1),
  ('faq_030', 'My reports are showing wrong numbers - what''s happening?', 'Common causes: wrong date range selected, timezone mismatch, filters applied unintentionally, or comparing different report types (net vs gross sales). Start by resetting all filters and verifying date range. If numbers still seem wrong, contact support - there may be a data sync issue.', 'troubleshooting', 30, 1);
