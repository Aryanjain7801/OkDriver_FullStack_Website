const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// In-Memory Database / State (Persistent during runtime)
// ==========================================

let cameras = [
  {
    id: "C001",
    name: "Traffic Junction (Ahmedabad)",
    department: "Traffic Police",
    location: "Ahmedabad - SG Highway Junction",
    type: "PTZ",
    protocol: "RTSP",
    streamUrl: "rtsp://cctv.ahmedabad.police/streams/c001",
    status: "Online",
    latitude: 23.0338,
    longitude: 72.5850,
    lastHeartbeat: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    zone: "Central Zone",
    fps: 30,
    bitrate: "4.2 Mbps",
    resolution: "1080p 60fps",
    storageRetentionDays: 30
  },
  {
    id: "C002",
    name: "RTO Checkpoint",
    department: "RTO",
    location: "Ahmedabad - Subhash Bridge RTO",
    type: "Fixed",
    protocol: "ONVIF",
    streamUrl: "rtsp://rto.ahmedabad.gov.in/c002/feed",
    status: "Online",
    latitude: 23.0550,
    longitude: 72.5780,
    lastHeartbeat: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    zone: "North Zone",
    fps: 30,
    bitrate: "3.8 Mbps",
    resolution: "1080p 30fps",
    storageRetentionDays: 45
  },
  {
    id: "C003",
    name: "City Center",
    department: "City Police",
    location: "Ahmedabad - CG Road Commercial",
    type: "Fixed",
    protocol: "WebRTC",
    streamUrl: "webrtc://okdriver.ai/live/c003",
    status: "Degraded",
    latitude: 23.0280,
    longitude: 72.5560,
    lastHeartbeat: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    zone: "West Zone",
    fps: 15,
    bitrate: "450 kbps",
    resolution: "720p 15fps",
    storageRetentionDays: 30
  },
  {
    id: "C004",
    name: "Highway",
    department: "Highway Police",
    location: "Ahmedabad - Ring Road Expy KM 14",
    type: "PTZ",
    protocol: "RTSP",
    streamUrl: "rtsp://expressway.nhai.gov.in/c004/h265",
    status: "Offline",
    latitude: 23.0720,
    longitude: 72.5420,
    lastHeartbeat: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    zone: "North-West Zone",
    fps: 0,
    bitrate: "0 kbps",
    resolution: "1080p (Disconnected)",
    storageRetentionDays: 60
  },
  {
    id: "C005",
    name: "Railway Station",
    department: "Railways",
    location: "Ahmedabad - Kalupur Terminus Entry",
    type: "Fixed",
    protocol: "HLS",
    streamUrl: "https://railways.gov.in/hls/c005/index.m3u8",
    status: "Online",
    latitude: 23.0210,
    longitude: 72.6010,
    lastHeartbeat: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    zone: "East Zone",
    fps: 25,
    bitrate: "3.1 Mbps",
    resolution: "1080p 25fps",
    storageRetentionDays: 90
  }
];

// Add synthetic cameras to match "Total Cameras: 48"
for (let i = 6; i <= 48; i++) {
  const zoneNames = ["North Zone", "South Zone", "East Zone", "West Zone", "Central Zone"];
  const depts = ["Traffic Police", "City Police", "RTO", "Highway Police", "Railways"];
  const types = ["PTZ", "Fixed", "Dome", "ANPR"];
  const idStr = `C0${i < 10 ? '0' + i : i}`;
  const status = (i === 14) ? "Offline" : (i === 22 ? "Degraded" : "Online");
  
  cameras.push({
    id: idStr,
    name: `Surveillance Post ${idStr}`,
    department: depts[i % depts.length],
    location: `Ahmedabad Sector ${Math.floor(i / 2) + 1}`,
    type: types[i % types.length],
    protocol: i % 2 === 0 ? "RTSP" : "ONVIF",
    streamUrl: `rtsp://police.gujarat.gov.in/sec/${idStr.toLowerCase()}`,
    status: status,
    latitude: 23.0225 + (Math.sin(i) * 0.05),
    longitude: 72.5714 + (Math.cos(i) * 0.05),
    lastHeartbeat: new Date(Date.now() - (i % 5) * 60 * 1000).toISOString(),
    zone: zoneNames[i % zoneNames.length],
    fps: 30,
    bitrate: "3.5 Mbps",
    resolution: "1080p 30fps",
    storageRetentionDays: 30
  });
}

