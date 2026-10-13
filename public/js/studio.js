// Estudio de fotos y videos: subes una foto o un video, pides lo que quieras
// («ponla en blanco y negro y escribe Feliz cumpleaños», «hazlo en cámara lenta»…)
// y la IA lo convierte en operaciones que se aplican aquí mismo, en el navegador.
// Para cambios que crean cosas nuevas (fondo, estilo Pixar, quitar objetos) se puede
// usar una IA generativa de imágenes con la clave de OpenAI del usuario.

const MAX_PHOTO = 2048;
const MAX_VIDEO = 1280;
const MAX_VIDEO_SECONDS = 120;
const POS = ["top", "center", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"];

export const studio = {
  kind: null, // "photo" | "video"
  name: "",
  bitmap: null, // foto (ImageBitmap o canvas)
  video: null, // <video> fuera del DOM
  videoUrl: "",
  duration: 0,
  ops: [],
  undo: [],
  reply: "",
  busy: false,
  genBusy: false,
  exporting: 0, // progreso 0-1 al crear el video
  playing: false,
};

const clampN = (v, a, b, d) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d);

/** Suma las operaciones: las de ajuste se reemplazan por la última; texto y stickers se acumulan. */
function mergeOps(list, add) {
  let out = [...list];
  for (const o of add) {
    if (!o || !o.op) continue;
    if (o.op === "reset") { out = []; continue; }
    if (o.op === "rotate") {
      const prev = out.find((x) => x.op === "rotate");
      const v = (((prev?.value || 0) + (Number(o.value) || 90)) % 360 + 360) % 360;
      out = out.filter((x) => x.op !== "rotate");
      if (v) out.push({ ...o, value: v });
      continue;
    }
    if (o.op === "flip_h" || o.op === "flip_v") {
      const had = out.some((x) => x.op === o.op);
      out = out.filter((x) => x.op !== o.op);
      if (!had) out.push(o);
      continue;
    }
    if (o.op === "text" || o.op === "sticker") { out.push(o); continue; }
    out = out.filter((x) => x.op !== o.op);
    out.push(o);
  }
  return out;
}
const opsOf = (name) => studio.ops.filter((o) => o.op === name);
const one = (ops, name) => ops.find((o) => o.op === name);

// =====================================================================
// Motor de render (sirve para la foto y para cada fotograma del video)
// =====================================================================
function geometry(srcW, srcH, ops, maxSide) {
  let sx = 0, sy = 0, sw = srcW, sh = srcH;
  const crop = one(ops, "crop");
  if (crop && /^\d+:\d+$/.test(crop.text)) {
    const [a, b] = crop.text.split(":").map(Number);
    const target = a / b;
    if (sw / sh > target) { const nw = sh * target; sx += (sw - nw) / 2; sw = nw; }
    else { const nh = sw / target; sy += (sh - nh) / 2; sh = nh; }
  }
  const zoom = clampN(one(ops, "zoom")?.value, 1, 4, 1);
  if (zoom > 1) { const nw = sw / zoom, nh = sh / zoom; sx += (sw - nw) / 2; sy += (sh - nh) / 2; sw = nw; sh = nh; }
  const rot = one(ops, "rotate")?.value || 0;
  const turned = rot === 90 || rot === 270;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  let ow = Math.round(sw * scale), oh = Math.round(sh * scale);
  ow -= ow % 2; oh -= oh % 2; // los códecs de video piden medidas pares
  return { sx, sy, sw, sh, rot, cw: turned ? oh : ow, ch: turned ? ow : oh, ow, oh };
}

function cssFilter(ops) {
  const f = [];
  const v = (n, a, b, d) => clampN(one(ops, n)?.value, a, b, d);
  if (one(ops, "brightness")) f.push(`brightness(${v("brightness", 0, 4, 1)})`);
  if (one(ops, "contrast")) f.push(`contrast(${v("contrast", 0, 4, 1)})`);
  if (one(ops, "saturate")) f.push(`saturate(${v("saturate", 0, 4, 1)})`);
  if (one(ops, "hue")) f.push(`hue-rotate(${v("hue", -360, 360, 0)}deg)`);
  if (one(ops, "grayscale")) f.push(`grayscale(${v("grayscale", 0, 1, 1)})`);
  if (one(ops, "sepia")) f.push(`sepia(${v("sepia", 0, 1, 1)})`);
  if (one(ops, "invert")) f.push(`invert(${v("invert", 0, 1, 1)})`);
  if (one(ops, "blur")) f.push(`blur(${v("blur", 0, 30, 0)}px)`);
  return f.join(" ") || "none";
}

