// Mapa táctico: un «Google Maps» con estilo de centro de mando. Satélite, visión nocturna
// y térmica, cuadrícula, coordenadas, aviones en vuelo, sismos, la Estación Espacial,
// radar de lluvia, cámaras PÚBLICAS, medición, objetivos marcados y análisis con IA.
// Solo usa datos públicos y abiertos.
import { renderInto } from "./md.js";
import { Heli } from "./heli.js";

const LEAFLET = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist";
const BASES = {
  sat: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "Esri, Maxar, Earthstar Geographics", max: 19 },
  hybrid: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", labels: true, attr: "Esri, Maxar", max: 19 },
  dark: { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attr: "© OpenStreetMap, © CARTO", max: 20 },
  topo: { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", attr: "© OpenStreetMap, SRTM, © OpenTopoMap", max: 17 },
  street: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attr: "© OpenStreetMap", max: 19 },
};
const LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const FILTERS = ["none", "nvg", "thermal", "mono"];
const LAYERS = ["grid", "flights", "quakes", "iss", "radar", "cams", "pins"];

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* lleno */ } };
export const tac = Object.assign(
  { base: "hybrid", filter: "none", layers: ["grid", "pins"], lat: 23.6, lon: -102.5, zoom: 5, pins: [] },
  load("nikolai.tacmap", {}),
);
const persist = () => { const { base, filter, layers, lat, lon, zoom, pins } = tac; save("nikolai.tacmap", { base, filter, layers, lat, lon, zoom, pins }); };

// ---------- Carga de Leaflet ----------
let leafletReady = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletReady) return leafletReady;
  leafletReady = new Promise((res, rej) => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = `${LEAFLET}/leaflet.css`;
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = `${LEAFLET}/leaflet.js`;
    s.onload = () => res(window.L);
    s.onerror = () => { leafletReady = null; rej(new Error("leaflet")); };
    document.head.appendChild(s);
  });
  return leafletReady;
}