let watchlist = [
  {
    id: "WL-001",
    identifier: "GJ01XX0001",
    type: "vehicle",
    category: "Blacklisted Vehicle",
    severity: "High",
    description: "Red Hyundai Verna involved in hit-and-run case FIR #1102/2026. Armed driver suspected.",
    registeredDate: "2026-04-12",
    addedBy: "Crime Branch Ahmedabad",
    active: true
  },
  {
    id: "WL-002",
    identifier: "RJ14AB5678",
    type: "vehicle",
    category: "Stolen Vehicle",
    severity: "High",
    description: "White Mahindra Scorpio stolen from Jaipur interstate transit corridor.",
    registeredDate: "2026-04-18",
    addedBy: "RTO Enforcement Unit",
    active: true
  },
  {
    id: "WL-003",
    identifier: "John Doe",
    type: "person",
    category: "Wanted Person",
    severity: "High",
    description: "Subject wanted for financial fraud and organized syndicate operations. Height 5'10\".",
    registeredDate: "2026-03-29",
    addedBy: "CID Special Investigation",
    active: true
  },
  {
    id: "WL-004",
    identifier: "GJ05AB1234",
    type: "vehicle",
    category: "Blacklisted Vehicle",
    severity: "High",
    description: "Silver Maruti Swift with forged number plate, evasion of border toll checkpoint.",
    registeredDate: "2026-04-20",
    addedBy: "Surat Highway Police",
    active: true
  },
  {
    id: "WL-005",
    identifier: "MH02CD9999",
    type: "vehicle",
    category: "Stolen Vehicle",
    severity: "Medium",
    description: "Commercial delivery van reported missing from transport hub.",
    registeredDate: "2026-04-22",
    addedBy: "State Transport Authority",
    active: true
  }
];

let alerts = [
  {
    id: "ALT-001",
    severity: "High",
    title: "Vehicle on Watchlist",
    description: "GJ01XX0001 detected at C002",
    details: "Blacklisted vehicle matching armed suspect alert flagged at Subhash Bridge checkpoint.",
    cameraId: "C002",
    cameraName: "RTO Checkpoint",
    matchedEntity: "GJ01XX0001 (Blacklisted Vehicle)",
    confidence: "99%",
    timestamp: "14:21",
    fullTimestamp: "2026-04-24T14:21:00Z",
    status: "active",
    vehicleNumber: "GJ01XX0001",
    eventType: "ANPR Match",
    thumbnail: "assets/alert-thumb-1.jpg"
  },
  {
    id: "ALT-002",
    severity: "Medium",
    title: "Person Detected",
    description: "Suspicious activity at C003",
    details: "Loitering behavior detected in commercial perimeter outside operating hours.",
    cameraId: "C003",
    cameraName: "City Center",
    matchedEntity: "Person of Interest / Loitering",
    confidence: "84%",
    timestamp: "13:56",
    fullTimestamp: "2026-04-24T13:56:00Z",
    status: "active",
    eventType: "Person Detection",
    thumbnail: "assets/alert-thumb-2.jpg"
  },
  {
    id: "ALT-003",
    severity: "High",
    title: "Vehicle on Watchlist",
    description: "GJ05AB1234 detected at C001",
    details: "Vehicle with stolen plate registered in Surat identified crossing main corridor.",
    cameraId: "C001",
    cameraName: "Traffic Junction (Ahmedabad)",
    matchedEntity: "GJ05AB1234 (Blacklisted Vehicle)",
    confidence: "96%",
    timestamp: "12:43",
    fullTimestamp: "2026-04-24T12:43:00Z",
    status: "active",
    vehicleNumber: "GJ05AB1234",
    eventType: "ANPR Match",
    thumbnail: "assets/alert-thumb-3.jpg"
  },
  {
    id: "ALT-004",
    severity: "Low",
    title: "Object Detected",
    description: "Backpack detected at C004",
    details: "Unattended baggage observed near expressway layby for >10 minutes.",
    cameraId: "C004",
    cameraName: "Highway",
    matchedEntity: "Unattended Object",
    confidence: "78%",
    timestamp: "11:32",
    fullTimestamp: "2026-04-24T11:32:00Z",
    status: "acknowledged",
    eventType: "Object Detection",
    thumbnail: "assets/alert-thumb-4.jpg"
  },
  {
    id: "ALT-005",
    severity: "Medium",
    title: "Vehicle Detected",
    description: "Unknown vehicle at C003",
    details: "Unregistered vehicle stationary in emergency transit lane.",
    cameraId: "C003",
    cameraName: "City Center",
    matchedEntity: "Traffic Obstruction",
    confidence: "91%",
    timestamp: "10:17",
    fullTimestamp: "2026-04-24T10:17:00Z",
    status: "active",
    vehicleNumber: "GJ01AB9981",
    eventType: "Vehicle Detection",
    thumbnail: "assets/alert-thumb-5.jpg"
  }
];

