-- ============================================
-- Add Network Support Products to Stripe Schema
-- Migration: 0027_networking_products.sql
-- ============================================
--
-- This migration updates the stripe_products and stripe_subscriptions
-- tables to support Lane A (Local Networking) support plans in addition
-- to Lane B (Restaurant Guardian) plans.
--
-- Network Support Plans:
-- - Basic: $150/month (48-hour response, business hours)
-- - Premium: $300/month (24-hour response, after-hours, on-site)
-- - Enterprise: $500/month (24/7 monitoring, emergency response)
-- ============================================

-- ============================================
-- STEP 1: Drop all dependent views first
-- ============================================
DROP VIEW IF EXISTS v_active_stripe_subscriptions;
DROP VIEW IF EXISTS v_pending_stripe_overages;
DROP VIEW IF EXISTS v_stripe_mrr_by_tier;

-- ============================================
-- STEP 2: Recreate stripe_products table with expanded tier constraint
-- ============================================
CREATE TABLE IF NOT EXISTS stripe_products_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tier TEXT NOT NULL CHECK (tier IN (
        'core', 'professional', 'premium',
        'network_basic', 'network_premium', 'network_enterprise'
    )),
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

-- Copy existing data
INSERT OR IGNORE INTO stripe_products_new (
    id, tier, billing_interval, stripe_product_id, stripe_price_id,
    amount_cents, included_hours, description, active, created_at, updated_at
)
SELECT
    id, tier, billing_interval, stripe_product_id, stripe_price_id,
    amount_cents, included_hours, description, active, created_at, updated_at
FROM stripe_products;

-- Drop old table and rename new one
DROP TABLE IF EXISTS stripe_products;
ALTER TABLE stripe_products_new RENAME TO stripe_products;

-- Recreate indexes for stripe_products
CREATE INDEX IF NOT EXISTS idx_stripe_products_tier ON stripe_products(tier);
CREATE INDEX IF NOT EXISTS idx_stripe_products_active ON stripe_products(active);

-- ============================================
-- STEP 3: Recreate stripe_subscriptions table with expanded tier constraint
-- ============================================
CREATE TABLE IF NOT EXISTS stripe_subscriptions_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id TEXT NOT NULL UNIQUE,
    client_id INTEGER,
    stripe_customer_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'incomplete'
        CHECK (status IN ('incomplete', 'incomplete_expired', 'trialing',
                         'active', 'past_due', 'canceled', 'unpaid', 'paused')),
    current_period_start TEXT,
    current_period_end TEXT,
    plan_tier TEXT CHECK (plan_tier IN (
        'core', 'professional', 'premium',
        'network_basic', 'network_premium', 'network_enterprise'
    )),
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

-- Copy existing subscription data
INSERT OR IGNORE INTO stripe_subscriptions_new (
    id, subscription_id, client_id, stripe_customer_id, status,
    current_period_start, current_period_end, plan_tier, price_id,
    quantity, billing_interval, commitment_start_date, commitment_end_date,
    commitment_months, cancel_at_period_end, canceled_at, cancellation_reason,
    ended_at, trial_start, trial_end, metadata, hubspot_synced_at,
    created_at, updated_at
)
SELECT
    id, subscription_id, client_id, stripe_customer_id, status,
    current_period_start, current_period_end, plan_tier, price_id,
    quantity, billing_interval, commitment_start_date, commitment_end_date,
    commitment_months, cancel_at_period_end, canceled_at, cancellation_reason,
    ended_at, trial_start, trial_end, metadata, hubspot_synced_at,
    created_at, updated_at
FROM stripe_subscriptions;

-- Drop old table and rename
DROP TABLE IF EXISTS stripe_subscriptions;
ALTER TABLE stripe_subscriptions_new RENAME TO stripe_subscriptions;

-- Recreate indexes for stripe_subscriptions
CREATE INDEX IF NOT EXISTS idx_stripe_subs_client_id ON stripe_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subs_customer_id ON stripe_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subs_status ON stripe_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_stripe_subs_tier ON stripe_subscriptions(plan_tier);
CREATE INDEX IF NOT EXISTS idx_stripe_subs_commitment_end ON stripe_subscriptions(commitment_end_date);
CREATE INDEX IF NOT EXISTS idx_stripe_subs_period_end ON stripe_subscriptions(current_period_end);

-- ============================================
-- STEP 4: Recreate all views with updated tier support
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

-- MRR by tier report (includes networking plans)
CREATE VIEW IF NOT EXISTS v_stripe_mrr_by_tier AS
SELECT
    plan_tier,
    billing_interval,
    COUNT(*) as subscription_count,
    SUM(CASE
        -- Restaurant Guardian Plans
        WHEN billing_interval = 'monthly' THEN
            CASE plan_tier
                WHEN 'core' THEN 35000
                WHEN 'professional' THEN 50000
                WHEN 'premium' THEN 80000
                WHEN 'network_basic' THEN 15000
                WHEN 'network_premium' THEN 30000
                WHEN 'network_enterprise' THEN 50000
            END
        WHEN billing_interval = 'quarterly' THEN
            CASE plan_tier
                WHEN 'core' THEN 35000
                WHEN 'professional' THEN 50000
                WHEN 'premium' THEN 26667
                WHEN 'network_basic' THEN 15000
                WHEN 'network_premium' THEN 30000
                WHEN 'network_enterprise' THEN 50000
            END
        WHEN billing_interval = 'annual' THEN
            CASE plan_tier
                WHEN 'core' THEN 32083
                WHEN 'professional' THEN 45833
                WHEN 'premium' THEN 73333
                WHEN 'network_basic' THEN 13750
                WHEN 'network_premium' THEN 27500
                WHEN 'network_enterprise' THEN 45833
            END
    END) as total_mrr_cents
FROM stripe_subscriptions
WHERE status = 'active'
GROUP BY plan_tier, billing_interval;
