-- ============================================
-- Phase 3: Admin Portal "Brain" Enhancements
-- Database migrations for intelligence engine,
-- automation jobs, and Toast integrations
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- AUTOMATION JOBS
-- ============================================

CREATE TABLE IF NOT EXISTS automation_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    priority INTEGER DEFAULT 1,
    config JSONB DEFAULT '{}',
    result JSONB,
    error TEXT,
    progress INTEGER DEFAULT 0,
    progress_message TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    depends_on UUID[] DEFAULT '{}',
    retry_on_failure BOOLEAN DEFAULT TRUE,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 3600,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_automation_jobs_client ON automation_jobs(client_id);
CREATE INDEX idx_automation_jobs_status ON automation_jobs(status);
CREATE INDEX idx_automation_jobs_type ON automation_jobs(job_type);
CREATE INDEX idx_automation_jobs_scheduled ON automation_jobs(scheduled_at) WHERE status IN ('pending', 'queued');
CREATE INDEX idx_automation_jobs_priority ON automation_jobs(priority DESC, created_at ASC) WHERE status = 'queued';

-- ============================================
-- TOAST INTEGRATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS toast_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    toast_guid VARCHAR(100) NOT NULL UNIQUE,
    username VARCHAR(255) NOT NULL,
    encrypted_password TEXT NOT NULL,
    encrypted_totp_secret TEXT,
    partner_code VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_toast_integrations_client ON toast_integrations(client_id);
CREATE INDEX idx_toast_integrations_restaurant ON toast_integrations(restaurant_id);
CREATE INDEX idx_toast_integrations_status ON toast_integrations(status);

-- ============================================
-- TOAST MENUS & ITEMS
-- ============================================

CREATE TABLE IF NOT EXISTS toast_menus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES toast_integrations(id) ON DELETE CASCADE,
    guid VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    item_count INTEGER DEFAULT 0,
    modifier_count INTEGER DEFAULT 0,
    raw_data JSONB,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(integration_id, guid)
);

CREATE TABLE IF NOT EXISTS toast_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES toast_integrations(id) ON DELETE CASCADE,
    menu_id UUID REFERENCES toast_menus(id) ON DELETE CASCADE,
    guid VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2),
    category VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    modifier_groups UUID[] DEFAULT '{}',
    raw_data JSONB,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(integration_id, guid)
);

CREATE INDEX idx_toast_items_integration ON toast_items(integration_id);
CREATE INDEX idx_toast_items_menu ON toast_items(menu_id);
CREATE INDEX idx_toast_items_category ON toast_items(category);

CREATE TABLE IF NOT EXISTS toast_modifier_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES toast_integrations(id) ON DELETE CASCADE,
    guid VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    min_selections INTEGER DEFAULT 0,
    max_selections INTEGER DEFAULT 1,
    is_required BOOLEAN DEFAULT FALSE,
    modifiers JSONB DEFAULT '[]',
    raw_data JSONB,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(integration_id, guid)
);

CREATE INDEX idx_toast_modifiers_integration ON toast_modifier_groups(integration_id);

-- ============================================
-- TOAST HEALTH CHECKS
-- ============================================

CREATE TABLE IF NOT EXISTS toast_health_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES toast_integrations(id) ON DELETE CASCADE,
    login_success BOOLEAN NOT NULL,
    menu_accessible BOOLEAN NOT NULL,
    ui_changes_detected BOOLEAN DEFAULT FALSE,
    response_time_ms INTEGER,
    selector_health JSONB DEFAULT '{}',
    error TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_toast_health_integration ON toast_health_checks(integration_id);
CREATE INDEX idx_toast_health_checked_at ON toast_health_checks(checked_at DESC);

-- ============================================
-- GOLDEN COPIES
-- ============================================

CREATE TABLE IF NOT EXISTS toast_golden_copies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES toast_integrations(id) ON DELETE CASCADE,
    page_name VARCHAR(100) NOT NULL,
    screenshot_path TEXT,
    selectors_hash VARCHAR(64),
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(integration_id, page_name)
);

CREATE INDEX idx_golden_copies_integration ON toast_golden_copies(integration_id);

-- ============================================
-- ALERTS
-- ============================================

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    category VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(255),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_category ON alerts(category);
CREATE INDEX idx_alerts_acknowledged ON alerts(acknowledged);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);

-- ============================================
-- RECOMMENDATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    impact_score INTEGER DEFAULT 50,
    effort_score INTEGER DEFAULT 50,
    priority INTEGER DEFAULT 5,
    action_items JSONB DEFAULT '[]',
    estimated_value DECIMAL(10, 2),
    status VARCHAR(20) DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_recommendations_client ON recommendations(client_id);
CREATE INDEX idx_recommendations_type ON recommendations(recommendation_type);
CREATE INDEX idx_recommendations_status ON recommendations(status);
CREATE INDEX idx_recommendations_priority ON recommendations(priority DESC);

-- ============================================
-- ACTIVITY LOG
-- ============================================

CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    user_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_client ON activity_log(client_id);
CREATE INDEX idx_activity_action ON activity_log(action);
CREATE INDEX idx_activity_created ON activity_log(created_at DESC);

-- ============================================
-- SYNC QUEUE
-- ============================================

CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    direction VARCHAR(20) DEFAULT 'to_cloud',
    payload JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sync_queue_status ON sync_queue(status);
CREATE INDEX idx_sync_queue_direction ON sync_queue(direction);
CREATE INDEX idx_sync_queue_created ON sync_queue(created_at);

-- ============================================
-- TICKETS (Support)
-- ============================================

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'open',
    priority VARCHAR(20) DEFAULT 'normal',
    assigned_to VARCHAR(255),
    first_response_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tickets_client ON tickets(client_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_assigned ON tickets(assigned_to);

-- ============================================
-- PROJECTS
-- ============================================

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'draft',
    project_type VARCHAR(50),
    start_date DATE,
    target_date DATE,
    completed_date DATE,
    budget DECIMAL(10, 2),
    actual_cost DECIMAL(10, 2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);

-- ============================================
-- QUOTES
-- ============================================

CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    quote_number VARCHAR(50) UNIQUE,
    status VARCHAR(20) DEFAULT 'draft',
    line_items JSONB DEFAULT '[]',
    subtotal DECIMAL(10, 2),
    discounts JSONB DEFAULT '[]',
    total DECIMAL(10, 2),
    notes TEXT,
    valid_until DATE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_quotes_client ON quotes(client_id);
CREATE INDEX idx_quotes_status ON quotes(status);

-- ============================================
-- HELPER FUNCTION: Update timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'updated_at'
        AND table_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', t, t);
        EXECUTE format('CREATE TRIGGER update_%I_updated_at
                        BEFORE UPDATE ON %I
                        FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SAMPLE DATA (Optional, for development)
-- ============================================

-- Insert sample alert types
-- INSERT INTO alerts (severity, category, title, message)
-- VALUES
--     ('info', 'system', 'Phase 3 Deployed', 'Admin Portal Brain enhancements are now active'),
--     ('warning', 'maintenance', 'Scheduled Maintenance', 'System maintenance scheduled for next Sunday');
