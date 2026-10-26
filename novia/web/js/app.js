// Mi novia IA: su cara animada a pantalla completa, conversación por voz continua o por chat,
// memoria, emociones, te ve por la cámara si quieres y nota cuándo te vas y cuándo vuelves.

import { Portrait, photoToPortrait } from "./portrait.js";
import { Listener, Speaker, speechSupported, unlockAudio, outputLevel } from "./voice.js";

const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("novia." + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("novia." + k, JSON.stringify(v)); } catch { /* sin espacio o bloqueado */ } },
};

const DEFAULT_FACE = "img/novia.jpg";
const AWAY_MIN = 20; // desde cuántos minutos fuera lo nota
const MOODS = {
  happy: ["😊", "feliz", 1.04, 1.05], loving: ["🥰", "cariñosa", 0.97, 1.04], playful: ["😜", "juguetona", 1.06, 1.06],
  excited: ["🤩", "emocionada", 1.1, 1.08], neutral: ["", "", 1, 1], worried: ["😟", "preocupada", 0.98, 1],
  sad: ["😢", "triste", 0.9, 0.95], crying: ["😭", "llorando", 0.86, 1.06], missing: ["🥺", "te extrañaba", 0.94, 1.02],
  jealous: ["😒", "celosa", 1, 0.98], annoyed: ["😤", "molesta", 1.05, 0.96], angry: ["😠", "enojada", 1.1, 0.92],
};

const me = Object.assign({ name: "Valeria", pet: "amor", about: "", voice: true }, store.get("me", {}));
let history = store.get("history", []);
let memories = store.get("memories", []);
let mood = store.get("mood", { mood: "neutral", intensity: 0.5, at: 0 });
let lastSeen = store.get("lastSeen", 0);
let camOn = false;
let talkOn = false; // conversación por voz continua
let state = "idle"; // idle | listening | thinking | speaking
let ctl = null;
let apiKey = true;

// ---------- Cara ----------
const portrait = new Portrait();
const canvas = $("#face");
async function loadFace() {
  const photo = store.get("photo", "");
  const face = store.get("faceData", null);
  try {
    const f = await portrait.set(photo || DEFAULT_FACE, photo && face?.eyes?.[0]?.contour ? face : null);
    if (photo && f) store.set("faceData", f);
  } catch {
    if (photo) { store.set("photo", ""); await portrait.set(DEFAULT_FACE).catch(() => {}); }
  }
  $("#gateImg").src = photo || DEFAULT_FACE;
}

function currentMood() {
  if (mood.mood !== "neutral" && Date.now() - mood.at > 25 * 60_000) mood = { mood: "neutral", intensity: 0.5, at: Date.now() };
  return mood;
}
function setMood(m, intensity = 0.6) {
  if (!MOODS[m]) return;
  mood = { mood: m, intensity: Math.min(1, Math.max(0.1, Number(intensity) || 0.6)), at: Date.now() };
  store.set("mood", mood);
  applyVoice();
  renderTop();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  const g = canvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = "#0b0709";
  g.fillRect(0, 0, w, h);
  if (!portrait.ready) return;
  const md = currentMood();
  const ch = state === "speaking" ? speaker.spokenChar() : null;
  let level = outputLevel();
  // Sin señal de audio ni letra (voz del navegador que no avisa), sílabas simuladas.
  if (state === "speaking" && ch == null && level < 0.02) level = Math.max(0, Math.sin(now / 77) * 0.5 + Math.sin(now / 137) * 0.35 + 0.2);
  portrait.draw(g, 0, 0, w, h, now, { mouth: state === "speaking" ? level : 0, char: ch, mood: md.mood, intensity: md.intensity });
}

// ---------- Voz ----------
const listener = new Listener();
listener.lang = "es-MX";
const speaker = new Speaker();
function applyVoice() {
  const mv = MOODS[currentMood().mood];
  speaker.lang = "es-MX";
  speaker.gender = "female";
  speaker.rate = mv[2];
  speaker.pitch = 1.08 * mv[3];
}
speaker.onStart = () => setState("speaking");
speaker.onIdle = () => {
  if (state === "speaking" || state === "thinking") setState("idle");
  if (talkOn) setTimeout(listenNow, 350);
};

