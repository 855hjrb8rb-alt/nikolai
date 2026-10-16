// =====================================================================
// NIKOLAI QUANT — laboratorio profesional de bots de trading y minería
// - Panel/dashboard con KPIs de cartera y curva de capital.
// - Bots de trading con apalancamiento (1x…100x), estrategias, SL/TP,
//   varios exchanges y vista de detalle con GRÁFICA en vivo (entrada, SL,
//   TP y liquidación dibujados) + curva de equity + estadísticas pro.
// - Motor de simulación (paper) con precios EN VIVO de Binance (markets.js).
// - Herramientas: liquidación, tamaño por riesgo, R:R, comisiones/funding,
//   ROE y proyección de interés compuesto.
// - Bots de minería con estimador. Bóveda de claves API (solo localStorage).
// Seguridad: una web estática no firma órdenes reales sin exponer la clave;
// el motor opera en PAPEL y en modo "Real" genera la orden para ejecutarla tú.
// =====================================================================
import { market, connectLive, loadCoins, fmtMoney } from "./markets.js";

const KEY = "nikolai.quant";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
export const quant = Object.assign({ trade: [], mine: [], keys: {}, wallets: {}, tab: "dash", curve: [], view: null }, load());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(quant)); } catch { /* lleno */ } };

export const BRAND = "NIKOLAI QUANT";

const EXCHANGES = [
  { id: "binance", name: "Binance", sub: "Futuros · Spot", url: "https://www.binance.com", maxLev: 125 },
  { id: "kucoin", name: "KuCoin", sub: "Futuros · Spot", url: "https://www.kucoin.com", maxLev: 100 },
  { id: "bybit", name: "Bybit", sub: "Derivados", url: "https://www.bybit.com", maxLev: 100 },
  { id: "okx", name: "OKX", sub: "Derivados · Spot", url: "https://www.okx.com", maxLev: 100 },
  { id: "coinbase", name: "Coinbase", sub: "Spot (regulado EE. UU.)", url: "https://www.coinbase.com", maxLev: 1 },
  { id: "kraken", name: "Kraken", sub: "Spot · Futuros", url: "https://www.kraken.com", maxLev: 50 },
];
const STRATEGIES = ["grid", "dca", "scalping", "momentum", "reversion"];
const LEVERAGES = [1, 5, 10, 20, 30, 50, 75, 100];
const PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "AVAXUSDT"];
const POOLS = [
  { id: "nicehash", name: "NiceHash", sub: "Alquiler de hashrate", url: "https://www.nicehash.com" },
  { id: "unmineable", name: "unMineable", sub: "Mina con CPU/GPU → cualquier cripto", url: "https://unmineable.com" },
  { id: "kryptex", name: "Kryptex", sub: "Minería fácil (Windows)", url: "https://www.kryptex.org" },
  { id: "f2pool", name: "F2Pool", sub: "Pool global", url: "https://www.f2pool.com" },
  { id: "twominers", name: "2Miners", sub: "Pools PPLNS/SOLO", url: "https://2miners.com" },
  { id: "viabtc", name: "ViaBTC", sub: "Pool + nube", url: "https://www.viabtc.com" },
];
const MINE_COINS = [
  { id: "XMR", name: "Monero", unit: "kH/s", perUnit: 0.015 },
  { id: "RVN", name: "Ravencoin", unit: "MH/s", perUnit: 0.012 },
  { id: "ETC", name: "Ethereum Classic", unit: "MH/s", perUnit: 0.004 },
  { id: "KAS", name: "Kaspa", unit: "GH/s", perUnit: 0.09 },
  { id: "ERG", name: "Ergo", unit: "MH/s", perUnit: 0.01 },
  { id: "BTC", name: "Bitcoin (ASIC)", unit: "TH/s", perUnit: 0.05 },
];

