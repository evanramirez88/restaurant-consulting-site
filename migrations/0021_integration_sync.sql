-- Migration: Integration Sync Columns
-- Description: Add columns for HubSpot and Square sync tracking

-- Add missing columns to clients table
ALTER TABLE clients ADD COLUMN hubspot_synced_at INTEGER;
ALTER TABLE clients ADD COLUMN square_customer_id TEXT;

-- Add missing column to restaurant_leads table
ALTER TABLE restaurant_leads ADD COLUMN hubspot_synced_at INTEGER;

-- Add missing column to quotes table
ALTER TABLE quotes ADD COLUMN square_customer_id TEXT;

-- Create indexes for sync queries
CREATE INDEX IF NOT EXISTS idx_clients_hubspot_sync ON clients(hubspot_contact_id, hubspot_synced_at);
CREATE INDEX IF NOT EXISTS idx_leads_hubspot_sync ON restaurant_leads(hubspot_id, hubspot_synced_at);
CREATE INDEX IF NOT EXISTS idx_quotes_square ON quotes(square_customer_id, square_invoice_id);
