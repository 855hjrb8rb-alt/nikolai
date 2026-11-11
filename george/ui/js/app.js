// George — la pantalla: escritorio con estilos + el asistente.
import { mac, isNative, Store } from "./bridge.js";
import { THEMES, themeById } from "./themes.js";
import { Backdrop } from "./fx.js";
import { Music } from "./music.js";
import { Speaker, Listener } from "./voice.js";
import { Brain } from "./brain.js";
import { Face } from "./face.js";

const $ = (id) => document.getElementById(id);
const PANEL = new URLSearchParams(location.search).get("mode") === "panel";
document.body.classList.toggle("panel", PANEL);

const settings = new Store("settings", {
  theme: "reactor", themesEnabled: true, snow: {}, favorites: null, volume: 60, autoplay: true,
  model: "", voices: {}, rate: 185, wake: true, muted: false, photo: "", photoFace: null,
});

const music = new Music();
const speaker = new Speaker();
const listener = new Listener();
let backdrop = null, face = null, orbFace = null, brain = null;
let theme = THEMES[0], apps = [], info = {}, busy = false;
let cameraStream = null, cinemaTimer = 0, lastTalk = 0;

// ---------------------------------------------------------------- utilidades
let toastTimer = 0;
function toast(msg, ms = 3200) {
  const t = $("toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// ---------------------------------------------------------------- estilos
function snowOn() { return settings.data.snow[theme.id] ?? theme.snow; }
function setSnow(on) {
  settings.data.snow[theme.id] = on; settings.save();
  backdrop?.setSnow(on); $("snowBtn").classList.toggle("on", on); $("snowAll").checked = on;
}
function applyTheme(id, { instant = false, greet = false } = {}) {
  theme = themeById(id);
  const paint = () => {
    const b = document.body;
    b.dataset.theme = theme.id; b.dataset.icon = theme.icon;
    for (const [k, v] of Object.entries(theme.vars)) b.style.setProperty("--" + k, v);
    $("themeGlyph").textContent = theme.glyph; $("themeName").textContent = theme.name; $("themeTag").textContent = theme.tag;
    $("motto").textContent = theme.greet; $("plName").textContent = theme.playlist;
    backdrop?.set(theme.fx);
    const snow = snowOn(); backdrop?.setSnow(snow); $("snowBtn").classList.toggle("on", snow); $("snowAll").checked = snow;
    document.querySelectorAll(".tcard").forEach((c) => c.classList.toggle("on", c.dataset.id === theme.id));
    b.classList.remove("switching");
  };
  if (PANEL || instant) paint(); else { document.body.classList.add("switching"); setTimeout(paint, 380); }
  if (settings.data.theme !== theme.id) { settings.set({ theme: theme.id }); mac.app.themeChanged(); }
  if (!PANEL) music.setTheme(theme).then(() => { if (settings.data.autoplay && started && !music.playing) music.play(); });
  if (greet) say(theme.greet, true);
}
function buildPicker() {
  const grid = $("themeGrid"); grid.textContent = "";
  for (const t of THEMES) {
    const b = document.createElement("button");
    b.className = "tcard"; b.dataset.id = t.id; b.style.background = t.vars.bg; b.style.color = t.vars.ink; b.style.fontFamily = t.vars.display;
    const gl = document.createElement("span"); gl.className = "gl"; gl.textContent = t.glyph;
    const tt = document.createElement("span"); tt.className = "tt";
    const nm = document.createElement("b"); nm.textContent = t.name;
    const sm = document.createElement("small"); sm.textContent = t.tag;
    tt.append(nm, sm); b.append(gl, tt);
    b.onclick = () => { applyTheme(t.id, { greet: true }); $("picker").hidden = true; };
    grid.append(b);
  }
}

// ---------------------------------------------------------------- reloj
function tick() {
  const now = new Date();
  $("clock").textContent = now.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  $("date").textContent = now.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
}
async function battery() {
  const b = await mac.sys.battery().catch(() => null);
  $("battery").hidden = !b;
  if (b) $("battery").textContent = `${/charg|AC/i.test(b.state) && !/dis/i.test(b.state) ? "⚡" : "🔋"} ${b.percent}%`;
}

// ---------------------------------------------------------------- apps
function appButton(a) {
  const b = document.createElement("button"); b.className = "app"; b.title = a.name;
  const ico = document.createElement("span"); ico.className = "ico";
  if (a.icon) { const img = document.createElement("img"); img.src = a.icon; img.alt = ""; img.draggable = false; ico.append(img); }
  else { const l = document.createElement("span"); l.className = "ltr"; l.textContent = a.name[0]; ico.append(l); }
  const nm = document.createElement("span"); nm.className = "name"; nm.textContent = a.name;
  b.append(ico, nm);
  b.onclick = () => launch(a);
  b.oncontextmenu = (e) => { e.preventDefault(); toggleFavorite(a); };
  return b;
}
function launch(a) { mac.apps.open(a.path).then((ok) => { if (!ok) toast(`No pude abrir ${a.name}`); }); }
function renderApps() {
  const q = norm($("search").value.trim());
  const list = q ? apps.filter((a) => norm(a.name).includes(q)) : apps;
  const box = $("apps"); box.textContent = "";
  list.forEach((a, i) => { const b = appButton(a); if (q && i === 0) b.classList.add("sel"); box.append(b); });
  const dock = $("dock"); dock.textContent = "";
  for (const name of settings.data.favorites || []) { const a = apps.find((x) => x.name === name); if (a) dock.append(appButton(a)); }
}
function toggleFavorite(a) {
  const f = settings.data.favorites || [], i = f.indexOf(a.name);
  if (i >= 0) f.splice(i, 1); else if (f.length < 12) f.push(a.name); else return toast("El dock está lleno");
  settings.set({ favorites: f }); renderApps();
  toast(i >= 0 ? `${a.name} quitada del dock` : `${a.name} fijada en el dock`, 1500);
}
function findApp(name) {
  const q = norm(name).replace(/[.!?]+$/, "").trim();
  if (!q) return null;
  const alias = { navegador: "safari", correo: "mail", musica: "music", fotos: "photos", mensajes: "messages", notas: "notes", calendario: "calendar", ajustes: "system settings", calculadora: "calculator", mapas: "maps", terminal: "terminal" }[q];
  const score = (a) => { const n = norm(a.name); return n === q || n === alias ? 3 : n.startsWith(q) || (alias && n.startsWith(alias)) ? 2 : n.includes(q) || (alias && n.includes(alias)) ? 1 : 0; };
  return apps.map((a) => [score(a), a]).filter(([s]) => s).sort((x, y) => y[0] - x[0] || x[1].name.length - y[1].name.length)[0]?.[1] || null;
}

// ---------------------------------------------------------------- música (interfaz)
function renderPlayer() {
  $("playBtn").textContent = music.playing ? "❚❚" : "▶";
  $("trackTitle").textContent = music.title || "Música";
  $("trackSrc").textContent = { files: "Tu carpeta de música", synth: "Partitura original de George", apple: "App Música" }[music.source];
  $("nextBtn").style.visibility = music.source === "files" && music.files.length > 1 ? "visible" : "hidden";
}

// ---------------------------------------------------------------- George
function setState(s) {
  for (const f of [face, orbFace]) if (f) f.state = s;
  const label = { idle: "en línea", listening: "escuchando…", hearing: "le oigo…", thinking: "pensando…", speaking: "hablando" }[s];
  $("orbState").textContent = label; $("gStatus").textContent = label;
}
function restState() { setState(listener.on ? "listening" : "idle"); }
function addMsg(kind, text) {
  const d = document.createElement("div"); d.className = "msg " + kind; d.textContent = text;
  const log = $("gLog"); log.append(d); log.scrollTop = log.scrollHeight;
  while (log.children.length > 120) log.firstChild.remove();
  return d;
}
function say(text, show = false) {
  if (show) addMsg("g", text);
  speaker.say(text);
}
function openGeorge(focus = true) {
  $("george").hidden = false;
  if (focus) setTimeout(() => $("gInput").focus(), 60);
}

function cameraFrame() {
  const v = $("cam");
  if (!cameraStream || !v.videoWidth) return null;
  const c = document.createElement("canvas"), k = Math.min(1, 640 / v.videoWidth);
  c.width = v.videoWidth * k; c.height = v.videoHeight * k;
  c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.75).split(",")[1];
}
async function setCamera(on) {
  if (on && !cameraStream) {
    await mac.media.ask("camera").catch(() => {});
    try { cameraStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } }); }
    catch { toast("No pude encender la cámara. Revisa el permiso en Ajustes del Sistema → Privacidad → Cámara."); return; }
    $("cam").srcObject = cameraStream; $("cam").hidden = false;
  } else if (!on && cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop()); cameraStream = null; $("cam").srcObject = null; $("cam").hidden = true;
  }
  $("camBtn").classList.toggle("on", Boolean(cameraStream));
}
async function setCinema(on) {
  clearInterval(cinemaTimer); cinemaTimer = 0;
  if (on) {
    const shot = await mac.screen.grab(640);
    if (!shot && isNative) {
      toast("Para el modo cine, da permiso a George en Ajustes del Sistema → Privacidad y seguridad → Grabación de pantalla, y vuelve a abrirlo.", 8000);
      $("cineBtn").classList.remove("on"); return;
    }
    cinemaTimer = setInterval(cinemaTick, 45000);
    if (music.playing) music.pause();
  }
  $("cineBtn").classList.toggle("on", on);
}
async function cinemaTick() {
  if (busy || speaker.speaking || Date.now() - lastTalk < 20000) return;
  const shot = await mac.screen.grab(1024);
  if (!shot) return;
  busy = true;
  try {
    const r = await brain.watch(shot);
    if (r) say(r, true);
  } finally { busy = false; }
}

