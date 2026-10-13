// Helicóptero UH-1 «Huey» para volar sobre el Mapa táctico.
// El helicóptero va siempre en el centro y el mapa se mueve debajo de él.
// Controles: teclado (W/S, A/D, Q/E o flechas), joystick en pantalla y botones de altura.
// Simulación sencilla y divertida: arranque del rotor, velocidad, rumbo, altitud,
// zoom automático según la altura, combustible, aterrizaje y sonido de rotor.

const MAX_SPEED = 205; // km/h (crucero real del UH-1H ~ 200 km/h)
const MAX_ALT = 3800; // m

export class Heli {
  /** map = mapa de Leaflet; box = contenedor del mapa; t = textos */
  constructor(map, box, t) {
    this.map = map; this.box = box; this.t = t;
    this.active = false;
    this.s = null;
    this.keys = new Set();
    this.joy = { x: 0, y: 0 };
    this.climbBtn = 0;
    this.autoZoom = true;
    this.muted = false;
    this.audio = null;
    this.raf = 0;
    this.onKey = this.onKey.bind(this);
  }

  start() {
    if (this.active) return;
    const c = this.map.getCenter();
    this.s = { lat: c.lat, lon: c.lng, hdg: 0, speed: 0, alt: 0, vs: 0, rpm: 0, fuel: 100, last: performance.now(), dist: 0 };
    this.active = true;
    this.box.classList.add("heli-on");
    document.body.classList.add("heli-flying");
    this.#mount();
    addEventListener("keydown", this.onKey, true);
    addEventListener("keyup", this.onKey, true);
    this.#sound();
    this.raf = requestAnimationFrame((n) => this.#tick(n));
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    cancelAnimationFrame(this.raf);
    removeEventListener("keydown", this.onKey, true);
    removeEventListener("keyup", this.onKey, true);
    this.el?.remove(); this.el = null;
    this.box.classList.remove("heli-on");
    document.body.classList.remove("heli-flying");
    try { this.audio?.ctx.close(); } catch { /* cerrado */ }
    this.audio = null;
    this.keys.clear();
  }

  // Las teclas de vuelo no deben mover el carrusel ni activar la voz.
  onKey(e) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const k = e.key.toLowerCase();
    const flight = ["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "shift", "pageup", "pagedown"];
    if (!flight.includes(k)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "keydown") this.keys.add(k); else this.keys.delete(k);
  }

  #mount() {
    const t = this.t;
    const el = document.createElement("div");
    el.className = "heli-layer";
    el.innerHTML = `
      <div class="heli-shadow"></div>
      <div class="heli-craft">${HUEY_SVG}</div>
      <div class="heli-hud mono">
        <div class="hh-tape"><span class="hh-k">${t("heli_spd")}</span><b data-h="spd">0</b><small>KM/H</small><small data-h="kt">0 KT</small></div>
        <div class="hh-compass"><div class="hh-rose" data-h="rose">${rose()}</div><b data-h="hdg">000°</b></div>
        <div class="hh-tape r"><span class="hh-k">${t("heli_alt")}</span><b data-h="alt">0</b><small>M</small><small data-h="ft">0 FT</small><small data-h="vs">VS 0</small></div>
        <div class="hh-bottom"><span data-h="state"></span><span>${t("heli_fuel")} <i class="hh-fuel"><i data-h="fuel"></i></i></span><span data-h="dist">0.0 KM</span></div>
      </div>
      <div class="heli-joy" data-target><i></i></div>
      <div class="heli-alt">
        <button data-target data-c="1">▲<small>${t("heli_up")}</small></button>
        <button data-target data-c="-1">▼<small>${t("heli_down")}</small></button>
      </div>
      <div class="heli-tools">
        <button class="nw-mini" data-target data-ht="zoom">${t("heli_autoZoom")}</button>
        <button class="nw-mini" data-target data-ht="mute">🔊</button>
        <button class="nw-mini" data-target data-ht="exit">✕ ${t("heli_exit")}</button>
      </div>
      <div class="heli-help mono">${t("heli_help")}</div>`;
    this.box.appendChild(el);
    this.el = el;
    // Joystick: arriba = adelante, abajo = frenar/atrás, lados = girar.
    const joy = el.querySelector(".heli-joy"), knob = joy.querySelector("i");
    const move = (e) => {
      const r = joy.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      const y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
      this.joy = { x, y: -y };
      knob.style.transform = `translate(${x * 34}px, ${y * 34}px)`;
    };
    const end = () => { this.joy = { x: 0, y: 0 }; knob.style.transform = ""; };
    joy.addEventListener("pointerdown", (e) => { joy.setPointerCapture(e.pointerId); move(e); });
    joy.addEventListener("pointermove", (e) => { if (joy.hasPointerCapture(e.pointerId)) move(e); });
    ["pointerup", "pointercancel"].forEach((ev) => joy.addEventListener(ev, end));
    el.querySelectorAll("[data-c]").forEach((b) => {
      const v = Number(b.dataset.c);
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); this.climbBtn = v; });
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, () => { if (this.climbBtn === v) this.climbBtn = 0; }));
    });
    el.querySelector('[data-ht="zoom"]').classList.toggle("on", this.autoZoom);
    el.querySelectorAll("[data-ht]").forEach((b) => b.addEventListener("click", () => {
      const a = b.dataset.ht;
      if (a === "exit") this.onExit?.();
      else if (a === "zoom") { this.autoZoom = !this.autoZoom; b.classList.toggle("on", this.autoZoom); }
      else if (a === "mute") { this.muted = !this.muted; b.textContent = this.muted ? "🔇" : "🔊"; }
    }));
  }

  // ---------- Física ----------
  #tick(now) {
    if (!this.active) return;
    this.raf = requestAnimationFrame((n) => this.#tick(n));
    const s = this.s;
    const dt = Math.min(0.1, (now - s.last) / 1000);
    s.last = now;
    const K = this.keys;
    const fwd = (K.has("w") || K.has("arrowup") ? 1 : 0) - (K.has("s") || K.has("arrowdown") ? 1 : 0) + this.joy.y;
    const turn = (K.has("d") || K.has("arrowright") ? 1 : 0) - (K.has("a") || K.has("arrowleft") ? 1 : 0) + this.joy.x;
    const climb = (K.has("q") || K.has(" ") || K.has("pageup") ? 1 : 0) - (K.has("e") || K.has("shift") || K.has("pagedown") ? 1 : 0) + this.climbBtn;

    // Arranque: el rotor tarda en tomar vueltas; sin combustible se apaga (autorrotación).
    const rpmTarget = s.fuel > 0 ? 1 : 0;
    s.rpm += (rpmTarget - s.rpm) * Math.min(1, dt * (rpmTarget ? 0.75 : 0.25));
    const ready = s.rpm > 0.92;
    const onGround = s.alt <= 0.5;

    // Altura
    const vsTarget = ready ? Math.max(-1, Math.min(1, climb)) * 9 : s.fuel <= 0 ? -6 : onGround ? 0 : -3;
    s.vs += (vsTarget - s.vs) * Math.min(1, dt * 1.8);
    s.alt = Math.max(0, Math.min(MAX_ALT, s.alt + s.vs * dt));
    if (s.alt === 0 && s.vs < 0) s.vs = 0;

    // Velocidad y rumbo (en tierra no avanza)
    if (onGround) s.speed *= Math.max(0, 1 - dt * 3);
    else {
      const f = Math.max(-1, Math.min(1, fwd));
      s.speed += (f > 0 ? f * 32 : f * 45) * dt;
      if (!f) s.speed -= Math.sign(s.speed) * Math.min(Math.abs(s.speed), 4 * dt); // se mantiene casi en crucero
      s.speed = Math.max(-35, Math.min(MAX_SPEED, s.speed));
    }
    const yawRate = onGround ? 25 : 55 - Math.min(35, Math.abs(s.speed) / 6);
    s.hdg = (s.hdg + Math.max(-1, Math.min(1, turn)) * yawRate * dt + 360) % 360;

    // Posición
    const m = (s.speed / 3.6) * dt;
    const r = (s.hdg * Math.PI) / 180;
    s.lat = Math.max(-84, Math.min(84, s.lat + (m * Math.cos(r)) / 111_320));
    s.lon += (m * Math.sin(r)) / (111_320 * Math.cos((s.lat * Math.PI) / 180));
    if (s.lon > 180) s.lon -= 360; else if (s.lon < -180) s.lon += 360;
    s.dist += Math.abs(m);

    // Combustible: ~2 h de vuelo; en tierra con motor al mínimo se recarga.
    if (!onGround) s.fuel = Math.max(0, s.fuel - dt * (0.012 + Math.abs(s.speed) / MAX_SPEED * 0.008) * (100 / 100));
    else if (Math.abs(s.speed) < 5) s.fuel = Math.min(100, s.fuel + dt * 4);

    // Mapa: el helicóptero en el centro; zoom según altura.
    const zoom = this.autoZoom ? Math.max(9, Math.min(18, Math.round(18 - Math.log2(1 + s.alt / 40) * 1.15))) : this.map.getZoom();
    this.map.setView([s.lat, s.lon], zoom, { animate: false });
    this.#draw(now, ready, onGround);
    this.#soundUpdate(ready, onGround);
  }

  #draw(now, ready, onGround) {
    const s = this.s, el = this.el;
    if (!el) return;
    const craft = el.querySelector(".heli-craft");
    // Inclinación al acelerar/girar y tamaño según altura (perspectiva).
    const scale = 0.9 + Math.min(0.5, s.alt / 2500);
    craft.style.transform = `translate(-50%, -50%) rotate(${s.hdg}deg) scale(${scale})`;
    craft.querySelector(".hr-main").style.transform = `rotate(${(now * 1.2 * s.rpm) % 360}deg)`;
    craft.querySelector(".hr-tail").style.transform = `rotate(${(now * 3 * s.rpm) % 360}deg)`;
    const off = Math.min(60, 6 + s.alt / 18);
    const sh = el.querySelector(".heli-shadow");
    sh.style.transform = `translate(calc(-50% + ${off}px), calc(-50% + ${off}px)) rotate(${s.hdg}deg) scale(${Math.max(0.35, 1 - s.alt / 3000)})`;
    sh.style.opacity = Math.max(0.12, 0.55 - s.alt / 4000);
    const q = (k) => el.querySelector(`[data-h="${k}"]`);
    q("spd").textContent = Math.round(Math.abs(s.speed));
    q("kt").textContent = `${Math.round(Math.abs(s.speed) / 1.852)} KT`;
    q("alt").textContent = Math.round(s.alt).toLocaleString();
    q("ft").textContent = `${Math.round(s.alt * 3.281).toLocaleString()} FT`;
    q("vs").textContent = `VS ${s.vs >= 0 ? "+" : ""}${s.vs.toFixed(1)} m/s`;
    q("hdg").textContent = `${String(Math.round(s.hdg) % 360).padStart(3, "0")}°`;
    q("rose").style.transform = `translateX(${-s.hdg * 2}px)`;
    q("fuel").style.width = `${s.fuel}%`;
    q("fuel").classList.toggle("low", s.fuel < 20);
    q("dist").textContent = `${(s.dist / 1000).toFixed(1)} KM`;
    q("state").textContent = s.fuel <= 0 ? this.t("heli_noFuel") : !ready ? `${this.t("heli_startup")} ${Math.round(s.rpm * 100)}%` : onGround ? this.t("heli_ground") : this.t("heli_flying");
    el.querySelector(".heli-help").style.opacity = ready && !onGround ? 0 : 1;
  }

  // ---------- Sonido de rotor (generado, sin archivos) ----------
  #sound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = "lowpass"; bp.frequency.value = 520;
      const chop = ctx.createGain(); chop.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.type = "sawtooth"; lfo.frequency.value = 2;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.5;
      lfo.connect(lfoGain); lfoGain.connect(chop.gain);
      const turbine = ctx.createOscillator(); turbine.type = "triangle"; turbine.frequency.value = 180;
      const tGain = ctx.createGain(); tGain.gain.value = 0;
      const master = ctx.createGain(); master.gain.value = 0;
      noise.connect(bp); bp.connect(chop); chop.connect(master);
      turbine.connect(tGain); tGain.connect(master);
      master.connect(ctx.destination);
      noise.start(); lfo.start(); turbine.start();
      this.audio = { ctx, lfo, master, turbine, tGain, bp };
    } catch { this.audio = null; }
  }
  #soundUpdate(ready, onGround) {
    const a = this.audio, s = this.s;
    if (!a) return;
    const now = a.ctx.currentTime;
    // El «chop-chop» acelera con las vueltas del rotor (~5,4 golpes por segundo en el Huey).
    a.lfo.frequency.setTargetAtTime(1 + s.rpm * 4.4 + Math.abs(s.speed) / 200, now, 0.2);
    a.turbine.frequency.setTargetAtTime(120 + s.rpm * 340 + Math.abs(s.vs) * 8, now, 0.3);
    a.tGain.gain.setTargetAtTime(0.025 * s.rpm, now, 0.3);
    a.bp.frequency.setTargetAtTime(380 + s.rpm * 300 + Math.abs(s.speed), now, 0.3);
    a.master.gain.setTargetAtTime(this.muted ? 0 : 0.18 * Math.max(0.1, s.rpm), now, 0.25);
  }
}

