# WEBSITE REVIEW & CHANGE REQUEST FORM
## R&G Consulting - Pre-Launch Review
## Date: January 15, 2026

---

# HOW TO USE THIS FORM

For each item you want to change:
1. Find the section below
2. Look at **CURRENT** text/value
3. Write your **CHANGE TO** in the blank field
4. Mark **PRIORITY**: `[C]` Critical, `[H]` High, `[M]` Medium, `[L]` Low

Leave fields blank if no change needed.

---

# GLOBAL CONSTANTS
**File: `constants.ts`**

These values appear across multiple pages:

| ID | Field | CURRENT VALUE | CHANGE TO | Priority |
|----|-------|---------------|-----------|----------|
| G1 | Company Name | Cape Cod Restaurant Consulting | | |
| G2 | Owner Name | Evan Ramirez | | |
| G3 | Phone Number | (508) 247-4936 | | |
| G4 | Email Address | evanramirez@ccrestaurantconsulting.com | | |

---

# PAGE: HOME (`/`)
**File: `pages/Home.tsx`**

## Hero Section

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| H1 | Main Headline Line 1 | Your POS Crashed Mid-Rush. | | |
| H2 | Main Headline Line 2 (amber) | Never Again. | | |
| H3 | Description Paragraph | Toast POS installation, bulletproof networking, and operational consulting from someone who's worked the line, run the pass, and closed out the registers. When your tech goes down during a 200-cover Saturday, you need someone who's been there—not a call center. | | |
| H4 | Pain Point Tag 1 | ✓ Zero-downtime installations | | |
| H5 | Pain Point Tag 2 | ✓ After-hours support | | |
| H6 | Pain Point Tag 3 | ✓ Menu built your way | | |
| H7 | CTA Button 1 Text | Get a Quote | | |
| H8 | CTA Button 1 Link | /quote | | |
| H9 | CTA Button 2 Text | Book a Discovery Call | | |
| H10 | CTA Button 2 Link | /schedule | | |
| H11 | Trust Indicator 1 | 25+ Cape Cod & New England Restaurants Served | | |
| H12 | Trust Indicator 2 | 10+ Years in Hospitality | | |
| H13 | Trust Indicator 3 | Response Within 2 Hours | | |

## "Why Choose R&G" Section

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| H14 | Section Label | THE R&G DIFFERENCE | | |
| H15 | Section Headline | Your Last IT Guy Made You Explain What "86'd" Means. We Won't. | | |
| H16 | Feature 1 Title | Kitchen-Tested Expertise | | |
| H17 | Feature 1 Description | We've expedited, bartended, and managed—so we build systems that survive a 300-cover night, not just a demo. | | |
| H18 | Feature 2 Title | Your Schedule, Not Ours | | |
| H19 | Feature 2 Description | Need to meet after close? No problem. 60% of our consultations happen evenings and weekends. | | |
| H20 | Feature 3 Title | Transparent Pricing, Fast | | |
| H21 | Feature 3 Description | Get an accurate quote in minutes with our algorithmic pricing tool—no sales calls, no surprises. | | |
| H22 | Link Text | Read Our Story | | |

## Services Overview Section

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| H23 | Section Headline | From Setup to Service—We've Got You Covered | | |
| H24 | Section Subhead | Tech that works is table stakes. We deliver systems that make your team faster, your tickets cleaner, and your margins healthier. | | |
| H25 | Service Card 1 Title | Toast POS Installation | | |
| H26 | Service Card 1 Desc | Hardware, menus, modifiers, and staff trained—all before your next service. No downtime, no chaos. | | |
| H27 | Service Card 2 Title | Networking & IT | | |
| H28 | Service Card 2 Desc | Dual-WAN failover, guest WiFi isolation, and enterprise-grade coverage that handles peak volume. | | |
| H29 | Service Card 3 Title | Operations Consulting | | |
| H30 | Service Card 3 Desc | Ticket routing that makes sense, station setups that flow, and SOPs that stick. Protect your margins. | | |
| H31 | Service Card 4 Title | Emergency Support | | |
| H32 | Service Card 4 Desc | Printer died mid-rush? Network down on a Saturday? We answer nights and weekends—period. | | |

## Client Success Stories Section

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| H33 | Section Label | REAL RESULTS | | |
| H34 | Section Headline | Client Success Stories | | |
| H35 | Section Subhead | From emergency recoveries to complex multi-location deployments—real projects, real outcomes. | | |

