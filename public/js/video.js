/**
 * Realistic Canvas CCTV Video Simulation & AI Analytics Overlay Engine
 * Renders animated traffic, pedestrians, and dynamic AI bounding boxes.
 */
class VideoSimulationEngine {
  constructor() {
    this.canvases = {};
    this.animationFrames = {};
    this.state = {
      C001: {
        vehicles: [
          { x: 30, y: 110, speed: 1.8, color: '#f8fafc', type: 'Car', plate: 'GJ01XX0001', match: true },
          { x: 180, y: 70, speed: 2.2, color: '#38bdf8', type: 'Car', plate: 'GJ01AB4432', match: false },
          { x: 80, y: 145, speed: 1.2, color: '#fbbf24', type: 'Auto', plate: 'GJ01TT5514', match: false },
          { x: 260, y: 120, speed: 2.5, color: '#ef4444', type: 'Bike', plate: 'GJ05K8899', match: false }
        ]
      },
      C002: {
        checkpointProgress: 0,
        vehicles: [
          { x: 50, y: 100, speed: 1.5, color: '#ffffff', type: 'Sedan', plate: 'GJ01XX0001', match: true },
          { x: 200, y: 130, speed: 2.0, color: '#94a3b8', type: 'SUV', plate: 'RJ14AB5678', match: true }
        ]
      },
      C003: {
        pedestrians: [
          { x: 60, y: 120, speed: 0.6, dir: 1, label: 'Person 84%', loitering: true },
          { x: 190, y: 130, speed: 0.8, dir: -1, label: 'Person 91%', loitering: false },
          { x: 120, y: 95, speed: 0.5, dir: 1, label: 'Person 88%', loitering: false }
        ]
      },
      C004: {
        offline: true,
        reconnectSeconds: 15
      }
    };
  }

  initFeed(canvasId, cameraId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.canvases[cameraId] = canvas;
    const ctx = canvas.getContext('2d');

    // Resize canvas to match internal resolution
    canvas.width = 480;
    canvas.height = 270;

    const render = () => {
      this.drawFeed(ctx, cameraId, canvas.width, canvas.height);
      this.animationFrames[cameraId] = requestAnimationFrame(render);
    };

    if (this.animationFrames[cameraId]) {
      cancelAnimationFrame(this.animationFrames[cameraId]);
    }
    render();
  }

  drawFeed(ctx, camId, w, h) {
    ctx.clearRect(0, 0, w, h);

    if (camId === 'C001') {
      this.drawTrafficJunction(ctx, w, h);
    } else if (camId === 'C002') {
      this.drawRTOCheckpoint(ctx, w, h);
    } else if (camId === 'C003') {
      this.drawCityCenter(ctx, w, h);
    } else if (camId === 'C004') {
      this.drawHighway(ctx, w, h);
    } else {
      this.drawGenericFeed(ctx, camId, w, h);
    }
  }

  // C001 - Traffic Junction Ahmedabad
  drawTrafficJunction(ctx, w, h) {
    // Road asphalt
    ctx.fillStyle = '#1e2433';
    ctx.fillRect(0, 0, w, h);

    // Intersection layout
    ctx.fillStyle = '#2b344a';
    ctx.fillRect(40, 50, w - 80, h - 80);

    // Zebra crossing lines
    ctx.fillStyle = '#e2e8f0';
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(50 + i * 22, 52, 14, 6);
      ctx.fillRect(50 + i * 22, h - 58, 14, 6);
    }

