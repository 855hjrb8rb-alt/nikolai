// George — proceso principal (Electron).
// Pone el escritorio con estilos a pantalla completa, mantiene a George siempre disponible
// (barra de menús + atajo global) y hace de puente con el Mac: apps, voz, oído, pantalla,
// música y el cerebro local (Ollama). Nada sale a internet.
const {
  app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, shell, screen,
  nativeImage, desktopCapturer, protocol, net, session, systemPreferences,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const { spawn, execFile } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const isMac = process.platform === "darwin";
const OLLAMA = process.env.OLLAMA_HOST_URL || "http://127.0.0.1:11434";
const HOTKEY = "Alt+Space";

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();
// La música y la voz suenan sin esperar un clic.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const userDir = () => app.getPath("userData");
const modelsDir = () => path.join(userDir(), "models");
const musicRoot = () => path.join(app.getPath("music"), "George");

// ---------- Guardado (ajustes, memoria, conversación) ----------
const STORES = new Set(["settings", "memory", "history"]);
const storeFile = (name) => path.join(userDir(), `${name}.json`);
function readStore(name) {
  try { return JSON.parse(fs.readFileSync(storeFile(name), "utf8")); } catch { return null; }
}
function writeStore(name, data) {
  fs.mkdirSync(userDir(), { recursive: true });
  const tmp = storeFile(name) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, storeFile(name));
}
const settings = () => readStore("settings") || {};

// ---------- Ventanas ----------
let shellWin = null; // el escritorio con estilos
let panelWin = null; // George solo (cuando los estilos están apagados)
let tray = null;
let quitting = false;

const webPreferences = () => ({
  preload: path.join(__dirname, "preload.js"),
  contextIsolation: true,
  nodeIntegration: false,
  backgroundThrottling: false,
});

function createShell() {
  if (shellWin) { shellWin.show(); shellWin.focus(); return; }
  const { bounds } = screen.getPrimaryDisplay();
  shellWin = new BrowserWindow({
    ...bounds,
    frame: false, show: false, backgroundColor: "#05070b",
    resizable: false, movable: false, minimizable: false, fullscreenable: true,
    hasShadow: false, roundedCorners: false, skipTaskbar: true,
    webPreferences: webPreferences(),
  });
  shellWin.loadURL("app://george/ui/index.html?mode=shell");
  shellWin.once("ready-to-show", () => {
    // Pantalla completa "simple": tapa el Dock y la barra de menús sin cambiar de Space,
    // así las apps que abras aparecen encima de tu escritorio con estilo.
    if (isMac) shellWin.setSimpleFullScreen(true);
    shellWin.show();
  });
  shellWin.on("close", (e) => { if (!quitting) { e.preventDefault(); shellWin.hide(); } });
  shellWin.on("closed", () => { shellWin = null; });
  if (panelWin) { panelWin.destroy(); panelWin = null; }
}

function createPanel(show = true) {
  if (panelWin) { if (show) { panelWin.show(); panelWin.focus(); } return; }
  const { workArea } = screen.getPrimaryDisplay();
  const w = 420, h = 680;
  panelWin = new BrowserWindow({
    width: w, height: h, x: workArea.x + workArea.width - w - 24, y: workArea.y + 24,
    frame: false, transparent: true, show: false, alwaysOnTop: true, resizable: true,
    minWidth: 340, minHeight: 480, skipTaskbar: true, hasShadow: true,
    webPreferences: webPreferences(),
  });
  panelWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  panelWin.loadURL("app://george/ui/index.html?mode=panel");
  panelWin.once("ready-to-show", () => { if (show) panelWin.show(); });
  panelWin.on("close", (e) => { if (!quitting) { e.preventDefault(); panelWin.hide(); } });
  panelWin.on("closed", () => { panelWin = null; });
}

/** Enciende o apaga los estilos. George se queda siempre. */
function setThemesEnabled(on, { showPanel = true } = {}) {
  writeStore("settings", { ...settings(), themesEnabled: on });
  if (on) createShell();
  else {
    if (shellWin) { const w = shellWin; shellWin = null; w.destroy(); }
    createPanel(showPanel);
  }
  buildTray();
}

