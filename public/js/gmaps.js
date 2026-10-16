// Google Maps dentro de NIKOLAI.
// · Con clave de Google (gratis para uso personal normal): el mapa completo de Google con
//   todas sus herramientas: mapa, satélite, relieve, vista 45°, el muñequito (Pegman) de
//   Street View, tráfico, transporte público, ciclovías, mi ubicación y rutas.
// · Sin clave: Google Maps incrustado (buscar, mapa/satélite/relieve, zoom) y botones que
//   abren Street View y las rutas en Google Maps.
// · «Ciudades del mundo»: 174 ciudades por continente para ir a cualquiera de un toque,
//   vista de todo el mundo y ciudad al azar; con clave, todas aparecen marcadas en el mapa.
// · «Jugar en bloques aquí»: convierte el lugar del mapa en un mundo de bloques en primera
//   persona (blocks.js, se carga solo al pulsarlo).
import { renderInto } from "./md.js";
import { CITIES, CONTINENTS } from "./cities.js";

const KEY = "nikolai.googleMapsKey";
const TYPES = ["roadmap", "satellite", "hybrid", "terrain"];
const EMBED_T = { roadmap: "m", satellite: "k", hybrid: "h", terrain: "p" };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* lleno */ } };
export const gm = Object.assign({ lat: 19.4326, lon: -99.1332, zoom: 13, type: "hybrid", q: "", traffic: false, transit: false, bike: false }, load("nikolai.gmaps", {}));
const persist = () => { const { lat, lon, zoom, type, q, traffic, transit, bike } = gm; save("nikolai.gmaps", { lat, lon, zoom, type, q, traffic, transit, bike }); };
const getKey = () => load(KEY, "");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- Carga de la API de Google Maps ----------
let apiPromise = null, apiKeyLoaded = "";
function loadGoogle(key, lang) {
  if (window.google?.maps?.Map && apiKeyLoaded === key) return Promise.resolve(window.google.maps);
  if (apiPromise && apiKeyLoaded === key) return apiPromise;
  apiKeyLoaded = key;
  apiPromise = new Promise((res, rej) => {
    window.__nikolaiGmaps = () => res(window.google.maps);
    window.gm_authFailure = () => { authFailed = true; rej(new Error("auth")); onAuthFail?.(); };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=${lang}&loading=async&callback=__nikolaiGmaps`;
    s.async = true;
    s.onerror = () => { apiPromise = null; rej(new Error("load")); };
    document.head.appendChild(s);
  });
  return apiPromise;
}
let authFailed = false, onAuthFail = null;

let gmap = null, layers = {}, myDot = null, ctxRef = null, cont = "all", cityMarker = null;

/** ctx = { t, esc, tile, icon, stream, errorText, lang } */
export async function renderMap(body, ctx) {
  ctxRef = ctx;
  destroy();
  const { t, tile, icon } = ctx;
  const key = getKey();
  const full = key && !authFailed;
  body.innerHTML = `
    <div class="gm-wrap" id="gmWrap">
      <div class="gm-bar">
        <form class="gm-search"><input class="field" placeholder="${esc(t("gm_search"))}" value="${esc(gm.q)}" autocomplete="off"><button class="nw-mini" data-target>⌕ ${esc(t("search"))}</button></form>
        <div class="tac-group">${TYPES.map((k) => `<button class="nw-mini ${gm.type === k ? "on" : ""}" data-target data-type="${k}">${esc(t("gmt_" + k))}</button>`).join("")}</div>
      </div>
      <div class="gm-box">${full ? `<div id="gmMap" class="gm-map"></div>` : `<iframe class="gm-map" id="gmFrame" title="Google Maps" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>`}
        <div class="gm-overlay" hidden><iframe title="Google Maps" referrerpolicy="no-referrer-when-downgrade" allowfullscreen allow="accelerometer; gyroscope"></iframe><button class="nw-mini gm-back" data-target>← ${esc(t("gm_backMap"))}</button></div>
      </div>
      <div class="gm-steps hw-out" hidden></div>
      <div class="gm-bar">
        <div class="tac-group">
          ${full ? ["traffic", "transit", "bike"].map((k) => `<button class="nw-mini ${gm[k] ? "on" : ""}" data-target data-layer="${k}">${esc(t("gml_" + k))}</button>`).join("") : ""}
          <button class="nw-mini" data-target data-act="locate">⌖ ${esc(t("map_locate"))}</button>
          <button class="nw-mini" data-target data-act="street">🚶 ${esc(t("map_street"))}</button>
          <button class="nw-mini" data-target data-act="route">↱ ${esc(t("gm_route"))}</button>
          <button class="nw-mini" data-target data-act="full">⛶ ${esc(t("map_full"))}</button>
        </div>
      </div>
      <div class="gm-route" hidden>
        <input class="field" id="gmFrom" placeholder="${esc(t("gm_from"))}">
        <input class="field" id="gmTo" placeholder="${esc(t("gm_to"))}" value="${esc(gm.q)}">
        <select class="field" id="gmMode">${["driving", "walking", "transit", "bicycling"].map((m) => `<option value="${m}">${esc(t("gmm_" + m))}</option>`).join("")}</select>
        <button class="nw-mini" data-target data-act="go">${esc(t("gm_go"))}</button>
      </div>
      <div class="gm-cities">
        <div class="gm-cities-head">
          <b>🌍 ${esc(t("gm_cities"))}</b><span class="muted mono">${CITIES.length}</span>
          <button class="nw-mini" data-target data-act="world">🌐 ${esc(t("gm_world"))}</button>
          <button class="nw-mini" data-target data-act="random">🎲 ${esc(t("gm_random"))}</button>
        </div>
        <div class="tac-group">${CONTINENTS.map((k) => `<button class="nw-mini ${cont === k ? "on" : ""}" data-target data-cont="${k}">${esc(t("gmc_" + k))}</button>`).join("")}</div>
        <input class="field gm-cfilter" placeholder="${esc(t("gm_cityFilter"))}" autocomplete="off">
        <div class="gm-clist"></div>
      </div>
      <button class="gm-blocks" data-target data-act="blocks"><span class="gm-blocks-ico">⛏</span><span><b>${esc(t("gm_blocks"))}</b><small>${esc(t("gm_blocksSub"))}</small></span></button>
      <p class="muted gm-note">${esc(full ? t("gm_fullNote") : t("gm_embedNote"))}</p>
      <div class="tiles biz-actions">${tile(`${icon("send")}<br>${esc(t("map_analyze"))}`, "", "action gm-ai")}</div>
      <div class="hw-out" id="gmOut"></div>
      <details class="readout gm-keys" ${key ? "" : "open"}>
        <summary class="k">${esc(t("gm_keyTitle").toUpperCase())} · ${key ? (authFailed ? "✕ " + esc(t("gm_keyBad")) : "✓ " + esc(t("keySaved"))) : esc(t("off"))}</summary>
        <ol class="steps">
          <li>${esc(t("gm_k1"))} <a class="key-link" href="https://console.cloud.google.com/google/maps-apis/start" target="_blank" rel="noopener" data-target>console.cloud.google.com</a></li>
          <li>${esc(t("gm_k2"))}</li><li>${esc(t("gm_k3"))}</li>
        </ol>
        <div class="key-row">
          <input id="gmKey" type="password" autocomplete="off" spellcheck="false" placeholder="AIza…">
          <button class="tile" data-target id="gmKeySave"><span class="t-main">${esc(t("saveKey"))}</span></button>
          ${key ? `<button class="tile" data-target id="gmKeyDel"><span class="t-main">${esc(t("deleteKey"))}</span></button>` : ""}
        </div>
        <p class="muted">${esc(t("gm_kNote"))}</p>
      </details>
    </div>`;
  body.querySelector(".gm-search").addEventListener("submit", (e) => e.preventDefault());
  bindCommon(body);
  bindCities(body);
  if (full) {
    try {
      onAuthFail = () => { if (body.isConnected) renderMap(body, ctx); };
      const maps = await loadGoogle(key, ctx.lang || "es");
      if (!body.isConnected || authFailed) return;
      initFull(body, maps);
    } catch {
      authFailed = true;
      if (body.isConnected) renderMap(body, ctx);
    }
  } else updateEmbed(body);
}

export function destroy() {
  if (document.body.classList.contains("tac-fullscreen")) document.querySelector("body > #gmWrap")?.remove();
  document.body.classList.remove("tac-fullscreen");
  gmap = null; layers = {}; myDot = null;
}

// ---------- Sin clave: Google Maps incrustado ----------
function updateEmbed(body) {
  const f = body.querySelector("#gmFrame") || document.querySelector("#gmFrame");
  if (!f) return;
  const q = gm.q || `${gm.lat},${gm.lon}`;
  f.src = `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=${EMBED_T[gm.type] || "h"}&z=${gm.zoom}&hl=${ctxRef.lang || "es"}&ie=UTF8&iwloc=&output=embed`;
}

// ---------- Con clave: Google Maps completo ----------
function initFull(body, maps) {
  gmap = new maps.Map(body.querySelector("#gmMap"), {
    center: { lat: gm.lat, lng: gm.lon }, zoom: gm.zoom, mapTypeId: gm.type,
    mapTypeControl: false, streetViewControl: true, fullscreenControl: false, zoomControl: true,
    rotateControl: true, scaleControl: true, tilt: 45, gestureHandling: "greedy",
    streetViewControlOptions: { position: maps.ControlPosition.RIGHT_BOTTOM },
  });
  layers.traffic = new maps.TrafficLayer();
  layers.transit = new maps.TransitLayer();
  layers.bike = new maps.BicyclingLayer();
  for (const k of ["traffic", "transit", "bike"]) if (gm[k]) layers[k].setMap(gmap);
  // Todas las ciudades del mundo marcadas en el mapa: un toque y vas.
  CITIES.forEach((c, i) => {
    const mk = new maps.Marker({ map: gmap, position: { lat: c[3], lng: c[4] }, title: `${c[2]} ${c[0]}, ${c[1]}`,
      icon: { path: maps.SymbolPath.CIRCLE, scale: 4, fillColor: "#ffcc5c", fillOpacity: 1, strokeColor: "#1a1a1a", strokeWeight: 1.5 } });
    mk.addListener("click", () => goCity(body, i));
  });
  gmap.addListener("idle", () => {
    const c = gmap.getCenter();
    gm.lat = +c.lat().toFixed(5); gm.lon = +c.lng().toFixed(5); gm.zoom = gmap.getZoom();
    persist();
  });
}

/** Coordenadas de un lugar sin clave (OpenStreetMap), para saber dónde poner Street View. */
async function geocodeFree(q) {
  try {
    const r = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`)).json();
    if (r[0]) return { lat: +r[0].lat, lon: +r[0].lon };
  } catch { /* sin conexión */ }
  return null;
}

