# Deduplication & Entity Resolution System

## Overview

The deduplication system provides automated detection and resolution of duplicate contacts and leads across the R&G Consulting platform. It uses similarity scoring algorithms to identify potential duplicates and supports both automated merging and manual review workflows.

## Architecture

### Target Tables

The system monitors these tables for duplicates:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `restaurant_leads` | Prospective restaurant contacts | name, primary_email, primary_phone |
| `clients` | Active clients | name, email, phone |
| `client_profiles` | Extended client info | business_name, contact_email |
| `contact_submissions` | Form submissions | name, email, phone, company |
| `synced_contacts` | Imported contacts | name, email, phone |
| `organizations` | Master company records | legal_name, dba_name |
| `org_contacts` | People at organizations | first_name, last_name, email, phone |

### Database Schema

```
┌─────────────────────────────┐
│  entity_resolution_rules    │  ← Configurable matching rules
├─────────────────────────────┤
│  id, name, source_table,    │
│  target_table, match_fields,│
│  field_weights, thresholds  │
└─────────────────────────────┘
            │
            ▼
┌─────────────────────────────┐
│    duplicate_candidates     │  ← Potential duplicate pairs
├─────────────────────────────┤
│  entity1_table/id,          │
│  entity2_table/id,          │
│  confidence_score, status   │
└─────────────────────────────┘
            │
            ▼ (when merged)
┌─────────────────────────────┐
│     merged_entities         │  ← Merge history & audit trail
├─────────────────────────────┤
│  canonical_table/id,        │
│  merged_table/id,           │
│  merged_data (JSON backup)  │
└─────────────────────────────┘
            │
            ▼
┌─────────────────────────────┐
│    canonical_contacts       │  ← Single source of truth
├─────────────────────────────┤
│  email, phone, name,        │
│  company_name, linked_records│
└─────────────────────────────┘
            │
            ▼
┌─────────────────────────────┐
│     entity_aliases          │  ← Alternate identifiers
├─────────────────────────────┤
│  canonical_contact_id,      │
│  alias_type, alias_value    │
└─────────────────────────────┘
```

## Similarity Scoring

### Algorithms Used

1. **Levenshtein Distance**
   - Counts minimum edits (insert/delete/substitute) to transform one string into another
   - Good for catching typos and minor variations
   - Similarity = 1 - (distance / max_length)

2. **Jaro-Winkler Similarity**
   - Better for short strings like names
   - Gives bonus weight to common prefixes
   - Range: 0.0 (no match) to 1.0 (exact match)

3. **Soundex Phonetic Encoding**
   - Encodes words by how they sound
   - "Smith" and "Smyth" both encode to S530
   - Useful for catching spelling variations of names

4. **Double Metaphone**
   - Advanced phonetic algorithm
   - Returns primary and alternate encodings
   - Better handles non-English name origins

### Field Matching

| Field | Normalization | Algorithm | Weight |
|-------|--------------|-----------|--------|
| email | lowercase, trim | Exact match only | 1.0 |
| phone | Remove non-digits | Last 10 digits match | 0.8 |
| company_name | lowercase, remove suffixes (LLC, Inc) | Jaro-Winkler + Phonetic | 0.7 |
| name | lowercase, remove punctuation | Jaro-Winkler + Phonetic | 0.6 |
| address | Abbreviate (Street→St), lowercase | Levenshtein | 0.5 |
| city | lowercase | Exact match | 0.3 |
| state | lowercase | Exact match | 0.2 |

### Confidence Calculation

```
confidence = Σ(field_similarity × field_weight) / Σ(field_weights)
```

For example, matching two records:
- Email match (exact): 1.0 × 1.0 = 1.0
- Phone match (exact): 1.0 × 0.8 = 0.8
- Company name (fuzzy 85%): 0.85 × 0.7 = 0.595

Confidence = (1.0 + 0.8 + 0.595) / (1.0 + 0.8 + 0.7) = 0.958 (95.8%)

### Thresholds

| Threshold | Value | Action |
|-----------|-------|--------|
| Auto-merge | ≥ 0.95 | Automatically mark as confirmed |
| Review | ≥ 0.70 | Queue for manual review |
| Ignore | < 0.50 | Not considered a duplicate |

## API Reference

### GET /api/admin/deduplication

Retrieve duplicate candidates with filtering.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | string | pending | Filter by status: pending, confirmed, rejected, merged, deferred |
| minConfidence | number | 0 | Minimum confidence score (0-1) |
| maxConfidence | number | 1 | Maximum confidence score (0-1) |
| sourceTable | string | - | Filter by source table |
| targetTable | string | - | Filter by target table |
| limit | number | 50 | Results per page (max 200) |
| offset | number | 0 | Pagination offset |
| includeStats | boolean | false | Include summary statistics |

**Response:**

```json
{
  "success": true,
  "candidates": [
    {
      "id": "dup_1706383200_abc123",
      "entity1_table": "restaurant_leads",
      "entity1_id": "lead_001",
      "entity2_table": "restaurant_leads",
      "entity2_id": "lead_002",
      "confidence_score": 0.92,
      "match_details": {
        "matchType": "exact_email",
        "email": "contact@restaurant.com"
      },
      "status": "pending",
      "rule_name": "Email Exact Match",
      "entity1_preview": {
        "id": "lead_001",
        "name": "Joe's Restaurant",
        "primary_email": "contact@restaurant.com"
      },
      "entity2_preview": {
        "id": "lead_002",
        "name": "Joe's Restaurant LLC",
        "primary_email": "contact@restaurant.com"
      }
    }
  ],
  "pagination": {
    "total": 156,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  },
  "stats": {
    "byStatus": [
      { "status": "pending", "count": 156, "avg_confidence": 0.82 },
      { "status": "merged", "count": 45, "avg_confidence": 0.94 }
    ]
  }
}
```

