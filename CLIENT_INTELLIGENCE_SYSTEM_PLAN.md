# Client Intelligence System - Comprehensive Implementation Plan

**Created:** 2026-01-12
**Author:** Claude Opus 4.5
**Status:** IN PROGRESS
**Target:** Full client control center with integrated intelligence and local storage

---

## EXECUTIVE SUMMARY

Transform the restaurant-consulting-site platform into a comprehensive business control center that:
1. **Manages all client data** with enable/disable portal functionality
2. **Stores data dually** - Cloudflare D1 (essential) + Seagate 20TB (complete archive)
3. **Integrates AI-powered research** via the Culinary Compass prototype (model-agnostic)
4. **Imports data from multiple formats** (txt, md, csv, pdf, xlsx)
5. **Processes files automatically** from a designated folder

---

## PHASE 1: DATABASE SCHEMA (Migration 0020)

### 1.1 Client Intelligence Tables

```sql
-- Client profiles with full business intelligence
CREATE TABLE client_profiles (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Restaurant Classification
  cuisine_type TEXT,
  service_style TEXT,
  bar_program TEXT,
  menu_complexity TEXT,
  restaurant_type_template_id TEXT,

  -- Business Details
  license_number TEXT,
  license_type TEXT CHECK (license_type IN ('Common Victualler', 'Liquor (Full)', 'Liquor (Beer/Wine)', 'Seasonal', 'Other')),
  seating_capacity INTEGER,
  square_footage INTEGER,
  employee_count INTEGER,

  -- Health & Compliance
  health_score INTEGER,
  last_inspection_date TEXT,
  compliance_notes TEXT,

  -- Tech Stack
  pos_system TEXT,
  pos_account_id TEXT,
  online_ordering TEXT,
  reservation_system TEXT,
  kitchen_display_count INTEGER,
  terminal_count INTEGER,

  -- Digital Presence
  website TEXT,
  google_business_url TEXT,
  yelp_url TEXT,
  tripadvisor_url TEXT,
  instagram_handle TEXT,
  facebook_url TEXT,

  -- Financial (Estimated/Discovered)
  estimated_revenue_tier TEXT CHECK (estimated_revenue_tier IN ('under_500k', '500k_1m', '1m_2m', '2m_5m', 'over_5m')),
  avg_check_size REAL,
  peak_hours TEXT,

  -- History & Timeline
  established_date TEXT,
  location_history_json TEXT,
  ownership_history_json TEXT,

  -- Internal Scoring
  client_score INTEGER DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Atomic facts from AI research (Culinary Compass integration)
CREATE TABLE client_atomic_facts (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  field_name TEXT NOT NULL,
  field_value TEXT NOT NULL,
  original_text TEXT,
  source TEXT, -- 'ai_research', 'manual', 'import', 'client_portal'
  source_file TEXT,

  confidence REAL DEFAULT 0.5,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

  reviewed_by TEXT,
  reviewed_at INTEGER,

  created_at INTEGER DEFAULT (unixepoch())
);

-- File imports tracking
CREATE TABLE file_imports (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT NOT NULL, -- 'txt', 'md', 'csv', 'pdf', 'xlsx'
  file_size INTEGER,

  import_status TEXT DEFAULT 'pending' CHECK (import_status IN ('pending', 'processing', 'completed', 'failed')),
  records_found INTEGER DEFAULT 0,
  records_imported INTEGER DEFAULT 0,
  errors_json TEXT,

  processing_started_at INTEGER,
  processing_completed_at INTEGER,

  created_at INTEGER DEFAULT (unixepoch())
);

-- AI provider configuration (model-agnostic)
CREATE TABLE ai_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL, -- 'openai', 'anthropic', 'google', 'local'
  model_id TEXT NOT NULL,
  api_endpoint TEXT,

  -- Configuration
  max_tokens INTEGER DEFAULT 4096,
  temperature REAL DEFAULT 0.7,
  is_active INTEGER DEFAULT 0,
  is_default INTEGER DEFAULT 0,

  -- Cost tracking
  cost_per_1k_input REAL,
  cost_per_1k_output REAL,

  -- Capabilities
  supports_vision INTEGER DEFAULT 0,
  supports_function_calling INTEGER DEFAULT 0,
  context_window INTEGER,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- AI usage logs
CREATE TABLE ai_usage_logs (
  id TEXT PRIMARY KEY,
  provider_id TEXT REFERENCES ai_providers(id),

  task_type TEXT NOT NULL, -- 'research', 'extraction', 'classification', 'enrichment'
  input_tokens INTEGER,
  output_tokens INTEGER,

  input_text TEXT,
  output_text TEXT,

  duration_ms INTEGER,
  cost_estimate REAL,

  client_id TEXT REFERENCES clients(id),

  created_at INTEGER DEFAULT (unixepoch())
);

-- Local storage sync tracking
CREATE TABLE local_storage_sync (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'client', 'lead', 'restaurant', 'file'
  entity_id TEXT NOT NULL,

  d1_updated_at INTEGER,
  local_path TEXT,
  local_updated_at INTEGER,

  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'conflict', 'local_only')),
  last_sync_at INTEGER,

  UNIQUE(entity_type, entity_id)
);
```

