# DATA_CONTEXT Engine Architecture Documentation

## Overview

The DATA_CONTEXT Engine (Millstone AI) is a comprehensive personal data management system located at `C:\Users\evanr\Desktop\ANTIGRAVITY\DATA_CONTEXT`. It ingests data from multiple sources, processes it through the Unified Cognitive Architecture (UCA v3.0), and stores it across three interconnected databases.

**Purpose for Business Brief Integration:**
- Enrich leads, prospects, and clients with contextual data
- Provide AI assistants with personal/business context for better insights
- Track interactions across SMS, calls, emails, and meetings
- Generate daily briefings and actionable intelligence

---

## Directory Structure

```
DATA_CONTEXT/
├── src/
│   ├── main.py              # CLI entry point (harvest, ingest, brief, ask, search, sync)
│   ├── config.py            # Machine-aware configuration (MachineConfig, DatabaseConfig, APIKeysConfig)
│   ├── scheduler.py         # Automated harvesting scheduler
│   ├── api/
│   │   └── server.py        # FastAPI REST API (20+ endpoints)
│   ├── core/
│   │   └── uca_logic.py     # UCA v3.0 Controller & Personas
│   ├── database/
│   │   ├── models.py        # SQLAlchemy models
│   │   └── connection.py    # Session management
│   ├── harvesters/          # Data source connectors
│   │   ├── limitless.py     # LimitlessAI pendant API
│   │   ├── sms_calls.py     # Android SMS/Call exports
│   │   ├── google_apis.py   # Gmail, Calendar (GmailHarvester, CalendarHarvester)
│   │   ├── location.py      # Google Location History (LocationHarvester)
│   │   ├── hubspot.py       # HubSpot CRM
│   │   └── square.py        # Square invoices/payments
│   ├── ingestion/
│   │   └── engine.py        # Universal file parser (JSON, XML, CSV, Text)
│   ├── intelligence/
│   │   └── idea_miner.py    # Pattern detection, insights, daily brief
│   └── storage/
│       ├── vector_store.py  # Qdrant embeddings
│       └── graph_store.py   # Neo4j relationships
├── limitless_sync_mvp/      # Standalone Limitless AI syncer
│   └── src/
│       └── limitless_sync.py  # Lifelog exporter script
├── dashboard/               # React dashboard (separate from Business Brief)
├── docker-compose.yml       # Database stack (PostgreSQL, Qdrant, Neo4j)
├── .env.example             # Configuration template
└── README.md                # Quick start guide
```

---

## Data Source Tiers

### Tier 1 - Crucial & Contextual (Near Real-Time)
| Source | Type | Location/API | Contains |
|--------|------|--------------|----------|
| **Limitless AI Pendant** | API | `https://api.limitless.ai/v1` | Lifelogs, transcripts, summaries, audio |
| **Android SMS Exports** | XML File | `G:\My Drive\call_sms_autoexports` | Text messages with timestamps, contacts |
| **Android Call Logs** | XML File | `G:\My Drive\call_sms_autoexports` | Call records (inbound/outbound/missed) |
| **Google Location History** | Export | Google Takeout | GPS coordinates, place visits, activity |
| **Google Places** | API/Export | Timeline | Visit history, reviews |

### Tier 2 - Day-to-Day (Hourly/Daily)
| Source | Type | API/Location | Contains |
|--------|------|--------------|----------|
| **Gmail** | API | Gmail API v1 | Emails, threads, labels, attachments |
| **Google Calendar** | API | Calendar API v3 | Events, meetings, attendees |
| **Google Keep** | API/Export | Notes API | Notes, lists, reminders |
| **HubSpot CRM** | API | HubSpot API | Contacts, deals, activities |
| **Square** | API | Square API | Invoices, payments, customers |
| **Toast KB** | Scrape | Toast Central | Help articles, release notes |
| **BuiltWith Pro** | CSV Export | `G:\RG OPS\70_LEADS` | Restaurant lead data |

### Tier 3 - Financial (Market Hours/EOD)
| Source | Type | Contains |
|--------|------|----------|
| Robinhood | API | Stock positions, orders |
| Coinbase | API | Crypto trades, balances |
| Kraken | API | Crypto trades |
| Bank Accounts | CSV/OFX | Transactions, statements |
| Square Banking | API | Business account activity |

