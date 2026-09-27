/**
 * WebSocket Real-Time Client for okDriver Platform
 * Synchronizes detection events, camera status changes, and watchlist alerts.
 */

class RealtimeClient {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.audioCtx = null;
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:3000';
    const wsUrl = `${protocol}//${host}/ws`;

    console.log(`[WS] Connecting to ${wsUrl}...`);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[WS] Connected successfully.');
      this.reconnectAttempts = 0;
      document.getElementById('sys-status-text').textContent = 'System Online';
      const dot = document.getElementById('sys-status-dot');
      if (dot) dot.style.background = '#10b981';
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (err) {
        console.error('[WS] Error parsing message:', err);
      }
    };

    this.ws.onclose = () => {
      console.warn('[WS] Disconnected. Reconnecting...');
      document.getElementById('sys-status-text').textContent = 'Reconnecting...';
      const dot = document.getElementById('sys-status-dot');
      if (dot) dot.style.background = '#f59e0b';

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 2000);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[WS] WebSocket error:', err);
    };
  }

  handleMessage(msg) {
    const { event, payload } = msg;

    if (event === 'init_state') {
      window.app.updateStats(payload.stats);
    } else if (event === 'watchlist_alert') {
      this.playAlertSound();
      window.app.handleIncomingAlert(payload);
    } else if (event === 'new_detection') {
      window.app.handleIncomingDetection(payload);
    } else if (event === 'stat_update') {
      window.app.updateStats(payload);
    } else if (event === 'camera_updated' || event === 'camera_added' || event === 'camera_deleted') {
      window.app.refreshCameras();
    }
  }

  playAlertSound() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      // High-priority dual-tone alert beep
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sawtooth';

      osc1.frequency.setValueAtTime(880, this.audioCtx.currentTime); // A5
      osc1.frequency.setValueAtTime(1174, this.audioCtx.currentTime + 0.12); // D6
      osc2.frequency.setValueAtTime(440, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(this.audioCtx.currentTime + 0.35);
      osc2.stop(this.audioCtx.currentTime + 0.35);
    } catch (e) {
      console.log('Audio chime unavailable', e);
    }
  }
}

window.realtimeClient = new RealtimeClient();
