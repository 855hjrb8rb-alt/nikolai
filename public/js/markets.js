// Bolsa y criptomonedas en tiempo real.
// - Cripto: lista de CoinGecko + precios en vivo por WebSocket de Binance (cada segundo).
// - Acciones, mapa de calor, gráficos y noticias del mercado: widgets gratuitos de TradingView.

const COINGECKO = "https://api.coingecko.com/api/v3/coins/markets";
const BINANCE_WS = "wss://stream.binance.com:9443/stream?streams=";
const STABLE = new Set(["usdt", "usdc", "dai", "fdusd", "tusd", "usde", "busd", "pyusd", "usds"]);

export const market = {
  // Última lista guardada: sirve sin internet (con su hora).
  coins: (() => { try { return JSON.parse(localStorage.getItem("nikolai.coins"))?.coins || []; } catch { return []; } })(),        // [{id, symbol, name, image, price, change, spark, pair}]
  live: {},         // par BINANCE -> {price, change}
  btcSeries: [],    // historial reciente de BTC para la tarjeta
  updatedAt: (() => { try { return JSON.parse(localStorage.getItem("nikolai.coins"))?.at || 0; } catch { return 0; } })(),
  error: "",
  currency: "usd",
};

let ws = null, wsPairs = "", listeners = new Set();
export const onMarket = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn());

export async function loadCoins(currency = market.currency) {
  market.currency = currency;
  try {
    const url = `${COINGECKO}?vs_currency=${currency}&order=market_cap_desc&per_page=40&page=1&sparkline=true&price_change_percentage=24h`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    market.coins = data
      .filter((c) => !STABLE.has(c.symbol))
      .slice(0, 30)
      .map((c) => ({
        id: c.id, symbol: c.symbol.toUpperCase(), name: c.name, image: c.image,
        price: c.current_price, change: c.price_change_percentage_24h ?? 0,
        spark: c.sparkline_in_7d?.price || [], cap: c.market_cap,
        pair: `${c.symbol.toUpperCase()}USDT`,
      }));
    market.updatedAt = Date.now();
    market.error = "";
    try { localStorage.setItem("nikolai.coins", JSON.stringify({ coins: market.coins.map(({ spark, ...c }) => ({ ...c, spark: spark.filter((_, i) => i % 4 === 0) })), at: market.updatedAt })); } catch { /* lleno */ }
    connectLive();
  } catch (e) {
    market.error = e.message;
  }
  emit();
}

/** Precios en vivo (USD) por WebSocket. Si no hay lista aún, sigue al menos BTC y ETH. */
export function connectLive() {
  const pairs = (market.coins.length ? market.coins.map((c) => c.pair) : ["BTCUSDT", "ETHUSDT"]).slice(0, 30);
  const key = pairs.join(",");
  if (ws && wsPairs === key && ws.readyState <= 1) return;
  try { ws?.close(); } catch { /* ya cerrado */ }
  wsPairs = key;
  ws = new WebSocket(BINANCE_WS + pairs.map((p) => `${p.toLowerCase()}@miniTicker`).join("/"));
  ws.onmessage = (e) => {
    const d = JSON.parse(e.data)?.data;
    if (!d?.s) return;
    const price = Number(d.c), open = Number(d.o);
    market.live[d.s] = { price, change: open ? ((price - open) / open) * 100 : 0, at: Date.now() };
    if (d.s === "BTCUSDT") {
      market.btcSeries.push(price);
      if (market.btcSeries.length > 90) market.btcSeries.shift();
    }
    emit();
  };
  ws.onclose = () => { setTimeout(() => wsPairs === key && connectLive(), 5000); };
}

export function fmtMoney(v, currency = "usd") {
  if (v == null || Number.isNaN(v)) return "—";
  const digits = v >= 1000 ? 0 : v >= 1 ? 2 : 5;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: digits }).format(v);
  } catch {
    return `$${v.toFixed(digits)}`;
  }
}
export const fmtPct = (v) => `${v >= 0 ? "+" : ""}${(v ?? 0).toFixed(2)}%`;

