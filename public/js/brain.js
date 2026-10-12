// Conexión con el cerebro (Claude). Dos modos:
// - "server": la web la sirve server.js y la clave vive en el servidor.
// - "direct": web estática (GitHub Pages, Netlify…); el navegador habla con la API
//   de Anthropic usando la clave que el usuario guarda en este navegador.

import { DEFAULT_MODEL, parseRequest, runChat } from "./brain-core.js";

const KEY_STORE = "nikolai.apiKey";
let mode = "direct";
let sdk = null;

export function getKey() {
  try { return localStorage.getItem(KEY_STORE) || ""; } catch { return ""; }
}

export function setKey(key) {
  try {
    if (key) localStorage.setItem(KEY_STORE, key.trim());
    else localStorage.removeItem(KEY_STORE);
  } catch { /* almacenamiento bloqueado */ }
}

export function getMode() {
  return mode;
}

/** Averigua si hay servidor. Devuelve el estado del cerebro. */
export async function detect() {
  try {
    const res = await fetch("api/health", { cache: "no-store" });
    if (res.ok) {
      const health = await res.json();
      if (health.mode === "server") {
        mode = "server";
        return health;
      }
    }
  } catch { /* sin servidor */ }
  mode = "direct";
  return { ok: true, mode, apiKey: Boolean(getKey()), model: DEFAULT_MODEL };
}

/**
 * Envía una petición y entrega la respuesta en streaming.
 * Devuelve el código de error, o null si todo fue bien.
 */
export async function stream(payload, { onText, onAction, onStatus, signal }) {
  let error = null;
  const handle = (ev) => {
    if (ev.type === "text") onText?.(ev.text);
    else if (ev.type === "action") onAction?.(ev);
    else if (ev.type === "status") onStatus?.(ev.status);
    else if (ev.type === "error") error = ev.error;
  };

  if (mode === "direct") {
    const apiKey = getKey();
    if (!apiKey) return "auth";
    const request = parseRequest(payload);
    if (!request) return "error";
    sdk ??= (await import("../vendor/anthropic-sdk.mjs")).default;
    const client = new sdk({ apiKey, dangerouslyAllowBrowser: true });
    await runChat({ client, Anthropic: sdk, request, send: handle, signal });
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return error;
  }

  const res = await fetch("api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop();
    for (const part of parts) {
      if (part.startsWith("data: ")) handle(JSON.parse(part.slice(6)));
    }
  }
  return error;
}
