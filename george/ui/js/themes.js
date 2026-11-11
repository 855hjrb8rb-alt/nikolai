// Los estilos. Cada uno es un diseño original inspirado en un género de cine:
// colores, tipografías (todas vienen con macOS), efectos de fondo, forma de los iconos,
// saludo de George y su partitura generada. `apple` son los términos para buscar la banda
// sonora de verdad en Apple Music; `playlist` es la lista de tu app Música que se toca si existe.

export const THEMES = [
  {
    id: "aventura", layout: "left", label: "Diario de expedición · Hoja 12", name: "Reliquia", tag: "Aventura · arqueología años 30", glyph: "🧭",
    fx: ["map", "dust"], icon: "seal", snow: false,
    vars: {
      bg: "radial-gradient(120% 90% at 50% 30%, #e9d3a1 0%, #c9a468 55%, #7c5a2c 100%)",
      ink: "#3a2410", dim: "#6b4a25", accent: "#9b2c16", accent2: "#c98a1b",
      panel: "rgba(250,236,200,.62)", line: "rgba(80,48,16,.45)", glow: "rgba(155,44,22,.35)",
      display: '"Copperplate","Big Caslon","Baskerville",serif', body: '"Baskerville","Hoefler Text",Georgia,serif',
      clock: '"Copperplate","Baskerville",serif', radius: "4px",
    },
    greet: "El mapa está desplegado. ¿Hacia dónde partimos hoy?",
    music: { key: 0, mode: "major", bpm: 118, style: "march", lead: "brass", prog: [0, 3, 4, 0, 5, 3, 4, 4] },
    apple: "Raiders of the Lost Ark soundtrack John Williams", playlist: "George – Aventura",
  },
  {
    id: "reactor", layout: "core", label: "SISTEMA · EN LÍNEA", name: "Reactor", tag: "Armadura · interfaz holográfica", glyph: "⚛️",
    fx: ["hud", "grid"], icon: "hex", snow: false,
    vars: {
      bg: "radial-gradient(90% 80% at 50% 45%, #0b2a3d 0%, #06131f 55%, #02060b 100%)",
      ink: "#c9f4ff", dim: "#5fa9c4", accent: "#35e0ff", accent2: "#ff5a36",
      panel: "rgba(8,36,54,.55)", line: "rgba(53,224,255,.45)", glow: "rgba(53,224,255,.55)",
      display: '"DIN Condensed","Avenir Next Condensed","Futura",sans-serif', body: '"Avenir Next","Helvetica Neue",sans-serif',
      clock: '"DIN Condensed","Avenir Next Condensed",sans-serif', radius: "2px",
    },
    greet: "Todos los sistemas en línea. A sus órdenes.",
    music: { key: 9, mode: "minor", bpm: 126, style: "drive", lead: "saw", prog: [0, 0, 5, 6, 0, 0, 3, 4] },
    apple: "Iron Man soundtrack", playlist: "George – Reactor",
  },
  {
    id: "expreso", layout: "center", label: "Boleto de ida y vuelta · Vagón 1", name: "Expreso del Norte", tag: "Tren de Nochebuena", glyph: "🚂",
    fx: ["aurora", "stars", "train"], icon: "ticket", snow: true,
    vars: {
      bg: "linear-gradient(180deg, #050b24 0%, #0c1d4a 45%, #1d3a6e 78%, #dfe9f7 100%)",
      ink: "#fff6d8", dim: "#b9c6e6", accent: "#f2c14e", accent2: "#c8352b",
      panel: "rgba(8,20,58,.55)", line: "rgba(242,193,78,.5)", glow: "rgba(242,193,78,.5)",
      display: '"Snell Roundhand","Apple Chancery",cursive', body: '"Baskerville","Hoefler Text",Georgia,serif',
      clock: '"Didot","Bodoni 72","Baskerville",serif', radius: "10px",
    },
    greet: "¡Todos a bordo! Su boleto, por favor.",
    music: { key: 7, mode: "major", bpm: 104, style: "sleigh", lead: "bells", prog: [0, 5, 3, 4, 0, 5, 1, 4] },
    apple: "The Polar Express soundtrack", playlist: "George – Expreso",
  },
  {
    id: "galaxia", layout: "left", label: "Sector 7 · Órbita estable", name: "Galaxia Lejana", tag: "Ópera espacial", glyph: "🌌",
    fx: ["hyperspace", "planet"], icon: "holo", snow: false,
    vars: {
      bg: "radial-gradient(100% 80% at 50% 50%, #0a0f24 0%, #03040c 60%, #000 100%)",
      ink: "#e9f1ff", dim: "#8ea3c9", accent: "#ffd23f", accent2: "#4cc3ff",
      panel: "rgba(10,18,40,.6)", line: "rgba(76,195,255,.45)", glow: "rgba(76,195,255,.5)",
      display: '"Futura","Avenir Next Condensed","Gill Sans",sans-serif', body: '"Avenir Next","Gill Sans",sans-serif',
      clock: '"Futura","Avenir Next",sans-serif', radius: "3px",
    },
    greet: "Coordenadas fijadas. Listos para el salto.",
    music: { key: 10, mode: "major", bpm: 100, style: "fanfare", lead: "brass", prog: [0, 4, 0, 3, 5, 3, 4, 0] },
    apple: "Star Wars A New Hope soundtrack John Williams", playlist: "George – Galaxia",
  },
  {
    id: "guerra", layout: "left", label: "Parte del día · Confidencial", name: "Cuartel 1944", tag: "Sala de mapas · años 40", glyph: "🎖️",
    fx: ["radar", "dust"], icon: "stamp", snow: false,
    vars: {
      bg: "radial-gradient(110% 90% at 50% 40%, #6b6a45 0%, #45472c 55%, #1d2014 100%)",
      ink: "#efe7c8", dim: "#b5ad85", accent: "#e8d27a", accent2: "#b33a2b",
      panel: "rgba(30,34,20,.6)", line: "rgba(232,210,122,.4)", glow: "rgba(232,210,122,.3)",
      display: '"American Typewriter","Courier New",monospace', body: '"American Typewriter","Courier New",monospace',
      clock: '"Impact","DIN Condensed","Arial Narrow",sans-serif', radius: "0px",
    },
    greet: "Comunicaciones abiertas. Esperando sus órdenes.",
    music: { key: 5, mode: "major", bpm: 132, style: "swing", lead: "brass", prog: [0, 0, 3, 0, 4, 3, 0, 4] },
    apple: "Glenn Miller In the Mood 1940s big band", playlist: "George – 1944",
  },
  {
    id: "navidad", layout: "center", label: "❦ Felices fiestas ❦", name: "Navidad Clásica", tag: "Chimenea, luces y crooners", glyph: "🎄",
    fx: ["lights", "hearth"], icon: "ornament", snow: true,
    vars: {
      bg: "radial-gradient(110% 90% at 50% 100%, #7a1414 0%, #3d0a0f 45%, #0d1f16 100%)",
      ink: "#fff3df", dim: "#e2bfa6", accent: "#f5c451", accent2: "#2f9e5b",
      panel: "rgba(48,10,14,.55)", line: "rgba(245,196,81,.5)", glow: "rgba(245,196,81,.5)",
      display: '"Snell Roundhand","Apple Chancery",cursive', body: '"Didot","Baskerville",Georgia,serif',
      clock: '"Didot","Bodoni 72",serif', radius: "14px",
    },
    greet: "Feliz Navidad. La chimenea está encendida y la música, lista.",
    music: { key: 3, mode: "major", bpm: 84, style: "croon", lead: "celesta", prog: [0, 5, 1, 4, 0, 5, 1, 4] },
    apple: "Frank Sinatra Christmas", playlist: "George – Navidad",
  },
  {
    id: "magia", layout: "center", label: "Tablón de la sala común", name: "Colegio de Magia", tag: "Velas flotantes y pergaminos", glyph: "🪄",
    fx: ["candles", "stars"], icon: "rune", snow: false,
    vars: {
      bg: "radial-gradient(100% 90% at 50% 0%, #2a2248 0%, #15102a 50%, #07050f 100%)",
      ink: "#f3e6c4", dim: "#a99b7d", accent: "#e0b354", accent2: "#8e6ad6",
      panel: "rgba(24,18,44,.6)", line: "rgba(224,179,84,.4)", glow: "rgba(224,179,84,.45)",
      display: '"Luminari","Papyrus","Apple Chancery",fantasy', body: '"Hoefler Text","Baskerville",serif',
      clock: '"Luminari","Big Caslon",serif', radius: "6px",
    },
    greet: "Juro solemnemente que mis intenciones son buenas. ¿En qué le ayudo?",
    music: { key: 4, mode: "minor", bpm: 108, style: "waltz", lead: "celesta", prog: [0, 0, 3, 4, 0, 5, 3, 4] },
    apple: "Harry Potter soundtrack Hedwig's Theme", playlist: "George – Magia",
  },
  {
    id: "matrix", layout: "left", label: "george@mac ~ % fecha", name: "Código", tag: "Lluvia digital", glyph: "🟩",
    fx: ["coderain"], icon: "term", snow: false,
    vars: {
      bg: "#000",
      ink: "#b8ffcb", dim: "#3f9a5a", accent: "#22ff6a", accent2: "#d8ffe2",
      panel: "rgba(0,18,6,.72)", line: "rgba(34,255,106,.4)", glow: "rgba(34,255,106,.5)",
      display: '"Menlo","Monaco","Courier New",monospace', body: '"Menlo","Monaco",monospace',
      clock: '"Menlo","Monaco",monospace', radius: "0px",
    },
    greet: "Sigue al conejo blanco. Yo vigilo el sistema.",
    music: { key: 2, mode: "minor", bpm: 128, style: "pulse", lead: "pluck", prog: [0, 0, 5, 5, 3, 3, 6, 4] },
    apple: "The Matrix soundtrack", playlist: "George – Código",
  },
  {
    id: "neon", layout: "center", label: "DISTRITO 9 · ABIERTO 24 H", name: "Neón 2049", tag: "Ciudad de lluvia y neón", glyph: "🌃",
    fx: ["synthgrid", "rain"], icon: "neon", snow: false,
    vars: {
      bg: "linear-gradient(180deg, #0a0220 0%, #2a0845 45%, #ff3d81 100%)",
      ink: "#ffe9fb", dim: "#c79bd8", accent: "#ff2bd6", accent2: "#19e3ff",
      panel: "rgba(20,4,40,.6)", line: "rgba(255,43,214,.5)", glow: "rgba(255,43,214,.6)",
      display: '"Futura","Avenir Next Condensed",sans-serif', body: '"Avenir Next","Helvetica Neue",sans-serif',
      clock: '"Futura","Avenir Next",sans-serif', radius: "8px",
    },
    greet: "La ciudad nunca duerme. Yo tampoco.",
    music: { key: 1, mode: "minor", bpm: 74, style: "ambient", lead: "saw", prog: [0, 5, 2, 6, 0, 5, 3, 4] },
    apple: "Blade Runner soundtrack Vangelis", playlist: "George – Neón",
  },
  {
    id: "jurasico", layout: "right", label: "Centro de visitantes · Sector 4", name: "Isla Jurásica", tag: "Selva, ámbar y huellas", glyph: "🦖",
    fx: ["jungle", "fireflies"], icon: "amber", snow: false,
    vars: {
      bg: "radial-gradient(120% 90% at 50% 20%, #2f5b2a 0%, #14301a 55%, #050e08 100%)",
      ink: "#f5efd2", dim: "#a9b88d", accent: "#ffb52e", accent2: "#d1442a",
      panel: "rgba(10,28,14,.6)", line: "rgba(255,181,46,.45)", glow: "rgba(255,181,46,.45)",
      display: '"Herculanum","Copperplate","Optima",fantasy', body: '"Optima","Gill Sans",sans-serif',
      clock: '"Copperplate","Optima",sans-serif', radius: "12px",
    },
    greet: "Bienvenido a la isla. Las cercas están activas… creo.",
    music: { key: 10, mode: "major", bpm: 76, style: "hymn", lead: "horn", prog: [0, 3, 0, 4, 5, 3, 4, 0] },
    apple: "Jurassic Park soundtrack John Williams", playlist: "George – Jurásico",
  },
];

