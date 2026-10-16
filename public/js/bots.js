// =====================================================================
// NIKOLAI QUANT — laboratorio de bots de trading y de minería
// - Bots de trading con apalancamiento (1x…100x), stop-loss, take-profit,
//   varias estrategias y varios exchanges (Binance, KuCoin, Bybit, OKX…).
// - Motor de simulación (paper trading) con precios EN VIVO de Binance.
// - Señales con IA (NIKOLAI), calculadora de liquidación y de riesgo.
// - Bots de minería con estimador de ganancias.
// - Bóveda de claves API (se guardan SOLO en este navegador).
// Nota de seguridad: una página web estática no puede firmar órdenes reales
// sin exponer tu clave secreta, así que el motor opera en PAPEL (simulación)
// y en modo "Real" genera la orden exacta y el enlace para que TÚ la ejecutes.
// =====================================================================
import { market, connectLive, fmtMoney } from "./markets.js";

const KEY = "nikolai.quant";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
export const quant = Object.assign({ trade: [], mine: [], keys: {}, wallets: {}, tab: "trade" }, load());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(quant)); } catch { /* lleno */ } };

export const BRAND = "NIKOLAI QUANT";

// Exchanges reputados (spot + derivados). url = sitio oficial.
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
// Pools / sitios de minería reputados.
const POOLS = [
  { id: "nicehash", name: "NiceHash", sub: "Alquiler de hashrate", url: "https://www.nicehash.com" },
  { id: "unmineable", name: "unMineable", sub: "Mina con CPU/GPU → cualquier cripto", url: "https://unmineable.com" },
  { id: "kryptex", name: "Kryptex", sub: "Minería fácil (Windows)", url: "https://www.kryptex.org" },
  { id: "f2pool", name: "F2Pool", sub: "Pool global", url: "https://www.f2pool.com" },
  { id: "twominers", name: "2Miners", sub: "Pools PPLNS/SOLO", url: "https://2miners.com" },
  { id: "viabtc", name: "ViaBTC", sub: "Pool + nube", url: "https://www.viabtc.com" },
];
// Monedas minables + ingreso estimado por unidad de hashrate y día (USD).
// Valores aproximados para ESTIMAR (cambian con el mercado y la dificultad).
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
const priceNow = (pair) => market.live[pair]?.price || 0;
// Precio de liquidación aproximado (margen aislado, sin comisiones).
export const liqPrice = (entry, lev, long) => entry * (long ? 1 - 1 / lev : 1 + 1 / lev);

