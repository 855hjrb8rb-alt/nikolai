// =====================================================================
// NIKOLAI TERMINAL — terminal financiera estilo Bloomberg (ámbar sobre negro)
// Línea de comandos con mnemónicos (DES, GP, TOP, WEI, N, Q, HELP), monitor
// Launchpad en vivo, menú numerado, reloj de bolsas, Fear & Greed, cinta de
// cotizaciones, tablas nativas en ámbar y gráficas reales (TradingView).
// Cripto en vivo por Binance (markets.js); acciones/índices por TradingView.
// =====================================================================
import { market, connectLive, loadCoins, fmtMoney, fmtPct, onMarket, tvWidget } from "./markets.js";
import { EXCHANGES, exchangeStatus, fmtCountdown, fearGreed, loadFearGreed } from "./wallstreet.js";
import { news, loadFeed, headlines } from "./news.js";

const MONITOR = [
  ["BTC", "BTCUSDT"], ["ETH", "ETHUSDT"], ["SOL", "SOLUSDT"], ["BNB", "BNBUSDT"],
  ["XRP", "XRPUSDT"], ["DOGE", "DOGEUSDT"], ["ADA", "ADAUSDT"], ["AVAX", "AVAXUSDT"],
];
const CRYPTO = new Set(["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "LTC", "LINK", "DOT", "MATIC", "TRX", "SHIB", "TON", "NEAR", "ATOM", "UNI", "XLM", "BCH"]);
const TAPE = [
  { proName: "FOREXCOM:SPXUSD", title: "S&P 500" }, { proName: "FOREXCOM:NSXUSD", title: "Nasdaq 100" },
  { proName: "FOREXCOM:DJI", title: "Dow 30" }, { proName: "TVC:DXY", title: "USD" },
  { proName: "TVC:GOLD", title: "Oro" }, { proName: "TVC:USOIL", title: "Petróleo" },
  { proName: "FX_IDC:USDMXN", title: "USD/MXN" }, { proName: "FX:EURUSD", title: "EUR/USD" },
  { proName: "BINANCE:BTCUSDT", title: "Bitcoin" }, { proName: "BINANCE:ETHUSDT", title: "Ether" },
];
const FUNCS = { HELP: "help", H: "help", "?": "help", MON: "home", HOME: "home", TOP: "news", N: "news", NEWS: "news", WEI: "wei", DES: "des", GP: "gp", GIP: "gp", Q: "quote", CLR: "home" };

let ctxRef = null, bodyRef = null, unsub = null, clock = 0;
const state = { sym: "BTC", hist: [], hi: -1 };

const tvSym = (sym) => (CRYPTO.has(sym) ? `BINANCE:${sym}USDT` : sym);
const pairOf = (sym) => (CRYPTO.has(sym) ? `${sym}USDT` : null);
const coinOf = (sym) => market.coins.find((c) => (c.symbol || "").toUpperCase() === sym);
const net = (price, chg) => price - price / (1 + chg / 100);

export function renderTerminal(body, ctx) {
  ctxRef = ctx; bodyRef = body;
  stopTerminal();
  connectLive();
  if (!market.coins.length) loadCoins();
  Promise.resolve(loadFearGreed()).catch(() => {});
  if (!news.items.length) Promise.resolve(loadFeed(ctx.lang)).catch(() => {});
  const { t, esc } = ctx;
  const menu = [["1", "HELP"], ["2", "MON"], ["3", "NEWS"], ["4", "WEI"], ["5", "TOP"], ["6", "DES"], ["7", "GP"]];
  body.innerHTML = `
    <div class="tm">
      <div class="tm-head">
        <span class="tm-logo">◆ NIKOLAI <b>TERMINAL</b></span>
        <span class="tm-clock mono" id="tmClock"></span>
        <span class="tm-conn mono"><i></i> ${esc(t("tm_live"))}</span>
      </div>
      <div class="tm-cmd">
        <span class="tm-prompt mono">CMD<span class="tm-cur">▊</span></span>
        <input class="tm-in mono" id="tmIn" autocomplete="off" spellcheck="false" placeholder="${esc(t("tm_ph"))}">
        <button class="tm-go" data-target id="tmGo">&lt;GO&gt;</button>
      </div>
      <div class="tm-menu mono">${menu.map(([n, c]) => `<span class="tm-mi" data-cmd="${c}">${n})&lt;${c}&gt;</span>`).join("")}<span class="tm-mi tm-dim" data-cmd="HELP">8)&lt;MENU&gt;</span></div>
      <div class="tm-grid">
        <div class="tm-left">
          <div class="tm-panel">
            <div class="tm-ph">${esc(t("tm_monitor"))}</div>
            <div class="tm-thead mono"><span>TICKER</span><span>LAST</span><span>NET</span><span>%CHG</span></div>
            <div class="tm-mon" id="tmMon">${MONITOR.map(monRow).join("")}</div>
          </div>
          <div class="tm-panel"><div class="tm-ph">${esc(t("tm_fng"))}</div><div class="tm-fng mono" id="tmFng">—</div></div>
          <div class="tm-panel"><div class="tm-ph">${esc(t("tm_world"))}</div><div class="tm-exch mono" id="tmExch"></div></div>
        </div>
        <div class="tm-main" id="tmMain"></div>
      </div>
      <div class="tm-tape" id="tmTape"></div>
      <div class="tm-status mono"><span><b>NIKOLAI</b> TERMINAL</span><span class="tm-dim" id="tmStatus">${esc(t("tm_ready"))}</span><span class="tm-dim">↑/↓ ${esc(t("tm_histHint"))}</span></div>
    </div>`;

  const input = body.querySelector("#tmIn");
  const run = () => { const v = input.value.trim(); if (!v) return; state.hist.unshift(v); state.hi = -1; input.value = ""; status(v.toUpperCase()); exec(v); };
  body.querySelector("#tmGo").addEventListener("click", run);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); run(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (state.hi < state.hist.length - 1) input.value = state.hist[++state.hi] || ""; }
    else if (e.key === "ArrowDown") { e.preventDefault(); if (state.hi > 0) input.value = state.hist[--state.hi] || ""; else { state.hi = -1; input.value = ""; } }
  });
  // Delegación: cualquier elemento con data-cmd (menú, cabecera, teclas) ejecuta su comando.
  body.querySelector(".tm").addEventListener("click", (e) => { const b = e.target.closest("[data-cmd]"); if (b) { status(b.dataset.cmd); exec(b.dataset.cmd); } });
  setTimeout(() => input.focus(), 60);

  if (navigator.onLine) tvWidget(body.querySelector("#tmTape"), "ticker-tape", { symbols: TAPE, showSymbolLogo: false, isTransparent: true, displayMode: "compact", colorTheme: "dark", locale: ctx.lang || "es" });

  patchMonitor(); patchFng(); patchExch(); tickClock();
  clock = setInterval(() => { tickClock(); patchExch(); }, 1000);
  unsub = onMarket(patchMonitor);
  home();
}

