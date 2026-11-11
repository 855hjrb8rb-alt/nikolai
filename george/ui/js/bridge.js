// Acceso al Mac. Dentro de la app usa el puente nativo; abierto en un navegador (para
// probar el diseño) usa un sustituto que guarda en localStorage y no toca el sistema.
const native = window.georgeNative;

const DEMO_APPS = [
  "Safari", "Mail", "Mensajes", "FaceTime", "Música", "Fotos", "Mapas", "Calendario", "Notas",
  "Recordatorios", "TV", "Podcasts", "Finder", "Terminal", "Ajustes del Sistema", "App Store",
  "Calculadora", "Reloj", "Tiempo", "Libros", "Vista Previa", "Pages", "Numbers", "Keynote",
].map((name) => ({ name, path: "/Applications/" + name + ".app", icon: "" }));

const mock = {
  store: {
    async get(name) { try { return JSON.parse(localStorage.getItem("george." + name)); } catch { return null; } },
    async set(name, data) { localStorage.setItem("george." + name, JSON.stringify(data)); return true; },
  },
  apps: { list: async () => DEMO_APPS, open: async () => true },
  sys: {
    info: async () => ({ platform: "web", user: "invitado", ramGB: 8, whisper: false, faceModel: false, loginItem: false, hotkey: "Alt+Space", musicRoot: "~/Music/George", version: "demo" }),
    openUrl: async (u) => { window.open(u, "_blank"); return true; },
    volume: async () => true, battery: async () => null,
  },
  tts: { voices: async () => [], synth: async () => null },
  stt: { transcribe: async () => ({ error: "no-whisper" }) },
  llm: {
    status: async () => ({ ok: false, models: [] }),
    chat: () => ({ done: Promise.reject(new Error("sin cerebro local")), abort() {} }),
  },
  screen: { grab: async () => null },
  music: { list: async () => [], openFolder: async () => "", apple: async () => false },
  app: { themes: async () => {}, loginItem: async () => true, hide: async () => {}, quit: async () => {}, themeChanged() {} },
  media: { ask: async () => true },
  on() {},
};

export const mac = native || mock;
export const isNative = Boolean(native);

/** Guardado con caché en memoria: lee una vez y escribe con un pequeño retraso. */
export class Store {
  constructor(name, defaults) { this.name = name; this.data = defaults; this.timer = 0; }
  async load() {
    const d = await mac.store.get(this.name).catch(() => null);
    if (d && typeof d === "object") this.data = Array.isArray(this.data) ? d : { ...this.data, ...d };
    return this.data;
  }
  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => mac.store.set(this.name, this.data).catch(() => {}), 250);
  }
  set(patch) { Object.assign(this.data, patch); this.save(); }
}