// ---------- Motor de simulación (paper trading) ----------
let engine = 0, ctxRef = null, bodyRef = null;
function startEngine() {
  clearInterval(engine);
  connectLive();
  engine = setInterval(tick, 1500);
}
function tick() {
  let touched = false;
  for (const b of quant.trade) {
    if (!b.running) continue;
    const p = priceNow(b.pair);
    if (!p) continue;
    b.ref = b.ref ? b.ref * 0.96 + p * 0.04 : p; // media móvil para señales
    if (!b.pos) {
      const sig = signal(b, p);
      if (sig) {
        const margin = (b.equity * b.posPct) / 100;
        b.pos = { side: sig, entry: p, margin, liq: liqPrice(p, b.lev, sig > 0) };
      }
    } else {
      const roe = b.pos.side * ((p - b.pos.entry) / b.pos.entry) * b.lev; // retorno sobre margen
      const hitLiq = b.pos.side > 0 ? p <= b.pos.liq : p >= b.pos.liq;
      if (hitLiq) { close(b, -1); }
      else if (roe >= b.tp / 100) { close(b, roe); }
      else if (roe <= -b.sl / 100) { close(b, roe); }
    }
    touched = true;
  }
  for (const m of quant.mine) {
    if (!m.running) continue;
    const perDay = estimateMining(m);
    m.earned = (m.earned || 0) + (perDay / 86400) * 1.5; // acumula por el intervalo
    touched = true;
  }
  if (touched) { save(); patchLive(); }
}
function signal(b, p) {
  // Simulación de estrategia (educativa; no es consejo financiero).
  const up = p > b.ref * 1.0006, down = p < b.ref * 0.9994;
  if (b.side === "long" && !up && !down) return 0;
  if (b.strategy === "grid") return down ? 1 : up ? -1 : 0;
  if (b.strategy === "reversion") return down ? 1 : up ? -1 : 0;
  if (b.strategy === "dca") return 1; // acumula largo
  // momentum / scalping siguen la tendencia
  const dir = up ? 1 : down ? -1 : 0;
  if (b.side === "long") return dir > 0 ? 1 : 0;
  if (b.side === "short") return dir < 0 ? -1 : 0;
  return dir;
}
function close(b, roe) {
  const pnl = roe <= -1 ? -b.pos.margin : b.pos.margin * roe;
  b.equity = Math.max(0, b.equity + pnl);
  b.pnl = (b.pnl || 0) + pnl;
  b.trades = (b.trades || 0) + 1;
  if (pnl >= 0) b.wins = (b.wins || 0) + 1;
  b.pos = null;
  if (b.equity <= 0) { b.running = false; b.blown = true; }
}
function patchLive() {
  if (!bodyRef || !bodyRef.isConnected) { clearInterval(engine); return; }
  for (const b of quant.trade) {
    const card = bodyRef.querySelector(`[data-bot="${b.id}"]`);
    if (!card) continue;
    const p = priceNow(b.pair);
    const roe = b.pos ? b.pos.side * ((p - b.pos.entry) / b.pos.entry) * b.lev : 0;
    const uPnl = b.pos ? b.pos.margin * roe : 0;
    const set = (sel, txt, cls) => { const e = card.querySelector(sel); if (e) { e.textContent = txt; if (cls !== undefined) e.className = cls; } };
    set(".q-price", p ? usd(p) : "—");
    set(".q-equity", usd(b.equity));
    set(".q-upnl", (uPnl >= 0 ? "+" : "") + usd(uPnl), "q-upnl " + (uPnl >= 0 ? "up" : "down"));
    set(".q-posn", b.pos ? (b.pos.side > 0 ? "LONG" : "SHORT") + " @ " + usd(b.pos.entry) : ctxRef.t("q_flat"));
    const g = card.querySelector(".q-roe"); if (g && b.pos) { g.textContent = (roe >= 0 ? "+" : "") + (roe * 100).toFixed(1) + "%"; g.className = "q-roe " + (roe >= 0 ? "up" : "down"); } else if (g) g.textContent = "";
  }
  for (const m of quant.mine) {
    const card = bodyRef.querySelector(`[data-mine="${m.id}"]`);
    if (card) { const e = card.querySelector(".q-earned"); if (e) e.textContent = usd(m.earned || 0); }
  }
}

function estimateMining(m) {
  const coin = MINE_COINS.find((c) => c.id === m.coin) || MINE_COINS[0];
  const gross = (m.hashrate || 0) * coin.perUnit;             // ingreso bruto estimado/día
  const powerCost = ((m.power || 0) / 1000) * 24 * (m.cost || 0); // kWh/día * precio
  return gross - powerCost;
}

// ---------- Resumen para la tarjeta del panel ----------
export function botsSummary() {
  const active = quant.trade.filter((b) => b.running).length + quant.mine.filter((m) => m.running).length;
  const pnl = quant.trade.reduce((s, b) => s + (b.pnl || 0), 0);
  return { active, total: quant.trade.length + quant.mine.length, pnl };
}

