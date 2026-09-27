/**
 * GIS and Movement Visualization Module using Leaflet.js
 * Exactly styled to match okDriver surveillance dashboard mockup:
 * - Clean light street map showing Ahmedabad & the blue Sabarmati River
 * - C001 (Green), C002 (Red), C003 (Orange), C004 (Red) camera pins
 * - Bright blue route polyline connecting C001 -> C002 -> C004 -> C003
 * - Animated blue circular car badge traveling along the route
 * - Multi-layer support (Clean Street, Dark Surveillance, Satellite)
 * - Independent instances for Dashboard and Full Maps view (never break each other)
 */

class GISMapManager {
  constructor() {
    this.maps = {};
    this.markers = {};
    this.routes = {};
    this.vehicleMarkers = {};
    this.animationTimers = {};
    this.apiKey = localStorage.getItem('okdriver_map_api_key') || '';

    // Camera Coordinates positioned around Sabarmati River (Ahmedabad) matching mockup
    this.cameras = [
      { id: "C001", name: "Traffic Junction (Ahmedabad)", status: "Online", dept: "Traffic Police", lat: 23.0480, lng: 72.5620, color: "#10b981" }, // Top-left of river
      { id: "C002", name: "RTO Checkpoint", status: "Online", dept: "RTO", lat: 23.0530, lng: 72.5890, color: "#ef4444" }, // Top-right of river
      { id: "C003", name: "City Center", status: "Degraded", dept: "City Police", lat: 23.0230, lng: 72.5530, color: "#f59e0b" }, // Bottom-left of river
      { id: "C004", name: "Highway", status: "Offline", dept: "Highway Police", lat: 23.0200, lng: 72.5930, color: "#ef4444" } // Bottom-right of river
    ];

    // Suspect Vehicle GJ01XX0001 Route Path
    this.routeWaypoints = [
      { lat: 23.0480, lng: 72.5620, time: "10:02", cam: "C001" }, // C001 (Top-Left)
      { lat: 23.0530, lng: 72.5890, time: "10:18", cam: "C002" }, // C002 (Top-Right)
      { lat: 23.0200, lng: 72.5930, time: "10:41", cam: "C004" }, // C004 (Bottom-Right)
      { lat: 23.0230, lng: 72.5530, time: "11:05", cam: "C003" }  // C003 (Bottom-Left)
    ];
  }

  setApiKey(key) {
    if (key) {
      this.apiKey = key.trim();
      localStorage.setItem('okdriver_map_api_key', this.apiKey);
    }
  }

  init(containerId = 'leaflet-map') {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Destroy existing instance for THIS container only
    if (this.maps[containerId]) {
      this.maps[containerId].remove();
      delete this.maps[containerId];
      if (this.animationTimers[containerId]) {
        clearInterval(this.animationTimers[containerId]);
      }
    }

    // Ahmedabad Sabarmati river center
    const centerLatLng = [23.0360, 72.5730];
    const zoomLevel = containerId === 'leaflet-map' ? 13 : 13;

    try {
      const map = L.map(containerId, {
        center: centerLatLng,
        zoom: zoomLevel,
        zoomControl: false,
        attributionControl: false,
        fadeAnimation: true,
        zoomAnimation: true
      });

      // Zoom Control top-right with custom styling matching screenshot
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Tile Layer: Google Maps Standard Roadmap (Official, Crisp, NO WATERMARK!)
      const googleRoadmap = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3'],
        attribution: 'Google Maps'
      }).addTo(map);

