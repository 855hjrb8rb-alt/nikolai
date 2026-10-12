// Módulos útiles: clima, calculadora, temporizador, emergencias (SOS), perfil y noticias.

import { renderInto, speakable } from "./md.js";

// =====================================================================
// Perfil (se guarda solo en este navegador)
// =====================================================================
export const profile = Object.assign(
  { name: "", birthday: "10-26", city: "", contactName: "", contactPhone: "", emergencyNumber: "911" },
  load("profile", {}),
);
function load(k, d) { try { return JSON.parse(localStorage.getItem("nikolai." + k)) ?? d; } catch { return d; } }
export function saveProfile() { try { localStorage.setItem("nikolai.profile", JSON.stringify(profile)); } catch { /* bloqueado */ } }

/** Días que faltan para el cumpleaños (0 = hoy), o null si no hay fecha. */
export function daysToBirthday(now = new Date()) {
  const m = /^(\d{2})-(\d{2})$/.exec(profile.birthday || "");
  if (!m) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), Number(m[1]) - 1, Number(m[2]));
  if (next < today) next = new Date(now.getFullYear() + 1, Number(m[1]) - 1, Number(m[2]));
  return Math.round((next - today) / 86_400_000);
}

export function renderProfile(body, ctx) {
  const { t, esc, tile } = ctx;
  const days = daysToBirthday();
  const [mm, dd] = (profile.birthday || "-").split("-");
  body.innerHTML = `
    <div class="readout bday ${days === 0 ? "today" : ""}">
      <div class="k">${esc(t("birthday").toUpperCase())}</div>
      <div class="v">${days === 0 ? esc(t("birthdayToday")) : days == null ? "—" : esc(t("daysLeft").replace("{n}", days))}</div>
    </div>
    <div class="form-grid">
      <label>${esc(t("name"))}<input class="field" id="pfName" value="${esc(profile.name)}" autocomplete="given-name"></label>
      <label>${esc(t("birthday"))}<input class="field" id="pfBday" type="date" value="2000-${esc(mm)}-${esc(dd)}"></label>
      <label>${esc(t("city"))}<input class="field" id="pfCity" value="${esc(profile.city)}" autocomplete="address-level2"></label>
      <label>${esc(t("contactName"))}<input class="field" id="pfCName" value="${esc(profile.contactName)}"></label>
      <label>${esc(t("contactPhone"))}<input class="field" id="pfCPhone" type="tel" value="${esc(profile.contactPhone)}" autocomplete="tel"></label>
      <label>${esc(t("emergencyNumber"))}<input class="field" id="pfEmerg" type="tel" value="${esc(profile.emergencyNumber)}"></label>
    </div>
    <div class="tiles">${tile(esc(t("save")), "", "action")}</div>
    <p class="muted">${esc(t("privacyNote"))}</p>`;
  body.querySelector(".tile.action").addEventListener("click", () => {
    const v = (id) => body.querySelector(id).value.trim();
    const date = v("#pfBday");
    Object.assign(profile, {
      name: v("#pfName"), city: v("#pfCity"), contactName: v("#pfCName"),
      contactPhone: v("#pfCPhone").replace(/[^\d+]/g, ""), emergencyNumber: v("#pfEmerg").replace(/[^\d+]/g, "") || "911",
      birthday: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(5) : profile.birthday,
    });
    saveProfile();
    ctx.onSaved?.();
    renderProfile(body, ctx);
  });
}

// =====================================================================
// Emergencias
// =====================================================================
/** Abre el marcador del teléfono. Una web no puede llamar sola: el teléfono pide confirmar. */
export function dial(number) {
  if (!number) return false;
  location.href = `tel:${number}`;
  return true;
}

export function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

export async function shareLocation(t) {
  const pos = await getLocation();
  const link = pos ? `https://maps.google.com/?q=${pos.lat.toFixed(5)},${pos.lon.toFixed(5)}` : "";
  const msg = `${t("sosMessage")} ${link}`.trim();
  if (profile.contactPhone) {
    location.href = `sms:${profile.contactPhone}?&body=${encodeURIComponent(msg)}`;
    return true;
  }
  if (navigator.share) {
    try { await navigator.share({ text: msg }); return true; } catch { /* cancelado */ }
  }
  return false;
}

