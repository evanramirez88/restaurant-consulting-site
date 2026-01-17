-- ============================================
-- Stripe Billing Integration Schema
-- Migration: 0026_stripe_billing.sql
-- ============================================
--
-- This migration creates the database schema for Stripe billing integration:
-- - stripe_customers: Links internal clients to Stripe customer records
-- - subscriptions: Tracks subscription lifecycle and billing details
-- - subscription_events: Idempotent webhook event processing
-- - commitment_tracking: Enforces minimum commitment periods
-- - subscription_overages: Quarterly overage tracking and billing
--
-- Support Plans (Restaurant Guardian):
-- - Core: $350/month, 5 hours
-- - Professional: $500/month, 10 hours
-- - Premium: $800/month, 20 hours
--
-- Billing Intervals: monthly, quarterly, annual (11 months = 1 free)
-- Minimum Commitment: 3 months standard
-- ============================================

-- ============================================
-- STRIPE CUSTOMERS TABLE
-- Links internal clients to Stripe customer records
-- ============================================

CREATE TABLE IF NOT EXISTS stripe_customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL UNIQUE,
    stripe_customer_id TEXT NOT NULL UNIQUE,
    email TEXT,
    name TEXT,
    phone TEXT,
    metadata TEXT,
    default_payment_method_id TEXT,
    currency TEXT DEFAULT 'usd',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_client_id ON stripe_customers(client_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_email ON stripe_customers(email);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- Tracks Stripe subscription lifecycle
-- ============================================

CREATE TABLE IF NOT EXISTS stripe_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id TEXT NOT NULL UNIQUE,
    client_id INTEGER,
    stripe_customer_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'incomplete'
        CHECK (status IN ('incomplete', 'incomplete_expired', 'trialing',
                         'active', 'past_due', 'canceled', 'unpaid', 'paused')),
    current_period_start TEXT,
    current_period_end TEXT,
    plan_tier TEXT CHECK (plan_tier IN ('core', 'professional', 'premium')),
    price_id TEXT,
    quantity INTEGER DEFAULT 1,
    billing_interval TEXT NOT NULL DEFAULT 'monthly'
        CHECK (billing_interval IN ('monthly', 'quarterly', 'annual')),
    commitment_start_date TEXT,
    commitment_end_date TEXT,
    commitment_months INTEGER DEFAULT 3,
    cancel_at_period_end INTEGER DEFAULT 0,
    canceled_at TEXT,
    cancellation_reason TEXT,
    ended_at TEXT,
    trial_start TEXT,
    trial_end TEXT,
    metadata TEXT,
    hubspot_synced_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_subs_client_id ON stripe_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subs_customer_id ON stripe_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subs_status ON stripe_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_stripe_subs_tier ON stripe_subscriptions(plan_tier);
CREATE INDEX IF NOT EXISTS idx_stripe_subs_commitment_end ON stripe_subscriptions(commitment_end_date);
CREATE INDEX IF NOT EXISTS idx_stripe_subs_period_end ON stripe_subscriptions(current_period_end);

-- ============================================
-- SUBSCRIPTION EVENTS TABLE
-- Idempotent webhook event processing
-- ============================================

CREATE TABLE IF NOT EXISTS stripe_subscription_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stripe_event_id TEXT NOT NULL UNIQUE,
    subscription_id TEXT,
    client_id INTEGER,
    event_type TEXT NOT NULL,
    api_version TEXT,
    payload TEXT NOT NULL,
    processed_at TEXT,
    processing_status TEXT DEFAULT 'pending'
        CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    processing_error TEXT,
    retry_count INTEGER DEFAULT 0,
    received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON stripe_subscription_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_status ON stripe_subscription_events(processing_status);
CREATE INDEX IF NOT EXISTS idx_stripe_events_sub_id ON stripe_subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_received ON stripe_subscription_events(received_at);

-- ============================================
-- COMMITMENT TRACKING TABLE
-- Enforces minimum commitment periods (3-month standard)
-- ============================================

CREATE TABLE IF NOT EXISTS stripe_commitment_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id TEXT NOT NULL UNIQUE,
    client_id INTEGER,
    stripe_customer_id TEXT,
    commitment_start_date TEXT NOT NULL,
    commitment_end_date TEXT NOT NULL,
    commitment_months INTEGER NOT NULL DEFAULT 3,
    monthly_commitment_amount INTEGER,
    commitment_fulfilled INTEGER DEFAULT 0,
    commitment_fulfilled_at TEXT,
    early_termination_requested INTEGER DEFAULT 0,
    early_termination_requested_at TEXT,
    early_termination_fee_calculated INTEGER,
    early_termination_fee_charged INTEGER DEFAULT 0,
    early_termination_fee_charged_at TEXT,
    early_termination_invoice_id TEXT,
    cancellation_blocked INTEGER DEFAULT 0,
    cancellation_blocked_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (subscription_id) REFERENCES stripe_subscriptions(subscription_id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_commit_sub_id ON stripe_commitment_tracking(subscription_id);
CREATE INDEX IF NOT EXISTS idx_stripe_commit_end_date ON stripe_commitment_tracking(commitment_end_date);
CREATE INDEX IF NOT EXISTS idx_stripe_commit_fulfilled ON stripe_commitment_tracking(commitment_fulfilled);
CREATE INDEX IF NOT EXISTS idx_stripe_commit_client ON stripe_commitment_tracking(client_id);

-- ============================================
-- SUBSCRIPTION OVERAGES TABLE
-- Quarterly overage tracking and automatic billing
-- ============================================

CREATE TABLE IF NOT EXISTS stripe_subscription_overages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id TEXT NOT NULL,
    client_id INTEGER,
    usage_period_start TEXT NOT NULL,
    usage_period_end TEXT NOT NULL,
    period_type TEXT DEFAULT 'quarterly'
        CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
    usage_type TEXT DEFAULT 'support_hours',
    included_units INTEGER NOT NULL DEFAULT 0,
    used_units INTEGER NOT NULL DEFAULT 0,
    overage_units INTEGER GENERATED ALWAYS AS (
        CASE WHEN used_units > included_units
             THEN used_units - included_units
             ELSE 0 END
    ) STORED,
    overage_rate INTEGER NOT NULL DEFAULT 12500,  -- $125/hour in cents
    overage_amount INTEGER GENERATED ALWAYS AS (
        CASE WHEN used_units > included_units
             THEN (used_units - included_units) * overage_rate
             ELSE 0 END
    ) STORED,
    billed INTEGER DEFAULT 0,
    billed_at TEXT,
    stripe_invoice_id TEXT,
    stripe_invoice_item_id TEXT,
    notes TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (subscription_id) REFERENCES stripe_subscriptions(subscription_id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
    UNIQUE(subscription_id, usage_period_start, usage_period_end, usage_type)
);

CREATE INDEX IF NOT EXISTS idx_stripe_overages_sub_id ON stripe_subscription_overages(subscription_id);
CREATE INDEX IF NOT EXISTS idx_stripe_overages_billed ON stripe_subscription_overages(billed);
CREATE INDEX IF NOT EXISTS idx_stripe_overages_period ON stripe_subscription_overages(usage_period_start, usage_period_end);
CREATE INDEX IF NOT EXISTS idx_stripe_overages_client ON stripe_subscription_overages(client_id);

-- ============================================
-- ADD STRIPE FIELDS TO CLIENTS TABLE
-- ============================================

-- Add stripe_customer_id if it doesn't exist
-- (Using separate statements since SQLite doesn't support IF NOT EXISTS for columns)

-- Check and add columns via PRAGMA (these will fail silently if columns exist)
ALTER TABLE clients ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE clients ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE clients ADD COLUMN stripe_subscription_status TEXT;
ALTER TABLE clients ADD COLUMN stripe_mrr INTEGER DEFAULT 0;

-- Create indexes for Stripe fields on clients
CREATE INDEX IF NOT EXISTS idx_clients_stripe_customer ON clients(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_clients_stripe_sub ON clients(stripe_subscription_id);

-- ============================================
-- STRIPE PRODUCTS/PRICES REFERENCE TABLE
-- Stores Stripe product and price IDs for each plan
-- ============================================

CREATE TABLE IF NOT EXISTS stripe_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tier TEXT NOT NULL CHECK (tier IN ('core', 'professional', 'premium')),
    billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'quarterly', 'annual')),
    stripe_product_id TEXT NOT NULL,
    stripe_price_id TEXT NOT NULL UNIQUE,
    amount_cents INTEGER NOT NULL,
    included_hours INTEGER NOT NULL,
    description TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tier, billing_interval)
);

