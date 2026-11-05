// Valle Jurásico — mundo 3D explorable (Three.js, todo generado por código).
import * as THREE from 'three';
import { Sky } from '../vendor/Sky.js';
import { Water } from '../vendor/Water.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { PAD, RESORT, PADDOCKS, ZONES, flattenPark, parkClear, dinoAllowed, buildPark } from './parque.js';

const $ = (s) => document.querySelector(s);
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const LOW = TOUCH;                       // móviles: menos densidad y sin reflejos caros
const DENS = LOW ? 0.45 : 1;
const TESTQ = new URLSearchParams(location.search).has('lite');
if (TOUCH) document.documentElement.classList.add('touch');
const V3 = THREE.Vector3;

// ───────────────────────── utilidades ─────────────────────────
let seed = 150_000_000;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const rr = (a, b) => a + (b - a) * rand();
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const tmpColor = new THREE.Color();
const srgb = (r, g, b) => tmpColor.setRGB(r, g, b, THREE.SRGBColorSpace);

function makeNoise(sd) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = sd * 7919 + 1;
  for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return (x, y) => {
    const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s);
    const t = (i + j) * G2, x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, q;
    if ((q = 0.5 - x0 * x0 - y0 * y0) > 0) { const g = G[perm[ii + perm[jj]] & 7]; q *= q; n += q * q * (g[0] * x0 + g[1] * y0); }
    if ((q = 0.5 - x1 * x1 - y1 * y1) > 0) { const g = G[perm[ii + i1 + perm[jj + j1]] & 7]; q *= q; n += q * q * (g[0] * x1 + g[1] * y1); }
    if ((q = 0.5 - x2 * x2 - y2 * y2) > 0) { const g = G[perm[ii + 1 + perm[jj + 1]] & 7]; q *= q; n += q * q * (g[0] * x2 + g[1] * y2); }
    return 70 * n;
  };
}
const n1 = makeNoise(1), n2 = makeNoise(2), n3 = makeNoise(3);
function fbm(nf, x, z, oct) { let a = 1, f = 1, s = 0, t = 0; for (let i = 0; i < oct; i++) { s += a * nf(x * f, z * f); t += a; a *= 0.5; f *= 2.03; } return s / t; }
function ridged(nf, x, z, oct) { let a = 1, f = 1, s = 0, t = 0; for (let i = 0; i < oct; i++) { const v = 1 - Math.abs(nf(x * f, z * f)); s += a * v * v; t += a; a *= 0.5; f *= 2.1; } return s / t; }

// ───────────────────────── forma del valle ─────────────────────────
// Norte (-z): cordillera. Sur (+z): costa y mar. Lago al oeste, río hacia el mar, volcán al noreste.
const SIZE = 1200, HALF = SIZE / 2, SEG = LOW ? 256 : 320, STEP = SIZE / SEG, WATER = 0;
const LAKE = { x: -150, z: -40 }, VOLC = { x: 330, z: -300 };
const riverX = (z) => -150 + (z + 40) * 0.35 + 45 * Math.sin(z * 0.012);

function heightFn(x, z) {
  let h = 10 + fbm(n1, x * 0.0035, z * 0.0035, 5) * 13 + fbm(n2, x * 0.02, z * 0.02, 3) * 2.2;
  const edge = Math.max(Math.abs(x) / HALF, -z / HALF) + fbm(n3, x * 0.004, z * 0.004, 2) * 0.12;
  h += smooth(0.5, 0.95, edge) * (35 + 150 * ridged(n3, x * 0.005 + 7, z * 0.005, 4));
  // volcán con cráter y cárcavas
  const dv = Math.hypot(x - VOLC.x, z - VOLC.z);
  const cone = Math.max(0, 1 - dv / 250);
  let vh = 200 * cone * cone;
  if (dv < 38) vh = 143.8 - 38 * (1 - (dv / 38) ** 2);
  vh += cone * 9 * n1(Math.atan2(z - VOLC.z, x - VOLC.x) * 5, dv * 0.03);
  h += vh;
  // lago
  const dl = Math.hypot(x - LAKE.x, (z - LAKE.z) * 1.3) + fbm(n2, x * 0.01, z * 0.01, 2) * 30;
  h = lerp(h, -7, 1 - smooth(60, 140, dl));
  // río
  if (z > -70) {
    const w = 7 + (z + 40) * 0.018, rm = (1 - smooth(w, w + 26, Math.abs(x - riverX(z)))) * smooth(-70, -20, z);
    h = Math.min(h, lerp(h, -2.5, rm));
  }
  h = flattenPark(x, z, h);
  // costa
  return lerp(h, -16, smooth(170, 470, z + fbm(n1, x * 0.003 + 3, 0.5, 3) * 90));
}

const GW = SEG + 1;
const heights = new Float32Array(GW * GW);
function groundH(x, z) {
  const fc = clamp((x + HALF) / STEP, 0, SEG - 1e-3), fr = clamp((z + HALF) / STEP, 0, SEG - 1e-3);
  const c = Math.floor(fc), r = Math.floor(fr), u = fc - c, v = fr - r, i = r * GW + c;
  return lerp(lerp(heights[i], heights[i + 1], u), lerp(heights[i + GW], heights[i + GW + 1], u), v);
}
function slopeAt(x, z) {
  const e = STEP;
  return Math.hypot(groundH(x + e, z) - groundH(x - e, z), groundH(x, z + e) - groundH(x, z - e)) / (2 * e);
}
const forestN = (x, z) => fbm(n3, x * 0.008 + 100, z * 0.008, 3);
const volcDist = (x, z) => Math.hypot(x - VOLC.x, z - VOLC.z);

function terrainRGB(x, z, h, s) {
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const v = fbm(n2, x * 0.03, z * 0.03, 2) * 0.5 + 0.5;
  let c = mix([0.30, 0.36, 0.15], [0.40, 0.40, 0.19], v);                   // musgo y plantas bajas
  c = mix(c, [0.22, 0.20, 0.12], smooth(-0.1, 0.35, forestN(x, z)) * 0.8); // suelo de bosque
  c = mix(c, [0.42, 0.33, 0.21], smooth(0.32, 0.6, s));                    // tierra en pendiente
  c = mix(c, [0.40, 0.36, 0.31], Math.max(smooth(0.6, 0.95, s), smooth(75, 120, h)));
  c = mix(c, [0.29, 0.27, 0.24], smooth(0.85, 1.4, s) * (0.4 + 0.6 * v));
  const dv = volcDist(x, z);
  c = mix(c, [0.17, 0.15, 0.14], smooth(230, 110, dv) * smooth(20, 55, h)); // ceniza y basalto
  c = mix(c, [0.76, 0.69, 0.52], 1 - smooth(0.7, 2.4, h));                 // arena
  c = mix(c, [0.45, 0.40, 0.30], 1 - smooth(-0.6, 0.4, h));                // arena mojada
  c = mix(c, [0.30, 0.30, 0.24], 1 - smooth(-6, -2, h));                   // fondo
  const k = 0.9 + 0.2 * (n1(x * 0.11, z * 0.11) * 0.5 + 0.5);
  return [c[0] * k, c[1] * k, c[2] * k];
}

// ───────────────────────── render básico ─────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: !LOW, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.25 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('#app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xb8c4c8, 0.0014);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 5000);
camera.rotation.order = 'YXZ';
const uTime = { value: 0 };

const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(LOW ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 800 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.06;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a3b22, 0.35);
scene.add(hemi);
const sunDir = new V3();

const sky = new Sky();
sky.scale.setScalar(3000);
scene.add(sky);
Object.assign(sky.material.uniforms.mieCoefficient, { value: 0.005 });
Object.assign(sky.material.uniforms.mieDirectionalG, { value: 0.8 });
const envScene = new THREE.Scene();
const envSky = new THREE.Mesh(sky.geometry, sky.material);
envSky.scale.setScalar(100);
envScene.add(envSky);
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;
const fogRT = new THREE.WebGLRenderTarget(32, 16, { type: THREE.FloatType });
const fogCam = new THREE.PerspectiveCamera(50, 2, 0.1, 1000);

// ───────────────────────── texturas procedurales ─────────────────────────
function canvasTex(size, fn, colorSpace = THREE.SRGBColorSpace) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const o = (y * size + x) * 4, c = fn(x, y);
    img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = c[3] ?? 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = colorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
// ruido periódico (se repite sin costuras)
function tileNoise(nf, x, y, W, freq, oct) {
  const u = x / W, v = y / W;
  const f = (a, b) => fbm(nf, a * freq, b * freq, oct);
  return lerp(lerp(f(x, y), f(x - W, y), u), lerp(f(x, y - W), f(x - W, y - W), u), v);
}

function waterNormals() {
  const N = 256, waves = [];
  for (let i = 0; i < 28; i++) waves.push([Math.round(rr(-14, 14)), Math.round(rr(-14, 14)), rr(0, 6.28), 1 / (1 + i * 0.35)]);
  return canvasTex(N, (x, y) => {
    let dx = 0, dy = 0;
    for (const [fx, fy, ph, a] of waves) {
      const c = Math.cos((2 * Math.PI * (fx * x + fy * y)) / N + ph) * a;
      dx += c * fx; dy += c * fy;
    }
    const n = new V3(-dx * 0.05, -dy * 0.05, 1).normalize();
    return [(n.x * 0.5 + 0.5) * 255, (n.y * 0.5 + 0.5) * 255, (n.z * 0.5 + 0.5) * 255];
  }, THREE.NoColorSpace);
}

