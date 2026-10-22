// NIKOLAI — interfaz de solo voz y manos: carrusel 3D de módulos, ciclo de voz
// continuo (escuchar → pensar → hablar → escuchar) y cursor controlado con el dedo.

import { LANGS, t, setLang, getLang, detectBrowserLang } from "./i18n.js";
import {
  Listener, Speaker, MicMeter, voicesFor, voiceGender, voiceQuality, stripWakeWord, speechSupported,
  isMobile, isIOS, inAppBrowser, isBrave, ClapDetector, prepareOfflineSpeech, offlineSpeechSupported, offlineSpeechReady,
  PREMIUM_VOICES, unlockAudio, testPremium, outputLevel,
} from "./voice.js";
import { CallView } from "./call.js";
import { renderStudio, studio } from "./studio.js";
import { renderWatch, watch, minuteNow } from "./watch.js";
import { renderBots, botsSummary, stopBots } from "./bots.js";
import { renderWork, renderProjects, renderMoney, projectStats, streak, habits, money, monthsToGoal, work } from "./business.js";
import { GestureController } from "./gestures.js";
import * as Brain from "./brain.js";
import { renderInto, speakable } from "./md.js";
import { renderHomework, study } from "./study.js";
import {
  spotify, renderMusic, handleRedirect, isConnected as spotifyConnected, refreshNow, control as spotifyControl,
  search as spotifySearch, playItem, setEmbed, presetFor, PRESETS, playInEmbed, hidePlayer, player as miniPlayer, preloadEmbed,
} from "./spotify.js";
import { news, prefetchNews } from "./news.js";
import { offline, localAnswer, isOffline, addPending, takePending, removePending, markPrepared } from "./offline.js";
import { watchOpeningBell, ringBell, exchangeStatus, EXCHANGES } from "./wallstreet.js";
import { memory, renderMemory, addMemory, forgetMatching, memoriesForBrain } from "./memory.js";
import { renderMarkets, market, connectLive, loadCoins, fmtMoney, fmtPct, priceOf, onMarket } from "./markets.js";
import { renderTerminal, termSummary, stopTerminal } from "./terminal.js";
import { renderFarm, farmSummary, stopFarm } from "./farm.js";
import {
  profile, daysToBirthday, renderProfile, renderSos, dial, shareLocation, renderWeather, weather, loadWeather, wmo,
  weatherSentence, renderTools, timer, startTimer, fmtTime, renderNews, calc,
} from "./extras.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- Preferencias (este navegador) ----------
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("nikolai." + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("nikolai." + k, JSON.stringify(v)); } catch { /* bloqueado */ } },
};
const settings = Object.assign(
  {
    mode: "conversation", voiceName: "", gender: "female", rate: 1, pitch: 1, poke: true, pinch: true, dwell: true,
    showCam: true, smoothing: 0.4, target: "en", chatSpeak: true, level: "secondary", facing: "user",
    bell: true, lowPower: false, clap: true, clapMobile: false, clapSens: 3, aiSpeed: "max", emotions: false, emoIntensity: "soft", persona: "nikolai", personaVoice: true, jfkLang: "es", jfkVintage: true, callSees: false, premiumOn: false, premiumVoice: "JBFqnCBsd6RMkjVDRZzb", premiumModel: "eleven_flash_v2_5", premiumFx: true, clapSong: { type: "track", id: "39shmbIHICJ2Wxnk1fPSdz", title: "Should I Stay or Should I Go — The Clash" },
  },
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
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  homework: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M7 9v5c0 1.7 2.2 3 5 3s5-1.3 5-3V9M21 7v6"/>',
  markets: '<path d="M4 20V4M4 20h16"/><path d="M7 16l4-5 3 3 5-7"/><path d="M15 7h4v4"/>',
  news: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2M7 9h7M7 12.5h7M7 16h4"/>',
  weather: '<circle cx="9" cy="9" r="3.5"/><path d="M9 2.5v1.5M9 14v1.5M2.5 9H4M14 9h1.5M4.4 4.4l1 1M12.6 12.6l1 1M4.4 13.6l1-1M12.6 5.4l1-1"/><path d="M10 19h8a3 3 0 0 0 0-6 4.5 4.5 0 0 0-8.4 1.5A2.3 2.3 0 0 0 10 19z"/>',
  tools: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11v6M8 14h2M12 14h2M8 17h2M12 17h2"/>',
  sos: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17v.5"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  send: '<path d="M4 12l16-8-6 16-3-6.5z"/><path d="M11 13.5L20 4"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  phone: '<path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  siren: '<path d="M7 18v-6a5 5 0 0 1 10 0v6M5 18h14v3H5zM12 2v2M4.2 5.2l1.4 1.4M19.8 5.2l-1.4 1.4"/>',
  install: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  memory: '<path d="M9.5 3a4 4 0 0 0-4 4 3.5 3.5 0 0 0-2 6.2A3.8 3.8 0 0 0 7 19a3 3 0 0 0 5 1V4.5A2.5 2.5 0 0 0 9.5 3zM14.5 3a4 4 0 0 1 4 4 3.5 3.5 0 0 1 2 6.2A3.8 3.8 0 0 1 17 19a3 3 0 0 1-5 1"/><path d="M9 9.5h1.5M14 12.5h1.5M9 15h1.5"/>',
  offline: '<path d="M2 8.5a15 15 0 0 1 20 0M5 12a10.5 10.5 0 0 1 14 0M8.5 15.5a5.5 5.5 0 0 1 7 0"/><circle cx="12" cy="19" r="1.3"/><path d="M3 3l18 18"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  projects: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
  bots: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 8V4M9 13h.01M15 13h.01M9.5 16.5h5M3 12v3M21 12v3"/><circle cx="12" cy="3.5" r="1"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 2.5L7 14M12.5 14h4"/>',
  farm: '<path d="M12 21V11M12 11c0-2.5-2-4.5-4.5-4.5M12 11c0-2 1.6-3.6 3.6-3.6M4 21h16M6 21v-4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/>',
  watch: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4M10 8.5v5l4.5-2.5z"/>',
  studio: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 15.5l-5-5-9 8.5"/><path d="M17.5 2.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>',
  persona: '<circle cx="8" cy="9" r="3.2"/><path d="M2.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="16.5" cy="7.5" r="2.7"/><path d="M14.5 12.6c.6-.2 1.3-.3 2-.3 2.4 0 4.3 1.6 4.9 4.4"/>',
  money: '<circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.6-1-1.8-1.5-3-1.5-1.7 0-3 .9-3 2.3 0 3.2 6 1.8 6 5 0 1.4-1.3 2.4-3 2.4-1.3 0-2.6-.6-3.2-1.6M12 5.5v13"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24">${ICON[name]}</svg>`;

document.body.dataset.persona = settings.persona;
const LOOK_RE = /\b(m[ií]rame|me ves|c[oó]mo me veo|qu[eé] ves|ves esto|mira esto|mira lo que|look at me|what do you see|how do i look)\b/i;

// ---------- Emociones (simuladas) ----------
const MOODS = {
  happy: ["😊", 1.04, 1.05], loving: ["🥰", 0.97, 1.04], playful: ["😜", 1.06, 1.06], excited: ["🤩", 1.1, 1.08], neutral: ["🙂", 1, 1],
  worried: ["😟", 0.98, 1], sad: ["😢", 0.9, 0.95], crying: ["😭", 0.86, 1.06], missing: ["🥺", 0.94, 1.02], jealous: ["😒", 1, 0.98],
  annoyed: ["😤", 1.05, 0.96], angry: ["😠", 1.1, 0.92],
};
let mood = store.get("mood", { mood: "neutral", intensity: 0.5, at: 0 });
/** Las emociones se calman solas con el tiempo (unos 25 minutos). */
function currentMood() {
  if (!settings.emotions) return { mood: "neutral", intensity: 0 };
  if (mood.mood !== "neutral" && Date.now() - mood.at > 25 * 60_000) mood = { mood: "neutral", intensity: 0.5, at: Date.now() };
  return mood;
}
function setMood(m, intensity = 0.6) {
  if (!MOODS[m]) return;
  mood = { mood: m, intensity: Math.min(1, Math.max(0.1, Number(intensity) || 0.6)), at: Date.now() };
  store.set("mood", mood);
  showMood();
  applyVoice();
  if (openId === "persona") refreshPanel();
}
function setEmotions(on, intensity) {
  settings.emotions = Boolean(on);
  if (intensity === "soft" || intensity === "high") settings.emoIntensity = intensity;
  if (!on) mood = { mood: "neutral", intensity: 0.5, at: Date.now() };
  saveSettings();
  showMood();
  applyVoice();
  updateCards();
  if (openId === "persona") refreshPanel();
}
function showMood() {
  const chip = $("#moodChip");
  const m = currentMood();
  document.body.dataset.mood = settings.emotions ? m.mood : "";
  if (!chip) return;
  chip.hidden = !settings.emotions;
  chip.textContent = `${MOODS[m.mood][0]} ${t("mood_" + m.mood)}`;
}
setInterval(showMood, 60_000);
let lastUserAt = store.get("lastUserAt", 0);
const EMO_ON_RE = /\b(activa|enciende|prende|pon|activar|turn on|enable)(te)?\s+(tus\s+|las\s+|el modo\s+|your\s+)?(emociones|sentimientos|emotions|feelings)\b|\bponte dram[aá]tica\b/i;
const EMO_OFF_RE = /\b(apaga|desactiva|quita|deja de tener|turn off|disable)(te)?\s+(tus\s+|las\s+|el modo\s+|your\s+)?(emociones|sentimientos|emotions|feelings)\b/i;
let awayHours = 0;

// ---------- Personalidades y videollamada ----------
// Retrato oficial de la Casa Blanca (1963), dominio público, servido por Wikimedia Commons.
const JFK_PHOTO = "https://commons.wikimedia.org/wiki/Special:FilePath/John_F._Kennedy,_White_House_color_photo_portrait.jpg?width=640";
const JFK_SPEECHES = [
  ["jfk_sp_inaugural", "JFK inaugural address 1961 ask not what your country can do for you"],
  ["jfk_sp_moon", "JFK we choose to go to the moon speech Rice University 1962"],
  ["jfk_sp_cuba", "JFK Cuban missile crisis address October 22 1962"],
  ["jfk_sp_berlin", "JFK Ich bin ein Berliner speech 1963"],
];
const PERSONA_VOICE = { lawyer: { gender: "male", premium: "nPczCjzI2devNBz1zQrb", pitch: 0.92 }, friend: { gender: "female", premium: "EXAVITQu4vr4xnSDxMaL", pitch: 1.06 }, house: { gender: "male", premium: "pqHfZKP75CvOlQylNhV4", pitch: 0.95 }, jfk: { gender: "male", premium: "pNInz6obpgDQGcFmaJgB", pitch: 1 } };
function setPersona(p, announce) {
  if (!["nikolai", "lawyer", "friend", "house", "jfk"].includes(p)) return;
  settings.persona = p;
  saveSettings();
  document.body.dataset.persona = p;
  applyVoice();
  updateCards();
  call.refresh();
  if (openId === "persona") refreshPanel();
  if (announce) speakOnce(t("persona_hello_" + p + (p === "jfk" && settings.jfkLang === "en" ? "_en" : "")).replace("{name}", profile.name ? " " + profile.name : ""));
}
const call = new CallView({
  t, esc, icon, jfkPhoto: JFK_PHOTO,
  getState: () => state,
  speakLevel: () => outputLevel(),
  micLevel: () => Math.min(1, mic.level() * 3),
  persona: () => settings.persona,
  mood: () => currentMood(),
  title: (p) => t("persona_" + p),
  caption: () => ui.reply.textContent.slice(-180),
  micOn: () => voiceOn,
  onMic: () => toggleVoice(),
  onEnd: () => endCall(),
  seeAlways: () => settings.callSees,
  onSeeAlways: () => { settings.callSees = !settings.callSees; saveSettings(); },
  onLook: () => ask(t("call_lookPrompt"), { look: true }),
  onPersona: () => { const P = ["nikolai", "lawyer", "friend", "house", "jfk"]; setPersona(P[(P.indexOf(settings.persona) + 1) % P.length], true); },
});
async function startCall() {
  if (call.active) return;
  closePanel();
  unlockAudio();
  await call.start();
  if (!voiceOn) toggleVoice();
  call.refresh();
  updateCards();
}
function endCall() {
  call.stop();
  updateCards();
  if (openId === "persona") refreshPanel();
}


const APP_VERSION = "2026.10.22-b";
const MODULES = [
  "core", "chat", "persona", "bots", "watch", "studio", "work", "projects", "money", "homework", "music", "markets", "terminal", "farm", "news", "weather", "tools", "sos",
  "voice", "translator", "notes", "memory", "language", "profile", "offline", "system", "settings", "help",
];
const WIDE = new Set(["bots", "terminal", "farm", "watch", "studio", "persona", "chat", "work", "projects", "money", "homework", "music", "markets", "news", "tools", "memory", "voice"]);
const titleOf = (id) => t(id === "settings" ? "gestures" : id);
const tagOf = (id) => `M-${String(MODULES.indexOf(id) + 1).padStart(2, "0")}`;

// ---------- Telemetría real ----------
const series = { mic: [], fps: [], hand: [], latency: [], btc: market.btcSeries };
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
    case "chat": return `<p class="desc" data-bind="lastChat" style="flex:1"></p><div class="stats">${stat("messages", "chatCount")}${stat("readAloud", "chatSpeak", "accent")}</div>`;
    case "homework": return `<p class="desc" style="flex:1">${esc(t("hwCardDesc"))}</p><div class="stats">${stat("tasksDone", "hwDone")}${stat("level", "hwLevel", "accent")}</div>`;
    case "offline": return `<div class="big-code mono" data-bind="netState">ON</div><div class="stats">${stat("offPack", "offPackState")}${stat("offPending", "offPendingCount", "accent")}</div>`;
    case "memory": return `<div class="big-code" data-bind="memCount">0</div><div class="stats">${stat("memory", "memState")}${stat("last", "memLast", "accent")}</div>`;
    case "music": return `<p class="desc" data-bind="musicNow" style="flex:1"></p><div class="stats">${stat("sp_account", "musicAccount")}${stat("sp_device", "musicDevice", "accent")}</div>`;
    case "markets": return spark("btc", "BTC") + `<div class="stats">${stat("btc", "btcPrice")}${stat("ex_nyse", "nyseState", "accent")}</div>`;
    case "terminal": return `<div class="big-code mono" data-bind="tmBtc">—</div><div class="stats">${stat("tm_cmd", "tmHint")}${stat("ex_nyse", "nyseState", "accent")}</div>`;
    case "farm": return `<div class="big-code mono" data-bind="fmMoneyK">—</div><div class="stats">${stat("fm_ready", "fmReady")}${stat("fm_plots", "fmPlots", "accent")}</div>`;
    case "bots": return `<div class="big-code mono bot-code" data-bind="botActive">0</div><div class="stats">${stat("bot_status", "botState")}${stat("bot_pnlK", "botPnl", "accent")}</div>`;
    case "watch": return `<p class="desc" data-bind="wtInfo" style="flex:1"></p><div class="stats">${stat("wt_now", "wtNow")}${stat("wt_minute", "wtMin", "accent")}</div>`;
    case "studio": return `<p class="desc" style="flex:1">${esc(t("studioCardDesc"))}</p><div class="stats">${stat("st_media", "stMedia")}${stat("st_edits", "stEdits", "accent")}</div>`;
    case "persona": return `<div class="big-code persona-code" data-bind="personaName">—</div><div class="stats">${stat("call_title", "callState")}${stat("ps_voice", "personaVoice", "accent")}</div>`;
    case "work": return `<p class="desc" style="flex:1">${esc(t("workCardDesc"))}</p><div class="stats">${stat("wk_tools", "workTools")}${stat("wk_last", "workLast", "accent")}</div>`;
    case "projects": return `<div class="big-code" data-bind="pjCount">0</div><div class="stats">${stat("pj_open", "pjOpen")}${stat("pj_doneN", "pjDone", "accent")}</div>`;
    case "money": return `<div class="big-code mono" data-bind="mnYears">—</div><div class="stats">${stat("mn_toMillion", "mnGoal")}${stat("hb_streak", "hbStreak", "accent")}</div>`;
    case "news": return `<p class="desc" data-bind="newsInfo" style="flex:1"></p><div class="stats">${stat("topics", "newsTopics")}${stat("source", "newsSource", "accent")}</div>`;
    case "weather": return `<div class="big-code" data-bind="wxTemp">—</div><div class="stats">${stat("sky", "wxDesc")}${stat("humidity", "wxHum", "accent")}</div>`;
    case "tools": return `<div class="big-code mono" data-bind="timerLeft">25:00</div><div class="stats">${stat("timer", "timerState")}${stat("calculator", "calcReady", "accent")}</div>`;
    case "sos": return `<p class="desc" style="flex:1">${esc(t("sosCardDesc"))}</p><div class="stats">${stat("emergencyNumber", "sosNumber")}${stat("contactName", "sosContact", "accent")}</div>`;
    case "profile": return `<div class="big-code" data-bind="bdayDays">—</div><div class="stats">${stat("birthday", "bdayDate")}${stat("name", "profileName", "accent")}</div>`;
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
  const live = market.live.BTCUSDT;
  const btcCoin = market.coins.find((c) => c.pair === "BTCUSDT");
  const btc = live || (btcCoin ? priceOf(btcCoin) : null);
  const bday = daysToBirthday();
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
    lastChat: lastReply ? lastReply.slice(0, 110) : "",
    chatCount: history.length,
    chatSpeak: settings.chatSpeak ? t("on") : t("off"),
    hwDone: study.done,
    hwLevel: t("lv_" + settings.level),
    btcPrice: btc ? fmtMoney(btc.price) : "—",
    tmBtc: termSummary().price,
    tmHint: "<GO>",
    fmMoneyK: "$" + Math.round(farmSummary().money).toLocaleString("en-US"),
    fmReady: String(farmSummary().ready),
    fmPlots: String(farmSummary().plots),
    btcChange: btc ? fmtPct(btc.change) : "—",
    newsInfo: news.items[0]?.t || t("newsCardDesc"),
    personaName: t("personaShort_" + settings.persona),
    botActive: String(botsSummary().active),
    botState: botsSummary().active ? t("q_running").toUpperCase() : "OK",
    botPnl: `${botsSummary().pnl >= 0 ? "+" : "-"}$${Math.abs(botsSummary().pnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
    wtInfo: watch.active ? `${watch.title}` : t("watchCardDesc"),
    wtNow: watch.active ? t("wt_live") : "—",
    wtMin: watch.active ? `${minuteNow()}′` : "—",
    stMedia: studio.kind ? t("st_kind_" + studio.kind) : "—",
    stEdits: studio.ops.length,
    callState: call.active ? t("call_live") : "—",
    personaVoice: settings.personaVoice ? t("on") : t("off"),
    workTools: 6,
    workLast: Object.keys(work.out).length ? t("wk_" + Object.keys(work.out).at(-1)) : "—",
    pjCount: projectStats().count,
    pjOpen: projectStats().open,
    pjDone: projectStats().done,
    mnYears: (() => { const m = monthsToGoal(money.start, money.monthly, money.rate, money.target); return m == null ? "100+" : `${Math.ceil(m / 12)} ${t("mn_yearsU")}`; })(),
    mnGoal: new Intl.NumberFormat(getLang(), { notation: "compact", maximumFractionDigits: 1 }).format(money.target),
    hbStreak: `${streak()} ${t("hb_days")}`,
    newsTopics: 9,
    newsSource: news.items.length ? String(news.items.length) : "WEB",
    wxTemp: weather.data ? `${Math.round(weather.data.current.temperature_2m)}°` : "—",
    wxDesc: weather.data ? t("wx_" + wmo(weather.data.current.weather_code)[0]) : "—",
    wxHum: weather.data ? `${weather.data.current.relative_humidity_2m}%` : "—",
    timerLeft: fmtTime(timer.left),
    timerState: timer.running ? t("running") : t("paused"),
    calcReady: "✓",
    sosNumber: profile.emergencyNumber,
    sosContact: profile.contactName || (profile.contactPhone ? "✓" : "—"),
    bdayDays: bday === 0 ? "🎂" : bday == null ? "—" : `${bday}`,
    bdayDate: profile.birthday ? profile.birthday.split("-").reverse().join("/") : "—",
    profileName: profile.name || "—",
    netState: isOffline() ? "OFF" : "ON",
    offPackState: offline.prepared ? "✓" : "—",
    offPendingCount: offline.pending.length,
    nyseState: t("ex_" + exchangeStatus(EXCHANGES[0]).state),
    memCount: memory.items.length,
    memState: memory.enabled ? t("on") : t("off"),
    memLast: memory.items[0] ? new Date(memory.items[0].at).toLocaleDateString(getLang(), { day: "numeric", month: "short" }) : "—",
    musicNow: spotify.now ? `${spotify.now.playing ? "▶" : "⏸"} ${spotify.now.title} — ${spotify.now.artist}` : t("musicCardDesc"),
    musicAccount: spotifyConnected() ? "Spotify ✓" : "—",
    musicDevice: spotify.now?.device || "—",
  };
}

function updateCards() {
  const v = values();
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const k = el.dataset.bind;
    if (k.startsWith("status-")) {
      const id = k.slice(7);
      const live = id === "core" || id === "chat" || id === "homework" ? brain.apiKey
        : id === "news" ? navigator.onLine
        : id === "work" || id === "projects" || id === "money" || id === "persona" || id === "studio" || id === "watch" ? true
        : id === "settings" ? Boolean(gestures?.running)
        : id === "markets" ? Boolean(market.live.BTCUSDT)
        : id === "music" ? true
        : id === "weather" ? Boolean(weather.data)
        : id === "tools" ? true
        : true;
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
  if (openId === "bots" && id !== "bots") stopBots();
  if (openId === "terminal" && id !== "terminal") stopTerminal();
  if (openId === "farm" && id !== "farm") stopFarm();
  clearInterval(panelTimer);
  openId = id;
  setFocus(MODULES.indexOf(id));
  ui.panel.hidden = false;
  ui.stage.classList.add("dimmed");
  ui.panelTag.textContent = tagOf(id);
  ui.panelTitle.textContent = titleOf(id);
  ui.panel.classList.toggle("wide", WIDE.has(id));
  ui.panelBody.innerHTML = "";
  renderDock();
  PANEL[id](ui.panelBody);
}
let panelTimer = null;
function closePanel() {
  clearInterval(panelTimer);
  if (openId === "bots") stopBots();
  if (openId === "terminal") stopTerminal();
  if (openId === "farm") stopFarm();
  openId = null;
  ui.panel.hidden = true;
  ui.stage.classList.remove("dimmed");
  renderDock();
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
      <div class="readout"><div class="k">${esc(t("aiSpeed").toUpperCase())}</div>
        <div class="tiles speed-tiles">${["fast", "balanced", "max"].map((k) => tile(esc(t("speed_" + k)), esc(t("speedSub_" + k)), settings.aiSpeed === k ? "on" : "")).join("")}</div>
        <p class="muted">${esc(t("aiSpeedNote"))}</p></div>
      ${Brain.getMode() === "direct" ? keyForm() : ""}
      ${readout(t("heardLabel"), lastHeard || "—", true)}
      ${readout("NIKOLAI", lastReply || t("greeting"))}
      <div class="readout"><div class="k">${esc(t("vlogTitle").toUpperCase())}</div><div class="vlog" id="voiceLog">${voiceLogHtml()}</div></div>
      <p class="muted">${esc(t("voiceHelp"))}</p>`;
    bindKeyForm(body);
    body.querySelectorAll(".speed-tiles .tile").forEach((el, i) => el.addEventListener("click", () => {
      settings.aiSpeed = ["fast", "balanced", "max"][i];
      saveSettings();
      refreshPanel();
    }));
    const [toggle, conv, wake] = body.querySelectorAll(".tiles .tile");
    toggle.onclick = () => { toggleVoice(); refreshPanel(); };
    conv.onclick = () => { settings.mode = "conversation"; saveSettings(); updateHint(); refreshPanel(); };
    wake.onclick = () => { settings.mode = "wake"; saveSettings(); updateHint(); refreshPanel(); };
  },

  voice(body) {
    const all = voicesFor(LANGS[getLang()].speech, settings.gender);
    const current = all.find((v) => v.name === settings.voiceName) || all[0];
    const presets = [
      ["natural", 1, 1], ["jarvis", 0.95, 0.85], ["soft", 0.92, 1.12], ["fast", 1.25, 1],
    ];
    const short = (v) => v.name.replace(/^(Microsoft|Google|Apple)\s*/i, "").replace(/\s*-\s*.*$/, "");
    const quality = (v) => ["", "★", "★★", "★★★"][voiceQuality(v)];
    const hasKey = Boolean(store.get("elevenKey", ""));
    const custom = !PREMIUM_VOICES.some((v) => v.id === settings.premiumVoice);
    body.innerHTML = `
      <div class="readout pv-box ${settings.premiumOn && hasKey ? "live" : ""}">
        <div class="k">${esc(t("pv_title").toUpperCase())} · ${settings.premiumOn && hasKey ? "● " + esc(t("on")) : esc(t("off"))}</div>
        <p class="muted">${esc(t("pv_intro"))}</p>
        ${hasKey ? "" : `<ol class="steps">
          <li>${esc(t("pv_step1"))} <a class="key-link" href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener" data-target>elevenlabs.io</a></li>
          <li>${esc(t("pv_step2"))}</li><li>${esc(t("pv_step3"))}</li></ol>`}
        <div class="key-row">
          <input id="pvKey" type="password" autocomplete="off" spellcheck="false" placeholder="${hasKey ? "••••••••  ✓ " + esc(t("keySaved")) : "sk_…"}">
          <button class="tile" data-target id="pvSave"><span class="t-main">${esc(t("saveKey"))}</span></button>
          ${hasKey ? `<button class="tile" data-target id="pvDel"><span class="t-main">${esc(t("deleteKey"))}</span></button>` : ""}
        </div>
        <div class="tiles pv-toggle">
          ${tile(esc(settings.premiumOn ? t("pv_turnOff") : t("pv_turnOn")), esc(t("pv_title").toUpperCase()), settings.premiumOn ? "on" : "")}
          ${tile(esc(t("pv_fx")), settings.premiumFx ? esc(t("on")) : esc(t("off")), settings.premiumFx ? "on" : "")}
          ${tile(esc(t("pv_fast")), "FLASH 2.5", settings.premiumModel === "eleven_flash_v2_5" ? "on" : "")}
          ${tile(esc(t("pv_best")), "MULTILINGUAL V2", settings.premiumModel === "eleven_multilingual_v2" ? "on" : "")}
        </div>
        <div class="tiles wide pv-voices">${PREMIUM_VOICES.map((v) => tile(`${esc(v.name)}${v.tag === "jarvis" ? " ★" : ""}`, `${esc(t("pvt_" + v.tag))} · ${v.gender === "male" ? "♂" : "♀"} ${v.accent}`, settings.premiumVoice === v.id ? "on" : "")).join("")}</div>
        <div class="key-row">
          <input id="pvCustom" autocomplete="off" spellcheck="false" placeholder="${esc(t("pv_customPh"))}" value="${custom ? esc(settings.premiumVoice) : ""}">
          <button class="tile" data-target id="pvUseCustom"><span class="t-main">${esc(t("pv_useCustom"))}</span></button>
          <button class="tile action" data-target id="pvTest"><span class="t-main">${icon("speaker")} ${esc(t("test"))}</span></button>
        </div>
        <p class="muted" id="pvResult">${esc(t("pv_note"))}</p>
      </div>
      <div class="k mono pv-sep">${esc(t("pv_system").toUpperCase())}</div>
      <div class="tiles sys-gender">${["female", "male", "any"].map((g) => tile(esc(t("gender_" + g)), esc(t("gender").toUpperCase()), settings.gender === g ? "on" : "")).join("")}</div>
      <div class="tiles sys-presets">${presets.map(([k]) => tile(esc(t("preset_" + k)), esc(t("presets").toUpperCase()))).join("")}</div>
      <div class="tiles wide voice-list">${all.map((v) => tile(esc(short(v)), `${esc(v.lang)} · ${quality(v)}${voiceGender(v) === "female" ? " · ♀" : voiceGender(v) === "male" ? " · ♂" : ""}`, v === current ? "on" : "")).join("") || `<p class="muted">${esc(t("noVoices"))}</p>`}</div>
      ${stepper(t("rate"), settings.rate.toFixed(2) + "×")}
      ${stepper(t("pitch"), settings.pitch.toFixed(2))}
      <div class="tiles sys-test">${tile(`${icon("speaker")}<br>${esc(t("test"))}`, "", "action")}</div>
      <p class="muted">${esc(t("bestVoiceTip"))}</p>`;

    // ---- voz premium ----
    const result = body.querySelector("#pvResult");
    const sample = () => (settings.premiumVoice === PREMIUM_VOICES[0].id || settings.premiumVoice === PREMIUM_VOICES[1].id ? t("pv_sampleJarvis") : t("voiceSample"));
    const test = async () => {
      const key = store.get("elevenKey", "");
      if (!key) { result.textContent = t("pv_needKey"); return; }
      result.textContent = t("thinking");
      const err = await testPremium({ key, voiceId: settings.premiumVoice, model: settings.premiumModel, fx: settings.premiumFx }, sample(), LANGS[getLang()].speech);
      result.textContent = err ? premiumErrorText(err) : t("pv_ok");
    };
    const change = (fn) => { fn(); saveSettings(); applyVoice(); refreshPanel(); };
    body.querySelector("#pvSave").onclick = () => {
      const v = body.querySelector("#pvKey").value.trim();
      if (!v) return;
      store.set("elevenKey", v);
      settings.premiumOn = true;
      saveSettings(); applyVoice(); refreshPanel();
      setTimeout(() => body.querySelector("#pvTest")?.click(), 50);
    };
    body.querySelector("#pvDel")?.addEventListener("click", () => change(() => { localStorage.removeItem("nikolai.elevenKey"); settings.premiumOn = false; }));
    const [onT, fxT, fastT, bestT] = body.querySelectorAll(".pv-toggle .tile");
    onT.onclick = () => change(() => { settings.premiumOn = !settings.premiumOn; });
    fxT.onclick = () => change(() => { settings.premiumFx = !settings.premiumFx; });
    fastT.onclick = () => change(() => { settings.premiumModel = "eleven_flash_v2_5"; });
    bestT.onclick = () => change(() => { settings.premiumModel = "eleven_multilingual_v2"; });
    body.querySelectorAll(".pv-voices .tile").forEach((el, i) => el.addEventListener("click", () => {
      change(() => { settings.premiumVoice = PREMIUM_VOICES[i].id; settings.premiumOn = true; });
      setTimeout(() => ui.panelBody.querySelector("#pvTest")?.click(), 50);
    }));
    body.querySelector("#pvUseCustom").onclick = () => {
      const v = body.querySelector("#pvCustom").value.trim();
      if (!/^[A-Za-z0-9]{10,40}$/.test(v)) { result.textContent = t("pv_errVoice"); return; }
      change(() => { settings.premiumVoice = v; settings.premiumOn = true; });
    };
    body.querySelector("#pvTest").onclick = test;

    // ---- voces del sistema ----
    body.querySelectorAll(".sys-gender .tile").forEach((el, i) => el.addEventListener("click", () => {
      settings.gender = ["female", "male", "any"][i];
      settings.voiceName = "";
      saveSettings(); applyVoice(); refreshPanel(); speakOnce(t("voiceSample"));
    }));
    body.querySelectorAll(".sys-presets .tile").forEach((el, i) => el.addEventListener("click", () => {
      [, settings.rate, settings.pitch] = presets[i];
      // Estilo JARVIS: la mejor voz masculina disponible, más grave y pausada.
      if (presets[i][0] === "jarvis") {
        settings.gender = "male";
        const best = voicesFor(LANGS[getLang()].speech, "male")[0];
        settings.voiceName = best ? best.name : "";
      }
      saveSettings(); applyVoice(); refreshPanel(); speakOnce(presets[i][0] === "jarvis" ? t("pv_sampleJarvis") : t("voiceSample"));
    }));
    body.querySelectorAll(".voice-list .tile").forEach((el, i) => el.addEventListener("click", () => {
      settings.voiceName = all[i].name;
      saveSettings(); applyVoice(); refreshPanel(); speakOnce(t("voiceSample"));
    }));
    const [rateStep, pitchStep] = body.querySelectorAll(".stepper");
    bindStepper(rateStep, (d) => { settings.rate = clamp(settings.rate + d * 0.05, 0.6, 1.8); saveSettings(); applyVoice(); refreshPanel(); });
    bindStepper(pitchStep, (d) => { settings.pitch = clamp(settings.pitch + d * 0.05, 0.5, 1.6); saveSettings(); applyVoice(); refreshPanel(); });
    body.querySelector(".sys-test .tile").onclick = () => speakOnce(t("voiceSample"));
  },

  chat(body) {
    body.innerHTML = `
      <div class="chat-log" id="chatLog"></div>
      <form class="chat-form" id="chatForm">
        <textarea class="field" id="chatIn" rows="1" placeholder="${esc(t("typeMessage"))}"></textarea>
        <button type="button" class="tile icon-tile" data-target id="chatMic" aria-label="${esc(t("dictate"))}">${icon("mic")}</button>
        <button type="submit" class="tile icon-tile action" data-target aria-label="${esc(t("send"))}">${icon("send")}</button>
      </form>
      <div class="tiles">
        ${tile(esc(t("readAloud")), settings.chatSpeak ? t("on") : t("off"), settings.chatSpeak ? "on" : "")}
        ${tile(esc(t("clearChat")))}
      </div>`;
    const log = body.querySelector("#chatLog");
    const addMsg = (role, text) => {
      const el = document.createElement("div");
      el.className = `msg ${role}`;
      if (role === "assistant") renderInto(el, text); else el.textContent = text;
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
      return el;
    };
    history.forEach((m) => addMsg(m.role, m.content));
    if (!history.length) addMsg("assistant", greetingText());
    const input = body.querySelector("#chatIn");
    const send = () => {
      const text = input.value.trim();
      if (!text || chatBusy) return;
      input.value = "";
      addMsg("user", text);
      const bubble = addMsg("assistant", "…");
      bubble.classList.add("pending");
      let pending = false;
      ask(text, {
        channel: "text",
        speak: settings.chatSpeak,
        onText: (full) => {
          if (pending) return;
          pending = true;
          requestAnimationFrame(() => { pending = false; renderInto(bubble, full); log.scrollTop = log.scrollHeight; });
        },
        onDone: (full, err) => {
          bubble.classList.remove("pending");
          renderInto(bubble, full || errorText(err));
          if (!full) bubble.classList.add("error");
          log.scrollTop = log.scrollHeight;
        },
      });
    };
    body.querySelector("#chatForm").addEventListener("submit", (e) => { e.preventDefault(); send(); });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
    body.querySelector("#chatMic").addEventListener("click", () => dictateInto((said) => { input.value = (input.value ? input.value + " " : "") + said; input.focus(); }));
    const [speakT, clearT] = body.querySelectorAll(".tiles .tile");
    speakT.addEventListener("click", () => { settings.chatSpeak = !settings.chatSpeak; saveSettings(); refreshPanel(); });
    clearT.addEventListener("click", () => { history.length = 0; saveHistory(); refreshPanel(); updateCards(); });
    setTimeout(() => input.focus(), 50);
  },

  homework(body) {
    study.level = settings.level;
    renderHomework(body, {
      ...moduleCtx(),
      onLevel: (lv) => { settings.level = lv; saveSettings(); updateCards(); },
      onDone: () => updateCards(),
    });
  },

  terminal(body) {
    renderTerminal(body, { ...moduleCtx(), lang: getLang() });
  },
  farm(body) {
    renderFarm(body, { ...moduleCtx(), lang: getLang() });
  },
  markets(body) {
    renderMarkets(body, {
      ...moduleCtx(),
      bell: { enabled: settings.bell, toggle: () => { settings.bell = !settings.bell; saveSettings(); if (settings.bell) ringBell(); } },
    }, marketState);
  },

  offline(body) {
    const p = offline.prepared;
    const prog = offline.progress;
    const ok = (v) => (v === true || v === "ready" ? "✓" : "✕");
    const works = ["offW_time", "offW_notes", "offW_memory", "offW_timer", "offW_calc", "offW_weather", "offW_gestures", "offW_sos", "offW_sleep", "offW_markets"];
    const needs = ["offN_ai", "offN_web", "offN_live", "offN_music", "offN_translate"];
    body.innerHTML = `
      <div class="readout off-status ${isOffline() ? "down" : "up"}">
        <div class="k">${esc(t("offStatus").toUpperCase())}</div>
        <div class="v">${esc(isOffline() ? t("offIsOffline") : t("offIsOnline"))}</div>
        <p class="muted">${esc(t("offExplain"))}</p>
      </div>
      <div class="tiles wide">
        ${tile(`${icon("install")}<br>${esc(prog ? t("offPreparing") : p ? t("offUpdate") : t("offPrepare"))}`, prog ? `${prog.done}/${prog.total} · ${Math.round(prog.bytes / 1e6)} MB` : "", "action" + (prog ? " live" : ""))}
        ${tile(esc(t("lowPower")), settings.lowPower ? t("on") : t("off"), settings.lowPower ? "on" : "")}
        ${offlineSpeechSupported ? tile(`${icon("mic")}<br>${esc(t("offSpeechBtn"))}`, offlineSpeechReady() ? "✓" : esc(t("experimental")).toUpperCase(), offlineSpeechReady() ? "on" : "") : ""}
      </div>
      ${p ? `<div class="readout"><div class="k">${esc(t("offPack").toUpperCase())} · ${esc(new Date(p.at).toLocaleString(getLang()))}</div>
        <div class="diag">
          <div class="diag-row ${p.files ? "good" : "bad"}"><span>${ok(p.files)}</span>${esc(t("offPackFiles"))} (${p.mb} MB)</div>
          <div class="diag-row ${p.weather ? "good" : "bad"}"><span>${ok(p.weather)}</span>${esc(t("offPackWeather"))}</div>
          <div class="diag-row ${p.coins ? "good" : "bad"}"><span>${ok(p.coins)}</span>${esc(t("offPackCoins"))}</div>
          <div class="diag-row ${p.speech === "ready" ? "good" : "bad"}"><span>${ok(p.speech)}</span>${esc(p.speech === "ready" ? t("offPackSpeech") : t("offPackNoSpeech"))}</div>
        </div></div>` : ""}
      <div class="off-cols">
        <div class="readout"><div class="k">${esc(t("offWorks").toUpperCase())}</div><ul class="off-list good">${works.map((k) => `<li>${esc(t(k))}</li>`).join("")}</ul></div>
        <div class="readout"><div class="k">${esc(t("offNeeds").toUpperCase())}</div><ul class="off-list bad">${needs.map((k) => `<li>${esc(t(k))}</li>`).join("")}</ul></div>
      </div>
      <div class="readout"><div class="k">${esc(t("offPending").toUpperCase())} · ${offline.pending.length}</div>
        ${offline.pending.length ? offline.pending.map((q, i) => `<div class="note-row"><div class="readout"><div class="v small">${esc(q.text)}</div></div><button class="tile" data-target data-pi="${i}" aria-label="${esc(t("remove"))}">${icon("trash")}</button></div>`).join("") : `<p class="muted">${esc(t("offNoPending"))}</p>`}
      </div>`;
    const [prep, power, speech] = body.querySelectorAll(".tiles.wide .tile");
    speech?.addEventListener("click", async () => {
      if (isOffline()) { ui.reply.textContent = t("offNeedNet"); return; }
      ui.reply.textContent = t("offPreparing");
      const r = await prepareOfflineSpeech(LANGS[getLang()].speech);
      if (offline.prepared) markPrepared({ ...offline.prepared, speech: r });
      ui.reply.textContent = r === "ready" ? t("offPackSpeech") + " ✓" : t("offPackNoSpeech");
      if (openId === "offline") refreshPanel();
    });
    prep.addEventListener("click", () => {
      if (offline.progress) return;
      if (isOffline()) { ui.reply.textContent = t("offNeedNet"); return; }
      prepareOffline(() => { if (openId === "offline") refreshPanel(); });
    });
    power.addEventListener("click", () => { settings.lowPower = !settings.lowPower; saveSettings(); applyLowPower(); refreshPanel(); });
    body.querySelectorAll("[data-pi]").forEach((b) => b.addEventListener("click", () => { removePending(Number(b.dataset.pi)); refreshPanel(); updateCards(); }));
  },

  memory(body) {
    renderMemory(body, {
      ...moduleCtx(),
      onChange: () => { updateCards(); renderSides(); },
      describe: brain.apiKey ? describePhoto : null,
    });
  },

  music(body) {
    renderMusic(body, { ...moduleCtx(), onChange: updateCards, clap: clapCtx() });
    if (spotifyConnected()) refreshNow().then(() => { if (openId === "music" && !body.querySelector(".now-row") && spotify.now) refreshPanel(); updateCards(); });
  },

  news(body) {
    renderNews(body, moduleCtx());
  },

  bots(body) {
    renderBots(body, { ...moduleCtx(), lang: getLang() });
  },

  watch(body) {
    renderWatch(body, { ...moduleCtx(), speak: (txt) => speakOnce(txt) });
    updateCards();
  },

  studio(body) {
    renderStudio(body, { ...moduleCtx(), speakIfVoice: (txt) => settings.chatSpeak && speakOnce(txt) });
    updateCards();
  },

  persona(body) {
    const P = ["nikolai", "lawyer", "friend", "house", "jfk"];
    body.innerHTML = `
      <div class="persona-cards">${P.map((p) => `
        <div class="persona-card ${p} ${settings.persona === p ? "on" : ""}">
          <div class="pc-head"><span class="pc-ico">${{ nikolai: "◉", lawyer: "⚖", friend: "♥", house: "▣", jfk: "★" }[p]}</span>
            <div><b>${esc(t("persona_" + p))}</b><small class="mono">${esc(t("personaSub_" + p))}</small></div></div>
          <p>${esc(t("personaDesc_" + p))}</p>
          ${p === "jfk" ? `
            <img class="pc-photo" src="${JFK_PHOTO}" alt="John F. Kennedy" referrerpolicy="no-referrer" onerror="this.remove()">
            <div class="pc-quick">
              <button class="nw-mini ${settings.jfkLang === "es" ? "on" : ""}" data-target data-jfk="es">${esc(t("jfk_es"))}</button>
              <button class="nw-mini ${settings.jfkLang === "en" ? "on" : ""}" data-target data-jfk="en">${esc(t("jfk_en"))}</button>
              <button class="nw-mini ${settings.jfkVintage ? "on" : ""}" data-target data-jfk="vintage">${esc(t("jfk_vintage"))}</button>
            </div>
            <div class="pc-real"><span class="mono">${esc(t("jfk_real").toUpperCase())}</span>
              ${JFK_SPEECHES.map(([k, q]) => `<a class="nw-mini" href="https://www.youtube.com/results?search_query=${encodeURIComponent(q)}" target="_blank" rel="noopener" data-target>▶ ${esc(t(k))}</a>`).join("")}
              <a class="nw-mini" href="https://www.jfklibrary.org/learn/about-jfk/historic-speeches" target="_blank" rel="noopener" data-target>${esc(t("jfk_library"))}</a>
            </div>` : ""}
          ${p !== "nikolai" ? `<div class="pc-quick">${[1, 2, 3, 4].map((i) => `<button class="nw-mini" data-target data-q="${p}:${i}">${esc(t(`pq_${p}${i}`))}</button>`).join("")}</div>` : ""}
          <button class="tile ${settings.persona === p ? "on" : "action"}" data-target data-persona="${p}"><span class="t-main">${esc(settings.persona === p ? t("ps_active") : t("ps_use"))}</span></button>
        </div>`).join("")}</div>
      <div class="readout emo-box ${settings.emotions ? "on" : ""}">
        <div class="k">${esc(t("emo_title").toUpperCase())} · ${settings.emotions ? `${MOODS[currentMood().mood][0]} ${esc(t("mood_" + currentMood().mood))}` : esc(t("off"))}</div>
        <p>${esc(t("emo_desc"))}</p>
        <div class="tiles">
          ${tile(esc(settings.emotions ? t("emo_off") : t("emo_on")), "", settings.emotions ? "on" : "action")}
          ${tile(esc(t("emo_soft")), "", settings.emoIntensity === "soft" ? "on" : "")}
          ${tile(esc(t("emo_high")), "", settings.emoIntensity === "high" ? "on" : "")}
        </div>
        ${settings.emotions ? `<div class="pc-quick">
          <button class="nw-mini" data-target data-emoq="1">${esc(t("emoq_1"))}</button>
          <button class="nw-mini" data-target data-emoq="2">${esc(t("emoq_2"))}</button>
          <button class="nw-mini" data-target data-emoq="3">${esc(t("emoq_3"))}</button>
          <button class="nw-mini" data-target data-emoq="4">${esc(t("emoq_4"))}</button>
        </div>` : ""}
        <p class="muted">${esc(t("emo_note"))}</p>
      </div>
      <div class="readout call-promo">
        <div class="k">${esc(t("call_title").toUpperCase())}</div>
        <p>${esc(t("call_desc"))}</p>
        <div class="tiles">
          ${tile(`${icon("phone")}<br>${esc(call.active ? t("call_end") : t("call_start"))}`, "", "action call-go")}
          ${tile(esc(t("call_seeAlways")), settings.callSees ? esc(t("on")) : esc(t("off")), settings.callSees ? "on" : "")}
          ${tile(esc(t("ps_voice")), settings.personaVoice ? esc(t("on")) : esc(t("off")), settings.personaVoice ? "on" : "")}
        </div>
        <p class="muted">${esc(t("call_privacy"))}</p>
      </div>
      <p class="muted">${esc(t("ps_note"))}</p>`;
    body.querySelectorAll("[data-persona]").forEach((b) => b.addEventListener("click", () => setPersona(b.dataset.persona, true)));
    body.querySelectorAll("[data-jfk]").forEach((b) => b.addEventListener("click", () => {
      const v = b.dataset.jfk;
      if (v === "vintage") settings.jfkVintage = !settings.jfkVintage; else settings.jfkLang = v;
      saveSettings();
      if (settings.persona === "jfk") { applyVoice(); refreshPanel(); speakOnce(t(v === "en" ? "persona_hello_jfk_en" : "persona_hello_jfk").replace("{name}", "")); }
      else setPersona("jfk", true);
    }));
    body.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => {
      const [p, i] = b.dataset.q.split(":");
      if (settings.persona !== p) setPersona(p, false);
      ask(t(`pq_${p}${i}`));
    }));
    const [eOn, eSoft, eHigh] = body.querySelectorAll(".emo-box .tile");
    eOn.onclick = () => { setEmotions(!settings.emotions); if (settings.emotions) speakOnce(t("emo_hello")); };
    eSoft.onclick = () => { settings.emoIntensity = "soft"; saveSettings(); refreshPanel(); };
    eHigh.onclick = () => { settings.emoIntensity = "high"; saveSettings(); refreshPanel(); };
    body.querySelectorAll("[data-emoq]").forEach((b) => b.addEventListener("click", () => ask(t("emoq_" + b.dataset.emoq))));
    const [go, sees, pv] = body.querySelectorAll(".call-promo .tile");
    go.onclick = () => (call.active ? endCall() : startCall());
    sees.onclick = () => { settings.callSees = !settings.callSees; saveSettings(); refreshPanel(); };
    pv.onclick = () => { settings.personaVoice = !settings.personaVoice; saveSettings(); applyVoice(); refreshPanel(); updateCards(); };
  },

  work(body) {
    renderWork(body, { ...moduleCtx(), speakIfVoice: (txt) => settings.chatSpeak && speakOnce(txt) });
  },

  projects(body) {
    renderProjects(body, { ...moduleCtx(), onChange: updateCards });
  },

  money(body) {
    renderMoney(body, { ...moduleCtx(), onChange: updateCards });
  },

  weather(body) {
    renderWeather(body, { ...moduleCtx(), lang: getLang(), onUpdate: updateCards });
  },

  tools(body) {
    renderTools(body, moduleCtx());
  },

  sos(body) {
    renderSos(body, moduleCtx());
  },

  profile(body) {
    renderProfile(body, { ...moduleCtx(), onSaved: () => { updateCards(); renderSides(); } });
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
    const ok = (v) => (v ? "✓" : "✕");
    const checks = [
      [t("diagSecure"), window.isSecureContext],
      [t("diagBrowser"), !inAppBrowser],
      [t("diagSpeech"), speechSupported],
      [t("diagMic"), Boolean(navigator.mediaDevices?.getUserMedia)],
      [t("diagTts"), "speechSynthesis" in window],
      [t("diagCamera"), Boolean(gestures?.running)],
    ];
    body.innerHTML = `
      <div class="grid-stats" id="sysLive"></div>
      <div class="readout"><div class="k">${esc(t("diagTitle").toUpperCase())}</div>
        <div class="diag">${checks.map(([k, v]) => `<div class="diag-row ${v ? "good" : "bad"}"><span>${ok(v)}</span>${esc(k)}</div>`).join("")}</div>
        ${inAppBrowser ? `<p class="notice-err">${esc(t("camErrInApp"))}</p>` : ""}
        ${lastMicError ? `<p class="notice-err">${esc(lastMicError)}</p>` : ""}
        ${lastCamError ? `<p class="notice-err">${esc(lastCamError)}</p>` : ""}
      </div>
      <div class="tiles">
        ${tile(`${icon("mic")}<br>${esc(t("testMic"))}`, "", "action")}
        ${tile(`${icon("camera")}<br>${esc(t("testCam"))}`, "", "action")}
        ${tile(`${icon("speaker")}<br>${esc(t("test"))}`, "", "action")}
      </div>
      <p class="muted" id="diagOut">${esc(t("diagHint"))}</p>
      <p class="muted mono">${esc(t("appVersion"))}: ${APP_VERSION} · ${MODULES.length} ${esc(t("modulesWord"))}</p>
      <div class="readout"><div class="k">${esc(t("vlogTitle").toUpperCase())}</div><div class="vlog" id="voiceLog">${voiceLogHtml()}</div></div>
      <div class="readout"><div class="k">${esc(t("micLevel"))}</div><div class="meter"><i id="sysMeter"></i></div></div>
      ${brain.model ? `<p class="muted mono">MODEL · ${esc(brain.model)}</p>` : ""}`;
    const live = body.querySelector("#sysLive");
    const out = body.querySelector("#diagOut");
    const render = () => {
      const v = values();
      live.innerHTML = `
        ${readout(t("brain"), brain.apiKey ? `${t("ready")}` : brain.ok ? t("noKey") : t("offline"))}
        ${readout(t("camera"), gestures?.running ? `${v.fps} ${t("fps")}` : "OFF")}
        ${readout(t("hand"), gestures?.handVisible ? t("detected") : t("none"))}
        ${readout(t("network"), navigator.onLine ? t("online") : t("offline"))}
        ${readout(t("battery"), v.battery)}
        ${readout(t("latency"), stats.lastLatency == null ? "—" : `${stats.lastLatency} ms`)}`;
      const meter = body.querySelector("#sysMeter");
      if (meter) meter.style.width = `${Math.min(100, Math.round((meterLevel() || 0) * 300))}%`;
    };
    render();
    panelTimer = setInterval(render, 250);
    const [micT, camT, ttsT] = body.querySelectorAll(".tiles .tile");
    micT.addEventListener("click", () => {
      out.textContent = t("diagSpeakNow");
      dictateInto((said) => { out.textContent = `✓ ${t("diagHeard")}: «${said}»`; });
    });
    camT.addEventListener("click", async () => {
      out.textContent = t("loading");
      await startCamera();
      out.textContent = gestures?.running ? `✓ ${t("diagCamOk")}` : lastCamError;
    });
    ttsT.addEventListener("click", () => speakOnce(t("voiceSample")));
  },

  settings(body) {
    const toggle = (key, label) => tile(esc(label), settings[key] ? t("on") : t("off"), settings[key] ? "on" : "");
    body.innerHTML = `
      <div class="tiles wide">
        ${tile(`${icon("camera")}<br>${esc(gestures?.running ? t("camOff") : t("camOn"))}`, "", "action" + (gestures?.running ? " live" : ""))}
        ${tile(esc(t("camFront")), esc(t("camera").toUpperCase()), settings.facing === "user" ? "on" : "")}
        ${tile(esc(t("camRear")), esc(t("camera").toUpperCase()), settings.facing !== "user" ? "on" : "")}
      </div>
      ${lastCamError ? `<p class="notice-err">${esc(lastCamError)}</p>` : ""}
      <div class="tiles wide toggles">${toggle("poke", t("poke"))}${toggle("pinch", t("pinch"))}${toggle("dwell", t("dwell"))}${toggle("showCam", t("showCam"))}</div>
      ${stepper(t("smoothing"), settings.smoothing.toFixed(2))}`;
    const [camBtn, front, rear] = body.querySelectorAll(".tiles:first-child .tile");
    camBtn.addEventListener("click", () => {
      if (gestures?.running) { gestures.stop(); gestures = null; ui.sensor.classList.add("off"); ui.camStart.hidden = false; refreshPanel(); }
      else startCamera();
    });
    front.addEventListener("click", () => { settings.facing = "user"; saveSettings(); startCamera(); });
    rear.addEventListener("click", () => { settings.facing = "environment"; saveSettings(); startCamera(); });
    const keys = ["poke", "pinch", "dwell", "showCam"];
    body.querySelectorAll(".tiles.toggles .tile").forEach((el, i) => el.addEventListener("click", () => {
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

// Web sin servidor: la clave de Anthropic se guarda solo en este navegador.
function keyForm() {
  const has = Boolean(Brain.getKey());
  return `<div class="readout key-box">
      <div class="k">${esc(t("apiKey").toUpperCase())} · ${has ? "✓ " + esc(t("keySaved")) : esc(t("keyMissing"))}</div>
      <ol class="steps">
        <li>${esc(t("keyStep1"))} <a class="key-link" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" data-target>console.anthropic.com</a></li>
        <li>${esc(t("keyStep2"))}</li>
        <li>${esc(t("keyStep3"))}</li>
      </ol>
      <div class="key-row">
        <input id="apiKeyIn" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…">
        <button class="tile" data-target id="apiKeySave"><span class="t-main">${esc(t("saveKey"))}</span></button>
        ${has ? `<button class="tile" data-target id="apiKeyTest"><span class="t-main">${esc(t("testKey"))}</span></button>` : ""}
        ${has ? `<button class="tile" data-target id="apiKeyDel"><span class="t-main">${esc(t("deleteKey"))}</span></button>` : ""}
      </div>
      <p class="muted" id="keyResult">${esc(t("keyCost"))}</p>
    </div>`;
}

function bindKeyForm(body) {
  const save = body.querySelector("#apiKeySave");
  if (!save) return;
  const input = body.querySelector("#apiKeyIn");
  save.addEventListener("click", () => {
    const key = input.value.trim();
    if (!/^sk-ant-/.test(key)) { input.focus(); ui.reply.textContent = t("keyInvalid"); return; }
    Brain.setKey(key);
    brain.apiKey = true;
    ui.reply.textContent = t("keySaved");
    refreshPanel();
    testKey();
    renderSides();
    updateCards();
  });
  body.querySelector("#apiKeyTest")?.addEventListener("click", testKey);
  body.querySelector("#apiKeyDel")?.addEventListener("click", () => {
    Brain.setKey("");
    brain.apiKey = false;
    refreshPanel();
    renderSides();
    updateCards();
  });
}

const marketState = {};
let chatBusy = false;

/** Lo que necesitan los módulos externos para pintar y hablar. */
function moduleCtx() {
  return {
    t, esc, tile, icon, stream, errorText, lang: getLang(),
    speak: (text, lang) => speakOnce(text, lang),
    dictate: dictateInto,
    open: openPanel,
  };
}

/** Escucha una frase y la entrega como texto (para escribir con la voz). */
function dictateInto(cb) {
  voiceTask = { kind: "dictate", cb };
  if (!speechSupported) { ui.reply.textContent = t("noSpeech"); voiceTask = null; return; }
  ensureMic();
  stopAll();
  listenNow();
}

function greetingText() {
  const d = daysToBirthday();
  const name = profile.name ? `, ${profile.name}` : "";
  if (d === 0) return t("birthdayGreeting").replace("{name}", name);
  return t("greeting");
}

/** Hace una pregunta mínima para comprobar que la clave funciona y tiene créditos. */
async function testKey() {
  const out = () => document.querySelector("#keyResult");
  if (out()) out().textContent = t("keyTesting");
  let text = "";
  let err;
  try {
    err = await stream({ messages: [{ role: "user", content: t("keyPing") }], channel: "text" }, { onText: (d) => { text += d; } });
  } catch (e) {
    err = "connection";
  }
  const msg = !err && text ? `✓ ${t("keyOk")}`
    : err === "auth" ? t("keyBad")
    : err === "credits" ? t("keyNoCredits")
    : err === "rate_limit" ? t("keyRate")
    : `${t("keyFail")} (${err || "—"})`;
  if (out()) out().textContent = msg;
  ui.reply.textContent = msg;
}

// =====================================================================
// Sin conexión: respuestas locales, preguntas pendientes y paquete offline
// =====================================================================
function localCtx() {
  return {
    t, lang: getLang(), notes: notes.map((n) => n.text),
    addNote: (x) => { addNote(x); if (openId === "notes") refreshPanel(); },
    memories: memoriesForBrain(t), memoryEnabled: memory.enabled,
    addMemory: (x) => { addMemory({ text: x, category: "other" }); updateCards(); },
    forget: (x) => forgetMatching(x),
    startTimer: (secs) => { startTimer(secs); updateCards(); },
    calc, weather, weatherSentence: () => weatherSentence(t),
    open: openPanel, dial, emergencyNumber: profile.emergencyNumber,
    profileName: profile.name, salutation,
  };
}

function answerOffline(text, { speak = true, onText, onDone } = {}) {
  stopAll();
  const { reply, queued } = localAnswer(text, localCtx());
  if (queued) addPending(text);
  history.push({ role: "user", content: text }, { role: "assistant", content: reply });
  saveHistory();
  lastReply = reply;
  onText?.(reply);
  onDone?.(reply, null);
  updateCards();
  if (speak) speakOnce(reply);
  else { ui.reply.textContent = reply; afterSpeech(); }
}

/** Al volver internet: responde las preguntas que quedaron pendientes. */
async function flushPending() {
  if (isOffline() || !offline.pending.length || !brain.apiKey || sleeping) return;
  const list = takePending();
  updateCards();
  ui.reply.textContent = t("offBack").replace("{n}", list.length);
  for (const p of list) {
    await new Promise((resolve) => ask(`${t("offPendingPrefix")} ${p.text}`, { channel: "text", speak: voiceOn, onDone: resolve }));
    while (speaker.speaking) await new Promise((r) => setTimeout(r, 400));
  }
}

function updateNetChip() {
  const chip = $("#netState");
  if (!chip) return;
  chip.textContent = isOffline() ? t("offChip") : "";
  chip.hidden = !isOffline();
  document.body.classList.toggle("is-offline", isOffline());
}

addEventListener("offline", () => { updateNetChip(); renderSides(); updateCards(); if (!sleeping) speakOnce(t("offWentOffline")); });
addEventListener("online", () => { updateNetChip(); renderSides(); updateCards(); setTimeout(flushPending, 1500); });

/** Descarga lo necesario para usar NIKOLAI sin internet. */
async function prepareOffline(onUpdate) {
  offline.progress = { done: 0, total: 1, failed: 0, bytes: 0 };
  onUpdate();
  const results = {};
  // 1) Archivos de la app y recursos pesados, vía el service worker.
  const reg = await navigator.serviceWorker?.ready.catch(() => null);
  if (reg?.active) {
    await new Promise((resolve) => {
      const onMsg = (e) => {
        if (e.data?.type !== "offline-progress") return;
        offline.progress = e.data;
        onUpdate();
        if (e.data.finished) { navigator.serviceWorker.removeEventListener("message", onMsg); resolve(); }
      };
      navigator.serviceWorker.addEventListener("message", onMsg);
      reg.active.postMessage({ type: "prepare-offline" });
      setTimeout(resolve, 180_000);
    });
    results.files = offline.progress.failed === 0;
  } else results.files = false;
  // 2) Datos para consultar sin internet: clima y bolsa.
  await loadWeather(getLang()).catch(() => {});
  results.weather = Boolean(weather.data);
  await loadCoins().catch(() => {});
  results.coins = market.coins.length > 0;
  results.speech = offlineSpeechReady() ? "ready" : "no";
  markPrepared({ ...results, mb: Math.round((offline.progress?.bytes || 0) / 1e6) });
  offline.progress = null;
  onUpdate();
}

function applyLowPower() {
  document.body.classList.toggle("lowpower", settings.lowPower);
}

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
// Historial de conversación: se guarda en este navegador para recordar entre visitas.
const history = store.get("history", []);
const saveHistory = () => store.set("history", history.slice(-40));
// Repara un historial guardado que haya quedado desordenado (dos preguntas seguidas, etc.).
(() => {
  const fixed = [];
  for (const m of history) {
    if (!m || typeof m.content !== "string" || !m.content.trim()) continue;
    if (fixed.length && fixed[fixed.length - 1].role === m.role) fixed[fixed.length - 1] = m; // se queda la más reciente
    else fixed.push(m);
  }
  while (fixed.length && fixed[0].role !== "user") fixed.shift();
  if (fixed.length !== history.length) { history.splice(0, history.length, ...fixed); saveHistory(); }
})();

function applyVoice() {
  speaker.voiceName = settings.voiceName;
  speaker.gender = settings.gender === "any" ? "female" : settings.gender;
  const elevenKey = store.get("elevenKey", "");
  speaker.premium = settings.premiumOn && elevenKey
    ? { key: elevenKey, voiceId: settings.premiumVoice, model: settings.premiumModel, fx: settings.premiumFx }
    : null;
  speaker.rate = settings.rate;
  speaker.pitch = settings.pitch;
  // Cada personalidad con su voz (se puede desactivar en Personalidades).
  const pv = settings.personaVoice && PERSONA_VOICE[settings.persona];
  if (pv) {
    if (speaker.gender !== pv.gender) { speaker.gender = pv.gender; speaker.voiceName = ""; }
    speaker.pitch = clamp(settings.pitch * pv.pitch, 0.5, 1.6);
    if (speaker.premium && PREMIUM_VOICES.some((v) => v.id === settings.premiumVoice)) speaker.premium = { ...speaker.premium, voiceId: pv.premium, fx: (settings.persona === "lawyer" || settings.persona === "house") && speaker.premium.fx };
  }
  // La emoción cambia un poco la voz (más lenta si está triste, más rápida si está emocionada o enojada).
  const mv = MOODS[currentMood().mood];
  if (settings.emotions && mv) { speaker.rate = clamp(speaker.rate * mv[1], 0.5, 2); speaker.pitch = clamp(speaker.pitch * mv[2], 0.5, 1.8); }
  // JFK: en inglés (su idioma) o doblado al español, con sonido de tele de 1963.
  if (settings.persona === "jfk") {
    if (settings.jfkLang === "en") speaker.lang = "en-US";
    if (speaker.premium && settings.jfkVintage) speaker.premium = { ...speaker.premium, fx: "vintage" };
  }
  speaker.lang = LANGS[getLang()].speech;
  listener.lang = LANGS[getLang()].speech;
}

function setState(s, label) {
  state = s;
  // En el celular el micrófono no se comparte: los aplausos solo escuchan cuando la conversación
  // por voz está apagada o NIKOLAI está en reposo; mientras conversas, el micrófono es del reconocimiento.
  if (mobileClaps()) {
    if (s === "listening" || (voiceOn && !sleeping)) claps.stop();
    else if (!claps.running && typeof startClaps === "function") setTimeout(() => state !== "listening" && !(voiceOn && !sleeping) && startClaps(), 300);
  }
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

let micChecked = false;
let speechActive = false; // el reconocimiento detecta voz (para animar la onda en el celular)

/**
 * Pide permiso de micrófono. En el celular NO se deja abierto: Android no deja
 * que el reconocimiento de voz use el micrófono si otra parte de la página lo tiene.
 */
async function ensureMic() {
  if (mic.analyser || micChecked) return true;
  if (!navigator.mediaDevices?.getUserMedia) return false;
  if (isMobile) {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((tr) => tr.stop());
      micChecked = true;
      return true;
    } catch (err) {
      showMicError(err.name === "NotAllowedError" ? "not-allowed" : "audio-capture");
      return false;
    }
  }
  try { await mic.start(); return true; } catch (err) {
    if (err.name === "NotAllowedError") { showMicError("not-allowed"); return false; }
    return true; // sin medidor, pero el reconocimiento puede funcionar
  }
}

/** Explica por qué no se oye al usuario y cómo arreglarlo. */
function showMicError(code) {
  const key = {
    "not-allowed": "micErrDenied", "service-not-allowed": "micErrDenied", "audio-capture": "micErrBusy",
    network: isBrave ? "micErrBrave" : "micErrNetwork", "language-not-supported": "micErrLang",
  }[code] || "micErrGeneric";
  lastMicError = t(key);
  ui.reply.textContent = lastMicError;
  if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture" || code === "network") {
    voiceOn = false;
    voiceTask = null;
    setState("off");
  }
}
let lastMicError = "";
let micRetries = 0, micBusyRetry = false;

// Registro de voz: qué oyó, qué envió y qué pasó (para encontrar dónde se corta).
const voiceLog = [];
function vlog(kind, text = "") {
  const last = voiceLog[voiceLog.length - 1];
  // «Escuchando» repetido (silencio) se cuenta en una sola línea.
  if (last && last.kind === kind && kind === "listen") { last.at = new Date(); last.n = (last.n || 1) + 1; last.text = `×${last.n}`; }
  else voiceLog.push({ at: new Date(), kind, text: String(text).slice(0, 140) });
  if (voiceLog.length > 12) voiceLog.shift();
  const el = document.querySelector("#voiceLog");
  if (el) el.innerHTML = voiceLogHtml();
}
function voiceLogHtml() {
  if (!voiceLog.length) return `<p class="muted">${esc(t("vlogEmpty"))}</p>`;
  return voiceLog.slice().reverse().map((e) => `<div class="vlog-row ${e.kind}"><span class="mono">${e.at.toLocaleTimeString(getLang(), { hour12: false })}</span><b>${esc(t("vlog_" + e.kind))}</b><span>${esc(e.text)}</span></div>`).join("");
}
/** Nivel del micrófono para el medidor (en el celular solo hay señal mientras se detecta voz). */
function meterLevel() {
  if (mic.analyser) return mic.level();
  return state === "listening" && speechActive ? 0.25 + Math.random() * 0.1 : 0;
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
    lastMicError = "";
    micRetries = 0;
    if (isMobile) claps.stop();
    ensureMic();
    if (!greeted) {
      greeted = true;
      speakOnce(greetingText());
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
  // Si los aplausos tenían el micrófono, se suelta y se espera un momento antes de escuchar
  // (si no, Android/iPhone dan «audio-capture» y la voz se apagaba).
  if (claps.running && (isMobile || micBusyRetry)) { claps.stop(); restartTimer = setTimeout(listenNow, 450); return; }
  lastListenAt = performance.now();
  listener.lang = LANGS[getLang()].speech;
  setState("listening");
  vlog("listen");
  const ok = listener.listen({
    onInterim: (text) => { speechActive = true; micRetries = 0; ui.heard.innerHTML = `<b>›</b> ${esc(text)}`; },
    onSound: (on) => { speechActive = on; },
    onFinal: handleFinal,
    onEnd: (got) => {
      if (got || state !== "listening") return;
      if (sleeping && mobileClaps()) { voiceTask = null; setState("off"); startWakeListening(); return; }
      restartTimer = setTimeout(listenNow, 150); // silencio: seguir escuchando
    },
    onError: (err) => {
      if (err === "no-speech" || err === "aborted") return; // silencio: se vuelve a escuchar
      vlog("micError", err);
      // Micrófono ocupado o fallo de red pasajero: libera el micrófono y reintenta antes de rendirse.
      if ((err === "audio-capture" || err === "network") && micRetries < 3) {
        micRetries++;
        micBusyRetry = true;
        claps.stop();
        if (!isMobile) mic.stop?.();
        restartTimer = setTimeout(listenNow, 700 * micRetries);
        return;
      }
      showMicError(err);
    },
  });
  if (!ok) setState("off");
}

function handleFinal(text) {
  micRetries = 0;
  lastMicError = "";
  vlog("heard", text);
  lastHeard = text;
  ui.heard.innerHTML = `<b>${esc(t("you").toUpperCase())} ›</b> ${esc(text)}`;
  const task = voiceTask;
  voiceTask = null;
  if (task?.kind === "wake") {
    if (WAKE_RE.test(text)) wake("voice");
    else if (mobileClaps()) { setState("off"); startWakeListening(); } // vuelve a escuchar aplausos
    else { voiceTask = task; listenNow(); } // sigue en reposo esperando «despierta»
    return;
  }
  if (!task && SLEEP_RE.test(text)) { goToSleep(); return; }
  // «Activa tus emociones» / «apaga tus sentimientos»: al instante, sin esperar a la IA.
  if (!task && EMO_ON_RE.test(text)) { setEmotions(true, /dram[aá]tic|intens|much/i.test(text) ? "high" : undefined); speakOnce(t("emo_hello")); return; }
  if (!task && EMO_OFF_RE.test(text)) { setEmotions(false); speakOnce(t("emo_bye")); return; }
  // Con música sonando solo hace caso si la llamas por su nombre (para no reaccionar a la letra).
  if (!task && miniPlayer.playing && miniPlayer.visible && settings.mode !== "wake") {
    const command = stripWakeWord(text);
    if (command === null) { vlog("ignoredMusic", text); listenNow(); return; }
    if (command) { ask(command); return; }
  }
  if (task?.kind === "dictate") {
    task.cb(text);
    afterSpeech();
    return;
  }
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
    if (command === null) { vlog("ignoredWake", text); listenNow(); return; } // no era para mí
    if (!command) { speakOnce(t("yes")); return; }
    ask(command);
    return;
  }
  ask(text);
}

/** Pantalla completa (Chrome, Edge, Android y Safari en Mac; en iPhone se usa «Añadir a inicio»). */
function toggleFullscreen() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen)?.call(d); return; }
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req) { try { const r = req.call(el, { navigationUI: "hide" }); r?.catch?.(() => { ui.reply.textContent = t("fullscreenIos"); }); } catch { ui.reply.textContent = t("fullscreenIos"); } }
  else ui.reply.textContent = t("fullscreenIos");
}
$("#hdrFull")?.addEventListener("click", toggleFullscreen);
["fullscreenchange", "webkitfullscreenchange"].forEach((ev) => document.addEventListener(ev, () => $("#hdrFull")?.classList.toggle("on", Boolean(document.fullscreenElement || document.webkitFullscreenElement))));

