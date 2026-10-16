// Cine 16: estudio para convertir vídeos y fotos en película antigua, y
// catálogo de las cintas de «El Hombre en el Castillo».
import { FilmRenderer, PRESETS, ASPECTS, RESOLUTIONS, outputSize, wrapSource, makeReel } from "./film.js";
import { SEASONS, FILMS, primeLink, youtubeLink } from "./films.js";

const $ = (id) => document.getElementById(id);
const fmt = (s) => {
  if (!isFinite(s)) s = 0;
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};
const download = (blob, name) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
};

/* ===================== Pestañas ===================== */
function showView(name) {
  for (const v of ["estudio", "cintas"]) $(v).hidden = v !== name;
  document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === name)));
  if (name === "cintas") renderGallery();
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => { location.hash = b.dataset.view; }));
addEventListener("hashchange", () => showView(location.hash === "#cintas" ? "cintas" : "estudio"));

/* ===================== Estudio ===================== */
const out = $("out");
const film = new FilmRenderer(out);
let settings = { ...PRESETS.kodachrome };
let presetKey = "kodachrome";
const vid = $("vid");

// Fuente actual. Las fuentes generadas (fotos, demo) llevan su propio reloj.
const src = { kind: null, gen: null, t: 0, playing: false, duration: 0, loop: false, imageUrls: [] };

const SLIDERS = [
  ["saturation", "Saturación", 0, 2, 0.01], ["contrast", "Contraste", 0.5, 2, 0.01], ["brightness", "Brillo", 0.5, 1.5, 0.01],
  ["warmth", "Calidez", -1, 1, 0.01], ["fade", "Desvaído", 0, 1, 0.01], ["grain", "Grano", 0, 1, 0.01],
  ["grainSize", "Tamaño grano", 0.5, 3, 0.05], ["scratches", "Rayas", 0, 1, 0.01], ["dust", "Polvo y pelos", 0, 1, 0.01],
  ["flicker", "Parpadeo", 0, 1, 0.01], ["weave", "Temblor", 0, 1, 0.01], ["jumps", "Saltos de cuadro", 0, 1, 0.01],
  ["vignette", "Viñeta", 0, 1, 0.01], ["blur", "Suavidad", 0, 1, 0.01], ["halation", "Halación", 0, 1, 0.01],
  ["leaks", "Fugas de luz", 0, 1, 0.01],
];
const SOUND_SLIDERS = [["projector", "Proyector", 0, 1, 0.01], ["oldSound", "Sonido viejo", 0, 1, 0.01]];

function buildSliders(container, list) {
  for (const [key, label, min, max, step] of list) {
    const row = document.createElement("label");
    row.className = "slider";
    row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" data-key="${key}"><output></output>`;
    const input = row.querySelector("input");
    input.addEventListener("input", () => apply({ [key]: Number(input.value) }));
    container.append(row);
  }
}
buildSliders($("sliders"), SLIDERS);
buildSliders($("soundSliders"), SOUND_SLIDERS);

for (const r of RESOLUTIONS) $("height").add(new Option(r.label, r.h));
for (const [k, a] of Object.entries(ASPECTS)) $("aspect").add(new Option(a.label, k));

const presetsBox = $("presets");
for (const [k, p] of Object.entries(PRESETS)) {
  const b = document.createElement("button");
  b.textContent = p.name;
  b.dataset.key = k;
  b.addEventListener("click", () => {
    presetKey = k;
    const { height, pillarbox } = settings;
    settings = { ...PRESETS[k], height, pillarbox };
    film.set(settings);
    syncUI();
    applyAudio();
    applySpeed();
  });
  presetsBox.append(b);
}

const SELECTS = { height: Number, aspect: String, fps: Number, speed: Number, perfs: String, color: String };
for (const [id, cast] of Object.entries(SELECTS)) $(id).addEventListener("change", () => apply({ [id]: cast($(id).value) }));
for (const id of ["pillarbox", "leader", "sound"]) $(id).addEventListener("change", () => apply({ [id]: $(id).checked }));

function apply(patch) {
  settings = { ...settings, ...patch };
  film.set(settings);
  if ("speed" in patch) applySpeed();
  if ("projector" in patch || "oldSound" in patch || "sound" in patch || "fps" in patch) applyAudio();
  syncUI(false);
}

