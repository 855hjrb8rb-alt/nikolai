// Mundo de bloques en primera persona (al estilo Minecraft), creado a partir del lugar que
// estás viendo en Google Maps: la semilla sale de las coordenadas, la altitud real decide si
// hay costa, llanura o montañas y la latitud decide si hay nieve o selva.
// · Romper bloques (manteniendo), ponerlos, saltar, nadar, volar y correr.
// · Dragones que vuelan en círculos, se lanzan en picada rompiendo bloques y escupen bolas
//   de fuego. Se les derrota con el arco (última casilla) o a golpes.
// · Sonidos generados al momento (blocks-audio.js) y música tranquila de piano.
// · Lo que construyes se guarda en tu navegador para ese lugar.
import * as THREE from "../vendor/three.mjs";
import { BlockAudio } from "./blocks-audio.js";

// ---------------------------------------------------------------------
// Mundo
// ---------------------------------------------------------------------
const W = 128, D = 128, H = 64, SEA = 22, CH = 16;
const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, COBBLE = 4, LOG = 5, LEAVES = 6, SAND = 7, WATER = 8,
  PLANKS = 9, SNOW = 10, GLASS = 11, BEDROCK = 12, OBSIDIAN = 13, BRICK = 14, COAL = 15, DIAMOND = 16;

// Casillas del atlas de texturas (8 columnas × 4 filas de 16 px).
const TX = { grassTop: 0, grassSide: 1, dirt: 2, stone: 3, cobble: 4, logSide: 5, logTop: 6, leaves: 7, sand: 8, water: 9, planks: 10, snowSide: 11, snowTop: 12, glass: 13, bedrock: 14, obsidian: 15, brick: 16, coal: 17, diamond: 18, crack0: 19 };

// tex: [arriba, abajo, lados] · hard: segundos para romper · snd: material del sonido.
const INFO = [];
const def = (id, name, tex, hard, snd, extra = {}) => { INFO[id] = { id, name, tex, hard, snd, opaque: true, solid: true, ...extra }; };
INFO[AIR] = { id: 0, name: "air", opaque: false, solid: false };
def(GRASS, "grass", [TX.grassTop, TX.dirt, TX.grassSide], 0.6, "grass");
def(DIRT, "dirt", [TX.dirt, TX.dirt, TX.dirt], 0.5, "gravel");
def(STONE, "stone", [TX.stone, TX.stone, TX.stone], 1.1, "stone");
def(COBBLE, "cobble", [TX.cobble, TX.cobble, TX.cobble], 1.4, "stone");
def(LOG, "log", [TX.logTop, TX.logTop, TX.logSide], 1.2, "wood");
def(LEAVES, "leaves", [TX.leaves, TX.leaves, TX.leaves], 0.2, "grass", { opaque: false });
def(SAND, "sand", [TX.sand, TX.sand, TX.sand], 0.5, "sand");
def(WATER, "water", [TX.water, TX.water, TX.water], Infinity, "sand", { opaque: false, solid: false });
def(PLANKS, "planks", [TX.planks, TX.planks, TX.planks], 1.0, "wood");
def(SNOW, "snow", [TX.snowTop, TX.dirt, TX.snowSide], 0.5, "snow");
def(GLASS, "glass", [TX.glass, TX.glass, TX.glass], 0.3, "glass", { opaque: false });
def(BEDROCK, "bedrock", [TX.bedrock, TX.bedrock, TX.bedrock], Infinity, "stone");
def(OBSIDIAN, "obsidian", [TX.obsidian, TX.obsidian, TX.obsidian], 6, "stone");
def(BRICK, "brick", [TX.brick, TX.brick, TX.brick], 1.4, "stone");
def(COAL, "coal", [TX.coal, TX.coal, TX.coal], 1.5, "stone");
def(DIAMOND, "diamond", [TX.diamond, TX.diamond, TX.diamond], 2, "stone");

const BOW = 100;
const HOTBAR = [GRASS, DIRT, STONE, COBBLE, PLANKS, LOG, GLASS, BRICK, BOW];
const UNBREAKABLE_BY_DRAGON = new Set([AIR, WATER, BEDROCK, OBSIDIAN]);

// ---------------------------------------------------------------------
// Ruido determinista (misma semilla = mismo mundo)
// ---------------------------------------------------------------------
function hash(x, y, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function noise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, seed, oct = 4) {
  let s = 0, amp = 1, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += noise(x * f, y * f, seed + i * 101) * amp; norm += amp; amp *= 0.5; f *= 2; }
  return s / norm;
}
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x6d2b79f5) >>> 0; return ((s ^ (s >>> 13)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------------
// Texturas pixeladas dibujadas al momento
// ---------------------------------------------------------------------
function makeAtlas() {
  const cv = document.createElement("canvas");
  cv.width = 128; cv.height = 64;
  const g = cv.getContext("2d");
  const r = rng(1234);
  const tile = (i, fn) => {
    const ox = (i % 8) * 16, oy = Math.floor(i / 8) * 16;
    const img = g.createImageData(16, 16);
    const put = (x, y, [cr, cg, cb], a = 255) => { const k = (y * 16 + x) * 4; img.data[k] = cr; img.data[k + 1] = cg; img.data[k + 2] = cb; img.data[k + 3] = a; };
    fn(put);
    g.putImageData(img, ox, oy);
  };
  const vary = ([cr, cg, cb], n) => { const k = (r() - 0.5) * n; return [cr + k, cg + k, cb + k].map((v) => Math.max(0, Math.min(255, v))); };
  const fill = (put, base, n) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(x, y, vary(base, n)); };
  const specks = (put, col, count, size = 1) => { for (let i = 0; i < count; i++) { const x = Math.floor(r() * (17 - size)), y = Math.floor(r() * (17 - size)); for (let a = 0; a < size; a++) for (let b = 0; b < size; b++) put(Math.min(15, x + a), Math.min(15, y + b), vary(col, 20)); } };
  const GREEN = [94, 157, 52], DIRTC = [134, 96, 67], STONEC = [125, 125, 125];

  tile(TX.grassTop, (p) => fill(p, GREEN, 40));
  tile(TX.dirt, (p) => { fill(p, DIRTC, 30); specks(p, [100, 70, 48], 14); specks(p, [160, 120, 90], 8); });
  const sideTop = (p, topCol, n) => {
    fill(p, DIRTC, 30); specks(p, [100, 70, 48], 12);
    for (let x = 0; x < 16; x++) { const d = 3 + Math.floor(r() * 2.5); for (let y = 0; y < d; y++) p(x, y, vary(topCol, n)); }
  };
  tile(TX.grassSide, (p) => sideTop(p, GREEN, 35));
  tile(TX.snowSide, (p) => sideTop(p, [240, 248, 255], 12));
  tile(TX.snowTop, (p) => fill(p, [240, 248, 255], 14));
  tile(TX.stone, (p) => { fill(p, STONEC, 18); specks(p, [100, 100, 100], 18, 2); specks(p, [145, 145, 145], 10); });
  tile(TX.cobble, (p) => {
    fill(p, [110, 110, 110], 10);
    for (let i = 0; i < 9; i++) { const cx = r() * 16, cy = r() * 16, rad = 2.5 + r() * 2; const shade = 120 + r() * 40; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x - cx, y - cy) < rad) p(x, y, vary([shade, shade, shade], 12)); }
    for (let i = 0; i < 30; i++) p(Math.floor(r() * 16), Math.floor(r() * 16), [70, 70, 70]);
  });
  tile(TX.logSide, (p) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p(x, y, vary(x % 4 === 0 ? [80, 62, 38] : [107, 85, 52], 14)); });
  tile(TX.logTop, (p) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); p(x, y, d > 6.5 ? vary([107, 85, 52], 12) : vary(Math.floor(d) % 2 ? [176, 141, 87] : [154, 122, 74], 10)); } });
  tile(TX.leaves, (p) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const h = r(); if (h < 0.16) p(x, y, [0, 0, 0], 0); else p(x, y, vary(h < 0.4 ? [42, 98, 30] : [64, 132, 42], 26)); } });
  tile(TX.sand, (p) => { fill(p, [219, 207, 163], 16); specks(p, [196, 182, 136], 14); });
  tile(TX.water, (p) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p(x, y, vary((x + y * 3) % 7 === 0 ? [80, 130, 235] : [46, 90, 210], 14), 200); });
  tile(TX.planks, (p) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const seam = y % 4 === 3 || (x === ((Math.floor(y / 4) * 7) % 16)); p(x, y, seam ? vary([110, 84, 48], 8) : vary([170, 136, 84], 18)); } });
  tile(TX.glass, (p) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x === 0 || y === 0 || x === 15 || y === 15; const streak = (x - y === 3 || x - y === 4 || x - y === -6) && x > 2 && x < 13; if (edge) p(x, y, [210, 235, 240]); else if (streak) p(x, y, [235, 250, 255], 170); else p(x, y, [0, 0, 0], 0); } });
  tile(TX.bedrock, (p) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p(x, y, vary(r() < 0.5 ? [40, 40, 40] : [95, 95, 95], 20)); });
  tile(TX.obsidian, (p) => { fill(p, [20, 16, 32], 10); specks(p, [60, 40, 90], 16); specks(p, [36, 26, 56], 10, 2); });
  tile(TX.brick, (p) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = Math.floor(y / 4); const mortar = y % 4 === 3 || (x + (row % 2) * 4) % 8 === 7; p(x, y, mortar ? vary([180, 170, 160], 10) : vary([150, 70, 55], 22)); } });
  tile(TX.coal, (p) => { fill(p, STONEC, 18); specks(p, [30, 30, 30], 7, 2); });
  tile(TX.diamond, (p) => { fill(p, STONEC, 18); specks(p, [90, 230, 225], 6, 2); specks(p, [210, 255, 255], 4); });
  // Grietas al picar (10 etapas).
  for (let s = 0; s < 10; s++) {
    tile(TX.crack0 + s, (p) => {
      const rr = rng(77);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p(x, y, [0, 0, 0], 0);
      for (let line = 0; line < 2 + s * 2; line++) {
        let x = 4 + Math.floor(rr() * 8), y = 4 + Math.floor(rr() * 8);
        for (let k = 0; k < 3 + s; k++) { p(x, y, [20, 20, 20], 230); x = Math.max(0, Math.min(15, x + Math.round(rr() * 2 - 1))); y = Math.max(0, Math.min(15, y + Math.round(rr() * 2 - 1))); }
      }
    });
  }
  return cv;
}

const tileUV = (i) => { const c = i % 8, row = Math.floor(i / 8), e = 0.0008; return [c / 8 + e, 1 - (row + 1) / 4 + e, (c + 1) / 8 - e, 1 - row / 4 - e]; };

