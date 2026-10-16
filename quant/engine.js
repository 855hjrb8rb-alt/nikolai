// Motor de bots de NIKOLAI QUANT.
// - Modo "paper": simula órdenes con precios reales del exchange (sin claves).
// - Modo "live": envía órdenes de mercado reales con tus claves API (ccxt).
// Gestión de riesgo en cada ciclo: stop-loss, take-profit, liquidación (paper)
// y drawdown máximo (si la cuenta del bot cae por debajo, cierra todo y se detiene).

import { randomBytes } from "node:crypto";
import { data, save, decrypt } from "./store.js";
import { VENUES, connect, candles, marketSymbol } from "./exchanges.js";
import { STRATEGIES } from "./strategies.js";
import { rsi, snapshot } from "./indicators.js";

const FEE = 0.001;    // comisión simulada (0,1 %)
const SLIP = 0.0005;  // deslizamiento simulado (0,05 %)
const MAINT = 0.005;  // margen de mantenimiento aproximado
export const TF_MS = { "1m": 60e3, "5m": 3e5, "15m": 9e5, "1h": 36e5, "4h": 144e5, "1d": 864e5 };
const MAX_ERRORS = 5;

const timers = new Map();
const busy = new Set();
const ai = { client: null, model: "claude-sonnet-5-5" };
export function setAI(client, model) { ai.client = client; if (model) ai.model = model; }

const uid = () => randomBytes(5).toString("hex");
const num = (v, d, min = -Infinity, max = Infinity) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

export function credsFor(venueId) {
  const enc = data().keys[venueId];
  return enc ? decrypt(enc) : null;
}

function log(bot, msg, level = "info") {
  bot.log.unshift({ t: Date.now(), msg, level });
  if (bot.log.length > 80) bot.log.length = 80;
}

// ---------- Crear / validar ----------
export function normalizeBot(input, prev) {
  const venue = VENUES[input.venue] ? input.venue : "binance";
  const v = VENUES[venue];
  const market = input.market === "futures" && v.futures ? "futures" : "spot";
  const strategy = STRATEGIES[input.strategy] ? input.strategy : "trend";
  const leverage = market === "futures" ? Math.round(num(input.leverage, 3, 1, v.maxLev)) : 1;
  const capital = num(input.capital, 1000, 1);
  const bot = {
    id: prev?.id || uid(),
    name: String(input.name || "").trim().slice(0, 40) || `${strategy} ${input.symbol || ""}`.trim(),
    venue, market, strategy,
    symbol: String(input.symbol || `BTC/${v.quote}`).toUpperCase().replace(/\s/g, "").slice(0, 30),
    timeframe: TF_MS[input.timeframe] ? input.timeframe : "15m",
    direction: ["both", "long", "short"].includes(input.direction) ? input.direction : "both",
    capital, leverage,
    allocation: num(input.allocation, 50, 1, 100),   // % del saldo del bot por operación
    stopLoss: num(input.stopLoss, 2, 0.1, 90),       // % de movimiento del precio
    takeProfit: num(input.takeProfit, 4, 0.1, 500),
    maxDrawdown: num(input.maxDrawdown, 30, 1, 99),  // % del capital
    mode: input.mode === "live" ? "live" : "paper",
    grid: {
      lower: num(input.grid?.lower, 0, 0), upper: num(input.grid?.upper, 0, 0),
      levels: Math.round(num(input.grid?.levels, 10, 2, 100)),
    },
    dca: { every: Math.round(num(input.dca?.every, 4, 1, 500)), orders: Math.round(num(input.dca?.orders, 8, 1, 100)) },
    status: prev?.status || "stopped",
    state: prev?.state || { equity: capital, lots: [], lastCandle: 0, price: 0, prevPrice: 0, errors: 0, candleCount: 0 },
    stats: prev?.stats || { trades: 0, wins: 0, pnl: 0, fees: 0 },
    history: prev?.history || [],
    log: prev?.log || [],
    createdAt: prev?.createdAt || Date.now(),
  };
  if (bot.direction === "short" && market === "spot") bot.direction = "long";
  if (!prev) bot.state.equity = capital;
  return bot;
}

