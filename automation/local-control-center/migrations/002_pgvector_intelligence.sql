-- ============================================
-- R&G Consulting - Intelligence Engine Schema
-- Phase 1: pgvector for embeddings
-- ============================================

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- INTELLIGENCE ENGINE TABLES
-- ============================================

-- Processed facts from DATA_CONTEXT
CREATE TABLE IF NOT EXISTS facts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_system VARCHAR(100) NOT NULL,  -- gmail, calendar, hubspot, sms, etc.
    source_account VARCHAR(255),          -- which Google account or service
    fact_type VARCHAR(100) NOT NULL,      -- email, meeting, contact, sms, call, etc.
    content TEXT NOT NULL,
    embedding vector(1536),               -- OpenAI ada-002 embeddings (or similar)
    metadata JSONB DEFAULT '{}'::jsonb,
    relevance_score FLOAT DEFAULT 0.5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE   -- for time-sensitive facts
);

CREATE INDEX IF NOT EXISTS idx_facts_source ON facts(source_system, fact_type);
CREATE INDEX IF NOT EXISTS idx_facts_created ON facts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_facts_embedding ON facts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_facts_metadata ON facts USING gin(metadata);

-- Workflow execution history (synced from n8n)
CREATE TABLE IF NOT EXISTS workflow_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    n8n_execution_id VARCHAR(100) UNIQUE,
    workflow_name VARCHAR(255) NOT NULL,
    workflow_id VARCHAR(100),
    trigger_type VARCHAR(50),             -- webhook, cron, manual
    trigger_source VARCHAR(255),          -- HubSpot, Trello, internal, etc.
    status VARCHAR(50) NOT NULL,          -- running, success, error, waiting
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    duration_ms INTEGER,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started ON workflow_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_name);

-- Browser session logs (from browser-service)
CREATE TABLE IF NOT EXISTS browser_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100) NOT NULL,
    browser_type VARCHAR(50),             -- playwright, puppeteer
    client_id VARCHAR(100),               -- Toast restaurant GUID or client ID
    target_url TEXT,
    action_type VARCHAR(100),             -- navigate, click, type, screenshot, login
    action_data JSONB,
    screenshot_path VARCHAR(500),
    status VARCHAR(50),                   -- success, failed, timeout
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_browser_sessions_session ON browser_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_client ON browser_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_created ON browser_sessions(created_at DESC);

-- Integration state tracking (HubSpot, Trello, Cloudflare, etc.)
CREATE TABLE IF NOT EXISTS integration_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_name VARCHAR(100) UNIQUE NOT NULL,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    cursor_position TEXT,                 -- pagination cursor
    sync_status VARCHAR(50),              -- idle, syncing, error
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Toast automation health checks
CREATE TABLE IF NOT EXISTS health_check_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    overall_status VARCHAR(50) NOT NULL,  -- pass, warn, fail, error
    total_checks INTEGER NOT NULL,
    passed_count INTEGER NOT NULL,
    warning_count INTEGER NOT NULL,
    failed_count INTEGER NOT NULL,
    error_count INTEGER NOT NULL,
    skipped_count INTEGER DEFAULT 0,
    checks_json JSONB NOT NULL,           -- Array of individual check results
    duration_ms INTEGER,
    learning_stats_json JSONB,
    screenshot_key VARCHAR(500),          -- MinIO/R2 key for failure screenshot
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_check_status ON health_check_results(overall_status);
CREATE INDEX IF NOT EXISTS idx_health_check_run_at ON health_check_results(run_at DESC);

-- Automation failure states (for pause/resume)
CREATE TABLE IF NOT EXISTS automation_failure_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id VARCHAR(100) NOT NULL,
    step_number INTEGER NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    failure_reason TEXT NOT NULL,
    selector_id VARCHAR(255),
    screenshot_key VARCHAR(500),
    dom_state_key VARCHAR(500),           -- MinIO key for serialized DOM
    console_errors_json JSONB,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(255),
    resolution_action VARCHAR(50),        -- resumed, cancelled, retried
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failure_states_job ON automation_failure_states(job_id);
CREATE INDEX IF NOT EXISTS idx_failure_states_unresolved ON automation_failure_states(resolved_at)
    WHERE resolved_at IS NULL;

-- AI business query conversations
CREATE TABLE IF NOT EXISTS ai_business_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(100),
    query TEXT NOT NULL,
    context_used JSONB,                   -- JSON of context items used
    response TEXT,
    sources_cited JSONB,                  -- JSON array of source references
    model_used VARCHAR(100),
    tokens_used INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_convos_user ON ai_business_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_convos_thread ON ai_business_conversations(thread_id);
CREATE INDEX IF NOT EXISTS idx_ai_convos_created ON ai_business_conversations(created_at DESC);

-- ============================================
-- N8N DATABASE (separate schema)
-- ============================================

-- Create n8n database if not exists (handled by Docker init)
-- n8n will create its own tables on first run

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to search facts by semantic similarity
CREATE OR REPLACE FUNCTION search_facts_by_embedding(
    query_embedding vector(1536),
    match_count INTEGER DEFAULT 10,
    similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    source_system VARCHAR(100),
    fact_type VARCHAR(100),
    content TEXT,
    similarity FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.id,
        f.source_system,
        f.fact_type,
        f.content,
        1 - (f.embedding <=> query_embedding) as similarity,
        f.metadata
    FROM facts f
    WHERE f.embedding IS NOT NULL
        AND 1 - (f.embedding <=> query_embedding) > similarity_threshold
    ORDER BY f.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to new tables
CREATE TRIGGER update_integration_state_updated_at
    BEFORE UPDATE ON integration_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_failure_states_updated_at
    BEFORE UPDATE ON automation_failure_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA
-- ============================================

-- Initialize integration state records
INSERT INTO integration_state (integration_name, sync_status, metadata) VALUES
    ('hubspot', 'idle', '{"portal_id": "243379742"}'::jsonb),
    ('cloudflare_d1', 'idle', '{"database_id": "eb39c9a2-24ed-426e-9260-a1fb55d899cb"}'::jsonb),
    ('google_gmail', 'idle', '{"accounts": ["rg_business", "evan_personal"]}'::jsonb),
    ('google_calendar', 'idle', '{"accounts": ["rg_business", "evan_personal"]}'::jsonb),
    ('google_drive', 'idle', '{"accounts": ["rg_business"]}'::jsonb),
    ('toast_automation', 'idle', '{}'::jsonb)
ON CONFLICT (integration_name) DO NOTHING;

COMMIT;