/** Muestra algo de Google Maps encima del mapa, sin salir de NIKOLAI. */
function showOverlay(url) {
  const ov = document.querySelector("#gmWrap .gm-overlay");
  if (!ov) return;
  ov.querySelector("iframe").src = url;
  ov.hidden = false;
}

async function search(body, q) {
  gm.q = q; persist();
  if (!gmap) {
    updateEmbed(body);
    const ll = await geocodeFree(q);
    if (ll) { gm.lat = ll.lat; gm.lon = ll.lon; persist(); }
    return;
  }
  try {
    const { results } = await new google.maps.Geocoder().geocode({ address: q });
    const r = results?.[0];
    if (!r) return;
    if (r.geometry.viewport) gmap.fitBounds(r.geometry.viewport); else gmap.setCenter(r.geometry.location);
    new google.maps.Marker({ map: gmap, position: r.geometry.location, title: r.formatted_address });
  } catch {
    // Si el Geocoding no está activado en la clave, se busca con OpenStreetMap y se centra el mapa.
    const ll = await geocodeFree(q);
    if (ll) { gmap.setCenter({ lat: ll.lat, lng: ll.lon }); gmap.setZoom(15); new google.maps.Marker({ map: gmap, position: { lat: ll.lat, lng: ll.lon }, title: q }); }
  }
}