### 1.2 Indexes for Performance

```sql
CREATE INDEX idx_client_profiles_client ON client_profiles(client_id);
CREATE INDEX idx_client_profiles_pos ON client_profiles(pos_system);
CREATE INDEX idx_atomic_facts_client ON client_atomic_facts(client_id);
CREATE INDEX idx_atomic_facts_status ON client_atomic_facts(status);
CREATE INDEX idx_file_imports_status ON file_imports(import_status);
CREATE INDEX idx_ai_providers_active ON ai_providers(is_active, is_default);
CREATE INDEX idx_local_sync_status ON local_storage_sync(sync_status);
```

### 1.3 Seed AI Providers

```sql
INSERT INTO ai_providers (id, name, provider_type, model_id, is_active, is_default, supports_vision, context_window) VALUES
  ('ai_gemini_flash', 'Gemini Flash', 'google', 'gemini-2.5-flash-preview-09-2025', 1, 1, 1, 1000000),
  ('ai_claude_sonnet', 'Claude Sonnet', 'anthropic', 'claude-sonnet-4-20250514', 1, 0, 1, 200000),
  ('ai_gpt4o_mini', 'GPT-4o Mini', 'openai', 'gpt-4o-mini', 0, 0, 1, 128000),
  ('ai_cloudflare', 'Cloudflare AI', 'cloudflare', 'llava-1.5-7b-hf', 1, 0, 1, 4096);
```

---

## PHASE 2: LOCAL STORAGE SYSTEM (Seagate D:\)

### 2.1 Directory Structure

```
D:\RG_CONSULTING_DATA\
├── clients\
│   ├── {client_slug}\
│   │   ├── profile.json          # Full client data
│   │   ├── atomic_facts.json     # All facts (approved + pending)
│   │   ├── documents\            # Client-specific files
│   │   ├── research\             # AI research outputs
│   │   ├── menus\                # Menu files and exports
│   │   └── communications\       # Message history
│   └── _index.json               # Client directory index
├── leads\
│   ├── segments\
│   │   ├── toast_existing.json
│   │   ├── switcher_clover.json
│   │   └── ...
│   └── master_leads.json
├── restaurant_research\
│   ├── cape_cod\
│   ├── southeast_ma\
│   └── national\
├── imports\                       # DROP FOLDER - Files here get processed
│   ├── pending\                   # New files to process
│   ├── processing\                # Currently being processed
│   ├── completed\                 # Successfully processed
│   └── failed\                    # Failed processing
├── exports\
│   ├── workbooks\
│   ├── reports\
│   └── backups\
├── backups\
│   ├── d1_snapshots\
│   └── daily\
└── config\
    ├── ai_providers.json
    └── sync_settings.json
```

### 2.2 Local Storage API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/local/sync` | POST | Trigger sync to Seagate |
| `/api/local/clients/:id` | GET | Get client from local storage |
| `/api/local/clients/:id` | PUT | Update client in local storage |
| `/api/local/imports/scan` | POST | Scan imports folder for new files |
| `/api/local/imports/process/:id` | POST | Process a specific import file |
| `/api/local/backup` | POST | Create backup of all data |

### 2.3 Sync Strategy

1. **D1 → Local (Primary)**: All client updates push to D:\
2. **Local → D1 (Secondary)**: Manual trigger for offline changes
3. **Conflict Resolution**: D1 wins, local backup created
4. **Scheduled Sync**: Every 5 minutes during active hours

---

## PHASE 3: CULINARY COMPASS INTEGRATION

### 3.1 Features to Integrate

| Feature | Prototype | Integration Target |
|---------|-----------|-------------------|
| Atomic Facts Extraction | Gemini AI | Model-agnostic API |
| Fact Triage UI | Card-based approval | Admin Dashboard new tab |
| Restaurant Directory | 59 Cape Cod | Merge with client_profiles |
| POS Market Analysis | Charts | Admin analytics |
| Universal Data Import | Text paste | Multi-format file import |