function syncUI(full = true) {
  presetsBox.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.key === presetKey));
  if (full) {
    for (const id of Object.keys(SELECTS)) $(id).value = String(settings[id]);
    for (const id of ["pillarbox", "leader", "sound"]) $(id).checked = !!settings[id];
  }
  document.querySelectorAll(".slider input").forEach((inp) => {
    if (full) inp.value = settings[inp.dataset.key];
    inp.nextElementSibling.textContent = Number(settings[inp.dataset.key]).toFixed(2);
  });
  const { w, h } = outputSize(settings);
  $("sizeInfo").textContent = `Salida: ${w} × ${h} px · ${settings.fps} fps`;
}

/* ---------- Fuentes ---------- */
function clearSource() {
  stopCam();
  vid.pause();
  if (vid.src) { URL.revokeObjectURL(vid.src); vid.removeAttribute("src"); vid.load(); }
  src.imageUrls.forEach((u) => URL.revokeObjectURL(u));
  Object.assign(src, { kind: null, gen: null, t: 0, playing: false, duration: 0, loop: false, imageUrls: [] });
}

function ready(kind, name, { seekable = true } = {}) {
  src.kind = kind;
  $("drop").hidden = true;
  $("srcName").textContent = name;
  $("play").disabled = false;
  $("seek").disabled = !seekable;
  setPlaying(false);
}

function loadVideo(file) {
  clearSource();
  vid.src = URL.createObjectURL(file);
  vid.loop = false;
  film.setSource(wrapSource(vid));
  vid.onloadedmetadata = () => {
    ready("video", `🎞 ${file.name} · ${vid.videoWidth}×${vid.videoHeight} · ${fmt(vid.duration)}`);
    applySpeed();
    vid.currentTime = Math.min(0.1, vid.duration / 2);
  };
  vid.onended = () => { if (!recorder) setPlaying(false); };
  vid.onerror = () => { $("srcName").textContent = "Este navegador no puede abrir ese vídeo. Prueba con MP4 (H.264) o WebM."; };
}

async function loadImages(files) {
  clearSource();
  const imgs = await Promise.all([...files].map((f) => new Promise((res) => {
    const url = URL.createObjectURL(f);
    src.imageUrls.push(url);
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = url;
  })));
  const list = imgs.filter(Boolean);
  if (!list.length) { $("srcName").textContent = "No se pudo abrir ninguna imagen."; return; }
  const per = 3.5;
  const c = document.createElement("canvas");
  const first = list[0];
  const scale = Math.min(1, 1920 / first.naturalWidth);
  c.width = Math.round(first.naturalWidth * scale);
  c.height = Math.round(first.naturalHeight * scale);
  const g = c.getContext("2d");
  const drawImg = (im, t, alpha) => {
    const z = 1 + 0.08 * (t / per);
    const s = Math.max(c.width / im.naturalWidth, c.height / im.naturalHeight) * z;
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    g.globalAlpha = alpha;
    g.drawImage(im, (c.width - w) / 2, (c.height - h) / 2, w, h);
    g.globalAlpha = 1;
  };
  src.gen = {
    el: c, ready: () => true, width: () => c.width, height: () => c.height,
    update(t) {
      const i = Math.min(list.length - 1, Math.floor(t / per));
      const local = t - i * per;
      g.fillStyle = "#000";
      g.fillRect(0, 0, c.width, c.height);
      drawImg(list[i], local, 1);
      if (local > per - 0.6 && list[i + 1]) drawImg(list[i + 1], 0, (local - (per - 0.6)) / 0.6);
    },
  };
  src.duration = list.length * per;
  src.gen.update(0);
  film.setSource(src.gen);
  ready("images", `🖼 ${list.length} foto${list.length > 1 ? "s" : ""} · ${fmt(src.duration)}`);
}

let camStream = null;
function stopCam() {
  camStream?.getTracks().forEach((t) => t.stop());
  camStream = null;
}
async function loadCam() {
  clearSource();
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1920, height: 1080 }, audio: true });
  } catch {
    $("srcName").textContent = "No hay permiso para la cámara (hace falta https o localhost).";
    return;
  }
  const cam = document.createElement("video");
  cam.muted = true;
  cam.playsInline = true;
  cam.srcObject = camStream;
  await cam.play();
  film.setSource(wrapSource(cam));
  ready("cam", "🎥 Cámara en directo", { seekable: false });
  setPlaying(true);
}