// ---------- Utilidades ----------
const dms = (v, pos, neg) => {
  const a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60), s = ((a - d - m / 60) * 3600).toFixed(1);
  return `${d}°${String(m).padStart(2, "0")}′${String(s).padStart(4, "0")}″${v >= 0 ? pos : neg}`;
};
const km = (a, b) => {
  const R = 6371, r = Math.PI / 180;
  const x = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const zulu = () => new Date().toISOString().slice(11, 19) + "Z";
const getJSON = async (url, opts) => { const r = await fetch(url, opts); if (!r.ok) throw new Error(String(r.status)); return r.json(); };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// =====================================================================
// Mapa
// =====================================================================
let map = null, L = null, baseLayer = null, labelLayer = null, timers = [], groups = {}, mode = null, measurePts = [], hud = null, ctxRef = null;
const status = {};

/** ctx = { t, esc, tile, icon, stream, errorText, speak, lang } */
export async function renderMap(body, ctx) {
  ctxRef = ctx;
  const { t, tile, icon } = ctx;
  destroy();
  body.innerHTML = `
    <div class="tac-wrap" id="tacWrap">
      <div class="tac-bar">
        <form class="tac-search"><input class="field" placeholder="${esc(t("map_search"))}" autocomplete="off"><button class="nw-mini" data-target>⌕</button></form>
        <div class="tac-group">${Object.keys(BASES).map((k) => `<button class="nw-mini ${tac.base === k ? "on" : ""}" data-target data-base="${k}">${esc(t("mapb_" + k))}</button>`).join("")}</div>
        <div class="tac-group">${FILTERS.map((k) => `<button class="nw-mini ${tac.filter === k ? "on" : ""}" data-target data-filter="${k}">${esc(t("mapf_" + k))}</button>`).join("")}</div>
      </div>
      <div class="tac-map-box">
        <div id="tacMap" class="tac-map tacf-${tac.filter}"></div>
        <div class="tac-hud">
          <div class="tac-corner tl"></div><div class="tac-corner tr"></div><div class="tac-corner bl"></div><div class="tac-corner br"></div>
          <div class="tac-title mono">NIKOLAI · ${esc(t("map_title").toUpperCase())} <span class="tac-blink">●</span> <span data-hud="zulu"></span></div>
          <div class="tac-coords mono" data-hud="coords"></div>
          <div class="tac-cross"></div>
          <div class="tac-status mono" data-hud="status"></div>
          <div class="tac-scan"></div>
        </div>
      </div>
      <div class="tac-bar">
        <div class="tac-group">${LAYERS.map((k) => `<button class="nw-mini ${tac.layers.includes(k) ? "on" : ""}" data-target data-layer="${k}">${esc(t("mapl_" + k))}</button>`).join("")}</div>
        <div class="tac-group">
          <button class="nw-mini" data-target data-act="locate">⌖ ${esc(t("map_locate"))}</button>
          <button class="nw-mini" data-target data-act="measure">📏 ${esc(t("map_measure"))}</button>
          <button class="nw-mini" data-target data-act="pin">◎ ${esc(t("map_pin"))}</button>
          <button class="nw-mini" data-target data-act="street">🚶 ${esc(t("map_street"))}</button>
          <button class="nw-mini" data-target data-act="camsweb">📹 ${esc(t("map_camsNear"))}</button>
          <button class="nw-mini heli-btn" data-target data-act="heli">🚁 ${esc(t("heli_fly"))}</button>
          <button class="nw-mini" data-target data-act="full">⛶ ${esc(t("map_full"))}</button>
        </div>
      </div>
      <div class="tiles biz-actions">${tile(`${icon("send")}<br>${esc(t("map_analyze"))}`, "", "action tac-ai")}</div>
      <div class="hw-out" id="tacOut"><p class="muted">${esc(t("map_hint"))}</p></div>
      <details class="readout tac-keys"><summary class="k">${esc(t("map_camsKeyTitle").toUpperCase())} · ${load("nikolai.windyKey", "") ? "✓" : esc(t("off"))}</summary>
        <p class="muted">${esc(t("map_camsKeyIntro"))} <a class="key-link" href="https://api.windy.com/keys" target="_blank" rel="noopener" data-target>api.windy.com/keys</a></p>
        <div class="key-row"><input id="tacKey" type="password" autocomplete="off" placeholder="Windy Webcams API key"><button class="tile" data-target id="tacKeySave"><span class="t-main">${esc(t("saveKey"))}</span></button></div>
      </details>
    </div>`;

  // El buscador nunca debe recargar la página (aunque el mapa aún no haya cargado).
  body.querySelector(".tac-search").addEventListener("submit", (e) => e.preventDefault());
  try { L = await loadLeaflet(); } catch {
    body.querySelector("#tacMap").innerHTML = `<p class="notice-err">${esc(t("map_loadError"))}</p>`;
    return;
  }
  if (!body.isConnected) return;
  map = L.map(body.querySelector("#tacMap"), { zoomControl: false, attributionControl: true, worldCopyJump: true, preferCanvas: true }).setView([tac.lat, tac.lon], tac.zoom);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.control.scale({ position: "bottomleft", imperial: false }).addTo(map);
  hud = body.querySelector(".tac-hud");
  setBase(tac.base);
  for (const k of LAYERS) groups[k] = L.layerGroup();
  for (const k of tac.layers) enableLayer(k);
  map.on("moveend", () => {
    const c = map.getCenter();
    tac.lat = +c.lat.toFixed(5); tac.lon = +c.lng.toFixed(5); tac.zoom = map.getZoom();
    // Volando, el mapa se mueve en cada fotograma: las capas pesadas se refrescan con calma.
    const now = Date.now();
    const flying = heli?.active;
    if (!flying || now - lastHeavy > 15_000) {
      lastHeavy = now;
      persist();
      if (tac.layers.includes("flights")) loadFlights();
      if (tac.layers.includes("cams")) loadCams();
    }
    if (tac.layers.includes("grid") && (!flying || now - lastGrid > 600)) { lastGrid = now; drawGrid(); }
    updateHud();
  });
  map.on("click", onClick);
  timers.push(setInterval(updateHud, 1000));
  updateHud();
  bindUi(body);
  setTimeout(() => map?.invalidateSize(), 200);
}

let fullHome = null, heli = null, lastHeavy = 0, lastGrid = 0;
export function destroy() {
  heli?.stop(); heli = null;
  // Si estaba a pantalla completa, el mapa vive en el <body>: se quita.
  if (document.body.classList.contains("tac-fullscreen")) document.querySelector("body > #tacWrap")?.remove();
  timers.forEach(clearInterval); timers = [];
  map?.remove(); map = null; groups = {}; mode = null; measurePts = [];
  document.body.classList.remove("tac-fullscreen");
}

function setBase(k) {
  const b = BASES[k] || BASES.hybrid;
  tac.base = k;
  baseLayer?.remove(); labelLayer?.remove();
  baseLayer = L.tileLayer(b.url, { maxZoom: b.max, attribution: b.attr, subdomains: "abc" }).addTo(map);
  if (b.labels) labelLayer = L.tileLayer(LABELS, { maxZoom: 19, pane: "overlayPane", className: "tac-labels" }).addTo(map);
  persist();
}

function setStatus(k, txt) { status[k] = txt; updateHud(); }
function updateHud() {
  if (!hud || !map) return;
  const c = map.getCenter();
  hud.querySelector('[data-hud="zulu"]').textContent = zulu();
  hud.querySelector('[data-hud="coords"]').innerHTML = `${dms(c.lat, "N", "S")}  ${dms(c.lng, "E", "W")}<br>${c.lat.toFixed(5)}, ${c.lng.toFixed(5)} · Z${map.getZoom()}`;
  hud.querySelector('[data-hud="status"]').innerHTML = tac.layers.filter((k) => status[k]).map((k) => `${esc(ctxRef.t("mapl_" + k)).toUpperCase()}: ${esc(status[k])}`).join("<br>");
}

// ---------- Capas ----------
function enableLayer(k) {
  groups[k].addTo(map);
  if (k === "grid") drawGrid();
  if (k === "pins") drawPins();
  if (k === "quakes") loadQuakes();
  if (k === "flights") { loadFlights(); timers.push(setInterval(() => tac.layers.includes("flights") && loadFlights(), 30_000)); }
  if (k === "iss") { loadIss(); timers.push(setInterval(() => tac.layers.includes("iss") && loadIss(), 5000)); }
  if (k === "radar") loadRadar();
  if (k === "cams") loadCams();
}
function disableLayer(k) { groups[k]?.clearLayers(); groups[k]?.remove(); delete status[k]; updateHud(); }

function drawGrid() {
  const g = groups.grid; g.clearLayers();
  const z = map.getZoom();
  const step = z <= 3 ? 30 : z <= 5 ? 10 : z <= 7 ? 2 : z <= 9 ? 0.5 : z <= 11 ? 0.1 : z <= 13 ? 0.02 : 0.005;
  const b = map.getBounds();
  const style = { color: "#7dffb2", weight: 0.6, opacity: 0.45, interactive: false, dashArray: "3 4" };
  const dec = step < 0.1 ? 3 : step < 1 ? 1 : 0;
  for (let x = Math.ceil(b.getWest() / step) * step; x <= b.getEast(); x += step) {
    g.addLayer(L.polyline([[b.getSouth(), x], [b.getNorth(), x]], style));
    g.addLayer(L.marker([b.getNorth(), x], { interactive: false, icon: L.divIcon({ className: "tac-glabel", html: `${x.toFixed(dec)}°`, iconSize: [60, 14], iconAnchor: [-2, -4] }) }));
  }
  for (let y = Math.ceil(b.getSouth() / step) * step; y <= b.getNorth(); y += step) {
    g.addLayer(L.polyline([[y, b.getWest()], [y, b.getEast()]], style));
    g.addLayer(L.marker([y, b.getWest()], { interactive: false, icon: L.divIcon({ className: "tac-glabel", html: `${y.toFixed(dec)}°`, iconSize: [60, 14], iconAnchor: [-4, 14] }) }));
  }
}

async function loadQuakes() {
  setStatus("quakes", "…");
  try {
    const j = await getJSON("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson");
    const g = groups.quakes; g.clearLayers();
    for (const f of j.features) {
      const [lon, lat, depth] = f.geometry.coordinates, m = f.properties.mag;
      g.addLayer(L.circleMarker([lat, lon], { radius: 3 + m * 2.2, color: m >= 6 ? "#ff3b5c" : m >= 4.5 ? "#ffcc5c" : "#7dffb2", weight: 1.5, fillOpacity: 0.25 })
        .bindPopup(`<b>M${m.toFixed(1)}</b> · ${esc(f.properties.place)}<br>${new Date(f.properties.time).toLocaleString()}<br>${ctxRef.t("map_depth")}: ${depth.toFixed(0)} km<br><a href="${esc(f.properties.url)}" target="_blank" rel="noopener">USGS</a>`));
    }
    setStatus("quakes", `${j.features.length} · 24H`);
  } catch { setStatus("quakes", ctxRef.t("map_noData")); }
}

let flightBusy = false;
async function loadFlights() {
  if (flightBusy || !map) return;
  if (map.getZoom() < 6) { groups.flights.clearLayers(); setStatus("flights", ctxRef.t("map_zoomIn")); return; }
  flightBusy = true;
  const b = map.getBounds();
  try {
    const j = await getJSON(`https://opensky-network.org/api/states/all?lamin=${b.getSouth().toFixed(3)}&lomin=${b.getWest().toFixed(3)}&lamax=${b.getNorth().toFixed(3)}&lomax=${b.getEast().toFixed(3)}`);
    const g = groups.flights; g.clearLayers();
    const list = (j.states || []).filter((s) => s[5] != null && s[6] != null).slice(0, 400);
    for (const s of list) {
      const [, call, country, , , lon, lat, baro, ground, vel, track] = s;
      const icon = L.divIcon({ className: "tac-plane", html: `<span style="transform:rotate(${track || 0}deg)">✈</span>`, iconSize: [18, 18], iconAnchor: [9, 9] });
      g.addLayer(L.marker([lat, lon], { icon }).bindPopup(`<b>${esc((call || "").trim() || "—")}</b> · ${esc(country)}<br>${ctxRef.t("map_alt")}: ${baro ? Math.round(baro).toLocaleString() + " m" : ground ? ctxRef.t("map_ground") : "—"}<br>${ctxRef.t("map_speed")}: ${vel ? Math.round(vel * 3.6) + " km/h" : "—"} · ${Math.round(track || 0)}°<br><a href="https://www.flightradar24.com/${encodeURIComponent((call || "").trim())}" target="_blank" rel="noopener">Flightradar24</a>`));
    }
    setStatus("flights", `${list.length} · LIVE`);
  } catch { setStatus("flights", ctxRef.t("map_noData")); }
  flightBusy = false;
}

let issTrail = [];
async function loadIss() {
  try {
    const j = await getJSON("https://api.wheretheiss.at/v1/satellites/25544");
    const g = groups.iss; g.clearLayers();
    issTrail.push([j.latitude, j.longitude]); issTrail = issTrail.slice(-120);
    if (issTrail.length > 1) g.addLayer(L.polyline(issTrail, { color: "#79e3ff", weight: 1.5, opacity: 0.7, dashArray: "4 4", interactive: false }));
    g.addLayer(L.marker([j.latitude, j.longitude], { icon: L.divIcon({ className: "tac-iss", html: "🛰", iconSize: [26, 26], iconAnchor: [13, 13] }) })
      .bindPopup(`<b>ISS</b><br>${ctxRef.t("map_alt")}: ${Math.round(j.altitude)} km<br>${ctxRef.t("map_speed")}: ${Math.round(j.velocity).toLocaleString()} km/h`));
    setStatus("iss", `${j.latitude.toFixed(1)}, ${j.longitude.toFixed(1)}`);
  } catch { setStatus("iss", ctxRef.t("map_noData")); }
}

async function loadRadar() {
  try {
    const j = await getJSON("https://api.rainviewer.com/public/weather-maps.json");
    const last = j.radar?.past?.at(-1);
    if (!last) throw new Error("none");
    groups.radar.clearLayers();
    groups.radar.addLayer(L.tileLayer(`${j.host}${last.path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0.65, maxNativeZoom: 10, maxZoom: 19, attribution: "RainViewer" }));
    setStatus("radar", new Date(last.time * 1000).toISOString().slice(11, 16) + "Z");
  } catch { setStatus("radar", ctxRef.t("map_noData")); }
}

async function loadCams() {
  const key = load("nikolai.windyKey", "");
  if (!key) { setStatus("cams", ctxRef.t("map_camsNeedKey")); return; }
  if (map.getZoom() < 7) { setStatus("cams", ctxRef.t("map_zoomIn")); return; }
  const c = map.getCenter();
  const radius = Math.min(250, Math.max(10, Math.round(km(map.getBounds().getNorthEast(), c))));
  try {
    const j = await getJSON(`https://api.windy.com/webcams/api/v3/webcams?nearby=${c.lat.toFixed(4)},${c.lng.toFixed(4)},${radius}&limit=50&include=location,images,player`, { headers: { "x-windy-api-key": key } });
    const g = groups.cams; g.clearLayers();
    for (const w of j.webcams || []) {
      const loc = w.location || {};
      const img = w.images?.current?.preview || w.images?.current?.thumbnail || "";
      const play = w.player?.live || w.player?.day || `https://www.windy.com/webcams/${w.webcamId}`;
      g.addLayer(L.marker([loc.latitude, loc.longitude], { icon: L.divIcon({ className: "tac-cam", html: "◉", iconSize: [18, 18], iconAnchor: [9, 9] }) })
        .bindPopup(`<b>${esc(w.title)}</b>${img ? `<br><img src="${esc(img)}" alt="" class="tac-camimg" referrerpolicy="no-referrer">` : ""}<br><a href="${esc(play)}" target="_blank" rel="noopener">${ctxRef.t("map_watchLive")}</a>`, { maxWidth: 320 }));
    }
    setStatus("cams", `${(j.webcams || []).length} · ${radius} km`);
  } catch { setStatus("cams", ctxRef.t("map_noData")); }
}

function drawPins() {
  const g = groups.pins; g.clearLayers();
  tac.pins.forEach((p, i) => {
    const m = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "tac-pin", html: `<span>◎</span><b>${esc(p.name)}</b>`, iconSize: [20, 20], iconAnchor: [10, 10] }) });
    m.bindPopup(`<b>${esc(p.name)}</b><br>${dms(p.lat, "N", "S")} ${dms(p.lon, "E", "W")}<br><button class="tac-del" data-i="${i}">${ctxRef.t("remove")}</button>`);
    m.on("popupopen", (e) => e.popup.getElement().querySelector(".tac-del")?.addEventListener("click", () => { tac.pins.splice(i, 1); persist(); drawPins(); }));
    g.addLayer(m);
  });
}

