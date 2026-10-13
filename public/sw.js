// Service worker de NIKOLAI: instalar como app y funcionar sin internet.
// - Archivos de la app: red primero (siempre la versión nueva) y caché si no hay conexión.
// - Recursos externos pesados (detector de manos, fuentes, fórmulas): caché primero.
// - «Preparar modo sin conexión» descarga por adelantado esos recursos externos.

const SHELL = "nikolai-shell-v5";
const ASSETS = "nikolai-assets-v1";

const SHELL_FILES = [
  "./", "index.html", "style.css", "manifest.webmanifest", "icon.svg", "vendor/anthropic-sdk.mjs",
  "js/app.js", "js/brain.js", "js/brain-core.js", "js/extras.js", "js/gestures.js", "js/i18n.js", "js/markets.js",
  "js/md.js", "js/memory.js", "js/offline.js", "js/spotify.js", "js/study.js", "js/voice.js", "js/wallstreet.js", "js/weather.js", "js/news.js",
];

const VISION = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const KATEX = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist";
const FONTS_CSS = "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@112..125,500..800&family=JetBrains+Mono:wght@400;500;700&display=swap";
const HEAVY = [
  `${VISION}/vision_bundle.mjs`,
  `${VISION}/wasm/vision_wasm_internal.js`, `${VISION}/wasm/vision_wasm_internal.wasm`,
  `${VISION}/wasm/vision_wasm_nosimd_internal.js`, `${VISION}/wasm/vision_wasm_nosimd_internal.wasm`,
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  `${KATEX}/katex.min.css`, `${KATEX}/katex.min.js`, `${KATEX}/contrib/auto-render.min.js`,
];
const ASSET_HOSTS = ["cdn.jsdelivr.net", "storage.googleapis.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => Promise.all(SHELL_FILES.map((f) => c.add(f).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL && k !== ASSETS) await caches.delete(k);
    await self.clients.claim();
  })());
});

/** Red primero, pero sin esperar más de 3,5 s: si no hay conexión se usa la caché enseguida. */
async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3500))]);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
    if (hit) return hit;
    if (req.mode === "navigate") return (await cache.match("index.html")) || (await cache.match("./"));
    return Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) e.respondWith(networkFirst(req));
  else if (ASSET_HOSTS.includes(url.hostname)) e.respondWith(cacheFirst(req));
});

/** Descarga por adelantado lo necesario para usar NIKOLAI sin internet. */
async function prepare(client) {
  const report = (data) => client?.postMessage({ type: "offline-progress", ...data });
  const shell = await caches.open(SHELL);
  const assets = await caches.open(ASSETS);
  const files = [...SHELL_FILES.map((f) => ({ url: f, cache: shell })), ...HEAVY.map((u) => ({ url: u, cache: assets }))];
  // Fuentes: la hoja de estilos y los archivos de letra que enlaza.
  try {
    const css = await fetch(FONTS_CSS);
    const text = await css.clone().text();
    await assets.put(FONTS_CSS, css);
    for (const m of text.matchAll(/url\((https:[^)]+)\)/g)) files.push({ url: m[1], cache: assets });
  } catch { /* sin fuentes: se usan las del sistema */ }
  let done = 0, failed = 0, bytes = 0;
  for (const f of files) {
    try {
      const res = await fetch(f.url, { cache: "reload" });
      if (!res.ok) throw new Error(res.status);
      const blob = await res.clone().blob();
      bytes += blob.size;
      await f.cache.put(f.url, res);
    } catch {
      failed++;
    }
    done++;
    report({ done, total: files.length, failed, bytes });
  }
  report({ done, total: files.length, failed, bytes, finished: true });
}

self.addEventListener("message", (e) => {
  if (e.data?.type === "prepare-offline") e.waitUntil(prepare(e.source));
});
