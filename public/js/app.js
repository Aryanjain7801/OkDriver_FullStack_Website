/**
 * okDriver Integrated CCTV Monitoring & AI Analytics Platform - Main App Controller
 */

class AppController {
  constructor() {
    this.currentView = 'dashboard';
    this.cameras = [];
    this.alerts = [];
    this.watchlist = [];
    this.stats = {};
    this.selectedAlert = null;
    this.selectedCamera = null;
  }

  async init() {
    this.initAuth();
    this.startClock();
    this.setupNavigation();
    this.setupSearch();
    await this.fetchInitialData();
    this.renderDashboard();

    // Initialize feeds and map
    setTimeout(() => {
      window.videoEngine.initFeed('feed-c001', 'C001');
      window.videoEngine.initFeed('feed-c002', 'C002');
      window.videoEngine.initFeed('feed-c003', 'C003');
      window.videoEngine.initFeed('feed-c004', 'C004');
      window.gisMap.init('leaflet-map');
    }, 200);

    // Connect WebSocket
    window.realtimeClient.connect();
  }

  startClock() {
    const clockEl = document.getElementById('header-live-clock');
    const update = () => {
      const now = new Date();
      // Format: 24 Apr 2026 14:32:17
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const day = String(now.getDate()).padStart(2, '0');
      const month = months[now.getMonth()];
      const year = now.getFullYear();
      const timeStr = now.toTimeString().split(' ')[0];
      if (clockEl) {
        clockEl.textContent = `${day} ${month} ${year} ${timeStr}`;
      }
    };
    update();
    setInterval(update, 1000);
  }

  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = item.getAttribute('data-view');
        if (targetView) {
          this.switchView(targetView);
        }
      });
    });
  }

  switchView(viewName) {
    this.currentView = viewName;

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewName);
    });

    // Hide all view panels and show target
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    const targetPanel = document.getElementById(`view-${viewName}`);
    if (targetPanel) {
      targetPanel.classList.add('active');
    }

    // Trigger specific view renders
    if (viewName === 'dashboard') {
      setTimeout(() => {
        if (!window.gisMap.maps['leaflet-map']) {
          window.gisMap.init('leaflet-map');
        } else {
          window.gisMap.maps['leaflet-map'].invalidateSize();
        }
        window.videoEngine.initFeed('feed-c001', 'C001');
        window.videoEngine.initFeed('feed-c002', 'C002');
        window.videoEngine.initFeed('feed-c003', 'C003');
        window.videoEngine.initFeed('feed-c004', 'C004');
      }, 100);
    } else if (viewName === 'cameras') {
      this.renderCameraRegistryPage();
    } else if (viewName === 'alerts') {
      this.renderAlertsPage();
    } else if (viewName === 'watchlist') {
      this.renderWatchlistPage();
    } else if (viewName === 'maps') {
      setTimeout(() => {
        if (!window.gisMap.maps['full-gis-map']) {
          window.gisMap.init('full-gis-map');
        } else {
          window.gisMap.maps['full-gis-map'].invalidateSize();
        }
      }, 100);
    } else if (viewName === 'analytics') {
      this.renderAnalyticsPage();
    } else if (viewName === 'monitoring') {
      this.renderMonitoringWall();
    } else if (viewName === 'reports') {
      this.loadAuditLogs();
    }
  }

  setupSearch() {
    const searchInput = document.getElementById('global-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (q.length > 1) {
        // Quick vehicle plate check
        if (q.includes('gj01') || q.includes('xx0001')) {
          this.showToast('Vehicle GJ01XX0001 identified! Highlighting route history on map.', 'info');
          if (this.currentView !== 'dashboard') this.switchView('dashboard');
          window.gisMap.focusVehicle();
        }
      }
    });
  }

  async fetchInitialData() {
    try {
      const [statsRes, camRes, alertRes, wlRes] = await Promise.all([
        fetch('/api/stats').then(r => r.json()),
        fetch('/api/cameras').then(r => r.json()),
        fetch('/api/alerts').then(r => r.json()),
        fetch('/api/watchlist').then(r => r.json())
      ]);

      this.stats = statsRes;
      this.cameras = camRes;
      this.alerts = alertRes;
      this.watchlist = wlRes;
    } catch (err) {
      console.error('Failed to load API data:', err);
    }
  }

  renderDashboard() {
    this.updateStats(this.stats);
    this.renderRecentAlerts();
    this.renderCameraTable();
    this.renderWatchlistMatches();
  }

  updateStats(stats) {
    if (!stats) return;
    this.stats = { ...this.stats, ...stats };

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setText('kpi-total-cameras', this.stats.totalCameras || 48);
    setText('kpi-online-cameras', this.stats.onlineCameras || 45);
    setText('kpi-offline-cameras', this.stats.offlineCameras || 2);
    setText('kpi-degraded-cameras', this.stats.degradedCameras || 1);
    setText('kpi-active-alerts', this.stats.activeAlerts || 5);
    setText('kpi-recent-detections', this.stats.recentDetections || 12);

    setText('stat-total-events', Number(this.stats.totalEvents || 1248).toLocaleString());
    setText('stat-ai-detections', Number(this.stats.aiDetections || 892).toLocaleString());
    setText('stat-alerts-gen', this.stats.alertsGenerated || 32);
    setText('stat-avg-resp', this.stats.avgResponseTime || '28s');

    // Update nav alert badge
    const badge = document.getElementById('nav-alert-badge');
    if (badge) badge.textContent = this.stats.activeAlerts || 5;
    const headerBadge = document.getElementById('header-bell-badge');
    if (headerBadge) headerBadge.textContent = this.stats.activeAlerts || 3;
  }

  renderRecentAlerts() {
    const container = document.getElementById('dashboard-recent-alerts');
    if (!container) return;

    container.innerHTML = '';
    const slice = this.alerts.slice(0, 5);

    slice.forEach(alert => {
      const item = document.createElement('div');
      item.className = 'alert-row-item';
      item.onclick = () => this.openAlertModal(alert.id);

      const sevClass = alert.severity ? alert.severity.toLowerCase() : 'medium';
      
      // Thumbnail SVG representation
      item.innerHTML = `
        <div class="alert-thumb-img" style="display:flex;align-items:center;justify-content:center;background:#182238;color:#38bdf8;font-size:16px;">
          ${alert.eventType && alert.eventType.includes('Person') ? '👤' : alert.eventType && alert.eventType.includes('Object') ? '🎒' : '🚗'}
        </div>
        <div class="alert-meta">
          <div class="alert-top-line">
            <span class="severity-tag ${sevClass}">${alert.severity || 'HIGH'}</span>
            <span class="alert-timestamp">${alert.timestamp || '14:21'}</span>
          </div>
          <div class="alert-heading">${alert.title}</div>
          <div class="alert-sub">${alert.description}</div>
        </div>
      `;
      container.appendChild(item);
    });
  }

  renderCameraTable() {
    const tbody = document.getElementById('mini-camera-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const topCameras = this.cameras.slice(0, 5);

    topCameras.forEach(cam => {
      const tr = document.createElement('tr');
      const statusClass = cam.status.toLowerCase();

      tr.innerHTML = `
        <td class="cam-id-cell">${cam.id}</td>
        <td>${cam.name}</td>
        <td>${cam.department}</td>
        <td>Ahmedabad</td>
        <td>${cam.type}</td>
        <td><span class="status-pill ${statusClass}">● ${cam.status}</span></td>
        <td style="color:#64748b;">${cam.id === 'C001' ? '2 min ago' : cam.id === 'C002' ? '1 min ago' : cam.id === 'C003' ? '6 min ago' : cam.id === 'C004' ? '12 min ago' : '1 min ago'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderWatchlistMatches() {
    const container = document.getElementById('dashboard-watchlist-matches');
    if (!container) return;

    container.innerHTML = '';
    const items = [
      { id: 'GJ01XX0001', category: 'Blacklisted Vehicle', loc: 'C001 • 14:21', color: 'red', icon: '🚗' },
      { id: 'RJ14AB5678', category: 'Stolen Vehicle', loc: 'C002 • 11:03', color: 'amber', icon: '🚙' },
      { id: 'John Doe', category: 'Wanted Person', loc: 'C003 • 09:45', color: 'purple', icon: '👤' },
      { id: 'MH02CD9999', category: 'Suspect Vehicle', loc: 'C004 • 08:30', color: 'red', icon: '🚚' }
    ];

    items.forEach(m => {
      const row = document.createElement('div');
      row.className = 'watchlist-match-item';
      row.onclick = () => {
        this.showToast(`Tracking history loaded for ${m.id}`, 'info');
        window.gisMap.focusVehicle();
      };

      row.innerHTML = `
        <div class="match-avatar-circle ${m.color}">
          ${m.icon}
        </div>
        <div class="match-content-info">
          <div class="match-identifier-title">${m.id}</div>
          <div class="match-category-sub">${m.category}</div>
          <div class="match-location-time">${m.loc}</div>
        </div>
        <div style="color:#64748b; font-size:14px; cursor:pointer;">⋮</div>
      `;
      container.appendChild(row);
    });
  }

  // Incoming WebSocket Handlers
  handleIncomingAlert(alert) {
    this.alerts.unshift(alert);
    this.renderRecentAlerts();
    this.showToast(`🚨 Watchlist Alert: ${alert.title} - ${alert.description}`, 'alert-high');

    // Trigger pulsating beacon on camera
    if (window.gisMap) {
      window.gisMap.focusCamera(alert.cameraId);
    }
  }

  handleIncomingDetection(detection) {
    const list = document.getElementById('analytics-detections-feed');
    if (list) {
      const item = document.createElement('div');
      item.className = 'alert-row-item';
      item.innerHTML = `
        <div style="font-size:16px;">🔍</div>
        <div class="alert-meta">
          <div class="alert-top-line">
            <span style="font-weight:700; color:${detection.match ? '#ef4444' : '#38bdf8'}">${detection.plate}</span>
            <span class="alert-timestamp">${detection.time}</span>
          </div>
          <div class="alert-sub">Cam ${detection.camera} • ${detection.type} • Conf: ${(detection.conf * 100).toFixed(0)}%</div>
        </div>
      `;
      list.prepend(item);
      if (list.children.length > 20) list.removeChild(list.lastChild);
    }
  }

  async refreshCameras() {
    this.cameras = await fetch('/api/cameras').then(r => r.json());
    this.renderCameraTable();
    if (this.currentView === 'cameras') {
      this.renderCameraRegistryPage();
    }
  }

  // Modals Management
  openAlertModal(alertId) {
    const alert = this.alerts.find(a => a.id === alertId) || this.alerts[0];
    if (!alert) return;

    this.selectedAlert = alert;
    document.getElementById('modal-alert-title').textContent = `${alert.severity.toUpperCase()} ALERT: ${alert.title}`;
    document.getElementById('modal-alert-desc').textContent = alert.description;
    document.getElementById('modal-alert-details').textContent = alert.details || 'Identified via AI neural network classifier.';
    document.getElementById('modal-alert-cam').textContent = `${alert.cameraId} - ${alert.cameraName}`;
    document.getElementById('modal-alert-entity').textContent = alert.matchedEntity || alert.vehicleNumber || 'Unknown';
    document.getElementById('modal-alert-conf').textContent = alert.confidence || '96%';
    document.getElementById('modal-alert-time').textContent = alert.timestamp;
    document.getElementById('modal-alert-status').textContent = alert.status.toUpperCase();

    document.getElementById('alert-details-modal').classList.add('open');
  }

  closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('open');
  }

  async acknowledgeAlert() {
    if (!this.selectedAlert) return;
    try {
      const res = await fetch(`/api/alerts/${this.selectedAlert.id}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator: 'Admin Officer' })
      });
      const updated = await res.json();
      this.showToast(`Alert ${this.selectedAlert.id} acknowledged.`, 'info');
      this.closeModal('alert-details-modal');
      this.alerts = await fetch('/api/alerts').then(r => r.json());
      this.renderRecentAlerts();
    } catch (e) {
      console.error(e);
    }
  }

  async resolveAlert() {
    if (!this.selectedAlert) return;
    try {
      const res = await fetch(`/api/alerts/${this.selectedAlert.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator: 'Admin Officer', notes: 'Vehicle intercepted and verified.' })
      });
      this.showToast(`Alert ${this.selectedAlert.id} resolved.`, 'info');
      this.closeModal('alert-details-modal');
      this.alerts = await fetch('/api/alerts').then(r => r.json());
      this.renderRecentAlerts();
    } catch (e) {
      console.error(e);
    }
  }

  openOnboardModal() {
    document.getElementById('onboard-camera-modal').classList.add('open');
  }

  async submitNewCamera(e) {
    e.preventDefault();
    const id = document.getElementById('cam-input-id').value.trim();
    const name = document.getElementById('cam-input-name').value.trim();
    const dept = document.getElementById('cam-input-dept').value;
    const type = document.getElementById('cam-input-type').value;
    const protocol = document.getElementById('cam-input-protocol').value;
    const streamUrl = document.getElementById('cam-input-stream').value.trim();
    const lat = document.getElementById('cam-input-lat').value.trim();
    const lng = document.getElementById('cam-input-lng').value.trim();
    const zone = document.getElementById('cam-input-zone').value;

    try {
      const res = await fetch('/api/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id, name, department: dept, type, protocol, streamUrl,
          latitude: lat, longitude: lng, zone
        })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.error}`);
        return;
      }

      this.showToast(`Camera ${id} successfully registered!`, 'info');
      this.closeModal('onboard-camera-modal');
      await this.refreshCameras();
    } catch (err) {
      console.error(err);
    }
  }

  openCameraModal(camId) {
    const cam = this.cameras.find(c => c.id === camId) || { id: camId, name: 'Surveillance Post' };
    this.selectedCamera = cam;
    document.getElementById('stream-modal-title').textContent = `${cam.id} - ${cam.name}`;
    document.getElementById('stream-modal-meta').textContent = `Protocol: ${cam.protocol || 'RTSP'} | Bitrate: ${cam.bitrate || '3.5 Mbps'} | FPS: 30`;
    document.getElementById('camera-stream-modal').classList.add('open');

    // Run canvas stream inside modal
    setTimeout(() => {
      window.videoEngine.initFeed('modal-canvas-stream', cam.id);
    }, 100);
  }

  // Simulator Triggers
  async predictTacticalRoute() {
    try {
      const res = await fetch('/api/ai/predict-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate: 'GJ01XX0001' })
      });
      const data = await res.json();

      document.getElementById('tactical-plate').textContent = data.plate;
      document.getElementById('tactical-model').textContent = data.aiModel;
      document.getElementById('tactical-summary').innerHTML = `
        Target Vehicle <b>${data.plate}</b> identified fleeing. Calculated speed: <b>${data.calculatedAverageSpeed}</b>. Heading: <b>${data.headingDirection}</b>. Last observed: <i>${data.lastObservedLocation}</i>.
      `;

      const list = document.getElementById('tactical-intercepts');
      list.innerHTML = data.predictedInterceptPoints.map(p => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); padding:6px 10px; border-radius:4px;">
          <span>📍 <b>${p.location}</b></span>
          <span style="color:#f59e0b;">ETA: ${p.etaMinutes} mins</span>
          <span style="color:#10b981; font-weight:700;">${p.probability} Match</span>
        </div>
      `).join('');

      document.getElementById('tactical-action').textContent = `Recommended Action: ${data.tacticalRecommendation}`;

      document.getElementById('tactical-route-modal').classList.add('open');
      this.showToast('AI Tactical Route Analysis generated using configured API Key.', 'info');
    } catch (e) {
      console.error(e);
    }
  }

  async saveApiKey() {
    const input = document.getElementById('setting-api-key');
    if (!input) return;
    const key = input.value.trim();
    if (!key) {
      alert('Please enter an API Key');
      return;
    }

    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key })
      });

      window.gisMap.setApiKey(key);
      this.showToast('API Key saved and applied to Maps & AI Engine!', 'info');
    } catch (e) {
      console.error(e);
    }
  }

  async simulateWatchlistTrigger() {
    try {
      const res = await fetch('/api/simulator/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger_watchlist_match', plate: 'GJ01XX0001', camera_id: 'C002' })
      });
      const data = await res.json();
      this.showToast('Watchlist event simulated for GJ01XX0001 @ C002', 'alert-high');
    } catch (e) {
      console.error(e);
    }
  }

  async simulateToggleCamera() {
    try {
      const res = await fetch('/api/simulator/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_camera_status', camera_id: 'C004' })
      });
      const data = await res.json();
      window.videoEngine.toggleCameraOnline('C004');
      this.showToast(`Camera C004 status toggled to: ${data.camera.status}`, 'info');
    } catch (e) {
      console.error(e);
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'alert-high' ? 'alert-high' : ''}`;
    toast.innerHTML = `
      <span style="font-size:16px;">${type === 'alert-high' ? '🚨' : 'ℹ️'}</span>
      <div>${message}</div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Authentication Management (Connected to Django Backend)
  initAuth() {
    const savedUser = localStorage.getItem('okdriver_user');
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
        this.updateUserHeader(this.currentUser);
      } catch (e) {
        this.currentUser = null;
      }
    } else {
      // Default initial user
      this.currentUser = {
        username: 'admin',
        full_name: 'Admin Director',
        department: 'Admin',
        role: 'Administrator',
        badge_number: 'HQ-ADM-001'
      };
      this.updateUserHeader(this.currentUser);
    }
  }

  updateUserHeader(user) {
    const nameEl = document.getElementById('header-user-name');
    const avatarEl = document.getElementById('header-user-avatar');
    if (nameEl) nameEl.textContent = user.full_name || user.username || 'Admin';
    if (avatarEl) {
      const initials = (user.full_name || user.username || 'AD')
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      avatarEl.textContent = initials || 'AD';
    }
  }

  openAuthModal(defaultTab = 'signin') {
    this.switchAuthTab(defaultTab);
    const m = document.getElementById('auth-modal');
    if (m) m.classList.add('open');
  }

  switchAuthTab(tab) {
    const tabSignin = document.getElementById('auth-tab-signin');
    const tabReg = document.getElementById('auth-tab-register');
    const btnSignin = document.getElementById('tab-btn-signin');
    const btnReg = document.getElementById('tab-btn-register');

    if (tab === 'signin') {
      if (tabSignin) tabSignin.style.display = 'block';
      if (tabReg) tabReg.style.display = 'none';
      if (btnSignin) {
        btnSignin.style.borderBottom = '2px solid var(--accent-blue)';
        btnSignin.style.color = '#ffffff';
      }
      if (btnReg) {
        btnReg.style.borderBottom = 'none';
        btnReg.style.color = 'var(--text-secondary)';
      }
    } else {
      if (tabSignin) tabSignin.style.display = 'none';
      if (tabReg) tabReg.style.display = 'block';
      if (btnSignin) {
        btnSignin.style.borderBottom = 'none';
        btnSignin.style.color = 'var(--text-secondary)';
      }
      if (btnReg) {
        btnReg.style.borderBottom = '2px solid var(--accent-blue)';
        btnReg.style.color = '#ffffff';
      }
    }
  }

  quickFillLogin(username, password) {
    const uInput = document.getElementById('login-username');
    const pInput = document.getElementById('login-password');
    if (uInput) uInput.value = username;
    if (pInput) pInput.value = password;
  }

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    try {
      const res = await fetch('/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Login failed. Please check your credentials.');
        return;
      }

      this.currentUser = data.user;
      localStorage.setItem('okdriver_user', JSON.stringify(data.user));
      this.updateUserHeader(data.user);
      this.closeModal('auth-modal');
      this.showToast(`Welcome ${data.user.full_name}! Successfully logged in.`, 'info');
    } catch (err) {
      console.error(err);
      alert('Authentication service temporarily unavailable.');
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const first_name = document.getElementById('reg-fname').value.trim();
    const last_name = document.getElementById('reg-lname').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const department = document.getElementById('reg-dept').value;
    const badge_number = document.getElementById('reg-badge').value.trim();
    const password = document.getElementById('reg-password').value.trim();

    try {
      const res = await fetch('/api/auth/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name, last_name, username, email, department, badge_number, password, role: 'Officer'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Registration failed.');
        return;
      }

      this.currentUser = data.user;
      localStorage.setItem('okdriver_user', JSON.stringify(data.user));
      this.updateUserHeader(data.user);
      this.closeModal('auth-modal');
      this.showToast(`Account successfully created! Welcome ${data.user.full_name}.`, 'info');
    } catch (err) {
      console.error(err);
      alert('Registration service temporarily unavailable.');
    }
  }

  logout() {
    localStorage.removeItem('okdriver_user');
    this.currentUser = null;
    window.location.href = 'login.html';
  }

  // Camera Registry Page Full Table with Filter
  filterCameras() {
    const search = (document.getElementById('camera-filter-search')?.value || '').toLowerCase().trim();
    const dept = (document.getElementById('camera-filter-dept')?.value || '').toLowerCase();
    const status = (document.getElementById('camera-filter-status')?.value || '').toLowerCase();

    const filtered = this.cameras.filter(c => {
      const matchSearch = !search || c.id.toLowerCase().includes(search) || c.name.toLowerCase().includes(search) || (c.location && c.location.toLowerCase().includes(search));
      const matchDept = !dept || c.department.toLowerCase().includes(dept);
      const matchStatus = !status || c.status.toLowerCase() === status;
      return matchSearch && matchDept && matchStatus;
    });

    this.renderCameraRegistryPage(filtered);
  }

  renderCameraRegistryPage(camsList = null) {
    const tbody = document.getElementById('full-camera-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = camsList || this.cameras;
    list.forEach(cam => {
      const tr = document.createElement('tr');
      const statusClass = cam.status.toLowerCase();
      tr.innerHTML = `
        <td class="cam-id-cell">${cam.id}</td>
        <td><b>${cam.name}</b></td>
        <td>${cam.department}</td>
        <td>${cam.zone || 'Central Zone'}</td>
        <td><span class="status-pill ${statusClass}">● ${cam.status}</span></td>
        <td>${cam.protocol || 'RTSP'}</td>
        <td>${cam.resolution || '1080p'}</td>
        <td>
          <button class="btn btn-secondary" style="padding:3px 8px;font-size:11px;" onclick="window.app.openCameraModal('${cam.id}')">Live View</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Alerts Page Full Table
  renderAlertsPage() {
    const list = document.getElementById('full-alerts-list');
    if (!list) return;
    list.innerHTML = '';

    this.alerts.forEach(a => {
      const item = document.createElement('div');
      item.className = 'alert-row-item';
      item.style.padding = '1rem';
      item.onclick = () => this.openAlertModal(a.id);

      const sevClass = a.severity.toLowerCase();
      item.innerHTML = `
        <div style="font-size:24px; padding:0 8px;">${a.eventType && a.eventType.includes('Person') ? '👤' : '🚗'}</div>
        <div class="alert-meta">
          <div class="alert-top-line">
            <span class="severity-tag ${sevClass}">${a.severity}</span>
            <span class="alert-timestamp">${a.fullTimestamp || a.timestamp}</span>
          </div>
          <div class="alert-heading" style="font-size:1rem;">${a.title} - ${a.description}</div>
          <div class="alert-sub">Camera: <b>${a.cameraId} (${a.cameraName})</b> | Matched Entity: <b>${a.matchedEntity || a.vehicleNumber}</b> | Confidence: <b>${a.confidence}</b></div>
          <div style="margin-top:6px; font-size:0.75rem; color:#94a3b8;">Status: <b style="color:${a.status === 'active' ? '#ef4444' : '#10b981'}">${a.status.toUpperCase()}</b></div>
        </div>
        <button class="btn btn-primary" style="align-self:center;" onclick="event.stopPropagation(); window.app.openAlertModal('${a.id}')">Manage</button>
      `;
      list.appendChild(item);
    });
  }

  // Watchlist Page CRUD & Modal
  openWatchlistModal() {
    const m = document.getElementById('add-watchlist-modal');
    if (m) m.classList.add('open');
  }

  async submitNewWatchlist(e) {
    e.preventDefault();
    const identifier = document.getElementById('wl-input-identifier').value.trim();
    const category = document.getElementById('wl-input-category').value;
    const severity = document.getElementById('wl-input-severity').value;
    const addedBy = document.getElementById('wl-input-dept').value;
    const description = document.getElementById('wl-input-desc').value.trim();

    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, category, severity, addedBy, description, type: 'vehicle' })
      });

      if (!res.ok) {
        alert('Failed to register watchlist record.');
        return;
      }

      this.watchlist = await fetch('/api/watchlist').then(r => r.json());
      this.renderWatchlistPage();
      this.renderWatchlistMatches();
      this.closeModal('add-watchlist-modal');
      this.showToast(`Entity ${identifier} registered in state watchlist!`, 'info');
      document.getElementById('wl-input-identifier').value = '';
      document.getElementById('wl-input-desc').value = '';
    } catch (err) {
      console.error(err);
      alert('Watchlist registration failed.');
    }
  }

  filterWatchlist() {
    const search = (document.getElementById('watchlist-filter-search')?.value || '').toLowerCase().trim();
    const cat = (document.getElementById('watchlist-filter-category')?.value || '').toLowerCase();

    const filtered = this.watchlist.filter(w => {
      const matchSearch = !search || w.identifier.toLowerCase().includes(search) || w.description.toLowerCase().includes(search);
      const matchCat = !cat || w.category.toLowerCase().includes(cat);
      return matchSearch && matchCat;
    });

    this.renderWatchlistPage(filtered);
  }

  renderWatchlistPage(itemsList = null) {
    const tbody = document.getElementById('watchlist-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = itemsList || this.watchlist;
    list.forEach(w => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:700; color:#38bdf8;">${w.identifier}</td>
        <td><span class="severity-tag ${w.severity.toLowerCase()}">${w.category}</span></td>
        <td>${w.severity}</td>
        <td>${w.description}</td>
        <td>${w.addedBy}</td>
        <td>${w.registeredDate}</td>
        <td>
          <button class="btn btn-danger" style="padding:2px 8px; font-size:11px;" onclick="window.app.deleteWatchlistEntry('${w.id}')">Remove</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  async deleteWatchlistEntry(id) {
    if (!confirm('Are you sure you want to remove this record from the active watchlist?')) return;
    try {
      await fetch(`/api/watchlist/${id}`, { method: 'DELETE' });
      this.watchlist = await fetch('/api/watchlist').then(r => r.json());
      this.renderWatchlistPage();
      this.renderWatchlistMatches();
      this.showToast('Watchlist entry removed.', 'info');
    } catch (e) {
      console.error(e);
    }
  }

  // Audit Logs & Reports Handling
  async loadAuditLogs() {
    try {
      const res = await fetch('/api/audit-logs');
      const logs = await res.json();
      this.renderAuditTrailPage(logs);
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    }
  }

  renderAuditTrailPage(logs) {
    const tbody = document.getElementById('audit-trail-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    logs.forEach(l => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family:monospace; color:#38bdf8; font-weight:600;">${l.id}</td>
        <td style="font-size:0.75rem; color:#94a3b8;">${l.timestamp}</td>
        <td><b>${l.officer}</b></td>
        <td><span class="severity-tag ${l.action.includes('WATCHLIST') ? 'high' : l.action.includes('ALERT') ? 'medium' : 'low'}">${l.action}</span></td>
        <td>${l.category}</td>
        <td style="font-size:0.78rem; color:#e2e8f0;">${l.details}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  exportAuditCSV() {
    window.location.href = '/api/reports/export-csv';
    this.showToast('Audit Report CSV downloaded successfully.', 'info');
  }

  // Camera PTZ Controls & Snapshot
  ptzMove(direction) {
    this.showToast(`PTZ: Pan/Tilt ${direction.toUpperCase()} command transmitted to camera.`, 'info');
  }

  ptzZoom() {
    this.showToast('PTZ: Optical Zoom +1.5x adjusted.', 'info');
  }

  takeSnapshot() {
    const canvas = document.getElementById('modal-canvas-stream');
    if (!canvas) return;
    const image = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = image;
    a.download = `CCTV_Snapshot_${this.selectedCamera ? this.selectedCamera.id : 'Live'}_${Date.now()}.png`;
    a.click();
    this.showToast('High-resolution snapshot saved to local drive.', 'info');
  }

  // Live Monitoring 3x3 Matrix Wall
  renderMonitoringWall() {
    const wall = document.getElementById('monitoring-wall-grid');
    if (!wall) return;
    wall.innerHTML = '';

    const cams = this.cameras.slice(0, 6);
    cams.forEach(cam => {
      const box = document.createElement('div');
      box.className = 'camera-feed-box';
      const canvasId = `wall-canvas-${cam.id}`;

      box.innerHTML = `
        <canvas id="${canvasId}" class="camera-canvas"></canvas>
        <div class="feed-header-overlay">
          <div class="feed-rec-badge"><span class="rec-dot"></span> LIVE</div>
          <div class="feed-fps-badge">30 FPS</div>
        </div>
        <div class="feed-info-footer">
          <span class="feed-cam-name">${cam.id} - ${cam.name}</span>
          <span class="status-pill ${cam.status.toLowerCase()}">● ${cam.status}</span>
        </div>
      `;
      wall.appendChild(box);

      setTimeout(() => {
        window.videoEngine.initFeed(canvasId, cam.id);
      }, 50);
    });
  }

  renderAnalyticsPage() {
    const plate = 'GJ01XX0001';
    const container = document.getElementById('anpr-movement-trail');
    const feedContainer = document.getElementById('analytics-detections-feed');

    if (container) {
      fetch(`/api/analytics/vehicle-history/${plate}`)
        .then(r => r.json())
        .then(data => {
          container.innerHTML = `
            <div style="background:var(--bg-card); padding:1.25rem; border-radius:12px; border:1px solid var(--border-color);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <h4 style="color:#38bdf8; font-size:0.95rem; font-weight:700;">Corridor Reconstruction: ${data.plate}</h4>
                <span class="severity-tag high">High-Risk Watchlist Match</span>
              </div>
              <p style="font-size:0.78rem; color:#94a3b8; margin-bottom:12px;">Total Detections: <b>${data.totalDetections}</b> | Corridor Window: <b>${data.firstSeen} - ${data.lastSeen}</b></p>
              <div style="display:flex; flex-direction:column; gap:8px;">
                ${data.waypoints.map(w => `
                  <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.02); padding:10px 14px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); font-size:0.8rem;">
                    <div>
                      <b style="color:#fff;">Step ${w.step}:</b> ${w.cameraName} <span style="color:#38bdf8; font-family:monospace;">(${w.cameraId})</span>
                    </div>
                    <div style="display:flex; gap:16px; align-items:center;">
                      <span style="color:#f59e0b; font-family:monospace; font-weight:600;">${w.time}</span>
                      <span style="color:#10b981; font-weight:600;">${w.speed}</span>
                      <span style="color:#94a3b8; font-size:0.75rem;">${w.lane}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        })
        .catch(err => console.error(err));
    }

    if (feedContainer) {
      fetch('/api/stats')
        .then(r => r.json())
        .then(stats => {
          if (stats.recentDetections) {
            feedContainer.innerHTML = `
              <div style="display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.03); border-radius:6px; font-size:0.78rem;">
                  <span><b>C001</b> • Car (GJ01XX0001)</span>
                  <span style="color:#10b981; font-weight:600;">96% Conf</span>
                  <span style="color:#f43f5e; font-weight:700;">🚨 MATCH</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.03); border-radius:6px; font-size:0.78rem;">
                  <span><b>C002</b> • SUV (RJ14AB5678)</span>
                  <span style="color:#10b981; font-weight:600;">93% Conf</span>
                  <span style="color:#f43f5e; font-weight:700;">🚨 MATCH</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.03); border-radius:6px; font-size:0.78rem;">
                  <span><b>C001</b> • Motorbike (GJ01AB4432)</span>
                  <span style="color:#38bdf8; font-weight:600;">88% Conf</span>
                  <span style="color:#64748b;">Standard</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.03); border-radius:6px; font-size:0.78rem;">
                  <span><b>C005</b> • Bus (GJ18Z7712)</span>
                  <span style="color:#38bdf8; font-weight:600;">95% Conf</span>
                  <span style="color:#64748b;">Standard</span>
                </div>
              </div>
            `;
          }
        })
        .catch(err => console.error(err));
    }
  }
}

window.app = new AppController();
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
