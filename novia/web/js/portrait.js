// Retrato realista animado: toma una foto (una cara generada por IA) y le da vida en el
// navegador: respira, mueve un poco la cabeza, parpadea, abre la boca al hablar y se
// sonroja, entrecierra los ojos o llora según su emoción. La piel y los rasgos son los de
// la foto; solo se deforman las zonas de los ojos y la boca.
// Los puntos de la cara los encuentra MediaPipe Face Landmarker una sola vez por foto.

// MediaPipe: desde el servidor (node_modules) o, si falla, desde el CDN.
const VISION_LOCAL = "vendor/tasks-vision";
const VISION_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
async function loadVision() {
  for (const base of [VISION_LOCAL, VISION_CDN]) {
    try {
      const url = base.startsWith("http") ? base : new URL(base, document.baseURI).href;
      const mod = await import(`${url}/vision_bundle.mjs`);
      return { ...mod, wasm: `${url}/wasm` };
    } catch { /* probar el siguiente */ }
  }
  throw new Error("No se pudo cargar MediaPipe");
}

const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Índices de la malla de 478 puntos de MediaPipe.
const IDX = {
  eyes: [
    { l: 33, r: 133, up: 159, low: 145, brow: 52 },
    { l: 362, r: 263, up: 386, low: 374, brow: 282 },
  ],
  mouth: { l: 61, r: 291, up: 13, low: 14 },
  chin: 152, top: 10, cheeks: [50, 280], sides: [234, 454],
  // Contorno de cada ojo (para recortar el iris al moverlo) e iris (centro + borde).
  contours: [
    [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7],
    [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382],
  ],
  irises: [[468, 469], [473, 474]],
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
  const irises = pts.length > 473 ? IDX.irises.map(([c, edge]) => ({ c: p(c), edge: p(edge) })) : [];
  return {
    eyes: IDX.eyes.map((e, i) => {
      const contour = IDX.contours[i].map(p);
      const mid = { x: (pts[e.l].x + pts[e.r].x) / 2, y: (pts[e.l].y + pts[e.r].y) / 2 };
      // El iris que cae más cerca de este ojo.
      const iris = irises.slice().sort((a, b) => Math.hypot(a.c.x - mid.x, a.c.y - mid.y) - Math.hypot(b.c.x - mid.x, b.c.y - mid.y))[0] || null;
      return { l: p(e.l), r: p(e.r), up: p(e.up), low: p(e.low), brow: p(e.brow), contour, iris };
    }),
    mouth: { l: p(IDX.mouth.l), r: p(IDX.mouth.r), up: p(IDX.mouth.up), low: p(IDX.mouth.low) },
    chin: p(IDX.chin), top: p(IDX.top), cheeks: IDX.cheeks.map(p), sides: IDX.sides.map(p),
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

/**
 * Amplía la foto (hasta ~1100 px) en pasos suaves y la enfoca (máscara de enfoque),
 * para que a pantalla completa no se vea borrosa ni pixelada.
 */
function enhance(img) {
  const W0 = img.naturalWidth, H0 = img.naturalHeight;
  const k = Math.max(1, Math.min(4, 1100 / Math.max(W0, H0)));
  let src = img, w = W0, h = H0;
  const step = () => {
    const c = document.createElement("canvas");
    w = Math.min(Math.round(W0 * k), w * 2); h = Math.min(Math.round(H0 * k), h * 2);
    c.width = w; c.height = h;
    const cg = c.getContext("2d");
    cg.imageSmoothingQuality = "high";
    cg.drawImage(src, 0, 0, w, h);
    src = c;
  };
  do step(); while (w < Math.round(W0 * k));
  if (k <= 1.05) return src;
  // Máscara de enfoque: original + cantidad × (original − desenfocado).
  const out = src;
  const og = out.getContext("2d", { willReadFrequently: true });
  const blur = document.createElement("canvas");
  blur.width = w; blur.height = h;
  const bg = blur.getContext("2d", { willReadFrequently: true });
  bg.filter = `blur(${(k * 0.5).toFixed(1)}px)`;
  bg.drawImage(out, 0, 0);
  const a = og.getImageData(0, 0, w, h), b = bg.getImageData(0, 0, w, h).data, d = a.data;
  const amt = 0.8;
  for (let i = 0; i < d.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      const diff = d[i + j] - b[i + j];
      if (diff > 2 || diff < -2) d[i + j] = Math.max(0, Math.min(255, d[i + j] + amt * diff));
    }
  }
  og.putImageData(a, 0, 0);
  return out;
}

/** Color del blanco del ojo: promedio de unos píxeles entre la esquina y el iris. */
function scleraColor(base, e) {
  if (!e.iris) return null;
  const g = base.getContext("2d", { willReadFrequently: true });
  let r = 0, gr = 0, b = 0, n = 0;
  for (const corner of [e.l, e.r]) {
    for (const t of [0.35, 0.5]) {
      const px = Math.round(corner.x + (e.iris.c.x - corner.x) * t), py = Math.round(corner.y + (e.iris.c.y - corner.y) * t);
      const d = g.getImageData(px, py, 1, 1).data;
      r += d[0]; gr += d[1]; b += d[2]; n++;
    }
  }
  const lift = (v) => Math.min(255, Math.round((v / n) * 1.12));
  return `rgb(${lift(r)},${lift(gr)},${lift(b)})`;
}

/** Textura de ruido para el grano de cámara. */
function makeGrain() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const im = g.createImageData(256, 256);
  for (let i = 0; i < im.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 110;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
// Forma de la boca para cada letra (español): abierta, ancha (sonrisa), redonda y lengua arriba.
const V = (open, wide = 0, round = 0, tongue = 0) => ({ open, wide, round, tongue });
const VISEMES = {
  a: V(1, 0.15), "á": V(1, 0.15), e: V(0.6, 0.55), "é": V(0.6, 0.55), i: V(0.3, 0.9), "í": V(0.3, 0.9), y: V(0.3, 0.8),
  o: V(0.7, 0, 0.75), "ó": V(0.7, 0, 0.75), u: V(0.3, 0, 1), "ú": V(0.3, 0, 1), "ü": V(0.3, 0, 1), w: V(0.3, 0, 0.9),
  m: V(0), b: V(0), p: V(0), f: V(0.12, 0.25), v: V(0.12, 0.25),
  l: V(0.45, 0.2, 0, 1), t: V(0.3, 0.3, 0, 0.9), d: V(0.35, 0.2, 0, 0.9), n: V(0.35, 0.2, 0, 0.8), r: V(0.4, 0.1, 0, 0.6),
  s: V(0.18, 0.65), z: V(0.18, 0.6), c: V(0.25, 0.5), x: V(0.25, 0.5), "ñ": V(0.35, 0.3, 0, 0.5),
  ch: V(0.25, 0, 0.5), j: V(0.45, 0.2), g: V(0.4, 0.1), k: V(0.4, 0.1), q: V(0.35, 0, 0.3), h: V(0.35),
  _: V(0.35, 0.1), " ": V(0), ",": V(0), ".": V(0),
};
const MOOD_LIDS = { annoyed: 0.22, jealous: 0.28, angry: 0.18, sad: 0.2, crying: 0.3, missing: 0.12, loving: 0.1 };

export class Portrait {
  constructor() {
    this.img = null;
    this.base = null; // la foto ampliada y enfocada: es la que se anima
    this.face = null;
    this.sclera = [];
    this.gaze = { x: 0, y: 0, tx: 0, ty: 0, next: 0 };
    this.grain = makeGrain();
    this.work = document.createElement("canvas");
    this.layer = document.createElement("canvas");
    this.jaw = document.createElement("canvas");
    // Forma actual de la boca (se acerca suave a la del sonido que está diciendo).
    this.shape = { open: 0, wide: 0, round: 0, tongue: 0 };
    this.brow = { v: 0, pulse: 0, next: 0 };
    this.blinkAt = performance.now() + 1500;
    // Cabeza: mira a distintos lados, ladea e inclina; se mueve suave hacia cada objetivo.
    this.head = { x: 0, y: 0, r: 0, tx: 0, ty: 0, tr: 0, next: 0 };
  }

  get ready() { return Boolean(this.img); }

  /** Carga la foto. Si no se pasa `face`, la detecta (y la devuelve para guardarla). */
  async set(dataUrl, face = null) {
    if (!dataUrl) { this.img = null; this.base = null; this.face = null; return null; }
    const img = await loadImage(dataUrl);
    const base = enhance(img);
    this.work.width = this.layer.width = this.jaw.width = base.width;
    this.work.height = this.layer.height = this.jaw.height = base.height;
    this.face = face || await detectFace(img).catch(() => null);
    this.base = base;
    this.img = img;
    // Versión diminuta para el fondo (al ampliarla queda muy difuminada).
    this.bg = document.createElement("canvas");
    this.bg.width = 24; this.bg.height = Math.max(1, Math.round(24 * base.height / base.width));
    this.bg.getContext("2d").drawImage(base, 0, 0, this.bg.width, this.bg.height);
    this.sclera = this.face ? this.#px(this.face, base.width, base.height).eyes.map((e) => scleraColor(base, e)) : [];
    return this.face;
  }

  /**
   * Pinta el retrato animado cubriendo el rectángulo (x, y, w, h).
   * st = { mouth: 0-1, mood, intensity, speaking }
   */
  draw(g, x, y, w, h, now, st) {
    const img = this.base;
    if (!img) return;
    const T = now / 1000;
    const W = img.width, H = img.height;
    const f = this.face && this.#px(this.face, W, H);
    const wg = this.work.getContext("2d");
    wg.globalCompositeOperation = "source-over";
    wg.filter = "none";
    wg.drawImage(img, 0, 0);
    if (f?.sides) this.#hair(wg, f, T);

    if (f) {
      const k = Math.max(0.3, st.intensity || 0.5);
      // Al llorar, la barbilla tiembla y la boca se entreabre en sollozos.
      const sob = st.mood === "crying" ? Math.max(0, Math.sin(T * 5.5)) * 0.25 * k + Math.random() * 0.04 : 0;
      const sh = this.#shape(st, sob);
      this.#lips(wg, f, sh);
      this.#mouth(wg, f, sh);
      this.#brows(wg, f, this.#browLift(now, st));
      this.#look(wg, f, now, st);
      // Al sonreír (i, e o de buenas) los ojos se entrecierran un poco, como en una sonrisa de verdad.
      const smileEyes = sh.wide * 0.16;
      const lid = Math.min(1, Math.max(this.#blink(now), (MOOD_LIDS[st.mood] || 0) * k, smileEyes));
      for (const e of f.eyes) this.#lid(wg, e, lid);
      this.#mood(wg, f, st.mood, k, T);
    }

    // Encuadre: cabeza y hombros, centrado en la cara.
    const faceH = f ? f.chin.y - f.top.y : H * 0.4;
    const fx = f ? (f.eyes[0].l.x + f.eyes[1].r.x) / 2 : W / 2;
    const fy = f ? (f.top.y + f.chin.y) / 2 + faceH * 0.15 : H * 0.42;
    // La cara entera (frente, barbilla, mejillas y algo de pelo) cabe siempre, en pantallas
    // horizontales y verticales (celular).
    const faceW = f ? dist(f.eyes[0].l, f.eyes[1].r) * 2.3 : W * 0.6;
    const fit = Math.min(h / Math.min(H, faceH * 2.1), w / Math.min(W, faceW * 1.3)); // px de pantalla por px de foto
    const vw = w / fit, vh = h / fit; // lo que se ve de la foto
    const cxs = W <= vw ? W / 2 : Math.min(W - vw / 2, Math.max(vw / 2, fx));
    const cys = H <= vh ? H / 2 : Math.min(H - vh / 2, Math.max(vh / 2, fy));
    const narrow = W * fit < w || H * fit < h; // la foto no llena la pantalla: fondo con ella misma difuminada

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
    const scale = fit * (1.04 + Math.sin(T * 1.5) * 0.004);
    const rot = hd.r + Math.sin(T * 0.37) * 0.006;
    const dx = (hd.x + Math.sin(T * 0.5) * 0.005) * faceH;
    const dy = (hd.y + Math.sin(T * 1.5) * 0.004 + sobbing) * faceH - (this.shape.open * 0.022 + (st.char ? Math.abs(Math.sin(T * 3.1)) * 0.008 : 0)) * faceH;
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    if (narrow && this.bg) {
      const k = Math.max(w / this.bg.width, h / this.bg.height);
      g.filter = "brightness(.55) saturate(.9)";
      g.drawImage(this.bg, x + (w - this.bg.width * k) / 2, y + (h - this.bg.height * k) / 2, this.bg.width * k, this.bg.height * k);
      g.filter = "none";
    }
    g.imageSmoothingQuality = "high";
    g.translate(x + w / 2, y + h / 2);
    g.rotate(rot);
    g.scale(scale, scale);
    if (st.mood === "sad" || st.mood === "crying") g.filter = "saturate(.85) brightness(.96)";
    g.drawImage(this.work, -(cxs - dx), -(cys - dy));
    g.filter = "none";
    g.restore();
    // Bordes de la foto fundidos con el fondo (sin corte recto a los lados).
    if (narrow) {
      const pw = W * scale, left = x + w / 2 - pw / 2 + dx * scale, fw = Math.min(90, pw * 0.12);
      for (const [x0, x1] of [[left, left + fw], [left + pw, left + pw - fw]]) {
        const eg = g.createLinearGradient(x0, 0, x1, 0);
        eg.addColorStop(0, "rgba(10,8,10,.75)"); eg.addColorStop(1, "rgba(10,8,10,0)");
        g.fillStyle = eg;
        g.fillRect(Math.min(x0, x1) - 2, y, fw + 4, h);
      }
    }
    // Grano fino de cámara (cambia en cada cuadro, como un video real) y viñeta suave.
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.globalAlpha = 0.07;
    g.globalCompositeOperation = "overlay";
    g.fillStyle = g.createPattern(this.grain, "repeat");
    g.translate((Math.random() * 256) | 0, (Math.random() * 256) | 0);
    g.fillRect(x - 256, y - 256, w + 256, h + 256);
    g.restore();
    const v = g.createRadialGradient(x + w / 2, y + h * 0.45, Math.min(w, h) * 0.4, x + w / 2, y + h / 2, Math.max(w, h) * 0.8);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.3)");
    g.fillStyle = v; g.fillRect(x, y, w, h);
  }

  #px(face, W, H) {
    const q = (p) => ({ x: p.x * W, y: p.y * H });
    return {
      eyes: face.eyes.map((e) => ({
        l: q(e.l), r: q(e.r), up: q(e.up), low: q(e.low), brow: e.brow ? q(e.brow) : null,
        contour: e.contour ? e.contour.map(q) : null,
        iris: e.iris ? { c: q(e.iris.c), rad: Math.hypot((e.iris.edge.x - e.iris.c.x) * W, (e.iris.edge.y - e.iris.c.y) * H) } : null,
      })),
      mouth: { l: q(face.mouth.l), r: q(face.mouth.r), up: q(face.mouth.up), low: q(face.mouth.low) },
      chin: q(face.chin), top: q(face.top), cheeks: face.cheeks.map(q), sides: face.sides ? face.sides.map(q) : null,
    };
  }

  /**
   * Cabello: se mece suave (más en las puntas que en la raíz) y se queda un poco atrás cuando
   * ella mueve la cabeza. La cara y el cuello no se mueven.
   */
  #hair(wg, f, T) {
    const W = this.work.width, H = this.work.height;
    const [sl, sr] = f.sides;
    const faceW = dist(sl, sr), faceH = f.chin.y - f.top.y;
    const root = f.top.y - faceH * 0.15;
    const lag = (this.head.tx - this.head.x) * faceH * 0.35; // las puntas siguen a la cabeza con retraso
    const A = faceW * 0.012;
    const lg = this.#clearLayer();
    const step = Math.max(2, Math.round(H / 300));
    for (let y = Math.max(0, Math.floor(root)); y < H; y += step) {
      const k = Math.min(1, Math.max(0, (y - root) / (H - root))) ** 1.3;
      const dx = k * (A * (Math.sin(T * 1.1 + y * 0.018) + 0.5 * Math.sin(T * 2.3 + y * 0.041)) + lag);
      lg.drawImage(this.base, 0, y, W, step, dx, y, W, step);
    }
    // Se quita la cara y el cuello (con borde suave): solo se mueve el pelo y lo de alrededor.
    lg.save();
    lg.globalCompositeOperation = "destination-out";
    const cx = (sl.x + sr.x) / 2, cy = (f.top.y + f.chin.y) / 2 + faceH * 0.04;
    for (const [ex, ey, rx, ry] of [[cx, cy, faceW * 0.56, faceH * 0.6], [cx, f.chin.y + faceH * 0.45, faceW * 0.38, faceH * 0.55]]) {
      lg.save();
      lg.translate(ex, ey); lg.scale(1, ry / rx);
      const gr = lg.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.8, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      lg.fillStyle = gr; lg.fillRect(-rx, -rx, rx * 2, rx * 2);
      lg.restore();
    }
    lg.restore();
    wg.drawImage(this.layer, 0, 0);
  }

  /** Forma de la boca: la del sonido que está diciendo (si se sabe) o según el volumen. */
  #shape(st, sob) {
    let t = { open: 0, wide: 0, round: 0, tongue: 0 };
    if (st.char != null) {
      t = { ...(VISEMES[st.char.toLowerCase()] || (/[\p{L}]/u.test(st.char) ? VISEMES._ : VISEMES[" "])) };
      if (st.mouth > 0.02) t.open *= 0.6 + Math.min(1, st.mouth) * 0.6; // voz premium: el volumen real manda
    } else if (st.mouth > 0.02) {
      t.open = Math.min(1, st.mouth);
    }
    if (st.mood === "happy" || st.mood === "playful" || st.mood === "excited") t.wide = Math.max(t.wide, 0.35);
    t.open = Math.max(t.open, sob);
    const s = this.shape;
    for (const k of Object.keys(s)) {
      const a = t[k] > s[k] ? 0.55 : 0.35; // abre rápido y cierra un poco más lento
      s[k] += (t[k] - s[k]) * a;
    }
    return s;
  }

  /** Cejas: según la emoción, y suben de golpe al exclamar o preguntar, o para enfatizar. */
  #browLift(now, st) {
    const b = this.brow;
    const moodLift = { excited: 0.45, happy: 0.25, playful: 0.3, loving: 0.15, worried: 0.35, sad: 0.25, crying: 0.3, missing: 0.2, angry: -0.45, annoyed: -0.3, jealous: -0.25 }[st.mood] || 0;
    if (st.char && "!¡?¿".includes(st.char)) b.pulse = Math.max(b.pulse, 0.7);
    if (st.char && now > b.next) {
      if (Math.random() < 0.55) b.pulse = Math.max(b.pulse, 0.4 + Math.random() * 0.35);
      b.next = now + 600 + Math.random() * 1200;
    }
    b.pulse *= 0.94;
    b.v += (moodLift * (st.intensity || 0.5) * 1.4 + b.pulse - b.v) * 0.25;
    return b.v;
  }

  /**
   * Mirada: los ojos hacen pequeños saltos rápidos (como una persona real), miran a la
   * cámara casi siempre que habla y compensan cuando la cabeza gira.
   */
  #look(wg, f, now, st) {
    const gz = this.gaze;
    if (now > gz.next) {
      const talk = (st.mouth || 0) > 0.05;
      const away = talk ? Math.random() < 0.2 : Math.random() < 0.6;
      gz.tx = away ? (Math.random() - 0.5) * 0.7 : (Math.random() - 0.5) * 0.08;
      gz.ty = away ? (Math.random() - 0.5) * 0.25 : 0;
      if (st.mood === "sad" || st.mood === "crying") gz.ty = 0.2;
      if (st.mood === "jealous" || st.mood === "annoyed") gz.tx = -Math.sign(this.head.x || 1) * 0.25;
      gz.next = now + (away ? 500 + Math.random() * 1200 : 1200 + Math.random() * 2600);
    }
    gz.x += (gz.tx - gz.x) * 0.45; gz.y += (gz.ty - gz.y) * 0.45; // sacada: rápida
    const hx = Math.max(-0.15, Math.min(0.15, -this.head.x * 4)); // si gira la cabeza, los ojos siguen mirándote
    f.eyes.forEach((e, i) => {
      if (!e.iris || !e.contour || !this.sclera[i]) return;
      const r = e.iris.rad;
      const ox = Math.max(-0.35, Math.min(0.35, gz.x + hx)) * r, oy = Math.max(-0.12, Math.min(0.15, gz.y * 0.6)) * r;
      if (Math.abs(ox) < 0.3 && Math.abs(oy) < 0.3) return;
      const { c } = e.iris;
      wg.save();
      wg.beginPath();
      e.contour.forEach((p, k) => (k ? wg.lineTo(p.x, p.y) : wg.moveTo(p.x, p.y)));
      wg.closePath();
      wg.clip();
      // Tapa el iris original con el blanco del ojo, con borde difuminado
      // (y más oscuro arriba, por la sombra del párpado).
      const sg = wg.createRadialGradient(c.x, c.y, 0, c.x, c.y, r * 1.25);
      sg.addColorStop(0, this.sclera[i]); sg.addColorStop(0.82, this.sclera[i]); sg.addColorStop(1, "rgba(0,0,0,0)");
      wg.fillStyle = sg;
      wg.fillRect(c.x - r * 1.3, c.y - r * 1.3, r * 2.6, r * 2.6);
      const shd = wg.createLinearGradient(0, c.y - r, 0, c.y + r * 0.4);
      shd.addColorStop(0, "rgba(40,25,20,.35)"); shd.addColorStop(1, "rgba(40,25,20,0)");
      wg.fillStyle = shd;
      wg.fillRect(c.x - r * 1.5, c.y - r * 1.2, r * 3, r * 1.6);
      // El iris en su nueva posición, con el borde fundido.
      const lg = this.#clearLayer();
      lg.drawImage(this.base, ox, oy);
      this.#feather(lg, c.x + ox, c.y + oy, r * 1.08, r * 1.08, 0.82);
      wg.drawImage(this.layer, 0, 0);
      wg.restore();
    });
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

  /**
   * Forma de los labios en cada sonido: ancho (i, e, s), redondo (o, u), cerrado (m, b, p)
   * y la lengua (l, t, d, n). Estira o junta la zona de la boca alrededor de su centro.
   */
  #lips(wg, f, sh) {
    const sx = 1 + 0.1 * sh.wide - 0.2 * sh.round, sy = 1 + 0.1 * sh.round - 0.03 * sh.wide;
    if (Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;
    const { l, r, up, low } = f.mouth;
    const mw = dist(l, r);
    const cx = (l.x + r.x) / 2, cy = (up.y + low.y) / 2;
    const lg = this.#clearLayer();
    lg.save();
    lg.translate(cx, cy); lg.scale(sx, sy); lg.translate(-cx, -cy);
    lg.drawImage(this.work, 0, 0);
    lg.restore();
    this.#feather(lg, cx, cy, mw * 0.85, mw * 0.42, 0.55);
    wg.drawImage(this.layer, 0, 0);
  }

  /**
   * Abre la boca: baja el labio inferior y la barbilla en curva (mucho en el centro, nada en
   * las comisuras), y pinta el interior: dientes, lengua y sombra.
   */
  #mouth(wg, f, sh) {
    const m = sh.open;
    if (!(m > 0.03)) return;
    const { l, r, up, low } = f.mouth;
    const mw0 = dist(l, r);
    const mw = mw0 * (1 + 0.1 * sh.wide - 0.2 * sh.round);
    const cx = (l.x + r.x) / 2;
    const d = Math.min(1, m) * mw0 * 0.26;
    const half = mw * 0.5;
    const drop = (x) => { const u = (x - cx) / half; return Math.abs(u) >= 1 ? 0 : d * Math.cos(u * Math.PI / 2) ** 2; };
    const closed = low.y - up.y < mw0 * 0.04;
    const top = closed ? up.y : low.y - mw0 * 0.02; // borde de arriba del hueco
    if (d < 1.2) return;
    const c = mw0 * 0.012; // se copia desde justo debajo del pliegue de los labios
    const jawH = Math.max(f.chin.y - low.y, mw0 * 0.6) * 1.25;
    const x0 = Math.floor(cx - half), x1 = Math.ceil(cx + half), step = Math.max(1, Math.round(mw0 / 90));

    // 1) Mandíbula: tiras verticales de la cara, cada una bajada según su curva.
    const jg = this.jaw.getContext("2d");
    jg.globalCompositeOperation = "source-over";
    jg.clearRect(0, 0, this.jaw.width, this.jaw.height);
    for (let x = x0; x < x1; x += step) {
      const dy = drop(x + step / 2);
      if (dy < 0.3) continue;
      jg.drawImage(this.work, x, low.y + c, step, jawH, x, low.y + c + dy, step, jawH);
    }
    // Abajo se funde con la barbilla original.
    jg.save();
    jg.globalCompositeOperation = "destination-in";
    const fade = jg.createLinearGradient(0, low.y + c + jawH * 0.55, 0, low.y + c + jawH);
    fade.addColorStop(0, "rgba(0,0,0,1)"); fade.addColorStop(1, "rgba(0,0,0,0)");
    jg.fillStyle = fade; jg.fillRect(0, 0, this.jaw.width, this.jaw.height);
    jg.restore();

    // 2) Interior de la boca, con la misma curva.
    const path = new Path2D();
    path.moveTo(x0, low.y);
    // En las comisuras no se abre nada; en el centro, todo.
    for (let x = x0; x <= x1; x += step) { const dy = drop(x); path.lineTo(x, low.y + (c + 1) * (dy / d) + dy); }
    for (let x = x1; x >= x0; x -= step) { const dy = drop(x); path.lineTo(x, top + (low.y - top) * (1 - dy / d)); }
    path.closePath();
    const bot = low.y + c + d, gap = bot - top;
    const rx = half * 0.8;
    wg.save();
    wg.clip(path);
    // Fondo: garganta oscura al centro, más rojiza hacia los lados.
    const gr = wg.createRadialGradient(cx, top + gap * 0.55, 0, cx, top + gap * 0.55, half);
    gr.addColorStop(0, "#1e0507"); gr.addColorStop(0.5, "#3d1216"); gr.addColorStop(1, "#5c2328");
    wg.fillStyle = gr;
    wg.fillRect(x0, top - 2, x1 - x0, gap + 4);
    // Lengua: abajo y relajada, o con la punta arriba (detrás de los dientes) en l, t, d, n.
    if (gap > mw0 * 0.03) {
      const tipUp = sh.tongue;
      const tw = rx * (0.82 - 0.22 * tipUp);
      const ty = bot - gap * (0.32 + 0.38 * tipUp);
      const tg = wg.createRadialGradient(cx, ty + gap * 0.1, 0, cx, ty + gap * 0.1, tw * 1.1);
      tg.addColorStop(0, "#e2818a"); tg.addColorStop(0.6, "#c25f6a"); tg.addColorStop(1, "#7d2d38");
      wg.fillStyle = tg;
      wg.beginPath();
      wg.moveTo(cx - tw, bot + 4);
      wg.bezierCurveTo(cx - tw, ty, cx - tw * 0.45, ty - gap * 0.08, cx, ty - gap * 0.08);
      wg.bezierCurveTo(cx + tw * 0.45, ty - gap * 0.08, cx + tw, ty, cx + tw, bot + 4);
      wg.closePath();
      wg.fill();
      // Surco del centro y brillo húmedo.
      wg.strokeStyle = "rgba(120,35,45,.35)"; wg.lineWidth = Math.max(1, mw0 * 0.008);
      wg.beginPath(); wg.moveTo(cx, ty + gap * 0.05); wg.lineTo(cx, bot); wg.stroke();
      wg.fillStyle = "rgba(255,225,230,.22)";
      wg.beginPath(); wg.ellipse(cx - tw * 0.3, ty + gap * 0.08, tw * 0.25, gap * 0.06, -0.2, 0, Math.PI * 2); wg.fill();
    }
    // Dientes de abajo: asoman un poco por el borde del labio inferior.
    const teeth = (yEdge, ry, down, alpha) => {
      const tt = wg.createLinearGradient(0, yEdge, 0, yEdge + (down ? ry : -ry));
      tt.addColorStop(0, `rgba(246,242,235,${alpha})`); tt.addColorStop(0.75, `rgba(232,225,214,${alpha * 0.9})`); tt.addColorStop(1, `rgba(200,190,180,${alpha * 0.5})`);
      wg.fillStyle = tt;
      wg.beginPath(); wg.ellipse(cx, yEdge, rx * (down ? 0.82 : 0.66), ry, 0, down ? 0 : Math.PI, down ? Math.PI : 0); wg.fill();
      // Separación entre dientes (los de en medio, más anchos).
      wg.strokeStyle = `rgba(150,128,118,${0.35 * alpha})`; wg.lineWidth = Math.max(0.6, mw0 * 0.006);
      for (const k of [0, 0.24, -0.24, 0.45, -0.45, 0.63, -0.63]) {
        const x = cx + k * rx * (down ? 0.82 : 0.66);
        const len = ry * Math.sqrt(Math.max(0, 1 - (k / 0.85) ** 2)) * 0.95;
        wg.beginPath(); wg.moveTo(x, yEdge); wg.lineTo(x, yEdge + (down ? len : -len)); wg.stroke();
      }
    };
    if (gap > mw0 * 0.05) teeth(bot + 1, Math.min(gap * 0.16, mw0 * 0.05), false, 0.85);
    // Dientes de arriba (si en la foto tenía la boca cerrada; si no, ya se ven en la foto).
    if (closed) teeth(top - 1, Math.min(gap * 0.36, mw0 * 0.1), true, 0.97);
    // Sombra suave del labio de arriba.
    const shd = wg.createLinearGradient(0, top, 0, top + gap * 0.18);
    shd.addColorStop(0, "rgba(40,12,14,.35)"); shd.addColorStop(1, "rgba(40,12,14,0)");
    wg.fillStyle = shd; wg.fillRect(x0, top - 1, x1 - x0, gap * 0.18);
    wg.restore();
    wg.drawImage(this.jaw, 0, 0);
  }

  /**
   * Sube (o baja, si es negativo) las cejas: `lift` en proporción a la altura del ojo.
   * Estira solo la piel que hay sobre el ojo (anclada justo encima del párpado), así el ojo no se mueve.
   */
  #brows(wg, f, lift) {
    lift = Math.max(-0.6, Math.min(0.8, lift));
    if (Math.abs(lift) < 0.03) return;
    for (const e of f.eyes) {
      if (!e.brow) continue;
      const ew = dist(e.l, e.r);
      const cx = (e.l.x + e.r.x) / 2;
      const eh = Math.max(ew * 0.18, e.low.y - e.up.y);
      const anchor = e.up.y - eh * 0.25;
      const span = Math.max(eh, anchor - e.brow.y);
      const k = 1 + (lift * eh * 0.6) / span; // la ceja se mueve lift·0.6 alturas de ojo
      const lg = this.#clearLayer();
      lg.save();
      lg.translate(0, anchor); lg.scale(1, k); lg.translate(0, -anchor);
      lg.drawImage(this.work, 0, 0);
      lg.restore();
      this.#feather(lg, cx, anchor - span * 0.6, ew * 1.0, span * 1.5, 0.5);
      // Nada por debajo del ancla: el ojo queda intacto.
      lg.save();
      lg.globalCompositeOperation = "destination-in";
      const cut = lg.createLinearGradient(0, anchor - eh * 0.35, 0, anchor);
      cut.addColorStop(0, "rgba(0,0,0,1)"); cut.addColorStop(1, "rgba(0,0,0,0)");
      lg.fillStyle = cut; lg.fillRect(0, 0, this.layer.width, this.layer.height);
      lg.restore();
      wg.drawImage(this.layer, 0, 0);
    }
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
    lg.drawImage(this.base, cx - ew * 0.7, srcTop, ew * 1.4, srcH, cx - ew * 0.7, srcTop, ew * 1.4, lidY - srcTop);
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
      gr.addColorStop(0, `rgba(255,190,185,${(mood === "angry" ? 0.7 : 0.5) * k})`); gr.addColorStop(1, "rgba(255,190,185,0)");
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
        const n = mood === "crying" ? 4 : 1;
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
