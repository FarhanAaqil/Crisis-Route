-- CrisisRoute Database Core Schema (PostgreSQL 16 + PostGIS)
-- Migration: 001_core.sql
-- Description: Core spatial tables, versioned graph snapshots, observations, plans, and audit trails

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ---------------------------------------------------------------------
-- 1. Snapshot Registry (Content-addressed immutable inputs)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snapshots (
    snapshot_id VARCHAR(64) PRIMARY KEY, -- SHA-256 hex digest
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    region_name VARCHAR(100) NOT NULL,
    bbox GEOMETRY(Polygon, 4326) NOT NULL,
    edge_count INTEGER NOT NULL,
    node_count INTEGER NOT NULL,
    source_attribution TEXT NOT NULL,
    raw_manifest JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_bbox ON snapshots USING GIST (bbox);

-- ---------------------------------------------------------------------
-- 2. Road Network Edges
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS road_edges (
    edge_id VARCHAR(100) NOT NULL,
    snapshot_id VARCHAR(64) NOT NULL REFERENCES snapshots(snapshot_id) ON DELETE RESTRICT,
    u_node VARCHAR(50) NOT NULL,
    v_node VARCHAR(50) NOT NULL,
    road_class VARCHAR(50) NOT NULL,
    surface VARCHAR(50) DEFAULT 'unpaved',
    distance_meters NUMERIC(10, 2) NOT NULL,
    free_flow_time_sec NUMERIC(10, 2) NOT NULL,
    bridge_flag BOOLEAN DEFAULT FALSE,
    slope_pct NUMERIC(5, 2) DEFAULT 0.0,
    geom GEOMETRY(LineString, 4326) NOT NULL,
    PRIMARY KEY (edge_id, snapshot_id)
);

CREATE INDEX IF NOT EXISTS idx_road_edges_geom ON road_edges USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_road_edges_nodes ON road_edges(u_node, v_node);

-- ---------------------------------------------------------------------
-- 3. Scenarios
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scenarios (
    scenario_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    snapshot_id VARCHAR(64) NOT NULL REFERENCES snapshots(snapshot_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    time_horizon_hours NUMERIC(5, 2) NOT NULL DEFAULT 24.0,
    equity_alpha NUMERIC(4, 3) NOT NULL DEFAULT 0.30,
    beta_tail_risk NUMERIC(4, 3) NOT NULL DEFAULT 0.20,
    active_plan_id UUID,
    raw_config JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scenarios_snapshot ON scenarios(snapshot_id);

-- ---------------------------------------------------------------------
-- 4. Road Observations
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS road_observations (
    observation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_id UUID NOT NULL REFERENCES scenarios(scenario_id) ON DELETE CASCADE,
    edge_id VARCHAR(100) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source_type VARCHAR(50) NOT NULL,
    source_credibility NUMERIC(3, 2) NOT NULL CHECK (source_credibility >= 0 AND source_credibility <= 1),
    status VARCHAR(50) NOT NULL,
    conf_interval_lower NUMERIC(3, 2),
    conf_interval_upper NUMERIC(3, 2),
    water_depth_cm NUMERIC(6, 2) DEFAULT 0.0,
    reported_by VARCHAR(100) NOT NULL,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_road_observations_scenario ON road_observations(scenario_id);
CREATE INDEX IF NOT EXISTS idx_road_observations_edge ON road_observations(edge_id);

-- ---------------------------------------------------------------------
-- 5. Generated Relief Plans & Audit Trail
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
    plan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_id UUID NOT NULL REFERENCES scenarios(scenario_id) ON DELETE CASCADE,
    snapshot_id VARCHAR(64) NOT NULL REFERENCES snapshots(snapshot_id) ON DELETE RESTRICT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    solver_status VARCHAR(50) NOT NULL,
    solve_time_seconds NUMERIC(8, 3) NOT NULL,
    min_group_served_fraction NUMERIC(4, 3) NOT NULL,
    routes_json JSONB NOT NULL,
    allocations_json JSONB NOT NULL,
    unmet_demand_json JSONB NOT NULL,
    voi_recommendations_json JSONB NOT NULL,
    approval_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMPTZ,
    approval_rationale TEXT
);

CREATE INDEX IF NOT EXISTS idx_plans_scenario ON plans(scenario_id);

-- ---------------------------------------------------------------------
-- 6. Audit Events (Immutable System Log)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100) NOT NULL,
    details JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_user ON audit_events(user_id);