let vehicleHistory = {
  "GJ01XX0001": [
    {
      step: 1,
      time: "10:02",
      cameraId: "C001",
      cameraName: "Traffic Junction (Ahmedabad)",
      latitude: 23.0338,
      longitude: 72.5850,
      confidence: 0.96,
      speed: "45 km/h",
      lane: "Lane 2 Northbound"
    },
    {
      step: 2,
      time: "10:18",
      cameraId: "C002",
      cameraName: "RTO Checkpoint",
      latitude: 23.0550,
      longitude: 72.5780,
      confidence: 0.99,
      speed: "52 km/h",
      lane: "Toll Booth 04"
    },
    {
      step: 3,
      time: "10:41",
      cameraId: "C004",
      cameraName: "Highway Expy KM 14",
      latitude: 23.0720,
      longitude: 72.5420,
      confidence: 0.94,
      speed: "78 km/h",
      lane: "Expressway Fast Lane"
    }
  ]
};

let recentDetections = [
  { id: "D-01", camera: "C001", time: "14:31:02", type: "Car", plate: "GJ01XX0001", conf: 0.96, match: true },
  { id: "D-02", camera: "C001", time: "14:30:54", type: "Motorbike", plate: "GJ01AB4432", conf: 0.88, match: false },
  { id: "D-03", camera: "C002", time: "14:30:40", type: "SUV", plate: "RJ14AB5678", conf: 0.93, match: true },
  { id: "D-04", camera: "C003", time: "14:30:15", type: "Person", plate: "N/A", conf: 0.84, match: false },
  { id: "D-05", camera: "C005", time: "14:29:50", type: "Bus", plate: "GJ18Z7712", conf: 0.95, match: false },
  { id: "D-06", camera: "C001", time: "14:29:10", type: "Auto-Rickshaw", plate: "GJ01TT5514", conf: 0.90, match: false }
];

let systemStats = {
  totalEvents: 1248,
  aiDetections: 892,
  alertsGenerated: 32,
  avgResponseTime: "28s",
  totalEventsTrend: "+12%",
  aiDetectionsTrend: "+18%",
  alertsGeneratedTrend: "+6%",
  avgResponseTimeTrend: "-22%"
};

let auditLogs = [
  { id: "AUD-101", timestamp: "2026-04-24 14:32:05", officer: "admin", action: "SYSTEM_STARTUP", category: "Core", details: "Surveillance node initialized with 48 active camera feeds." },
  { id: "AUD-102", timestamp: "2026-04-24 14:21:18", officer: "officer_patel", action: "WATCHLIST_MATCH", category: "Alerts", details: "Vehicle GJ01XX0001 automatically flagged at Subhash Bridge (C002)." },
  { id: "AUD-103", timestamp: "2026-04-24 13:58:40", officer: "inspector_sharma", action: "CAMERA_ONBOARD", category: "Registry", details: "Onboarded Highway PTZ Camera C049 into Central Zone." },
  { id: "AUD-104", timestamp: "2026-04-24 12:45:10", officer: "admin", action: "ALERT_ACKNOWLEDGED", category: "Incident", details: "Acknowledged ANPR stolen vehicle alert ALT-003." },
  { id: "AUD-105", timestamp: "2026-04-24 11:15:22", officer: "officer_vikram", action: "WATCHLIST_ADDED", category: "Database", details: "Added stolen vehicle MH02CD9999 to state active watchlist." }
];

