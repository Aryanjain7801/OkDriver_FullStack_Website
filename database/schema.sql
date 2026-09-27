-- ====================================================================
-- okDriver CCTV Monitoring & AI Video Analytics Platform
-- Production PostgreSQL / MySQL Schema (RDS Compatible)
-- Designed for Large-Scale Deployment (Scalable to 80,000+ Cameras)
-- ====================================================================

-- 1. Camera Registry Table
CREATE TABLE IF NOT EXISTS cameras (
    camera_id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL, -- Traffic Police, RTO, City Police, Highway, Railways
    location VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    camera_type VARCHAR(50) NOT NULL DEFAULT 'Fixed', -- Fixed, PTZ, Dome, ANPR
    protocol VARCHAR(32) NOT NULL DEFAULT 'RTSP',     -- RTSP, ONVIF, WebRTC, HLS
    stream_url VARCHAR(512) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'Online',     -- Online, Offline, Degraded
    zone VARCHAR(100) NOT NULL,                       -- Central, North, South, East, West
    fps INT DEFAULT 30,
    bitrate VARCHAR(32) DEFAULT '3.5 Mbps',
    resolution VARCHAR(32) DEFAULT '1080p',
    storage_retention_days INT DEFAULT 30,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cameras_status ON cameras(status);
CREATE INDEX idx_cameras_department ON cameras(department);
CREATE INDEX idx_cameras_zone ON cameras(zone);
CREATE INDEX idx_cameras_geo ON cameras(latitude, longitude);

-- 2. Camera Health & Telemetry Logs (Time-series)
CREATE TABLE IF NOT EXISTS camera_health_logs (
    log_id BIGSERIAL PRIMARY KEY,
    camera_id VARCHAR(32) REFERENCES cameras(camera_id) ON DELETE CASCADE,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(32) NOT NULL,
    latency_ms INT,
    fps_observed INT,
    bitrate_kbps INT,
    packet_loss_pct DECIMAL(5,2)
);

CREATE INDEX idx_health_cam_time ON camera_health_logs(camera_id, recorded_at DESC);

-- 3. Watchlist Table
CREATE TABLE IF NOT EXISTS watchlists (
    watchlist_id VARCHAR(64) PRIMARY KEY,
    identifier VARCHAR(64) NOT NULL, -- License Plate or Person Name / ID
    entity_type VARCHAR(32) NOT NULL DEFAULT 'vehicle', -- vehicle, person, object
    category VARCHAR(64) NOT NULL,    -- Blacklisted Vehicle, Stolen Vehicle, Wanted Person
    severity VARCHAR(32) NOT NULL DEFAULT 'High', -- High, Medium, Low
    description TEXT,
    registered_date DATE NOT NULL,
    added_by VARCHAR(100) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_watchlist_identifier ON watchlists(identifier);
CREATE INDEX idx_watchlist_active ON watchlists(active);

-- 4. AI Detections Table (Partitioned by Month for 80,000 Camera Scale)
CREATE TABLE IF NOT EXISTS ai_detections (
    detection_id BIGSERIAL,
    camera_id VARCHAR(32) NOT NULL REFERENCES cameras(camera_id),
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    event_type VARCHAR(64) NOT NULL, -- ANPR, vehicle_detection, person_detection, object_detection
    identifier VARCHAR(64),          -- Detected vehicle plate or facial ID
    vehicle_type VARCHAR(64),        -- Car, SUV, Motorbike, Truck, Bus
    confidence DECIMAL(5, 4) NOT NULL,
    bbox_x INT,
    bbox_y INT,
    bbox_w INT,
    bbox_h INT,
    speed_kmh INT,
    snapshot_s3_key VARCHAR(512),
    is_watchlist_match BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (detection_id, detected_at)
) PARTITION BY RANGE (detected_at);

-- Partition Table for Current Month (Example)
CREATE TABLE IF NOT EXISTS ai_detections_2026_04 PARTITION OF ai_detections
    FOR VALUES FROM ('2026-04-01 00:00:00+00') TO ('2026-05-01 00:00:00+00');

CREATE INDEX idx_detections_plate ON ai_detections(identifier);
CREATE INDEX idx_detections_cam_time ON ai_detections(camera_id, detected_at DESC);
CREATE INDEX idx_detections_match ON ai_detections(is_watchlist_match) WHERE is_watchlist_match = TRUE;

-- 5. Incidents and Alerts
CREATE TABLE IF NOT EXISTS alerts (
    alert_id VARCHAR(64) PRIMARY KEY,
    detection_id BIGINT,
    camera_id VARCHAR(32) NOT NULL REFERENCES cameras(camera_id),
    severity VARCHAR(32) NOT NULL, -- High, Medium, Low
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    matched_entity VARCHAR(255),
    confidence VARCHAR(32),
    status VARCHAR(32) NOT NULL DEFAULT 'active', -- active, acknowledged, resolved
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_cam_id ON alerts(camera_id);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);

-- 6. Operator Action Audit Trail
CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id BIGSERIAL PRIMARY KEY,
    operator_id VARCHAR(64) NOT NULL,
    action VARCHAR(100) NOT NULL, -- CAMERA_ONBOARD, ALERT_ACK, ALERT_RESOLVE, WATCHLIST_ADD
    entity_id VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45),
    details JSONB,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_operator ON audit_logs(operator_id);
CREATE INDEX idx_audit_time ON audit_logs(performed_at DESC);
