// Estrategias preprogramadas. Cada una recibe las velas CERRADAS y la posición
// actual y devuelve "long" | "short" | "close" | null (no hacer nada).
// "grid" y "dca" las gestiona el motor directamente (operan por niveles/lotes).

import { ema, rsi, macd, bollinger, highest, lowest } from "./indicators.js";

const crossUp = (a, b, i) => a[i - 1] <= b[i - 1] && a[i] > b[i];
const crossDown = (a, b, i) => a[i - 1] >= b[i - 1] && a[i] < b[i];

export const STRATEGIES = {
  trend: {
    name: "Tendencia EMA 9/21 + RSI",
    desc: "Entra cuando la EMA rápida cruza la lenta a favor de la tendencia (EMA 200) y el RSI no está agotado. Sale con el cruce contrario.",
    decide(candles, pos) {
      const c = candles.map((x) => x.c), i = c.length - 1;
      const f = ema(c, 9), s = ema(c, 21), t = ema(c, 200), r = rsi(c);
      if (pos?.side === "long" && crossDown(f, s, i)) return "close";
      if (pos?.side === "short" && crossUp(f, s, i)) return "close";
      if (pos) return null;
      if (crossUp(f, s, i) && c[i] > t[i] && r[i] < 70) return "long";
      if (crossDown(f, s, i) && c[i] < t[i] && r[i] > 30) return "short";
      return null;
    },
  },
  rsi: {
    name: "Reversión RSI + Bollinger",
    desc: "Compra en sobreventa (RSI<30 y bajo la banda inferior) y vende en sobrecompra (RSI>70 y sobre la superior). Cierra al volver a la media.",
    decide(candles, pos) {
      const c = candles.map((x) => x.c), i = c.length - 1;
      const r = rsi(c), bb = bollinger(c);
      if (pos?.side === "long" && (r[i] >= 55 || c[i] >= bb.mid[i])) return "close";
      if (pos?.side === "short" && (r[i] <= 45 || c[i] <= bb.mid[i])) return "close";
      if (pos) return null;
      if (r[i] < 30 && c[i] < bb.lo[i]) return "long";
      if (r[i] > 70 && c[i] > bb.up[i]) return "short";
      return null;
    },
  },
  breakout: {
    name: "Ruptura Donchian 20",
    desc: "Sigue rupturas: compra al superar el máximo de 20 velas y vende al perder el mínimo. Sale al romper el canal de 10 velas contrario.",
    decide(candles, pos) {
      const h = candles.map((x) => x.h), l = candles.map((x) => x.l), i = candles.length - 1, c = candles[i].c;
      if (pos?.side === "long" && c < lowest(l, 10, i)) return "close";
      if (pos?.side === "short" && c > highest(h, 10, i)) return "close";
      if (pos) return null;
      if (c > highest(h, 20, i)) return "long";
      if (c < lowest(l, 20, i)) return "short";
      return null;
    },
  },
  macd: {
    name: "MACD + filtro EMA 200",
    desc: "Cruce del MACD con su señal, solo a favor de la EMA 200. Sale cuando el histograma cambia de signo.",
    decide(candles, pos) {
      const c = candles.map((x) => x.c), i = c.length - 1;
      const m = macd(c), t = ema(c, 200);
      if (pos?.side === "long" && m.hist[i] < 0) return "close";
      if (pos?.side === "short" && m.hist[i] > 0) return "close";
      if (pos) return null;
      if (crossUp(m.line, m.signal, i) && c[i] > t[i]) return "long";
      if (crossDown(m.line, m.signal, i) && c[i] < t[i]) return "short";
      return null;
    },
  },
  grid: {
    name: "Grid (rejilla)",
    desc: "Divide un rango de precios en niveles: compra un lote al bajar a cada nivel y lo vende un nivel más arriba. Ideal en mercados laterales.",
  },
  dca: {
    name: "DCA inteligente",
    desc: "Compra por tramos cada N velas (doble si el RSI<30) y vende todo cuando el precio supera el promedio + take profit.",
  },
  ai: {
    name: "IA NIKOLAI (Claude)",
    desc: "En cada vela cerrada, Claude analiza los indicadores y decide abrir largo, corto, cerrar o esperar. Requiere ANTHROPIC_API_KEY.",
  },
};

export const strategyList = () => Object.entries(STRATEGIES).map(([id, s]) => ({ id, name: s.name, desc: s.desc }));
