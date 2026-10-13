// Música con Spotify.
// - Sin cuenta: listas de Spotify incrustadas (reproductor oficial) y cualquier enlace que pegues.
// - Con tu cuenta (Client ID propio, flujo PKCE sin servidor): buscar, ver qué suena,
//   reproducir/pausar/siguiente en tus dispositivos y abrir tus listas.
//   Controlar la reproducción requiere Spotify Premium (regla de Spotify).

const AUTH = "https://accounts.spotify.com/authorize";
const TOKEN = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";
const SCOPES = [
  "user-read-playback-state", "user-modify-playback-state", "user-read-currently-playing",
  "playlist-read-private", "user-library-read",
].join(" ");

/** Listas públicas de Spotify para usar sin iniciar sesión. */
export const PRESETS = [
  { key: "focus", id: "37i9dQZF1DWZeKCadgRdKQ", words: ["estudiar", "estudio", "concentr", "focus", "study", "tarea", "trabajar"] },
  { key: "lofi", id: "37i9dQZF1DWWQRwui0ExPn", words: ["lofi", "lo-fi", "relaj", "chill", "tranquil"] },
  { key: "piano", id: "37i9dQZF1DX4sWSpwq3LiO", words: ["piano", "dormir", "sleep", "calma", "calm"] },
  { key: "hits", id: "37i9dQZF1DXcBWIGoYBM5M", words: ["éxitos", "exitos", "hits", "popular", "pop"] },
  { key: "mexico", id: "37i9dQZEVXbO3qyFxbkOE1", words: ["méxico", "mexico", "mexicana", "top 50"] },
  { key: "global", id: "37i9dQZEVXbMDoHDwVN2tF", words: ["global", "mundo", "world"] },
  { key: "latino", id: "37i9dQZF1DX10zKzsJ2jva", words: ["latino", "reggaeton", "reguetón", "urbano", "fiesta", "party"] },
  { key: "gym", id: "37i9dQZF1DX76Wlfdnj7AP", words: ["gym", "ejercicio", "entrenar", "workout", "correr", "motiva"] },
];

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("nikolai.spotify." + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("nikolai.spotify." + k, JSON.stringify(v)); } catch { /* bloqueado */ } },
  del(k) { try { localStorage.removeItem("nikolai.spotify." + k); } catch { /* bloqueado */ } },
};

export const spotify = {
  clientId: store.get("clientId", ""),
  token: store.get("token", null), // {access, refresh, expires}
  embed: store.get("embed", { type: "playlist", id: PRESETS[0].id }),
  now: null,           // lo que suena: {title, artist, image, playing, progress, duration, device}
  results: [],
  playlists: [],
  error: "",
};

export const redirectUri = () => location.origin + location.pathname;
export const isConnected = () => Boolean(spotify.token?.access);

// ---------- Inicio de sesión (PKCE) ----------
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function login(clientId) {
  spotify.clientId = clientId.trim();
  store.set("clientId", spotify.clientId);
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(12)));
  store.set("verifier", verifier);
  store.set("state", state);
  const params = new URLSearchParams({
    client_id: spotify.clientId, response_type: "code", redirect_uri: redirectUri(),
    code_challenge_method: "S256", code_challenge: challenge, scope: SCOPES, state,
  });
  location.href = `${AUTH}?${params}`;
}

/** Al volver de Spotify: cambia el código por un token. Devuelve true si se conectó. */
export async function handleRedirect() {
  const q = new URLSearchParams(location.search);
  const code = q.get("code"), state = q.get("state"), err = q.get("error");
  if (!code && !err) return false;
  history.replaceState(null, "", redirectUri() + location.hash);
  if (err || state !== store.get("state", "")) { spotify.error = err || "state"; return false; }
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: spotify.clientId, grant_type: "authorization_code", code,
      redirect_uri: redirectUri(), code_verifier: store.get("verifier", ""),
    }),
  });
  const j = await res.json();
  if (!res.ok) { spotify.error = j.error_description || j.error || `HTTP ${res.status}`; return false; }
  saveToken(j);
  store.del("verifier");
  store.del("state");
  return true;
}

