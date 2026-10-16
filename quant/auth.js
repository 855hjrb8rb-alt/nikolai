// NIKOLAI QUANT — acceso privado.
// Una sola contraseña (QUANT_PASSWORD en el entorno). Sesión por cookie
// HttpOnly + SameSite=Strict, caducidad de 12 h y bloqueo tras intentos fallidos.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_TTL = 12 * 60 * 60 * 1000;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const COOKIE = "nq_session";

const sessions = new Map(); // token -> expira (ms)
const fails = new Map();    // ip -> { n, until }

const digest = (s) => createHash("sha256").update(String(s)).digest();

export const authEnabled = () => Boolean(process.env.QUANT_PASSWORD);

function clientIp(req) {
  return (process.env.QUANT_TRUST_PROXY ? String(req.headers["x-forwarded-for"] || "").split(",").pop().trim() : "") || req.socket.remoteAddress || "?";
}

export function login(req, password) {
  const ip = clientIp(req);
  const f = fails.get(ip);
  if (f && f.until > Date.now()) return { ok: false, error: "locked", retryIn: Math.ceil((f.until - Date.now()) / 1000) };
  if (!authEnabled() || !timingSafeEqual(digest(password), digest(process.env.QUANT_PASSWORD))) {
    const recent = f && f.first > Date.now() - LOCK_MS;
    const n = (recent ? f.n : 0) + 1;
    fails.set(ip, { n, first: recent ? f.first : Date.now(), until: n >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
    return { ok: false, error: "bad_password" };
  }
  fails.delete(ip);
  const token = randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL);
  return { ok: true, token };
}

function readCookie(req) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return v.join("=");
  }
  return "";
}

export function isAuthed(req) {
  const token = readCookie(req);
  const exp = token && sessions.get(token);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(token); return false; }
  return true;
}

export function logout(req) { sessions.delete(readCookie(req)); }

export function sessionCookie(req, token) {
  const secure = process.env.QUANT_SECURE_COOKIE === "1" || req.headers["x-forwarded-proto"] === "https";
  const maxAge = token ? SESSION_TTL / 1000 : 0;
  return `${COOKIE}=${token || ""}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