function summonGeorge() {
  if (shellWin) {
    shellWin.show(); shellWin.focus();
    shellWin.webContents.send("george:summon");
  } else if (panelWin?.isVisible() && panelWin.isFocused()) {
    panelWin.hide();
  } else {
    createPanel(true);
    panelWin.webContents.send("george:summon");
  }
}

const THEME_NAMES = [
  ["aventura", "Reliquia · aventura años 30"], ["reactor", "Reactor · armadura HUD"],
  ["expreso", "Expreso del Norte"], ["galaxia", "Galaxia Lejana"], ["guerra", "Cuartel 1944"],
  ["navidad", "Navidad Clásica"], ["magia", "Colegio de Magia"], ["matrix", "Código"],
  ["neon", "Neón 2049"], ["jurasico", "Isla Jurásica"],
];

function buildTray() {
  if (!tray) {
    const icon = nativeImage.createFromPath(path.join(__dirname, "build", "trayTemplate.png"));
    if (isMac) icon.setTemplateImage(true);
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
    tray.setToolTip("George");
    if (icon.isEmpty() && isMac) tray.setTitle("G");
  }
  const s = settings();
  const on = s.themesEnabled !== false;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Hablar con George", accelerator: HOTKEY, click: summonGeorge },
    { type: "separator" },
    { label: "Estilos activados", type: "checkbox", checked: on, click: (i) => setThemesEnabled(i.checked) },
    {
      label: "Estilo", enabled: on,
      submenu: THEME_NAMES.map(([id, label]) => ({
        label, type: "radio", checked: s.theme === id,
        click: () => {
          // Se guarda y además se avisa: así vale tanto si el escritorio ya está abierto como si se abre ahora.
          writeStore("settings", { ...settings(), theme: id, themesEnabled: true });
          createShell(); shellWin.webContents.send("theme:set", id); buildTray();
        },
      })),
    },
    { type: "separator" },
    {
      label: "Abrir al encender la Mac", type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked }),
    },
    { label: "Salir de George", click: () => { quitting = true; app.quit(); } },
  ]));
}

// ---------- Apps del Mac ----------
const APP_DIRS = () => [
  "/Applications", "/System/Applications", "/System/Applications/Utilities",
  "/Applications/Utilities", path.join(os.homedir(), "Applications"),
];
let appsCache = null;
async function listApps() {
  if (appsCache) return appsCache;
  const found = new Map();
  for (const dir of APP_DIRS()) {
    let names = [];
    try { names = await fsp.readdir(dir); } catch { continue; }
    for (const n of names) {
      if (!n.endsWith(".app") || n.startsWith(".")) continue;
      const name = n.slice(0, -4);
      if (!found.has(name)) found.set(name, path.join(dir, n));
    }
  }
  const out = [];
  await Promise.all([...found].map(async ([name, p]) => {
    let icon = "";
    try { icon = (await app.getFileIcon(p, { size: "large" })).toDataURL(); } catch { /* sin icono */ }
    out.push({ name, path: p, icon });
  }));
  out.sort((a, b) => a.name.localeCompare(b.name, "es"));
  if (out.length) appsCache = out;
  return out;
}

// ---------- Voz (say) y oído (whisper.cpp), todo local ----------
function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { maxBuffer: 32 * 1024 * 1024, timeout: 120000, ...opts }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout || ""), stderr: String(stderr || ""), err });
    });
  });
}

