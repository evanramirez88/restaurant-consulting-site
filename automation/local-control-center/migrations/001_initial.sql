-- ============================================
-- R&G Consulting Local Control Center
-- Initial Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE BUSINESS TABLES
-- ============================================

-- Clients table (extended from Cloudflare D1)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cloudflare_id TEXT UNIQUE,  -- Reference to D1 record
    hubspot_id VARCHAR(50),
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    portal_enabled BOOLEAN DEFAULT false,
    support_plan_tier VARCHAR(50),
    support_plan_status VARCHAR(50),
    square_customer_id VARCHAR(100),
    google_drive_folder_id VARCHAR(255),
    local_folder_path VARCHAR(500),  -- Path on Seagate drive
    avatar_url TEXT,
    notes TEXT,
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    tags JSONB DEFAULT '[]'::jsonb,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_to_cloud_at TIMESTAMP WITH TIME ZONE,
    synced_from_cloud_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_slug ON clients(slug);
CREATE INDEX idx_clients_hubspot_id ON clients(hubspot_id);
CREATE INDEX idx_clients_cloudflare_id ON clients(cloudflare_id);

-- Restaurants table (multi-location support)
CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cloudflare_id TEXT UNIQUE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    pos_system VARCHAR(50),  -- Toast, Square, Clover, etc.
    pos_version VARCHAR(50),
    toast_restaurant_guid VARCHAR(100),  -- Toast API reference
    square_location_id VARCHAR(100),
    number_of_stations INTEGER,
    monthly_volume DECIMAL(12,2),
    cuisine_type VARCHAR(100),
    service_style VARCHAR(50),  -- full_service, counter, quick_service
    operating_hours JSONB,
    special_equipment JSONB,  -- KDS, printers, handhelds, etc.
    integration_status JSONB,  -- 3rd party integrations like DoorDash, etc.
    notes TEXT,
    local_folder_path VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_restaurants_client_id ON restaurants(client_id);
CREATE INDEX idx_restaurants_pos_system ON restaurants(pos_system);
CREATE INDEX idx_restaurants_toast_guid ON restaurants(toast_restaurant_guid);

-- Contacts (key personnel at each client/restaurant)
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    is_primary BOOLEAN DEFAULT false,
    is_billing_contact BOOLEAN DEFAULT false,
    is_technical_contact BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contacts_client_id ON contacts(client_id);
CREATE INDEX idx_contacts_restaurant_id ON contacts(restaurant_id);

-- ============================================
-- PROJECTS & TASKS
-- ============================================

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cloudflare_id TEXT UNIQUE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_type VARCHAR(50),  -- implementation, menu_build, support, training
    status VARCHAR(50) DEFAULT 'pending',  -- pending, in_progress, completed, on_hold
    priority INTEGER DEFAULT 5,  -- 1-10
    progress_percentage INTEGER DEFAULT 0,
    due_date DATE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    assigned_to VARCHAR(255),
    estimated_hours DECIMAL(8,2),
    actual_hours DECIMAL(8,2),
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_due_date ON projects(due_date);

CREATE TABLE project_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    parent_task_id UUID REFERENCES project_tasks(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    due_date DATE,
    assigned_to VARCHAR(255),
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    completed_at TIMESTAMP WITH TIME ZONE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_status ON project_tasks(status);

-- ============================================
-- QUOTES & PRICING
-- ============================================

CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cloudflare_id TEXT UNIQUE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
    quote_number VARCHAR(50) UNIQUE,
    version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'draft',  -- draft, sent, viewed, accepted, rejected, expired
    
    -- Hardware Configuration
    hardware_config JSONB,  -- Array of hardware items with quantities
    station_config JSONB,   -- Station placements and configurations
    cabling_config JSONB,   -- Cable runs and specifications
    
    -- Pricing
    travel_zone VARCHAR(50),
    support_tier INTEGER DEFAULT 0,  -- 0, 10, 20, 30 percent
    
    -- Calculated Totals
    total_hardware DECIMAL(12,2) DEFAULT 0,
    total_labor DECIMAL(12,2) DEFAULT 0,
    total_travel DECIMAL(12,2) DEFAULT 0,
    total_monthly DECIMAL(12,2) DEFAULT 0,
    total_annual DECIMAL(12,2) DEFAULT 0,
    total_one_time DECIMAL(12,2) DEFAULT 0,
    
    -- Files
    pdf_path VARCHAR(500),
    local_file_path VARCHAR(500),
    
    -- Payment
    stripe_session_id VARCHAR(255),
    deposit_amount DECIMAL(12,2),
    deposit_paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Validity
    valid_until DATE,
    viewed_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    
    notes TEXT,
    internal_notes TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_quotes_client_id ON quotes(client_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_quote_number ON quotes(quote_number);

-- ============================================
-- MENUS
-- ============================================

CREATE TABLE menus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cloudflare_id TEXT UNIQUE,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'draft',  -- draft, review, approved, deployed
    
    -- Menu Data
    menu_data JSONB,  -- Complete parsed menu structure
    categories JSONB,  -- Category list with sort order
    items_count INTEGER DEFAULT 0,
    modifiers_count INTEGER DEFAULT 0,
    
    -- Source Files
    source_file_path VARCHAR(500),
    source_file_type VARCHAR(50),  -- pdf, image, csv, manual
    
    -- Export Paths
    pdf_export_path VARCHAR(500),
    toast_export_path VARCHAR(500),
    square_export_path VARCHAR(500),
    
    -- Deployment
    deployed_to_toast_at TIMESTAMP WITH TIME ZONE,
    deployed_to_square_at TIMESTAMP WITH TIME ZONE,
    deployment_notes TEXT,
    
    -- Classification (from AI)
    cuisine_classification JSONB,
    pricing_tier VARCHAR(50),  -- budget, moderate, upscale, fine_dining
    
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_menus_restaurant_id ON menus(restaurant_id);
CREATE INDEX idx_menus_status ON menus(status);

-- ============================================
-- SUPPORT & TICKETS
-- ============================================

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cloudflare_id TEXT UNIQUE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
    ticket_number VARCHAR(50) UNIQUE,
    subject VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(100),  -- pos_issue, menu_update, training, billing, etc.
    priority VARCHAR(50) DEFAULT 'normal',  -- low, normal, high, urgent
    status VARCHAR(50) DEFAULT 'open',  -- open, in_progress, waiting, resolved, closed
    
    -- Assignment
    assigned_to VARCHAR(255),
    escalated_to VARCHAR(255),
    
    -- Resolution
    resolution TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    
    -- SLA
    sla_due_at TIMESTAMP WITH TIME ZONE,
    first_response_at TIMESTAMP WITH TIME ZONE,
    
    -- Time Tracking
    time_spent_minutes INTEGER DEFAULT 0,
    billable BOOLEAN DEFAULT true,
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tickets_client_id ON tickets(client_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);

CREATE TABLE ticket_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    author VARCHAR(255) NOT NULL,
    author_type VARCHAR(50),  -- admin, client, system
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);

-- ============================================
-- FILES & DOCUMENTS
-- ============================================

CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    
    filename VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500),
    mime_type VARCHAR(100),
    file_size BIGINT,
    
    -- Storage
    storage_type VARCHAR(50) DEFAULT 'local',  -- local, minio, r2, google_drive
    local_path VARCHAR(1000),
    cloud_key VARCHAR(500),
    
    -- Metadata
    category VARCHAR(100),  -- menu, quote, contract, training, other
    description TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    
    -- Versioning
    version INTEGER DEFAULT 1,
    parent_file_id UUID REFERENCES files(id),
    
    uploaded_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_files_client_id ON files(client_id);
