// Indicadores técnicos sobre arrays de números (cierres, máximos, mínimos).

export function ema(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  let prev;
  values.forEach((v, i) => {
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  });
  return out;
}

export function sma(values, period) {
  return values.map((_, i) => {
    if (i < period - 1) return NaN;
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += values[j];
    return s / period;
  });
}

// RSI de Wilder.
export function rsi(values, period = 14) {
  const out = new Array(values.length).fill(NaN);
  if (values.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= period; loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function macd(values, fast = 12, slow = 26, signal = 9) {
  const f = ema(values, fast), s = ema(values, slow);
  const line = values.map((_, i) => f[i] - s[i]);
  const sig = ema(line, signal);
  return { line, signal: sig, hist: line.map((v, i) => v - sig[i]) };
}

export function atr(candles, period = 14) {
  const tr = candles.map((c, i) => i === 0 ? c.h - c.l
    : Math.max(c.h - c.l, Math.abs(c.h - candles[i - 1].c), Math.abs(c.l - candles[i - 1].c)));
  return ema(tr, period);
}

export function bollinger(values, period = 20, mult = 2) {
  const mid = sma(values, period);
  const up = [], lo = [];
  values.forEach((_, i) => {
    if (i < period - 1) { up.push(NaN); lo.push(NaN); return; }
    const slice = values.slice(i - period + 1, i + 1);
    const sd = Math.sqrt(slice.reduce((s, v) => s + (v - mid[i]) ** 2, 0) / period);
    up.push(mid[i] + mult * sd); lo.push(mid[i] - mult * sd);
  });
  return { mid, up, lo };
}

export const highest = (arr, n, end = arr.length) => Math.max(...arr.slice(Math.max(0, end - n), end));
export const lowest = (arr, n, end = arr.length) => Math.min(...arr.slice(Math.max(0, end - n), end));

// Resumen compacto para la IA y para el panel.
export function snapshot(candles) {
  const c = candles.map((x) => x.c);
  const last = c.length - 1;
  const m = macd(c);
  const bb = bollinger(c);
  const r = (v, d = 2) => Number.isFinite(v) ? Number(v.toFixed(d)) : null;
  return {
    price: c[last],
    change24: r(((c[last] - c[Math.max(0, last - 24)]) / c[Math.max(0, last - 24)]) * 100),
    ema9: r(ema(c, 9)[last]), ema21: r(ema(c, 21)[last]), ema50: r(ema(c, 50)[last]), ema200: r(ema(c, 200)[last]),
    rsi14: r(rsi(c)[last]),
    macd: r(m.line[last], 4), macdSignal: r(m.signal[last], 4), macdHist: r(m.hist[last], 4),
    bbUpper: r(bb.up[last]), bbLower: r(bb.lo[last]),
    atr14: r(atr(candles)[last]),
    high20: r(highest(candles.map((x) => x.h), 20)), low20: r(lowest(candles.map((x) => x.l), 20)),
  };
}
