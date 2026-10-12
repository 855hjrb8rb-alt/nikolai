// NIKOLAI — lógica principal de la interfaz: menú holográfico, paneles,
// conversación con la IA, voz y conexión con el control por gestos.

import { LANGS, t, setLang, getLang, detectBrowserLang } from "./i18n.js";
import { Voice } from "./voice.js";
import { GestureController } from "./gestures.js";

const $ = (sel, root = document) => root.querySelector(sel);

// ---------- Estado persistente ----------
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem("nikolai." + key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("nikolai." + key, JSON.stringify(value)); } catch { /* modo privado */ }
  },
};

const settings = Object.assign(
  { speak: true, rate: 1, smoothing: 0.35, dwell: true, showCam: true, wake: false },
  store.get("settings", {}),
);
let notes = store.get("notes", []);
const history = []; // [{role, content}]

const MENU = [
  { id: "chat", ico: "💬" },
  { id: "voice", ico: "🎙️" },
  { id: "languages", ico: "🌐" },
  { id: "translator", ico: "🔁" },
  { id: "notes", ico: "📝" },
  { id: "system", ico: "📊" },
  { id: "settings", ico: "⚙️" },
  { id: "help", ico: "✋" },
];

const ui = {
  stage: $(".stage"),
  radial: $("#radial"),
  core: $("#core"),
  panel: $("#panel"),
  panelTitle: $("#panelTitle"),
  panelBody: $("#panelBody"),
  caption: $("#caption"),
  status: $("#statusText"),
  gesture: $("#gestureText"),
  langChip: $("#langChip"),
  clock: $("#clock"),
  cursor: $("#cursor"),
  camBox: $("#camBox"),
  camStart: $("#camStart"),
};

let menuOpen = true;
let rotation = 0; // en pasos de menú (el elemento enfocado queda arriba)
let currentPanel = null;
let panelTimer = null;
let brain = { ok: false, apiKey: false };
let busy = false;
let userInteracted = false;

// ---------- Voz ----------
const voice = new Voice({
  onResult: (text) => {
    if (text) sendMessage(text);
    else say(t("listening"), { silent: false });
  },
  onState: (s) => setStatus(s === "listening" ? "listening" : "idle"),
});

// ---------- Idioma ----------
function applyLanguage(code, { announce = false } = {}) {
  setLang(code);
  store.set("lang", code);
  voice.setLanguage(LANGS[code].speech);
  ui.langChip.textContent = `${LANGS[code].flag} ${code.toUpperCase()}`;
  buildRadial();
  ui.camStart.textContent = t("startCam");
  if (currentPanel) openPanel(currentPanel);
  setStatus("idle");
  if (announce) say(t("greeting"));
}

// ---------- Menú radial ----------
function buildRadial() {
  ui.radial.innerHTML = "";
  MENU.forEach((item, i) => {
    const el = document.createElement("button");
    el.className = "radial-item";
    el.dataset.gesture = "";
    el.dataset.index = i;
    el.innerHTML = `<span class="ico">${item.ico}</span><span>${t(item.id)}</span>`;
    el.addEventListener("click", () => openPanel(item.id));
    ui.radial.appendChild(el);
  });
  layoutRadial();
}

function layoutRadial() {
  const n = MENU.length;
  const focus = ((-rotation % n) + n) % n;
  [...ui.radial.children].forEach((el, i) => {
    const angle = ((i + rotation) / n) * Math.PI * 2 - Math.PI / 2;
    const r = 39; // % del contenedor
    el.style.transform = `translate(${Math.cos(angle) * r * 4.55}%, ${Math.sin(angle) * r * 4.55}%)`;
    el.classList.toggle("focus", i === focus);
  });
}

function rotateMenu(dir) {
  if (!menuOpen) toggleMenu(true);
  rotation += dir;
  layoutRadial();
}

function focusedItem() {
  const n = MENU.length;
  return MENU[((-rotation % n) + n) % n];
}

function toggleMenu(force) {
  menuOpen = force ?? !menuOpen;
  ui.radial.classList.toggle("closed", !menuOpen);
}

// ---------- Paneles ----------
function openPanel(id) {
  clearInterval(panelTimer);
  currentPanel = id;
  ui.panel.classList.remove("hidden");
  ui.stage.classList.add("with-panel");
  ui.panelTitle.textContent = t(id);
  ui.panelBody.innerHTML = "";
  RENDER[id]?.(ui.panelBody);
}