// ---------- Contabilidad ----------
const dir = (lot) => (lot.side === "long" ? 1 : -1);
const lotPnl = (lot, p) => dir(lot) * (p - lot.entry) * lot.qty;
const liqPrice = (side, entry, lev) => (lev <= 1 ? 0 : side === "long" ? entry * (1 - 1 / lev + MAINT) : entry * (1 + 1 / lev - MAINT));

export function view(bot) {
  const p = bot.state.price;
  const unreal = p ? bot.state.lots.reduce((s, l) => s + lotPnl(l, p), 0) : 0;
  const margin = bot.state.lots.reduce((s, l) => s + l.margin, 0);
  const { state, ...rest } = bot;
  return {
    ...rest,
    price: p,
    equity: state.equity,
    equityNow: state.equity + unreal,
    unrealized: unreal,
    roe: margin ? (unreal / margin) * 100 : 0,
    lots: state.lots,
    grid: { ...bot.grid },
    history: bot.history.slice(0, 30),
    log: bot.log.slice(0, 40),
    winRate: bot.stats.trades ? (bot.stats.wins / bot.stats.trades) * 100 : 0,
  };
}

function exchangeFor(bot) {
  if (bot.mode === "live") {
    const c = credsFor(bot.venue);
    if (!c?.apiKey) throw new Error(`Faltan las claves API de ${VENUES[bot.venue].name}`);
    return connect(bot.venue, bot.market, c);
  }
  return connect(bot.venue, bot.market);
}

// ---------- Órdenes ----------
async function openLot(bot, ex, side, price, margin, extra = {}) {
  const sym = marketSymbol(bot.symbol, bot.market);
  if (margin <= 0 || margin > bot.state.equity + 1e-9) { log(bot, "Saldo insuficiente para abrir posición", "warn"); return null; }
  let qty = (margin * bot.leverage) / price;
  let fill = price * (side === "long" ? 1 + SLIP : 1 - SLIP);
  let fee = margin * bot.leverage * FEE;
  if (bot.mode === "live") {
    await ex.loadMarkets();
    const amount = Number(ex.amountToPrecision(sym, qty));
    const min = ex.markets[sym]?.limits?.amount?.min || 0;
    if (!amount || amount < min) { log(bot, `Tamaño ${amount} menor que el mínimo del exchange (${min})`, "warn"); return null; }
    const params = {};
    if (bot.market === "futures" && ex.has?.createOrderWithTakeProfitAndStopLoss && bot.strategy !== "grid") {
      const sl = side === "long" ? price * (1 - bot.stopLoss / 100) : price * (1 + bot.stopLoss / 100);
      const tp = side === "long" ? price * (1 + bot.takeProfit / 100) : price * (1 - bot.takeProfit / 100);
      params.stopLoss = { triggerPrice: Number(ex.priceToPrecision(sym, sl)) };
      params.takeProfit = { triggerPrice: Number(ex.priceToPrecision(sym, tp)) };
    }
    const order = await ex.createOrder(sym, "market", side === "long" ? "buy" : "sell", amount, undefined, params);
    qty = order.filled || amount;
    fill = order.average || order.price || price;
    fee = order.fee?.cost && order.fee?.currency === VENUES[bot.venue].quote ? order.fee.cost : qty * fill * FEE;
  }
  const lot = { id: uid(), side, qty, entry: fill, margin, liq: bot.market === "futures" ? liqPrice(side, fill, bot.leverage) : 0, openedAt: Date.now(), ...extra };
  bot.state.equity -= fee;
  bot.stats.fees += fee;
  bot.state.lots.push(lot);
  log(bot, `${side === "long" ? "COMPRA/LARGO" : "VENTA/CORTO"} ${qty.toPrecision(5)} @ ${fill.toFixed(2)} · margen ${margin.toFixed(2)} · ${bot.leverage}x`, "trade");
  return lot;
}

