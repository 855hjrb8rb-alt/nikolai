// Videollamada con NIKOLAI: avatar holográfico animado que habla, escucha y puede verte
// por la cámara (con zoom). Todo corre en el navegador; solo se envía una foto a la IA
// cuando tú se lo pides («mírame», botón del ojo) o activas «que me vea siempre».

const COLORS = {
  nikolai: { main: "#79e3ff", accent: "#ffcc5c", glow: "rgba(121,227,255,.55)" },
  lawyer: { main: "#ffcc5c", accent: "#cfe3ff", glow: "rgba(255,204,92,.5)" },
  friend: { main: "#ff9ad5", accent: "#c9b8ff", glow: "rgba(255,154,213,.55)" },
};

export class CallView {
  /**
   * opts = { t, esc, icon, getState, speakLevel, micLevel, persona, caption, title,
   *          onEnd, onMic, micOn, onPersona, seeAlways, onSeeAlways, onLook }
   */
  constructor(opts) {
    this.o = opts;
    this.el = null;
    this.stream = null;
    this.ownStream = false;
    this.zoom = 1;
    this.camOn = true;
    this.started = 0;
    this.raf = 0;
    this.blinkAt = performance.now() + 2000;
    this.look = { x: 0, y: 0, tx: 0, ty: 0, next: 0 };
    this.mouth = 0;
  }

  get active() { return Boolean(this.el); }

  async start() {
    if (this.el) return;
    const { t, esc, icon } = this.o;
    const el = document.createElement("div");
    el.id = "call";
    el.className = "call";
    el.innerHTML = `
      <div class="call-top">
        <span class="call-live mono">● ${esc(t("call_live"))}</span>
        <b class="call-name"></b>
        <span class="call-time mono">00:00</span>
      </div>
      <canvas class="call-avatar"></canvas>
      <div class="call-state mono"></div>
      <div class="call-caption"></div>
      <div class="call-self">
        <video playsinline muted autoplay></video>
        <span class="call-nocam mono">${esc(t("call_noCam"))}</span>
        <div class="call-zoom">
          <button data-target data-z="-1" aria-label="zoom -">−</button>
          <span class="mono">1.0×</span>
          <button data-target data-z="1" aria-label="zoom +">+</button>
        </div>
      </div>
      <div class="call-bar">
        <button class="call-btn" data-target data-act="mic">${icon("mic")}<span></span></button>
        <button class="call-btn" data-target data-act="cam">${icon("camera")}<span>${esc(t("call_cam"))}</span></button>
        <button class="call-btn" data-target data-act="look">${eye}<span>${esc(t("call_look"))}</span></button>
        <button class="call-btn" data-target data-act="see">${eye}<span>${esc(t("call_seeAlways"))}</span></button>
        <button class="call-btn" data-target data-act="persona">${icon("persona")}<span>${esc(t("call_persona"))}</span></button>
        <button class="call-btn end" data-target data-act="end">${icon("phone")}<span>${esc(t("call_end"))}</span></button>
      </div>`;
    document.body.appendChild(el);
    document.body.classList.add("in-call");
    this.el = el;
    this.canvas = el.querySelector(".call-avatar");
    this.video = el.querySelector(".call-self video");
    this.started = Date.now();
    el.querySelectorAll("[data-z]").forEach((b) => b.addEventListener("click", () => this.setZoom(this.zoom + Number(b.dataset.z) * 0.5)));
    el.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => this.#action(b.dataset.act)));
    this.refresh();
    this.#loop();
    await this.#camera();
  }

  stop() {
    if (!this.el) return;
    cancelAnimationFrame(this.raf);
    if (this.ownStream) this.stream?.getTracks().forEach((tr) => tr.stop());
    this.stream = null;
    this.el.remove();
    this.el = null;
    document.body.classList.remove("in-call");
  }

  /** Vuelve a pintar textos y botones (persona, micrófono…). */
  refresh() {
    if (!this.el) return;
    const { t } = this.o;
    const p = this.o.persona();
    this.el.dataset.persona = p;
    this.el.querySelector(".call-name").textContent = this.o.title(p);
    const mic = this.el.querySelector('[data-act="mic"]');
    mic.classList.toggle("off", !this.o.micOn());
    mic.querySelector("span").textContent = this.o.micOn() ? t("call_mute") : t("call_unmute");
    this.el.querySelector('[data-act="cam"]').classList.toggle("off", !this.camOn);
    this.el.querySelector('[data-act="see"]').classList.toggle("on", this.o.seeAlways());
    this.el.querySelector(".call-self").classList.toggle("off", !this.camOn || !this.stream);
  }