function logAudit(officer, action, category, details) {
  const newLog = {
    id: `AUD-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    officer: officer || 'System',
    action,
    category,
    details
  };
  auditLogs.unshift(newLog);
  if (auditLogs.length > 100) auditLogs.pop();
  return newLog;
}

// Temporal Deduplication Buffer (60-second cooldown window to prevent alert storming)
const alertDeduplicationCache = new Map();
const DEDUPLICATION_WINDOW_MS = 60 * 1000;

// ==========================================
// WebSocket Broadcast Utility
// ==========================================

function broadcast(event, payload) {
  const message = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected. Total clients:', wss.clients.size);
  // Send initial snapshot
  ws.send(JSON.stringify({
    event: 'init_state',
    payload: {
      stats: getComputedStats(),
      recentAlerts: alerts.slice(0, 5),
      recentDetections: recentDetections.slice(0, 10),
      camerasCount: cameras.length
    }
  }));

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.action === 'ping') {
        ws.send(JSON.stringify({ event: 'pong' }));
      }
    } catch (e) {
      console.error('[WebSocket] Invalid JSON message received', e);
    }
  });
});

function getComputedStats() {
  const onlineCount = cameras.filter(c => c.status === 'Online').length;
  const offlineCount = cameras.filter(c => c.status === 'Offline').length;
  const degradedCount = cameras.filter(c => c.status === 'Degraded').length;
  const activeAlertsCount = alerts.filter(a => a.status === 'active').length;

  return {
    totalCameras: cameras.length,
    onlineCameras: onlineCount,
    offlineCameras: offlineCount,
    degradedCameras: degradedCount,
    onlinePercent: ((onlineCount / cameras.length) * 100).toFixed(2),
    offlinePercent: ((offlineCount / cameras.length) * 100).toFixed(2),
    degradedPercent: ((degradedCount / cameras.length) * 100).toFixed(2),
    activeAlerts: activeAlertsCount,
    recentDetections: recentDetections.length,
    ...systemStats
  };
}

// ==========================================
// REST API Endpoints
// ==========================================

// 1. Health check & Stats
app.get('/api/health', (req, res) => {
  res.json({ status: 'UP', service: 'okDriver CCTV Analytics & Monitoring Platform', version: '1.0.0' });
});

app.get('/api/stats', (req, res) => {
  res.json(getComputedStats());
});

// 2. Camera Registry Endpoints
app.get('/api/cameras', (req, res) => {
  const { department, status, zone, search } = req.query;
  let filtered = [...cameras];

  if (department) filtered = filtered.filter(c => c.department.toLowerCase() === department.toLowerCase());
  if (status) filtered = filtered.filter(c => c.status.toLowerCase() === status.toLowerCase());
  if (zone) filtered = filtered.filter(c => c.zone.toLowerCase().includes(zone.toLowerCase()));
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(c => c.id.toLowerCase().includes(s) || c.name.toLowerCase().includes(s) || c.location.toLowerCase().includes(s));
  }

  res.json(filtered);
});

app.get('/api/cameras/:id', (req, res) => {
  const cam = cameras.find(c => c.id.toUpperCase() === req.params.id.toUpperCase());
  if (!cam) return res.status(404).json({ error: 'Camera not found' });
  res.json(cam);
});

app.post('/api/cameras', (req, res) => {
  const { id, name, department, location, type, protocol, streamUrl, latitude, longitude, zone } = req.body;
  if (!id || !name || !department) {
    return res.status(400).json({ error: 'Missing required camera fields: id, name, department' });
  }

  const existing = cameras.find(c => c.id.toUpperCase() === id.toUpperCase());
  if (existing) {
    return res.status(409).json({ error: 'Camera ID already exists in registry' });
  }

  const newCamera = {
    id: id.toUpperCase(),
    name,
    department,
    location: location || 'Ahmedabad Metropolitan',
    type: type || 'Fixed',
    protocol: protocol || 'RTSP',
    streamUrl: streamUrl || `rtsp://cctv.ahmedabad.police/streams/${id.toLowerCase()}`,
    status: 'Online',
    latitude: latitude ? parseFloat(latitude) : 23.0225,
    longitude: longitude ? parseFloat(longitude) : 72.5714,
    lastHeartbeat: new Date().toISOString(),
    zone: zone || 'Central Zone',
    fps: 30,
    bitrate: '3.5 Mbps',
    resolution: '1080p 30fps',
    storageRetentionDays: 30
  };

  cameras.unshift(newCamera);
  logAudit(req.body.operator || 'Admin', 'CAMERA_ONBOARD', 'Registry', `Onboarded ${newCamera.type} Camera ${newCamera.id} (${newCamera.name}) in ${newCamera.department}.`);
  broadcast('camera_added', newCamera);
  broadcast('stat_update', getComputedStats());
  res.status(201).json(newCamera);
});

