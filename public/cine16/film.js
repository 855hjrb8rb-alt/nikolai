// Motor de película antigua: toma cualquier fuente que se pueda dibujar en un
// canvas (vídeo, imagen, cámara, otro canvas) y la convierte en cine de 16 mm,
// Super 8 o cine mudo: cadencia de fotogramas, color de época, grano, rayas,
// polvo, parpadeo, temblor de la ventanilla, viñeta, halación y perforaciones.

export const ASPECTS = {
  "1.33": { label: "4:3 · 16 mm clásico", r: 4 / 3 },
  "1.37": { label: "1.37 · Academy (noticiero)", r: 1.375 },
  "1.66": { label: "1.66 · Super 16", r: 5 / 3 },
  "1.78": { label: "16:9 · panorámico", r: 16 / 9 },
  "2.39": { label: "2.39 · CinemaScope", r: 2.39 },
};

export const RESOLUTIONS = [
  { h: 240, label: "240p · tele antigua" },
  { h: 480, label: "480p · SD" },
  { h: 720, label: "720p · HD" },
  { h: 1080, label: "1080p · Full HD" },
  { h: 1440, label: "1440p · 2K" },
  { h: 2160, label: "2160p · 4K (escaneo de negativo)" },
];

const BASE = {
  height: 1080, aspect: "1.33", pillarbox: false, fps: 24, speed: 1,
  color: "color", saturation: 1, contrast: 1, brightness: 1, warmth: 0, fade: 0.1,
  grain: 0.35, grainSize: 1.4, scratches: 0.25, dust: 0.3, flicker: 0.25, weave: 0.3,
  vignette: 0.45, blur: 0.25, halation: 0.2, leaks: 0, jumps: 0.1, perfs: "none", leader: false,
  sound: true, projector: 0.15, oldSound: 0.4,
};

export const PRESETS = {
  kodachrome: { name: "16 mm Kodachrome · años 60", ...BASE, saturation: 1.25, contrast: 1.12, warmth: 0.25, fade: 0.05 },
  newsreel: {
    name: "16 mm B/N · noticiero 1945", ...BASE, aspect: "1.37", color: "bw", contrast: 1.35, brightness: 1.02,
    grain: 0.55, scratches: 0.5, dust: 0.55, flicker: 0.45, weave: 0.45, vignette: 0.6, blur: 0.35, jumps: 0.2, oldSound: 0.8,
  },
  highcastle: {
    name: "Cinta de «El Hombre en el Castillo»", ...BASE, aspect: "1.37", color: "bw", contrast: 1.45, brightness: 0.98,
    fade: 0.18, grain: 0.6, grainSize: 1.6, scratches: 0.6, dust: 0.6, flicker: 0.5, weave: 0.5, vignette: 0.7,
    blur: 0.4, halation: 0.3, jumps: 0.25, leader: true, projector: 0.3, oldSound: 0.9,
  },
  super8: {
    name: "Super 8 casero · años 70", ...BASE, fps: 18, aspect: "1.33", saturation: 0.95, contrast: 1.05, warmth: 0.45,
    fade: 0.3, grain: 0.5, grainSize: 2, scratches: 0.15, dust: 0.35, flicker: 0.3, weave: 0.55, vignette: 0.75,
    blur: 0.5, halation: 0.35, leaks: 0.5, jumps: 0.05, perfs: "single", projector: 0.35,
  },
  ektachrome: { name: "Ektachrome desvaído · 1975", ...BASE, saturation: 0.8, contrast: 0.95, warmth: 0.6, fade: 0.4, leaks: 0.25, grain: 0.4 },
  silent: {
    name: "Cine mudo · años 20", ...BASE, fps: 16, speed: 1.25, aspect: "1.33", color: "sepia", contrast: 1.4,
    fade: 0.2, grain: 0.7, grainSize: 1.8, scratches: 0.8, dust: 0.8, flicker: 0.75, weave: 0.7, vignette: 0.85,
    blur: 0.55, halation: 0.25, jumps: 0.35, perfs: "double", sound: false, projector: 0.45, oldSound: 1,
  },
  super16: {
    name: "Super 16 moderno · limpio", ...BASE, aspect: "1.66", saturation: 1.05, warmth: 0.08, fade: 0.06,
    grain: 0.25, grainSize: 1.1, scratches: 0, dust: 0.05, flicker: 0.05, weave: 0.08, vignette: 0.25, blur: 0.1,
    halation: 0.25, jumps: 0, projector: 0, oldSound: 0,
  },
};

