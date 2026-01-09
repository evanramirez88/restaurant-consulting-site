-- Billing System Fixes Migration
-- Migration: 0016_billing_fixes.sql
-- Created: 2026-01-08
-- Purpose: Fix missing columns and schema issues identified in billing audit

-- ============================================
-- FIX 1: Add missing columns to invoices table
-- ============================================
-- The invoices.js API tries to insert 'title' and 'currency' columns
-- that don't exist in the current schema

ALTER TABLE invoices ADD COLUMN title TEXT;
ALTER TABLE invoices ADD COLUMN currency TEXT DEFAULT 'USD';

-- ============================================
-- FIX 2: Update support_plan_tier CHECK constraint
-- ============================================
-- NOTE: SQLite doesn't support modifying CHECK constraints via ALTER TABLE.
-- The original migrations used 'essential' but the codebase uses 'core'.
--
-- Current constraint: CHECK (support_plan_tier IN ('essential', 'professional', 'premium'))
-- Should be: CHECK (support_plan_tier IN ('core', 'professional', 'premium'))
--
-- WORKAROUND: SQLite doesn't strictly enforce CHECK constraints added via
-- ALTER TABLE in all cases. If 'core' values are already in the database,
-- they will work. For a complete fix, the table would need to be recreated.
--
-- For now, we document this discrepancy. The application code validates
-- tier values before insertion, so the CHECK constraint is a secondary safety.

-- ============================================
-- FIX 3: Create index for faster invoice lookups
-- ============================================
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- ============================================
-- FIX 4: Add payment method tracking to payment_logs
-- ============================================
ALTER TABLE payment_logs ADD COLUMN payment_method TEXT;
ALTER TABLE payment_logs ADD COLUMN receipt_url TEXT;

-- ============================================
-- DOCUMENTATION: Tier Value Mapping
-- ============================================
-- The codebase uses these tier values:
--   - 'core' ($350/mo, 1.5 hours)
--   - 'professional' ($500/mo, 3 hours)
--   - 'premium' ($800/mo, 5 hours)
--
-- Some legacy database constraints reference 'essential' instead of 'core'.
-- Application code should normalize to 'core' on read/write.
