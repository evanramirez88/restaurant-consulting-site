-- =====================================================
-- CAPE COD CULINARY COMPASS - PUBLIC RECORDS SEED DATA
-- =====================================================

-- Massachusetts ABCC
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('abcc_search', 'abcc_license', NULL,
 'https://www.google.com/search?q=site:mass.gov+ABCC+"{license_number}"',
 'https://www.mass.gov/orgs/alcoholic-beverages-control-commission',
 'MA Alcoholic Beverages Control Commission');

-- Barnstable
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('barnstable_biz', 'business_certificate', 'Barnstable',
 'https://www.google.com/search?q=site:townofbarnstable.us+"{business_name}"+license',
 'https://www.townofbarnstable.us/Departments/TownClerk/Business-Certificates.asp',
 'Town of Barnstable Business Certificates');

INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('barnstable_health', 'health_inspection', 'Barnstable',
 'https://www.google.com/search?q="{business_name}"+Barnstable+MA+health+inspection',
 'https://www.townofbarnstable.us/Departments/Health/',
 'Town of Barnstable Health Department');

-- Bourne
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('bourne_biz', 'business_certificate', 'Bourne',
 'https://www.google.com/search?q=site:townofbourne.com+"{business_name}"',
 'https://www.townofbourne.com/town-clerk/pages/business-certificates',
 'Town of Bourne Business Certificates');

-- Brewster
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('brewster_biz', 'business_certificate', 'Brewster',
 'https://www.google.com/search?q=site:brewster-ma.gov+"{business_name}"',
 'https://www.brewster-ma.gov/town-clerk',
 'Town of Brewster Business Certificates');

-- Chatham
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('chatham_biz', 'business_certificate', 'Chatham',
 'https://www.google.com/search?q=site:chatham-ma.gov+"{business_name}"',
 'https://www.chatham-ma.gov/town-clerk',
 'Town of Chatham Business Certificates');

-- Dennis
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('dennis_biz', 'business_certificate', 'Dennis',
 'https://www.google.com/search?q=site:town.dennis.ma.us+"{business_name}"',
 'https://www.town.dennis.ma.us/town-clerk',
 'Town of Dennis Business Certificates');

-- Eastham
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('eastham_biz', 'business_certificate', 'Eastham',
 'https://www.google.com/search?q=site:eastham-ma.gov+"{business_name}"',
 'https://www.eastham-ma.gov/town-clerk',
 'Town of Eastham Business Certificates');

-- Falmouth
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('falmouth_biz', 'business_certificate', 'Falmouth',
 'https://www.google.com/search?q=site:falmouthma.gov+"{business_name}"',
 'https://www.falmouthma.gov/150/Town-Clerk',
 'Town of Falmouth Business Certificates');

-- Harwich
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('harwich_biz', 'business_certificate', 'Harwich',
 'https://www.google.com/search?q=site:harwich-ma.gov+"{business_name}"',
 'https://www.harwich-ma.gov/town-clerk',
 'Town of Harwich Business Certificates');

-- Mashpee
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('mashpee_biz', 'business_certificate', 'Mashpee',
 'https://www.google.com/search?q=site:mashpeema.gov+"{business_name}"',
 'https://www.mashpeema.gov/town-clerk',
 'Town of Mashpee Business Certificates');

-- Orleans
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('orleans_biz', 'business_certificate', 'Orleans',
 'https://www.google.com/search?q=site:town.orleans.ma.us+"{business_name}"',
 'https://www.town.orleans.ma.us/town-clerk',
 'Town of Orleans Business Certificates');

-- Provincetown
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('provincetown_biz', 'business_certificate', 'Provincetown',
 'https://www.google.com/search?q=site:provincetown-ma.gov+"{business_name}"',
 'https://www.provincetown-ma.gov/154/Town-Clerk',
 'Town of Provincetown Business Certificates');

-- Sandwich
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('sandwich_biz', 'business_certificate', 'Sandwich',
 'https://www.google.com/search?q=site:sandwichmass.org+"{business_name}"',
 'https://www.sandwichmass.org/189/Town-Clerk',
 'Town of Sandwich Business Certificates');

-- Truro
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('truro_biz', 'business_certificate', 'Truro',
 'https://www.google.com/search?q=site:truro-ma.gov+"{business_name}"',
 'https://www.truro-ma.gov/town-clerk',
 'Town of Truro Business Certificates');

-- Wellfleet
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('wellfleet_biz', 'business_certificate', 'Wellfleet',
 'https://www.google.com/search?q=site:wellfleet-ma.gov+"{business_name}"',
 'https://www.wellfleet-ma.gov/town-clerk',
 'Town of Wellfleet Business Certificates');

-- Yarmouth
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('yarmouth_biz', 'business_certificate', 'Yarmouth',
 'https://www.google.com/search?q=site:yarmouth.ma.us+"{business_name}"',
 'https://www.yarmouth.ma.us/141/Town-Clerk',
 'Town of Yarmouth Business Certificates');

-- County Health
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('barnstable_county_health', 'health_inspection', NULL,
 'https://www.google.com/search?q="{business_name}"+"{town}"+MA+health+inspection',
 'https://www.barnstablecountyhealth.org/',
 'Barnstable County Department of Health and Environment');

-- Google Maps
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('google_maps', 'address_verify', NULL,
 'https://www.google.com/maps/search/{business_name}+{address}+{town}+MA',
 'https://www.google.com/maps',
 'Google Maps Address Verification');

-- Yelp
INSERT OR IGNORE INTO public_records_links (id, record_type, town, url_template, search_url, description) VALUES
('yelp_business', 'reviews', NULL,
 'https://www.yelp.com/search?find_desc={business_name}&find_loc={town}%2C+MA',
 'https://www.yelp.com',
 'Yelp Business Listings');