/** Pinta `src` con las operaciones en `canvas`. heavy = permite efectos píxel a píxel (solo fotos). */
export function renderMedia(canvas, src, srcW, srcH, ops, { heavy = true, maxSide = MAX_PHOTO } = {}) {
  const G = geometry(srcW, srcH, ops, maxSide);
  if (canvas.width !== G.cw || canvas.height !== G.ch) { canvas.width = G.cw; canvas.height = G.ch; }
  const g = canvas.getContext("2d", { willReadFrequently: heavy });
  g.save();
  g.clearRect(0, 0, G.cw, G.ch);
  g.filter = cssFilter(ops);
  g.translate(G.cw / 2, G.ch / 2);
  g.rotate((G.rot * Math.PI) / 180);
  g.scale(one(ops, "flip_h") ? -1 : 1, one(ops, "flip_v") ? -1 : 1);
  const pix = one(ops, "pixelate");
  if (pix) {
    // Pixelado: dibuja muy pequeño y lo agranda sin suavizar.
    const block = clampN(pix.value, 2, 60, 10);
    const tw = Math.max(1, Math.round(G.ow / block)), th = Math.max(1, Math.round(G.oh / block));
    const tmp = pixelCanvas(tw, th);
    const tg = tmp.getContext("2d");
    tg.filter = g.filter;
    tg.drawImage(src, G.sx, G.sy, G.sw, G.sh, 0, 0, tw, th);
    g.filter = "none";
    g.imageSmoothingEnabled = false;
    g.drawImage(tmp, 0, 0, tw, th, -G.ow / 2, -G.oh / 2, G.ow, G.oh);
    g.imageSmoothingEnabled = true;
  } else {
    g.drawImage(src, G.sx, G.sy, G.sw, G.sh, -G.ow / 2, -G.oh / 2, G.ow, G.oh);
  }
  g.restore();

  if (heavy) {
    if (one(ops, "cartoon")) cartoon(g, G.cw, G.ch);
    else if (one(ops, "sketch")) sketch(g, G.cw, G.ch);
    else if (one(ops, "posterize")) posterize(g, G.cw, G.ch, clampN(one(ops, "posterize").value, 2, 12, 4));
  }
  const warm = clampN(one(ops, "warm")?.value, -1, 1, 0);
  if (warm) {
    g.save();
    g.globalCompositeOperation = "soft-light";
    g.fillStyle = warm > 0 ? `rgba(255,140,40,${Math.abs(warm) * 0.55})` : `rgba(40,120,255,${Math.abs(warm) * 0.55})`;
    g.fillRect(0, 0, G.cw, G.ch);
    g.restore();
  }
  const grain = clampN(one(ops, "grain")?.value, 0, 1, 0);
  if (grain) {
    g.save();
    g.globalAlpha = grain * 0.35;
    g.globalCompositeOperation = "overlay";
    g.drawImage(noise(), 0, 0, G.cw, G.ch);
    g.restore();
  }
  const vig = clampN(one(ops, "vignette")?.value, 0, 1, 0);
  if (vig) {
    const r = Math.hypot(G.cw, G.ch) / 2;
    const grd = g.createRadialGradient(G.cw / 2, G.ch / 2, r * 0.35, G.cw / 2, G.ch / 2, r);
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, `rgba(0,0,0,${0.85 * vig})`);
    g.fillStyle = grd;
    g.fillRect(0, 0, G.cw, G.ch);
  }
  const border = one(ops, "border");
  if (border) {
    const bw = clampN(border.value, 1, Math.min(G.cw, G.ch) / 4, 12);
    g.save();
    g.strokeStyle = safeColor(border.color, "#ffffff");
    g.lineWidth = bw * 2;
    g.strokeRect(0, 0, G.cw, G.ch);
    g.restore();
  }
  for (const o of ops.filter((x) => (x.op === "text" || x.op === "sticker") && x.text)) drawLabel(g, G.cw, G.ch, o);
  return G;
}

