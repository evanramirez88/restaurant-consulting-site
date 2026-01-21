-- Migration: 0063_seed_real_cape_cod_data.sql
-- Description: Seed real Cape Cod restaurants as leads

-- Hyannis
INSERT OR IGNORE INTO restaurant_leads (id, name, dba_name, city, state, zip, cuisine_primary, restaurant_type_id, status) VALUES
('lead_black_cat', 'The Black Cat Tavern', 'Black Cat Tavern', 'Hyannis', 'MA', '02601', 'seafood', 'seafood_casual', 'prospect'),
('lead_spankys', 'Spanky''s Clam Shack', 'Spanky''s', 'Hyannis', 'MA', '02601', 'seafood', 'seafood_casual', 'prospect'),
('lead_baxters', 'Baxter''s Boathouse', 'Baxter''s', 'Hyannis', 'MA', '02601', 'seafood', 'seafood_casual', 'prospect'),
('lead_albertos', 'Alberto''s Ristorante', 'Alberto''s', 'Hyannis', 'MA', '02601', 'italian', 'fine_italian', 'prospect');

-- Provincetown
INSERT OR IGNORE INTO restaurant_leads (id, name, dba_name, city, state, zip, cuisine_primary, restaurant_type_id, status) VALUES
('lead_lobster_pot', 'The Lobster Pot', 'Lobster Pot', 'Provincetown', 'MA', '02657', 'seafood', 'seafood_casual', 'prospect'),
('lead_canteen', 'The Canteen', 'The Canteen', 'Provincetown', 'MA', '02657', 'american', 'casual_american', 'prospect'),
('lead_ross_grill', 'Ross Grill', 'Ross Grill', 'Provincetown', 'MA', '02657', 'american', 'upscale_casual', 'prospect');

-- Chatham
INSERT OR IGNORE INTO restaurant_leads (id, name, dba_name, city, state, zip, cuisine_primary, restaurant_type_id, status) VALUES
('lead_cbi_beach_house', 'Beach House Grill', 'Chatham Bars Inn Beach House', 'Chatham', 'MA', '02633', 'seafood', 'upscale_casual', 'prospect'),
('lead_macs_chatham', 'Mac''s Chatham Fish & Lobster', 'Mac''s Chatham', 'Chatham', 'MA', '02633', 'seafood', 'seafood_casual', 'prospect'),
('lead_squire', 'The Chatham Squire', 'The Squire', 'Chatham', 'MA', '02633', 'pub', 'bar', 'prospect');

-- Dennis
INSERT OR IGNORE INTO restaurant_leads (id, name, dba_name, city, state, zip, cuisine_primary, restaurant_type_id, status) VALUES
('lead_ocean_house', 'Ocean House Restaurant', 'Ocean House', 'Dennis Port', 'MA', '02639', 'seafood', 'fine_dining', 'prospect'),
('lead_sesuit', 'Sesuit Harbor Cafe', 'Sesuit Harbor', 'Dennis', 'MA', '02638', 'seafood', 'seafood_casual', 'prospect'),
('lead_marshside', 'The Marshside', 'The Marshside', 'East Dennis', 'MA', '02641', 'american', 'casual_american', 'prospect');

-- Sandwich
INSERT OR IGNORE INTO restaurant_leads (id, name, dba_name, city, state, zip, cuisine_primary, restaurant_type_id, status) VALUES
('lead_fishermens_view', 'Fishermen''s View', 'Fishermen''s View', 'Sandwich', 'MA', '02563', 'seafood', 'upscale_casual', 'prospect'),
('lead_seafood_sams', 'Seafood Sam''s', 'Seafood Sam''s', 'Sandwich', 'MA', '02563', 'seafood', 'seafood_casual', 'prospect');

-- Wellfleet
INSERT OR IGNORE INTO restaurant_leads (id, name, dba_name, city, state, zip, cuisine_primary, restaurant_type_id, status) VALUES
('lead_beachcomber', 'The Beachcomber', 'The Beachcomber', 'Wellfleet', 'MA', '02667', 'american', 'bar', 'prospect'),
('lead_macs_pier', 'Mac''s On The Pier', 'Mac''s Wellfleet', 'Wellfleet', 'MA', '02667', 'seafood', 'seafood_casual', 'prospect');

-- Yarmouth
INSERT OR IGNORE INTO restaurant_leads (id, name, dba_name, city, state, zip, cuisine_primary, restaurant_type_id, status) VALUES
('lead_skipper', 'The Skipper Chowder House', 'The Skipper', 'South Yarmouth', 'MA', '02664', 'seafood', 'casual_american', 'prospect'),
('lead_capt_parkers', 'Captain Parker''s Pub', 'Captain Parker''s', 'West Yarmouth', 'MA', '02673', 'seafood', 'pub', 'prospect');

-- Falmouth
INSERT OR IGNORE INTO restaurant_leads (id, name, dba_name, city, state, zip, cuisine_primary, restaurant_type_id, status) VALUES
('lead_anejo', 'Añejo Mexican Bistro', 'Añejo', 'Falmouth', 'MA', '02540', 'mexican', 'casual_american', 'prospect'),
('lead_quarterdeck', 'Quarterdeck Restaurant', 'Quarterdeck', 'Falmouth', 'MA', '02540', 'seafood', 'casual_american', 'prospect');

-- Mashpee
INSERT OR IGNORE INTO restaurant_leads (id, name, dba_name, city, state, zip, cuisine_primary, restaurant_type_id, status) VALUES
('lead_siena', 'Siena', 'Siena Mashpee', 'Mashpee', 'MA', '02649', 'italian', 'casual_italian', 'prospect'),
('lead_cookes', 'Cooke''s Seafood', 'Cooke''s', 'Mashpee', 'MA', '02649', 'seafood', 'seafood_casual', 'prospect');
