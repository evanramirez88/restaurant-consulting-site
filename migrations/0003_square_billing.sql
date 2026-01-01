-- Square Billing Integration Migration
-- Migration: 0003_square_billing.sql
-- Created: 2025-12-31

-- ============================================
-- ADD SQUARE COLUMNS TO CLIENTS TABLE
-- ============================================

-- Square Customer ID
ALTER TABLE clients ADD COLUMN square_customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_square_customer ON clients(square_customer_id);

-- Square Subscription ID
ALTER TABLE clients ADD COLUMN square_subscription_id TEXT;

-- Support Plan Tier (essential, professional, premium)
ALTER TABLE clients ADD COLUMN support_plan_tier TEXT CHECK (support_plan_tier IN ('essential', 'professional', 'premium'));

-- Support Plan Status
ALTER TABLE clients ADD COLUMN support_plan_status TEXT DEFAULT 'none' CHECK (support_plan_status IN ('none', 'active', 'cancelled', 'paused', 'pending'));

-- Support Plan Timestamps
ALTER TABLE clients ADD COLUMN support_plan_started INTEGER;
ALTER TABLE clients ADD COLUMN support_plan_renews INTEGER;

-- Support Hours Tracking
ALTER TABLE clients ADD COLUMN support_hours_used REAL DEFAULT 0;

-- Service Lane (A = Local Cape Cod, B = National/Remote)
ALTER TABLE clients ADD COLUMN service_lane TEXT DEFAULT 'B' CHECK (service_lane IN ('A', 'B'));

-- ============================================
-- PAYMENT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payment_logs (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
  square_invoice_id TEXT,
  square_payment_id TEXT,
  amount INTEGER NOT NULL, -- Amount in cents
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'paid', 'failed', 'refunded')),
  description TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_client ON payment_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_status ON payment_logs(status);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created ON payment_logs(created_at);

-- ============================================
-- INVOICES TABLE (Local copy of Square invoices)
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
  square_invoice_id TEXT UNIQUE,
  invoice_number TEXT,
  amount INTEGER NOT NULL, -- Amount in cents
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled', 'refunded')),
  due_date TEXT, -- YYYY-MM-DD format
  paid_date TEXT,
  description TEXT,
  public_url TEXT, -- Square payment link
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_square ON invoices(square_invoice_id);

-- ============================================
-- SUPPORT HOUR LOGS TABLE (Track usage)
-- ============================================
CREATE TABLE IF NOT EXISTS support_hour_logs (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  hours REAL NOT NULL,
  description TEXT,
  logged_by TEXT, -- Admin user
  logged_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_support_hours_client ON support_hour_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_support_hours_logged ON support_hour_logs(logged_at);
