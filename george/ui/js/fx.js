// Fondos animados. Cada efecto pinta una capa sobre el degradado del estilo.
// La nieve es una capa aparte que se puede encender o apagar en cualquier estilo.

const R = (a = 1, b = 0) => b + Math.random() * (a - b);
const TAU = Math.PI * 2;

function css(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }

const FX = {
  // --- Polvo dorado flotando ---
  dust: {
    init(s, w, h) { s.p = Array.from({ length: 70 }, () => ({ x: R(w), y: R(h), r: R(2.2, 0.4), v: R(0.25, 0.05), a: R(TAU) })); },
    draw(g, s, w, h, t) {
      g.fillStyle = "rgba(255,240,200,.5)";
      for (const p of s.p) {
        p.y -= p.v; p.x += Math.sin(t * 0.4 + p.a) * 0.25;
        if (p.y < -5) { p.y = h + 5; p.x = R(w); }
        g.globalAlpha = 0.25 + 0.35 * Math.sin(t + p.a) ** 2;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
    },
  },
  // --- Mapa antiguo: meridianos, rosa de los vientos y una ruta roja que avanza ---
  map: {
    init(s, w, h) {
      s.route = [];
      let x = w * 0.08, y = h * R(0.75, 0.55);
      while (x < w * 0.95) { s.route.push([x, y]); x += R(140, 60); y = Math.max(h * 0.2, Math.min(h * 0.85, y + R(90, -90))); }
      s.land = Array.from({ length: 5 }, () => ({ x: R(w), y: R(h), r: R(220, 90), n: Array.from({ length: 14 }, () => R(1.25, 0.7)) }));
    },
    draw(g, s, w, h, t) {
      const ink = "rgba(70,40,12,";
      // continentes de tinta
      g.strokeStyle = ink + ".28)"; g.fillStyle = ink + ".07)"; g.lineWidth = 1.5;
      for (const l of s.land) {
        g.beginPath();
        l.n.forEach((k, i) => { const a = (i / l.n.length) * TAU; const x = l.x + Math.cos(a) * l.r * k, y = l.y + Math.sin(a) * l.r * k * 0.7; i ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.closePath(); g.fill(); g.stroke();
      }
      // cuadrícula
      g.strokeStyle = ink + ".13)"; g.lineWidth = 1;
      for (let x = 0; x < w; x += 120) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let y = 0; y < h; y += 120) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      // rosa de los vientos
      const cx = w - 150, cy = h - 170, rr = 78;
      g.save(); g.translate(cx, cy); g.rotate(Math.sin(t * 0.3) * 0.05);
      g.strokeStyle = ink + ".5)"; g.fillStyle = ink + ".35)";
      g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, rr * 0.72, 0, TAU); g.stroke();
      for (let i = 0; i < 8; i++) {
        const len = i % 2 ? rr * 0.55 : rr * 1.05;
        g.rotate(TAU / 8); g.beginPath(); g.moveTo(0, -len); g.lineTo(7, 0); g.lineTo(-7, 0); g.closePath(); i % 2 ? g.stroke() : g.fill();
      }
      g.restore();
      // ruta punteada que avanza, como el viaje en avión de las películas
      const total = s.route.length - 1, prog = (t * 0.12) % (total + 2);
      g.strokeStyle = "rgba(155,30,15,.85)"; g.lineWidth = 3.5; g.setLineDash([10, 9]); g.lineCap = "round";
      g.beginPath();
      let end = s.route[0];
      s.route.forEach(([x, y], i) => {
        if (i === 0) { g.moveTo(x, y); return; }
        if (i <= prog) { g.lineTo(x, y); end = [x, y]; }
        else if (i - 1 < prog) { const [px, py] = s.route[i - 1], k = prog - (i - 1); end = [px + (x - px) * k, py + (y - py) * k]; g.lineTo(...end); }
      });
      g.stroke(); g.setLineDash([]);
      g.fillStyle = "rgba(155,30,15,.9)";
      g.beginPath(); g.arc(end[0], end[1], 6, 0, TAU); g.fill();
      for (const [x, y] of s.route) { g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); }
    },
  },
  // --- Anillos holográficos tipo reactor ---
  hud: {
    draw(g, s, w, h, t) {
      const c = css("--accent") || "#35e0ff";
      const cx = w / 2, cy = h * 0.46, base = Math.min(w, h) * 0.3;
      g.save(); g.translate(cx, cy); g.strokeStyle = c; g.lineCap = "butt";
      const rings = [[1, 2, 0.1, 40, 0.25], [0.88, 10, -0.16, 3, 0.18], [0.74, 1.5, 0.3, 90, 0.35], [0.62, 16, -0.07, 6, 0.1], [1.12, 1, -0.05, 180, 0.2], [1.2, 5, 0.04, 2, 0.12]];
      for (const [k, lw, sp, seg, al] of rings) {
        g.save(); g.rotate(t * sp); g.globalAlpha = al; g.lineWidth = lw;
        const step = TAU / seg;
        for (let i = 0; i < seg; i++) { g.beginPath(); g.arc(0, 0, base * k, i * step, i * step + step * 0.62); g.stroke(); }
        g.restore();
      }
      // núcleo que late
      const pulse = 0.5 + 0.5 * Math.sin(t * 2);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, base * 0.5);
      gr.addColorStop(0, `rgba(180,245,255,${0.22 + pulse * 0.12})`); gr.addColorStop(1, "rgba(53,224,255,0)");
      g.globalAlpha = 1; g.fillStyle = gr; g.beginPath(); g.arc(0, 0, base * 0.5, 0, TAU); g.fill();
      g.restore();
      // lecturas en las esquinas
      g.fillStyle = c; g.globalAlpha = 0.45; g.font = '11px "Menlo",monospace';
      for (let i = 0; i < 7; i++) {
        const v = (Math.sin(t * (0.7 + i * 0.13) + i) * 0.5 + 0.5);
        g.fillRect(28, h - 60 - i * 14, 30 + v * 120, 3);
        g.fillRect(w - 58 - v * 120, 60 + i * 14, 30 + v * 120, 3);
      }
      g.globalAlpha = 1;
    },
  },
  grid: {
    draw(g, s, w, h) {
      g.strokeStyle = "rgba(53,224,255,.06)"; g.lineWidth = 1;
      for (let x = 0; x < w; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let y = 0; y < h; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    },
  },
  // --- Estrellas que titilan ---
  stars: {
    init(s, w, h) { s.p = Array.from({ length: 220 }, () => ({ x: R(w), y: R(h * 0.8), r: R(1.5, 0.3), a: R(TAU), v: R(2, 0.5) })); },
    draw(g, s, w, h, t) {
      g.fillStyle = "#fff";
      for (const p of s.p) { g.globalAlpha = 0.25 + 0.6 * Math.sin(t * p.v + p.a) ** 2; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
    },
  },
  aurora: {
    draw(g, s, w, h, t) {
      for (let i = 0; i < 3; i++) {
        const y0 = h * (0.16 + i * 0.07);
        const gr = g.createLinearGradient(0, y0 - 90, 0, y0 + 150);
        const col = ["80,255,190", "90,170,255", "190,120,255"][i];
        gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(0.4, `rgba(${col},.16)`); gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr; g.beginPath(); g.moveTo(0, y0 + 150);
        for (let x = 0; x <= w; x += 30) g.lineTo(x, y0 - 90 + Math.sin(x * 0.004 + t * 0.25 + i * 2) * 50 + Math.sin(x * 0.011 - t * 0.4) * 18);
        g.lineTo(w, y0 + 150); g.closePath(); g.fill();
      }
    },
  },
  // --- Tren nocturno con ventanas encendidas, colinas nevadas y humo ---
  train: {
    init(s) { s.smoke = []; },
    draw(g, s, w, h, t) {
      // colinas y pinos
      const hill = (yy, amp, col, sp) => {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
        for (let x = 0; x <= w; x += 24) g.lineTo(x, yy + Math.sin((x + t * sp) * 0.004) * amp + Math.sin((x + t * sp) * 0.011) * amp * 0.4);
        g.lineTo(w, h); g.closePath(); g.fill();
      };
      hill(h * 0.7, 34, "#b8c9e6", 6); hill(h * 0.79, 22, "#e6eefb", 14);
      g.fillStyle = "#0f2a3a";
      for (let i = 0; i < 16; i++) {
        const x = ((i * 173 - t * 14) % (w + 200) + w + 200) % (w + 200) - 100, y = h * 0.79 + Math.sin(i * 7) * 12, sz = 34 + (i % 4) * 12;
        for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x, y - sz * (1 - k * 0.22)); g.lineTo(x + sz * (0.2 + k * 0.1), y - sz * (0.55 - k * 0.27)); g.lineTo(x - sz * (0.2 + k * 0.1), y - sz * (0.55 - k * 0.27)); g.closePath(); g.fill(); }
      }
      // tren
      const y = h * 0.8, cars = 6, cw = 150, len = cars * (cw + 10) + 190;
      const x0 = ((t * 60) % (w + len * 2)) - len;
      g.fillStyle = "#07101f"; g.fillRect(0, y + 44, w, 3);
      for (let i = 0; i < cars; i++) {
        const x = x0 + i * (cw + 10);
        g.fillStyle = "#0b1730"; g.fillRect(x, y, cw, 40); g.fillRect(x + 6, y - 6, cw - 12, 8);
        g.fillStyle = "#b3262a"; g.fillRect(x, y + 28, cw, 4);
        for (let k = 0; k < 5; k++) {
          const wx = x + 12 + k * 27;
          g.fillStyle = "rgba(255,214,120,.95)"; g.fillRect(wx, y + 8, 18, 14);
          g.fillStyle = "rgba(255,214,120,.14)"; g.fillRect(wx - 6, y + 44, 30, 22);
        }
      }
      const lx = x0 + cars * (cw + 10);
      g.fillStyle = "#0b1730"; g.fillRect(lx, y + 6, 150, 34); g.fillRect(lx, y - 12, 54, 20); g.fillRect(lx + 104, y - 16, 16, 24);
      g.beginPath(); g.moveTo(lx + 150, y + 40); g.lineTo(lx + 186, y + 40); g.lineTo(lx + 150, y + 16); g.fill();
      g.fillStyle = "rgba(255,214,120,.95)"; g.fillRect(lx + 10, y - 6, 26, 12);
      const beam = g.createLinearGradient(lx + 150, 0, lx + 520, 0);
      beam.addColorStop(0, "rgba(255,236,170,.5)"); beam.addColorStop(1, "rgba(255,236,170,0)");
      g.fillStyle = beam; g.beginPath(); g.moveTo(lx + 150, y + 14); g.lineTo(lx + 520, y - 30); g.lineTo(lx + 520, y + 60); g.closePath(); g.fill();
      // humo
      if (Math.random() < 0.5) s.smoke.push({ x: lx + 112, y: y - 18, r: 8, a: 0.5 });
      for (const p of s.smoke) { p.x -= 1.6; p.y -= 0.9; p.r += 0.35; p.a -= 0.006; g.fillStyle = `rgba(235,240,255,${Math.max(0, p.a)})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill(); }
      s.smoke = s.smoke.filter((p) => p.a > 0);
    },
  },
  // --- Estrellas en perspectiva; al entrar al estilo, salto al hiperespacio ---
  hyperspace: {
    init(s) { s.p = Array.from({ length: 520 }, () => ({ x: R(1, -1), y: R(1, -1), z: R(1, 0.05) })); s.born = performance.now(); },
    draw(g, s, w, h) {
      const age = (performance.now() - s.born) / 1000;
      const speed = age < 1.6 ? 0.045 * (1 - age / 1.6) + 0.0012 : 0.0012;
      const cx = w / 2, cy = h / 2, f = Math.max(w, h) * 0.6;
      g.lineCap = "round";
      for (const p of s.p) {
        const pz = p.z; p.z -= speed;
        if (p.z <= 0.02) { p.x = R(1, -1); p.y = R(1, -1); p.z = 1; continue; }
        const x = cx + (p.x / p.z) * f, y = cy + (p.y / p.z) * f;
        const ox = cx + (p.x / pz) * f, oy = cy + (p.y / pz) * f;
        const a = Math.min(1, (1 - p.z) * 1.4);
        g.strokeStyle = `rgba(${200 + p.x * 55 | 0},${225},255,${a})`; g.lineWidth = Math.max(0.6, (1 - p.z) * 2.4);
        g.beginPath(); g.moveTo(ox, oy); g.lineTo(x + 0.1, y + 0.1); g.stroke();
      }
    },
  },
  planet: {
    draw(g, s, w, h, t) {
      const r = Math.min(w, h) * 0.34, cx = w * 0.84, cy = h * 1.02;
      const gr = g.createRadialGradient(cx - r * 0.4, cy - r * 0.5, r * 0.1, cx, cy, r);
      gr.addColorStop(0, "#f0c78a"); gr.addColorStop(0.5, "#a8683b"); gr.addColorStop(1, "#1c0f12");
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
      g.strokeStyle = "rgba(255,220,170,.35)"; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r + 3, Math.PI * 1.05, Math.PI * 1.7); g.stroke();
      // dos soles lejanos
      for (const [dx, dy, rr, c] of [[0.2, 0.24, 26, "255,214,140"], [0.26, 0.31, 17, "255,150,110"]]) {
        const x = w * dx, y = h * dy + Math.sin(t * 0.2) * 4;
        const sg = g.createRadialGradient(x, y, 0, x, y, rr * 4);
        sg.addColorStop(0, `rgba(${c},1)`); sg.addColorStop(0.25, `rgba(${c},.55)`); sg.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = sg; g.beginPath(); g.arc(x, y, rr * 4, 0, TAU); g.fill();
      }
    },
  },
  // --- Radar y retícula de sala de mapas ---
  radar: {
    init(s) { s.blips = Array.from({ length: 7 }, () => ({ a: R(TAU), d: R(0.95, 0.2) })); },
    draw(g, s, w, h, t) {
      g.strokeStyle = "rgba(232,210,122,.09)"; g.lineWidth = 1;
      for (let x = 0; x < w; x += 80) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let y = 0; y < h; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      const cx = w * 0.82, cy = h * 0.3, r = Math.min(w, h) * 0.2, ang = t * 0.9;
      g.save(); g.translate(cx, cy);
      g.fillStyle = "rgba(14,22,10,.5)"; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.strokeStyle = "rgba(170,230,120,.4)";
      for (let k = 1; k <= 4; k++) { g.beginPath(); g.arc(0, 0, (r * k) / 4, 0, TAU); g.stroke(); }
      g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); g.moveTo(0, -r); g.lineTo(0, r); g.stroke();
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(170,240,120,${0.22 * (1 - i / 40)})`;
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, ang - i * 0.025, ang - (i + 1) * 0.025, true); g.closePath(); g.fill();
      }
      for (const b of s.blips) {
        const diff = ((ang - b.a) % TAU + TAU) % TAU;
        g.fillStyle = `rgba(200,255,150,${Math.max(0, 1 - diff / 4)})`;
        g.beginPath(); g.arc(Math.cos(b.a) * r * b.d, Math.sin(b.a) * r * b.d, 3.5, 0, TAU); g.fill();
      }
      g.restore();
      // flechas de avance sobre el mapa
      g.strokeStyle = "rgba(179,58,43,.5)"; g.lineWidth = 4; g.setLineDash([16, 10]); g.lineDashOffset = -t * 20;
      g.beginPath(); g.moveTo(w * 0.05, h * 0.82); g.quadraticCurveTo(w * 0.3, h * 0.55, w * 0.55, h * 0.7); g.stroke();
      g.setLineDash([]);
    },
  },
  // --- Guirnalda de luces de colores ---
  lights: {
    draw(g, s, w, h, t) {
      const cols = ["255,80,70", "255,200,80", "90,220,120", "90,170,255", "255,120,220"];
      for (let row = 0; row < 2; row++) {
        const n = Math.ceil(w / 70), sag = 46 + row * 20, y0 = row * 34 - 4;
        g.strokeStyle = "rgba(20,40,20,.9)"; g.lineWidth = 2; g.beginPath();
        for (let i = 0; i <= n * 8; i++) { const x = (i / (n * 8)) * w, seg = (x / 280 + row * 0.5) % 1; const y = y0 + Math.sin(seg * Math.PI) * sag; i ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
        for (let i = 0; i < n; i++) {
          const x = (i + 0.5) * (w / n), seg = (x / 280 + row * 0.5) % 1, y = y0 + Math.sin(seg * Math.PI) * sag + 9;
          const c = cols[(i + row * 2) % cols.length], tw = 0.55 + 0.45 * Math.sin(t * 2.2 + i * 1.7 + row);
          const gr = g.createRadialGradient(x, y, 0, x, y, 34);
          gr.addColorStop(0, `rgba(${c},${0.9 * tw})`); gr.addColorStop(0.2, `rgba(${c},${0.4 * tw})`); gr.addColorStop(1, `rgba(${c},0)`);
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, 34, 0, TAU); g.fill();
          g.fillStyle = `rgba(255,255,240,${0.9 * tw})`; g.beginPath(); g.ellipse(x, y, 4, 6, 0, 0, TAU); g.fill();
        }
      }
    },
  },
  // --- Resplandor de chimenea con chispas ---
  hearth: {
    init(s, w, h) { s.p = Array.from({ length: 40 }, () => ({ x: R(w), y: h + R(200), v: R(1.4, 0.4), a: R(TAU) })); },
    draw(g, s, w, h, t) {
      const fl = 0.75 + 0.25 * Math.sin(t * 7) * Math.sin(t * 3.1);
      const gr = g.createRadialGradient(w / 2, h * 1.08, 0, w / 2, h * 1.08, h * 0.75);
      gr.addColorStop(0, `rgba(255,150,50,${0.42 * fl})`); gr.addColorStop(0.5, `rgba(255,90,30,${0.14 * fl})`); gr.addColorStop(1, "rgba(255,90,30,0)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (const p of s.p) {
        p.y -= p.v; p.x += Math.sin(t * 2 + p.a) * 0.6;
        if (p.y < h * 0.45) { p.y = h + 10; p.x = R(w); }
        g.fillStyle = `rgba(255,${170 + Math.sin(p.a) * 50 | 0},80,${Math.max(0, (p.y - h * 0.45) / (h * 0.55))})`;
        g.beginPath(); g.arc(p.x, p.y, 1.6, 0, TAU); g.fill();
      }
    },
  },
  // --- Velas flotantes ---
  candles: {
    init(s, w, h) { s.c = Array.from({ length: 26 }, () => ({ x: R(w), y: R(h * 0.55, h * 0.04), l: R(60, 26), a: R(TAU), z: R(1, 0.45) })); },
    draw(g, s, w, h, t) {
      for (const c of s.c) {
        const y = c.y + Math.sin(t * 0.6 + c.a) * 9, x = c.x + Math.sin(t * 0.3 + c.a * 2) * 5, k = c.z;
        const fl = 0.8 + 0.2 * Math.sin(t * 9 + c.a * 5);
        const gr = g.createRadialGradient(x, y - 8 * k, 0, x, y - 8 * k, 70 * k);
        gr.addColorStop(0, `rgba(255,205,110,${0.5 * fl * k})`); gr.addColorStop(1, "rgba(255,205,110,0)");
        g.fillStyle = gr; g.beginPath(); g.arc(x, y - 8 * k, 70 * k, 0, TAU); g.fill();
        g.fillStyle = `rgba(238,228,200,${0.75 * k})`; g.fillRect(x - 3.5 * k, y, 7 * k, c.l * k);
        g.fillStyle = `rgba(255,230,150,${fl})`; g.beginPath(); g.ellipse(x, y - 7 * k, 3 * k, 8 * k * fl, 0, 0, TAU); g.fill();
      }
    },
  },
  // --- Lluvia de código ---
  coderain: {
    fade: 0.08,
    init(s, w) { s.fs = 18; s.cols = Array.from({ length: Math.ceil(w / s.fs) }, () => R(-60, 0)); s.acc = 0; },
    draw(g, s, w, h, t, dt) {
      s.acc += dt; if (s.acc < 0.05) return; s.acc = 0;
      const chars = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ0123456789ΓΕΩΡΓΕ:.=*+-<>";
      g.font = `${s.fs}px "Menlo",monospace`;
      s.cols.forEach((y, i) => {
        const ch = chars[Math.random() * chars.length | 0];
        g.fillStyle = "#d8ffe2"; g.fillText(ch, i * s.fs, y * s.fs);
        g.fillStyle = "rgba(34,255,106,.85)"; g.fillText(chars[Math.random() * chars.length | 0], i * s.fs, (y - 1) * s.fs);
        s.cols[i] = y * s.fs > h && Math.random() > 0.975 ? 0 : y + 1;
      });
    },
  },
  // --- Sol y retícula synthwave ---
  synthgrid: {
    draw(g, s, w, h, t) {
      const hz = h * 0.7, cx = w / 2, r = Math.min(w, h) * 0.24;
      const sun = g.createLinearGradient(0, hz - r * 1.6, 0, hz);
      sun.addColorStop(0, "#ffe66d"); sun.addColorStop(1, "#ff2b8a");
      g.save(); g.beginPath(); g.rect(0, 0, w, hz); g.clip();
      g.fillStyle = sun; g.beginPath(); g.arc(cx, hz - r * 0.5, r, 0, TAU); g.fill();
      g.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 7; i++) g.fillRect(cx - r, hz - r * 0.5 + i * r * 0.15 + 6, r * 2, 2 + i * 1.6);
      g.restore();
      // edificios
      g.fillStyle = "#12041f";
      for (let i = 0; i < 40; i++) { const bw = w / 40, bh = 30 + ((i * 7919) % 97) * 1.3; g.fillRect(i * bw, hz - bh, bw - 2, bh); }
      g.fillStyle = "#0b0218"; g.fillRect(0, hz, w, h - hz);
      g.strokeStyle = "rgba(255,43,214,.7)"; g.lineWidth = 1.2;
      for (let i = -14; i <= 14; i++) { g.beginPath(); g.moveTo(cx + i * 30, hz); g.lineTo(cx + i * 260, h); g.stroke(); }
      for (let k = 0; k < 14; k++) { const z = ((k + (t * 0.5) % 1) / 14) ** 2.2; const y = hz + z * (h - hz); g.globalAlpha = 0.25 + z * 0.7; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.globalAlpha = 1;
    },
  },
  rain: {
    init(s, w, h) { s.p = Array.from({ length: 160 }, () => ({ x: R(w * 1.2), y: R(h), v: R(22, 12), l: R(22, 9) })); },
    draw(g, s, w, h) {
      g.strokeStyle = "rgba(170,220,255,.28)"; g.lineWidth = 1; g.beginPath();
      for (const p of s.p) { p.y += p.v; p.x -= p.v * 0.18; if (p.y > h) { p.y = -20; p.x = R(w * 1.2); } g.moveTo(p.x, p.y); g.lineTo(p.x - p.l * 0.18, p.y + p.l); }
      g.stroke();
    },
  },
  // --- Hojas de selva en los bordes y niebla ---
  jungle: {
    init(s, w, h) {
      s.leaves = [];
      for (let i = 0; i < 26; i++) {
        const side = i % 2;
        s.leaves.push({ x: side ? w + 30 : -30, y: R(h), len: R(420, 200), ang: (side ? Math.PI : 0) + R(0.8, -0.8), a: R(TAU), c: i % 3 });
      }
    },
    draw(g, s, w, h, t) {
      const mist = g.createLinearGradient(0, h * 0.5, 0, h);
      mist.addColorStop(0, "rgba(200,230,190,0)"); mist.addColorStop(1, "rgba(200,230,190,.13)");
      g.fillStyle = mist; g.fillRect(0, 0, w, h);
      const cols = ["#0a2411", "#103519", "#07190c"];
      for (const l of s.leaves) {
        const sway = Math.sin(t * 0.5 + l.a) * 0.05;
        g.save(); g.translate(l.x, l.y); g.rotate(l.ang + sway); g.fillStyle = cols[l.c];
        // fronda: tallo con foliolos
        for (let k = 0; k < 16; k++) {
          const d = (k / 16) * l.len, sz = (1 - k / 18) * 70;
          for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(d, 0); g.quadraticCurveTo(d + sz * 0.5, sgn * sz * 0.6, d + sz * 1.1, sgn * sz); g.quadraticCurveTo(d + sz * 0.3, sgn * sz * 0.3, d, 0); g.fill(); }
        }
        g.fillRect(0, -2, l.len, 4);
        g.restore();
      }
    },
  },
  fireflies: {
    init(s, w, h) { s.p = Array.from({ length: 34 }, () => ({ x: R(w), y: R(h), a: R(TAU), v: R(1, 0.3) })); },
    draw(g, s, w, h, t) {
      for (const p of s.p) {
        p.x += Math.cos(t * 0.3 * p.v + p.a) * 0.6; p.y += Math.sin(t * 0.4 * p.v + p.a * 2) * 0.5;
        const al = Math.max(0, Math.sin(t * p.v + p.a));
        const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14);
        gr.addColorStop(0, `rgba(255,220,110,${al})`); gr.addColorStop(1, "rgba(255,220,110,0)");
        g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, 14, 0, TAU); g.fill();
      }
    },
  },
};