function speakOnce(text, lang) {
  stopAll();
  lastReply = text;
  ui.reply.textContent = text;
  setState("speaking");
  speaker.say(text, lang || speaker.lang);
}

function afterSpeech() {
  if (pendingSleep) { pendingSleep = false; enterSleep(); return; }
  if (voiceOn || voiceTask) restartTimer = setTimeout(listenNow, 350);
  else setState("off");
}
speaker.onStart = () => { if (state === "thinking") setState("speaking"); };
speaker.onWatchdog = () => vlog("ttsStuck");
let premiumWarned = 0;
speaker.onPremiumError = (e) => {
  vlog("premiumError", e.status || e.message);
  // Avisa una vez por minuto como mucho y sigue con la voz del sistema.
  if (Date.now() - premiumWarned > 60_000) { premiumWarned = Date.now(); ui.heard.textContent = premiumErrorText(e); }
};
function premiumErrorText(e) {
  const st = e?.status;
  return st === 401 ? t("pv_errKey") : st === 402 || /quota|credit/i.test(e?.message) ? t("pv_errQuota") : st === 404 || st === 400 ? t("pv_errVoice") : `${t("pv_errOther")} (${st || e?.message || "?"})`;
}
speaker.onIdle = () => { if (state === "speaking" || state === "thinking") afterSpeech(); };

