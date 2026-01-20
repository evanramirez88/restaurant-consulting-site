-- =====================================================
-- CAPE COD CULINARY COMPASS - VALIDATION RULES SEED DATA
-- =====================================================

-- Required fields
INSERT OR IGNORE INTO import_validation_rules (id, field_name, rule_type, rule_config, error_message, severity) VALUES
('val_name_required', 'name', 'required', '{}', 'Restaurant name is required', 'error');

INSERT OR IGNORE INTO import_validation_rules (id, field_name, rule_type, rule_config, error_message, severity) VALUES
('val_town_required', 'town', 'required', '{}', 'Town is required', 'error');

INSERT OR IGNORE INTO import_validation_rules (id, field_name, rule_type, rule_config, error_message, severity) VALUES
('val_region_required', 'region', 'required', '{}', 'Region is required', 'error');

-- Cape Cod towns only
INSERT OR IGNORE INTO import_validation_rules (id, field_name, rule_type, rule_config, error_message, severity) VALUES
('val_town_enum', 'town', 'enum',
 '{"values": ["Barnstable", "Bourne", "Brewster", "Chatham", "Dennis", "Eastham", "Falmouth", "Harwich", "Mashpee", "Orleans", "Provincetown", "Sandwich", "Truro", "Wellfleet", "Yarmouth"]}',
 'Town must be one of the 15 Cape Cod towns',
 'error');

-- Region validation
INSERT OR IGNORE INTO import_validation_rules (id, field_name, rule_type, rule_config, error_message, severity) VALUES
('val_region_enum', 'region', 'enum',
 '{"values": ["Outer Cape", "Lower Cape", "Mid Cape", "Upper Cape"]}',
 'Region must be Outer Cape, Lower Cape, Mid Cape, or Upper Cape',
 'error');

-- Block non-Cape Cod locations
INSERT OR IGNORE INTO import_validation_rules (id, field_name, rule_type, rule_config, error_message, severity) VALUES
('val_no_boston', 'town', 'custom',
 '{"type": "blocklist", "values": ["Boston", "Cambridge", "Somerville", "Quincy", "Brookline", "Newton", "Worcester", "Springfield", "Brockton", "Fall River", "New Bedford", "Lynn", "Lawrence", "Lowell"]}',
 'Only Cape Cod towns allowed - metro Boston and other MA cities are excluded',
 'error');

-- Range validations
INSERT OR IGNORE INTO import_validation_rules (id, field_name, rule_type, rule_config, error_message, severity) VALUES
('val_price_range', 'price_level', 'range', '{"min": 1, "max": 4}', 'Price level must be 1-4', 'warning');

INSERT OR IGNORE INTO import_validation_rules (id, field_name, rule_type, rule_config, error_message, severity) VALUES
('val_rating_range', 'rating', 'range', '{"min": 1.0, "max": 5.0}', 'Rating must be between 1.0 and 5.0', 'warning');

INSERT OR IGNORE INTO import_validation_rules (id, field_name, rule_type, rule_config, error_message, severity) VALUES
('val_health_range', 'health_score', 'range', '{"min": 0, "max": 100}', 'Health score must be between 0 and 100', 'warning');

-- Known POS systems
INSERT OR IGNORE INTO import_validation_rules (id, field_name, rule_type, rule_config, error_message, severity) VALUES
('val_pos_enum', 'pos_system', 'enum',
 '{"values": ["Toast", "Square", "Clover", "Aloha", "Micros", "Lightspeed", "Upserve", "TouchBistro", "Revel", "SpotOn", "NCR", "Heartland", "Lavu", "Unknown"]}',
 'Unrecognized POS system - verify spelling or use Unknown',
 'info');

-- Online ordering platforms
INSERT OR IGNORE INTO import_validation_rules (id, field_name, rule_type, rule_config, error_message, severity) VALUES
('val_online_ordering_enum', 'online_ordering', 'enum',
 '{"values": ["Toast", "Grubhub", "UberEats", "DoorDash", "Slice", "ChowNow", "Direct", "None"]}',
 'Unrecognized online ordering platform',
 'info');

-- License types
INSERT OR IGNORE INTO import_validation_rules (id, field_name, rule_type, rule_config, error_message, severity) VALUES
('val_license_type_enum', 'license_type', 'enum',
 '{"values": ["Common Victualler", "Liquor (Full)", "Liquor (Beer/Wine)", "Seasonal", "Retail Food", "Catering"]}',
 'Unrecognized license type',
 'info');

-- Service styles
INSERT OR IGNORE INTO import_validation_rules (id, field_name, rule_type, rule_config, error_message, severity) VALUES
('val_service_style_enum', 'service_style', 'enum',
 '{"values": ["Fine Dining", "Upscale Casual", "Full Service", "Fast Casual", "Quick Service", "Counter Service", "Bar/Lounge", "Food Truck", "Takeout Only"]}',
 'Unrecognized service style',
 'info');

-- Data Refresh Schedule
INSERT OR IGNORE INTO data_refresh_schedule (id, schedule_name, cron_expression, refresh_type, status, config_json) VALUES
('refresh_5am', 'Morning Directory Refresh', '0 5 * * *', 'full_directory', 'active',
 '{"tasks": ["validate_data", "check_websites", "update_pos_detection"]}');

INSERT OR IGNORE INTO data_refresh_schedule (id, schedule_name, cron_expression, refresh_type, status, config_json) VALUES
('refresh_5pm', 'Evening Directory Refresh', '0 17 * * *', 'full_directory', 'active',
 '{"tasks": ["validate_data", "sync_external_sources"]}');

INSERT OR IGNORE INTO data_refresh_schedule (id, schedule_name, cron_expression, refresh_type, status, config_json) VALUES
('enrich_daily', 'Daily AI Enrichment', '0 6 * * *', 'enrichment', 'active',
 '{"model": "mistral-7b", "max_records": 50, "priority": "missing_data"}');

INSERT OR IGNORE INTO data_refresh_schedule (id, schedule_name, cron_expression, refresh_type, status, config_json) VALUES
('health_weekly', 'Weekly Health Score Check', '0 3 * * 1', 'health_scores', 'active',
 '{"source": "barnstable_county_health"}');
