-- ============================================
-- MENU PERSISTENCE MIGRATION
-- Migration: 0037_menu_persistence.sql
-- Created: 2026-01-17
--
-- This migration adds:
-- - parsed_menus table for storing Menu Builder outputs
-- - Enables saving, listing, loading, and deploying parsed menus
-- ============================================

-- ============================================
-- PARSED MENUS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS parsed_menus (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  name TEXT NOT NULL,
  source_file_key TEXT,
  menu_data_json TEXT NOT NULL,
  categories_json TEXT,
  modifier_groups_json TEXT,
  item_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'deployed', 'archived')),
  deployed_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),

  -- Foreign key to clients table (optional - menus can be standalone)
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- Index for efficient client menu lookups
CREATE INDEX IF NOT EXISTS idx_parsed_menus_client ON parsed_menus(client_id);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_parsed_menus_status ON parsed_menus(status);

-- Index for sorting by creation date
CREATE INDEX IF NOT EXISTS idx_parsed_menus_created ON parsed_menus(created_at DESC);

-- Index for sorting by update date
CREATE INDEX IF NOT EXISTS idx_parsed_menus_updated ON parsed_menus(updated_at DESC);

-- ============================================
-- MENU DEPLOYMENT HISTORY
-- ============================================

CREATE TABLE IF NOT EXISTS menu_deployment_history (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL,
  client_id TEXT,
  job_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  items_deployed INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error TEXT,
  deployed_by TEXT,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),

  FOREIGN KEY (menu_id) REFERENCES parsed_menus(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (job_id) REFERENCES automation_jobs(id) ON DELETE SET NULL
);

-- Index for menu deployment lookups
CREATE INDEX IF NOT EXISTS idx_menu_deployment_menu ON menu_deployment_history(menu_id);

-- Index for client deployment lookups
CREATE INDEX IF NOT EXISTS idx_menu_deployment_client ON menu_deployment_history(client_id);

-- Index for job tracking
CREATE INDEX IF NOT EXISTS idx_menu_deployment_job ON menu_deployment_history(job_id);

-- ============================================
-- DONE
-- ============================================
