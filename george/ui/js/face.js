// La cara de George.
//  - Con foto (Ajustes → Cara de George): retrato realista animado; parpadea, mira, respira y
//    mueve la boca al hablar.
//  - Sin foto: un rostro holográfico dibujado en vivo con el color del estilo.
import { Portrait, photoToPortrait } from "./portrait.js";

const TAU = Math.PI * 2;

export class Face {
  constructor(canvas) {
    this.c = canvas; this.g = canvas.getContext("2d");
    this.portrait = new Portrait(); this.photo = false;
    this.state = "idle"; // idle | listening | hearing | thinking | speaking
    this.level = 0; this.smooth = 0; this.char = " ";
    this.blinkAt = performance.now() + 2000; this.gaze = { x: 0, y: 0, tx: 0, ty: 0, next: 0 };
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    requestAnimationFrame((n) => this.frame(n));
  }
  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1), r = this.c.getBoundingClientRect();
    this.w = Math.max(40, r.width); this.h = Math.max(40, r.height);
    this.c.width = this.w * dpr; this.c.height = this.h * dpr;
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  /** Pone (o quita) la foto. Devuelve los puntos de la cara para guardarlos y no recalcular. */
  async setPhoto(dataUrl, face = null) {
    if (!dataUrl) { this.photo = false; await this.portrait.set(null); return null; }
    const f = await this.portrait.set(dataUrl, face);
    this.photo = true;
    return f;
  }
  static fileToPhoto(file) { return photoToPortrait(file, 1100); }

  frame(now) {
    requestAnimationFrame((n) => this.frame(n));
    if (document.hidden || this.c.offsetParent === null) return;
    const g = this.g, { w, h } = this, t = now / 1000;
    this.smooth += (this.level - this.smooth) * 0.35;
    g.clearRect(0, 0, w, h);
    const cs = getComputedStyle(this.c);
    const accent = cs.getPropertyValue("--accent").trim() || "#35e0ff", accent2 = cs.getPropertyValue("--accent2").trim() || "#ff5a36";
    const r = Math.min(w, h) / 2;
    g.save(); g.translate(w / 2, h / 2);
    if (this.photo && this.portrait.ready) {
      g.save(); g.beginPath(); g.arc(0, 0, r * 0.86, 0, TAU); g.clip();
      this.portrait.draw(g, -r * 0.86, -r * 0.86, r * 1.72, r * 1.72, now, { mouth: this.state === "speaking" ? this.smooth : 0, char: this.char, mood: "neutral", intensity: 0.4, speaking: this.state === "speaking" });
      g.restore();
    } else this.holo(g, r * 0.8, t, accent);
    this.ring(g, r, t, accent, accent2);
    g.restore();
  }

  ring(g, r, t, accent, accent2) {
    const col = this.state === "hearing" || this.state === "listening" ? accent2 : accent;
    g.strokeStyle = col; g.lineCap = "round";
    // aro de estado
    g.globalAlpha = 0.9; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, r * 0.89, 0, TAU); g.stroke();
    // segmentos que giran (más rápido al pensar)
    const sp = this.state === "thinking" ? 2.6 : 0.35;
    g.globalAlpha = 0.55; g.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const a = t * sp + (i * TAU) / 3; g.beginPath(); g.arc(0, 0, r * 0.95, a, a + 0.7); g.stroke(); }
    // onda de voz alrededor
    const lv = this.state === "speaking" ? this.smooth : this.state === "hearing" || this.state === "listening" ? this.level : 0;
    if (lv > 0.02) {
      g.globalAlpha = 0.5; g.lineWidth = 1.5; g.beginPath();
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * TAU, k = r * (0.99 + lv * 0.07 * (0.5 + 0.5 * Math.sin(a * 9 + t * 14) * Math.sin(a * 4 - t * 6)));
        i ? g.lineTo(Math.cos(a) * k, Math.sin(a) * k) : g.moveTo(Math.cos(a) * k, Math.sin(a) * k);
      }
      g.closePath(); g.stroke();
    }
    g.globalAlpha = 1;
  }

  /** Rostro holográfico: curvas de nivel de una cabeza, ojos que parpadean y boca que habla. */
  holo(g, r, t, accent) {
    const now = t * 1000, speaking = this.state === "speaking", open = speaking ? this.smooth : 0;
    // mirada y parpadeo
    const gz = this.gaze;
    if (now > gz.next) { gz.tx = (Math.random() - 0.5) * 0.5; gz.ty = (Math.random() - 0.5) * 0.3; gz.next = now + 1200 + Math.random() * 2600; }
    gz.x += (gz.tx - gz.x) * 0.06; gz.y += (gz.ty - gz.y) * 0.06;
    let lid = 1;
    if (now > this.blinkAt) { const p = (now - this.blinkAt) / 170; lid = p >= 1 ? 1 : Math.abs(1 - p * 2); if (p >= 1) this.blinkAt = now + 2200 + Math.random() * 3800; }
    const nod = Math.sin(t * 0.7) * 0.02 + open * 0.02, breath = 1 + Math.sin(t * 1.4) * 0.008;
    g.save(); g.rotate(Math.sin(t * 0.45) * 0.03); g.scale(breath, breath);
    g.shadowColor = accent; g.shadowBlur = 12; g.strokeStyle = accent; g.fillStyle = accent;
    // silueta por líneas de barrido
    const hw = r * 0.6, hh = r * 0.82, n = 30;
    const half = (y) => { const base = Math.sqrt(Math.max(0, 1 - y * y)); return base * (y > 0.1 ? 1 - (y - 0.1) * 0.36 : 1) * hw; };
    g.lineWidth = 1.1;
    for (let i = 0; i <= n; i++) {
      const y = -1 + (2 * i) / n, wv = half(y), yy = (y + nod) * hh + (y > 0.35 ? open * r * 0.07 * (y - 0.35) : 0);
      g.globalAlpha = 0.16 + 0.22 * (0.5 + 0.5 * Math.sin(t * 2 - i * 0.5));
      g.beginPath(); g.moveTo(-wv, yy);
      g.quadraticCurveTo(0, yy + Math.sin(t * 1.3 + i) * 1.5 + wv * 0.07, wv, yy); g.stroke();
    }
    // contorno
    g.globalAlpha = 0.85; g.lineWidth = 1.8; g.beginPath();
    for (let i = 0; i <= 80; i++) { const y = -1 + (2 * i) / 80, x = half(y), yy = (y + nod) * hh + (y > 0.35 ? open * r * 0.07 * (y - 0.35) : 0); i ? g.lineTo(x, yy) : g.moveTo(x, yy); }
    for (let i = 80; i >= 0; i--) { const y = -1 + (2 * i) / 80, yy = (y + nod) * hh + (y > 0.35 ? open * r * 0.07 * (y - 0.35) : 0); g.lineTo(-half(y), yy); }
    g.closePath(); g.stroke();
    // ojos y cejas
    const ey = (-0.16 + nod) * hh, ex = hw * 0.42, ew = hw * 0.2, eh = hw * 0.085 * lid + 0.6;
    const brow = this.state === "thinking" ? -4 : this.state === "hearing" ? -3 : 0;
    for (const s of [-1, 1]) {
      g.globalAlpha = 0.95; g.lineWidth = 2;
      g.beginPath(); g.ellipse(s * ex, ey, ew, eh, 0, 0, TAU); g.stroke();
      g.beginPath(); g.arc(s * ex + gz.x * ew * 0.9, ey + gz.y * eh, Math.min(eh, ew * 0.36), 0, TAU); g.fill();
      g.globalAlpha = 0.7; g.beginPath(); g.moveTo(s * (ex - ew * 1.15), ey - hw * 0.2 + brow * (s === 1 && this.state === "thinking" ? 1.8 : 1)); g.quadraticCurveTo(s * ex, ey - hw * 0.27 + brow, s * (ex + ew * 1.15), ey - hw * 0.19 + brow); g.stroke();
    }
    // nariz
    g.globalAlpha = 0.5; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-hw * 0.04, ey + hh * 0.08); g.lineTo(-hw * 0.1, (0.24 + nod) * hh); g.lineTo(hw * 0.08, (0.26 + nod) * hh); g.stroke();
    // boca: forma según la letra que suena
    const my = (0.5 + nod) * hh + open * r * 0.02, ch = (this.char || " ").toLowerCase();
    const round = "ouw".includes(ch) ? 0.55 : 1, wide = "eiy".includes(ch) ? 1.15 : 1, closed = "mbp ".includes(ch) ? 0.25 : 1;
    const mw = hw * 0.34 * (speaking ? round * wide : 1), mh = open * hw * 0.3 * closed;
    g.globalAlpha = 0.95; g.lineWidth = 2.2; g.beginPath();
    if (mh < 1.2) { g.moveTo(-mw, my); g.quadraticCurveTo(0, my + hw * 0.06, mw, my); }
    else { g.ellipse(0, my, mw, mh, 0, 0, TAU); }
    g.stroke();
    if (mh >= 1.2) { g.globalAlpha = 0.18; g.fill(); }
    g.restore(); g.shadowBlur = 0; g.globalAlpha = 1;
  }
}
