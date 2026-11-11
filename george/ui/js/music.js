// Música de cada estilo.
//  1) Si pones tus canciones en ~/Music/George/<estilo>/ se tocan esas (tu Sinatra, tus bandas sonoras).
//  2) Si no hay archivos, suena una partitura original generada en vivo para ese estilo (sin internet).
//  3) Además puede pedirle a la app Música que toque tu lista "George – <estilo>".
import { mac } from "./bridge.js";

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

// Qué toca cada tipo de partitura. steps = corcheas por compás.
const STYLES = {
  march:   { steps: 8, pad: 0.10, bass: [1, 0, 0, 0, 1, 0, 0, 0], kick: [1, 0, 0, 0, 1, 0, 0, 0], snare: [0, 0, 1, 0, 0, 0, 1, 1], density: 0.62, arp: 0 },
  drive:   { steps: 8, pad: 0.10, bass: [1, 1, 1, 1, 1, 1, 1, 1], kick: [1, 0, 0, 0, 1, 0, 0, 1], snare: [0, 0, 1, 0, 0, 0, 1, 0], hat: 1, density: 0.5, arp: 0 },
  sleigh:  { steps: 8, pad: 0.12, bass: [1, 0, 0, 0, 1, 0, 0, 0], sleigh: 1, density: 0.6, arp: 0.5 },
  fanfare: { steps: 8, pad: 0.16, bass: [1, 0, 0, 0, 1, 0, 0, 0], timp: [1, 0, 0, 0, 0, 0, 1, 1], density: 0.5, arp: 0 },
  swing:   { steps: 8, swing: 1, pad: 0.05, walk: 1, hat: 1, snare: [0, 0, 1, 0, 0, 0, 1, 0], brush: 1, density: 0.6, arp: 0, stabs: 1 },
  croon:   { steps: 8, swing: 1, pad: 0.15, walk: 1, brush: 1, sleigh: 0.5, seventh: 1, density: 0.42, arp: 0 },
  waltz:   { steps: 6, pad: 0.12, bass: [1, 0, 0, 0, 0, 0], comp: [0, 0, 1, 0, 1, 0], density: 0.6, arp: 0 },
  pulse:   { steps: 8, pad: 0.12, bass: [1, 0, 1, 1, 0, 1, 1, 0], kick: [1, 0, 1, 0, 1, 0, 1, 0], hat: 1, density: 0.2, arp: 1 },
  ambient: { steps: 8, pad: 0.26, bass: [1, 0, 0, 0, 0, 0, 0, 0], density: 0.28, arp: 0.35, long: 1 },
  hymn:    { steps: 8, pad: 0.22, bass: [1, 0, 0, 0, 1, 0, 0, 0], timp: [1, 0, 0, 0, 0, 0, 0, 0], density: 0.4, arp: 0, long: 1 },
};