const FILTER_OK = (() => {
  try { const c = document.createElement("canvas").getContext("2d"); c.filter = "blur(1px)"; return c.filter === "blur(1px)"; }
  catch { return false; }
})();

/** Ancho y alto finales (siempre pares, como exigen los códecs de vídeo). */
export function outputSize(s) {
  const r = ASPECTS[s.aspect]?.r || 4 / 3;
  const h = s.height;
  const w = s.pillarbox && r < 16 / 9 ? h * 16 / 9 : h * r;
  return { w: Math.round(w / 2) * 2, h: Math.round(h / 2) * 2 };
}

function makeGrainTiles(n = 4, size = 256) {
  const tiles = [];
  for (let k = 0; k < n; k++) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const img = g.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      // Ruido aproximadamente gaussiano centrado en gris medio (neutro en «overlay»).
      const v = 128 + ((Math.random() + Math.random() + Math.random() - 1.5) * 150);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    tiles.push(c);
  }
  return tiles;
}

export class FilmRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.s = { ...PRESETS.kodachrome };
    this.source = null;
    this.grain = makeGrainTiles();
    this.halo = document.createElement("canvas");
    this.haloCtx = this.halo.getContext("2d");
    this.scratchList = [];
    this.lastFilmFrame = -1e9;
    this.frameNo = 0;
    this.weave = { x: 0, y: 0 };
    this.jump = 0;
    this.leaderStart = null;
    this.resize();
  }

  set(settings) {
    this.s = { ...this.s, ...settings };
    this.resize();
    this.lastFilmFrame = -1e9;
  }

  resize() {
    const { w, h } = outputSize(this.s);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.halo.width = Math.max(32, Math.round(w / 8));
    this.halo.height = Math.max(24, Math.round(h / 8));
  }

  /** Fuente: { el, width(), height() }; el puede ser vídeo, imagen o canvas. */
  setSource(src) { this.source = src; this.lastFilmFrame = -1e9; }

  /** Arranca la cuenta atrás de la colilla (8 → 2) en el próximo fotograma. */
  startLeader() { this.leaderStart = performance.now(); }

  /** Dibuja si toca un fotograma nuevo según la cadencia. Devuelve true si dibujó. */
  tick(now = performance.now()) {
    if (now - this.lastFilmFrame < 1000 / this.s.fps - 1) return false;
    this.lastFilmFrame = now;
    this.frameNo++;
    this.draw(now);
    return true;
  }

  imageRect() {
    const { width: W, height: H } = this.canvas;
    const r = ASPECTS[this.s.aspect]?.r || 4 / 3;
    let iw = Math.min(W, H * r), ih = iw / r;
    let ix = (W - iw) / 2, iy = (H - ih) / 2;
    if (this.s.perfs !== "none") {
      const m = iw * (this.s.perfs === "double" ? 0.09 : 0.07);
      const left = m, right = this.s.perfs === "double" ? m : m * 0.25;
      ix += left; iw -= left + right;
      ih = Math.min(ih, H); // la tira ocupa todo el alto
    }
    return { ix, iy, iw, ih };
  }

  draw(now) {
    const { ctx, s } = this;
    const { width: W, height: H } = this.canvas;
    const R = this.imageRect();
    const rnd = Math.random;

    // Temblor de la ventanilla: movimiento suave + sacudidas pequeñas.
    const amp = s.weave * Math.min(R.iw, R.ih) * 0.006;
    this.weave.x = this.weave.x * 0.6 + (rnd() - 0.5) * amp * 1.2;
    this.weave.y = this.weave.y * 0.6 + (rnd() - 0.5) * amp * 2;
    if (this.jump > 0) this.jump *= 0.55;
    if (rnd() < s.jumps * 0.02) this.jump = R.ih * (0.04 + rnd() * 0.08);
    if (this.jump < 0.5) this.jump = 0;

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (s.perfs !== "none") this.drawStrip(R);

    ctx.beginPath();
    ctx.rect(R.ix, R.iy, R.iw, R.ih);
    ctx.clip();
    ctx.translate(this.weave.x, this.weave.y + this.jump);

    const leaderLeft = this.leaderStart == null ? -1 : 7 - (now - this.leaderStart) / 1000;
    if (leaderLeft > 0) {
      this.drawLeader(R, leaderLeft);
    } else {
      this.leaderStart = null;
      this.drawSource(R);
    }
    if (this.jump) { // línea entre fotogramas visible durante el salto
      ctx.fillStyle = "#050403";
      ctx.fillRect(R.ix, R.iy - this.jump, R.iw, this.jump * 0.35);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    this.grade(R);
    this.drawHalation(R);
    this.drawLeaks(R, now);
    this.drawGrain(R);
    this.drawDirt(R);
    this.drawFlickerVignette(R);
    ctx.restore();
  }

  colorFilter(extraBlur = 0) {
    const s = this.s;
    const f = [];
    if (s.color === "bw") f.push("grayscale(1)");
    if (s.color === "sepia") f.push("grayscale(1) sepia(0.85)");
    if (s.color === "color" && s.saturation !== 1) f.push(`saturate(${s.saturation})`);
    if (s.contrast !== 1) f.push(`contrast(${s.contrast})`);
    if (s.brightness !== 1) f.push(`brightness(${s.brightness})`);
    const b = s.blur * Math.max(1, this.canvas.height / 720) * 1.2 + extraBlur;
    if (b > 0.05) f.push(`blur(${b.toFixed(2)}px)`);
    return f.join(" ") || "none";
  }

  drawSource(R) {
    const { ctx } = this;
    const src = this.source;
    if (!src || !src.ready()) {
      ctx.fillStyle = "#1b1712";
      ctx.fillRect(R.ix, R.iy, R.iw, R.ih);
      return;
    }
    const sw = src.width(), sh = src.height();
    const scale = Math.max(R.iw / sw, R.ih / sh) * 1.02; // un poco de margen para el temblor
    const dw = sw * scale, dh = sh * scale;
    if (FILTER_OK) ctx.filter = this.colorFilter();
    ctx.drawImage(src.el, R.ix + (R.iw - dw) / 2, R.iy + (R.ih - dh) / 2, dw, dh);
    ctx.filter = "none";
  }

  // Ajustes de color que funcionan también sin ctx.filter (Safari).
  grade(R) {
    const { ctx, s } = this;
    const fill = (op, color, alpha) => {
      if (alpha <= 0.001) return;
      ctx.globalCompositeOperation = op;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(R.ix, R.iy, R.iw, R.ih);
    };
    if (!FILTER_OK && s.color !== "color") {
      fill("saturation", "#888", 1);
      if (s.color === "sepia") fill("color", "#a8865a", 0.6);
    }
    if (s.warmth > 0) fill("soft-light", "#ff9a3c", s.warmth * 0.5);
    if (s.warmth < 0) fill("soft-light", "#3c8cff", -s.warmth * 0.5);
    if (s.fade > 0) fill("lighten", s.color === "color" ? "#2c2620" : "#2a2a2a", s.fade * 1.6);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  drawHalation(R) {
    const { ctx, s, halo, haloCtx } = this;
    if (s.halation <= 0.01) return;
    haloCtx.filter = FILTER_OK ? "brightness(1.6) contrast(1.8)" : "none";
    haloCtx.drawImage(this.canvas, R.ix, R.iy, R.iw, R.ih, 0, 0, halo.width, halo.height);
    haloCtx.filter = "none";
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = s.halation * 0.45;
    if (FILTER_OK) ctx.filter = s.color === "color" ? "blur(3px) sepia(0.6) saturate(3) hue-rotate(-25deg)" : "blur(3px)";
    ctx.drawImage(halo, R.ix, R.iy, R.iw, R.ih);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  drawLeaks(R, now) {
    const { ctx, s } = this;
    if (s.leaks <= 0.01) return;
    const t = now / 1000;
    const x = R.ix + R.iw * (0.5 + 0.6 * Math.sin(t * 0.37));
    const y = R.iy + R.ih * (0.3 + 0.4 * Math.sin(t * 0.23 + 1));
    const rad = Math.max(R.iw, R.ih) * (0.5 + 0.2 * Math.sin(t * 0.5));
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const a = s.leaks * (0.45 + 0.3 * Math.sin(t * 1.3) ** 2);
    g.addColorStop(0, `rgba(255,120,40,${a})`);
    g.addColorStop(0.4, `rgba(255,60,30,${a * 0.5})`);
    g.addColorStop(1, "rgba(255,40,0,0)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = g;
    ctx.fillRect(R.ix, R.iy, R.iw, R.ih);
    ctx.globalCompositeOperation = "source-over";
  }

  drawGrain(R) {
    const { ctx, s } = this;
    if (s.grain <= 0.01) return;
    const tile = this.grain[this.frameNo % this.grain.length];
    const pat = ctx.createPattern(tile, "repeat");
    const k = s.grainSize * Math.max(1, this.canvas.height / 900);
    pat.setTransform(new DOMMatrix().translate(Math.random() * 256, Math.random() * 256).scale(k, k));
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = Math.min(1, s.grain * 0.85);
    ctx.fillStyle = pat;
    ctx.fillRect(R.ix, R.iy, R.iw, R.ih);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  drawDirt(R) {
    const { ctx, s } = this;
    const rnd = Math.random;
    const unit = R.ih / 720;

    // Rayas verticales: duran varios fotogramas y bailan un poco.
    if (rnd() < s.scratches * 0.12) {
      this.scratchList.push({ x: rnd(), life: 4 + rnd() * 40, w: (0.6 + rnd() * 1.6) * unit, light: rnd() < 0.6, a: 0.25 + rnd() * 0.5 });
    }
    this.scratchList = this.scratchList.filter((sc) => sc.life-- > 0);
    for (const sc of this.scratchList) {
      sc.x += (rnd() - 0.5) * 0.002;
      ctx.strokeStyle = sc.light ? `rgba(235,230,215,${sc.a})` : `rgba(10,8,6,${sc.a})`;
      ctx.lineWidth = sc.w;
      ctx.beginPath();
      const x = R.ix + sc.x * R.iw;
      ctx.moveTo(x, R.iy);
      ctx.lineTo(x + (rnd() - 0.5) * 3 * unit, R.iy + R.ih);
      ctx.stroke();
    }

    // Polvo y pelos: solo un fotograma cada uno.
    const specks = Math.floor(s.dust * 14 * rnd());
    for (let i = 0; i < specks; i++) {
      const light = rnd() < 0.35;
      ctx.fillStyle = light ? "rgba(240,236,225,0.75)" : "rgba(8,6,4,0.8)";
      const r = (0.6 + rnd() ** 3 * 5) * unit;
      ctx.beginPath();
      ctx.ellipse(R.ix + rnd() * R.iw, R.iy + rnd() * R.ih, r, r * (0.5 + rnd()), rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    if (rnd() < s.dust * 0.08) {
      const x = R.ix + rnd() * R.iw, y = R.iy + rnd() * R.ih, L = (30 + rnd() * 90) * unit;
      ctx.strokeStyle = "rgba(10,8,6,0.7)";
      ctx.lineWidth = 1.1 * unit;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + L * (rnd() - 0.5), y + L * rnd(), x + L * (rnd() - 0.5), y + L * rnd(), x + L * (rnd() - 0.5), y + L);
      ctx.stroke();
    }
  }

  drawFlickerVignette(R) {
    const { ctx, s } = this;
    const fl = (Math.random() - 0.5) * s.flicker * 0.22;
    if (Math.abs(fl) > 0.003) {
      ctx.fillStyle = fl > 0 ? `rgba(255,250,235,${fl})` : `rgba(0,0,0,${-fl})`;
      ctx.fillRect(R.ix, R.iy, R.iw, R.ih);
    }
    if (s.vignette > 0.01) {
      const cx = R.ix + R.iw / 2, cy = R.iy + R.ih / 2;
      const g = ctx.createRadialGradient(cx, cy, Math.min(R.iw, R.ih) * 0.3, cx, cy, Math.hypot(R.iw, R.ih) * 0.55);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(0,0,0,${Math.min(0.95, s.vignette)})`);
      ctx.fillStyle = g;
      ctx.fillRect(R.ix, R.iy, R.iw, R.ih);
    }
  }

  // Tira de película con perforaciones a los lados de la imagen.
  drawStrip(R) {
    const { ctx, s } = this;
    const H = this.canvas.height;
    const stripL = R.ix - R.iw * (s.perfs === "double" ? 0.1 : 0.08);
    const stripR = R.ix + R.iw + R.iw * (s.perfs === "double" ? 0.1 : 0.03);
    ctx.fillStyle = "#14100b";
    ctx.fillRect(stripL, 0, stripR - stripL, H);
    const pitch = R.ih / (s.perfs === "double" ? 2 : 1);
    const hw = R.iw * 0.035, hh = pitch * 0.32;
    const off = ((this.jump + this.weave.y) % pitch + pitch) % pitch;
    ctx.fillStyle = "#e9e4d6";
    const holes = (x) => {
      for (let y = -pitch + off; y < H + pitch; y += pitch) {
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y + (pitch - hh) / 2, hw, hh, hw * 0.25) : ctx.rect(x, y + (pitch - hh) / 2, hw, hh);
        ctx.fill();
      }
    };
    holes(stripL + (R.ix - stripL - hw) / 2);
    if (s.perfs === "double") holes(R.ix + R.iw + (stripR - R.ix - R.iw - hw) / 2);
  }

  // Colilla de proyección (cuenta atrás 8…2 con barrido).
  drawLeader(R, left) {
    const { ctx } = this;
    const n = Math.max(2, Math.ceil(left) + 1);
    const frac = 1 - (left % 1);
    const cx = R.ix + R.iw / 2, cy = R.iy + R.ih / 2, rad = Math.hypot(R.iw, R.ih);
    ctx.fillStyle = "#cfc9bb";
    ctx.fillRect(R.ix, R.iy, R.iw, R.ih);
    ctx.fillStyle = "#6f6a60";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1a1714";
    ctx.lineWidth = R.ih * 0.006;
    ctx.beginPath(); ctx.moveTo(R.ix, cy); ctx.lineTo(R.ix + R.iw, cy); ctx.moveTo(cx, R.iy); ctx.lineTo(cx, R.iy + R.ih); ctx.stroke();
    for (const k of [0.36, 0.42]) { ctx.beginPath(); ctx.arc(cx, cy, R.ih * k, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = "#0e0c0a";
    ctx.font = `700 ${Math.round(R.ih * 0.5)}px Georgia, "Times New Roman", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), cx, cy + R.ih * 0.02);
  }
}

/** Envuelve un elemento dibujable en la interfaz de fuente que usa el motor. */
export function wrapSource(el) {
  return {
    el,
    ready: () => (el instanceof HTMLVideoElement ? el.readyState >= 2 && el.videoWidth > 0 : el instanceof HTMLImageElement ? el.complete && el.naturalWidth > 0 : true),
    width: () => el.videoWidth || el.naturalWidth || el.width,
    height: () => el.videoHeight || el.naturalHeight || el.height,
  };
}

/**
 * Bobina generada: cartelas de época con reflectores y texto, para las
 * reconstrucciones del catálogo y la demo. Devuelve un canvas que se anima solo
 * mientras se llama a update(t); dura `duration` segundos.
 */
export function makeReel({ title, subtitle = "", cards = [], seconds = 2.6 }) {
  const c = document.createElement("canvas");
  c.width = 960; c.height = 720;
  const g = c.getContext("2d");
  const scenes = [{ big: title, small: subtitle }, ...cards.map((t) => ({ big: t, small: "" }))];
  const duration = scenes.length * seconds + 1;
  const wrap = (text, max) => {
    const words = text.split(" "), lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (g.measureText(test).width > max && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };
  return {
    el: c, duration,
    ready: () => true, width: () => c.width, height: () => c.height,
    update(t) {
      const W = c.width, H = c.height;
      const i = Math.min(scenes.length - 1, Math.floor(t / seconds));
      const local = t - i * seconds;
      const sc = scenes[i];
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#3a3631"); bg.addColorStop(1, "#0d0c0b");
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      // Reflectores barriendo el cielo
      g.save();
      g.globalCompositeOperation = "lighter";
      for (let k = 0; k < 3; k++) {
        const a = Math.sin(t * 0.6 + k * 2.1) * 0.5 - Math.PI / 2;
        const x0 = W * (0.2 + k * 0.3), y0 = H;
        const grd = g.createLinearGradient(x0, y0, x0 + Math.cos(a) * H, y0 + Math.sin(a) * H);
        grd.addColorStop(0, "rgba(255,255,240,0.22)"); grd.addColorStop(1, "rgba(255,255,240,0)");
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x0 + Math.cos(a - 0.06) * H * 1.4, y0 + Math.sin(a - 0.06) * H * 1.4);
        g.lineTo(x0 + Math.cos(a + 0.06) * H * 1.4, y0 + Math.sin(a + 0.06) * H * 1.4);
        g.fill();
      }
      g.restore();
      // Siluetas de ciudad
      g.fillStyle = "#070706";
      for (let x = 0, k = 0; x < W; k++) {
        const bw = 30 + ((k * 37) % 50), bh = 60 + ((k * 53) % 140);
        g.fillRect(x, H - bh, bw, bh);
        x += bw + 4;
      }
      // Marco art déco y texto
      const fade = Math.min(1, local / 0.4, (seconds - local) / 0.4);
      g.globalAlpha = Math.max(0, fade);
      g.strokeStyle = "#e8e2d2"; g.lineWidth = 4;
      g.strokeRect(70, 110, W - 140, H - 300);
      g.lineWidth = 1.5;
      g.strokeRect(84, 124, W - 168, H - 328);
      g.fillStyle = "#f2ecdc";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.font = `700 ${i === 0 ? 62 : 70}px Georgia, "Times New Roman", serif`;
      const lines = wrap(sc.big.toUpperCase(), W - 220);
      const lh = i === 0 ? 72 : 80;
      const y0 = 110 + (H - 300) / 2 - ((lines.length - 1) * lh) / 2 - (sc.small ? 22 : 0);
      lines.forEach((ln, j) => g.fillText(ln, W / 2, y0 + j * lh));
      if (sc.small) {
        g.font = `italic 30px Georgia, serif`;
        g.fillText(sc.small, W / 2, y0 + lines.length * lh + 6);
      }
      g.globalAlpha = 1;
    },
  };
}