function status(txt) { const el = bodyRef?.querySelector("#tmStatus"); if (el) el.textContent = `» ${txt}`; }
function monRow([label, pair]) {
  return `<div class="tm-trow" data-pair="${pair}" data-cmd="${label}">
    <span class="tm-sym">${label}</span><span class="tm-px mono">—</span><span class="tm-net mono">—</span><span class="tm-chg mono">—</span></div>`;
}
function patchMonitor() {
  if (!bodyRef || !bodyRef.isConnected) return stopTerminal();
  for (const [, pair] of MONITOR) {
    const row = bodyRef.querySelector(`.tm-trow[data-pair="${pair}"]`); if (!row) continue;
    const live = market.live[pair]; if (!live) continue;
    const px = row.querySelector(".tm-px"), nt = row.querySelector(".tm-net"), chg = row.querySelector(".tm-chg");
    const prev = Number(px.dataset.v || 0);
    const n = net(live.price, live.change), cls = live.change >= 0 ? "up" : "down";
    px.textContent = fmtMoney(live.price); px.dataset.v = live.price;
    nt.textContent = (n >= 0 ? "+" : "") + n.toFixed(Math.abs(live.price) < 5 ? 4 : 2); nt.className = "tm-net mono " + cls;
    chg.textContent = fmtPct(live.change); chg.className = "tm-chg mono " + cls;
    if (prev && live.price !== prev) { row.classList.remove("flash", "up", "down"); void row.offsetWidth; row.classList.add("flash", live.price > prev ? "up" : "down"); }
  }
  if (gp$ && gp$.cv && gp$.cv.isConnected && pairOf(state.sym) && market.live[pairOf(state.sym)]) drawGP();
}
function patchFng() {
  const el = bodyRef?.querySelector("#tmFng"); if (!el) return;
  if (fearGreed.value == null) { setTimeout(patchFng, 1200); return; }
  const v = fearGreed.value;
  el.innerHTML = `<div class="tm-gauge"><b class="${v < 45 ? "down" : v > 55 ? "up" : "warn"}">${v}</b> ${ctxRef.esc(fearGreed.label || "")}</div><div class="tm-bar"><i style="left:${v}%"></i></div>`;
}
function patchExch() {
  const el = bodyRef?.querySelector("#tmExch"); if (!el) return;
  el.innerHTML = EXCHANGES.slice(0, 6).map((ex) => {
    const s = exchangeStatus(ex);
    const cls = s.state === "open" ? "up" : s.state === "pre" || s.state === "post" ? "warn" : "down";
    const dot = s.state === "open" ? "●" : "○";
    return `<div class="tm-exrow"><span>${ctxRef.esc(ex.name)}</span><span class="${cls}">${dot} ${ctxRef.t("ex_" + s.state)}</span><span class="tm-exc">${s.minutes != null ? fmtCountdown(s.minutes) : ""}</span></div>`;
  }).join("");
}
function tickClock() {
  const el = bodyRef?.querySelector("#tmClock"); if (!el) return;
  const now = new Date();
  const ny = now.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour12: false });
  el.textContent = `${now.toLocaleDateString(ctxRef.lang || "es", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}  ${ny} ET`;
}

