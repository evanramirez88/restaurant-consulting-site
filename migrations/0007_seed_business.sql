-- Seed initial business data for R&G Consulting LLC
-- Migration 0007: Business seed data

-- Insert R&G Consulting LLC as the first client (the business itself for testing/internal use)
INSERT OR IGNORE INTO clients (
  id,
  email,
  name,
  company,
  slug,
  phone,
  portal_enabled,
  support_plan_tier,
  support_plan_status,
  google_drive_folder_id,
  avatar_url,
  notes,
  timezone,
  created_at,
  updated_at
) VALUES (
  'rg-consulting-internal',
  'evanramirez@ccrestaurantconsulting.com',
  'R&G Consulting LLC',
  'R&G Consulting LLC',
  'rg-consulting',
  '508-247-4936',
  1,
  'premium',
  'active',
  NULL,
  NULL,
  'Internal business account - Cape Cod Restaurant Consulting. Used for system testing and demonstration purposes.',
  'America/New_York',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Insert first rep entry for Toast referral program
INSERT OR IGNORE INTO reps (
  id,
  email,
  name,
  territory,
  slug,
  phone,
  portal_enabled,
  status,
  avatar_url,
  notes,
  created_at,
  updated_at
) VALUES (
  'toast-rep-adam-holmes',
  'adam.holmes@toasttab.com',
  'Adam Holmes',
  'Cape Cod / Massachusetts',
  'adam-holmes',
  NULL,
  1,
  'active',
  NULL,
  'Toast Account Executive - Primary referral partner for Cape Cod region. Key relationship for Lane A local business.',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Create rep assignment linking Adam Holmes to R&G Consulting
INSERT OR IGNORE INTO client_rep_assignments (
  id,
  client_id,
  rep_id,
  role,
  commission_rate,
  created_at,
  updated_at
) VALUES (
  'rg-adam-assignment',
  'rg-consulting-internal',
  'toast-rep-adam-holmes',
  'primary',
  0.0,
  strftime('%s', 'now'),
  strftime('%s', 'now')
);
