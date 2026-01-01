# HubSpot Email Sequences - R&G Consulting

## Overview

This folder contains 6 email sequences for OPERATION BREAKOUT 400K.
HubSpot's API doesn't support programmatic sequence creation, so these templates
are formatted for quick copy-paste into the HubSpot Sequences UI.

## Sequences Summary

| # | Sequence Name | Emails | Duration | Target Segment |
|---|---------------|--------|----------|----------------|
| 1 | Toast Users - Support Plan | 3 | 10 days | Existing Toast users (17,402) |
| 2 | Clover Users - Toast Switch | 3 | 10 days | Clover POS users |
| 3 | Square Users - Toast Switch | 3 | 10 days | Square POS users |
| 4 | New Toast Install | 3 | 7 days | Upcoming implementations (1,616) |
| 5 | Past Client - Referral | 2 | 14 days | Previous clients |
| 6 | Non-Responder Re-engagement | 2 | 21 days | Cold contacts |

## Quick Setup Instructions

### Step 1: Access Sequences
1. Go to HubSpot → Automation → Sequences
2. Click "Create sequence" (top right)

### Step 2: For Each Sequence
1. Name the sequence (use names from table above)
2. Add steps:
   - Click "+" to add a step
   - Choose "Automated email"
   - Copy/paste subject and body from template files
3. Set delays between steps as specified
4. Save and activate

### Step 3: Enroll Contacts
Use the enrollment API endpoint once sequences are created:
```
POST /automation/v4/sequences/enrollments/
```

## File Structure
```
hubspot-sequences/
├── README.md (this file)
├── 01-toast-users-support-plan/
│   ├── email-1-day-0.md
│   ├── email-2-day-3.md
│   └── email-3-day-10.md
├── 02-clover-users-toast-switch/
│   ├── email-1-day-0.md
│   ├── email-2-day-3.md
│   └── email-3-day-10.md
├── 03-square-users-toast-switch/
│   ├── email-1-day-0.md
│   ├── email-2-day-3.md
│   └── email-3-day-10.md
├── 04-new-toast-install/
│   ├── email-1-day-0.md
│   ├── email-2-day-3.md
│   └── email-3-day-7.md
├── 05-past-client-referral/
│   ├── email-1-day-0.md
│   └── email-2-day-14.md
├── 06-non-responder-reengagement/
│   ├── email-1-day-0.md
│   └── email-2-day-21.md
└── enrollment-api.js (Cloudflare Worker for bulk enrollment)
```

## Merge Fields Used
- `{{contact.firstname}}` - Contact's first name
- `{{contact.company}}` - Company name
- `{{contact.current_pos_system}}` - Current POS system

## Important Links
- Scheduling: https://app.acuityscheduling.com/schedule.php?owner=34242148
- Website: https://ccrestaurantconsulting.com
- Phone: 508-247-4936