let voicesCache = null;
async function listVoices() {
  if (voicesCache) return voicesCache;
  if (!isMac) return [];
  const r = await run("say", ["-v", "?"]);
  const voices = [];
  for (const line of r.stdout.split("\n")) {
    // "Jorge (Enhanced)    es_ES    # Hola, me llamo Jorge."
    const m = line.match(/^(.+?)\s{2,}([a-z]{2,3}[_-][A-Za-z0-9]+)\s+#/);
    if (!m) continue;
    const name = m[1].trim();
    const quality = /premium/i.test(name) ? 3 : /enhanced|mejorada/i.test(name) ? 2 : 1;
    voices.push({ name, lang: m[2].replace("_", "-"), quality });
  }
  if (voices.length) voicesCache = voices;
  return voices;
}

let ttsSeq = 0;
/** Sintetiza con la voz del sistema a un WAV y lo devuelve (la interfaz lo reproduce y mueve la boca). */
async function synth({ text, voice, rate }) {
  if (!isMac || !text) return null;
  const file = path.join(os.tmpdir(), `george-tts-${process.pid}-${++ttsSeq}.wav`);
  const args = ["-o", file, "--data-format=LEI16@22050"];
  if (voice) args.push("-v", voice);
  if (rate) args.push("-r", String(rate));
  args.push("--", text);
  const r = await run("say", args);
  try {
    if (!r.ok) return null;
    const buf = await fsp.readFile(file);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  } catch { return null; } finally { fsp.unlink(file).catch(() => {}); }
}

function findWhisper() {
  const bins = ["whisper-cli", "whisper-cpp", "main"];
  const dirs = ["/opt/homebrew/bin", "/usr/local/bin", path.join(userDir(), "bin")];
  for (const d of dirs) for (const b of bins) {
    const p = path.join(d, b);
    if (b !== "main" && fs.existsSync(p)) return p;
  }
  return process.env.GEORGE_WHISPER_BIN || null;
}
function findWhisperModel() {
  try {
    const all = fs.readdirSync(modelsDir()).filter((f) => /^ggml-.*\.bin$/.test(f));
    // El más grande que haya suele ser el mejor.
    all.sort((a, b) => fs.statSync(path.join(modelsDir(), b)).size - fs.statSync(path.join(modelsDir(), a)).size);
    return all[0] ? path.join(modelsDir(), all[0]) : null;
  } catch { return null; }
}
async function transcribe({ wav, lang }) {
  const bin = findWhisper(), model = findWhisperModel();
  if (!bin || !model) return { error: "no-whisper" };
  const file = path.join(os.tmpdir(), `george-stt-${process.pid}-${Date.now()}.wav`);
  await fsp.writeFile(file, Buffer.from(wav));
  const threads = String(Math.max(2, Math.min(8, os.cpus().length - 2)));
  const r = await run(bin, ["-m", model, "-f", file, "-l", lang || "auto", "-nt", "-np", "-t", threads]);
  fsp.unlink(file).catch(() => {});
  if (!r.ok) return { error: "stt-failed", detail: r.stderr.slice(-300) };
  return { text: r.stdout.replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/\s+/g, " ").trim() };
}