let pix = null;
function pixelCanvas(w, h) {
  if (!pix) pix = document.createElement("canvas");
  pix.width = w; pix.height = h;
  return pix;
}
let noiseCanvas = null;
function noise() {
  if (noiseCanvas) return noiseCanvas;
  noiseCanvas = document.createElement("canvas");
  noiseCanvas.width = noiseCanvas.height = 256;
  const g = noiseCanvas.getContext("2d");
  const d = g.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  return noiseCanvas;
}
function safeColor(c, fallback) {
  const s = new Option().style;
  s.color = String(c || "");
  return s.color ? c : fallback;
}

function drawLabel(g, W, H, o) {
  const size = clampN(o.value, 0.5, 6, 2);
  const fs = Math.round(Math.min(W, H) * (o.op === "sticker" ? 0.09 : 0.05) * size);
  const pos = POS.includes(o.position) ? o.position : "bottom";
  const pad = Math.round(Math.min(W, H) * 0.05);
  g.save();
  g.font = `${o.op === "sticker" ? "" : "800 "}${fs}px "Archivo", "Arial Black", system-ui, sans-serif`;
  g.textAlign = pos.endsWith("left") ? "left" : pos.endsWith("right") ? "right" : "center";
  g.textBaseline = pos.startsWith("top") ? "top" : pos.startsWith("bottom") ? "bottom" : "middle";
  const x = g.textAlign === "left" ? pad : g.textAlign === "right" ? W - pad : W / 2;
  let y = g.textBaseline === "top" ? pad : g.textBaseline === "bottom" ? H - pad : H / 2;
  // Parte el texto en líneas que quepan.
  const words = String(o.text).slice(0, 200).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (g.measureText(test).width > W - pad * 2 && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  const lh = fs * 1.15;
  if (g.textBaseline === "bottom") y -= (lines.length - 1) * lh;
  else if (g.textBaseline === "middle") y -= ((lines.length - 1) * lh) / 2;
  g.lineJoin = "round";
  g.lineWidth = Math.max(2, fs * 0.12);
  g.strokeStyle = "rgba(0,0,0,.75)";
  g.fillStyle = safeColor(o.color, "#ffffff");
  g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = fs * 0.2;
  lines.forEach((l, i) => {
    if (o.op !== "sticker") g.strokeText(l, x, y + i * lh);
    g.fillText(l, x, y + i * lh);
  });
  g.restore();
}

// ---------- Efectos píxel a píxel (fotos) ----------
function posterize(g, W, H, levels) {
  const img = g.getImageData(0, 0, W, H), d = img.data, step = 255 / (levels - 1);
  for (let i = 0; i < d.length; i += 4) { d[i] = Math.round(d[i] / step) * step; d[i + 1] = Math.round(d[i + 1] / step) * step; d[i + 2] = Math.round(d[i + 2] / step) * step; }
  g.putImageData(img, 0, 0);
}
function luminance(d, W, H) {
  const L = new Float32Array(W * H);
  for (let i = 0, j = 0; j < L.length; i += 4, j++) L[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return L;
}
function sobel(L, W, H) {
  const E = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    const gx = -L[i - W - 1] - 2 * L[i - 1] - L[i + W - 1] + L[i - W + 1] + 2 * L[i + 1] + L[i + W + 1];
    const gy = -L[i - W - 1] - 2 * L[i - W] - L[i - W + 1] + L[i + W - 1] + 2 * L[i + W] + L[i + W + 1];
    E[i] = Math.hypot(gx, gy);
  }
  return E;
}
function sketch(g, W, H) {
  const img = g.getImageData(0, 0, W, H), d = img.data;
  const E = sobel(luminance(d, W, H), W, H);
  for (let j = 0, i = 0; j < E.length; j++, i += 4) {
    const v = 255 - Math.min(255, E[j] * 0.9);
    d[i] = d[i + 1] = d[i + 2] = v * 0.97 + 6;
  }
  g.putImageData(img, 0, 0);
}
function cartoon(g, W, H) {
  // Suaviza, reduce colores y marca bordes en negro, como un cómic.
  const tmp = document.createElement("canvas");
  tmp.width = W; tmp.height = H;
  const tg = tmp.getContext("2d", { willReadFrequently: true });
  tg.filter = "blur(2px) saturate(1.5) contrast(1.1)";
  tg.drawImage(g.canvas, 0, 0);
  const soft = tg.getImageData(0, 0, W, H), d = soft.data;
  const E = sobel(luminance(g.getImageData(0, 0, W, H).data, W, H), W, H);
  const step = 255 / 5;
  for (let j = 0, i = 0; j < E.length; j++, i += 4) {
    if (E[j] > 140) { d[i] = d[i + 1] = d[i + 2] = 20; continue; }
    d[i] = Math.round(d[i] / step) * step; d[i + 1] = Math.round(d[i + 1] / step) * step; d[i + 2] = Math.round(d[i + 2] / step) * step;
  }
  g.putImageData(soft, 0, 0);
}

// =====================================================================
// Carga de archivos
// =====================================================================
export async function loadFile(file) {
  clearMedia();
  studio.name = (file.name || "nikolai").replace(/\.[^.]+$/, "");
  if (file.type.startsWith("video/")) {
    const v = document.createElement("video");
    v.playsInline = true; v.muted = true; v.preload = "auto"; v.loop = true;
    v.crossOrigin = "anonymous";
    studio.videoUrl = URL.createObjectURL(file);
    v.src = studio.videoUrl;
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error("video")); });
    studio.video = v;
    studio.duration = v.duration || 0;
    studio.kind = "video";
  } else {
    studio.bitmap = await createImageBitmap(file);
    studio.kind = "photo";
  }
  studio.ops = []; studio.undo = []; studio.reply = "";
}
export function clearMedia() {
  studio.video?.pause();
  if (studio.videoUrl) URL.revokeObjectURL(studio.videoUrl);
  studio.bitmap?.close?.();
  Object.assign(studio, { kind: null, bitmap: null, video: null, videoUrl: "", duration: 0, playing: false });
}
const srcSize = () => (studio.kind === "video" ? [studio.video.videoWidth, studio.video.videoHeight] : [studio.bitmap.width, studio.bitmap.height]);
const source = () => (studio.kind === "video" ? studio.video : studio.bitmap);

