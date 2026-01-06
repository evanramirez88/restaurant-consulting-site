-- ============================================
-- TICKET DATE FIELDS MIGRATION
-- Adds due_date and target_date columns to tickets
-- ============================================

-- Add due_date column (internal deadline for completing the ticket)
ALTER TABLE tickets ADD COLUMN due_date INTEGER;

-- Add target_date column (client-facing deadline - ready by, test by, etc.)
ALTER TABLE tickets ADD COLUMN target_date INTEGER;

-- Add target_date_label column (describes what the target date represents)
ALTER TABLE tickets ADD COLUMN target_date_label TEXT;

-- Create indexes for date-based queries
CREATE INDEX IF NOT EXISTS idx_tickets_due_date ON tickets(due_date);
CREATE INDEX IF NOT EXISTS idx_tickets_target_date ON tickets(target_date);
