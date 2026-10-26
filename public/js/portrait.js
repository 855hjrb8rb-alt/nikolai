// Retrato realista animado: toma una foto (una cara generada por IA) y le da vida en el
// navegador: respira, mueve un poco la cabeza, parpadea, abre la boca al hablar y se
// sonroja, entrecierra los ojos o llora según su emoción. La piel y los rasgos son los de
// la foto; solo se deforman las zonas de los ojos y la boca.
// Los puntos de la cara los encuentra MediaPipe Face Landmarker una sola vez por foto.

import { loadVision } from "./gestures.js";

const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Índices de la malla de 478 puntos de MediaPipe.
const IDX = {
  eyes: [
    { l: 33, r: 133, up: 159, low: 145, brow: 52 },
    { l: 362, r: 263, up: 386, low: 374, brow: 282 },
  ],
  mouth: { l: 61, r: 291, up: 13, low: 14 },
  chin: 152, top: 10, cheeks: [50, 280],
};

let landmarkerP = null;
function landmarker() {
  landmarkerP ??= (async () => {
    const { FilesetResolver, FaceLandmarker, wasm } = await loadVision();
    const vision = await FilesetResolver.forVisionTasks(wasm);
    const opts = (delegate) => ({ baseOptions: { modelAssetPath: FACE_MODEL, delegate }, runningMode: "IMAGE", numFaces: 1 });
    try { return await FaceLandmarker.createFromOptions(vision, opts("GPU")); }
    catch { return FaceLandmarker.createFromOptions(vision, opts("CPU")); }
  })();
  landmarkerP.catch(() => { landmarkerP = null; });
  return landmarkerP;
}

/** Busca la cara en la imagen. Devuelve los puntos normalizados (0-1) o null. */
export async function detectFace(img) {
  const lm = await landmarker();
  const pts = lm.detect(img).faceLandmarks?.[0];
  if (!pts) return null;
  const p = (i) => ({ x: pts[i].x, y: pts[i].y });
  return {
    eyes: IDX.eyes.map((e) => ({ l: p(e.l), r: p(e.r), up: p(e.up), low: p(e.low), brow: p(e.brow) })),
    mouth: { l: p(IDX.mouth.l), r: p(IDX.mouth.r), up: p(IDX.mouth.up), low: p(IDX.mouth.low) },
    chin: p(IDX.chin), top: p(IDX.top), cheeks: IDX.cheeks.map(p),
  };
}

/** Reduce una foto subida a JPEG de como máximo `max` px (para guardarla en el navegador). */
export async function photoToPortrait(file, max = 900) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const MOOD_LIDS = { annoyed: 0.22, jealous: 0.28, angry: 0.18, sad: 0.2, crying: 0.3, missing: 0.12, loving: 0.1 };

export class Portrait {
  constructor() {
    this.img = null;
    this.face = null;
    this.work = document.createElement("canvas");
    this.layer = document.createElement("canvas");
    this.blinkAt = performance.now() + 1500;
    // Cabeza: mira a distintos lados, ladea e inclina; se mueve suave hacia cada objetivo.
    this.head = { x: 0, y: 0, r: 0, tx: 0, ty: 0, tr: 0, next: 0 };
  }

  get ready() { return Boolean(this.img); }

  /** Carga la foto. Si no se pasa `face`, la detecta (y la devuelve para guardarla). */
  async set(dataUrl, face = null) {
    if (!dataUrl) { this.img = null; this.face = null; return null; }
    const img = await loadImage(dataUrl);
    this.img = img;
    this.work.width = this.layer.width = img.naturalWidth;
    this.work.height = this.layer.height = img.naturalHeight;
    this.face = face || await detectFace(img).catch(() => null);
    return this.face;
  }