export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

/** Busca un estilo por cómo lo diría una persona ("pon el de star wars", "navidad"...). */
const ALIASES = {
  aventura: ["aventura", "reliquia", "indiana", "arqueolog", "adventure", "explorador"],
  reactor: ["reactor", "iron", "armadura", "hud", "stark", "jarvis"],
  expreso: ["expreso", "polar", "tren", "train", "express"],
  galaxia: ["galaxia", "star wars", "starwars", "guerra de las galaxias", "espacio", "galaxy", "jedi"],
  guerra: ["1944", "cuartel", "segunda guerra", "guerra mundial", "militar", "world war", "ww2"],
  navidad: ["navidad", "christmas", "sinatra", "navide", "xmas"],
  magia: ["magia", "mago", "potter", "hogwarts", "colegio", "wizard", "magic"],
  matrix: ["matrix", "código", "codigo", "hacker", "code"],
  neon: ["neón", "neon", "cyberpunk", "blade", "2049", "ciberpunk"],
  jurasico: ["jurásic", "jurasic", "dinosaur", "isla", "jurassic", "selva"],
};
export function findTheme(text) {
  const t = text.toLowerCase();
  for (const [id, words] of Object.entries(ALIASES)) if (words.some((w) => t.includes(w))) return themeById(id);
  return null;
}
