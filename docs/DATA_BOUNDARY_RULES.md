# Data Boundary Rules: Personal vs Business Data

## Overview

This document defines strict rules for separating personal data from business data when integrating the DATA_CONTEXT Engine with the Business Brief Intelligence Console. **Violation of these rules could expose private personal information to business systems where it could be seen by business partners or synced to external services.**

---

## Data Classification Matrix

### PERSONAL ONLY (Never sync to Business Brief)
| Data Type | Source | Why Personal |
|-----------|--------|--------------|
| Personal SMS | SMS XML Export | Private conversations with friends/family |
| Personal Calls | Call Log Export | Non-business phone calls |
| Location History | Google Timeline | Private movement patterns |
| Health Data | Google Fit, Sleep as Android | Medical/fitness info |
| Personal Email (evanramirez88@gmail.com) | Gmail | Private correspondence |
| Reddit/Spotify | API | Entertainment/personal interests |
| Personal Calendar Events | Google Calendar | Private appointments |
| Pokemon/Plant Collections | CSV/Photos | Hobbies |
| Personal Bank Accounts | CSV/OFX | Non-business finances |
| ChatGPT Conversations | Export | May contain personal topics |
| Limitless Personal Lifelogs | API | Private conversations |

### BUSINESS ONLY (Safe for Business Brief)
| Data Type | Source | Business Purpose |
|-----------|--------|------------------|
| HubSpot Contacts | HubSpot API | CRM data is business-native |
| HubSpot Deals | HubSpot API | Sales pipeline |
| Square Invoices | Square API | Business billing |
| Square Customers | Square API | Business customers |
| Business Email (ramirezconsulting.rg@gmail.com) | Gmail | Client correspondence |
| Cal.com Bookings | Cal.com API | Business appointments |
| BuiltWith Leads | CSV Export | Business lead data |
| Toast KB Articles | Scrape | Industry knowledge |
| Business Calendar Events | Google Calendar | Client meetings |
| Stripe Subscriptions | Stripe API | Subscription billing |

### HYBRID DATA (Requires Filtering)
| Data Type | Source | Rule |
|-----------|--------|------|
| **Phone Calls** | Call Log | Only sync if phone matches HubSpot contact |
| **SMS Messages** | SMS XML | Only sync if phone matches HubSpot contact |
| **Emails** | Gmail | Only sync from ramirezconsulting.rg@gmail.com OR to/from HubSpot contacts |
| **Calendar Events** | Google Calendar | Only sync if title/attendees match business contacts |
| **Limitless Transcripts** | Limitless API | Only sync if participants match business contacts |
| **Location Data** | Timeline | Only sync visits to client locations (match by address) |

---

## Filtering Rules

### Rule 1: Phone Number Matching
Before syncing any phone-based data (SMS, calls) to Business Brief:

```python
def is_business_phone(phone_number: str, db) -> bool:
    """Check if phone belongs to a business contact."""
    # Normalize phone number
    normalized = normalize_phone(phone_number)

    # Check HubSpot contacts
    hubspot_match = db.query(HubSpotContact).filter(
        HubSpotContact.phone.contains(normalized)
    ).first()

    # Check D1 clients
    client_match = db.query(Client).filter(
        Client.phone.contains(normalized)
    ).first()

    # Check D1 leads
    lead_match = db.query(RestaurantLead).filter(
        RestaurantLead.phone.contains(normalized)
    ).first()

    return bool(hubspot_match or client_match or lead_match)
```

