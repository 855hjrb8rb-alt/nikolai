// Voz: reconocimiento (micrófono → texto), síntesis por frases (texto → voz)
// y medidor del micrófono para el visualizador. Usa la Web Speech API
// (mejor soporte en Chrome y Edge).

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const speechSupported = Boolean(Recognition);

const UA = navigator.userAgent || "";
export const isMobile = /Android|iPhone|iPad|iPod/i.test(UA) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(UA));
export const isIOS = /iPhone|iPad|iPod/i.test(UA) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(UA));
/** Navegadores dentro de otras apps (WhatsApp, Instagram, Facebook…) suelen bloquear micrófono y cámara. */
export const inAppBrowser = /FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat|TikTok|musical_ly|; wv\)|GSA\//i.test(UA);
export const isBrave = Boolean(navigator.brave);

const WAKE_WORDS = ["nikolai", "nicolai", "nikolay", "nicolás", "nicolas", "jarvis", "ニコライ", "尼古拉", "николай"];

/** Busca la palabra clave y devuelve lo que viene después, o null si no está. */
export function stripWakeWord(text) {
  const lower = text.toLowerCase();
  const w = WAKE_WORDS.find((k) => lower.includes(k));
  if (!w) return null;
  return text.slice(lower.indexOf(w) + w.length).replace(/^[\s,.:;!?¡¿]+/, "");
}

// ---------- Reconocimiento ----------
export class Listener {
  constructor() {
    this.lang = "es-ES";
    this.rec = null;
  }

  /** Escucha una frase. Llama a onInterim mientras hablas y a onFinal con el texto. */
  listen({ onInterim, onFinal, onEnd, onError, onSound }) {
    this.stop();
    if (!Recognition) return false;
    const rec = new Recognition();
    rec.lang = this.lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let finalText = "", lastInterim = "";
    rec.onspeechstart = () => onSound?.(true);
    rec.onspeechend = () => onSound?.(false);
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      lastInterim = (finalText + interim).trim();
      onInterim?.(lastInterim);
    };
    rec.onerror = (e) => onError?.(e.error);
    rec.onend = () => {
      if (this.rec === rec) this.rec = null;
      // Algunos Android terminan sin marcar el resultado como final: usamos lo último oído.
      const text = finalText.trim() || lastInterim;
      if (text) onFinal?.(text);
      onEnd?.(Boolean(text));
    };
    this.rec = rec;
    try { rec.start(); } catch { return false; }
    return true;
  }

  stop() {
    const rec = this.rec;
    this.rec = null;
    if (rec) {
      rec.onend = null;
      rec.onresult = null;
      try { rec.abort(); } catch { /* ya detenido */ }
    }
  }
}

// ---------- Síntesis por frases ----------
// Habla cada frase en cuanto llega del streaming, sin esperar a la respuesta completa.
export class Speaker {
  constructor() {
    this.voiceName = "";
    this.lang = "es-ES";
    this.rate = 1;
    this.pitch = 1;
    this.gender = "female";
    this.buffer = "";
    this.pending = 0;
    this.closed = true;
    this.onStart = null;
    this.onIdle = null;
    this.gen = 0; // invalida callbacks de frases canceladas
  }

  /** Empieza una respuesta nueva. */
  begin() {
    this.cancel();
    this.closed = false;
  }

  push(delta) {
    this.buffer += delta;
    // Corta en el último fin de frase si ya hay texto suficiente.
    const re = /[.!?。！？…\n](\s|$)/g;
    let cut = -1, m;
    while ((m = re.exec(this.buffer))) cut = m.index + 1;
    if (cut > 0 && cut >= 24) {
      this.#say(this.buffer.slice(0, cut));
      this.buffer = this.buffer.slice(cut);
    }
  }

  /** No llegará más texto: habla lo que queda. */
  end() {
    if (this.buffer.trim()) this.#say(this.buffer);
    this.buffer = "";
    this.closed = true;
    if (this.pending === 0) this.onIdle?.();
  }

  /** Dice un texto completo de una vez. */
  say(text, lang) {
    this.begin();
    this.#say(text, lang);
    this.closed = true;
    if (this.pending === 0) this.onIdle?.();
  }

  cancel() {
    this.buffer = "";
    this.pending = 0;
    this.closed = true;
    this.gen++;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }

  get speaking() {
    return this.pending > 0;
  }

