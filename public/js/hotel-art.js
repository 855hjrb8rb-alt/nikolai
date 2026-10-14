// Dibujos del hotel en SVG (sin emojis): iconos de línea, palmeras, plantas, muebles,
// elevadores y el refugio oxidado de los subniveles.

const svg = (body, vb = "0 0 24 24", cls = "ic") => `<svg viewBox="${vb}" class="${cls}" aria-hidden="true">${body}</svg>`;
const line = (d) => svg(`<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`);

// ---------- Iconos de línea ----------
export const I = {
  key: line("M14.5 9.5a4 4 0 1 1-1.2-2.8M13.3 6.7 21 6.7M18 6.7v3M20.5 6.7v2.2"),
  bell: line("M4 18h16M6 18a6 6 0 0 1 12 0M12 9V7M10 6h4"),
  elevator: line("M5 3h14v18H5zM12 3v18M8 9l1.5-2L11 9M13 15l1.5 2 1.5-2"),
  stairs: line("M3 20h4v-4h4v-4h4V8h4V4M3 20h18"),
  door: line("M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M4 21h16M14.5 12h.01"),
  glass: line("M6 4h12l-6 8zM12 12v7M8 20h8"),
  spa: line("M12 20c-4 0-7-3-7-7 3 0 5 1.5 7 4 2-2.5 4-4 7-4 0 4-3 7-7 7zM12 17c-1.5-2-1.5-5 0-8 1.5 3 1.5 6 0 8z"),
  sun: line("M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5"),
  moon: line("M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"),
  trash: line("M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"),
  computer: line("M3 5h18v11H3zM8 20h8M12 16v4"),
  tasks: line("M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"),
  search: line("M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.5 16.5 21 21"),
  case: line("M3 8h18v12H3zM9 8V5h6v3M3 13h18"),
  doc: line("M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7"),
  money: line("M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 12h.01M18 12h.01"),
  star: line("M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"),
  sound: line("M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"),
  mute: line("M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6"),
  bed: line("M3 18V7M3 13h18v5M21 18v-5a3 3 0 0 0-3-3h-7v3M6 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3"),
  balcony: line("M4 12h16M5 12v8M9 12v8M13 12v8M17 12v8M4 20h16M8 4h8v8H8z"),
  crown: line("M3 8l4 4 5-7 5 7 4-4-2 11H5z"),
  book: line("M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M9 8h6"),
  scale: line("M12 3v18M7 21h10M4 7h16M7 7l-3 7h6zM17 7l-3 7h6z"),
  trophy: line("M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4"),
  towel: line("M6 4h12v16H6zM6 9h12M9 4v16"),
  tray: line("M3 16h18M5 16a7 7 0 0 1 14 0M12 9V7M10 7h4"),
  tv: line("M3 6h18v11H3zM8 21l4-4 4 4"),
  fridge: line("M6 3h12v18H6zM6 10h12M9 6v2M9 13v3"),
  ring: line("M12 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM9 3h6l-3 6z"),
  snow: line("M12 2v20M4 6l16 12M20 6 4 18"),
  drop: line("M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"),
  lock: line("M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4"),
  radio: line("M4 9h16v11H4zM8 9l8-5M8 14.5a1.5 1.5 0 1 0 0 .1M13 13h4M13 16h4"),
  power: line("M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0"),
  back: line("M15 5l-7 7 7 7"),
  down: line("M12 4v16M6 14l6 6 6-6"),
  up: line("M12 20V4M6 10l6-6 6 6"),
};
export const icon = (name) => I[name] || "";

// ---------- Decoración ----------
export const PALM = svg(`
  <path d="M60 200 C58 150 52 110 64 70" stroke="#7a5230" stroke-width="10" fill="none" stroke-linecap="round"/>
  <path d="M60 200 C58 150 52 110 64 70" stroke="#a07040" stroke-width="3" fill="none" stroke-dasharray="4 7"/>
  <g fill="#2f8a3a" stroke="#1d5e25" stroke-width="1.2">
    <path d="M64 70 C40 50 15 58 4 74 C24 64 44 66 64 72z"/><path d="M64 70 C88 48 112 54 124 70 C104 62 84 64 64 72z"/>
    <path d="M64 70 C50 38 30 26 12 28 C34 36 50 50 62 72z"/><path d="M64 70 C78 36 98 24 116 26 C94 36 80 50 66 72z"/>
    <path d="M64 70 C62 40 70 18 82 8 C76 30 72 50 66 72z"/>
  </g>
  <circle cx="60" cy="76" r="5" fill="#6d4c2a"/><circle cx="68" cy="78" r="5" fill="#5d4024"/>`, "0 0 128 204", "deco palm");
export const UMBRELLA = svg(`
  <path d="M10 50 Q60 0 110 50 Z" fill="#e53935"/><path d="M35 50 Q60 8 85 50Z" fill="#fff"/><path d="M52 50 Q60 14 68 50Z" fill="#e53935"/>
  <line x1="60" y1="48" x2="60" y2="118" stroke="#8d6e63" stroke-width="4"/>
  <rect x="20" y="104" width="64" height="8" rx="3" fill="#29b6c8"/><rect x="24" y="112" width="4" height="10" fill="#555"/><rect x="76" y="112" width="4" height="10" fill="#555"/>`, "0 0 120 124", "deco umb");
