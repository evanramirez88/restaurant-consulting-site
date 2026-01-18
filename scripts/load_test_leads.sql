-- Test Leads for Platform Testing
-- 20 quality leads across different segments
-- Generated: 2026-01-17
-- Uses correct schema: name, address_line1, primary_email, primary_phone

-- 5 Toast Existing (Support Plan Upsell Targets)
INSERT OR IGNORE INTO restaurant_leads (id, name, primary_email, primary_phone, address_line1, city, state, zip, current_pos, lead_score, status, source, tags, notes, created_at)
VALUES
  ('test-lead-001', 'Coastal Kitchen & Bar', 'manager@coastalkitchen.com', '508-555-0101', '123 Harbor View Rd', 'Provincetown', 'MA', '02657', 'Toast', 85, 'prospect', 'test_import', 'toast_existing,renewal_soon', 'Renewal date 2026-03-15', unixepoch()),
  ('test-lead-002', 'The Lobster Trap', 'info@lobstertrap.com', '508-555-0102', '456 Commercial St', 'Provincetown', 'MA', '02657', 'Toast', 78, 'prospect', 'test_import', 'toast_existing', 'Renewal date 2026-04-01', unixepoch()),
  ('test-lead-003', 'Wellfleet Oyster House', 'contact@wellfleetoyster.com', '508-555-0103', '789 Main St', 'Wellfleet', 'MA', '02667', 'Toast', 82, 'prospect', 'test_import', 'toast_existing', 'Renewal date 2026-05-20', unixepoch()),
  ('test-lead-004', 'Chatham Pier Fish Market', 'orders@chathamfish.com', '508-555-0104', '321 Shore Rd', 'Chatham', 'MA', '02633', 'Toast', 90, 'prospect', 'test_import', 'toast_existing,high_value,renewal_soon', 'Renewal date 2026-02-28, premium candidate', unixepoch()),
  ('test-lead-005', 'Orleans Bistro', 'reservations@orleansbistro.com', '508-555-0105', '654 Route 6A', 'Orleans', 'MA', '02653', 'Toast', 75, 'prospect', 'test_import', 'toast_existing', 'Renewal date 2026-06-10', unixepoch());

-- 5 POS Switchers (Clover/Square Migration Targets)
INSERT OR IGNORE INTO restaurant_leads (id, name, primary_email, primary_phone, address_line1, city, state, zip, current_pos, lead_score, status, source, tags, notes, created_at)
VALUES
  ('test-lead-006', 'Hyannis Harbor Grille', 'owner@hyannisgrille.com', '508-555-0106', '100 Ocean St', 'Hyannis', 'MA', '02601', 'Clover', 72, 'prospect', 'test_import', 'switcher_clover,cape_cod', 'Frustrated with Clover fees', unixepoch()),
  ('test-lead-007', 'Falmouth Fresh Cafe', 'hello@falmouthfresh.com', '508-555-0107', '200 Main St', 'Falmouth', 'MA', '02540', 'Square', 68, 'prospect', 'test_import', 'switcher_square,cape_cod', 'Looking for better reporting', unixepoch()),
  ('test-lead-008', 'Sandwich Tavern', 'info@sandwichtavern.com', '508-555-0108', '300 Route 6A', 'Sandwich', 'MA', '02563', 'Clover', 74, 'prospect', 'test_import', 'switcher_clover,cape_cod', 'Needs KDS integration', unixepoch()),
  ('test-lead-009', 'Brewster Breakfast Club', 'breakfast@brewsterclub.com', '508-555-0109', '400 Underpass Rd', 'Brewster', 'MA', '02631', 'Square', 65, 'prospect', 'test_import', 'switcher_square,cape_cod', 'Growing, needs more features', unixepoch()),
  ('test-lead-010', 'Dennis Port Diner', 'diner@dennisport.com', '508-555-0110', '500 Lower County Rd', 'Dennis Port', 'MA', '02639', 'Upserve', 70, 'prospect', 'test_import', 'switcher_upserve,cape_cod', 'Upserve sunset concern', unixepoch());