### 3.2 Admin Dashboard New Tab: "Client Intelligence"

Components to create:
- `ClientIntelligenceTab.tsx` - Main container
- `FactTriageQueue.tsx` - Pending facts review (Tinder-style cards)
- `ClientResearchPanel.tsx` - AI-powered client research
- `ImportManager.tsx` - File import with drag-drop
- `AIProviderConfig.tsx` - Model selection and API keys

### 3.3 Model-Agnostic AI Service

```typescript
// src/services/ai-research.ts
interface AIProvider {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'google' | 'cloudflare';
  model: string;
  apiKey?: string; // From env or config
}

interface AIResearchRequest {
  provider_id?: string; // Use default if not specified
  task: 'extract_facts' | 'classify_restaurant' | 'enrich_profile' | 'analyze_menu';
  input: string | { type: 'text' | 'image' | 'url'; content: string };
  client_id?: string;
}

interface AtomicFact {
  field: string;
  value: any;
  confidence: number;
  originalText: string;
}

async function callAI(request: AIResearchRequest): Promise<any> {
  const provider = await getActiveProvider(request.provider_id);

  switch (provider.type) {
    case 'google':
      return callGemini(provider, request);
    case 'anthropic':
      return callClaude(provider, request);
    case 'openai':
      return callOpenAI(provider, request);
    case 'cloudflare':
      return callCloudflareAI(provider, request);
  }
}
```

---

## PHASE 4: FILE IMPORT SYSTEM

### 4.1 Supported Formats

| Format | Parser | Use Case |
|--------|--------|----------|
| `.txt` | Built-in | Notes, transcripts |
| `.md` | Built-in | Documentation |
| `.csv` | csv-parse | Lead lists, client data |
| `.pdf` | unpdf + AI | Menus, contracts |
| `.xlsx` | xlsx npm | Spreadsheets |
| `.docx` | mammoth | Word documents |

### 4.2 Import Workflow

```
1. FILE DETECTION
   ├── Watch D:\RG_CONSULTING_DATA\imports\pending\
   ├── Manual upload via Admin UI
   └── API upload endpoint

2. FILE PARSING
   ├── Identify format by extension
   ├── Extract raw text content
   └── Detect structure (tables, sections)

3. AI EXTRACTION
   ├── Send to configured AI provider
   ├── Extract atomic facts
   └── Fuzzy match to existing clients

4. TRIAGE QUEUE
   ├── All facts start as 'pending'
   ├── Human reviews and approves/rejects
   └── Approved facts update client profile

5. ARCHIVE
   ├── Move to completed/ folder
   ├── Log import in database
   └── Trigger D1 → Local sync
```

### 4.3 Import API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/imports` | GET | List all imports |
| `/api/admin/imports` | POST | Upload new file |
| `/api/admin/imports/:id` | GET | Get import details |
| `/api/admin/imports/:id/process` | POST | Process import |
| `/api/admin/imports/:id/facts` | GET | Get extracted facts |

---

## PHASE 5: CLIENT PORTAL ENHANCEMENTS

### 5.1 Portal Enable/Disable

Already exists in schema:
```sql
ALTER TABLE clients ADD COLUMN portal_enabled INTEGER DEFAULT 0;
```

Admin UI additions:
- Toggle switch in client list
- Bulk enable/disable
- Portal status indicator

### 5.2 Client List View Enhancements

| Column | Source | Sortable |
|--------|--------|----------|
| Name | clients.name | Yes |
| Company | clients.company | Yes |
| Portal | portal_enabled toggle | Yes |
| Score | client_profiles.client_score | Yes |
| POS | client_profiles.pos_system | Yes |
| Last Activity | latest activity_log | Yes |
| Actions | Edit, View, Message | No |

### 5.3 Client Profile Page

Tabs:
1. **Overview** - Key info, scores, status
2. **Intelligence** - AI-discovered facts, pending reviews
3. **Documents** - Files, menus, contracts
4. **Timeline** - Activity history
5. **Communications** - Messages
6. **Settings** - Portal access, notifications

---

## PHASE 6: EXISTING CLIENT DATA IMPORT

### 6.1 Source Data

Location: `G:/My Drive/RG OPS/CLIENTS_AND_REPS/Clients-and-Client_Info/`

Data available:
- **Client Info 12_25 - Sheet1.csv**: 44 restaurants with addresses
- **40+ individual client folders** with various files

### 6.2 Initial Import Script

