-- ============================================
-- MENU BUILDER REP TRACKING MIGRATION
-- Migration: 0035_menu_builder_rep_tracking.sql
-- Created: 2026-01-17
--
-- This migration adds:
-- - rep_id tracking on menu_jobs table
-- - menu_updated activity type to rep_activity_log
-- ============================================

-- ============================================
-- ADD REP TRACKING TO MENU_JOBS
-- ============================================

-- Add rep_id to track which rep created/modified the menu
ALTER TABLE menu_jobs ADD COLUMN rep_id TEXT REFERENCES reps(id);

-- Add index for rep lookups
CREATE INDEX IF NOT EXISTS idx_menu_jobs_rep ON menu_jobs(rep_id);

-- ============================================
-- UPDATE REP_ACTIVITY_LOG CHECK CONSTRAINT
-- (SQLite doesn't support modifying CHECK constraints, so we handle in app)
-- Activity types now include: menu_created, menu_updated
-- ============================================

-- Note: The rep_activity_log table already exists from migration 0034.
-- We're adding new activity types: menu_created, menu_updated
-- These are enforced at the application level since SQLite doesn't support
-- modifying CHECK constraints on existing tables.

-- ============================================
-- DONE
-- ============================================