/** JPEG base64 (sin efectos) para mandar a la IA. */
function jpeg(src, w, h, max = 768) {
  const s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * s); c.height = Math.round(h * s);
  c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82).split(",")[1];
}
async function seek(v, t) {
  await new Promise((res) => { v.onseeked = res; v.currentTime = Math.min(Math.max(0, t), Math.max(0, v.duration - 0.05)); setTimeout(res, 1500); });
}
/** Imágenes para la IA: la foto, o 3 fotogramas del video. */
async function framesForAI() {
  const [w, h] = srcSize();
  if (studio.kind === "photo") return [{ media_type: "image/jpeg", data: jpeg(studio.bitmap, w, h) }];
  const v = studio.video, was = v.currentTime, out = [];
  v.pause();
  for (const f of [0.1, 0.5, 0.9]) { await seek(v, studio.duration * f); out.push({ media_type: "image/jpeg", data: jpeg(v, w, h, 640) }); }
  await seek(v, was);
  if (studio.playing) v.play().catch(() => {});
  return out;
}

// =====================================================================
// Exportar
// =====================================================================
function photoBlob() {
  const c = document.createElement("canvas");
  const [w, h] = srcSize();
  renderMedia(c, studio.bitmap, w, h, studio.ops, { heavy: true, maxSide: MAX_PHOTO });
  return new Promise((res) => c.toBlob(res, "image/jpeg", 0.92));
}

