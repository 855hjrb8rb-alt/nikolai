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
    // Sin internet, los navegadores que lo permiten reconocen la voz en el propio dispositivo.
    // Solo si el usuario activó antes la voz sin internet (función experimental de Chrome).
    if (navigator.onLine === false && offlineSpeechReady() && "processLocally" in rec) rec.processLocally = true;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let finalText = "", lastInterim = "", delivered = false, silence = null;
    // Entrega la frase en cuanto está lista, sin esperar a que el navegador cierre el micrófono:
    // en algunos Android ese aviso llega muy tarde o nunca, y la frase se quedaba sin enviar.
    const deliver = (text) => {
      if (delivered) return;
      delivered = true;
      clearTimeout(silence);
      rec.onend = null;
      if (this.rec === rec) this.rec = null;
      try { rec.stop(); } catch { /* ya detenido */ }
      if (text) onFinal?.(text);
      onEnd?.(Boolean(text));
    };
    rec.onspeechstart = () => onSound?.(true);
    rec.onspeechend = () => onSound?.(false);
    rec.onresult = (e) => {
      let interim = "";
      finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      lastInterim = (finalText + interim).trim();
      onInterim?.(lastInterim);
      clearTimeout(silence);
      if (finalText.trim() && !interim.trim()) deliver(finalText.trim());
      // Si el texto deja de cambiar 1,6 s, se da por terminada la frase.
      else silence = setTimeout(() => deliver(lastInterim), 1600);
    };
    rec.onerror = (e) => onError?.(e.error);
    rec.onend = () => {
      if (this.rec === rec) this.rec = null;
      if (!delivered) deliver(finalText.trim() || lastInterim);
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
    // Voz premium (ElevenLabs) con la clave del usuario: {key, voiceId, model, fx}
    this.premium = null;
    this.chain = Promise.resolve();
    this.source = null;
    this.onPremiumError = null;
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
    this.chain = Promise.resolve();
    try { this.source?.stop(); } catch { /* ya parado */ }
    this.source = null;
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
    if (!clean) return;
    if (this.premium?.key && this.premium.voiceId && navigator.onLine !== false) return this.#sayPremium(clean, lang);
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = lang;
    u.rate = this.rate;
    u.pitch = this.pitch;
    const voice = pickVoice(lang, this.voiceName, this.gender);
    if (voice) u.voice = voice;
    this.pending++;
    const gen = this.gen;
    let finished = false;
    // Vigilante: Chrome a veces no avisa de que terminó de hablar y NIKOLAI
    // se quedaba «hablando» para siempre sin volver a escuchar.
    const maxMs = (clean.length * 95) / Math.max(0.5, this.rate) + 4000;
    const watchdog = setTimeout(() => { if (!finished) { this.onWatchdog?.(); u.onend(); } }, maxMs);
    u.onstart = () => gen === this.gen && this.onStart?.();
    u.onend = u.onerror = () => {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      if (gen !== this.gen) return;
      this.pending = Math.max(0, this.pending - 1);
      if (this.pending === 0 && this.closed) this.onIdle?.();
    };
    speechSynthesis.speak(u);
  }

  /** Pide el audio en cuanto llega la frase y lo reproduce en orden, sin pisar la anterior. */
  #sayPremium(clean, lang) {
    this.pending++;
    const gen = this.gen;
    const audio = premiumAudio(clean, this.premium, lang, this.rate);
    audio.catch(() => {}); // el error se atiende en la cadena
    this.chain = this.chain.then(async () => {
      if (gen !== this.gen) return;
      try {
        const buf = await audio;
        if (gen !== this.gen) return;
        this.onStart?.();
        await new Promise((resolve) => {
          const src = playBuffer(buf, this.premium.fx);
          this.source = src;
          src.onended = resolve;
          // Por si el navegador no avisa del final.
          setTimeout(resolve, buf.duration * 1000 + 1500);
        });
      } catch (e) {
        if (gen !== this.gen) return;
        this.onPremiumError?.(e);
        await browserSayAndWait(clean, lang, this);
      }
    }).finally(() => {
      if (gen !== this.gen) return;
      this.pending = Math.max(0, this.pending - 1);
      if (this.pending === 0 && this.closed) this.onIdle?.();
    });
  }
}

// ---------- Voz premium (ElevenLabs) ----------
// Voces prediseñadas de ElevenLabs. Todas hablan español y otros 30 idiomas con el modelo multilingüe.
export const PREMIUM_VOICES = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", tag: "jarvis", gender: "male", accent: "UK" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", tag: "jarvis2", gender: "male", accent: "UK" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", tag: "deep", gender: "male", accent: "US" },
  { id: "pqHfZKP75CvOlQylNhV4", name: "Bill", tag: "mature", gender: "male", accent: "US" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", tag: "deep", gender: "male", accent: "US" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", tag: "friday", gender: "female", accent: "UK" },
  { id: "pFZP5JQG7iQjIQuC4Bof", name: "Lily", tag: "warm", gender: "female", accent: "UK" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", tag: "soft", gender: "female", accent: "US" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", tag: "warm", gender: "female", accent: "US" },
];

