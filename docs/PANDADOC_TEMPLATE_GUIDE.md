# PandaDoc Contract Template Guide
## R&G Consulting / Cape Cod Restaurant Consulting

This guide explains how to create PandaDoc templates that integrate with the Quote Builder automation system.

---

## Template Types Needed

Create these 3 templates in PandaDoc:

| Template Name | Environment Variable | Use Case |
|--------------|---------------------|----------|
| Implementation Services Contract | `PANDADOC_TEMPLATE_IMPLEMENTATION` | On-site Toast installations, networking |
| Support Plan Agreement | `PANDADOC_TEMPLATE_SUPPORT_PLAN` | Monthly Toast Guardian support plans |
| Remote Services Contract | `PANDADOC_TEMPLATE_REMOTE_SERVICES` | National/remote consulting services |

---

## Template Token Reference

The API will automatically merge these tokens into your templates. Use them with the syntax: `{{token_name}}`

### Client Information
| Token | Description | Example |
|-------|-------------|---------|
| `{{client.name}}` | Client's full name | John Smith |
| `{{client.company}}` | Company name | Village Pizza |
| `{{client.email}}` | Email address | john@villagepizza.com |
| `{{client.phone}}` | Phone number | 508-555-1234 |
| `{{client.address}}` | Full address | 123 Main St, Hyannis, MA |

### Quote Information
| Token | Description | Example |
|-------|-------------|---------|
| `{{quote.number}}` | Quote reference number | Q-M3KJ7B |
| `{{quote.date}}` | Quote generation date | January 2, 2026 |
| `{{quote.valid_until}}` | Quote expiration date | February 1, 2026 |
| `{{quote.install_cost}}` | Installation labor cost | $1,650.00 |
| `{{quote.travel_cost}}` | Travel fees | $100.00 |
| `{{quote.support_monthly}}` | Monthly support cost | $165.00 |
| `{{quote.support_annual}}` | Annual support cost | $1,881.00 |
| `{{quote.total_first}}` | Total first payment | $1,915.00 |
| `{{quote.time_min}}` | Minimum hours estimate | 12 |
| `{{quote.time_max}}` | Maximum hours estimate | 18 |

### Service Information
| Token | Description | Example |
|-------|-------------|---------|
| `{{service.type}}` | Type of service | implementation |
| `{{service.lane}}` | Service lane | Lane A - Local Cape Cod |

### Company Information (Your Info)
| Token | Description | Value |
|-------|-------------|-------|
| `{{company.name}}` | Legal entity | R&G Consulting LLC |
| `{{company.dba}}` | DBA name | Cape Cod Restaurant Consulting |
| `{{company.email}}` | Contact email | ramirezconsulting.rg@gmail.com |
| `{{company.phone}}` | Contact phone | 774-408-0083 |
| `{{company.address}}` | Business address | 328 Millstone Road, Brewster, MA 02631 |

---

## Template Structure: Implementation Services Contract

### Page 1: Header & Parties

```
PROFESSIONAL SERVICES AGREEMENT

This Agreement is entered into as of {{quote.date}} by and between:

SERVICE PROVIDER:
{{company.name}}
DBA: {{company.dba}}
{{company.address}}
{{company.email}} | {{company.phone}}

CLIENT:
{{client.company}}
{{client.name}}
{{client.address}}
{{client.email}} | {{client.phone}}

Quote Reference: {{quote.number}}
```

### Page 2: Scope of Services

```
SCOPE OF WORK

Service Type: {{service.type}}
Service Lane: {{service.lane}}

The Service Provider agrees to provide the following services:

[PRICING TABLE - "Service Breakdown"]
This table will be auto-populated from the quote with:
- Description
- Type (hardware, integration, cabling, etc.)
- Amount

ESTIMATED TIMELINE
Minimum: {{quote.time_min}} hours
Maximum: {{quote.time_max}} hours

Note: Actual time may vary based on site conditions and client readiness.
```

### Page 3: Pricing & Payment

```
PRICING SUMMARY

Installation & Configuration:  {{quote.install_cost}}
Travel & Site Visit:           {{quote.travel_cost}}
─────────────────────────────────────────────────
TOTAL DUE AT COMPLETION:       {{quote.total_first}}

OPTIONAL SUPPORT PLAN
Monthly:  {{quote.support_monthly}}/month
Annual:   {{quote.support_annual}}/year (save 5%)

PAYMENT TERMS
- 50% deposit due upon contract signing
- 50% balance due upon project completion
- Support plan billing begins after go-live
- Accepted: Credit Card, ACH, Check
```