### Tier 4 - Bulk/Periodic
| Source | Type | Contains |
|--------|------|----------|
| ChatGPT Exports | JSON | Conversation history |
| Google Takeout | Export | Full Google data archive |
| Historical Email | Export | Gmail backfill |
| Google Drive | Export | Documents, sheets, slides |

### Tier 5 - System/Telemetry
| Source | Contains |
|--------|----------|
| n8n Workflows | Execution logs, errors |
| ETL Audit Trails | Ingest IDs, checksums |
| Reddit | Posts, comments, saved |
| Spotify | Listening history, playlists |

### Tier 6 - Hobbies/Collections
| Source | Contains |
|--------|----------|
| Pokemon Collection | Inventory CSV |
| Plant Collection | Photos, notes |

---

## Triple Database Architecture

### 1. PostgreSQL (Relational)
Primary structured data storage.

**Tables:**
- `contacts` - People and companies (from HubSpot, SMS, emails)
- `events` - Meetings, appointments (from Calendar, Limitless)
- `transcripts` - LimitlessAI recordings with summaries, action items
- `invoices` - Square billing records
- `interactions` - SMS, calls, emails with direction and content
- `location_points` - GPS coordinates with timestamps
- `data_sources` - Registry of all configured sources
- `ingested_files` - Deduplication tracking by SHA256 hash

### 2. Qdrant (Vector Database)
Semantic search and similarity matching.

**Collections:**
- `transcripts` - Embedded meeting recordings
- `interactions` - Communication content embeddings
- `documents` - PDFs, DOCs embedded
- `notes` - Journal entries
- `knowledge` - Reference material

**Embedding Model:** OpenAI `text-embedding-3-small` (default)

### 3. Neo4j (Graph Database)
Relationship mapping and entity connections.

**Node Types:**
- `Person`, `Organization`, `Event`, `Document`, `Location`, `Topic`

**Relationships:**
- `WORKS_AT`, `KNOWS`, `ATTENDED`, `CREATED`, `MENTIONED_IN`, `BILLED_TO`

---

## Key Components

### IngestionEngine (`src/ingestion/engine.py`)
Universal file parser that handles any file type.

**Supported Formats:**
| Format | Parser | Source Types |
|--------|--------|--------------|
| `.json` | JSONParser | Limitless exports, ChatGPT exports, generic |
| `.xml` | XMLParser | SMS Backup & Restore, Call logs |
| `.csv/.tsv` | CSVParser | BuiltWith leads, bank exports |
| `.txt/.md/.log` | TextParser | Notes, documents |

**Process:**
1. Analyze file metadata (hash, MIME type, category)
2. Check for duplicates by SHA256
3. Select appropriate parser
4. Extract records and text content
5. Generate embedding chunks
6. Return structured `ParsedContent`

### Harvesters

#### GmailHarvester (`src/harvesters/google_apis.py`)
- Uses OAuth2 for authentication
- Fetches messages matching query filters
- Extracts text/HTML body, attachments
- Generates vector embeddings for search

#### CalendarHarvester (`src/harvesters/google_apis.py`)
- Fetches events within date range
- Parses all-day vs timed events
- Extracts attendees, location, description

#### LocationHarvester (`src/harvesters/location.py`)
- Parses Google Takeout Location History
- Handles Records.json (raw GPS points)
- Handles Semantic Location History (place visits)
- Creates graph nodes for significant places

#### LimitlessSync (`limitless_sync_mvp/src/limitless_sync.py`)
- Polls Limitless API for new lifelogs
- Saves JSON and Markdown per lifelog
- Optionally downloads audio in 2-hour chunks
- Maintains sync state for incremental pulls

### IdeaMiner (`src/intelligence/idea_miner.py`)
AI-powered insight extraction.

**Capabilities:**
- `extract_action_items()` - Find TODOs from transcripts/emails
- `find_unbilled_work()` - Revenue leakage detection
- `detect_patterns()` - Recurring behaviors
- `generate_daily_brief()` - Morning summary report
- `answer_question()` - Semantic Q&A about data

### ContextBuilder (`src/intelligence/idea_miner.py`)
Builds rich context for AI prompts.

