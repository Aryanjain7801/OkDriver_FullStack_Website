"""
okDriver CCTV Monitoring & AI Video Analytics Platform
FastAPI Production Backend (Python 3.10+)
Implements RESTful API, WebSocket Broadcaster, and Watchlist Correlation Engine
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import asyncio
import json

app = FastAPI(
    title="okDriver CCTV & Video Analytics Platform API",
    version="1.0.0",
    description="Backend service for Gujarat Police Hackathon 2026 CCTV Monitoring & ANPR Correlation"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# Data Models
# -------------------------------------------------------------

class CameraModel(BaseModel):
    id: str
    name: str
    department: str
    location: str
    type: str = "Fixed"
    protocol: str = "RTSP"
    stream_url: str
    status: str = "Online"
    latitude: float
    longitude: float
    last_heartbeat: str
    zone: str
    fps: int = 30
    bitrate: str = "3.5 Mbps"
    resolution: str = "1080p 30fps"
    storage_retention_days: int = 30

class AIEventPayload(BaseModel):
    camera_id: str
    timestamp: Optional[str] = None
    vehicle_number: Optional[str] = None
    confidence: float = 0.95
    vehicle_type: str = "Car"
    bounding_box: Optional[Dict[str, int]] = None
    event_type: str = "ANPR"

class WatchlistModel(BaseModel):
    id: str
    identifier: str
    type: str = "vehicle"
    category: str
    severity: str = "High"
    description: str
    registered_date: str
    added_by: str
    active: bool = True

class AlertModel(BaseModel):
    id: str
    severity: str
    title: str
    description: str
    camera_id: str
    camera_name: str
    matched_entity: str
    confidence: str
    timestamp: str
    status: str = "active"

# -------------------------------------------------------------
# WebSocket Connection Manager
# -------------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, event: str, payload: Any):
        msg = json.dumps({"event": event, "payload": payload, "timestamp": datetime.utcnow().isoformat()})
        for connection in self.active_connections:
            try:
                await connection.send_text(msg)
            except Exception:
                pass

manager = ConnectionManager()

# -------------------------------------------------------------
# Seed Database
# -------------------------------------------------------------

cameras_db: Dict[str, CameraModel] = {
    "C001": CameraModel(
        id="C001", name="Traffic Junction (Ahmedabad)", department="Traffic Police",
        location="Ahmedabad - SG Highway Junction", type="PTZ", protocol="RTSP",
        stream_url="rtsp://cctv.ahmedabad.police/streams/c001", status="Online",
        latitude=23.0338, longitude=72.5850, last_heartbeat=datetime.utcnow().isoformat(), zone="Central Zone"
    ),
    "C002": CameraModel(
        id="C002", name="RTO Checkpoint", department="RTO",
        location="Ahmedabad - Subhash Bridge RTO", type="Fixed", protocol="ONVIF",
        stream_url="rtsp://rto.ahmedabad.gov.in/c002/feed", status="Online",
        latitude=23.0550, longitude=72.5780, last_heartbeat=datetime.utcnow().isoformat(), zone="North Zone"
    ),
    "C003": CameraModel(
        id="C003", name="City Center", department="City Police",
        location="Ahmedabad - CG Road Commercial", type="Fixed", protocol="WebRTC",
        stream_url="webrtc://okdriver.ai/live/c003", status="Degraded",
        latitude=23.0280, longitude=72.5560, last_heartbeat=datetime.utcnow().isoformat(), zone="West Zone"
    ),
    "C004": CameraModel(
        id="C004", name="Highway", department="Highway Police",
        location="Ahmedabad - Ring Road Expy KM 14", type="PTZ", protocol="RTSP",
        stream_url="rtsp://expressway.nhai.gov.in/c004/h265", status="Offline",
        latitude=23.0720, longitude=72.5420, last_heartbeat=datetime.utcnow().isoformat(), zone="North-West Zone"
    ),
    "C005": CameraModel(
        id="C005", name="Railway Station", department="Railways",
        location="Ahmedabad - Kalupur Terminus Entry", type="Fixed", protocol="HLS",
        stream_url="https://railways.gov.in/hls/c005/index.m3u8", status="Online",
        latitude=23.0210, longitude=72.6010, last_heartbeat=datetime.utcnow().isoformat(), zone="East Zone"
    )
}

watchlist_db: List[WatchlistModel] = [
    WatchlistModel(
        id="WL-001", identifier="GJ01XX0001", category="Blacklisted Vehicle",
        severity="High", description="Vehicle involved in hit-and-run case FIR #1102/2026",
        registered_date="2026-04-12", added_by="Crime Branch Ahmedabad"
    ),
    WatchlistModel(
        id="WL-002", identifier="RJ14AB5678", category="Stolen Vehicle",
        severity="High", description="Interstate stolen vehicle alert",
        registered_date="2026-04-18", added_by="RTO Enforcement Unit"
    ),
    WatchlistModel(
        id="WL-003", identifier="John Doe", category="Wanted Person",
        severity="High", description="Wanted in commercial financial fraud syndicate",
        registered_date="2026-03-29", added_by="CID Special Investigation"
    )
]

alerts_db: List[AlertModel] = [
    AlertModel(
        id="ALT-001", severity="High", title="Vehicle on Watchlist",
        description="GJ01XX0001 detected at C002", camera_id="C002",
        camera_name="RTO Checkpoint", matched_entity="GJ01XX0001 (Blacklisted Vehicle)",
        confidence="99%", timestamp="14:21", status="active"
    )
]

# -------------------------------------------------------------
# REST Routes
# -------------------------------------------------------------

@app.get("/api/health")
def health_check():
    return {"status": "HEALTHY", "service": "okDriver CCTV Core", "timestamp": datetime.utcnow().isoformat()}

@app.get("/api/cameras", response_model=List[CameraModel])
def list_cameras(department: Optional[str] = None, status: Optional[str] = None):
    cams = list(cameras_db.values())
    if department:
        cams = [c for c in cams if c.department.lower() == department.lower()]
    if status:
        cams = [c for c in cams if c.status.lower() == status.lower()]
    return cams

@app.post("/api/cameras", response_model=CameraModel, status_code=status.HTTP_201_CREATED)
async def onboard_camera(camera: CameraModel):
    if camera.id in cameras_db:
        raise HTTPException(status_code=409, detail="Camera ID already registered")
    cameras_db[camera.id] = camera
    await manager.broadcast("camera_added", camera.dict())
    return camera

@app.post("/api/analytics/events")
async def ingest_ai_detection(event: AIEventPayload):
    # Match against active watchlist
    matched = None
    if event.vehicle_number:
        clean_plate = event.vehicle_number.upper().replace(" ", "")
        for w in watchlist_db:
            if w.active and w.identifier.upper().replace(" ", "") == clean_plate:
                matched = w
                break

    alert_obj = None
    if matched:
        cam = cameras_db.get(event.camera_id)
        alert_obj = AlertModel(
            id=f"ALT-{int(datetime.utcnow().timestamp())}",
            severity=matched.severity,
            title=matched.category,
            description=f"{clean_plate} detected at {event.camera_id}",
            camera_id=event.camera_id,
            camera_name=cam.name if cam else f"Camera {event.camera_id}",
            matched_entity=f"{clean_plate} ({matched.category})",
            confidence=f"{int(event.confidence * 100)}%",
            timestamp=datetime.utcnow().strftime("%H:%M"),
            status="active"
        )
        alerts_db.insert(0, alert_obj)
        await manager.broadcast("watchlist_alert", alert_obj.dict())

    await manager.broadcast("new_detection", event.dict())
    return {"status": "SUCCESS", "matched": matched is not None, "alert": alert_obj}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Respond to ping heartbeats
            if "ping" in data:
                await websocket.send_text(json.dumps({"event": "pong"}))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
