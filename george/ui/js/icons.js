// Iconos dibujados para las apps más comunes. Son de un solo trazo y toman el color del
// estilo, así todas las apps parecen parte de la misma película. Para las demás apps se usa
// su icono real teñido con el color del estilo.
const P = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6.5L20.5 7"/>',
  chat: '<path d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v7a2.5 2.5 0 01-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 014 13.5z"/>',
  video: '<rect x="3" y="6.5" width="12" height="11" rx="2.5"/><path d="M15 10.5l6-3v9l-6-3z"/>',
  note: '<path d="M9 18V5.5l10-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  photo: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M3.5 17l5-5 4 4 3-3 5 5"/>',
  pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0113 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4M8 13.5h2M14 13.5h2M8 16.5h2"/>',
  page: '<path d="M6.5 3.5h8l4 4V19a1.5 1.5 0 01-1.5 1.5H6.5A1.5 1.5 0 015 19V5a1.5 1.5 0 011.5-1.5z"/><path d="M14.5 3.5v4h4M8.5 12h7M8.5 15.5h7"/>',
  check: '<path d="M4 6.5l1.5 1.5L8 5.5M4 12l1.5 1.5L8 11M4 17.5L5.5 19 8 16.5M11 7h9M11 12.5h9M11 18h9"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8.5 20.5h7M10 9l4.5 2.5L10 14z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3"/>',
  folder: '<path d="M3 7.5A2 2 0 015 5.5h4l2 2.5h8a2 2 0 012 2V17a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  term: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M7 9.5l3 2.5-3 2.5M12.5 15h4.5"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8"/>',
  bag: '<path d="M5 8.5h14l-1 11.5H6z"/><path d="M9 8.5V7a3 3 0 016 0v1.5"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8 7h8M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 17.5h.01M12 17.5h.01M15.5 17.5h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6.5V12l3.5 2.2"/>',
  cloud: '<circle cx="8" cy="7.5" r="2.8"/><path d="M8 2.5v1M3 7.5h1M4.5 4l.8.8M7 19.5h9.5a3.8 3.8 0 00.6-7.5 5.2 5.2 0 00-10 1.3A3.2 3.2 0 007 19.5z"/>',
  book: '<path d="M12 6.5c-2-1.6-5-2-8-1.5v13c3-.5 6-.1 8 1.5 2-1.6 5-2 8-1.5V5c-3-.5-6-.1-8 1.5zM12 6.5v13"/>',
  bars: '<path d="M4 20.5h16M6.5 17v-5M11 17V7M15.5 17v-8M19 17v-3"/>',
  slides: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v3M8 21l4-2 4 2M8 12l3-3 2 2 3-3"/>',
  pen: '<path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 013 3L8 18.5zM14.5 6l3 3"/>',
  person: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0115 0"/>',
  camera: '<path d="M4.5 7.5h3l1.5-2.5h6l1.5 2.5h3A1.5 1.5 0 0121 9v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18V9a1.5 1.5 0 011.5-1.5z"/><circle cx="12" cy="13" r="3.6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  wave: '<path d="M4 10v4M8 6.5v11M12 3.5v17M16 7.5v9M20 10v4"/>',
  home: '<path d="M3.5 11.5L12 4l8.5 7.5M6 10v9.5h12V10M10 19.5v-5h4v5"/>',
  chart: '<path d="M3.5 17l5-6 4 3.5 7.5-9M15.5 5.5H20V10"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4.5-2 1.5a12 12 0 005.5 5.5l1.5-2 4.5 1.5v3A2 2 0 0118.5 19.5C10.5 19.5 4.5 13.5 4.5 5.5a2 2 0 012-2z"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5.5 3.5-5.5 3.5z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16 7l2.5 2.5M13.5 9.5l2 2"/>',
  bolt: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
};
// nombre de app (sin acentos, minúsculas) → dibujo. Se compara por "contiene".
const MAP = [
  ["safari", "compass"], ["chrome", "globe"], ["firefox", "globe"], ["edge", "globe"], ["arc", "globe"], ["brave", "globe"], ["opera", "globe"],
  ["facetime", "video"], ["zoom", "video"], ["teams", "video"], ["photo booth", "camera"], ["camara", "camera"], ["camera", "camera"],
  ["mail", "mail"], ["correo", "mail"], ["outlook", "mail"],
  ["mensajes", "chat"], ["messages", "chat"], ["whatsapp", "chat"], ["telegram", "chat"], ["discord", "chat"], ["slack", "chat"],
  ["musica", "note"], ["music", "note"], ["spotify", "note"], ["garageband", "note"],
  ["fotos", "photo"], ["photos", "photo"], ["vista previa", "photo"], ["preview", "photo"],
  ["mapas", "pin"], ["maps", "pin"], ["encontrar", "pin"], ["find my", "pin"],
  ["calendar", "calendar"], ["notas de voz", "wave"], ["voice memos", "wave"],
  ["notas", "page"], ["notes", "page"], ["textedit", "page"], ["word", "page"],
  ["recordatorios", "check"], ["reminders", "check"],
  ["podcasts", "mic"], ["tv", "tv"], ["netflix", "tv"], ["quicktime", "play"], ["vlc", "play"], ["iina", "play"], ["youtube", "play"],
  ["finder", "folder"], ["archivos", "folder"], ["terminal", "term"], ["iterm", "term"], ["consola", "term"], ["console", "term"], ["xcode", "term"], ["code", "term"],
  ["ajustes", "gear"], ["settings", "gear"], ["preferencias", "gear"], ["utilidad", "gear"], ["utility", "gear"], ["monitor", "chart"],
  ["app store", "bag"], ["calculadora", "calc"], ["calculator", "calc"], ["excel", "bars"], ["numbers", "bars"],
  ["reloj", "clock"], ["clock", "clock"], ["time machine", "clock"], ["tiempo", "cloud"], ["weather", "cloud"], ["clima", "cloud"],
  ["libros", "book"], ["books", "book"], ["diccionario", "book"], ["dictionary", "book"], ["kindle", "book"],
  ["keynote", "slides"], ["powerpoint", "slides"], ["pages", "pen"], ["freeform", "pen"], ["contactos", "person"], ["contacts", "person"],
  ["casa", "home"], ["home", "home"], ["bolsa", "chart"], ["stocks", "chart"], ["telefono", "phone"], ["phone", "phone"],
  ["contrasenas", "key"], ["passwords", "key"], ["llaveros", "key"], ["keychain", "key"], ["atajos", "bolt"], ["shortcuts", "bolt"], ["ollama", "bolt"],
];
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function svg(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.grid}</svg>`;
}
/** El dibujo que le toca a una app, o null si no es de las conocidas. */
export function glyphFor(appName) {
  const n = norm(appName);
  const hit = MAP.find(([k]) => n === k) || MAP.find(([k]) => (k.length <= 3 ? n.split(/\s+/).includes(k) : n.includes(k)));
  return hit ? hit[1] : null;
}