function listenNow() {
  if (!talkOn || state === "thinking" || state === "speaking") return;
  setState("listening");
  const ok = listener.listen({
    onInterim: (txt) => showCaption("", txt),
    onFinal: (txt) => ask(txt, { voice: true }),
    onEnd: (got) => { if (!got && talkOn && state === "listening") setTimeout(listenNow, 250); },
    onError: (err) => {
      if (err === "not-allowed" || err === "service-not-allowed") { toggleTalk(false); showCaption(`Activa el permiso del micrófono para hablar con ${me.name}.`); }
    },
  });
  if (!ok) { toggleTalk(false); showCaption("Tu navegador no reconoce la voz. Usa Chrome o escríbele."); }
}

function toggleTalk(on = !talkOn) {
  talkOn = on && speechSupported;
  $("#micBtn").classList.toggle("on", talkOn);
  if (talkOn) { unlockAudio(); speaker.cancel(); listenNow(); }
  else { listener.stop(); if (state === "listening") setState("idle"); }
}

function setState(s) {
  state = s;
  const labels = { idle: "en línea", listening: "te escucha…", thinking: "escribiendo…", speaking: "hablando" };
  $("#status").textContent = labels[s];
}

// ---------- Cámara (que te vea) ----------
let camStream = null;
async function toggleCam(on = !camOn) {
  if (on) {
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 } }, audio: false });
      $("#video").srcObject = camStream;
      $("#video").play().catch(() => {});
      $("#video").play().catch(() => {});
      camOn = true;
    } catch {
      showCaption("No pude abrir tu cámara. Revisa el permiso del navegador.");
      camOn = false;
    }
  } else {
    camStream?.getTracks().forEach((t) => t.stop());
    camStream = null;
    camOn = false;
  }
  $("#camBtn").classList.toggle("on", camOn);
}
function snapshot() {
  const v = $("#video");
  if (!camOn || !v.videoWidth) return "";
  const k = Math.min(1, 768 / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
  c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8).split(",")[1];
}

// ---------- Conversación ----------
function showCaption(her, mine = "") {
  const cap = $("#caption");
  cap.textContent = "";
  if (mine) { const m = document.createElement("span"); m.className = "me"; m.textContent = mine; cap.appendChild(m); }
  if (her) cap.appendChild(document.createTextNode(her.length > 320 ? "…" + her.slice(-320) : her));
}

const ERRORS = {
  auth: "Falta tu clave de Anthropic en el servidor (ANTHROPIC_API_KEY).",
  credits: "Tu cuenta de Anthropic se quedó sin saldo.",
  rate_limit: "Demasiados mensajes seguidos; espera un momento.",
  connection: "No hay conexión con la IA.",
  refusal: "Mejor hablemos de otra cosa, ¿va?",
};

/**
 * Le manda un mensaje. `hidden`: aviso de la app (no lo escribiste tú), p. ej. que volviste.
 */