function closePanel() {
  clearInterval(panelTimer);
  currentPanel = null;
  ui.panel.classList.add("hidden");
  ui.stage.classList.remove("with-panel");
}

const RENDER = {
  chat(body) {
    body.appendChild($("#tpl-chat").content.cloneNode(true));
    const log = $("#chatLog", body);
    for (const m of history) addBubble(m.role, m.content, log);
    $("#chatInput", body).placeholder = t("placeholder");
    $("#sendBtn", body).textContent = t("send");
    $("#clearChat", body).textContent = t("clear");
    $("#chatForm", body).addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("#chatInput", body);
      const text = input.value.trim();
      if (text) sendMessage(text);
      input.value = "";
    });
    $("#micBtn", body).addEventListener("click", startListening);
    $("#clearChat", body).addEventListener("click", () => {
      history.length = 0;
      log.innerHTML = "";
    });
    log.scrollTop = log.scrollHeight;
  },

  voice(body) {
    body.innerHTML = `
      <button class="btn" id="vListen" data-gesture>🎙️ ${t("listen")}</button>
      <label class="row">${t("wakeToggle")} <input type="checkbox" id="vWake" data-gesture ${settings.wake ? "checked" : ""}></label>
      <label class="row">${t("speakReplies")} <input type="checkbox" id="vSpeak" data-gesture ${settings.speak ? "checked" : ""}></label>
      <label class="row">${t("speechRate")} <input type="range" id="vRate" min="0.6" max="1.6" step="0.1" value="${settings.rate}"></label>
      ${voice.supported ? "" : `<p class="muted">⚠️ Este navegador no soporta reconocimiento de voz. Usa Chrome o Edge.</p>`}`;
    $("#vListen", body).onclick = startListening;
    $("#vWake", body).onchange = (e) => setWake(e.target.checked);
    $("#vSpeak", body).onchange = (e) => updateSettings({ speak: e.target.checked });
    $("#vRate", body).oninput = (e) => updateSettings({ rate: Number(e.target.value) });
  },

  languages(body) {
    const grid = document.createElement("div");
    grid.className = "lang-grid";
    for (const [code, info] of Object.entries(LANGS)) {
      const b = document.createElement("button");
      b.className = "btn" + (code === getLang() ? " active" : "");
      b.dataset.gesture = "";
      b.innerHTML = `<span>${info.flag}</span><span>${info.name}</span>`;
      b.onclick = () => applyLanguage(code, { announce: true });
      grid.appendChild(b);
    }
    body.appendChild(grid);
  },

  translator(body) {
    const options = Object.entries(LANGS)
      .map(([c, i]) => `<option value="${c}" ${c === (getLang() === "en" ? "es" : "en") ? "selected" : ""}>${i.flag} ${i.name}</option>`)
      .join("");
    body.innerHTML = `
      <textarea id="trIn" placeholder="${t("translateHint")}" data-gesture></textarea>
      <label class="row">${t("targetLang")} <select id="trLang" data-gesture style="width:55%">${options}</select></label>
      <div style="display:flex;gap:8px">
        <button class="btn" id="trGo" data-gesture>🔁 ${t("translate")}</button>
        <button class="btn icon" id="trMic" data-gesture>🎙️</button>
      </div>
      <div class="msg assistant" id="trOut" style="max-width:100%;min-height:60px"></div>
      <button class="btn ghost small" id="trSpeak" data-gesture>🔊</button>`;
    const out = $("#trOut", body);
    $("#trMic", body).onclick = () => {
      const prev = voice.onResult;
      voice.onResult = (text) => { voice.onResult = prev; if (text) $("#trIn", body).value = text; };
      voice.listenOnce();
    };
    $("#trGo", body).onclick = async () => {
      const text = $("#trIn", body).value.trim();
      if (!text) return;
      const target = $("#trLang", body).value;
      out.textContent = "…";
      const result = await askBrain(
        [{ role: "user", content: `Traduce el siguiente texto a ${LANGS[target].name}. Responde únicamente con la traducción, sin comillas ni comentarios.\n\n${text}` }],
        { onText: (full) => { out.textContent = full; } },
      );
      out.textContent = result.text || out.textContent;
      out.dataset.lang = target;
    };
    $("#trSpeak", body).onclick = () => {
      const target = out.dataset.lang;
      if (!target || !out.textContent) return;
      const prev = voice.speechLang;
      voice.setLanguage(LANGS[target].speech);
      voice.speak(out.textContent, speakingAnim);
      voice.setLanguage(prev);
    };
  },

  notes(body) {
    body.innerHTML = `
      <div style="display:flex;gap:8px">
        <input id="noteIn" placeholder="${t("noteHint")}" data-gesture>
        <button class="btn" id="noteAdd" data-gesture>${t("addNote")}</button>
      </div>
      <div id="noteList" style="display:flex;flex-direction:column;gap:8px"></div>`;
    const list = $("#noteList", body);
    const render = () => {
      list.innerHTML = notes.length ? "" : `<p class="muted">${t("noNotes")}</p>`;
      notes.forEach((n, i) => {
        const row = document.createElement("div");
        row.className = "note";
        row.innerHTML = `<div><div></div><small>${new Date(n.at).toLocaleString(getLang())}</small></div>`;
        row.firstChild.firstChild.textContent = n.text;
        const del = document.createElement("button");
        del.className = "btn icon small";
        del.dataset.gesture = "";
        del.textContent = "🗑";
        del.onclick = () => { notes.splice(i, 1); store.set("notes", notes); render(); };
        row.appendChild(del);
        list.appendChild(row);
      });
    };
    $("#noteAdd", body).onclick = () => {
      const input = $("#noteIn", body);
      if (input.value.trim()) addNote(input.value.trim());
      input.value = "";
      render();
    };
    render();
  },

  system(body) {
    const render = async () => {
      const now = new Date();
      let battery = "—";
      try {
        const b = await navigator.getBattery?.();
        if (b) battery = `${Math.round(b.level * 100)}%${b.charging ? " ⚡" : ""}`;
      } catch { /* sin API de batería */ }
      const stats = [
        [t("time"), now.toLocaleTimeString(getLang())],
        [t("date"), now.toLocaleDateString(getLang(), { weekday: "short", day: "numeric", month: "short" })],
        [t("camera"), gestures?.running ? `${gestures.fps} ${t("fps")}` : "OFF"],
        [t("hand"), gestures?.handVisible ? t("detected") : t("none")],
        [t("battery"), battery],
        [t("network"), navigator.onLine ? t("online") : t("offline")],
        [t("brain"), brain.ok ? (brain.apiKey ? `${t("ready")} · ${brain.model}` : t("noKey")) : t("offline")],
        [t("languages"), Object.keys(LANGS).length],
      ];
      body.innerHTML = `<div class="stat-grid">${stats.map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("")}</div>`;
    };
    render();
    panelTimer = setInterval(render, 1000);
  },

  settings(body) {
    body.innerHTML = `
      <label class="row">${t("speakReplies")} <input type="checkbox" id="sSpeak" data-gesture ${settings.speak ? "checked" : ""}></label>
      <label class="row">${t("dwell")} <input type="checkbox" id="sDwell" data-gesture ${settings.dwell ? "checked" : ""}></label>
      <label class="row">${t("showCam")} <input type="checkbox" id="sCam" data-gesture ${settings.showCam ? "checked" : ""}></label>
      <label class="row">${t("sensitivity")} <input type="range" id="sSmooth" min="0" max="0.85" step="0.05" value="${settings.smoothing}"></label>
      <label class="row">${t("speechRate")} <input type="range" id="sRate" min="0.6" max="1.6" step="0.1" value="${settings.rate}"></label>`;
    $("#sSpeak", body).onchange = (e) => updateSettings({ speak: e.target.checked });
    $("#sDwell", body).onchange = (e) => updateSettings({ dwell: e.target.checked });
    $("#sCam", body).onchange = (e) => updateSettings({ showCam: e.target.checked });
    $("#sSmooth", body).oninput = (e) => updateSettings({ smoothing: Number(e.target.value) });
    $("#sRate", body).oninput = (e) => updateSettings({ rate: Number(e.target.value) });
  },

  help(body) {
    const items = t("helpItems");
    body.innerHTML =
      `<p class="muted">${t("helpTitle")}</p>` +
      items.map(([e, g, d]) => `<div class="help-item"><span class="e">${e}</span><b>${g}</b><span>${d}</span></div>`).join("") +
      `<p class="muted">🎙️ «Nikolai, abre las notas» · «Nikolai, habla en inglés» · «Nikolai, ¿qué tiempo hace en Madrid?»</p>`;
  },
};