/** Icono isométrico de un bloque para la barra (o el arco). */
function blockIcon(atlas, id) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 48;
  const g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  if (id === BOW) {
    const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x * 3, y * 3, 3, 3); };
    for (let i = 0; i < 12; i++) { px(3 + i, 13 - i, "#e8e8e8"); }
    const arc = [[2, 12], [2, 11], [3, 9], [4, 7], [5, 5], [7, 4], [9, 3], [11, 2], [12, 2], [3, 10], [4, 8], [6, 4], [8, 3], [10, 2]];
    arc.forEach(([x, y]) => px(x, y, "#8a5a2b"));
    px(12, 3, "#5b3a1a"); px(3, 12, "#5b3a1a");
    for (let i = 0; i < 7; i++) px(5 + i, 10 - i, "#c9a36b");
    px(11, 3, "#bbb"); px(12, 4, "#bbb");
    return cv.toDataURL();
  }
  const [top, , side] = INFO[id].tex;
  const src = (t) => [(t % 8) * 16, Math.floor(t / 8) * 16];
  const draw = (t, tf, shade) => {
    g.save(); g.setTransform(...tf);
    const [sx, sy] = src(t);
    g.drawImage(atlas, sx, sy, 16, 16, 0, 0, 16, 16);
    if (shade) { g.fillStyle = `rgba(0,0,0,${shade})`; g.fillRect(0, 0, 16, 16); }
    g.restore();
  };
  draw(top, [1.3, 0.65, -1.3, 0.65, 24, 3], 0);
  draw(side, [1.3, 0.65, 0, 1.45, 3.2, 13.4], 0.25);
  draw(side, [1.3, -0.65, 0, 1.45, 24, 23.8], 0.42);
  return cv.toDataURL();
}