const ACTIONS = {
  set_persona: ({ persona }) => setPersona(persona, false),
  set_mood: ({ mood: m, intensity }) => { if (settings.emotions) setMood(m, intensity); },
  set_emotions: ({ on, intensity }) => setEmotions(on, intensity),
  video_call: ({ action }) => (action === "start" ? startCall() : endCall()),
  set_language: ({ code }) => applyLanguage(code),
  open_panel: ({ panel }) => (panel === "none" ? closePanel() : openPanel(panel)),
  save_note: ({ text }) => { addNote(text); if (openId === "notes") refreshPanel(); },
  remember: ({ text, category }) => { if (memory.enabled) addMemory({ text, category }); updateCards(); if (openId === "memory") refreshPanel(); },
  forget: ({ text }) => { forgetMatching(text); updateCards(); if (openId === "memory") refreshPanel(); },
  start_timer: ({ minutes }) => { startTimer(Math.round(minutes * 60)); updateCards(); if (openId === "tools") refreshPanel(); },
  play_music: async ({ query }) => {
    const preset = presetFor(query);
    if (spotifyConnected()) {
      try {
        const found = preset ? [{ type: "playlist", id: preset.id, uri: `spotify:playlist:${preset.id}` }] : await spotifySearch(query);
        const item = found.find((x) => x.type === "track") || found[0];
        if (item) {
          try { await playItem(item); } catch { await playInEmbed(item.type, item.id, item.title || query); }
          return;
        }
      } catch { /* sin Premium o sin dispositivo: se usa el reproductor flotante */ }
    }
    const p = preset || PRESETS[0];
    playInEmbed("playlist", p.id, t("sp_" + p.key));
  },
  music_control: ({ action }) => {
    spotifyControl(action).catch(() => openPanel("music")).finally(updateCards);
  },
  emergency: ({ target }) => {
    openPanel("sos");
    if (target === "services") dial(profile.emergencyNumber);
    else if (target === "contact") { if (!dial(profile.contactPhone)) openPanel("profile"); }
    else shareLocation(t);
  },
};