async function closeLot(bot, ex, lot, price, reason) {
  const sym = marketSymbol(bot.symbol, bot.market);
  let fill = price * (lot.side === "long" ? 1 - SLIP : 1 + SLIP);
  let qty = lot.qty;
  if (bot.mode === "live" && reason !== "liquidación") {
    await ex.loadMarkets();
    const side = lot.side === "long" ? "sell" : "buy";
    const params = bot.market === "futures" ? { reduceOnly: true } : {};
    if (bot.market === "spot") {
      const base = sym.split("/")[0];
      const bal = await ex.fetchBalance();
      qty = Math.min(qty, bal[base]?.free ?? qty);
    }
    const amount = Number(ex.amountToPrecision(sym, qty));
    if (amount > 0) {
      const order = await ex.createOrder(sym, "market", side, amount, undefined, params);
      fill = order.average || order.price || price;
    }
    if (bot.market === "futures" && ex.has?.cancelAllOrders && bot.state.lots.length === 1) {
      try { await ex.cancelAllOrders(sym); } catch { /* sin órdenes pendientes */ }
    }
  }
  const fee = qty * fill * FEE;
  let pnl = dir(lot) * (fill - lot.entry) * qty - fee;
  if (reason === "liquidación") pnl = -lot.margin;
  bot.state.equity = Math.max(0, bot.state.equity + pnl);
  bot.state.lots = bot.state.lots.filter((l) => l.id !== lot.id);
  bot.stats.trades++;
  bot.stats.fees += fee;
  bot.stats.pnl += pnl;
  if (pnl > 0) bot.stats.wins++;
  bot.history.unshift({ side: lot.side, entry: lot.entry, exit: fill, qty, pnl, reason, openedAt: lot.openedAt, closedAt: Date.now() });
  if (bot.history.length > 200) bot.history.length = 200;
  log(bot, `CIERRE ${lot.side === "long" ? "largo" : "corto"} @ ${fill.toFixed(2)} · ${reason} · P&L ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`, pnl >= 0 ? "win" : "loss");
}

async function closeAll(bot, ex, price, reason) {
  for (const lot of [...bot.state.lots]) await closeLot(bot, ex, lot, price, reason);
}

// ---------- Ciclo ----------
export async function tick(bot) {
  if (busy.has(bot.id) || bot.status !== "running") return;
  busy.add(bot.id);
  try {
    const ex = exchangeFor(bot);
    const sym = marketSymbol(bot.symbol, bot.market);
    const cs = await candles(ex, sym, bot.timeframe, 250);
    if (cs.length < 30) throw new Error("No hay suficientes velas para este par");
    const price = cs.at(-1).c;
    const closed = cs.slice(0, -1);
    bot.state.prevPrice = bot.state.price || price;
    bot.state.price = price;

    await riskChecks(bot, ex, price);
    if (bot.status !== "running") return;

    const lastClosed = closed.at(-1).t;
    const newCandle = lastClosed !== bot.state.lastCandle;
    if (newCandle) { bot.state.lastCandle = lastClosed; bot.state.candleCount++; }

    if (bot.strategy === "grid") await gridStep(bot, ex, price);
    else if (bot.strategy === "dca") { if (newCandle) await dcaStep(bot, ex, closed, price); }
    else if (newCandle) await signalStep(bot, ex, closed, price);

    bot.state.errors = 0;
  } catch (err) {
    bot.state.errors++;
    log(bot, `Error: ${String(err?.message || err).slice(0, 200)}`, "error");
    if (bot.state.errors >= MAX_ERRORS) {
      bot.status = "error";
      log(bot, `Detenido tras ${MAX_ERRORS} errores seguidos`, "error");
      unschedule(bot.id);
    }
  } finally {
    busy.delete(bot.id);
    save();
  }
}