// ---------------------------------------------------------------------
// Geometría de los bloques
// ---------------------------------------------------------------------
const FACES = [
  { dir: [-1, 0, 0], shade: 0.78, c: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [1, 0, 0], shade: 0.78, c: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { dir: [0, -1, 0], shade: 0.5, c: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { dir: [0, 1, 0], shade: 1, c: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { dir: [0, 0, -1], shade: 0.64, c: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { dir: [0, 0, 1], shade: 0.64, c: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];
const AO = [0.45, 0.62, 0.8, 1];

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;

let current = null;

/** Abre el mundo de bloques encima de todo. opts = { lat, lon, place, t, lang } */
export async function openBlocks(opts) {
  if (current) return;
  const game = new BlockGame(opts);
  current = game;
  try { await game.init(); } catch (e) { console.error(e); game.fail(); }
}

export const blocksOpen = () => Boolean(current);
/** Para pruebas desde la consola. */
export const blocksGame = () => current;

class BlockGame {
  constructor({ lat, lon, place, t }) {
    this.lat = lat; this.lon = lon; this.place = place || `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
    this.t = t;
    this.seed = (Math.round(lat * 1000) * 73856093) ^ (Math.round(lon * 1000) * 19349663);
    this.saveKey = `nikolai.blocks.${lat.toFixed(3)},${lon.toFixed(3)}`;
    this.world = new Uint8Array(W * H * D);
    this.edits = new Map();
    this.chunks = [];
    this.dirty = new Set();
    this.audio = new BlockAudio();
    try { this.audio.musicOn = localStorage.getItem("nikolai.blocks.music") !== "0"; } catch { /* sin almacenamiento */ }
    this.touch = matchMedia("(pointer: coarse)").matches;
    this.keys = new Set();
    this.yaw = 0; this.pitch = 0;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.health = 20; this.kills = 0; this.flying = false; this.onGround = false;
    this.slot = 0; this.mining = null; this.miningHeld = false;
    this.time = 0.28; // mañana
    this.dragons = []; this.fireballs = []; this.arrows = [];
    this.running = false; this.paused = true; this.dead = false;
    this.listeners = [];
  }

  // ------------------------------------------------------------------
  // Arranque
  // ------------------------------------------------------------------
  async init() {
    const { t } = this;
    document.body.classList.add("in-blocks");
    this.root = document.createElement("div");
    this.root.className = "mc";
    this.root.innerHTML = `
      <canvas class="mc-cv"></canvas>
      <div class="mc-vignette"></div>
      <div class="mc-cross"></div>
      <div class="mc-top">
        <span class="mc-place">📍 ${esc(this.place)}</span>
        <span class="mc-coords mono"></span>
        <span class="mc-kills"></span>
        <button class="mc-btn mc-pause-btn" data-target>❚❚</button>
      </div>
      <div class="mc-boss" hidden><b></b><div class="mc-boss-bar"><i></i></div></div>
      <div class="mc-toast" hidden></div>
      <div class="mc-bottom">
        <div class="mc-name"></div>
        <div class="mc-hearts"></div>
        <div class="mc-hot">${HOTBAR.map((id, i) => `<button class="mc-slot" data-slot="${i}" data-target><img alt=""><small>${i + 1}</small></button>`).join("")}</div>
      </div>
      <div class="mc-touch" ${this.touch ? "" : "hidden"}>
        <div class="mc-joy"><i></i></div>
        <div class="mc-tbtns">
          <button class="mc-tb" data-tb="fly" data-target>🕊</button>
          <button class="mc-tb" data-tb="down" data-target>⤓</button>
          <button class="mc-tb mc-tb-jump" data-tb="jump" data-target>⤒</button>
        </div>
      </div>
      <div class="mc-menu">
        <div class="mc-card">
          <h2 class="mc-logo">NIKOLAI<span>CRAFT</span></h2>
          <p class="mc-sub">${esc(t("mc_world"))} <b>${esc(this.place)}</b></p>
          <p class="mc-load mono">${esc(t("mc_loading"))}</p>
          <div class="mc-actions" hidden>
            <button class="mc-big" data-act="play" data-target>${esc(t("mc_play"))}</button>
            <button class="mc-big" data-act="music" data-target></button>
            <button class="mc-big" data-act="reset" data-target>${esc(t("mc_reset"))}</button>
            <button class="mc-big" data-act="exit" data-target>${esc(t("mc_exit"))}</button>
          </div>
          <p class="mc-help">${esc(t(this.touch ? "mc_helpTouch" : "mc_help"))}</p>
        </div>
      </div>
      <div class="mc-dead" hidden><h2>${esc(t("mc_dead"))}</h2><button class="mc-big" data-act="respawn" data-target>${esc(t("mc_respawn"))}</button><button class="mc-big" data-act="exit" data-target>${esc(t("mc_exit"))}</button></div>`;
    document.body.appendChild(this.root);
    this.$ = (s) => this.root.querySelector(s);
    this.updateMusicBtn();
    this.root.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); this.action(b.dataset.act); }));
    await new Promise((r) => setTimeout(r, 30)); // que se pinte el menú antes de generar

    // Renderizador
    this.canvas = this.$(".mc-cv");
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: "high-performance" });
    } catch {
      this.$(".mc-load").textContent = t("mc_noWebgl");
      this.$(".mc-actions").hidden = false; this.$('[data-act="play"]').hidden = true;
      return;
    }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.touch ? 1.25 : 1.5));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.08, 400);
    this.camera.rotation.order = "YXZ";
    this.sky = new THREE.Color(0x7fb2ff);
    this.scene.background = this.sky;
    this.scene.fog = new THREE.Fog(this.sky, 40, 115);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1.1);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.4);
    this.scene.add(this.hemi, this.sun);

    this.atlasCanvas = makeAtlas();
    this.atlas = new THREE.CanvasTexture(this.atlasCanvas);
    this.atlas.magFilter = THREE.NearestFilter; this.atlas.minFilter = THREE.NearestFilter;
    this.atlas.generateMipmaps = false; this.atlas.colorSpace = THREE.SRGBColorSpace;
    this.matSolid = new THREE.MeshBasicMaterial({ map: this.atlas, vertexColors: true, alphaTest: 0.5 });
    this.matWater = new THREE.MeshBasicMaterial({ map: this.atlas, vertexColors: true, transparent: true, opacity: 0.78, depthWrite: false, side: THREE.DoubleSide });

    this.root.querySelectorAll(".mc-slot img").forEach((img, i) => { img.src = blockIcon(this.atlasCanvas, HOTBAR[i]); });

    // Altitud real del lugar (gratis, sin clave). Sin conexión se inventa.
    this.elev = await this.fetchElevation();
    this.generate();
    this.loadEdits();
    this.buildAll();
    this.makeSkyStuff();
    this.makeHelpers();
    this.spawnPlayer();
    for (let i = 0; i < 2; i++) this.dragons.push(new Dragon(this, i % 2 ? "fire" : "ender", i));

    this.$(".mc-load").textContent = this.elev == null ? t("mc_noElev") : `${t("mc_elev")}: ${Math.round(this.elev)} m · ${this.biomeName()}`;
    this.$(".mc-actions").hidden = false;
    this.bindInput();
    this.selectSlot(0, true);
    this.drawHearts();
    this.drawKills();
    this.resize();
    this.running = true;
    this.last = performance.now();
    this.saveTimer = setInterval(() => this.saveEdits(), 20000);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  fail() {
    if (this.$) { this.$(".mc-load").textContent = this.t("mc_noWebgl"); this.$(".mc-actions").hidden = false; }
  }

  async fetchElevation() {
    try {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 4500);
      const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${this.lat}&longitude=${this.lon}`, { signal: ctl.signal });
      clearTimeout(to);
      const j = await r.json();
      const e = j?.elevation?.[0];
      return typeof e === "number" ? e : null;
    } catch { return null; }
  }

  biomeName() {
    const { t } = this;
    return t("mc_b_" + this.biome);
  }

  // ------------------------------------------------------------------
  // Generación del terreno
  // ------------------------------------------------------------------
  generate() {
    const e = this.elev ?? 300 + hash(1, 2, this.seed) * 800;
    const absLat = Math.abs(this.lat);
    const temp = 1 - absLat / 66 - Math.max(0, e) / 4200;
    let base, amp, mount;
    if (e < 12) { base = SEA - 2; amp = 9; mount = 0; this.biome = "coast"; }
    else if (e < 400) { base = SEA + 4; amp = 7; mount = 0.1; this.biome = "plains"; }
    else if (e < 1500) { base = SEA + 6; amp = 11; mount = 0.35; this.biome = "hills"; }
    else if (e < 3000) { base = SEA + 8; amp = 12; mount = 0.6; this.biome = "highlands"; }
    else { base = SEA + 10; amp = 16; mount = 1; this.biome = "mountains"; }
    const cold = temp < 0.18;
    const tropical = absLat < 24 && !cold;
    if (cold) this.biome = "snow"; else if (tropical && this.biome !== "mountains") this.biome += "_tropical";
    this.cold = cold;
    const seed = this.seed;
    const R = rng(seed);
    this.heights = new Int16Array(W * D);
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      let h = base + (fbm(x / 48, z / 48, seed) - 0.5) * 2 * amp;
      const ridge = 1 - Math.abs(fbm(x / 70, z / 70, seed + 999) * 2 - 1);
      h += Math.pow(ridge, 3) * 22 * mount;
      h = clamp(Math.round(h), 4, H - 8);
      this.heights[z * W + x] = h;
      const snowLine = H - 16;
      for (let y = 0; y <= h; y++) {
        let id;
        if (y === 0) id = BEDROCK;
        else if (y < h - 3) {
          id = STONE;
          const o = hash(x * 7 + y, z * 13 - y, seed + 5);
          if (o < 0.012) id = COAL;
          else if (y < 12 && o > 0.9975) id = DIAMOND;
        } else if (y < h) id = h <= SEA + 1 ? SAND : DIRT;
        else id = h <= SEA + 1 ? (cold ? SNOW : SAND) : (cold || h >= snowLine) ? SNOW : GRASS;
        this.world[this.idx(x, y, z)] = id;
      }
      for (let y = h + 1; y <= SEA; y++) this.world[this.idx(x, y, z)] = WATER;
    }
    // Cuevas sencillas (gusanos) para que haya algo que explorar picando.
    for (let w = 0; w < 10; w++) {
      let x = R() * W, y = 6 + R() * 18, z = R() * D, a = R() * 6.28, b = 0;
      for (let s = 0; s < 70; s++) {
        a += (R() - 0.5) * 0.6; b = clamp(b + (R() - 0.5) * 0.3, -0.5, 0.5);
        x += Math.cos(a); z += Math.sin(a); y += b;
        const rad = 1.4 + R() * 1.2;
        for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
          const bx = Math.floor(x + dx), by = Math.floor(y + dy), bz = Math.floor(z + dz);
          if (dx * dx + dy * dy + dz * dz > rad * rad || by < 2 || !this.inside(bx, by, bz)) continue;
          const top = this.heights[bz * W + bx];
          if (by < top - 2 && this.world[this.idx(bx, by, bz)] !== WATER) this.world[this.idx(bx, by, bz)] = AIR;
        }
      }
    }
    // Árboles
    const density = tropical ? 0.03 : cold ? 0.008 : this.biome === "coast" ? 0.01 : 0.018;
    for (let z = 3; z < D - 3; z++) for (let x = 3; x < W - 3; x++) {
      const h = this.heights[z * W + x];
      const top = this.world[this.idx(x, h, z)];
      if ((top !== GRASS && top !== SNOW) || h + 9 >= H || hash(x, z, seed + 77) > density) continue;
      const tall = 4 + Math.floor(hash(z, x, seed + 3) * 3) + (tropical ? 2 : 0);
      for (let y = 1; y <= tall; y++) this.world[this.idx(x, h + y, z)] = LOG;
      const cy = h + tall;
      for (let dy = -2; dy <= 1; dy++) {
        const rad = dy >= 0 ? 1 : 2;
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy === 1 || hash(x + dx, z + dz + dy, seed) < 0.5)) continue;
          const bx = x + dx, by = cy + dy, bz = z + dz;
          if (this.inside(bx, by, bz) && this.world[this.idx(bx, by, bz)] === AIR) this.world[this.idx(bx, by, bz)] = LEAVES;
        }
      }
      this.world[this.idx(x, cy + 1, z)] = LEAVES;
    }
    // Un pequeño pilar de obsidiana como en el End, donde descansan los dragones.
    const px = 20 + Math.floor(R() * (W - 40)), pz = 20 + Math.floor(R() * (D - 40));
    const ph = this.heights[pz * W + px];
    for (let y = ph + 1; y < Math.min(H - 2, ph + 12); y++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) this.world[this.idx(px + dx, y, pz + dz)] = OBSIDIAN;
  }

  idx(x, y, z) { return (y * D + z) * W + x; }
  inside(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D; }
  get(x, y, z) {
    if (y < 0) return BEDROCK;
    if (x < 0 || z < 0 || x >= W || z >= D || y >= H) return AIR;
    return this.world[this.idx(x, y, z)];
  }
  /** Para chocar: fuera del mundo hay una pared invisible. */
  solidAt(x, y, z) {
    if (x < 0 || z < 0 || x >= W || z >= D || y < 0) return true;
    if (y >= H) return false;
    return INFO[this.world[this.idx(x, y, z)]].solid;
  }
  topY(x, z) {
    for (let y = H - 1; y >= 0; y--) { const b = this.get(x, y, z); if (b !== AIR && b !== LEAVES) return y; }
    return 0;
  }

  setBlock(x, y, z, id) {
    if (!this.inside(x, y, z)) return;
    const i = this.idx(x, y, z);
    if (this.world[i] === id) return;
    this.world[i] = id;
    if (this.edits.size < 40000 || this.edits.has(i)) this.edits.set(i, id);
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
    this.dirty.add(cx + "," + cz);
    if (x % CH === 0 && cx > 0) this.dirty.add(cx - 1 + "," + cz);
    if (x % CH === CH - 1 && cx < W / CH - 1) this.dirty.add(cx + 1 + "," + cz);
    if (z % CH === 0 && cz > 0) this.dirty.add(cx + "," + (cz - 1));
    if (z % CH === CH - 1 && cz < D / CH - 1) this.dirty.add(cx + "," + (cz + 1));
  }

  loadEdits() {
    try {
      const raw = JSON.parse(localStorage.getItem(this.saveKey) || "null");
      if (!Array.isArray(raw)) return;
      for (let k = 0; k < raw.length; k += 2) { const i = raw[k], id = raw[k + 1]; if (i >= 0 && i < this.world.length && INFO[id]) { this.world[i] = id; this.edits.set(i, id); } }
    } catch { /* guardado dañado: se ignora */ }
  }

  saveEdits() {
    try {
      const flat = [];
      for (const [i, id] of this.edits) flat.push(i, id);
      localStorage.setItem(this.saveKey, JSON.stringify(flat));
    } catch { /* almacenamiento lleno */ }
  }

  // ------------------------------------------------------------------
  // Mallas por trozos de 16 × 16
  // ------------------------------------------------------------------
  buildAll() {
    for (let cx = 0; cx < W / CH; cx++) { this.chunks[cx] = []; for (let cz = 0; cz < D / CH; cz++) this.buildChunk(cx, cz); }
  }

  buildChunk(cx, cz) {
    const old = this.chunks[cx][cz];
    if (old) for (const m of old) { this.scene.remove(m); m.geometry.dispose(); }
    const out = { solid: { p: [], uv: [], c: [], i: [] }, water: { p: [], uv: [], c: [], i: [] } };
    const opq = (x, y, z) => INFO[this.get(x, y, z)].opaque;
    for (let y = 0; y < H; y++) for (let z = cz * CH; z < cz * CH + CH; z++) for (let x = cx * CH; x < cx * CH + CH; x++) {
      const id = this.world[this.idx(x, y, z)];
      if (!id) continue;
      const info = INFO[id];
      const isWater = id === WATER;
      const tgt = isWater ? out.water : out.solid;
      for (const f of FACES) {
        const [dx, dy, dz] = f.dir;
        const n = this.get(x + dx, y + dy, z + dz);
        if (n !== AIR && (INFO[n].opaque || n === id)) continue;
        if (isWater && dy !== 1 && n !== AIR) continue;
        const tex = dy === 1 ? info.tex[0] : dy === -1 ? info.tex[1] : info.tex[2];
        const [u0, v0, u1, v1] = tileUV(tex);
        const base = tgt.p.length / 3;
        const axis = dx ? 0 : dy ? 1 : 2, t1 = (axis + 1) % 3, t2 = (axis + 2) % 3;
        const aos = [];
        for (const c of f.c) {
          let py = y + c[1];
          if (isWater && c[1] === 1 && this.get(x, y + 1, z) !== WATER) py -= 0.12;
          tgt.p.push(x + c[0], py, z + c[2]);
          tgt.uv.push(c[3] ? u1 : u0, c[4] ? v1 : v0);
          let ao = 3;
          if (!isWater) {
            const p = [x + dx, y + dy, z + dz];
            const s1 = [...p], s2 = [...p];
            s1[t1] += c[t1] ? 1 : -1; s2[t2] += c[t2] ? 1 : -1;
            const cr = [...s1]; cr[t2] += c[t2] ? 1 : -1;
            const a = opq(...s1), b = opq(...s2), k = opq(...cr);
            ao = a && b ? 0 : 3 - (a + b + k);
          }
          aos.push(ao);
          const lum = f.shade * AO[ao];
          const l2 = lum * lum;
          tgt.c.push(l2, l2, l2);
        }
        if (aos[0] + aos[3] > aos[1] + aos[2]) tgt.i.push(base, base + 1, base + 3, base, base + 3, base + 2);
        else tgt.i.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      }
    }
    const meshes = [];
    for (const [k, mat] of [["solid", this.matSolid], ["water", this.matWater]]) {
      const d = out[k];
      if (!d.i.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(d.p), 3));
      g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(d.uv), 2));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(d.c), 3));
      g.setIndex(new THREE.BufferAttribute(d.p.length / 3 > 65535 ? new Uint32Array(d.i) : new Uint16Array(d.i), 1));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      if (k === "water") m.renderOrder = 2;
      this.scene.add(m);
      meshes.push(m);
    }
    this.chunks[cx][cz] = meshes;
  }

  // ------------------------------------------------------------------
  // Cielo, sol, luna, nubes, estrellas, partículas
  // ------------------------------------------------------------------
  makeSkyStuff() {
    const square = (col, glow) => {
      const cv = document.createElement("canvas"); cv.width = cv.height = 32;
      const g = cv.getContext("2d");
      if (glow) { g.fillStyle = glow; g.fillRect(0, 0, 32, 32); }
      g.fillStyle = col; g.fillRect(8, 8, 16, 16);
      const tx = new THREE.CanvasTexture(cv); tx.magFilter = THREE.NearestFilter; tx.colorSpace = THREE.SRGBColorSpace;
      return new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ map: tx, transparent: true, fog: false, depthWrite: false }));
    };
    this.sunMesh = square("#fff6b0", "rgba(255,240,170,.25)");
    this.moonMesh = square("#dfe6f0", "rgba(200,210,230,.12)");
    this.scene.add(this.sunMesh, this.moonMesh);

    const cv = document.createElement("canvas"); cv.width = cv.height = 64;
    const g = cv.getContext("2d");
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (fbm(x / 9, y / 9, 3, 2) > 0.58) { g.fillStyle = "rgba(255,255,255,.85)"; g.fillRect(x, y, 1, 1); }
    const ct = new THREE.CanvasTexture(cv);
    ct.magFilter = THREE.NearestFilter; ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(4, 4);
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.set(W / 2, H + 18, D / 2);
    this.scene.add(this.clouds);

    const sp = [];
    for (let i = 0; i < 600; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random());
      sp.push(Math.sin(ph) * Math.cos(th) * 250, Math.cos(ph) * 250, Math.sin(ph) * Math.sin(th) * 250);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(sp), 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }));
    this.scene.add(this.stars);

    // Partículas (trozos de bloque, fuego, humo, magia del dragón).
    this.maxP = 700;
    this.pPos = new Float32Array(this.maxP * 3); this.pCol = new Float32Array(this.maxP * 3);
    this.pVel = new Float32Array(this.maxP * 3); this.pLife = new Float32Array(this.maxP); this.pGrav = new Float32Array(this.maxP);
    this.pNext = 0;
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(this.pPos, 3));
    pg.setAttribute("color", new THREE.BufferAttribute(this.pCol, 3));
    this.particles = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.14, vertexColors: true }));
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
    for (let i = 0; i < this.maxP; i++) this.pPos[i * 3 + 1] = -999;
  }

  particle(x, y, z, vx, vy, vz, [r, g, b], life = 0.8, grav = 14) {
    const i = this.pNext; this.pNext = (this.pNext + 1) % this.maxP;
    this.pPos.set([x, y, z], i * 3); this.pVel.set([vx, vy, vz], i * 3); this.pCol.set([r, g, b], i * 3);
    this.pLife[i] = life; this.pGrav[i] = grav;
  }

  blockColor(id) {
    const t = INFO[id].tex[2];
    const d = this.atlasCanvas.getContext("2d").getImageData((t % 8) * 16 + 6, Math.floor(t / 8) * 16 + 8, 4, 4).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255];
  }

  breakParticles(x, y, z, id) {
    const col = this.blockColor(id);
    for (let i = 0; i < 18; i++) {
      const c = col.map((v) => clamp(v * (0.75 + Math.random() * 0.5), 0, 1));
      this.particle(x + Math.random(), y + Math.random(), z + Math.random(), (Math.random() - 0.5) * 4, Math.random() * 4, (Math.random() - 0.5) * 4, c, 0.6 + Math.random() * 0.5);
    }
  }

  makeHelpers() {
    this.highlight = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }));
    this.highlight.visible = false;
    this.scene.add(this.highlight);
    const cg = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    this.crackUV = cg.attributes.uv.array.slice();
    this.crack = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ map: this.atlas, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    this.crack.visible = false;
    this.scene.add(this.crack);
    // Mano / bloque en la mano (vista en primera persona).
    this.hand = new THREE.Group();
    this.handBlock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial({ map: this.atlas }));
    this.handBow = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: 0x8a5a2b });
    for (let i = -3; i <= 3; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), wood); m.position.set(Math.abs(i) * 0.025, i * 0.1, 0); this.handBow.add(m); }
    const str = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.68, 0.008), new THREE.MeshBasicMaterial({ color: 0xdddddd })); str.position.x = 0.09; this.handBow.add(str);
    this.handBow.rotation.set(0, 0, 0.3);
    this.handBow.scale.setScalar(0.65);
    this.hand.add(this.handBlock, this.handBow);
    this.hand.position.set(0.4, -0.34, -0.62);
    this.camera.add(this.hand);
    this.scene.add(this.camera);
  }

  setHandBlock(id) {
    const bow = id === BOW;
    this.handBlock.visible = !bow; this.handBow.visible = bow;
    if (bow) return;
    const g = this.handBlock.geometry, uv = g.attributes.uv;
    // Orden de caras de BoxGeometry: +x, -x, +y, -y, +z, -z
    const faceTex = [2, 2, 0, 1, 2, 2].map((k) => INFO[id].tex[k]);
    for (let f = 0; f < 6; f++) {
      const [u0, v0, u1, v1] = tileUV(faceTex[f]);
      for (let v = 0; v < 4; v++) { const k = f * 4 + v; uv.setXY(k, lerp(u0, u1, this.crackUV[k * 2]), lerp(v0, v1, this.crackUV[k * 2 + 1])); }
    }
    uv.needsUpdate = true;
    this.handBlock.rotation.set(0.15, 0.7, 0);
  }

  setCrack(stage) {
    const uv = this.crack.geometry.attributes.uv;
    const [u0, v0, u1, v1] = tileUV(TX.crack0 + stage);
    for (let k = 0; k < uv.count; k++) uv.setXY(k, lerp(u0, u1, this.crackUV[k * 2]), lerp(v0, v1, this.crackUV[k * 2 + 1]));
    uv.needsUpdate = true;
  }

  spawnPlayer() {
    let best = null;
    for (let r = 0; r < 50 && !best; r += 2) for (let a = 0; a < 16 && !best; a++) {
      const x = Math.floor(W / 2 + Math.cos(a / 16 * 6.283) * r), z = Math.floor(D / 2 + Math.sin(a / 16 * 6.283) * r);
      const y = this.topY(x, z);
      const b = this.get(x, y, z);
      if (b !== WATER && b !== LOG && y < H - 3) best = [x, y, z];
    }
    const [x, y, z] = best || [W / 2, this.topY(W / 2, D / 2), D / 2];
    this.pos.set(x + 0.5, y + 1.01, z + 0.5);
    this.vel.set(0, 0, 0);
    this.fallStart = this.pos.y;
    this.health = 20;
    this.drawHearts();
  }

  // ------------------------------------------------------------------
  // Controles
  // ------------------------------------------------------------------
  on(target, ev, fn, opts) { target.addEventListener(ev, fn, opts); this.listeners.push([target, ev, fn, opts]); }

  bindInput() {
    // Teclado en fase de captura: así las teclas no llegan al resto de NIKOLAI mientras juegas.
    const keyHandler = (e) => {
      if (!this.running) return;
      e.stopPropagation();
      if (e.type === "keyup") { this.keys.delete(e.code); return; }
      if (["Space", "ArrowUp", "ArrowDown", "Tab"].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === "Space" && this.lastSpace && performance.now() - this.lastSpace < 280) this.toggleFly();
      if (e.code === "Space") this.lastSpace = performance.now();
      if (e.code === "KeyF") this.toggleFly();
      if (e.code === "KeyM") this.action("music");
      if (/^Digit[1-9]$/.test(e.code)) this.selectSlot(Number(e.code.slice(5)) - 1);
      if (e.code === "Escape" && this.paused && document.pointerLockElement !== this.canvas && !this.dead) this.action("exit");
    };
    this.on(window, "keydown", keyHandler, true);
    this.on(window, "keyup", keyHandler, true);
    this.on(window, "resize", () => this.resize());
    this.on(window, "blur", () => { this.keys.clear(); this.miningHeld = false; });
    this.on(document, "pointerlockchange", () => {
      if (document.pointerLockElement === this.canvas) this.setPaused(false);
      else if (!this.touch && !this.dead) this.setPaused(true);
    });
    this.on(this.canvas, "contextmenu", (e) => e.preventDefault());
    this.on(this.root, "wheel", (e) => { if (!this.paused) { e.preventDefault(); this.selectSlot((this.slot + (e.deltaY > 0 ? 1 : -1) + HOTBAR.length) % HOTBAR.length); } }, { passive: false });
    this.root.querySelectorAll(".mc-slot").forEach((b) => b.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.selectSlot(Number(b.dataset.slot)); }));
    this.$(".mc-pause-btn").addEventListener("click", (e) => { e.stopPropagation(); if (document.pointerLockElement) document.exitPointerLock(); this.setPaused(true); });

    if (!this.touch) {
      this.on(this.canvas, "mousedown", (e) => {
        if (this.paused || this.dead) return;
        if (document.pointerLockElement !== this.canvas && !this.noLock) { this.lock(); return; }
        if (e.button === 0) { this.miningHeld = true; this.attack(); }
        else if (e.button === 2) this.use();
      });
      this.on(window, "mouseup", (e) => { if (e.button === 0) this.miningHeld = false; });
      this.on(document, "mousemove", (e) => {
        // Sin bloqueo del puntero (algunos navegadores lo impiden) se mira arrastrando.
        if (document.pointerLockElement !== this.canvas && !(this.noLock && !this.paused && e.buttons)) return;
        this.yaw -= e.movementX * 0.0024;
        this.pitch = clamp(this.pitch - e.movementY * 0.0024, -1.55, 1.55);
      });
    } else this.bindTouch();
  }

  bindTouch() {
    // Mirar arrastrando · tocar = poner / disparar · mantener = romper.
    let look = null;
    this.on(this.canvas, "pointerdown", (e) => {
      if (this.paused || this.dead || look) return;
      look = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
      this.holdTimer = setTimeout(() => { if (look && look.moved < 14) { this.miningHeld = true; this.attack(); } }, 260);
    });
    this.on(window, "pointermove", (e) => {
      if (!look || e.pointerId !== look.id) return;
      const dx = e.clientX - look.x, dy = e.clientY - look.y;
      look.moved += Math.abs(dx) + Math.abs(dy);
      look.x = e.clientX; look.y = e.clientY;
      this.yaw -= dx * 0.0058;
      this.pitch = clamp(this.pitch - dy * 0.0058, -1.55, 1.55);
    });
    const end = (e) => {
      if (!look || e.pointerId !== look.id) return;
      clearTimeout(this.holdTimer);
      if (!this.miningHeld && performance.now() - look.t < 260 && look.moved < 14) {
        const hitDragon = this.attack(true);
        if (!hitDragon) this.use();
      }
      this.miningHeld = false;
      look = null;
    };
    this.on(window, "pointerup", end);
    this.on(window, "pointercancel", end);

    const joy = this.$(".mc-joy"), knob = joy.querySelector("i");
    let jid = null;
    this.joy = { x: 0, y: 0 };
    const setJoy = (e) => {
      const r = joy.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const m = Math.hypot(dx, dy), max = r.width / 2;
      if (m > max) { dx *= max / m; dy *= max / m; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy = { x: dx / max, y: dy / max };
    };
    joy.addEventListener("pointerdown", (e) => { e.stopPropagation(); jid = e.pointerId; joy.setPointerCapture(e.pointerId); setJoy(e); });
    joy.addEventListener("pointermove", (e) => { if (e.pointerId === jid) setJoy(e); });
    const jend = (e) => { if (e.pointerId !== jid) return; jid = null; this.joy = { x: 0, y: 0 }; knob.style.transform = ""; };
    joy.addEventListener("pointerup", jend); joy.addEventListener("pointercancel", jend);
    this.root.querySelectorAll("[data-tb]").forEach((b) => {
      const k = b.dataset.tb;
      b.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        if (k === "fly") { this.toggleFly(); return; }
        this.keys.add(k === "jump" ? "Space" : "ShiftLeft"); b.classList.add("on");
      });
      const up = () => { if (k !== "fly") { this.keys.delete(k === "jump" ? "Space" : "ShiftLeft"); b.classList.remove("on"); } };
      b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
    });
  }

  action(a) {
    this.audio.click();
    if (a === "play") {
      this.audio.start();
      if (this.touch) { this.setPaused(false); this.root.requestFullscreen?.().catch(() => {}); } else this.lock();
      if (!this.greeted) { this.greeted = true; setTimeout(() => { const d = this.dragons[0]; if (d) this.audio.roar(0.5, 0); this.toast(this.t("mc_dragonNear")); }, 2500); }
    } else if (a === "music") {
      this.audio.setMusic(!this.audio.musicOn);
      try { localStorage.setItem("nikolai.blocks.music", this.audio.musicOn ? "1" : "0"); } catch { /* nada */ }
      this.updateMusicBtn();
    } else if (a === "reset") {
      if (!confirm(this.t("mc_resetAsk"))) return;
      this.edits.clear();
      try { localStorage.removeItem(this.saveKey); } catch { /* nada */ }
      this.world.fill(0); this.generate(); this.buildAll(); this.spawnPlayer();
    } else if (a === "respawn") {
      this.dead = false; this.$(".mc-dead").hidden = true; this.spawnPlayer();
      if (this.touch) this.setPaused(false); else this.lock();
    } else if (a === "exit") this.destroy();
  }

  lock() {
    try {
      const r = this.canvas.requestPointerLock?.();
      if (!this.canvas.requestPointerLock) throw new Error("sin pointer lock");
      r?.catch?.(() => { this.noLock = true; this.setPaused(false); });
    } catch { this.noLock = true; this.setPaused(false); }
  }

  updateMusicBtn() { const b = this.$('[data-act="music"]'); if (b) b.textContent = `${this.t("mc_music")}: ${this.audio.musicOn ? this.t("mc_on") : this.t("mc_off")}`; }

  setPaused(p) {
    this.paused = p;
    this.$(".mc-menu").hidden = !p;
    if (p) { this.keys.clear(); this.miningHeld = false; this.$('[data-act="play"]').textContent = this.t(this.greeted ? "mc_resume" : "mc_play"); }
  }

  toggleFly() { this.flying = !this.flying; this.vel.y = 0; this.toast(this.t(this.flying ? "mc_flyOn" : "mc_flyOff")); this.root.querySelector('[data-tb="fly"]')?.classList.toggle("on", this.flying); }

  selectSlot(i, silent) {
    this.slot = i;
    this.root.querySelectorAll(".mc-slot").forEach((b, k) => b.classList.toggle("on", k === i));
    const id = HOTBAR[i];
    this.setHandBlock(id);
    const n = this.$(".mc-name");
    n.textContent = this.t(id === BOW ? "mc_bow" : "mcb_" + INFO[id].name);
    n.classList.remove("show"); void n.offsetWidth; n.classList.add("show");
    if (!silent) this.audio.click();
  }

  toast(txt) {
    const el = this.$(".mc-toast");
    el.textContent = txt; el.hidden = false;
    clearTimeout(this.toastT); this.toastT = setTimeout(() => { el.hidden = true; }, 2600);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer?.setSize(w, h, false);
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    this.handX = Math.min(0.4, (w / h) * 0.3); // en vertical la mano se acerca al centro para que se vea
  }

  // ------------------------------------------------------------------
  // Mirar, romper, poner, atacar
  // ------------------------------------------------------------------
  eye() { return new THREE.Vector3(this.pos.x, this.pos.y + (this.keys.has("ShiftLeft") && !this.flying && this.onGround ? 1.32 : 1.62), this.pos.z); }
  lookDir() { const cp = Math.cos(this.pitch); return new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp); }

  /** Rayo por la cuadrícula (DDA) hasta el primer bloque que se puede tocar. */
  raycast(maxD = 6) {
    const o = this.eye(), d = this.lookDir();
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
    const tdx = 1 / (Math.abs(d.x) || 1e-9), tdy = 1 / (Math.abs(d.y) || 1e-9), tdz = 1 / (Math.abs(d.z) || 1e-9);
    let tx = (sx > 0 ? x + 1 - o.x : o.x - x) * tdx, ty = (sy > 0 ? y + 1 - o.y : o.y - y) * tdy, tz = (sz > 0 ? z + 1 - o.z : o.z - z) * tdz;
    let n = [0, 0, 0], t = 0;
    while (t <= maxD) {
      const b = this.get(x, y, z);
      if (b !== AIR && b !== WATER) return { x, y, z, n, id: b, dist: t };
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; }
      else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
    }
    return null;
  }

  /** Golpe: primero dragones y bolas de fuego cercanas; si no, se empieza a picar. Devuelve true si golpeó algo vivo. */
  attack(onlyCreatures = false) {
    const o = this.eye(), d = this.lookDir();
    const hit = this.raycast();
    const maxD = Math.min(5, hit ? hit.dist : 5);
    for (const fb of this.fireballs) {
      const v = fb.mesh.position.clone().sub(o), along = v.dot(d);
      if (along > 0 && along < maxD + 1 && v.lengthSq() - along * along < 1) { fb.deflect(d); this.audio.arrowHit(); return true; }
    }
    for (const dr of this.dragons) {
      if (!dr.alive) continue;
      for (const s of dr.spheres()) {
        const v = s.p.clone().sub(o), along = v.dot(d);
        if (along > 0 && along < maxD + s.r && v.lengthSq() - along * along < s.r * s.r) {
          dr.damage(this.vel.y < -1 ? 6 : 4);
          this.swing();
          return true;
        }
      }
    }
    if (!onlyCreatures) this.swing();
    return false;
  }

  swing() { this.swingT = 0.25; }

  use() {
    const id = HOTBAR[this.slot];
    this.swing();
    if (id === BOW) { this.shoot(); return; }
    const hit = this.raycast();
    if (!hit) return;
    const x = hit.x + hit.n[0], y = hit.y + hit.n[1], z = hit.z + hit.n[2];
    if (!this.inside(x, y, z)) return;
    const cur = this.get(x, y, z);
    if (cur !== AIR && cur !== WATER) return;
    // No poner un bloque dentro del jugador.
    const p = this.pos;
    if (x + 1 > p.x - 0.3 && x < p.x + 0.3 && z + 1 > p.z - 0.3 && z < p.z + 0.3 && y + 1 > p.y && y < p.y + 1.8) return;
    this.setBlock(x, y, z, id);
    this.audio.place(INFO[id].snd);
  }

  shoot() {
    if (this.bowCd > 0) return;
    this.bowCd = 0.45;
    this.audio.bow();
    const d = this.lookDir();
    const o = this.eye().add(d.clone().multiplyScalar(0.6));
    this.arrows.push(new Arrow(this, o, d.multiplyScalar(38)));
    if (this.arrows.length > 25) this.arrows.shift().remove();
  }

  updateMining(dt) {
    const hit = this.raycast();
    this.highlight.visible = Boolean(hit);
    if (hit) this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    if (!this.miningHeld || !hit || HOTBAR[this.slot] === BOW) { this.mining = null; this.crack.visible = false; return; }
    const info = INFO[hit.id];
    if (!this.mining || this.mining.x !== hit.x || this.mining.y !== hit.y || this.mining.z !== hit.z) this.mining = { x: hit.x, y: hit.y, z: hit.z, p: 0, snd: 0 };
    if (!isFinite(info.hard)) return;
    const m = this.mining;
    m.p += dt / Math.max(0.05, info.hard * (this.onGround || this.flying ? 1 : 2.5));
    m.snd -= dt;
    if (m.snd <= 0) { this.audio.dig(info.snd); m.snd = 0.24; this.swing(); }
    this.crack.visible = true;
    this.crack.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    this.setCrack(Math.min(9, Math.floor(m.p * 10)));
    if (m.p >= 1) {
      this.audio.breakBlock(info.snd);
      this.breakParticles(hit.x, hit.y, hit.z, hit.id);
      // Si hay agua al lado, el hueco se llena.
      const wet = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]].some(([a, b, c]) => this.get(hit.x + a, hit.y + b, hit.z + c) === WATER);
      this.setBlock(hit.x, hit.y, hit.z, wet && hit.y <= SEA ? WATER : AIR);
      this.mining = null; this.crack.visible = false;
      if (hit.id === DIAMOND) { this.audio.levelUp(); this.toast(this.t("mc_diamond")); }
      else if (hit.id === COAL) this.audio.xp(2);
      if (this.touch) this.miningHeld = true;
    }
  }

  // ------------------------------------------------------------------
  // Física del jugador
  // ------------------------------------------------------------------
  collides(p) {
    const x0 = Math.floor(p.x - 0.3), x1 = Math.floor(p.x + 0.3 - 1e-6);
    const y0 = Math.floor(p.y), y1 = Math.floor(p.y + 1.8 - 1e-6);
    const z0 = Math.floor(p.z - 0.3), z1 = Math.floor(p.z + 0.3 - 1e-6);
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (this.solidAt(x, y, z)) return true;
    return false;
  }

  moveAxis(axis, d) {
    if (!d) return false;
    const p = this.pos;
    p[axis] += d;
    if (!this.collides(p)) return false;
    if (axis === "y") p.y = d > 0 ? Math.floor(p.y + 1.8) - 1.8 - 1e-3 : Math.floor(p.y) + 1;
    else p[axis] = d > 0 ? Math.floor(p[axis] + 0.3) - 0.3 - 1e-3 : Math.floor(p[axis] - 0.3) + 1 + 0.3 + 1e-3;
    return true;
  }

  updatePlayer(dt) {
    const k = this.keys;
    let fx = 0, fz = 0;
    if (k.has("KeyW") || k.has("ArrowUp")) fz -= 1;
    if (k.has("KeyS") || k.has("ArrowDown")) fz += 1;
    if (k.has("KeyA") || k.has("ArrowLeft")) fx -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) fx += 1;
    if (this.joy) { fx += this.joy.x; fz += this.joy.y; }
    const len = Math.hypot(fx, fz);
    if (len > 1) { fx /= len; fz /= len; }
    const feet = this.get(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.2), Math.floor(this.pos.z));
    const inWater = feet === WATER || this.get(Math.floor(this.pos.x), Math.floor(this.pos.y + 1), Math.floor(this.pos.z)) === WATER;
    if (inWater && !this.wasInWater && this.vel.y < -3) this.audio.splash();
    this.wasInWater = inWater;
    const sneak = k.has("ShiftLeft") || k.has("ShiftRight");
    const sprint = (k.has("ControlLeft") || k.has("KeyR") || (this.touch && Math.hypot(this.joy?.x || 0, this.joy?.y || 0) > 0.95)) && !sneak;
    const speed = this.flying ? (sprint ? 16 : 10) : inWater ? 2.6 : sneak ? 1.6 : sprint ? 5.8 : 4.4;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = (fx * cos + fz * sin) * speed, wz = (-fx * sin + fz * cos) * speed;
    const acc = this.onGround || this.flying ? 12 : 3.5;
    this.vel.x = lerp(this.vel.x, wx, Math.min(1, acc * dt));
    this.vel.z = lerp(this.vel.z, wz, Math.min(1, acc * dt));
    const jump = k.has("Space");
    if (this.flying) {
      this.vel.y = lerp(this.vel.y, (jump ? 8 : 0) - (sneak ? 8 : 0), Math.min(1, 10 * dt));
    } else if (inWater) {
      this.vel.y = Math.max(this.vel.y - 9 * dt, -3);
      if (jump) this.vel.y = Math.min(this.vel.y + 22 * dt, 3.2);
    } else {
      this.vel.y = Math.max(this.vel.y - 30 * dt, -50);
      if (jump && this.onGround) { this.vel.y = 8.6; this.onGround = false; }
    }
    // Se mueve por pasos cortos para no atravesar bloques a gran velocidad.
    const steps = Math.ceil(Math.max(Math.abs(this.vel.x), Math.abs(this.vel.y), Math.abs(this.vel.z)) * dt / 0.4) || 1;
    let hitY = false, hitXZ = false;
    const wasGround = this.onGround;
    for (let s = 0; s < steps; s++) {
      const sx = this.vel.x * dt / steps, sz = this.vel.z * dt / steps;
      // Agachado al borde no te caes.
      if (sneak && wasGround && !this.flying) {
        const test = (dx, dz) => { const p = this.pos.clone(); p.x += dx; p.z += dz; p.y -= 0.6; return this.collides(p); };
        if (!test(sx, 0)) this.vel.x = 0;
        if (!test(0, sz)) this.vel.z = 0;
      }
      if (this.moveAxis("x", this.vel.x * dt / steps)) { this.vel.x = 0; hitXZ = true; }
      if (this.moveAxis("z", this.vel.z * dt / steps)) { this.vel.z = 0; hitXZ = true; }
      if (this.moveAxis("y", this.vel.y * dt / steps)) { hitY = this.vel.y < 0 ? "down" : "up"; this.vel.y = 0; }
    }
    this.onGround = hitY === "down";
    if (this.onGround && this.flying && sneak) this.flying = false;
    // Salto automático en pantallas táctiles.
    if (this.touch && hitXZ && this.onGround && len > 0.3) this.vel.y = 8.6;
    // Caída
    if (this.onGround || inWater || this.flying) {
      if (!wasGround && this.onGround && !inWater && !this.flying) {
        const fall = this.fallStart - this.pos.y;
        if (fall > 3.5) { this.hurt(Math.floor(fall - 3)); this.audio.land(true); } else if (fall > 0.8) this.audio.land(false);
      }
      this.fallStart = this.pos.y;
    } else this.fallStart = Math.max(this.fallStart, this.pos.y);
    if (this.pos.y < -20) this.hurt(100);
    // Pasos
    const moved = Math.hypot(this.vel.x, this.vel.z) * dt;
    if (this.onGround && moved > 0) {
      this.stepAcc = (this.stepAcc || 0) + moved;
      this.bob = (this.bob || 0) + moved * 2.2;
      if (this.stepAcc > 1.7) {
        this.stepAcc = 0;
        const below = this.get(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.1), Math.floor(this.pos.z));
        if (INFO[below]?.snd) this.audio.step(INFO[below].snd);
      }
    }
    // Cámara
    const e = this.eye();
    const bob = this.onGround ? Math.sin(this.bob || 0) * 0.05 * Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 4) : 0;
    this.shake = Math.max(0, (this.shake || 0) - dt * 2);
    const sh = this.shake * 0.25;
    this.camera.position.set(e.x + (Math.random() - 0.5) * sh, e.y + bob + (Math.random() - 0.5) * sh, e.z + (Math.random() - 0.5) * sh);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.camera.fov = lerp(this.camera.fov, sprint && len > 0 ? 80 : 72, Math.min(1, dt * 8));
    this.camera.updateProjectionMatrix();
    // Mano
    this.swingT = Math.max(0, (this.swingT || 0) - dt);
    const sw = Math.sin((this.swingT / 0.25) * Math.PI);
    this.hand.position.set((this.handX || 0.4) - sw * 0.12, -0.34 + Math.abs(Math.cos(this.bob || 0)) * 0.02 - sw * 0.1, -0.62 - sw * 0.1);
    this.hand.rotation.x = -sw * 0.6;
    // Bajo el agua todo se ve azul.
    const head = this.get(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z));
    this.underwater = head === WATER;
    // Regeneración
    this.regen = (this.regen || 0) + dt;
    if (this.regen > 4 && this.health < 20 && performance.now() - (this.lastHurt || 0) > 5000) { this.regen = 0; this.health++; this.drawHearts(); }
  }

  hurt(n, from) {
    if (this.dead || n <= 0) return;
    this.health = Math.max(0, this.health - n);
    this.lastHurt = performance.now();
    this.audio.hurt();
    this.drawHearts();
    const v = this.$(".mc-vignette"); v.classList.remove("hit"); void v.offsetWidth; v.classList.add("hit");
    if (from) { const k = this.pos.clone().sub(from).setY(0).normalize().multiplyScalar(9); this.vel.x += k.x; this.vel.z += k.z; this.vel.y = 6; }
    this.shake = Math.max(this.shake || 0, 0.6);
    if (this.health <= 0) {
      this.dead = true;
      this.keys.clear(); this.miningHeld = false;
      if (document.pointerLockElement) document.exitPointerLock();
      this.$(".mc-dead").hidden = false;
      this.$(".mc-menu").hidden = true;
      this.paused = true;
    }
  }

  drawHearts() {
    const el = this.$(".mc-hearts");
    if (!el) return;
    let s = "";
    for (let i = 0; i < 10; i++) { const v = this.health - i * 2; s += `<i class="${v >= 2 ? "full" : v === 1 ? "half" : "empty"}"></i>`; }
    el.innerHTML = s;
  }

  drawKills() { this.$(".mc-kills").textContent = `🐉 ${this.kills}`; }

  /** Explosión: rompe bloques en una esfera y daña al jugador cercano. */
  explode(pos, r = 2.4, fromDragon = true) {
    const R = Math.ceil(r);
    for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) {
      const d = Math.hypot(dx, dy, dz);
      if (d > r * (0.7 + Math.random() * 0.3)) continue;
      const x = Math.floor(pos.x) + dx, y = Math.floor(pos.y) + dy, z = Math.floor(pos.z) + dz;
      const b = this.get(x, y, z);
      if (!UNBREAKABLE_BY_DRAGON.has(b) && this.inside(x, y, z)) this.setBlock(x, y, z, AIR);
    }
    for (let i = 0; i < 60; i++) {
      const fire = i % 2;
      this.particle(pos.x, pos.y, pos.z, (Math.random() - 0.5) * 12, Math.random() * 9, (Math.random() - 0.5) * 12, fire ? [1, 0.55 + Math.random() * 0.3, 0.1] : [0.4, 0.4, 0.42], 0.6 + Math.random() * 0.8, fire ? 4 : -1);
    }
    const c = this.pos.clone().setY(this.pos.y + 0.9);
    const d = c.distanceTo(pos);
    const [vol, pan] = this.spatial(pos);
    this.audio.explosion(vol, pan);
    this.shake = Math.max(this.shake || 0, clamp(1.2 - d / 25, 0, 1.2));
    if (fromDragon && d < r * 2.4) this.hurt(Math.round((1 - d / (r * 2.4)) * 13), pos);
  }

  /** Volumen y paneo de un sonido según dónde está respecto al jugador. */
  spatial(p) {
    const dx = p.x - this.pos.x, dy = p.y - this.pos.y, dz = p.z - this.pos.z;
    const d = Math.hypot(dx, dy, dz);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const pan = d > 0.1 ? (dx * rx + dz * rz) / d : 0;
    return [clamp(1 / (1 + d / 18), 0, 1), pan * 0.8];
  }

  // ------------------------------------------------------------------
  // Bucle
  // ------------------------------------------------------------------
  loop(now) {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    // Rehacer como mucho 3 trozos por cuadro.
    let n = 0;
    for (const key of this.dirty) { if (n++ >= 3) break; this.dirty.delete(key); const [cx, cz] = key.split(",").map(Number); this.buildChunk(cx, cz); }

    if (!this.paused) {
      this.bowCd = Math.max(0, (this.bowCd || 0) - dt);
      this.updatePlayer(dt);
      this.updateMining(dt);
      this.time = (this.time + dt / 600) % 1; // un día = 10 minutos
    } else if (!this.dead) {
      // En el menú la cámara gira despacio mostrando el lugar.
      this.yaw += dt * 0.05;
      const e = this.eye();
      this.camera.position.copy(e);
      this.camera.rotation.set(this.pitch, this.yaw, 0);
    }
    const simDt = this.paused ? 0 : dt;
    for (const d of this.dragons) d.update(simDt, now / 1000);
    for (const f of this.fireballs) f.update(simDt);
    this.fireballs = this.fireballs.filter((f) => !f.dead);
    for (const a of this.arrows) a.update(simDt);
    this.arrows = this.arrows.filter((a) => !a.dead);
    this.updateParticles(simDt || dt * 0.3);
    this.updateSky(dt);
    this.updateHud();
    this.renderer.render(this.scene, this.camera);
  }

  updateParticles(dt) {
    for (let i = 0; i < this.maxP; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      const k = i * 3;
      if (this.pLife[i] <= 0) { this.pPos[k + 1] = -999; continue; }
      this.pVel[k + 1] -= this.pGrav[i] * dt;
      this.pPos[k] += this.pVel[k] * dt; this.pPos[k + 1] += this.pVel[k + 1] * dt; this.pPos[k + 2] += this.pVel[k + 2] * dt;
      if (this.pGrav[i] > 0 && this.get(Math.floor(this.pPos[k]), Math.floor(this.pPos[k + 1]), Math.floor(this.pPos[k + 2])) !== AIR) { this.pVel[k] *= 0.3; this.pVel[k + 1] = 0; this.pVel[k + 2] *= 0.3; this.pPos[k + 1] = Math.ceil(this.pPos[k + 1]) + 0.02; }
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.geometry.attributes.color.needsUpdate = true;
  }

  updateSky(dt) {
    const ang = (this.time - 0.25) * Math.PI * 2; // 0.25 = amanecer, 0.5 = mediodía
    const sunY = Math.sin(ang), sunX = Math.cos(ang);
    const day = clamp(sunY * 2.2 + 0.35, 0, 1);
    const light = 0.22 + 0.78 * day;
    const dayC = new THREE.Color(0x7fb2ff), nightC = new THREE.Color(0x070a1c), dusk = new THREE.Color(0xf08a4b);
    const c = nightC.clone().lerp(dayC, day);
    const duskK = clamp(1 - Math.abs(sunY) * 4, 0, 1) * 0.55;
    c.lerp(dusk, duskK);
    if (this.underwater) c.set(0x1d3f8f);
    this.sky.copy(c);
    this.scene.fog.color.copy(c);
    this.scene.fog.near = this.underwater ? 2 : 40;
    this.scene.fog.far = this.underwater ? 22 : 115;
    this.matSolid.color.setScalar(light);
    this.matWater.color.setScalar(light);
    this.hemi.intensity = 0.35 + 0.9 * day; this.sun.intensity = 0.2 + 1.3 * day;
    const cam = this.camera.position;
    this.sunMesh.position.set(cam.x + sunX * 160, cam.y + sunY * 160, cam.z + 30);
    this.moonMesh.position.set(cam.x - sunX * 160, cam.y - sunY * 160, cam.z - 30);
    this.sunMesh.lookAt(cam); this.moonMesh.lookAt(cam);
    this.sun.position.set(sunX * 100, Math.max(0.2, sunY) * 100, 30);
    this.stars.position.copy(cam);
    this.stars.material.opacity = clamp(1 - day * 1.6, 0, 1);
    this.clouds.material.map.offset.x += dt * 0.0015;
    this.clouds.material.color.setScalar(0.35 + 0.65 * day);
    this.night = day < 0.3;
  }

  updateHud() {
    const p = this.pos;
    this.$(".mc-coords").textContent = `X ${Math.floor(p.x)}  Y ${Math.floor(p.y)}  Z ${Math.floor(p.z)}`;
    // Barra del jefe: el dragón vivo más cercano.
    let best = null, bd = 80;
    for (const d of this.dragons) if (d.alive) { const dist = d.pos.distanceTo(p); if (dist < bd) { bd = dist; best = d; } }
    const boss = this.$(".mc-boss");
    boss.hidden = !best;
    if (best) { boss.querySelector("b").textContent = this.t(best.kind === "fire" ? "mc_dragonFire" : "mc_dragonEnd"); boss.querySelector("i").style.width = `${(best.hp / best.maxHp) * 100}%`; boss.dataset.kind = best.kind; }
    this.root.classList.toggle("underwater", Boolean(this.underwater));
  }

  destroy() {
    this.running = false;
    this.saveEdits();
    clearInterval(this.saveTimer);
    if (document.pointerLockElement) document.exitPointerLock();
    if (document.fullscreenElement === this.root) document.exitFullscreen?.().catch(() => {});
    for (const [t, ev, fn, opts] of this.listeners) t.removeEventListener(ev, fn, opts);
    this.audio.stop();
    this.scene?.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); });
    this.renderer?.dispose();
    this.renderer?.forceContextLoss?.();
    this.root?.remove();
    document.body.classList.remove("in-blocks");
    current = null;
  }
}