function loadDemo() {
  clearSource();
  src.gen = makeReel({ title: "Cine 16", subtitle: "Prueba de película", cards: ["Grano · rayas · polvo", "Tu vídeo aquí", "Fin"] });
  src.duration = src.gen.duration;
  src.loop = true;
  src.gen.update(0);
  film.setSource(src.gen);
  ready("demo", "✨ Bobina de demostración");
  setPlaying(true);
}

$("fileVideo").addEventListener("change", (e) => e.target.files[0] && loadVideo(e.target.files[0]));
$("fileImages").addEventListener("change", (e) => e.target.files.length && loadImages(e.target.files));
$("srcCam").addEventListener("click", loadCam);
$("srcDemo").addEventListener("click", loadDemo);

const screen = $("screen");
screen.addEventListener("dragover", (e) => { e.preventDefault(); screen.classList.add("drag"); });
screen.addEventListener("dragleave", () => screen.classList.remove("drag"));
screen.addEventListener("drop", (e) => {
  e.preventDefault();
  screen.classList.remove("drag");
  const files = [...e.dataTransfer.files];
  const v = files.find((f) => f.type.startsWith("video/"));
  if (v) loadVideo(v);
  else if (files.some((f) => f.type.startsWith("image/"))) loadImages(files.filter((f) => f.type.startsWith("image/")));
});

/* ---------- Reproducción ---------- */
function setPlaying(on) {
  ensureAudio();
  src.playing = on;
  if (src.kind === "video") { if (on) vid.play().catch(() => {}); else vid.pause(); }
  $("play").textContent = on ? "⏸ Pausa" : "▶ Reproducir";
}
$("play").addEventListener("click", () => {
  const atStart = src.kind === "video" ? vid.currentTime < 0.2 || vid.ended : src.t < 0.05;
  if (!src.playing && src.kind === "video" && vid.ended) vid.currentTime = 0;
  if (!src.playing && settings.leader && atStart) startWithLeader();
  else setPlaying(!src.playing);
});
$("seek").addEventListener("input", () => {
  const f = $("seek").value / 1000;
  if (src.kind === "video") vid.currentTime = f * (vid.duration || 0);
  else if (src.gen) { src.t = f * src.duration; src.gen.update(src.t); }
  film.lastFilmFrame = -1e9;
});
function applySpeed() { vid.playbackRate = settings.speed; }

/** Cuenta atrás de colilla (7 s) y después arranca la fuente. */
let leaderTimer = 0;
function startWithLeader() {
  return new Promise((resolve) => {
    clearTimeout(leaderTimer);
    film.startLeader();
    ensureAudio();
    leaderTimer = setTimeout(() => { setPlaying(true); resolve(); }, 7000);
  });
}

$("shot").addEventListener("click", () => out.toBlob((b) => b && download(b, `fotograma-16mm-${out.height}p.png`), "image/png"));

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (src.gen && src.playing) {
    src.t += dt * settings.speed;
    if (src.t >= src.duration) {
      if (src.loop) src.t = 0;
      else { src.t = src.duration; if (!recorder) setPlaying(false); }
    }
    src.gen.update(src.t);
  }
  if (src.kind || film.leaderStart != null) film.tick(now);
  const cur = src.kind === "video" ? vid.currentTime : src.t;
  const dur = src.kind === "video" ? vid.duration : src.duration;
  if (src.kind && src.kind !== "cam") {
    $("time").textContent = `${fmt(cur)} / ${fmt(dur)}`;
    if (document.activeElement !== $("seek")) $("seek").value = dur ? Math.round((cur / dur) * 1000) : 0;
  }
  if (recorder && dur && src.kind !== "cam") $("recBar").firstElementChild.style.width = `${Math.min(100, (cur / dur) * 100)}%`;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- Sonido: vídeo filtrado + ruido de proyector ---------- */