class Synth {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.bus = ctx.createGain(); this.bus.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    this.bus.connect(comp); comp.connect(out);
    // reverberación de sala generada
    const len = ctx.sampleRate * 2.8, imp = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = imp.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6; }
    this.rev = ctx.createConvolver(); this.rev.buffer = imp;
    const wet = ctx.createGain(); wet.gain.value = 0.32; this.rev.connect(wet); wet.connect(comp);
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.timer = 0; this.cfg = null;
  }
  // ----- instrumentos -----
  voice(t, dur, { freq, type = "sawtooth", gain = 0.1, a = 0.02, r = 0.2, cut = 2400, cutEnv = 0, detune = 0, rev = 0.3, voices = 1 }) {
    const { ctx } = this, g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.Q.value = 0.8;
    f.frequency.setValueAtTime(cut + cutEnv, t); f.frequency.exponentialRampToValueAtTime(Math.max(120, cut), t + Math.max(0.05, dur * 0.6));
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + a);
    g.gain.setValueAtTime(gain, t + Math.max(a, dur - 0.02)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + r);
    for (let i = 0; i < voices; i++) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
      o.detune.value = voices > 1 ? (i - (voices - 1) / 2) * detune : 0;
      o.connect(f); o.start(t); o.stop(t + dur + r + 0.05);
    }
    f.connect(g); g.connect(this.bus);
    if (rev) { const s = ctx.createGain(); s.gain.value = rev; g.connect(s); s.connect(this.rev); }
  }
  bell(t, freq, gain = 0.12, dur = 1.4, ratio = 4) {
    const { ctx } = this, car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = freq; mod.frequency.value = freq * ratio;
    mg.gain.setValueAtTime(freq * 1.6, t); mg.gain.exponentialRampToValueAtTime(1, t + dur * 0.5);
    mod.connect(mg); mg.connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g); g.connect(this.bus);
    const s = ctx.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(this.rev);
    car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  }
  noise(t, dur, { type = "highpass", freq = 6000, gain = 0.1, q = 0.7 }) {
    const { ctx } = this, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noiseBuf; src.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.bus); src.start(t, Math.random()); src.stop(t + dur + 0.02);
  }
  drum(t, f0, f1, dur, gain) {
    const { ctx } = this, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + 0.02);
  }
  lead(kind, t, dur, midi) {
    const freq = midiHz(midi);
    if (kind === "bells") return this.bell(t, freq * 2, 0.11, 1.6, 3.5);
    if (kind === "celesta") return this.bell(t, freq * 2, 0.1, 1.1, 4);
    if (kind === "brass") return this.voice(t, dur * 0.9, { freq, gain: 0.085, a: 0.04, r: 0.12, cut: 1500, cutEnv: 1800, detune: 9, voices: 2, rev: 0.35 });
    if (kind === "horn") return this.voice(t, dur, { freq, gain: 0.1, a: 0.12, r: 0.4, cut: 900, cutEnv: 500, detune: 6, voices: 2, rev: 0.6 });
    if (kind === "pluck") return this.voice(t, 0.12, { freq, gain: 0.07, a: 0.004, r: 0.18, cut: 700, cutEnv: 4200, rev: 0.4 });
    return this.voice(t, dur * 0.9, { freq, gain: 0.06, a: 0.03, r: 0.3, cut: 1800, cutEnv: 1400, detune: 14, voices: 3, rev: 0.5 });
  }
  // ----- composición -----
  compose(theme) {
    const m = theme.music, st = STYLES[m.style], sc = SCALES[m.mode], rnd = rng(hash(theme.id));
    const bars = m.prog.length, steps = st.steps;
    const deg = (d) => m.key + 12 * Math.floor(d / 7) + sc[((d % 7) + 7) % 7];
    // Melodía: una frase A y una variación B; se repite A A B A para que se sienta "tema".
    const phrase = (seedDeg) => {
      const out = []; let cur = seedDeg;
      for (let b = 0; b < bars; b++) {
        const root = m.prog[b], tones = [root, root + 2, root + 4, root + 7];
        for (let s = 0; s < steps; s++) {
          const strong = s % (steps === 6 ? 6 : 4) === 0, mid = s % 2 === 0;
          const p = strong ? 0.95 : mid ? st.density : st.density * 0.45;
          if (rnd() > p) { out.push(null); continue; }
          if (strong || rnd() < 0.35) {
            // nota del acorde más cercana
            cur = tones.map((x) => [x, x + 7, x - 7]).flat().sort((a, b2) => Math.abs(a - cur) - Math.abs(b2 - cur))[rnd() < 0.7 ? 0 : 1];
          } else cur += rnd() < 0.5 ? 1 : -1;
          cur = Math.max(4, Math.min(16, cur));
          // duración: hasta la siguiente nota (se ajusta al tocar)
          out.push(cur);
        }
      }
      // termina en la tónica
      out[out.length - steps] = 7 + (out[out.length - steps] > 10 ? 7 : 0);
      for (let i = out.length - steps + 1; i < out.length; i++) out[i] = null;
      return out;
    };
    const A = phrase(9), B = phrase(11);
    return { m, st, deg, bars, steps, form: [A, A, B, A] };
  }
  start(theme) {
    this.stop();
    const c = this.cfg = this.compose(theme);
    const beat = 60 / c.m.bpm, stepDur = beat / 2;
    let step = 0, next = this.ctx.currentTime + 0.12;
    const tick = () => {
      while (next < this.ctx.currentTime + 0.2) {
        const swing = c.st.swing && step % 2 === 1 ? stepDur * 0.34 : 0;
        this.playStep(c, step, next + swing, stepDur);
        next += stepDur; step++;
      }
    };
    tick();
    this.timer = setInterval(tick, 40);
  }
  playStep(c, step, t, sd) {
    const { m, st, deg, bars, steps } = c;
    const s = step % steps, bar = Math.floor(step / steps) % bars, section = Math.floor(step / (steps * bars)) % c.form.length;
    const root = m.prog[bar], barDur = sd * steps;
    const chord = [root, root + 2, root + 4].concat(st.seventh ? [root + 6] : []);
    const lowRoot = 36 + ((deg(root) % 12) + 12) % 12;
    // colchón de cuerdas
    if (s === 0 && st.pad) for (const d of chord) this.voice(t, barDur * 0.98, { freq: midiHz(48 + ((deg(d) - 48) % 12 + 12) % 12 + 12), gain: st.pad / 3, a: barDur * 0.25, r: barDur * 0.3, cut: 1300, detune: 16, voices: 3, rev: 0.7 });
    // bajo
    if (st.walk) {
      if (s % 2 === 0) { const w = [0, 2, 4, 5][(s / 2) % 4]; this.voice(t, sd * 1.7, { type: "triangle", freq: midiHz(lowRoot - 12 + (deg(root + w) - deg(root))), gain: 0.2, a: 0.01, r: 0.1, cut: 700, rev: 0.05 }); }
    } else if (st.bass?.[s]) this.voice(t, sd * (m.style === "drive" || m.style === "pulse" ? 0.8 : 2.6), { type: m.style === "drive" || m.style === "pulse" ? "sawtooth" : "triangle", freq: midiHz(lowRoot - (m.style === "pulse" ? 0 : 12) + 12), gain: 0.15, a: 0.008, r: 0.12, cut: 520, cutEnv: 900, rev: 0.05 });
    // acompañamiento
    if (st.comp?.[s]) for (const d of chord) this.voice(t, sd * 0.8, { type: "triangle", freq: midiHz(deg(d) + 60), gain: 0.035, a: 0.01, r: 0.2, cut: 1800, rev: 0.4 });
    if (st.stabs && (s === 3 || s === 6) && bar % 2 === 1) for (const d of chord) this.voice(t, sd * 0.5, { freq: midiHz(deg(d) + 60), gain: 0.03, a: 0.01, r: 0.1, cut: 1600, cutEnv: 1500, rev: 0.3 });
    if (st.arp && (st.arp >= 1 || s % 2 === 0)) { const d = chord[(step * (st.arp >= 1 ? 1 : 0.5) | 0) % chord.length] + (s >= steps / 2 ? 7 : 0); this.lead(st.arp >= 1 ? "pluck" : "bells", t, sd, deg(d) + 60); }
    // percusión
    if (st.kick?.[s]) this.drum(t, 130, 42, 0.22, 0.5);
    if (st.timp?.[s]) this.drum(t, midiHz(lowRoot) * 1.4, midiHz(lowRoot), 0.9, 0.34);
    if (st.snare?.[s]) { this.noise(t, 0.13, { type: "bandpass", freq: 1900, gain: st.swing ? 0.07 : 0.16, q: 0.6 }); if (!st.swing) this.drum(t, 220, 150, 0.08, 0.1); }
    if (st.hat) this.noise(t, 0.04, { freq: 8000, gain: s % 2 ? 0.035 : 0.06 });
    if (st.brush && s % 2 === 0) this.noise(t, 0.2, { type: "bandpass", freq: 3200, gain: 0.03, q: 0.4 });
    if (st.sleigh && (st.sleigh >= 1 || s % 2 === 0)) { this.noise(t, 0.07, { freq: 7000, gain: 0.05 }); this.bell(t, 4200 + (s % 3) * 300, 0.012, 0.12, 1.5); }
    // melodía
    const note = c.form[section][bar * steps + s];
    if (note != null) {
      let len = 1; const ph = c.form[section];
      while (len < (st.long ? 8 : 4) && ph[bar * steps + s + len] == null && bar * steps + s + len < ph.length) len++;
      this.lead(m.lead, t, sd * len, deg(note) + 60);
      if (m.style === "fanfare" || m.style === "hymn") this.lead(m.lead, t, sd * len, deg(note - 2) + 60);
    }
  }
  stop() { clearInterval(this.timer); this.timer = 0; }
}