/** Quita del historial una pregunta que se quedó sin respuesta (interrumpida o con error). */
function dropOrphan(msg) {
  const i = history.lastIndexOf(msg);
  if (i >= 0 && history[i + 1]?.role !== "assistant") { history.splice(i, 1); saveHistory(); }
}

/** Envía la petición al cerebro (servidor o directo) con el idioma y la hora. */
function stream(payload, handlers) {
  const model = { max: "claude-opus-5-5", balanced: "claude-sonnet-5-5", fast: "claude-haiku-5-5" }[settings.aiSpeed];
  return Brain.stream({ lang: getLang(), now: new Date().toString(), profile, memories: memoriesForBrain(t), model, persona: settings.persona, emotions: settings.emotions ? { on: true, intensity: settings.emoIntensity, mood: currentMood().mood, hoursAway: awayHours } : undefined, personaLang: settings.persona === "jfk" ? settings.jfkLang : "es", video: call.active, ...payload }, handlers);
}

/** Pide a NIKOLAI una descripción corta de una foto para guardarla como recuerdo. */
async function describePhoto(dataUrl) {
  let text = "";
  const err = await stream(
    { messages: [{ role: "user", content: t("memDescribe") }], mode: "describe", channel: "text", images: [{ media_type: "image/jpeg", data: dataUrl.split(",")[1] }] },
    { onText: (d) => { text += d; } },
  );
  return err ? "" : text.trim();
}