**Methods:**
- `build_daily_context(date)` - Aggregate day's activity
- `build_entity_context(entity_id)` - All data about a person/company
- `build_topic_context(topic)` - Semantic search for topic

---

## CLI Commands

```bash
# Initialize all databases
python src/main.py init

# Check system status
python src/main.py status

# Harvest from specific source
python src/main.py harvest --source limitless
python src/main.py harvest --source sms
python src/main.py harvest --source gmail --days 7

# Ingest local files
python src/main.py ingest "path/to/file.json"
python src/main.py ingest "path/to/folder" --recursive

# Generate daily briefing
python src/main.py brief
python src/main.py brief --date 2026-01-15

# Ask questions about data
python src/main.py ask "What did I discuss with John last week?"

# Sync to D1 (Cloudflare)
python src/main.py sync --target d1
```

---

## API Endpoints (FastAPI)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/status` | System status |
| POST | `/query` | Process through UCA |
| POST | `/ingest` | Ingest files |
| POST | `/search` | Semantic search |
| GET | `/contacts` | List contacts |
| GET | `/events` | List events |
| GET | `/sources` | List data sources |
| POST | `/sources/{key}/sync` | Trigger sync |
| GET | `/audit/revenue-leakage` | Find unbilled work |
| GET | `/graph/node/{id}` | Get graph node |

---

## UCA v3.0 (Unified Cognitive Architecture)

### Core Principles
1. **TIME (Constant A)** - Every query establishes temporal sequence first
2. **SYSTEM (Constant B)** - Routes to: Financial, Relational, Epistemic, or Operational

### Operational Axioms
1. **The Lie of the Datum** - Truth requires triangulation from multiple sources
2. **Falsification First** - Attempt to disprove before confirming
3. **Context is Constructed** - Build context by querying multiple sources
4. **IDK is Gold** - Flag uncertainty, never hallucinate

### Module Personas
- **Epistemic Controller** - Analyzes intent, identifies system
- **Orchestrator** - Plans multi-step workflows
- **Tactical Executor** - Retrieves data, executes actions
- **Revenue Auditor** - Detects leakage, finds opportunities

---

## Scheduling

The scheduler runs harvesters automatically based on tier:

| Job | Schedule | Source | Tier |
|-----|----------|--------|------|
| `limitless_sync` | Every 5 min | LimitlessAI API | 1 |
| `sms_calls_scan` | Every 30 min | Google Drive folder | 1 |
| `gmail_sync` | Every 30 min | Gmail API | 2 |
| `calendar_sync` | Hourly | Calendar API | 2 |
| `hubspot_sync` | Hourly | HubSpot API | 2 |
| `square_sync` | Hourly | Square API | 2 |
| `opportunity_scan` | Daily | Analysis engine | - |

---

## Configuration

### Machine-Aware Paths
```env
# Development (Acer)
MACHINE_ID=ACER_DEV
GOOGLE_DRIVE_ROOT=G:/My Drive
DATA_BACKUPS_PATH=G:/My Drive/drive_bot_files/data_backups

# Production (Lenovo)
MACHINE_ID=LENOVO_PROD
SEAGATE_ROOT=S:/
DATA_BACKUPS_PATH=S:/MILLSTONE_INGESTION
```

### Required API Keys
```env
# Essential
LIMITLESS_API_KEY=lim_xxx
OPENAI_API_KEY=sk-xxx
POSTGRES_PASSWORD=xxx
NEO4J_PASSWORD=xxx

# Google (OAuth)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

# Business
HUBSPOT_API_KEY=pat-na2-xxx
SQUARE_ACCESS_TOKEN=xxx
```

---

## Integration with Business Brief

The Business Brief Intelligence Console integrates with DATA_CONTEXT to:

1. **Enrich Lead Data**
   - Match phone numbers from SMS to leads
   - Match email addresses from Gmail to leads
   - Show recent interactions in lead profiles

2. **Provide Context to AI**
   - Include recent transcripts in AI prompts
   - Surface relevant past conversations
   - Build relationship timeline

3. **Generate Insights**
   - Unbilled work detection
   - Follow-up reminders
   - Pattern analysis

See `DATA_BOUNDARY_RULES.md` for data separation guidelines.