let ac = null, nodes = null;
function ensureAudio() {
  if (ac) { if (ac.state === "suspended") ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  const media = ac.createMediaElementSource(vid);
  const hp = ac.createBiquadFilter(); hp.type = "highpass";
  const lp = ac.createBiquadFilter(); lp.type = "lowpass";
  const shaper = ac.createWaveShaper();
  const vgain = ac.createGain();
  const proj = ac.createGain();
  const master = ac.createGain();
  const dest = ac.createMediaStreamDestination();
  media.connect(hp).connect(lp).connect(shaper).connect(vgain).connect(master);
  proj.connect(master);
  master.connect(ac.destination);
  master.connect(dest);
  nodes = { hp, lp, shaper, vgain, proj, dest, projSrc: null, projFps: 0 };
  applyAudio();
}

function projectorBuffer(fps) {
  const sr = ac.sampleRate, len = sr * 2;
  const buf = ac.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  let lpState = 0;
  const step = sr / fps;
  for (let i = 0; i < len; i++) {
    lpState += 0.08 * ((Math.random() * 2 - 1) - lpState); // zumbido grave del motor
    const phase = (i % step) / step;
    const click = phase < 0.012 ? (Math.random() * 2 - 1) * (1 - phase / 0.012) : 0; // golpe del garfio
    d[i] = lpState * 0.5 + click * 0.6 + Math.sin(i / sr * 2 * Math.PI * 50) * 0.03;
  }
  return buf;
}

function applyAudio() {
  if (!ac || !nodes) return;
  const o = settings.oldSound;
  nodes.hp.frequency.value = 20 + o * 330;
  nodes.lp.frequency.value = 18000 - o * 14800;
  const k = o * 40, n = 1024, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
  nodes.shaper.curve = curve;
  nodes.vgain.gain.value = settings.sound ? 1 : 0;
  nodes.proj.gain.value = settings.projector * 0.35;
  if (nodes.projFps !== settings.fps || !nodes.projSrc) {
    nodes.projSrc?.stop();
    const s = ac.createBufferSource();
    s.buffer = projectorBuffer(settings.fps);
    s.loop = true;
    s.connect(nodes.proj);
    s.start();
    nodes.projSrc = s;
    nodes.projFps = settings.fps;
  }
}

/* ---------- Grabación ---------- */
let recorder = null;
function pickMime() {
  const opts = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return opts.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
}
const BITRATE = { 240: 1.5e6, 480: 4e6, 720: 8e6, 1080: 16e6, 1440: 28e6, 2160: 50e6 };

async function startRecording() {
  if (!src.kind) { $("recInfo").textContent = "Primero elige una fuente."; return; }
  if (!window.MediaRecorder || !out.captureStream) { $("recInfo").textContent = "Este navegador no puede grabar vídeo (usa Chrome, Edge o Firefox)."; return; }
  ensureAudio();
  const mime = pickMime();
  const stream = out.captureStream(30);
  if (nodes) nodes.dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  if (src.kind === "cam" && settings.sound) camStream?.getAudioTracks().forEach((t) => stream.addTrack(t));
  const chunks = [];
  recorder = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: BITRATE[settings.height] || 16e6 });
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    const type = recorder.mimeType || mime || "video/webm";
    const ext = type.includes("mp4") ? "mp4" : "webm";
    const blob = new Blob(chunks, { type });
    const { w, h } = outputSize(settings);
    const name = `pelicula-16mm-${h}p.${ext}`;
    download(blob, name);
    $("recDone").hidden = false;
    $("recDone").textContent = `✓ Película lista: ${name} · ${w}×${h} · ${(blob.size / 1e6).toFixed(1)} MB. Se ha descargado.`;
    stream.getVideoTracks().forEach((t) => t.stop());
    recorder = null;
    setRecUI(false);
  };
  setRecUI(true, mime);
  // Siempre desde el principio (salvo la cámara).
  setPlaying(false);
  if (src.kind === "video") vid.currentTime = 0;
  if (src.gen) { src.t = 0; src.gen.update(0); }
  recorder.start(1000);
  if (settings.leader) await startWithLeader();
  else setPlaying(true);
  if (src.kind === "video") vid.addEventListener("ended", stopRecording, { once: true });
  if (src.kind === "images") setTimeout(() => recorder && watchGenEnd(), 200);
}
function watchGenEnd() {
  if (!recorder) return;
  if (src.t >= src.duration) stopRecording();
  else setTimeout(watchGenEnd, 200);
}
function stopRecording() {
  if (!recorder) return;
  clearTimeout(leaderTimer);
  setPlaying(false);
  setTimeout(() => recorder?.state === "recording" && recorder.stop(), 300); // último fotograma
}
function setRecUI(on, mime = "") {
  $("rec").hidden = on;
  $("stop").hidden = !on;
  $("recBar").hidden = !on || src.kind === "cam" || src.kind === "demo";
  $("recBar").firstElementChild.style.width = "0";
  if (on) $("recDone").hidden = true;
  const { w, h } = outputSize(settings);
  $("recInfo").textContent = on ? `● Grabando ${w}×${h} · ${mime.includes("mp4") ? "MP4" : "WebM"}…` : "";
  for (const id of ["height", "aspect", "pillarbox", "perfs"]) $(id).disabled = on;
}
$("rec").addEventListener("click", startRecording);
$("stop").addEventListener("click", stopRecording);

