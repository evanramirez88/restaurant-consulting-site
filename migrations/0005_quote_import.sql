-- Quote Builder PDF Import System
-- Migration: 0005_quote_import.sql
-- Created: 2026-01-05
--
-- This migration adds support for:
-- - Toast PDF quote import jobs
-- - OCR processing tracking
-- - Extracted hardware item storage

-- ============================================
-- QUOTE IMPORT JOBS TABLE
-- Tracks PDF uploads and processing status
-- ============================================
CREATE TABLE IF NOT EXISTS quote_import_jobs (
  id TEXT PRIMARY KEY,
  
  -- File information
  file_key TEXT NOT NULL,           -- R2 storage key
  file_name TEXT,                   -- Original filename
  file_type TEXT,                   -- MIME type (application/pdf)
  file_size INTEGER,                -- File size in bytes
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN (
    'uploaded',                     -- File uploaded, waiting for processing
    'processing',                   -- OCR/extraction in progress
    'completed',                    -- Successfully extracted items
    'failed'                        -- Processing failed
  )),
  
  -- OCR Results
  ocr_result_json TEXT,             -- Raw OCR text output
  extracted_items_json TEXT,        -- Parsed hardware items array
  
  -- Error tracking
  error_message TEXT,               -- Error details if failed
  
  -- Timing
  processing_started_at INTEGER,    -- When OCR started
  processing_completed_at INTEGER,  -- When OCR completed
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Index for status queries (find pending jobs)
CREATE INDEX IF NOT EXISTS idx_quote_import_status ON quote_import_jobs(status);

-- Index for recent jobs lookup
CREATE INDEX IF NOT EXISTS idx_quote_import_created ON quote_import_jobs(created_at DESC);

-- ============================================
-- QUOTE IMPORT ITEMS TABLE (Optional - for detailed tracking)
-- Individual extracted hardware items
-- ============================================
CREATE TABLE IF NOT EXISTS quote_import_items (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES quote_import_jobs(id) ON DELETE CASCADE,
  
  -- Extracted data
  product_name TEXT NOT NULL,       -- Original product name from PDF
  quantity INTEGER DEFAULT 1,       -- Quantity extracted
  
  -- Mapping to catalog
  mapped_hardware_ids TEXT,         -- JSON array of catalog hardware IDs
  confidence REAL DEFAULT 0.5,      -- OCR confidence score (0-1)
  
  -- User adjustments
  user_verified INTEGER DEFAULT 0,  -- Boolean: user confirmed mapping
  user_notes TEXT,                  -- Notes added by user
  
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_quote_items_job ON quote_import_items(job_id);

-- ============================================
-- AI CONFIG FOR QUOTE OCR
-- Stores configurable AI model settings
-- ============================================
-- Insert default quote OCR config if not exists
INSERT OR IGNORE INTO api_configs (
  id,
  service,
  config_json,
  is_active,
  created_at,
  updated_at
) VALUES (
  'quote_ocr_default',
  'quote_ocr',
  json('{"model":"@cf/meta/llama-3.2-11b-vision-instruct","max_tokens":2048,"prompt":"Extract hardware items from this Toast POS quote PDF. Focus on the HARDWARE section table. For each item, extract: Product Name, Quantity (QTY column). Return as JSON array: [{\"name\": \"...\", \"qty\": 1}, ...]"}'),
  1,
  unixepoch(),
  unixepoch()
);