/** Lo que el usuario dice o escribe llega aquí. */
async function handle(text, viaVoice = false) {
  text = text.trim();
  if (!text) return;
  lastTalk = Date.now();
  speaker.stop();
  addMsg("u", text);
  openGeorge(!viaVoice);
  const bubble = addMsg("g", "…");
  setState("thinking"); busy = true;
  const images = [];
  if (cinemaTimer) { const s = await mac.screen.grab(1024); if (s) images.push(s); }
  else { const f = cameraFrame(); if (f) images.push(f); }
  try {
    const answer = await brain.ask(text, {
      images,
      onText: (t) => { bubble.textContent = t || "…"; $("gLog").scrollTop = $("gLog").scrollHeight; },
      onSentence: (s) => speaker.say(s),
    });
    if (!answer) bubble.remove();
  } catch (e) { bubble.textContent = "Algo falló al pensar: " + (e.message || e); }
  busy = false; lastTalk = Date.now();
  if (!speaker.speaking) restState();
  renderBrainStatus();
}

const WAKE = /\b(george|jorge|yorch|yorge|georgie)\b[,.!?]*/i;
function onUtterance(text) {
  const named = WAKE.test(text);
  // Con "solo cuando diga George": hace falta nombrarlo, salvo si la plática sigue (30 s).
  if (settings.data.wake && !named && Date.now() - lastTalk > 30000) return;
  const clean = text.replace(/^\s*(oye|hey|ok|hola)?[\s,]*(george|jorge|yorch|yorge|georgie)[\s,.!?]*/i, "").trim();
  handle(clean || "Hola, George", true);
}
async function setMic(on) {
  if (on) {
    if (!info.whisper && isNative) { toast("Falta instalar el oído de George (Whisper). Ejecuta el instalador: lo explica el LÉEME.", 7000); return; }
    if (!(await listener.start())) { toast("No pude usar el micrófono. Revisa el permiso en Ajustes del Sistema → Privacidad → Micrófono.", 6000); return; }
  } else listener.stop();
  $("micBtn").classList.toggle("on", listener.on);
  restState();
}

