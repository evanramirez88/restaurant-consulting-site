-- Migration: 0081_subscribers_view.sql
-- Fixes EM-3: Create view to alias email_subscribers as subscribers
-- Applied: 2026-01-26

-- EM-3: Some code queries non-existent 'subscribers' table
-- Create a view that aliases email_subscribers for backwards compatibility

-- Drop view if exists first for idempotency
DROP VIEW IF EXISTS subscribers;

-- Create the view
CREATE VIEW subscribers AS
SELECT
  id,
  email,
  first_name,
  last_name,
  status,
  lead_source,
  geographic_tier,
  geo_tier,
  subscribed_at,
  created_at,
  updated_at,
  bounced_at,
  complained_at,
  converted_at
FROM email_subscribers;