  #say(text, lang = this.lang) {
    const clean = text
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/\$\$?([^$]+)\$\$?/g, (_, f) => f.replace(/\\[a-z]+/gi, " ").replace(/[{}^_]/g, " "))
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[*_#`>|~]/g, "")
      .replace(/\p{Extended_Pictographic}/gu, "")
      .trim();
    if (!clean || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = lang;
    u.rate = this.rate;
    u.pitch = this.pitch;
    const voice = pickVoice(lang, this.voiceName, this.gender);
    if (voice) u.voice = voice;
    this.pending++;
    const gen = this.gen;
    u.onstart = () => gen === this.gen && this.onStart?.();
    u.onend = u.onerror = () => {
      if (gen !== this.gen) return;
      this.pending = Math.max(0, this.pending - 1);
      if (this.pending === 0 && this.closed) this.onIdle?.();
    };
    speechSynthesis.speak(u);
  }
}

// Nombres habituales de voces del sistema (Windows/Edge, Chrome, macOS/iOS, Android).
const FEMALE = /(female|mujer|woman|helena|laura|sabina|elvira|dalia|paloma|m[oó]nica|paulina|luc[ií]a|camila|ximena|isabela|elsa|zira|aria|jenny|samantha|victoria|karen|moira|tessa|fiona|catherine|am[eé]lie|marie|anna|alice|francisca|catalina|valentina|renata|larissa|abril|beatriz|triana|irene|vera|salome|salom[eé]|marisol|esperanza|google espa[nñ]ol|denise|vivienne|katja|elsa|isabella|nanami|xiaoxiao|sun-hi|svetlana|zariyah|swara|emma|ava|michelle|sonia|libby|natasha|clara|sofia|sof[ií]a)/i;
const MALE = /(\bmale\b|hombre|jorge|pablo|[aá]lvaro|ra[uú]l|diego|enrique|juan|carlos|jos[eé]|gerardo|tom[aá]s|liam|guy|david|mark|george|daniel|alex\b|fred|ryan|henri|thomas|antonio|dar[ií]o|emilio|lorenzo|gonzalo|nuno|cristiano|conrad|diego|keita|yunxi|injoon|dmitry|madhur|hamed|andrew|brian|christopher|eric|roger|steffan|alvaro|federico|jorge)/i;

export function voiceGender(v) {
  if (FEMALE.test(v.name)) return "female";
  if (MALE.test(v.name)) return "male";
  return "unknown";
}

export function voiceQuality(v) {
  if (/natural|neural|online|premium|enhanced|wavenet|siri/i.test(v.name)) return 3; // las más naturales
  if (/google/i.test(v.name)) return 2;
  return v.localService === false ? 2 : 1;
}

/** Voces disponibles para un idioma, de mejor a peor, priorizando el género elegido. */
export function voicesFor(lang, gender = "any") {
  if (!("speechSynthesis" in window)) return [];
  const base = lang.slice(0, 2);
  return speechSynthesis
    .getVoices()
    .filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(base))
    .filter((v) => gender === "any" || voiceGender(v) === gender)
    .sort((a, b) => voiceScore(b, lang, gender) - voiceScore(a, lang, gender));
}

function voiceScore(v, lang, gender) {
  let s = voiceQuality(v) * 2;
  if (v.lang.replace("_", "-") === lang) s += 1;
  if (gender !== "any" && voiceGender(v) === gender) s += 3;
  return s;
}

function pickVoice(lang, preferredName, gender) {
  const all = voicesFor(lang);
  return all.find((v) => v.name === preferredName) || voicesFor(lang, gender)[0] || all[0] || null;
}

if ("speechSynthesis" in window) {
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener?.("voiceschanged", () => speechSynthesis.getVoices());
}

// ---------- Medidor del micrófono ----------
export class MicMeter {
  constructor() {
    this.analyser = null;
    this.data = null;
  }

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 128;
    this.analyser.smoothingTimeConstant = 0.75;
    src.connect(this.analyser);
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
  }

  /** Bandas de frecuencia normalizadas 0..1. */
  bands() {
    if (!this.analyser) return null;
    this.analyser.getByteFrequencyData(this.data);
    return this.data;
  }

  level() {
    const d = this.bands();
    if (!d) return 0;
    let sum = 0;
    for (let i = 2; i < 40; i++) sum += d[i];
    return sum / (38 * 255);
  }
}
