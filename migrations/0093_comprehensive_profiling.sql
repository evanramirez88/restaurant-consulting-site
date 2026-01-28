-- =====================================================
-- COMPREHENSIVE PROFILING SYSTEM
-- =====================================================
-- Migration: 0093_comprehensive_profiling.sql
-- Created: 2026-01-27
-- Purpose: Deep profiling tables for the Admin Intelligence Researcher
--
-- New Tables:
--   - prospect_profiles (company-level intelligence)
--   - contact_profiles (person-level profiles with social/engagement)
--   - enrichment_data (raw scraped/API data storage)
--   - research_notes (intelligence notes and observations)
--   - profile_scores (P-P-P scoring: Problem, Pain, Priority)
-- =====================================================

-- =====================================================
-- PART 1: PROSPECT PROFILES
-- =====================================================
-- Deep company-level intelligence beyond basic organization data
CREATE TABLE IF NOT EXISTS prospect_profiles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- ==========================================
  -- BUSINESS CLASSIFICATION
  -- ==========================================
  industry_segment TEXT CHECK (industry_segment IN (
    'fine_dining', 'casual_dining', 'fast_casual', 'quick_service',
    'bar_nightclub', 'cafe_bakery', 'food_truck', 'catering',
    'ghost_kitchen', 'hotel_restaurant', 'country_club', 'other'
  )),
  business_model TEXT CHECK (business_model IN (
    'owner_operated', 'management_group', 'franchise', 'corporate_owned'
  )),
  
  -- Size & Scale
  employee_count_min INTEGER,
  employee_count_max INTEGER,
  employee_count_confidence TEXT CHECK (employee_count_confidence IN ('exact', 'estimated', 'range')),
  location_count INTEGER DEFAULT 1,
  annual_revenue_min REAL,
  annual_revenue_max REAL,
  revenue_confidence TEXT CHECK (revenue_confidence IN ('exact', 'estimated', 'range')),
  revenue_source TEXT,  -- 'linkedin', 'press', 'estimate', etc.
  
  -- ==========================================
  -- TECHNOLOGY STACK
  -- ==========================================
  current_pos TEXT,
  pos_contract_end_date INTEGER,
  pos_satisfaction TEXT CHECK (pos_satisfaction IN ('very_satisfied', 'satisfied', 'neutral', 'dissatisfied', 'very_dissatisfied', 'unknown')),
  pos_pain_points TEXT,  -- JSON array of known pain points
  
  -- Additional Technology
  tech_stack_json TEXT,  -- { "online_ordering": "DoorDash", "reservations": "OpenTable", ... }
  website_platform TEXT,  -- wordpress, squarespace, custom, etc.
  uses_third_party_delivery INTEGER DEFAULT 0,
  has_loyalty_program INTEGER DEFAULT 0,
  has_gift_cards INTEGER DEFAULT 0,
  has_online_ordering INTEGER DEFAULT 0,
  
  -- Integration Status
  integrations_json TEXT,  -- Current integrations in use
  integration_pain_points TEXT,
  
  -- ==========================================
  -- OPERATIONAL INTELLIGENCE
  -- ==========================================
  hours_of_operation TEXT,  -- JSON: { "mon": "11:00-22:00", ... }
  peak_hours TEXT,  -- JSON array of peak hours
  seasonal_pattern TEXT CHECK (seasonal_pattern IN ('year_round', 'seasonal', 'event_based', 'unknown')),
  seasonal_notes TEXT,
  
  -- Menu & Pricing
  avg_check_size_min REAL,
  avg_check_size_max REAL,
  menu_item_count INTEGER,
  menu_complexity TEXT CHECK (menu_complexity IN ('simple', 'moderate', 'complex', 'very_complex')),
  price_tier INTEGER CHECK (price_tier >= 1 AND price_tier <= 4),
  
  -- ==========================================
  -- FINANCIAL HEALTH SIGNALS
  -- ==========================================
  funding_stage TEXT CHECK (funding_stage IN ('bootstrapped', 'seed', 'series_a', 'series_b_plus', 'private_equity', 'public', 'unknown')),
  known_investors TEXT,  -- JSON array
  recent_funding_amount REAL,
  recent_funding_date INTEGER,
  
  -- Financial Indicators
  is_profitable INTEGER,  -- 0/1/NULL for unknown
  growth_trajectory TEXT CHECK (growth_trajectory IN ('declining', 'stable', 'growing', 'rapid_growth', 'unknown')),
  
  -- ==========================================
  -- DIGITAL PRESENCE
  -- ==========================================
  website_url TEXT,
  website_last_updated INTEGER,  -- Timestamp from scraping
  website_tech_json TEXT,  -- { "analytics": "ga4", "chat": "intercom", ... }
  
  -- Social Media
  social_profiles_json TEXT,  -- { "instagram": "@handle", "facebook": "url", ... }
  social_follower_count_total INTEGER,
  social_engagement_rate REAL,
  
  -- Review Presence
  google_rating REAL,
  google_review_count INTEGER,
  yelp_rating REAL,
  yelp_review_count INTEGER,
  tripadvisor_rating REAL,
  tripadvisor_review_count INTEGER,
  avg_review_score REAL,  -- Computed weighted average
  review_sentiment TEXT CHECK (review_sentiment IN ('very_positive', 'positive', 'mixed', 'negative', 'very_negative')),
  
  -- ==========================================
  -- BUYING SIGNALS
  -- ==========================================
  recent_tech_changes TEXT,  -- JSON array of observed changes
  job_postings_json TEXT,  -- Relevant job postings found
  expansion_signals TEXT,  -- JSON: new locations, renovations, etc.
  
  -- Pain Indicators
  pain_signals_json TEXT,  -- { "bad_reviews_tech": 5, "hiring_it": true, ... }
  
  -- ==========================================
  -- COMPETITIVE LANDSCAPE
  -- ==========================================
  known_competitors TEXT,  -- JSON array of competitor IDs
  competitive_position TEXT,
  market_share_estimate REAL,
  
  -- ==========================================
  -- QUALITY & METADATA
  -- ==========================================
  profile_completeness INTEGER DEFAULT 0 CHECK (profile_completeness >= 0 AND profile_completeness <= 100),
  data_freshness_score INTEGER DEFAULT 0 CHECK (data_freshness_score >= 0 AND data_freshness_score <= 100),
  last_enriched_at INTEGER,
  enrichment_sources TEXT,  -- JSON array of sources used
  
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  
  UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_prospect_profiles_org ON prospect_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_prospect_profiles_industry ON prospect_profiles(industry_segment);