// ---------------------------------------------------------------------
// Dragones
// ---------------------------------------------------------------------
const KINDS = {
  ender: { body: 0x16141c, belly: 0x2a2633, wing: 0x23202b, membrane: 0x3a3446, eye: 0xd35cff, hp: 80, speed: 13, fire: 0.6, particle: [0.75, 0.3, 1] },
  fire: { body: 0x7a1a12, belly: 0xc2611c, wing: 0x5a120c, membrane: 0x9c3a1a, eye: 0xffd43a, hp: 60, speed: 15, fire: 1, particle: [1, 0.5, 0.1] },
};

class Dragon {
  constructor(game, kind, n) {
    this.g = game; this.kind = kind; this.k = KINDS[kind];
    this.maxHp = this.k.hp; this.hp = this.maxHp;
    this.group = this.build();
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.respawn(n);
  }

  build() {
    const k = this.k;
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    this.mats = { body: mat(k.body), belly: mat(k.belly), wing: mat(k.wing), membrane: new THREE.MeshLambertMaterial({ color: k.membrane, side: THREE.DoubleSide }) };
    this.eyeMat = new THREE.MeshBasicMaterial({ color: k.eye, fog: false });
    const box = (w, h, d, m, x, y, z, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); parent.add(b); return b; };
    const root = new THREE.Group();
    const M = this.mats;
    // Cuerpo
    box(1.8, 1.4, 4.4, M.body, 0, 0, 0, root);
    box(1.4, 0.3, 3.6, M.belly, 0, -0.75, 0, root);
    for (let i = 0; i < 5; i++) box(0.22, 0.55, 0.35, M.belly, 0, 0.95, -1.6 + i * 0.8, root);
    // Patas
    for (const [x, z] of [[-0.8, 1.4], [0.8, 1.4], [-0.8, -1.4], [0.8, -1.4]]) { box(0.4, 1.1, 0.5, M.body, x, -1.1, z, root); box(0.5, 0.2, 0.7, M.belly, x, -1.7, z + 0.15, root); }
    // Cuello y cabeza
    this.neck = [];
    let parent = root, z = 2.4;
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Group(); seg.position.set(0, i === 0 ? 0.2 : 0.1, i === 0 ? z : 0.85); parent.add(seg);
      box(0.85, 0.85, 0.95, M.body, 0, 0, 0.45, seg); box(0.2, 0.35, 0.3, M.belly, 0, 0.55, 0.45, seg);
      this.neck.push(seg); parent = seg;
    }
    const head = new THREE.Group(); head.position.set(0, 0.1, 1.0); parent.add(head);
    box(1.3, 0.9, 1.4, M.body, 0, 0, 0.6, head);
    box(0.95, 0.5, 1.2, M.body, 0, -0.1, 1.85, head);
    box(0.2, 0.12, 0.2, M.belly, -0.25, 0.18, 2.4, head); box(0.2, 0.12, 0.2, M.belly, 0.25, 0.18, 2.4, head);
    box(0.25, 0.5, 0.25, M.belly, -0.4, 0.65, 0.2, head); box(0.25, 0.5, 0.25, M.belly, 0.4, 0.65, 0.2, head);
    box(0.32, 0.16, 0.1, this.eyeMat, -0.5, 0.2, 1.31, head); box(0.32, 0.16, 0.1, this.eyeMat, 0.5, 0.2, 1.31, head);
    this.jaw = new THREE.Group(); this.jaw.position.set(0, -0.35, 1.3); head.add(this.jaw);
    box(0.85, 0.22, 1.2, M.belly, 0, -0.1, 0.55, this.jaw);
    this.head = head;
    // Alas
    const wing = (side) => {
      const w = new THREE.Group(); w.position.set(side * 0.9, 0.5, 0.6); w.scale.x = side; root.add(w);
      box(4.6, 0.26, 0.36, M.wing, 2.3, 0, 0, w);
      box(4.6, 0.06, 2.8, M.membrane, 2.3, -0.02, -1.4, w);
      const tip = new THREE.Group(); tip.position.set(4.6, 0, 0); w.add(tip);
      box(3.8, 0.2, 0.3, M.wing, 1.9, 0, 0, tip);
      box(3.8, 0.05, 2.3, M.membrane, 1.9, -0.02, -1.15, tip);
      w.tip = tip;
      return w;
    };
    this.wingL = wing(1); this.wingR = wing(-1);
    // Cola
    this.tail = [];
    parent = root; let s = 1;
    for (let i = 0; i < 9; i++) {
      const seg = new THREE.Group(); seg.position.set(0, 0, i === 0 ? -2.2 : -0.85); parent.add(seg);
      box(0.8 * s, 0.8 * s, 0.9, M.body, 0, 0, -0.45, seg); box(0.15, 0.4 * s, 0.25, M.belly, 0, 0.55 * s, -0.45, seg);
      this.tail.push(seg); parent = seg; s *= 0.9;
    }
    const sc = this.kind === "fire" ? 0.85 : 1;
    root.scale.setScalar(sc);
    this.scale = sc;
    this.g.scene.add(root);
    return root;
  }

  respawn(n = 0) {
    const g = this.g;
    const a = Math.random() * Math.PI * 2;
    this.pos.set(W / 2 + Math.cos(a) * 90, H + 10 + n * 6, D / 2 + Math.sin(a) * 90);
    this.vel.set(-Math.cos(a), 0, -Math.sin(a)).multiplyScalar(this.k.speed);
    this.hp = this.maxHp; this.alive = true; this.dying = 0;
    this.state = "circle"; this.timer = 6 + Math.random() * 6 + n * 4; this.angle = a; this.radius = 26 + Math.random() * 14;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.fireCd = 4 + Math.random() * 4; this.growlCd = 5 + Math.random() * 8;
    this.group.visible = true; this.group.rotation.set(0, 0, 0);
    this.flash = 0; this.prevFlap = 0;
    g.scene.add(this.group);
  }

  spheres() {
    const p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), p3 = new THREE.Vector3();
    this.group.getWorldPosition(p1);
    this.head.getWorldPosition(p2);
    this.tail[3].getWorldPosition(p3);
    return [{ p: p1, r: 2.2 * this.scale }, { p: p2, r: 1.4 * this.scale }, { p: p3, r: 1 * this.scale }];
  }

  damage(n) {
    if (!this.alive || this.dying) return;
    this.hp -= n;
    this.flash = 0.2;
    const [vol, pan] = this.g.spatial(this.pos);
    this.g.audio.dragonHurt(vol, pan);
    // Al recibir un golpe se aleja y vuelve a dar vueltas.
    if (this.state === "dive") { this.state = "climb"; this.timer = 2.5; }
    if (this.hp <= 0) {
      this.hp = 0; this.dying = 3.2;
      this.g.audio.dragonDeath();
    }
  }

  update(dt, time) {
    const g = this.g;
    if (!this.alive) {
      this.timer -= dt;
      if (this.timer <= 0) { this.respawn(); g.toast(g.t("mc_dragonNear")); const [v, p] = g.spatial(this.pos); g.audio.roar(Math.max(0.3, v), p); }
      return;
    }
    if (this.dying) {
      this.dying -= dt;
      this.group.rotation.y += dt * 2.5;
      this.group.position.y += dt * 2;
      for (let i = 0; i < 6; i++) g.particle(this.pos.x + (Math.random() - 0.5) * 4, this.pos.y + (Math.random() - 0.5) * 3, this.pos.z + (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3, Math.random() * 6, (Math.random() - 0.5) * 3, this.k.particle, 1, -2);
      if (this.dying <= 0) {
        this.alive = false; this.group.visible = false; this.timer = 45;
        g.kills++; g.drawKills(); g.audio.xp(14); g.audio.levelUp(); g.toast(g.t("mc_dragonDown"));
      }
      return;
    }
    if (!dt) { this.pose(time); return; }
    const player = g.pos.clone().setY(g.pos.y + 1);
    const center = new THREE.Vector3(clamp(g.pos.x, 20, W - 20), 0, clamp(g.pos.z, 20, D - 20));
    const ground = g.topY(Math.floor(clamp(this.pos.x, 0, W - 1)), Math.floor(clamp(this.pos.z, 0, D - 1)));
    this.timer -= dt; this.fireCd -= dt; this.growlCd -= dt;
    let target;
    if (this.state === "circle") {
      this.angle += this.dir * (this.k.speed / this.radius) * dt;
      target = new THREE.Vector3(center.x + Math.cos(this.angle) * this.radius, Math.max(ground + 14, SEA + 18) + Math.sin(time * 0.7) * 3, center.z + Math.sin(this.angle) * this.radius);
      if (this.fireCd <= 0 && this.pos.distanceTo(player) < 60 && !g.paused) {
        this.fireCd = (7 + Math.random() * 6) / this.k.fire;
        const head = new THREE.Vector3(); this.head.getWorldPosition(head);
        const dir = player.clone().add(g.vel.clone().multiplyScalar(0.6)).sub(head).normalize();
        g.fireballs.push(new Fireball(g, head, dir));
        this.jawOpen = 0.6;
      }
      if (this.timer <= 0) { this.state = "dive"; this.timer = 6; const [v, p] = g.spatial(this.pos); g.audio.roar(v, p, this.kind === "fire" ? 1.15 : 1); this.jawOpen = 1.5; }
    } else if (this.state === "dive") {
      target = player;
      if (this.pos.distanceTo(player) < 2.6 * this.scale + 0.5) { g.hurt(this.kind === "fire" ? 5 : 6, this.pos); this.state = "climb"; this.timer = 3; }
      if (this.timer <= 0) { this.state = "climb"; this.timer = 3; }
      this.chewBlocks();
    } else {
      target = this.pos.clone().add(this.vel.clone().setY(0).normalize().multiplyScalar(20)).setY(ground + 26);
      if (this.timer <= 0) { this.state = "circle"; this.timer = 10 + Math.random() * 10; this.radius = 24 + Math.random() * 16; this.angle = Math.atan2(this.pos.z - center.z, this.pos.x - center.x); }
    }
    const speed = this.k.speed * (this.state === "dive" ? 1.35 : 1);
    const desired = target.clone().sub(this.pos).normalize().multiplyScalar(speed);
    const before = Math.atan2(this.vel.x, this.vel.z);
    this.vel.lerp(desired, Math.min(1, dt * (this.state === "dive" ? 1.6 : 1.1)));
    this.pos.addScaledVector(this.vel, dt);
    this.pos.y = Math.max(this.pos.y, SEA + 2);
    const after = Math.atan2(this.vel.x, this.vel.z);
    let turn = after - before; if (turn > Math.PI) turn -= Math.PI * 2; if (turn < -Math.PI) turn += Math.PI * 2;
    this.bank = lerp(this.bank || 0, clamp(-turn / dt * 0.5, -0.8, 0.8), Math.min(1, dt * 3));
    this.group.position.copy(this.pos);
    this.group.lookAt(this.pos.clone().add(this.vel));
    this.group.rotateZ(this.bank);
    if (this.growlCd <= 0) { this.growlCd = 8 + Math.random() * 10; const [v, p] = g.spatial(this.pos); g.audio.growl(v, p); }
    this.pose(time, dt);
  }

  pose(time, dt = 0) {
    const g = this.g;
    const rate = this.state === "dive" ? 3.6 : 2.2;
    const ph = time * rate * Math.PI;
    const flap = Math.sin(ph);
    this.wingL.rotation.z = flap * 0.75; this.wingR.rotation.z = -flap * 0.75;
    this.wingL.tip.rotation.z = Math.sin(ph - 0.8) * 0.5; this.wingR.tip.rotation.z = Math.sin(ph - 0.8) * 0.5;
    // Sonido del aleteo en cada bajada del ala.
    if (dt && this.prevFlap > 0 && flap <= 0) { const [v, p] = g.spatial(this.pos); g.audio.flap(v, p); }
    this.prevFlap = flap;
    this.tail.forEach((s, i) => { s.rotation.y = Math.sin(time * 2 - i * 0.55) * 0.14; s.rotation.x = Math.sin(time * 1.3 - i * 0.4) * 0.05; });
    this.neck.forEach((s, i) => { s.rotation.y = Math.sin(time * 1.2 - i * 0.4) * 0.08; s.rotation.x = (this.state === "dive" ? 0.08 : -0.05); });
    this.jawOpen = Math.max(0, (this.jawOpen || 0) - dt);
    this.jaw.rotation.x = Math.min(0.6, this.jawOpen) + Math.max(0, Math.sin(time * 1.7)) * 0.05;
    this.flash = Math.max(0, this.flash - dt);
    const f = this.flash > 0 ? 0.8 : 0;
    for (const m of Object.values(this.mats)) m.emissive.setRGB(f, 0, 0);
    this.eyeMat.color.setHex(this.k.eye);
  }

  /** En picada rompe los bloques que atraviesa (como el dragón del End). */
  chewBlocks() {
    const g = this.g;
    let n = 0;
    for (const s of this.spheres().slice(0, 2)) {
      const r = Math.ceil(s.r * 0.8);
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
        if (n > 14) return;
        const x = Math.floor(s.p.x) + dx, y = Math.floor(s.p.y) + dy, z = Math.floor(s.p.z) + dz;
        if (dx * dx + dy * dy + dz * dz > s.r * s.r) continue;
        const b = g.get(x, y, z);
        if (UNBREAKABLE_BY_DRAGON.has(b) || !g.inside(x, y, z)) continue;
        g.setBlock(x, y, z, AIR);
        if (n % 4 === 0) { g.breakParticles(x, y, z, b); const [v, p] = g.spatial(s.p); if (v > 0.2) g.audio.breakBlock(INFO[b].snd); }
        n++;
      }
    }
  }
}