// ---------------------------------------------------------------- ajustes
function renderBrainStatus() {
  const el = $("brainStatus");
  if (!brain) return;
  if (brain.online) {
    el.className = "status ok";
    el.innerHTML = `Cerebro local activo: <code></code>. Funciona sin internet.${info.whisper || !isNative ? "" : "<br>Oído (Whisper): <b>no instalado</b> — la voz por micrófono no funcionará hasta ejecutar el instalador."}`;
    el.querySelector("code").textContent = brain.model;
  } else {
    el.className = "status bad";
    el.innerHTML = "George está en <b>modo básico</b> (estilos, nieve, música y apps). Para que converse, vea y recuerde, instala su cerebro local una sola vez con internet; después ya no lo necesita:<br><code>brew install ollama && ollama serve & ollama pull gemma3:4b</code><br>o simplemente ejecuta <code>./instalar.command</code> de la carpeta de George.";
  }
  const sel = $("modelSel"); sel.textContent = "";
  for (const m of brain.models) { const o = new Option(m, m, false, m === brain.model); sel.add(o); }
  if (!brain.models.length) sel.add(new Option("(ninguno instalado)", ""));
}
function renderVoices() {
  for (const [id, lang] of [["voiceEs", "es"], ["voiceEn", "en"]]) {
    const sel = $(id); sel.textContent = ""; sel.add(new Option("Automática (la mejor instalada)", ""));
    for (const v of speaker.voices.filter((x) => x.lang.toLowerCase().startsWith(lang)).sort((a, b) => b.quality - a.quality))
      sel.add(new Option(`${v.name} · ${v.lang}`, v.name, false, settings.data.voices[lang] === v.name));
    sel.onchange = () => { settings.data.voices[lang] = sel.value; settings.save(); speaker.voicePref = { ...settings.data.voices }; };
  }
}
function renderMemory() {
  const ul = $("memList"); ul.textContent = "";
  const facts = brain.memory.data.facts;
  if (!facts.length) { const li = document.createElement("li"); li.textContent = "Todavía no hay recuerdos. Cuéntale algo a George o añádelo arriba."; li.className = "hint"; ul.append(li); return; }
  facts.forEach((f, i) => {
    const li = document.createElement("li"), sp = document.createElement("span"), b = document.createElement("button");
    sp.textContent = f.text; b.className = "mini"; b.textContent = "✕"; b.title = "Olvidar";
    b.onclick = () => { brain.forgetAt(i); renderMemory(); };
    li.append(sp, b); ul.prepend(li);
  });
}
function openSettings(tab) {
  $("settings").hidden = false;
  renderBrainStatus(); renderVoices(); renderMemory();
  if (tab) document.querySelector(`.tabs [data-tab=${tab}]`)?.click();
}
async function loadPhoto() {
  const { photo, photoFace } = settings.data;
  for (const f of [face, orbFace].filter(Boolean)) {
    try {
      const pts = await f.setPhoto(photo || null, photoFace);
      if (photo && pts && !settings.data.photoFace) settings.set({ photoFace: pts });
    } catch { await f.setPhoto(null); }
  }
}