CREATE INDEX IF NOT EXISTS idx_prospect_profiles_pos ON prospect_profiles(current_pos);
CREATE INDEX IF NOT EXISTS idx_prospect_profiles_completeness ON prospect_profiles(profile_completeness DESC);
CREATE INDEX IF NOT EXISTS idx_prospect_profiles_revenue ON prospect_profiles(annual_revenue_min);

-- =====================================================
-- PART 2: CONTACT PROFILES
-- =====================================================
-- Deep person-level intelligence beyond basic org_contacts
CREATE TABLE IF NOT EXISTS contact_profiles (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES org_contacts(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  
  -- ==========================================
  -- PROFESSIONAL IDENTITY
  -- ==========================================
  linkedin_url TEXT,
  linkedin_id TEXT,
  linkedin_connections INTEGER,
  linkedin_headline TEXT,
  linkedin_summary TEXT,
  
  -- Career Info
  current_title TEXT,
  seniority_level TEXT CHECK (seniority_level IN ('entry', 'mid', 'senior', 'director', 'vp', 'c_level', 'owner')),
  department TEXT CHECK (department IN ('operations', 'finance', 'marketing', 'it', 'hr', 'executive', 'culinary', 'other')),
  years_in_role INTEGER,
  years_at_company INTEGER,
  years_in_industry INTEGER,
  
  -- Previous Experience (JSON array)
  work_history_json TEXT,  -- [{ "company": "", "title": "", "years": "" }, ...]
  education_json TEXT,     -- [{ "school": "", "degree": "", "year": "" }, ...]
  certifications_json TEXT,
  
  -- ==========================================
  -- SOCIAL PROFILES
  -- ==========================================
  twitter_handle TEXT,
  twitter_followers INTEGER,
  facebook_url TEXT,
  instagram_handle TEXT,
  other_socials_json TEXT,  -- { "tiktok": "", "threads": "", ... }
  
  -- ==========================================
  -- COMMUNICATION PREFERENCES
  -- ==========================================
  preferred_contact_method TEXT CHECK (preferred_contact_method IN ('email', 'phone', 'text', 'linkedin', 'in_person')),
  best_time_to_contact TEXT,  -- morning, afternoon, evening
  communication_style TEXT CHECK (communication_style IN ('formal', 'casual', 'direct', 'detailed', 'unknown')),
  response_speed TEXT CHECK (response_speed IN ('immediate', 'same_day', 'few_days', 'slow', 'unknown')),
  
  -- ==========================================
  -- ENGAGEMENT HISTORY
  -- ==========================================
  first_contact_date INTEGER,
  last_contact_date INTEGER,
  total_touchpoints INTEGER DEFAULT 0,
  
  -- Email Engagement
  emails_sent INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  emails_replied INTEGER DEFAULT 0,
  email_open_rate REAL,
  avg_reply_time_hours REAL,
  
  -- Meeting Engagement
  meetings_scheduled INTEGER DEFAULT 0,
  meetings_attended INTEGER DEFAULT 0,
  meetings_cancelled INTEGER DEFAULT 0,
  no_shows INTEGER DEFAULT 0,
  
  -- Call Engagement
  calls_attempted INTEGER DEFAULT 0,
  calls_connected INTEGER DEFAULT 0,
  avg_call_duration_minutes REAL,
  
  -- ==========================================
  -- DECISION-MAKING PROFILE
  -- ==========================================
  is_decision_maker INTEGER DEFAULT 0,
  is_influencer INTEGER DEFAULT 0,
  is_technical_evaluator INTEGER DEFAULT 0,
  is_end_user INTEGER DEFAULT 0,
  is_budget_holder INTEGER DEFAULT 0,
  is_champion INTEGER DEFAULT 0,  -- Internal advocate for us
  is_blocker INTEGER DEFAULT 0,   -- Potential obstacle
  
  buying_role TEXT CHECK (buying_role IN (
    'economic_buyer',    -- Signs the check
    'technical_buyer',   -- Evaluates tech fit
    'user_buyer',        -- Will use the product
    'coach',             -- Guides us through the org
    'influencer',        -- Affects the decision
    'gatekeeper',        -- Controls access
    'unknown'
  )),
  
  -- Influence mapping
  reports_to TEXT,  -- Contact ID of manager
  direct_reports INTEGER,
  cross_functional_influence TEXT,  -- JSON array of departments influenced
  
  -- ==========================================
  -- PERSONALITY & RELATIONSHIP
  -- ==========================================
  personality_notes TEXT,
  interests_json TEXT,  -- Personal interests (sports, hobbies, etc.)
  rapport_level TEXT CHECK (rapport_level IN ('none', 'cold', 'warm', 'strong', 'advocate')),
  relationship_owner TEXT,  -- Rep ID who owns this relationship
  
  -- Sentiment & Disposition
  current_sentiment TEXT CHECK (current_sentiment IN ('very_positive', 'positive', 'neutral', 'negative', 'very_negative', 'unknown')),
  sentiment_history_json TEXT,  -- [{ "date": "", "sentiment": "", "reason": "" }, ...]
  
  -- ==========================================
  -- INTELLIGENCE NOTES
  -- ==========================================
  pain_points_json TEXT,      -- What problems do they have?
  goals_json TEXT,            -- What are they trying to achieve?
  objections_json TEXT,       -- What concerns have they raised?
  hot_buttons_json TEXT,      -- What gets them excited?
  
  -- Competitive info
  vendor_relationships_json TEXT,  -- [{ "vendor": "", "relationship": "", "sentiment": "" }, ...]
  
  -- ==========================================
  -- QUALITY & METADATA
  -- ==========================================
  profile_completeness INTEGER DEFAULT 0 CHECK (profile_completeness >= 0 AND profile_completeness <= 100),
  last_enriched_at INTEGER,
  enrichment_sources TEXT,  -- JSON array
  
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  
  UNIQUE(contact_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_profiles_contact ON contact_profiles(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_profiles_org ON contact_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_contact_profiles_linkedin ON contact_profiles(linkedin_id);
CREATE INDEX IF NOT EXISTS idx_contact_profiles_seniority ON contact_profiles(seniority_level);
CREATE INDEX IF NOT EXISTS idx_contact_profiles_buyer ON contact_profiles(buying_role);
CREATE INDEX IF NOT EXISTS idx_contact_profiles_decision_maker ON contact_profiles(is_decision_maker);

-- =====================================================
-- PART 3: ENRICHMENT DATA
-- =====================================================
-- Raw scraped and API data storage for audit and reprocessing
CREATE TABLE IF NOT EXISTS enrichment_data (
  id TEXT PRIMARY KEY,
  
  -- Entity Reference
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'organization', 'location', 'contact', 'lead', 'prospect', 'competitor'
  )),
  entity_id TEXT NOT NULL,
  
  -- Data Source
  source_type TEXT NOT NULL CHECK (source_type IN (
    'web_scrape',           -- Generic web scraping
    'linkedin_profile',     -- LinkedIn data
    'linkedin_company',
    'google_places',        -- Google Places API
    'yelp_api',
    'tripadvisor',
    'facebook_page',
    'instagram_profile',
    'twitter_profile',
    'builtwith',            -- Technology detection
    'clearbit',             -- Company enrichment
    'zoominfo',
    'apollo',
    'hunter_io',            -- Email finding
    'whois',
    'press_release',
    'news_article',
    'job_posting',
    'sec_filing',
    'review_aggregation',
    'menu_scrape',
    'health_inspection',
    'liquor_license',
    'property_record',
    'manual_research',
    'other'
  )),
  source_url TEXT,
  source_name TEXT,
  
  -- Raw Data
  raw_data_json TEXT NOT NULL,  -- Full API response or scraped data
  extracted_data_json TEXT,     -- Parsed/structured data
  
  -- Quality
  data_quality_score INTEGER DEFAULT 0 CHECK (data_quality_score >= 0 AND data_quality_score <= 100),
  confidence_score INTEGER DEFAULT 50 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  is_verified INTEGER DEFAULT 0,
  verified_by TEXT,
  verified_at INTEGER,
  
  -- Processing Status
  processing_status TEXT DEFAULT 'raw' CHECK (processing_status IN (
    'raw',           -- Just captured
    'parsed',        -- Extracted structured data
    'validated',     -- Verified accuracy
    'applied',       -- Applied to entity profile
    'stale',         -- Needs refresh
    'invalid'        -- Bad data, don't use
  )),
  applied_to_profile INTEGER DEFAULT 0,
  applied_at INTEGER,
  
  -- Freshness
  data_captured_at INTEGER DEFAULT (unixepoch()),
  data_as_of_date INTEGER,  -- When the source says data is from
  expires_at INTEGER,       -- When to consider data stale
  refresh_priority INTEGER DEFAULT 5,
  
  -- Error Tracking
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  
  -- Metadata
  captured_by TEXT,  -- Agent or user that captured this
  tags TEXT,         -- JSON array
  notes TEXT,
  
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_enrichment_data_entity ON enrichment_data(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_data_source ON enrichment_data(source_type);
CREATE INDEX IF NOT EXISTS idx_enrichment_data_status ON enrichment_data(processing_status);
CREATE INDEX IF NOT EXISTS idx_enrichment_data_captured ON enrichment_data(data_captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_data_quality ON enrichment_data(data_quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_data_stale ON enrichment_data(expires_at);

-- =====================================================
-- PART 4: RESEARCH NOTES
-- =====================================================
-- Intelligence research notes and observations
CREATE TABLE IF NOT EXISTS research_notes (
  id TEXT PRIMARY KEY,
  
  -- Entity Reference (flexible - can link to any entity type)
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'organization', 'location', 'contact', 'lead', 'prospect', 
    'competitor', 'territory', 'market_segment', 'general'
  )),
  entity_id TEXT,  -- NULL for general notes
  
  -- Note Classification
  note_type TEXT NOT NULL CHECK (note_type IN (
    'observation',       -- Something noticed during research
    'insight',           -- Actionable intelligence
    'hypothesis',        -- Theory to be validated
    'question',          -- Something to investigate
    'finding',           -- Confirmed intelligence
    'warning',           -- Risk or concern
    'opportunity',       -- Potential opportunity
    'relationship_map',  -- Org/people connections
    'timeline',          -- Historical events/dates
    'competitive_intel', -- Competitor-related
    'market_intel',      -- Market/industry intel
    'technical_intel',   -- Technology-related
    'financial_intel',   -- Financial/business health
    'other'
  )),
  
  -- Content
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,  -- AI-generated or manual summary
  
  -- Structured Data
  key_points_json TEXT,     -- [{ "point": "", "confidence": 0.8 }, ...]
  evidence_json TEXT,       -- [{ "source": "", "quote": "", "url": "" }, ...]
  action_items_json TEXT,   -- [{ "action": "", "assignee": "", "due": "" }, ...]
  
  -- Source Attribution
  sources_json TEXT,        -- [{ "type": "", "url": "", "date": "" }, ...]
  primary_source TEXT,
  
  -- Intelligence Quality
  confidence_level TEXT CHECK (confidence_level IN ('confirmed', 'likely', 'possible', 'speculative', 'unknown')),
  confidence_score INTEGER DEFAULT 50 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'disputed', 'outdated')),
  verified_by TEXT,
  verified_at INTEGER,
  
  -- Relevance & Priority
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  relevance_score INTEGER DEFAULT 50,
  impact_assessment TEXT,  -- Low/Medium/High with explanation
  
  -- Time Sensitivity
  valid_from INTEGER,
  valid_until INTEGER,
  is_time_sensitive INTEGER DEFAULT 0,
  
  -- Relationships
  related_notes_json TEXT,  -- Array of related note IDs
  parent_note_id TEXT REFERENCES research_notes(id),
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived', 'superseded')),
  superseded_by TEXT REFERENCES research_notes(id),
  
  -- Attribution
  author_type TEXT DEFAULT 'agent' CHECK (author_type IN ('agent', 'admin', 'rep', 'system')),
  author_id TEXT,
  author_name TEXT,
  
  -- Visibility
  is_confidential INTEGER DEFAULT 0,
  visibility TEXT DEFAULT 'internal' CHECK (visibility IN ('private', 'internal', 'team')),
  
  -- Tags & Search
  tags TEXT,  -- JSON array
  
  -- Metadata
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_research_notes_entity ON research_notes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_research_notes_type ON research_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_research_notes_priority ON research_notes(priority);
CREATE INDEX IF NOT EXISTS idx_research_notes_confidence ON research_notes(confidence_level);
CREATE INDEX IF NOT EXISTS idx_research_notes_status ON research_notes(status);
CREATE INDEX IF NOT EXISTS idx_research_notes_created ON research_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_notes_author ON research_notes(author_type, author_id);

-- Full-text search on research notes
CREATE VIRTUAL TABLE IF NOT EXISTS research_notes_fts USING fts5(
  title,
  content,
  summary,
  tags,
  content='research_notes',
  content_rowid='rowid'
);

-- FTS triggers
CREATE TRIGGER IF NOT EXISTS research_notes_ai AFTER INSERT ON research_notes BEGIN
  INSERT INTO research_notes_fts(rowid, title, content, summary, tags)
  VALUES (NEW.rowid, NEW.title, NEW.content, NEW.summary, NEW.tags);
END;

CREATE TRIGGER IF NOT EXISTS research_notes_ad AFTER DELETE ON research_notes BEGIN
  INSERT INTO research_notes_fts(research_notes_fts, rowid, title, content, summary, tags)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.content, OLD.summary, OLD.tags);
END;

CREATE TRIGGER IF NOT EXISTS research_notes_au AFTER UPDATE ON research_notes BEGIN
  INSERT INTO research_notes_fts(research_notes_fts, rowid, title, content, summary, tags)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.content, OLD.summary, OLD.tags);
  INSERT INTO research_notes_fts(rowid, title, content, summary, tags)
  VALUES (NEW.rowid, NEW.title, NEW.content, NEW.summary, NEW.tags);
END;

-- =====================================================
-- PART 5: PROFILE SCORES (P-P-P Framework)
-- =====================================================
-- Problem, Pain, Priority scoring for prospects/contacts
CREATE TABLE IF NOT EXISTS profile_scores (
  id TEXT PRIMARY KEY,
  
  -- Entity Reference
  entity_type TEXT NOT NULL CHECK (entity_type IN ('organization', 'contact', 'lead')),
  entity_id TEXT NOT NULL,
  
  -- ==========================================
  -- PROBLEM DIMENSION
  -- ==========================================
  -- Does the prospect have a problem we can solve?
  problem_identified INTEGER DEFAULT 0,  -- 0/1 - Have we identified a problem?
  problem_score INTEGER DEFAULT 0 CHECK (problem_score >= 0 AND problem_score <= 100),
  problem_category TEXT CHECK (problem_category IN (
    'pos_pain',             -- POS system issues
    'integration_gap',      -- Missing integrations
    'support_void',         -- No reliable support
    'growth_constraint',    -- Tech limiting growth
    'cost_optimization',    -- Overpaying for services
    'compliance_risk',      -- Regulatory/security concerns
    'operational_inefficiency',
    'staff_training',
    'reporting_analytics',
    'other',
    'none_identified'
  )),
  problem_description TEXT,
  problem_evidence_json TEXT,  -- [{ "signal": "", "source": "", "date": "" }, ...]
  problem_confidence INTEGER DEFAULT 50,
  
  -- ==========================================
  -- PAIN DIMENSION  
  -- ==========================================
  -- How much pain is the problem causing?
  pain_level TEXT CHECK (pain_level IN ('none', 'mild', 'moderate', 'significant', 'severe', 'critical')),
  pain_score INTEGER DEFAULT 0 CHECK (pain_score >= 0 AND pain_score <= 100),
  pain_urgency TEXT CHECK (pain_urgency IN ('not_urgent', 'low', 'moderate', 'high', 'immediate')),
  
  -- Pain Indicators
  has_budget_impact INTEGER DEFAULT 0,
  has_operational_impact INTEGER DEFAULT 0,
  has_customer_impact INTEGER DEFAULT 0,
  has_compliance_impact INTEGER DEFAULT 0,
  has_growth_impact INTEGER DEFAULT 0,
  
  pain_quantified REAL,  -- Dollar amount if quantified
  pain_quantified_period TEXT,  -- monthly, annually, etc.
  pain_description TEXT,
  pain_evidence_json TEXT,
  
  -- ==========================================
  -- PRIORITY DIMENSION
  -- ==========================================
  -- How much of a priority is solving this?
  priority_level TEXT CHECK (priority_level IN ('none', 'low', 'medium', 'high', 'critical')),
  priority_score INTEGER DEFAULT 0 CHECK (priority_score >= 0 AND priority_score <= 100),
  
  -- Priority Indicators
  active_evaluation INTEGER DEFAULT 0,     -- Currently evaluating solutions
  budget_allocated INTEGER DEFAULT 0,      -- Budget exists
  timeline_defined INTEGER DEFAULT 0,      -- Has implementation timeline
  decision_maker_engaged INTEGER DEFAULT 0, -- DM is involved
  competitor_shortlisted INTEGER DEFAULT 0, -- We're on the short list
  
  -- Timing
  expected_decision_date INTEGER,
  expected_implementation_date INTEGER,
  fiscal_year_end INTEGER,
  budget_cycle_timing TEXT,
  
  priority_description TEXT,
  priority_evidence_json TEXT,
  
  -- ==========================================
  -- COMPOSITE SCORES
  -- ==========================================
  -- Combined P-P-P Score (0-100)
  ppp_score INTEGER DEFAULT 0 CHECK (ppp_score >= 0 AND ppp_score <= 100),
  ppp_grade TEXT CHECK (ppp_grade IN ('A', 'B', 'C', 'D', 'F')),
  
  -- Readiness Assessment
  sales_readiness TEXT CHECK (sales_readiness IN (
    'not_ready',        -- Not a fit / no opportunity
    'early_stage',      -- Awareness only
    'nurture',          -- Needs warming up
    'mql',              -- Marketing qualified
    'sql',              -- Sales qualified
    'opportunity',      -- Active opportunity
    'hot'               -- Ready to buy
  )),
  
  -- Recommended Action
  recommended_action TEXT,
  next_best_action TEXT,
  action_priority INTEGER DEFAULT 5,
  
  -- ==========================================
  -- SCORING METADATA
  -- ==========================================
  scoring_model_version TEXT DEFAULT 'v1',
  last_scored_at INTEGER DEFAULT (unixepoch()),
  scored_by TEXT,  -- Agent ID or 'manual'
  score_confidence INTEGER DEFAULT 50,
  
  -- Override capability
  is_manual_override INTEGER DEFAULT 0,
  override_reason TEXT,
  override_by TEXT,
  override_at INTEGER,
  
  -- History tracking
  score_history_json TEXT,  -- [{ "date": "", "ppp_score": 0, "reason": "" }, ...]
  
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_scores_entity ON profile_scores(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_profile_scores_ppp ON profile_scores(ppp_score DESC);
CREATE INDEX IF NOT EXISTS idx_profile_scores_grade ON profile_scores(ppp_grade);
CREATE INDEX IF NOT EXISTS idx_profile_scores_readiness ON profile_scores(sales_readiness);
CREATE INDEX IF NOT EXISTS idx_profile_scores_problem ON profile_scores(problem_category);
CREATE INDEX IF NOT EXISTS idx_profile_scores_pain ON profile_scores(pain_level);
CREATE INDEX IF NOT EXISTS idx_profile_scores_priority ON profile_scores(priority_level);

-- =====================================================
-- PART 6: HELPER VIEWS
-- =====================================================

-- View: Enriched Organization 360
CREATE VIEW IF NOT EXISTS v_org_intel_360 AS
SELECT 
  o.id,
  o.legal_name,
  o.dba_name,
  o.lifecycle_stage,
  o.source,
  -- Prospect Profile
  pp.industry_segment,
  pp.business_model,
  pp.employee_count_min,
  pp.employee_count_max,
  pp.annual_revenue_min,
  pp.annual_revenue_max,
  pp.current_pos,
  pp.tech_stack_json,
  pp.avg_review_score,
  pp.profile_completeness as prospect_profile_completeness,
  -- Scoring
  ps.problem_score,
  ps.pain_score,
  ps.priority_score,
  ps.ppp_score,
  ps.ppp_grade,
  ps.sales_readiness,
  ps.recommended_action,
  -- Counts
  (SELECT COUNT(*) FROM research_notes WHERE entity_type = 'organization' AND entity_id = o.id AND status = 'active') as research_note_count,
  (SELECT COUNT(*) FROM enrichment_data WHERE entity_type = 'organization' AND entity_id = o.id) as enrichment_data_count,
  (SELECT MAX(data_captured_at) FROM enrichment_data WHERE entity_type = 'organization' AND entity_id = o.id) as last_enriched_at
FROM organizations o
LEFT JOIN prospect_profiles pp ON pp.organization_id = o.id
LEFT JOIN profile_scores ps ON ps.entity_type = 'organization' AND ps.entity_id = o.id;

-- View: Contact Intelligence Summary
CREATE VIEW IF NOT EXISTS v_contact_intel_360 AS
SELECT
  oc.id,
  oc.organization_id,
  oc.first_name,
  oc.last_name,
  oc.email,
  oc.phone,
  oc.title,
  oc.role_type,
  oc.is_primary,
  oc.is_decision_maker as contact_is_dm,
  -- Contact Profile
  cp.linkedin_url,
  cp.seniority_level,
  cp.department,
  cp.buying_role,
  cp.is_decision_maker as profile_is_dm,
  cp.is_champion,
  cp.is_blocker,
  cp.rapport_level,
  cp.current_sentiment,
  cp.profile_completeness as contact_profile_completeness,
  -- Engagement
  cp.emails_sent,
  cp.emails_opened,
  cp.emails_clicked,
  cp.meetings_attended,
  cp.email_open_rate,
  -- Scoring
  ps.problem_score,
  ps.pain_score,
  ps.priority_score,
  ps.ppp_score,
  ps.ppp_grade
FROM org_contacts oc
LEFT JOIN contact_profiles cp ON cp.contact_id = oc.id
LEFT JOIN profile_scores ps ON ps.entity_type = 'contact' AND ps.entity_id = oc.id;

-- View: High-Priority Opportunities
CREATE VIEW IF NOT EXISTS v_hot_opportunities AS
SELECT
  o.id,
  o.legal_name,
  o.dba_name,
  o.lifecycle_stage,
  pp.current_pos,
  pp.industry_segment,
  ps.ppp_score,
  ps.ppp_grade,
  ps.sales_readiness,
  ps.problem_category,
  ps.pain_level,
  ps.priority_level,
  ps.recommended_action,
  ps.expected_decision_date,
  (SELECT COUNT(*) FROM org_contacts WHERE organization_id = o.id AND is_decision_maker = 1) as dm_count,
  ps.last_scored_at
FROM organizations o
INNER JOIN profile_scores ps ON ps.entity_type = 'organization' AND ps.entity_id = o.id
LEFT JOIN prospect_profiles pp ON pp.organization_id = o.id
WHERE ps.ppp_score >= 60
  AND o.lifecycle_stage NOT IN ('client', 'churned', 'blacklist')
ORDER BY ps.ppp_score DESC, ps.priority_score DESC;

-- View: Research Activity Dashboard
CREATE VIEW IF NOT EXISTS v_research_activity AS
SELECT
  DATE(created_at, 'unixepoch') as date,
  COUNT(*) as notes_created,
  COUNT(DISTINCT entity_id) as entities_researched,
  SUM(CASE WHEN note_type = 'finding' THEN 1 ELSE 0 END) as findings,
  SUM(CASE WHEN note_type = 'insight' THEN 1 ELSE 0 END) as insights,
  SUM(CASE WHEN note_type = 'opportunity' THEN 1 ELSE 0 END) as opportunities,
  SUM(CASE WHEN priority = 'high' OR priority = 'critical' THEN 1 ELSE 0 END) as high_priority
FROM research_notes
WHERE created_at > unixepoch() - (86400 * 30)
GROUP BY DATE(created_at, 'unixepoch')
ORDER BY date DESC;

-- =====================================================
-- PART 7: TRIGGERS
-- =====================================================

-- Update timestamps
CREATE TRIGGER IF NOT EXISTS trg_prospect_profiles_updated
AFTER UPDATE ON prospect_profiles
BEGIN
  UPDATE prospect_profiles SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_contact_profiles_updated
AFTER UPDATE ON contact_profiles
BEGIN
  UPDATE contact_profiles SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_enrichment_data_updated
AFTER UPDATE ON enrichment_data
BEGIN
  UPDATE enrichment_data SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_research_notes_updated
AFTER UPDATE ON research_notes
BEGIN
  UPDATE research_notes SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_profile_scores_updated
AFTER UPDATE ON profile_scores
BEGIN
  UPDATE profile_scores SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Auto-calculate PPP composite score
CREATE TRIGGER IF NOT EXISTS trg_profile_scores_calculate_ppp
AFTER INSERT ON profile_scores
BEGIN
  UPDATE profile_scores 
  SET ppp_score = ROUND((NEW.problem_score + NEW.pain_score + NEW.priority_score) / 3.0),
      ppp_grade = CASE 
        WHEN ROUND((NEW.problem_score + NEW.pain_score + NEW.priority_score) / 3.0) >= 80 THEN 'A'
        WHEN ROUND((NEW.problem_score + NEW.pain_score + NEW.priority_score) / 3.0) >= 60 THEN 'B'
        WHEN ROUND((NEW.problem_score + NEW.pain_score + NEW.priority_score) / 3.0) >= 40 THEN 'C'
        WHEN ROUND((NEW.problem_score + NEW.pain_score + NEW.priority_score) / 3.0) >= 20 THEN 'D'
        ELSE 'F'
      END
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_profile_scores_recalculate_ppp
AFTER UPDATE OF problem_score, pain_score, priority_score ON profile_scores
WHEN NEW.is_manual_override = 0
BEGIN
  UPDATE profile_scores 
  SET ppp_score = ROUND((NEW.problem_score + NEW.pain_score + NEW.priority_score) / 3.0),
      ppp_grade = CASE 
        WHEN ROUND((NEW.problem_score + NEW.pain_score + NEW.priority_score) / 3.0) >= 80 THEN 'A'
        WHEN ROUND((NEW.problem_score + NEW.pain_score + NEW.priority_score) / 3.0) >= 60 THEN 'B'
        WHEN ROUND((NEW.problem_score + NEW.pain_score + NEW.priority_score) / 3.0) >= 40 THEN 'C'
        WHEN ROUND((NEW.problem_score + NEW.pain_score + NEW.priority_score) / 3.0) >= 20 THEN 'D'
        ELSE 'F'
      END,
      last_scored_at = unixepoch()
  WHERE id = NEW.id;
END;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