/** Motor del fondo: pinta los efectos del estilo actual y, si está encendida, la nieve. */
export class Backdrop {
  constructor(canvas, snowCanvas) {
    this.c = canvas; this.g = canvas.getContext("2d");
    this.sc = snowCanvas; this.sg = snowCanvas.getContext("2d");
    this.layers = []; this.snow = false; this.flakes = []; this.pile = 0; this.last = performance.now();
    addEventListener("resize", () => this.resize());
    this.resize();
    requestAnimationFrame((n) => this.frame(n));
  }
  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.w = innerWidth; this.h = innerHeight;
    for (const c of [this.c, this.sc]) { c.width = this.w * dpr; c.height = this.h * dpr; }
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0); this.sg.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.set(this.names || []);
    this.flakes = Array.from({ length: Math.round(this.w / 7) }, () => this.flake(true));
  }
  set(names) {
    this.names = names;
    this.layers = names.filter((n) => FX[n]).map((n) => { const s = {}; FX[n].init?.(s, this.w, this.h); return { fx: FX[n], s }; });
    this.fade = this.layers.find((l) => l.fx.fade)?.fx.fade || 0;
    this.g.clearRect(0, 0, this.w, this.h);
  }
  flake(anywhere) {
    return { x: R(this.w), y: anywhere ? R(this.h) : -10, r: R(3.6, 0.8), v: R(1.5, 0.45), a: R(TAU), w: R(1.2, 0.3) };
  }
  setSnow(on) { this.snow = on; if (!on) this.sg.clearRect(0, 0, this.w, this.h); this.sc.style.opacity = on ? 1 : 0; }
  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const t = now / 1000, g = this.g, { w, h } = this;
    if (!document.hidden) {
      if (this.fade) { g.fillStyle = `rgba(0,0,0,${this.fade})`; g.fillRect(0, 0, w, h); }
      else g.clearRect(0, 0, w, h);
      for (const l of this.layers) { g.save(); l.fx.draw(g, l.s, w, h, t, dt); g.restore(); }
      if (this.snow) this.drawSnow(t);
    }
    requestAnimationFrame((n) => this.frame(n));
  }
  drawSnow(t) {
    const g = this.sg, { w, h } = this;
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#fff";
    const wind = Math.sin(t * 0.2) * 0.6;
    for (const f of this.flakes) {
      f.y += f.v * (0.6 + f.r * 0.25); f.x += Math.sin(t * f.w + f.a) * 0.7 + wind;
      if (f.y > h + 6) Object.assign(f, this.flake(false));
      if (f.x < -6) f.x = w + 5; else if (f.x > w + 6) f.x = -5;
      g.globalAlpha = 0.35 + f.r * 0.17;
      g.beginPath(); g.arc(f.x, f.y, f.r, 0, TAU); g.fill();
    }
    // nieve acumulada abajo
    g.globalAlpha = 0.92; g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 20) g.lineTo(x, h - 14 - Math.sin(x * 0.013) * 7 - Math.sin(x * 0.041 + 2) * 4);
    g.lineTo(w, h); g.closePath(); g.fill(); g.globalAlpha = 1;
  }
}