-- Insert default price configuration (IDs to be updated after Stripe setup)
INSERT OR IGNORE INTO stripe_products (tier, billing_interval, stripe_product_id, stripe_price_id, amount_cents, included_hours, description) VALUES
    ('core', 'monthly', 'prod_core_TBD', 'price_core_monthly_TBD', 35000, 5, 'Core Support - Monthly'),
    ('core', 'quarterly', 'prod_core_TBD', 'price_core_quarterly_TBD', 105000, 5, 'Core Support - Quarterly'),
    ('core', 'annual', 'prod_core_TBD', 'price_core_annual_TBD', 385000, 5, 'Core Support - Annual (11 months)'),
    ('professional', 'monthly', 'prod_pro_TBD', 'price_pro_monthly_TBD', 50000, 10, 'Professional Support - Monthly'),
    ('professional', 'quarterly', 'prod_pro_TBD', 'price_pro_quarterly_TBD', 150000, 10, 'Professional Support - Quarterly'),
    ('professional', 'annual', 'prod_pro_TBD', 'price_pro_annual_TBD', 550000, 10, 'Professional Support - Annual'),
    ('premium', 'monthly', 'prod_premium_TBD', 'price_premium_monthly_TBD', 80000, 20, 'Premium Support - Monthly'),
    ('premium', 'quarterly', 'prod_premium_TBD', 'price_premium_quarterly_TBD', 240000, 20, 'Premium Support - Quarterly'),
    ('premium', 'annual', 'prod_premium_TBD', 'price_premium_annual_TBD', 880000, 20, 'Premium Support - Annual');

