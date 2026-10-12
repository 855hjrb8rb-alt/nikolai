// NIKOLAI — interfaz de solo voz y manos: carrusel 3D de módulos, ciclo de voz
// continuo (escuchar → pensar → hablar → escuchar) y cursor controlado con el dedo.

import { LANGS, t, setLang, getLang, detectBrowserLang } from "./i18n.js";
import { Listener, Speaker, MicMeter, voicesFor, stripWakeWord, speechSupported } from "./voice.js";
import { GestureController } from "./gestures.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- Preferencias (este navegador) ----------
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("nikolai." + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("nikolai." + k, JSON.stringify(v)); } catch { /* bloqueado */ } },
};
const settings = Object.assign(
  { mode: "conversation", voiceName: "", rate: 1, pitch: 0.9, poke: true, pinch: true, dwell: true, showCam: true, smoothing: 0.4, target: "en" },
  store.get("settings", {}),
);
const saveSettings = () => store.set("settings", settings);
let notes = store.get("notes", []);

// ---------- Iconos de línea ----------
const ICON = {
  core: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  voice: '<path d="M3 12h1.5M6 8v8M9 5v14M12 9v6M15 6v12M18 9v6M21 12h-1.5"/>',
  language: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18M4.5 7.5h15M4.5 16.5h15"/>',
  translator: '<path d="M3 5h9M7.5 3v2M5 5c.5 3.5 3 6 6.5 7.5M10 5c-.8 3.6-3 6.4-6.5 8"/><path d="M12.5 21l4.25-10L21 21M14 17.5h5.5"/>',
  notes: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h7M9 14.5h7M9 18h4"/>',
  system: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4.5-5"/><circle cx="12" cy="17" r="1.3"/><path d="M6.5 13.5l1 .6M12 9v1.2M17.5 13.5l-1 .6"/>',
  settings: '<path d="M12 21v-6.5"/><path d="M9 9.5V4.8a1.4 1.4 0 0 1 2.8 0v5.7M11.8 10V3.6a1.4 1.4 0 0 1 2.8 0V10M14.6 10.2V5.5a1.4 1.4 0 0 1 2.8 0v7.3a6.2 6.2 0 0 1-6.2 6.2h-.6a6 6 0 0 1-5-2.7L3.3 12.4a1.4 1.4 0 0 1 2.3-1.6L9 13.5"/>',
  help: '<path d="M12 2l8.5 5v10L12 22l-8.5-5V7z"/><path d="M12 7l4.3 2.5v5L12 17l-4.3-2.5v-5z"/><circle cx="12" cy="12" r="1.2"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  speaker: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24">${ICON[name]}</svg>`;

const MODULES = ["core", "voice", "language", "translator", "notes", "system", "settings", "help"];
const titleOf = (id) => t(id === "settings" ? "gestures" : id);
const tagOf = (id) => `M-${String(MODULES.indexOf(id) + 1).padStart(2, "0")}`;

// ---------- Telemetría real ----------
const series = { mic: [], fps: [], hand: [], latency: [] };
const pushSeries = (k, v, max = 60) => { series[k].push(v); if (series[k].length > max) series[k].shift(); };
const stats = { responses: 0, lastLatency: null, translations: 0, lastTranslation: "" };
let brain = { ok: false, apiKey: false, model: "" };
let battery = null;
navigator.getBattery?.().then((b) => { battery = b; }).catch(() => {});

// ---------- Elementos ----------
const ui = {
  stage: $("#stage"), carousel: $("#carousel"), panel: $("#panel"), panelTag: $("#panelTag"), panelTitle: $("#panelTitle"),
  panelBody: $("#panelBody"), heard: $("#heard"), reply: $("#reply"), voiceBar: $("#voiceBar"), vbState: $("#vbState"),
  vbHint: $("#vbHint"), wave: $("#vbWave"), nav: $("#navLabel"), langState: $("#langState"), clock: $("#clock"),
  sideLeft: $("#sideLeft"), sideRight: $("#sideRight"), cursor: $("#cursor"), sensor: $("#sensor"), camStart: $("#camStart"),
};

// =====================================================================
// Carrusel 3D
// =====================================================================
let focus = 0;
let openId = null;

function cardBody(id) {
  const spark = (key, label) => `<div class="tele-label mono">${esc(t("telemetry").toUpperCase())} · ${label}</div><canvas class="spark" data-series="${key}"></canvas>`;
  const stat = (k, bind, accent = "") => `<div class="stat"><div class="k mono">${esc(t(k).toUpperCase())}</div><div class="v ${accent}" data-bind="${bind}">—</div></div>`;
  switch (id) {
    case "core": return spark("latency", "MS") + `<div class="stats">${stat("responses", "responses")}${stat("latency", "latency", "accent")}</div>`;
    case "voice": return spark("mic", "MIC") + `<div class="stats">${stat("speed", "rate")}${stat("active", "voiceShort", "accent")}</div>`;
    case "language": return `<div class="big-code" data-bind="langCode">ES</div><div class="stats">${stat("active", "langName")}${stat("available", "langCount", "accent")}</div>`;
    case "translator": return `<p class="desc" data-bind="lastTranslation" style="flex:1"></p><div class="stats">${stat("translations", "translations")}${stat("target", "targetCode", "accent")}</div>`;
    case "notes": return `<p class="desc" data-bind="lastNote" style="flex:1"></p><div class="stats">${stat("notes", "notesCount")}${stat("last", "lastNoteTime", "accent")}</div>`;
    case "system": return spark("fps", "FPS") + `<div class="stats">${stat("camera", "fps")}${stat("battery", "battery", "accent")}</div>`;
    case "settings": return spark("hand", t("hand").toUpperCase()) + `<div class="stats">${stat("hand", "handState")}${stat("smoothing", "smoothing", "accent")}</div>`;
    case "help": return `<p class="desc" style="flex:1">${esc(t("voiceHelp"))}</p><div class="stats">${stat("gestures", "gestureCount")}${stat("language", "langCount2", "accent")}</div>`;
  }
  return "";
}

function buildCarousel() {
  ui.carousel.innerHTML = "";
  MODULES.forEach((id, i) => {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.target = "";
    card.dataset.id = id;
    card.dataset.index = i;
    card.innerHTML = `
      <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
      <div class="card-head mono"><span class="card-id">${tagOf(id)}</span><span class="online" data-bind="status-${id}">● ONLINE</span></div>
      <div class="card-rule"></div>
      <div class="glyph">${icon(id)}</div>
      <h3>${esc(titleOf(id))}</h3>
      <p class="desc">${esc(t(id === "settings" ? "gesturesDesc" : id + "Desc"))}</p>
      ${cardBody(id)}`;
    card.addEventListener("click", () => {
      if (Number(card.dataset.index) === focus) openPanel(id);
      else setFocus(Number(card.dataset.index));
    });
    ui.carousel.appendChild(card);
  });
  layoutCarousel();
  updateCards();
}

function layoutCarousel() {
  const n = MODULES.length;
  // En pantallas estrechas el anillo se abre para que los laterales no tapen el central.
  const narrow = innerWidth < 760;
  const R = Math.round(narrow ? innerWidth * 1.15 : Math.min(780, Math.max(420, innerWidth * 0.5)));
  document.documentElement.style.setProperty("--R", `${R}px`);
  document.documentElement.style.setProperty("--depth", narrow ? "120px" : "250px");
  [...ui.carousel.children].forEach((card, i) => {
    let o = (((i - focus) % n) + n) % n;
    if (o > n / 2) o -= n;
    card.style.setProperty("--a", `${o * -40}deg`);
    card.classList.toggle("focus", o === 0);
    card.classList.toggle("far", Math.abs(o) === 2);
    card.classList.toggle("gone", Math.abs(o) > 2);
  });
  ui.nav.innerHTML = `<b>${tagOf(MODULES[focus])}</b> · ${esc(titleOf(MODULES[focus]).toUpperCase())} · ${esc(t("tapNav"))}`;
}

function setFocus(i) {
  const n = MODULES.length;
  focus = ((i % n) + n) % n;
  layoutCarousel();
}

function values() {
  const voice = voicesFor(LANGS[getLang()].speech).find((v) => v.name === settings.voiceName) || voicesFor(LANGS[getLang()].speech)[0];
  const last = notes[0];
  return {
    responses: stats.responses,
    latency: stats.lastLatency == null ? "—" : `${stats.lastLatency}`,
    rate: `${settings.rate.toFixed(1)}×`,
    voiceShort: voice ? voice.name.replace(/^(Microsoft|Google|Apple)\s*/i, "").split(/[\s(-]/)[0] : "—",
    langCode: LANGS[getLang()].short,
    langName: LANGS[getLang()].name,
    langCount: Object.keys(LANGS).length,
    langCount2: Object.keys(LANGS).length,
    translations: stats.translations,
    targetCode: LANGS[settings.target].short,
    lastTranslation: stats.lastTranslation,
    notesCount: notes.length,
    lastNote: last ? `“${last.text}”` : t("noNotes"),
    lastNoteTime: last ? new Date(last.at).toLocaleTimeString(getLang(), { hour: "2-digit", minute: "2-digit" }) : "—",
    fps: gestures?.running ? `${gestures.fps}` : "OFF",
    battery: battery ? `${Math.round(battery.level * 100)}%` : "—",
    handState: gestures?.handVisible ? "✓" : "—",
    smoothing: settings.smoothing.toFixed(2),
    gestureCount: t("helpItems").length,
  };
}

function updateCards() {
  const v = values();
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const k = el.dataset.bind;
    if (k.startsWith("status-")) {
      const id = k.slice(7);
      const live = id === "core" ? brain.apiKey : id === "settings" || id === "system" ? Boolean(gestures?.running) : true;
      el.textContent = live ? "● ONLINE" : "○ STANDBY";
      el.classList.toggle("idle", !live);
    } else if (k in v) el.textContent = v[k];
  });
  document.querySelectorAll("canvas.spark").forEach(drawSpark);
}