export const CASTLE = svg(`
  <path d="M6 60 L6 30 L14 30 L14 36 L22 36 L22 30 L30 30 L30 18 L38 18 L38 24 L46 24 L46 18 L54 18 L54 30 L62 30 L62 36 L70 36 L70 30 L78 30 L78 60Z" fill="#e2c27e" stroke="#b8975a" stroke-width="2"/>
  <path d="M36 60 V46 a6 6 0 0 1 12 0 V60" fill="#b8975a"/><line x1="42" y1="18" x2="42" y2="6" stroke="#666"/><path d="M42 6 L52 9 L42 12z" fill="#e53935"/>`, "0 0 84 62", "deco castle");
export const BALL = svg(`<circle cx="20" cy="20" r="18" fill="#fff" stroke="#999"/><path d="M4 14 Q20 24 36 14M8 32 Q20 18 32 32M20 2 Q12 20 20 38" fill="none" stroke="#1e88e5" stroke-width="3"/>`, "0 0 40 40", "deco ball");
export const PLANT = svg(`
  <path d="M20 70 L60 70 L54 100 L26 100Z" fill="#8d4f2a"/><rect x="16" y="64" width="48" height="8" rx="3" fill="#a1623a"/>
  <g fill="#2e7d32" stroke="#1b5e20" stroke-width="1"><path d="M40 64 C20 50 10 30 14 10 C26 26 34 44 40 64z"/><path d="M40 64 C60 50 70 30 66 8 C54 26 46 44 40 64z"/>
  <path d="M40 64 C34 40 36 18 42 2 C48 18 48 40 40 64z"/><path d="M40 64 C26 58 8 56 0 44 C16 44 30 52 40 64z"/><path d="M40 64 C54 58 72 56 80 44 C64 44 50 52 40 64z"/></g>`, "0 0 80 102", "deco plant");
export const LAMP = svg(`<path d="M8 30 L22 6 L38 6 L52 30Z" fill="#f3e2b4"/><rect x="28" y="30" width="4" height="40" fill="#b8892f"/><ellipse cx="30" cy="72" rx="14" ry="4" fill="#8d6e3a"/>`, "0 0 60 78", "deco lamp");
export const BOTTLES = svg(`${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
  const x = 6 + i * 26, c = ["#2e7d32", "#8d6e63", "#c62828", "#f9a825", "#4e342e", "#1565c0"][i % 6], h = 40 + ((i * 7) % 18);
  return `<rect x="${x}" y="${70 - h}" width="14" height="${h}" rx="3" fill="${c}" opacity=".9"/><rect x="${x + 4}" y="${60 - h}" width="6" height="12" fill="${c}"/><rect x="${x + 2}" y="${82 - h * .6}" width="10" height="10" fill="#f5f0e1" opacity=".8"/>`;
}).join("")}<rect x="0" y="70" width="320" height="6" fill="#5a3415"/>`, "0 0 320 78", "deco bottles");
export const LOTUS = svg(`<g fill="#f8bbd0" stroke="#c2185b" stroke-width="1"><path d="M40 50 C30 40 30 22 40 10 C50 22 50 40 40 50z"/><path d="M40 50 C26 48 14 38 12 24 C26 26 36 36 40 50z"/><path d="M40 50 C54 48 66 38 68 24 C54 26 44 36 40 50z"/></g><ellipse cx="40" cy="54" rx="30" ry="5" fill="#26a69a"/>`, "0 0 80 60", "deco lotus");
export const CANDLE = svg(`<rect x="10" y="20" width="16" height="30" rx="2" fill="#fff8e1"/><path d="M18 6 C22 12 22 16 18 19 C14 16 14 12 18 6z" fill="#ffb300"/><ellipse cx="18" cy="52" rx="14" ry="3" fill="#bcaaa4"/>`, "0 0 36 56", "deco candle");
export const LAPTOP = svg(`<rect x="10" y="6" width="60" height="40" rx="3" fill="#263238"/><rect x="14" y="10" width="52" height="32" fill="#4fc3f7"/><path d="M14 30 L30 20 L44 28 L66 14 V42 H14z" fill="#0288d1"/><path d="M2 48 H78 L72 54 H8Z" fill="#90a4ae"/>`, "0 0 80 56", "deco laptop");
export const COFFEE = svg(`<path d="M6 10 H30 V24 a10 10 0 0 1-10 10 h-4 a10 10 0 0 1-10-10z" fill="#fff"/><path d="M30 14 h4 a4 4 0 0 1 0 8 h-4" stroke="#fff" stroke-width="3" fill="none"/><ellipse cx="18" cy="12" rx="11" ry="3" fill="#6d4c41"/>`, "0 0 40 36", "deco coffee");