function rose() {
  let h = "";
  for (let rep = -1; rep <= 1; rep++) {
    for (let d = 0; d < 360; d += 15) {
      const x = (d + rep * 360) * 2;
      const lbl = { 0: "N", 90: "E", 180: "S", 270: "O" }[d] ?? (d % 45 === 0 ? d : "");
      h += `<span style="left:${x}px" class="${d % 90 === 0 ? "c" : ""}">${lbl === "" ? "|" : lbl}</span>`;
    }
  }
  return h;
}

// UH-1 visto desde arriba: fuselaje, botalón de cola, patines, rotor principal de 2 palas y rotor de cola.
const HUEY_SVG = `
<svg viewBox="-60 -70 120 160" width="120" height="160" class="huey">
  <g class="hull">
    <path d="M-8 52 L-4 86 L4 86 L8 52 Z" fill="#4b5b3a" stroke="#1e2617" stroke-width="1.2"/>
    <rect x="-18" y="80" width="36" height="5" rx="2" fill="#4b5b3a" stroke="#1e2617"/>
    <path d="M0 -42 C14 -42 20 -28 20 -8 L20 30 C20 46 12 56 0 56 C-12 56 -20 46 -20 30 L-20 -8 C-20 -28 -14 -42 0 -42 Z" fill="#5a6b44" stroke="#1e2617" stroke-width="1.5"/>
    <path d="M-13 -30 C-8 -40 8 -40 13 -30 L12 -16 L-12 -16 Z" fill="#9fd6ff" fill-opacity=".55" stroke="#1e2617"/>
    <rect x="-16" y="-4" width="32" height="22" rx="3" fill="#4d5d3a" stroke="#1e2617"/>
    <circle cx="0" cy="6" r="5" fill="#2b3421"/>
    <rect x="-28" y="-26" width="4" height="70" rx="2" fill="#30391f"/>
    <rect x="24" y="-26" width="4" height="70" rx="2" fill="#30391f"/>
    <rect x="-27" y="-6" width="9" height="3" fill="#30391f"/><rect x="18" y="-6" width="9" height="3" fill="#30391f"/>
    <rect x="-27" y="26" width="9" height="3" fill="#30391f"/><rect x="18" y="26" width="9" height="3" fill="#30391f"/>
    <text x="0" y="40" text-anchor="middle" font-size="7" font-family="monospace" fill="#e8e8d0">NIKOLAI</text>
  </g>
  <g transform="translate(11 83)"><g class="hr-tail"><rect x="-1.2" y="-9" width="2.4" height="18" fill="#222"/></g></g>
  <g transform="translate(0 6)"><g class="hr-main">
    <rect x="-60" y="-2.6" width="120" height="5.2" rx="2.6" fill="#1b1b1b" fill-opacity=".85"/>
    <circle r="62" fill="#000" fill-opacity=".07"/>
  </g></g>
</svg>`;