let audioCtx = null;
/** Crea o reanuda el audio (los navegadores lo exigen tras un toque del usuario). */
export function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

const cache = new Map(); // frases repetidas (saludos, avisos) no se vuelven a pagar
async function premiumAudio(text, cfg, lang, rate = 1, noCache = false) {
  const ctx = unlockAudio();
  if (!ctx) throw new Error("noaudio");
  const model = cfg.model || "eleven_flash_v2_5";
  const k = `${cfg.voiceId}|${model}|${rate}|${text}`;
  let bytes = noCache ? null : cache.get(k);
  if (!bytes) {
    const body = {
      text,
      model_id: model,
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: Math.min(1.2, Math.max(0.7, rate)) },
    };
    if (/v2_5|v3/.test(model)) body.language_code = String(lang || "es").slice(0, 2);
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(cfg.voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": cfg.key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      let detail = "";
      try { const j = await r.json(); detail = j.detail?.status || j.detail?.message || j.detail || ""; } catch { /* sin detalle */ }
      const e = new Error(String(detail || r.status));
      e.status = r.status;
      throw e;
    }
    bytes = await r.arrayBuffer();
    if (cache.size > 40) cache.delete(cache.keys().next().value);
    cache.set(k, bytes);
  }
  return ctx.decodeAudioData(bytes.slice(0));
}

let reverbIR = null;
function impulse(ctx) {
  if (reverbIR) return reverbIR;
  const len = Math.floor(ctx.sampleRate * 0.45);
  reverbIR = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = reverbIR.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  return reverbIR;
}

/**
 * Reproduce el audio. Con fx activo le da el toque de asistente holográfico:
 * graves limpios, más presencia, compresión y un eco corto de sala metálica.
 */
function playBuffer(buf, fx) {
  const ctx = unlockAudio();
  const src = ctx.createBufferSource();
  src.buffer = buf;
  if (!fx) { src.connect(ctx.destination); src.start(); return src; }
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 85;
  const low = ctx.createBiquadFilter(); low.type = "lowshelf"; low.frequency.value = 180; low.gain.value = 2.5;
  const pres = ctx.createBiquadFilter(); pres.type = "peaking"; pres.frequency.value = 3200; pres.Q.value = 0.9; pres.gain.value = 3.5;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.12;
  const out = ctx.createGain(); out.gain.value = 0.95;
  const delay = ctx.createDelay(); delay.delayTime.value = 0.019;
  const dGain = ctx.createGain(); dGain.gain.value = 0.2;
  const verb = ctx.createConvolver(); verb.buffer = impulse(ctx);
  const vGain = ctx.createGain(); vGain.gain.value = 0.14;
  src.connect(hp); hp.connect(low); low.connect(pres); pres.connect(comp);
  comp.connect(out);
  comp.connect(delay); delay.connect(dGain); dGain.connect(out);
  comp.connect(verb); verb.connect(vGain); vGain.connect(out);
  out.connect(ctx.destination);
  src.start();
  return src;
}

/** Si la voz premium falla, dice la frase con la voz del sistema y espera a que termine. */
function browserSayAndWait(text, lang, sp) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = sp.rate; u.pitch = sp.pitch;
    const v = pickVoice(lang, sp.voiceName, sp.gender);
    if (v) u.voice = v;
    u.onend = u.onerror = resolve;
    setTimeout(resolve, text.length * 95 + 4000);
    speechSynthesis.speak(u);
  });
}