### Rule 2: Email Address Filtering
```python
BUSINESS_EMAIL_DOMAINS = [
    'ramirezconsulting.rg@gmail.com',  # Primary business email
]

BUSINESS_DOMAIN_PATTERNS = [
    '@toasttab.com',
    '@squareup.com',
    # Add client domains as discovered
]

def is_business_email(email_address: str, direction: str, db) -> bool:
    """Check if email should be synced to business."""
    # Business account emails always sync
    if any(email_address.lower() == be.lower() for be in BUSINESS_EMAIL_DOMAINS):
        return True

    # Check if correspondent is a HubSpot contact
    contact_match = db.query(HubSpotContact).filter(
        HubSpotContact.email == email_address.lower()
    ).first()

    # Check if correspondent is a D1 client
    client_match = db.query(Client).filter(
        Client.email == email_address.lower()
    ).first()

    return bool(contact_match or client_match)
```

### Rule 3: Calendar Event Filtering
```python
PERSONAL_CALENDAR_KEYWORDS = [
    'personal', 'doctor', 'dentist', 'family', 'birthday',
    'vacation', 'pto', 'sick', 'gym', 'workout', 'therapy',
    'date', 'dinner with'  # non-work dinners
]

def is_business_event(event: CalendarEvent, db) -> bool:
    """Determine if calendar event is business-related."""
    title_lower = event.title.lower()

    # Explicitly personal
    for keyword in PERSONAL_CALENDAR_KEYWORDS:
        if keyword in title_lower:
            return False

    # Check attendees against business contacts
    for attendee in event.attendees:
        if is_business_email(attendee['email'], 'outbound', db):
            return True

    # Check if title mentions a business contact or company
    # ...

    return False  # Default to personal if uncertain
```

### Rule 4: Limitless Transcript Filtering
```python
def is_business_transcript(transcript, db) -> bool:
    """Determine if Limitless transcript is business-related."""
    # Check if any mentioned names match business contacts
    if transcript.participants:
        for participant in transcript.participants:
            # Fuzzy match against HubSpot/D1 contacts
            if match_contact_name(participant, db):
                return True

    # Check for business keywords in summary
    BUSINESS_KEYWORDS = [
        'client', 'restaurant', 'toast', 'pos', 'menu',
        'invoice', 'quote', 'contract', 'project', 'support'
    ]

    if transcript.summary:
        for keyword in BUSINESS_KEYWORDS:
            if keyword in transcript.summary.lower():
                return True

    return False  # Default to personal
```

---

## Data Flow Rules

### What FLOWS INTO Business Brief Intelligence Console

| Source | What Syncs | What Filters Out |
|--------|-----------|------------------|
| DATA_CONTEXT SMS | Messages to/from business contacts | Personal messages |
| DATA_CONTEXT Calls | Calls with business contacts | Personal calls |
| DATA_CONTEXT Gmail | Business account emails only | Personal email account |
| DATA_CONTEXT Calendar | Business meetings | Personal appointments |
| DATA_CONTEXT Limitless | Business-related transcripts | Personal conversations |
| DATA_CONTEXT Location | Client location visits only | Personal location history |

### What NEVER Leaves DATA_CONTEXT

- Personal SMS messages
- Personal call logs
- Health/fitness data
- Personal calendar items
- Location history (except client visits)
- Personal email account
- Entertainment data (Reddit, Spotify)
- Personal finance data
- Hobby collections

---

## Implementation in Intelligence Console API

### context.js Data Boundary Implementation

```javascript
// In /api/admin/intelligence-console/context.js

async function syncFromDataContext(env, options = {}) {
  const { includePersonal = false } = options;

  // CRITICAL: Default is business-only mode
  if (!includePersonal) {
    // Fetch only business-relevant data
    const businessPhones = await getBusinessPhoneNumbers(env);
    const businessEmails = await getBusinessEmailAddresses(env);

    // SMS: Only matching business contacts
    const smsData = await fetchDataContextSMS();
    const filteredSMS = smsData.filter(sms =>
      businessPhones.has(normalizePhone(sms.phone_number))
    );

    // Emails: Only from business account or to business contacts
    const emailData = await fetchDataContextEmails();
    const filteredEmails = emailData.filter(email =>
      email.from === 'ramirezconsulting.rg@gmail.com' ||
      businessEmails.has(email.from) ||
      businessEmails.has(email.to)
    );

    // Store filtered data
    await storeContextItems(env, filteredSMS, 'sms');
    await storeContextItems(env, filteredEmails, 'email');
  }

  return {
    success: true,
    mode: includePersonal ? 'FULL_PERSONAL' : 'BUSINESS_ONLY',
    warning: includePersonal ? 'PERSONAL DATA INCLUDED - HANDLE WITH CARE' : null
  };
}
```

