
-- Migration: 0061_privacy_controls.sql
-- Description: Add privacy controls to synced data

ALTER TABLE synced_contacts ADD COLUMN privacy_level TEXT DEFAULT 'private'; -- 'private', 'business', 'public'
ALTER TABLE synced_communications ADD COLUMN privacy_level TEXT DEFAULT 'private';
ALTER TABLE context_items ADD COLUMN privacy_level TEXT DEFAULT 'private';

-- Index for fast filtering by privacy
CREATE INDEX IF NOT EXISTS idx_synced_contacts_privacy ON synced_contacts(privacy_level);
CREATE INDEX IF NOT EXISTS idx_synced_comms_privacy ON synced_communications(privacy_level);