async function riskChecks(bot, ex, price) {
  for (const lot of [...bot.state.lots]) {
    if (bot.market === "futures" && bot.mode === "paper" && lot.liq && (lot.side === "long" ? price <= lot.liq : price >= lot.liq)) {
      await closeLot(bot, ex, lot, price, "liquidación");
      continue;
    }
    if (bot.strategy === "grid" || bot.strategy === "dca") continue;
    const move = (dir(lot) * (price - lot.entry)) / lot.entry * 100;
    if (move <= -bot.stopLoss) await closeLot(bot, ex, lot, price, "stop-loss");
    else if (move >= bot.takeProfit) await closeLot(bot, ex, lot, price, "take-profit");
  }
  const unreal = bot.state.lots.reduce((s, l) => s + lotPnl(l, price), 0);
  if (bot.state.equity + unreal <= bot.capital * (1 - bot.maxDrawdown / 100)) {
    await closeAll(bot, ex, price, "drawdown máximo");
    bot.status = "halted";
    unschedule(bot.id);
    log(bot, `Pérdida máxima (${bot.maxDrawdown}%) alcanzada: bot detenido para proteger tu capital`, "error");
  }
}

async function signalStep(bot, ex, closed, price) {
  const lot = bot.state.lots[0];
  let action;
  if (bot.strategy === "ai") action = await aiDecide(bot, closed, lot);
  else action = STRATEGIES[bot.strategy].decide(closed, lot);
  if (!action) return;
  if (action === "close") { if (lot) await closeLot(bot, ex, lot, price, "señal"); return; }
  if (lot && lot.side === action) return;
  if (lot) await closeLot(bot, ex, lot, price, "señal contraria");
  if (bot.direction !== "both" && bot.direction !== action) return;
  if (action === "short" && bot.market === "spot") return; // en spot no se puede vender en corto
  await openLot(bot, ex, action, price, bot.state.equity * (bot.allocation / 100));
}

function gridLevels(bot, price) {
  if (!(bot.grid.lower > 0 && bot.grid.upper > bot.grid.lower)) {
    // Rango automático: ±5 % alrededor del precio actual.
    bot.grid.lower = Number((price * 0.95).toPrecision(6));
    bot.grid.upper = Number((price * 1.05).toPrecision(6));
    log(bot, `Rango de grid automático: ${bot.grid.lower} – ${bot.grid.upper}`);
  }
  const step = (bot.grid.upper - bot.grid.lower) / bot.grid.levels;
  return { step, levels: Array.from({ length: bot.grid.levels }, (_, i) => bot.grid.lower + i * step) };
}

async function gridStep(bot, ex, price) {
  const { step, levels } = gridLevels(bot, price);
  const prev = bot.state.prevPrice;
  // Vender lotes que alcanzaron su objetivo (un nivel más arriba).
  for (const lot of [...bot.state.lots]) {
    if (price >= levels[lot.level] + step) await closeLot(bot, ex, lot, price, "grid +1 nivel");
  }
  // Stop-loss del grid: el precio cae bajo el rango más el margen de stop.
  if (price < bot.grid.lower * (1 - bot.stopLoss / 100)) {
    if (bot.state.lots.length) await closeAll(bot, ex, price, "stop-loss bajo el rango");
    return;
  }
  const perLevel = bot.capital / bot.grid.levels;
  for (let i = 0; i < levels.length; i++) {
    const L = levels[i];
    const crossed = prev > L && price <= L;
    if (crossed && !bot.state.lots.some((l) => l.level === i) && bot.state.equity >= perLevel) {
      await openLot(bot, ex, "long", price, perLevel, { level: i });
    }
  }
}

async function dcaStep(bot, ex, closed, price) {
  const lots = bot.state.lots;
  if (lots.length) {
    const qty = lots.reduce((s, l) => s + l.qty, 0);
    const avg = lots.reduce((s, l) => s + l.entry * l.qty, 0) / qty;
    if (price >= avg * (1 + bot.takeProfit / 100)) { await closeAll(bot, ex, price, "take-profit DCA"); bot.state.candleCount = 0; return; }
    if (price <= avg * (1 - bot.stopLoss / 100)) { await closeAll(bot, ex, price, "stop-loss DCA"); bot.state.candleCount = 0; return; }
  }
  const r = rsi(closed.map((c) => c.c)).at(-1);
  const due = lots.length === 0 || bot.state.candleCount >= bot.dca.every;
  if (!due || lots.length >= bot.dca.orders) return;
  const chunk = (bot.capital / bot.dca.orders) * (r < 30 ? 2 : 1);
  bot.state.candleCount = 0;
  await openLot(bot, ex, "long", price, Math.min(chunk, bot.state.equity * 0.98));
}

