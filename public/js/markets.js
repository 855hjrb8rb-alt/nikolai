// Bolsa y criptomonedas en tiempo real.
// - Cripto: lista de CoinGecko + precios en vivo por WebSocket de Binance (cada segundo).
// - Acciones, mapa de calor, gráficos y noticias del mercado: widgets gratuitos de TradingView.

const COINGECKO = "https://api.coingecko.com/api/v3/coins/markets";
const BINANCE_WS = "wss://stream.binance.com:9443/stream?streams=";
const STABLE = new Set(["usdt", "usdc", "dai", "fdusd", "tusd", "usde", "busd", "pyusd", "usds"]);

export const market = {
  coins: [],        // [{id, symbol, name, image, price, change, spark, pair}]
  live: {},         // par BINANCE -> {price, change}
  btcSeries: [],    // historial reciente de BTC para la tarjeta
  updatedAt: 0,
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
function tvWidget(el, name, config) {
  el.innerHTML = `<div class="tradingview-widget-container" style="height:100%;width:100%"><div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div></div>`;
  const s = document.createElement("script");
  s.src = `https://s3.tradingview.com/external-embedding/embed-widget-${name}.js`;
  s.async = true;
  s.textContent = JSON.stringify({ colorTheme: "dark", isTransparent: true, locale: "es", width: "100%", height: "100%", ...config });
  el.firstChild.appendChild(s);
}

const TABS = ["crypto", "stocks", "screener", "heatmap", "chart", "news"];

/** Pinta el módulo de mercados. ctx = { t, esc, tile } */
export function renderMarkets(body, ctx, state) {
  const { t, esc, tile } = ctx;
  state.tab ??= "crypto";
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

  view.classList.add("mk-widget");
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
  } else if (state.tab === "chart") {
    const sym = state.symbol || "NASDAQ:AAPL";
    view.classList.remove("mk-widget");
    view.innerHTML = `
      <div class="tiles">${["NASDAQ:AAPL", "NASDAQ:NVDA", "NASDAQ:TSLA", "BMV:AMXB", "BINANCE:BTCUSDT", "BINANCE:ETHUSDT", "FX_IDC:USDMXN"]
        .map((s) => tile(esc(s.split(":")[1]), "", s === sym ? "on" : "")).join("")}</div>
      <div class="mk-widget" id="mkChart"></div>`;
    view.querySelectorAll(".tile").forEach((el) => el.addEventListener("click", () => {
      state.symbol = ["NASDAQ:AAPL", "NASDAQ:NVDA", "NASDAQ:TSLA", "BMV:AMXB", "BINANCE:BTCUSDT", "BINANCE:ETHUSDT", "FX_IDC:USDMXN"]
        .find((s) => s.split(":")[1] === el.textContent.trim());
      renderMarkets(body, ctx, state);
    }));
    tvWidget(view.querySelector("#mkChart"), "advanced-chart", {
      symbol: sym, interval: "D", timezone: "Etc/UTC", style: "1", allow_symbol_change: true, hide_side_toolbar: false, autosize: true,
    });
  } else if (state.tab === "news") {
    tvWidget(view, "timeline", { feedMode: "all_symbols", displayMode: "regular" });
  }
}