const recorderType = () => ["video/mp4;codecs=avc1", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || "";

/** Graba el video con los efectos aplicados (en tiempo real). */
async function videoBlob(onProgress) {
  const v = studio.video, ops = studio.ops;
  const [w, h] = srcSize();
  const start = clampN(one(ops, "trim_start")?.value, 0, studio.duration, 0);
  const end = clampN(one(ops, "trim_end")?.value, start + 0.2, studio.duration, studio.duration);
  if (end - start > MAX_VIDEO_SECONDS) throw new Error("long");
  const speed = clampN(one(ops, "speed")?.value, 0.25, 4, 1);
  const mute = Boolean(one(ops, "mute"));
  const c = document.createElement("canvas");
  renderMedia(c, v, w, h, ops, { heavy: false, maxSide: MAX_VIDEO });
  const stream = c.captureStream(30);
  // Audio del video (a la velocidad elegida, sin cambiar el tono).
  let dest = null;
  if (!mute) {
    try {
      // Un <video> solo admite una fuente de audio: se crea una vez y se reutiliza.
      if (!v._actx) {
        v._actx = new AudioContext();
        v._src = v._actx.createMediaElementSource(v);
        v._src.connect(v._actx.destination);
      }
      await v._actx.resume();
      dest = v._actx.createMediaStreamDestination();
      v._src.connect(dest);
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    } catch { dest = null; }
  }
  const type = recorderType();
  const rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 5_000_000 } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  v.pause();
  v.loop = false;
  v.muted = mute;
  v.playbackRate = speed;
  v.preservesPitch = true;
  await seek(v, start);
  rec.start(250);
  await v.play();
  await new Promise((res) => {
    const step = () => {
      renderMedia(c, v, w, h, ops, { heavy: false, maxSide: MAX_VIDEO });
      onProgress?.((v.currentTime - start) / (end - start));
      if (v.currentTime >= end || v.ended) return res();
      (v.requestVideoFrameCallback ? v.requestVideoFrameCallback.bind(v) : requestAnimationFrame)(step);
    };
    step();
  });
  v.pause();
  await new Promise((res) => { rec.onstop = res; rec.stop(); });
  if (dest) try { v._src.disconnect(dest); } catch { /* ya desconectado */ }
  v.loop = true; v.muted = true; v.playbackRate = 1;
  return new Blob(chunks, { type: (type || "video/webm").split(";")[0] });
}

function save(blob, ext) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${studio.name || "nikolai"}-nikolai.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// =====================================================================
// IA generativa (opcional, con la clave de OpenAI del usuario)
// =====================================================================
const OPENAI_KEY = "nikolai.openaiKey";
const getOpenAI = () => { try { return JSON.parse(localStorage.getItem(OPENAI_KEY)) || ""; } catch { return ""; } };

async function generative(prompt) {
  const key = getOpenAI();
  if (!key) throw Object.assign(new Error("nokey"), { code: "nokey" });
  const blob = await photoBlob();
  const [w, h] = srcSize();
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("image", new File([blob], "foto.jpg", { type: "image/jpeg" }));
  form.append("prompt", prompt);
  form.append("size", w > h * 1.2 ? "1536x1024" : h > w * 1.2 ? "1024x1536" : "1024x1024");
  form.append("quality", "medium");
  const r = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error?.message || String(r.status)), { status: r.status });
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new Error("empty");
  const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
  return createImageBitmap(new Blob([bytes], { type: "image/png" }));
}

// =====================================================================
// Interfaz
// =====================================================================
const PRESETS = [
  ["bw", [{ op: "grayscale", value: 1 }, { op: "contrast", value: 1.15 }]],
  ["vintage", [{ op: "sepia", value: 0.6 }, { op: "grain", value: 0.5 }, { op: "vignette", value: 0.6 }, { op: "contrast", value: 1.05 }]],
  ["vivid", [{ op: "saturate", value: 1.45 }, { op: "contrast", value: 1.12 }, { op: "brightness", value: 1.04 }]],
  ["warm", [{ op: "warm", value: 0.6 }]],
  ["cool", [{ op: "warm", value: -0.6 }]],
  ["cinema", [{ op: "crop", text: "16:9" }, { op: "contrast", value: 1.15 }, { op: "saturate", value: 0.85 }, { op: "vignette", value: 0.5 }]],
  ["cartoon", [{ op: "cartoon", value: 1 }], "photo"],
  ["sketch", [{ op: "sketch", value: 1 }], "photo"],
  ["pixel", [{ op: "pixelate", value: 14 }]],
  ["square", [{ op: "crop", text: "1:1" }]],
  ["story", [{ op: "crop", text: "9:16" }]],
  ["rotate", [{ op: "rotate", value: 90 }]],
  ["mirror", [{ op: "flip_h", value: 1 }]],
  ["slow", [{ op: "speed", value: 0.5 }], "video"],
  ["fast", [{ op: "speed", value: 2 }], "video"],
  ["mute", [{ op: "mute", value: 1 }], "video"],
];
const fill = (o) => ({ value: 0, text: "", color: "", position: "center", ...o });