// ---------- IA (Claude) ----------
function parseJson(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  try { return m ? JSON.parse(m[0]) : null; } catch { return null; }
}

async function aiDecide(bot, closed, lot) {
  if (!ai.client || !process.env.ANTHROPIC_API_KEY) throw new Error("La estrategia IA necesita ANTHROPIC_API_KEY en el servidor");
  const snap = snapshot(closed);
  const recent = closed.slice(-20).map((c) => [c.o, c.h, c.l, c.c].map((n) => Number(n.toPrecision(6))));
  const res = await ai.client.messages.create({
    model: ai.model,
    max_tokens: 400,
    system: "Eres el motor de decisiones de un bot de trading algorítmico. Responde SOLO con un objeto JSON: {\"action\":\"long\"|\"short\"|\"close\"|\"hold\",\"confidence\":0-100,\"reason\":\"frase corta en español\"}. Sé conservador: si la señal no es clara, responde hold. Con apalancamiento alto exige más confirmación.",
    messages: [{
      role: "user",
      content: JSON.stringify({
        symbol: bot.symbol, market: bot.market, timeframe: bot.timeframe, leverage: bot.leverage,
        allowed: bot.market === "spot" ? ["long", "close", "hold"] : ["long", "short", "close", "hold"],
        position: lot ? { side: lot.side, entry: lot.entry, pnlPct: Number(((dir(lot) * (snap.price - lot.entry)) / lot.entry * 100).toFixed(2)) } : null,
        indicators: snap, last20ohlc: recent,
      }),
    }],
  });
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const d = parseJson(text);
  if (!d || !["long", "short", "close", "hold"].includes(d.action)) { log(bot, "IA: respuesta no válida, se mantiene"); return null; }
  log(bot, `IA → ${d.action.toUpperCase()} (${d.confidence ?? "?"}%) · ${String(d.reason || "").slice(0, 140)}`, "ai");
  if (d.action === "hold" || (d.confidence ?? 0) < 60) return null;
  return d.action;
}

export async function analyze({ venue, market, symbol, timeframe }) {
  const ex = connect(venue, market === "futures" ? "futures" : "spot");
  const cs = await candles(ex, marketSymbol(symbol, market), TF_MS[timeframe] ? timeframe : "1h", 250);
  const snap = snapshot(cs);
  if (!ai.client || !process.env.ANTHROPIC_API_KEY) return { snapshot: snap, text: "" };
  const res = await ai.client.messages.create({
    model: ai.model,
    max_tokens: 1200,
    system: "Eres NIKOLAI, analista cuantitativo de criptomonedas. Responde en español, conciso y con viñetas: tendencia, niveles clave (soporte/resistencia), escenario alcista y bajista, y un plan con entrada, stop-loss y take-profit. Señala el riesgo del apalancamiento. No prometas ganancias.",
    messages: [{ role: "user", content: `Analiza ${symbol} (${venue}, ${market}, velas ${timeframe}). Indicadores: ${JSON.stringify(snap)}` }],
  });
  return { snapshot: snap, text: res.content.filter((b) => b.type === "text").map((b) => b.text).join("") };
}

// ---------- Programación ----------
function unschedule(id) { clearTimeout(timers.get(id)); timers.delete(id); }

function schedule(bot) {
  unschedule(bot.id);
  const every = Math.min(60e3, Math.max(10e3, TF_MS[bot.timeframe] / 4));
  const loop = async () => {
    const b = data().bots.find((x) => x.id === bot.id);
    if (!b || b.status !== "running") return unschedule(bot.id);
    await tick(b);
    if (b.status === "running") timers.set(bot.id, setTimeout(loop, every));
  };
  timers.set(bot.id, setTimeout(loop, 50));
}