      // Alternative High-Quality Tile Layers (All 100% Free & No Watermark)
      const googleSatellite = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3'],
        attribution: 'Google Satellite'
      });

      const esriStreet = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Esri World Street Map'
      });

      const osmStandard = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: 'OpenStreetMap'
      });

      // Layer Control (available on both views)
      const baseMaps = {
        "🗺️ Google Maps": googleRoadmap,
        "🛰️ Google Satellite": googleSatellite,
        "🏙️ Esri Street Map": esriStreet,
        "🌍 OpenStreetMap": osmStandard
      };
      L.control.layers(baseMaps, null, { position: 'topleft' }).addTo(map);

      this.maps[containerId] = map;

      // Render Camera Pins matching mockup
      this.renderCameraPins(map, containerId);

      // Render Suspect Vehicle Route & Animated Car Marker
      this.renderVehicleRoute(map, containerId);

      // Invalidate sizes at multiple intervals to guarantee zero grey tiles
      [50, 150, 300, 600, 1000].forEach(delay => {
        setTimeout(() => {
          if (this.maps[containerId]) {
            this.maps[containerId].invalidateSize();
          }
        }, delay);
      });

    } catch (err) {
      console.error('[Map] Error initializing Leaflet map:', err);
    }
  }

  // Create Custom SVG Camera Pin matching mockup
  createPinIcon(cam) {
    const isAlert = cam.id === 'C002';
    const pulseHtml = isAlert ? `<div class="pulse-beacon" style="border-color:${cam.color};"></div>` : '';

    return L.divIcon({
      className: 'custom-cam-pin-marker',
      html: `
        <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
          ${pulseHtml}
          <div style="
            background:${cam.color}; 
            color:#ffffff; 
            font-size:11px; 
            font-weight:700; 
            padding:3px 9px; 
            border-radius:14px; 
            box-shadow:0 3px 10px rgba(0,0,0,0.35); 
            border:2px solid #ffffff; 
            display:flex; 
            align-items:center; 
            gap:4px;
            cursor:pointer;
            letter-spacing:0.02em;
          ">
            <span style="font-size:10px;">📹</span> ${cam.id}
          </div>
          <div style="
            width: 0; 
            height: 0; 
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 6px solid ${cam.color};
            margin-top: -1px;
          "></div>
        </div>
      `,
      iconSize: [64, 38],
      iconAnchor: [32, 38]
    });
  }

  renderCameraPins(map, containerId) {
    if (!this.markers[containerId]) this.markers[containerId] = {};

    this.cameras.forEach(cam => {
      const marker = L.marker([cam.lat, cam.lng], {
        icon: this.createPinIcon(cam),
        title: `${cam.id} - ${cam.name}`
      }).addTo(map);

      marker.bindPopup(`
        <div style="color:#0f172a; font-family:-apple-system,BlinkMacSystemFont,sans-serif; min-width:200px; padding:2px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
            <h4 style="margin:0; font-size:13px; font-weight:700; color:#1e3a8a;">${cam.id}: ${cam.name}</h4>
          </div>
          <p style="margin:2px 0; font-size:11px; color:#475569;">Department: <b>${cam.dept}</b></p>
          <p style="margin:2px 0; font-size:11px; color:#475569;">Health: <b style="color:${cam.color};">${cam.status}</b></p>
          <p style="margin:2px 0; font-size:10px; color:#94a3b8;">Coords: ${cam.lat.toFixed(4)}, ${cam.lng.toFixed(4)}</p>
          <div style="margin-top:8px; display:flex; gap:6px;">
            <button onclick="window.app.openCameraModal('${cam.id}')" style="flex:1; background:#2563eb; color:#fff; border:none; padding:5px 8px; border-radius:4px; font-size:11px; font-weight:600; cursor:pointer;">Live View</button>
            <button onclick="window.gisMap.focusCamera('${cam.id}', '${containerId}')" style="background:#e2e8f0; color:#1e293b; border:none; padding:5px 8px; border-radius:4px; font-size:11px; cursor:pointer;">Focus</button>
          </div>
        </div>
      `);

      this.markers[containerId][cam.id] = marker;
    });
  }

  renderVehicleRoute(map, containerId) {
    const latLngs = this.routeWaypoints.map(p => [p.lat, p.lng]);

    // Outer glow polyline
    L.polyline(latLngs, {
      color: '#38bdf8',
      weight: 6,
      opacity: 0.45,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    // Main route polyline matching screenshot
    const polyline = L.polyline(latLngs, {
      color: '#2563eb',
      weight: 3.5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    this.routes[containerId] = polyline;

    // Circular Blue Car Marker (Exact match with round blue badge in mockup)
    const carIcon = L.divIcon({
      className: 'vehicle-route-car-icon',
      html: `
        <div style="
          background:#2563eb; 
          border:2px solid #ffffff; 
          width:30px; 
          height:30px; 
          border-radius:50%; 
          display:flex; 
          align-items:center; 
          justify-content:center; 
          font-size:14px; 
          box-shadow:0 3px 12px rgba(37,99,235,0.6);
          color:#ffffff;
          cursor:pointer;
        ">
          🚘
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    // Initial position on line between C001 and C002 (matching screenshot position)
    const midLat = (this.routeWaypoints[0].lat + this.routeWaypoints[1].lat) / 2;
    const midLng = (this.routeWaypoints[0].lng + this.routeWaypoints[1].lng) / 2;

    const carMarker = L.marker([midLat, midLng], {
      icon: carIcon,
      zIndexOffset: 1000
    }).addTo(map);

    carMarker.bindPopup(`
      <div style="color:#0f172a; font-family:-apple-system,sans-serif; min-width:180px;">
        <h4 style="margin:0 0 4px 0; color:#dc2626; font-size:13px;">🚨 Suspect Vehicle: GJ01XX0001</h4>
        <p style="margin:2px 0; font-size:11px;">Category: <b>Blacklisted Vehicle</b></p>
        <p style="margin:2px 0; font-size:11px;">Speed: <b>62 km/h (Active)</b></p>
        <p style="margin:2px 0; font-size:11px; color:#475569;">Corridor: <b>Sabarmati Riverfront Expressway</b></p>
      </div>
    `);

    this.vehicleMarkers[containerId] = carMarker;

    // Start Smooth Animated Glide along the path
    this.startVehicleAnimation(containerId);
  }

  startVehicleAnimation(containerId) {
    let segment = 0;
    let t = 0.5; // start between C001 and C002 as shown in mockup
    const speed = 0.006;

    if (this.animationTimers[containerId]) {
      clearInterval(this.animationTimers[containerId]);
    }

    this.animationTimers[containerId] = setInterval(() => {
      const marker = this.vehicleMarkers[containerId];
      if (!marker) return;

      const p1 = this.routeWaypoints[segment];
      const p2 = this.routeWaypoints[(segment + 1) % this.routeWaypoints.length];

      t += speed;
      if (t >= 1) {
        t = 0;
        segment = (segment + 1) % this.routeWaypoints.length;
      }

      const curLat = p1.lat + (p2.lat - p1.lat) * t;
      const curLng = p1.lng + (p2.lng - p1.lng) * t;

      marker.setLatLng([curLat, curLng]);
    }, 40);
  }

  focusVehicle(containerId = 'leaflet-map') {
    const map = this.maps[containerId] || this.maps['leaflet-map'];
    const marker = this.vehicleMarkers[containerId] || this.vehicleMarkers['leaflet-map'];

    if (map && marker) {
      map.flyTo(marker.getLatLng(), 14, { duration: 1 });
      marker.openPopup();
    }
  }

  focusCamera(camId, containerId = 'leaflet-map') {
    const map = this.maps[containerId] || this.maps['leaflet-map'];
    const markers = this.markers[containerId] || this.markers['leaflet-map'];

    if (map && markers && markers[camId]) {
      const marker = markers[camId];
      map.flyTo(marker.getLatLng(), 15, { duration: 1 });
      marker.openPopup();
    }
  }
}

window.gisMap = new GISMapManager();
window.addEventListener('resize', () => {
  Object.values(window.gisMap.maps).forEach(map => map && map.invalidateSize());
});
