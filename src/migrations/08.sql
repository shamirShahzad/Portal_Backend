-- Migration 08: Export Jobs Table
-- This migration creates the export_jobs table to track export requests and their status

CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    data_types JSONB NOT NULL DEFAULT '{}', -- {"applications": true, "training": false, ...}
    filters JSONB NOT NULL DEFAULT '{}', -- Date range, organizations, etc.
    format VARCHAR(50) NOT NULL CHECK (format IN ('excel', 'csv', 'pdf', 'json')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    file_path VARCHAR(500), -- Path to generated file
    file_size BIGINT, -- File size in bytes
    error_message TEXT, -- Error details if failed
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100), -- Progress percentage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'), -- Auto-cleanup date
    scheduling JSONB DEFAULT '{"type": "one-time"}' -- Scheduling configuration
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_export_jobs_user_status ON export_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created_at ON export_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_export_jobs_expires_at ON export_jobs(expires_at);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);

-- Comments for documentation
COMMENT ON TABLE export_jobs IS 'Tracks export job requests and their processing status';
COMMENT ON COLUMN export_jobs.data_types IS 'JSON object specifying which data types to export';
COMMENT ON COLUMN export_jobs.filters IS 'JSON object containing export filters (date range, organizations, etc.)';
COMMENT ON COLUMN export_jobs.scheduling IS 'JSON object containing scheduling configuration for recurring exports';
COMMENT ON COLUMN export_jobs.progress IS 'Progress percentage (0-100) for ongoing exports';
COMMENT ON COLUMN export_jobs.expires_at IS 'When the export file expires and can be cleaned up';