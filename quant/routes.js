// Rutas HTTP de NIKOLAI QUANT (panel privado + API).

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { authEnabled, isAuthed, login, logout, sessionCookie } from "./auth.js";
import { data, save, encrypt } from "./store.js";
import { VENUES, venueList, connect, candles, marketSymbol, forget } from "./exchanges.js";
import { strategyList } from "./strategies.js";
import { normalizeBot, view, startBot, stopBot, resetBot, panic, analyze, credsFor, TF_MS } from "./engine.js";
import { btcNetwork, btcProfit, poolStatus, MINING_GUIDE } from "./mining.js";

const PRIVATE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "private");
const ASSETS = { "/quant/app.js": ["app.js", "text/javascript; charset=utf-8"], "/quant/app.css": ["app.css", "text/css; charset=utf-8"] };
const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

function json(res, status, obj, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS, ...headers });
  res.end(JSON.stringify(obj));
}

async function page(res, file, type = "text/html; charset=utf-8") {
  res.writeHead(200, { "Content-Type": type, ...SECURITY_HEADERS });
  res.end(await readFile(path.join(PRIVATE_DIR, file)));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let d = "";
    req.on("data", (c) => { d += c; if (d.length > 100_000) { reject(new Error("too large")); req.destroy(); } });
    req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch { reject(new Error("JSON inválido")); } });
    req.on("error", reject);
  });
}

const findBot = (id) => data().bots.find((b) => b.id === id);
const keyHint = (k) => (k ? `${k.slice(0, 4)}…${k.slice(-4)}` : "");

function state() {
  const d = data();
  const bots = d.bots.map(view);
  const keys = {};
  for (const id of Object.keys(VENUES)) {
    const c = d.keys[id] ? credsFor(id) : null;
    keys[id] = c ? { set: true, hint: keyHint(c.apiKey) } : { set: Boolean(d.keys[id]), broken: Boolean(d.keys[id]) };
  }
  // Totales por moneda de cotización (USDT, USD, MXN…), no se mezclan.
  const totals = {};
  for (const b of bots) {
    const q = b.symbol.split("/")[1]?.split(":")[0] || "USD";
    const t = (totals[q] ||= { capital: 0, equity: 0, pnl: 0, unrealized: 0 });
    t.capital += b.capital; t.equity += b.equityNow; t.pnl += b.stats.pnl; t.unrealized += b.unrealized;
  }
  return {
    bots, totals, keys,
    running: bots.filter((b) => b.status === "running").length,
    venues: venueList(), strategies: strategyList(), timeframes: Object.keys(TF_MS),
    ai: Boolean(process.env.ANTHROPIC_API_KEY), sandbox: process.env.QUANT_SANDBOX === "1",
    miners: d.miners, guide: MINING_GUIDE,
  };
}

