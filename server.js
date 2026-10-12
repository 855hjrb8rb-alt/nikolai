// NIKOLAI — servidor del asistente tipo JARVIS.
// Sirve la interfaz (carpeta public/) y hace de puente con la API de Claude,
// para que tu clave ANTHROPIC_API_KEY nunca llegue al navegador.

import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");
const VISION_DIR = path.join(ROOT, "node_modules", "@mediapipe", "tasks-vision");

const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.JARVIS_MODEL || "claude-opus-5-5";
// Esfuerzo bajo = respuestas rápidas, ideal para un asistente por voz.
const EFFORT = process.env.JARVIS_EFFORT || "low";
const WEB_SEARCH = process.env.JARVIS_WEB_SEARCH !== "off";
const MAX_ROUNDS = 6;

const client = new Anthropic(); // usa ANTHROPIC_API_KEY del entorno

const LANGUAGES = {
  es: "español", en: "English", fr: "français", pt: "português", de: "Deutsch",
  it: "italiano", ja: "日本語", zh: "中文", ko: "한국어", ru: "русский", ar: "العربية", hi: "हिन्दी",
};
const PANELS = ["chat", "voice", "languages", "translator", "notes", "system", "settings", "help"];

// Herramientas con las que Claude puede controlar la interfaz (las ejecuta el navegador).
const UI_TOOLS = [
  {
    name: "set_language",
    description: "Cambia el idioma de la interfaz, del reconocimiento de voz y de la voz del asistente. Úsala cuando el usuario pida hablar en otro idioma.",
    input_schema: {
      type: "object",
      properties: { code: { type: "string", enum: Object.keys(LANGUAGES) } },
      required: ["code"],
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: "open_panel",
    description: "Abre un panel del menú holográfico: chat, voice (voz), languages (idiomas), translator (traductor), notes (notas), system (estado del sistema), settings (ajustes), help (ayuda con gestos).",
    input_schema: {
      type: "object",
      properties: { panel: { type: "string", enum: PANELS } },
      required: ["panel"],
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: "save_note",
    description: "Guarda una nota o recordatorio en el panel de notas del usuario.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
];

function validToolInput(name, input) {
  if (!input || typeof input !== "object") return false;
  if (name === "set_language") return typeof input.code === "string" && input.code in LANGUAGES;
  if (name === "open_panel") return PANELS.includes(input.panel);
  if (name === "save_note") return typeof input.text === "string" && input.text.trim().length > 0;
  return false;
}

function systemPrompt(lang, now) {
  return [
    "Eres NIKOLAI, un asistente de inteligencia artificial al estilo de JARVIS: brillante, leal, elegante y con un toque de humor británico sutil.",
    "Tu usuario te controla con gestos de la mano, con la voz y con el teclado desde una interfaz holográfica.",
    `Idioma actual de la interfaz: ${LANGUAGES[lang] || lang}. Responde siempre en el idioma en el que te hable el usuario; si no está claro, usa el idioma de la interfaz.`,
    "Tus respuestas se leen en voz alta: sé conciso (2-4 frases salvo que te pidan detalle), evita tablas y markdown pesado.",
    "Puedes usar tus herramientas para cambiar el idioma, abrir paneles del menú o guardar notas cuando el usuario lo pida.",
    WEB_SEARCH ? "Si necesitas información actual (noticias, clima, precios, resultados), usa la búsqueda web." : "",
    `Fecha y hora local del usuario: ${now}.`,
  ].filter(Boolean).join("\n");
}

function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-30)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
}

async function handleChat(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: "JSON inválido" });
  }
  const messages = cleanHistory(body.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return sendJson(res, 400, { error: "Falta el mensaje del usuario" });
  }
  const lang = typeof body.lang === "string" ? body.lang : "es";
  const now = typeof body.now === "string" ? body.now.slice(0, 80) : new Date().toString();

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  let aborted = false;
  res.on("close", () => { aborted = true; });

  const tools = [...UI_TOOLS];
  if (WEB_SEARCH) tools.push({ type: "web_search_20260209", name: "web_search", max_uses: 3 });

  try {
    for (let round = 0; round < MAX_ROUNDS && !aborted; round++) {
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: EFFORT },
        system: systemPrompt(lang, now),
        tools,
        messages,
        // Si un filtro de seguridad rechaza la petición, la API reintenta con otro modelo.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });

      for await (const event of stream) {
        if (aborted) { stream.abort(); return; }
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          send({ type: "text", text: event.delta.text });
        } else if (event.type === "content_block_start" && event.content_block.type === "server_tool_use") {
          send({ type: "status", status: "searching" });
        }
      }

      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") {
        send({ type: "error", error: "refusal" });
        break;
      }
      if (final.stop_reason === "pause_turn") {
        // Búsqueda web larga: se continúa el mismo turno.
        messages.push({ role: "assistant", content: final.content });
        continue;
      }
      if (final.stop_reason !== "tool_use") break;

      messages.push({ role: "assistant", content: final.content });
      const results = [];
      for (const block of final.content) {
        if (block.type !== "tool_use") continue;
        if (validToolInput(block.name, block.input)) {
          send({ type: "action", name: block.name, input: block.input });
          results.push({ type: "tool_result", tool_use_id: block.id, content: "Hecho." });
        } else {
          results.push({ type: "tool_result", tool_use_id: block.id, content: "INVALID_INPUT: revisa los parámetros.", is_error: true });
        }
      }
      messages.push({ role: "user", content: results });
    }
    send({ type: "done" });
  } catch (err) {
    console.error("[chat]", err);
    const msg = err instanceof Anthropic.AuthenticationError || /authentication/i.test(err?.message || "")
      ? "auth"
      : err instanceof Anthropic.RateLimitError
        ? "rate_limit"
        : err instanceof Anthropic.APIConnectionError
          ? "connection"
          : err?.message || "error";
    send({ type: "error", error: msg });
  } finally {
    res.end();
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  let pathname = decodeURIComponent(url.pathname);
  let baseDir = PUBLIC_DIR;
  if (pathname.startsWith("/vendor/tasks-vision/")) {
    baseDir = VISION_DIR;
    pathname = pathname.slice("/vendor/tasks-vision".length);
  }
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.normalize(path.join(baseDir, pathname));
  if (!filePath.startsWith(baseDir + path.sep)) return sendJson(res, 403, { error: "forbidden" });
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("not a file");
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: "No encontrado" });
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) { reject(new Error("too large")); req.destroy(); }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

http
  .createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/chat") return handleChat(req, res);
    if (req.method === "GET" && req.url === "/api/health") {
      return sendJson(res, 200, { ok: true, model: MODEL, apiKey: Boolean(process.env.ANTHROPIC_API_KEY) });
    }
    if (req.method === "GET") return serveStatic(req, res);
    sendJson(res, 405, { error: "Método no permitido" });
  })
  .listen(PORT, () => {
    console.log(`\n  ⚡ NIKOLAI en línea → http://localhost:${PORT}\n`);
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn("  ⚠  Falta ANTHROPIC_API_KEY: la interfaz y los gestos funcionan, pero el cerebro (Claude) no responderá.\n");
    }
  });
