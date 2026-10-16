// Exchanges soportados (vía ccxt) y creación de conexiones.

import ccxt from "ccxt";

// spot / futures = id de ccxt para cada mercado (null = no disponible).
export const VENUES = {
  binance:  { name: "Binance",  url: "https://www.binance.com",  spot: "binance",  futures: "binanceusdm",   maxLev: 125, quote: "USDT", keysUrl: "https://www.binance.com/es/my/settings/api-management" },
  bitso:    { name: "Bitso",    url: "https://bitso.com",        spot: "bitso",    futures: null,            maxLev: 1,   quote: "MXN",  keysUrl: "https://bitso.com/developers" },
  kucoin:   { name: "KuCoin",   url: "https://www.kucoin.com",   spot: "kucoin",   futures: "kucoinfutures", maxLev: 100, quote: "USDT", keysUrl: "https://www.kucoin.com/account/api", passphrase: true },
  kraken:   { name: "Kraken",   url: "https://www.kraken.com",   spot: "kraken",   futures: "krakenfutures", maxLev: 50,  quote: "USD",  keysUrl: "https://www.kraken.com/u/security/api" },
  bybit:    { name: "Bybit",    url: "https://www.bybit.com",    spot: "bybit",    futures: "bybit",         maxLev: 100, quote: "USDT", keysUrl: "https://www.bybit.com/app/user/api-management" },
  okx:      { name: "OKX",      url: "https://www.okx.com",      spot: "okx",      futures: "okx",           maxLev: 100, quote: "USDT", keysUrl: "https://www.okx.com/account/my-api", passphrase: true },
  bitget:   { name: "Bitget",   url: "https://www.bitget.com",   spot: "bitget",   futures: "bitget",        maxLev: 125, quote: "USDT", keysUrl: "https://www.bitget.com/account/newapi", passphrase: true },
  mexc:     { name: "MEXC",     url: "https://www.mexc.com",     spot: "mexc",     futures: "mexc",          maxLev: 200, quote: "USDT", keysUrl: "https://www.mexc.com/user/openapi" },
  coinbase: { name: "Coinbase", url: "https://www.coinbase.com", spot: "coinbase", futures: null,            maxLev: 1,   quote: "USD",  keysUrl: "https://www.coinbase.com/settings/api" },
};

export const venueList = () => Object.entries(VENUES).map(([id, v]) => ({
  id, name: v.name, url: v.url, keysUrl: v.keysUrl, futures: Boolean(v.futures), maxLev: v.maxLev, quote: v.quote, passphrase: Boolean(v.passphrase),
}));

// "BTC/USDT" → en futuros perpetuos "BTC/USDT:USDT".
export function marketSymbol(symbol, market) {
  const s = String(symbol || "").toUpperCase().replace(/\s/g, "");
  if (market !== "futures" || s.includes(":")) return s;
  const [, quote] = s.split("/");
  return quote ? `${s}:${quote}` : s;
}

const cache = new Map();

// Para pruebas: permite inyectar un exchange falso (ver scripts/quant-selftest.mjs).
let factory = (ccxtId, opts) => new ccxt[ccxtId](opts);
export function setExchangeFactory(fn) { factory = fn; cache.clear(); }

export function connect(venueId, market, creds) {
  const v = VENUES[venueId];
  if (!v) throw new Error(`Exchange desconocido: ${venueId}`);
  const ccxtId = market === "futures" ? v.futures : v.spot;
  if (!ccxtId) throw new Error(`${v.name} no ofrece futuros con apalancamiento`);
  const cacheKey = `${venueId}:${market}:${creds?.apiKey || "public"}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const opts = { enableRateLimit: true, timeout: 20000, options: {} };
  if (market === "futures" && ["bybit", "okx", "bitget", "mexc"].includes(ccxtId)) opts.options.defaultType = "swap";
  if (creds?.apiKey) {
    opts.apiKey = creds.apiKey;
    opts.secret = creds.secret;
    if (creds.password) opts.password = creds.password;
  }
  const ex = factory(ccxtId, opts);
  if (process.env.QUANT_PROXY) ex.httpsProxy = process.env.QUANT_PROXY;
  if (process.env.QUANT_SANDBOX === "1" && ex.has?.sandbox !== false && typeof ex.setSandboxMode === "function") {
    try { ex.setSandboxMode(true); } catch { /* sin testnet */ }
  }
  cache.set(cacheKey, ex);
  return ex;
}

export function forget(venueId) {
  for (const k of cache.keys()) if (k.startsWith(venueId + ":") && !k.endsWith(":public")) cache.delete(k);
}

export async function candles(ex, symbol, timeframe, limit = 250) {
  const raw = await ex.fetchOHLCV(symbol, timeframe, undefined, limit);
  return raw.map(([t, o, h, l, c, v]) => ({ t, o, h, l, c, v }));
}