app.put('/api/cameras/:id', (req, res) => {
  const camIndex = cameras.findIndex(c => c.id.toUpperCase() === req.params.id.toUpperCase());
  if (camIndex === -1) return res.status(404).json({ error: 'Camera not found' });

  cameras[camIndex] = { ...cameras[camIndex], ...req.body, id: cameras[camIndex].id };
  logAudit(req.body.operator || 'Admin', 'CAMERA_UPDATED', 'Registry', `Updated Camera ${cameras[camIndex].id} (${cameras[camIndex].name}).`);
  broadcast('camera_updated', cameras[camIndex]);
  broadcast('stat_update', getComputedStats());
  res.json(cameras[camIndex]);
});

app.delete('/api/cameras/:id', (req, res) => {
  const initialLength = cameras.length;
  cameras = cameras.filter(c => c.id.toUpperCase() !== req.params.id.toUpperCase());
  if (cameras.length === initialLength) return res.status(404).json({ error: 'Camera not found' });

  logAudit('Admin', 'CAMERA_DELETED', 'Registry', `Deleted Camera ${req.params.id} from registry.`);
  broadcast('camera_deleted', { id: req.params.id.toUpperCase() });
  broadcast('stat_update', getComputedStats());
  res.json({ message: 'Camera removed successfully' });
});

// 3. Alerts Endpoints
app.get('/api/alerts', (req, res) => {
  const { severity, status, search } = req.query;
  let filtered = [...alerts];

  if (severity) filtered = filtered.filter(a => a.severity.toLowerCase() === severity.toLowerCase());
  if (status) filtered = filtered.filter(a => a.status.toLowerCase() === status.toLowerCase());
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(a => a.title.toLowerCase().includes(s) || a.description.toLowerCase().includes(s) || (a.vehicleNumber && a.vehicleNumber.toLowerCase().includes(s)));
  }

  res.json(filtered);
});

app.post('/api/alerts/:id/acknowledge', (req, res) => {
  const alert = alerts.find(a => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });

  alert.status = 'acknowledged';
  alert.acknowledgedAt = new Date().toISOString();
  alert.acknowledgedBy = req.body.operator || 'Admin';

  logAudit(alert.acknowledgedBy, 'ALERT_ACKNOWLEDGED', 'Incident', `Acknowledged alert ${alert.id} (${alert.title} - ${alert.matchedEntity}).`);
  broadcast('alert_acknowledged', alert);
  broadcast('stat_update', getComputedStats());
  res.json(alert);
});