// ───────────────────────── terreno ─────────────────────────
let terrain;
function buildTerrain() {
  for (let r = 0; r < GW; r++) for (let c = 0; c < GW; c++) heights[r * GW + c] = heightFn(-HALF + c * STEP, -HALF + r * STEP);
  const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = heights[i];
    pos.setY(i, h);
    const c = terrainRGB(x, z, h, slopeAt(x, z));
    srgb(c[0], c[1], c[2]); col[i * 3] = tmpColor.r; col[i * 3 + 1] = tmpColor.g; col[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const detail = canvasTex(256, (x, y) => {
    const v = 205 + 50 * (tileNoise(n2, x, y, 256, 0.06, 4) * 0.5 + 0.5) - 25 * Math.max(0, tileNoise(n1, x, y, 256, 0.25, 2));
    return [v, v, v];
  });
  detail.repeat.set(160, 160);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.96, metalness: 0 });
  terrain = new THREE.Mesh(g, mat);
  terrain.receiveShadow = true;
  scene.add(terrain);
}

// ───────────────────────── agua, nubes, volcán ─────────────────────────
let water;
function buildWater() {
  const normals = waterNormals();
  if (!LOW) {
    water = new Water(new THREE.PlaneGeometry(9000, 9000), {
      textureWidth: 512, textureHeight: 512, waterNormals: normals, sunDirection: new V3(0, 1, 0),
      sunColor: 0xfff2dd, waterColor: 0x0b3236, distortionScale: 2.2, fog: true,
    });
    water.material.uniforms.size.value = 2.2;
  } else {
    normals.repeat.set(900, 900);
    water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({
      color: 0x10383b, roughness: 0.06, metalness: 0.2, normalMap: normals, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.9,
    }));
  }
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER;
  scene.add(water);
}

let clouds;
function buildClouds() {
  const tex = canvasTex(256, (x, y) => {
    const v = tileNoise(n3, x, y, 256, 0.018, 5);
    const a = smooth(0.02, 0.45, v) * 255;
    return [255, 255, 255, a];
  });
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { map: { value: tex }, off: { value: new THREE.Vector2() }, tint: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform sampler2D map; uniform vec2 off; uniform vec3 tint; varying vec2 vUv;
      void main(){ float a = texture2D(map, vUv*2.5 + off).a * smoothstep(.5,.18,distance(vUv,vec2(.5)));
        float sh = texture2D(map, vUv*2.5 + off + vec2(.004)).a;
        gl_FragColor = vec4(tint*(1.-.35*sh), a*.9);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  clouds = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), mat);
  clouds.rotation.x = Math.PI / 2;
  clouds.position.y = 520;
  clouds.renderOrder = -1;
  scene.add(clouds);
}

const smoke = [];
let craterY = 0;
function buildVolcano() {
  craterY = groundH(VOLC.x, VOLC.z);
  const lava = new THREE.Mesh(new THREE.CircleGeometry(16, 24), new THREE.MeshBasicMaterial({ color: 0xff5a1a, fog: true }));
  lava.material.color.multiplyScalar(4);
  lava.rotation.x = -Math.PI / 2;
  lava.position.set(VOLC.x, craterY + 0.6, VOLC.z);
  scene.add(lava);
  const glow = new THREE.PointLight(0xff5522, 60000, 180, 2);
  glow.position.set(VOLC.x, craterY + 8, VOLC.z);
  scene.add(glow);
  const puff = canvasTex(64, (x, y) => {
    const d = Math.hypot(x - 32, y - 32) / 32;
    return [255, 255, 255, Math.max(0, 1 - d) ** 1.6 * 255 * (0.75 + 0.25 * n1(x * 0.2, y * 0.2))];
  });
  for (let i = 0; i < 34; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: 0x6b6460, transparent: true, depthWrite: false }));
    s.userData = { t: i / 34, sx: rr(-1, 1), sz: rr(-1, 1), rot: rr(-0.3, 0.3) };
    scene.add(s); smoke.push(s);
  }
}
function updateSmoke(dt) {
  for (const s of smoke) {
    const d = s.userData;
    d.t += dt / 70;
    if (d.t > 1) { d.t -= 1; d.sx = rr(-1, 1); d.sz = rr(-1, 1); }
    const t = d.t;
    s.position.set(VOLC.x + t * 160 + d.sx * 12 * (1 + t * 3), craterY + 10 + t * 260, VOLC.z + t * 60 + d.sz * 12 * (1 + t * 3));
    s.scale.setScalar(25 + t * 150);
    s.material.opacity = Math.sin(Math.PI * Math.min(1, t * 1.3)) * 0.55;
    s.material.rotation += d.rot * dt * 0.1;
  }
}

// ───────────────────────── vegetación ─────────────────────────
function paint(geom, rgb, opt = {}) {
  let g = geom.index ? geom.toNonIndexed() : geom;
  g.deleteAttribute('uv');
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const j = 1 + (rand() - 0.5) * (opt.jitter ?? 0.12);
    const grad = opt.grad ? opt.grad(p.getX(i), p.getY(i), p.getZ(i)) : 1;
    srgb(rgb[0] * j * grad, rgb[1] * j * grad, rgb[2] * j * grad);
    c[i * 3] = tmpColor.r; c[i * 3 + 1] = tmpColor.g; c[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
// hoja de helecho/cícada: tira arqueada a lo largo de +x
function frond(L, W, droop, segs = 5) {
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, x = t * L, y = -droop * t * t * L, w = W * Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.05)) * (1 - 0.3 * t);
    pos.push(x, y, -w, x, y + 0.04 * L * (1 - t), 0, x, y, w);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 3, b = a + 3;
    idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function place(g, { yaw = 0, tilt = 0, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const m = new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, tilt, 'YXZ')), new V3(sx, sy, sz));
  g.applyMatrix4(m);
  return g;
}
const tipGrad = (L) => (x, y, z) => 0.75 + 0.45 * clamp(Math.hypot(x, z) / L, 0, 1);

function geoAraucaria() {
  const parts = [paint(place(new THREE.CylinderGeometry(0.22, 0.48, 17, 7), { y: 8.5 }), [0.34, 0.26, 0.19], { grad: (x, y) => 0.7 + y / 40 })];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, r = i === 0 ? 0 : rr(1.2, 2.2);
    const s = rr(1.8, 2.6);
    parts.push(paint(place(new THREE.IcosahedronGeometry(1, 1), { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 15.2 + rr(-1, 1.6) + (i === 0 ? 1.6 : 0), sx: s * 1.4, sy: s * 0.5, sz: s * 1.4, yaw: a }), [0.15, 0.25, 0.12], { jitter: 0.25 }));
  }
  return mergeGeometries(parts);
}
function geoConifer() {
  const parts = [paint(place(new THREE.CylinderGeometry(0.16, 0.36, 13, 6), { y: 6.5 }), [0.32, 0.24, 0.17])];
  [[3.4, 4.5, 4.6], [2.8, 4, 7.2], [2.1, 3.4, 9.6], [1.4, 3, 11.8], [0.7, 2.4, 13.6]].forEach(([r, h, y]) =>
    parts.push(paint(place(new THREE.ConeGeometry(r, h, 9, 1), { y, yaw: rand() * 6 }), [0.12, 0.21, 0.11], { jitter: 0.3, grad: (x, yy, z) => 0.8 + 0.35 * Math.hypot(x, z) / r })));
  return mergeGeometries(parts);
}
function geoCycad() {
  const parts = [paint(place(new THREE.CylinderGeometry(0.38, 0.5, 1.5, 8), { y: 0.75 }), [0.36, 0.29, 0.18], { jitter: 0.3 })];
  for (let i = 0; i < 16; i++) parts.push(paint(place(frond(2.1, 0.3, 0.25, 5), { y: 1.45, yaw: (i / 16) * 6.28 + rr(-0.1, 0.1), tilt: i % 2 ? 0.75 : 0.45 }), [0.22, 0.38, 0.11], { grad: tipGrad(2.1) }));
  return mergeGeometries(parts);
}
function geoTreeFern() {
  const parts = [paint(place(new THREE.CylinderGeometry(0.16, 0.26, 4.6, 6), { y: 2.3 }), [0.2, 0.15, 0.1], { jitter: 0.3 })];
  for (let i = 0; i < 13; i++) parts.push(paint(place(frond(3, 0.5, 0.5, 6), { y: 4.5, yaw: (i / 13) * 6.28, tilt: rr(0.15, 0.45) }), [0.2, 0.4, 0.12], { grad: tipGrad(3) }));
  return mergeGeometries(parts);
}
function geoFern() {
  const parts = [];
  for (let i = 0; i < 8; i++) parts.push(paint(place(frond(0.95, 0.18, 0.6, 4), { yaw: (i / 8) * 6.28 + rr(-0.2, 0.2), tilt: rr(0.6, 1.0) }), [0.24, 0.42, 0.13], { grad: tipGrad(0.95) }));
  return mergeGeometries(parts);
}
function geoHorsetail() {
  const parts = [];
  for (let i = 0; i < 8; i++) {
    const h = rr(0.9, 1.9);
    parts.push(paint(place(new THREE.CylinderGeometry(0.018, 0.035, h, 4), { x: rr(-0.35, 0.35), z: rr(-0.35, 0.35), y: h / 2 }), [0.36, 0.44, 0.2], { grad: (x, y) => 0.75 + y * 0.25 }));
  }
  return mergeGeometries(parts);
}
function geoRock() {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new V3(p.getX(i), p.getY(i), p.getZ(i));
    const k = 1 + 0.28 * n2(v.x * 1.7 + v.z, v.y * 1.7 - v.z) + 0.1 * n1(v.x * 4, v.y * 4 + v.z * 4);
    v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return paint(g, [0.47, 0.45, 0.42], { jitter: 0.08, grad: (x, y) => 0.8 + 0.25 * y });
}