function center() {
  if (gmap) { const c = gmap.getCenter(); return { lat: c.lat(), lon: c.lng() }; }
  return { lat: gm.lat, lon: gm.lon };
}

function bindCommon(body) {
  const { t } = ctxRef;
  const input = body.querySelector(".gm-search input");
  body.querySelector(".gm-search").addEventListener("submit", () => { const q = input.value.trim(); if (q) search(body, q); });
  body.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => {
    gm.type = b.dataset.type; persist();
    body.querySelectorAll("[data-type]").forEach((x) => x.classList.toggle("on", x === b));
    if (gmap) gmap.setMapTypeId(gm.type); else updateEmbed(body);
  }));
  body.querySelectorAll("[data-layer]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.layer;
    gm[k] = !gm[k]; persist();
    b.classList.toggle("on", gm[k]);
    layers[k]?.setMap(gm[k] ? gmap : null);
  }));
  const route = body.querySelector(".gm-route");
  body.querySelector(".gm-back").addEventListener("click", () => { const ov = body.querySelector(".gm-overlay") || document.querySelector("#gmWrap .gm-overlay"); ov.hidden = true; ov.querySelector("iframe").src = "about:blank"; });
  body.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => {
    const a = b.dataset.act, c = center();
    if (a === "locate") {
      navigator.geolocation?.getCurrentPosition((p) => {
        const ll = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (gmap) {
          gmap.panTo(ll); gmap.setZoom(17);
          myDot?.setMap(null);
          myDot = new google.maps.Marker({ map: gmap, position: ll, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#4285f4", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } });
        } else { gm.lat = ll.lat; gm.lon = ll.lng; gm.q = ""; gm.zoom = 17; persist(); updateEmbed(body); }
      }, () => { body.querySelector(".gm-note").textContent = t("map_noLocation"); }, { enableHighAccuracy: true, timeout: 10000 });
    } else if (a === "street") {
      // Con el mapa completo, activa Street View aquí mismo; si no, lo abre en Google Maps.
      if (gmap) {
        const sv = gmap.getStreetView();
        new google.maps.StreetViewService().getPanorama({ location: { lat: c.lat, lng: c.lon }, radius: 300 }, (data, st) => {
          if (st === "OK") { sv.setPosition(data.location.latLng); sv.setPov({ heading: 0, pitch: 0 }); sv.setVisible(true); }
          else body.querySelector(".gm-note").textContent = t("gm_noStreet");
        });
      } else {
        // Street View de Google dentro de NIKOLAI (sin clave).
        showOverlay(`https://maps.google.com/maps?layer=c&cbll=${c.lat},${c.lon}&cbp=12,0,0,0,0&source=embed&output=svembed&hl=${ctxRef.lang || "es"}`);
      }
    } else if (a === "route") {
      route.hidden = !route.hidden;
    } else if (a === "go") {
      routeInside(body, c);
    } else if (a === "full") {
      const wrap = document.querySelector("#gmWrap");
      const full = !document.body.classList.contains("tac-fullscreen");
      if (full) { fullHome = wrap.parentNode; document.body.appendChild(wrap); } else if (fullHome?.isConnected) fullHome.appendChild(wrap);
      document.body.classList.toggle("tac-fullscreen", full);
      document.querySelectorAll('#gmWrap [data-act="full"]').forEach((x) => x.classList.toggle("on", full));
    } else if (a === "world") {
      showWorld(body);
    } else if (a === "random") {
      goCity(body, Math.floor(Math.random() * CITIES.length));
    } else if (a === "blocks") {
      openWorld(b, c);
    }
  }));
  body.querySelector("#gmKeySave").addEventListener("click", () => {
    const v = body.querySelector("#gmKey").value.trim();
    if (!v) return;
    save(KEY, v); authFailed = false; apiPromise = null;
    renderMap(body, ctxRef);
  });
  body.querySelector("#gmKeyDel")?.addEventListener("click", () => { localStorage.removeItem(KEY); authFailed = false; renderMap(body, ctxRef); });
  body.querySelector(".gm-ai").addEventListener("click", async () => {
    const out = body.querySelector("#gmOut");
    const c = center();
    out.innerHTML = `<p class="muted">${esc(t("map_analyzing"))}</p>`;
    const prompt = t("map_analyzePrompt").replace("{lat}", c.lat.toFixed(5)).replace("{lon}", c.lon.toFixed(5)).replace("{zoom}", gm.zoom).replace("{place}", gm.q || "—").replace("{layers}", "—");
    let full = "";
    try {
      const err = await ctxRef.stream({ messages: [{ role: "user", content: prompt }], channel: "text" }, { onText: (d) => { full += d; renderInto(out, full); } });
      if (!full) out.textContent = ctxRef.errorText(err);
    } catch { out.textContent = t("errGeneric"); }
  });
}
let fullHome = null, dirRenderer = null;