  /**
   * Pinta el retrato animado cubriendo el rectángulo (x, y, w, h).
   * st = { mouth: 0-1, mood, intensity, speaking }
   */
  draw(g, x, y, w, h, now, st) {
    const img = this.img;
    if (!img) return;
    const T = now / 1000;
    const W = img.naturalWidth, H = img.naturalHeight;
    const f = this.face && this.#px(this.face, W, H);
    const wg = this.work.getContext("2d");
    wg.globalCompositeOperation = "source-over";
    wg.filter = "none";
    wg.drawImage(img, 0, 0);

    if (f) {
      const k = Math.max(0.3, st.intensity || 0.5);
      // Al llorar, la barbilla tiembla y la boca se entreabre en sollozos.
      const sob = st.mood === "crying" ? Math.max(0, Math.sin(T * 5.5)) * 0.25 * k + Math.random() * 0.04 : 0;
      this.#mouth(wg, f, Math.max(st.mouth || 0, sob));
      const lid = Math.min(1, Math.max(this.#blink(now), (MOOD_LIDS[st.mood] || 0) * k));
      for (const e of f.eyes) this.#lid(wg, e, lid);
      this.#mood(wg, f, st.mood, k, T);
    }

    // Encuadre: cabeza y hombros, centrado en la cara.
    const faceH = f ? f.chin.y - f.top.y : H * 0.4;
    const fx = f ? (f.eyes[0].l.x + f.eyes[1].r.x) / 2 : W / 2;
    const fy = f ? (f.top.y + f.chin.y) / 2 + faceH * 0.15 : H * 0.42;
    let sh = Math.min(H, faceH * 2.5), sw = sh * (w / h);
    if (sw > W) { sw = W; sh = sw * (h / w); }
    const sx = Math.min(W - sw, Math.max(0, fx - sw / 2));
    const sy = Math.min(H - sh, Math.max(0, fy - sh / 2));

    // Movimiento de cabeza: mira a los lados, ladea, asiente al hablar y reacciona a su emoción.
    const hd = this.head;
    if (now > hd.next) {
      const talk = (st.mouth || 0) > 0.05;
      hd.tx = (Math.random() - 0.5) * (talk ? 0.03 : 0.05);
      hd.ty = (Math.random() - 0.5) * 0.02;
      hd.tr = (Math.random() - 0.5) * (talk ? 0.05 : 0.07);
      if (st.mood === "sad" || st.mood === "crying" || st.mood === "missing") { hd.ty += 0.025; hd.tr *= 0.5; }
      if (st.mood === "jealous" || st.mood === "annoyed") { hd.tx = (Math.random() < 0.5 ? -1 : 1) * 0.03; hd.tr = -Math.sign(hd.tx) * 0.05; }
      if (st.mood === "playful" || st.mood === "loving") hd.tr = (Math.random() < 0.5 ? -1 : 1) * 0.06;
      hd.next = now + 1800 + Math.random() * 3500;
    }
    hd.x += (hd.tx - hd.x) * 0.03; hd.y += (hd.ty - hd.y) * 0.03; hd.r += (hd.tr - hd.r) * 0.03;
    const sobbing = st.mood === "crying" ? Math.abs(Math.sin(T * 5.5)) * 0.006 : 0;
    const scale = (w / sw) * (1.04 + Math.sin(T * 1.5) * 0.004);
    const rot = hd.r + Math.sin(T * 0.37) * 0.006;
    const dx = (hd.x + Math.sin(T * 0.5) * 0.005) * faceH;
    const dy = (hd.y + Math.sin(T * 1.5) * 0.004 + sobbing) * faceH - (st.mouth || 0) * faceH * 0.012 * Math.abs(Math.sin(T * 3.1));
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.translate(x + w / 2, y + h / 2);
    g.rotate(rot);
    g.scale(scale, scale);
    if (st.mood === "sad" || st.mood === "crying") g.filter = "saturate(.85) brightness(.96)";
    g.drawImage(this.work, -(sx + sw / 2 - dx), -(sy + sh / 2 - dy));
    g.filter = "none";
    g.restore();
    // Viñeta suave, como luz de cámara frontal.
    const v = g.createRadialGradient(x + w / 2, y + h * 0.45, Math.min(w, h) * 0.35, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.45)");
    g.fillStyle = v; g.fillRect(x, y, w, h);
  }

  #px(face, W, H) {
    const q = (p) => ({ x: p.x * W, y: p.y * H });
    return {
      eyes: face.eyes.map((e) => ({ l: q(e.l), r: q(e.r), up: q(e.up), low: q(e.low), brow: e.brow ? q(e.brow) : null })),
      mouth: { l: q(face.mouth.l), r: q(face.mouth.r), up: q(face.mouth.up), low: q(face.mouth.low) },
      chin: q(face.chin), top: q(face.top), cheeks: face.cheeks.map(q),
    };
  }

  /** Parpadeo natural: cada 2-6 s, a veces doble. Devuelve cuánto está cerrado (0-1). */
  #blink(now) {
    const dur = 170;
    if (now > this.blinkAt + dur) {
      this.blinkAt = now + (Math.random() < 0.15 ? 260 : 2000 + Math.random() * 4000);
    }
    const p = (now - this.blinkAt) / dur;
    return p >= 0 && p <= 1 ? Math.sin(Math.PI * p) : 0;
  }