// ---------- Ejecutor de comandos ----------
function exec(raw) {
  const tokens = raw.trim().toUpperCase().split(/\s+/);
  const first = tokens[0];
  if (FUNCS[first]) {
    const fn = FUNCS[first];
    if (fn === "des" || fn === "gp" || fn === "quote") { if (tokens[1]) state.sym = tokens[1]; return ({ des, gp, quote }[fn])(); }
    return ({ help, home, news: newsView, wei }[fn])();
  }
  if (/^[A-Z0-9.:/-]{1,12}$/.test(first)) {
    state.sym = first;
    const f = tokens[1];
    if (f === "DES") return des();
    if (f === "GP" || f === "GIP") return gp();
    if (f === "Q") return quote();
    return security();
  }
  aiQuery(raw);
}
function out(html) { const m = bodyRef?.querySelector("#tmMain"); if (m) { m.innerHTML = html; m.scrollTop = 0; } return bodyRef?.querySelector("#tmMain"); }
const esc2 = (s) => ctxRef.esc(s);

// ---------- Inicio / monitor ----------
function home() {
  const { t, esc } = ctxRef;
  out(`<div class="tm-hero mono">
      <div class="tm-art">NIKOLAI&lt;GO&gt; · ${esc(t("tm_overview")).toUpperCase()}</div>
      <p>${esc(t("tm_welcome"))}</p>
      <p class="tm-dim">${esc(t("tm_tryp"))}</p>
    </div>
    <div class="tm-two">
      <div class="tm-panel"><div class="tm-ph">MOV · ${esc(t("tm_movers"))}</div><div class="tm-movers mono" id="tmMov"></div></div>
      <div class="tm-panel"><div class="tm-ph">N · ${esc(t("tm_topnews"))}</div><div class="tm-news mono" id="tmNews"></div></div>
    </div>
    <div class="tm-panel tm-grow"><div class="tm-ph">WEI · ${esc(t("tm_overview"))}</div><div id="tmWei" style="height:300px"></div></div>`);
  renderMovers(); loadHeadlines();
  if (navigator.onLine) overviewWidget("tmWei");
}
function overviewWidget(id) {
  tvWidget(bodyRef.querySelector("#" + id), "market-overview", {
    colorTheme: "dark", showChart: true, locale: ctxRef.lang || "es", isTransparent: true, dateRange: "1D",
    tabs: [{ title: "Índices", symbols: [{ s: "FOREXCOM:SPXUSD", d: "S&P 500" }, { s: "FOREXCOM:NSXUSD", d: "Nasdaq 100" }, { s: "FOREXCOM:DJI", d: "Dow 30" }, { s: "INDEX:NKY", d: "Nikkei" }, { s: "FOREXCOM:UKXGBP", d: "FTSE 100" }] },
      { title: "Cripto", symbols: [{ s: "BINANCE:BTCUSDT", d: "Bitcoin" }, { s: "BINANCE:ETHUSDT", d: "Ether" }, { s: "BINANCE:SOLUSDT", d: "Solana" }, { s: "BINANCE:BNBUSDT", d: "BNB" }] },
      { title: "FX · Materias", symbols: [{ s: "FX_IDC:USDMXN", d: "USD/MXN" }, { s: "FX:EURUSD", d: "EUR/USD" }, { s: "TVC:GOLD", d: "Oro" }, { s: "TVC:USOIL", d: "Petróleo" }] }],
  });
}
function renderMovers() {
  const el = bodyRef?.querySelector("#tmMov"); if (!el) return;
  const coins = market.coins.slice().filter((c) => typeof c.change === "number");
  if (!coins.length) { el.innerHTML = `<div class="tm-dim" style="padding:8px">${esc2(ctxRef.t("tm_loading"))}</div>`; setTimeout(renderMovers, 1500); return; }
  const up = coins.slice().sort((a, b) => b.change - a.change).slice(0, 4);
  const dn = coins.slice().sort((a, b) => a.change - b.change).slice(0, 4);
  const row = (c) => `<div class="tm-trow" data-cmd="${(c.symbol || "").toUpperCase()}"><span class="tm-sym">${(c.symbol || "").toUpperCase()}</span><span class="tm-px mono">${fmtMoney(c.price)}</span><span class="tm-chg mono ${c.change >= 0 ? "up" : "down"}">${fmtPct(c.change)}</span></div>`;
  el.innerHTML = `<div class="tm-mlabel up">▲ ${esc2(ctxRef.t("tm_gainers"))}</div>${up.map(row).join("")}<div class="tm-mlabel down">▼ ${esc2(ctxRef.t("tm_losers"))}</div>${dn.map(row).join("")}`;
}
async function loadHeadlines() {
  const el = bodyRef?.querySelector("#tmNews"); if (!el) return;
  if (!news.items.length) { await loadFeed(ctxRef.lang).catch(() => {}); }
  const hs = headlines(7);
  el.innerHTML = hs.length ? hs.map((h, i) => `<div class="tm-nrow"><span class="tm-num">${i + 1})</span> ${ctxRef.esc(h)}</div>`).join("") : `<div class="tm-dim" style="padding:8px">${ctxRef.esc(ctxRef.t("tm_nonews"))}</div>`;
}

