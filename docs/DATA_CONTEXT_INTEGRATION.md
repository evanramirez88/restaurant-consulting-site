# DATA_CONTEXT Integration

The Business Platform integrates directly with DATA_CONTEXT, the central data lake and intelligence system, via API.

## Overview

DATA_CONTEXT is a FastAPI-based service that aggregates business data from multiple sources:
- CRM data (HubSpot, Square)
- Calendar events (Google Calendar, Cal.com)
- Email interactions
- Intelligence feeds
- Market research

The Business Platform queries DATA_CONTEXT directly rather than syncing to Cloudflare D1, enabling:
- Real-time data access
- Reduced data duplication
- Centralized data management
- Unified search across all data

## Architecture

```
┌─────────────────────┐     HTTP/JSON      ┌─────────────────────┐
│   Business Platform │ ◄────────────────► │    DATA_CONTEXT     │
│   (React Frontend)  │                    │   (FastAPI Server)  │
└─────────────────────┘                    └─────────────────────┘
                                                    │
                                           ┌────────┴────────┐
                                           │                 │
                                      ┌────▼────┐       ┌────▼────┐
                                      │ Qdrant  │       │ SQLite  │
                                      │ Vector  │       │   DB    │
                                      └─────────┘       └─────────┘
```

## Configuration

### Environment Variables

Set in `.env` (or `.env.local` for local development):

```bash
# For local development
VITE_DATA_CONTEXT_URL=http://localhost:8100

# For network access (when running from another machine)
VITE_DATA_CONTEXT_URL=http://192.168.8.249:8100
```

### CORS Configuration

DATA_CONTEXT's FastAPI server includes CORS middleware allowing all origins:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Scope Model

All Business Platform queries are automatically scoped to `business` data:

```typescript
const BUSINESS_SCOPE = 'business';
```

This ensures:
- The Business Platform only sees business-relevant data
- Personal data remains separate
- Multi-tenant data isolation

## API Client

The API client is located at `src/services/dataContext.ts`.

### Available Functions

#### Queries

| Function | Description |
|----------|-------------|
| `getContacts(limit, offset)` | Fetch business contacts |
| `getContact(id)` | Get a single contact by ID |
| `getEvents(startDate, endDate, limit)` | Fetch calendar events |
| `searchData(query, collections, limit)` | Semantic search across collections |
| `getIntelligence(limit)` | Get intelligence/insights items |
| `getIntelligenceByType(type, limit)` | Get intelligence by type |
| `getDailyBrief()` | Get the daily business briefing |
| `getStats()` | Get DATA_CONTEXT statistics |

#### Mutations

| Function | Description |
|----------|-------------|
| `ingestData(data, collection)` | Push data into DATA_CONTEXT |

#### Health Checks

| Function | Description |
|----------|-------------|
| `checkConnection()` | Quick health check (returns boolean) |
| `getHealthStatus()` | Detailed health status |

### Usage Examples

```typescript
import dataContext from '@/services/dataContext';

// Check connection
const isConnected = await dataContext.checkConnection();

// Fetch contacts
const contacts = await dataContext.getContacts(50, 0);

// Search across all data
const results = await dataContext.searchData('restaurant consulting', ['contacts', 'notes']);

// Get intelligence items
const intelligence = await dataContext.getIntelligence(20);

// Get daily briefing
const brief = await dataContext.getDailyBrief();
```

## UI Components

### DataContextStatus

A reusable component showing DATA_CONTEXT connection status:

```tsx
import DataContextStatus from '@/components/admin/DataContextStatus';

// Compact mode (for headers/toolbars)
<DataContextStatus compact />

// Full mode (detailed card)
<DataContextStatus 
  refreshInterval={60}
  onStatusChange={(connected) => console.log('Connected:', connected)}
/>
```

### Integration Points

1. **Admin Overview** - Shows DATA_CONTEXT connection status and stats in System Status section
2. **Intelligence Dashboard** - Displays DATA_CONTEXT intelligence items alongside local findings

## DATA_CONTEXT API Endpoints

The Business Platform expects these endpoints from DATA_CONTEXT:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check (returns 200 if alive) |
| `/health` | GET | Detailed health status |
| `/stats` | GET | Collection statistics |
| `/contacts` | GET | List contacts (supports `scope`, `limit`, `offset`) |
| `/contacts/:id` | GET | Get single contact |
| `/events` | GET | List events (supports `scope`, `start_date`, `end_date`, `limit`) |
| `/intelligence` | GET | List intelligence items (supports `scope`, `type`, `limit`) |
| `/search` | POST | Semantic search (body: `query`, `collections`, `limit`, `scope`) |
| `/ingest` | POST | Ingest data (body: `data`, `collection`, `scope`) |
| `/briefing/daily` | GET | Daily business briefing (supports `scope`) |

## Adding New Data Types

To add support for new data types:

1. **Add TypeScript interface** in `src/services/dataContext.ts`:
   ```typescript
   export interface NewDataType {
     id: string;
     // ... fields
   }
   ```

2. **Add API function**:
   ```typescript
   export async function getNewDataType(limit = 50): Promise<NewDataType[]> {
     const res = await fetch(
       `${DATA_CONTEXT_URL}/new-data-type?scope=${BUSINESS_SCOPE}&limit=${limit}`
     );
     if (!res.ok) throw new Error(`DATA_CONTEXT error: ${res.status}`);
     return res.json();
   }
   ```

3. **Export in default object**:
   ```typescript
   export default {
     // ... existing
     getNewDataType,
   };
   ```

4. **Update DATA_CONTEXT server** to serve the new endpoint.

## Error Handling

The API client throws errors on non-2xx responses:

```typescript
try {
  const contacts = await dataContext.getContacts();
} catch (error) {
  if (error.message.includes('DATA_CONTEXT error')) {
    // Handle API error
  }
  // Handle network error
}
```

For graceful degradation, check connection first:

```typescript
const connected = await dataContext.checkConnection();
if (connected) {
  const data = await dataContext.getContacts();
} else {
  // Fall back to cached data or show offline message
}
```

## Troubleshooting

### Connection Issues

1. **Check DATA_CONTEXT is running**:
   ```bash
   curl http://localhost:8100/
   ```

2. **Check CORS**: Browser console will show CORS errors if misconfigured.

3. **Check environment variable**: Ensure `VITE_DATA_CONTEXT_URL` is set correctly.

### Network Access

When accessing DATA_CONTEXT from a different machine:
- Use the server's IP address: `http://192.168.8.249:8100`
- Ensure firewall allows port 8100
- Verify DATA_CONTEXT is bound to `0.0.0.0` not just `localhost`

## Related Files

- `src/services/dataContext.ts` - API client
- `src/components/admin/DataContextStatus.tsx` - Status component
- `src/components/admin/AdminOverview.tsx` - Shows DATA_CONTEXT in System Status
- `src/components/admin/intelligence/IntelligenceDashboard.tsx` - Shows DATA_CONTEXT intelligence
- `.env` / `.env.example` - Environment configuration

---

*Last Updated: January 2026*