let siren = null;
export function toggleSiren() {
  if (siren) { siren.stop(); siren = null; return false; }
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ac.createOscillator(), gain = ac.createGain();
  osc.type = "sawtooth";
  gain.gain.value = 0.25;
  osc.connect(gain).connect(ac.destination);
  const lfo = setInterval(() => { osc.frequency.setTargetAtTime(osc.frequency.value > 900 ? 600 : 1200, ac.currentTime, 0.15); }, 450);
  osc.frequency.value = 600;
  osc.start();
  siren = { stop: () => { clearInterval(lfo); osc.stop(); ac.close(); } };
  return true;
}

export function renderSos(body, ctx) {
  const { t, esc, tile, icon } = ctx;
  const hasContact = Boolean(profile.contactPhone);
  body.innerHTML = `
    <div class="tiles sos-tiles">
      ${tile(`${icon("phone")}<br>${esc(t("callServices"))} ${esc(profile.emergencyNumber)}`, "", "action sos")}
      ${tile(`${icon("phone")}<br>${esc(t("callContact"))}`, hasContact ? esc(profile.contactName || profile.contactPhone) : esc(t("noContact")), "action" + (hasContact ? "" : " disabled"))}
      ${tile(`${icon("pin")}<br>${esc(t("sendLocation"))}`, "", "action")}
      ${tile(`${icon("siren")}<br>${esc(siren ? t("sirenOff") : t("siren"))}`, "", "action" + (siren ? " live" : ""))}
    </div>
    <p class="muted">${esc(t("sosNote"))}</p>
    ${hasContact ? "" : `<div class="tiles">${tile(esc(t("addContact")), "", "")}</div>`}`;
  const [svc, contact, loc, sir, add] = body.querySelectorAll(".tile");
  svc.addEventListener("click", () => dial(profile.emergencyNumber));
  contact.addEventListener("click", () => (hasContact ? dial(profile.contactPhone) : ctx.open("profile")));
  loc.addEventListener("click", () => shareLocation(t));
  sir.addEventListener("click", () => { toggleSiren(); renderSos(body, ctx); });
  add?.addEventListener("click", () => ctx.open("profile"));
}

// =====================================================================
// Clima (Open-Meteo, sin clave)
// =====================================================================
// El último clima se guarda para poder consultarlo sin internet.
export const weather = Object.assign(
  { place: "", data: null, error: "", loading: false, at: 0 },
  (() => { try { return JSON.parse(localStorage.getItem("nikolai.weather")) || {}; } catch { return {}; } })(),
);

const WMO = {
  0: ["clear", "☀"], 1: ["mainlyClear", "🌤"], 2: ["partlyCloudy", "⛅"], 3: ["overcast", "☁"], 45: ["fog", "🌫"], 48: ["fog", "🌫"],
  51: ["drizzle", "🌦"], 53: ["drizzle", "🌦"], 55: ["drizzle", "🌦"], 61: ["rain", "🌧"], 63: ["rain", "🌧"], 65: ["heavyRain", "🌧"],
  71: ["snow", "🌨"], 73: ["snow", "🌨"], 75: ["snow", "🌨"], 80: ["showers", "🌦"], 81: ["showers", "🌦"], 82: ["heavyRain", "⛈"],
  95: ["storm", "⛈"], 96: ["storm", "⛈"], 99: ["storm", "⛈"],
};
export const wmo = (code) => WMO[code] || ["unknown", "·"];