export class Music {
  constructor() {
    this.ctx = null; this.theme = null; this.playing = false; this.source = "synth";
    this.files = []; this.idx = 0; this.title = ""; this.volume = 0.6; this.ducked = false;
    this.audio = new Audio(); this.audio.preload = "auto";
    this.audio.addEventListener("ended", () => this.next());
    this.audio.addEventListener("error", () => { if (this.source === "files" && this.playing) this.next(); });
    this.onchange = () => {};
  }
  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.synth = new Synth(this.ctx, this.master);
      this.applyVolume();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }
  applyVolume() {
    const v = this.volume * (this.ducked ? 0.22 : 1);
    this.audio.volume = Math.min(1, v);
    if (this.master) this.master.gain.setTargetAtTime(v * 0.9, this.ctx.currentTime, 0.15);
  }
  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); this.applyVolume(); }
  /** Baja la música mientras George habla o escucha. */
  duck(on) { this.ducked = on; this.applyVolume(); }

  async setTheme(theme) {
    const was = this.playing;
    this.halt();
    this.theme = theme;
    this.files = await mac.music.list(theme.id).catch(() => []);
    this.idx = Math.floor(Math.random() * Math.max(1, this.files.length));
    this.source = this.files.length ? "files" : "synth";
    this.title = this.files.length ? this.files[this.idx].title : `Partitura de ${theme.name}`;
    if (was) this.play(); else this.onchange();
  }
  halt() { this.synth?.stop(); this.audio.pause(); if (this.source === "apple") mac.music.apple({ action: "pause" }); }
  play() {
    if (!this.theme) return;
    this.ensure(); this.playing = true;
    if (this.source === "files" && this.files.length) {
      const f = this.files[this.idx % this.files.length];
      if (this.audio.dataset.url !== f.url) { this.audio.src = f.url; this.audio.dataset.url = f.url; }
      this.title = f.title;
      this.audio.play().catch(() => {});
    } else if (this.source === "synth") this.synth.start(this.theme);
    else if (this.source === "apple") mac.music.apple({ action: "playlist", playlist: this.theme.playlist });
    this.onchange();
  }
  pause() { this.playing = false; this.halt(); this.onchange(); }
  toggle() { this.playing ? this.pause() : this.play(); }
  next() {
    if (this.source !== "files" || !this.files.length) return;
    this.idx = (this.idx + 1) % this.files.length;
    if (this.playing) this.play(); else { this.title = this.files[this.idx].title; this.onchange(); }
  }
  /** Toca tu lista de la app Música para este estilo (si existe). */
  async playApple() {
    const ok = await mac.music.apple({ action: "playlist", playlist: this.theme.playlist });
    if (ok) { this.synth?.stop(); this.audio.pause(); this.source = "apple"; this.playing = true; this.title = this.theme.playlist; this.onchange(); }
    return ok;
  }
  searchApple() { return mac.music.apple({ action: "search", term: this.theme.apple }); }
}