// ---------- Cerebro local (Ollama) ----------
const chats = new Map();
async function ollamaStatus() {
  try {
    const r = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(1500) });
    const j = await r.json();
    return { ok: true, models: (j.models || []).map((m) => m.name) };
  } catch { return { ok: false, models: [] }; }
}
async function startOllama() {
  if ((await ollamaStatus()).ok) return true;
  for (const bin of ["/opt/homebrew/bin/ollama", "/usr/local/bin/ollama"]) {
    if (!fs.existsSync(bin)) continue;
    try { spawn(bin, ["serve"], { detached: true, stdio: "ignore" }).unref(); } catch { /* seguir */ }
    break;
  }
  if (isMac && fs.existsSync("/Applications/Ollama.app")) shell.openPath("/Applications/Ollama.app").catch(() => {});
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if ((await ollamaStatus()).ok) return true;
  }
  return false;
}
async function chat(sender, { id, model, messages, options }) {
  const ctrl = new AbortController();
  chats.set(id, ctrl);
  const send = (type, data) => { if (!sender.isDestroyed()) sender.send("llm:event", { id, type, data }); };
  try {
    const r = await fetch(`${OLLAMA}/api/chat`, {
      method: "POST", signal: ctrl.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, messages, stream: true, keep_alive: "30m", options: { temperature: 0.7, ...options } }),
    });
    if (!r.ok) throw new Error(`Ollama ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const dec = new TextDecoder();
    let buf = "";
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const j = JSON.parse(line);
        if (j.error) throw new Error(j.error);
        if (j.message?.content) send("chunk", j.message.content);
      }
    }
    send("done");
  } catch (e) {
    send(ctrl.signal.aborted ? "done" : "error", String(e.message || e));
  } finally { chats.delete(id); }
}

// ---------- Pantalla (para ver películas contigo) ----------
async function grabScreen(maxW = 1024) {
  const { size } = screen.getPrimaryDisplay();
  const k = Math.min(1, maxW / size.width);
  const sources = await desktopCapturer.getSources({
    types: ["screen"], thumbnailSize: { width: Math.round(size.width * k), height: Math.round(size.height * k) },
  });
  const img = sources[0]?.thumbnail;
  if (!img || img.isEmpty()) return null;
  return img.toJPEG(70).toString("base64");
}

// ---------- Música ----------
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|aiff?|flac|ogg|opus)$/i;
async function listMusic(themeId) {
  const safe = String(themeId).replace(/[^a-z0-9_-]/gi, "");
  const dir = path.join(musicRoot(), safe);
  await fsp.mkdir(dir, { recursive: true }).catch(() => {});
  let names = [];
  try { names = await fsp.readdir(dir); } catch { /* vacío */ }
  return names.filter((n) => AUDIO_EXT.test(n) && !n.startsWith(".")).sort()
    .map((n) => ({ title: n.replace(AUDIO_EXT, ""), url: "app://george/file/" + encodeURIComponent(path.join(dir, n)) }));
}
const osa = (script) => (isMac ? run("osascript", ["-e", script]) : Promise.resolve({ ok: false, stdout: "" }));
const quote = (s) => String(s).replace(/[\\"]/g, "\\$&");
async function appleMusic({ action, playlist, term }) {
  if (action === "playlist") {
    const r = await osa(`tell application "Music"
      if exists playlist "${quote(playlist)}" then
        set shuffle enabled to true
        play playlist "${quote(playlist)}"
        return "ok"
      end if
      return "missing"
    end tell`);
    return r.stdout.trim() === "ok";
  }
  if (action === "pause") return (await osa('tell application "Music" to pause')).ok;
  if (action === "search") { await shell.openExternal("music://music.apple.com/search?term=" + encodeURIComponent(term)); return true; }
  return false;
}

// ---------- Arranque ----------
function registerProtocol() {
  const root = __dirname;
  const inside = (base, p) => { const r = path.resolve(base, p); return r === base || r.startsWith(base + path.sep) ? r : null; };
  protocol.handle("app", async (req) => {
    const url = new URL(req.url);
    const p = decodeURIComponent(url.pathname);
    let file = null;
    if (p.startsWith("/ui/")) file = inside(path.join(root, "ui"), p.slice(4));
    else if (p.startsWith("/vendor/tasks-vision/")) file = inside(path.join(root, "node_modules", "@mediapipe", "tasks-vision"), p.slice(21));
    else if (p.startsWith("/models/")) file = inside(modelsDir(), p.slice(8));
    else if (p.startsWith("/file/")) {
      // Solo música de la carpeta ~/Music/George.
      const abs = path.resolve(decodeURIComponent(p.slice(6)));
      if (abs.startsWith(musicRoot() + path.sep) && AUDIO_EXT.test(abs)) file = abs;
    }
    if (!file) return new Response("No encontrado", { status: 404 });
    try { return await net.fetch(pathToFileURL(file).toString(), { headers: req.headers }); }
    catch { return new Response("No encontrado", { status: 404 }); }
  });
}

function registerIpc() {
  ipcMain.handle("store:get", (_e, name) => (STORES.has(name) ? readStore(name) : null));
  ipcMain.handle("store:set", (_e, name, data) => { if (STORES.has(name)) writeStore(name, data); return true; });
  ipcMain.handle("apps:list", () => listApps());
  ipcMain.handle("apps:open", async (_e, p) => {
    const apps = await listApps();
    if (!apps.some((a) => a.path === p)) return false; // solo apps de la lista
    return (await shell.openPath(p)) === "";
  });
  ipcMain.handle("sys:openUrl", (_e, url) => (/^https?:\/\//.test(url) ? shell.openExternal(url).then(() => true) : false));
  ipcMain.handle("sys:info", async () => ({
    platform: process.platform, user: os.userInfo().username, host: os.hostname(),
    ramGB: Math.round(os.totalmem() / 2 ** 30), version: app.getVersion(),
    whisper: Boolean(findWhisper() && findWhisperModel()),
    faceModel: fs.existsSync(path.join(modelsDir(), "face_landmarker.task")),
    loginItem: app.getLoginItemSettings().openAtLogin, hotkey: HOTKEY, musicRoot: musicRoot(),
  }));
  ipcMain.handle("sys:volume", (_e, v) => osa(`set volume output volume ${Math.max(0, Math.min(100, Math.round(v)))}`).then((r) => r.ok));
  ipcMain.handle("sys:battery", async () => {
    if (!isMac) return null;
    const m = (await run("pmset", ["-g", "batt"])).stdout.match(/(\d+)%;\s*([a-z ]+);/i);
    return m ? { percent: Number(m[1]), state: m[2].trim() } : null;
  });
  ipcMain.handle("tts:voices", () => listVoices());
  ipcMain.handle("tts:synth", (_e, a) => synth(a));
  ipcMain.handle("stt:transcribe", (_e, a) => transcribe(a));
  ipcMain.handle("llm:status", async () => { await startOllama(); return ollamaStatus(); });
  ipcMain.on("llm:chat", (e, a) => { chat(e.sender, a); });
  ipcMain.on("llm:abort", (_e, id) => chats.get(id)?.abort());
  ipcMain.handle("screen:grab", (_e, w) => grabScreen(w).catch(() => null));
  ipcMain.handle("music:list", (_e, id) => listMusic(id));
  ipcMain.handle("music:openFolder", async (_e, id) => {
    const dir = path.join(musicRoot(), String(id).replace(/[^a-z0-9_-]/gi, ""));
    await fsp.mkdir(dir, { recursive: true });
    return shell.openPath(dir);
  });
  ipcMain.handle("music:apple", (_e, a) => appleMusic(a));
  ipcMain.handle("app:themes", (_e, on) => setThemesEnabled(Boolean(on)));
  ipcMain.handle("app:loginItem", (_e, on) => { app.setLoginItemSettings({ openAtLogin: Boolean(on) }); buildTray(); return true; });
  ipcMain.handle("app:hide", (e) => BrowserWindow.fromWebContents(e.sender)?.hide());
  ipcMain.handle("app:quit", () => { quitting = true; app.quit(); });
  ipcMain.on("theme:changed", () => buildTray());
  ipcMain.handle("media:ask", async (_e, kind) => {
    if (!isMac) return true;
    if (kind === "screen") return systemPreferences.getMediaAccessStatus("screen") === "granted";
    return systemPreferences.askForMediaAccess(kind);
  });
}

app.on("second-instance", summonGeorge);
app.on("window-all-closed", () => { /* George sigue en la barra de menús */ });
app.on("before-quit", () => { quitting = true; });
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("activate", () => { if (settings().themesEnabled !== false) createShell(); else createPanel(true); });

app.whenReady().then(() => {
  registerProtocol();
  registerIpc();
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(["media", "mediaKeySystem", "fullscreen"].includes(perm)));
  session.defaultSession.setPermissionCheckHandler((_wc, perm) => ["media", "fullscreen"].includes(perm));

  const s = settings();
  if (s.firstRunDone !== true) {
    // La primera vez queda puesto para abrirse solo al encender la Mac.
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true });
    writeStore("settings", { ...s, firstRunDone: true });
  }
  buildTray();
  globalShortcut.register(HOTKEY, summonGeorge);
  if (s.themesEnabled === false) createPanel(!app.getLoginItemSettings().wasOpenedAtLogin);
  else createShell();
  startOllama();
});