$("height").value = "1080";
syncUI();
film.set(settings);

/* ===================== Cintas ===================== */
// Copias propias de los clips: se guardan solo en este navegador (IndexedDB).
const db = (() => {
  let p = null;
  const open = () => (p ??= new Promise((res, rej) => {
    const r = indexedDB.open("cine16", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("clips");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = async (mode, fn) => {
    const d = await open();
    return new Promise((res, rej) => {
      const tx = d.transaction("clips", mode);
      const req = fn(tx.objectStore("clips"));
      tx.oncomplete = () => res(req?.result);
      tx.onerror = () => rej(tx.error);
    });
  };
  return {
    get: (k) => run("readonly", (s) => s.get(k)).catch(() => null),
    keys: () => run("readonly", (s) => s.getAllKeys()).catch(() => []),
    put: (k, v) => run("readwrite", (s) => s.put(v, k)),
    del: (k) => run("readwrite", (s) => s.delete(k)),
  };
})();

let seasonFilter = 0;
let galleryBuilt = false;
async function renderGallery() {
  const tabs = $("seasonTabs");
  if (!galleryBuilt) {
    galleryBuilt = true;
    for (const n of [0, 1, 2, 3, 4]) {
      const b = document.createElement("button");
      b.textContent = n ? `T${n}` : "Todas";
      b.addEventListener("click", () => { seasonFilter = n; renderGallery(); });
      tabs.append(b);
    }
  }
  [...tabs.children].forEach((b, i) => b.classList.toggle("on", i === seasonFilter));
  const owned = new Set(await db.keys());
  const list = $("filmList");
  list.innerHTML = "";
  for (const season of SEASONS) {
    if (seasonFilter && season.n !== seasonFilter) continue;
    const block = document.createElement("section");
    block.className = "season-block";
    block.innerHTML = `<h2>${season.title} <span class="muted small">(${season.year})</span></h2><p>${season.blurb}</p><div class="films"></div>`;
    const grid = block.querySelector(".films");
    for (const f of FILMS.filter((x) => x.season === season.n)) grid.append(filmCard(f, owned.has(f.id)));
    list.append(block);
  }
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function filmCard(f, owned) {
  const el = document.createElement("article");
  el.className = "film card";
  el.innerHTML = `
    <div class="thumb" title="Ver"></div>
    <span class="ep">T${f.season} · ${esc(f.episode)}</span>
    <h4>${esc(f.title)}</h4>
    <dl><dt>La ve</dt><dd>${esc(f.viewers)}</dd><dt>Mundo</dt><dd>${esc(f.world)}</dd></dl>
    <p>${esc(f.summary)}</p>
    ${owned ? `<span class="own">✓ Tu copia adjunta: se reproduce con efecto de película</span>` : ""}
    <div class="actions">
      <button class="btn small" data-a="play">▶ ${owned ? "Ver tu copia" : "Reconstrucción"}</button>
      <a class="btn ghost small" href="${primeLink(f)}" target="_blank" rel="noopener">Prime Video</a>
      <a class="btn ghost small" href="${youtubeLink(f)}" target="_blank" rel="noopener">Buscar clip</a>
      <label class="btn ghost small">${owned ? "Cambiar copia" : "Adjuntar mi copia"}<input type="file" accept="video/*" hidden></label>
      ${owned ? `<button class="btn ghost small" data-a="del">Quitar</button>` : ""}
      <button class="btn ghost small" data-a="studio">Llevar estilo al estudio</button>
    </div>`;
  const thumb = el.querySelector(".thumb");
  thumb.append(thumbCanvas(f));
  thumb.addEventListener("click", () => openPlayer([f.id]));
  el.querySelector('[data-a="play"]').addEventListener("click", () => openPlayer([f.id]));
  el.querySelector('input[type=file]').addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { await db.put(f.id, { blob: file, name: file.name }); }
    catch { alert("No se pudo guardar el vídeo en este navegador (¿modo privado o sin espacio?)."); }
    renderGallery();
  });
  el.querySelector('[data-a="del"]')?.addEventListener("click", async () => { await db.del(f.id); renderGallery(); });
  el.querySelector('[data-a="studio"]').addEventListener("click", () => {
    presetsBox.querySelector('[data-key="highcastle"]').click();
    location.hash = "estudio";
  });
  return el;
}

function reelFor(f) {
  return makeReel({ title: f.title, subtitle: `Temporada ${f.season} · ${f.episode}`, cards: f.cards });
}

function thumbCanvas(f) {
  const c = document.createElement("canvas");
  const r = new FilmRenderer(c);
  r.set({ ...PRESETS.highcastle, height: 300, leader: false, perfs: "none" });
  const reel = reelFor(f);
  reel.update(1.3);
  r.setSource(reel);
  r.tick(performance.now());
  return c;
}

/* ---------- Reproductor del catálogo ---------- */
const dlg = $("player");
const pRenderer = new FilmRenderer($("pCanvas"));
pRenderer.set({ ...PRESETS.highcastle, height: 720 });
const pVid = $("pVid");
const player = { queue: [], i: 0, reel: null, t: 0, playing: false, raf: 0, url: null };

async function openPlayer(ids) {
  player.queue = ids;
  player.i = 0;
  if (!dlg.open) dlg.showModal();
  await playItem();
  cancelAnimationFrame(player.raf);
  let prev = performance.now();
  const step = (now) => {
    if (!dlg.open) return;
    const dt = Math.min(0.1, (now - prev) / 1000);
    prev = now;
    if (player.reel && player.playing && pRenderer.leaderStart == null) {
      player.t += dt;
      if (player.t >= player.reel.duration) next(1);
      else player.reel.update(player.t);
    }
    pRenderer.tick(now);
    player.raf = requestAnimationFrame(step);
  };
  player.raf = requestAnimationFrame(step);
}

async function playItem() {
  const f = FILMS.find((x) => x.id === player.queue[player.i]);
  if (!f) return;
  pVid.pause();
  if (player.url) { URL.revokeObjectURL(player.url); player.url = null; }
  $("pTitle").textContent = f.title;
  $("pSub").textContent = `Temporada ${f.season} · ${f.episode}`;
  const clip = await db.get(f.id);
  player.playing = true;
  $("pPlay").textContent = "⏸";
  pRenderer.startLeader();
  if (clip?.blob) {
    player.reel = null;
    player.url = URL.createObjectURL(clip.blob);
    pVid.src = player.url;
    pRenderer.setSource(wrapSource(pVid));
    $("pInfo").textContent = `Tu copia: ${clip.name}`;
    setTimeout(() => player.playing && dlg.open && pVid.play().catch(() => {}), 7000);
  } else {
    player.reel = reelFor(f);
    player.t = 0;
    player.reel.update(0);
    pRenderer.setSource(player.reel);
    $("pInfo").textContent = "Reconstrucción original (no es metraje de la serie). Adjunta tu copia del clip en la ficha para verla aquí.";
  }
  $("pInfo").textContent += player.queue.length > 1 ? ` · ${player.i + 1} de ${player.queue.length}` : "";
}

function next(d) {
  const ni = player.i + d;
  if (ni < 0 || ni >= player.queue.length) { player.playing = false; $("pPlay").textContent = "▶"; return; }
  player.i = ni;
  playItem();
}
pVid.addEventListener("ended", () => next(1));
$("pNext").addEventListener("click", () => next(1));
$("pPrev").addEventListener("click", () => next(-1));
$("pPlay").addEventListener("click", () => {
  player.playing = !player.playing;
  $("pPlay").textContent = player.playing ? "⏸" : "▶";
  if (!player.reel) { if (player.playing) pVid.play().catch(() => {}); else pVid.pause(); }
});
$("pClose").addEventListener("click", () => dlg.close());
dlg.addEventListener("close", () => {
  pVid.pause();
  player.playing = false;
  cancelAnimationFrame(player.raf);
});
$("playAll").addEventListener("click", () => openPlayer(FILMS.map((f) => f.id)));

showView(location.hash === "#cintas" ? "cintas" : "estudio");