  /** Mascara difuminada (elipse) aplicada a la capa auxiliar. */
  #feather(lg, cx, cy, rx, ry, solid = 0.55) {
    lg.save();
    lg.globalCompositeOperation = "destination-in";
    lg.translate(cx, cy);
    lg.scale(1, ry / rx);
    const gr = lg.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(solid, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    lg.fillStyle = gr;
    lg.fillRect(-rx, -rx, rx * 2, rx * 2);
    lg.restore();
    // Lo que queda fuera de la elipse se borra del todo.
    lg.save();
    lg.globalCompositeOperation = "destination-in";
    lg.beginPath(); lg.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); lg.fillStyle = "#000"; lg.fill();
    lg.restore();
  }

  #clearLayer() {
    const lg = this.layer.getContext("2d");
    lg.globalCompositeOperation = "source-over";
    lg.clearRect(0, 0, this.layer.width, this.layer.height);
    return lg;
  }

  /** Abre la boca: baja el labio inferior y la barbilla y pinta el interior de la boca. */
  #mouth(wg, f, m) {
    if (!(m > 0.03)) return;
    const { l, r, up, low } = f.mouth;
    const mw = dist(l, r);
    const cx = (l.x + r.x) / 2;
    const tilt = Math.atan2(r.y - l.y, r.x - l.x);
    const d = Math.min(1, m) * mw * 0.13;
    // Solo se pinta el hueco nuevo (entre el labio inferior original y su nueva posición):
    // lo que ya se veía de la boca, como los dientes de una sonrisa, se queda igual.
    const closed = low.y - up.y < mw * 0.04;
    const top = closed ? up.y : low.y - mw * 0.02, bot = low.y + d;
    const my = (top + bot) / 2;
    wg.save();
    wg.filter = `blur(${Math.max(0.6, mw * 0.012)}px)`;
    wg.beginPath();
    wg.ellipse(cx, my, mw * (closed ? 0.36 : 0.3), Math.max(1, (bot - top) / 2), tilt, 0, Math.PI * 2);
    const gr = wg.createRadialGradient(cx, my, 0, cx, my, mw * 0.36);
    gr.addColorStop(0, "#5a2628"); gr.addColorStop(0.6, "#3a1517"); gr.addColorStop(1, "#24090b");
    wg.fillStyle = gr; wg.fill();
    // Lengua: asoma en la parte de abajo cuando la boca se abre bastante.
    if (bot - top > mw * 0.05) {
      wg.save();
      wg.clip();
      const th = (bot - top) * 0.5;
      const tg = wg.createRadialGradient(cx, bot - th * 0.3, 0, cx, bot - th * 0.3, mw * 0.26);
      tg.addColorStop(0, "#c8646b"); tg.addColorStop(0.7, "#a04650"); tg.addColorStop(1, "#6e2730");
      wg.fillStyle = tg;
      wg.beginPath(); wg.ellipse(cx, bot - th * 0.15, mw * 0.24, th, tilt, Math.PI, 0); wg.fill();
      wg.restore();
    }
    wg.filter = "none";
    if (closed) {
      wg.clip();
      wg.fillStyle = "rgba(236,228,220,.45)";
      wg.fillRect(cx - mw * 0.24, top - 1, mw * 0.48, (bot - top) * 0.25);
    }
    wg.restore();
    // Mandíbula: copia de la foto desplazada hacia abajo, fundida con la cara.
    const lg = this.#clearLayer();
    lg.drawImage(this.img, 0, d);
    const jawH = Math.max(f.chin.y - low.y, mw * 0.6);
    this.#feather(lg, cx, low.y + d + jawH * 0.45, mw * 1.05, jawH * 0.95, 0.5);
    lg.save();
    lg.globalCompositeOperation = "destination-in";
    const cut = lg.createLinearGradient(0, low.y + d - 1.5, 0, low.y + d + 2);
    cut.addColorStop(0, "rgba(0,0,0,0)"); cut.addColorStop(1, "rgba(0,0,0,1)");
    lg.fillStyle = cut; lg.fillRect(0, 0, this.layer.width, this.layer.height);
    lg.restore();
    wg.drawImage(this.layer, 0, 0);
  }

  /** Baja el párpado superior estirando la piel que hay sobre el ojo. */
  #lid(wg, e, b) {
    if (!(b > 0.02)) return;
    const ew = dist(e.l, e.r);
    const cx = (e.l.x + e.r.x) / 2;
    const top = e.up.y, bot = e.low.y;
    const eh = Math.max(ew * 0.18, bot - top);
    // Piel del párpado: entre la ceja y el ojo, sin tocar la ceja.
    const gap = e.brow ? Math.max(eh * 0.5, top - e.brow.y) : eh * 1.2;
    const srcTop = top - gap * 0.6, srcH = gap * 0.45;
    const lidY = top + b * (bot - top) * 1.08;
    const lg = this.#clearLayer();
    lg.drawImage(this.img, cx - ew * 0.7, srcTop, ew * 1.4, srcH, cx - ew * 0.7, srcTop, ew * 1.4, lidY - srcTop);
    this.#feather(lg, cx, (srcTop + lidY) / 2 + eh * 0.1, ew * 0.66, (lidY - srcTop) / 2 + eh * 0.35, 0.6);
    wg.drawImage(this.layer, 0, 0);
    // Línea de pestañas en el borde del párpado.
    wg.save();
    wg.strokeStyle = `rgba(28,16,14,${0.75 * b})`;
    wg.lineWidth = Math.max(1, eh * 0.22);
    wg.lineCap = "round";
    wg.beginPath();
    wg.moveTo(e.l.x + ew * 0.04, e.l.y);
    wg.quadraticCurveTo(cx, lidY + eh * 0.15, e.r.x - ew * 0.04, e.r.y);
    wg.stroke();
    wg.restore();
  }

  /** Rubor, enrojecimiento y lágrimas según la emoción. */
  #mood(wg, f, mood, k, T) {
    const faceW = dist(f.eyes[0].l, f.eyes[1].r);
    if (["loving", "playful", "jealous", "excited", "happy"].includes(mood)) {
      wg.save();
      wg.globalCompositeOperation = "multiply";
      for (const c of f.cheeks) {
        const gr = wg.createRadialGradient(c.x, c.y, 0, c.x, c.y, faceW * 0.22);
        gr.addColorStop(0, `rgba(255,150,160,${0.55 * k})`); gr.addColorStop(1, "rgba(255,150,160,0)");
        wg.fillStyle = gr;
        wg.fillRect(c.x - faceW * 0.25, c.y - faceW * 0.25, faceW * 0.5, faceW * 0.5);
      }
      wg.restore();
    }
    if (mood === "angry" || mood === "annoyed") {
      const cx = (f.top.x + f.chin.x) / 2, cy = (f.top.y + f.chin.y) / 2;
      wg.save();
      wg.globalCompositeOperation = "multiply";
      const gr = wg.createRadialGradient(cx, cy, 0, cx, cy, faceW * 0.9);
      gr.addColorStop(0, `rgba(255,205,200,${0.6 * k})`); gr.addColorStop(1, "rgba(255,205,200,0)");
      wg.fillStyle = gr; wg.fillRect(cx - faceW, cy - faceW, faceW * 2, faceW * 2);
      wg.restore();
    }
    if (mood === "crying" || (mood === "sad" && k > 0.6)) {
      for (const e of f.eyes) {
        const ew = dist(e.l, e.r);
        const ex = (e.l.x + e.r.x) / 2, ey = e.low.y + ew * 0.06;
        // Ojos un poco rojos.
        wg.save();
        wg.globalCompositeOperation = "multiply";
        const gr = wg.createRadialGradient(ex, ey, 0, ex, ey, ew * 0.8);
        gr.addColorStop(0, "rgba(255,185,185,.7)"); gr.addColorStop(1, "rgba(255,185,185,0)");
        wg.fillStyle = gr; wg.fillRect(ex - ew, ey - ew, ew * 2, ew * 2);
        wg.restore();
        // Ojos húmedos: un brillo sobre el borde del párpado inferior.
        wg.save();
        wg.globalCompositeOperation = "screen";
        wg.strokeStyle = `rgba(255,255,255,${0.35 + Math.sin(T * 2) * 0.1})`;
        wg.lineWidth = Math.max(1, ew * 0.035);
        wg.beginPath(); wg.moveTo(e.l.x + ew * 0.2, e.low.y - ew * 0.01); wg.quadraticCurveTo(ex, e.low.y + ew * 0.05, e.r.x - ew * 0.2, e.low.y - ew * 0.01); wg.stroke();
        wg.restore();
        // Lágrimas que brillan y bajan por la mejilla.
        const n = mood === "crying" ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const ph = (T * 0.35 + i * 0.5 + (e === f.eyes[0] ? 0 : 0.27)) % 1;
          const tx = ex + ew * (e === f.eyes[0] ? -0.1 : 0.1), ty = ey + ph * ew * 1.6;
          const rr = ew * 0.07;
          wg.save();
          wg.globalAlpha = 1 - ph * 0.8;
          // Rastro húmedo: un brillo tenue que se desvanece hacia arriba.
          const trail = wg.createLinearGradient(0, ey, 0, ty);
          trail.addColorStop(0, "rgba(255,255,255,0)"); trail.addColorStop(1, "rgba(255,255,255,.16)");
          wg.strokeStyle = trail; wg.lineWidth = rr * 1.1; wg.lineCap = "round";
          wg.beginPath(); wg.moveTo(tx, ey); wg.quadraticCurveTo(tx + rr * 0.6, (ey + ty) / 2, tx, ty); wg.stroke();
          // Gota: casi transparente, con sombra abajo y un reflejo pequeño.
          wg.fillStyle = "rgba(0,0,0,.08)";
          wg.beginPath(); wg.ellipse(tx, ty + rr * 0.35, rr * 0.85, rr * 0.9, 0, 0, Math.PI * 2); wg.fill();
          wg.fillStyle = "rgba(235,242,255,.18)";
          wg.beginPath(); wg.ellipse(tx, ty, rr * 0.8, rr, 0, 0, Math.PI * 2); wg.fill();
          wg.fillStyle = "rgba(255,255,255,.7)";
          wg.beginPath(); wg.arc(tx - rr * 0.25, ty - rr * 0.35, rr * 0.22, 0, Math.PI * 2); wg.fill();
          wg.restore();
        }
      }
    }
  }
}
