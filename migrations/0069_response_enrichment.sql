-- ============================================
-- EMAIL RESPONSE ENRICHMENT
-- Migration: 0069_response_enrichment.sql
-- Adds classification, extraction, and enrichment fields
-- ============================================

-- Add classification and enrichment columns to email_replies
ALTER TABLE email_replies ADD COLUMN classification TEXT; -- auto_reply, human_positive, human_negative, human_info, bounce
ALTER TABLE email_replies ADD COLUMN response_type TEXT; -- correction, interest, rejection, ooo, info
ALTER TABLE email_replies ADD COLUMN extracted_business_name TEXT;
ALTER TABLE email_replies ADD COLUMN extracted_phone TEXT;
ALTER TABLE email_replies ADD COLUMN extracted_address TEXT;
ALTER TABLE email_replies ADD COLUMN extracted_business_type TEXT;
ALTER TABLE email_replies ADD COLUMN enrichment_status TEXT DEFAULT 'pending'; -- pending, enriched, skipped
ALTER TABLE email_replies ADD COLUMN rep_profile_id TEXT; -- if converted to rep
ALTER TABLE email_replies ADD COLUMN local_storage_path TEXT; -- path to full body on Seagate

-- Add response tracking columns to restaurant_leads
ALTER TABLE restaurant_leads ADD COLUMN response_received INTEGER DEFAULT 0;
ALTER TABLE restaurant_leads ADD COLUMN response_classification TEXT;
ALTER TABLE restaurant_leads ADD COLUMN response_date INTEGER;
ALTER TABLE restaurant_leads ADD COLUMN business_type_detected TEXT;

-- Index for classification filtering
CREATE INDEX IF NOT EXISTS idx_email_replies_classification ON email_replies(classification);
CREATE INDEX IF NOT EXISTS idx_email_replies_enrichment ON email_replies(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_restaurant_leads_response ON restaurant_leads(response_received);
