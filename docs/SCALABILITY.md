# Scalability & Production Engineering Blueprint
## Scaling to 80,000 Cameras for Gujarat Police Innovation Hackathon 2026

---

### 1. Compute Hierarchy: Edge vs. Regional vs. Central

| Tier | Deployment | Responsibilities | Hardware/Scale |
| :--- | :--- | :--- | :--- |
| **Edge Node** | Traffic poles, toll booths, police vans | Camera RTSP ingestion, motion detection, ANPR OCR (LPRNet), frame sampling (5-10 FPS). | NVIDIA Jetson Orin Nano / RK3588 (1 device per 4-8 cameras). |
| **Regional POP** | 33 District Police HQs (Ahmedabad, Surat, etc.) | Video recording ring-buffer (7 days), regional MediaMTX WebRTC stream relay, Kafka cluster broker. | 4x Dell PowerEdge R750 + 2x NVIDIA L4 GPUs per district. |
| **Central Cloud / State DC** | Gandhinagar State Command Center (GSWAN) | Master Camera Registry, centralized watchlist indexing, spatial GIS route tracing, cross-district alert dispatch. | Kubernetes (EKS/OKD) cluster with 20 worker nodes + RDS PostgreSQL Multi-AZ. |

---

### 2. Video Bandwidth Optimization Strategy

Streaming 80,000 continuous 1080p feeds at 4 Mbps would consume **320 Gbps of bandwidth**, causing network collapse on public fiber. We solve this with a 3-tiered bandwidth conservation strategy:

1. **Metadata-First Architecture**: Cameras do NOT stream continuous video over WAN. They run local inference and transmit **only JSON metadata (2-3 KB)** when a vehicle or entity is detected.
2. **On-Demand WebRTC Streaming**: High-resolution video is streamed to the dashboard **only when an operator clicks a camera or when a high-priority watchlist alert fires**.
3. **Adaptive Bitrate (ABR) & H.265 / AV1**: Uses H.265 codec reducing bandwidth by 50% compared to H.264. Degraded mode drops to 450 kbps 720p dynamically when packet loss exceeds 5%.

---

### 3. GPU / AI Accelerator Sizing

- **Total Cameras**: 80,000
- **Total Concurrent Frame Inference**: 80,000 cameras × 5 FPS = 400,000 frames/sec across the state.
- **Edge Inference**: Distributed across 10,000 quad-camera edge devices running quantized INT8 YOLOv10n + LPRNet.
- **Central Re-Identification & Deep Analytics**: 40x NVIDIA L40S GPUs (handling secondary confirmation, facial recognition, and route re-ID).

---

### 4. Storage Tiering (Hot, Warm, Cold)

1. **Hot Storage (0 to 7 Days)**:
   - High-speed NVMe storage at regional district data centers.
   - Circular buffer for 24/7 continuous video recording.
2. **Warm Storage (8 to 30 Days)**:
   - S3 Standard / Ceph Object Store storing all **flagged incident clips and ANPR snapshots** (storing unflagged footage is unnecessary).
3. **Cold Storage (31 Days to 3 Years)**:
   - AWS S3 Glacier Flexible Retrieval / Tape backup for legal evidence and court proceedings.

---

### 5. High Availability, Disaster Recovery & Network Segmentation

- **Network Air-Gapping & GSWAN**: Video feeds reside on a dedicated VLAN separated from public internet.
- **TLS 1.3 & mTLS**: Mutual TLS for all edge-to-cloud telemetry ingestion.
- **Failover**: Multi-AZ PostgreSQL with read-replicas, Redis Sentinel with automatic failover (<3 seconds), and stateless container pods auto-scaled via Kubernetes HPA.