function swayMaterial(amp, side = THREE.DoubleSide) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, side });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime; sh.uniforms.uSway = { value: amp };
    sh.vertexShader = 'uniform float uTime; uniform float uSway;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      #else
        vec2 ip = vec2(0.);
      #endif
      float sw = sin(uTime*1.3 + ip.x*.05 + ip.y*.07) + .4*sin(uTime*2.9 + ip.x*.13);
      float hh = max(transformed.y, 0.);
      transformed.x += sw * uSway * hh * hh;
      transformed.z += sw * uSway * .6 * hh * hh;`);
  };
  return m;
}

// colisiones (troncos y rocas) en rejilla
const CELL = 10, cells = new Map();
function addCollider(x, z, r) {
  const k = Math.floor(x / CELL) + ',' + Math.floor(z / CELL);
  if (!cells.has(k)) cells.set(k, []);
  cells.get(k).push({ x, z, r });
}
function collide(p, pr) {
  const gx = Math.floor(p.x / CELL), gz = Math.floor(p.z / CELL);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const list = cells.get(gx + a + ',' + (gz + b));
    if (!list) continue;
    for (const c of list) {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + pr;
      if (d < m && d > 1e-4) { p.x = c.x + (dx / d) * m; p.z = c.z + (dz / d) * m; }
    }
  }
}

function clearAround(x, z, r) {
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const list = cells.get(Math.floor(x / CELL) + a + ',' + (Math.floor(z / CELL) + b)) || [];
    if (list.some((c) => Math.hypot(c.x - x, c.z - z) < r + c.r)) return false;
  }
  return true;
}
// muros de edificios (segmentos) y plataformas transitables (muelle)
const walls = [], platforms = [];
function addWall(ax, az, bx, bz, t, top) { walls.push({ ax, az, bx, bz, t, top }); }
function addPlatform(x0, z0, x1, z1, y) { platforms.push({ x0, z0, x1, z1, y }); }
function groundAt(x, z) {
  let g = groundH(x, z);
  for (const p of platforms) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) g = Math.max(g, p.y);
  return g;
}
function collideWalls(p, pr) {
  for (const w of walls) {
    if (p.y > w.top) continue;
    const dx = w.bx - w.ax, dz = w.bz - w.az, L2 = dx * dx + dz * dz;
    const t = clamp(((p.x - w.ax) * dx + (p.z - w.az) * dz) / L2, 0, 1);
    const cx = w.ax + dx * t, cz = w.az + dz * t, ex = p.x - cx, ez = p.z - cz, d = Math.hypot(ex, ez), m = pr + w.t / 2;
    if (d < m) {
      if (d > 1e-4) { p.x = cx + (ex / d) * m; p.z = cz + (ez / d) * m; }
      else { const L = Math.sqrt(L2); p.x = cx - (dz / L) * m; p.z = cz + (dx / L) * m; }
    }
  }
}
const CH = 300, NCH = SIZE / CH, chunks = [];
function scatter(geom, mat, count, test, { shadow = true, maxDist = 1e9, collider = 0, sink = 0.1, tilt = 0.06 } = {}) {
  const buckets = Array.from({ length: NCH * NCH }, () => []);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new V3(), c = new THREE.Color();
  let placed = 0, tries = 0;
  count = Math.round(count * DENS);
  if (TESTQ) count = Math.round(count * 0.25);
  while (placed < count && tries < count * 40) {
    tries++;
    const x = rr(-HALF + 6, HALF - 6), z = rr(-HALF + 6, HALF - 6), h = groundH(x, z);
    if (!parkClear(x, z)) continue;
    const sc = test(x, z, h, slopeAt(x, z));
    if (!sc) continue;
    e.set(rr(-tilt, tilt), rand() * Math.PI * 2, rr(-tilt, tilt));
    q.setFromEuler(e);
    s.set(sc, sc * rr(0.85, 1.15), sc);
    m.compose(new V3(x, h - sink * sc, z), q, s);
    const bi = clamp(Math.floor((z + HALF) / CH), 0, NCH - 1) * NCH + clamp(Math.floor((x + HALF) / CH), 0, NCH - 1);
    buckets[bi].push([m.clone(), rr(0.8, 1.15)]);
    if (collider) addCollider(x, z, collider * sc);
    placed++;
  }
  buckets.forEach((list, bi) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geom, mat, list.length);
    list.forEach(([mm, k], i) => { im.setMatrixAt(i, mm); im.setColorAt(i, c.setRGB(k, k, k * rr(0.95, 1.05))); });
    im.castShadow = shadow; im.receiveShadow = true;
    im.computeBoundingSphere();
    scene.add(im);
    const cx = -HALF + (bi % NCH + 0.5) * CH, cz = -HALF + (Math.floor(bi / NCH) + 0.5) * CH;
    chunks.push({ im, cx, cz, maxDist });
  });
}

function buildVegetation() {
  const treeMat = swayMaterial(0.00008), plantMat = swayMaterial(0.012), stiff = swayMaterial(0.0006);
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: false });
  const land = (h, s, hmin, hmax, smax) => h > hmin && h < hmax && s < smax;
  const noVolc = (x, z) => volcDist(x, z) > 175;
  scatter(geoAraucaria(), treeMat, 650, (x, z, h, s) => land(h, s, 2.5, 95, 0.42) && noVolc(x, z) && forestN(x, z) > -0.05 && rr(0.75, 1.35), { collider: 0.45, sink: 0.3 });
  scatter(geoConifer(), treeMat, 900, (x, z, h, s) => land(h, s, 3, 125, 0.55) && noVolc(x, z) && (forestN(x, z) > 0.08 || (h > 40 && rand() < 0.5)) && rr(0.7, 1.3), { collider: 0.38, sink: 0.3 });
  scatter(geoCycad(), stiff, 950, (x, z, h, s) => land(h, s, 1.2, 45, 0.4) && noVolc(x, z) && forestN(x, z) < 0.3 && rr(0.7, 1.4), { collider: 0.45 });
  scatter(geoTreeFern(), stiff, 750, (x, z, h, s) => land(h, s, 0.8, 30, 0.35) && noVolc(x, z) && (h < 6 || forestN(x, z) > 0.05) && rr(0.7, 1.3), { collider: 0.25 });
  scatter(geoFern(), plantMat, 7500, (x, z, h, s) => land(h, s, 0.6, 70, 0.55) && noVolc(x, z) && !(forestN(x, z) < -0.15 && rand() < 0.6) && rr(0.6, 1.6), { shadow: false, maxDist: 380, tilt: 0.2 });
  scatter(geoHorsetail(), plantMat, 3000, (x, z, h, s) => land(h, s, 0.1, 3.2, 0.4) && rr(0.7, 1.4), { shadow: false, maxDist: 380, tilt: 0.15, sink: 0 });
  scatter(geoRock(), rockMat, 700, (x, z, h, s) => h > -1 && (s > 0.35 || h > 60 || volcDist(x, z) < 220 || rand() < 0.12) && rr(0.4, 2.4), { collider: 0.9, sink: 0.35, tilt: 0.6 });
}

// ───────────────────────── dinosaurios ─────────────────────────
// Cuerpo = barrido de secciones elípticas a lo largo de una columna (plano XY, la cabeza hacia +x)
function sweep(points, radii, colorFn, radial = 14, perPoint = 7) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new V3(p[0], p[1], 0)));
  const segs = (points.length - 1) * perPoint;
  const pos = [], col = [], idx = [], P = new V3(), T = new V3(), N = new V3(0, 0, 1), B = new V3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPoint(t, P); curve.getTangent(t, T);
    B.crossVectors(N, T).normalize();
    const f = t * (radii.length - 1), k = Math.min(Math.floor(f), radii.length - 2), u = f - k;
    const ra = radii[k], rb = radii[k + 1];
    const rw = lerp(ra[0], rb[0], u), rh = lerp(ra[1] ?? ra[0], rb[1] ?? rb[0], u);
    for (let j = 0; j <= radial; j++) {
      const a = -Math.PI / 2 + (j / radial) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const x = P.x + N.x * ca * rw + B.x * sa * rh, y = P.y + N.y * ca * rw + B.y * sa * rh, z = ca * rw;
      pos.push(x, y, z);
      const c = colorFn(x, y, z, sa, t);
      srgb(c[0], c[1], c[2]); col.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g.toNonIndexed();
}
function skin(sp) {
  return (x, y, z, sa) => {
    const top = smooth(-0.35, 0.65, sa);
    let c = [lerp(sp.belly[0], sp.back[0], top), lerp(sp.belly[1], sp.back[1], top), lerp(sp.belly[2], sp.back[2], top)];
    const st = 0.5 + 0.5 * Math.sin(x * sp.freq + n1(x * 0.4, y * 0.4) * 2.2);
    const k = (1 - sp.stripe * smooth(0.55, 0.95, st) * smooth(0, 0.8, sa)) * (0.88 + 0.24 * (n2(x * 1.6 + z * 2, y * 1.6) * 0.5 + 0.5));
    return [c[0] * k, c[1] * k, c[2] * k];
  };
}

const SPECIES = {
  brachio: {
    name: 'Brachiosaurus', sci: 'Brachiosaurus altithorax', diet: 'Herbívoro', len: '22 m', speed: 1.5, run: 3, radius: 3.2, stride: 3.4, gait: 'quad', range: 30,
    spine: [[-12, 4.4], [-9, 5.3], [-5, 6.4], [-2, 7.0], [0.6, 7.3], [3, 7.8], [4.9, 9.2], [6.3, 12], [7.4, 15], [8.2, 16.7], [9.3, 16.6], [10.1, 16.3]],
    radii: [[0.05], [0.45, 0.5], [1.0, 1.1], [1.7, 1.9], [2.0, 2.3], [1.8, 2.1], [1.05, 1.15], [0.62, 0.66], [0.47, 0.47], [0.5, 0.45], [0.3, 0.27], [0.04]],
    legs: [[-2, 1.15, 6.2, 0.62], [-2, -1.15, 6.2, 0.62], [3.2, 1.2, 6.9, 0.58], [3.2, -1.2, 6.9, 0.58]],
    eye: [8.9, 16.85, 0.36], back: [0.43, 0.41, 0.35], belly: [0.66, 0.62, 0.52], stripe: 0.12, freq: 1.2,
  },
  diplo: {
    name: 'Diplodocus', sci: 'Diplodocus carnegii', diet: 'Herbívoro', len: '26 m', speed: 1.7, run: 3.5, radius: 2.4, stride: 2.8, gait: 'quad', range: 30,
    spine: [[-17, 2.4], [-13, 3.2], [-8.5, 4.0], [-4.5, 4.6], [-1.5, 4.9], [1, 4.8], [3.4, 4.4], [6, 4.6], [9, 5.0], [11.8, 5.3], [13.1, 5.25], [14.1, 5.0]],
    radii: [[0.04], [0.3, 0.32], [0.65, 0.72], [1.1, 1.25], [1.4, 1.6], [1.45, 1.65], [1.2, 1.35], [0.7, 0.75], [0.45, 0.47], [0.34, 0.34], [0.32, 0.28], [0.04]],
    legs: [[-1.5, 0.95, 4.1, 0.5], [-1.5, -0.95, 4.1, 0.5], [3.4, 0.95, 3.5, 0.45], [3.4, -0.95, 3.5, 0.45]],
    eye: [13.25, 5.45, 0.27], back: [0.49, 0.44, 0.33], belly: [0.72, 0.65, 0.5], stripe: 0.28, freq: 1.6,
  },
  allo: {
    name: 'Allosaurus', sci: 'Allosaurus fragilis', diet: 'Carnívoro', len: '9,5 m', speed: 2, run: 7.5, radius: 1.3, stride: 2.3, gait: 'biped', range: 160, hunter: true,
    spine: [[-6.2, 2.3], [-4.2, 2.6], [-2, 2.95], [0, 3.15], [1.5, 3.05], [2.6, 3.3], [3.3, 3.85], [3.75, 4.05], [4.6, 3.85], [5.25, 3.65]],
    radii: [[0.04], [0.28, 0.32], [0.55, 0.65], [0.72, 0.95], [0.68, 0.92], [0.45, 0.55], [0.42, 0.5], [0.45, 0.62], [0.32, 0.4], [0.05]],
    legs: [[0, 0.52, 2.75, 0.38], [0, -0.52, 2.75, 0.38]], arms: [[2.1, 0.5, 2.7], [2.1, -0.5, 2.7]],
    eye: [4.05, 4.22, 0.36], back: [0.42, 0.28, 0.18], belly: [0.78, 0.68, 0.52], stripe: 0.45, freq: 2.2,
  },
  stego: {
    name: 'Stegosaurus', sci: 'Stegosaurus stenops', diet: 'Herbívoro', len: '9 m', speed: 1.1, run: 2.5, radius: 1.8, stride: 1.6, gait: 'quad', range: 25,
    spine: [[-5, 1.7], [-3.6, 2.2], [-1.8, 2.75], [0, 3.0], [1.6, 2.65], [2.8, 2.15], [3.7, 1.6], [4.3, 1.25], [4.8, 1.1], [5.15, 1.05]],
    radii: [[0.04], [0.3, 0.33], [0.65, 0.75], [0.95, 1.15], [0.85, 1.0], [0.62, 0.72], [0.34, 0.36], [0.3, 0.28], [0.22, 0.2], [0.03]],
    legs: [[0, 0.62, 2.3, 0.38], [0, -0.62, 2.3, 0.38], [2.7, 0.55, 1.65, 0.3], [2.7, -0.55, 1.65, 0.3]],
    eye: [4.55, 1.32, 0.22], back: [0.38, 0.42, 0.28], belly: [0.66, 0.64, 0.48], stripe: 0.2, freq: 1.8, plates: [0.6, 0.32, 0.2],
  },
};
const dinoMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });

function legGeom(sp, L, r, biped) {
  const pts = biped
    ? [[0, 0.1], [0.32 * L, -0.42 * L], [-0.12 * L, -0.8 * L], [0.04 * L, -0.97 * L], [0.28 * L, -L], [0.32 * L, -L - 0.01]]
    : [[0, 0.1], [0.06 * L, -0.45 * L], [-0.03 * L, -0.86 * L], [0.03 * L, -0.98 * L], [0.04 * L, -L - 0.02]];
  const radii = biped ? [[r * 1.25], [r * 0.85], [r * 0.42], [r * 0.38], [r * 0.25], [0.01]] : [[r], [r * 0.82], [r * 0.62], [r * 0.78], [0.02]];
  const c = sp.back;
  return sweep(pts, radii, (x, y) => { const k = 0.65 + 0.3 * clamp((y + L) / L, 0, 1); return [c[0] * k, c[1] * k, c[2] * k]; }, 10, 5);
}
const geoCache = {};
function dinoGeoms(key) {
  if (geoCache[key]) return geoCache[key];
  const sp = SPECIES[key];
  const parts = [sweep(sp.spine, sp.radii, skin(sp), 16, 8)];
  const eye = (zs) => paint(place(new THREE.SphereGeometry(key === 'brachio' || key === 'diplo' ? 0.08 : 0.055, 8, 6), { x: sp.eye[0], y: sp.eye[1], z: sp.eye[2] * zs }), [0.05, 0.04, 0.03], { jitter: 0 });
  parts.push(eye(1), eye(-1));
  if (sp.arms) for (const [x, z, y] of sp.arms) {
    const a = sweep([[0, 0], [0.25, -0.35], [0.5, -0.55], [0.62, -0.6]], [[0.16], [0.12], [0.08], [0.02]], () => sp.back, 8, 4);
    a.translate(x, y, z); parts.push(a);
  }
  if (sp.plates) {
    const curve = new THREE.CatmullRomCurve3(sp.spine.map((p) => new V3(p[0], p[1], 0)));
    for (let i = 0; i < 15; i++) {
      const t = 0.1 + (i / 14) * 0.52, P = curve.getPoint(t), T = curve.getTangent(t);
      const f = t * (sp.radii.length - 1), k = Math.floor(f), rh = lerp(sp.radii[k][1] ?? sp.radii[k][0], sp.radii[k + 1][1] ?? sp.radii[k + 1][0], f - k);
      const hgt = 0.35 + 0.75 * Math.sin(Math.PI * (i / 14)) ** 1.2, w = hgt * 0.95;
      const sh = new THREE.Shape();
      sh.moveTo(-w / 2, 0); sh.quadraticCurveTo(-w * 0.5, hgt * 0.75, 0, hgt); sh.quadraticCurveTo(w * 0.5, hgt * 0.75, w / 2, 0); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false });
      g.translate(0, -0.1, -0.03);
      g.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.atan2(T.y, T.x)));
      g.translate(P.x, P.y + rh * 0.88, (i % 2 ? 0.13 : -0.13));
      parts.push(paint(g, sp.plates, { grad: (x, y) => 0.75 + 0.35 * clamp(y - P.y - rh, 0, 1) }));
    }
    for (const [zs, k] of [[1, 0], [-1, 0], [1, 1], [-1, 1]]) {
      const g = new THREE.ConeGeometry(0.06, 0.75, 6);
      g.translate(0, 0.37, 0);
      g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(zs * 1.0, 0, 0.7)));
      g.translate(-4.1 + k * 0.45, 2.0 + k * 0.1, zs * 0.12);
      parts.push(paint(g, [0.85, 0.8, 0.68]));
    }
  }
  const body = mergeGeometries(parts.map((p) => { const q = p.index ? p.toNonIndexed() : p; for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'color'].includes(k)) q.deleteAttribute(k); return q; }));
  const legs = sp.legs.map(([, , L, r]) => legGeom(sp, L, r, sp.gait === 'biped'));
  return (geoCache[key] = { body, legs });
}

const dinos = [];
const herds = [];
function validLand(x, z, wade = -0.8, zone = undefined) {
  return Math.abs(x) < HALF - 30 && Math.abs(z) < HALF - 30 && groundH(x, z) > wade && slopeAt(x, z) < 0.42 && (zone === undefined || dinoAllowed(x, z, zone));
}
function findLand(cx, cz, r, tries = 200, zone = undefined) {
  for (let i = 0; i < tries; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * r, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (validLand(x, z, 0.5, zone)) return new V3(x, groundH(x, z), z);
  }
  return null;
}

class Dino {
  constructor(key, pos, herd, scale = 1, zone = null) {
    this.sp = SPECIES[key]; this.key = key; this.herd = herd; this.scale = scale; this.zone = herd ? herd.zone : zone;
    const { body, legs } = dinoGeoms(key);
    this.g = new THREE.Group();
    this.g.rotation.order = 'YZX';
    const mesh = new THREE.Mesh(body, dinoMat); mesh.castShadow = true; mesh.receiveShadow = true;
    this.g.add(mesh);
    const biped = this.sp.gait === 'biped';
    const offs = biped ? [0, Math.PI] : [0, Math.PI, Math.PI / 2, Math.PI * 1.5];
    this.legs = this.sp.legs.map(([x, z, L], i) => {
      const pivot = new THREE.Group(); pivot.position.set(x, L, z);
      const lm = new THREE.Mesh(legs[i], dinoMat); lm.castShadow = true; pivot.add(lm);
      this.g.add(pivot);
      return { pivot, off: offs[i] };
    });
    this.g.scale.setScalar(scale);
    scene.add(this.g);
    this.pos = pos.clone(); this.yaw = rand() * Math.PI * 2; this.speed = 0; this.phase = rand() * 6;
    this.target = null; this.timer = rr(0, 6); this.stalk = 0; this.bored = 0; this.callT = rr(5, 30);
    this.radius = this.sp.radius * scale;
  }
  pickTarget() {
    const a = this.herd ? this.herd.anchor : this.pos;
    this.target = findLand(a.x, a.z, this.sp.range, 30, this.zone);
  }
  update(dt) {
    const sp = this.sp;
    let want = 0;
    const toP = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
    if (sp.hunter) {
      this.bored -= dt;
      if (!player.drone && toP < 45 && this.bored <= 0 && this.stalk <= 0) { this.stalk = 22; onStalk(this); }
      if (this.stalk > 0) {
        this.stalk -= dt;
        if (this.stalk <= 0 || player.drone) { this.stalk = 0; this.bored = 40; this.target = null; }
        else this.target = new V3(player.pos.x, 0, player.pos.z);
      }
    }
    if (this.target) {
      const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z, d = Math.hypot(dx, dz);
      const stopAt = this.stalk > 0 ? 7 * this.scale : 3;
      if (d < stopAt) { if (this.stalk <= 0) { this.target = null; this.timer = rr(4, 14); } }
      else {
        const dy = wrapAngle(Math.atan2(-dz, dx) - this.yaw);
        this.yaw += clamp(dy, -0.6 * dt, 0.6 * dt);
        want = (this.stalk > 0 ? sp.run * (toP > 18 ? 0.9 : 0.35) : sp.speed) * (Math.abs(dy) > 1.2 ? 0.4 : 1) * Math.sqrt(this.scale);
      }
    } else if ((this.timer -= dt) <= 0) this.pickTarget();
    this.speed = lerp(this.speed, want, 1 - Math.exp(-dt * 1.5));
    const fx = Math.cos(this.yaw), fz = -Math.sin(this.yaw);
    const nx = this.pos.x + fx * this.speed * dt, nz = this.pos.z + fz * this.speed * dt;
    if (validLand(nx, nz, -0.8, this.zone)) { this.pos.x = nx; this.pos.z = nz; } else { this.target = null; this.timer = 1; this.speed *= 0.5; }
    const half = (sp.radius * 1.4) * this.scale;
    const hf = groundH(this.pos.x + fx * half, this.pos.z + fz * half), hb = groundH(this.pos.x - fx * half, this.pos.z - fz * half);
    const gy = Math.min(groundH(this.pos.x, this.pos.z), (hf + hb) / 2 + 0.2);
    this.phase += (2 * Math.PI * this.speed * dt) / (sp.stride * this.scale);
    const moving = clamp(this.speed / (sp.speed * 0.6), 0, 1);
    this.g.position.set(this.pos.x, gy + Math.abs(Math.sin(this.phase)) * 0.05 * moving * this.scale, this.pos.z);
    this.g.rotation.set(0, this.yaw, clamp(Math.atan2(hf - hb, 2 * half), -0.35, 0.35));
    for (const l of this.legs) l.pivot.rotation.z = Math.sin(this.phase + l.off) * 0.38 * moving;
    this.pos.y = gy;
  }
}

class Ptero {
  constructor(cx, cz) {
    this.c = new V3(cx, 0, cz); this.R = rr(30, 90); this.alt = rr(35, 85); this.a = rand() * 6.28; this.w = rr(0.12, 0.22) * (rand() < 0.5 ? 1 : -1);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
    const body = sweep([[-0.9, -0.02], [-0.4, 0], [-0.1, 0.02], [0.18, 0.04], [0.32, 0.08], [0.55, 0.06], [0.72, 0.03]],
      [[0.01], [0.025], [0.07, 0.08], [0.08, 0.09], [0.05], [0.035, 0.03], [0.005]], (x, y, z, sa) => sa > 0 ? [0.35, 0.27, 0.2] : [0.7, 0.62, 0.5], 8, 4);
    this.g = new THREE.Group();
    this.g.add(new THREE.Mesh(body, mat));
    const wingG = () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([0.15, 0, 0, 0.05, 0.02, 0.45, 0.1, 0.05, 0.92, -0.05, 0, 0.5, -0.12, 0, 0.06], 3));
      g.setIndex([0, 1, 4, 1, 3, 4, 1, 2, 3]);
      g.computeVertexNormals();
      return paint(g, [0.45, 0.33, 0.24], { jitter: 0.1 });
    };
    this.wings = [1, -1].map((s) => {
      const p = new THREE.Group(); const m = new THREE.Mesh(wingG(), mat); m.scale.z = s; p.add(m); this.g.add(p); return p;
    });
    this.g.rotation.order = 'YXZ';
    this.g.scale.setScalar(1.15);
    scene.add(this.g);
    this.t = rand() * 10;
  }
  update(dt) {
    this.t += dt; this.a += this.w * dt;
    const x = this.c.x + Math.cos(this.a) * this.R, z = this.c.z + Math.sin(this.a) * this.R;
    const y = Math.max(groundH(x, z), WATER) + this.alt + Math.sin(this.t * 0.4) * 6;
    this.g.position.set(x, y, z);
    const vx = -Math.sin(this.a) * this.w, vz = Math.cos(this.a) * this.w;
    this.g.rotation.set(0, Math.atan2(-vz, vx), 0);
    this.g.rotation.x = -Math.sign(this.w) * 0.35;
    const flap = Math.sin(this.t * 0.7) > 0.2 ? Math.sin(this.t * 9) * 0.6 : 0.08;
    this.wings[0].rotation.x = -flap; this.wings[1].rotation.x = flap;
  }
}
const pteros = [];

function spawnFauna() {
  const herd = (key, cx, cz, n, juveniles = 0, zone = null) => {
    const anchor = findLand(cx, cz, 60, 200, zone) || findLand(cx, cz, 250, 400, zone);
    if (!anchor) return;
    const h = { anchor, key, timer: rr(30, 60), members: [], zone };
    herds.push(h);
    for (let i = 0; i < n + juveniles; i++) {
      const p = findLand(anchor.x, anchor.z, 30, 200, zone) || anchor;
      const d = new Dino(key, p, h, i >= n ? rr(0.4, 0.55) : rr(0.88, 1.08));
      dinos.push(d); h.members.push(d);
    }
  };
  const [sauro, stego, allo] = PADDOCKS;
  // animales del parque, dentro de sus recintos
  herd('brachio', sauro.x, sauro.z, 3, 1, sauro);
  herd('diplo', sauro.x - 20, sauro.z + 20, 2, 0, sauro);
  herd('stego', stego.x, stego.z, 3, 1, stego);
  { const p = findLand(allo.x, allo.z, 30, 300, allo); if (p) dinos.push(new Dino('allo', p, null, 1, allo)); }
  // fauna salvaje del resto del valle
  herd('diplo', 10, 250, 4, 1, null);
  herd('stego', -330, 150, 2, 0, null);
  herd('brachio', -380, -200, 2, 0, null);
  for (const [x, z] of [[-260, -190], [-380, 60]]) {
    const p = findLand(x, z, 120, 300, null);
    if (p) dinos.push(new Dino('allo', p, null, rr(0.9, 1.05), null));
  }
  for (let i = 0; i < 16; i++) {
    const c = i < 8 ? [LAKE.x + rr(-60, 60), LAKE.z + rr(-40, 40)] : [rr(-300, 300), rr(380, 470)];
    pteros.push(new Ptero(c[0], c[1]));
  }
}
function updateHerds(dt) {
  for (const h of herds) {
    if ((h.timer -= dt) > 0) continue;
    h.timer = rr(40, 90);
    const n = findLand(h.anchor.x, h.anchor.z, h.zone ? h.zone.r * 0.7 : 140, 200, h.zone);
    if (n) h.anchor = n;
  }
}

// ───────────────────────── jugador y controles ─────────────────────────
const player = { prev: new V3(), pos: new V3(), vy: 0, yaw: 0, pitch: 0, onGround: true, drone: false, run: false, bob: 0, swim: false };
const keys = new Set();
let sens = 1, active = false, mapOpen = false;
const joy = { x: 0, y: 0 }, touchBtn = { up: false, down: false };

function findSpawn() {
  for (let r = 0; r < 300; r += 6) for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2, x = -20 + Math.cos(a) * r, z = 60 + Math.sin(a) * r;
    const h = groundH(x, z);
    if (h > 2 && h < 20 && slopeAt(x, z) < 0.2 && forestN(x, z) < 0) return new V3(x, h, z);
  }
  return new V3(0, groundH(0, 0), 0);
}

addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (!active) return;
  if (e.code === 'KeyF') toggleDrone();
  if (e.code === 'KeyM') toggleMap();
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  player.yaw -= e.movementX * 0.0021 * sens;
  player.pitch = clamp(player.pitch - e.movementY * 0.0021 * sens, -1.45, 1.45);
});
document.addEventListener('pointerlockchange', () => {
  if (TOUCH) return;
  if (document.pointerLockElement !== renderer.domElement && active && !mapOpen) showPause(true);
});
renderer.domElement.addEventListener('click', () => { if (active && !TOUCH && !mapOpen) lock(); });
function lock() { renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); }

// táctil: joystick + mirar
if (TOUCH) {
  const jEl = $('#joy'), knob = $('#knob');
  let jId = null, lId = null, lx = 0, ly = 0;
  const tz = $('#touch');
  tz.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (t.target.closest('button')) continue;
      const r = jEl.getBoundingClientRect();
      if (jId === null && t.clientX < innerWidth * 0.45 && t.clientY > innerHeight * 0.35) {
        jId = t.identifier; jEl.dataset.cx = r.left + r.width / 2; jEl.dataset.cy = r.top + r.height / 2; moveJoy(t);
      } else if (lId === null) { lId = t.identifier; lx = t.clientX; ly = t.clientY; }
    }
    e.preventDefault();
  }, { passive: false });
  const moveJoy = (t) => {
    let dx = t.clientX - jEl.dataset.cx, dy = t.clientY - jEl.dataset.cy;
    const d = Math.hypot(dx, dy), m = 50;
    if (d > m) { dx *= m / d; dy *= m / d; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    joy.x = dx / m; joy.y = dy / m;
  };
  tz.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === jId) moveJoy(t);
      else if (t.identifier === lId) {
        player.yaw -= (t.clientX - lx) * 0.005 * sens;
        player.pitch = clamp(player.pitch - (t.clientY - ly) * 0.005 * sens, -1.45, 1.45);
        lx = t.clientX; ly = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === jId) { jId = null; joy.x = joy.y = 0; knob.style.transform = ''; }
      if (t.identifier === lId) lId = null;
    }
  };
  tz.addEventListener('touchend', end); tz.addEventListener('touchcancel', end);
  const hold = (id, k) => {
    const b = $(id);
    b.addEventListener('touchstart', (e) => { touchBtn[k] = true; e.preventDefault(); }, { passive: false });
    b.addEventListener('touchend', () => (touchBtn[k] = false));
  };
  hold('#tUp', 'up'); hold('#tDown', 'down');
  $('#tRun').addEventListener('touchstart', (e) => { player.run = !player.run; $('#tRun').classList.toggle('on', player.run); e.preventDefault(); }, { passive: false });
  $('#tDrone').addEventListener('touchstart', (e) => { toggleDrone(); e.preventDefault(); }, { passive: false });
}

function toggleDrone() {
  player.drone = !player.drone;
  if (player.drone) player.pos.y = Math.max(player.pos.y, Math.max(groundH(player.pos.x, player.pos.z), WATER) + 25);
  player.vy = 0;
  $('#bDrone').classList.toggle('on', player.drone);
  $('#tDrone').classList.toggle('on', player.drone);
  $('#tDown').style.visibility = player.drone ? 'visible' : 'hidden';
  $('#tUp').textContent = player.drone ? 'Subir' : 'Saltar';
  toast(player.drone ? 'Modo dron: vuela libremente' : 'De vuelta a pie');
}

const fwd = new V3(), right = new V3();
function updatePlayer(dt) {
  const p = player.pos;
  let mx = joy.x, mz = -joy.y;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  const run = player.run || keys.has('ShiftLeft') || keys.has('ShiftRight');
  fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  right.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const g = groundAt(p.x, p.z);
  if (player.drone) {
    const sp = run ? 95 : 32;
    fwd.set(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch));
    p.addScaledVector(fwd, mz * sp * dt).addScaledVector(right, mx * sp * dt);
    const up = (keys.has('Space') || touchBtn.up ? 1 : 0) - (keys.has('KeyC') || keys.has('ControlLeft') || touchBtn.down ? 1 : 0);
    p.y += up * sp * 0.7 * dt;
    p.x = clamp(p.x, -HALF + 5, HALF - 5); p.z = clamp(p.z, -HALF + 5, HALF + 300);
    p.y = clamp(p.y, Math.max(groundH(p.x, p.z), WATER) + 1.5, 480);
    player.swim = false;
  } else {
    const depth = WATER - g;
    player.swim = depth > 1.35;
    const sp = (run ? 9 : 4.3) * (player.swim ? 0.45 : depth > 0.4 ? 0.7 : 1);
    const nx = p.x + (fwd.x * mz + right.x * mx) * sp * dt, nz = p.z + (fwd.z * mz + right.z * mx) * sp * dt;
    const ng = groundAt(nx, nz);
    if (!(ng > g && slopeAt(nx, nz) > 0.9 && ng > WATER)) { p.x = nx; p.z = nz; }
    p.x = clamp(p.x, -HALF + 8, HALF - 8); p.z = clamp(p.z, -HALF + 8, HALF - 8);
    collide(p, 0.35);
    collideWalls(p, 0.35);
    for (const pd of PADDOCKS) {
      const d = Math.hypot(p.x - pd.x, p.z - pd.z), was = Math.hypot(player.prev.x - pd.x, player.prev.z - pd.z);
      if (Math.abs(d - pd.r) < 1.2 && d > 0.01) {
        const k = (was < pd.r ? pd.r - 1.2 : pd.r + 1.2) / d;
        p.x = pd.x + (p.x - pd.x) * k; p.z = pd.z + (p.z - pd.z) * k;
      }
    }
    for (const j of park.movers) {
      const dx = p.x - j.pos.x, dz = p.z - j.pos.z, dd = Math.hypot(dx, dz);
      if (dd < j.radius && dd > 0.01) { p.x = j.pos.x + (dx / dd) * j.radius; p.z = j.pos.z + (dz / dd) * j.radius; }
    }
    for (const d of dinos) {
      const dx = p.x - d.pos.x, dz = p.z - d.pos.z, dd = Math.hypot(dx, dz);
      if (dd < d.radius && dd > 0.01) { p.x = d.pos.x + (dx / dd) * d.radius; p.z = d.pos.z + (dz / dd) * d.radius; }
    }
    const gh = groundAt(p.x, p.z);
    if (player.swim) { p.y = lerp(p.y, WATER - 1.45 + Math.sin(uTime.value * 2) * 0.05, 1 - Math.exp(-dt * 6)); player.vy = 0; player.onGround = true; }
    else {
      if ((keys.has('Space') || touchBtn.up) && player.onGround) { player.vy = 6.2; player.onGround = false; }
      player.vy -= 22 * dt;
      p.y += player.vy * dt;
      if (p.y <= gh || (player.onGround && player.vy <= 0 && p.y - gh < 0.6)) { p.y = gh; player.vy = 0; player.onGround = true; }
      else player.onGround = false;
    }
    if (ml > 0.1 && player.onGround && !player.swim) player.bob += dt * sp * 1.9;
  }
  player.prev.copy(p);
  const bob = player.drone ? 0 : Math.sin(player.bob) * 0.045;
  camera.position.set(p.x, p.y + (player.drone ? 0 : 1.7) + bob, p.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
}

// ───────────────────────── cielo y hora del día ─────────────────────────
let hour = 9.5, envTimer = null, envIntensity = 0.55, park = null;
function setHour(hh, regenEnv = true) {
  hour = hh;
  const raw = 66 * Math.sin((Math.PI * (hh - 6)) / 12);
  const elev = Math.max(1.5, raw), nightK = smooth(3, -7, raw);
  const theta = 90 - ((hh - 6) / 12) * 180;
  sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(theta));
  const u = sky.material.uniforms, t = smooth(0, 35, elev);
  u.sunPosition.value.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - Math.max(raw, -9)), THREE.MathUtils.degToRad(theta));
  u.turbidity.value = lerp(9, 4.5, t);
  u.rayleigh.value = lerp(2.8, 1.3, t);
  sun.color.setRGB(1, lerp(0.58, 0.95, t), lerp(0.36, 0.88, t), THREE.SRGBColorSpace);
  sun.intensity = lerp(1.4, 3.3, t) * (1 - nightK * 0.93);
  hemi.intensity = lerp(0.18, 0.4, t) * (1 - nightK * 0.6) + nightK * 0.12;
  envIntensity = 0.55 * (1 - nightK * 0.75);
  renderer.toneMappingExposure = 0.5 + nightK * 0.35;
  park?.setNight(nightK);
  if (water?.material.uniforms) water.material.uniforms.sunDirection.value.copy(sunDir);
  clouds?.material.uniforms.tint.value.setRGB(1, lerp(0.7, 1, t), lerp(0.55, 1, t), THREE.SRGBColorSpace);
  const txt = `${Math.floor(hh)}:${String(Math.round((hh % 1) * 60)).padStart(2, '0')}`;
  $('#hourTxt').textContent = txt;
  if (regenEnv) { clearTimeout(envTimer); envTimer = setTimeout(updateEnv, 60); }
}
function updateEnv() {
  envRT?.dispose();
  envRT = pmrem.fromScene(envScene, 0, 0.1, 1000);
  scene.environment = envRT.texture;
  scene.environmentIntensity = envIntensity;
  // color de la niebla = color real del cielo en el horizonte
  try {
    const perp = new V3(-sunDir.z, 0, sunDir.x).normalize();
    fogCam.position.set(0, 0, 0);
    fogCam.lookAt(perp.x, 0.07, perp.z);
    renderer.setRenderTarget(fogRT);
    renderer.render(envScene, fogCam);
    const px = new Float32Array(32 * 16 * 4);
    renderer.readRenderTargetPixels(fogRT, 0, 0, 32, 16, px);
    renderer.setRenderTarget(null);
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 4; y < 8; y++) for (let x = 0; x < 32; x++) { const o = (y * 32 + x) * 4; r += px[o]; g += px[o + 1]; b += px[o + 2]; n++; }
    if (n && isFinite(r) && r + g + b > 0) scene.fog.color.setRGB(r / n, g / n, b / n);
    hemi.color.copy(scene.fog.color).multiplyScalar(1.5).lerp(new THREE.Color(0.35, 0.45, 0.75), smooth(3, -7, 66 * Math.sin((Math.PI * (hour - 6)) / 12)));
  } catch { renderer.setRenderTarget(null); }
}

// ───────────────────────── HUD, mapa, sonido ─────────────────────────
const mini = $('#mini'), mctx = mini.getContext('2d'), mapCv = $('#mapCv'), mapCtx = mapCv.getContext('2d');
const MAPR = 256;
const monCv = document.createElement('canvas'); monCv.width = monCv.height = 256;
const monCtx = monCv.getContext('2d');
const monitorTex = new THREE.CanvasTexture(monCv); monitorTex.colorSpace = THREE.SRGBColorSpace;
function drawMonitor() {
  monCtx.drawImage(mapImg, 0, 0, 256, 256);
  monCtx.fillStyle = 'rgba(0,30,40,.25)'; monCtx.fillRect(0, 0, 256, 256);
  drawMarkers(monCtx, 256, 0, 0, 256 / SIZE);
  monCtx.fillStyle = '#7ff'; monCtx.font = 'bold 13px monospace'; monCtx.fillText('CONTROL · ' + $('#hourTxt').textContent, 8, 16);
  monCtx.fillText('ANIMALES: ' + dinos.length, 8, 246);
  monitorTex.needsUpdate = true;
}
let mapImg;
function buildMapImage() {
  const cv = document.createElement('canvas'); cv.width = cv.height = MAPR;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(MAPR, MAPR);
  const L = new V3(-0.6, 0.7, -0.4).normalize();
  for (let y = 0; y < MAPR; y++) for (let x = 0; x < MAPR; x++) {
    const wx = -HALF + ((x + 0.5) / MAPR) * SIZE, wz = -HALF + ((y + 0.5) / MAPR) * SIZE, h = groundH(wx, wz);
    let c;
    if (h < WATER) { const d = smooth(0, 14, -h); c = [lerp(0.25, 0.08, d), lerp(0.48, 0.25, d), lerp(0.5, 0.36, d)]; }
    else {
      c = terrainRGB(wx, wz, h, slopeAt(wx, wz));
      const e = 3, nx = groundH(wx - e, wz) - groundH(wx + e, wz), nz = groundH(wx, wz - e) - groundH(wx, wz + e);
      const n = new V3(nx, 2 * e, nz).normalize(), sh = 0.55 + 0.75 * Math.max(0, n.dot(L));
      const tree = forestN(wx, wz) > 0.05 && h > 2.5 && h < 110 ? 0.75 : 1;
      c = c.map((v) => v * sh * tree * 1.25);
    }
    const o = (y * MAPR + x) * 4;
    img.data[o] = clamp(c[0] * 255, 0, 255); img.data[o + 1] = clamp(c[1] * 255, 0, 255); img.data[o + 2] = clamp(c[2] * 255, 0, 255); img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const k = MAPR / SIZE, X = (x) => (x + HALF) * k;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(60,55,50,.9)'; ctx.lineWidth = 1.6;
  for (const r of park.roads) { ctx.beginPath(); r.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), X(z)) : ctx.moveTo(X(x), X(z)))); if (r.length > 10) ctx.closePath(); ctx.stroke(); }
  ctx.fillStyle = '#eee7d6';
  for (const [x0, z0, x1, z1] of park.mapRects) ctx.fillRect(X(x0), X(z0), Math.max(1.5, (x1 - x0) * k), Math.max(1.5, (z1 - z0) * k));
  ctx.beginPath(); ctx.arc(X(RESORT.x), X(RESORT.z), 25 * k, 0, 7); ctx.fill();
  ctx.setLineDash([2, 2]); ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 1;
  for (const p of PADDOCKS) { ctx.beginPath(); ctx.arc(X(p.x), X(p.z), p.r * k, 0, 7); ctx.stroke(); }
  ctx.setLineDash([]);
  mapImg = cv;
}
function drawMarkers(ctx, S, ox, oz, scale) {
  const tx = (x) => (x - ox) * scale + S / 2, tz = (z) => (z - oz) * scale + S / 2;
  for (const d of dinos) {
    ctx.fillStyle = d.sp.hunter ? '#ff6a4d' : '#8fd17a';
    ctx.beginPath(); ctx.arc(tx(d.pos.x), tz(d.pos.z), Math.max(2.5, S / 90) * (d.scale < 0.7 ? 0.7 : 1), 0, 7); ctx.fill();
  }
  ctx.save();
  ctx.translate(tx(player.pos.x), tz(player.pos.z));
  ctx.rotate(-player.yaw);
  const a = Math.max(6, S / 45);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -a * 1.3); ctx.lineTo(a * 0.8, a); ctx.lineTo(0, a * 0.5); ctx.lineTo(-a * 0.8, a); ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.restore();
}
function drawMini() {
  const S = mini.width = mini.height = 150 * 2;
  const scale = S / 260; // ~260 m de diámetro
  mctx.save();
  mctx.beginPath(); mctx.arc(S / 2, S / 2, S / 2, 0, 7); mctx.clip();
  mctx.fillStyle = '#123'; mctx.fillRect(0, 0, S, S);
  const k = (SIZE / MAPR) * scale;
  mctx.imageSmoothingEnabled = true;
  mctx.drawImage(mapImg, S / 2 - (player.pos.x + HALF) * scale, S / 2 - (player.pos.z + HALF) * scale, MAPR * k, MAPR * k);
  drawMarkers(mctx, S, player.pos.x, player.pos.z, scale);
  mctx.restore();
  mctx.fillStyle = '#fff'; mctx.font = 'bold 22px system-ui'; mctx.textAlign = 'center'; mctx.fillText('N', S / 2, 26);
}
function drawMap() {
  const S = mapCv.width, scale = S / SIZE;
  mapCtx.imageSmoothingEnabled = true;
  mapCtx.drawImage(mapImg, 0, 0, S, S);
  mapCtx.font = '600 15px system-ui'; mapCtx.textAlign = 'center';
  const label = (t, x, z) => { mapCtx.fillStyle = 'rgba(0,0,0,.55)'; mapCtx.fillText(t, (x + HALF) * scale + 1, (z + HALF) * scale + 1); mapCtx.fillStyle = '#fff'; mapCtx.fillText(t, (x + HALF) * scale, (z + HALF) * scale); };
  label('Lago', LAKE.x, LAKE.z); label('Volcán', VOLC.x, VOLC.z + 60); label('Cordillera', -120, -500); label('Mar', 0, 520); label('Río', riverX(200) - 45, 230);
  mapCtx.font = '600 12px system-ui';
  label('Parque Valle Jurásico', RESORT.x, RESORT.z - 8); label('Hotel', 232, 182); label('Saurópodos', PADDOCKS[0].x, PADDOCKS[0].z);
  label('Estegosaurios', PADDOCKS[1].x, PADDOCKS[1].z); label('Allosaurus', PADDOCKS[2].x, PADDOCKS[2].z); label('Puerta', 178, 280); label('Muelle', 182, 340);
  drawMarkers(mapCtx, S, 0, 0, scale);
}
function toggleMap(force) {
  mapOpen = force ?? !mapOpen;
  $('#map').classList.toggle('open', mapOpen);
  if (mapOpen) { document.exitPointerLock?.(); drawMap(); }
  else if (!TOUCH) lock();
}
$('#mapClose').onclick = () => toggleMap(false);
$('#bMap').onclick = () => toggleMap(true);
mini.onclick = () => toggleMap(true);
$('#bDrone').onclick = () => toggleDrone();
mapCv.addEventListener('click', (e) => {
  const r = mapCv.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * SIZE - HALF, z = ((e.clientY - r.top) / r.height) * SIZE - HALF;
  if (Math.abs(x) > HALF - 10 || Math.abs(z) > HALF - 10) return;
  player.pos.set(x, Math.max(groundH(x, z), WATER) + (player.drone ? 30 : 0), z);
  player.vy = 0;
  toggleMap(false);
  toast(groundH(x, z) < WATER - 1.3 && !player.drone ? 'Estás nadando' : 'Has viajado al punto elegido');
});

const compass = $('#compass'), cctx = compass.getContext('2d');
function drawCompass() {
  const W = compass.width = compass.clientWidth * 2, H = compass.height = 60;
  cctx.clearRect(0, 0, W, H);
  const head = ((-player.yaw * 180) / Math.PI % 360 + 360) % 360, span = 120;
  cctx.textAlign = 'center';
  for (let d = 0; d < 360; d += 15) {
    let off = ((d - head + 540) % 360) - 180;
    if (Math.abs(off) > span / 2) continue;
    const x = W / 2 + (off / span) * W;
    const main = d % 90 === 0;
    cctx.fillStyle = main ? '#fff' : 'rgba(255,255,255,.6)';
    if (main) { cctx.font = 'bold 26px system-ui'; cctx.fillText({ 0: 'N', 90: 'E', 180: 'S', 270: 'O' }[d], x, 40); }
    else { cctx.fillRect(x - 1, d % 45 === 0 ? 14 : 20, 2, d % 45 === 0 ? 22 : 12); }
  }
  cctx.fillStyle = '#e8a33d'; cctx.beginPath(); cctx.moveTo(W / 2 - 8, 0); cctx.lineTo(W / 2 + 8, 0); cctx.lineTo(W / 2, 10); cctx.fill();
}

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }
let alertT;
function onStalk(d) {
  const a = $('#alert'); a.textContent = `⚠️ Un ${d.sp.name} te ha visto. ¡Aléjate!`; a.classList.add('on');
  clearTimeout(alertT); alertT = setTimeout(() => a.classList.remove('on'), 4000);
  audio.roar(Math.hypot(d.pos.x - player.pos.x, d.pos.z - player.pos.z));
}
let hudT = 0, lastZone = null, monT = 0;
function updateHUD(dt) {
  if ((hudT -= dt) > 0) return;
  hudT = 0.15;
  drawMini(); drawCompass();
  let best = null, bd = 1e9;
  const look = new V3(); camera.getWorldDirection(look);
  for (const d of dinos) {
    const v = new V3(d.pos.x - camera.position.x, d.pos.y + 3 * d.scale - camera.position.y, d.pos.z - camera.position.z);
    const dist = v.length(), facing = v.normalize().dot(look);
    const score = dist * (facing > 0.6 ? 1 : 3);
    if (dist < 140 && score < bd) { bd = score; best = { d, dist }; }
  }
  const card = $('#dinoCard');
  if (best) {
    const { d, dist } = best;
    $('#dcName').textContent = d.sp.name + (d.scale < 0.7 ? ' (cría)' : '');
    $('#dcSci').textContent = d.sp.sci;
    $('#dcMeta').innerHTML = `${d.sp.diet} · ${d.sp.len} de largo${d.scale < 0.7 ? ' (adulto)' : ''} · <span class="dist">a ${Math.round(dist)} m</span>`;
    card.classList.add('on');
  } else card.classList.remove('on');
  const g = groundH(player.pos.x, player.pos.z);
  const z = ZONES.find((z) => Math.hypot(player.pos.x - z.x, player.pos.z - z.z) < z.r);
  if (z && z !== lastZone) toast(z.name);
  lastZone = z || (lastZone && Math.hypot(player.pos.x - lastZone.x, player.pos.z - lastZone.z) < lastZone.r + 6 ? lastZone : null);
  if ((monT -= 1) <= 0 && Math.hypot(player.pos.x - 110, player.pos.z - 145) < 70) { monT = 4; drawMonitor(); }
  $('#stats').textContent = `${player.drone ? `Dron · ${Math.round(player.pos.y - Math.max(g, 0))} m sobre el suelo` : (player.swim ? 'Nadando' : 'A pie') + ` · altitud ${Math.round(Math.max(g, 0))} m`} · ${$('#hourTxt').textContent}`;
}

// sonido ambiente sintetizado (viento, insectos y llamadas lejanas)
const audio = {
  ctx: null, on: true, master: null, wind: null,
  init() {
    if (this.ctx) return;
    try {
      const C = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
      this.master = C.createGain(); this.master.gain.value = 0.7; this.master.connect(C.destination);
      const len = C.sampleRate * 4, buf = C.createBuffer(1, len, C.sampleRate), d = buf.getChannelData(0);
      let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
      this.noise = buf;
      const src = C.createBufferSource(); src.buffer = buf; src.loop = true;
      const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      this.wind = C.createGain(); this.wind.gain.value = 0.25;
      src.connect(lp).connect(this.wind).connect(this.master); src.start();
    } catch { this.ctx = null; }
  },
  env(g, t0, a, peak, dur) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); },
  insects() {
    const C = this.ctx; if (!C || !this.on) return;
    const t = C.currentTime, o = C.createOscillator(), g = C.createGain(), lfo = C.createOscillator(), lg = C.createGain();
    o.frequency.value = rr(4200, 6200); lfo.frequency.value = rr(25, 45); lg.gain.value = 0.5;
    lfo.connect(lg).connect(g.gain);
    this.env(g, t, 0.15, 0.012, rr(0.8, 2));
    o.connect(g).connect(this.master); o.start(t); lfo.start(t); o.stop(t + 2.1); lfo.stop(t + 2.1);
  },
  call(dist) {
    const C = this.ctx; if (!C || !this.on) return;
    const vol = clamp(1 - dist / 260, 0, 1) * 0.5; if (vol < 0.02) return;
    const t = C.currentTime, o = C.createOscillator(), f = C.createBiquadFilter(), g = C.createGain();
    o.type = 'sawtooth'; const f0 = rr(48, 62); o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.25, t + 0.8); o.frequency.linearRampToValueAtTime(f0 * 0.8, t + 3);
    f.type = 'lowpass'; f.frequency.value = 260;
    this.env(g, t, 0.6, vol, 3.2);
    o.connect(f).connect(g).connect(this.master); o.start(t); o.stop(t + 3.3);
  },
  roar(dist) {
    const C = this.ctx; if (!C || !this.on) return;
    const vol = clamp(1 - dist / 120, 0.15, 1) * 0.6, t = C.currentTime;
    const o = C.createOscillator(), n = C.createBufferSource(), bp = C.createBiquadFilter(), f = C.createBiquadFilter(), g = C.createGain(), trem = C.createOscillator(), tg = C.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(62, t + 1.8);
    n.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.value = 320; bp.Q.value = 0.8;
    f.type = 'lowpass'; f.frequency.value = 700;
    trem.frequency.value = 18; tg.gain.value = vol * 0.4; trem.connect(tg).connect(g.gain);
    this.env(g, t, 0.12, vol, 2);
    o.connect(f); n.connect(bp).connect(f); f.connect(g).connect(this.master);
    o.start(t); n.start(t); trem.start(t); o.stop(t + 2.1); n.stop(t + 2.1); trem.stop(t + 2.1);
  },
  setOn(v) { this.on = v; if (this.master) this.master.gain.value = v ? 0.7 : 0; },
};
let insectT = 3;
function updateAudio(dt) {
  if (!audio.ctx) return;
  audio.wind.gain.value = clamp(0.18 + (camera.position.y - groundH(player.pos.x, player.pos.z)) / 300, 0.15, 0.6);
  if ((insectT -= dt) < 0) { insectT = rr(2, 7); if (!player.drone) audio.insects(); }
  for (const d of dinos) {
    if (d.sp.hunter || d.scale < 0.7) continue;
    if ((d.callT -= dt) < 0) { d.callT = rr(25, 60); audio.call(Math.hypot(d.pos.x - player.pos.x, d.pos.z - player.pos.z)); }
  }
}

// ───────────────────────── pausa / inicio ─────────────────────────
function showPause(v) {
  $('#pause').classList.toggle('hide', !v);
  active = !v;
  if (v) document.exitPointerLock?.();
}
$('#bPause').onclick = () => showPause(true);
$('#resume').onclick = () => { showPause(false); if (!TOUCH) lock(); };
$('#hour').oninput = (e) => setHour(+e.target.value);
$('#sens').oninput = (e) => (sens = +e.target.value);
$('#snd').onclick = () => { audio.setOn(!audio.on); $('#snd').textContent = audio.on ? 'Activado' : 'Silenciado'; };
if (TOUCH) { document.querySelectorAll('.mob').forEach((e) => (e.style.display = 'block')); }
$('#go').onclick = () => {
  $('#start').classList.add('hide');
  $('#hud').classList.remove('hide');
  active = true;
  audio.init();
  if (!TOUCH) lock();
  toast(TOUCH ? 'Usa el joystick para caminar' : 'WASD para caminar · F para volar');
};

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ───────────────────────── bucle ─────────────────────────
const clock = new THREE.Clock();
const TEST = new URLSearchParams(location.search).has('test');
function frame(fixed) {
  const dt = fixed ?? Math.min(clock.getDelta(), 0.05);
  uTime.value += dt;
  if (active && !mapOpen) updatePlayer(dt);
  updateHerds(dt);
  for (const d of dinos) d.update(dt);
  for (const p of pteros) p.update(dt);
  updateSmoke(dt);
  park.update(dt, uTime.value, player.pos);
  // sombras que siguen al jugador
  const sx = Math.round(player.pos.x), sz = Math.round(player.pos.z), sy = Math.round(groundH(sx, sz));
  sun.target.position.set(sx, sy, sz);
  sun.position.set(sx + sunDir.x * 400, sy + sunDir.y * 400, sz + sunDir.z * 400);
  sky.position.copy(camera.position);
  clouds.position.x = camera.position.x; clouds.position.z = camera.position.z;
  clouds.material.uniforms.off.value.set(uTime.value * 0.0015 + camera.position.x / 2800, uTime.value * 0.0007 + camera.position.z / 2800);
  if (water.material.uniforms?.time) water.material.uniforms.time.value += dt * 0.5;
  for (const c of chunks) c.im.visible = Math.hypot(c.cx - camera.position.x, c.cz - camera.position.z) < c.maxDist + CH * 0.71;
  if (active) { updateHUD(dt); updateAudio(dt); }
  renderer.render(scene, camera);
  if (!TEST) requestAnimationFrame(() => frame());
}

// ───────────────────────── arranque ─────────────────────────
async function boot() {
  const step = async (msg, pct) => { $('#loadMsg').textContent = msg; $('#loadBar').style.width = pct + '%'; await nextFrame(); };
  try {
    await step('Generando el terreno…', 8); buildTerrain();
    await step('Llenando el lago y el mar…', 30); buildWater(); buildClouds(); buildVolcano();
    await step('Construyendo el parque: hotel, centro de visitantes, oficinas…', 40);
    park = buildPark({ scene, groundH, paint, addCollider, addWall, addPlatform, holoGeom: dinoGeoms('brachio').body, monitorTex });
    await step('Plantando araucarias, cícadas y helechos…', 55); buildVegetation();
    await step('Despertando a los dinosaurios…', 75); spawnFauna();
    await step('Dibujando el mapa…', 88); buildMapImage();
    // empezar en la plaza, mirando al centro de visitantes
    player.pos.set(RESORT.x + 4, PAD, RESORT.z + 17);
    player.prev.copy(player.pos);
    player.yaw = 0.12;
    player.pitch = 0.08;
    void findSpawn; void clearAround;
    setHour(hour, false); updateEnv();
    camera.position.set(player.pos.x, player.pos.y + 1.7, player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
    await step('Listo', 100);
    $('#loading').classList.add('hide');
    $('#start').classList.remove('hide');
    window.__ready = true;
    frame();
  } catch (err) {
    console.error(err);
    $('#loadMsg').textContent = 'No se pudo iniciar el mundo 3D: ' + err.message + '. Prueba con un navegador actualizado con WebGL.';
  }
}
// para pruebas automatizadas
window.__world = { step: (n = 1, dt = 0.05) => { for (let i = 0; i < n; i++) frame(dt); }, hudNow: () => { hudT = 0; updateHUD(0); }, player, dinos, setHour, toggleDrone, groundH, camera, start: () => $('#go').click() };
boot();
