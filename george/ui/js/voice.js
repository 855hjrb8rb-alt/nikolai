// Voz y oído de George, sin internet.
//  - Habla: la voz del sistema de macOS (las "Premium"/"Mejorada" suenan naturales), sintetizada
//    a audio y reproducida aquí para poder mover la boca al ritmo real del sonido.
//  - Escucha: graba del micrófono, detecta cuándo empiezas y terminas de hablar y lo transcribe
//    con Whisper en la propia Mac.
import { mac, isNative } from "./bridge.js";

// ---------- Idioma de un texto (para elegir la voz) ----------
const STOP = {
  es: " el la los las de que y en un una es no por con para se su al lo como más pero sus le ya o fue este ha sí porque esta son entre está cuando muy sin sobre ser tiene también me hasta hay donde han quien están ",
  en: " the of and to in is you that it he was for on are as with his they at be this have from or one had by but not what all were we when your can said there use an each which she do how their if will ",
  fr: " le la les de des et un une est que dans pour pas qui sur avec plus par je il elle nous vous ils au ce cette son ses mais ou où être avoir fait très bien aussi comme tout ",
  de: " der die das und ist nicht ein eine ich du er sie es wir ihr mit für auf von zu den dem des im auch sich wie aber oder wenn was sind war noch nach bei aus nur ",
  it: " il lo la gli le di che e un una è non per con sono come più ma anche mi si ha questo questa nel della dei del alla ho sei cosa molto tutto perché quando ",
  pt: " o a os as de que e um uma é não por com para se seu sua ao como mais mas foi este esta são está quando muito sem sobre ser tem também me até há onde você isso ",
};
const SCRIPTS = [
  [/[Ͱ-Ͽἀ-῿]/g, "el"], [/[Ѐ-ӿ]/g, "ru"], [/[぀-ヿ]/g, "ja"], [/[가-힯]/g, "ko"],
  [/[一-鿿]/g, "zh"], [/[؀-ۿ]/g, "ar"], [/[֐-׿]/g, "he"], [/[ऀ-ॿ]/g, "hi"],
];
export function detectLang(text, fallback = "es") {
  for (const [re, lang] of SCRIPTS) if ((text.match(re) || []).length > text.length * 0.25) return lang;
  const words = text.toLowerCase().replace(/[^\p{L}\s']/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length < 2) return fallback;
  let best = fallback, top = 0;
  for (const [lang, list] of Object.entries(STOP)) {
    const n = words.reduce((c, w) => c + (list.includes(` ${w} `) ? 1 : 0), 0);
    if (n > top) { top = n; best = lang; }
  }
  // Latín: se lee bien con voz italiana.
  if (top <= words.length * 0.08 && /\b(est|et|sunt|quod|non|cum|ad|in)\b/i.test(text) && /(um|us|ae|is|orum)\b/i.test(text)) return "it";
  return best;
}

// ---------- Habla ----------
export class Speaker {
  constructor() {
    this.ctx = null; this.analyser = null; this.queue = []; this.busy = false; this.level = 0; this.char = " ";
    this.voices = []; this.voicePref = {}; this.rate = 185; this.muted = false; this.gen = 0;
    this.onstate = () => {};
    this.buf = null;
  }
  async init() { this.voices = await mac.tts.voices().catch(() => []); }
  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 512;
      this.analyser.connect(this.ctx.destination);
      this.buf = new Uint8Array(this.analyser.fftSize);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }
  /** La mejor voz instalada para un idioma (Premium > Mejorada > normal), o la que hayas elegido. */
  voiceFor(lang) {
    if (this.voicePref[lang]) return this.voicePref[lang];
    const list = this.voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
    if (!list.length) return null;
    const prefer = { es: ["Jorge", "Diego", "Juan", "Carlos"], en: ["Daniel", "Oliver", "Jamie", "Arthur", "Evan", "Tom"], it: ["Luca"], fr: ["Thomas"], de: ["Markus", "Viktor"], pt: ["Felipe"] }[lang] || [];
    list.sort((a, b) => (b.quality - a.quality) || (prefer.findIndex((p) => b.name.startsWith(p)) >= 0) - (prefer.findIndex((p) => a.name.startsWith(p)) >= 0));
    return list[0].name;
  }
  get speaking() { return this.busy; }
  /** Encola una frase. Se van diciendo en orden. */
  say(text, lang) {
    const clean = text.replace(/[*_#`>]/g, "").replace(/\s+/g, " ").trim();
    if (!clean || this.muted) return;
    this.queue.push({ text: clean, lang: lang || detectLang(clean), gen: this.gen });
    if (!this.busy) this.pump();
  }
  async pump() {
    this.busy = true; this.onstate(true);
    while (this.queue.length) {
      const item = this.queue.shift();
      if (item.gen !== this.gen) continue;
      try { await this.speakOne(item); } catch { /* seguir con la siguiente */ }
    }
    this.busy = false; this.level = 0; this.onstate(false);
  }
  async speakOne({ text, lang, gen }) {
    if (isNative) {
      const wav = await mac.tts.synth({ text, voice: this.voiceFor(lang), rate: this.rate });
      if (!wav || gen !== this.gen) return;
      this.ensure();
      const audio = await this.ctx.decodeAudioData(wav);
      if (gen !== this.gen) return;
      await new Promise((resolve) => {
        const src = this.ctx.createBufferSource(); src.buffer = audio; src.connect(this.analyser);
        this.current = { stop: () => { try { src.stop(); } catch { /* ya paró */ } } };
        const t0 = this.ctx.currentTime;
        const meter = () => {
          if (!this.current) return;
          this.analyser.getByteTimeDomainData(this.buf);
          let sum = 0; for (const v of this.buf) sum += (v - 128) ** 2;
          this.level = Math.min(1, Math.sqrt(sum / this.buf.length) / 42);
          this.char = text[Math.min(text.length - 1, Math.floor(((this.ctx.currentTime - t0) / audio.duration) * text.length))] || " ";
          requestAnimationFrame(meter);
        };
        src.onended = () => { this.current = null; resolve(); };
        src.start(); meter();
      });
    } else if ("speechSynthesis" in window) {
      // Navegador (modo prueba): voz del navegador.
      await new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(text); u.lang = lang;
        let i = 0; const timer = setInterval(() => { this.level = 0.3 + Math.random() * 0.5; this.char = text[i++ % text.length]; }, 70);
        const end = () => { clearInterval(timer); this.current = null; resolve(); };
        u.onend = end; u.onerror = end;
        this.current = { stop: () => speechSynthesis.cancel() };
        speechSynthesis.speak(u);
        setTimeout(end, 1000 + text.length * 90);
      });
    }
  }
  stop() { this.gen++; this.queue.length = 0; this.current?.stop(); }
}

// ---------- Escucha ----------
const HALLUCINATIONS = /amara\.org|subt[ií]tulos|gracias por ver|thanks for watching|suscr[ií]bete|^\W*(you|bye|gracias|thank you)\W*$/i;

function encodeWav(samples, rate) {
  const buf = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); str(8, "WAVEfmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  return buf;
}

export class Listener {
  constructor() {
    this.on = false; this.paused = false; this.level = 0; this.lang = "auto";
    this.onutterance = () => {}; this.onstate = () => {}; this.onerror = () => {};
    this.chunks = []; this.speech = false; this.silence = 0; this.voiced = 0; this.noise = 0.008; this.pre = [];
  }
  async start() {
    if (this.on) return true;
    await mac.media.ask("microphone").catch(() => {});
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch (e) { this.onerror("mic"); return false; }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = this.ctx.createScriptProcessor(2048, 1, 1);
    const mute = this.ctx.createGain(); mute.gain.value = 0;
    src.connect(this.node); this.node.connect(mute); mute.connect(this.ctx.destination);
    this.node.onaudioprocess = (e) => this.process(e.inputBuffer.getChannelData(0));
    this.on = true; this.onstate("listening");
    return true;
  }
  stop() {
    if (!this.on) return;
    this.on = false; this.node.disconnect(); this.stream.getTracks().forEach((t) => t.stop()); this.ctx.close();
    this.reset(); this.level = 0; this.onstate("off");
  }
  /** Mientras George habla no se escucha a sí mismo. */
  pause(p) { this.paused = p; if (p) this.reset(); }
  reset() { this.chunks = []; this.pre = []; this.speech = false; this.silence = 0; this.voiced = 0; }
  process(input) {
    if (this.paused) { this.level = 0; return; }
    let sum = 0; for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
    const rms = Math.sqrt(sum / input.length), dur = input.length / this.ctx.sampleRate;
    this.level = Math.min(1, rms * 9);
    const thr = Math.max(0.012, this.noise * 3);
    const loud = rms > thr;
    if (!this.speech) {
      this.noise = this.noise * 0.97 + rms * 0.03;
      this.pre.push(new Float32Array(input)); if (this.pre.length > 8) this.pre.shift();
      this.voiced = loud ? this.voiced + dur : 0;
      if (this.voiced > 0.12) { this.speech = true; this.chunks = this.pre.splice(0); this.silence = 0; this.total = 0; this.onstate("hearing"); }
      return;
    }
    this.chunks.push(new Float32Array(input)); this.total += dur;
    this.silence = loud ? 0 : this.silence + dur;
    if (this.silence > 0.9 || this.total > 28) this.finish();
  }
  async finish() {
    const chunks = this.chunks, rate = this.ctx.sampleRate; const total = this.total - this.silence;
    this.reset();
    if (total < 0.35) { this.onstate("listening"); return; }
    // juntar y bajar a 16 kHz
    const len = chunks.reduce((n, c) => n + c.length, 0), all = new Float32Array(len);
    let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
    const k = rate / 16000, out = new Float32Array(Math.floor(len / k));
    for (let i = 0; i < out.length; i++) { const a = Math.floor(i * k), b = Math.min(len, Math.floor((i + 1) * k)); let s = 0; for (let j = a; j < b; j++) s += all[j]; out[i] = s / Math.max(1, b - a); }
    this.onstate("thinking");
    const r = await mac.stt.transcribe({ wav: encodeWav(out, 16000), lang: this.lang }).catch(() => ({ error: "stt-failed" }));
    if (this.on) this.onstate("listening");
    if (r.error) { this.onerror(r.error); return; }
    const text = (r.text || "").trim();
    if (text.length < 2 || HALLUCINATIONS.test(text)) return;
    this.onutterance(text);
  }
}