    // Lane dashes
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 50);
    ctx.lineTo(w / 2, h - 50);
    ctx.stroke();
    ctx.setLineDash([]);

    // Vehicles
    const st = this.state.C001;
    st.vehicles.forEach(v => {
      v.x += v.speed;
      if (v.x > w + 40) v.x = -40;

      // Draw vehicle body
      ctx.fillStyle = v.color;
      ctx.fillRect(v.x, v.y, 44, 22);

      // Windows
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(v.x + 8, v.y + 3, 26, 16);

      // AI Bounding Box
      const boxColor = v.match ? '#ef4444' : '#10b981';
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(v.x - 4, v.y - 6, 52, 34);

      // Tag Label
      ctx.fillStyle = boxColor;
      ctx.fillRect(v.x - 4, v.y - 20, 68, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px monospace';
      ctx.fillText(v.plate, v.x - 2, v.y - 10);
    });

    // Surveillance timestamp and watermark
    this.drawCCTVMeta(ctx, 'C001 • SG JCT AHMEDABAD', w, h);
  }

  // C002 - RTO Checkpoint
  drawRTOCheckpoint(ctx, w, h) {
    // Toll checkpoint background
    ctx.fillStyle = '#182030';
    ctx.fillRect(0, 0, w, h);

    // Toll booths
    ctx.fillStyle = '#334155';
    ctx.fillRect(110, 40, 24, 70);
    ctx.fillRect(250, 40, 24, 70);
    ctx.fillRect(390, 40, 24, 70);

    // Boom barrier
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(134, 80);
    ctx.lineTo(210, 80);
    ctx.stroke();

    // Vehicles passing
    const st = this.state.C002;
    st.vehicles.forEach(v => {
      v.x += v.speed;
      if (v.x > w + 40) v.x = -60;

      // Car
      ctx.fillStyle = v.color;
      ctx.fillRect(v.x, v.y, 50, 26);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(v.x + 10, v.y + 4, 30, 18);

      // ANPR Bounding Box
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(v.x - 5, v.y - 8, 60, 42);

      // Pulsing match badge
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(v.x - 5, v.y - 22, 105, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px monospace';
      ctx.fillText(`WATCHLIST: ${v.plate}`, v.x - 2, v.y - 12);
    });

    this.drawCCTVMeta(ctx, 'C002 • RTO SUBHASH BRIDGE', w, h);
  }

  // C003 - City Center (Degraded signal)
  drawCityCenter(ctx, w, h) {
    ctx.fillStyle = '#161d2d';
    ctx.fillRect(0, 0, w, h);

    // Storefront walkway
    ctx.fillStyle = '#222f46';
    ctx.fillRect(0, 80, w, h - 80);

    // Pillars
    ctx.fillStyle = '#3a4b68';
    for (let p = 40; p < w; p += 120) {
      ctx.fillRect(p, 20, 20, 160);
    }

    // Pedestrians
    const st = this.state.C003;
    st.pedestrians.forEach(p => {
      p.x += p.speed * p.dir;
      if (p.x > w - 30 || p.x < 20) p.dir *= -1;

      // Person silhouette
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 16, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(p.x - 4, p.y - 11, 8, 16);

      // AI Detection box
      ctx.strokeStyle = p.loitering ? '#f59e0b' : '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(p.x - 10, p.y - 25, 20, 34);

      // Label
      ctx.fillStyle = p.loitering ? '#f59e0b' : '#38bdf8';
      ctx.fillRect(p.x - 10, p.y - 36, 55, 11);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 7px monospace';
      ctx.fillText(p.label, p.x - 8, p.y - 28);
    });

    // Subtle Degraded TV Scanlines / Noise
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let line = 0; line < h; line += 4) {
      ctx.fillRect(0, line, w, 1);
    }

    this.drawCCTVMeta(ctx, 'C003 • CG RD (BITRATE LOW: 450kbps)', w, h);
  }

  // C004 - Highway (Offline simulator or online when toggled)
  drawHighway(ctx, w, h) {
    if (this.state.C004.offline) {
      // Disconnected state
      ctx.fillStyle = '#080d18';
      ctx.fillRect(0, 0, w, h);

      // Static noise effect
      const imgData = ctx.createImageData(w, h);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const noise = Math.random() * 40;
        imgData.data[i] = noise;
        imgData.data[i + 1] = noise;
        imgData.data[i + 2] = noise + 10;
        imgData.data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);

      // Warning text in center
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NO RTSP SIGNAL • RECONNECTING...', w / 2, h / 2 - 10);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px sans-serif';
      ctx.fillText('Source: rtsp://expressway.nhai.gov.in/c004', w / 2, h / 2 + 10);
      ctx.textAlign = 'left';
    } else {
      // Highway traffic
      ctx.fillStyle = '#1a2233';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#243048';
      ctx.fillRect(0, 60, w, 150);

      // Highway dashes
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([12, 12]);
      ctx.beginPath();
      ctx.moveTo(0, 110);
      ctx.lineTo(w, 110);
      ctx.moveTo(0, 160);
      ctx.lineTo(w, 160);
      ctx.stroke();
      ctx.setLineDash([]);

      this.drawCCTVMeta(ctx, 'C004 • RING RD EXPY KM 14', w, h);
    }
  }

  drawGenericFeed(ctx, camId, w, h) {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#374151';
    ctx.fillRect(40, 40, w - 80, h - 80);
    this.drawCCTVMeta(ctx, `${camId} • SURVEILLANCE FEED`, w, h);
  }

  drawCCTVMeta(ctx, title, w, h) {
    // Watermark Top Left
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(6, 6, 210, 18);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`CAM: ${title}`, 10, 18);

    // Live clock top right
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0').slice(0, 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(w - 110, 6, 104, 18);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '9px monospace';
    ctx.fillText(timeStr, w - 104, 18);
  }

  toggleCameraOnline(camId) {
    if (this.state[camId]) {
      this.state[camId].offline = !this.state[camId].offline;
    }
  }
}

// Global instance
window.videoEngine = new VideoSimulationEngine();