// ---------- Elevador (puertas de acero, marco dorado, indicador y botones de llamada) ----------
export function elevatorHtml(floorLabel, n) {
  return `<span class="ev-frame">
    <span class="ev-display"><i class="ev-arrow">${I.up}</i><b class="mono">${floorLabel}</b></span>
    <span class="ev-doors"><i class="ev-door l"></i><i class="ev-door r"></i><span class="ev-cab"><i class="ev-rail"></i><i class="ev-mirror"></i></span></span>
  </span>
  <span class="ev-call"><i class="up"></i><i class="dn"></i></span>
  <span class="ev-plate mono">${n}</span>`;
}

// ---------- Cuarto (cama, regadera y sala) ----------
export function roomHtml({ suite, balcony, f }) {
  return `
  <div class="rm2-wall ${suite ? "suite" : ""}">
    <div class="rm2-zone bath" data-obj="bath">
      <div class="rm2-tiles"></div>
      <div class="rm2-shower"><i class="head"></i><i class="pipe"></i><i class="glass"></i><i class="rain"></i><i class="tray"></i></div>
      <div class="rm2-sink"><i></i></div><div class="rm2-mirror"></div>
      <span class="rm2-label">${suite ? "Baño con regadera y tina" : "Baño con regadera"}</span>
    </div>
    <div class="rm2-zone sleep">
      <button class="rm2-window" data-target data-obj="window" style="--sky:${Math.min(1, f / 8)}"><i class="sea"></i><i class="curtain l"></i><i class="curtain r"></i></button>
      <button class="rm2-painting" data-target data-obj="painting"><i></i></button>
      <button class="rm2-bed" data-target data-obj="bed">
        <i class="headboard"></i><i class="mattress"></i><i class="duvet"></i><i class="pillow a"></i><i class="pillow b"></i><i class="runner"></i>
      </button>
      <span class="rm2-night l"><i class="lampshade"></i></span><span class="rm2-night r"><i class="lampshade"></i></span>
    </div>
    <div class="rm2-zone living">
      <button class="rm2-tv" data-target data-obj="tv"><i></i></button>
      <button class="rm2-sofa" data-target data-obj="sofa"><i class="back"></i><i class="seat"></i><i class="arm l"></i><i class="arm r"></i><i class="cushion"></i></button>
      <span class="rm2-table"><i></i></span>
      <button class="rm2-minibar" data-target data-obj="minibar"><i></i></button>
      <button class="rm2-safe" data-target data-obj="safe"><i></i></button>
      ${suite ? `<span class="rm2-jacuzzi"><i></i></span><span class="rm2-dining"><i></i></span>` : ""}
      ${balcony ? `<button class="rm2-balcony" data-target data-obj="balcony"><i class="rail"></i><i class="sky"></i></button>` : ""}
    </div>
  </div>
  <div class="rm2-floor ${suite ? "suite" : ""}"></div>`;
}

// ---------- Subniveles oxidados ----------
export function bunkerHtml(level, hasKey) {
  const grime = `<i class="bk-grime"></i>`;
  const pipes = `<i class="bk-pipe p1"></i><i class="bk-pipe p2"></i><i class="bk-pipe p3"></i><i class="bk-valve"></i>`;
  const light = `<i class="bk-light"></i><i class="bk-drip d1"></i><i class="bk-drip d2"></i><i class="bk-puddle"></i>`;
  if (level === 1) return `${grime}${pipes}${light}
    <button class="bk-obj bk-boiler" data-target data-bk="boiler"><i></i><i></i></button>
    <button class="bk-obj bk-generator" data-target data-bk="generator"><i class="fan"></i></button>
    <button class="bk-obj bk-panel" data-target data-bk="panel"><i></i><i></i><i></i></button>
    <span class="bk-stencil">S1 · CUARTO DE MÁQUINAS</span>`;
  if (level === 2) return `${grime}${pipes}${light}
    <button class="bk-obj bk-shelf" data-target data-bk="shelf"><i></i><i></i><i></i><i></i></button>
    <button class="bk-obj bk-locker" data-target data-bk="locker"><i></i><i></i><i></i></button>
    <button class="bk-obj bk-crates" data-target data-bk="crates"><i></i><i></i><i></i></button>
    <span class="bk-stencil">S2 · ALMACÉN — PROHIBIDO EL PASO</span>`;
  return `${grime}${pipes}${light}
    <button class="bk-obj bk-vault ${hasKey ? "open" : ""}" data-target data-bk="vault"><i class="wheel"></i><i class="bolts"></i></button>
    ${hasKey ? `
    <button class="bk-obj bk-bunks" data-target data-bk="bunks"><i></i><i></i></button>
    <button class="bk-obj bk-radio" data-target data-bk="radio"><i class="dial"></i><i class="grill"></i></button>
    <button class="bk-obj bk-map" data-target data-bk="map"><i></i></button>
    <button class="bk-obj bk-journal" data-target data-bk="journal"><i></i></button>
    <button class="bk-obj bk-cans" data-target data-bk="cans"><i></i><i></i><i></i><i></i></button>` : ""}
    <span class="bk-stencil">S3 · REFUGIO 1962</span>`;
}
