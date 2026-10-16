// Autotest del motor de NIKOLAI QUANT con un exchange falso (sin red).
// Uso: npm run test:quant
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

process.env.QUANT_DATA_DIR = mkdtempSync(path.join(tmpdir(), "nq-"));
process.env.QUANT_PASSWORD = "test-password";

const { setExchangeFactory } = await import("../quant/exchanges.js");
const { normalizeBot, tick, view, seedPresets, startBot, stopBot } = await import("../quant/engine.js");
const { data, encrypt, decrypt } = await import("../quant/store.js");
const { snapshot } = await import("../quant/indicators.js");

// Serie sintética: tendencia + ondas + ruido determinista.
function series(n, base = 100, shape = (i) => Math.sin(i / 9) * 6 + Math.sin(i / 2.7) * 1.5 + i * 0.02) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  return Array.from({ length: n }, (_, i) => {
    const c = base + shape(i) + rnd() * 0.8, o = c - rnd() * 0.6;
    return [i * 60e3, o, Math.max(o, c) + Math.abs(rnd()), Math.min(o, c) - Math.abs(rnd()), c, 10];
  });
}

class FakeExchange {
  constructor(id, opts, all) { this.id = id; this.opts = opts; this.all = all; this.i = 260; this.orders = []; this.markets = {}; this.has = { createOrderWithTakeProfitAndStopLoss: true, cancelAllOrders: true }; }
  async loadMarkets() { this.markets["BTC/USDT:USDT"] = this.markets["BTC/USDT"] = { limits: { amount: { min: 0.0001 } } }; }
  async fetchOHLCV(sym, tf, since, limit) { this.i = Math.min(this.i + 1, this.all.length); return this.all.slice(Math.max(0, this.i - limit), this.i); }
  amountToPrecision(_s, a) { return a.toFixed(6); }
  priceToPrecision(_s, p) { return p.toFixed(2); }
  async createOrder(symbol, type, side, amount, _p, params) { const px = this.all[this.i - 1][4]; this.orders.push({ symbol, type, side, amount, params }); return { filled: amount, average: px }; }
  async fetchBalance() { return { BTC: { free: 1 }, total: { USDT: 1000 }, free: { USDT: 1000 } }; }
  async cancelAllOrders() { this.cancelled = (this.cancelled || 0) + 1; }
  async setLeverage(l) { this.lev = l; }
  async setMarginMode(m) { this.mode = m; }
  async fetchTicker() { return { last: this.all[this.i - 1][4] }; }
}

let feed = series(900);
const made = [];
const fresh = () => setExchangeFactory((id, opts) => { const ex = new FakeExchange(id, opts, feed); made.push(ex); return ex; });

async function run(input, ticks = 500) {
  fresh();
  const bot = normalizeBot({ mode: "paper", ...input });
  bot.status = "running";
  data().bots.push(bot);
  for (let i = 0; i < ticks && bot.status === "running"; i++) await tick(bot);
  return bot;
}

// 1) Cifrado de claves
const enc = encrypt({ apiKey: "abc", secret: "xyz" });
assert.deepEqual(decrypt(enc), { apiKey: "abc", secret: "xyz" });
assert.ok(!enc.includes("xyz"));

// 2) Indicadores
const snap = snapshot(feed.slice(0, 300).map(([t, o, h, l, c, v]) => ({ t, o, h, l, c, v })));
assert.ok(snap.rsi14 > 0 && snap.rsi14 < 100, "RSI fuera de rango");

