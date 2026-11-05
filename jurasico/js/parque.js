// Parque Valle Jurásico — complejo turístico original dentro del valle:
// centro de visitantes, centro de control con oficinas, hotel, laboratorio,
// recintos con cercas eléctricas, monorraíl, jeeps de safari, helipuerto, muelle y puerta principal.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

const V3 = THREE.Vector3;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const PAD = 8; // altura del terreno nivelado del complejo
export const RESORT = { x: 170, z: 140, r: 112, fall: 50 };
export const PADDOCKS = [
  { id: 'sauro', name: 'Recinto de saurópodos', x: 30, z: -130, r: 95, kind: 'fence' },
  { id: 'stego', name: 'Recinto de estegosaurios', x: 345, z: 85, r: 58, kind: 'fence' },
  { id: 'allo', name: 'Recinto del Allosaurus', x: 265, z: -55, r: 48, kind: 'wall', view: [215, -22] },
];
const GATE = { x: 178, z: 265 };
const ENTRY = [[180, 300], [178, 265], [174, 215], [171, 185], [170, 163]];
const LOOP = [[162, 163], [148, 140], [132, 112], [100, 88], [84, 40], [95, -15], [112, -38], [150, -35], [185, -22], [215, -22],
  [250, 10], [278, 48], [275, 105], [252, 128], [215, 138], [192, 141], [178, 163]];
const MONO = [[140, 58], [122, 5], [105, -40], [65, -38], [20, -25]];

export const ZONES = [
  { name: 'Plaza central del Parque Valle Jurásico', x: 170, z: 140, r: 24 },
  { name: 'Centro de visitantes', x: 170, z: 90, r: 18 },
  { name: 'Centro de control y oficinas', x: 110, z: 145, r: 14 },
  { name: 'Hotel Valle', x: 232, z: 172, r: 22 },
  { name: 'Laboratorio', x: 120, z: 195, r: 16 },
  { name: 'Helipuerto', x: 225, z: 95, r: 12 },
  { name: 'Puerta principal del parque', x: GATE.x, z: GATE.z, r: 16 },
  { name: 'Mirador del Allosaurus', x: 215, z: -22, r: 16 },
  { name: 'Estación del monorraíl', x: 140, z: 58, r: 12 },
  { name: 'Estación Mirador de saurópodos', x: 20, z: -25, r: 12 },
];

// distancia de un punto a una polilínea
function distPoly(x, z, pts) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

// el terreno del complejo se nivela antes de recortar la costa
export function flattenPark(x, z, h) {
  const d = Math.hypot(x - RESORT.x, z - RESORT.z);
  const k = 1 - smooth(RESORT.r, RESORT.r + RESORT.fall, d);
  return h + (PAD - h) * k;
}

// zonas donde no deben crecer árboles ni plantas
export function parkClear(x, z) {
  if (Math.hypot(x - RESORT.x, z - RESORT.z) < RESORT.r + 6) return false;
  for (const p of PADDOCKS) if (Math.abs(Math.hypot(x - p.x, z - p.z) - p.r) < 5) return false;
  if (distPoly(x, z, LOOP) < 7 || distPoly(x, z, ENTRY) < 7 || distPoly(x, z, MONO) < 4) return false;
  if (Math.abs(z - GATE.z) < 5 && Math.abs(x - GATE.x) < 50) return false;
  if (Math.abs(x - 182) < 8 && z > 300) return false;
  return true;
}
// los dinosaurios salvajes no entran al complejo ni a los recintos; los del parque no salen
export function dinoAllowed(x, z, zone) {
  if (zone) return Math.hypot(x - zone.x, z - zone.z) < zone.r - 7;
  if (Math.hypot(x - RESORT.x, z - RESORT.z) < RESORT.r + 25) return false;
  for (const p of PADDOCKS) if (Math.hypot(x - p.x, z - p.z) < p.r + 10) return false;
  if (Math.abs(z - GATE.z) < 12 && Math.abs(x - GATE.x) < 55) return false;
  return true;
}