### Case Study 1: Emergency Recovery
| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| H36 | Label | Emergency Recovery | | |
| H37 | Title | Seafood Restaurant — Network Failure | | |
| H38 | POS Transition | Toast → Toast (restored/stabilized) | | |
| H39 | Crisis | Complete network failure at noon, day before July 4th weekend | | |
| H40 | Response | On-site within the hour, operational by 5 PM | | |
| H41 | Outcome | Saved their busiest weekend of the year—zero downtime during peak season | | |

### Case Study 2: Historic Diner
| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| H42 | Label | Full Deployment | | |
| H43 | Title | Historic Diner — West Chatham | | |
| H44 | POS Transition | Manual/Cash Register → Toast | | |
| H45 | Challenge | Cash register + handwritten tickets to modern POS system | | |
| H46 | Scope | Complete Toast deployment + operational workflow redesign + staff training | | |
| H47 | Outcome | Seamless transition from analog to digital—staff confident on day one | | |

### Case Study 3: Village Pizza
| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| H48 | Label | Menu Architecture | | |
| H49 | Title | Village Pizza & Ice Cream — Westport | | |
| H50 | POS Transition | Legacy System → Toast | | |
| H51 | Challenge | Pizza modifiers, ice cream combinations, complex sizing/pricing logic | | |
| H52 | Scope | Advanced menu architecture with nested modifiers and dynamic pricing | | |
| H53 | Outcome | First recurring service agreement—now handling all their menu updates | | |

### Case Study 4: Restaurant Group
| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| H54 | Label | Multi-Location | | |
| H55 | Title | Restaurant Group — 3 Concepts | | |
| H56 | POS Transition | Various Systems → Toast (unified platform) | | |
| H57 | Concepts | QSR burger shack, full-service tiki bar, and food truck | | |
| H58 | Scope | Three different service models unified on Toast ecosystem | | |
| H59 | Outcome | Concept-specific configurations with consolidated reporting—owner sees everything | | |

### Case Study 5: Market & Café
| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| H60 | Label | Retail + Food Service | | |
| H61 | Title | Market & Café — Sandwich | | |
| H62 | POS Transition | Legacy System → Toast Retail + Toast | | |
| H63 | Challenge | Grocery retail + deli/cafe operations on single system | | |
| H64 | Scope | Dual-mode Toast configuration for retail and restaurant workflows | | |
| H65 | Outcome | One platform handling both retail inventory and made-to-order cafe items | | |

## Trust Bar Section

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| H66 | Trust Bar Text | Serving Independent Restaurants from Provincetown to Providence | | |
| H67 | Badge 1 | Emergency Recovery | | |
| H68 | Badge 2 | POS Conversions | | |
| H69 | Badge 3 | Complex Menus | | |
| H70 | Badge 4 | Multi-Location | | |

## Final CTA Section

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| H71 | CTA Headline | Stop Losing Sales to Broken Tech | | |
| H72 | CTA Description | Every crashed terminal, slow ticket, and network hiccup costs you money. Let's fix it—before your next rush, not during it. | | |
| H73 | CTA Button 1 | Get Your Free Quote | | |
| H74 | CTA Button 2 | Call Now: (508) 247-4936 | | |

---

# PAGE: SERVICES (`/services`)
**File: `pages/Services.tsx`**

## Header

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| S1 | Page Title | Services & Support Plans | | |
| S2 | Page Subtitle | Professional POS installation, menu configuration, and restaurant networking in Cape Cod. Systems built to survive the Friday night rush. | | |

## Segment Callout: POS Switchers

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| S3 | Headline | Switching from Clover or Square? | | |
| S4 | Description | Menu builds that take Toast corporate 3 weeks? I deliver in 48 hours. I migrate your menu data so you do not have to re-type it, and I handle the configuration based on your actual workflow. | | |
| S5 | Bullet 1 | Zero-downtime migration planning | | |
| S6 | Bullet 2 | Menu and modifier data transfer | | |
| S7 | Bullet 3 | Staff training before go-live | | |
| S8 | CTA Button | Get a Switch Readiness Audit | | |

## Segment Callout: Restaurant Transitions

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| S9 | Headline | Taking Over a Restaurant? | | |
| S10 | Description | Restaurant transitions fail when the tech handoff is fuzzy. I map ownership changes into a zero-downtime checklist: credentials, accounts, training, and vendor handoffs all covered. | | |
| S11 | Bullet 1 | Full system and credential audit | | |
| S12 | Bullet 2 | Overnight cutover execution | | |
| S13 | Bullet 3 | Day-one on-site support | | |
| S14 | CTA Button | Schedule Transition Consultation | | |

