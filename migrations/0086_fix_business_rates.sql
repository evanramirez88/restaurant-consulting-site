-- Migration: 0082_fix_business_rates.sql
-- Fixes CF-1: Seed business rates with CLAUDE.md documented values
-- Applied: 2026-01-26

-- CF-1: Config shows wrong rates (or empty)
-- Correct values per CLAUDE.md:
-- - Non-plan: $175/hr
-- - On-site: $200/hr (2hr min)
-- - Emergency: $250/hr
-- - Plan overage: $100-125/hr

-- Use INSERT OR REPLACE to handle both empty table and existing data
INSERT OR REPLACE INTO business_rates (key, value, updated_at) VALUES ('standard_hourly', '175', unixepoch());
INSERT OR REPLACE INTO business_rates (key, value, updated_at) VALUES ('emergency_rate', '250', unixepoch());
INSERT OR REPLACE INTO business_rates (key, value, updated_at) VALUES ('onsite_rate', '200', unixepoch());
INSERT OR REPLACE INTO business_rates (key, value, updated_at) VALUES ('consultation', '175', unixepoch());
INSERT OR REPLACE INTO business_rates (key, value, updated_at) VALUES ('plan_overage', '100', unixepoch());