// ---------------------------------------------------------------------
// Bolas de fuego y flechas
// ---------------------------------------------------------------------
class Fireball {
  constructor(game, pos, dir) {
    this.g = game;
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a, fog: false }));
    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), new THREE.MeshBasicMaterial({ color: 0xfff1a0, fog: false }));
    this.mesh.add(this.core);
    this.mesh.position.copy(pos);
    this.vel = dir.clone().multiplyScalar(17);
    this.life = 9; this.dead = false; this.friendly = false;
    game.scene.add(this.mesh);
    const [v, p] = game.spatial(pos);
    game.audio.fireball(v, p);
  }

  deflect(dir) {
    this.vel = dir.clone().multiplyScalar(26);
    this.friendly = true;
  }

  update(dt) {
    if (!dt || this.dead) return;
    const g = this.g, p = this.mesh.position;
    p.addScaledVector(this.vel, dt);
    this.life -= dt;
    this.mesh.rotation.y += dt * 8;
    g.particle(p.x, p.y, p.z, (Math.random() - 0.5), (Math.random() - 0.5) + 0.5, (Math.random() - 0.5), Math.random() < 0.5 ? [1, 0.6, 0.15] : [0.35, 0.35, 0.35], 0.5, -1);
    const pc = g.pos.clone().setY(g.pos.y + 0.9);
    let boom = this.life <= 0 || INFO[g.get(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))].solid || (!this.friendly && p.distanceTo(pc) < 1.1);
    if (this.friendly) {
      for (const d of g.dragons) if (d.alive && !d.dying && d.spheres().some((s) => s.p.distanceTo(p) < s.r + 0.4)) { d.damage(15); boom = true; }
    }
    if (boom) {
      this.dead = true;
      g.scene.remove(this.mesh);
      this.mesh.geometry.dispose(); this.core.geometry.dispose();
      g.explode(p.clone(), this.friendly ? 1.6 : 2.4, true);
    }
  }
}