function errorText(err) {
  if (err === "credits") return t("keyNoCredits");
  if (err === "auth") {
    if (Brain.getMode() === "direct") { setTimeout(() => openPanel("core"), 0); return t("needKey"); }
    return t("errAuth");
  }
  if (err === "refusal") return t("errRefusal");
  if (err === "rate_limit") return t("keyRate");
  // Error desconocido: se muestra el motivo para poder arreglarlo.
  return err && err !== "error" ? `${t("errGeneric")} (${String(err).slice(0, 120)})` : t("errGeneric");
}

/**
 * Pregunta al cerebro. Por voz (por defecto) habla mientras llega la respuesta;
 * desde el chat (channel "text") pinta la respuesta y la lee solo si speak es true.
 */
async function ask(text, { channel = "voice", speak = true, onText, onDone, look = false } = {}) {
  // En videollamada, NIKOLAI te ve si se lo pides («mírame») o si activaste «que me vea siempre».
  const photo = call.active && (look || settings.callSees || LOOK_RE.test(text)) ? call.snapshot() : null;
  awayHours = lastUserAt ? (Date.now() - lastUserAt) / 3_600_000 : 0;
  lastUserAt = Date.now();
  store.set("lastUserAt", lastUserAt);
  if (isOffline()) { vlog("offline", text); answerOffline(text, { speak, onText, onDone }); return; }
  stopAll();
  const userMsg = { role: "user", content: text };
  history.push(userMsg);
  vlog("sent", text);
  setState("thinking");
  ui.reply.textContent = "";
  speaker.begin();
  askCtl = new AbortController();
  const ctl = askCtl;
  if (channel === "text") chatBusy = true;
  const t0 = performance.now();
  let reply = "", first = true, err = null;
  try {
    err = await stream(
      { messages: history.slice(-20), notes: notes.map((n) => n.text), channel, ...(photo ? { images: [{ media_type: "image/jpeg", data: photo }] } : {}) },
      {
        signal: ctl.signal,
        onText: (delta) => {
          if (first) {
            first = false;
            stats.lastLatency = Math.round(performance.now() - t0);
            pushSeries("latency", stats.lastLatency, 30);
            vlog("firstToken", `${stats.lastLatency} ms`);
          }
          reply += delta;
          ui.reply.textContent = speakable(reply).slice(-220);
          onText?.(reply);
          if (speak) speaker.push(channel === "text" ? speakable(delta) + (/\n\s*$/.test(delta) ? ". " : "") : delta);
        },
        onAction: (ev) => ACTIONS[ev.name]?.(ev.input),
        onStatus: (s) => s === "searching" && setState("thinking", t("searching")),
      },
    );
    if (ctl !== askCtl) { dropOrphan(userMsg); return; } // interrumpido
    if (err) vlog("aiError", err);
    if (!reply && err === "connection") { // se cayó la conexión a mitad: responde en modo local
      history.pop();
      askCtl = null;
      answerOffline(text, { speak, onText, onDone });
      return;
    }
    if (reply) {
      vlog("replied", speakable(reply));
      history.push({ role: "assistant", content: reply });
      saveHistory();
      stats.responses++;
      lastReply = speakable(reply);
    } else history.pop();
    onDone?.(reply, err);
    if (err && !reply) {
      if (speak) speakOnce(errorText(err));
      else { ui.reply.textContent = errorText(err); speaker.cancel(); afterSpeech(); }
      return;
    }
    speaker.end();
  } catch (e) {
    if (ctl !== askCtl) { dropOrphan(userMsg); return; }
    vlog("aiError", e?.message || "error");
    dropOrphan(userMsg);
    onDone?.("", "error");
    if (speak) speakOnce(t("errGeneric")); else afterSpeech();
  } finally {
    if (ctl === askCtl) askCtl = null;
    if (channel === "text") chatBusy = false;
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
    if (state === "listening") {
      v = bands ? bands[2 + i] / 255
        : speechActive ? 0.3 + 0.6 * Math.abs(Math.sin(now / 90 + i * 0.7) * Math.sin(now / 230 + i * 0.3))
        : 0.12 + 0.08 * Math.sin(now / 200 + i);
    }
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
  renderDock();
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
      if (sleeping) { if (ev.gesture === "palm" || ev.gesture === "victory") wake("gesture"); break; }
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

let lastCamError = "";

async function startCamera() {
  ui.camStart.hidden = true;
  gestures?.stop();
  try {
    gestures = new GestureController({ video: $("#video"), canvas: $("#handCanvas"), onEvent: onGesture });
    applyGestureSettings();
    await gestures.start({ facingMode: settings.facing });
    ui.sensor.classList.remove("off");
    ui.sensor.classList.toggle("rear", settings.facing !== "user");
    lastCamError = "";
  } catch (err) {
    console.error(err);
    gestures = null;
    ui.sensor.classList.add("off");
    ui.camStart.hidden = false;
    lastCamError = cameraErrorText(err);
    ui.reply.textContent = lastCamError;
  }
  updateCards();
  if (openId === "settings" || openId === "system") refreshPanel();
}

function cameraErrorText(err) {
  if (inAppBrowser) return t("camErrInApp");
  if (!window.isSecureContext) return t("camErrHttps");
  if (err.stage === "unsupported") return t("camErrUnsupported");
  if (err.stage === "model") return t("camErrModel");
  return {
    NotAllowedError: t("camErrDenied"), SecurityError: t("camErrDenied"),
    NotFoundError: t("camErrNotFound"), OverconstrainedError: t("camErrNotFound"),
    NotReadableError: t("camErrBusy"), AbortError: t("camErrBusy"),
  }[err.name] || `${t("camDenied")} (${err.name || err.message})`;
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
    row(t("network").toUpperCase(), navigator.onLine ? "ON" : t("offShort"), navigator.onLine ? "ok" : "bad") +
    (offline.pending.length ? row(t("offPending").toUpperCase(), offline.pending.length, "warn") : "");
  ui.sideRight.innerHTML =
    row(t("language").toUpperCase(), LANGS[getLang()].short) +
    row(t("notes").toUpperCase(), notes.length) +
    row(t("memory").toUpperCase(), memory.enabled ? memory.items.length : "OFF", memory.enabled ? "" : "warn") +
    row(t("responses").toUpperCase(), stats.responses) +
    row(t("latency").toUpperCase(), stats.lastLatency == null ? "—" : `${stats.lastLatency}ms`) +
    row("MOD", tagOf(MODULES[focus]), "warn");
}

// =====================================================================
// Teclado, toque y ratón (alternativas)
// =====================================================================
document.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
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
// Escritorio: barra de accesos, pantalla completa e instalar como app
// =====================================================================
let installPrompt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; renderDock(); });
addEventListener("appinstalled", () => { installPrompt = null; renderDock(); });