function updateSettings(patch) {
  Object.assign(settings, patch);
  store.set("settings", settings);
  voice.speakEnabled = settings.speak;
  voice.rate = settings.rate;
  if (gestures) gestures.smoothing = settings.smoothing;
  ui.camBox.classList.toggle("mini", !settings.showCam);
}

function setWake(on) {
  updateSettings({ wake: on });
  voice.setWakeMode(on);
  say(on ? t("wakeOn") : t("wakeOff"), { silent: true });
}

function addNote(text) {
  notes.unshift({ text, at: Date.now() });
  store.set("notes", notes);
}

// ---------- Conversación con la IA ----------
function addBubble(role, text, log = $("#chatLog")) {
  if (!log) return null;
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

function setStatus(kind) {
  document.body.classList.toggle("thinking", kind === "thinking" || kind === "searching");
  document.body.classList.toggle("listening", kind === "listening");
  ui.status.textContent = { thinking: "◐ ", searching: "🌐 ", listening: "🎙️ ", idle: "● " }[kind] + t(kind);
}

function speakingAnim(on) {
  document.body.classList.toggle("speaking", on);
}

function say(text, { silent = false } = {}) {
  ui.caption.textContent = text;
  if (!silent) {
    voice.cancelSpeech();
    voice.speak(text, speakingAnim);
  }
}

function startListening() {
  voice.cancelSpeech();
  if (!voice.listenOnce()) say("⚠️ Reconocimiento de voz no disponible en este navegador (usa Chrome o Edge).", { silent: true });
}

const ACTIONS = {
  set_language: ({ code }) => applyLanguage(code),
  open_panel: ({ panel }) => openPanel(panel),
  save_note: ({ text }) => {
    addNote(text);
    if (currentPanel === "notes") openPanel("notes");
  },
};

// Envía mensajes al servidor y lee la respuesta en streaming (Server-Sent Events).
async function askBrain(messages, { onText, onAction, onStatus } = {}) {
  let text = "";
  let error = null;
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, lang: getLang(), now: new Date().toString() }),
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop();
      for (const part of parts) {
        if (!part.startsWith("data: ")) continue;
        const ev = JSON.parse(part.slice(6));
        if (ev.type === "text") { text += ev.text; onText?.(text); }
        else if (ev.type === "action") onAction?.(ev);
        else if (ev.type === "status") onStatus?.(ev.status);
        else if (ev.type === "error") error = ev.error;
      }
    }
  } catch (err) {
    error = err.message;
  }
  return { text, error };
}

