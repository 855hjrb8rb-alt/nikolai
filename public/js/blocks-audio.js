// Sonidos del mundo de bloques, generados al momento con Web Audio (no hay archivos de audio):
// picar y romper según el material, poner bloques, pasos, golpes, el arco, explosiones,
// el rugido y el aleteo de los dragones y música tranquila de piano al estilo del juego.

export class BlockAudio {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.musicTimer = null;
  }

  /** Se llama desde un clic o toque (los navegadores solo dejan sonar audio así). */
  start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = 0.8; this.master.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.connect(this.master);
      this.music = c.createGain(); this.music.gain.value = 0.16; this.music.connect(this.master);
      this.verb = c.createConvolver(); this.verb.buffer = this.impulse(3.2);
      this.verbOut = c.createGain(); this.verbOut.gain.value = 0.55;
      this.verb.connect(this.verbOut); this.verbOut.connect(this.master);
      this.noise = this.noiseBuffer(2);
    }
    this.ctx.resume?.();
    if (this.musicOn) this.startMusic();
  }

  stop() {
    this.stopMusic();
    this.ctx?.close?.();
    this.ctx = null;
  }

  setMusic(on) {
    this.musicOn = on;
    if (on) this.startMusic(); else this.stopMusic();
  }

  // ---------- piezas básicas ----------
  noiseBuffer(sec) {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  impulse(sec) {
    const c = this.ctx, len = c.sampleRate * sec, b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return b;
  }

  /** Salida con volumen y paneo (pan -1..1) para sonidos con posición. */
  out(vol = 1, pan = 0, verb = 0) {
    const c = this.ctx, g = c.createGain();
    g.gain.value = vol;
    let node = g;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); node = p; }
    node.connect(this.sfx);
    if (verb) { const s = c.createGain(); s.gain.value = verb; node.connect(s); s.connect(this.verb); }
    return g;
  }

  /** Ráfaga de ruido filtrado: la base de picar, pasos y explosiones. */
  burst({ type = "bandpass", freq = 1000, q = 1, dur = 0.1, vol = 0.5, attack = 0.003, pan = 0, verb = 0, sweep = 0, at = 0 }) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + at;
    const src = c.createBufferSource(); src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.out(1, pan, verb));
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  tone({ type = "sine", freq = 440, to = 0, dur = 0.2, vol = 0.3, attack = 0.005, pan = 0, verb = 0, at = 0, filter = 0 }) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let last = o;
    if (filter) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = filter; o.connect(f); last = f; }
    last.connect(g); g.connect(this.out(1, pan, verb));
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ---------- bloques ----------
  /** Golpecito al picar un bloque (material: grass, gravel, stone, wood, sand, glass, snow). */
  dig(mat, vol = 0.32) {
    if (!this.ctx) return;
    const r = 0.85 + Math.random() * 0.3;
    switch (mat) {
      case "stone": this.burst({ type: "bandpass", freq: 2200 * r, q: 1.4, dur: 0.07, vol }); this.burst({ type: "lowpass", freq: 500, dur: 0.06, vol: vol * 0.6 }); break;
      case "wood": this.tone({ type: "triangle", freq: 210 * r, to: 150, dur: 0.09, vol: vol * 0.9 }); this.burst({ type: "bandpass", freq: 900 * r, q: 2, dur: 0.08, vol: vol * 0.6 }); break;
      case "sand": this.burst({ type: "lowpass", freq: 2600 * r, dur: 0.13, vol: vol * 0.8, attack: 0.02 }); break;
      case "snow": this.burst({ type: "lowpass", freq: 1500 * r, dur: 0.12, vol: vol * 0.7, attack: 0.02 }); break;
      case "glass": this.burst({ type: "highpass", freq: 3500, dur: 0.06, vol: vol * 0.7 }); break;
      case "gravel": this.burst({ type: "bandpass", freq: 1200 * r, q: 0.8, dur: 0.11, vol }); break;
      default: this.burst({ type: "bandpass", freq: 1700 * r, q: 0.6, dur: 0.11, vol, attack: 0.008 }); // pasto, hojas
    }
  }

  /** El bloque se rompe. */
  breakBlock(mat) {
    if (!this.ctx) return;
    if (mat === "glass") {
      for (let i = 0; i < 6; i++) this.tone({ type: "sine", freq: 2400 + Math.random() * 3000, dur: 0.25 + Math.random() * 0.2, vol: 0.06, at: i * 0.025, verb: 0.3 });
      this.burst({ type: "highpass", freq: 2500, dur: 0.3, vol: 0.35 });
      return;
    }
    this.dig(mat, 0.5);
    this.dig(mat, 0.35);
    setTimeout(() => this.dig(mat, 0.25), 45);
  }

  place(mat) {
    if (!this.ctx) return;
    this.dig(mat, 0.42);
    this.tone({ type: "sine", freq: 120, to: 70, dur: 0.07, vol: 0.18 });
  }

  step(mat) {
    this.dig(mat, mat === "stone" ? 0.13 : 0.16);
  }

  // ---------- jugador ----------
  hurt() {
    if (!this.ctx) return;
    // El «uf» corto: voz grave sintetizada con un formante.
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(130, t + 0.2);
    const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 750; f.Q.value = 3;
    const f2 = c.createBiquadFilter(); f2.type = "lowpass"; f2.frequency.value = 1800;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(f); f.connect(f2); f2.connect(g); g.connect(this.out(1));
    o.start(t); o.stop(t + 0.25);
  }

  land(hard) { this.burst({ type: "lowpass", freq: hard ? 600 : 900, dur: hard ? 0.22 : 0.1, vol: hard ? 0.6 : 0.25 }); }
  splash() { this.burst({ type: "bandpass", freq: 1100, q: 0.5, dur: 0.5, vol: 0.4, attack: 0.02, sweep: 0.4 }); }
  click() { this.tone({ type: "square", freq: 1300, dur: 0.035, vol: 0.06 }); }
  pop() { this.tone({ type: "sine", freq: 700 + Math.random() * 300, to: 1300, dur: 0.07, vol: 0.12 }); }

  bow() {
    this.tone({ type: "triangle", freq: 190, to: 120, dur: 0.18, vol: 0.35 });
    this.burst({ type: "highpass", freq: 2000, dur: 0.08, vol: 0.25 });
  }

  arrowHit(pan = 0) { this.tone({ type: "triangle", freq: 160, to: 90, dur: 0.08, vol: 0.3, pan }); this.burst({ type: "bandpass", freq: 900, dur: 0.06, vol: 0.2, pan }); }

  /** Las bolitas de experiencia: «ding» agudos. */
  xp(n = 6) {
    for (let i = 0; i < n; i++) this.tone({ type: "sine", freq: 1400 + Math.random() * 900, dur: 0.18, vol: 0.12, at: i * 0.09 + Math.random() * 0.05, verb: 0.2 });
  }

  levelUp() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: "triangle", freq: f, dur: 0.5, vol: 0.18, at: i * 0.11, verb: 0.4 }));
  }

  explosion(vol = 1, pan = 0) {
    if (!this.ctx) return;
    this.burst({ type: "lowpass", freq: 900, dur: 1.6, vol: 0.9 * vol, attack: 0.005, pan, verb: 0.5, sweep: 0.15 });
    this.burst({ type: "lowpass", freq: 3000, dur: 0.35, vol: 0.5 * vol, pan });
    this.tone({ type: "sine", freq: 70, to: 30, dur: 0.8, vol: 0.8 * vol, pan });
  }

  fireball(vol = 1, pan = 0) {
    this.burst({ type: "bandpass", freq: 500, q: 0.7, dur: 0.6, vol: 0.5 * vol, attack: 0.08, sweep: 3, pan, verb: 0.3 });
  }

  // ---------- dragones ----------
  /** Rugido del dragón: graves con distorsión y ruido, que bajan de tono. */
  roar(vol = 1, pan = 0, pitch = 1) {
    if (!this.ctx || vol < 0.02) return;
    const c = this.ctx, t = c.currentTime, dur = 2.1;
    const shaper = c.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 4); }
    shaper.curve = curve;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(380, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55 * vol, t + 0.18);
    g.gain.setValueAtTime(0.55 * vol, t + 1.1); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    // Temblor del rugido.
    const trem = c.createOscillator(); trem.frequency.value = 22; const tg = c.createGain(); tg.gain.value = 0.25 * vol;
    trem.connect(tg); tg.connect(g.gain);
    for (const [type, f, d] of [["sawtooth", 95, 0], ["sawtooth", 142, 3], ["square", 64, -4]]) {
      const o = c.createOscillator(); o.type = type; o.detune.value = d * 10;
      o.frequency.setValueAtTime(f * pitch * 1.25, t); o.frequency.exponentialRampToValueAtTime(f * pitch * 0.7, t + dur);
      o.connect(shaper); o.start(t); o.stop(t + dur + 0.1);
    }
    shaper.connect(lp); lp.connect(g); g.connect(this.out(1, pan, 0.6));
    trem.start(t); trem.stop(t + dur + 0.1);
    this.burst({ type: "bandpass", freq: 700 * pitch, q: 0.6, dur, vol: 0.3 * vol, attack: 0.2, pan, verb: 0.4, sweep: 0.5 });
  }

  growl(vol = 1, pan = 0) {
    if (!this.ctx || vol < 0.02) return;
    this.tone({ type: "sawtooth", freq: 75, to: 55, dur: 0.9, vol: 0.25 * vol, attack: 0.1, pan, filter: 500 });
    this.burst({ type: "lowpass", freq: 400, dur: 0.9, vol: 0.2 * vol, attack: 0.15, pan });
  }

  flap(vol = 1, pan = 0) {
    if (vol < 0.03) return;
    this.burst({ type: "lowpass", freq: 520, q: 0.5, dur: 0.42, vol: 0.55 * vol, attack: 0.12, pan, sweep: 0.5 });
  }

  dragonHurt(vol = 1, pan = 0) {
    this.tone({ type: "sawtooth", freq: 320, to: 160, dur: 0.35, vol: 0.3 * vol, pan, filter: 1600 });
    this.burst({ type: "bandpass", freq: 1200, dur: 0.25, vol: 0.25 * vol, pan });
  }

  dragonDeath() {
    this.roar(1.2, 0, 0.8);
    for (let i = 0; i < 10; i++) this.tone({ type: "sine", freq: 300 + i * 90, to: 2000, dur: 0.6, vol: 0.06, at: i * 0.25, verb: 0.6 });
  }

  // ---------- música ----------
  /** Piano tranquilo y espaciado, generado sin fin (acordes suaves con notas sueltas). */
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const chords = [
      [48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 66],
      [52, 59, 67, 74], [41, 53, 60, 69], [48, 52, 59, 67], [43, 47, 55, 62],
    ];
    const scale = [60, 62, 64, 67, 69, 71, 72, 74, 76, 79, 81];
    let bar = 0, chord = 0;
    const tick = () => {
      if (!this.ctx) return;
      const rest = bar % 8 === 7 || Math.random() < 0.12;
      if (!rest) {
        if (bar % 2 === 0) chord = (chord + 1 + (Math.random() < 0.3 ? 2 : 0)) % chords.length;
        const ch = chords[chord];
        this.piano(ch[0], 0, 0.5);
        if (Math.random() < 0.7) this.piano(ch[1] + 12, 0.02, 0.28);
        let at = 0.3 + Math.random() * 0.5;
        const n = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const pool = Math.random() < 0.6 ? ch.map((m) => m + 12) : scale;
          this.piano(pool[Math.floor(Math.random() * pool.length)], at, 0.32 + Math.random() * 0.12);
          at += 0.6 + Math.random() * 1.1;
        }
      }
      bar++;
      this.musicTimer = setTimeout(tick, 2800 + Math.random() * 1200);
    };
    this.musicTimer = setTimeout(tick, 1500);
  }

  stopMusic() {
    clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }

  piano(midi, at, vol) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + at, f = 440 * Math.pow(2, (midi - 69) / 12);
    const dur = 3.2 + Math.random();
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(900, t + dur);
    for (const [mult, amp, type] of [[1, 1, "sine"], [2, 0.25, "triangle"], [3, 0.08, "sine"], [4.02, 0.04, "sine"]]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f * mult;
      const og = c.createGain(); og.gain.value = amp;
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
    lp.connect(g);
    g.connect(this.music);
    const send = c.createGain(); send.gain.value = 0.9; g.connect(send); send.connect(this.verb);
  }
}
