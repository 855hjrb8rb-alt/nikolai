// Servidor de mi novia IA. Sirve la app (carpeta web/) y habla con Claude con tu clave,
// que nunca llega al navegador. Con NOVIA_PASSWORD, la app pide contraseña (solo tú entras).

import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MODEL, parseRequest, runChat } from "./web/js/brain.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.join(ROOT, "web");
const VISION_DIR = path.join(ROOT, "node_modules", "@mediapipe", "tasks-vision");

const PORT = Number(process.env.PORT) || 3500;
const MODEL = process.env.NOVIA_MODEL || DEFAULT_MODEL;
const PASSWORD = process.env.NOVIA_PASSWORD || "";

const client = new Anthropic(); // usa ANTHROPIC_API_KEY del entorno

/** Contraseña con la autenticación básica del navegador (cualquier usuario, tu contraseña). */
function authorized(req) {
  if (!PASSWORD) return true;
  const m = /^Basic (.+)$/.exec(req.headers.authorization || "");
  if (!m) return false;
  const pass = Buffer.from(m[1], "base64").toString().split(":").slice(1).join(":");
  const a = Buffer.from(pass), b = Buffer.from(PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handleChat(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: "JSON inválido" });
  }
  const request = parseRequest(body);
  if (!request) return sendJson(res, 400, { error: "Falta tu mensaje" });
  res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive" });
  let aborted = false;
  res.on("close", () => { aborted = true; });
  await runChat({
    client, Anthropic, request, model: MODEL,
    send: (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`),
    isAborted: () => aborted,
  });
  res.end();
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".wasm": "application/wasm",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json",
};

async function serveStatic(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  let baseDir = WEB_DIR;
  if (pathname.startsWith("/vendor/tasks-vision/")) {
    baseDir = VISION_DIR;
    pathname = pathname.slice("/vendor/tasks-vision".length);
  }
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.normalize(path.join(baseDir, pathname));
  if (!filePath.startsWith(baseDir + path.sep)) return sendJson(res, 403, { error: "forbidden" });
  try {
    if (!(await stat(filePath)).isFile()) throw new Error("no es archivo");
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream", "Cache-Control": "no-cache" });
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
      if (data.length > 8_000_000) { reject(new Error("demasiado grande")); req.destroy(); }
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
    if (!authorized(req)) {
      res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Mi novia", charset="UTF-8"' });
      return res.end("Contraseña requerida");
    }
    if (req.method === "POST" && req.url === "/api/chat") return handleChat(req, res);
    if (req.method === "GET" && req.url === "/api/health") return sendJson(res, 200, { ok: true, apiKey: Boolean(process.env.ANTHROPIC_API_KEY) });
    if (req.method === "GET") return serveStatic(req, res);
    sendJson(res, 405, { error: "Método no permitido" });
  })
  .listen(PORT, () => {
    console.log(`\n  ❣  Tu novia te espera → http://localhost:${PORT}\n`);
    if (!process.env.ANTHROPIC_API_KEY) console.warn("  ⚠  Falta ANTHROPIC_API_KEY: la cara se ve, pero no podrá hablar.\n");
    if (!PASSWORD) console.warn("  ℹ  Sin NOVIA_PASSWORD: cualquiera con acceso a tu red puede abrirla.\n");
  });
