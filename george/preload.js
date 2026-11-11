// Puente seguro entre la interfaz y el Mac.
const { contextBridge, ipcRenderer } = require("electron");

const call = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);
let chatSeq = 0;
const chatHandlers = new Map();
ipcRenderer.on("llm:event", (_e, { id, type, data }) => {
  const h = chatHandlers.get(id);
  if (!h) return;
  if (type === "chunk") h.onChunk?.(data);
  else { chatHandlers.delete(id); if (type === "error") h.reject(new Error(data)); else h.resolve(); }
});

contextBridge.exposeInMainWorld("georgeNative", {
  store: { get: call("store:get"), set: call("store:set") },
  apps: { list: call("apps:list"), open: call("apps:open") },
  sys: { info: call("sys:info"), openUrl: call("sys:openUrl"), volume: call("sys:volume"), battery: call("sys:battery") },
  tts: { voices: call("tts:voices"), synth: call("tts:synth") },
  stt: { transcribe: call("stt:transcribe") },
  llm: {
    status: call("llm:status"),
    /** Devuelve { done: Promise, abort() } y va llamando onChunk con cada trozo de texto. */
    chat(req, onChunk) {
      const id = `c${++chatSeq}`;
      const done = new Promise((resolve, reject) => chatHandlers.set(id, { onChunk, resolve, reject }));
      ipcRenderer.send("llm:chat", { id, ...req });
      return { done, abort: () => ipcRenderer.send("llm:abort", id) };
    },
  },
  screen: { grab: call("screen:grab") },
  music: { list: call("music:list"), openFolder: call("music:openFolder"), apple: call("music:apple") },
  app: {
    themes: call("app:themes"), loginItem: call("app:loginItem"), hide: call("app:hide"), quit: call("app:quit"),
    themeChanged: () => ipcRenderer.send("theme:changed"),
  },
  media: { ask: call("media:ask") },
  on(event, fn) {
    if (!["george:summon", "theme:set"].includes(event)) return;
    ipcRenderer.on(event, (_e, ...a) => fn(...a));
  },
});