app.post('/api/alerts/:id/resolve', (req, res) => {
  const alert = alerts.find(a => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });

  alert.status = 'resolved';
  alert.resolvedAt = new Date().toISOString();
  alert.resolutionNotes = req.body.notes || 'Resolved by operator';
  alert.resolvedBy = req.body.operator || 'Admin';

  logAudit(alert.resolvedBy, 'ALERT_RESOLVED', 'Incident', `Resolved alert ${alert.id}. Notes: ${alert.resolutionNotes}.`);
  broadcast('alert_resolved', alert);
  broadcast('stat_update', getComputedStats());
  res.json(alert);
});

// 4. Watchlist Endpoints
app.get('/api/watchlist', (req, res) => {
  res.json(watchlist);
});

app.post('/api/watchlist', (req, res) => {
  const { identifier, type, category, severity, description, addedBy } = req.body;
  if (!identifier || !category) {
    return res.status(400).json({ error: 'Missing required watchlist fields' });
  }

  const newEntry = {
    id: `WL-${Date.now().toString().slice(-4)}`,
    identifier: identifier.toUpperCase().trim(),
    type: type || 'vehicle',
    category,
    severity: severity || 'High',
    description: description || 'Subject of interest',
    registeredDate: new Date().toISOString().split('T')[0],
    addedBy: addedBy || 'Control Room Operator',
    active: true
  };

  watchlist.unshift(newEntry);
  logAudit(newEntry.addedBy, 'WATCHLIST_ADDED', 'Database', `Added ${newEntry.category} identifier "${newEntry.identifier}" with priority ${newEntry.severity}.`);
  broadcast('watchlist_updated', newEntry);
  res.status(201).json(newEntry);
});

app.delete('/api/watchlist/:id', (req, res) => {
  const prevLen = watchlist.length;
  const removed = watchlist.find(w => w.id === req.params.id);
  watchlist = watchlist.filter(w => w.id !== req.params.id);
  if (watchlist.length === prevLen) return res.status(404).json({ error: 'Watchlist entry not found' });

  logAudit('Admin', 'WATCHLIST_REMOVED', 'Database', `Removed watchlist entry ${req.params.id} (${removed ? removed.identifier : ''}).`);
  res.json({ message: 'Watchlist entry removed' });
});

// Audit Logs & CSV Report Export
app.get('/api/audit-logs', (req, res) => {
  res.json(auditLogs);
});

