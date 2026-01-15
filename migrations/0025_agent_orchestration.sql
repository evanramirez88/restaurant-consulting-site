-- ============================================
-- MIGRATION: 0025_agent_orchestration.sql
-- PURPOSE: Agent orchestration system tables
-- CREATED: 2026-01-15
-- ============================================

-- automation_jobs: Task queue for AI agents
-- Jobs can be queued from any source (web, API, cron)
-- Sagenode (local PC) polls this table for work
CREATE TABLE IF NOT EXISTS automation_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type TEXT NOT NULL,           -- 'email_sequence', 'lead_import', 'data_sync', etc.
    status TEXT DEFAULT 'queued',     -- 'queued', 'claimed', 'processing', 'completed', 'failed'
    priority TEXT DEFAULT 'medium',   -- 'critical', 'high', 'medium', 'low'
    payload TEXT,                     -- JSON payload for the job
    result TEXT,                      -- JSON result after completion

    -- Claiming/locking
    agent_id TEXT,                    -- Which agent claimed this job
    claimed_at TEXT,                  -- When the job was claimed

    -- Retry logic
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Metadata
    metadata TEXT,                    -- Additional JSON metadata
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
);

-- automation_heartbeats: Track which servers are alive
CREATE TABLE IF NOT EXISTS automation_heartbeats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL,          -- 'sagenode', 'cloudflare', etc.
    status TEXT DEFAULT 'alive',      -- 'alive', 'stale', 'dead'
    last_heartbeat TEXT,
    current_task_id INTEGER,
    metadata TEXT,                    -- JSON with additional status info
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    UNIQUE(server_id)
);

-- automation_wake_events: Log when systems are woken up
CREATE TABLE IF NOT EXISTS automation_wake_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL,
    trigger_type TEXT NOT NULL,       -- 'idle_timeout', 'cron', 'manual', 'cloudflare'
    trigger_source TEXT,              -- Where the wake came from
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_status ON automation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON automation_jobs(priority);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON automation_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON automation_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_heartbeats_server ON automation_heartbeats(server_id);

-- Insert initial heartbeat record for sagenode
INSERT OR IGNORE INTO automation_heartbeats (server_id, status, metadata)
VALUES ('sagenode', 'unknown', '{"initialized": true}');

-- Insert a test job to verify the system works
INSERT INTO automation_jobs (job_type, status, priority, payload, metadata)
VALUES (
    'system_health_check',
    'queued',
    'medium',
    '{"description": "Initial system health check after migration"}',
    '{"source": "migration_0025", "created_by": "claude_code_cli"}'
);
