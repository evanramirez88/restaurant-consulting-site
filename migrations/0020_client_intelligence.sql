-- Migration: 0020_client_intelligence.sql
-- Purpose: Add client intelligence and portal control fields
-- Date: 2026-01-10

-- Add intel/research fields (NOT synced to client portal)
ALTER TABLE clients ADD COLUMN intel_profile TEXT;
ALTER TABLE clients ADD COLUMN intel_notes TEXT;
ALTER TABLE clients ADD COLUMN intel_sources TEXT;
ALTER TABLE clients ADD COLUMN intel_last_updated INTEGER;

-- Add client-submitted data storage (data they enter in portal)
ALTER TABLE clients ADD COLUMN client_submitted TEXT;

-- Add portal control field (already exists but ensuring it's there)
-- portal_enabled already exists

-- Add local folder path for Seagate storage
ALTER TABLE clients ADD COLUMN local_folder_path TEXT;

-- Add tags for flexible categorization
ALTER TABLE clients ADD COLUMN tags TEXT;

-- Create index for portal-enabled clients
CREATE INDEX IF NOT EXISTS idx_clients_portal_enabled ON clients(portal_enabled);

-- Create restaurants intel fields
ALTER TABLE restaurants ADD COLUMN intel_profile TEXT;
ALTER TABLE restaurants ADD COLUMN intel_notes TEXT;
ALTER TABLE restaurants ADD COLUMN local_folder_path TEXT;
