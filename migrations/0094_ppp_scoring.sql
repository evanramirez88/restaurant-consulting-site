-- =====================================================
-- P-P-P PROSPECT RESEARCH SCORING SYSTEM
-- =====================================================
-- Purpose: Add Problem-Pain-Priority scoring framework for prospect research
-- Framework: P-P-P (Problem, Pain, Priority)
-- =====================================================

-- Add P-P-P scoring columns to restaurant_leads
ALTER TABLE restaurant_leads ADD COLUMN ppp_problem_score INTEGER DEFAULT NULL;
ALTER TABLE restaurant_leads ADD COLUMN ppp_pain_score INTEGER DEFAULT NULL;
ALTER TABLE restaurant_leads ADD COLUMN ppp_priority_score INTEGER DEFAULT NULL;
ALTER TABLE restaurant_leads ADD COLUMN ppp_composite_score INTEGER DEFAULT NULL;
ALTER TABLE restaurant_leads ADD COLUMN ppp_last_scored_at INTEGER DEFAULT NULL;
ALTER TABLE restaurant_leads ADD COLUMN ppp_scored_by TEXT DEFAULT NULL;

-- Detailed research notes for P-P-P framework
ALTER TABLE restaurant_leads ADD COLUMN research_problem_description TEXT DEFAULT NULL;
ALTER TABLE restaurant_leads ADD COLUMN research_pain_symptoms TEXT DEFAULT NULL;
ALTER TABLE restaurant_leads ADD COLUMN research_priority_signals TEXT DEFAULT NULL;
ALTER TABLE restaurant_leads ADD COLUMN research_notes TEXT DEFAULT NULL;
ALTER TABLE restaurant_leads ADD COLUMN research_web_data TEXT DEFAULT NULL;
ALTER TABLE restaurant_leads ADD COLUMN research_last_updated_at INTEGER DEFAULT NULL;

-- Create index for priority queue sorting
CREATE INDEX IF NOT EXISTS idx_leads_ppp_composite ON restaurant_leads(ppp_composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_ppp_scored ON restaurant_leads(ppp_last_scored_at);

-- Research activity tracking table
CREATE TABLE IF NOT EXISTS prospect_research_log (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES restaurant_leads(id) ON DELETE CASCADE,
  
  -- Activity details
  activity_type TEXT NOT NULL, -- 'ppp_scored', 'note_added', 'web_research', 'status_change'
  
  -- P-P-P scores at time of activity (for history)
  problem_score INTEGER,
  pain_score INTEGER,
  priority_score INTEGER,
  composite_score INTEGER,
  
  -- Notes
  notes TEXT,
  
  -- Attribution
  performed_by TEXT,
  
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_research_log_lead ON prospect_research_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_research_log_created ON prospect_research_log(created_at DESC);

-- Web research cache (for scraped/enriched data)
CREATE TABLE IF NOT EXISTS prospect_web_research (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES restaurant_leads(id) ON DELETE CASCADE,
  
  -- Source info
  source_type TEXT NOT NULL, -- 'website', 'google_places', 'yelp', 'social', 'news'
  source_url TEXT,
  
  -- Extracted data
  title TEXT,
  content TEXT,
  extracted_data TEXT, -- JSON for structured extraction
  
  -- Relevance
  relevance_score REAL,
  
  -- Timestamps
  fetched_at INTEGER DEFAULT (unixepoch()),
  expires_at INTEGER,
  
  UNIQUE(lead_id, source_type, source_url)
);

CREATE INDEX IF NOT EXISTS idx_web_research_lead ON prospect_web_research(lead_id);
CREATE INDEX IF NOT EXISTS idx_web_research_source ON prospect_web_research(source_type);