let raf = 0;
/** ctx = { t, esc, tile, icon, stream, dictate, speak, errorText } */
export function renderStudio(body, ctx) {
  const { t, esc, tile, icon } = ctx;
  cancelAnimationFrame(raf);
  const has = Boolean(studio.kind);
  const isVideo = studio.kind === "video";
  const hasOpenAI = Boolean(getOpenAI());
  body.innerHTML = `
    <div class="tiles st-load">
      ${tile(`${icon("camera")}<br>${esc(t("st_photo"))}`, "", "action")}
      ${tile(`${icon("music")}<br>${esc(t("st_video"))}`, "", "action")}
      ${has ? tile(`${icon("install")}<br>${esc(studio.exporting ? `${Math.round(studio.exporting * 100)}%` : isVideo ? t("st_saveVideo") : t("st_savePhoto"))}`, "", "action st-save" + (studio.exporting ? " live" : "")) : ""}
      ${has ? tile(`↶<br>${esc(t("st_undo"))}`, "", "action st-undo") : ""}
      ${has ? tile(`✕<br>${esc(t("st_original"))}`, "", "action st-reset") : ""}
    </div>
    <input type="file" id="stPhoto" accept="image/*" hidden>
    <input type="file" id="stVideo" accept="video/*" hidden>
    ${has ? `
      <div class="st-stage">
        <canvas id="stCanvas"></canvas>
        ${isVideo ? `<button class="st-play" data-target>${studio.playing ? "❚❚" : "▶"}</button>` : ""}
        <span class="st-hold mono">${esc(t("st_hold"))}</span>
      </div>
      ${studio.ops.length ? `<div class="st-ops">${studio.ops.map((o, i) => `<button class="nw-mini" data-target data-rm="${i}">${esc(opLabel(o, t))} ✕</button>`).join("")}</div>` : ""}
      <div class="form-row st-ask">
        <textarea id="stReq" class="field" rows="2" placeholder="${esc(isVideo ? t("st_phVideo") : t("st_phPhoto"))}"></textarea>
      </div>
      <div class="tiles biz-actions">
        ${tile(`${icon("send")}<br>${esc(studio.busy ? t("thinking") : t("st_go"))}`, "", "action st-go" + (studio.busy ? " live" : ""))}
        ${tile(`${icon("mic")}<br>${esc(t("hw_dictate"))}`, "", "action st-dict")}
        ${!isVideo ? tile(`✦<br>${esc(studio.genBusy ? t("st_genBusy") : t("st_gen"))}`, "", "action st-gen" + (studio.genBusy ? " live" : "")) : ""}
      </div>
      ${studio.reply ? `<div class="hw-out st-reply">${esc(studio.reply)}</div>` : ""}
      <div class="st-presets">${PRESETS.filter(([, , k]) => !k || k === studio.kind).map(([k]) => `<button class="nw-mini" data-target data-preset="${k}">${esc(t("stp_" + k))}</button>`).join("")}
        <button class="nw-mini" data-target data-preset="text">${esc(t("stp_text"))}</button></div>
    ` : `<div class="st-empty"><p>${esc(t("st_intro"))}</p><p class="muted">${esc(t("st_examples"))}</p></div>`}
    <details class="readout st-gen-box" ${!hasOpenAI && studio.needKey ? "open" : ""}>
      <summary class="k">${esc(t("st_genTitle").toUpperCase())} · ${hasOpenAI ? "✓ " + esc(t("keySaved")) : esc(t("off"))}</summary>
      <p class="muted">${esc(t("st_genIntro"))}</p>
      <div class="key-row">
        <input id="stKey" type="password" autocomplete="off" spellcheck="false" placeholder="sk-…">
        <button class="tile" data-target id="stKeySave"><span class="t-main">${esc(t("saveKey"))}</span></button>
        ${hasOpenAI ? `<button class="tile" data-target id="stKeyDel"><span class="t-main">${esc(t("deleteKey"))}</span></button>` : ""}
      </div>
      <p class="muted">${esc(t("st_genNote"))} <a class="key-link" href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" data-target>platform.openai.com</a></p>
    </details>`;

  // ---- cargar ----
  const [bPhoto, bVideo] = body.querySelectorAll(".st-load .tile");
  const inPhoto = body.querySelector("#stPhoto"), inVideo = body.querySelector("#stVideo");
  bPhoto.addEventListener("click", () => inPhoto.click());
  bVideo.addEventListener("click", () => inVideo.click());
  const onFile = async (input) => {
    const f = input.files?.[0];
    if (!f) return;
    try { await loadFile(f); } catch { studio.reply = t("st_loadError"); }
    renderStudio(body, ctx);
  };
  inPhoto.addEventListener("change", () => onFile(inPhoto));
  inVideo.addEventListener("change", () => onFile(inVideo));

  // ---- clave de OpenAI ----
  body.querySelector("#stKeySave").addEventListener("click", () => {
    const v = body.querySelector("#stKey").value.trim();
    if (!v) return;
    try { localStorage.setItem(OPENAI_KEY, JSON.stringify(v)); } catch { /* bloqueado */ }
    studio.needKey = false;
    renderStudio(body, ctx);
  });
  body.querySelector("#stKeyDel")?.addEventListener("click", () => { localStorage.removeItem(OPENAI_KEY); renderStudio(body, ctx); });

  if (!has) return;

  // ---- vista previa ----
  const canvas = body.querySelector("#stCanvas");
  const [w, h] = srcSize();
  let showOriginal = false;
  const draw = () => renderMedia(canvas, source(), w, h, showOriginal ? [] : studio.ops, { heavy: !isVideo, maxSide: isVideo ? 960 : 1400 });
  if (isVideo) {
    const v = studio.video;
    const loop = () => {
      if (!canvas.isConnected) { v.pause(); studio.playing = false; return; }
      const ts = clampN(one(studio.ops, "trim_start")?.value, 0, studio.duration, 0);
      const te = clampN(one(studio.ops, "trim_end")?.value, ts + 0.2, studio.duration, studio.duration);
      if (studio.playing && (v.currentTime >= te || v.currentTime < ts)) v.currentTime = ts;
      v.playbackRate = clampN(one(studio.ops, "speed")?.value, 0.25, 4, 1);
      draw();
      raf = requestAnimationFrame(loop);
    };
    loop();
    body.querySelector(".st-play").addEventListener("click", () => {
      studio.playing = !studio.playing;
      if (studio.playing) { v.muted = Boolean(one(studio.ops, "mute")); v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }); } else v.pause();
      body.querySelector(".st-play").textContent = studio.playing ? "❚❚" : "▶";
    });
  } else draw();
  // Mantén pulsado para ver el original.
  const hold = (on) => { showOriginal = on; if (!isVideo) draw(); };
  canvas.addEventListener("pointerdown", () => hold(true));
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => canvas.addEventListener(ev, () => hold(false)));

  const apply = (ops) => { studio.undo.push(studio.ops); studio.ops = mergeOps(studio.ops, ops.map(fill)); renderStudio(body, ctx); };
  body.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => {
    studio.undo.push(studio.ops);
    studio.ops = studio.ops.filter((_, i) => i !== Number(b.dataset.rm));
    renderStudio(body, ctx);
  }));
  body.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.preset;
    if (k === "text") {
      const txt = prompt(t("st_textAsk"));
      if (txt) apply([{ op: "text", text: txt, color: "#ffffff", position: "bottom", value: 2 }]);
      return;
    }
    apply(PRESETS.find((p) => p[0] === k)[1]);
  }));
  body.querySelector(".st-undo").addEventListener("click", () => { if (studio.undo.length) { studio.ops = studio.undo.pop(); renderStudio(body, ctx); } });
  body.querySelector(".st-reset").addEventListener("click", () => { studio.undo.push(studio.ops); studio.ops = []; studio.reply = ""; renderStudio(body, ctx); });

  const req = body.querySelector("#stReq");
  req.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); body.querySelector(".st-go").click(); } });
  body.querySelector(".st-dict").addEventListener("click", () => ctx.dictate((said) => { req.value = (req.value ? req.value + " " : "") + said; }));

  // ---- pedir a la IA ----
  body.querySelector(".st-go").addEventListener("click", async () => {
    const text = req.value.trim();
    if (!text || studio.busy) return;
    studio.busy = true; studio.lastReq = text;
    renderStudio(body, ctx);
    try {
      const images = await framesForAI();
      let full = "";
      const err = await ctx.stream(
        {
          messages: [{ role: "user", content: text }], mode: "studio", channel: "text", images,
          media: studio.kind, duration: studio.duration, currentOps: JSON.stringify(studio.ops.map(({ op, value, text: tx }) => ({ op, value, text: tx }))),
        },
        { onText: (d) => { full += d; } },
      );
      const res = JSON.parse(full);
      studio.undo.push(studio.ops);
      studio.ops = mergeOps(studio.ops, (res.ops || []).filter((o) => isVideo || !["speed", "trim_start", "trim_end", "mute"].includes(o.op)).map(fill));
      studio.reply = res.reply || "";
      if (res.generative && res.genPrompt && !isVideo) {
        if (getOpenAI()) { studio.busy = false; await runGenerative(body, ctx, res.genPrompt); return; }
        studio.needKey = true;
        studio.reply += " " + t("st_needGen");
      } else if (res.generative && isVideo) studio.reply += " " + t("st_noGenVideo");
      if (studio.reply) ctx.speakIfVoice?.(studio.reply);
      if (!full) studio.reply = ctx.errorText(err);
    } catch {
      studio.reply = t("st_aiError");
    }
    studio.busy = false;
    if (body.isConnected) renderStudio(body, ctx);
  });

  body.querySelector(".st-gen")?.addEventListener("click", () => {
    const text = req.value.trim() || studio.lastReq;
    if (!text) { req.focus(); return; }
    runGenerative(body, ctx, text);
  });

  // ---- guardar ----
  body.querySelector(".st-save").addEventListener("click", async () => {
    if (studio.exporting) return;
    if (!isVideo) { save(await photoBlob(), "jpg"); return; }
    if (!window.MediaRecorder) { studio.reply = t("st_noRecorder"); renderStudio(body, ctx); return; }
    studio.exporting = 0.001; studio.playing = false;
    renderStudio(body, ctx);
    try {
      const blob = await videoBlob((p) => {
        studio.exporting = Math.max(0.001, Math.min(1, p));
        const lbl = body.querySelector(".st-save .t-main");
        if (lbl) lbl.lastChild.textContent = `${Math.round(studio.exporting * 100)}%`;
      });
      save(blob, blob.type.includes("mp4") ? "mp4" : "webm");
      studio.reply = t("st_videoReady");
    } catch (e) {
      studio.reply = e.message === "long" ? t("st_tooLong") : t("st_exportError");
    }
    studio.exporting = 0;
    if (body.isConnected) renderStudio(body, ctx);
  });
}