-- 5 Contactable (Have Email + Phone, Good Fit)
INSERT OR IGNORE INTO restaurant_leads (id, name, primary_email, primary_phone, address_line1, city, state, zip, current_pos, lead_score, status, source, tags, notes, created_at)
VALUES
  ('test-lead-011', 'Yarmouth Yacht Club Restaurant', 'events@yarmouthyc.com', '508-555-0111', '600 Willow St', 'Yarmouth', 'MA', '02673', NULL, 60, 'prospect', 'test_import', 'contactable,cape_cod', 'Private club, high-end clientele', unixepoch()),
  ('test-lead-012', 'Barnstable Brewing Co', 'taproom@barnstablebrewing.com', '508-555-0112', '700 Route 132', 'Barnstable', 'MA', '02630', NULL, 55, 'prospect', 'test_import', 'contactable,cape_cod', 'Brewery with food service', unixepoch()),
  ('test-lead-013', 'Mashpee Commons Cafe', 'cafe@mashpeecommons.com', '508-555-0113', '800 Steeple St', 'Mashpee', 'MA', '02649', NULL, 58, 'prospect', 'test_import', 'contactable,cape_cod', 'High traffic location', unixepoch()),
  ('test-lead-014', 'Bourne Bridge Restaurant', 'manager@bournebridge.com', '508-555-0114', '900 Scenic Hwy', 'Bourne', 'MA', '02532', NULL, 62, 'prospect', 'test_import', 'contactable,cape_cod', 'Waterfront dining', unixepoch()),
  ('test-lead-015', 'Wareham Waterfront Grill', 'reservations@warehamgrill.com', '508-555-0115', '1000 Onset Ave', 'Wareham', 'MA', '02571', NULL, 57, 'prospect', 'test_import', 'contactable,cape_cod', 'Seasonal, high volume', unixepoch());

-- 5 High Value (Score 80+, Prime Targets)
INSERT OR IGNORE INTO restaurant_leads (id, name, primary_email, primary_phone, address_line1, city, state, zip, current_pos, lead_score, status, source, tags, notes, created_at)
VALUES
  ('test-lead-016', 'The Captain Linnell House', 'events@captainlinnell.com', '508-555-0116', '137 Skatet Beach Rd', 'Orleans', 'MA', '02653', 'Toast', 92, 'prospect', 'test_import', 'high_value,toast_existing,cape_cod', 'Historic fine dining, wedding venue, renewal 2026-02-15', unixepoch()),
  ('test-lead-017', 'Ocean House Restaurant', 'dining@oceanhouse.com', '508-555-0117', '425 Commercial St', 'Provincetown', 'MA', '02657', 'Clover', 88, 'prospect', 'test_import', 'high_value,switcher_clover,cape_cod', 'Multi-location potential, frustrated with current POS', unixepoch()),
  ('test-lead-018', 'Wicked Oyster', 'info@wickedoyster.com', '508-555-0118', '50 Main St', 'Wellfleet', 'MA', '02667', 'Toast', 95, 'prospect', 'test_import', 'high_value,toast_existing,expansion', 'Expanding to second location, needs unified system', unixepoch()),
  ('test-lead-019', 'Mac Seafood Group', 'corporate@macseafood.com', '508-555-0119', '265 Commercial St', 'Wellfleet', 'MA', '02667', 'Multiple', 98, 'prospect', 'test_import', 'high_value,multi_location,cape_cod', '5 locations, consolidation project potential', unixepoch()),
  ('test-lead-020', 'Embargo Restaurant', 'chef@embargohyannis.com', '508-555-0120', '453 Main St', 'Hyannis', 'MA', '02601', 'Square', 86, 'prospect', 'test_import', 'high_value,switcher_square,cape_cod', 'Upscale Spanish, ready for upgrade', unixepoch());