const uid = () => Math.random().toString(36).slice(2, 8);
const usd = (v) => (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const pct = (v) => `${v >= 0 ? "+" : ""}${(v ?? 0).toFixed(2)}%`;
const priceNow = (pair) => market.live[pair]?.price || 0;
export const liqPrice = (entry, lev, long) => entry * (long ? 1 - 1 / lev : 1 + 1 / lev);
const slPrice = (b, entry) => entry * (b.side === "short" ? 1 + b.sl / 100 / b.lev : 1 - b.sl / 100 / b.lev);
const tpPrice = (b, entry) => entry * (b.side === "short" ? 1 - b.tp / 100 / b.lev : 1 + b.tp / 100 / b.lev);
const coinByPair = (pair) => market.coins.find((c) => c.pair === pair);
function priceSeries(pair) {
  let s = [];
  if (pair === "BTCUSDT" && market.btcSeries.length > 8) s = market.btcSeries.slice();
  else { const c = coinByPair(pair); if (c?.spark?.length) s = c.spark.slice(); }
  const live = priceNow(pair); if (s.length && live) s = s.concat(live);
  return s;
}

// ---------- Motor de simulación ----------
let engine = 0, ctxRef = null, bodyRef = null, liveCharts = [], chartROs = [];
function startEngine() { clearInterval(engine); connectLive(); engine = setInterval(tick, 1500); }
function tick() {
  let touched = false;
  for (const b of quant.trade) {
    if (!b.running) continue;
    const p = priceNow(b.pair); if (!p) continue;
    b.ref = b.ref ? b.ref * 0.96 + p * 0.04 : p;
    if (!b.pos) {
      const sig = signal(b, p);
      if (sig) { const margin = (b.equity * b.posPct) / 100; b.pos = { side: sig, entry: p, margin, liq: liqPrice(p, b.lev, sig > 0) }; }
    } else {
      const roe = b.pos.side * ((p - b.pos.entry) / b.pos.entry) * b.lev;
      const hitLiq = b.pos.side > 0 ? p <= b.pos.liq : p >= b.pos.liq;
      if (hitLiq) close(b, -1);
      else if (roe >= b.tp / 100) close(b, roe);
      else if (roe <= -b.sl / 100) close(b, roe);
    }
    b._k = (b._k || 0) + 1;
    if (b._k % 3 === 0) { const mark = markEquity(b, p); (b.curve = b.curve || []).push(Math.round(mark * 100) / 100); if (b.curve.length > 180) b.curve.shift(); }
    touched = true;
  }
  for (const m of quant.mine) { if (m.running) { m.earned = (m.earned || 0) + (estimateMining(m) / 86400) * 1.5; touched = true; } }
  if (touched) { samplePortfolio(); save(); patchLive(); liveCharts.forEach((d) => { try { d(); } catch { /* chart fuera */ } }); }
}
function markEquity(b, p) { if (!b.pos) return b.equity; const roe = b.pos.side * ((p - b.pos.entry) / b.pos.entry) * b.lev; return b.equity + b.pos.margin * roe; }
function signal(b, p) {
  const up = p > b.ref * 1.0006, down = p < b.ref * 0.9994;
  if (b.side === "long" && !up && !down) return 0;
  if (b.strategy === "grid" || b.strategy === "reversion") return down ? 1 : up ? -1 : 0;
  if (b.strategy === "dca") return 1;
  const dir = up ? 1 : down ? -1 : 0;
  if (b.side === "long") return dir > 0 ? 1 : 0;
  if (b.side === "short") return dir < 0 ? -1 : 0;
  return dir;
}
function close(b, roe) {
  const pnl = roe <= -1 ? -b.pos.margin : b.pos.margin * roe;
  b.equity = Math.max(0, b.equity + pnl);
  b.pnl = (b.pnl || 0) + pnl; b.trades = (b.trades || 0) + 1;
  if (pnl >= 0) { b.wins = (b.wins || 0) + 1; b.grossWin = (b.grossWin || 0) + pnl; } else { b.grossLoss = (b.grossLoss || 0) - pnl; }
  b.pos = null;
  if (b.equity <= 0) { b.running = false; b.blown = true; }
}
function samplePortfolio() {
  const eq = quant.trade.reduce((s, b) => s + markEquity(b, priceNow(b.pair)), 0);
  if (!quant.trade.length) return;
  quant._k = (quant._k || 0) + 1;
  if (quant._k % 3 === 0) { quant.curve.push(Math.round(eq * 100) / 100); if (quant.curve.length > 180) quant.curve.shift(); }
}
function estimateMining(m) { const coin = MINE_COINS.find((c) => c.id === m.coin) || MINE_COINS[0]; return (m.hashrate || 0) * coin.perUnit - ((m.power || 0) / 1000) * 24 * (m.cost || 0); }

function patchLive() {
  if (!bodyRef || !bodyRef.isConnected) { clearInterval(engine); return; }
  for (const b of quant.trade) {
    const card = bodyRef.querySelector(`[data-bot="${b.id}"]`); if (!card) continue;
    const p = priceNow(b.pair);
    const roe = b.pos ? b.pos.side * ((p - b.pos.entry) / b.pos.entry) * b.lev : 0;
    const uPnl = b.pos ? b.pos.margin * roe : 0;
    const set = (sel, txt, cls) => { const e = card.querySelector(sel); if (e) { e.textContent = txt; if (cls !== undefined) e.className = cls; } };
    set(".q-price", p ? usd(p) : "—");
    set(".q-equity", usd(b.equity));
    set(".q-upnl", (uPnl >= 0 ? "+" : "") + usd(uPnl), "q-upnl mono " + (uPnl >= 0 ? "up" : "down"));
    set(".q-posn", b.pos ? (b.pos.side > 0 ? "LONG" : "SHORT") + " @ " + usd(b.pos.entry) : ctxRef.t("q_flat"));
    const g = card.querySelector(".q-roe"); if (g) { g.textContent = b.pos ? (roe >= 0 ? "+" : "") + (roe * 100).toFixed(1) + "%" : ""; g.className = "q-roe mono " + (roe >= 0 ? "up" : "down"); }
  }
  for (const m of quant.mine) { const card = bodyRef.querySelector(`[data-mine="${m.id}"]`); if (card) { const e = card.querySelector(".q-earned"); if (e) e.textContent = usd(m.earned || 0); } }
  // KPIs del dashboard
  if (quant.tab === "dash") { const k = kpis(); const set = (id, v) => { const e = bodyRef.querySelector("#" + id); if (e) e.textContent = v; }; set("kpiEq", usd(k.equity)); set("kpiPnl", (k.pnl >= 0 ? "+" : "") + usd(k.pnl)); set("kpiRoi", pct(k.roi)); }
}

// ---------- Gráficas (canvas) ----------
function clearCharts() { chartROs.forEach((r) => r.disconnect()); chartROs = []; liveCharts = []; }
function registerChart(cv, drawFn) {
  if (!cv) return;
  drawFn();
  const ro = new ResizeObserver(() => drawFn()); ro.observe(cv.parentElement || cv); chartROs.push(ro);
  liveCharts.push(drawFn);
}
function plot(cv, series, opts = {}) {
  if (!cv || !cv.isConnected || !series || series.length < 2) return;
  const host = cv.parentElement, pad = Object.assign({ l: 6, r: 62, t: 10, b: 16 }, opts.pad || {});
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = host.clientWidth, H = host.clientHeight || 160;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const levels = opts.levels || [];
  const vals = series.concat(levels.map((l) => l.v));
  let lo = Math.min(...vals), hi = Math.max(...vals); const span = hi - lo || hi || 1; lo -= span * 0.08; hi += span * 0.08; const rng = hi - lo;
  const x0 = pad.l, x1 = W - pad.r, y0 = pad.t, y1 = H - pad.b;
  const X = (i) => x0 + (i / (series.length - 1)) * (x1 - x0);
  const Y = (v) => y1 - ((v - lo) / rng) * (y1 - y0);
  const up = opts.up != null ? opts.up : series[series.length - 1] >= series[0];
  const line = opts.color || (up ? "#2fd98a" : "#ff5a6a");
  g.fillStyle = "#0a0e14"; g.fillRect(0, 0, W, H);
  g.font = "10px ui-monospace, Menlo, monospace"; g.textBaseline = "middle"; g.lineWidth = 1;
  g.strokeStyle = "rgba(130,150,200,.10)"; g.fillStyle = "rgba(160,180,220,.6)"; g.textAlign = "left";
  for (let i = 0; i <= 3; i++) { const v = hi - (i / 3) * rng, y = Y(v); g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); if (opts.labels !== false) g.fillText(fmtMoney(v), x1 + 5, y); }
  // área + línea
  g.beginPath(); g.moveTo(X(0), Y(series[0])); for (let i = 1; i < series.length; i++) g.lineTo(X(i), Y(series[i]));
  g.lineTo(X(series.length - 1), y1); g.lineTo(X(0), y1); g.closePath();
  const grad = g.createLinearGradient(0, y0, 0, y1); grad.addColorStop(0, hexA(line, .22)); grad.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = grad; g.fill();
  g.beginPath(); g.moveTo(X(0), Y(series[0])); for (let i = 1; i < series.length; i++) g.lineTo(X(i), Y(series[i]));
  g.shadowColor = line; g.shadowBlur = 5; g.strokeStyle = line; g.lineWidth = 1.6; g.stroke(); g.shadowBlur = 0;
  // niveles (entrada/SL/TP/liq)
  for (const lv of levels) {
    const y = Y(lv.v); g.setLineDash([4, 3]); g.strokeStyle = lv.color; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); g.setLineDash([]);
    g.fillStyle = lv.color; g.fillRect(x1, y - 7, pad.r, 14); g.fillStyle = "#06080c"; g.textAlign = "center"; g.font = "bold 9px ui-monospace, monospace";
    g.fillText(lv.tag || fmtMoney(lv.v), x1 + pad.r / 2, y); g.font = "10px ui-monospace, monospace"; g.textAlign = "left";
  }
  // último precio
  const last = series[series.length - 1], ly = Y(last);
  g.fillStyle = line; g.fillRect(x1, ly - 7, pad.r, 14); g.fillStyle = "#06080c"; g.textAlign = "center"; g.font = "bold 9px ui-monospace, monospace"; g.fillText(fmtMoney(last), x1 + pad.r / 2, ly);
}
function hexA(hex, a) { const m = hex.replace("#", ""); const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

// ---------- Resumen para la tarjeta del panel ----------
export function botsSummary() {
  const active = quant.trade.filter((b) => b.running).length + quant.mine.filter((m) => m.running).length;
  const pnl = quant.trade.reduce((s, b) => s + (b.pnl || 0), 0);
  return { active, total: quant.trade.length + quant.mine.length, pnl };
}
function kpis() {
  const eq = quant.trade.reduce((s, b) => s + markEquity(b, priceNow(b.pair)), 0);
  const invested = quant.trade.reduce((s, b) => s + (b.capital || 0), 0);
  const pnl = quant.trade.reduce((s, b) => s + (b.pnl || 0), 0);
  const trades = quant.trade.reduce((s, b) => s + (b.trades || 0), 0);
  const wins = quant.trade.reduce((s, b) => s + (b.wins || 0), 0);
  const gw = quant.trade.reduce((s, b) => s + (b.grossWin || 0), 0);
  const gl = quant.trade.reduce((s, b) => s + (b.grossLoss || 0), 0);
  return { equity: eq, invested, pnl, roi: invested ? (pnl / invested) * 100 : 0, trades, win: trades ? (wins / trades) * 100 : 0, pf: gl ? gw / gl : gw ? Infinity : 0, active: quant.trade.filter((b) => b.running).length };
}

// ---------- Render principal ----------
export function renderBots(body, ctx) {
  const { t, esc } = ctx;
  ctxRef = ctx; bodyRef = body; clearCharts();
  const tabs = [["dash", "q_tabDash"], ["trade", "q_tabTrade"], ["mine", "q_tabMine"], ["tools", "q_tabTools"], ["keys", "q_tabKeys"]];
  body.innerHTML = `
    <div class="q-brand"><b>${BRAND}</b><span class="mono">${esc(t("q_tagline"))}</span></div>
    <div class="q-tabs">${tabs.map(([id, k]) => `<button class="q-tab ${quant.tab === id ? "on" : ""}" data-target data-qtab="${id}">${esc(t(k))}</button>`).join("")}</div>
    <div class="q-body"></div>`;
  body.querySelectorAll("[data-qtab]").forEach((b) => b.addEventListener("click", () => { quant.tab = b.dataset.qtab; quant.view = null; save(); renderBots(body, ctx); }));
  const host = body.querySelector(".q-body");
  if (quant.tab === "trade" && quant.view) return detailView(host, ctx);
  ({ dash: dashTab, trade: tradeTab, mine: mineTab, tools: toolsTab, keys: keysTab }[quant.tab] || dashTab)(host, ctx);
  startEngine();
}

// ---------- Dashboard ----------
function dashTab(host, ctx) {
  const { t, esc } = ctx;
  const k = kpis();
  const kpi = (id, label, val, cls) => `<div class="q-kpi"><span>${esc(label)}</span><b id="${id}" class="${cls || ""}">${val}</b></div>`;
  host.innerHTML = `
    <div class="q-kpis">
      ${kpi("kpiEq", t("q_k_equity"), usd(k.equity))}
      ${kpi("kpiPnl", t("q_k_pnl"), (k.pnl >= 0 ? "+" : "") + usd(k.pnl), k.pnl >= 0 ? "up" : "down")}
      ${kpi("kpiRoi", t("q_k_roi"), pct(k.roi), k.roi >= 0 ? "up" : "down")}
      ${kpi("kpiAct", t("q_k_active"), `${k.active}/${quant.trade.length}`)}
      ${kpi("kpiWin", t("q_k_win"), k.trades ? Math.round(k.win) + "%" : "—")}
      ${kpi("kpiPf", t("q_k_pf"), k.pf === Infinity ? "∞" : k.pf ? k.pf.toFixed(2) : "—")}
    </div>
    <div class="q-fcard"><div class="q-ph">${esc(t("q_equityCurve"))}</div><div class="q-chart" style="height:200px"><canvas id="qCurve"></canvas></div></div>
    <div class="q-fcard"><div class="q-ph">${esc(t("q_alloc"))}</div><div class="q-alloc">${allocHtml(ctx)}</div></div>
    <button class="tile action" data-target data-goto="trade"><span class="t-main">${esc(t("q_manageBots"))}</span></button>`;
  host.querySelector("[data-goto]").addEventListener("click", () => { quant.tab = "trade"; save(); renderBots(bodyRef, ctx); });
  const cv = host.querySelector("#qCurve");
  registerChart(cv, () => plot(cv, quant.curve.length > 2 ? quant.curve : [k.equity, k.equity], { color: "#5cc8ff" }));
  startEngine();
}
function allocHtml(ctx) {
  const { esc } = ctx;
  if (!quant.trade.length) return `<p class="muted">${esc(ctx.t("q_noBots"))}</p>`;
  const tot = quant.trade.reduce((s, b) => s + b.equity, 0) || 1;
  return quant.trade.map((b) => { const w = (b.equity / tot) * 100; return `<div class="q-arow"><span class="q-aname">${esc(b.name)}</span><div class="q-abar"><i style="width:${w}%"></i></div><span class="mono">${usd(b.equity)}</span></div>`; }).join("");
}

// ---------- Pestaña trading ----------
function tradeTab(host, ctx) {
  const { t, esc } = ctx;
  host.innerHTML = `
    <div class="q-list">${quant.trade.length ? quant.trade.map((b) => tradeCard(b, ctx)).join("") : `<p class="muted">${esc(t("q_noBots"))}</p>`}</div>
    <button class="tile action" data-target data-newbot><span class="t-main">+ ${esc(t("q_newBot"))}</span></button>
    <div class="q-form" hidden></div>`;
  host.querySelector("[data-newbot]").addEventListener("click", () => openBotForm(host, ctx));
  host.querySelectorAll("[data-open]").forEach((c) => c.addEventListener("click", (e) => { if (e.target.closest("[data-stop]")) return; quant.view = c.dataset.open; save(); renderBots(bodyRef, ctx); }));
  host.querySelectorAll("[data-stop]").forEach((btn) => btn.addEventListener("click", (e) => { e.stopPropagation(); const b = quant.trade.find((x) => x.id === btn.dataset.stop); if (b.blown) { b.blown = false; b.equity = b.capital; b.pnl = 0; b.trades = 0; b.wins = 0; b.pos = null; b.curve = [b.capital]; } b.running = !b.running; save(); renderBots(bodyRef, ctx); }));
  startEngine();
}
function tradeCard(b, ctx) {
  const { t, esc } = ctx;
  const ex = EXCHANGES.find((e) => e.id === b.exchange) || EXCHANGES[0];
  const wr = b.trades ? Math.round(((b.wins || 0) / b.trades) * 100) : 0;
  return `<div class="q-card ${b.running ? "live" : ""} ${b.blown ? "blown" : ""}" data-bot="${b.id}" data-open="${b.id}">
    <div class="q-card-top"><div><b>${esc(b.name)}</b><small class="mono">${esc(ex.name)} · ${esc(b.pair)}</small></div><span class="q-lev ${b.lev >= 50 ? "hot" : ""}">${b.lev}x</span></div>
    <div class="q-tags mono"><span class="q-chip ${b.side}">${esc(t("q_" + b.side))}</span><span class="q-chip">${esc(t("q_s_" + b.strategy))}</span><span class="q-chip">${esc(b.mode === "real" ? t("q_modeReal") : t("q_modePaper"))}</span></div>
    <div class="q-stats">
      <div><span>${esc(t("q_price"))}</span><b class="q-price mono">—</b></div>
      <div><span>${esc(t("q_equity"))}</span><b class="q-equity mono">${usd(b.equity)}</b></div>
      <div><span>${esc(t("q_upnl"))}</span><b class="q-upnl mono">$0.00</b></div>
    </div>
    <div class="q-pos mono"><span class="q-posn">${esc(t("q_flat"))}</span> <span class="q-roe mono"></span></div>
    <div class="q-mini mono">${esc(t("q_realPnl"))}: <span class="${(b.pnl || 0) >= 0 ? "up" : "down"}">${(b.pnl || 0) >= 0 ? "+" : ""}${usd(b.pnl || 0)}</span> · ${esc(t("q_win"))}: ${wr}% · ${esc(t("q_openDetail"))} ▸</div>
    <div class="q-row"><button class="nw-mini ${b.running ? "on" : ""}" data-target data-stop="${b.id}">${esc(b.running ? t("q_pause") : t("q_start"))}</button></div>
    ${b.blown ? `<p class="q-warn mono">${esc(t("q_blown"))}</p>` : ""}</div>`;
}

// ---------- Vista de detalle (profesional, con gráfica) ----------
function detailView(host, ctx) {
  const { t, esc } = ctx;
  const b = quant.trade.find((x) => x.id === quant.view);
  if (!b) { quant.view = null; return tradeTab(host, ctx); }
  const ex = EXCHANGES.find((e) => e.id === b.exchange) || EXCHANGES[0];
  const p = priceNow(b.pair) || (coinByPair(b.pair)?.price) || 0;
  const entry = b.pos ? b.pos.entry : p;
  const rr = (b.tp / b.sl) || 0;
  const liqDist = p ? Math.abs((liqPrice(entry, b.lev, b.side !== "short") - p) / p) * 100 : 100 / b.lev;
  const wr = b.trades ? Math.round(((b.wins || 0) / b.trades) * 100) : 0;
  const pf = b.grossLoss ? (b.grossWin || 0) / b.grossLoss : (b.grossWin ? Infinity : 0);
  const dd = maxDD(b.curve);
  host.innerHTML = `
    <div class="q-detail-top"><button class="nw-mini" data-target data-back>‹ ${esc(t("q_back"))}</button>
      <b>${esc(b.name)}</b><span class="mono muted">${esc(ex.name)} · ${esc(b.pair)}</span><span class="q-lev ${b.lev >= 50 ? "hot" : ""}">${b.lev}x</span></div>
    <div class="q-fcard"><div class="q-ph">${esc(b.pair)} · ${esc(t("q_chart"))} <span class="q-legend"><i class="e"></i>${esc(t("q_entry"))} <i class="t"></i>TP <i class="s"></i>SL <i class="l"></i>LIQ</span></div>
      <div class="q-chart" style="height:260px"><canvas id="qPx"></canvas></div></div>
    <div class="q-two">
      <div class="q-fcard"><div class="q-ph">${esc(t("q_position"))}</div><div class="q-pgrid mono" id="qPosBox"></div></div>
      <div class="q-fcard"><div class="q-ph">${esc(t("q_equityCurve"))}</div><div class="q-chart" style="height:170px"><canvas id="qEq"></canvas></div></div>
    </div>
    <div class="q-fcard"><div class="q-ph">${esc(t("q_stats"))}</div><div class="q-sgrid mono">
      ${sCell(t("q_equity"), usd(b.equity))}${sCell(t("q_realPnl"), (b.pnl || 0 >= 0 ? "+" : "") + usd(b.pnl || 0), (b.pnl || 0) >= 0 ? "up" : "down")}
      ${sCell("ROI", pct(b.capital ? ((b.pnl || 0) / b.capital) * 100 : 0))}${sCell(t("q_trades"), String(b.trades || 0))}
      ${sCell(t("q_win"), wr + "%")}${sCell(t("q_pf"), pf === Infinity ? "∞" : pf ? pf.toFixed(2) : "—")}
      ${sCell(t("q_maxdd"), pct(-dd))}${sCell("R:R", rr ? "1:" + rr.toFixed(1) : "—")}
      ${sCell(t("q_liqDist"), liqDist.toFixed(2) + "%")}${sCell(t("q_mode"), b.mode === "real" ? t("q_modeReal") : t("q_modePaper"))}
    </div></div>
    <div class="q-fcard"><div class="q-ph">DES · NIKOLAI</div><div class="q-ai mono" id="qAi"><button class="nw-mini" data-target data-signal>▸ ${esc(t("q_aiSignal"))}</button></div></div>
    <div class="q-row q-detail-actions">
      <button class="tile action" data-target data-stop><span class="t-main">${esc(b.running ? t("q_pause") : t("q_start"))}</span></button>
      <button class="nw-mini" data-target data-order>${esc(t("q_order"))}</button>
      <button class="nw-mini" data-target data-edit>${esc(t("q_edit"))}</button>
      <button class="nw-mini" data-target data-del>${esc(t("q_delete"))}</button>
    </div>
    <div class="q-form" hidden></div>`;
  // Gráfica de precio con niveles
  const pxcv = host.querySelector("#qPx");
  registerChart(pxcv, () => {
    const s = priceSeries(b.pair); if (s.length < 2) return;
    const e = b.pos ? b.pos.entry : s[s.length - 1];
    const levels = [{ v: e, color: "#e0c060", tag: "ENT" }, { v: tpPrice(b, e), color: "#2fd98a", tag: "TP" }, { v: slPrice(b, e), color: "#ff5a6a", tag: "SL" }, { v: liqPrice(e, b.lev, b.side !== "short"), color: "#c06cff", tag: "LIQ" }];
    plot(pxcv, s, { levels });
  });
  const eqcv = host.querySelector("#qEq");
  registerChart(eqcv, () => plot(eqcv, (b.curve && b.curve.length > 2) ? b.curve : [b.capital, b.equity], { color: "#5cc8ff" }));
  const paintPos = () => {
    const box = host.querySelector("#qPosBox"); if (!box) return;
    const pr = priceNow(b.pair);
    const roe = b.pos ? b.pos.side * ((pr - b.pos.entry) / b.pos.entry) * b.lev : 0;
    const uPnl = b.pos ? b.pos.margin * roe : 0;
    box.innerHTML = b.pos
      ? `${sCell(t("q_side"), b.pos.side > 0 ? "LONG" : "SHORT", b.pos.side > 0 ? "up" : "down")}${sCell(t("q_entry"), usd(b.pos.entry))}${sCell(t("q_price"), usd(pr))}${sCell(t("q_margin"), usd(b.pos.margin))}${sCell(t("q_upnl"), (uPnl >= 0 ? "+" : "") + usd(uPnl), uPnl >= 0 ? "up" : "down")}${sCell("ROE", (roe >= 0 ? "+" : "") + (roe * 100).toFixed(1) + "%", roe >= 0 ? "up" : "down")}`
      : `<div class="q-flatbox">${esc(t("q_flat"))} · ${esc(t("q_price"))} ${usd(pr)}</div>`;
  };
  paintPos(); liveCharts.push(paintPos);
  host.querySelector("[data-back]").addEventListener("click", () => { quant.view = null; save(); renderBots(bodyRef, ctx); });
  host.querySelector("[data-stop]").addEventListener("click", () => { if (b.blown) { b.blown = false; b.equity = b.capital; b.pnl = 0; b.trades = 0; b.wins = 0; b.pos = null; b.curve = [b.capital]; } b.running = !b.running; save(); renderBots(bodyRef, ctx); });
  host.querySelector("[data-del]").addEventListener("click", () => { quant.trade = quant.trade.filter((x) => x.id !== b.id); quant.view = null; save(); renderBots(bodyRef, ctx); });
  host.querySelector("[data-edit]").addEventListener("click", () => openBotForm(host, ctx, b));
  host.querySelector("[data-order]").addEventListener("click", () => showOrder(b, host, ctx));
  host.querySelector("[data-signal]").addEventListener("click", () => aiSignal(b, host.querySelector("#qAi"), ctx));
  startEngine();
}
function sCell(label, val, cls) { return `<div class="q-scell"><span>${ctxRef.esc(label)}</span><b class="${cls || ""}">${ctxRef.esc(val)}</b></div>`; }
function maxDD(curve) { if (!curve || curve.length < 2) return 0; let peak = curve[0], dd = 0; for (const v of curve) { if (v > peak) peak = v; dd = Math.max(dd, (peak - v) / peak); } return dd * 100; }

function openBotForm(host, ctx, edit) {
  const { t, esc } = ctx;
  const box = host.querySelector(".q-form");
  const d = edit || { name: "", exchange: "binance", pair: "BTCUSDT", side: "both", strategy: "momentum", lev: 10, capital: 1000, posPct: 10, sl: 20, tp: 40, mode: "paper" };
  box.hidden = false;
  box.innerHTML = `<div class="q-fcard">
      <label>${esc(t("q_name"))}<input class="q-in" data-f="name" value="${esc(d.name)}" placeholder="Mi bot BTC"></label>
      <label>${esc(t("q_exchange"))}<select class="q-in" data-f="exchange">${EXCHANGES.map((e) => `<option value="${e.id}" ${d.exchange === e.id ? "selected" : ""}>${e.name} · ${esc(e.sub)}</option>`).join("")}</select></label>
      <label>${esc(t("q_pair"))}<select class="q-in" data-f="pair">${PAIRS.map((p) => `<option ${d.pair === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>
      <label>${esc(t("q_dir"))}<select class="q-in" data-f="side">${["both", "long", "short"].map((s) => `<option value="${s}" ${d.side === s ? "selected" : ""}>${esc(t("q_" + s))}</option>`).join("")}</select></label>
      <label>${esc(t("q_strategy"))}<select class="q-in" data-f="strategy">${STRATEGIES.map((s) => `<option value="${s}" ${d.strategy === s ? "selected" : ""}>${esc(t("q_s_" + s))}</option>`).join("")}</select></label>
      <div class="q-lev-pick"><span>${esc(t("q_leverage"))}</span><div class="q-levs">${LEVERAGES.map((l) => `<button type="button" class="q-levbtn ${d.lev === l ? "on" : ""} ${l >= 50 ? "hot" : ""}" data-lev="${l}">${l}x</button>`).join("")}</div></div>
      <div class="q-two"><label>${esc(t("q_capital"))} (USDT)<input class="q-in" type="number" data-f="capital" value="${d.capital}" min="10"></label><label>${esc(t("q_posPct"))}<input class="q-in" type="number" data-f="posPct" value="${d.posPct}" min="1" max="100"></label></div>
      <div class="q-two"><label>${esc(t("q_sl"))}<input class="q-in" type="number" data-f="sl" value="${d.sl}" min="1"></label><label>${esc(t("q_tp"))}<input class="q-in" type="number" data-f="tp" value="${d.tp}" min="1"></label></div>
      <label>${esc(t("q_mode"))}<select class="q-in" data-f="mode"><option value="paper" ${d.mode === "paper" ? "selected" : ""}>${esc(t("q_modePaper"))}</option><option value="real" ${d.mode === "real" ? "selected" : ""}>${esc(t("q_modeReal"))}</option></select></label>
      <p class="q-liqnote mono"></p>
      <div class="q-row"><button class="tile action" data-target data-savebot><span class="t-main">${esc(t("q_save"))}</span></button><button class="nw-mini" data-target data-cancelbot>${esc(t("q_cancel"))}</button></div>
      <p class="q-risk mono">${esc(t("q_riskNote"))}</p></div>`;
  let lev = d.lev;
  const liqNote = () => { const pair = box.querySelector('[data-f="pair"]').value; const p = priceNow(pair) || (coinByPair(pair)?.price) || 0; const el = box.querySelector(".q-liqnote"); el.innerHTML = p ? `${esc(t("q_liqAt"))}: <b>${usd(liqPrice(p, lev, true))}</b> (long) · <b>${usd(liqPrice(p, lev, false))}</b> (short) · −${(100 / lev).toFixed(1)}% ${esc(t("q_liqMove"))}` : t("q_liqWait"); };
  box.querySelectorAll(".q-levbtn").forEach((btn) => btn.addEventListener("click", () => { lev = Number(btn.dataset.lev); box.querySelectorAll(".q-levbtn").forEach((x) => x.classList.toggle("on", x === btn)); liqNote(); }));
  box.querySelector('[data-f="pair"]').addEventListener("change", liqNote); liqNote();
  box.querySelector("[data-cancelbot]").addEventListener("click", () => { box.hidden = true; box.innerHTML = ""; });
  box.querySelector("[data-savebot]").addEventListener("click", () => {
    const g = (f) => box.querySelector(`[data-f="${f}"]`).value;
    const cap = Math.max(10, +g("capital") || 1000);
    const b = { id: edit?.id || uid(), name: g("name").trim() || `${g("pair")} ${lev}x`, exchange: g("exchange"), pair: g("pair"), side: g("side"), strategy: g("strategy"), lev, capital: cap, posPct: Math.min(100, Math.max(1, +g("posPct") || 10)), sl: Math.max(1, +g("sl") || 20), tp: Math.max(1, +g("tp") || 40), mode: g("mode"), running: edit?.running || false, equity: edit?.equity ?? cap, pnl: edit?.pnl || 0, trades: edit?.trades || 0, wins: edit?.wins || 0, grossWin: edit?.grossWin || 0, grossLoss: edit?.grossLoss || 0, pos: edit?.pos || null, curve: edit?.curve || [cap] };
    if (edit) Object.assign(quant.trade.find((x) => x.id === edit.id), b); else quant.trade.push(b);
    save(); renderBots(bodyRef, ctx);
  });
}

async function aiSignal(b, out, ctx) {
  out.hidden = false; out.textContent = ctx.t("q_thinking");
  const p = priceNow(b.pair);
  const msg = ctx.t("q_signalPrompt").replace("{pair}", b.pair).replace("{price}", p ? usd(p) : "?").replace("{lev}", b.lev).replace("{strat}", ctx.t("q_s_" + b.strategy));
  let full = "";
  try { await ctx.stream({ messages: [{ role: "user", content: msg }], mode: "market", channel: "text", symbol: b.pair }, { onText: (d) => { full += d; out.textContent = full; } }); if (!full) out.textContent = ctx.t("errGeneric"); } catch { out.textContent = ctx.t("errGeneric"); }
}
function showOrder(b, host, ctx) {
  const { t, esc } = ctx;
  const ex = EXCHANGES.find((e) => e.id === b.exchange) || EXCHANGES[0];
  const p = priceNow(b.pair) || 0, margin = (b.equity * b.posPct) / 100, notional = margin * b.lev, qty = p ? notional / p : 0;
  const side = b.side === "short" ? "SELL / SHORT" : "BUY / LONG";
  const box = host.querySelector(".q-form"); box.hidden = false;
  box.innerHTML = `<div class="q-fcard"><div class="q-order">
    <b>${esc(t("q_orderTicket"))} · ${esc(ex.name)}</b>
    <div>${esc(t("q_pair"))}: <b>${esc(b.pair)}</b> · ${side}</div>
    <div>${esc(t("q_leverage"))}: <b>${b.lev}x</b> · ${esc(t("q_margin"))}: <b>${usd(margin)}</b></div>
    <div>${esc(t("q_size"))}: <b>${qty.toFixed(5)}</b> (${usd(notional)})</div>
    <div>SL: <b>${usd(slPrice(b, p))}</b> · TP: <b>${usd(tpPrice(b, p))}</b></div>
    <div>${esc(t("q_liqAt"))}: <b class="down">${usd(liqPrice(p, b.lev, b.side !== "short"))}</b></div>
    <a class="nw-mini" href="${ex.url}" target="_blank" rel="noopener">${esc(t("q_openExchange"))} ↗</a>
    <p class="q-risk mono">${esc(t("q_orderNote"))}</p></div></div>`;
}

// ---------- Minería ----------
function mineTab(host, ctx) {
  const { t, esc } = ctx;
  host.innerHTML = `<div class="q-list">${quant.mine.length ? quant.mine.map((m) => mineCard(m, ctx)).join("") : `<p class="muted">${esc(t("q_noMine"))}</p>`}</div>
    <button class="tile action" data-target data-newmine><span class="t-main">+ ${esc(t("q_newMine"))}</span></button><div class="q-form" hidden></div>`;
  host.querySelector("[data-newmine]").addEventListener("click", () => openMineForm(host, ctx));
  host.querySelectorAll("[data-togglem]").forEach((btn) => btn.addEventListener("click", () => { const m = quant.mine.find((x) => x.id === btn.dataset.togglem); m.running = !m.running; save(); renderBots(bodyRef, ctx); }));
  host.querySelectorAll("[data-delmine]").forEach((btn) => btn.addEventListener("click", () => { quant.mine = quant.mine.filter((x) => x.id !== btn.dataset.delmine); save(); renderBots(bodyRef, ctx); }));
  startEngine();
}
function mineCard(m, ctx) {
  const { t, esc } = ctx;
  const pool = POOLS.find((p) => p.id === m.pool) || POOLS[0], coin = MINE_COINS.find((c) => c.id === m.coin) || MINE_COINS[0];
  const day = estimateMining(m), be = m.cost ? ((m.power || 0) / 1000) * 24 * m.cost : 0;
  return `<div class="q-card ${m.running ? "live" : ""}" data-mine="${m.id}">
    <div class="q-card-top"><div><b>${esc(m.name)}</b><small class="mono">${esc(pool.name)} · ${esc(coin.name)}</small></div><span class="q-lev">${esc(coin.id)}</span></div>
    <div class="q-stats"><div><span>${esc(t("q_hashrate"))}</span><b class="mono">${m.hashrate} ${esc(coin.unit)}</b></div><div><span>${esc(t("q_estDay"))}</span><b class="mono ${day >= 0 ? "up" : "down"}">${usd(day)}</b></div><div><span>${esc(t("q_earned"))}</span><b class="q-earned mono">${usd(m.earned || 0)}</b></div></div>
    <div class="q-mini mono">${esc(t("q_estMonth"))}: ${usd(day * 30)} · ${esc(t("q_power"))}: ${m.power}W · ${esc(t("q_cost"))}: $${m.cost}/kWh · ${esc(t("q_breakeven"))}: ${usd(be)}/d</div>
    <div class="q-row"><button class="nw-mini ${m.running ? "on" : ""}" data-target data-togglem="${m.id}">${esc(m.running ? t("q_pause") : t("q_start"))}</button><a class="nw-mini" href="${pool.url}" target="_blank" rel="noopener">${esc(pool.name)} ↗</a><button class="nw-mini" data-target data-delmine="${m.id}">${esc(t("q_delete"))}</button></div>
    <p class="q-risk mono">${esc(t("q_mineNote"))}</p></div>`;
}
function openMineForm(host, ctx) {
  const { t, esc } = ctx;
  const box = host.querySelector(".q-form"); box.hidden = false;
  box.innerHTML = `<div class="q-fcard">
    <label>${esc(t("q_name"))}<input class="q-in" data-f="name" placeholder="Rig 1"></label>
    <label>${esc(t("q_pool"))}<select class="q-in" data-f="pool">${POOLS.map((p) => `<option value="${p.id}">${p.name} · ${esc(p.sub)}</option>`).join("")}</select></label>
    <label>${esc(t("q_coin"))}<select class="q-in" data-f="coin">${MINE_COINS.map((c) => `<option value="${c.id}">${c.name} (${c.unit})</option>`).join("")}</select></label>
    <div class="q-two"><label>${esc(t("q_hashrate"))}<input class="q-in" type="number" data-f="hashrate" value="100" min="0"></label><label>${esc(t("q_powerW"))}<input class="q-in" type="number" data-f="power" value="300" min="0"></label></div>
    <label>${esc(t("q_costKwh"))} (USD)<input class="q-in" type="number" step="0.01" data-f="cost" value="0.10" min="0"></label>
    <label>${esc(t("q_wallet"))}<input class="q-in" data-f="wallet" placeholder="${esc(t("q_walletPh"))}"></label>
    <div class="q-row"><button class="tile action" data-target data-savemine><span class="t-main">${esc(t("q_save"))}</span></button><button class="nw-mini" data-target data-cancelm>${esc(t("q_cancel"))}</button></div></div>`;
  box.querySelector("[data-cancelm]").addEventListener("click", () => { box.hidden = true; box.innerHTML = ""; });
  box.querySelector("[data-savemine]").addEventListener("click", () => {
    const g = (f) => box.querySelector(`[data-f="${f}"]`).value; const coin = g("coin");
    if (g("wallet").trim()) quant.wallets[coin] = g("wallet").trim();
    quant.mine.push({ id: uid(), name: g("name").trim() || "Rig", pool: g("pool"), coin, hashrate: +g("hashrate") || 0, power: +g("power") || 0, cost: +g("cost") || 0, running: false, earned: 0 });
    save(); renderBots(bodyRef, ctx);
  });
}

// ---------- Herramientas (muchas, profesionales) ----------
function toolsTab(host, ctx) {
  const { t, esc } = ctx;
  host.innerHTML = `
    <div class="q-fcard"><div class="q-ph">${esc(t("q_calcLiq"))}</div>
      <div class="q-two"><label>${esc(t("q_entry"))}<input class="q-in" id="clEntry" type="number" value="60000"></label><label>${esc(t("q_leverage"))}<input class="q-in" id="clLev" type="number" value="20"></label></div>
      <label>${esc(t("q_dir"))}<select class="q-in" id="clSide"><option value="long">${esc(t("q_long"))}</option><option value="short">${esc(t("q_short"))}</option></select></label>
      <p class="q-out mono" id="clOut"></p></div>
    <div class="q-fcard"><div class="q-ph">${esc(t("q_calcPos"))}</div>
      <div class="q-two"><label>${esc(t("q_capital"))}<input class="q-in" id="psCap" type="number" value="1000"></label><label>${esc(t("q_riskPct"))}<input class="q-in" id="psRisk" type="number" value="2"></label></div>
      <div class="q-two"><label>${esc(t("q_entry"))}<input class="q-in" id="psEntry" type="number" value="60000"></label><label>${esc(t("q_stopPrice"))}<input class="q-in" id="psStop" type="number" value="58000"></label></div>
      <p class="q-out mono" id="psOut"></p></div>
    <div class="q-fcard"><div class="q-ph">${esc(t("q_calcRR"))}</div>
      <div class="q-two"><label>${esc(t("q_entry"))}<input class="q-in" id="rrEntry" type="number" value="60000"></label><label>${esc(t("q_stopPrice"))}<input class="q-in" id="rrStop" type="number" value="58000"></label></div>
      <label>${esc(t("q_target"))}<input class="q-in" id="rrTgt" type="number" value="66000"></label>
      <p class="q-out mono" id="rrOut"></p></div>
    <div class="q-fcard"><div class="q-ph">${esc(t("q_calcRoe"))}</div>
      <div class="q-two"><label>${esc(t("q_margin"))}<input class="q-in" id="roMar" type="number" value="100"></label><label>${esc(t("q_leverage"))}<input class="q-in" id="roLev" type="number" value="20"></label></div>
      <label>${esc(t("q_move"))} %<input class="q-in" id="roMove" type="number" value="2" step="0.1"></label>
      <p class="q-out mono" id="roOut"></p></div>
    <div class="q-fcard"><div class="q-ph">${esc(t("q_calcFees"))}</div>
      <div class="q-two"><label>${esc(t("q_notional"))}<input class="q-in" id="feNot" type="number" value="5000"></label><label>${esc(t("q_takerFee"))} %<input class="q-in" id="feTaker" type="number" value="0.05" step="0.01"></label></div>
      <div class="q-two"><label>${esc(t("q_funding"))} %/8h<input class="q-in" id="feFund" type="number" value="0.01" step="0.01"></label><label>${esc(t("q_hours"))}<input class="q-in" id="feHrs" type="number" value="24"></label></div>
      <p class="q-out mono" id="feOut"></p></div>
    <div class="q-fcard"><div class="q-ph">${esc(t("q_calcComp"))}</div>
      <div class="q-two"><label>${esc(t("q_capital"))}<input class="q-in" id="coCap" type="number" value="1000"></label><label>${esc(t("q_perTrade"))} %<input class="q-in" id="coGain" type="number" value="1.5" step="0.1"></label></div>
      <div class="q-two"><label>${esc(t("q_perDay"))}<input class="q-in" id="coN" type="number" value="3"></label><label>${esc(t("q_days"))}<input class="q-in" id="coDays" type="number" value="30"></label></div>
      <p class="q-out mono" id="coOut"></p><div class="q-chart" style="height:150px"><canvas id="coCv"></canvas></div></div>
    <p class="q-risk mono">${esc(t("q_toolsNote"))}</p>`;
  const num = (id) => +host.querySelector("#" + id).value;
  const liq = () => { const e = num("clEntry"), l = num("clLev") || 1, long = host.querySelector("#clSide").value === "long"; host.querySelector("#clOut").innerHTML = `${esc(t("q_liqAt"))}: <b>${usd(liqPrice(e, l, long))}</b> · ${esc(t("q_liqMove"))}: <b class="down">−${(100 / l).toFixed(2)}%</b>`; };
  const pos = () => { const cap = num("psCap"), risk = num("psRisk"), e = num("psEntry"), s = num("psStop"); const amt = cap * (risk / 100), per = Math.abs(e - s), u = per ? amt / per : 0; host.querySelector("#psOut").innerHTML = `${esc(t("q_maxRisk"))}: <b>${usd(amt)}</b> · ${esc(t("q_size"))}: <b>${u.toFixed(5)}</b> (${usd(u * e)})`; };
  const rr = () => { const e = num("rrEntry"), s = num("rrStop"), tg = num("rrTgt"); const risk = Math.abs(e - s), rew = Math.abs(tg - e); const ratio = risk ? rew / risk : 0; const be = (1 / (1 + ratio)) * 100; host.querySelector("#rrOut").innerHTML = `R:R <b>1:${ratio.toFixed(2)}</b> · ${esc(t("q_winNeeded"))}: <b>${be.toFixed(1)}%</b>`; };
  const roe = () => { const m = num("roMar"), l = num("roLev"), mv = num("roMove"); const pnl = m * l * (mv / 100); host.querySelector("#roOut").innerHTML = `${esc(t("q_pnl"))}: <b class="${pnl >= 0 ? "up" : "down"}">${(pnl >= 0 ? "+" : "") + usd(pnl)}</b> · ROE <b>${(l * mv >= 0 ? "+" : "") + (l * mv).toFixed(1)}%</b>`; };
  const fees = () => { const n = num("feNot"), tk = num("feTaker"), fd = num("feFund"), h = num("feHrs"); const trade = n * (tk / 100) * 2, fund = n * (fd / 100) * (h / 8); host.querySelector("#feOut").innerHTML = `${esc(t("q_tradeFee"))}: <b class="down">${usd(trade)}</b> · funding: <b class="down">${usd(fund)}</b> · ${esc(t("q_total"))}: <b class="down">${usd(trade + fund)}</b>`; };
  const comp = () => { const cap = num("coCap"), gain = num("coGain") / 100, n = num("coN"), days = num("coDays"); const series = [cap]; let v = cap; for (let d = 0; d < days; d++) { for (let i = 0; i < n; i++) v *= (1 + gain); series.push(Math.round(v)); } host.querySelector("#coOut").innerHTML = `${esc(t("q_final"))}: <b class="up">${usd(v)}</b> · ×${(v / cap).toFixed(1)} (${days}d) · <span class="muted">${esc(t("q_compNote"))}</span>`; const cv = host.querySelector("#coCv"); plot(cv, series, { color: "#2fd98a", labels: true }); };
  host.querySelectorAll("#clEntry,#clLev,#clSide").forEach((e) => e.addEventListener("input", liq));
  host.querySelectorAll("#psCap,#psRisk,#psEntry,#psStop").forEach((e) => e.addEventListener("input", pos));
  host.querySelectorAll("#rrEntry,#rrStop,#rrTgt").forEach((e) => e.addEventListener("input", rr));
  host.querySelectorAll("#roMar,#roLev,#roMove").forEach((e) => e.addEventListener("input", roe));
  host.querySelectorAll("#feNot,#feTaker,#feFund,#feHrs").forEach((e) => e.addEventListener("input", fees));
  host.querySelectorAll("#coCap,#coGain,#coN,#coDays").forEach((e) => e.addEventListener("input", comp));
  liq(); pos(); rr(); roe(); fees();
  const cv = host.querySelector("#coCv"); registerChart(cv, comp);
  startEngine();
}

// ---------- Claves API ----------
function keysTab(host, ctx) {
  const { t, esc } = ctx;
  host.innerHTML = `<p class="q-risk mono">${esc(t("q_keysNote"))}</p>
    <div class="q-list">${EXCHANGES.filter((e) => e.maxLev > 1).map((e) => { const k = quant.keys[e.id] || {}; return `<div class="q-fcard" data-ex="${e.id}"><div class="q-card-top"><div><b>${esc(e.name)}</b><small class="mono">${esc(e.sub)} · ${esc(t("q_maxLev"))} ${e.maxLev}x</small></div>${k.key ? '<span class="q-chip long">●</span>' : ""}</div>
      <label>API Key<input class="q-in" data-k="key" value="${esc(k.key || "")}" placeholder="API key"></label>
      <label>API Secret<input class="q-in" type="password" data-k="secret" value="${esc(k.secret || "")}" placeholder="API secret"></label>
      <div class="q-row"><button class="nw-mini" data-target data-savekey="${e.id}">${esc(t("q_save"))}</button><a class="nw-mini" href="${e.url}" target="_blank" rel="noopener">${esc(e.name)} ↗</a></div></div>`; }).join("")}</div>`;
  host.querySelectorAll("[data-savekey]").forEach((btn) => btn.addEventListener("click", () => { const card = btn.closest("[data-ex]"), id = btn.dataset.savekey; quant.keys[id] = { key: card.querySelector('[data-k="key"]').value.trim(), secret: card.querySelector('[data-k="secret"]').value.trim() }; save(); btn.textContent = t("q_saved"); setTimeout(() => { btn.textContent = t("q_save"); }, 1500); }));
  startEngine();
}

export function stopBots() { clearInterval(engine); clearCharts(); bodyRef = null; }