async function runGenerative(body, ctx, prompt) {
  const { t } = ctx;
  if (!getOpenAI()) { studio.needKey = true; studio.reply = t("st_needGen"); renderStudio(body, ctx); return; }
  studio.genBusy = true;
  renderStudio(body, ctx);
  try {
    const bmp = await generative(prompt);
    // La imagen generada pasa a ser la nueva base (las ediciones ya van incluidas).
    studio.bitmap = bmp;
    studio.undo = [];
    studio.ops = [];
    studio.reply = t("st_genDone");
  } catch (e) {
    studio.reply = e.status === 401 ? t("st_genKeyBad") : e.status === 429 || e.status === 402 ? t("st_genQuota") : `${t("st_genError")} (${e.message})`;
  }
  studio.genBusy = false;
  if (body.isConnected) renderStudio(body, ctx);
}

function opLabel(o, t) {
  const name = t("sto_" + o.op);
  if (o.op === "text" || o.op === "sticker") return `${name}: ${String(o.text).slice(0, 18)}`;
  if (o.op === "crop") return `${name} ${o.text}`;
  if (["flip_h", "flip_v", "sketch", "cartoon", "mute"].includes(o.op)) return name;
  if (o.op === "speed") return `${name} ${o.value}×`;
  if (o.op === "rotate") return `${name} ${o.value}°`;
  return `${name} ${Math.round(o.value * 100) / 100}`;
}