## Service: Toast POS Installation

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| S15 | Title | Toast POS Installation & Configuration | | |
| S16 | Description | Don't trust your install to a generic IT contractor. We configure your menu, modifiers, and hardware specifically for your kitchen's workflow. | | |
| S17 | Feature 1 | Hardware deployment (Terminals, KDS, Printers) | | |
| S18 | Feature 2 | Menu engineering and modifier group optimization | | |
| S19 | Feature 3 | Staff training (FOH & BOH specific sessions) | | |
| S20 | Feature 4 | Go-live support | | |

## Service: Restaurant Networking

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| S21 | Title | Restaurant Networking & IT | | |
| S22 | Description | If your internet drops, you can't print tickets. We build redundant, commercial-grade networks designed to handle heavy guest wifi traffic without compromising your POS. | | |
| S23 | Feature 1 | Ubiquiti/Cisco/Meraki configuration | | |
| S24 | Feature 2 | LTE Failover setup (never lose a credit card auth) | | |
| S25 | Feature 3 | Separate Guest/Staff/POS VLANs | | |
| S26 | Feature 4 | Structured cabling & cable management | | |

## Service: Operations Consulting

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| S27 | Title | Operational Consulting | | |
| S28 | Description | The best POS in the world won't fix a bad line setup. We analyze your FOH and BOH operations to reduce ticket times and increase table turns. | | |
| S29 | Feature 1 | Ticket routing analysis | | |
| S30 | Feature 2 | Server station optimization | | |
| S31 | Feature 3 | Bar inventory workflow | | |
| S32 | Feature 4 | Standard Operating Procedures (SOPs) development | | |

## Service: Emergency Support

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| S33 | Title | Emergency Support | | |
| S34 | Description | The 'Restaurant 911'. When things break at 8 PM on a Friday, you need someone who picks up the phone and fixes it immediately. | | |
| S35 | Feature 1 | 24/7 On-call availability (retainer based) | | |
| S36 | Feature 2 | Remote diagnostics & repair | | |
| S37 | Feature 3 | Emergency hardware replacement | | |
| S38 | Feature 4 | Crisis management | | |

## Toast Guardian Support Plans Header

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| S39 | Section Title | Toast Guardian | | |
| S40 | Section Description | When your POS goes down at 7 PM on a Saturday, you need someone who answers the phone. Toast Guardian provides reliable support plans built for Cape Cod restaurants. | | |

## Support Plan: Core ($350/mo)

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| S41 | Plan Name | Core | | |
| S42 | Monthly Price | $350 | | |
| S43 | Annual Price | $3,850 | | |
| S44 | Description | Essential coverage for single-location restaurants with straightforward needs | | |
| S45 | Feature 1 | 1.5 hours per month included | | |
| S46 | Feature 2 | 24-48 hour response time | | |
| S47 | Feature 3 | Email support | | |
| S48 | Feature 4 | Basic monitoring alerts | | |
| S49 | Feature 5 | Quarterly system health check | | |
| S50 | Feature 6 | Knowledge base access | | |

## Support Plan: Professional ($500/mo)

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| S51 | Plan Name | Professional | | |
| S52 | Monthly Price | $500 | | |
| S53 | Annual Price | $5,500 | | |
| S54 | Description | Comprehensive support with faster response and proactive management | | |
| S55 | Feature 1 | 3 hours per month included | | |
| S56 | Feature 2 | 4-hour response SLA | | |
| S57 | Feature 3 | Phone & email support | | |
| S58 | Feature 4 | Google Business Profile management | | |
| S59 | Feature 5 | Monthly system review | | |
| S60 | Feature 6 | 1 on-site visit per quarter | | |

## Support Plan: Premium ($800/mo)

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| S61 | Plan Name | Premium | | |
| S62 | Monthly Price | $800 | | |
| S63 | Annual Price | $8,800 | | |
| S64 | Description | Full-service partnership for high-volume and complex operations | | |
| S65 | Feature 1 | 5 hours per month included | | |
| S66 | Feature 2 | 2-hour response SLA | | |
| S67 | Feature 3 | Emergency after-hours included | | |
| S68 | Feature 4 | Website hosting & maintenance | | |
| S69 | Feature 5 | Third-party coordination (Loman, DoorDash) | | |
| S70 | Feature 6 | 2 on-site visits per quarter | | |
| S71 | Feature 7 | Monthly strategy call | | |
| S72 | Feature 8 | Dedicated Slack channel | | |

---

# PAGE: ABOUT (`/about`)
**File: `pages/About.tsx`**

## Hero Section

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| A1 | Page Title | The Face Behind the Tech | | |
| A2 | Tagline | It's not about the wires. It's about the service. | | |

