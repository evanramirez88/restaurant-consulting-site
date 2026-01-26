-- Portal Authentication Enhancements
-- Migration: 0084_portal_auth_enhancements.sql
-- Created: 2026-01-26
--
-- This migration adds columns for tracking portal invites and logins

-- ============================================
-- Add invitation tracking columns to reps table
-- ============================================
ALTER TABLE reps ADD COLUMN last_invited_at INTEGER;
ALTER TABLE reps ADD COLUMN last_login_at INTEGER;

-- ============================================
-- Add invitation tracking columns to clients table
-- ============================================
ALTER TABLE clients ADD COLUMN last_invited_at INTEGER;
ALTER TABLE clients ADD COLUMN last_login_at INTEGER;

-- ============================================
-- Create index for portal session cleanup
-- ============================================
CREATE INDEX IF NOT EXISTS idx_portal_sessions_cleanup ON portal_sessions(expires_at) WHERE expires_at < unixepoch();
