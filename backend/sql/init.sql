-- CrisisRoute PostGIS & Database Initialization Script
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create Audit Log Table
CREATE TABLE IF NOT EXISTS audit_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id VARCHAR(128) NOT NULL,
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(128) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Index for temporal audit queries
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events (action);