class Arrow {
  constructor(game, pos, vel) {
    this.g = game;
    this.mesh = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.75), new THREE.MeshLambertMaterial({ color: 0x8b6b42 }));
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.12), new THREE.MeshLambertMaterial({ color: 0x9a9a9a }));
    tip.position.z = 0.4;
    const fl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.16), new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
    fl.position.z = -0.32;
    this.mesh.add(shaft, tip, fl);
    this.mesh.position.copy(pos);
    this.vel = vel; this.stuck = 0; this.dead = false; this.life = 6;
    game.scene.add(this.mesh);
  }

  remove() { this.dead = true; this.g.scene.remove(this.mesh); this.mesh.traverse((o) => o.geometry?.dispose?.()); }

  update(dt) {
    if (!dt || this.dead) return;
    const g = this.g, p = this.mesh.position;
    if (this.stuck) { this.life -= dt; if (this.life <= 0) this.remove(); return; }
    this.vel.y -= 16 * dt;
    const steps = 3;
    for (let s = 0; s < steps; s++) {
      p.addScaledVector(this.vel, dt / steps);
      for (const d of g.dragons) {
        if (!d.alive || d.dying) continue;
        if (d.spheres().some((sp) => sp.p.distanceTo(p) < sp.r)) {
          d.damage(Math.round(5 + this.vel.length() / 10));
          const [v, pan] = g.spatial(p); g.audio.arrowHit(pan);
          for (let i = 0; i < 8; i++) g.particle(p.x, p.y, p.z, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, [0.9, 0.1, 0.1], 0.5);
          this.remove(); return;
        }
      }
      for (const f of g.fireballs) if (!f.dead && f.mesh.position.distanceTo(p) < 0.9) { f.deflect(this.vel.clone().normalize()); this.remove(); return; }
      if (INFO[g.get(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))].solid) {
        this.stuck = true;
        const [v, pan] = g.spatial(p); if (v > 0.15) g.audio.arrowHit(pan);
        return;
      }
    }
    this.mesh.lookAt(p.clone().add(this.vel));
    if (p.y < -10 || p.distanceTo(g.pos) > 160) this.remove();
  }
}