### Page 4: Terms & Conditions

```
TERMS AND CONDITIONS

1. SCHEDULING
   Work will be scheduled within 14 business days of deposit receipt,
   subject to mutual availability.

2. CLIENT RESPONSIBILITIES
   - Provide access to premises during scheduled work
   - Ensure stable internet connection (minimum 50 Mbps)
   - Have menu and pricing information ready before installation
   - Designate a point of contact available during installation

3. WARRANTY
   - 30-day warranty on installation labor
   - Hardware covered under manufacturer warranty
   - Software issues addressed under support plan

4. CANCELLATION
   - Cancellation within 48 hours of scheduled work: 50% fee
   - Cancellation with less than 24 hours notice: Full fee
   - Client may reschedule once without penalty

5. LIMITATION OF LIABILITY
   Service Provider's liability is limited to the total amount paid
   under this Agreement.

6. CONFIDENTIALITY
   Both parties agree to keep confidential any proprietary information
   shared during the course of this engagement.

This Agreement constitutes the entire understanding between the parties.
```

### Page 5: Signatures

```
ACCEPTANCE

By signing below, both parties agree to the terms of this Agreement.

CLIENT SIGNATURE
[Signature Block - Role: Client]

Name: {{client.name}}
Title: ___________________
Date: ___________________

SERVICE PROVIDER
[Signature Block - Role: Provider]

Evan M. Ramirez
Owner, R&G Consulting LLC
Date: ___________________
```

---

## Template Structure: Support Plan Agreement

Use similar structure but focus on:

- Monthly/Annual support plan terms
- Response time SLAs
- Covered services
- Exclusions
- Auto-renewal terms

### Key Sections:
1. Support Plan Tier (Essential/Professional/Premium)
2. Response Time Guarantees
3. Covered Services List
4. Monthly/Annual Pricing
5. Billing Terms
6. Cancellation Policy

---

## Setting Up Pricing Tables

In PandaDoc, create a pricing table named **"Service Breakdown"** with these columns:

| Column Name | Type | Notes |
|-------------|------|-------|
| Description | Text | Service description |
| Type | Text | hardware, integration, cabling, etc. |
| Amount | Currency | Cost for this item |

Enable "Data Merge" on the table so the API can populate it.

---

## Signature Block Configuration

For each signature block, set:

| Setting | Value |
|---------|-------|
| Role | Client (for client) / Provider (for you) |
| Required | Yes |
| Signing Order | 1 (client first), 2 (you second) |

---

## After Creating Templates

1. Get each template's UUID from PandaDoc (Settings → Templates → Template Details)
2. Add these as Cloudflare secrets:

```bash
npx wrangler pages secret put PANDADOC_TEMPLATE_IMPLEMENTATION
# Paste the Implementation template UUID

npx wrangler pages secret put PANDADOC_TEMPLATE_SUPPORT_PLAN
# Paste the Support Plan template UUID

npx wrangler pages secret put PANDADOC_TEMPLATE_REMOTE_SERVICES
# Paste the Remote Services template UUID
```

---

## Testing the Integration

1. Use PandaDoc sandbox mode first
2. Generate a test quote in Quote Builder
3. Call `/api/contracts/generate` with test data
4. Verify tokens merge correctly
5. Test signature flow
6. Verify webhook triggers Square invoice

---

## API Flow Reference

```
┌─────────────────┐
│  Quote Builder  │
│  (Client side)  │
└────────┬────────┘
         │ Client accepts quote
         ▼
┌─────────────────┐
│ POST /api/      │
│ contracts/      │
│ generate        │
└────────┬────────┘
         │ Creates PandaDoc document
         ▼
┌─────────────────┐
│    PandaDoc     │
│  Sends email    │
│  for signature  │
└────────┬────────┘
         │ Client signs
         ▼
┌─────────────────┐
│ Webhook:        │
│ document.       │
│ completed       │
└────────┬────────┘
         │ Triggers invoice creation
         ▼
┌─────────────────┐
│  Square API     │
│ Create invoice  │
│ Send to client  │
└─────────────────┘
```

---

*Document Version: 1.0*
*Last Updated: January 2026*
*For: R&G Consulting / Cape Cod Restaurant Consulting*
