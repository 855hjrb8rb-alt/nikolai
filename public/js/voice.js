// Voz: reconocimiento (micrófono → texto) y síntesis (texto → voz)
// usando la Web Speech API del navegador (mejor soporte en Chrome y Edge).

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const WAKE_WORDS = ["nikolai", "nicolai", "nikolay", "nicolás", "nicolas", "jarvis", "ニコライ", "尼古拉", "николай"];

export class Voice {
  constructor({ onResult, onState }) {
    this.onResult = onResult;
    this.onState = onState;
    this.speechLang = "es-ES";
    this.rate = 1;
    this.speakEnabled = true;
    this.wakeMode = false;
    this.listening = false;
    this.supported = Boolean(Recognition);
    this.rec = null;
  }

  setLanguage(speechLang) {
    this.speechLang = speechLang;
    if (this.rec) this.rec.lang = speechLang;
  }

  // Escucha una frase (modo pulsar para hablar).
  listenOnce() {
    if (!this.supported) return false;
    this.stop();
    this.#start(false);
    return true;
  }

  // Escucha continua: solo reacciona a frases que empiezan con la palabra clave.
  setWakeMode(on) {
    this.wakeMode = on && this.supported;
    this.stop();
    if (this.wakeMode) this.#start(true);
  }

  stop() {
    if (this.rec) {
      this.rec.onend = null;
      try { this.rec.abort(); } catch { /* ya detenido */ }
      this.rec = null;
    }
    if (this.listening) {
      this.listening = false;
      this.onState("idle");
    }
  }

  #start(continuous) {
    const rec = new Recognition();
    rec.lang = this.speechLang;
    rec.continuous = continuous;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      this.listening = true;
      if (!continuous) this.onState("listening");
    };
    rec.onresult = (e) => {
      const res = e.results[e.results.length - 1];
      const text = res[0].transcript.trim();
      if (!text) return;
      if (!continuous) return this.onResult(text);
      const lower = text.toLowerCase();
      const wake = WAKE_WORDS.find((w) => lower.includes(w));
      if (wake) {
        const command = text.slice(lower.indexOf(wake) + wake.length).replace(/^[\s,.:;!?¡¿]+/, "");
        this.onResult(command || null);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") this.wakeMode = false;
    };
    rec.onend = () => {
      this.listening = false;
      this.rec = null;
      // En modo palabra clave el navegador corta cada cierto tiempo: se reinicia.
      if (!continuous) this.onState("idle");
      if (this.wakeMode) setTimeout(() => this.wakeMode && !this.rec && this.#start(true), 300);
    };
    this.rec = rec;
    try { rec.start(); } catch { /* ya estaba escuchando */ }
  }

  speak(text, onBoundary) {
    if (!this.speakEnabled || !("speechSynthesis" in window) || !text) return;
    const clean = text.replace(/[*_#`>|]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1");
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = this.speechLang;
    u.rate = this.rate;
    const voice = pickVoice(this.speechLang);
    if (voice) u.voice = voice;
    u.onstart = () => onBoundary?.(true);
    u.onend = () => onBoundary?.(false);
    u.onerror = () => onBoundary?.(false);
    speechSynthesis.speak(u);
  }

  cancelSpeech() {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }
}

function pickVoice(lang) {
  const voices = speechSynthesis.getVoices();
  const base = lang.slice(0, 2);
  const preferred = voices.filter((v) => v.lang.replace("_", "-").startsWith(base));
  // Preferimos voces masculinas/"Google"/"natural" para un tono tipo JARVIS.
  return (
    preferred.find((v) => /natural|neural|google/i.test(v.name) && /male|daniel|jorge|pablo|george|thomas/i.test(v.name)) ||
    preferred.find((v) => /natural|neural|google/i.test(v.name)) ||
    preferred.find((v) => v.lang.replace("_", "-") === lang) ||
    preferred[0] ||
    null
  );
}

if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
