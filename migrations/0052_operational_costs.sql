-- Migration 0052: Operational Costs Tracking
-- Purpose: Track business expenses for profitability analysis
-- Date: 2026-01-20

-- ============================================
-- Operational costs master table
-- ============================================
CREATE TABLE IF NOT EXISTS operational_costs (
  id TEXT PRIMARY KEY,

  -- Categorization
  category TEXT NOT NULL CHECK(category IN (
    'software',       -- SaaS subscriptions
    'marketing',      -- Ads, content, etc.
    'labor',          -- Contractors, employees
    'infrastructure', -- Hosting, tools
    'travel',         -- Client visits
    'materials',      -- Physical goods
    'professional',   -- Legal, accounting
    'other'
  )),
  subcategory TEXT,

  -- Details
  vendor TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',

  -- Recurring handling
  is_recurring BOOLEAN DEFAULT 0,
  billing_cycle TEXT CHECK(billing_cycle IN ('weekly', 'monthly', 'quarterly', 'annual', 'one-time')),
  next_billing_date INTEGER,
  auto_renew BOOLEAN DEFAULT 1,

  -- Contract details
  contract_start INTEGER,
  contract_end INTEGER,
  cancellation_notice_days INTEGER,

  -- Status
  active BOOLEAN DEFAULT 1,
  payment_method TEXT,
  account_reference TEXT,

  -- Metadata
  tags TEXT, -- Comma-separated
  notes TEXT,
  created_by TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_costs_category ON operational_costs(category);
CREATE INDEX IF NOT EXISTS idx_costs_vendor ON operational_costs(vendor);
CREATE INDEX IF NOT EXISTS idx_costs_recurring ON operational_costs(is_recurring, next_billing_date);
CREATE INDEX IF NOT EXISTS idx_costs_active ON operational_costs(active);

-- ============================================
-- Cost payment records
-- ============================================
CREATE TABLE IF NOT EXISTS cost_payments (
  id TEXT PRIMARY KEY,
  cost_id TEXT NOT NULL REFERENCES operational_costs(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_date INTEGER NOT NULL,
  payment_method TEXT,
  reference_number TEXT,
  period_start INTEGER,
  period_end INTEGER,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_cost_payments_cost ON cost_payments(cost_id);
CREATE INDEX IF NOT EXISTS idx_cost_payments_date ON cost_payments(payment_date);

-- ============================================
-- Cost allocations to clients/projects
-- ============================================
CREATE TABLE IF NOT EXISTS cost_allocations (
  id TEXT PRIMARY KEY,
  cost_id TEXT NOT NULL REFERENCES operational_costs(id),
  client_id TEXT REFERENCES clients(id),
  project_id TEXT,

  -- Allocation method
  allocation_type TEXT DEFAULT 'percentage' CHECK(allocation_type IN ('percentage', 'fixed', 'hours')),
  allocation_value DECIMAL(10,4) NOT NULL,

  -- Period
  period_start INTEGER,
  period_end INTEGER,
  is_active BOOLEAN DEFAULT 1,

  -- Metadata
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_allocations_cost ON cost_allocations(cost_id);
CREATE INDEX IF NOT EXISTS idx_allocations_client ON cost_allocations(client_id);
CREATE INDEX IF NOT EXISTS idx_allocations_project ON cost_allocations(project_id);

-- ============================================
-- Monthly cost summary view
-- ============================================
CREATE VIEW IF NOT EXISTS vw_monthly_costs AS
SELECT
  strftime('%Y-%m', datetime(payment_date, 'unixepoch')) as month,
  oc.category,
  oc.vendor,
  SUM(cp.amount) as total_amount,
  COUNT(cp.id) as payment_count
FROM cost_payments cp
JOIN operational_costs oc ON cp.cost_id = oc.id
GROUP BY month, oc.category, oc.vendor
ORDER BY month DESC, total_amount DESC;

-- ============================================
-- Projected monthly costs view
-- ============================================
CREATE VIEW IF NOT EXISTS vw_projected_monthly_costs AS
SELECT
  category,
  vendor,
  description,
  CASE billing_cycle
    WHEN 'weekly' THEN amount * 4.33
    WHEN 'monthly' THEN amount
    WHEN 'quarterly' THEN amount / 3
    WHEN 'annual' THEN amount / 12
    ELSE amount
  END as monthly_amount,
  billing_cycle,
  next_billing_date
FROM operational_costs
WHERE active = 1 AND is_recurring = 1;

-- ============================================
-- Client profitability view
-- ============================================
CREATE VIEW IF NOT EXISTS vw_client_profitability AS
SELECT
  c.id as client_id,
  c.company as client_name,
  COALESCE(rev.net_revenue, 0) as total_revenue,
  COALESCE(costs.allocated_costs, 0) as allocated_costs,
  COALESCE(rev.net_revenue, 0) - COALESCE(costs.allocated_costs, 0) as gross_profit,
  CASE
    WHEN COALESCE(rev.net_revenue, 0) > 0
    THEN ROUND((COALESCE(rev.net_revenue, 0) - COALESCE(costs.allocated_costs, 0)) / rev.net_revenue * 100, 2)
    ELSE 0
  END as profit_margin_percent
FROM clients c
LEFT JOIN (
  SELECT
    client_id,
    SUM(CASE WHEN type NOT IN ('refund', 'credit') THEN amount ELSE -amount END) as net_revenue
  FROM project_revenue
  WHERE status = 'paid'
  GROUP BY client_id
) rev ON c.id = rev.client_id
LEFT JOIN (
  SELECT
    ca.client_id,
    SUM(CASE ca.allocation_type
      WHEN 'percentage' THEN oc.amount * (ca.allocation_value / 100)
      WHEN 'fixed' THEN ca.allocation_value
      ELSE ca.allocation_value
    END) as allocated_costs
  FROM cost_allocations ca
  JOIN operational_costs oc ON ca.cost_id = oc.id
  WHERE ca.is_active = 1
  GROUP BY ca.client_id
) costs ON c.id = costs.client_id;

-- ============================================
-- Budget tracking
-- ============================================
CREATE TABLE IF NOT EXISTS cost_budgets (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  period TEXT NOT NULL, -- 'YYYY-MM' format
  budgeted_amount DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(category, period)
);

-- Budget vs actual view
CREATE VIEW IF NOT EXISTS vw_budget_variance AS
SELECT
  b.period,
  b.category,
  b.budgeted_amount,
  COALESCE(actual.spent, 0) as actual_spent,
  b.budgeted_amount - COALESCE(actual.spent, 0) as variance,
  ROUND((COALESCE(actual.spent, 0) / b.budgeted_amount) * 100, 2) as utilization_percent
FROM cost_budgets b
LEFT JOIN (
  SELECT
    strftime('%Y-%m', datetime(payment_date, 'unixepoch')) as period,
    oc.category,
    SUM(cp.amount) as spent
  FROM cost_payments cp
  JOIN operational_costs oc ON cp.cost_id = oc.id
  GROUP BY period, oc.category
) actual ON b.period = actual.period AND b.category = actual.category;

-- ============================================
-- Seed initial cost categories
-- ============================================
INSERT OR IGNORE INTO operational_costs (id, category, vendor, description, amount, is_recurring, billing_cycle)
VALUES
  ('cost_cloudflare', 'infrastructure', 'Cloudflare', 'Pages, Workers, D1, R2', 0, 1, 'monthly'),
  ('cost_resend', 'infrastructure', 'Resend', 'Email delivery service', 0, 1, 'monthly'),
  ('cost_hubspot', 'software', 'HubSpot', 'CRM platform', 0, 1, 'monthly'),
  ('cost_stripe', 'software', 'Stripe', 'Payment processing fees', 0, 1, 'monthly'),
  ('cost_square', 'software', 'Square', 'Payment processing', 0, 1, 'monthly'),
  ('cost_calcom', 'software', 'Cal.com', 'Scheduling', 0, 1, 'monthly');