// ---------- Valor / seguridad ----------
function secMenu() {
  const items = [["1", "GP"], ["2", "GIP"], ["3", "DES"], ["4", "TOP"], ["5", "Q"]];
  return `<div class="tm-smenu mono">${items.map(([n, c]) => `<span class="tm-mi" data-cmd="${c}">${n})${c}</span>`).join("")}</div>`;
}
function secHeader() {
  const { t } = ctxRef;
  const sym = state.sym, pair = pairOf(sym), coin = coinOf(sym);
  let px = "—", chg = "", cls = "", nt = "";
  const live = pair && market.live[pair];
  if (live) { px = fmtMoney(live.price); chg = fmtPct(live.change); nt = (net(live.price, live.change) >= 0 ? "+" : "") + net(live.price, live.change).toFixed(2); cls = live.change >= 0 ? "up" : "down"; }
  else if (coin) { px = fmtMoney(coin.price); chg = fmtPct(coin.change); cls = coin.change >= 0 ? "up" : "down"; }
  const kind = CRYPTO.has(sym) ? "Crypto Curncy" : (coin ? "Crypto" : t("tm_equity"));
  return `<div class="tm-sechead">
    <b>${ctxRef.esc(sym)}</b> <span class="tm-dim">${ctxRef.esc(kind)}</span>
    <span class="tm-secpx mono ${cls}">${px} <small>${nt} ${chg}</small></span></div>${secMenu()}`;
}
function quoteTable() {
  const { t, esc } = ctxRef;
  const sym = state.sym, coin = coinOf(sym), pair = pairOf(sym), live = pair && market.live[pair];
  if (!coin && !live) return `<div class="tm-ai mono tm-dim">${esc(t("tm_noQuote"))}</div>`;
  const price = live ? live.price : coin.price, chg = live ? live.change : coin.change;
  const spark = coin?.spark || [];
  const hi = spark.length ? Math.max(...spark) : null, lo = spark.length ? Math.min(...spark) : null;
  const rows = [
    [t("tm_q_name"), coin?.name || sym], [t("tm_q_last"), fmtMoney(price)],
    [t("tm_q_net"), (net(price, chg) >= 0 ? "+" : "") + fmtMoney(net(price, chg))],
    [t("tm_q_chg"), fmtPct(chg)],
    [t("tm_q_hi"), hi != null ? fmtMoney(hi) : "—"], [t("tm_q_lo"), lo != null ? fmtMoney(lo) : "—"],
    [t("tm_q_cap"), coin?.cap ? "$" + Intl.NumberFormat("en", { notation: "compact" }).format(coin.cap) : "—"],
  ];
  return `<div class="tm-quote mono">${rows.map(([k, v], i) => `<div class="tm-qrow"><span class="tm-qk">${esc(k)}</span><span class="tm-qv ${i === 3 ? (chg >= 0 ? "up" : "down") : ""}">${esc(v)}</span></div>`).join("")}</div>`;
}
function security() {
  const { t } = ctxRef;
  out(`${secHeader()}
    <div class="tm-two">
      <div class="tm-panel"><div class="tm-ph">DES · ${ctxRef.esc(state.sym)}</div>${quoteTable()}</div>
      <div class="tm-panel"><div class="tm-ph">${esc2(t("tm_tech"))}</div><div id="tmTA" style="height:300px"></div></div>
    </div>
    <div class="tm-panel tm-grow"><div class="tm-ph">GP · ${ctxRef.esc(state.sym)} · ${esc2(t("tm_daily"))}</div><div id="tmChart" style="height:320px"></div></div>
    <div class="tm-panel"><div class="tm-ph">DES · NIKOLAI</div><div class="tm-ai mono" id="tmDes"><button class="tm-fk" data-cmd="DES">▸ ${esc2(t("tm_askAi"))}</button></div></div>`);
  mountChart("tmChart");
  if (navigator.onLine) tvWidget(bodyRef.querySelector("#tmTA"), "technical-analysis", { symbol: tvSym(state.sym), interval: "1D", showIntervalTabs: true, displayMode: "single", colorTheme: "dark", isTransparent: true, locale: ctxRef.lang || "es" });
}
function quote() {
  out(`${secHeader()}<div class="tm-panel"><div class="tm-ph">Q · ${ctxRef.esc(state.sym)}</div>${quoteTable()}</div>
    <div class="tm-panel tm-grow"><div class="tm-ph">GIP · ${ctxRef.esc(state.sym)}</div><div id="tmChart" style="height:320px"></div></div>`);
  mountChart("tmChart");
}
function gp() { out(`${secHeader()}<div class="tm-panel tm-grow"><div class="tm-ph">GP · ${ctxRef.esc(state.sym)} · ${esc2(ctxRef.t("tm_price"))}</div><div id="tmChart" style="height:460px"></div></div>`); mountChart("tmChart"); }

