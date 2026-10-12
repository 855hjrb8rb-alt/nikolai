// NIKOLAI — servidor del asistente tipo JARVIS.
// Sirve la interfaz (carpeta public/) y hace de puente con la API de Claude,
// para que tu clave ANTHROPIC_API_KEY nunca llegue al navegador.
// (La carpeta public/ también funciona sola como web estática; ver README.)

import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MODEL, DEFAULT_EFFORT, parseRequest, runChat } from "./public/js/brain-core.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");
const VISION_DIR = path.join(ROOT, "node_modules", "@mediapipe", "tasks-vision");

const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.JARVIS_MODEL || DEFAULT_MODEL;
const EFFORT = process.env.JARVIS_EFFORT || DEFAULT_EFFORT;
const WEB_SEARCH = process.env.JARVIS_WEB_SEARCH !== "off";

const client = new Anthropic(); // usa ANTHROPIC_API_KEY del entorno

async function handleChat(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: "JSON inválido" });
  }
  const request = parseRequest(body);
  if (!request) return sendJson(res, 400, { error: "Falta el mensaje del usuario" });

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  let aborted = false;
  res.on("close", () => { aborted = true; });
  await runChat({
    client, Anthropic, request, model: MODEL, effort: EFFORT, webSearch: WEB_SEARCH,
    send: (event) => res.write(`data: ${JSON.stringify(event)}\n\n`),
    isAborted: () => aborted,
  });
  res.end();
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
      return sendJson(res, 200, { ok: true, mode: "server", model: MODEL, apiKey: Boolean(process.env.ANTHROPIC_API_KEY) });
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