function saveToken(j) {
  spotify.token = {
    access: j.access_token,
    refresh: j.refresh_token || spotify.token?.refresh,
    expires: Date.now() + (j.expires_in - 60) * 1000,
  };
  store.set("token", spotify.token);
}

async function accessToken() {
  if (!spotify.token) return null;
  if (Date.now() < spotify.token.expires) return spotify.token.access;
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: spotify.clientId, grant_type: "refresh_token", refresh_token: spotify.token.refresh }),
  });
  if (!res.ok) { logout(); return null; }
  saveToken(await res.json());
  return spotify.token.access;
}

export function logout() {
  spotify.token = null;
  spotify.now = null;
  store.del("token");
}

async function api(path, { method = "GET", body } = {}) {
  const token = await accessToken();
  if (!token) throw Object.assign(new Error("not connected"), { code: "auth" });
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const j = await res.json().catch(() => null);
  if (!res.ok) {
    const reason = j?.error?.reason || "";
    throw Object.assign(new Error(j?.error?.message || `HTTP ${res.status}`), {
      code: reason === "PREMIUM_REQUIRED" || res.status === 403 ? "premium" : reason === "NO_ACTIVE_DEVICE" || res.status === 404 ? "device" : "api",
    });
  }
  return j;
}

// ---------- Acciones ----------
export async function refreshNow() {
  if (!isConnected()) return null;
  try {
    const j = await api("/me/player?additional_types=track,episode");
    const item = j?.item;
    spotify.now = item ? {
      title: item.name,
      artist: (item.artists || []).map((a) => a.name).join(", ") || item.show?.name || "",
      image: (item.album?.images || item.images || [])[0]?.url || "",
      playing: j.is_playing, progress: j.progress_ms, duration: item.duration_ms,
      device: j.device?.name || "", url: item.external_urls?.spotify,
    } : null;
  } catch (e) {
    if (e.code === "auth") spotify.now = null;
  }
  return spotify.now;
}

export async function control(action) {
  if (!isConnected()) throw Object.assign(new Error("not connected"), { code: "auth" });
  if (action === "play") await api("/me/player/play", { method: "PUT" });
  else if (action === "pause") await api("/me/player/pause", { method: "PUT" });
  else if (action === "next") await api("/me/player/next", { method: "POST" });
  else if (action === "previous") await api("/me/player/previous", { method: "POST" });
  setTimeout(refreshNow, 600);
}

export async function search(q) {
  const j = await api(`/search?type=track,playlist,album,artist&limit=8&q=${encodeURIComponent(q)}`);
  const pick = (arr, type, fn) => (arr?.items || []).filter(Boolean).map((x) => ({ type, ...fn(x) }));
  spotify.results = [
    ...pick(j.tracks, "track", (x) => ({ id: x.id, uri: x.uri, title: x.name, sub: x.artists.map((a) => a.name).join(", "), image: x.album?.images?.[2]?.url || x.album?.images?.[0]?.url })),
    ...pick(j.playlists, "playlist", (x) => ({ id: x.id, uri: x.uri, title: x.name, sub: x.owner?.display_name || "", image: x.images?.[0]?.url })),
    ...pick(j.albums, "album", (x) => ({ id: x.id, uri: x.uri, title: x.name, sub: x.artists?.map((a) => a.name).join(", "), image: x.images?.[0]?.url })),
    ...pick(j.artists, "artist", (x) => ({ id: x.id, uri: x.uri, title: x.name, sub: "", image: x.images?.[0]?.url })),
  ];
  return spotify.results;
}

export async function loadPlaylists() {
  const j = await api("/me/playlists?limit=20");
  spotify.playlists = (j?.items || []).filter(Boolean).map((p) => ({ type: "playlist", id: p.id, uri: p.uri, title: p.name, sub: `${p.tracks?.total ?? ""}`, image: p.images?.[0]?.url }));
  return spotify.playlists;
}

/** Reproduce en el dispositivo activo del usuario (Premium). */
export async function playItem(item) {
  // Siempre desde el principio de la canción.
  const body = item.type === "track" ? { uris: [item.uri], position_ms: 0 } : { context_uri: item.uri, offset: { position: 0 }, position_ms: 0 };
  await api("/me/player/play", { method: "PUT", body });
  setTimeout(refreshNow, 800);
}