// 3) Estrategias en simulación
const results = {};
for (const strategy of ["trend", "rsi", "breakout", "macd"]) {
  const b = await run({ name: strategy, venue: "binance", market: "futures", symbol: "BTC/USDT", timeframe: "1m", strategy, leverage: 3, capital: 1000, allocation: 50, stopLoss: 2, takeProfit: 3, maxDrawdown: 50 }, 600);
  results[strategy] = b;
  assert.ok(b.stats.trades > 0, `${strategy}: no operó`);
  assert.ok(Number.isFinite(b.state.equity) && b.state.equity >= 0, `${strategy}: saldo inválido`);
}
feed = series(900, 100, (i) => Math.sin(i / 6) * 3);
const grid = await run({ name: "grid", venue: "bitso", market: "spot", symbol: "BTC/MXN", timeframe: "1m", strategy: "grid", capital: 1000, grid: { levels: 10 }, stopLoss: 20, maxDrawdown: 50 }, 600);
assert.ok(grid.stats.trades > 0 && grid.grid.lower > 0, "grid: no operó");
const dca = await run({ name: "dca", venue: "kraken", market: "spot", symbol: "BTC/USD", timeframe: "1m", strategy: "dca", capital: 1000, takeProfit: 2, stopLoss: 30, dca: { every: 3, orders: 5 }, maxDrawdown: 50 }, 600);
assert.ok(dca.stats.trades > 0, "dca: no operó");
assert.equal(normalizeBot({ venue: "bitso", market: "futures", leverage: 50 }).leverage, 1, "Bitso no debe permitir apalancamiento");
assert.equal(normalizeBot({ venue: "binance", market: "futures", leverage: 500 }).leverage, 125, "tope de apalancamiento");

// 4) Liquidación y drawdown con apalancamiento extremo en caída
feed = series(900, 100, (i) => -i * 0.15 + Math.sin(i / 3) * 2);
const rekt = await run({ name: "rekt", venue: "binance", market: "futures", symbol: "BTC/USDT", timeframe: "1m", strategy: "rsi", direction: "long", leverage: 100, capital: 100, allocation: 100, stopLoss: 50, takeProfit: 50, maxDrawdown: 30 }, 800);
assert.ok(rekt.history.some((h) => h.reason === "liquidación") || rekt.status === "halted", "debe liquidar o detenerse");

// 5) Modo real: órdenes con SL/TP adjuntos, reduceOnly al cerrar, apalancamiento aplicado
feed = series(900);
fresh();
data().keys.binance = encrypt({ apiKey: "k", secret: "s" });
const live = normalizeBot({ name: "live", venue: "binance", market: "futures", symbol: "BTC/USDT", timeframe: "1m", strategy: "trend", leverage: 5, capital: 200, allocation: 50, stopLoss: 1, takeProfit: 2, maxDrawdown: 50, mode: "live" });
data().bots.push(live);
await startBot(live);
await stopBot(live); // detiene el temporizador; ejecutamos los ciclos a mano
live.status = "running";
for (let i = 0; i < 400; i++) await tick(live);
const ex = made.find((e) => e.opts.apiKey === "k");
assert.equal(ex.lev, 5, "no aplicó el apalancamiento");
assert.ok(ex.orders.length > 0, "no envió órdenes reales");
assert.ok(ex.orders.some((o) => o.params.stopLoss?.triggerPrice), "falta SL adjunto");
assert.ok(ex.orders.some((o) => o.params.reduceOnly), "falta cierre reduceOnly");
await stopBot(live, true);
assert.equal(live.state.lots.length, 0, "no cerró posiciones al detener");

// 6) Presets
seedPresets();
assert.ok(data().bots.filter((b) => b.mode === "paper").length >= 7);

const fmt = (b) => `${b.stats.trades} ops · P&L ${b.stats.pnl.toFixed(2)} · saldo ${view(b).equityNow.toFixed(2)}`;
for (const [k, b] of Object.entries(results)) console.log(`  ✓ ${k.padEnd(9)} ${fmt(b)}`);
console.log(`  ✓ grid      ${fmt(grid)}`);
console.log(`  ✓ dca       ${fmt(dca)}`);
console.log(`  ✓ riesgo    100x → ${rekt.status === "halted" ? "detenido por drawdown" : "liquidado"}`);
console.log(`  ✓ real      ${ex.orders.length} órdenes enviadas (SL/TP adjuntos, reduceOnly)`);
console.log("\nNIKOLAI QUANT: autotest OK");
process.exit(0);