function renderDock() {
  const dock = $("#dock");
  if (!dock) return;
  dock.innerHTML = MODULES.map((id) => `<button class="dock-btn ${openId === id ? "on" : ""} ${id === "sos" ? "sos" : ""}" data-target data-open="${id}" title="${esc(titleOf(id))}">${icon(id)}<span>${esc(titleOf(id))}</span></button>`).join("") +
    `<i class="dock-sep"></i>` +
    `<button class="dock-btn" data-target id="dockSleep" title="${esc(t("sleep"))}">${icon("moon")}<span>${esc(t("sleep"))}</span></button>` +
    `<button class="dock-btn" data-target id="dockFull" title="${esc(t("fullscreen"))}">${icon("expand")}<span>${esc(t("fullscreen"))}</span></button>` +
    (installPrompt ? `<button class="dock-btn gold" data-target id="dockInstall" title="${esc(t("install"))}">${icon("install")}<span>${esc(t("install"))}</span></button>` : "");
  dock.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => (openId === b.dataset.open ? closePanel() : openPanel(b.dataset.open))));
  $("#dockSleep")?.addEventListener("click", goToSleep);
  $("#dockFull")?.addEventListener("click", () => {
    toggleFullscreen();
  });
  $("#dockInstall")?.addEventListener("click", async () => {
    installPrompt?.prompt();
    await installPrompt?.userChoice.catch(() => {});
    installPrompt = null;
    renderDock();
  });
}