async function geocode(name, lang) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=${lang}`);
  const j = await r.json();
  const g = j.results?.[0];
  if (!g) throw new Error("not found");
  return { lat: g.latitude, lon: g.longitude, place: [g.name, g.admin1, g.country_code].filter(Boolean).join(", ") };
}

export async function loadWeather(lang, city = profile.city) {
  weather.loading = true;
  weather.error = "";
  try {
    let loc = null;
    if (city) loc = await geocode(city, lang);
    else {
      const pos = await getLocation();
      if (pos) loc = { ...pos, place: "" };
    }
    if (!loc) throw new Error("no location");
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
      "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day" +
      "&hourly=temperature_2m,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset" +
      "&timezone=auto&forecast_days=7";
    const r = await fetch(url);
    weather.data = await r.json();
    weather.place = loc.place;
    weather.at = Date.now();
    try { localStorage.setItem("nikolai.weather", JSON.stringify({ data: weather.data, place: weather.place, at: weather.at })); } catch { /* lleno */ }
  } catch (e) {
    weather.error = e.message;
  } finally {
    weather.loading = false;
  }
}

export function renderWeather(body, ctx) {
  const { t, esc, tile, lang } = ctx;
  const d = weather.data;
  const head = `
    <div class="form-row">
      <input class="field" id="wxCity" placeholder="${esc(t("city"))}" value="${esc(profile.city)}">
      ${tile(esc(t("search")), "", "")}${tile(esc(t("myLocation")), "", "")}
    </div>`;
  if (!d || weather.loading) {
    body.innerHTML = head + `<p class="muted">${esc(weather.error ? t("wxError") : t("loading"))}</p>`;
  } else {
    const c = d.current;
    const [key, glyph] = wmo(c.weather_code);
    const hours = d.hourly.temperature_2m.slice(0, 24);
    const min = Math.min(...hours), max = Math.max(...hours);
    const pts = hours.map((v, i) => `${(i / 23) * 100},${30 - ((v - min) / (max - min || 1)) * 26}`).join(" ");
    body.innerHTML = head + `
      <div class="wx-now">
        <span class="wx-glyph">${glyph}</span>
        <div><div class="wx-temp">${Math.round(c.temperature_2m)}°</div><div class="wx-desc">${esc(t("wx_" + key))}${weather.place ? " · " + esc(weather.place) : ""}</div></div>
      </div>
      <div class="grid-stats">
        <div class="readout"><div class="k">${esc(t("feelsLike"))}</div><div class="v">${Math.round(c.apparent_temperature)}°</div></div>
        <div class="readout"><div class="k">${esc(t("humidity"))}</div><div class="v">${c.relative_humidity_2m}%</div></div>
        <div class="readout"><div class="k">${esc(t("wind"))}</div><div class="v">${Math.round(c.wind_speed_10m)} km/h</div></div>
        <div class="readout"><div class="k">${esc(t("rainChance"))}</div><div class="v">${d.daily.precipitation_probability_max[0] ?? 0}%</div></div>
      </div>
      <div class="readout"><div class="k">24 H · ${Math.round(min)}° – ${Math.round(max)}°</div>
        <svg viewBox="0 0 100 32" preserveAspectRatio="none" class="wx-spark"><polyline points="${pts}"/></svg></div>
      <div class="wx-days">${d.daily.time.map((day, i) => {
        const [, g] = wmo(d.daily.weather_code[i]);
        return `<div class="wx-day"><span class="mono">${new Date(day + "T12:00").toLocaleDateString(lang, { weekday: "short" })}</span><span class="g">${g}</span><b>${Math.round(d.daily.temperature_2m_max[i])}°</b><small>${Math.round(d.daily.temperature_2m_min[i])}°</small></div>`;
      }).join("")}</div>
      <div class="tiles">${tile(`${ctx.icon("speaker")}<br>${esc(t("readAloud"))}`, "", "action")}</div>`;
    body.querySelector(".tile.action").addEventListener("click", () => ctx.speak(weatherSentence(t)));
  }
  const [search, here] = body.querySelectorAll(".form-row .tile");
  const input = body.querySelector("#wxCity");
  const go = async (city) => { profile.city = city; saveProfile(); weather.loading = true; weather.error = ""; renderWeather(body, ctx); await loadWeather(lang, city); if (body.isConnected) renderWeather(body, ctx); ctx.onUpdate?.(); };
  search.addEventListener("click", () => go(input.value.trim()));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(input.value.trim()); });
  here.addEventListener("click", () => go(""));
  if (!d && !weather.loading && !weather.error) go(profile.city);
}

export function weatherSentence(t) {
  const d = weather.data;
  if (!d) return t("wxError");
  const c = d.current;
  return t("wxSay")
    .replace("{place}", weather.place || "")
    .replace("{temp}", Math.round(c.temperature_2m))
    .replace("{desc}", t("wx_" + wmo(c.weather_code)[0]))
    .replace("{max}", Math.round(d.daily.temperature_2m_max[0]))
    .replace("{min}", Math.round(d.daily.temperature_2m_min[0]))
    .replace("{rain}", d.daily.precipitation_probability_max[0] ?? 0);
}

// =====================================================================
// Herramientas: calculadora y temporizador
// =====================================================================
export const timer = { total: 25 * 60, left: 25 * 60, running: false, endAt: 0, handle: null, onDone: null, onTick: null };

export function startTimer(seconds) {
  if (seconds) { timer.total = seconds; timer.left = seconds; }
  if (timer.left <= 0) timer.left = timer.total;
  timer.running = true;
  timer.endAt = Date.now() + timer.left * 1000;
  clearInterval(timer.handle);
  timer.handle = setInterval(() => {
    timer.left = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
    timer.onTick?.();
    if (timer.left === 0) {
      clearInterval(timer.handle);
      timer.running = false;
      beep();
      timer.onDone?.();
    }
  }, 250);
}
export function pauseTimer() { clearInterval(timer.handle); timer.running = false; timer.onTick?.(); }
export function resetTimer() { pauseTimer(); timer.left = timer.total; timer.onTick?.(); }
export const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((at) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.3, ac.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + at + 0.3);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + at);
      o.stop(ac.currentTime + at + 0.3);
    });
    setTimeout(() => ac.close(), 1500);
  } catch { /* sin audio */ }
}

/** Evalúa una operación de forma segura (solo números y operadores). */
export function calc(expr) {
  const src = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/√/g, "sqrt").replace(/π/g, "pi").replace(/\^/g, "**").replace(/,/g, ".");
  if (!/^[\d+\-*/().%\s]*(?:(?:sqrt|sin|cos|tan|log|ln|pi)[\d+\-*/().%\s]*)*$/.test(src)) throw new Error("bad");
  const js = src
    .replace(/(\d+(?:\.\d+)?)%/g, "($1/100)")
    .replace(/sqrt/g, "Math.sqrt").replace(/sin/g, "Math.sin").replace(/cos/g, "Math.cos").replace(/tan/g, "Math.tan")
    .replace(/log/g, "Math.log10").replace(/ln/g, "Math.log").replace(/pi/g, "Math.PI");
  const v = Function(`"use strict";return (${js || 0})`)();
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error("bad");
  return Math.round(v * 1e10) / 1e10;
}

let calcExpr = "", calcResult = "";
const KEYS = ["C", "(", ")", "÷", "7", "8", "9", "×", "4", "5", "6", "-", "1", "2", "3", "+", "0", ".", "⌫", "=", "√", "^", "%", "π"];

export function renderTools(body, ctx) {
  const { t, esc, tile } = ctx;
  body.innerHTML = `
    <div class="tools-grid">
      <section>
        <div class="readout calc-display"><div class="k">${esc(t("calculator").toUpperCase())}</div>
          <div class="calc-expr mono">${esc(calcExpr) || "0"}</div><div class="v calc-res mono">${esc(calcResult)}</div></div>
        <div class="calc-keys">${KEYS.map((k) => `<button class="tile ${"=÷×-+".includes(k) ? "op" : ""}" data-target data-k="${esc(k)}"><span class="t-main">${esc(k)}</span></button>`).join("")}</div>
      </section>
      <section>
        <div class="readout"><div class="k">${esc(t("timer").toUpperCase())}</div><div class="timer-big mono" id="tmLeft">${fmtTime(timer.left)}</div>
          <div class="meter"><i style="width:${(1 - timer.left / timer.total) * 100}%"></i></div></div>
        <div class="tiles timer-presets">${[5, 15, 25, 45].map((m) => tile(`${m}`, esc(t("minutes")).toUpperCase(), timer.total === m * 60 ? "on" : "")).join("")}</div>
        <div class="tiles">${tile(esc(timer.running ? t("pause") : t("start")), "", "action" + (timer.running ? " live" : ""))}${tile(esc(t("reset")), "", "")}</div>
      </section>
    </div>`;
  body.querySelectorAll("[data-k]").forEach((el) => el.addEventListener("click", () => {
    const k = el.dataset.k;
    if (k === "C") { calcExpr = ""; calcResult = ""; }
    else if (k === "⌫") calcExpr = calcExpr.slice(0, -1);
    else if (k === "=") {
      try { calcResult = String(calc(calcExpr)); } catch { calcResult = t("calcError"); }
    } else calcExpr += k === "√" ? "√(" : k;
    renderTools(body, ctx);
  }));
  const sec = body.querySelectorAll("section")[1];
  const [p5, p15, p25, p45, play, reset] = sec.querySelectorAll(".tile");
  [p5, p15, p25, p45].forEach((el, i) => el.addEventListener("click", () => { pauseTimer(); timer.total = timer.left = [5, 15, 25, 45][i] * 60; renderTools(body, ctx); }));
  play.addEventListener("click", () => { timer.running ? pauseTimer() : startTimer(); renderTools(body, ctx); });
  reset.addEventListener("click", () => { resetTimer(); renderTools(body, ctx); });
}

// =====================================================================
// Noticias (resumen con búsqueda web)
// =====================================================================
const TOPICS = ["top", "local", "world", "economy", "tech", "sports", "science", "entertainment"];
export const news = Object.assign(
  { topic: "top", text: "", busy: false, at: 0 },
  (() => { try { return JSON.parse(localStorage.getItem("nikolai.news")) || {}; } catch { return {}; } })(),
  { busy: false },
);

export function renderNews(body, ctx) {
  const { t, esc, tile, icon } = ctx;
  body.innerHTML = `
    <div class="tiles">${TOPICS.map((k) => tile(esc(t("nw_" + k)), "", news.topic === k ? "on" : "")).join("")}</div>
    <div class="tiles">${tile(`${icon("send")}<br>${esc(news.busy ? t("thinking") : t("nw_get"))}`, "", "action" + (news.busy ? " live" : ""))}${tile(`${icon("speaker")}<br>${esc(t("readAloud"))}`, "", "action")}</div>
    <div class="hw-out" id="nwOut"></div>`;
  body.querySelectorAll(".tiles:first-child .tile").forEach((el, i) => el.addEventListener("click", () => { news.topic = TOPICS[i]; renderNews(body, ctx); fetchNews(body, ctx); }));
  const [get, read] = body.querySelectorAll(".tiles:nth-child(2) .tile");
  get.addEventListener("click", () => fetchNews(body, ctx));
  read.addEventListener("click", () => news.text && ctx.speak(speakable(news.text)));
  const out = body.querySelector("#nwOut");
  if (news.text) renderInto(out, news.text);
  else out.innerHTML = `<p class="muted">${esc(t("nw_hint"))}</p>`;
}

async function fetchNews(body, ctx) {
  if (news.busy) return;
  news.busy = true;
  news.text = "";
  renderNews(body, ctx);
  const out = body.querySelector("#nwOut");
  const where = profile.city || ctx.t("nw_defaultRegion");
  const ask = ctx.t("nw_prompt").replace("{topic}", ctx.t("nw_" + news.topic)).replace("{place}", where);
  let full = "";
  try {
    const err = await ctx.stream(
      { messages: [{ role: "user", content: ask }], mode: "news", channel: "text" },
      { onText: (d) => { full += d; if (out.isConnected) renderInto(out, full); } },
    );
    news.text = full || ctx.errorText(err);
    news.at = Date.now();
    if (full) { try { localStorage.setItem("nikolai.news", JSON.stringify({ topic: news.topic, text: news.text, at: news.at })); } catch { /* lleno */ } }
  } catch {
    news.text = ctx.t("errGeneric");
  } finally {
    news.busy = false;
    if (body.isConnected) renderNews(body, ctx);
  }
}