/** Comprueba la clave y la voz con una frase corta. Devuelve null si todo va bien o el error. */
export async function testPremium(cfg, text, lang) {
  try {
    const buf = await premiumAudio(text, cfg, lang, 1, true);
    playBuffer(buf, cfg.fx);
    return null;
  } catch (e) {
    return e;
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
  let all = voicesFor(lang);
  // Sin internet solo funcionan las voces instaladas en el dispositivo.
  if (navigator.onLine === false) all = all.filter((v) => v.localService !== false);
  return all.find((v) => v.name === preferredName) || all.find((v) => voiceGender(v) === gender) || all[0] || null;
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

// ---------- Detector de aplausos ----------
/**
 * Reconoce aplausos a partir del volumen de cada fragmento de audio (~20 ms):
 * un aplauso es un golpe fuerte y repentino que se apaga enseguida; la voz y la
 * música se sostienen más tiempo y no cuentan. Dos aplausos seguidos = "double".
 */
export class ClapCounter {
  constructor({ sensitivity = 1 } = {}) {
    this.sensitivity = sensitivity; // >1 más sensible, <1 menos
    this.bg = 0.01;                 // ruido de fondo (se adapta)
    this.pending = null;            // golpe en espera de confirmar que se apaga rápido
    this.lastOnset = -1e9;
    this.lastClap = -1e9;
    this.cooldownUntil = 0;
  }

  /**
   * peak y rms del fragmento (0..1), t en ms y flat = planitud espectral (0..1).
   * Un aplauso es ruido de banda ancha (planitud alta, ~0,5); un pitido, una nota
   * o una vocal son tonos (planitud muy baja, ~0,01). Devuelve "clap", "double" o null.
   */
  process(peak, rms, t, flat = 0.5) {
    let event = null;
    if (this.pending && t - this.pending.t >= 110) {
      // ¿Se apagó rápido? Entonces era un aplauso (se tolera el eco de un cuarto).
      if (rms < this.pending.rms * 0.6) event = this.#clap(this.pending.t);
      // Sonido sostenido (voz, música, ruido): no buscar aplausos hasta que se calle.
      else this.quietBelow = this.pending.rms * 0.35;
      this.pending = null;
    }
    if (this.quietBelow) {
      if (rms < this.quietBelow) this.quietBelow = 0;
      else return event;
    }
    const s = this.sensitivity;
    const onset = rms > 0.03 / s && rms > this.bg * 4 && peak > 0.15 / s && flat > 0.3 && t - this.lastOnset > 140;
    if (!this.pending && onset && t >= this.cooldownUntil) {
      this.pending = { t, rms };
      this.lastOnset = t;
    } else if (!this.pending) {
      this.bg = this.bg * 0.97 + rms * 0.03;
    }
    return event;
  }

  #clap(t) {
    const gap = t - this.lastClap;
    if (gap >= 150 && gap <= 1200) {
      this.lastClap = -1e9;
      this.cooldownUntil = t + 2500;
      return "double";
    }
    this.lastClap = t;
    return "clap";
  }
}

export class ClapDetector {
  constructor({ onClap, onDouble, onVoice }) {
    this.onClap = onClap;
    this.onDouble = onDouble;
    this.onVoice = onVoice; // alguien habla (sonido tonal sostenido)
    this.voiceSince = 0;
    this.counter = new ClapCounter();
    this.stream = null;
    this.ctx = null;
    this.timer = null;
    this.muted = () => false; // p. ej. mientras NIKOLAI habla
  }

  get running() {
    return Boolean(this.stream);
  }

  async start() {
    if (this.stream) return;
    // Sin cancelación de eco ni supresión de ruido: borrarían el golpe del aplauso.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    await this.ctx.resume();
    const src = this.ctx.createMediaStreamSource(this.stream);
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const spec = new Float32Array(analyser.frequencyBinCount);
    const lo = Math.floor((300 / this.ctx.sampleRate) * analyser.fftSize);
    const hi = Math.floor((8000 / this.ctx.sampleRate) * analyser.fftSize);
    this.timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let peak = 0, sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i]);
        if (v > peak) peak = v;
        sum += v * v;
      }
      if (this.muted()) return;
      // Planitud espectral entre 300 Hz y 8 kHz: media geométrica / media aritmética de la potencia.
      analyser.getFloatFrequencyData(spec);
      let logSum = 0, powSum = 0;
      for (let k = lo; k < hi; k++) {
        const db = Math.max(spec[k], -160);
        logSum += db * Math.LN10 / 10;
        powSum += 10 ** (db / 10);
      }
      const n = hi - lo;
      const flat = Math.exp(logSum / n) / (powSum / n || 1);
      const rmsNow = Math.sqrt(sum / buf.length), now = performance.now();
      const ev = this.counter.process(peak, rmsNow, now, flat);
      // Voz: sonido tonal (planitud baja) por encima del fondo durante más de 0,3 s.
      if (rmsNow > 0.02 && rmsNow > this.counter.bg * 3 && flat < 0.25) {
        this.voiceSince ||= now;
        if (now - this.voiceSince > 300) { this.voiceSince = 0; this.onVoice?.(); }
      } else this.voiceSince = 0;
      if (ev === "clap") this.onClap?.();
      else if (ev === "double") this.onDouble?.();
    }, 20);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}

export const offlineSpeechSupported = Boolean(Recognition?.install);
export function offlineSpeechReady() {
  try { return localStorage.getItem("nikolai.offlineSpeech") === "1"; } catch { return false; }
}

/**
 * Descarga el reconocimiento de voz para usarlo sin internet (Chrome, experimental).
 * Solo se llama cuando el usuario lo pide: en algunos navegadores esta función todavía falla.
 */
export async function prepareOfflineSpeech(lang) {
  if (!Recognition?.install) return "unsupported";
  try {
    const ok = await Recognition.install({ langs: [lang], processLocally: true });
    if (ok) { try { localStorage.setItem("nikolai.offlineSpeech", "1"); } catch { /* bloqueado */ } }
    return ok ? "ready" : "unsupported";
  } catch {
    return "unsupported";
  }
}

// Chrome de escritorio pausa la voz tras ~15 s: un «resume» periódico lo evita.
if ("speechSynthesis" in window) {
  setInterval(() => { if (speechSynthesis.speaking) speechSynthesis.resume(); }, 5000);
}