if ("serviceWorker" in navigator && window.isSecureContext) {
  // Busca versiones nuevas al abrir y al volver a la app; cuando llega una, recarga sola una vez.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
    reg.update().catch(() => {});
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  }).catch(() => {});
}

// Campana de apertura de Wall Street (9:30 de Nueva York).
watchOpeningBell(() => {
  if (!settings.bell || sleeping) return;
  ringBell();
  setTimeout(() => speakOnce(t("ws_bellSay")), 1800);
});

// Temporizador: tarjeta en vivo y aviso por voz al terminar.
timer.onTick = () => document.querySelectorAll('[data-bind="timerLeft"]').forEach((el) => { el.textContent = fmtTime(timer.left); });
timer.onDone = () => { speakOnce(t("timerDone")); updateCards(); if (openId === "tools") refreshPanel(); };

// =====================================================================
// Doble aplauso → canción (por defecto «Should I Stay or Should I Go»)
// =====================================================================
const CLAP_SENS = [0.6, 0.8, 1, 1.3, 1.7];
const claps = new ClapDetector({
  onClap: () => vlog("clap"),
  onDouble: () => { vlog("clapDouble"); playClapSong(); if (sleeping) wake("claps"); },
  // En el celular, en reposo, el micrófono escucha aplausos y, si oye hablar,
  // pasa al reconocimiento de voz para entender «despierta».
  onVoice: () => {
    if (!(isMobile && sleeping && speechSupported)) return;
    claps.stop();
    voiceTask = { kind: "wake" };
    listenNow();
  },
});
claps.counter.sensitivity = CLAP_SENS[settings.clapSens - 1] || 1;
// No escuchar aplausos mientras NIKOLAI habla (su propia voz podría parecer un golpe).
claps.muted = () => speaker.speaking;

