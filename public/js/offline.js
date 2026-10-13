// Modo sin conexión: una NIKOLAI básica que responde sin internet con lo que hay
// en el dispositivo (hora, notas, recuerdos, temporizador, cuentas, clima guardado…)
// y guarda las preguntas que necesitan a Claude para responderlas al volver la conexión.

const PENDING_KEY = "nikolai.pending";

export const offline = {
  pending: (() => { try { return JSON.parse(localStorage.getItem(PENDING_KEY)) || []; } catch { return []; } })(),
  prepared: (() => { try { return JSON.parse(localStorage.getItem("nikolai.offlinePack")) || null; } catch { return null; } })(),
  progress: null, // {done, total, failed, bytes, finished}
};

const savePending = () => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(offline.pending.slice(-20))); } catch { /* lleno */ } };
export function addPending(text) { offline.pending.push({ text, at: Date.now() }); savePending(); }
export function takePending() { const list = offline.pending.splice(0); savePending(); return list; }
export function removePending(i) { offline.pending.splice(i, 1); savePending(); }
export function markPrepared(info) {
  offline.prepared = { ...info, at: Date.now() };
  try { localStorage.setItem("nikolai.offlinePack", JSON.stringify(offline.prepared)); } catch { /* lleno */ }
}

export const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

// ---------- Utilidades de texto ----------
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;:"«»()]/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(("el la los las un una unos unas de del al a y o que en mi mis me te tu tus su sus es son se lo le les por para con como cual cuales cuando donde quien quienes " +
  "que cuanto cuantos nikolai dime sabes recuerdas oye hola favor porfa the a an of to is are my your what who when where which how do does did you me").split(" "));
const keywords = (s) => norm(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w));

const NUM_WORDS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, media: 0.5 };
const toNumber = (w) => (w in NUM_WORDS ? NUM_WORDS[w] : Number(String(w).replace(",", ".")));

/** Convierte «cuánto es 15 por 3 más 2» en «15*3+2». */
function spokenMath(s) {
  return norm(s)
    .replace(/\b(cuanto es|calcula|cuanto da|how much is|calculate)\b/g, " ")
    .replace(/\bmas\b|\bplus\b/g, "+").replace(/\bmenos\b|\bminus\b/g, "-")
    .replace(/\b(por|multiplicado por|veces|times|x)\b/g, "*").replace(/\b(entre|dividido entre|dividido por|divided by)\b/g, "/")
    .replace(/\b(elevado a|a la potencia)\b/g, "^").replace(/\braiz cuadrada de\b|\bsquare root of\b/g, "√")
    .replace(/\bpor ciento\b|\bpercent\b/g, "%")
    .replace(/[a-z]+/g, (w) => (w in NUM_WORDS ? String(NUM_WORDS[w]) : " "))
    .replace(/\s+/g, "");
}

const MODULE_WORDS = {
  notes: ["nota", "notas"], memory: ["memoria", "recuerdo", "recuerdos"], tools: ["calculadora", "temporizador", "herramienta", "herramientas", "cronometro"],
  weather: ["clima", "tiempo"], news: ["noticia", "noticias"], markets: ["bolsa", "acciones", "cripto", "mercado"], music: ["musica", "spotify"],
  homework: ["tarea", "tareas"], chat: ["chat"], profile: ["perfil"], system: ["sistema", "diagnostico"], sos: ["emergencia", "sos"],
  language: ["idioma", "idiomas"], lobby: ["sala", "relojes", "hotel", "playa"], bots: ["bot", "bots", "trading", "minar", "mineria"], map: ["mapa", "maps", "google maps", "satelite", "street view"], watch: ["netflix", "prime", "pelicula", "serie", "ver juntos"], studio: ["estudio", "foto", "fotos", "video", "videos", "editar"], persona: ["personalidad", "personalidades", "abogado", "amiga", "videollamada"], work: ["trabajo", "curriculum", "entrevista"], projects: ["proyecto", "proyectos"], money: ["dinero", "millonario", "presupuesto", "ahorro", "habitos"], voice: ["voz", "voces"], translator: ["traductor"], offline: ["conexion", "offline"],
};

/**
 * Responde sin internet. ctx da acceso a los datos y acciones de la app:
 * { t, lang, notes, addNote, memories, memoryEnabled, addMemory, forget, startTimer, calc, weather, weatherSentence,
 *   open, dial, emergencyNumber, profileName, salutation }
 * Devuelve { reply, queued }.
 */