CREATE INDEX idx_files_restaurant_id ON files(restaurant_id);
CREATE INDEX idx_files_category ON files(category);

-- ============================================
-- SYNC & AUDIT
-- ============================================

CREATE TABLE sync_queue (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,  -- create, update, delete
    direction VARCHAR(50) DEFAULT 'to_cloud',  -- to_cloud, from_cloud
    payload JSONB,
    status VARCHAR(50) DEFAULT 'pending',  -- pending, processing, completed, failed
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT unique_pending_sync UNIQUE (entity_type, entity_id, action, status)
);

CREATE INDEX idx_sync_queue_status ON sync_queue(status);
CREATE INDEX idx_sync_queue_entity ON sync_queue(entity_type, entity_id);

CREATE TABLE activity_log (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    action VARCHAR(50) NOT NULL,
    actor_type VARCHAR(50),  -- admin, client, rep, system, api
    actor_id UUID,
    actor_name VARCHAR(255),
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_created ON activity_log(created_at);
CREATE INDEX idx_activity_log_actor ON activity_log(actor_type, actor_id);

-- ============================================
-- VIEWS
-- ============================================

-- Client summary view
CREATE VIEW client_summary AS
SELECT 
    c.id,
    c.name,
    c.company,
    c.email,
    c.slug,
    c.support_plan_tier,
    c.support_plan_status,
    c.created_at,
    COUNT(DISTINCT r.id) as restaurant_count,
    COUNT(DISTINCT p.id) as project_count,
    COUNT(DISTINCT CASE WHEN p.status = 'in_progress' THEN p.id END) as active_projects,
    COUNT(DISTINCT CASE WHEN t.status IN ('open', 'in_progress') THEN t.id END) as open_tickets,
    MAX(t.created_at) as last_ticket_at
FROM clients c
LEFT JOIN restaurants r ON r.client_id = c.id
LEFT JOIN projects p ON p.client_id = c.id
LEFT JOIN tickets t ON t.client_id = c.id
GROUP BY c.id;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_project_tasks_updated_at BEFORE UPDATE ON project_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menus_updated_at BEFORE UPDATE ON menus FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Generate quote number
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quote_number IS NULL THEN
        NEW.quote_number = 'RG-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(NEXTVAL('quote_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1;
CREATE TRIGGER auto_quote_number BEFORE INSERT ON quotes FOR EACH ROW EXECUTE FUNCTION generate_quote_number();

-- Generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ticket_number IS NULL THEN
        NEW.ticket_number = 'TKT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('ticket_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1;
CREATE TRIGGER auto_ticket_number BEFORE INSERT ON tickets FOR EACH ROW EXECUTE FUNCTION generate_ticket_number();

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert Evan as first client (for testing)
INSERT INTO clients (email, name, company, slug, phone, portal_enabled, support_plan_tier, support_plan_status, notes)
VALUES (
    'evanramirez88@gmail.com',
    'Evan Ramirez',
    'R&G Consulting LLC',
    'rg-consulting',
    '508-555-1234',
    true,
    'premium',
    'active',
    'Owner/Admin account - used for testing and system administration'
);

COMMIT;
