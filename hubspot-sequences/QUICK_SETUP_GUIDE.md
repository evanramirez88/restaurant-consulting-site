# HubSpot Sequences - Quick Setup Guide

## Time Required: ~30 minutes for all 6 sequences

---

## Step 1: Access HubSpot Sequences

1. Log into HubSpot: https://app.hubspot.com
2. Go to **Automation** → **Sequences**
3. Click **Create sequence** (blue button, top right)

---

## Step 2: Create Each Sequence

### Sequence 1: Toast Users - Support Plan Offer

**Settings:**
- Name: `Toast Users - Support Plan Offer`
- Folder: Create "Outreach Sequences" folder

**Add 3 emails:**

| Step | Type | Delay | Template File |
|------|------|-------|---------------|
| 1 | Automated email | Immediate | `01-toast-users-support-plan/email-1-day-0.md` |
| 2 | Automated email | 3 days | `01-toast-users-support-plan/email-2-day-3.md` |
| 3 | Automated email | 7 days | `01-toast-users-support-plan/email-3-day-10.md` |

**For each email:**
1. Click "+" → "Automated email"
2. Set delay (after step 1)
3. Copy **SUBJECT LINE** from template file
4. Copy **EMAIL BODY** from template file
5. Click "Save"

---

### Sequence 2: Clover Users - Toast Switch

**Settings:**
- Name: `Clover Users - Toast Switch`

**Add 3 emails:**

| Step | Delay | Template File |
|------|-------|---------------|
| 1 | Immediate | `02-clover-users-toast-switch/email-1-day-0.md` |
| 2 | 3 days | `02-clover-users-toast-switch/email-2-day-3.md` |
| 3 | 7 days | `02-clover-users-toast-switch/email-3-day-10.md` |

---

### Sequence 3: Square Users - Toast Switch

**Settings:**
- Name: `Square Users - Toast Switch`

**Add 3 emails:**

| Step | Delay | Template File |
|------|-------|---------------|
| 1 | Immediate | `03-square-users-toast-switch/email-1-day-0.md` |
| 2 | 3 days | `03-square-users-toast-switch/email-2-day-3.md` |
| 3 | 7 days | `03-square-users-toast-switch/email-3-day-10.md` |

---

### Sequence 4: New Toast Install - Implementation

**Settings:**
- Name: `New Toast Install - Implementation`

**Add 3 emails:**

| Step | Delay | Template File |
|------|-------|---------------|
| 1 | Immediate | `04-new-toast-install/email-1-day-0.md` |
| 2 | 3 days | `04-new-toast-install/email-2-day-3.md` |
| 3 | 4 days | `04-new-toast-install/email-3-day-7.md` |

---

### Sequence 5: Past Client - Referral Request

**Settings:**
- Name: `Past Client - Referral Request`

**Add 2 emails:**

| Step | Delay | Template File |
|------|-------|---------------|
| 1 | Immediate | `05-past-client-referral/email-1-day-0.md` |
| 2 | 14 days | `05-past-client-referral/email-2-day-14.md` |

---

### Sequence 6: Non-Responder Re-engagement

**Settings:**
- Name: `Non-Responder Re-engagement`

**Add 2 emails:**

| Step | Delay | Template File |
|------|-------|---------------|
| 1 | Immediate | `06-non-responder-reengagement/email-1-day-0.md` |
| 2 | 21 days | `06-non-responder-reengagement/email-2-day-21.md` |

---

## Step 3: Configure Sequence Settings

For each sequence, configure:

1. **Sending schedule:**
   - Business hours only: 9 AM - 6 PM EST
   - Skip weekends: Yes
   - Time zone: Eastern Time

2. **Enrollment settings:**
   - Allow re-enrollment: No (default)
   - Unenroll on reply: Yes

3. **Sender:**
   - From: ramirezconsulting.rg@gmail.com
   - Reply-to: Same

---

## Step 4: Get Sequence IDs

After creating all sequences:

1. Click on each sequence name
2. Look at the URL: `app.hubspot.com/sequences/243379742/sequence/XXXXXXXX`
3. The number at the end is the Sequence ID
4. Update `enrollment-api.js` with these IDs:

```javascript
const SEQUENCES = {
  'toast-users-support': 'YOUR_ID_1',
  'clover-users-switch': 'YOUR_ID_2',
  'square-users-switch': 'YOUR_ID_3',
  'new-toast-install': 'YOUR_ID_4',
  'past-client-referral': 'YOUR_ID_5',
  'non-responder': 'YOUR_ID_6'
};
```

---

## Step 5: Test Each Sequence

1. Create a test contact (use your own email)
2. Enroll test contact in each sequence
3. Verify emails arrive with correct formatting
4. Check merge fields populate correctly
5. Unenroll test contact

---

## Step 6: Segment Contacts for Enrollment

Create HubSpot lists for each sequence:

| List Name | Filter Criteria |
|-----------|-----------------|
| Toast Users for Support | `current_pos_system` = Toast |
| Clover Users for Switch | `current_pos_system` = Clover |
| Square Users for Switch | `current_pos_system` = Square |
| New Toast Implementations | `pos_migration_status` = Planning Migration |
| Past Clients for Referral | `lifecycle_stage` = Customer |
| Non-Responders | `engagement_status` = Cold, `last_outreach_date` > 30 days ago |

---

## Enrollment Targets (OPERATION BREAKOUT)

| Week | Daily Enrollments | Sequence |
|------|-------------------|----------|
| 1 | 100 | Toast Users (primary) |
| 2 | 100 | Mix: 50 Toast, 50 Competitor |
| 3 | 100 | Mix: 33 Toast, 33 Clover, 33 Square |
| 4 | 100 | New Installs + Past Clients |

**Total Week 1-4:** 2,000 contacts enrolled

---

## Tracking & Optimization

Monitor these metrics weekly:

| Metric | Target | Action if Below |
|--------|--------|-----------------|
| Open rate | >25% | Adjust subject lines |
| Response rate | >3% | Adjust body copy |
| Bounce rate | <5% | Clean email list |
| Unsubscribe rate | <1% | Reduce frequency |

---

## Files Created

```
hubspot-sequences/
├── README.md
├── QUICK_SETUP_GUIDE.md (this file)
├── enrollment-api.js
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
└── 06-non-responder-reengagement/
    ├── email-1-day-0.md
    └── email-2-day-21.md
```

---

**TASK_COMPLETE: HubSpot Email Sequences - 6 sequences, 16 emails created**