```javascript
// scripts/import_existing_clients.cjs
const clients = [
  { name: '11 Circuit', address: '11 Circuit Ave', town: 'Oak Bluffs', state: 'MA' },
  { name: 'ACK Goia', address: '302 Underpass Rd', town: 'Brewster', state: 'MA' },
  // ... 44 total clients from CSV
];

async function importClients() {
  for (const client of clients) {
    // 1. Create client record in D1
    // 2. Create client_profile record
    // 3. Create folder in D:\RG_CONSULTING_DATA\clients\{slug}\
    // 4. Copy any existing files from G: drive folder
    // 5. Log import
  }
}
```

---

## IMPLEMENTATION TIMELINE

### Week 1: Foundation
| Day | Task | Priority |
|-----|------|----------|
| 1 | Create migration 0020_client_intelligence.sql | HIGH |
| 1 | Apply migration to D1 | HIGH |
| 2 | Create local storage directory structure | HIGH |
| 2 | Build local storage sync API | HIGH |
| 3 | Import 44 existing clients | HIGH |
| 4-5 | Build Client Intelligence admin tab | HIGH |

### Week 2: AI Integration
| Day | Task | Priority |
|-----|------|----------|
| 1-2 | Create model-agnostic AI service | HIGH |
| 3 | Integrate Culinary Compass extraction logic | HIGH |
| 4 | Build Fact Triage UI component | MEDIUM |
| 5 | Test AI extraction with real client data | HIGH |

### Week 3: File Import System
| Day | Task | Priority |
|-----|------|----------|
| 1 | Build file upload endpoint | HIGH |
| 2 | Implement CSV parser | HIGH |
| 2 | Implement TXT/MD parser | HIGH |
| 3 | Implement PDF parser (unpdf) | MEDIUM |
| 4 | Build imports folder watcher | MEDIUM |
| 5 | Test full import pipeline | HIGH |

### Week 4: Polish & Deploy
| Day | Task | Priority |
|-----|------|----------|
| 1-2 | Client portal enable/disable UI | HIGH |
| 3 | Client list view enhancements | MEDIUM |
| 4 | Documentation and testing | HIGH |
| 5 | Deploy and verify | HIGH |

---

## FILES TO CREATE

### Migrations
- `migrations/0020_client_intelligence.sql`

### API Endpoints
- `functions/api/admin/intelligence/index.js` - Main intelligence endpoints
- `functions/api/admin/intelligence/facts.js` - Fact management
- `functions/api/admin/intelligence/research.js` - AI research
- `functions/api/admin/imports/index.js` - File import endpoints
- `functions/api/admin/imports/[id].js` - Single import management
- `functions/api/local/sync.js` - Local storage sync

### Components
- `src/components/admin/intelligence/ClientIntelligenceTab.tsx`
- `src/components/admin/intelligence/FactTriageQueue.tsx`
- `src/components/admin/intelligence/ClientResearchPanel.tsx`
- `src/components/admin/intelligence/ImportManager.tsx`
- `src/components/admin/intelligence/AIProviderConfig.tsx`

### Services
- `src/services/ai-research.ts` - Model-agnostic AI service
- `src/services/local-storage.ts` - Seagate storage interface
- `src/services/file-parser.ts` - Multi-format file parsing

### Scripts
- `scripts/import_existing_clients.cjs` - Initial client import
- `scripts/sync_to_seagate.cjs` - Manual sync utility

---

## ENVIRONMENT VARIABLES NEEDED

| Variable | Purpose | Status |
|----------|---------|--------|
| `GEMINI_API_KEY` | Google AI | NEEDED |
| `OPENAI_API_KEY` | OpenAI | Optional |
| `ANTHROPIC_API_KEY` | Anthropic | Optional |
| `LOCAL_STORAGE_PATH` | D:\RG_CONSULTING_DATA | Set in .dev.vars |

---

## SUCCESS CRITERIA

1. **Client Management**: Can view, edit, enable/disable all 44+ clients
2. **Portal Control**: Toggle button works, portal access reflects state
3. **Local Storage**: All client data syncs to D:\ automatically
4. **AI Research**: Can paste text, extract facts, approve to client
5. **File Import**: Can drop CSV/PDF in folder, see facts extracted
6. **Model Agnostic**: Can switch AI providers without code changes

---

## RELATED DOCUMENTS

- `MASTER_EXECUTION_PLAN.md` - Overall business execution
- `docs/RESTAURANT_INTELLIGENCE_SYSTEM.md` - Lead classification
- `integrations/culinary-compass/` - Prototype source code
- `CONTINUITY_LEDGER.md` - Session history

---

**Plan Version:** 1.0
**Last Updated:** 2026-01-12
