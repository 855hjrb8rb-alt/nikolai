// El cerebro de George: un modelo de lenguaje que corre en tu propia Mac (Ollama), con
// memoria guardada en disco. Sin internet. Las órdenes sencillas (estilo, nieve, música,
// abrir apps) se entienden aquí mismo para que respondan al instante aunque no haya modelo.
import { mac, Store } from "./bridge.js";
import { THEMES, findTheme } from "./themes.js";

const PREFERRED = ["gemma3:27b", "gemma3:12b", "gemma3:4b", "qwen2.5vl", "llama3.2-vision", "llava", "gemma3", "qwen3", "llama3.3", "llama3.2", "mistral"];
const TAG = /\[\[\s*(tema|nieve|musica|música|abrir|recordar|olvidar)\s*:\s*([^\]]*?)\s*\]\]/gi;

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export class Brain {
  /** host: lo que George puede hacer en el escritorio (ver app.js). */
  constructor(host) {
    this.host = host;
    this.memory = new Store("memory", { facts: [], owner: "" });
    this.history = new Store("history", []);
    this.model = ""; this.models = []; this.online = false; this.vision = true;
    this.current = null; this.watched = [];
  }
  async init(preferredModel) {
    await Promise.all([this.memory.load(), this.history.load()]);
    await this.refresh(preferredModel);
  }
  async refresh(preferredModel) {
    const st = await mac.llm.status().catch(() => ({ ok: false, models: [] }));
    this.online = st.ok && st.models.length > 0;
    this.models = st.models.filter((m) => !/embed/i.test(m));
    const want = preferredModel || this.model;
    this.model = this.models.includes(want) ? want
      : PREFERRED.map((p) => this.models.find((m) => m.startsWith(p))).find(Boolean) || this.models[0] || "";
    return this.online;
  }

  // ---------- memoria ----------
  remember(text) {
    const t = text.trim().replace(/\s+/g, " ");
    if (t.length < 3) return false;
    const facts = this.memory.data.facts;
    if (facts.some((f) => norm(f.text) === norm(t))) return false;
    facts.push({ text: t, at: Date.now() });
    if (facts.length > 400) facts.splice(0, facts.length - 400);
    this.memory.save();
    return true;
  }
  forget(text) {
    const q = norm(text).split(/\s+/).filter((w) => w.length > 3);
    const before = this.memory.data.facts.length;
    this.memory.data.facts = this.memory.data.facts.filter((f) => !q.length || !q.every((w) => norm(f.text).includes(w)));
    this.memory.save();
    return before - this.memory.data.facts.length;
  }
  forgetAt(i) { this.memory.data.facts.splice(i, 1); this.memory.save(); }
  clearHistory() { this.history.data.length = 0; this.history.save(); }
  pushHistory(role, content) {
    this.history.data.push({ role, content, at: Date.now() });
    if (this.history.data.length > 200) this.history.data.splice(0, this.history.data.length - 200);
    this.history.save();
  }

  system() {
    const h = this.host, now = new Date();
    const facts = this.memory.data.facts.slice(-120).map((f) => `- ${f.text}`).join("\n") || "- (todavía nada)";
    return `Eres George, el asistente personal que vive dentro de la Mac de tu usuario. Tu estilo es el de un mayordomo
inteligente de película: educado, sereno, ingenioso, con humor seco y leal. Tratas al usuario con respeto y cercanía.
No eres JARVIS ni ningún otro personaje: eres George.

Cómo respondes:
- Siempre en el idioma en que te hablen. Dominas muchos idiomas, también antiguos (latín, griego antiguo, náhuatl clásico,
  egipcio, sánscrito, hebreo bíblico, nórdico antiguo…): puedes traducir, explicar y conversar en ellos.
- Tus respuestas se dicen en voz alta: sé breve y natural (1 a 4 frases), sin listas ni markdown, salvo que te pidan detalle.
- Tienes opiniones propias sobre películas, música, libros y la vida, y las das con gusto y con argumentos.
- Si no sabes algo o no tienes internet para comprobarlo, dilo con franqueza. Funcionas sin internet.
- Si recibes una imagen, es lo que ves ahora mismo: la cámara (al usuario) o la pantalla (lo que están viendo juntos).
  Coméntala con naturalidad; no describas de más ni identifiques a personas reales por su cara.

Lo que puedes hacer en la Mac (escribe la etiqueta al final de tu respuesta; el usuario no la ve):
- Cambiar el estilo del escritorio: [[tema:ID]] con ID uno de: ${THEMES.map((t) => `${t.id} (${t.name})`).join(", ")}.
- Nieve: [[nieve:on]] o [[nieve:off]].  Música: [[musica:play]], [[musica:pause]], [[musica:next]].
- Abrir una app: [[abrir:Nombre de la app]].
- Guardar en tu memoria algo duradero sobre el usuario (gustos, nombres, fechas, planes): [[recordar:dato en una frase]].
  Úsala cuando te cuente algo que valga la pena recordar. Para borrar: [[olvidar:palabras del dato]].

Ahora: ${now.toLocaleString("es", { dateStyle: "full", timeStyle: "short" })}. Estilo actual: ${h.themeName()}.
Nieve: ${h.snow() ? "encendida" : "apagada"}. Música: ${h.musicState()}.${h.cameraOn() ? " La cámara está encendida: puedes ver al usuario." : ""}${h.cinemaOn() ? " Modo cine: estás viendo la pantalla con el usuario." : ""}

Lo que recuerdas del usuario:
${facts}`;
  }

  // ---------- órdenes que se entienden sin modelo ----------
  local(text) {
    const t = norm(text), h = this.host;
    let m;
    if (/(quita|apaga|desactiva|sin|remove|turn off|disable)\b.*\b(los estilos|todos los estilos|temas|themes)/.test(t)) { h.themesOff(); return "Estilos desactivados. Yo sigo aquí, a un atajo de distancia."; }
    if (/(quita|apaga|para|deten|sin|remove|stop|turn off|no more)\b.*\b(nieve|nevar|snow)/.test(t)) { h.setSnow(false); return "Nieve fuera. Despejado."; }
    if (/(pon|activa|enciende|quiero|haz|que|let it|turn on|make it)\b.*\b(nieve|nieva|nevar|snow)/.test(t)) { h.setSnow(true); return "Que nieve, entonces."; }
    if (/(pausa|para|deten|quita|apaga|calla|silencia|stop|pause)\b.*\b(musica|cancion|music|song)/.test(t)) { h.music("pause"); return "Música en pausa."; }
    if (/(siguiente|otra|cambia|next|skip)\b.*\b(cancion|musica|pista|song|track)/.test(t)) { h.music("next"); return "Siguiente."; }
    if (/(pon|toca|reproduce|sube|play|quiero)\b.*\b(musica|cancion|music|soundtrack|banda sonora)/.test(t) && !findTheme(t)) { h.music("play"); return "Música, maestro."; }
    if (/(estilo|tema|theme|style|modo|ambiente|interfaz|fondo)/.test(t) || (/^(pon|cambia|activa|usa|quiero|switch|set)\b/.test(t) && t.split(" ").length <= 7)) {
      const th = findTheme(t);
      if (th && !/(pelicula|movie|opinas|piensas|cuentame|quien|que es)/.test(t)) { h.setTheme(th.id); return th.greet; }
    }
    if ((m = t.match(/^(?:por favor )?(?:abre|abrir|abreme|lanza|inicia|open|launch)\s+(?:la app |el |la |the )?(.+?)[.!]?$/))) {
      const app = h.openApp(m[1]);
      return app ? `Abriendo ${app}.` : `No encuentro ninguna app llamada «${m[1]}».`;
    }
    if ((m = text.match(/^\s*(?:george[, ]*)?(?:recuerda|acu[eé]rdate(?: de)?|no olvides|remember)(?:\s+que|\s+that)?\s+(.{4,})$/i))) {
      this.remember(m[1].replace(/[.!]+$/, "")); return "Anotado. No se me olvidará.";
    }
    if (/(modo cine|veamos|vamos a ver|ver una peli|watch.*(movie|film)|mira.*(conmigo|pantalla))/.test(t)) { h.cinema(true); return "Modo cine. Apago las luces y me siento a su lado; comentaré lo justo."; }
    if (/(sal|salir|quita|termina|apaga|stop).*(modo cine|cine)/.test(t)) { h.cinema(false); return "Fin de la función."; }
    if (/(enciende|prende|activa|turn on).*(camara|camera)|^mirame/.test(t)) { h.camera(true); return "Cámara encendida. Ya le veo."; }
    if (/(apaga|quita|desactiva|turn off).*(camara|camera)/.test(t)) { h.camera(false); return "Cámara apagada."; }
    return null;
  }

  /** Respuestas mínimas cuando todavía no hay modelo instalado. */
  offline(text) {
    const t = norm(text), now = new Date();
    if (/que hora|what time|hora es/.test(t)) return `Son las ${now.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}.`;
    if (/que dia|fecha|what day|date/.test(t)) return `Hoy es ${now.toLocaleDateString("es", { dateStyle: "full" })}.`;
    if (/^(hola|buenas|hey|hello|hi)\b/.test(t)) return "Hola. Estoy en modo básico: puedo cambiar estilos, nieve, música y abrir apps. Para conversar de verdad falta instalar mi cerebro local; lo explico en Ajustes.";
    return "Todavía no tengo instalado mi cerebro local, así que solo entiendo órdenes del escritorio: estilos, nieve, música y abrir apps. En Ajustes → George están los pasos para activarlo (es un solo comando).";
  }

  stop() { this.current?.abort(); this.current = null; }

  /**
   * Responde a un mensaje. onText recibe el texto visible acumulado; onSentence, cada frase
   * terminada (para decirla en voz alta mientras sigue pensando).
   */
  async ask(text, { images = [], onText = () => {}, onSentence = () => {}, silent = false } = {}) {
    this.stop();
    if (!silent) {
      const quick = this.local(text);
      if (quick) { this.pushHistory("user", text); this.pushHistory("assistant", quick); onText(quick); onSentence(quick); return quick; }
    }
    if (!this.online && !(await this.refresh())) {
      const r = this.offline(text);
      if (!silent) { this.pushHistory("user", text); this.pushHistory("assistant", r); }
      onText(r); onSentence(r); return r;
    }
    const past = this.history.data.slice(-16).map(({ role, content }) => ({ role, content }));
    const user = { role: "user", content: text };
    if (images.length && this.vision) user.images = images;
    const messages = [{ role: "system", content: this.system() }, ...past, user];

    let raw = "", spoken = 0;
    const visible = () => raw.replace(TAG, "").replace(/\[\[[^\]]*$/, "").replace(/<think>[\s\S]*?(<\/think>|$)/g, "").replace(/[ \t]{2,}/g, " ").trimStart();
    const flush = (final) => {
      const v = visible(); onText(v);
      const rest = v.slice(spoken);
      const re = /[^.!?…。！？\n]+[.!?…。！？\n]+["»”)]?\s*/g; let m, end = 0;
      while ((m = re.exec(rest))) { if (m[0].trim().length > 1) onSentence(m[0].trim()); end = re.lastIndex; }
      spoken += end;
      if (final && v.slice(spoken).trim()) { onSentence(v.slice(spoken).trim()); spoken = v.length; }
    };
    try {
      const job = this.current = mac.llm.chat({ model: this.model, messages }, (chunk) => { raw += chunk; flush(false); });
      await job.done;
    } catch (e) {
      if (user.images && /image|vision|multimodal/i.test(String(e.message))) { this.vision = false; return this.ask(text, { onText, onSentence, silent }); }
      this.online = false;
      const r = raw ? visible() : "Mi cerebro local no responde. ¿Está Ollama abierto? Lo reintento en cuanto me hable de nuevo.";
      onText(r); if (!raw) onSentence(r); return r;
    } finally { this.current = null; }
    flush(true);
    // acciones pedidas por el modelo
    for (const [, kind, val] of raw.matchAll(TAG)) this.act(kind.toLowerCase(), val);
    const answer = visible().trim();
    if (!silent && answer) { this.pushHistory("user", text); this.pushHistory("assistant", answer); }
    return answer;
  }
  act(kind, val) {
    const h = this.host, v = norm(val);
    if (kind === "tema") { const th = THEMES.find((t) => t.id === v) || findTheme(v); if (th) h.setTheme(th.id); }
    else if (kind === "nieve") h.setSnow(/on|si|enc/.test(v));
    else if (kind.startsWith("m")) h.music(/pause|pausa|stop/.test(v) ? "pause" : /next|sig/.test(v) ? "next" : "play");
    else if (kind === "abrir") h.openApp(val);
    else if (kind === "recordar") { if (this.remember(val)) h.note("Guardado en memoria: " + val); }
    else if (kind === "olvidar") this.forget(val);
  }

  /** Modo cine: mira la pantalla y, si hay algo que decir, lo comenta en una frase. */
  async watch(image, opts) {
    const seen = this.watched.slice(-4).join(" | ");
    const prompt = `(Modo cine) Esta es la pantalla ahora mismo; estamos viendo algo juntos.${seen ? ` Antes comentaste: ${seen}.` : ""} ` +
      "Haz un único comentario breve y con personalidad, como un amigo que ve la película a tu lado (una frase, sin spoilers ni descripciones obvias). " +
      "Si la imagen no muestra una película o serie, o no hay nada interesante que decir, responde solo «…».";
    const r = await this.ask(prompt, { ...opts, images: [image], silent: true });
    if (r && !/^[.…\s]*$/.test(r)) { this.watched.push(r.slice(0, 120)); this.pushHistory("assistant", r); return r; }
    return "";
  }
}