// ---------- Render principal ----------
export function renderBots(body, ctx) {
  const { t, esc } = ctx;
  ctxRef = ctx; bodyRef = body;
  const tabs = [["trade", "q_tabTrade"], ["mine", "q_tabMine"], ["tools", "q_tabTools"], ["keys", "q_tabKeys"]];
  body.innerHTML = `
    <div class="q-brand"><b>${BRAND}</b><span class="mono">${esc(t("q_tagline"))}</span><a class="nw-mini" href="/quant" target="_blank" rel="noopener">Panel privado PRO ↗</a></div>
    <div class="q-tabs">${tabs.map(([id, k]) => `<button class="q-tab ${quant.tab === id ? "on" : ""}" data-target data-qtab="${id}">${esc(t(k))}</button>`).join("")}</div>
    <div class="q-body"></div>`;
  body.querySelectorAll("[data-qtab]").forEach((b) => b.addEventListener("click", () => { quant.tab = b.dataset.qtab; save(); renderBots(body, ctx); }));
  const host = body.querySelector(".q-body");
  ({ trade: tradeTab, mine: mineTab, tools: toolsTab, keys: keysTab }[quant.tab] || tradeTab)(host, ctx);
  startEngine();
}

// ---------- Pestaña: bots de trading ----------
function tradeTab(host, ctx) {
  const { t, esc } = ctx;
  host.innerHTML = `
    <div class="q-list">${quant.trade.length ? quant.trade.map((b) => tradeCard(b, ctx)).join("") : `<p class="muted">${esc(t("q_noBots"))}</p>`}</div>
    <button class="tile action" data-target data-newbot><span class="t-main">+ ${esc(t("q_newBot"))}</span></button>
    <div class="q-form" hidden></div>`;
  host.querySelector("[data-newbot]").addEventListener("click", () => openBotForm(host, ctx));
  bindTradeCards(host, ctx);
}
function tradeCard(b, ctx) {
  const { t, esc } = ctx;
  const ex = EXCHANGES.find((e) => e.id === b.exchange) || EXCHANGES[0];
  const wr = b.trades ? Math.round(((b.wins || 0) / b.trades) * 100) : 0;
  return `<div class="q-card ${b.running ? "live" : ""} ${b.blown ? "blown" : ""}" data-bot="${b.id}">
    <div class="q-card-top">
      <div><b>${esc(b.name)}</b><small class="mono">${esc(ex.name)} · ${esc(b.pair)}</small></div>
      <span class="q-lev ${b.lev >= 50 ? "hot" : ""}">${b.lev}x</span>
    </div>
    <div class="q-tags mono">
      <span class="q-chip ${b.side}">${esc(t("q_" + b.side))}</span>
      <span class="q-chip">${esc(t("q_s_" + b.strategy))}</span>
      <span class="q-chip">${esc(b.mode === "real" ? t("q_modeReal") : t("q_modePaper"))}</span>
    </div>
    <div class="q-stats">
      <div><span>${esc(t("q_price"))}</span><b class="q-price mono">—</b></div>
      <div><span>${esc(t("q_equity"))}</span><b class="q-equity mono">${usd(b.equity)}</b></div>
      <div><span>${esc(t("q_upnl"))}</span><b class="q-upnl mono">$0.00</b></div>
    </div>
    <div class="q-pos mono"><span class="q-posn">${esc(t("q_flat"))}</span> <span class="q-roe"></span></div>
    <div class="q-mini mono">SL ${b.sl}% · TP ${b.tp}% · ${esc(t("q_trades"))}: ${b.trades || 0} · ${esc(t("q_win"))}: ${wr}%
      · ${esc(t("q_realPnl"))}: <span class="${(b.pnl || 0) >= 0 ? "up" : "down"}">${(b.pnl || 0) >= 0 ? "+" : ""}${usd(b.pnl || 0)}</span></div>
    ${b.blown ? `<p class="q-warn mono">${esc(t("q_blown"))}</p>` : ""}
    <div class="q-row">
      <button class="nw-mini ${b.running ? "on" : ""}" data-target data-toggle="${b.id}">${esc(b.running ? t("q_pause") : t("q_start"))}</button>
      <button class="nw-mini" data-target data-signal="${b.id}">${esc(t("q_aiSignal"))}</button>
      <button class="nw-mini" data-target data-order="${b.id}">${esc(t("q_order"))}</button>
      <button class="nw-mini" data-target data-delbot="${b.id}">${esc(t("q_delete"))}</button>
    </div>
    <div class="q-ai mono" hidden></div>`;
}
function bindTradeCards(host, ctx) {
  host.querySelectorAll("[data-toggle]").forEach((btn) => btn.addEventListener("click", () => {
    const b = quant.trade.find((x) => x.id === btn.dataset.toggle);
    if (!b) return;
    if (b.blown) { b.blown = false; b.equity = b.capital; b.pnl = 0; b.trades = 0; b.wins = 0; b.pos = null; }
    b.running = !b.running; save(); renderBots(bodyRef, ctx);
  }));
  host.querySelectorAll("[data-delbot]").forEach((btn) => btn.addEventListener("click", () => {
    quant.trade = quant.trade.filter((x) => x.id !== btn.dataset.delbot); save(); renderBots(bodyRef, ctx);
  }));
  host.querySelectorAll("[data-signal]").forEach((btn) => btn.addEventListener("click", () => aiSignal(btn, ctx)));
  host.querySelectorAll("[data-order]").forEach((btn) => btn.addEventListener("click", () => showOrder(btn, ctx)));
}