## Bio Paragraphs

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| A3 | Paragraph 1 | I didn't start in IT; I started in kitchens, working every restaurant position from dishwasher to manager. I know the panic when your KDS or online ordering fails during a rush. | | |
| A4 | Paragraph 2 | That experience shapes how I work. A typical IT vendor sees specs; I see your operation. I know you can't stop for maintenance and need technical problems explained clearly amidst fifty other issues. I know the difference between "fixed" and "fixed right." I became the bridge: fluent in both restaurant and tech. | | |
| A5 | Paragraph 3 | After years in the industry, I specialized in Toast POS because I saw restaurants struggling with vendors who didn't understand their world. | | |
| A6 | Paragraph 4 | Now, I support independent restaurants and small groups across New England. I install systems, fix networks, optimize operations, and provide emergency support—evenings, weekends, whenever. Because I remember being on your side of that 11 PM Friday call. | | |

## Author Card

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| A7 | Author Name | Evan Ramirez | | |
| A8 | Author Title | Owner & Principal Consultant | | |
| A9 | Company Name | R&G Consulting LLC | | |

## Contact Section

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| A10 | Section Title | Get In Touch | | |
| A11 | Section Subtitle | POS down? Call (508) 247-4936 immediately. For everything else, fill out the form below. | | |
| A12 | Location | Cape Cod, Massachusetts | | |
| A13 | Location Subtitle | Serving New England & Remote Nationwide | | |
| A14 | Hours Line 1 | Mon-Fri: 9 AM - 6 PM | | |
| A15 | Hours Note | Emergency Support 24/7 for Contract Clients | | |

---

# PAGE: CONTACT (`/contact`)
**File: `pages/Contact.tsx`**

## Header

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| C1 | Page Title | Contact Your Cape Cod Toast POS Consultant | | |
| C2 | Subtitle | POS down? Call (508) 247-4936 immediately. For everything else, fill out the form below. | | |

## Contact Info Card

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| C3 | Location | Cape Cod, Massachusetts | | |
| C4 | Location Note | Serving Provincetown to Providence. Remote support nationwide. | | |
| C5 | Hours | Mon-Fri: 9 AM - 6 PM | | |
| C6 | Hours Note | Emergency support available for contract clients | | |

---

# PAGE: SCHEDULE (`/schedule`)
**File: `pages/Schedule.tsx`**

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| SC1 | Badge | Book Online 24/7 | | |
| SC2 | Page Title | Schedule a Toast POS Consultation | | |
| SC3 | Page Description | Book time with Cape Cod's Toast POS consultants. Whether it's a quick discovery call or a full project consultation, we'll make time to understand your restaurant's needs. | | |
| SC4 | Appointment 1 Name | Discovery Call (15 min) | | |
| SC5 | Appointment 1 Desc | Quick intro to discuss your restaurant technology challenges and see if we're a good fit. | | |
| SC6 | Appointment 2 Name | Toast POS Support (30 min) | | |
| SC7 | Appointment 2 Desc | Troubleshooting session for menu updates, configuration questions, or technical issues. | | |
| SC8 | Appointment 3 Name | Project Consultation (45 min) | | |
| SC9 | Appointment 3 Desc | In-depth discussion of your project goals, current setup, and roadmap for success. | | |
| SC10 | Flexible Hours Text | We work around your schedule, with most of our meetings taking place in the evening to accommodate service hours. | | |
| SC11 | Urgent Support Title | Need Urgent Support? | | |
| SC12 | Urgent Support Text | POS down during service? Skip the calendar and call directly. | | |
| SC13 | Bottom CTA Title | Not Sure What You Need? | | |
| SC14 | Bottom CTA Text | Start with a free discovery call. We'll figure out the right approach together. | | |

---

# PAGE: LOCAL NETWORKING (`/local-networking`)
**File: `pages/LocalNetworking.tsx`**

## Header

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| LN1 | Page Title | Cape Cod's Only Restaurant-Focused Network Installer | | |
| LN2 | Subtitle | Most IT guys install networks. We install networks that survive the dinner rush. | | |

## Network Support Plans (These connect to Stripe)

| ID | Element | CURRENT VALUE | CHANGE TO | Priority |
|----|---------|---------------|-----------|----------|
| LN3 | Basic Plan Monthly | $150 | | |
| LN4 | Premium Plan Monthly | $300 | | |
| LN5 | Enterprise Plan Monthly | $500 | | |

---

# PAGE: SUPPORT PLANS (`/support-plans`)
**File: `pages/SupportPlans.tsx`**

