-- Migration: 0062_context_items_privacy.sql
-- Description: Add privacy_level to context_items table

ALTER TABLE context_items ADD COLUMN privacy_level TEXT DEFAULT 'private';
CREATE INDEX IF NOT EXISTS idx_context_items_privacy ON context_items(privacy_level);