/** Precio actual de una moneda: en vivo (USD) si hay, si no el de CoinGecko. */
export function priceOf(coin) {
  const live = market.currency === "usd" ? market.live[coin.pair] : null;
  return { price: live?.price ?? coin.price, change: live?.change ?? coin.change, live: Boolean(live) };
}

function sparkSvg(points, up) {
  if (points.length < 2) return "";
  const step = Math.max(1, Math.floor(points.length / 60));
  const pts = points.filter((_, i) => i % step === 0);
  const min = Math.min(...pts), max = Math.max(...pts);
  const d = pts.map((p, i) => `${((i / (pts.length - 1)) * 100).toFixed(1)},${(28 - ((p - min) / (max - min || 1)) * 26).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 100 30" preserveAspectRatio="none" class="mk-spark ${up ? "up" : "down"}"><polyline points="${d}"/></svg>`;
}

// ---------- Widgets de TradingView ----------
export function tvWidget(el, name, config) {
  el.innerHTML = `<div class="tradingview-widget-container" style="height:100%;width:100%"><div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div></div>`;
  const s = document.createElement("script");
  s.src = `https://s3.tradingview.com/external-embedding/embed-widget-${name}.js`;
  s.async = true;
  s.textContent = JSON.stringify({ colorTheme: "dark", isTransparent: true, locale: "es", width: "100%", height: "100%", ...config });
  el.firstChild.appendChild(s);
}

import {
  EXCHANGES, exchangeStatus, fmtCountdown, wallClock, fearGreed, loadFearGreed, watchlist, addWatch, removeWatch, normalizeSymbol,
} from "./wallstreet.js";
import { renderInto, speakable } from "./md.js";

const TABS = ["wallst", "stocks", "movers", "heatmap", "screener", "chart", "watch", "calendar", "crypto", "news", "ai"];
const QUICK = ["NASDAQ:AAPL", "NASDAQ:NVDA", "NASDAQ:MSFT", "NASDAQ:AMZN", "NASDAQ:TSLA", "NYSE:JPM", "BMV:AMXB", "BINANCE:BTCUSDT"];
export const aiState = { text: "", busy: false, symbol: "" };

/** Barra de estado de las bolsas: abierta/cerrada y cuenta atrás. */
function exchangesHtml(t, esc) {
  return `<div class="ex-grid">${EXCHANGES.map((ex) => {
    const st = exchangeStatus(ex);
    const clock = wallClock(ex.tz);
    const hh = String(Math.floor(clock.min / 60)).padStart(2, "0"), mm = String(Math.floor(clock.min % 60)).padStart(2, "0");
    return `<div class="ex ${st.state}">
      <div class="ex-top mono"><b>${esc(ex.name)}</b><span class="ex-state">● ${esc(t("ex_" + st.state).toUpperCase())}</span></div>
      <div class="ex-clock mono">${hh}:${mm}</div>
      <div class="ex-sub mono">${esc(ex.city)} · ${esc(t(st.next === "close" ? "ex_closesIn" : "ex_opensIn"))} ${fmtCountdown(st.minutes)}</div>
    </div>`;
  }).join("")}</div>`;
}

/** Pinta el módulo de mercados. ctx = { t, esc, tile } */
export function renderMarkets(body, ctx, state) {
  const { t, esc, tile } = ctx;
  state.tab ??= "wallst";
  body.innerHTML = `
    <div class="tabs">${TABS.map((k) => tile(esc(t("mk_" + k)), "", state.tab === k ? "on" : "")).join("")}</div>
    <div class="mk-view" id="mkView"></div>`;
  body.querySelectorAll(".tabs .tile").forEach((el, i) => el.addEventListener("click", () => {
    state.tab = TABS[i];
    renderMarkets(body, ctx, state);
  }));
  const view = body.querySelector("#mkView");

  if (state.tab === "crypto") {
    const draw = () => {
      if (!view.isConnected) return;
      const cur = market.currency;
      const rows = market.coins.map((c, i) => {
        const p = priceOf(c);
        const up = p.change >= 0;
        return `<div class="mk-row" data-pair="${c.pair}">
          <span class="mk-rank mono">${i + 1}</span>
          <img src="${esc(c.image)}" alt="" loading="lazy" width="28" height="28">
          <span class="mk-name"><b>${esc(c.symbol)}</b><small>${esc(c.name)}</small></span>
          ${sparkSvg(c.spark, up)}
          <span class="mk-price mono">${fmtMoney(p.price, cur)}${p.live ? '<i class="live-dot"></i>' : ""}</span>
          <span class="mk-chg mono ${up ? "up" : "down"}">${fmtPct(p.change)}</span>
        </div>`;
      }).join("");
      view.innerHTML = `
        <div class="mk-head">
          <div class="tiles">${tile("USD", "", cur === "usd" ? "on" : "")}${tile("MXN", "", cur === "mxn" ? "on" : "")}${tile("EUR", "", cur === "eur" ? "on" : "")}</div>
          <p class="muted mono">${market.error ? esc(t("mk_error")) : `${esc(t("mk_liveNote"))} · ${market.updatedAt ? new Date(market.updatedAt).toLocaleTimeString() : "…"}`}</p>
        </div>
        <div class="mk-list">${rows || `<p class="muted">${esc(market.error ? t("mk_error") : t("loading"))}</p>`}</div>`;
      view.querySelectorAll(".mk-head .tile").forEach((el, i) => el.addEventListener("click", () => loadCoins(["usd", "mxn", "eur"][i])));
    };
    draw();
    if (!market.coins.length || Date.now() - market.updatedAt > 60_000) loadCoins();
    // Repinta como mucho 2 veces por segundo mientras el módulo esté abierto.
    let pending = false;
    const off = onMarket(() => {
      if (!view.isConnected) { off(); return; }
      if (pending) return;
      pending = true;
      setTimeout(() => { pending = false; draw(); }, 500);
    });
    return;
  }

  if (state.tab === "wallst") {
    const fg = fearGreed.value;
    view.innerHTML = `
      <div class="ws-tape" id="wsTape"></div>
      <div id="wsEx">${exchangesHtml(t, esc)}</div>
      <div class="ws-indices">${["FOREXCOM:SPXUSD|S&P 500", "FOREXCOM:NSXUSD|Nasdaq 100", "FOREXCOM:DJI|Dow Jones", "TVC:VIX|VIX"].map((x, i) => `<div class="ws-mini" id="wsMini${i}"></div>`).join("")}</div>
      <div class="ws-row">
        <div class="readout fg">
          <div class="k">${esc(t("fearGreed").toUpperCase())}</div>
          <div class="fg-bar"><i style="left:${fg ?? 50}%"></i></div>
          <div class="v">${fg ?? "—"} <small class="mono">${esc(fearGreed.label ? t("fg_" + fearGreed.label.replace(/\s+/g, "")) : "")}</small></div>
        </div>
        <div class="tiles ws-actions">
          ${tile(`${ctx.icon("send")}<br>${esc(t("ws_brief"))}`, "", "action")}
          ${tile(esc(ctx.bell.enabled ? t("ws_bellOn") : t("ws_bellOff")), esc(t("ws_bell").toUpperCase()), ctx.bell.enabled ? "on" : "")}
        </div>
      </div>`;
    tvWidget(view.querySelector("#wsTape"), "ticker-tape", {
      symbols: [
        { proName: "FOREXCOM:SPXUSD", title: "S&P 500" }, { proName: "FOREXCOM:NSXUSD", title: "Nasdaq 100" }, { proName: "FOREXCOM:DJI", title: "Dow" },
        { proName: "NASDAQ:AAPL" }, { proName: "NASDAQ:NVDA" }, { proName: "NASDAQ:MSFT" }, { proName: "NASDAQ:AMZN" }, { proName: "NASDAQ:GOOGL" },
        { proName: "NASDAQ:META" }, { proName: "NASDAQ:TSLA" }, { proName: "NYSE:JPM" }, { proName: "TVC:GOLD", title: "Oro" },
        { proName: "TVC:USOIL", title: "Petróleo" }, { proName: "FX_IDC:USDMXN", title: "USD/MXN" }, { proName: "BINANCE:BTCUSDT", title: "Bitcoin" },
      ],
      showSymbolLogo: true, displayMode: "adaptive", height: 46,
    });
    ["FOREXCOM:SPXUSD", "FOREXCOM:NSXUSD", "FOREXCOM:DJI", "TVC:VIX"].forEach((sym, i) =>
      tvWidget(view.querySelector(`#wsMini${i}`), "mini-symbol-overview", { symbol: sym, dateRange: "1D", trendLineColor: "rgba(255, 204, 92, 1)", underLineColor: "rgba(255, 204, 92, .15)", chartOnly: false, noTimeScale: false }));
    const [brief, bell] = view.querySelectorAll(".ws-actions .tile");
    brief.addEventListener("click", () => { state.tab = "ai"; aiState.symbol = ""; renderMarkets(body, ctx, state); runAnalysis(body, ctx, state, ""); });
    bell.addEventListener("click", () => { ctx.bell.toggle(); renderMarkets(body, ctx, state); });
    // Relojes en vivo sin recargar los widgets.
    const timer = setInterval(() => {
      const el = view.querySelector("#wsEx");
      if (!el) { clearInterval(timer); return; }
      el.innerHTML = exchangesHtml(t, esc);
    }, 15_000);
    loadFearGreed().then(() => { if (view.isConnected && fearGreed.value !== fg) renderMarkets(body, ctx, state); });
    return;
  }

  if (state.tab === "watch") {
    view.innerHTML = `
      <div class="form-row two">
        <input class="field mono" id="wlIn" placeholder="${esc(t("wl_add"))}" autocomplete="off" spellcheck="false">
        ${tile(esc(t("wl_addBtn")), "", "action")}
      </div>
      <div class="wl-chips">${watchlist.map((s) => `<span class="wl-chip mono">${esc(s)}<button data-target data-rm="${esc(s)}" aria-label="${esc(t("remove"))}">✕</button></span>`).join("")}</div>
      <div class="mk-widget" id="wlQuotes"></div>`;
    const input = view.querySelector("#wlIn");
    const add = () => { if (normalizeSymbol(input.value)) { addWatch(input.value); renderMarkets(body, ctx, state); } };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
    view.querySelector(".form-row .tile").addEventListener("click", add);
    view.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { removeWatch(b.dataset.rm); renderMarkets(body, ctx, state); }));
    if (watchlist.length) {
      tvWidget(view.querySelector("#wlQuotes"), "market-quotes", {
        symbolsGroups: [{ name: t("wl_title"), symbols: watchlist.map((s) => ({ name: s, displayName: s.split(":").pop() })) }],
        showSymbolLogo: true,
      });
    }
    return;
  }

  if (state.tab === "chart") {
    const sym = state.symbol || "NASDAQ:AAPL";
    view.innerHTML = `
      <div class="form-row two">
        <input class="field mono" id="symIn" placeholder="${esc(t("sym_search"))}" value="${esc(sym)}" autocomplete="off" spellcheck="false">
        ${tile(esc(t("search")), "", "action")}
      </div>
      <div class="tabs">${QUICK.map((s) => tile(esc(s.split(":")[1]), "", s === sym ? "on" : "")).join("")}</div>
      <div class="ws-symbol" id="symInfo"></div>
      <div class="ws-split">
        <div class="mk-widget" id="symChart"></div>
        <div class="ws-side">
          <div class="mk-widget small" id="symTA"></div>
          <div class="tiles">${tile(`${ctx.icon("send")}<br>${esc(t("sym_ai"))}`, "", "action")}${tile(esc(watchlist.includes(sym) ? t("wl_in") : t("wl_addBtn")), esc(t("wl_title").toUpperCase()), watchlist.includes(sym) ? "on" : "")}</div>
        </div>
      </div>
      <div class="ws-split">
        <div class="mk-widget small" id="symProfile"></div>
        <div class="mk-widget small" id="symFin"></div>
      </div>`;
    const go = (s) => { state.symbol = normalizeSymbol(s) || sym; renderMarkets(body, ctx, state); };
    const input = view.querySelector("#symIn");
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(input.value); });
    view.querySelector(".form-row .tile").addEventListener("click", () => go(input.value));
    view.querySelectorAll(".tabs .tile").forEach((el, i) => el.addEventListener("click", () => go(QUICK[i])));
    const [ai, fav] = view.querySelectorAll(".ws-side .tile");
    ai.addEventListener("click", () => { state.tab = "ai"; aiState.symbol = sym; renderMarkets(body, ctx, state); runAnalysis(body, ctx, state, sym); });
    fav.addEventListener("click", () => { watchlist.includes(sym) ? removeWatch(sym) : addWatch(sym); renderMarkets(body, ctx, state); });
    tvWidget(view.querySelector("#symInfo"), "symbol-info", { symbol: sym, height: 180 });
    tvWidget(view.querySelector("#symChart"), "advanced-chart", { symbol: sym, interval: "D", timezone: "America/New_York", style: "1", allow_symbol_change: true, autosize: true, studies: ["Volume@tv-basicstudies"] });
    tvWidget(view.querySelector("#symTA"), "technical-analysis", { symbol: sym, interval: "1D", showIntervalTabs: true, displayMode: "single" });
    tvWidget(view.querySelector("#symProfile"), "symbol-profile", { symbol: sym });
    tvWidget(view.querySelector("#symFin"), "financials", { symbol: sym, displayMode: "regular" });
    return;
  }

  if (state.tab === "ai") {
    view.innerHTML = `
      <div class="form-row two">
        <input class="field mono" id="aiSym" placeholder="${esc(t("ai_symbolHint"))}" value="${esc(aiState.symbol)}" autocomplete="off" spellcheck="false">
        ${tile(`${esc(aiState.busy ? t("thinking") : t("ai_run"))}`, "", "action" + (aiState.busy ? " live" : ""))}
      </div>
      <div class="tiles">${tile(esc(t("ws_brief")), "", "")}${tile(`${ctx.icon("speaker")}<br>${esc(t("readAloud"))}`, "", "")}</div>
      <div class="hw-out" id="aiOut"></div>
      <p class="muted">${esc(t("ai_disclaimer"))}</p>`;
    const out = view.querySelector("#aiOut");
    if (aiState.text) renderInto(out, aiState.text);
    else out.innerHTML = `<p class="muted">${esc(t("ai_hint"))}</p>`;
    const input = view.querySelector("#aiSym");
    const run = () => { aiState.symbol = normalizeSymbol(input.value); runAnalysis(body, ctx, state, aiState.symbol); };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
    view.querySelector(".form-row .tile").addEventListener("click", run);
    const [brief, read] = view.querySelectorAll(".tiles .tile");
    brief.addEventListener("click", () => { aiState.symbol = ""; runAnalysis(body, ctx, state, ""); });
    read.addEventListener("click", () => aiState.text && ctx.speak(speakable(aiState.text)));
    return;
  }

  view.classList.add("mk-widget");
  if (state.tab === "movers") {
    tvWidget(view, "hotlists", { exchange: "US", dateRange: "1D", showChart: true, showSymbolLogo: true, showFloatingTooltip: true, plotLineColorGrowing: "rgba(125, 255, 178, 1)", plotLineColorFalling: "rgba(255, 122, 144, 1)" });
    return;
  }
  if (state.tab === "calendar") {
    tvWidget(view, "events", { importanceFilter: "0,1", countryFilter: "us,mx,eu,gb,cn,jp" });
    return;
  }
  if (state.tab === "stocks") {
    tvWidget(view, "market-overview", {
      dateRange: "1D", showChart: true, showSymbolLogo: true, showFloatingTooltip: true,
      tabs: [
        { title: "Índices", symbols: [{ s: "FOREXCOM:SPXUSD", d: "S&P 500" }, { s: "FOREXCOM:NSXUSD", d: "Nasdaq 100" }, { s: "FOREXCOM:DJI", d: "Dow Jones" }, { s: "BMV:ME", d: "IPC México" }, { s: "INDEX:NKY", d: "Nikkei 225" }, { s: "INDEX:DEU40", d: "DAX" }] },
        { title: "Acciones", symbols: [{ s: "NASDAQ:AAPL" }, { s: "NASDAQ:MSFT" }, { s: "NASDAQ:NVDA" }, { s: "NASDAQ:AMZN" }, { s: "NASDAQ:GOOGL" }, { s: "NASDAQ:META" }, { s: "NASDAQ:TSLA" }, { s: "NYSE:BRK.B" }] },
        { title: "México", symbols: [{ s: "BMV:AMXB" }, { s: "BMV:WALMEX" }, { s: "BMV:GFNORTEO" }, { s: "BMV:FEMSAUBD" }, { s: "BMV:CEMEXCPO" }, { s: "BMV:GMEXICOB" }] },
        { title: "Divisas", symbols: [{ s: "FX_IDC:USDMXN", d: "USD/MXN" }, { s: "FX:EURUSD", d: "EUR/USD" }, { s: "FX_IDC:EURMXN", d: "EUR/MXN" }] },
        { title: "Materias primas", symbols: [{ s: "TVC:GOLD", d: "Oro" }, { s: "TVC:SILVER", d: "Plata" }, { s: "TVC:USOIL", d: "Petróleo WTI" }] },
      ],
    });
  } else if (state.tab === "screener") {
    tvWidget(view, "screener", { defaultColumn: "overview", defaultScreen: "most_capitalized", market: state.region || "america", showToolbar: true });
  } else if (state.tab === "heatmap") {
    tvWidget(view, "stock-heatmap", { dataSource: "SPX500", grouping: "sector", blockSize: "market_cap_basic", blockColor: "change", hasTopBar: true, isZoomEnabled: true, hasSymbolTooltip: true });
  } else if (state.tab === "news") {
    tvWidget(view, "timeline", { feedMode: "all_symbols", displayMode: "regular" });
  }
}

/** Pide a NIKOLAI un resumen de Wall Street (sin símbolo) o el análisis de una acción. */
async function runAnalysis(body, ctx, state, symbol) {
  if (aiState.busy) return;
  aiState.busy = true;
  aiState.text = "";
  if (state.tab === "ai") renderMarkets(body, ctx, state);
  let full = "";
  try {
    const err = await ctx.stream(
      { messages: [{ role: "user", content: symbol ? ctx.t("ai_promptSymbol").replace("{s}", symbol) : ctx.t("ai_promptBrief") }], mode: "market", channel: "text", symbol },
      { onText: (d) => {
        full += d;
        aiState.text = full;
        const out = body.querySelector("#aiOut");
        if (out) renderInto(out, full);
      } },
    );
    aiState.text = full || ctx.errorText(err);
  } catch {
    aiState.text = ctx.t("errGeneric");
  } finally {
    aiState.busy = false;
    if (body.isConnected && state.tab === "ai") renderMarkets(body, ctx, state);
  }
}