-- ============================================
-- HELPFUL VIEWS
-- ============================================

-- Active subscriptions with client info
CREATE VIEW IF NOT EXISTS v_active_stripe_subscriptions AS
SELECT
    s.subscription_id,
    s.status,
    s.plan_tier,
    s.billing_interval,
    s.current_period_start,
    s.current_period_end,
    s.commitment_end_date,
    c.id as client_id,
    c.name as client_name,
    c.email as client_email,
    c.company as client_company,
    ct.commitment_fulfilled,
    ct.early_termination_requested
FROM stripe_subscriptions s
LEFT JOIN clients c ON s.client_id = c.id
LEFT JOIN stripe_commitment_tracking ct ON s.subscription_id = ct.subscription_id
WHERE s.status = 'active';

-- Pending overages (not yet billed)
CREATE VIEW IF NOT EXISTS v_pending_stripe_overages AS
SELECT
    o.*,
    c.name as client_name,
    c.email as client_email,
    s.plan_tier
FROM stripe_subscription_overages o
JOIN stripe_subscriptions s ON o.subscription_id = s.subscription_id
LEFT JOIN clients c ON o.client_id = c.id
WHERE o.billed = 0 AND o.overage_units > 0;

-- MRR by tier report
CREATE VIEW IF NOT EXISTS v_stripe_mrr_by_tier AS
SELECT
    plan_tier,
    billing_interval,
    COUNT(*) as subscription_count,
    SUM(CASE
        WHEN billing_interval = 'monthly' THEN
            CASE plan_tier
                WHEN 'core' THEN 35000
                WHEN 'professional' THEN 50000
                WHEN 'premium' THEN 80000
            END
        WHEN billing_interval = 'quarterly' THEN
            CASE plan_tier
                WHEN 'core' THEN 35000
                WHEN 'professional' THEN 50000
                WHEN 'premium' THEN 26667
            END
        WHEN billing_interval = 'annual' THEN
            CASE plan_tier
                WHEN 'core' THEN 32083
                WHEN 'professional' THEN 45833
                WHEN 'premium' THEN 73333
            END
    END) as total_mrr_cents
FROM stripe_subscriptions
WHERE status = 'active'
GROUP BY plan_tier, billing_interval;