export async function startBot(bot) {
  if (bot.mode === "live") {
    const ex = exchangeFor(bot); // lanza error si faltan claves
    if (bot.market === "futures") {
      const sym = marketSymbol(bot.symbol, bot.market);
      try { await ex.setMarginMode?.("isolated", sym); } catch (e) { log(bot, `Aviso margen aislado: ${e.message?.slice(0, 120)}`, "warn"); }
      try { await ex.setLeverage?.(bot.leverage, sym); } catch (e) { log(bot, `Aviso apalancamiento: ${e.message?.slice(0, 120)}`, "warn"); }
    }
  }
  bot.state.errors = 0;
  bot.status = "running";
  log(bot, `Bot iniciado (${bot.mode === "live" ? "REAL" : "simulación"})`);
  save();
  schedule(bot);
}

export async function stopBot(bot, closePositions = false) {
  unschedule(bot.id);
  if (closePositions && bot.state.lots.length) {
    try {
      const ex = exchangeFor(bot);
      const price = bot.state.price || (await ex.fetchTicker(marketSymbol(bot.symbol, bot.market))).last;
      await closeAll(bot, ex, price, "cierre manual");
    } catch (err) { log(bot, `No se pudieron cerrar posiciones: ${err.message}`, "error"); }
  }
  bot.status = "stopped";
  log(bot, "Bot detenido");
  save();
}

export function resetBot(bot) {
  unschedule(bot.id);
  bot.status = "stopped";
  bot.state = { equity: bot.capital, lots: [], lastCandle: 0, price: 0, prevPrice: 0, errors: 0, candleCount: 0 };
  bot.stats = { trades: 0, wins: 0, pnl: 0, fees: 0 };
  bot.history = [];
  bot.log = [];
  log(bot, "Cuenta del bot reiniciada");
  save();
}

export async function panic() {
  for (const bot of data().bots) if (bot.status === "running" || bot.state.lots.length) await stopBot(bot, true);
  save(true);
}

export function resumeAll() {
  for (const bot of data().bots) if (bot.status === "running") schedule(bot);
}

// Bots preprogramados (en simulación) para empezar con un clic.
export function seedPresets() {
  const d = data();
  if (d.seeded) return;
  const presets = [
    { name: "BTC Tendencia 5x", venue: "binance", market: "futures", symbol: "BTC/USDT", timeframe: "15m", strategy: "trend", leverage: 5, capital: 1000, allocation: 50, stopLoss: 1.5, takeProfit: 3, maxDrawdown: 25 },
    { name: "ETH Ruptura 3x", venue: "bybit", market: "futures", symbol: "ETH/USDT", timeframe: "1h", strategy: "breakout", leverage: 3, capital: 1000, allocation: 50, stopLoss: 3, takeProfit: 6, maxDrawdown: 25 },
    { name: "BTC Grid Bitso", venue: "bitso", market: "spot", symbol: "BTC/MXN", timeframe: "5m", strategy: "grid", capital: 20000, stopLoss: 5, takeProfit: 5, maxDrawdown: 20, grid: { levels: 12 } },
    { name: "SOL Reversión RSI", venue: "kucoin", market: "spot", symbol: "SOL/USDT", timeframe: "15m", strategy: "rsi", capital: 1000, allocation: 60, stopLoss: 3, takeProfit: 4, maxDrawdown: 20 },
    { name: "BTC DCA Kraken", venue: "kraken", market: "spot", symbol: "BTC/USD", timeframe: "1h", strategy: "dca", capital: 1000, stopLoss: 12, takeProfit: 3, maxDrawdown: 30, dca: { every: 6, orders: 8 } },
    { name: "ETH MACD OKX 2x", venue: "okx", market: "futures", symbol: "ETH/USDT", timeframe: "1h", strategy: "macd", leverage: 2, capital: 1000, allocation: 50, stopLoss: 2.5, takeProfit: 5, maxDrawdown: 25 },
    { name: "IA NIKOLAI BTC 3x", venue: "binance", market: "futures", symbol: "BTC/USDT", timeframe: "1h", strategy: "ai", leverage: 3, capital: 1000, allocation: 40, stopLoss: 2, takeProfit: 4, maxDrawdown: 20 },
  ];
  d.bots.push(...presets.map((p) => normalizeBot({ ...p, mode: "paper" })));
  d.seeded = true;
  save(true);
}