---

## Database Separation

### D1 Tables (Business Data)
- `context_items` - Only business-filtered context
- `intelligence_messages` - AI chat history (no personal data in prompts)
- `intelligence_sessions` - Session metadata only

### DATA_CONTEXT PostgreSQL (All Data)
- Contains ALL personal data
- Never directly exposed to Business Brief
- Only accessed through filtering layer

---

## UI Indicators

### In Business Brief Intelligence Console

1. **Data Source Badges** - Show where each piece of context came from
2. **Business Filter Indicator** - Show "Business Mode" vs "Full Mode" (admin only)
3. **Contact Match Indicator** - Show when SMS/call is matched to a lead/client

### Admin-Only Features

- Toggle to view personal data (requires re-authentication)
- Audit log of data boundary crossings
- Manual classification override (mark item as business/personal)

---

## Sync Process Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     DATA_CONTEXT Engine                      │
│   PostgreSQL + Qdrant + Neo4j (ALL DATA - Personal + Biz)   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │   FILTERING LAYER    │
                   │                      │
                   │ 1. Phone matching    │
                   │ 2. Email filtering   │
                   │ 3. Calendar rules    │
                   │ 4. Transcript filter │
                   └──────────────────────┘
                              │
                              │ (Business-filtered data only)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Cloudflare D1 (Business)                   │
│        context_items, intelligence_sessions, etc.            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                 ┌────────────────────────┐
                 │   Business Brief Tab    │
                 │   Intelligence Console  │
                 │                         │
                 │  - AI Chat              │
                 │  - Lead Enrichment      │
                 │  - Context Search       │
                 └────────────────────────┘
```

---

## Audit Trail Requirements

Every piece of data that crosses from DATA_CONTEXT to D1 must be logged:

```sql
CREATE TABLE context_sync_audit (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  source_type TEXT NOT NULL,      -- 'sms', 'email', 'transcript', etc.
  source_id TEXT NOT NULL,        -- ID in DATA_CONTEXT
  destination_id TEXT,            -- ID in D1 (if stored)
  filter_result TEXT NOT NULL,    -- 'ALLOWED', 'BLOCKED', 'MANUAL_OVERRIDE'
  matched_contact_id TEXT,        -- Which contact triggered the match
  filter_reason TEXT,             -- Why it was allowed/blocked
  synced_by TEXT                  -- 'system' or user ID
);
```

---

## Warning Labels

### In AI Prompts
When personal data is included (admin mode only):

```
⚠️ WARNING: This context includes personal data. Do not share
this response with business partners or external systems.
```

### In Exports
Any data export from Intelligence Console includes:

```
BUSINESS DATA ONLY - Filtered from personal content.
Contact: ramirezconsulting.rg@gmail.com for full data access.
```

---

## Summary

| Rule | Description |
|------|-------------|
| **Default Mode** | Business-only filtering is ALWAYS ON |
| **Phone Match** | SMS/Calls only sync if phone matches HubSpot/D1 contact |
| **Email Filter** | Only business email account or to/from business contacts |
| **Calendar Filter** | Only events with business attendees/keywords |
| **Transcript Filter** | Only conversations mentioning business topics/contacts |
| **Location Filter** | Only visits to client addresses (address match) |
| **Health Data** | NEVER syncs to business systems |
| **Entertainment** | NEVER syncs to business systems |
| **Audit Trail** | ALL boundary crossings are logged |

**The default assumption is PERSONAL until proven BUSINESS.**
