-- Intelligence Run Logs Table
-- Tracks automated intelligence gathering runs

CREATE TABLE IF NOT EXISTS intelligence_run_logs (
    id TEXT PRIMARY KEY,
    run_type TEXT NOT NULL DEFAULT 'scheduled',  -- 'scheduled', 'manual', 'triggered'
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    searches_performed INTEGER DEFAULT 0,
    leads_created INTEGER DEFAULT 0,
    leads_enriched INTEGER DEFAULT 0,
    leads_scraped INTEGER DEFAULT 0,
    errors TEXT,  -- JSON array of errors
    budget_status TEXT,  -- JSON snapshot of budget at run time
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Index for finding recent runs
CREATE INDEX IF NOT EXISTS idx_intelligence_run_logs_created
    ON intelligence_run_logs(created_at DESC);

-- Index for finding runs by type
CREATE INDEX IF NOT EXISTS idx_intelligence_run_logs_type
    ON intelligence_run_logs(run_type, created_at DESC);

-- Add enriched_at column to restaurant_leads if not exists
-- (silently ignore if already exists)
ALTER TABLE restaurant_leads ADD COLUMN enriched_at INTEGER;