(Same pricing as Services page - uses same data)

---

# SEO / META CONTENT

| ID | Page | Meta Type | CURRENT VALUE | CHANGE TO | Priority |
|----|------|-----------|---------------|-----------|----------|
| SEO1 | Home | Title | Toast POS Consultant Cape Cod \| R&G Consulting LLC | | |
| SEO2 | Home | Description | Expert Toast POS installation, menu configuration, and restaurant networking in Cape Cod, MA. Get your free quote today! Call (508) 247-4936. | | |
| SEO3 | Services | Title | Toast POS Installation & Support Plans \| Cape Cod Restaurant Consulting | | |
| SEO4 | Services | Description | Professional Toast POS installation, menu configuration, restaurant networking, and ongoing support plans. Toast Guardian support starting at $350/month with quarterly billing. Cape Cod & nationwide remote support. | | |
| SEO5 | About | Title | About & Contact \| Toast POS Consultant Cape Cod | | |
| SEO6 | About | Description | Meet Evan Ramirez, Cape Cod's trusted Toast POS consultant with real restaurant experience. Contact us for POS installation, menu configuration, or networking. Call (508) 247-4936. | | |
| SEO7 | Contact | Title | Contact Toast POS Consultant \| Cape Cod Restaurant Tech | | |
| SEO8 | Contact | Description | Contact Cape Cod's trusted Toast POS consultant. Get help with POS installation, menu configuration, or restaurant networking. Call (508) 247-4936 today! | | |
| SEO9 | Schedule | Title | Schedule a Toast POS Consultation \| Cape Cod Restaurant Tech | | |
| SEO10 | Schedule | Description | Book a free consultation with Cape Cod's Toast POS expert. Discuss POS installation, menu configuration, or networking needs. Flexible scheduling available. | | |

---

# NAVIGATION & FOOTER

| ID | Element | CURRENT TEXT | CHANGE TO | Priority |
|----|---------|--------------|-----------|----------|
| NAV1 | Nav Item 1 | Home | | |
| NAV2 | Nav Item 2 | Services | | |
| NAV3 | Nav Item 3 | Local Networking | | |
| NAV4 | Nav Item 4 | About | | |
| NAV5 | Nav Item 5 | Quote Builder | | |
| NAV6 | Nav Item 6 | Menu Builder | | |
| NAV7 | Nav Item 7 | Schedule | | |
| NAV8 | Nav Item 8 | Contact | | |

---

# BUTTON/LINK ISSUES

| ID | Page | Button Text | Current Behavior | Expected Behavior | Priority |
|----|------|-------------|------------------|-------------------|----------|
| B1 | | | | | |
| B2 | | | | | |
| B3 | | | | | |
| B4 | | | | | |
| B5 | | | | | |

---

# STYLE/DESIGN ISSUES

| ID | Page | Element | Current Style | Desired Style | Priority |
|----|------|---------|---------------|---------------|----------|
| D1 | | | | | |
| D2 | | | | | |
| D3 | | | | | |
| D4 | | | | | |
| D5 | | | | | |

---

# FUNCTIONALITY BUGS

| ID | Page | What You Did | What Happened | What Should Happen | Priority |
|----|------|--------------|---------------|-------------------|----------|
| BUG1 | | | | | |
| BUG2 | | | | | |
| BUG3 | | | | | |
| BUG4 | | | | | |
| BUG5 | | | | | |

---

# MISSING CONTENT / ADD REQUESTS

| ID | Page | Section | What to Add | Priority |
|----|------|---------|-------------|----------|
| ADD1 | | | | |
| ADD2 | | | | |
| ADD3 | | | | |

---

# REMOVE CONTENT REQUESTS

| ID | Page | Section | What to Remove | Priority |
|----|------|---------|----------------|----------|
| REM1 | | | | |
| REM2 | | | | |
| REM3 | | | | |

---

# GENERAL NOTES

```
Note 1:


Note 2:


Note 3:


Note 4:


Note 5:


```

---

# SUBMISSION INSTRUCTIONS

When done:
1. Copy just the rows you filled in (skip empty rows)
2. Paste back to me
3. I will execute all changes in order of priority
4. Changes will be committed and deployed

**Example submission:**
```
| H3 | Description Paragraph | [old text] | New England's premier Toast POS installation team... | [H] |
| S42 | Monthly Price | $350 | $375 | [C] |
| G3 | Phone Number | (508) 247-4936 | (774) 408-0083 | [C] |
```

---

*Form generated January 15, 2026 - All current content extracted from source files*