// ---------------------------------------------------------------- arranque
let started = false;
async function main() {
  await settings.load();
  info = await mac.sys.info().catch(() => ({}));
  if (!PANEL) { backdrop = new Backdrop($("bg"), $("snow")); orbFace = new Face($("orbFace")); }
  face = new Face($("face"));

  brain = new Brain({
    themeName: () => (PANEL ? "ninguno (estilos apagados)" : theme.name),
    snow: () => !PANEL && snowOn(),
    musicState: () => (music.playing ? `sonando (${music.title})` : "en pausa"),
    cameraOn: () => Boolean(cameraStream), cinemaOn: () => Boolean(cinemaTimer),
    setTheme: (id) => { if (PANEL) { settings.set({ theme: id }); mac.app.themes(true); } else applyTheme(id); },
    themesOff: () => mac.app.themes(false),
    setSnow: (on) => { if (!PANEL) setSnow(on); },
    music: (a) => { if (PANEL) return; a === "play" ? music.play() : a === "pause" ? music.pause() : music.next(); },
    openApp: (name) => { const a = findApp(name); if (a) launch(a); return a?.name || null; },
    camera: setCamera, cinema: setCinema,
    note: (t) => addMsg("n", t),
  });

  // --- habla / escucha
  speaker.rate = settings.data.rate; speaker.muted = settings.data.muted; speaker.voicePref = { ...settings.data.voices };
  speaker.onstate = (on) => { listener.pause(on); music.duck(on); if (on) setState("speaking"); else setTimeout(() => { if (!speaker.speaking && !busy) restState(); }, 250); };
  listener.onstate = (s) => { if (speaker.speaking || busy) return; setState(s === "off" ? "idle" : s); if (s === "hearing") music.duck(true); else if (s === "listening") music.duck(false); };
  listener.onutterance = onUtterance;
  listener.onerror = (e) => { if (e === "no-whisper") { toast("Falta instalar el oído de George (Whisper)."); setMic(false); } };
  (function meter() { const lv = speaker.speaking ? speaker.level : listener.level; for (const f of [face, orbFace]) if (f) { f.level = lv; f.char = speaker.char; } requestAnimationFrame(meter); })();

  // --- estilos, reloj, apps
  buildPicker();
  applyTheme(settings.data.theme, { instant: true });
  tick(); setInterval(tick, 1000);
  if (!PANEL) { battery(); setInterval(battery, 60000); }
  music.setVolume(settings.data.volume / 100); $("vol").value = settings.data.volume;
  music.onchange = renderPlayer; renderPlayer();

  mac.apps.list().then((list) => {
    apps = list;
    if (!settings.data.favorites) {
      const wanted = ["Safari", "Mail", "Messages", "Mensajes", "Music", "Música", "Photos", "Fotos", "TV", "Notes", "Notas", "Finder", "System Settings", "Ajustes del Sistema"];
      settings.data.favorites = wanted.filter((n) => apps.some((a) => a.name === n)).slice(0, 8);
    }
    renderApps();
  });

  // --- eventos del escritorio
  $("themeBtn").onclick = () => { $("picker").hidden = false; };
  $("snowBtn").onclick = () => setSnow(!snowOn());
  $("settingsBtn").onclick = () => openSettings();
  $("search").oninput = renderApps;
  $("search").onkeydown = (e) => { if (e.key === "Enter") { document.querySelector("#apps .app")?.click(); e.target.value = ""; renderApps(); } };
  $("playBtn").onclick = () => music.toggle();
  $("nextBtn").onclick = () => music.next();
  $("vol").oninput = (e) => { music.setVolume(e.target.value / 100); settings.set({ volume: Number(e.target.value) }); };
  $("folderBtn").onclick = $("musicFolder").onclick = () => { mac.music.openFolder(theme.id); toast(`Pon aquí tu música para «${theme.name}» y vuelve a entrar al estilo.`, 5000); };
  $("appleBtn").onclick = async () => { if (!(await music.playApple())) { await music.searchApple(); toast(`No encontré la lista «${theme.playlist}» en tu app Música; te abro la búsqueda de la banda sonora.`, 6000); } };
  $("orb").onclick = () => { $("george").hidden ? openGeorge() : ($("george").hidden = true); };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { for (const id of ["settings", "picker"]) if (!$(id).hidden) { $(id).hidden = true; return; } if (!PANEL && !$("george").hidden) $("george").hidden = true; }
    else if (!PANEL && !e.metaKey && !e.ctrlKey && e.key.length === 1 && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && $("settings").hidden && $("picker").hidden) $("search").focus();
  });
  document.querySelectorAll(".overlay").forEach((o) => o.addEventListener("click", (e) => { if (e.target === o || e.target.closest("[data-close]")) o.hidden = true; }));

  // --- George
  $("gClose").onclick = () => { if (PANEL) mac.app.hide(); else $("george").hidden = true; };
  $("gForm").onsubmit = (e) => { e.preventDefault(); const v = $("gInput").value; $("gInput").value = ""; handle(v); };
  $("micBtn").onclick = () => setMic(!listener.on);
  $("camBtn").onclick = () => setCamera(!cameraStream);
  $("cineBtn").onclick = () => setCinema(!cinemaTimer);
  const paintMute = () => { $("muteBtn").classList.toggle("on", !speaker.muted); $("muteBtn").firstChild.textContent = speaker.muted ? "🔇" : "🔊"; };
  $("muteBtn").onclick = () => { speaker.muted = !speaker.muted; if (speaker.muted) speaker.stop(); settings.set({ muted: speaker.muted }); paintMute(); };
  paintMute();
  if (PANEL) {
    $("george").hidden = false; $("gStyles").hidden = false; $("gSettings").hidden = false;
    $("gStyles").onclick = () => mac.app.themes(true);
    $("gSettings").onclick = () => openSettings();
  }

  // --- ajustes
  document.querySelectorAll(".tabs button").forEach((b) => { b.onclick = () => {
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("on", x === b));
    document.querySelectorAll(".tab").forEach((t) => { t.hidden = t.id !== b.dataset.tab; });
  }; });
  $("modelSel").onchange = (e) => { brain.model = e.target.value; settings.set({ model: e.target.value }); renderBrainStatus(); };
  $("rate").value = settings.data.rate; $("rate").onchange = (e) => { speaker.rate = Number(e.target.value); settings.set({ rate: speaker.rate }); };
  $("wake").checked = settings.data.wake; $("wake").onchange = (e) => settings.set({ wake: e.target.checked });
  $("autoplay").checked = settings.data.autoplay; $("autoplay").onchange = (e) => settings.set({ autoplay: e.target.checked });
  $("testVoice").onclick = () => { speaker.muted = false; paintMute(); speaker.say("Buenas. Soy George, a su servicio. Good evening; I am George, at your service."); };
  $("recheck").onclick = async () => { $("brainStatus").textContent = "Comprobando…"; await brain.refresh(settings.data.model); info = await mac.sys.info().catch(() => info); await speaker.init(); renderBrainStatus(); renderVoices(); };
  $("loginItem").checked = Boolean(info.loginItem); $("loginItem").onchange = (e) => mac.app.loginItem(e.target.checked);
  $("snowAll").onchange = (e) => setSnow(e.target.checked);
  $("themesOff").onclick = $("offStyles").onclick = () => mac.app.themes(false);
  $("quit").onclick = () => mac.app.quit();
  $("about").textContent = `George ${info.version || ""} · todo se guarda y se procesa en esta Mac.`;
  $("memForm").onsubmit = (e) => { e.preventDefault(); if (brain.remember($("memInput").value)) { $("memInput").value = ""; renderMemory(); } };
  $("histClear").onclick = () => { brain.clearHistory(); $("gLog").textContent = ""; toast("Conversación borrada"); };
  $("photoFile").onchange = async (e) => {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    $("photoMsg").textContent = "Preparando la cara…";
    try {
      const dataUrl = await Face.fileToPhoto(file);
      settings.set({ photo: dataUrl, photoFace: null });
      await loadPhoto();
      $("photoMsg").textContent = settings.data.photoFace ? "Listo: George ya tiene cara y la mueve al hablar." : "Foto puesta, pero no encontré bien la cara (o falta el modelo de caras). Se verá sin animar la boca; prueba con un retrato de frente.";
    } catch { $("photoMsg").textContent = "No pude usar esa imagen."; }
  };
  $("photoClear").onclick = () => { settings.set({ photo: "", photoFace: null }); loadPhoto(); $("photoMsg").textContent = "Rostro holográfico activado."; };

  // --- avisos del sistema
  mac.on("george:summon", () => openGeorge());
  mac.on("theme:set", (id) => applyTheme(id, { greet: true }));

  // El audio necesita un primer gesto del usuario en algunos casos; dentro de la app arranca solo.
  const start = () => {
    if (started) return; started = true;
    if (!PANEL && settings.data.autoplay) music.play();
  };
  if (isNative) setTimeout(start, 900); else addEventListener("pointerdown", start, { once: true });

  // --- cerebro, voces y cara (sin bloquear la pantalla)
  await Promise.all([speaker.init(), brain.init(settings.data.model)]);
  renderBrainStatus();
  for (const m of brain.history.data.slice(-12)) addMsg(m.role === "user" ? "u" : "g", m.content);
  loadPhoto();
  restState();
  if (!brain.history.data.length) addMsg("g", brain.online
    ? "Buenas. Soy George. Puede escribirme aquí o activar «Voz» y hablarme; recuerdo lo que me cuente y todo se queda en esta Mac."
    : "Buenas. Soy George. Ya puedo cambiar estilos, nieve, música y abrir apps. Para conversar, verle y recordar, instale mi cerebro local (⚙ Ajustes → George).");
}
main();
