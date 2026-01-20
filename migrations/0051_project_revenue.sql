-- Migration 0051: Project Revenue Tracking
-- Purpose: Track all revenue sources with attribution to clients/projects
-- Date: 2026-01-20

-- ============================================
-- Project revenue tracking
-- ============================================
CREATE TABLE IF NOT EXISTS project_revenue (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  client_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('invoice', 'subscription', 'refund', 'credit', 'adjustment')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  description TEXT,
  invoice_number TEXT,

  -- Source tracking
  source TEXT CHECK(source IN ('stripe', 'square', 'manual', 'import')),
  source_id TEXT,
  source_metadata JSON,

  -- Timing
  invoice_date INTEGER,
  due_date INTEGER,
  paid_at INTEGER,
  period_start INTEGER,
  period_end INTEGER,

  -- Status
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'overdue', 'cancelled', 'refunded')),

  -- Metadata
  notes TEXT,
  created_by TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),

  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_revenue_client ON project_revenue(client_id);
CREATE INDEX IF NOT EXISTS idx_revenue_project ON project_revenue(project_id);
CREATE INDEX IF NOT EXISTS idx_revenue_period ON project_revenue(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_revenue_source ON project_revenue(source, source_id);
CREATE INDEX IF NOT EXISTS idx_revenue_paid ON project_revenue(paid_at);
CREATE INDEX IF NOT EXISTS idx_revenue_status ON project_revenue(status);
CREATE INDEX IF NOT EXISTS idx_revenue_type ON project_revenue(type);
CREATE INDEX IF NOT EXISTS idx_revenue_date ON project_revenue(invoice_date);

-- ============================================
-- Revenue line items (for detailed invoices)
-- ============================================
CREATE TABLE IF NOT EXISTS revenue_line_items (
  id TEXT PRIMARY KEY,
  revenue_id TEXT NOT NULL REFERENCES project_revenue(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,

  -- Categorization
  category TEXT CHECK(category IN ('service', 'product', 'support', 'consulting', 'materials', 'other')),
  service_type TEXT, -- Links to service offerings

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_line_items_revenue ON revenue_line_items(revenue_id);
CREATE INDEX IF NOT EXISTS idx_line_items_category ON revenue_line_items(category);

-- ============================================
-- Revenue aggregation view (per client)
-- ============================================
CREATE VIEW IF NOT EXISTS vw_client_revenue_summary AS
SELECT
  client_id,
  SUM(CASE WHEN type NOT IN ('refund', 'credit') THEN amount ELSE 0 END) as gross_revenue,
  SUM(CASE WHEN type IN ('refund', 'credit') THEN amount ELSE 0 END) as refunds_credits,
  SUM(CASE WHEN type NOT IN ('refund', 'credit') THEN amount ELSE -amount END) as net_revenue,
  SUM(CASE
    WHEN type = 'subscription' AND period_end > unixepoch()
    THEN amount
    ELSE 0
  END) as active_mrr,
  COUNT(DISTINCT id) as total_transactions,
  COUNT(DISTINCT CASE WHEN status = 'paid' THEN id END) as paid_transactions,
  SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END) as overdue_amount,
  MAX(paid_at) as last_payment_at,
  MIN(paid_at) as first_payment_at,
  ROUND(AVG(CASE WHEN paid_at IS NOT NULL THEN paid_at - invoice_date END), 2) as avg_days_to_pay
FROM project_revenue
GROUP BY client_id;

-- ============================================
-- Monthly revenue view
-- ============================================
CREATE VIEW IF NOT EXISTS vw_monthly_revenue AS
SELECT
  strftime('%Y-%m', datetime(COALESCE(paid_at, invoice_date), 'unixepoch')) as month,
  type,
  source,
  COUNT(*) as transaction_count,
  SUM(CASE WHEN type NOT IN ('refund', 'credit') THEN amount ELSE -amount END) as net_amount,
  AVG(amount) as avg_amount
FROM project_revenue
WHERE paid_at IS NOT NULL OR status = 'paid'
GROUP BY month, type, source
ORDER BY month DESC;

-- ============================================
-- Revenue recognition tracking
-- ============================================
CREATE TABLE IF NOT EXISTS revenue_recognition (
  id TEXT PRIMARY KEY,
  revenue_id TEXT NOT NULL REFERENCES project_revenue(id),
  recognition_date INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  period TEXT NOT NULL, -- 'YYYY-MM' format
  recognized_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_recognition_period ON revenue_recognition(period);
CREATE INDEX IF NOT EXISTS idx_recognition_revenue ON revenue_recognition(revenue_id);

-- ============================================
-- AR Aging buckets view
-- ============================================
CREATE VIEW IF NOT EXISTS vw_ar_aging AS
SELECT
  client_id,
  c.company as client_name,
  SUM(CASE WHEN unixepoch() - due_date < 0 THEN amount ELSE 0 END) as not_yet_due,
  SUM(CASE WHEN unixepoch() - due_date BETWEEN 0 AND 2592000 THEN amount ELSE 0 END) as days_1_30,
  SUM(CASE WHEN unixepoch() - due_date BETWEEN 2592001 AND 5184000 THEN amount ELSE 0 END) as days_31_60,
  SUM(CASE WHEN unixepoch() - due_date BETWEEN 5184001 AND 7776000 THEN amount ELSE 0 END) as days_61_90,
  SUM(CASE WHEN unixepoch() - due_date > 7776000 THEN amount ELSE 0 END) as days_90_plus,
  SUM(amount) as total_outstanding
FROM project_revenue pr
LEFT JOIN clients c ON pr.client_id = c.id
WHERE pr.status IN ('pending', 'overdue')
GROUP BY client_id;