function playClapSong() {
  const song = settings.clapSong;
  ui.reply.textContent = `♫ ${song.title}`;
  document.body.classList.add("clap-flash");
  setTimeout(() => document.body.classList.remove("clap-flash"), 900);
  const item = { type: song.type, id: song.id, uri: `spotify:${song.type}:${song.id}`, title: song.title };
  if (spotifyConnected()) playItem(item).catch(() => playInEmbed(song.type, song.id, song.title));
  else playInEmbed(song.type, song.id, song.title);
  // Si el navegador bloqueó el sonido automático, se avisa para tocar ▶.
  setTimeout(() => {
    if (!miniPlayer.playing && !spotifyConnected()) {
      vlog("musicBlocked");
      ui.reply.textContent = t("musicBlocked");
    }
  }, 4000);
}

let userGestured = false;
/** ¿Los aplausos usan el micrófono en el celular? (Desactivado por defecto: así «despierta» por voz siempre funciona.) */
function mobileClaps() { return isMobile && settings.clap && settings.clapMobile; }
async function startClaps() {
  if (!settings.clap || !userGestured) return;
  // En el celular los aplausos le quitan el micrófono al reconocimiento de voz: solo si el usuario los activa ahí.
  if (isMobile && !settings.clapMobile) return;
  if (claps.running) { claps.ctx?.resume(); return; }
  // En el celular, el micrófono no se puede compartir con el reconocimiento de voz.
  if (isMobile && state === "listening") return;
  try { await claps.start(); } catch { /* sin permiso de micrófono */ }
}

function clapCtx() {
  return {
    enabled: settings.clap,
    songTitle: settings.clapSong.title,
    toggle: () => { settings.clap = !settings.clap; saveSettings(); settings.clap ? startClaps() : claps.stop(); },
    sens: settings.clapSens,
    setSens: (n) => { settings.clapSens = Math.min(5, Math.max(1, n)); saveSettings(); claps.counter.sensitivity = CLAP_SENS[settings.clapSens - 1]; },
    listening: () => claps.running,
    mobile: isMobile,
    mobileOn: settings.clapMobile,
    toggleMobile: () => { settings.clapMobile = !settings.clapMobile; saveSettings(); settings.clapMobile ? startClaps() : claps.stop(); if (sleeping) { listener.stop(); startWakeListening(); } },
    fire: playClapSong,
    setSong: (type, id) => {
      settings.clapSong = { type, id, title: `${t("sp_type_" + type)} · ${id.slice(0, 6)}…` };
      saveSettings();
    },
  };
}

miniPlayer.onChange = () => updateCards();
$("#mpClose").addEventListener("click", hidePlayer);
// El audio del navegador solo arranca tras una interacción: el detector empieza con el primer toque.
["pointerdown", "keydown"].forEach((ev) => addEventListener(ev, () => {
  if (userGestured) return;
  userGestured = true;
  unlockAudio();
  startClaps();
  if (sleeping) startWakeListening();
  // Precarga la canción del aplauso para que pueda sonar sin otro toque.
  if (settings.clap && !spotifyConnected()) preloadEmbed(settings.clapSong.type, settings.clapSong.id);
}));

// =====================================================================
// Reposo y arranque tipo JARVIS
// =====================================================================
const WAKE_RE = /despiert|despierta|wake ?up|enci[eé]nde|arriba|nikolai|nicolai|jarvis|hola/i;
const SLEEP_RE = /(du[eé]rmete|a dormir|modo reposo|ap[aá]gate|descansa|go to sleep|sleep mode)/i;
let sleeping = true;
let pendingSleep = false;
const visit = store.get("visit", { count: 0, last: 0 });

function startWakeListening() {
  if (!sleeping) return;
  $("#sleepHint").textContent = t("sleepReadyHint");
  // Celular con aplausos activados: el micrófono escucha aplausos y salta al
  // reconocimiento de voz cuando oye hablar (no se pueden usar los dos a la vez).
  if (mobileClaps()) { voiceTask = null; listener.stop(); startClaps(); return; }
  if (!speechSupported) return;
  voiceTask = { kind: "wake" };
  listenNow();
}

function goToSleep() {
  if (sleeping) return;
  pendingSleep = true;
  speakOnce(t("sleepBye"));
}

function enterSleep() {
  sleeping = true;
  voiceOn = false;
  stopAll();
  closePanel();
  setState("off");
  document.body.classList.add("sleeping");
  $("#sleepHint").textContent = userGestured ? t("sleepReadyHint") : t("sleepTapHint");
  if (userGestured) setTimeout(startWakeListening, 600);
}

function salutation(d = new Date()) {
  const h = d.getHours();
  return h >= 5 && h < 12 ? t("morning") : h >= 12 && h < 19 ? t("afternoon") : t("evening");
}

function agoText(ms) {
  const min = Math.round(ms / 60000);
  if (min < 2) return t("agoNow");
  if (min < 60) return t("agoMin").replace("{n}", min);
  const h = Math.round(min / 60);
  if (h < 36) return t("agoHour").replace("{n}", h);
  return t("agoDay").replace("{n}", Math.round(h / 24));
}

/** Sonido de encendido: barrido grave → agudo y un brillo final. */
function powerUpSound() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const now = ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(60, now);
    o.frequency.exponentialRampToValueAtTime(880, now + 1.1);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
    const f = ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(400, now);
    f.frequency.exponentialRampToValueAtTime(4000, now + 1.1);
    o.connect(f).connect(g).connect(ac.destination);
    o.start(now);
    o.stop(now + 1.4);
    [1320, 1760].forEach((hz, i) => {
      const c = ac.createOscillator(), cg = ac.createGain();
      c.frequency.value = hz;
      cg.gain.setValueAtTime(0.0001, now + 1.1 + i * 0.12);
      cg.gain.exponentialRampToValueAtTime(0.08, now + 1.15 + i * 0.12);
      cg.gain.exponentialRampToValueAtTime(0.0001, now + 1.9 + i * 0.12);
      c.connect(cg).connect(ac.destination);
      c.start(now + 1.1 + i * 0.12);
      c.stop(now + 2 + i * 0.12);
    });
    setTimeout(() => ac.close(), 2600);
  } catch { /* sin audio */ }
}

/** Enciende la interfaz con animación y saluda según la hora y el historial. */
function wake(how) {
  if (!sleeping) return;
  sleeping = false;
  voiceTask = null;
  listener.stop();
  clearTimeout(restartTimer);
  powerUpSound();
  document.body.classList.remove("sleeping");
  document.body.classList.add("booting");
  setTimeout(() => document.body.classList.remove("booting"), 2600);
  const lastVisit = visit.last;
  const firstTime = !visit.count;
  visit.count++;
  visit.last = Date.now();
  store.set("visit", visit);
  voiceOn = speechSupported;
  greeted = true;
  if (openId === "core") refreshPanel();
  renderSides();
  setTimeout(() => greetOnWake(how, firstTime, lastVisit), 1500);
  setTimeout(() => prefetchNews(getLang()), 6000);
}

async function greetOnWake(how, firstTime, lastVisit) {
  const hello = salutation();
  const name = profile.name ? `, ${profile.name}` : "";
  const bday = daysToBirthday() === 0 ? ` ${t("birthdayGreeting").replace("{name}", name)}` : "";
  const local = firstTime
    ? `${hello}${name}. ${t("welcomeFirst")}${bday}`
    : settings.emotions && Date.now() - lastVisit > 6 * 3_600_000
      ? `${hello}${name}… ${t("emo_missedLocal").replace("{ago}", agoText(Date.now() - lastVisit))}${bday}`
      : `${hello}${name}. ${t("welcomeBack").replace("{ago}", agoText(Date.now() - lastVisit))}${bday}`;
  // Si ya hay historial y cerebro, que el saludo recuerde de qué hablaron.
  if (!firstTime && history.length && brain.apiKey) {
    const instruction = t("greetPrompt")
      .replace("{how}", t({ voice: "wokeVoice", claps: "wokeClaps", gesture: "wokeGesture" }[how] || "wokeTap"))
      .replace("{hello}", hello).replace("{name}", name).replace("{ago}", agoText(Date.now() - lastVisit))
      + (settings.emotions && Date.now() - lastVisit > 3 * 3_600_000 ? " " + t("emo_greet") : "");
    awayHours = settings.emotions ? (Date.now() - Math.max(lastVisit || 0, lastUserAt || 0)) / 3_600_000 : 0;
    stopAll();
    setState("thinking");
    speaker.begin();
    askCtl = new AbortController();
    const ctl = askCtl;
    let text = "";
    try {
      const err = await stream(
        { messages: [...history.slice(-12), { role: "user", content: instruction }], notes: notes.map((n) => n.text), channel: "voice" },
        { signal: ctl.signal, onText: (d) => { text += d; ui.reply.textContent = text.slice(-220); speaker.push(d); } },
      );
      if (ctl !== askCtl) return;
      askCtl = null;
      if (err || !text) { speakOnce(local); return; }
      lastReply = text;
      speaker.end();
      return;
    } catch {
      if (ctl !== askCtl) return;
      askCtl = null;
    }
  }
  speakOnce(local);
}

// Guarda la hora de la visita mientras está encendida (para saber cuándo fue la última).
setInterval(() => { if (!sleeping) { visit.last = Date.now(); store.set("visit", visit); } }, 60000);

// =====================================================================
// Arranque
// =====================================================================
setLang(store.get("lang", detectBrowserLang()));
applyLanguage(getLang());
setState("off");
ui.reply.textContent = inAppBrowser ? t("camErrInApp") : !speechSupported ? t("noSpeech") : "";
document.body.classList.add("sleeping");
$("#sleepTitle").textContent = t("sleepTitle");
$("#sleepHint").textContent = t("sleepTapHint");
$("#sleepPower").textContent = t("sleepPowerOn");
$("#sleepPower").addEventListener("click", (e) => { e.stopPropagation(); userGestured = true; startClaps(); wake("tap"); });
document.body.classList.toggle("birthday", daysToBirthday() === 0);
renderDock();
applyLowPower();
updateNetChip();
connectLive();
if (profile.city) loadWeather(getLang()).then(updateCards);

function tickClock() {
  const now = new Date();
  ui.clock.textContent = now.toLocaleTimeString(getLang(), { hour12: false });
  const today = $("#today");
  if (today) {
    const long = innerWidth > 1100;
    const txt = now.toLocaleDateString(getLang(), long ? { weekday: "long", day: "numeric", month: "long", year: "numeric" } : { weekday: "short", day: "numeric", month: "short" });
    const cap = txt.charAt(0).toUpperCase() + txt.slice(1);
    if (today.textContent !== cap) today.textContent = cap;
  }
}
tickClock();
setInterval(tickClock, 1000);
showMood();
setInterval(() => {
  pushSeries("mic", mic.level());
  pushSeries("fps", gestures?.running ? gestures.fps : 0);
  if (!gestures?.handVisible) pushSeries("hand", 0);
  updateCards();
  renderSides();
}, 1000);
(function frame(now) { drawWave(now); requestAnimationFrame(frame); })(performance.now());

Brain.detect().then((h) => {
  brain = h;
  if (!h.apiKey) {
    ui.reply.textContent = h.mode === "direct" ? t("needKey") : t("errAuth");
    if (h.mode === "direct") openPanel("core");
  }
  renderSides();
  updateCards();
});

// Vuelta del inicio de sesión de Spotify.
handleRedirect().then((ok) => { if (ok || spotify.error) openPanel("music"); if (ok) refreshNow().then(updateCards); }).catch(() => {});
setInterval(() => { if (spotifyConnected()) refreshNow().then(() => updateCards()); }, 15000);

ui.sensor.classList.add("off");
startCamera();
