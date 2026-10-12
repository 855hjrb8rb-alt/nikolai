// Terminal de Wall Street: horario de las bolsas, campana de apertura,
// lista de favoritos, análisis de acciones y resumen del mercado con IA.

// ---------- Horario de las bolsas ----------
// Festivos de la Bolsa de Nueva York (NYSE / Nasdaq) y cierres anticipados (13:00).
const NYSE_HOLIDAYS = new Set([
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03",
  "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05",
  "2027-09-06", "2027-11-25", "2027-12-24",
]);
const NYSE_EARLY = new Set(["2026-11-27", "2026-12-24", "2027-11-26"]);

export const EXCHANGES = [
  { id: "nyse", name: "NYSE · Nasdaq", city: "Nueva York", tz: "America/New_York", sessions: [[570, 960]], pre: [240, 570], post: [960, 1200], holidays: NYSE_HOLIDAYS, early: NYSE_EARLY },
  { id: "bmv", name: "BMV", city: "Ciudad de México", tz: "America/Mexico_City", sessions: [[510, 900]] },
  { id: "lse", name: "LSE", city: "Londres", tz: "Europe/London", sessions: [[480, 990]] },
  { id: "tse", name: "TSE", city: "Tokio", tz: "Asia/Tokyo", sessions: [[540, 690], [750, 930]] },
];

/** Fecha y hora "de pared" en una zona horaria: {date: "AAAA-MM-DD", min: minutos del día, dow: 0-6}. */
export function wallClock(tz, at = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(at).map((p) => [p.type, p.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, min: Number(parts.hour) * 60 + Number(parts.minute) + Number(parts.second) / 60, dow };
}

function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return { date: d.toISOString().slice(0, 10), dow: d.getUTCDay() };
}

function sessionsOn(ex, date, dow) {
  if (dow === 0 || dow === 6 || ex.holidays?.has(date)) return [];
  if (ex.early?.has(date)) return [[ex.sessions[0][0], 780]];
  return ex.sessions;
}

/**
 * Estado de una bolsa: "open", "pre", "post", "break" (pausa de mediodía) o "closed",
 * y los minutos hasta el próximo cambio (apertura o cierre).
 */
export function exchangeStatus(ex, at = new Date()) {
  const now = wallClock(ex.tz, at);
  const today = sessionsOn(ex, now.date, now.dow);
  for (const [o, c] of today) {
    if (now.min >= o && now.min < c) return { state: "open", minutes: c - now.min, next: "close" };
  }
  const isTradingDay = today.length > 0;
  // Próxima apertura (hoy más tarde o en los próximos días hábiles).
  let toOpen = null;
  for (const [o] of today) if (o > now.min) { toOpen = o - now.min; break; }
  for (let d = 1; toOpen == null && d < 12; d++) {
    const day = addDays(now.date, d);
    const s = sessionsOn(ex, day.date, day.dow);
    if (s.length) toOpen = d * 1440 + s[0][0] - now.min;
  }
  let state = "closed";
  if (isTradingDay && ex.pre && now.min >= ex.pre[0] && now.min < ex.pre[1]) state = "pre";
  else if (isTradingDay && ex.post && now.min >= today[0][1] && now.min < ex.post[1]) state = "post";
  else if (isTradingDay && today.length > 1 && now.min > today[0][1] && now.min < today[today.length - 1][0]) state = "break";
  return { state, minutes: toOpen, next: "open" };
}

export function fmtCountdown(min) {
  if (min == null) return "—";
  const m = Math.max(0, Math.round(min));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  return d ? `${d}d ${h}h ${mm}m` : h ? `${h}h ${String(mm).padStart(2, "0")}m` : `${mm}m`;
}

// ---------- Campana de apertura ----------
let lastNyse = null;
/** Llama a onBell cuando la NYSE pasa a abierta (comprobar cada ~20 s). */
export function watchOpeningBell(onBell) {
  const tick = () => {
    const s = exchangeStatus(EXCHANGES[0]).state;
    if (lastNyse && lastNyse !== "open" && s === "open") onBell();
    lastNyse = s;
  };
  tick();
  return setInterval(tick, 20_000);
}

/** Campana sintetizada (tres golpes metálicos). */
export function ringBell() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.45, 0.9].forEach((at) => {
      [523.25, 1046.5, 1567.98, 2637].forEach((hz, i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = hz;
        const t0 = ac.currentTime + at;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.18 / (i + 1), t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6 - i * 0.25);
        o.connect(g).connect(ac.destination);
        o.start(t0);
        o.stop(t0 + 1.7);
      });
    });
    setTimeout(() => ac.close(), 3500);
  } catch { /* sin audio */ }
}

// ---------- Índice de miedo y codicia (cripto) ----------
export const fearGreed = { value: null, label: "", at: 0 };
export async function loadFearGreed() {
  if (Date.now() - fearGreed.at < 10 * 60_000 && fearGreed.value != null) return fearGreed;
  try {
    const j = await (await fetch("https://api.alternative.me/fng/?limit=1")).json();
    fearGreed.value = Number(j.data?.[0]?.value);
    fearGreed.label = j.data?.[0]?.value_classification || "";
    fearGreed.at = Date.now();
  } catch { /* sin datos */ }
  return fearGreed;
}

// ---------- Mi lista (favoritos) ----------
const WATCH_KEY = "nikolai.watchlist";
export const watchlist = (() => {
  try { return JSON.parse(localStorage.getItem(WATCH_KEY)) || null; } catch { return null; }
})() || ["NASDAQ:AAPL", "NASDAQ:NVDA", "NASDAQ:MSFT", "NASDAQ:TSLA", "NYSE:JPM", "BMV:AMXB"];
const saveWatch = () => { try { localStorage.setItem(WATCH_KEY, JSON.stringify(watchlist)); } catch { /* bloqueado */ } };

/** "aapl" → "AAPL", "nasdaq:aapl" → "NASDAQ:AAPL". */
export function normalizeSymbol(s) {
  return String(s || "").trim().toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9:._!-]/g, "");
}
export function addWatch(sym) {
  const s = normalizeSymbol(sym);
  if (s && !watchlist.includes(s)) { watchlist.unshift(s); saveWatch(); }
}
export function removeWatch(sym) {
  const i = watchlist.indexOf(sym);
  if (i >= 0) { watchlist.splice(i, 1); saveWatch(); }
}