// ---------- Ciudades del mundo ----------
const norm = (x) => String(x).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function listCities(body) {
  const box = body.querySelector(".gm-clist");
  if (!box) return;
  const q = norm(body.querySelector(".gm-cfilter")?.value.trim() || "");
  const items = CITIES.map((c, i) => [c, i]).filter(([c]) => (cont === "all" || c[5] === cont) && (!q || norm(c[0]).includes(q) || norm(c[1]).includes(q)));
  box.innerHTML = items.length
    ? items.map(([c, i]) => `<button class="gm-city ${gm.q === `${c[0]}, ${c[1]}` ? "on" : ""}" data-target data-city="${i}"><span>${c[2]}</span><b>${esc(c[0])}</b><small>${esc(c[1])}</small></button>`).join("")
    : `<p class="muted">${esc(ctxRef.t("gm_noCity"))}</p>`;
  box.querySelectorAll("[data-city]").forEach((b) => b.addEventListener("click", () => goCity(body, Number(b.dataset.city))));
}

function bindCities(body) {
  body.querySelectorAll("[data-cont]").forEach((b) => b.addEventListener("click", () => {
    cont = b.dataset.cont;
    body.querySelectorAll("[data-cont]").forEach((x) => x.classList.toggle("on", x === b));
    listCities(body);
  }));
  body.querySelector(".gm-cfilter").addEventListener("input", () => listCities(body));
  listCities(body);
}