function openBotForm(host, ctx, edit) {
  const { t, esc } = ctx;
  const box = host.querySelector(".q-form");
  const d = edit || { name: "", exchange: "binance", pair: "BTCUSDT", side: "both", strategy: "momentum", lev: 10, capital: 1000, posPct: 10, sl: 20, tp: 40, mode: "paper" };
  box.hidden = false;
  box.innerHTML = `
    <div class="q-fcard">
      <label>${esc(t("q_name"))}<input class="q-in" data-f="name" value="${esc(d.name)}" placeholder="Mi bot BTC"></label>
      <label>${esc(t("q_exchange"))}<select class="q-in" data-f="exchange">${EXCHANGES.map((e) => `<option value="${e.id}" ${d.exchange === e.id ? "selected" : ""}>${e.name} · ${esc(e.sub)}</option>`).join("")}</select></label>
      <label>${esc(t("q_pair"))}<select class="q-in" data-f="pair">${PAIRS.map((p) => `<option ${d.pair === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>
      <label>${esc(t("q_dir"))}<select class="q-in" data-f="side">${["both", "long", "short"].map((s) => `<option value="${s}" ${d.side === s ? "selected" : ""}>${esc(t("q_" + s))}</option>`).join("")}</select></label>
      <label>${esc(t("q_strategy"))}<select class="q-in" data-f="strategy">${STRATEGIES.map((s) => `<option value="${s}" ${d.strategy === s ? "selected" : ""}>${esc(t("q_s_" + s))}</option>`).join("")}</select></label>
      <div class="q-lev-pick"><span>${esc(t("q_leverage"))}</span><div class="q-levs">${LEVERAGES.map((l) => `<button type="button" class="q-levbtn ${d.lev === l ? "on" : ""} ${l >= 50 ? "hot" : ""}" data-lev="${l}">${l}x</button>`).join("")}</div></div>
      <div class="q-two">
        <label>${esc(t("q_capital"))} (USDT)<input class="q-in" type="number" data-f="capital" value="${d.capital}" min="10"></label>
        <label>${esc(t("q_posPct"))}<input class="q-in" type="number" data-f="posPct" value="${d.posPct}" min="1" max="100"></label>
      </div>
      <div class="q-two">
        <label>${esc(t("q_sl"))}<input class="q-in" type="number" data-f="sl" value="${d.sl}" min="1"></label>
        <label>${esc(t("q_tp"))}<input class="q-in" type="number" data-f="tp" value="${d.tp}" min="1"></label>
      </div>
      <label>${esc(t("q_mode"))}<select class="q-in" data-f="mode"><option value="paper" ${d.mode === "paper" ? "selected" : ""}>${esc(t("q_modePaper"))}</option><option value="real" ${d.mode === "real" ? "selected" : ""}>${esc(t("q_modeReal"))}</option></select></label>
      <p class="q-liqnote mono"></p>
      <div class="q-row"><button class="tile action" data-target data-savebot><span class="t-main">${esc(t("q_save"))}</span></button><button class="nw-mini" data-target data-cancelbot>${esc(t("q_cancel"))}</button></div>
      <p class="q-risk mono">${esc(t("q_riskNote"))}</p>
    </div>`;
  let lev = d.lev;
  const liqNote = () => {
    const pair = box.querySelector('[data-f="pair"]').value;
    const p = priceNow(pair) || 0;
    const el = box.querySelector(".q-liqnote");
    if (p) el.innerHTML = `${esc(t("q_liqAt"))}: <b>${usd(liqPrice(p, lev, true))}</b> (long) · <b>${usd(liqPrice(p, lev, false))}</b> (short) · −${(100 / lev).toFixed(1)}% ${esc(t("q_liqMove"))}`;
    else el.textContent = t("q_liqWait");
  };
  box.querySelectorAll(".q-levbtn").forEach((btn) => btn.addEventListener("click", () => {
    lev = Number(btn.dataset.lev); box.querySelectorAll(".q-levbtn").forEach((x) => x.classList.toggle("on", x === btn)); liqNote();
  }));
  box.querySelector('[data-f="pair"]').addEventListener("change", liqNote);
  liqNote();
  box.querySelector("[data-cancelbot]").addEventListener("click", () => { box.hidden = true; box.innerHTML = ""; });
  box.querySelector("[data-savebot]").addEventListener("click", () => {
    const g = (f) => box.querySelector(`[data-f="${f}"]`).value;
    const b = {
      id: edit?.id || uid(), name: g("name").trim() || `${g("pair")} ${lev}x`, exchange: g("exchange"), pair: g("pair"),
      side: g("side"), strategy: g("strategy"), lev, capital: Math.max(10, +g("capital") || 1000),
      posPct: Math.min(100, Math.max(1, +g("posPct") || 10)), sl: Math.max(1, +g("sl") || 20), tp: Math.max(1, +g("tp") || 40),
      mode: g("mode"), running: edit?.running || false, equity: edit?.equity ?? Math.max(10, +g("capital") || 1000),
      pnl: edit?.pnl || 0, trades: edit?.trades || 0, wins: edit?.wins || 0, pos: edit?.pos || null,
    };
    if (edit) Object.assign(quant.trade.find((x) => x.id === edit.id), b);
    else quant.trade.push(b);
    save(); renderBots(bodyRef, ctx);
  });
}

// Señal con IA (NIKOLAI) usando datos de mercado en vivo.
async function aiSignal(btn, ctx) {
  const b = quant.trade.find((x) => x.id === btn.dataset.signal);
  const card = btn.closest("[data-bot]"); const out = card.querySelector(".q-ai");
  out.hidden = false; out.textContent = ctx.t("q_thinking");
  const p = priceNow(b.pair);
  const msg = ctx.t("q_signalPrompt").replace("{pair}", b.pair).replace("{price}", p ? usd(p) : "?").replace("{lev}", b.lev).replace("{strat}", ctx.t("q_s_" + b.strategy));
  let full = "";
  try {
    await ctx.stream({ messages: [{ role: "user", content: msg }], mode: "market", channel: "text", symbol: b.pair }, { onText: (d) => { full += d; out.textContent = full; } });
    if (!full) out.textContent = ctx.t("errGeneric");
  } catch { out.textContent = ctx.t("errGeneric"); }
}

// Orden exacta para ejecutar en el exchange (modo real = tú confirmas).
function showOrder(btn, ctx) {
  const { t, esc } = ctx;
  const b = quant.trade.find((x) => x.id === btn.dataset.order);
  const ex = EXCHANGES.find((e) => e.id === b.exchange) || EXCHANGES[0];
  const p = priceNow(b.pair) || 0;
  const margin = (b.equity * b.posPct) / 100;
  const notional = margin * b.lev;
  const qty = p ? notional / p : 0;
  const side = b.side === "short" ? "SELL / SHORT" : "BUY / LONG";
  const card = btn.closest("[data-bot]"); const out = card.querySelector(".q-ai");
  out.hidden = false;
  out.innerHTML = `<div class="q-order">
    <b>${esc(t("q_orderTicket"))} · ${esc(ex.name)}</b>
    <div>${esc(t("q_pair"))}: <b>${esc(b.pair)}</b> · ${side}</div>
    <div>${esc(t("q_leverage"))}: <b>${b.lev}x</b> · ${esc(t("q_margin"))}: <b>${usd(margin)}</b></div>
    <div>${esc(t("q_size"))}: <b>${qty.toFixed(5)}</b> (${usd(notional)})</div>
    <div>SL: <b>${usd(p * (b.side === "short" ? 1 + b.sl / 100 / b.lev : 1 - b.sl / 100 / b.lev))}</b> · TP: <b>${usd(p * (b.side === "short" ? 1 - b.tp / 100 / b.lev : 1 + b.tp / 100 / b.lev))}</b></div>
    <div>${esc(t("q_liqAt"))}: <b class="down">${usd(liqPrice(p, b.lev, b.side !== "short"))}</b></div>
    <a class="nw-mini" href="${ex.url}" target="_blank" rel="noopener">${esc(t("q_openExchange"))} ↗</a>
    <p class="q-risk mono">${esc(t("q_orderNote"))}</p>
  </div>`;
}

// ---------- Pestaña: minería ----------
function mineTab(host, ctx) {
  const { t, esc } = ctx;
  host.innerHTML = `
    <div class="q-list">${quant.mine.length ? quant.mine.map((m) => mineCard(m, ctx)).join("") : `<p class="muted">${esc(t("q_noMine"))}</p>`}</div>
    <button class="tile action" data-target data-newmine><span class="t-main">+ ${esc(t("q_newMine"))}</span></button>
    <div class="q-form" hidden></div>`;
  host.querySelector("[data-newmine]").addEventListener("click", () => openMineForm(host, ctx));
  host.querySelectorAll("[data-togglem]").forEach((btn) => btn.addEventListener("click", () => { const m = quant.mine.find((x) => x.id === btn.dataset.togglem); m.running = !m.running; save(); renderBots(bodyRef, ctx); }));
  host.querySelectorAll("[data-delmine]").forEach((btn) => btn.addEventListener("click", () => { quant.mine = quant.mine.filter((x) => x.id !== btn.dataset.delmine); save(); renderBots(bodyRef, ctx); }));
}
function mineCard(m, ctx) {
  const { t, esc } = ctx;
  const pool = POOLS.find((p) => p.id === m.pool) || POOLS[0];
  const coin = MINE_COINS.find((c) => c.id === m.coin) || MINE_COINS[0];
  const day = estimateMining(m);
  return `<div class="q-card ${m.running ? "live" : ""}" data-mine="${m.id}">
    <div class="q-card-top"><div><b>${esc(m.name)}</b><small class="mono">${esc(pool.name)} · ${esc(coin.name)}</small></div><span class="q-lev">${esc(coin.id)}</span></div>
    <div class="q-stats">
      <div><span>${esc(t("q_hashrate"))}</span><b class="mono">${m.hashrate} ${esc(coin.unit)}</b></div>
      <div><span>${esc(t("q_estDay"))}</span><b class="mono ${day >= 0 ? "up" : "down"}">${usd(day)}</b></div>
      <div><span>${esc(t("q_earned"))}</span><b class="q-earned mono">${usd(m.earned || 0)}</b></div>
    </div>
    <div class="q-mini mono">${esc(t("q_estMonth"))}: ${usd(day * 30)} · ${esc(t("q_power"))}: ${m.power}W · ${esc(t("q_cost"))}: $${m.cost}/kWh</div>
    <div class="q-row">
      <button class="nw-mini ${m.running ? "on" : ""}" data-target data-togglem="${m.id}">${esc(m.running ? t("q_pause") : t("q_start"))}</button>
      <a class="nw-mini" href="${pool.url}" target="_blank" rel="noopener">${esc(pool.name)} ↗</a>
      <button class="nw-mini" data-target data-delmine="${m.id}">${esc(t("q_delete"))}</button>
    </div>
    <p class="q-risk mono">${esc(t("q_mineNote"))}</p>`;
}
function openMineForm(host, ctx) {
  const { t, esc } = ctx;
  const box = host.querySelector(".q-form");
  box.hidden = false;
  box.innerHTML = `<div class="q-fcard">
    <label>${esc(t("q_name"))}<input class="q-in" data-f="name" placeholder="Rig 1"></label>
    <label>${esc(t("q_pool"))}<select class="q-in" data-f="pool">${POOLS.map((p) => `<option value="${p.id}">${p.name} · ${esc(p.sub)}</option>`).join("")}</select></label>
    <label>${esc(t("q_coin"))}<select class="q-in" data-f="coin">${MINE_COINS.map((c) => `<option value="${c.id}">${c.name} (${c.unit})</option>`).join("")}</select></label>
    <div class="q-two">
      <label>${esc(t("q_hashrate"))}<input class="q-in" type="number" data-f="hashrate" value="100" min="0"></label>
      <label>${esc(t("q_powerW"))}<input class="q-in" type="number" data-f="power" value="300" min="0"></label>
    </div>
    <label>${esc(t("q_costKwh"))} (USD)<input class="q-in" type="number" step="0.01" data-f="cost" value="0.10" min="0"></label>
    <label>${esc(t("q_wallet"))}<input class="q-in" data-f="wallet" placeholder="${esc(t("q_walletPh"))}"></label>
    <div class="q-row"><button class="tile action" data-target data-savemine><span class="t-main">${esc(t("q_save"))}</span></button><button class="nw-mini" data-target data-cancelm>${esc(t("q_cancel"))}</button></div>
  </div>`;
  box.querySelector("[data-cancelm]").addEventListener("click", () => { box.hidden = true; box.innerHTML = ""; });
  box.querySelector("[data-savemine]").addEventListener("click", () => {
    const g = (f) => box.querySelector(`[data-f="${f}"]`).value;
    const coin = g("coin");
    if (g("wallet").trim()) { quant.wallets[coin] = g("wallet").trim(); }
    quant.mine.push({ id: uid(), name: g("name").trim() || "Rig", pool: g("pool"), coin, hashrate: +g("hashrate") || 0, power: +g("power") || 0, cost: +g("cost") || 0, running: false, earned: 0 });
    save(); renderBots(bodyRef, ctx);
  });
}

// ---------- Pestaña: herramientas ----------
function toolsTab(host, ctx) {
  const { t, esc } = ctx;
  host.innerHTML = `
    <div class="q-fcard">
      <b>${esc(t("q_calcLiq"))}</b>
      <div class="q-two"><label>${esc(t("q_entry"))}<input class="q-in" id="clEntry" type="number" value="60000"></label>
      <label>${esc(t("q_leverage"))}<input class="q-in" id="clLev" type="number" value="20"></label></div>
      <label>${esc(t("q_dir"))}<select class="q-in" id="clSide"><option value="long">${esc(t("q_long"))}</option><option value="short">${esc(t("q_short"))}</option></select></label>
      <p class="q-liqnote mono" id="clOut"></p>
    </div>
    <div class="q-fcard">
      <b>${esc(t("q_calcPos"))}</b>
      <div class="q-two"><label>${esc(t("q_capital"))}<input class="q-in" id="psCap" type="number" value="1000"></label>
      <label>${esc(t("q_riskPct"))}<input class="q-in" id="psRisk" type="number" value="2"></label></div>
      <div class="q-two"><label>${esc(t("q_entry"))}<input class="q-in" id="psEntry" type="number" value="60000"></label>
      <label>${esc(t("q_stopPrice"))}<input class="q-in" id="psStop" type="number" value="58000"></label></div>
      <p class="q-liqnote mono" id="psOut"></p>
    </div>
    <p class="q-risk mono">${esc(t("q_toolsNote"))}</p>`;
  const liq = () => {
    const e = +host.querySelector("#clEntry").value, l = +host.querySelector("#clLev").value || 1, long = host.querySelector("#clSide").value === "long";
    host.querySelector("#clOut").innerHTML = `${esc(t("q_liqAt"))}: <b>${usd(liqPrice(e, l, long))}</b> · ${esc(t("q_liqMove"))}: <b class="down">−${(100 / l).toFixed(2)}%</b>`;
  };
  const pos = () => {
    const cap = +host.querySelector("#psCap").value, risk = +host.querySelector("#psRisk").value, e = +host.querySelector("#psEntry").value, s = +host.querySelector("#psStop").value;
    const riskAmt = cap * (risk / 100); const perUnit = Math.abs(e - s);
    const units = perUnit ? riskAmt / perUnit : 0;
    host.querySelector("#psOut").innerHTML = `${esc(t("q_maxRisk"))}: <b>${usd(riskAmt)}</b> · ${esc(t("q_size"))}: <b>${units.toFixed(5)}</b> (${usd(units * e)})`;
  };
  host.querySelectorAll("#clEntry,#clLev,#clSide").forEach((el) => el.addEventListener("input", liq));
  host.querySelectorAll("#psCap,#psRisk,#psEntry,#psStop").forEach((el) => el.addEventListener("input", pos));
  liq(); pos();
}

// ---------- Pestaña: claves API ----------
function keysTab(host, ctx) {
  const { t, esc } = ctx;
  host.innerHTML = `
    <p class="q-risk mono">${esc(t("q_keysNote"))}</p>
    <div class="q-list">${EXCHANGES.filter((e) => e.maxLev > 1).map((e) => {
      const k = quant.keys[e.id] || {};
      return `<div class="q-fcard" data-ex="${e.id}">
        <div class="q-card-top"><div><b>${esc(e.name)}</b><small class="mono">${esc(e.sub)} · ${esc(t("q_maxLev"))} ${e.maxLev}x</small></div>${k.key ? '<span class="q-chip long">●</span>' : ""}</div>
        <label>API Key<input class="q-in" data-k="key" value="${esc(k.key || "")}" placeholder="API key"></label>
        <label>API Secret<input class="q-in" type="password" data-k="secret" value="${esc(k.secret || "")}" placeholder="API secret"></label>
        <div class="q-row"><button class="nw-mini" data-target data-savekey="${e.id}">${esc(t("q_save"))}</button><a class="nw-mini" href="${e.url}" target="_blank" rel="noopener">${esc(e.name)} ↗</a></div>
      </div>`;
    }).join("")}</div>`;
  host.querySelectorAll("[data-savekey]").forEach((btn) => btn.addEventListener("click", () => {
    const card = btn.closest("[data-ex]"); const id = btn.dataset.savekey;
    quant.keys[id] = { key: card.querySelector('[data-k="key"]').value.trim(), secret: card.querySelector('[data-k="secret"]').value.trim() };
    save(); ctx.speak?.(t("q_saved")); btn.textContent = t("q_saved"); setTimeout(() => { btn.textContent = t("q_save"); }, 1500);
  }));
}

export function stopBots() { clearInterval(engine); bodyRef = null; }
