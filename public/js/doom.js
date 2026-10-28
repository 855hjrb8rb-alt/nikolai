// Autodestrucción: una cuenta regresiva de 1 día. Cada hora el asistente se
// oxida más y se le van cayendo opciones; al llegar a cero se borra TODO en
// este dispositivo (memoria, ajustes, caché y el propio código) y no queda
// nada: solo cenizas. No se puede deshacer desde aquí.

const KEY = "nikolai.doom";
const TOMB = "nikolai.dead";
export const DOOM_HOURS = 24;
const HOUR = 3600_000;

// Orden en que se van "cayendo" las opciones, una por hora (de lo menos a lo
// más esencial). No incluye "doom" (para poder abortar hasta el final) ni
// "core". Lo último en caer es el SOS.
const KILL_ORDER = [
  "weather", "music", "news", "markets", "terminal", "studio", "watch", "translator",
  "language", "notes", "tools", "homework", "work", "projects", "money", "profile",
  "offline", "system", "settings", "help", "voice", "persona", "bots", "chat", "sos",
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function readState() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } }

export function isDead() { try { return Boolean(localStorage.getItem(TOMB)); } catch { return false; } }
export function doomArmed() { const s = readState(); return Boolean(s && s.start); }

export function armDoom(hours = DOOM_HOURS) {
  const s = { start: Date.now(), hours };
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* bloqueado */ }
  return s;
}
export function disarmDoom() { try { localStorage.removeItem(KEY); } catch { /* bloqueado */ } }

/** Estado derivado de la cuenta regresiva en un instante dado. */
export function doomInfo(now = Date.now()) {
  const s = readState();
  if (!s || !s.start) return { armed: false, fallen: [] };
  const hours = s.hours || DOOM_HOURS;
  const total = hours * HOUR;
  const elapsed = Math.max(0, now - s.start);
  const remaining = Math.max(0, total - elapsed);
  const progress = Math.min(1, elapsed / total);                       // 0..1 oxidación
  const hoursPassed = Math.min(hours, Math.floor(elapsed / HOUR));
  const fallen = KILL_ORDER.slice(0, Math.min(KILL_ORDER.length, hoursPassed));
  return { armed: true, hours, total, elapsed, remaining, progress, hoursPassed, fallen, dead: remaining <= 0 };
}

export function doomFallen(id, now = Date.now()) {
  const info = doomInfo(now);
  return info.armed && info.fallen.includes(id);
}

export function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(sec)}`;
}

/** Pinta la oxidación global: <html data-doom> + variable --rust (0..1). */
export function applyDoomVisual(now = Date.now()) {
  const info = doomInfo(now);
  const root = document.documentElement;
  if (!info.armed) { root.removeAttribute("data-doom"); root.style.removeProperty("--rust"); return info; }
  root.dataset.doom = info.dead ? "dead" : "on";
  root.style.setProperty("--rust", info.progress.toFixed(3));
  return info;
}

let destroying = false;
/** El final: borra TODO en este dispositivo y deja solo cenizas. Irreversible. */
export async function selfDestruct(t) {
  if (destroying) return;
  destroying = true;
  // 1) Todo el almacenamiento local de la app.
  try { for (const k of Object.keys(localStorage)) if (k.startsWith("nikolai")) localStorage.removeItem(k); } catch { /* */ }
  try { localStorage.clear(); } catch { /* */ }
  try { sessionStorage.clear(); } catch { /* */ }
  // 2) Bases de datos del navegador.
  try { const dbs = (await indexedDB.databases?.()) || []; dbs.forEach((d) => d.name && indexedDB.deleteDatabase(d.name)); } catch { /* */ }
  // 3) El código cacheado (PWA) y el service worker.
  try { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); } catch { /* */ }
  try { const regs = (await navigator.serviceWorker?.getRegistrations?.()) || []; await Promise.all(regs.map((r) => r.unregister())); } catch { /* */ }
  // 4) Lápida: para que al recargar siga destruido y nunca vuelva a arrancar.
  try { localStorage.setItem(TOMB, String(Date.now())); } catch { /* */ }
  renderAshes(t);
}

/** Pantalla final: cenizas. También se usa al recargar un dispositivo ya muerto. */
export function renderAshes(t) {
  const T = typeof t === "function" ? t : (k) => k;
  document.documentElement.setAttribute("data-doom", "dead");
  try { document.body.innerHTML = ""; } catch { /* */ }
  const wrap = document.createElement("div");
  wrap.className = "doom-dead";
  wrap.innerHTML = `
    <div class="doom-ash"></div>
    <div class="doom-dead-inner">
      <div class="doom-skull">⚰</div>
      <h1>${esc(T("doomDead1"))}</h1>
      <p>${esc(T("doomDead2"))}</p>
    </div>`;
  document.body.appendChild(wrap);
}