/** Lleva el mapa a una ciudad de la lista. */
function goCity(body, i) {
  const [name, country, , lat, lon] = CITIES[i];
  gm.q = `${name}, ${country}`; gm.lat = lat; gm.lon = lon; gm.zoom = 12; persist();
  const input = body.querySelector(".gm-search input"); if (input) input.value = gm.q;
  const to = body.querySelector("#gmTo"); if (to) to.value = gm.q;
  if (gmap) {
    gmap.setCenter({ lat, lng: lon }); gmap.setZoom(12);
    cityMarker?.setMap(null);
    cityMarker = new google.maps.Marker({ map: gmap, position: { lat, lng: lon }, title: gm.q });
  } else updateEmbed(body);
  body.querySelectorAll(".gm-city").forEach((b) => b.classList.toggle("on", Number(b.dataset.city) === i));
  (document.querySelector("#gmWrap .gm-box"))?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/** Todo el planeta en pantalla. */
function showWorld(body) {
  gm.q = ""; gm.lat = 20; gm.lon = 0; gm.zoom = 2; persist();
  const input = body.querySelector(".gm-search input"); if (input) input.value = "";
  if (gmap) { gmap.setCenter({ lat: 20, lng: 0 }); gmap.setZoom(2); } else updateEmbed(body);
  body.querySelectorAll(".gm-city").forEach((b) => b.classList.remove("on"));
}

/** Abre el mundo de bloques del lugar que está en el centro del mapa. */
async function openWorld(btn, c) {
  const { t } = ctxRef;
  if (document.body.classList.contains("tac-fullscreen")) document.querySelector('#gmWrap [data-act="full"]')?.click();
  btn.classList.add("on");
  try {
    const { openBlocks } = await import("./blocks.js");
    await openBlocks({ lat: c.lat, lon: c.lon, place: gm.q, t, lang: ctxRef.lang });
  } catch (e) {
    console.error(e);
    const note = document.querySelector("#gmWrap .gm-note");
    if (note) note.textContent = t("mc_noWebgl");
  } finally { btn.classList.remove("on"); }
}

/** Rutas dentro de NIKOLAI: con clave, dibujadas en el mapa con los pasos; sin clave, la ruta de Google incrustada. */
async function routeInside(body, c) {
  const { t } = ctxRef;
  let from = body.querySelector("#gmFrom").value.trim();
  const to = body.querySelector("#gmTo").value.trim() || `${c.lat},${c.lon}`;
  const mode = body.querySelector("#gmMode").value;
  if (!from) {
    // Sin origen: desde donde estás.
    from = await new Promise((res) => {
      if (!navigator.geolocation) return res("");
      navigator.geolocation.getCurrentPosition((p) => res(`${p.coords.latitude},${p.coords.longitude}`), () => res(""), { timeout: 8000 });
    });
    if (!from) { body.querySelector(".gm-note").textContent = t("gm_needFrom"); return; }
  }
  const steps = document.querySelector("#gmWrap .gm-steps");
  if (gmap) {
    try {
      const res = await new google.maps.DirectionsService().route({ origin: from, destination: to, travelMode: mode.toUpperCase() });
      dirRenderer?.setMap(null);
      dirRenderer = new google.maps.DirectionsRenderer({ map: gmap });
      dirRenderer.setDirections(res);
      const leg = res.routes[0].legs[0];
      steps.hidden = false;
      steps.innerHTML = `<b>${esc(leg.distance.text)} · ${esc(leg.duration.text)}</b><ol>${leg.steps.map((st) => `<li>${st.instructions} <small class="muted">${esc(st.distance.text)}</small></li>`).join("")}</ol>`;
      return;
    } catch { /* la clave no tiene «Directions»: se usa la ruta incrustada */ }
  }
  const flag = { driving: "d", walking: "w", transit: "r", bicycling: "b" }[mode] || "d";
  showOverlay(`https://maps.google.com/maps?saddr=${encodeURIComponent(from)}&daddr=${encodeURIComponent(to)}&dirflg=${flag}&hl=${ctxRef.lang || "es"}&ie=UTF8&output=embed`);
}
