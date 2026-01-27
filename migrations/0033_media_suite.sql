-- Media Suite Database Migration
-- Extends existing media functionality with comprehensive processing capabilities

-- Enhanced file uploads table with processing metadata
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS media_type TEXT; -- image, video, audio, document
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending'; -- pending, processing, completed, failed
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS processing_options TEXT; -- JSON string of processing options
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS processed_files TEXT; -- JSON array of processed file URLs
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS metadata TEXT; -- JSON string of extracted metadata
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS parent_file_id INTEGER; -- For processed versions
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS batch_job_id TEXT; -- Link to batch processing job
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS error_message TEXT; -- Processing error details

-- Media processing jobs table
CREATE TABLE IF NOT EXISTS media_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL, -- single, batch, workflow
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
    priority INTEGER DEFAULT 0, -- Higher number = higher priority
    file_id INTEGER REFERENCES file_uploads(id),
    options TEXT, -- JSON string of processing options
    result TEXT, -- JSON string of processing results
    metadata TEXT, -- JSON string of extracted metadata
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3
);

-- Media library table for organized access
CREATE TABLE IF NOT EXISTS media_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER UNIQUE REFERENCES file_uploads(id),
    title TEXT,
    description TEXT,
    tags TEXT, -- JSON array of tags
    category TEXT, -- menu, quote, contract, training, etc.
    collection TEXT, -- For grouping related media
    is_public BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    last_accessed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Media processing workflows table
CREATE TABLE IF NOT EXISTS media_workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    trigger_type TEXT, -- upload, schedule, webhook, manual
    trigger_config TEXT, -- JSON string of trigger configuration
    steps TEXT, -- JSON array of processing steps
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Workflow execution logs
CREATE TABLE IF NOT EXISTS workflow_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER REFERENCES media_workflows(id),
    job_id TEXT REFERENCES media_jobs(job_id),
    status TEXT DEFAULT 'pending',
    input_data TEXT, -- JSON string
    output_data TEXT, -- JSON string
    error_message TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- Media analytics table
CREATE TABLE IF NOT EXISTS media_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER REFERENCES file_uploads(id),
    event_type TEXT, -- upload, process, view, download, delete
    user_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT, -- Additional event data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_uploads_media_type ON file_uploads(media_type);
CREATE INDEX IF NOT EXISTS idx_file_uploads_processing_status ON file_uploads(processing_status);
CREATE INDEX IF NOT EXISTS idx_file_uploads_parent_file_id ON file_uploads(parent_file_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_batch_job_id ON file_uploads(batch_job_id);
CREATE INDEX IF NOT EXISTS idx_media_jobs_status ON media_jobs(status);
CREATE INDEX IF NOT EXISTS idx_media_jobs_type ON media_jobs(type);
CREATE INDEX IF NOT EXISTS idx_media_jobs_created_at ON media_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_media_library_category ON media_library(category);
CREATE INDEX IF NOT EXISTS idx_media_library_collection ON media_library(collection);
CREATE INDEX IF NOT EXISTS idx_media_library_tags ON media_library(tags);
CREATE INDEX IF NOT EXISTS idx_media_workflows_trigger_type ON media_workflows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_media_analytics_file_id ON media_analytics(file_id);
CREATE INDEX IF NOT EXISTS idx_media_analytics_event_type ON media_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_media_analytics_created_at ON media_analytics(created_at);

-- Insert default workflows
INSERT OR IGNORE INTO media_workflows (name, description, trigger_type, steps) VALUES
('Menu OCR Processing', 'Extract text from menu images and PDFs', 'upload', '[
    {"step": "validate", "type": "file", "options": {"allowed_types": ["image/*", "application/pdf"]}},
    {"step": "extract_metadata", "type": "metadata"},
    {"step": "ocr_process", "type": "ai", "model": "@cf/llava-hf/llava-1.5-7b-hf"},
    {"step": "parse_menu_items", "type": "custom"},
    {"step": "store_results", "type": "storage"}
]'),
('Image Optimization', 'Resize and compress images for web', 'upload', '[
    {"step": "validate", "type": "file", "options": {"allowed_types": ["image/*"]}},
    {"step": "extract_metadata", "type": "metadata"},
    {"step": "resize", "type": "image", "options": {"max_width": 1920, "max_height": 1080}},
    {"step": "compress", "type": "image", "options": {"quality": 85, "format": "auto"}},
    {"step": "generate_thumbnails", "type": "image", "options": {"sizes": [150, 300, 600]}},
    {"step": "store_results", "type": "storage"}
]'),
('Video Thumbnail Generation', 'Extract thumbnails from video uploads', 'upload', '[
    {"step": "validate", "type": "file", "options": {"allowed_types": ["video/*"]}},
    {"step": "extract_metadata", "type": "metadata"},
    {"step": "generate_thumbnail", "type": "video", "options": {"time": "10%", "size": "640x480"}},
    {"step": "store_results", "type": "storage"}
]'),
('Audio Transcription', 'Transcribe audio files to text', 'upload', '[
    {"step": "validate", "type": "file", "options": {"allowed_types": ["audio/*"]}},
    {"step": "extract_metadata", "type": "metadata"},
    {"step": "transcribe", "type": "ai", "model": "whisper"},
    {"step": "store_results", "type": "storage"}
]');