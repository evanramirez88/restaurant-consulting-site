-- Migration: 0062_context_items_privacy.sql
-- Description: Add privacy index for context_items (privacy_level column added in 0061)
-- NOTE: The ALTER TABLE was removed as it's redundant with 0061_privacy_controls.sql

-- Index only (column already exists from 0061)
CREATE INDEX IF NOT EXISTS idx_context_items_privacy ON context_items(privacy_level);