async function ask(text, { voice = talkOn, hidden = false, awayMin = 0 } = {}) {
  if (!text.trim()) return;
  ctl?.abort();
  listener.stop();
  speaker.cancel();
  applyVoice();
  if (me.voice) speaker.begin();
  setState("thinking");
  const photo = snapshot();
  const userMsg = { role: "user", content: text };
  const payload = {
    messages: [...history.slice(-30), userMsg], me, mood: currentMood().mood, awayMin, voice,
    photo, memories, now: new Date().toLocaleString("es-MX", { dateStyle: "full", timeStyle: "short" }),
  };
  showCaption("", hidden ? "" : text);
  const mine = hidden ? "" : text;
  ctl = new AbortController();
  const my = ctl;
  let reply = "", error = null;
  try {
    const res = await fetch("api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: my.signal });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop();
      for (const part of parts) {
        if (!part.startsWith("data: ")) continue;
        const ev = JSON.parse(part.slice(6));
        if (ev.type === "text") { reply += ev.text; showCaption(reply, mine); if (me.voice) speaker.push(ev.text); }
        else if (ev.type === "action") onAction(ev);
        else if (ev.type === "error") error = ev.error;
      }
    }
  } catch (e) {
    if (my.signal.aborted) return;
    error = "connection";
  }
  if (my !== ctl) return;
  ctl = null;
  if (error && !reply) {
    speaker.cancel();
    showCaption(ERRORS[error] || "Algo falló. Intenta otra vez.", mine);
    setState("idle");
    if (talkOn) setTimeout(listenNow, 1200);
    return;
  }
  history.push(userMsg, { role: "assistant", content: reply });
  history = history.slice(-60);
  store.set("history", history);
  if (me.voice) speaker.end();
  else { setState("idle"); if (talkOn) listenNow(); }
}

function onAction({ name, input }) {
  if (name === "set_mood") setMood(input.mood, input.intensity);
  else if (name === "remember") {
    if (!memories.includes(input.text)) memories.push(input.text.trim());
    memories = memories.slice(-120);
    store.set("memories", memories);
  } else if (name === "forget") {
    const words = input.words.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    memories = memories.filter((m) => !words.some((w) => m.toLowerCase().includes(w)));
    store.set("memories", memories);
  }
}

// ---------- Se va / vuelve ----------
// Mientras la app está a la vista se apunta la hora; al volver sabe cuánto tiempo estuviste fuera.
function markSeen() { lastSeen = Date.now(); store.set("lastSeen", lastSeen); }
setInterval(() => { if (document.visibilityState === "visible" && $("#gate").hidden) markSeen(); }, 20_000);
document.addEventListener("visibilitychange", () => {
  if (!$("#gate").hidden) return;
  if (document.visibilityState === "hidden") {
    markSeen();
    listener.stop();
    return;
  }
  const away = (Date.now() - lastSeen) / 60_000;
  markSeen();
  if (away >= AWAY_MIN) welcomeBack(away);
  else if (talkOn && state === "idle") listenNow();
});

function welcomeBack(awayMin) {
  // Antes de que diga nada, su cara ya lo nota.
  if (awayMin < 60) setMood("annoyed", 0.5);
  else if (awayMin < 6 * 60) setMood(Math.random() < 0.5 ? "jealous" : "missing", 0.75);
  else if (awayMin < 24 * 60) setMood("sad", 0.8);
  else setMood("crying", 0.85);
  const ago = awayMin < 60 ? `${Math.round(awayMin)} minutos` : awayMin < 1440 ? `${Math.round(awayMin / 60)} horas` : `${Math.floor(awayMin / 1440)} días`;
  ask(`[Aviso de la app, no lo escribió él: acaba de volver después de ${ago} sin abrir la app${camOn ? " (te llega una foto de su cámara)" : ""}. Reacciona tú primero, como su novia, según cuánto tiempo pasó: nótalo, reclámale con tu estilo o dile que lo extrañaste. Una o dos frases.]`, { hidden: true, awayMin, voice: true });
}

// ---------- Ajustes ----------
function renderTop() {
  $("#herName").textContent = me.name;
  document.title = me.name;
  const m = MOODS[currentMood().mood];
  $("#mood").textContent = m[0] ? `${m[0]} ${m[1]}` : "";
}