async function sendMessage(text) {
  if (busy) return;
  busy = true;
  voice.cancelSpeech();
  history.push({ role: "user", content: text });
  addBubble("user", text);
  const bubble = addBubble("assistant", "…");
  ui.caption.textContent = "";
  setStatus("thinking");

  const { text: reply, error } = await askBrain(history, {
    onText: (full) => {
      setStatus("thinking");
      if (bubble?.isConnected) bubble.textContent = full;
      ui.caption.textContent = full.slice(-280);
    },
    onAction: (ev) => ACTIONS[ev.name]?.(ev.input),
    onStatus: (s) => setStatus(s),
  });

  setStatus("idle");
  busy = false;
  if (reply) {
    history.push({ role: "assistant", content: reply });
    const log = $("#chatLog");
    if (log && !bubble?.isConnected) addBubble("assistant", reply);
    say(reply);
  }
  if (error) {
    const msg = error === "auth" ? t("errAuth") : error === "refusal" ? t("errRefusal") : t("errGeneric");
    if (bubble?.isConnected) { bubble.textContent = msg; bubble.classList.add("error"); }
    if (!reply) history.pop();
    say(msg);
  } else if (!reply && bubble?.isConnected) {
    bubble.remove();
  }
}

// ---------- Cursor de la mano ----------
let gestures = null;
let hoverEl = null;
let hoverSince = 0;
let dwellDone = false;
const dwellRing = ui.cursor.querySelector(".dwell");
const DWELL_MS = 1300;

function targetAt(x, y) {
  const el = document.elementFromPoint(x, y);
  return el?.closest("[data-gesture], button, input, select, textarea, label.row") || null;
}