  setZoom(z) {
    this.zoom = Math.min(3, Math.max(1, z));
    this.video.style.transform = `scaleX(-1) scale(${this.zoom})`;
    this.el.querySelector(".call-zoom span").textContent = `${this.zoom.toFixed(1)}×`;
  }

  /** Foto de la cámara (con el zoom aplicado) en JPEG base64, o null. */
  snapshot() {
    const v = this.video;
    if (!this.camOn || !this.stream || !v?.videoWidth) return null;
    const sw = v.videoWidth / this.zoom, sh = v.videoHeight / this.zoom;
    const sx = (v.videoWidth - sw) / 2, sy = (v.videoHeight - sh) / 2;
    const scale = Math.min(1, 768 / Math.max(sw, sh));
    const c = document.createElement("canvas");
    c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
    c.getContext("2d").drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    this.#flash();
    return c.toDataURL("image/jpeg", 0.8).split(",")[1];
  }

  async #camera() {
    const shared = document.getElementById("video")?.srcObject;
    if (shared?.active && shared.getVideoTracks().length) {
      this.stream = shared; this.ownStream = false;
    } else {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        this.ownStream = true;
      } catch { this.stream = null; }
    }
    if (!this.el) { if (this.ownStream) this.stream?.getTracks().forEach((tr) => tr.stop()); return; }
    if (this.stream) { this.video.srcObject = this.stream; this.video.play().catch(() => {}); }
    this.setZoom(this.zoom);
    this.refresh();
  }

  #action(act) {
    if (act === "end") this.o.onEnd();
    else if (act === "mic") { this.o.onMic(); this.refresh(); }
    else if (act === "cam") { this.camOn = !this.camOn; this.refresh(); }
    else if (act === "look") this.o.onLook();
    else if (act === "see") { this.o.onSeeAlways(); this.refresh(); }
    else if (act === "persona") { this.o.onPersona(); this.refresh(); }
  }

  #flash() {
    const s = this.el?.querySelector(".call-self");
    if (!s) return;
    s.classList.remove("flash"); void s.offsetWidth; s.classList.add("flash");
  }

  // ---------- Animación ----------
  #loop() {
    const tick = (now) => {
      if (!this.el) return;
      this.raf = requestAnimationFrame(tick);
      const secs = Math.floor((Date.now() - this.started) / 1000);
      this.el.querySelector(".call-time").textContent = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
      const state = this.o.getState();
      const st = this.el.querySelector(".call-state");
      const label = this.o.t("call_st_" + state) || "";
      if (st.textContent !== label) st.textContent = label;
      const cap = this.o.caption();
      const capEl = this.el.querySelector(".call-caption");
      if (capEl.textContent !== cap) capEl.textContent = cap;
      this.#draw(now, state);
    };
    this.raf = requestAnimationFrame(tick);
  }

  #draw(now, state) {
    const c = this.canvas;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const p = this.o.persona();
    const col = COLORS[p] || COLORS.nikolai;
    const T = now / 1000;
    // Nivel de la boca: audio real si hay voz premium, si no, sílabas simuladas mientras habla.
    let target = 0;
    if (state === "speaking") {
      const real = this.o.speakLevel();
      target = real > 0.02 ? real : Math.max(0, Math.sin(T * 13) * 0.5 + Math.sin(T * 7.3) * 0.35 + 0.25);
    }
    this.mouth += (target - this.mouth) * 0.35;
    const mic = state === "listening" ? this.o.micLevel() : 0;
    const S = Math.min(w, h) / 2.3;
    const cx = w / 2, cy = h / 2 + S * 0.05 + Math.sin(T * 1.3) * 2;

    // Halo de fondo
    const halo = g.createRadialGradient(cx, cy, S * 0.2, cx, cy, S * 1.3);
    halo.addColorStop(0, col.glow.replace(/[\d.]+\)$/, "0.18)"));
    halo.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, w, h);

    // Anillo de estado (escuchando / pensando)
    g.save();
    g.strokeStyle = col.main; g.shadowColor = col.glow; g.shadowBlur = 18; g.lineWidth = 2;
    g.globalAlpha = 0.35 + mic * 0.6;
    g.beginPath(); g.arc(cx, cy, S * (1.08 + mic * 0.12), 0, Math.PI * 2); g.stroke();
    if (state === "thinking") {
      g.globalAlpha = 0.9;
      for (let i = 0; i < 3; i++) {
        const a = T * 2.4 + (i * Math.PI * 2) / 3;
        g.beginPath(); g.arc(cx, cy, S * 1.08, a, a + 0.5); g.stroke();
      }
    }
    g.restore();

    if (p === "nikolai") this.#orb(g, cx, cy, S, T, col);
    else this.#face(g, cx, cy, S, now, col, p);

    // Líneas de holograma
    g.save();
    g.globalAlpha = 0.07; g.fillStyle = col.main;
    const off = (T * 40) % 6;
    for (let y = off; y < h; y += 6) g.fillRect(0, y, w, 1);
    g.restore();
  }

  #orb(g, cx, cy, S, T, col) {
    g.save();
    g.shadowColor = col.glow; g.shadowBlur = 24; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      g.strokeStyle = i % 2 ? col.accent : col.main;
      g.globalAlpha = 0.5 + i * 0.1;
      g.beginPath();
      const r = S * (0.35 + i * 0.13);
      const a0 = T * (0.6 + i * 0.35) * (i % 2 ? -1 : 1);
      g.arc(cx, cy, r, a0, a0 + Math.PI * (1.2 + i * 0.15));
      g.stroke();
    }
    // Onda de voz
    g.globalAlpha = 1; g.strokeStyle = col.main; g.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) {
      const r = S * 0.28 + Math.sin(a * 8 + T * 6) * S * 0.08 * this.mouth + Math.sin(a * 3 - T * 2) * 2;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath(); g.stroke();
    const core = g.createRadialGradient(cx, cy, 0, cx, cy, S * 0.22);
    core.addColorStop(0, "#fff"); core.addColorStop(0.4, col.main); core.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = core; g.globalAlpha = 0.6 + this.mouth * 0.4;
    g.beginPath(); g.arc(cx, cy, S * (0.18 + this.mouth * 0.05), 0, Math.PI * 2); g.fill();
    g.restore();
  }

  #face(g, cx, cy, S, now, col, p) {
    const girl = p === "friend";
    // Parpadeo y mirada
    if (now > this.blinkAt + 140) this.blinkAt = now + 2200 + Math.random() * 3200;
    const open = now > this.blinkAt ? 0.08 : 1;
    if (now > this.look.next) { this.look.tx = (Math.random() - 0.5) * 0.6; this.look.ty = (Math.random() - 0.5) * 0.35; this.look.next = now + 900 + Math.random() * 2200; }
    this.look.x += (this.look.tx - this.look.x) * 0.15; this.look.y += (this.look.ty - this.look.y) * 0.15;

    g.save();
    g.lineCap = "round"; g.lineJoin = "round";
    g.strokeStyle = col.main; g.shadowColor = col.glow; g.shadowBlur = 16; g.lineWidth = Math.max(1.5, S * 0.012);
    const hy = cy - S * 0.18; // centro de la cabeza
    const line = (pts, close = false) => { g.beginPath(); g.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) g.lineTo(...pts[i]); if (close) g.closePath(); g.stroke(); };
    const curve = (x0, y0, cx1, cy1, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx1, cy1, x1, y1); g.stroke(); };

    // Hombros, cuello y ropa
    const sy = cy + S * 0.55;
    g.globalAlpha = 0.85;
    curve(cx - S * 0.13, hy + S * 0.5, cx - S * 0.13, sy - S * 0.1, cx - S * 0.14, sy);
    curve(cx + S * 0.13, hy + S * 0.5, cx + S * 0.13, sy - S * 0.1, cx + S * 0.14, sy);
    curve(cx - S * 0.14, sy, cx - S * 0.75, sy + S * 0.02, cx - S * 0.95, sy + S * 0.45);
    curve(cx + S * 0.14, sy, cx + S * 0.75, sy + S * 0.02, cx + S * 0.95, sy + S * 0.45);
    if (!girl) {
      // Traje, solapas y corbata
      g.strokeStyle = col.accent;
      line([[cx - S * 0.14, sy], [cx - S * 0.3, sy + S * 0.18], [cx - S * 0.12, sy + S * 0.45]]);
      line([[cx + S * 0.14, sy], [cx + S * 0.3, sy + S * 0.18], [cx + S * 0.12, sy + S * 0.45]]);
      line([[cx - S * 0.04, sy + S * 0.02], [cx + S * 0.04, sy + S * 0.02], [cx + S * 0.05, sy + S * 0.3], [cx, sy + S * 0.38], [cx - S * 0.05, sy + S * 0.3]], true);
      g.strokeStyle = col.main;
    } else {
      // Collar
      g.strokeStyle = col.accent; g.globalAlpha = 0.7;
      curve(cx - S * 0.2, sy + S * 0.02, cx, sy + S * 0.22, cx + S * 0.2, sy + S * 0.02);
      g.beginPath(); g.arc(cx, sy + S * 0.13, S * 0.018, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = col.main;
    }
    g.globalAlpha = 1;

    // Cabeza
    g.beginPath(); g.ellipse(cx, hy, S * 0.36, S * 0.47, 0, 0, Math.PI * 2); g.stroke();
    // Cabello
    g.strokeStyle = col.accent;
    if (girl) {
      curve(cx - S * 0.38, hy - S * 0.05, cx - S * 0.3, hy - S * 0.62, cx + S * 0.05, hy - S * 0.5);
      curve(cx + S * 0.05, hy - S * 0.5, cx + S * 0.4, hy - S * 0.5, cx + S * 0.4, hy - S * 0.05);
      curve(cx - S * 0.38, hy - S * 0.05, cx - S * 0.48, hy + S * 0.5, cx - S * 0.36, sy + S * 0.2);
      curve(cx + S * 0.4, hy - S * 0.05, cx + S * 0.5, hy + S * 0.5, cx + S * 0.38, sy + S * 0.2);
      curve(cx - S * 0.05, hy - S * 0.48, cx - S * 0.2, hy - S * 0.3, cx - S * 0.32, hy - S * 0.2);
    } else {
      curve(cx - S * 0.36, hy - S * 0.1, cx - S * 0.3, hy - S * 0.58, cx + S * 0.05, hy - S * 0.52);
      curve(cx + S * 0.05, hy - S * 0.52, cx + S * 0.34, hy - S * 0.5, cx + S * 0.36, hy - S * 0.12);
      curve(cx - S * 0.25, hy - S * 0.38, cx, hy - S * 0.5, cx + S * 0.28, hy - S * 0.36);
      curve(cx - S * 0.3, hy - S * 0.25, cx - S * 0.05, hy - S * 0.42, cx + S * 0.22, hy - S * 0.44);
    }
    g.strokeStyle = col.main;

    // Cejas
    const ey = hy - S * 0.06, ex = S * 0.14;
    const browUp = girl ? S * 0.02 : 0;
    curve(cx - ex - S * 0.08, ey - S * 0.08 - browUp, cx - ex, ey - S * (girl ? 0.13 : 0.1) - browUp, cx - ex + S * 0.08, ey - S * (girl ? 0.09 : 0.1));
    curve(cx + ex - S * 0.08, ey - S * (girl ? 0.09 : 0.1), cx + ex, ey - S * (girl ? 0.13 : 0.11) - browUp, cx + ex + S * 0.08, ey - S * 0.08 - browUp);
    // Ojos
    for (const sx of [-1, 1]) {
      const x = cx + sx * ex;
      g.beginPath(); g.ellipse(x, ey, S * 0.07, S * 0.038 * open, 0, 0, Math.PI * 2); g.stroke();
      if (open > 0.5) {
        g.save(); g.fillStyle = col.main;
        g.beginPath(); g.arc(x + this.look.x * S * 0.03, ey + this.look.y * S * 0.015, S * 0.02, 0, Math.PI * 2); g.fill();
        g.restore();
        if (girl) { line([[x + sx * S * 0.065, ey - S * 0.01], [x + sx * S * 0.09, ey - S * 0.035]]); }
      }
    }
    // Nariz
    curve(cx, ey + S * 0.04, cx - S * 0.03, ey + S * 0.15, cx + S * 0.015, ey + S * 0.17);
    // Boca: se abre con la voz; en reposo sonríe (más la amiga)
    const my = hy + S * 0.24, mw = S * (girl ? 0.11 : 0.12);
    const openH = this.mouth * S * 0.09;
    const smile = girl ? S * 0.035 : S * 0.012;
    g.strokeStyle = girl ? col.main : col.main;
    curve(cx - mw, my, cx, my + smile - openH * 0.2, cx + mw, my);
    if (openH > 1) curve(cx - mw * 0.85, my + 1, cx, my + smile + openH, cx + mw * 0.85, my + 1);
    // Orejas
    curve(cx - S * 0.36, ey, cx - S * 0.43, ey + S * 0.07, cx - S * 0.35, ey + S * 0.14);
    curve(cx + S * 0.36, ey, cx + S * 0.43, ey + S * 0.07, cx + S * 0.35, ey + S * 0.14);
    g.restore();
  }
}

const eye = '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