/** Elige qué mostrar en el reproductor flotante (funciona sin cuenta). */
export function setEmbed(type, id) {
  spotify.embed = { type, id };
  store.set("embed", spotify.embed);
}

// ---------- Reproductor flotante (Spotify iFrame API) ----------
// Vive fuera de los módulos, así la música sigue al cerrar el panel.
let apiPromise = null, controller = null, controllerReady = null, loadedUri = "";
export const player = { visible: false, playing: false, title: "", onChange: null };

function loadIframeApi() {
  apiPromise ??= new Promise((resolve, reject) => {
    window.onSpotifyIframeApiReady = (api) => resolve(api);
    const s = document.createElement("script");
    s.src = "https://open.spotify.com/embed/iframe-api/v1";
    s.async = true;
    s.onerror = reject;
    document.body.appendChild(s);
  });
  return apiPromise;
}

async function getController(uri) {
  if (controller) return controller;
  controllerReady ??= loadIframeApi().then((api) => new Promise((resolve) => {
    const host = document.querySelector("#spHost");
    api.createController(host, { uri, width: "100%", height: 152 }, (c) => {
      c.addListener("playback_update", (e) => {
        const playing = !e.data.isPaused;
        if (playing !== player.playing) { player.playing = playing; player.onChange?.(); }
      });
      controller = c;
      resolve(c);
    });
  }));
  return controllerReady;
}

/** Pone algo en el reproductor flotante y lo hace sonar. */
export async function playInEmbed(type, id, title = "") {
  setEmbed(type, id);
  const uri = `spotify:${type}:${id}`;
  player.visible = true;
  player.title = title;
  document.querySelector("#miniPlayer")?.removeAttribute("hidden");
  player.onChange?.();
  try {
    const c = await getController(uri);
    if (loadedUri === uri) c.seek(0); // la misma canción: vuelve al inicio
    else c.loadUri(uri);
    loadedUri = uri;
    c.play();
  } catch {
    // Plan B: reproductor incrustado normal (hay que pulsar ▶) y se reintenta la API la próxima vez.
    apiPromise = null;
    controllerReady = null;
    const host = document.querySelector("#spHost");
    if (host) {
      host.innerHTML = `<iframe src="https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0" width="100%" height="152"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title="Spotify"></iframe>`;
    }
  }
}

/** Carga la canción en el reproductor (oculto) para que después suene al instante. */
export async function preloadEmbed(type, id) {
  const uri = `spotify:${type}:${id}`;
  try {
    const c = await getController(uri);
    if (loadedUri !== uri) { c.loadUri(uri); loadedUri = uri; }
    return true;
  } catch {
    apiPromise = null;
    controllerReady = null;
    return false;
  }
}

export function hidePlayer() {
  controller?.pause();
  player.visible = false;
  player.playing = false;
  document.querySelector("#miniPlayer")?.setAttribute("hidden", "");
  player.onChange?.();
}

/** Convierte un enlace de Spotify (open.spotify.com/... o spotify:...) en {type, id}. */
export function parseLink(link) {
  const m = /(?:open\.spotify\.com\/(?:intl-[a-z]+\/)?|spotify:)(track|album|playlist|artist|episode|show)[/:]([A-Za-z0-9]+)/.exec(link || "");
  return m ? { type: m[1], id: m[2] } : null;
}

export function presetFor(text) {
  const q = (text || "").toLowerCase();
  return PRESETS.find((p) => p.words.some((w) => q.includes(w))) || null;
}

// ---------- Interfaz ----------
const fmt = (ms) => (ms == null ? "" : `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`);