function moveCursor(x, y) {
  ui.cursor.style.transform = `translate(${x}px, ${y}px)`;
  const el = targetAt(x, y);
  if (el !== hoverEl) {
    hoverEl?.classList.remove("hover");
    hoverEl = el;
    hoverEl?.classList.add("hover");
    hoverSince = performance.now();
    dwellDone = false;
  }
  // Clic por permanencia: mantener el dedo quieto sobre un botón.
  let progress = 0;
  if (settings.dwell && hoverEl && !dwellDone && !/^(INPUT|TEXTAREA|SELECT)$/.test(hoverEl.tagName)) {
    progress = Math.min((performance.now() - hoverSince) / DWELL_MS, 1);
    if (progress >= 1) {
      dwellDone = true;
      progress = 0;
      activate(hoverEl, x, y);
    }
  }
  dwellRing.style.strokeDashoffset = String(100.5 * (1 - progress));
}

function activate(el, x, y) {
  const ripple = document.createElement("div");
  ripple.className = "ripple";
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  document.body.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
  userInteracted = true;

  if (!el) {
    // Pellizco en el vacío: abre la opción enfocada del menú.
    if (menuOpen && !currentPanel) openPanel(focusedItem().id);
    return;
  }
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== "checkbox") {
    el.focus();
    return;
  }
  if (el.matches("label.row")) {
    el.querySelector("input[type=checkbox]")?.click();
    return;
  }
  el.click();
}

function onGesture(ev) {
  switch (ev.type) {
    case "move":
      ui.cursor.classList.remove("hidden");
      moveCursor(ev.x, ev.y);
      break;
    case "hand":
      ui.cursor.classList.toggle("hidden", !ev.visible);
      if (!ev.visible) { hoverEl?.classList.remove("hover"); hoverEl = null; }
      break;
    case "pinch":
      ui.cursor.classList.add("pinch");
      activate(targetAt(ev.x, ev.y), ev.x, ev.y);
      dwellDone = true;
      break;
    case "release":
      ui.cursor.classList.remove("pinch");
      break;
    case "pose":
      ui.gesture.textContent = { palm: "✋ palma", fist: "✊ puño", victory: "✌️ V", point: "☝️ cursor", other: "🤚", none: "— sin mano" }[ev.gesture] || ev.gesture;
      break;
    case "gesture":
      if (ev.gesture === "palm") toggleMenu();
      else if (ev.gesture === "fist") { if (currentPanel) closePanel(); else toggleMenu(false); }
      else if (ev.gesture === "victory") startListening();
      break;
    case "swipe":
      rotateMenu(ev.dir);
      break;
  }
}

async function startCamera() {
  ui.camStart.classList.add("hidden");
  try {
    gestures = new GestureController({ video: $("#video"), canvas: $("#handCanvas"), onEvent: onGesture });
    gestures.smoothing = settings.smoothing;
    await gestures.start();
    ui.camBox.classList.remove("off");
  } catch (err) {
    console.error(err);
    gestures = null;
    ui.camBox.classList.add("off");
    ui.camStart.classList.remove("hidden");
    say(`${t("camDenied")} (${err.name || err.message})`, { silent: true });
  }
}

// ---------- Teclado (atajos) ----------
document.addEventListener("keydown", (e) => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) {
    if (e.key === "Escape") document.activeElement.blur();
    return;
  }
  if (e.key === "ArrowLeft") rotateMenu(-1);
  else if (e.key === "ArrowRight") rotateMenu(1);
  else if (e.key === "Enter" && !currentPanel) openPanel(focusedItem().id);
  else if (e.key === "Escape") currentPanel ? closePanel() : toggleMenu();
  else if (e.key === " ") { e.preventDefault(); startListening(); }
});

// ---------- Arranque ----------
ui.core.addEventListener("click", () => toggleMenu());
$("#panelClose").addEventListener("click", closePanel);
ui.camStart.addEventListener("click", startCamera);
document.addEventListener("pointerdown", () => {
  // Los navegadores no dejan hablar hasta la primera interacción: saludamos entonces.
  if (!userInteracted) { userInteracted = true; say(t("greeting")); }
}, { once: true });

setInterval(() => { ui.clock.textContent = new Date().toLocaleTimeString(getLang(), { hour12: false }); }, 1000);

applyLanguage(store.get("lang", detectBrowserLang()));
updateSettings({});
ui.caption.textContent = t("greeting");
if (settings.wake) voice.setWakeMode(true);

fetch("/api/health")
  .then((r) => r.json())
  .then((h) => { brain = h; if (!h.apiKey) ui.caption.textContent = t("errAuth"); })
  .catch(() => { brain = { ok: false }; });

ui.camBox.classList.add("off");
startCamera();
