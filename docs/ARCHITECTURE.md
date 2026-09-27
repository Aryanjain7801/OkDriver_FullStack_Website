# okDriver CCTV Monitoring & AI Video Analytics Platform
## System Architecture Specification

Aligned with **Gujarat Police Innovation Hackathon 2026** and **okDriver Full Stack Engineering Challenge**.

---

### 1. High-Level Architecture Diagram

```mermaid
flowchart TD
    subgraph EdgeLayer["Edge / Camera Infrastructure"]
        C1["Traffic Junction C001 (PTZ)"]
        C2["RTO Checkpoint C002 (ANPR)"]
        C3["City Center C003 (Fixed)"]
        C4["Highway Expy C004 (PTZ)"]
        CN["80,000+ City CCTVs (Heterogeneous)"]
        
        EdgeGW["Edge AI Gateways (YOLOv10 / ByteTrack / LPRNet)"]
    end

    subgraph VideoGateway["Video Gateway & Ingestion Layer"]
        MediaMTX["MediaMTX / WebRTC & HLS Transcoder"]
        RTSPAdapter["ONVIF & RTSP Protocol Adapter"]
    end

    subgraph IngestionBus["Real-Time Message Bus"]
        Kafka["Redis Pub/Sub / Apache Kafka"]
    end

    subgraph CoreBackend["Core Services & Analytics Engine"]
        API["FastAPI / Express REST & WebSocket Gateway"]
        WatchlistEngine["Watchlist Correlation Engine (Sub-10ms)"]
        GISRoute["GIS Spatial Tracker & Route Reconstructor"]
        AuditService["Audit & Telemetry Logger"]
    end

    subgraph StorageLayer["Data & Persistence Layer"]
        Postgres[("PostgreSQL RDS (Partitioned Tables & PostGIS)")]
        RedisCache[("Redis Memory Cache & Session Store")]
        S3Storage[("AWS S3 / MinIO (Snapshots & Cold Video)")]
    end

    subgraph ClientLayer["Operator Dashboard & GIS Console"]
        UI["okDriver Surveillance Dashboard"]
        Leaflet["Leaflet Interactive GIS Map (Ahmedabad)"]
        VideoWall["WebRTC / Canvas Low-Latency Video Wall"]
        AlertNotifier["Real-Time Alert Dispatcher & Audio Chime"]
    end

    C1 & C2 & C3 & C4 & CN --> RTSPAdapter
    C1 & C2 & C3 & C4 & CN --> EdgeGW
    RTSPAdapter --> MediaMTX
    EdgeGW -- "Telemetry & BBox JSON" --> Kafka
    MediaMTX -- "WebRTC WHEP Streams" --> VideoWall

    Kafka --> API
    API --> WatchlistEngine
    WatchlistEngine --> GISRoute
    WatchlistEngine --> Postgres
    WatchlistEngine --> AlertNotifier
    API --> Postgres
    API --> RedisCache
    
    API -- "WebSocket Events" --> UI
    GISRoute -- "Waypoints Polyline" --> Leaflet
    AlertNotifier --> UI
```

---

### 2. Architectural Components

#### A. Edge & Video Ingestion Layer
- **Heterogeneous Protocol Support**: Accepts **RTSP**, **ONVIF Profile S/G/T**, vendor SDK feeds (Hikvision, Dahua, CP Plus), and **WebRTC/HLS**.
- **Edge Analytics**: Runs lightweight Computer Vision models (ANPR, vehicle classification, loitering detection) on local hardware (e.g., Jetson Orin Nano). Rather than shipping 80,000 full-resolution 4K streams to the cloud, cameras send **lightweight JSON inference metadata (2 KB/event)**, saving **>95% WAN bandwidth**.

#### B. Watchlist Correlation Engine
- Pre-caches active watchlist records in memory using **Inverted Index & In-memory Hash Sets**.
- Upon receiving an ANPR event (`vehicle_number: "GJ01XX0001"`), the engine matches against the watchlist in **under 2 milliseconds**.
- Immediately pushes WebSocket alerts (`watchlist_alert`) to police control room operators.

#### C. GIS & Spatial Movement Reconstruction
- Correlates detection timestamps across adjacent camera locations.
- Connects historical timestamps (`10:02 @ C001 -> 10:18 @ C002 -> 10:41 @ C004`) to generate a directional polyline route with estimated speed and lane vectors on Leaflet map tiles.

#### D. Production Database Tier
- **PostgreSQL 15+** with **PostGIS** extension for spatial queries (`ST_DWithin`, `ST_MakeLine`).
- Table partitioning by month (`PARTITION BY RANGE (detected_at)`) prevents performance degradation across 500+ million detection records.