// ---------- Gráfica nativa estilo Bloomberg (ámbar sobre negro) ----------
let gp$ = null;
function seriesFor(sym) {
  const coin = coinOf(sym), pair = pairOf(sym), live = pair && market.live[pair];
  let s = [];
  if (sym === "BTC" && market.btcSeries.length > 8) s = market.btcSeries.slice();
  else if (coin?.spark?.length) s = coin.spark.slice();
  if (s.length && live) s = s.concat(live.price); // añade el precio en vivo al final
  return s;
}
function mountChart(id) {
  const el = bodyRef?.querySelector("#" + id); if (!el) return;
  if (gp$?.ro) { gp$.ro.disconnect(); } gp$ = null;
  const series = seriesFor(state.sym);
  if (series.length > 6) {            // gráfica nativa Bloomberg cuando hay datos (cripto)
    el.innerHTML = `<canvas class="tm-gp" id="${id}Cv"></canvas><div class="tm-gpcross" id="${id}Cr" hidden></div>`;
    const cv = el.querySelector("canvas");
    gp$ = { el, cv, id };
    drawGP();
    const ro = new ResizeObserver(() => drawGP()); ro.observe(el); gp$.ro = ro;
    cv.addEventListener("mousemove", onCross); cv.addEventListener("mouseleave", () => { const c = el.querySelector(".tm-gpcross"); if (c) c.hidden = true; drawGP(); });
    return;
  }
  if (!navigator.onLine) { el.innerHTML = `<div class="tm-dim mono" style="padding:16px">${ctxRef.esc(ctxRef.t("tm_offline"))}</div>`; return; }
  // Acciones sin histórico local: TradingView con tema ámbar/negro tipo Bloomberg.
  tvWidget(el, "advanced-chart", { symbol: tvSym(state.sym), interval: "D", timezone: "America/New_York", style: "2", allow_symbol_change: true, autosize: true, studies: ["Volume@tv-basicstudies"], theme: "dark", backgroundColor: "#000000", gridColor: "rgba(255,176,0,0.07)", locale: ctxRef.lang || "es",
    overrides: { "mainSeriesProperties.lineStyle.color": "#ffb000", "mainSeriesProperties.areaStyle.color1": "rgba(255,176,0,0.25)", "mainSeriesProperties.areaStyle.color2": "rgba(255,176,0,0.02)", "mainSeriesProperties.areaStyle.linecolor": "#ffb000", "scalesProperties.textColor": "#ffb000", "paneProperties.background": "#000000", "paneProperties.vertGridProperties.color": "rgba(255,176,0,0.06)", "paneProperties.horzGridProperties.color": "rgba(255,176,0,0.06)" } });
}
function drawGP(cross) {
  if (!gp$ || !gp$.cv || !gp$.cv.isConnected) return;
  const cv = gp$.cv, el = gp$.el;
  const series = seriesFor(state.sym); if (series.length < 2) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = el.clientWidth, H = el.clientHeight || 300;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const padL = 10, padR = 62, padT = 14, padB = 22;
  const x0 = padL, x1 = W - padR, y0 = padT, y1 = H - padB;
  let lo = Math.min(...series), hi = Math.max(...series); const span = hi - lo || hi || 1;
  lo -= span * 0.08; hi += span * 0.08; const rng = hi - lo;
  const X = (i) => x0 + (i / (series.length - 1)) * (x1 - x0);
  const Y = (v) => y1 - ((v - lo) / rng) * (y1 - y0);
  const up = series[series.length - 1] >= series[0];
  const line = up ? "#3dfb8b" : "#ff4d4d", amb = "rgba(255,176,0,.55)", ambF = "rgba(255,176,0,.10)";
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  g.font = "10px ui-monospace, Menlo, monospace"; g.textBaseline = "middle";
  // Rejilla + etiquetas de precio (derecha)
  g.strokeStyle = ambF; g.fillStyle = amb; g.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const v = hi - (i / 4) * rng, y = Y(v);
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    g.textAlign = "left"; g.fillText(fmtMoney(v), x1 + 5, y);
  }
  // Rejilla vertical + etiquetas de tiempo (abajo)
  const labels = ["-7D", "-5D", "-3D", "-1D", "NOW"];
  g.textAlign = "center";
  for (let i = 0; i <= 4; i++) {
    const x = x0 + (i / 4) * (x1 - x0);
    g.strokeStyle = ambF; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
    g.fillStyle = amb; g.fillText(labels[i], x, y1 + 11);
  }
  // Área bajo la línea
  g.beginPath(); g.moveTo(X(0), Y(series[0]));
  for (let i = 1; i < series.length; i++) g.lineTo(X(i), Y(series[i]));
  g.lineTo(X(series.length - 1), y1); g.lineTo(X(0), y1); g.closePath();
  const grad = g.createLinearGradient(0, y0, 0, y1); grad.addColorStop(0, up ? "rgba(61,251,139,.22)" : "rgba(255,77,77,.20)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad; g.fill();
  // Línea de precio con brillo de fósforo
  g.beginPath(); g.moveTo(X(0), Y(series[0]));
  for (let i = 1; i < series.length; i++) g.lineTo(X(i), Y(series[i]));
  g.shadowColor = line; g.shadowBlur = 6; g.strokeStyle = line; g.lineWidth = 1.6; g.stroke(); g.shadowBlur = 0;
  // Máx/mín punteados
  g.setLineDash([3, 3]); g.strokeStyle = "rgba(255,176,0,.35)";
  for (const v of [Math.max(...series), Math.min(...series)]) { const y = Y(v); g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
  g.setLineDash([]);
  // Etiqueta de último precio (tag en el eje derecho)
  const last = series[series.length - 1], ly = Y(last);
  g.fillStyle = line; g.fillRect(x1, ly - 8, padR, 16);
  g.fillStyle = "#000"; g.textAlign = "center"; g.font = "bold 10px ui-monospace, Menlo, monospace";
  g.fillText(fmtMoney(last), x1 + padR / 2, ly);
  g.beginPath(); g.arc(X(series.length - 1), ly, 2.5, 0, 7); g.fillStyle = line; g.fill();
  // Crosshair
  if (cross && cross.i != null) {
    const i = cross.i, x = X(i), y = Y(series[i]);
    g.strokeStyle = "rgba(255,176,0,.5)"; g.setLineDash([2, 2]);
    g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); g.setLineDash([]);
    g.fillStyle = "#ffb000"; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill();
    const box = gp$.el.querySelector(".tm-gpcross");
    if (box) { box.hidden = false; box.textContent = fmtMoney(series[i]); box.style.left = Math.min(W - 70, x + 8) + "px"; box.style.top = Math.max(2, y - 26) + "px"; }
  }
}
function onCross(e) {
  if (!gp$) return;
  const series = seriesFor(state.sym); if (series.length < 2) return;
  const r = gp$.cv.getBoundingClientRect();
  const W = gp$.el.clientWidth, x0 = 10, x1 = W - 62;
  const rel = (e.clientX - r.left - x0) / (x1 - x0);
  const i = Math.max(0, Math.min(series.length - 1, Math.round(rel * (series.length - 1))));
  drawGP({ i });
}
async function des() {
  const host = out(`${secHeader()}<div class="tm-two">
      <div class="tm-panel"><div class="tm-ph">Q · ${ctxRef.esc(state.sym)}</div>${quoteTable()}</div>
      <div class="tm-panel tm-grow"><div class="tm-ph">DES · NIKOLAI · ${ctxRef.esc(state.sym)}</div><div class="tm-ai mono" id="tmDes">${ctxRef.esc(ctxRef.t("tm_thinking"))}<span class="tm-blink">▊</span></div></div>
    </div>`);
  const el = host.querySelector("#tmDes");
  const msg = ctxRef.t("tm_desPrompt").replace(/\{s\}/g, state.sym);
  let full = "";
  try {
    await ctxRef.stream({ messages: [{ role: "user", content: msg }], mode: "market", channel: "text", symbol: tvSym(state.sym) }, { onText: (d) => { full += d; el.textContent = full; } });
    if (!full) el.textContent = ctxRef.t("errGeneric");
  } catch { el.textContent = ctxRef.t("errGeneric"); }
}
async function aiQuery(raw) {
  const host = out(`<div class="tm-panel tm-grow"><div class="tm-ph">NIKOLAI · IA</div><div class="tm-ai mono" id="tmAi">${ctxRef.esc(ctxRef.t("tm_thinking"))}<span class="tm-blink">▊</span></div></div>`);
  const el = host.querySelector("#tmAi"); let full = "";
  try {
    await ctxRef.stream({ messages: [{ role: "user", content: raw }], mode: "market", channel: "text" }, { onText: (d) => { full += d; el.textContent = full; } });
    if (!full) el.textContent = ctxRef.t("errGeneric");
  } catch { el.textContent = ctxRef.t("errGeneric"); }
}
function newsView() {
  const { t } = ctxRef;
  out(`<div class="tm-panel"><div class="tm-ph">TOP · ${esc2(t("tm_topnews"))}</div><div class="tm-news mono" id="tmNews"></div></div>
    <div class="tm-panel tm-grow"><div class="tm-ph">NW · ${esc2(t("tm_wire"))}</div><div id="tmWire" style="height:340px"></div></div>`);
  loadHeadlines();
  if (navigator.onLine) tvWidget(bodyRef.querySelector("#tmWire"), "timeline", { feedMode: "market", market: "stock", displayMode: "regular", colorTheme: "dark", isTransparent: true, locale: ctxRef.lang || "es" });
}
function wei() {
  const { t } = ctxRef;
  out(`<div class="tm-panel tm-grow"><div class="tm-ph">WEI · ${esc2(t("tm_world"))}</div><div id="tmWei" style="height:520px"></div></div>`);
  if (navigator.onLine) tvWidget(bodyRef.querySelector("#tmWei"), "market-overview", {
    colorTheme: "dark", showChart: true, locale: ctxRef.lang || "es", isTransparent: true, dateRange: "1D",
    tabs: [{ title: "América", symbols: [{ s: "FOREXCOM:SPXUSD", d: "S&P 500" }, { s: "FOREXCOM:NSXUSD", d: "Nasdaq 100" }, { s: "FOREXCOM:DJI", d: "Dow 30" }, { s: "INDEX:TSX", d: "TSX" }, { s: "BMV:ME", d: "IPC México" }] },
      { title: "Europa", symbols: [{ s: "FOREXCOM:UKXGBP", d: "FTSE 100" }, { s: "INDEX:DAX", d: "DAX" }, { s: "INDEX:CAC40", d: "CAC 40" }, { s: "INDEX:IBEX35", d: "IBEX 35" }] },
      { title: "Asia", symbols: [{ s: "INDEX:NKY", d: "Nikkei 225" }, { s: "INDEX:HSI", d: "Hang Seng" }, { s: "SSE:000001", d: "Shanghai" }, { s: "INDEX:SENSEX", d: "Sensex" }] }],
  });
}
function help() {
  const { t, esc } = ctxRef;
  const rows = [
    ["AAPL", t("tm_h_sym")], ["BTC", t("tm_h_crypto")], ["DES AAPL", t("tm_h_des")], ["GP TSLA", t("tm_h_gp")],
    ["WEI", t("tm_h_wei")], ["TOP / N", t("tm_h_news")], ["MON", t("tm_h_mon")], ["Q BTC", t("tm_h_q")],
    [t("tm_h_freeHdr"), t("tm_h_free")],
  ];
  out(`<div class="tm-panel"><div class="tm-ph">HELP · ${esc2(t("tm_cmdref"))}</div><div class="tm-help mono">
    ${rows.map(([c, d], i) => `<div class="tm-hrow"><span class="tm-num">${i + 1})</span><span class="tm-cmd-k">${esc(c)}</span><span>${esc(d)}</span></div>`).join("")}
    <p class="tm-dim">${esc(t("tm_helpFoot"))}</p>
  </div></div>`);
}

export function termSummary() {
  const btc = market.live.BTCUSDT;
  return { price: btc ? fmtMoney(btc.price) : "—", chg: btc ? btc.change : null };
}
export function stopTerminal() { clearInterval(clock); if (unsub) { unsub(); unsub = null; } if (gp$?.ro) { gp$.ro.disconnect(); } gp$ = null; }