// ---------- Herramientas ----------
let measureLayer = null;
function onClick(e) {
  if (mode === "pin") {
    const name = prompt(ctxRef.t("map_pinName"), `OBJ-${String(tac.pins.length + 1).padStart(2, "0")}`);
    mode = null; map.getContainer().classList.remove("tac-aim");
    if (!name) return;
    tac.pins.push({ name: name.slice(0, 40), lat: +e.latlng.lat.toFixed(6), lon: +e.latlng.lng.toFixed(6) });
    persist();
    if (!tac.layers.includes("pins")) { tac.layers.push("pins"); enableLayer("pins"); } else drawPins();
    return;
  }
  if (mode === "measure") {
    measurePts.push(e.latlng);
    measureLayer?.remove();
    let total = 0;
    for (let i = 1; i < measurePts.length; i++) total += km(measurePts[i - 1], measurePts[i]);
    measureLayer = L.layerGroup([
      L.polyline(measurePts, { color: "#ffcc5c", weight: 2, dashArray: "6 4" }),
      ...measurePts.map((p) => L.circleMarker(p, { radius: 4, color: "#ffcc5c" })),
    ]).addTo(map);
    if (measurePts.length > 1) L.marker(measurePts.at(-1), { icon: L.divIcon({ className: "tac-dist", html: `${total < 1 ? Math.round(total * 1000) + " m" : total.toFixed(2) + " km"}`, iconSize: [90, 18], iconAnchor: [-8, 9] }) }).addTo(measureLayer);
    return;
  }
  L.popup().setLatLng(e.latlng).setContent(`<span class="mono">${dms(e.latlng.lat, "N", "S")}<br>${dms(e.latlng.lng, "E", "W")}<br>${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}</span>`).openOn(map);
}