function drawSpark(cv) {
  const data = series[cv.dataset.series] || [];
  const dpr = devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(176,200,255,.12)";
  ctx.lineWidth = 1;
  for (let y = h / 4; y < h; y += h / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  if (data.length < 2) return;
  const max = Math.max(...data, 1e-6), min = Math.min(...data, 0);
  const X = (i) => (i / (data.length - 1)) * w;
  const Y = (v) => h - 4 - ((v - min) / (max - min || 1)) * (h - 10);
  const focused = cv.closest(".card")?.classList.contains("focus");
  const color = focused ? "255,204,92" : "155,140,255";
  ctx.beginPath();
  data.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.strokeStyle = `rgba(${color},1)`;
  ctx.lineWidth = 1.6;
  ctx.shadowColor = `rgba(${color},.8)`;
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgba(${color},.28)`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fill();
}

// =====================================================================
// Módulos abiertos (todo se maneja con el dedo o la voz)
// =====================================================================
function openPanel(id) {
  if (!MODULES.includes(id)) return;
  clearInterval(panelTimer);
  openId = id;
  setFocus(MODULES.indexOf(id));
  ui.panel.hidden = false;
  ui.stage.classList.add("dimmed");
  ui.panelTag.textContent = tagOf(id);
  ui.panelTitle.textContent = titleOf(id);
  ui.panelBody.innerHTML = "";
  PANEL[id](ui.panelBody);
}
let panelTimer = null;
function closePanel() {
  clearInterval(panelTimer);
  openId = null;
  ui.panel.hidden = true;
  ui.stage.classList.remove("dimmed");
}
const refreshPanel = () => openId && openPanel(openId);

function tile(main, sub = "", cls = "") {
  return `<button class="tile ${cls}" data-target><span class="t-main">${main}</span>${sub ? `<span class="t-sub">${sub}</span>` : ""}</button>`;
}
function stepper(label, value) {
  return `<div class="stepper"><button class="tile" data-target data-step="-1">−</button><div class="val"><b>${value}</b><span>${esc(label)}</span></div><button class="tile" data-target data-step="1">+</button></div>`;
}
function bindStepper(root, onStep) {
  root.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => onStep(Number(b.dataset.step))));
}
const readout = (k, v, small = false) => `<div class="readout"><div class="k">${esc(k)}</div><div class="v ${small ? "small" : ""}">${esc(v)}</div></div>`;

const PANEL = {
  core(body) {
    body.innerHTML = `
      <div class="tiles wide">
        ${tile(`${icon("mic")}<br>${esc(voiceOn ? t("pauseVoice") : t("startVoice"))}`, "", "action" + (voiceOn ? " live" : ""))}
        ${tile(esc(t("modeConversation")), t("mode").toUpperCase(), settings.mode === "conversation" ? "on" : "")}
        ${tile(esc(t("modeWake")), t("mode").toUpperCase(), settings.mode === "wake" ? "on" : "")}
      </div>
      ${readout(t("heardLabel"), lastHeard || "—", true)}
      ${readout("NIKOLAI", lastReply || t("greeting"))}
      <p class="muted">${esc(t("voiceHelp"))}</p>`;
    const [toggle, conv, wake] = body.querySelectorAll(".tile");
    toggle.onclick = () => { toggleVoice(); refreshPanel(); };
    conv.onclick = () => { settings.mode = "conversation"; saveSettings(); updateHint(); refreshPanel(); };
    wake.onclick = () => { settings.mode = "wake"; saveSettings(); updateHint(); refreshPanel(); };
  },

  voice(body) {
    const voices = voicesFor(LANGS[getLang()].speech).slice(0, 8);
    const current = voices.find((v) => v.name === settings.voiceName) || voices[0];
    body.innerHTML = `
      <div class="tiles wide">${voices.map((v) => tile(esc(v.name.replace(/^(Microsoft|Google|Apple)\s*/i, "")), esc(v.lang), v === current ? "on" : "")).join("") || `<p class="muted">—</p>`}</div>
      ${stepper(t("rate"), settings.rate.toFixed(1) + "×")}
      ${stepper(t("pitch"), settings.pitch.toFixed(1))}
      <div class="tiles">${tile(`${icon("speaker")}<br>${esc(t("test"))}`, "", "action")}</div>`;
    const tiles = body.querySelectorAll(".tiles.wide .tile");
    tiles.forEach((el, i) => el.addEventListener("click", () => {
      settings.voiceName = voices[i].name;
      saveSettings();
      applyVoice();
      refreshPanel();
      speakOnce(t("greeting"));
    }));
    const [rateStep, pitchStep] = body.querySelectorAll(".stepper");
    bindStepper(rateStep, (d) => { settings.rate = clamp(settings.rate + d * 0.1, 0.6, 1.8); saveSettings(); applyVoice(); refreshPanel(); });
    bindStepper(pitchStep, (d) => { settings.pitch = clamp(settings.pitch + d * 0.1, 0.5, 1.6); saveSettings(); applyVoice(); refreshPanel(); });
    body.querySelector(".tile.action").onclick = () => speakOnce(t("greeting"));
  },

  language(body) {
    body.innerHTML = `<div class="tiles">${Object.entries(LANGS).map(([c, l]) => tile(esc(l.name), l.short, c === getLang() ? "on" : "")).join("")}</div>`;
    body.querySelectorAll(".tile").forEach((el, i) => el.addEventListener("click", () => {
      applyLanguage(Object.keys(LANGS)[i]);
      speakOnce(t("greeting"));
    }));
  },

  translator(body) {
    const listeningHere = voiceTask?.kind === "translate";
    body.innerHTML = `
      <div class="tiles">${tile(`${icon("mic")}<br>${esc(t("speakNow"))}`, "", "action" + (listeningHere ? " live" : ""))}${tile(`${icon("speaker")}<br>${esc(t("repeat"))}`, "", "action")}</div>
      ${readout(t("heardLabel"), lastTranslation.source || "—", true)}
      ${readout(`${t("targetLang").toUpperCase()} · ${LANGS[settings.target].name}`, lastTranslation.text || "—")}
      <div class="tiles">${Object.entries(LANGS).map(([c, l]) => tile(l.short, esc(l.name), c === settings.target ? "on" : "")).join("")}</div>`;
    const [talk, again, ...langs] = body.querySelectorAll(".tile");
    talk.onclick = () => startTask({ kind: "translate" });
    again.onclick = () => lastTranslation.text && speakOnce(lastTranslation.text, LANGS[lastTranslation.target].speech);
    langs.forEach((el, i) => el.addEventListener("click", () => {
      settings.target = Object.keys(LANGS)[i];
      saveSettings();
      refreshPanel();
      updateCards();
    }));
  },

  notes(body) {
    const dictating = voiceTask?.kind === "note";
    body.innerHTML = `
      <div class="tiles">${tile(`${icon("mic")}<br>${esc(t("dictate"))}`, "", "action" + (dictating ? " live" : ""))}${tile(`${icon("speaker")}<br>${esc(t("readAll"))}`, "", "action")}</div>
      ${notes.length ? notes.map((n) => `<div class="note-row">${readout(new Date(n.at).toLocaleString(getLang()), n.text)}<button class="tile" data-target aria-label="Borrar">${icon("trash")}</button></div>`).join("") : `<p class="muted">${esc(t("noNotes"))}</p>`}`;
    const [dictate, read] = body.querySelectorAll(".tiles .tile");
    dictate.onclick = () => startTask({ kind: "note" });
    read.onclick = () => speakOnce(notes.length ? notes.map((n) => n.text).join(". ") : t("noNotes"));
    body.querySelectorAll(".note-row .tile").forEach((el, i) => el.addEventListener("click", () => {
      notes.splice(i, 1);
      store.set("notes", notes);
      refreshPanel();
      updateCards();
    }));
  },

  system(body) {
    const render = () => {
      const v = values();
      body.innerHTML = `<div class="grid-stats">
        ${readout(t("brain"), brain.apiKey ? `${t("ready")}` : brain.ok ? t("noKey") : t("offline"))}
        ${readout(t("camera"), gestures?.running ? `${v.fps} ${t("fps")}` : "OFF")}
        ${readout(t("hand"), gestures?.handVisible ? t("detected") : t("none"))}
        ${readout(t("network"), navigator.onLine ? t("online") : t("offline"))}
        ${readout(t("battery"), v.battery)}
        ${readout(t("latency"), stats.lastLatency == null ? "—" : `${stats.lastLatency} ms`)}
      </div>
      <div class="readout"><div class="k">${esc(t("micLevel"))}</div><div class="meter"><i style="width:${Math.round(mic.level() * 300)}%"></i></div></div>
      ${brain.model ? `<p class="muted mono">MODEL · ${esc(brain.model)}</p>` : ""}`;
    };
    render();
    panelTimer = setInterval(render, 500);
  },

  settings(body) {
    const toggle = (key, label) => tile(esc(label), settings[key] ? t("on") : t("off"), settings[key] ? "on" : "");
    body.innerHTML = `
      <div class="tiles wide">${toggle("poke", t("poke"))}${toggle("pinch", t("pinch"))}${toggle("dwell", t("dwell"))}${toggle("showCam", t("showCam"))}</div>
      ${stepper(t("smoothing"), settings.smoothing.toFixed(2))}`;
    const keys = ["poke", "pinch", "dwell", "showCam"];
    body.querySelectorAll(".tiles .tile").forEach((el, i) => el.addEventListener("click", () => {
      settings[keys[i]] = !settings[keys[i]];
      saveSettings();
      applyGestureSettings();
      refreshPanel();
    }));
    bindStepper(body.querySelector(".stepper"), (d) => {
      settings.smoothing = clamp(settings.smoothing + d * 0.05, 0, 0.85);
      saveSettings();
      applyGestureSettings();
      refreshPanel();
    });
  },

  help(body) {
    body.innerHTML = t("helpItems").map(([g, d]) => `<div class="help-row"><b>${esc(g)}</b><span>${esc(d)}</span></div>`).join("") +
      `<p class="muted">${esc(t("voiceHelp"))}</p>`;
  },
};

const clamp = (v, a, b) => Math.round(Math.min(b, Math.max(a, v)) * 100) / 100;

// =====================================================================
// Voz: ciclo continuo escuchar → pensar → hablar → escuchar
// =====================================================================
const listener = new Listener();
const speaker = new Speaker();
const mic = new MicMeter();
let voiceOn = false;
let greeted = false;
let state = "off"; // off | listening | thinking | speaking
let voiceTask = null; // null | {kind: "note"} | {kind: "translate"}
let askCtl = null;
let lastHeard = "", lastReply = "";
let lastTranslation = { source: "", text: "", target: "en" };
let lastListenAt = 0;
let restartTimer = null;
const history = [];

function applyVoice() {
  speaker.voiceName = settings.voiceName;
  speaker.rate = settings.rate;
  speaker.pitch = settings.pitch;
  speaker.lang = LANGS[getLang()].speech;
  listener.lang = LANGS[getLang()].speech;
}

function setState(s, label) {
  state = s;
  document.body.classList.remove("v-listening", "v-thinking", "v-speaking", "v-off");
  document.body.classList.add("v-" + s);
  ui.vbState.textContent = (label || (s === "off" ? (voiceOn ? t("paused") : t("micOff")) : t(s))).toUpperCase();
  updateHint();
}

function updateHint() {
  ui.vbHint.textContent = !speechSupported
    ? t("noSpeech")
    : !voiceOn && !voiceTask ? t("tapToStart")
    : state === "listening" ? (voiceTask ? t("sayCommand") : settings.mode === "wake" ? t("wakeHint") : t("sayCommand"))
    : "";
}

async function ensureMic() {
  if (mic.analyser) return;
  try { await mic.start(); } catch { /* el visualizador queda plano */ }
}

function toggleVoice() {
  if (!speechSupported) { ui.reply.textContent = t("noSpeech"); return; }
  if (voiceOn) {
    voiceOn = false;
    voiceTask = null;
    stopAll();
    setState("off");
  } else {
    voiceOn = true;
    ensureMic();
    if (!greeted) {
      greeted = true;
      speakOnce(t("greeting"));
    } else listenNow();
  }
  if (openId === "core") refreshPanel();
  updateCards();
}

function stopAll() {
  clearTimeout(restartTimer);
  listener.stop();
  askCtl?.abort();
  askCtl = null;
  speaker.cancel();
}

/** Interrumpe lo que esté diciendo y vuelve a escuchar. */
function interrupt() {
  if (state !== "speaking" && state !== "thinking") return false;
  askCtl?.abort();
  askCtl = null;
  speaker.cancel();
  afterSpeech();
  return true;
}

function startTask(task) {
  if (!speechSupported) { ui.reply.textContent = t("noSpeech"); return; }
  ensureMic();
  voiceTask = task;
  stopAll();
  listenNow();
  refreshPanel();
}

function listenNow() {
  clearTimeout(restartTimer);
  if (!voiceOn && !voiceTask) { setState("off"); return; }
  const since = performance.now() - lastListenAt;
  if (since < 400) { restartTimer = setTimeout(listenNow, 900); return; } // evita reinicios en bucle
  lastListenAt = performance.now();
  listener.lang = LANGS[getLang()].speech;
  setState("listening");
  const ok = listener.listen({
    onInterim: (text) => { ui.heard.innerHTML = `<b>›</b> ${esc(text)}`; },
    onFinal: handleFinal,
    onEnd: (got) => {
      if (got || state !== "listening") return;
      restartTimer = setTimeout(listenNow, 150); // silencio: seguir escuchando
    },
    onError: (err) => {
      if (err === "not-allowed" || err === "service-not-allowed" || err === "audio-capture") {
        voiceOn = false;
        voiceTask = null;
        ui.reply.textContent = t("micDenied");
        setState("off");
      }
    },
  });
  if (!ok) setState("off");
}

function handleFinal(text) {
  lastHeard = text;
  ui.heard.innerHTML = `<b>${esc(t("you").toUpperCase())} ›</b> ${esc(text)}`;
  const task = voiceTask;
  voiceTask = null;
  if (task?.kind === "note") {
    addNote(text);
    speakOnce(t("noteSaved"));
    refreshPanel();
    return;
  }
  if (task?.kind === "translate") {
    translate(text);
    return;
  }
  if (settings.mode === "wake") {
    const command = stripWakeWord(text);
    if (command === null) { listenNow(); return; } // no era para mí
    if (!command) { speakOnce(t("yes")); return; }
    ask(command);
    return;
  }
  ask(text);
}

function speakOnce(text, lang) {
  stopAll();
  lastReply = text;
  ui.reply.textContent = text;
  setState("speaking");
  speaker.say(text, lang || LANGS[getLang()].speech);
}

function afterSpeech() {
  if (voiceOn || voiceTask) restartTimer = setTimeout(listenNow, 350);
  else setState("off");
}
speaker.onStart = () => { if (state === "thinking") setState("speaking"); };
speaker.onIdle = () => { if (state === "speaking" || state === "thinking") afterSpeech(); };

const ACTIONS = {
  set_language: ({ code }) => applyLanguage(code),
  open_panel: ({ panel }) => (panel === "none" ? closePanel() : openPanel(panel)),
  save_note: ({ text }) => { addNote(text); if (openId === "notes") refreshPanel(); },
};

/** Envía al servidor y lee la respuesta en streaming (Server-Sent Events). */
async function stream(payload, { onText, onAction, onStatus, signal }) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lang: getLang(), now: new Date().toString(), ...payload }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", error = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop();
    for (const part of parts) {
      if (!part.startsWith("data: ")) continue;
      const ev = JSON.parse(part.slice(6));
      if (ev.type === "text") onText?.(ev.text);
      else if (ev.type === "action") onAction?.(ev);
      else if (ev.type === "status") onStatus?.(ev.status);
      else if (ev.type === "error") error = ev.error;
    }
  }
  return error;
}

function errorText(err) {
  return err === "auth" ? t("errAuth") : err === "refusal" ? t("errRefusal") : t("errGeneric");
}

async function ask(text) {
  stopAll();
  history.push({ role: "user", content: text });
  setState("thinking");
  ui.reply.textContent = "";
  speaker.begin();
  askCtl = new AbortController();
  const ctl = askCtl;
  const t0 = performance.now();
  let reply = "", first = true;
  try {
    const err = await stream(
      { messages: history.slice(-20), notes: notes.map((n) => n.text) },
      {
        signal: ctl.signal,
        onText: (delta) => {
          if (first) {
            first = false;
            stats.lastLatency = Math.round(performance.now() - t0);
            pushSeries("latency", stats.lastLatency, 30);
          }
          reply += delta;
          ui.reply.textContent = reply.slice(-220);
          speaker.push(delta);
        },
        onAction: (ev) => ACTIONS[ev.name]?.(ev.input),
        onStatus: (s) => s === "searching" && setState("thinking", t("searching")),
      },
    );
    if (ctl !== askCtl) return; // interrumpido
    if (reply) {
      history.push({ role: "assistant", content: reply });
      stats.responses++;
      lastReply = reply;
    } else history.pop();
    if (err && !reply) {
      speakOnce(errorText(err));
      return;
    }
    speaker.end();
  } catch (e) {
    if (ctl !== askCtl) return;
    history.pop();
    speakOnce(t("errGeneric"));
  } finally {
    if (ctl === askCtl) askCtl = null;
    updateCards();
    if (openId === "core") refreshPanel();
  }
}

async function translate(text) {
  stopAll();
  setState("thinking", t("translating"));
  const target = settings.target;
  lastTranslation = { source: text, text: "", target };
  refreshPanel();
  askCtl = new AbortController();
  const ctl = askCtl;
  let out = "";
  try {
    const err = await stream(
      { messages: [{ role: "user", content: text }], mode: "translate", target },
      { signal: ctl.signal, onText: (d) => { out += d; ui.reply.textContent = out; } },
    );
    if (ctl !== askCtl) return;
    if (err || !out.trim()) { speakOnce(errorText(err)); return; }
    lastTranslation.text = out.trim();
    stats.translations++;
    stats.lastTranslation = `${LANGS[target].short} · ${lastTranslation.text}`;
    refreshPanel();
    updateCards();
    speakOnce(lastTranslation.text, LANGS[target].speech);
  } catch {
    if (ctl === askCtl) speakOnce(t("errGeneric"));
  } finally {
    if (ctl === askCtl) askCtl = null;
  }
}

function addNote(text) {
  notes.unshift({ text: String(text).slice(0, 2000), at: Date.now() });
  store.set("notes", notes);
  updateCards();
}

// Onda de la barra de voz: micrófono real al escuchar, onda sintética al hablar.
function drawWave(now) {
  const cv = ui.wave, ctx = cv.getContext("2d");
  const w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h);
  const bars = 40, bw = w / bars;
  const bands = state === "listening" ? mic.bands() : null;
  for (let i = 0; i < bars; i++) {
    let v;
    if (state === "listening") v = bands ? bands[2 + i] / 255 : 0.15 + 0.1 * Math.sin(now / 200 + i);
    else if (state === "speaking") v = 0.25 + 0.55 * Math.abs(Math.sin(now / 140 + i * 0.55) * Math.sin(now / 410 + i * 0.21));
    else if (state === "thinking") v = 0.12 + 0.5 * Math.max(0, Math.sin(now / 160 - i * 0.35)) ** 6;
    else v = 0.05;
    const bh = Math.max(2, v * h);
    ctx.fillStyle = state === "speaking" ? "#ffcc5c" : state === "listening" ? "#79e3ff" : "#9b8cff";
    ctx.globalAlpha = 0.35 + v * 0.65;
    ctx.fillRect(i * bw + 1, (h - bh) / 2, bw - 2, bh);
  }
  ctx.globalAlpha = 1;
}

// =====================================================================
// Idioma
// =====================================================================
function applyLanguage(code) {
  if (!LANGS[code]) return;
  setLang(code);
  store.set("lang", code);
  applyVoice();
  ui.langState.textContent = LANGS[code].short;
  buildCarousel();
  setState(state);
  if (openId) openPanel(openId);
  renderSides();
}

// =====================================================================
// Cursor de la mano: imán hacia la opción más cercana, toque en el aire,
// pellizco y permanencia
// =====================================================================
let gestures = null;
let hoverEl = null, hoverSince = 0, dwellDone = false;
const dwellRing = ui.cursor.querySelector(".c-dwell");
const DWELL_MS = 1500, SNAP_PX = 64;
let lastCursor = null;

function targets() {
  return [...document.querySelectorAll("[data-target]")].filter((el) => {
    if (el.closest("[hidden]") || el.classList.contains("gone")) return false;
    if (openId && !el.closest("#panel") && !el.closest(".console")) return false; // con un módulo abierto solo cuenta el módulo
    return true;
  });
}

function nearestTarget(x, y) {
  let best = null, bestD = Infinity, bestRect = null;
  for (const el of targets()) {
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    let d = Math.hypot(dx, dy);
    if (d === 0) d = -1 / (r.width * r.height); // dentro de varios: gana el más pequeño
    if (d < bestD) { bestD = d; best = el; bestRect = r; }
  }
  return bestD <= SNAP_PX ? { el: best, rect: bestRect, inside: bestD <= 0 } : null;
}

function moveCursor(x, y) {
  const hit = nearestTarget(x, y);
  let cx = x, cy = y;
  if (hit && !hit.inside) {
    // imán: acerca el cursor visual al borde de la opción
    cx = Math.min(Math.max(x, hit.rect.left + 6), hit.rect.right - 6);
    cy = Math.min(Math.max(y, hit.rect.top + 6), hit.rect.bottom - 6);
  }
  ui.cursor.style.transform = `translate(${cx}px, ${cy}px)`;
  ui.cursor.classList.toggle("snap", Boolean(hit));
  const el = hit?.el || null;
  if (el !== hoverEl) {
    hoverEl?.classList.remove("hover");
    hoverEl = el;
    hoverEl?.classList.add("hover");
    hoverSince = performance.now();
    dwellDone = false;
  }
  let progress = 0;
  if (settings.dwell && hoverEl && !dwellDone) {
    progress = Math.min((performance.now() - hoverSince) / DWELL_MS, 1);
    if (progress >= 1) {
      dwellDone = true;
      progress = 0;
      activate(hoverEl, cx, cy);
    }
  }
  dwellRing.style.strokeDashoffset = String(132 * (1 - progress));
  if (lastCursor) pushSeries("hand", Math.hypot(x - lastCursor.x, y - lastCursor.y), 60);
  lastCursor = { x, y };
}

function activate(el, x, y) {
  const r = document.createElement("div");
  r.className = "ripple";
  r.style.left = `${x}px`;
  r.style.top = `${y}px`;
  document.body.appendChild(r);
  setTimeout(() => r.remove(), 600);
  ui.cursor.classList.add("press");
  setTimeout(() => ui.cursor.classList.remove("press"), 180);
  if (el) el.click();
}

function onGesture(ev) {
  switch (ev.type) {
    case "move":
      ui.cursor.hidden = false;
      moveCursor(ev.x, ev.y);
      break;
    case "hand":
      ui.cursor.hidden = !ev.visible;
      if (!ev.visible) { hoverEl?.classList.remove("hover"); hoverEl = null; lastCursor = null; }
      renderSides();
      break;
    case "tap":
    case "pinch": {
      const hit = hoverEl ? { el: hoverEl } : nearestTarget(ev.x, ev.y);
      activate(hit?.el, ev.x, ev.y);
      dwellDone = true;
      break;
    }
    case "swipe":
      if (!openId) setFocus(focus - ev.dir);
      break;
    case "gesture":
      if (ev.gesture === "fist") { if (!interrupt() && openId) closePanel(); }
      else if (ev.gesture === "victory") toggleVoice();
      else if (ev.gesture === "palm" && !openId) openPanel(MODULES[focus]);
      break;
  }
}

function applyGestureSettings() {
  ui.sensor.classList.toggle("mini", !settings.showCam);
  if (!gestures) return;
  gestures.smoothing = settings.smoothing;
  gestures.pokeEnabled = settings.poke;
  gestures.pinchEnabled = settings.pinch;
}

async function startCamera() {
  ui.camStart.hidden = true;
  try {
    gestures = new GestureController({ video: $("#video"), canvas: $("#handCanvas"), onEvent: onGesture });
    applyGestureSettings();
    await gestures.start();
    ui.sensor.classList.remove("off");
  } catch (err) {
    console.error(err);
    gestures = null;
    ui.sensor.classList.add("off");
    ui.camStart.hidden = false;
    ui.reply.textContent = `${t("camDenied")} (${err.name || err.message})`;
  }
  updateCards();
}

// =====================================================================
// Columnas laterales y reloj
// =====================================================================
function renderSides() {
  const row = (k, v, cls = "") => `<div class="row"><span class="k">${esc(k)}</span><span class="v ${cls}">${esc(v)}</span></div>`;
  ui.sideLeft.innerHTML =
    row(t("brain").toUpperCase(), brain.apiKey ? "OK" : brain.ok ? "KEY?" : "OFF", brain.apiKey ? "ok" : "bad") +
    row("VOZ", voiceOn ? t("micOn").split(" ")[0] : "OFF", voiceOn ? "ok" : "warn") +
    row(t("hand").toUpperCase(), gestures?.handVisible ? "✓" : "—", gestures?.handVisible ? "ok" : "") +
    row(t("camera").toUpperCase().slice(0, 10), gestures?.running ? `${gestures.fps} FPS` : "OFF", gestures?.running ? "ok" : "warn") +
    row(t("network").toUpperCase(), navigator.onLine ? "ON" : "OFF", navigator.onLine ? "ok" : "bad");
  ui.sideRight.innerHTML =
    row(t("language").toUpperCase(), LANGS[getLang()].short) +
    row(t("notes").toUpperCase(), notes.length) +
    row(t("responses").toUpperCase(), stats.responses) +
    row(t("latency").toUpperCase(), stats.lastLatency == null ? "—" : `${stats.lastLatency}ms`) +
    row("MOD", tagOf(MODULES[focus]), "warn");
}

// =====================================================================
// Teclado, toque y ratón (alternativas)
// =====================================================================
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") setFocus(focus - 1);
  else if (e.key === "ArrowRight") setFocus(focus + 1);
  else if (e.key === "Enter") openId ? null : openPanel(MODULES[focus]);
  else if (e.key === "Escape") { if (!interrupt()) closePanel(); }
  else if (e.key === " ") { e.preventDefault(); toggleVoice(); }
});
let swipeStart = null;
ui.stage.addEventListener("pointerdown", (e) => { swipeStart = { x: e.clientX, t: performance.now() }; });
ui.stage.addEventListener("pointerup", (e) => {
  if (!swipeStart || openId) return;
  const dx = e.clientX - swipeStart.x;
  if (Math.abs(dx) > 60 && performance.now() - swipeStart.t < 700) setFocus(focus + (dx < 0 ? 1 : -1));
  swipeStart = null;
});
ui.voiceBar.addEventListener("click", () => { if (!interrupt()) toggleVoice(); });
$("#panelClose").addEventListener("click", closePanel);
ui.camStart.addEventListener("click", startCamera);
addEventListener("resize", layoutCarousel);

// =====================================================================
// Arranque
// =====================================================================
setLang(store.get("lang", detectBrowserLang()));
applyLanguage(getLang());
setState("off");
ui.reply.textContent = t("greeting");

setInterval(() => {
  ui.clock.textContent = new Date().toLocaleTimeString(getLang(), { hour12: false });
}, 1000);
setInterval(() => {
  pushSeries("mic", mic.level());
  pushSeries("fps", gestures?.running ? gestures.fps : 0);
  if (!gestures?.handVisible) pushSeries("hand", 0);
  updateCards();
  renderSides();
}, 1000);
(function frame(now) { drawWave(now); requestAnimationFrame(frame); })(performance.now());

fetch("/api/health")
  .then((r) => r.json())
  .then((h) => {
    brain = h;
    if (!h.apiKey) ui.reply.textContent = t("errAuth");
    renderSides();
    updateCards();
  })
  .catch(() => { brain = { ok: false }; });

ui.sensor.classList.add("off");
startCamera();