export async function handleQuant(req, res) {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;
  if (p !== "/quant" && p !== "/quant/" && !p.startsWith("/quant/") && !p.startsWith("/api/quant/")) return false;

  try {
    // --- Páginas ---
    if (req.method === "GET" && (p === "/quant" || p === "/quant/")) {
      await page(res, authEnabled() && isAuthed(req) ? "quant.html" : "login.html");
      return true;
    }
    if (req.method === "GET" && ASSETS[p]) {
      if (!isAuthed(req)) { json(res, 401, { error: "auth" }); return true; }
      await page(res, ...ASSETS[p]);
      return true;
    }

    // --- Sesión ---
    if (p === "/api/quant/status") { json(res, 200, { enabled: authEnabled(), authed: authEnabled() && isAuthed(req) }); return true; }
    if (p === "/api/quant/login" && req.method === "POST") {
      if (!authEnabled()) { json(res, 503, { error: "not_configured" }); return true; }
      const { password } = await body(req);
      const r = login(req, String(password || ""));
      if (!r.ok) { json(res, r.error === "locked" ? 429 : 401, r); return true; }
      json(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(req, r.token) });
      return true;
    }
    if (p === "/api/quant/logout" && req.method === "POST") {
      logout(req);
      json(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(req, "") });
      return true;
    }

    // --- Todo lo demás exige sesión ---
    if (!authEnabled() || !isAuthed(req)) { json(res, 401, { error: "auth" }); return true; }
    if (req.method === "POST" && req.headers["x-quant"] !== "1") { json(res, 403, { error: "csrf" }); return true; }

    if (p === "/api/quant/state" && req.method === "GET") { json(res, 200, state()); return true; }

    if (p === "/api/quant/candles" && req.method === "GET") {
      const q = Object.fromEntries(url.searchParams);
      const market = q.market === "futures" ? "futures" : "spot";
      const ex = connect(q.venue, market);
      const cs = await candles(ex, marketSymbol(q.symbol, market), TF_MS[q.timeframe] ? q.timeframe : "15m", 150);
      json(res, 200, { candles: cs });
      return true;
    }

    if (p === "/api/quant/analyze" && req.method === "POST") { json(res, 200, await analyze(await body(req))); return true; }

    if (p === "/api/quant/panic" && req.method === "POST") { await panic(); json(res, 200, state()); return true; }

    // --- Bots ---
    if (p === "/api/quant/bots" && req.method === "POST") {
      const input = await body(req);
      if (input.mode === "live" && input.confirmLive !== true) { json(res, 400, { error: "Confirma el modo REAL" }); return true; }
      data().bots.push(normalizeBot(input));
      save();
      json(res, 200, state());
      return true;
    }
    const m = p.match(/^\/api\/quant\/bots\/([a-f0-9]{10})\/(update|start|stop|reset|delete)$/);
    if (m && req.method === "POST") {
      const bot = findBot(m[1]);
      if (!bot) { json(res, 404, { error: "Bot no encontrado" }); return true; }
      const input = await body(req);
      const act = m[2];
      if (act === "update") {
        if (bot.status === "running") { json(res, 409, { error: "Detén el bot antes de editarlo" }); return true; }
        if (bot.state.lots.length && (input.venue !== bot.venue || input.symbol?.toUpperCase() !== bot.symbol || input.market !== bot.market || input.mode !== bot.mode)) {
          json(res, 409, { error: "Cierra sus posiciones antes de cambiar exchange, par, mercado o modo" }); return true;
        }
        if (input.mode === "live" && bot.mode !== "live" && input.confirmLive !== true) { json(res, 400, { error: "Confirma el modo REAL" }); return true; }
        Object.assign(bot, normalizeBot(input, bot));
        save();
      } else if (act === "start") await startBot(bot);
      else if (act === "stop") await stopBot(bot, Boolean(input.close));
      else if (act === "reset") { if (bot.state.lots.length && bot.mode === "live") { json(res, 409, { error: "Cierra las posiciones reales primero" }); return true; } resetBot(bot); }
      else if (act === "delete") {
        if (bot.state.lots.length && bot.mode === "live") { json(res, 409, { error: "Cierra las posiciones reales primero" }); return true; }
        await stopBot(bot);
        data().bots = data().bots.filter((b) => b.id !== bot.id);
        save();
      }
      json(res, 200, state());
      return true;
    }

    // --- Claves API ---
    if (p === "/api/quant/keys" && req.method === "POST") {
      const { venue, apiKey, secret, password } = await body(req);
      if (!VENUES[venue]) { json(res, 400, { error: "Exchange desconocido" }); return true; }
      if (!apiKey || !secret) { json(res, 400, { error: "Faltan API key y secret" }); return true; }
      data().keys[venue] = encrypt({ apiKey: String(apiKey).trim(), secret: String(secret).trim(), password: password ? String(password).trim() : undefined });
      forget(venue);
      save(true);
      json(res, 200, state());
      return true;
    }
    if (p === "/api/quant/keys/delete" && req.method === "POST") {
      const { venue } = await body(req);
      if (data().bots.some((b) => b.venue === venue && b.mode === "live" && b.status === "running")) { json(res, 409, { error: "Hay bots reales activos en ese exchange" }); return true; }
      delete data().keys[venue];
      forget(venue);
      save(true);
      json(res, 200, state());
      return true;
    }
    if (p === "/api/quant/keys/test" && req.method === "POST") {
      const { venue, market } = await body(req);
      const c = credsFor(venue);
      if (!c) { json(res, 400, { error: "Guarda primero las claves" }); return true; }
      const ex = connect(venue, market === "futures" && VENUES[venue]?.futures ? "futures" : "spot", c);
      const bal = await ex.fetchBalance();
      const balances = Object.entries(bal.total || {}).filter(([, v]) => v > 0).slice(0, 20).map(([asset, total]) => ({ asset, total, free: bal.free?.[asset] ?? null }));
      json(res, 200, { ok: true, balances });
      return true;
    }

    // --- Minería ---
    if (p === "/api/quant/mining/btc" && req.method === "GET") {
      const q = Object.fromEntries(url.searchParams);
      const net = await btcNetwork();
      json(res, 200, { network: net, result: btcProfit(net, { hashrateTH: +q.hashrateTH || 0, powerW: +q.powerW || 0, costKwh: +q.costKwh || 0, poolFee: q.poolFee ? +q.poolFee : 2 }) });
      return true;
    }
    if (p === "/api/quant/miners" && req.method === "POST") {
      const i = await body(req);
      data().miners.push({
        id: randomBytes(5).toString("hex"), name: String(i.name || "Minero").slice(0, 40), pool: String(i.pool || "2miners"),
        coin: String(i.coin || "").toLowerCase().slice(0, 15), wallet: String(i.wallet || "").trim().slice(0, 120),
        hashrateTH: Math.max(0, +i.hashrateTH || 0), powerW: Math.max(0, +i.powerW || 0), costKwh: Math.max(0, +i.costKwh || 0),
      });
      save();
      json(res, 200, state());
      return true;
    }
    const mm = p.match(/^\/api\/quant\/miners\/([a-f0-9]{10})\/(status|delete)$/);
    if (mm) {
      const miner = data().miners.find((x) => x.id === mm[1]);
      if (!miner) { json(res, 404, { error: "Minero no encontrado" }); return true; }
      if (mm[2] === "delete" && req.method === "POST") { data().miners = data().miners.filter((x) => x !== miner); save(); json(res, 200, state()); return true; }
      if (mm[2] === "status" && req.method === "GET") { json(res, 200, await poolStatus(miner)); return true; }
    }

    json(res, 404, { error: "No encontrado" });
  } catch (err) {
    console.error("[quant]", err?.message || err);
    json(res, 502, { error: String(err?.message || err).slice(0, 300) });
  }
  return true;
}
