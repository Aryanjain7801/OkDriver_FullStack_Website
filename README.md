# okDriver Integrated CCTV Monitoring & AI Video Analytics Platform
> **Gujarat Police Innovation Hackathon 2026 Reference Solution**
> An enterprise-grade, edge-compatible surveillance intelligence layer unifying heterogeneous camera sources, AI event ingestion, real-time WebSocket synchronization, GIS spatial movement reconstruction, and tamper-resistant audit trails.

---

## 📑 System Architecture & Scale Overview

```mermaid
flowchart TD
    subgraph "Heterogeneous Camera Ingestion Layer (Target: 80,000+ Cams)"
        C1["Traffic Junction (C001)\nRTSP / H.264"]
        C2["RTO Checkpoint (C002)\nONVIF / High-Speed ANPR"]
        C3["City Center (C003)\nPTZ / WebRTC Relay"]
        C4["Highway Expressway (C004)\nEdge AI Gateway"]
    end

    subgraph "Edge Inference & Event Pipeline"
        E1["YOLOv8 & ByteTrack\n(Vehicle/Person/Object)"]
        E2["High-Speed ANPR\n(License Plate OCR)"]
        E3["Event Deduplicator\n& Temporal Buffer"]
    end

    subgraph "okDriver Core Backend Layer (Node.js & Django)"
        GW["Real-Time Gateway\n(Express & WebSocket Server :3000)"]
        AUTH["Django Auth & UserProfile DB\n(SQLite / PostgreSQL :8000)"]
        WL_ENG["Watchlist Match Engine\n(Hash Index & In-Memory Trie)"]
        AUDIT["Audit & Chain-of-Custody Logger\n(Tamper-Resistant Trail)"]
    end

    subgraph "Frontend Command & Control Dashboard"
        DASH["Live Surveillance Matrix\n(30 FPS Canvas Streams)"]
        MAP["Google Maps & Esri GIS\n(Vehicle Route Reconstruction)"]
        ALERTS["Incident Dispatch & Resolution\n(<150ms WebSocket Push)"]
    end

    C1 & C2 & C3 & C4 --> E1 & E2
    E1 & E2 --> E3
    E3 -->|HTTP/gRPC Ingest| GW
    GW <--> AUTH
    GW --> WL_ENG
    WL_ENG -->|Alert Match| AUDIT
    GW -->|WebSocket Pub/Sub| DASH & MAP & ALERTS
```

---

## 🚀 Key Implemented Deliverables

1. **Camera Registry & Onboarding**:
   - Manual onboarding modal (`+ Onboard Camera Source`) with lat/lon, protocol (RTSP/ONVIF/WebRTC/HLS), and zone.
   - Real-time search and multi-criteria filters (Department, Status, Keyword).
   - PTZ Camera Stream modal with Pan, Tilt, Zoom, and high-resolution Snapshot export.

2. **AI Video Analytics & Watchlist Alerting**:
   - Edge telemetry ingestion (`POST /api/analytics/events`) with bounding boxes, confidence, vehicle plates, and timestamps.
   - Live correlation against active watchlist (`Stolen Vehicles`, `Wanted Persons`, `Blacklisted`).
   - Automated instant alerts broadcast over WebSockets without page reload.
   - Alert management workflow (Acknowledge and Resolve with officer notes).

3. **GIS Spatial Intelligence & Movement Reconstruction**:
   - Interactive Leaflet GIS map with official Google Maps and Esri layers (no watermarks).
   - Multi-junction chronological vehicle route plotting (`GJ01XX0001` route from C001 → C002 → C004).
   - AI tactical intercept prediction with ETA and predicted interception points.

4. **Multi-Tenant User Management & Security**:
   - Role-based officer authentication (`Traffic Police`, `City Police`, `RTO`, `CID`).
   - User database managed through Django backend with SQLite/PostgreSQL support.
   - Dedicated authentication portal (`login.html`) and live sign-out flow.

5. **Chain-of-Custody Audit & CSV Export**:
   - System and operator audit logs (`GET /api/audit-logs`).
   - One-click official CSV download (`GET /api/reports/export-csv`).

---

## ⚙️ Quick Start Instructions

### Prerequisites
- Node.js (v18+)
- Python (3.10+)

### 1. Start Django Authentication Backend
```bash
cd okdriver_django
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```
*Django Admin Portal: [http://localhost:8000/admin/](http://localhost:8000/admin/) (admin/admin)*

### 2. Start okDriver Command Server
```bash
cd okdriver-cctv-platform
npm install
node server.js
```
*Frontend Command Dashboard: [http://localhost:3000](http://localhost:3000)*
*Login / Register Portal: [http://localhost:3000/login.html](http://localhost:3000/login.html)*

---

## 🗄️ Database Schema & Entity Relationship

```mermaid
erDiagram
    OFFICER_PROFILE ||--o{ AUDIT_LOG : generates
    CAMERA ||--o{ DETECTION_EVENT : captures
    DETECTION_EVENT ||--o{ ALERT : triggers
    WATCHLIST_RECORD ||--o{ ALERT : matches

    OFFICER_PROFILE {
        int id PK
        string username
        string email
        string department
        string badge_number
        string role
        datetime last_login
    }

    CAMERA {
        string id PK
        string name
        string department
        string zone
        string protocol
        string stream_url
        float latitude
        float longitude
        string status
        datetime last_heartbeat
    }

    WATCHLIST_RECORD {
        string id PK
        string identifier
        string category
        string severity
        string description
        string added_by
        date registered_date
        boolean active
    }

    ALERT {
        string id PK
        string camera_id FK
        string severity
        string title
        string matched_entity
        string confidence
        datetime timestamp
        string status
        string acknowledged_by
        string resolved_by
    }

    AUDIT_LOG {
        string id PK
        datetime timestamp
        string officer
        string action
        string category
        string details
    }
```

---

## 📈 Scalability Toward 80,000 Cameras

For full enterprise scaling details across Edge Processing, Kafka Message Queuing, Redis Caching, Video HLS/WebRTC Relay, Bandwidth Optimization, and Cloud Sizing, see [ARCHITECTURE.md](file:///C:/Users/MCS/.gemini/antigravity/scratch/okdriver-cctv-platform/ARCHITECTURE.md).
