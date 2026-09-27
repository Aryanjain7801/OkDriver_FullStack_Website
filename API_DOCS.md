# okDriver CCTV Analytics Platform - API Specification

## Base URLs
- **Node.js Command Gateway**: `http://localhost:3000`
- **Django Auth Backend**: `http://localhost:8000`
- **WebSocket Gateway**: `ws://localhost:3000/ws`

---

## 1. Authentication Endpoints (Django Backend)

### `POST /api/auth/login/`
Authenticates an officer and returns profile and session token.
- **Request Body**:
```json
{
  "username": "officer_patel",
  "password": "password123"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "user": {
    "id": 2,
    "username": "officer_patel",
    "full_name": "Ramesh Patel",
    "department": "Traffic Police",
    "badge_number": "GJ-TP-2041",
    "role": "Officer"
  }
}
```

### `POST /api/auth/register/`
Registers a new officer in the system.
- **Request Body**:
```json
{
  "first_name": "Vikram",
  "last_name": "Rathore",
  "username": "officer_vikram",
  "email": "vikram@police.gov.in",
  "department": "Crime Branch / CID",
  "badge_number": "GJ-CID-9901",
  "password": "password123",
  "role": "Officer"
}
```

---

## 2. Camera Registry Endpoints

### `GET /api/cameras`
Fetches all cameras with optional query filters.
- **Query Parameters**: `department`, `status`, `zone`, `search`
- **Response**: Array of camera objects.

### `POST /api/cameras`
Onboards a new CCTV camera source.
- **Request Body**:
```json
{
  "id": "C049",
  "name": "Sabarmati Riverfront North",
  "department": "Traffic Police",
  "type": "PTZ",
  "protocol": "RTSP",
  "streamUrl": "rtsp://edge.ahmedabad.police/live/c049",
  "latitude": 23.0380,
  "longitude": 72.5810,
  "zone": "Central Zone"
}
```

---

## 3. Watchlist Management Endpoints

### `GET /api/watchlist`
Retrieves all registered watchlist suspects and vehicles.

### `POST /api/watchlist`
Adds a new vehicle or person of interest to the watchlist.
- **Request Body**:
```json
{
  "identifier": "GJ01ZZ8888",
  "category": "Stolen Vehicle",
  "severity": "Critical",
  "addedBy": "Traffic Police",
  "description": "Black Scorpio reported stolen from Satellite area."
}
```

### `DELETE /api/watchlist/:id`
Removes an entry from the watchlist.

---

## 4. AI Video Analytics & Alerts

### `POST /api/analytics/events`
Receives AI inference results from edge cameras.
- **Request Body**:
```json
{
  "camera_id": "C002",
  "vehicle_number": "GJ01XX0001",
  "confidence": 0.98,
  "vehicle_type": "Sedan",
  "bounding_box": { "x": 120, "y": 140, "width": 240, "height": 160 },
  "event_type": "ANPR"
}
```

### `POST /api/alerts/:id/acknowledge`
Acknowledges an active alert.

### `POST /api/alerts/:id/resolve`
Resolves an alert with resolution notes.

---

## 5. Audit Trail & CSV Export

### `GET /api/audit-logs`
Returns the immutable system audit log entries.

### `GET /api/reports/export-csv`
Downloads the complete incident and audit report as an official CSV file.

---

## 6. WebSocket Real-Time Events (`ws://localhost:3000/ws`)

| Event Name | Direction | Description |
| :--- | :--- | :--- |
| `init_state` | Server → Client | Initial snapshot of system KPIs, recent alerts, and detections |
| `new_detection` | Server → Client | Real-time AI detection event with plate & bounding box |
| `watchlist_alert` | Server → Client | Instant high-priority alert on watchlist correlation |
| `camera_updated` | Server → Client | Camera status or heartbeat change |
| `alert_acknowledged` | Server → Client | Broadcasts alert acknowledgment across all operator screens |
| `alert_resolved` | Server → Client | Broadcasts alert resolution |