async function search(q) {
  if (!q) return;
  try {
    const r = await getJSON(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}&accept-language=${ctxRef.lang || "es"}`);
    if (!r[0]) { setStatus("grid", ctxRef.t("map_notFound")); return; }
    const bb = r[0].boundingbox?.map(Number);
    if (bb) map.flyToBounds([[bb[0], bb[2]], [bb[1], bb[3]]], { maxZoom: 17, duration: 1.6 });
    else map.flyTo([+r[0].lat, +r[0].lon], 15, { duration: 1.6 });
  } catch { setStatus("grid", ctxRef.t("map_noData")); }
}

async function placeName(lat, lon) {
  try {
    const r = await getJSON(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=${Math.min(18, map.getZoom())}&accept-language=${ctxRef.lang || "es"}`);
    return r.display_name || "";
  } catch { return ""; }
}

function bindUi(body) {
  const { t } = ctxRef;
  const input = body.querySelector(".tac-search input");
  body.querySelector(".tac-search").addEventListener("submit", (e) => { e.preventDefault(); search(input.value.trim()); });
  body.querySelectorAll("[data-base]").forEach((b) => b.addEventListener("click", () => { setBase(b.dataset.base); body.querySelectorAll("[data-base]").forEach((x) => x.classList.toggle("on", x === b)); }));
  body.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => {
    tac.filter = b.dataset.filter; persist();
    const el = body.querySelector("#tacMap");
    FILTERS.forEach((f) => el.classList.remove("tacf-" + f));
    el.classList.add("tacf-" + tac.filter);
    body.querySelectorAll("[data-filter]").forEach((x) => x.classList.toggle("on", x === b));
  }));
  body.querySelectorAll("[data-layer]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.layer;
    if (tac.layers.includes(k)) { tac.layers = tac.layers.filter((x) => x !== k); disableLayer(k); }
    else { tac.layers.push(k); enableLayer(k); }
    b.classList.toggle("on", tac.layers.includes(k));
    persist();
  }));
  body.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => {
    const a = b.dataset.act;
    const c = map.getCenter();
    if (a === "locate") {
      navigator.geolocation?.getCurrentPosition((p) => {
        const ll = [p.coords.latitude, p.coords.longitude];
        map.flyTo(ll, 16, { duration: 1.6 });
        L.circle(ll, { radius: p.coords.accuracy, color: "#79e3ff", weight: 1, fillOpacity: 0.08 }).addTo(map);
        L.circleMarker(ll, { radius: 6, color: "#79e3ff", fillOpacity: 1 }).addTo(map);
      }, () => setStatus("grid", t("map_noLocation")), { enableHighAccuracy: true, timeout: 10000 });
    } else if (a === "measure") {
      if (mode === "measure") { mode = null; measurePts = []; measureLayer?.remove(); b.classList.remove("on"); map.getContainer().classList.remove("tac-aim"); }
      else { mode = "measure"; measurePts = []; b.classList.add("on"); map.getContainer().classList.add("tac-aim"); }
    } else if (a === "pin") {
      mode = "pin"; map.getContainer().classList.add("tac-aim");
    } else if (a === "street") {
      window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${c.lat},${c.lng}`, "_blank", "noopener");
    } else if (a === "camsweb") {
      window.open(`https://www.windy.com/-Webcams/webcams?${c.lat.toFixed(3)},${c.lng.toFixed(3)},${Math.max(8, map.getZoom())}`, "_blank", "noopener");
    } else if (a === "heli") {
      if (heli?.active) { heli.onExit(); return; }
      heli = new Heli(map, body.querySelector(".tac-map-box") || document.querySelector(".tac-map-box"), (k) => esc(t(k)));
      // Para volar, el mapa pasa a pantalla completa (y vuelve como estaba al salir).
      const fullBtn = (body.querySelector('[data-act="full"]') || document.querySelector('#tacWrap [data-act="full"]'));
      const wasFull = document.body.classList.contains("tac-fullscreen");
      if (!wasFull) fullBtn?.click();
      heli.onExit = () => { heli.stop(); b.classList.remove("on"); if (!wasFull && document.body.classList.contains("tac-fullscreen")) fullBtn?.click(); };
      setTimeout(() => heli?.start(), wasFull ? 0 : 300);
      b.classList.add("on");
    } else if (a === "full") {
      // El panel tiene transformaciones 3D: para ocupar toda la pantalla, el mapa se mueve al <body>.
      const wrap = body.querySelector("#tacWrap") || document.querySelector("#tacWrap");
      const full = !document.body.classList.contains("tac-fullscreen");
      if (full) { fullHome = wrap.parentNode; document.body.appendChild(wrap); }
      else if (fullHome?.isConnected) fullHome.appendChild(wrap);
      document.body.classList.toggle("tac-fullscreen", full);
      b.classList.toggle("on", full);
      setTimeout(() => map?.invalidateSize(), 250);
    }
  }));
  body.querySelector("#tacKeySave").addEventListener("click", () => {
    const v = body.querySelector("#tacKey").value.trim();
    if (!v) return;
    save("nikolai.windyKey", v);
    if (!tac.layers.includes("cams")) { tac.layers.push("cams"); persist(); }
    renderMap(body, ctxRef);
  });
  // Análisis de la zona con IA
  body.querySelector(".tac-ai").addEventListener("click", async () => {
    const out = body.querySelector("#tacOut");
    const c = map.getCenter();
    out.innerHTML = `<p class="muted">${esc(t("map_analyzing"))}</p>`;
    const name = await placeName(c.lat, c.lng);
    const visible = [];
    if (tac.layers.includes("quakes") && status.quakes) visible.push(`sismos: ${status.quakes}`);
    if (tac.layers.includes("flights") && status.flights) visible.push(`aviones: ${status.flights}`);
    const prompt = t("map_analyzePrompt").replace("{lat}", c.lat.toFixed(5)).replace("{lon}", c.lng.toFixed(5)).replace("{zoom}", map.getZoom()).replace("{place}", name || "—").replace("{layers}", visible.join(", ") || "—");
    let full = "";
    try {
      const err = await ctxRef.stream({ messages: [{ role: "user", content: prompt }], channel: "text" }, { onText: (d) => { full += d; renderInto(out, full); } });
      if (!full) out.textContent = ctxRef.errorText(err);
    } catch { out.textContent = t("errGeneric"); }
  });
}