/** ctx = { t, esc, tile, icon, speak, onChange } */
export function renderMusic(body, ctx) {
  const { t, esc, tile, icon } = ctx;
  const connected = isConnected();
  const n = spotify.now;
  body.innerHTML = `
    <div class="music-grid">
      <section class="music-left">
        <div class="readout clap-box">
          <div class="k">${esc(t("clapTitle").toUpperCase())} · ${esc(ctx.clap.enabled ? t("on") : t("off"))}</div>
          <div class="v small">${esc(t("clapTitle"))} → ${esc(ctx.clap.songTitle)}</div>
          <div class="tiles">
            ${tile(esc(ctx.clap.enabled ? t("clapOff") : t("clapOn")), "", ctx.clap.enabled ? "on" : "")}
            ${tile(esc(t("clapTest")), "", "")}
            ${tile(esc(t("clapUseLink")), "", "")}
          </div>
          <div class="clap-sens">
            <span class="mono">${esc(t("clapSens").toUpperCase())}</span>
            <button class="tile" data-target data-sens="-1"><span class="t-main">−</span></button>
            <b class="mono">${ctx.clap.sens} / 5</b>
            <button class="tile" data-target data-sens="1"><span class="t-main">+</span></button>
            <span class="mono ${ctx.clap.listening() ? "up" : "down"}">● ${esc(ctx.clap.listening() ? t("clapListening") : t("clapIdle"))}</span>
          </div>
          <p class="muted">${esc(t("clapNote"))}</p>
        </div>
        <div class="tiles presets">${PRESETS.map((p) => tile(esc(t("sp_" + p.key)), "", spotify.embed.id === p.id ? "on" : "")).join("")}</div>
        <div class="form-row two">
          <input class="field" id="spLink" placeholder="${esc(t("sp_paste"))}">
          ${tile(esc(t("sp_open")), "", "")}
        </div>
      </section>
      <section class="music-right">
        ${connected ? `
          <div class="readout now">
            <div class="k">${esc(t("sp_now").toUpperCase())}${n?.device ? " · " + esc(n.device) : ""}</div>
            ${n ? `<div class="now-row">${n.image ? `<img src="${esc(n.image)}" alt="">` : ""}<div><b>${esc(n.title)}</b><small>${esc(n.artist)}</small><small class="mono">${fmt(n.progress)} / ${fmt(n.duration)}</small></div></div>`
              : `<p class="muted">${esc(t("sp_nothing"))}</p>`}
          </div>
          <div class="tiles transport">
            ${tile("⏮", "", "")}${tile(n?.playing ? "⏸" : "▶", "", "action")}${tile("⏭", "", "")}${tile("⟳", "", "")}
          </div>
          <div class="form-row two">
            <input class="field" id="spQuery" placeholder="${esc(t("sp_search"))}">
            ${tile(esc(t("search")), "", "")}
          </div>
          <div class="sp-results" id="spResults"></div>
          <div class="tiles">${tile(esc(t("sp_myLists")), "", "")}${tile(esc(t("sp_disconnect")), "", "")}</div>
          <p class="muted">${esc(t("sp_premiumNote"))}</p>`
        : `
          <div class="readout">
            <div class="k">${esc(t("sp_connect").toUpperCase())}</div>
            <ol class="steps">
              <li>${esc(t("sp_step1"))} <span class="mono">developer.spotify.com/dashboard</span></li>
              <li>${esc(t("sp_step2"))}</li>
              <li>${esc(t("sp_step3"))}<br><code class="mono sel">${esc(redirectUri())}</code></li>
              <li>${esc(t("sp_step4"))}</li>
            </ol>
            <div class="form-row two">
              <input class="field mono" id="spClient" placeholder="Client ID" value="${esc(spotify.clientId)}" spellcheck="false" autocomplete="off">
              ${tile(esc(t("sp_connectBtn")), "", "action")}
            </div>
            ${spotify.error ? `<p class="notice-err">${esc(t("sp_error"))} (${esc(spotify.error)})</p>` : ""}
          </div>
          <p class="muted">${esc(t("sp_noAccountNote"))}</p>`}
      </section>
    </div>
    <p class="muted" id="spMsg"></p>`;

  const msg = body.querySelector("#spMsg");
  const [clapToggle, clapTest, clapLink] = body.querySelectorAll(".clap-box .tiles .tile");
  body.querySelectorAll("[data-sens]").forEach((b) => b.addEventListener("click", () => { ctx.clap.setSens(ctx.clap.sens + Number(b.dataset.sens)); ctx.clap.sens = Math.min(5, Math.max(1, ctx.clap.sens + Number(b.dataset.sens))); renderMusic(body, ctx); }));
  clapToggle.addEventListener("click", () => { ctx.clap.toggle(); renderMusic(body, ctx); });
  clapTest.addEventListener("click", () => ctx.clap.fire());
  clapLink.addEventListener("click", () => {
    const p = parseLink(body.querySelector("#spLink").value);
    if (!p) { msg.textContent = t("clapPasteFirst"); return; }
    ctx.clap.setSong(p.type, p.id);
    renderMusic(body, ctx);
  });
  const fail = (e) => {
    msg.textContent = e.code === "premium" ? t("sp_errPremium") : e.code === "device" ? t("sp_errDevice") : e.code === "auth" ? t("sp_errAuth") : `${t("sp_error")} (${e.message})`;
  };

  body.querySelectorAll(".presets .tile").forEach((el, i) => el.addEventListener("click", () => {
    playInEmbed("playlist", PRESETS[i].id, t("sp_" + PRESETS[i].key));
    renderMusic(body, ctx);
  }));
  const linkIn = body.querySelector("#spLink");
  const openLink = () => {
    const p = parseLink(linkIn.value);
    if (!p) { msg.textContent = t("sp_badLink"); return; }
    playInEmbed(p.type, p.id);
    renderMusic(body, ctx);
  };
  linkIn.addEventListener("keydown", (e) => { if (e.key === "Enter") openLink(); });
  linkIn.parentElement.querySelector(".tile").addEventListener("click", openLink);

  if (!connected) {
    const input = body.querySelector("#spClient");
    body.querySelector(".music-right .tile.action").addEventListener("click", () => {
      const id = input.value.trim();
      if (!/^[0-9a-f]{32}$/i.test(id)) { msg.textContent = t("sp_badClient"); input.focus(); return; }
      login(id);
    });
    return;
  }

  const [prev, play, next, sync] = body.querySelectorAll(".transport .tile");
  prev.addEventListener("click", () => control("previous").then(() => later(body, ctx)).catch(fail));
  play.addEventListener("click", () => control(n?.playing ? "pause" : "play").then(() => later(body, ctx)).catch(fail));
  next.addEventListener("click", () => control("next").then(() => later(body, ctx)).catch(fail));
  sync.addEventListener("click", () => refreshNow().then(() => renderMusic(body, ctx)));

  const results = body.querySelector("#spResults");
  const showList = (items) => {
    results.innerHTML = items.map((it, i) => `<button class="sp-item" data-target data-i="${i}">
      ${it.image ? `<img src="${esc(it.image)}" alt="" loading="lazy">` : `<span class="ph"></span>`}
      <span><b>${esc(it.title)}</b><small>${esc(t("sp_type_" + it.type))}${it.sub ? " · " + esc(it.sub) : ""}</small></span></button>`).join("")
      || `<p class="muted">—</p>`;
    results.querySelectorAll(".sp-item").forEach((el) => el.addEventListener("click", () => {
      const it = items[Number(el.dataset.i)];
      // Con Premium suena en tu Spotify; si no se puede, en el reproductor flotante.
      playItem(it).then(() => later(body, ctx)).catch(() => playInEmbed(it.type, it.id, it.title));
    }));
  };
  const q = body.querySelector("#spQuery");
  const doSearch = () => q.value.trim() && search(q.value.trim()).then(showList).catch(fail);
  q.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });
  q.parentElement.querySelector(".tile").addEventListener("click", doSearch);
  const [mine, out] = body.querySelectorAll(".music-right > .tiles:not(.transport) .tile");
  mine.addEventListener("click", () => loadPlaylists().then(showList).catch(fail));
  out.addEventListener("click", () => { logout(); renderMusic(body, ctx); ctx.onChange?.(); });
  if (spotify.results.length) showList(spotify.results);
}

function later(body, ctx) {
  setTimeout(() => refreshNow().then(() => body.isConnected && renderMusic(body, ctx)), 900);
}