export function localAnswer(text, ctx) {
  const t = ctx.t;
  const q = norm(text);
  const now = new Date();
  const fmtTime = () => now.toLocaleTimeString(ctx.lang, { hour: "numeric", minute: "2-digit" });

  if (/^(hola|buenos dias|buenas tardes|buenas noches|hey|hi|hello)\b/.test(q)) {
    return { reply: `${ctx.salutation()}${ctx.profileName ? ", " + ctx.profileName : ""}. ${t("offHello")}` };
  }
  if (/\b(emergencia|ayuda urgente|llama al 911|auxilio|emergency)\b/.test(q)) {
    ctx.open("sos");
    ctx.dial(ctx.emergencyNumber);
    return { reply: t("offEmergency").replace("{n}", ctx.emergencyNumber) };
  }
  if (/\b(que hora|hora es|what time)\b/.test(q)) return { reply: t("offTime").replace("{time}", fmtTime()) };
  if (/\b(que dia|que fecha|fecha de hoy|dia es hoy|what day|date today)\b/.test(q)) {
    return { reply: t("offDate").replace("{date}", now.toLocaleDateString(ctx.lang, { weekday: "long", day: "numeric", month: "long", year: "numeric" })) };
  }
  let m = /\b(temporizador|alarma|timer|cronometro|avisame en|recuerdame en)\b.*?(\d+(?:[.,]\d+)?|un|una|dos|tres|cuatro|cinco|diez|quince|veinte|treinta|cuarenta|cincuenta|sesenta|media)\s*(segundos?|seg|minutos?|min|horas?|hora|seconds?|minutes?|hours?)/.exec(q);
  if (m) {
    const n = toNumber(m[2]);
    const unit = m[3].startsWith("h") ? 3600 : m[3].startsWith("s") ? 1 : 60;
    const secs = Math.max(5, Math.round(n * unit));
    ctx.startTimer(secs);
    return { reply: t("offTimer").replace("{n}", m[2]).replace("{u}", m[3]) };
  }
  if (/\b(cuanto es|calcula|cuanto da|how much is|calculate)\b/.test(q)) {
    try { return { reply: t("offCalc").replace("{r}", String(ctx.calc(spokenMath(text)))) }; } catch { /* sigue */ }
  }
  m = /^(apunta|anota|toma nota|nota|note|write down)\s+(que\s+)?(.+)/.exec(q);
  if (m) { ctx.addNote(text.replace(/^\s*\S+\s+(que\s+)?/i, "")); return { reply: t("noteSaved") }; }
  if (/\b(lee|leeme|cuales son|read)\b.*\bnotas?\b/.test(q)) {
    return { reply: ctx.notes.length ? `${t("offNotes")} ${ctx.notes.slice(0, 5).join(". ")}.` : t("noNotes") };
  }
  m = /^recuerda que\s+(.+)/i.exec(text.trim()) || /^remember that\s+(.+)/i.exec(text.trim());
  if (m) {
    if (!ctx.memoryEnabled) return { reply: t("memOff") };
    ctx.addMemory(m[1]);
    return { reply: t("offRemembered") };
  }
  m = /^(olvida|forget)\s+(lo de\s+)?(.+)/.exec(q);
  if (m) return { reply: ctx.forget(m[3]) ? t("offForgot") : t("offForgetNone") };
  if (/\b(clima|tiempo hace|temperatura|llover|lluvia|llueve|weather|rain)\b/.test(q)) {
    if (!ctx.weather?.data) return { reply: t("offNoWeather") };
    const age = Math.round((Date.now() - (ctx.weather.at || Date.now())) / 3600000);
    return { reply: `${ctx.weatherSentence()}${age >= 1 ? " " + t("offWeatherAge").replace("{h}", age) : ""}` };
  }
  m = /\b(abre|abrir|muestra|ensename|ve a|open|show)\b\s+(el |la |los |las |mi |mis |the )?(\w+)/.exec(q);
  if (m) {
    const id = Object.keys(MODULE_WORDS).find((k) => MODULE_WORDS[k].some((w) => m[3].startsWith(w)));
    if (id) { ctx.open(id); return { reply: t("offOpened") }; }
  }
  // Preguntas sobre el usuario: buscar en sus recuerdos y notas.
  const kw = keywords(text);
  if (kw.length && (ctx.memories.length || ctx.notes.length)) {
    const pool = [...ctx.memories.map((x) => ({ x, w: 2 })), ...ctx.notes.map((x) => ({ x, w: 1 }))];
    let best = null, score = 0;
    for (const { x, w } of pool) {
      const hay = norm(x);
      const s = kw.filter((k) => hay.includes(k.slice(0, Math.max(4, k.length - 2)))).length * w;
      if (s > score) { score = s; best = x; }
    }
    if (best && score >= 2) return { reply: t("offFromMemory").replace("{m}", best.replace(/^\[[^\]]+\]\s*/, "")) };
  }
  return { reply: t("offQueued"), queued: true };
}