// ───────────────────────── texturas de texto ─────────────────────────
function textTex(lines, { w = 1024, h = 192, bg = '#2a2017', fg = '#f2c46d', font = 'bold 120px system-ui', border = '#f2c46d', stripes = false } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  if (stripes) {
    c.fillStyle = '#111';
    for (let x = -h; x < w; x += 60) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 30, h); c.lineTo(x + 30 + h * 0.5, h * 0.78); c.lineTo(x + h * 0.5, h * 0.78); c.fill(); }
  }
  if (border) { c.strokeStyle = border; c.lineWidth = h * 0.05; c.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12); }
  c.fillStyle = fg; c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle';
  const lh = h / (lines.length + (stripes ? 0.6 : 0));
  lines.forEach((t, i) => c.fillText(t, w / 2, lh * (i + 0.5) + (stripes ? -h * 0.06 : 0), w * 0.9));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function buildPark(ctx) {
  const { scene, groundH, paint, addCollider, addWall, addPlatform, holoGeom, monitorTex } = ctx;
  const night = []; // {m, day, night}
  const anims = [];
  const movers = [];
  const mapRects = [];

  const M = {
    solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    wood: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.7 }),
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.04, metalness: 0.4, transparent: true, opacity: 0.32, depthWrite: false }),
    lit: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: 0xffe2a8, emissiveIntensity: 0.2 }),
    win: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.5, emissive: 0xffd28a, emissiveIntensity: 0 }),
  };
  night.push({ m: M.lit, day: 0.25, night: 3 }, { m: M.win, day: 0, night: 0.9 });
  const lists = new Map();
  const add = (mat, g) => { if (!lists.has(mat)) lists.set(mat, []); lists.get(mat).push(g); };
  const P = (g, rgb) => paint(g, rgb, { jitter: 0 });
  function box(mat, w, h, d, x, y, z, rgb, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    g.translate(x, y + h / 2, z);
    add(mat, P(g, rgb));
  }
  function cyl(mat, rt, rb, h, x, y, z, rgb, seg = 12) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(x, y + h / 2, z); add(mat, P(g, rgb));
  }
  function solidRect(x0, z0, x1, z1, top) {
    addWall(x0, z0, x1, z0, 0.6, top); addWall(x1, z0, x1, z1, 0.6, top); addWall(x1, z1, x0, z1, 0.6, top); addWall(x0, z1, x0, z0, 0.6, top);
    mapRects.push([x0, z0, x1, z1]);
  }
  // muro alineado a un eje con huecos (puertas y ventanas). ops: [{a, b, ys:[[y0,y1]], door}]
  function wall(ax, az, bx, bz, h, t, rgb, ops = [], base = PAD, mat = M.solid) {
    const alongX = az === bz, L = alongX ? bx - ax : bz - az;
    const seg = (s0, s1, y0, y1, m = mat, col = rgb, th = t) => {
      if (s1 - s0 < 0.01 || y1 - y0 < 0.01) return;
      const c = (s0 + s1) / 2, len = s1 - s0;
      if (alongX) box(m, len, y1 - y0, th, ax + c, base + y0, az, col); else box(m, th, y1 - y0, len, ax, base + y0, az + c, col);
    };
    let cur = 0;
    for (const o of ops) {
      seg(cur, o.a, 0, h);
      let y = 0;
      for (const [y0, y1] of o.ys) {
        seg(o.a, o.b, y, y0);
        if (!o.door) {
          seg(o.a, o.b, y0, y1, M.glass, [0.62, 0.78, 0.84], t * 0.25);
          seg(o.a, o.b, y0 - 0.12, y0, M.metal, [0.25, 0.25, 0.25], t * 1.1);
        }
        y = y1;
      }
      seg(o.a, o.b, y, h);
      cur = o.b;
    }
    seg(cur, L, 0, h);
    // colisión: todo el muro salvo las puertas
    let c0 = 0;
    const solidSeg = (s0, s1) => { if (s1 - s0 > 0.05) alongX ? addWall(ax + s0, az, ax + s1, az, t, base + h) : addWall(ax, az + s0, ax, az + s1, t, base + h); };
    for (const o of ops.filter((o) => o.door)) { solidSeg(c0, o.a); c0 = o.b; }
    solidSeg(c0, L);
  }
  function sign(lines, W, H, x, y, z, ry, opt = {}, glow = 0.15) {
    const tex = textTex(lines, opt);
    const m = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: glow, roughness: 0.6 });
    night.push({ m, day: glow, night: opt.nightGlow ?? 1.1 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), m);
    mesh.position.set(x, y, z); mesh.rotation.y = ry;
    scene.add(mesh);
    return mesh;
  }
  function lamp(x, z, h = 4.6, base) {
    const y = base ?? groundH(x, z);
    cyl(M.metal, 0.07, 0.1, h, x, y, z, [0.15, 0.15, 0.14], 6);
    const g = new THREE.SphereGeometry(0.32, 10, 8); g.translate(x, y + h + 0.1, z); add(M.lit, P(g, [1, 0.95, 0.85]));
    addCollider(x, z, 0.2);
  }

  const STONE = [0.74, 0.68, 0.56], STONE_D = [0.52, 0.47, 0.39], TIMBER = [0.36, 0.26, 0.17], WHITE = [0.88, 0.87, 0.84], CONC = [0.66, 0.65, 0.62], DARK = [0.13, 0.13, 0.13];

  // ── Plaza central y fuente ──
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const c = cv.getContext('2d');
    c.fillStyle = '#b9ad95'; c.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const v = 165 + Math.random() * 40; c.fillStyle = `rgb(${v},${v * 0.94},${v * 0.82})`;
      c.fillRect(x * 32 + 1.5, y * 32 + 1.5, 29, 29);
    }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 7); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(25, 64), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
    plaza.rotation.x = -Math.PI / 2; plaza.position.set(RESORT.x, PAD + 0.06, RESORT.z); plaza.receiveShadow = true;
    scene.add(plaza);
    const basin = new THREE.CylinderGeometry(6.2, 6.5, 0.9, 40); basin.translate(RESORT.x, PAD + 0.45, RESORT.z); add(M.solid, P(basin, STONE));
    const water = new THREE.Mesh(new THREE.CircleGeometry(5.8, 40), new THREE.MeshStandardMaterial({ color: 0x2c8fa8, roughness: 0.05, metalness: 0.2 }));
    water.rotation.x = -Math.PI / 2; water.position.set(RESORT.x, PAD + 0.92, RESORT.z); scene.add(water);
    cyl(M.solid, 0.5, 0.8, 2.4, RESORT.x, PAD + 0.9, RESORT.z, STONE_D, 16);
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.6, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.45, emissive: 0x9fd8ff, emissiveIntensity: 0.15, side: THREE.DoubleSide, depthWrite: false }));
    jet.position.set(RESORT.x, PAD + 3.3 + 1.8, RESORT.z); jet.rotation.x = Math.PI; scene.add(jet);
    anims.push((dt, t) => { jet.scale.set(1 + Math.sin(t * 7) * 0.05, 1 + Math.sin(t * 5.3) * 0.06, 1 + Math.cos(t * 7) * 0.05); });
    addCollider(RESORT.x, RESORT.z, 6.4);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.13;
      const x = RESORT.x + Math.cos(a) * 26.5, z = RESORT.z + Math.sin(a) * 26.5;
      if (Math.abs(Math.sin(a)) > 0.93) continue; // hueco para los caminos
      lamp(x, z, 4.6, PAD);
    }
  }

  // ── Centro de visitantes (52 × 30 m, entrada hacia la plaza) ──
  {
    const x0 = 144, x1 = 196, z0 = 75, z1 = 105, H = 14, cx = 170, cz = 90;
    box(M.solid, 52, 0.25, 30, cx, PAD - 0.2, cz, [0.8, 0.77, 0.7]);
    wall(x0, z0, x1, z0, H, 0.8, STONE);
    wall(x0, z0, x0, z1, H, 0.8, STONE, [{ a: 6, b: 24, ys: [[2, 11]] }]);
    wall(x1, z0, x1, z1, H, 0.8, STONE, [{ a: 6, b: 24, ys: [[2, 11]] }]);
    wall(x0, z1, x1, z1, H, 0.5, STONE, [{ a: 1.5, b: 21.5, ys: [[0.7, 12.8]] }, { a: 22, b: 30, ys: [[0, 4.6]], door: true }, { a: 30.5, b: 50.5, ys: [[0.7, 12.8]] }]);
    for (let x = x0 + 5.5; x < x1 - 1; x += 4) if (x < 166 || x > 174) box(M.metal, 0.18, 12.2, 0.6, x, PAD + 0.6, z1, [0.2, 0.2, 0.2]);
    // cubierta con lucernario
    const R = PAD + H;
    box(M.wood, 58, 0.8, 12, cx, R, 78, TIMBER); box(M.wood, 58, 0.8, 12, cx, R, 102, TIMBER);
    box(M.wood, 19, 0.8, 12, 150.5, R, cz, TIMBER); box(M.wood, 19, 0.8, 12, 189.5, R, cz, TIMBER);
    box(M.glass, 20, 2.2, 12, cx, R, cz, [0.7, 0.85, 0.9]);
    for (let x = 161; x <= 179; x += 4.5) box(M.metal, 0.2, 0.3, 12, x, R + 2.0, cz, [0.2, 0.2, 0.2]);
    for (const x of [146.5, 158, 182, 193.5]) box(M.wood, 0.8, H, 0.8, x, PAD, 107.2, TIMBER);
    // interior: holograma de Brachiosaurus, recepción, bancos y estandartes
    cyl(M.solid, 5, 5.3, 0.8, cx, PAD, 88, [0.32, 0.3, 0.28], 40);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.12, 8, 64), M.lit); ring.rotation.x = -Math.PI / 2; ring.position.set(cx, PAD + 0.85, 88); scene.add(ring);
    const holo = new THREE.Mesh(holoGeom, new THREE.MeshBasicMaterial({ color: 0x5fe0ff, wireframe: true, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    holo.scale.setScalar(0.52); holo.position.set(cx - 0.5, PAD + 0.85, 88);
    scene.add(holo);
    anims.push((dt, t) => { holo.rotation.y += dt * 0.25; holo.material.opacity = 0.3 + Math.sin(t * 3) * 0.06; });
    box(M.wood, 11, 1.1, 1.4, cx, PAD, 79.5, [0.45, 0.32, 0.2]);
    box(M.solid, 11.4, 0.08, 1.8, cx, PAD + 1.1, 79.5, [0.85, 0.8, 0.7]);
    for (const x of [152, 188]) for (const z of [86, 94]) box(M.wood, 4, 0.5, 1, x, PAD, z, [0.4, 0.3, 0.2]);
    sign(['VALLE', 'JURÁSICO'], 4, 9, 149, PAD + 7.5, 75.5, 0, { w: 256, h: 576, font: 'bold 64px system-ui', bg: '#3d2414' }, 0.3);
    sign(['150', 'MILLONES', 'DE AÑOS'], 4, 9, 191, PAD + 7.5, 75.5, 0, { w: 256, h: 576, font: 'bold 56px system-ui', bg: '#3d2414' }, 0.3);
    sign(['RECEPCIÓN'], 6, 1.1, cx, PAD + 3.4, 75.45, 0, { w: 512, h: 96, font: 'bold 60px system-ui' }, 0.3);
    const light = new THREE.PointLight(0xffefd6, 900, 45, 2); light.position.set(cx, PAD + 11, cz); scene.add(light);
    sign(['CENTRO DE VISITANTES'], 22, 2.4, cx, PAD + 9.6, z1 + 0.32, 0, {}, 0.25);
    mapRects.push([x0, z0, x1, z1]);
  }

  // ── Centro de control y oficinas (2 plantas) ──
  {
    const x0 = 99, x1 = 121, z0 = 128, z1 = 162, H = 8, cx = 110, cz = 145;
    box(M.solid, 22, 0.25, 34, cx, PAD - 0.2, cz, [0.55, 0.56, 0.58]);
    const upper = { a: 1.5, b: 32.5, ys: [[5, 7.2]] };
    wall(x0, z0, x0, z1, H, 0.6, CONC, [{ a: 1.5, b: 32.5, ys: [[1.2, 3.2], [5, 7.2]] }]);
    wall(x1, z0, x1, z1, H, 0.6, CONC, [{ a: 1.5, b: 11.5, ys: [[1.0, 3.2], [5, 7.2]] }, { a: 13, b: 17, ys: [[0, 3.2]], door: true }, { a: 18.5, b: 32.5, ys: [[1.0, 3.2], [5, 7.2]] }]);
    wall(x0, z0, x1, z0, H, 0.6, CONC, [{ a: 1.5, b: 20.5, ys: [[5, 7.2]] }]);
    wall(x0, z1, x1, z1, H, 0.6, CONC, [{ a: 1.5, b: 20.5, ys: [[1.2, 3.2], [5, 7.2]] }]);
    void upper;
    box(M.solid, 22, 0.3, 34, cx, PAD + 4, cz, [0.85, 0.85, 0.83]);
    box(M.solid, 22.8, 0.5, 34.8, cx, PAD + H, cz, [0.4, 0.4, 0.4]);
    for (let z = z0 + 3; z < z1 - 2; z += 4) box(M.lit, 3, 0.06, 0.6, cx, PAD + 3.92, z, [1, 1, 1]);
    // tabique entre la sala de control y las oficinas
    wall(x0, 150, x1, 150, 4, 0.2, [0.8, 0.8, 0.78], [{ a: 3.5, b: 6.5, ys: [[0, 3]], door: true }, { a: 8, b: 20.5, ys: [[1.0, 3.2]] }]);
    // sala de control: pantalla gigante y tres filas de puestos con monitores en vivo
    const scr = new THREE.MeshBasicMaterial({ map: monitorTex, toneMapped: false });
    const vw = new THREE.Mesh(new THREE.PlaneGeometry(15, 3.1), scr); vw.position.set(x0 + 0.36, PAD + 2.2, 139); vw.rotation.y = Math.PI / 2; scene.add(vw);
    box(M.metal, 0.2, 3.5, 15.6, x0 + 0.3, PAD + 0.45, 139, DARK);
    for (const dx of [105, 110.5, 116]) {
      box(M.solid, 1.1, 0.78, 13, dx, PAD, 139.5, [0.22, 0.23, 0.25]);
      for (let z = 134.5; z <= 145; z += 2.6) {
        const mon = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.55), scr); mon.position.set(dx - 0.15, PAD + 1.15, z); mon.rotation.y = -Math.PI / 2; scene.add(mon);
        box(M.metal, 0.06, 0.62, 1.02, dx - 0.11, PAD + 0.84, z, DARK);
        box(M.solid, 0.55, 0.9, 0.55, dx + 1.1, PAD, z, [0.12, 0.2, 0.35]);
      }
    }
    // oficinas
    for (const [ox, oz] of [[103, 155], [109.5, 158.5], [116, 155]]) {
      box(M.wood, 1.8, 0.76, 0.9, ox, PAD, oz, [0.5, 0.36, 0.22]);
      box(M.metal, 0.6, 0.4, 0.05, ox, PAD + 0.8, oz - 0.25, DARK);
      box(M.win, 0.54, 0.34, 0.02, ox, PAD + 0.83, oz - 0.22, [0.25, 0.45, 0.65]);
      box(M.solid, 0.55, 0.95, 0.55, ox, PAD, oz + 0.85, [0.15, 0.15, 0.17]);
    }
    for (let x = 100; x <= 104; x += 1) box(M.metal, 0.9, 1.4, 0.6, x + 0.2, PAD, 161.3, [0.5, 0.5, 0.52]);
    cyl(M.solid, 0.3, 0.25, 0.5, 119.8, PAD, 160.8, [0.5, 0.3, 0.2], 10);
    { const g = new THREE.SphereGeometry(0.6, 10, 8); g.translate(119.8, PAD + 1.1, 160.8); add(M.solid, P(g, [0.2, 0.42, 0.15])); }
    const l = new THREE.PointLight(0xe6efff, 350, 28, 2); l.position.set(cx, PAD + 3.5, 139); scene.add(l);
    // azotea: antena y parabólica
    cyl(M.metal, 0.12, 0.2, 10, 104, PAD + H, 132, [0.6, 0.6, 0.6], 8);
    { const g = new THREE.SphereGeometry(2.4, 18, 8, 0, Math.PI * 2, 0, 1.05); g.rotateX(-0.9); g.translate(115, PAD + H + 2.5, 156); add(M.metal, P(g, [0.85, 0.85, 0.85])); }
    cyl(M.metal, 0.15, 0.2, 2, 115, PAD + H, 156, [0.5, 0.5, 0.5], 8);
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
    blink.position.set(104, PAD + H + 10.2, 132); scene.add(blink);
    anims.push((dt, t) => { blink.visible = Math.sin(t * 3) > 0; });
    sign(['CENTRO DE CONTROL'], 12, 1.5, x1 + 0.34, PAD + 4.55, cz, Math.PI / 2, {}, 0.25);
    mapRects.push([x0, z0, x1, z1]);
  }

  // ── Hotel Valle (9 plantas) y piscina ──
  {
    const x0 = 222, x1 = 242, z0 = 157, z1 = 173, H = 31, cx = 232, cz = 165;
    const floors = 9, cols = 8;
    const mk = (lit) => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 768;
      const c = cv.getContext('2d');
      c.fillStyle = lit ? '#000' : '#d9d0bd'; c.fillRect(0, 0, 512, 768);
      const fh = 768 / floors, cw = 512 / cols;
      for (let f = 0; f < floors; f++) for (let k = 0; k < cols; k++) {
        const on = ((f * 31 + k * 17) % 7) > 2;
        if (f === floors - 1) { c.fillStyle = lit ? '#ffcf7a' : '#46606c'; c.fillRect(k * cw + 4, f * fh + 10, cw - 8, fh - 10); continue; }
        c.fillStyle = lit ? (on ? '#ffc977' : '#000') : '#3c5560';
        c.fillRect(k * cw + 12, f * fh + 16, cw - 24, fh - 34);
        if (!lit) { c.fillStyle = '#bfb39c'; c.fillRect(k * cw + 8, f * fh + fh - 18, cw - 16, 5); }
      }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
    };
    const day = mk(false), litT = mk(true);
    const facade = new THREE.MeshStandardMaterial({ map: day, emissive: 0xffffff, emissiveMap: litT, emissiveIntensity: 0, roughness: 0.7 });
    night.push({ m: facade, day: 0, night: 1.3 });
    const roof = new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: 0.9 });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(20, H, 16), [facade, facade, roof, roof, facade, facade]);
    tower.position.set(cx, PAD + H / 2, cz); tower.castShadow = tower.receiveShadow = true; scene.add(tower);
    for (let f = 1; f < floors; f++) {
      const y = PAD + f * (H / floors) - 0.1;
      box(M.solid, 19, 0.18, 1.3, cx, y, z1 + 0.65, WHITE); box(M.solid, 19, 0.18, 1.3, cx, y, z0 - 0.65, WHITE);
      box(M.glass, 19, 1.0, 0.06, cx, y + 0.18, z1 + 1.28, [0.7, 0.8, 0.85]); box(M.glass, 19, 1.0, 0.06, cx, y + 0.18, z0 - 1.28, [0.7, 0.8, 0.85]);
    }
    box(M.solid, 7, 3, 6, cx, PAD + H, cz, [0.6, 0.58, 0.55]);
    sign(['HOTEL VALLE'], 12, 2.4, x0 - 0.06, PAD + H + 1.6, cz, -Math.PI / 2, { bg: '#1d2a2a', fg: '#ffe3a3', border: null }, 0.5);
    sign(['HOTEL VALLE'], 12, 2.4, cx, PAD + H + 1.6, z1 + 0.06, 0, { bg: '#1d2a2a', fg: '#ffe3a3', border: null }, 0.5);
    box(M.solid, 4, 0.3, 9, x0 - 2, PAD + 3.6, cz, WHITE);
    for (const z of [cz - 4, cz + 4]) box(M.metal, 0.2, 3.6, 0.2, x0 - 3.8, PAD, z, [0.3, 0.3, 0.3]);
    solidRect(x0, z0, x1, z1, PAD + H);
    // piscina
    box(M.solid, 24, 0.25, 13, cx, PAD - 0.1, 189, [0.85, 0.82, 0.75]);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), new THREE.MeshStandardMaterial({ color: 0x35b6d6, roughness: 0.04, metalness: 0.1, emissive: 0x0a4a5a, emissiveIntensity: 0.3 }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(cx, PAD + 0.17, 189); scene.add(pool);
    for (let i = 0; i < 5; i++) box(M.solid, 0.7, 0.35, 1.9, 224 + i * 4, PAD + 0.15, 194.5, WHITE);
    for (const x of [222, 242]) { cyl(M.metal, 0.05, 0.05, 2.4, x, PAD, 194.5, [0.3, 0.3, 0.3], 6); const g = new THREE.ConeGeometry(1.4, 0.6, 8); g.translate(x, PAD + 2.6, 194.5); add(M.solid, P(g, [0.9, 0.55, 0.2])); }
  }

  // ── Laboratorio ──
  {
    const x0 = 107, x1 = 133, z0 = 187, z1 = 203;
    box(M.solid, 26, 7, 16, 120, PAD, 195, WHITE);
    box(M.win, 26.15, 1.6, 16.15, 120, PAD + 3.2, 195, [0.2, 0.35, 0.45]);
    box(M.metal, 4, 1.4, 3, 113, PAD + 7, 191, [0.6, 0.6, 0.62]); box(M.metal, 4, 1.4, 3, 126, PAD + 7, 199, [0.6, 0.6, 0.62]);
    box(M.solid, 3, 3, 0.2, x1 + 0.05, PAD, 195, [0.3, 0.32, 0.35]);
    sign(['LABORATORIO'], 9, 1.3, x1 + 0.1, PAD + 5.4, 195, Math.PI / 2, { bg: '#e8e8e8', fg: '#1d4f6e', border: '#1d4f6e' }, 0.15);
    solidRect(x0, z0, x1, z1, PAD + 7);
  }

  // ── Quioscos ──
  for (const [x, z, name] of [[140, 152, 'CAFÉ'], [200, 152, 'RECUERDOS']]) {
    box(M.wood, 5, 2.8, 4, x, PAD, z, [0.55, 0.4, 0.26]);
    for (let i = 0; i < 6; i++) box(M.solid, 5.6 / 6, 0.12, 2.2, x - 2.8 + (i + 0.5) * (5.6 / 6), PAD + 2.7, z + 2.6, i % 2 ? WHITE : [0.85, 0.5, 0.15]);
    sign([name], 4, 0.8, x, PAD + 3.4, z + 2.02, 0, { w: 512, h: 112, font: 'bold 72px system-ui' }, 0.3);
    solidRect(x - 2.5, z - 2, x + 2.5, z + 2, PAD + 3);
  }

  // ── Carreteras ──
  function road(pts, closed, width = 7) {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new V3(x, 0, z)), closed, 'centripetal');
    const L = curve.getLength(), n = Math.ceil(L / 2);
    const pos = [], uv = [], idx = [];
    const P0 = new V3(), T = new V3();
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      curve.getPointAt(u % 1 === 0 && closed && i === n ? 0 : u, P0); curve.getTangentAt(closed && i === n ? 0 : u, T);
      const nx = -T.z, nz = T.x, hw = width / 2;
      const lx = P0.x + nx * hw, lz = P0.z + nz * hw, rx = P0.x - nx * hw, rz = P0.z - nz * hw;
      const y = Math.max(groundH(lx, lz), groundH(rx, rz), groundH(P0.x, P0.z)) + 0.12;
      pos.push(lx, y, lz, rx, y, rz);
      uv.push(0, (u * L) / 8, 1, (u * L) / 8);
      if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, roadMat); mesh.receiveShadow = true; scene.add(mesh);
    return curve;
  }
  const roadTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
    const c = cv.getContext('2d');
    c.fillStyle = '#4a4741'; c.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 900; i++) { const v = 55 + Math.random() * 40; c.fillStyle = `rgb(${v},${v},${v * 0.95})`; c.fillRect(Math.random() * 64, Math.random() * 256, 1.5, 1.5); }
    c.fillStyle = '#d8b23c'; c.fillRect(30, 0, 4, 140);
    c.fillStyle = '#cfcac0'; c.fillRect(2, 0, 2.5, 256); c.fillRect(59.5, 0, 2.5, 256);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  })();
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

  // muelle: buscar dónde empieza el mar al sur de la puerta
  let beachZ = null;
  for (let z = 300; z < 560; z += 1) if (groundH(182, z) < -0.4) { beachZ = z; break; }
  const entry = beachZ ? [[182, beachZ - 8], ...ENTRY] : ENTRY;
  road(entry, false);
  const loopCurve = road(LOOP, true);
  for (let i = 0; i < entry.length - 1; i++) if (i % 1 === 0) {
    const [x, z] = entry[i], [x2, z2] = entry[i + 1];
    for (let t = 0.25; t < 1; t += 0.5) { const px = x + (x2 - x) * t, pz = z + (z2 - z) * t; if (Math.hypot(px - RESORT.x, pz - RESORT.z) > 30) lamp(px + 5, pz); }
  }

  // ── Puerta principal ──
  {
    const { x, z } = GATE, y = groundH(x, z) - 0.5;
    for (const px of [x - 9.6, x + 9.6]) {
      box(M.solid, 3.4, 14, 3.4, px, y, z, STONE_D);
      box(M.solid, 4, 1.2, 4, px, y + 13.5, z, STONE);
      box(M.solid, 4, 2, 4, px, y, z, [0.4, 0.36, 0.3]);
      addCollider(px, z, 2.3);
    }
    box(M.wood, 26, 2.8, 1.8, x, y + 11, z, TIMBER);
    box(M.wood, 23, 0.6, 1.2, x, y + 9.6, z, [0.3, 0.21, 0.13]);
    sign(['VALLE JURÁSICO'], 18, 2.2, x, y + 12.4, z + 0.92, 0, { bg: '#2a1c10', fg: '#f2c46d' }, 0.3);
    sign(['VALLE JURÁSICO'], 18, 2.2, x, y + 12.4, z - 0.92, Math.PI, { bg: '#2a1c10', fg: '#f2c46d' }, 0.3);
    for (const [hx, dir] of [[x - 7.9, 1], [x + 7.9, -1]]) {
      const g = new THREE.BoxGeometry(7.6, 9.5, 0.4); g.translate(dir * 3.8, 4.75, 0); g.rotateY(dir * 1.35); g.translate(hx, y + 0.5, z);
      add(M.wood, P(g, [0.42, 0.3, 0.19]));
      for (let k = 1; k < 4; k++) { const b = new THREE.BoxGeometry(7.6, 0.35, 0.55); b.translate(dir * 3.8, k * 2.4, 0); b.rotateY(dir * 1.35); b.translate(hx, y + 0.5, z); add(M.metal, P(b, DARK)); }
    }
    // muralla a los lados
    for (const side of [-1, 1]) {
      let px = x + side * 11.3;
      for (let i = 0; i < 9; i++) {
        const nx = px + side * 4.4, mx = (px + nx) / 2, gy = Math.min(groundH(px, z), groundH(nx, z)) - 1;
        box(M.solid, 4.5, 5.5 + (groundH(mx, z) - gy - 1), 1.4, mx, gy, z, STONE);
        addWall(px, z, nx, z, 1.4, gy + 7);
        px = nx;
      }
    }
  }

  // ── Muelle y barco ──
  if (beachZ) {
    const z0 = beachZ - 6, z1 = beachZ + 44;
    box(M.wood, 5, 0.35, z1 - z0, 182, 1.3, (z0 + z1) / 2, [0.48, 0.36, 0.24]);
    for (let z = z0 + 2; z < z1; z += 5) for (const x of [179.8, 184.2]) cyl(M.wood, 0.18, 0.2, 9, x, -7.2, z, [0.3, 0.22, 0.15], 6);
    addPlatform(179.5, z0, 184.5, z1, 1.65);
    lamp(184.2, z1 - 1, 3.2, 1.65);
    const boat = new THREE.Group();
    const hull = new THREE.BoxGeometry(3.4, 1.8, 9); hull.translate(0, 0.2, 0);
    const bow = new THREE.CylinderGeometry(0.05, 1.7, 3.2, 4, 1); bow.rotateX(Math.PI / 2); bow.rotateZ(Math.PI / 4); bow.scale(1, 0.75, 1); bow.translate(0, 0.45, 6);
    const cabin = new THREE.BoxGeometry(2.6, 1.8, 3.6); cabin.translate(0, 2, -1.2);
    const stripe = new THREE.BoxGeometry(3.45, 0.3, 9.05); stripe.translate(0, 0.6, 0);
    const bm = new THREE.Mesh(mergeGeometries([P(hull, WHITE), P(bow, WHITE), P(cabin, [0.92, 0.9, 0.86]), P(stripe, [0.15, 0.35, 0.6])]), M.solid);
    bm.castShadow = true; boat.add(bm);
    boat.position.set(189, 0, beachZ + 30); scene.add(boat);
    anims.push((dt, t) => { boat.position.y = Math.sin(t * 1.1) * 0.18 + 0.1; boat.rotation.z = Math.sin(t * 0.9) * 0.03; boat.rotation.x = Math.sin(t * 0.7) * 0.02; });
    addCollider(189, beachZ + 30, 3);
  }

  // ── Helipuerto y helicóptero ──
  {
    const hx = 225, hz = 95;
    cyl(M.solid, 10, 10.3, 0.35, hx, PAD - 0.15, hz, [0.45, 0.45, 0.44], 40);
    const ht = textTex(['H'], { w: 256, h: 256, bg: 'rgba(0,0,0,0)', fg: '#f4f1e8', font: 'bold 200px system-ui', border: null });
    const hp = new THREE.Mesh(new THREE.CircleGeometry(8, 40), new THREE.MeshStandardMaterial({ map: ht, transparent: true, roughness: 0.9 }));
    hp.rotation.x = -Math.PI / 2; hp.position.set(hx, PAD + 0.22, hz); scene.add(hp);
    const ring = new THREE.Mesh(new THREE.RingGeometry(8.3, 8.8, 48), new THREE.MeshStandardMaterial({ color: 0xe8b33a, roughness: 0.8 }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(hx, PAD + 0.21, hz); scene.add(ring);
    const heli = new THREE.Group();
    const body = new THREE.CapsuleGeometry(1.25, 2.6, 6, 14); body.rotateZ(Math.PI / 2); body.scale(1, 0.95, 0.85); body.translate(0, 1.9, 0);
    const glassG = new THREE.SphereGeometry(1.15, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2); glassG.rotateZ(-Math.PI / 2); glassG.scale(1.05, 0.9, 0.95); glassG.translate(1.55, 2.0, 0);
    const boom = new THREE.CylinderGeometry(0.22, 0.38, 5.5, 8); boom.rotateZ(Math.PI / 2); boom.translate(-4.2, 2.3, 0);
    const fin = new THREE.BoxGeometry(1.2, 1.6, 0.12); fin.translate(-6.8, 3.0, 0);
    const parts = [P(body, WHITE), P(glassG, [0.15, 0.22, 0.28]), P(boom, WHITE), P(fin, [0.85, 0.5, 0.15])];
    for (const s of [-1, 1]) { const sk = new THREE.BoxGeometry(4.2, 0.12, 0.12); sk.translate(0, 0.1, s * 1.1); parts.push(P(sk, DARK)); for (const x of [-1, 1]) { const st = new THREE.BoxGeometry(0.1, 0.8, 0.1); st.translate(x, 0.5, s * 1.0); parts.push(P(st, DARK)); } }
    const stripe = new THREE.BoxGeometry(3.6, 0.35, 2.15); stripe.translate(-0.2, 1.45, 0); parts.push(P(stripe, [0.85, 0.5, 0.15]));
    const hm = new THREE.Mesh(mergeGeometries(parts), M.solid); hm.castShadow = true; heli.add(hm);
    const rotor = new THREE.Group(); rotor.position.set(0.2, 3.35, 0);
    rotor.add(new THREE.Mesh(P(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 8), DARK), M.metal));
    for (const a of [0, Math.PI / 2]) { const bl = new THREE.Mesh(P(new THREE.BoxGeometry(10, 0.06, 0.35), DARK), M.metal); bl.rotation.y = a; bl.castShadow = true; rotor.add(bl); }
    heli.add(rotor);
    heli.position.set(hx, PAD + 0.2, hz); heli.rotation.y = 0.6; scene.add(heli);
    anims.push((dt) => { rotor.rotation.y += dt * 0.6; });
    addCollider(hx, hz, 3.4);
  }

  // ── Jeeps de safari ──
  function jeepGeom(col) {
    const parts = [];
    const b = (w, h, d, x, y, z, c) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); parts.push(P(g, c)); };
    b(4.3, 0.8, 1.9, 0, 0.95, 0, col);
    b(1.5, 0.35, 1.85, 1.35, 1.5, 0, col);
    b(4.35, 0.14, 1.95, 0, 1.08, 0, [0.82, 0.72, 0.5]);
    b(0.08, 0.75, 1.75, 0.55, 1.7, 0, [0.2, 0.25, 0.28]);
    b(0.12, 1.2, 0.12, -0.9, 1.95, 0.85, DARK); b(0.12, 1.2, 0.12, -0.9, 1.95, -0.85, DARK); b(0.12, 0.12, 1.8, -0.9, 2.5, 0, DARK);
    b(0.12, 0.12, 2.9, -0.2, 2.5, 0.85, DARK); b(0.12, 0.12, 2.9, -0.2, 2.5, -0.85, DARK);
    b(0.7, 0.5, 1.5, -0.2, 1.5, 0, [0.6, 0.48, 0.32]); b(0.7, 0.5, 1.5, -1.4, 1.5, 0, [0.6, 0.48, 0.32]);
    b(0.15, 0.3, 1.9, 2.18, 0.8, 0, DARK);
    for (const [x, z] of [[1.4, 0.95], [1.4, -0.95], [-1.4, 0.95], [-1.4, -0.95]]) { const w = new THREE.CylinderGeometry(0.44, 0.44, 0.32, 14); w.rotateX(Math.PI / 2); w.translate(x, 0.44, z); parts.push(P(w, DARK)); }
    const sp = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 14); sp.rotateZ(Math.PI / 2); sp.translate(-2.3, 1.15, 0); parts.push(P(sp, DARK));
    for (const z of [0.65, -0.65]) { const l = new THREE.CylinderGeometry(0.13, 0.13, 0.1, 10); l.rotateZ(Math.PI / 2); l.translate(2.16, 1.2, z); parts.push(P(l, [1, 1, 0.85])); }
    return mergeGeometries(parts);
  }
  const jeepCols = [[0.34, 0.37, 0.22], [0.62, 0.52, 0.34], [0.3, 0.33, 0.2]];
  const jeepGs = jeepCols.map(jeepGeom);
  const loopLen = loopCurve.getLength();
  const jeeps = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(jeepGs[i], M.solid); m.castShadow = true; m.rotation.order = 'YZX'; scene.add(m);
    const j = { m, u: i / 3, pos: new V3(), radius: 2.4, stop: 0 };
    jeeps.push(j); movers.push(j);
  }
  const tmp = new V3(), tan = new V3();
  anims.push((dt, t, player) => {
    for (const j of jeeps) {
      // los jeeps frenan si hay alguien delante
      tmp.copy(loopCurve.getPointAt(j.u)); loopCurve.getTangentAt(j.u, tan);
      const ahead = Math.hypot(player.x - (tmp.x + tan.x * 6), player.z - (tmp.z + tan.z * 6)) < 4.5;
      const sp = ahead ? 0 : 8.5;
      j.speed = (j.speed ?? 0) + (sp - (j.speed ?? 0)) * Math.min(1, dt * 1.5);
      j.u = (j.u + (j.speed * dt) / loopLen) % 1;
      const y = groundH(tmp.x, tmp.z) + 0.12;
      const yf = groundH(tmp.x + tan.x * 2, tmp.z + tan.z * 2), yb = groundH(tmp.x - tan.x * 2, tmp.z - tan.z * 2);
      j.m.position.set(tmp.x, Math.max(y, Math.max(yf, yb) + 0.12 - 0.1), tmp.z);
      j.m.rotation.set(0, Math.atan2(-tan.z, tan.x), Math.atan2(yf - yb, 4));
      j.pos.copy(j.m.position);
    }
  });
  // aparcamiento
  {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
    const c = cv.getContext('2d'); c.fillStyle = '#4a4741'; c.fillRect(0, 0, 512, 256);
    c.fillStyle = '#e8e4da'; for (let x = 0; x <= 512; x += 64) { c.fillRect(x - 2, 0, 4, 100); c.fillRect(x - 2, 156, 4, 100); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const pk = new THREE.Mesh(new THREE.PlaneGeometry(32, 16), new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2 }));
    pk.rotation.x = -Math.PI / 2; pk.position.set(200, PAD + 0.07, 200); pk.receiveShadow = true; scene.add(pk);
    [[189, 195, 0], [197, 195, 1], [205, 205, 2], [213, 205, 0]].forEach(([x, z, k]) => {
      const m = new THREE.Mesh(jeepGs[k], M.solid); m.position.set(x, PAD + 0.05, z); m.rotation.y = z < 200 ? -Math.PI / 2 : Math.PI / 2; m.castShadow = true; scene.add(m);
      addCollider(x, z, 1.6);
    });
    mapRects.push([184, 192, 216, 208]);
  }

  // ── Monorraíl ──
  {
    const curve = new THREE.CatmullRomCurve3(MONO.map(([x, z]) => new V3(x, 0, z)), false, 'centripetal');
    const L = curve.getLength(), n = Math.ceil(L / 2);
    const pts = [];
    for (let i = 0; i <= n; i++) { const p = curve.getPointAt(i / n); pts.push(new V3(p.x, groundH(p.x, p.z) + 9, p.z)); }
    for (let pass = 0; pass < 4; pass++) for (let i = 1; i < n; i++) pts[i].y = (pts[i - 1].y + pts[i].y * 2 + pts[i + 1].y) / 4;
    for (const p of pts) p.y = Math.max(p.y, groundH(p.x, p.z) + 6.5);
    const lens = [0];
    for (let i = 1; i <= n; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = lens[n];
    const at = (s, out) => {
      s = clamp(s, 0, total);
      let i = 1; while (i < n && lens[i] < s) i++;
      const t = (s - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
      return out.lerpVectors(pts[i - 1], pts[i], t);
    };
    const beam = [], mtx = new THREE.Matrix4(), up = new V3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[i + 1], len = a.distanceTo(b);
      const g = new THREE.BoxGeometry(1.1, 1.0, len + 0.05);
      mtx.lookAt(b, a, up); g.applyMatrix4(mtx); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      beam.push(P(g, [0.82, 0.8, 0.76]));
      if (i % 10 === 5) {
        const gy = groundH(a.x, a.z);
        const c = new THREE.CylinderGeometry(0.55, 0.75, a.y - gy + 0.5, 10); c.translate(a.x, gy + (a.y - gy) / 2 - 0.5, a.z); beam.push(P(c, [0.72, 0.7, 0.66]));
        const cap = new THREE.BoxGeometry(2.4, 0.6, 1.2); mtx.lookAt(b, a, up); cap.applyMatrix4(mtx); cap.translate(a.x, a.y - 0.8, a.z); beam.push(P(cap, [0.72, 0.7, 0.66]));
        addCollider(a.x, a.z, 0.8);
      }
    }
    const bm = new THREE.Mesh(mergeGeometries(beam), M.solid); bm.castShadow = bm.receiveShadow = true; scene.add(bm);
    // estaciones elevadas
    for (const [k, label] of [[0, 'MONORRAÍL'], [n, 'MIRADOR DE SAURÓPODOS']]) {
      const p = pts[k], q = pts[k === 0 ? 4 : n - 4];
      const ang = Math.atan2(q.x - p.x, q.z - p.z);
      const g1 = new THREE.BoxGeometry(5, 0.5, 16); g1.rotateY(ang); g1.translate(p.x + Math.cos(ang) * 3.2, p.y - 0.6, p.z - Math.sin(ang) * 3.2);
      const g2 = new THREE.BoxGeometry(9, 0.4, 18); g2.rotateY(ang); g2.translate(p.x + Math.cos(ang) * 1.5, p.y + 4.6, p.z - Math.sin(ang) * 1.5);
      add(M.solid, P(g1, [0.7, 0.68, 0.64])); add(M.solid, P(g2, [0.85, 0.5, 0.18]));
      for (const dz of [-7, 7]) for (const dx of [-1.4, 4.8]) {
        const x = p.x + Math.cos(ang) * dx + Math.sin(ang) * dz, z = p.z - Math.sin(ang) * dx + Math.cos(ang) * dz, gy = groundH(x, z);
        cyl(M.metal, 0.22, 0.22, p.y + 4.6 - gy, x, gy, z, [0.3, 0.3, 0.3], 8); addCollider(x, z, 0.3);
      }
      const s = sign([label], 8, 1.2, p.x + Math.cos(ang) * 1.5, p.y + 5.6, p.z - Math.sin(ang) * 1.5, ang + Math.PI / 2, { w: 1024, h: 150, font: 'bold 84px system-ui' }, 0.4);
      const s2 = s.clone(); s2.rotation.y += Math.PI; scene.add(s2);
    }
    // tren de dos vagones que va y viene
    const carG = (() => {
      const body = new THREE.CapsuleGeometry(1.35, 6.4, 6, 16); body.rotateX(Math.PI / 2); body.scale(1, 1.1, 1);
      const roofG = new THREE.BoxGeometry(1.2, 0.3, 6); roofG.translate(0, 1.45, 0);
      const skirt = new THREE.BoxGeometry(2.0, 0.7, 7.4); skirt.translate(0, -1.2, 0);
      return mergeGeometries([P(body, WHITE), P(roofG, [0.85, 0.5, 0.18]), P(skirt, [0.4, 0.4, 0.42])]);
    })();
    const winG = new THREE.CylinderGeometry(1.38, 1.38, 6.2, 16, 1, true, -1.3, 2.6); winG.rotateX(Math.PI / 2); winG.rotateZ(Math.PI / 2); winG.scale(1, 0.45, 1); winG.translate(0, 0.45, 0);
    const winG2 = winG.clone(); winG2.rotateY(Math.PI);
    const winGeo = mergeGeometries([P(winG, [0.12, 0.2, 0.26]), P(winG2, [0.12, 0.2, 0.26])]);
    const cars = [0, 1].map(() => {
      const g = new THREE.Group();
      const b = new THREE.Mesh(carG, M.solid); b.castShadow = true; g.add(b);
      g.add(new THREE.Mesh(winGeo, M.win));
      scene.add(g); return g;
    });
    let s = 0, dir = 1, wait = 6;
    const pa = new V3(), pb = new V3();
    anims.push((dt) => {
      if (wait > 0) { wait -= dt; } else {
        const edge = Math.min(s, total - s);
        const v = 3 + 11 * smooth(0, 40, edge);
        s += dir * v * dt;
        if (s >= total - 9.5 && dir > 0) { s = total - 9.5; dir = -1; wait = 10; }
        if (s <= 0 && dir < 0) { s = 0; dir = 1; wait = 10; }
      }
      cars.forEach((c, i) => {
        const cs = clamp(s + 4.5 - i * 9, 0, total);
        at(cs, pa); at(Math.min(total, cs + 1), pb);
        if (cs >= total) at(total - 1, pa), at(total, pb);
        c.position.set(pa.x, pa.y + 2.15, pa.z);
        c.lookAt(pb.x, pb.y + 2.15, pb.z);
      });
    });
  }

  // ── Recintos: cercas eléctricas y muro del carnívoro ──
  {
    const postG = new THREE.BoxGeometry(0.35, 7, 0.35); postG.translate(0, 3, 0);
    const cableG = new THREE.CylinderGeometry(0.035, 0.035, 1, 4); cableG.translate(0, 0.5, 0);
    const postM = new THREE.MeshStandardMaterial({ color: 0x6d6a64, roughness: 0.7, metalness: 0.3 });
    const cableM = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.4, metalness: 0.8 });
    const posts = [], cables = [];
    const warn = textTex(['PELIGRO', '10.000 VOLTIOS'], { w: 512, h: 320, bg: '#f2c230', fg: '#111', font: 'bold 70px system-ui', border: '#111', stripes: true });
    const warnM = new THREE.MeshStandardMaterial({ map: warn, roughness: 0.6, side: THREE.DoubleSide });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), yAxis = new V3(0, 1, 0);
    for (const pd of PADDOCKS) {
      const n = Math.ceil((Math.PI * 2 * pd.r) / (pd.kind === 'wall' ? 5 : 6));
      const ring = [];
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const x = pd.x + Math.cos(a) * pd.r, z = pd.z + Math.sin(a) * pd.r; ring.push([a, x, z, groundH(x, z)]); }
      if (pd.kind === 'fence') {
        ring.forEach(([a, x, z, y], i) => {
          posts.push(new THREE.Matrix4().makeTranslation(x, y, z));
          const [, x2, z2, y2] = ring[(i + 1) % n];
          for (const hh of [1.1, 2.3, 3.5, 4.7, 5.9]) {
            const A = new V3(x, y + hh, z), B = new V3(x2, y2 + hh, z2), d = B.clone().sub(A);
            q.setFromUnitVectors(yAxis, d.clone().normalize());
            cables.push(m4.clone().compose(A, q, new V3(1, d.length(), 1)));
          }
          if (i % 9 === 0) {
            const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), warnM);
            s.position.set(pd.x + Math.cos(a) * (pd.r + 0.3), y + 2.2, pd.z + Math.sin(a) * (pd.r + 0.3));
            s.rotation.y = Math.atan2(Math.cos(a), Math.sin(a)); scene.add(s);
          }
        });
      } else {
        const [vx, vz] = pd.view, va = Math.atan2(vz - pd.z, vx - pd.x);
        ring.forEach(([a, x, z], i) => {
          const [a2, x2, z2] = ring[(i + 1) % n];
          const mx = (x + x2) / 2, mz = (z + z2) / 2, gy = Math.min(groundH(x, z), groundH(x2, z2), groundH(mx, mz)) - 3;
          const top = groundH(mx, mz) + 10, len = Math.hypot(x2 - x, z2 - z) + 0.3, ry = -Math.atan2(z2 - z, x2 - x);
          const glassy = Math.abs(Math.atan2(Math.sin(a - va), Math.cos(a - va))) < 0.28;
          if (glassy) {
            box(M.solid, len, groundH(mx, mz) + 1 - gy, 1.4, mx, gy, mz, CONC, ry);
            box(M.glass, len, 6, 0.5, mx, groundH(mx, mz) + 1, mz, [0.7, 0.85, 0.9], ry);
            box(M.solid, len, 3, 1.4, mx, groundH(mx, mz) + 7, mz, CONC, ry);
          } else box(M.solid, len, top - gy, 1.4, mx, gy, mz, CONC, ry);
          box(M.solid, len, 0.4, 1.8, mx, top, mz, [0.45, 0.44, 0.42], ry);
          void a2;
        });
        const s = sign(['PELIGRO · CARNÍVORO'], 7, 1.1, pd.x + Math.cos(va) * (pd.r + 0.75), groundH(vx, vz) + 8, pd.z + Math.sin(va) * (pd.r + 0.75), Math.atan2(Math.cos(va), Math.sin(va)), { bg: '#f2c230', fg: '#111', border: '#111', font: 'bold 96px system-ui' }, 0.2);
        void s;
        sign(['MIRADOR DEL ALLOSAURUS'], 9, 1.3, vx + 6, groundH(vx + 6, vz + 3) + 2.4, vz + 3, -0.9, {}, 0.3);
      }
    }
    const pm = new THREE.InstancedMesh(postG, postM, posts.length); posts.forEach((m, i) => pm.setMatrixAt(i, m)); pm.castShadow = true; pm.computeBoundingSphere(); scene.add(pm);
    const cm = new THREE.InstancedMesh(cableG, cableM, cables.length); cables.forEach((m, i) => cm.setMatrixAt(i, m)); cm.computeBoundingSphere(); scene.add(cm);
  }

  // fusionar todo lo estático por material
  for (const [mat, list] of lists) {
    const mesh = new THREE.Mesh(mergeGeometries(list), mat);
    mesh.castShadow = mat !== M.glass; mesh.receiveShadow = true;
    if (mat === M.glass) mesh.renderOrder = 2;
    scene.add(mesh);
  }

  return {
    movers,
    mapRects,
    roads: [entry, LOOP],
    update(dt, t, player) { for (const f of anims) f(dt, t, player); },
    setNight(k) { for (const n of night) n.m.emissiveIntensity = n.day + (n.night - n.day) * k; },
  };
}