app.get('/api/reports/export-csv', (req, res) => {
  let csv = 'ID,Timestamp,Officer,Action,Category,Details\n';
  auditLogs.forEach(l => {
    csv += `"${l.id}","${l.timestamp}","${l.officer}","${l.action}","${l.category}","${l.details.replace(/"/g, '""')}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="okDriver_Audit_Report_${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

// 5. AI Video Analytics Event Ingestion
app.post('/api/analytics/events', (req, res) => {
  const { camera_id, timestamp, vehicle_number, confidence, vehicle_type, bounding_box, event_type } = req.body;

  if (!camera_id) {
    return res.status(400).json({ error: 'camera_id is mandatory' });
  }

  const camera = cameras.find(c => c.id.toUpperCase() === camera_id.toUpperCase());
  const cameraName = camera ? camera.name : `Camera ${camera_id}`;

  const eventTime = timestamp ? new Date(timestamp) : new Date();
  const timeStr = eventTime.toTimeString().split(' ')[0].slice(0, 5);

  systemStats.totalEvents++;
  systemStats.aiDetections++;

  let matchedWatchlist = null;
  let isAlertGenerated = false;
  let generatedAlert = null;

  if (vehicle_number) {
    const cleanPlate = vehicle_number.toUpperCase().replace(/\s+/g, '');
    matchedWatchlist = watchlist.find(w => w.active && w.identifier.replace(/\s+/g, '').toUpperCase() === cleanPlate);

    if (matchedWatchlist) {
      const dedupKey = `${camera_id}_${cleanPlate}`;
      const lastTriggered = alertDeduplicationCache.get(dedupKey);
      const now = Date.now();

      // Check if duplicate alert suppression is active (60s cooldown)
      if (lastTriggered && (now - lastTriggered) < DEDUPLICATION_WINDOW_MS) {
        console.log(`[Deduplication] Suppressed redundant alert for ${cleanPlate} at ${camera_id} (${Math.round((now - lastTriggered) / 1000)}s since last alert)`);
      } else {
        alertDeduplicationCache.set(dedupKey, now);
        isAlertGenerated = true;
        systemStats.alertsGenerated++;

        generatedAlert = {
          id: `ALT-${Date.now().toString().slice(-4)}`,
          severity: matchedWatchlist.severity || 'High',
          title: `${matchedWatchlist.category}`,
          description: `${cleanPlate} detected at ${camera_id}`,
          details: matchedWatchlist.description,
          cameraId: camera_id,
          cameraName: cameraName,
          matchedEntity: `${cleanPlate} (${matchedWatchlist.category})`,
          confidence: `${Math.round((confidence || 0.95) * 100)}%`,
          timestamp: timeStr,
          fullTimestamp: eventTime.toISOString(),
          status: 'active',
          vehicleNumber: cleanPlate,
          eventType: 'ANPR Watchlist Match',
          thumbnail: 'assets/alert-thumb-1.jpg'
        };

        alerts.unshift(generatedAlert);

        // Record in vehicle history trail
        if (!vehicleHistory[cleanPlate]) vehicleHistory[cleanPlate] = [];
        vehicleHistory[cleanPlate].push({
          step: vehicleHistory[cleanPlate].length + 1,
          time: timeStr,
          cameraId: camera_id,
          cameraName: cameraName,
          latitude: camera ? camera.latitude : 23.0338,
          longitude: camera ? camera.longitude : 72.5850,
          confidence: confidence || 0.96,
          speed: `${Math.floor(40 + Math.random() * 35)} km/h`,
          lane: 'Active Lane'
        });
      }
    }
  }

  const detectionRecord = {
    id: `D-${Date.now().toString().slice(-4)}`,
    camera: camera_id,
    time: eventTime.toTimeString().split(' ')[0],
    type: vehicle_type || 'Vehicle',
    plate: vehicle_number || 'N/A',
    conf: confidence || 0.92,
    match: isAlertGenerated,
    boundingBox: bounding_box || { x: 100, y: 150, width: 220, height: 140 }
  };

  recentDetections.unshift(detectionRecord);
  if (recentDetections.length > 25) recentDetections.pop();

  // Broadcast through WebSocket in real-time
  broadcast('new_detection', detectionRecord);
  if (generatedAlert) {
    broadcast('watchlist_alert', generatedAlert);
  }
  broadcast('stat_update', getComputedStats());

  res.status(201).json({
    status: 'PROCESSED',
    detection: detectionRecord,
    watchlistMatched: !!matchedWatchlist,
    alert: generatedAlert
  });
});

// 6. Vehicle GIS Movement Tracking & Route History
app.get('/api/analytics/vehicle-history/:plate', (req, res) => {
  const plate = req.params.plate.toUpperCase().replace(/\s+/g, '');
  const history = vehicleHistory[plate];

  if (!history || history.length === 0) {
    // Generate synthetic realistic route for demo search if plate is known
    return res.status(404).json({ error: 'No movement trail found for vehicle plate' });
  }

  res.json({
    plate,
    waypoints: history,
    totalDetections: history.length,
    firstSeen: history[0].time,
    lastSeen: history[history.length - 1].time
  });
});

// 7. Interactive Event Simulator Controls
let activeApiKey = process.env.MAP_API_KEY || "YOUR_MAP_API_KEY";

// Forward Auth requests to Django Backend
app.all('/api/auth/*', async (req, res) => {
  const djangoUrl = `http://localhost:8000${req.originalUrl}`;
  try {
    const fetchOptions = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
    }
    const response = await fetch(djangoUrl, fetchOptions);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Django auth proxy error:', err);
    res.status(502).json({ error: 'Failed to connect to Django authentication server on http://localhost:8000' });
  }
});

app.get('/api/config', (req, res) => {
  res.json({
    apiKey: activeApiKey,
    mapProvider: 'Carto Voyager (Mockup HD)',
    status: 'ACTIVE'
  });
});

app.post('/api/config', (req, res) => {
  if (req.body.apiKey) {
    activeApiKey = req.body.apiKey.trim();
  }
  res.json({ success: true, apiKey: activeApiKey, message: 'API key updated successfully' });
});

// AI Tactical Prediction for Suspect Vehicle
app.post('/api/ai/predict-route', (req, res) => {
  const { plate } = req.body;
  const targetPlate = plate || 'GJ01XX0001';

  const tacticalReport = {
    plate: targetPlate,
    classification: 'High-Risk Evasion Subject',
    lastObservedLocation: 'Ahmedabad - Ring Road Expy KM 14 (Camera C004)',
    lastTimestamp: '10:41 AM',
    calculatedAverageSpeed: '58.4 km/h',
    headingDirection: 'South-Southwest toward Sarkhej-Gandhinagar Corridor',
    predictedInterceptPoints: [
      { location: 'Sabarmati Riverfront South Toll Plaza', etaMinutes: 6, probability: '94%' },
      { location: 'Narol Junction Police Checkpoint', etaMinutes: 11, probability: '88%' }
    ],
    tacticalRecommendation: 'Deploy highway interception unit at C003/C004 intersection. Initiate automated license plate lock on adjacent toll booms.',
    aiModel: 'Gemini Tactical Intelligence Engine',
    apiKeyConfigured: activeApiKey ? `${activeApiKey.slice(0, 8)}...${activeApiKey.slice(-4)}` : 'Active'
  };

  res.json(tacticalReport);
});
app.post('/api/simulator/trigger', (req, res) => {
  const { action, plate, camera_id } = req.body;

  if (action === 'trigger_watchlist_match') {
    const targetPlate = plate || 'GJ01XX0001';
    const targetCam = camera_id || 'C002';

    // Simulate AI inference payload
    const simEvent = {
      camera_id: targetCam,
      timestamp: new Date().toISOString(),
      vehicle_number: targetPlate,
      confidence: 0.98,
      vehicle_type: 'Sedan',
      bounding_box: { x: 140, y: 160, width: 260, height: 180 },
      event_type: 'ANPR'
    };

    // Forward to analytics engine
    const camera = cameras.find(c => c.id === targetCam);
    const timeStr = new Date().toTimeString().split(' ')[0].slice(0, 5);

    const matchAlert = {
      id: `ALT-${Date.now().toString().slice(-4)}`,
      severity: 'High',
      title: 'Vehicle on Watchlist',
      description: `${targetPlate} detected at ${targetCam}`,
      details: `Live ANPR Alert triggered via edge gateway sensor. Blacklisted vehicle identified.`,
      cameraId: targetCam,
      cameraName: camera ? camera.name : 'Surveillance Post',
      matchedEntity: `${targetPlate} (Blacklisted Vehicle)`,
      confidence: '98%',
      timestamp: timeStr,
      fullTimestamp: new Date().toISOString(),
      status: 'active',
      vehicleNumber: targetPlate,
      eventType: 'ANPR Watchlist Match',
      thumbnail: 'assets/alert-thumb-1.jpg'
    };

    alerts.unshift(matchAlert);
    systemStats.alertsGenerated++;
    systemStats.aiDetections++;
    systemStats.totalEvents++;

    broadcast('watchlist_alert', matchAlert);
    broadcast('stat_update', getComputedStats());

    return res.json({ success: true, alert: matchAlert });
  }

  if (action === 'toggle_camera_status') {
    const cam = cameras.find(c => c.id === (camera_id || 'C004'));
    if (cam) {
      cam.status = cam.status === 'Offline' ? 'Online' : 'Offline';
      cam.lastHeartbeat = new Date().toISOString();
      broadcast('camera_updated', cam);
      broadcast('stat_update', getComputedStats());
      return res.json({ success: true, camera: cam });
    }
  }

  res.status(400).json({ error: 'Unknown simulator action' });
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Catch-all route to serve the Single Page App
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` okDriver CCTV Monitoring & AI Analytics Platform     `);
  console.log(` Running on: http://localhost:${PORT}                 `);
  console.log(` WebSocket:  ws://localhost:${PORT}/ws               `);
  console.log(`=======================================================`);
});