### POST /api/admin/deduplication

Perform actions on duplicate candidates.

#### Merge Action

```json
{
  "action": "merge",
  "candidateId": "dup_1706383200_abc123",
  "canonicalId": "lead_001",
  "notes": "Keeping older record with more data"
}
```

#### Status Update Actions

```json
{
  "action": "reject",  // or "defer", "confirm"
  "candidateId": "dup_1706383200_abc123",
  "notes": "Different restaurants, same name"
}
```

#### Bulk Update

```json
{
  "action": "bulk_update",
  "candidateIds": ["dup_001", "dup_002", "dup_003"],
  "newStatus": "rejected"
}
```

#### Scan Action

Trigger a deduplication scan:

```json
{
  "action": "scan",
  "scanOptions": {
    "tables": ["restaurant_leads"],
    "ruleIds": ["rule_email_exact"],
    "maxResults": 100
  }
}
```

## Entity Resolution Service

### Usage

```typescript
import { 
  calculateMatchConfidence,
  findDuplicates,
  normalizeEmail,
  normalizePhone,
  DEFAULT_CONFIG 
} from '@/services/entityResolution';

// Compare two entities
const match = calculateMatchConfidence(
  { id: '1', email: 'test@example.com', name: "Joe's Bar" },
  { id: '2', email: 'test@example.com', name: "Joes Bar & Grill" },
  ['email', 'company_name'],
  DEFAULT_CONFIG
);

console.log(match.confidence);      // 0.95
console.log(match.recommendation);  // 'auto_merge'

// Find all duplicates in a list
const duplicates = findDuplicates(entities, ['email', 'phone', 'company_name']);
```

### Normalization Functions

```typescript
// Email normalization
normalizeEmail('  John@Example.COM  ')  // → 'john@example.com'

// Phone normalization
normalizePhone('(508) 555-1234')        // → '5085551234'
normalizePhone('+1 508-555-1234')       // → '5085551234'

// Company name normalization
normalizeName("Joe's Restaurant LLC")   // → 'joes restaurant'
normalizeName("ACME Bar & Grill, Inc.") // → 'acme bar grill'

// Address normalization
normalizeAddress("123 Main Street, Apt 4") // → '123 main st apt 4'
```

## Default Rules

The system comes with pre-configured rules:

| Rule | Description | Auto-merge | Review |
|------|-------------|------------|--------|
| Email Exact Match | Same email address | ≥99% | ≥80% |
| Phone + Company | Same phone and similar company | ≥90% | ≥70% |
| Lead to Client | Match leads with clients | ≥92% | ≥75% |
| Organization Match | Match orgs by name/address | ≥90% | ≥72% |
| Contact Form Match | Match form submissions to leads | ≥88% | ≥70% |

## Workflow

### Automated Deduplication

1. **Scan Triggered**: Manual via API or scheduled job
2. **Rules Applied**: Each active rule runs against its source/target tables
3. **Candidates Created**: Matches above review threshold become candidates
4. **Auto-Merge**: High-confidence matches (≥95%) auto-confirmed
5. **Queue for Review**: Medium-confidence matches await manual review

### Manual Review

1. Admin views pending candidates in dashboard
2. Reviews entity previews and match details
3. Takes action:
   - **Merge**: Choose canonical record, merge the other
   - **Reject**: Mark as not a duplicate (false positive)
   - **Defer**: Review later

### Merge Process

1. Full merged record data preserved in `merged_entities`
2. Duplicate candidate marked as merged
3. Original record optionally marked inactive
4. Aliases created linking old identifiers to canonical

## Data Quality

### Completeness Scoring

Each canonical contact gets a data completeness score (0-100):

```typescript
const score = calculateCompleteness(entity, 
  ['email', 'phone', 'name'],           // Required (10 pts each)
  ['address', 'city', 'state', 'website'] // Optional (5 pts each)
);
```

### Verification Tracking

- `email_verified`: Boolean, email confirmed deliverable
- `phone_verified`: Boolean, phone confirmed callable
- `address_verified`: Boolean, address confirmed valid

## Best Practices

### When to Auto-Merge

- Exact email matches within same table
- Phone + name + city all match exactly
- Confidence ≥ 95%

### When to Review

- Cross-table matches (lead → client)
- Similar company names but different emails
- Confidence 70-95%

### False Positive Prevention

- Franchise locations may share email/phone - check address
- Common names need additional verification
- Form submissions may have typos - review carefully

## Troubleshooting

### "Too Many Duplicates Found"

Lower the review threshold in rules or add more specific match fields.

### "Missing Duplicates"

- Check if tables are included in scan
- Verify field mappings are correct
- Enable phonetic matching for names

### "Merge Failed"

- Check permissions on both tables
- Verify canonical entity still exists
- Check for foreign key constraints

## Future Enhancements

- [ ] ML-based matching confidence
- [ ] Automatic periodic scans
- [ ] Undo merge (rollback) UI
- [ ] Cross-platform sync (HubSpot, Square)
- [ ] Bulk auto-merge for high-confidence batches
