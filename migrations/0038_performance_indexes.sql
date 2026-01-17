-- Performance Indexes for Production Scale
-- Migration 0038
-- Created: 2026-01-17
-- Purpose: Optimize query performance across all major tables

-- =============================================================================
-- Rep Portal Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_rep_quotes_rep_status ON rep_quotes(rep_id, status);
CREATE INDEX IF NOT EXISTS idx_rep_quotes_client_created ON rep_quotes(client_id, created_at DESC);

-- =============================================================================
-- Portal Notifications
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_portal_notif_client_read ON portal_notifications(client_id, is_read, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_notif_type_created ON portal_notifications(notification_type, created_at DESC);

-- =============================================================================
-- Beacon Content
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_beacon_items_priority ON beacon_content_items(status, ai_priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_beacon_items_category ON beacon_content_items(category, status);

-- =============================================================================
-- Email System
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_subscriber_seq_next ON subscriber_sequences(next_step_scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_subscriber ON email_logs(subscriber_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscribers_segment ON email_subscribers(segment, status);

-- =============================================================================
-- Restaurant Leads
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_leads_score_pos ON restaurant_leads(lead_score DESC, current_pos);
CREATE INDEX IF NOT EXISTS idx_leads_stage_score ON restaurant_leads(lead_stage, lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_source_rep ON restaurant_leads(source_rep_id, lead_stage);
CREATE INDEX IF NOT EXISTS idx_leads_state_city ON restaurant_leads(state, city);
CREATE INDEX IF NOT EXISTS idx_leads_created ON restaurant_leads(created_at DESC);

-- =============================================================================
-- Automation Jobs
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_auto_jobs_status_priority ON automation_jobs(status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_auto_jobs_client_type ON automation_jobs(client_id, job_type, status);
CREATE INDEX IF NOT EXISTS idx_auto_jobs_scheduled ON automation_jobs(scheduled_at, status);

-- =============================================================================
-- Client Assignments
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_client_rep_assign_rep ON client_rep_assignments(rep_id, role);
CREATE INDEX IF NOT EXISTS idx_client_rep_assign_client ON client_rep_assignments(client_id, role);

-- =============================================================================
-- Tickets
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_tickets_client_status ON tickets(client_id, status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_rep_status ON tickets(rep_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_visibility ON tickets(visibility, status);

-- =============================================================================
-- Message Threads
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_threads_client_updated ON message_threads(client_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_rep_updated ON message_threads(rep_id, updated_at DESC);

-- =============================================================================
-- Messages
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_messages_thread_created ON messages(thread_id, created_at);

-- =============================================================================
-- Menu Jobs
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_menu_jobs_client_status ON menu_jobs(client_id, status);
CREATE INDEX IF NOT EXISTS idx_menu_jobs_created ON menu_jobs(created_at DESC);

-- =============================================================================
-- Stripe
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_stripe_subs_customer ON stripe_subscriptions(stripe_customer_id, status);
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_subscription_events(event_type, created_at DESC);

-- =============================================================================
-- Feature Flags (small table, but for completeness)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);

-- =============================================================================
-- Intel Submissions
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_intel_rep_status ON rep_intel_submissions(rep_id, status, created_at DESC);

-- =============================================================================
-- Referral Credits
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_referral_credits_rep_status ON rep_referral_credits(rep_id, status);
CREATE INDEX IF NOT EXISTS idx_referral_credits_client ON rep_referral_credits(client_id);

-- =============================================================================
-- Activity Log
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_activity_log_rep_created ON rep_activity_log(rep_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_client_created ON rep_activity_log(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON rep_activity_log(activity_type, created_at DESC);