function openSettings() {
  $("#sName").value = me.name;
  $("#sPet").value = me.pet;
  $("#sAbout").value = me.about;
  $("#sVoice").checked = me.voice;
  $("#sPhoto").src = store.get("photo", "") || DEFAULT_FACE;
  $("#sRule").checked = false;
  $("#sUpload").classList.add("off");
  $("#sUpload input").disabled = true;
  $("#sPhotoNote").textContent = "";
  renderMemories();
  $("#settings").showModal();
}
function renderMemories() {
  const ul = $("#sMem");
  ul.textContent = "";
  if (!memories.length) {
    const li = document.createElement("li"); li.className = "empty"; li.textContent = "Todavía nada. Cuéntale cosas de ti.";
    ul.appendChild(li);
  }
  memories.forEach((m, i) => {
    const li = document.createElement("li");
    const sp = document.createElement("span"); sp.textContent = m;
    const del = document.createElement("button"); del.type = "button"; del.textContent = "✕"; del.ariaLabel = "Olvidar";
    del.onclick = () => { memories.splice(i, 1); store.set("memories", memories); renderMemories(); };
    li.append(sp, del);
    ul.appendChild(li);
  });
}
$("#sRule").addEventListener("change", (e) => {
  $("#sUpload input").disabled = !e.target.checked;
  $("#sUpload").classList.toggle("off", !e.target.checked);
});
$("#sUpload").addEventListener("click", (e) => { if (!$("#sRule").checked) { e.preventDefault(); $("#sPhotoNote").textContent = "Primero marca la casilla."; } });
$("#sUpload input").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  $("#sPhotoNote").textContent = "Buscando su cara…";
  try {
    const dataUrl = await photoToPortrait(file, 1100);
    const face = await portrait.set(dataUrl);
    store.set("photo", dataUrl);
    store.set("faceData", face);
    $("#sPhoto").src = dataUrl;
    $("#gateImg").src = dataUrl;
    $("#sPhotoNote").textContent = face ? "Cara detectada ✓" : "No encontré una cara clara: prueba un retrato de frente y bien iluminado.";
  } catch {
    $("#sPhotoNote").textContent = "No pude abrir esa imagen. Prueba otra (JPG o PNG).";
  }
});
$("#sReset").addEventListener("click", async () => {
  store.set("photo", ""); store.set("faceData", null);
  await portrait.set(DEFAULT_FACE).catch(() => {});
  $("#sPhoto").src = DEFAULT_FACE; $("#gateImg").src = DEFAULT_FACE;
});
$("#sClear").addEventListener("click", () => {
  if (!confirm(`¿Borrar toda la conversación? (Sus recuerdos de ti se quedan.)`)) return;
  history = []; store.set("history", history);
  showCaption("");
});
$("#settings").addEventListener("close", () => {
  me.name = $("#sName").value.trim() || "Valeria";
  me.pet = $("#sPet").value.trim() || "amor";
  me.about = $("#sAbout").value.trim();
  me.voice = $("#sVoice").checked;
  store.set("me", me);
  if (!me.voice) speaker.cancel();
  renderTop();
});

// ---------- Arranque ----------
$("#settingsBtn").onclick = openSettings;
$("#micBtn").onclick = () => toggleTalk();
$("#camBtn").onclick = () => toggleCam();
$("#chat").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("#input").value.trim();
  if (!v) return;
  $("#input").value = "";
  ask(v, { voice: false });
});
$("#enter").onclick = async () => {
  unlockAudio();
  $("#gate").hidden = true;
  const away = lastSeen ? (Date.now() - lastSeen) / 60_000 : 0;
  markSeen();
  if (!apiKey) { showCaption(ERRORS.auth); return; }
  // La plática por voz queda abierta: cuando ella termine de hablar, te escucha.
  if (speechSupported) { talkOn = true; $("#micBtn").classList.add("on"); }
  if (!history.length) {
    ask(`[Aviso de la app, no lo escribió él: es la primera vez que él abre la app y te ve. Salúdalo como su novia, con tu personalidad, en una o dos frases, y pregúntale algo.]`, { hidden: true, voice: true });
  } else if (away >= AWAY_MIN) {
    welcomeBack(away);
  } else if (talkOn) {
    listenNow();
  }
};

renderTop();
applyVoice();
loadFace();
requestAnimationFrame(frame);
fetch("api/health").then((r) => r.json()).then((h) => { apiKey = h.apiKey; $("#dot").classList.toggle("off", !apiKey); }).catch(() => {});
