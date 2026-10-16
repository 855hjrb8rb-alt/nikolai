// NIKOLAI QUANT — panel privado (cliente).
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem("nq." + k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem("nq." + k, JSON.stringify(v)); } catch { /* privado */ } } };

const TITLES = { dash: "Panel", bots: "Bots de trading", ai: "Analista IA", ex: "Exchanges y claves API", mine: "Minería", tools: "Herramientas" };
const S = { tab: store.get("tab", "dash"), d: null, chartBot: store.get("chartBot", null), open: new Set(), candles: null, candlesKey: "", candlesAt: 0 };

// ---------- Utilidades ----------
const quoteOf = (sym) => (String(sym).split("/")[1] || "USD").split(":")[0];
function money(v, q = "USD") {
  const n = Number(v) || 0;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}${abs} ${q}`;
}
const signed = (v, q) => `${v >= 0 ? "+" : ""}${money(v, q)}`;
const cls = (v) => (v > 0 ? "up" : v < 0 ? "down" : "");
function price(v) {
  const n = Number(v) || 0;
  if (!n) return "—";
  const d = n >= 1000 ? 2 : n >= 1 ? 4 : 6;
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
const time = (t) => new Date(t).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dateTime = (t) => new Date(t).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const venueName = (id) => S.d?.venues.find((v) => v.id === id)?.name || id;
const stratName = (id) => S.d?.strategies.find((s) => s.id === id)?.name || id;
const STATUS = { running: "Operando", stopped: "Detenido", halted: "Detenido por riesgo", error: "Error" };

function toast(msg, err = false) {
  const t = $("#toast");
  t.textContent = msg; t.className = "toast" + (err ? " err" : ""); t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 4200);
}

async function api(path, { method = "GET", body } = {}) {
  const r = await fetch(path, { method, headers: { "Content-Type": "application/json", "X-Quant": "1" }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) { location.reload(); throw new Error("Sesión caducada"); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
  return d;
}

async function act(btn, fn) {
  if (btn) btn.disabled = true;
  try { const d = await fn(); if (d?.bots) { S.d = d; render(); } return d; }
  catch (e) { toast(e.message, true); }
  finally { if (btn) btn.disabled = false; }
}

// ---------- Ciclo principal ----------
async function refresh() {
  try { S.d = await api("/api/quant/state"); } catch { return; }
  header();
  const typing = document.activeElement && $("#view").contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
  if (!typing && $("#modal").hidden && (S.tab === "dash" || S.tab === "bots")) render();
}

function header() {
  const d = S.d;
  $("#title").textContent = TITLES[S.tab];
  $("#runPill").textContent = `${d.running} bot${d.running === 1 ? "" : "s"} activo${d.running === 1 ? "" : "s"}`;
  $("#runPill").className = "pill" + (d.running ? " live" : "");
  $("#sandboxPill").hidden = !d.sandbox;
  $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === S.tab));
}

function render() {
  if (!S.d) return;
  header();
  const v = $("#view");
  ({ dash: dashView, bots: botsView, ai: aiView, ex: exView, mine: mineView, tools: toolsView }[S.tab] || dashView)(v);
}

// ---------- Panel ----------
function dashView(v) {
  const d = S.d;
  const totals = Object.entries(d.totals);
  const kpis = totals.map(([q, t]) => `
    <div class="card kpi"><span>Capital bots · ${esc(q)}</span><b>${money(t.equity, q)}</b>
      <small class="${cls(t.equity - t.capital)}">${signed(t.equity - t.capital, q)} (${t.capital ? (((t.equity - t.capital) / t.capital) * 100).toFixed(2) : "0.00"}%)</small></div>`).join("");
  const wins = d.bots.reduce((s, b) => s + b.stats.wins, 0), trades = d.bots.reduce((s, b) => s + b.stats.trades, 0);
  const feed = d.bots.flatMap((b) => b.log.map((l) => ({ ...l, bot: b.name }))).sort((a, b) => b.t - a.t).slice(0, 60);
  if (!S.chartBot || !d.bots.some((b) => b.id === S.chartBot)) S.chartBot = d.bots[0]?.id || null;

  v.innerHTML = `
    <div class="grid kpis">
      ${kpis}
      <div class="card kpi"><span>Bots activos</span><b>${d.running} / ${d.bots.length}</b><small class="muted">${d.bots.filter((b) => b.mode === "live").length} en modo REAL</small></div>
      <div class="card kpi"><span>Operaciones</span><b>${trades}</b><small class="muted">Acierto ${trades ? ((wins / trades) * 100).toFixed(1) : "0.0"}%</small></div>
    </div>
    ${d.running ? "" : `<div class="card row" style="margin-bottom:16px;justify-content:space-between">
      <div><h3>Tus bots están listos</h3><p class="muted mono" style="margin:6px 0 0;font-size:12px">Vienen preprogramados en SIMULACIÓN con precios reales. Cuando te convenzan los resultados, pásalos a modo REAL con tus claves API.</p></div>
      <button class="btn primary" id="startAll">▶ Iniciar todos (simulación)</button></div>`}
    <div class="grid cols">
      <div class="card">
        <div class="chart-head">
          <select class="in" id="chartSel">${d.bots.map((b) => `<option value="${b.id}" ${b.id === S.chartBot ? "selected" : ""}>${esc(b.name)} · ${esc(b.symbol)} ${esc(b.timeframe)}</option>`).join("")}</select>
          <span class="mono muted" id="chartInfo"></span>
        </div>
        <div class="chart-wrap"><canvas id="chart"></canvas></div>
      </div>
      <div class="card"><h2>Actividad en vivo</h2><div class="feed">${feed.length ? feed.map((l) => `<div class="${esc(l.level)}"><time>${time(l.t)}</time><em>${esc(l.bot)}</em>${esc(l.msg)}</div>`).join("") : '<p class="muted mono">Sin actividad todavía.</p>'}</div></div>
    </div>
    <div class="card" style="margin-top:16px"><h2>Resumen de bots</h2><div class="scroll"><table>
      <tr><th>Bot</th><th>Exchange</th><th>Par</th><th>Estrategia</th><th>Apal.</th><th>Modo</th><th>Estado</th><th>Precio</th><th>Saldo</th><th>P&L</th><th>No realiz.</th></tr>
      ${d.bots.map((b) => { const q = quoteOf(b.symbol); return `<tr class="click" data-chart="${b.id}">
        <td><b>${esc(b.name)}</b></td><td>${esc(venueName(b.venue))}</td><td>${esc(b.symbol)}${b.market === "futures" ? " ⟂" : ""}</td><td>${esc(stratName(b.strategy))}</td>
        <td>${b.leverage}x</td><td>${b.mode === "live" ? '<span class="chip real">REAL</span>' : '<span class="chip paper">SIM</span>'}</td>
        <td>${esc(STATUS[b.status])}</td><td>${price(b.price)}</td><td>${money(b.equityNow, q)}</td>
        <td class="${cls(b.stats.pnl)}">${signed(b.stats.pnl, q)}</td><td class="${cls(b.unrealized)}">${signed(b.unrealized, q)}</td></tr>`; }).join("")}
    </table></div></div>`;

  $("#startAll")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget; btn.disabled = true;
    for (const b of S.d.bots.filter((x) => x.mode === "paper" && x.status !== "running" && (x.strategy !== "ai" || S.d.ai))) {
      try { S.d = await api(`/api/quant/bots/${b.id}/start`, { method: "POST" }); } catch (err) { toast(`${b.name}: ${err.message}`, true); }
    }
    render();
  });
  $("#chartSel")?.addEventListener("change", (e) => { S.chartBot = e.target.value; store.set("chartBot", S.chartBot); S.candlesKey = ""; render(); });
  $$("[data-chart]", v).forEach((tr) => tr.addEventListener("click", () => { S.chartBot = tr.dataset.chart; store.set("chartBot", S.chartBot); S.candlesKey = ""; render(); }));
  drawChart();
}

async function drawChart() {
  const bot = S.d.bots.find((b) => b.id === S.chartBot);
  const canvas = $("#chart");
  if (!bot || !canvas) return;
  const key = `${bot.venue}|${bot.market}|${bot.symbol}|${bot.timeframe}`;
  if (key !== S.candlesKey || Date.now() - S.candlesAt > 15000) {
    S.candlesKey = key; S.candlesAt = Date.now();
    try {
      const q = new URLSearchParams({ venue: bot.venue, market: bot.market, symbol: bot.symbol, timeframe: bot.timeframe });
      S.candles = (await api(`/api/quant/candles?${q}`)).candles;
    } catch (e) { S.candles = null; const i = $("#chartInfo"); if (i) i.textContent = "Sin datos: " + e.message; }
  }
  if (!$("#chart")) return;
  paint($("#chart"), S.candles || [], bot);
}

function paint(canvas, cs, bot) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const g = canvas.getContext("2d");
  g.scale(dpr, dpr);
  g.clearRect(0, 0, W, H);
  const info = $("#chartInfo");
  if (!cs.length) { g.fillStyle = "#8ea6d8"; g.font = "13px JetBrains Mono"; g.fillText("Cargando velas…", 16, 30); return; }
  const data = cs.slice(-120);
  const padR = 78, padT = 12, padB = 22, plotW = W - padR, plotH = H - padB - padT;
  let hi = Math.max(...data.map((c) => c.h)), lo = Math.min(...data.map((c) => c.l));
  for (const l of bot.lots || []) { hi = Math.max(hi, l.entry); lo = Math.min(lo, l.entry); }
  const pad = (hi - lo) * 0.06 || hi * 0.01; hi += pad; lo -= pad;
  const y = (p) => padT + ((hi - p) / (hi - lo)) * plotH;
  const cw = plotW / data.length;

  g.font = "11px JetBrains Mono"; g.textBaseline = "middle";
  for (let i = 0; i <= 5; i++) {
    const p = lo + ((hi - lo) * i) / 5, yy = y(p);
    g.strokeStyle = "rgba(176,200,255,0.08)"; g.beginPath(); g.moveTo(0, yy); g.lineTo(plotW, yy); g.stroke();
    g.fillStyle = "#5d6fa3"; g.fillText(price(p), plotW + 8, yy);
  }
  // EMA 21
  const k = 2 / 22; let e;
  g.strokeStyle = "rgba(155,140,255,0.85)"; g.lineWidth = 1.5; g.beginPath();
  cs.forEach((c, i) => { e = i ? c.c * k + e * (1 - k) : c.c; const j = i - (cs.length - data.length); if (j >= 0) { const xx = j * cw + cw / 2; j ? g.lineTo(xx, y(e)) : g.moveTo(xx, y(e)); } });
  g.stroke();
  // Velas
  data.forEach((c, i) => {
    const x = i * cw + cw / 2, up = c.c >= c.o;
    g.strokeStyle = g.fillStyle = up ? "#4dffa6" : "#ff6b86";
    g.lineWidth = 1; g.beginPath(); g.moveTo(x, y(c.h)); g.lineTo(x, y(c.l)); g.stroke();
    const bw = Math.max(1, cw * 0.62), top = y(Math.max(c.o, c.c)), bh = Math.max(1, Math.abs(y(c.o) - y(c.c)));
    g.fillRect(x - bw / 2, top, bw, bh);
  });
  // Entradas, stops y liquidación
  const line = (p, color, label, dash = [5, 4]) => {
    if (!p || p < lo || p > hi) return;
    g.setLineDash(dash); g.strokeStyle = color; g.beginPath(); g.moveTo(0, y(p)); g.lineTo(plotW, y(p)); g.stroke(); g.setLineDash([]);
    g.fillStyle = color; g.fillRect(plotW + 2, y(p) - 9, padR - 4, 18); g.fillStyle = "#05061a"; g.fillText(label, plotW + 6, y(p));
  };
  for (const l of bot.lots || []) {
    const sgn = l.side === "long" ? 1 : -1;
    line(l.entry, "#79e3ff", (l.side === "long" ? "L " : "S ") + price(l.entry));
    if (bot.strategy !== "grid" && bot.strategy !== "dca") {
      line(l.entry * (1 - sgn * bot.stopLoss / 100), "#ff6b86", "SL");
      line(l.entry * (1 + sgn * bot.takeProfit / 100), "#4dffa6", "TP");
    }
    if (l.liq) line(l.liq, "#ffb35c", "LIQ", [2, 3]);
  }
  if (bot.strategy === "grid" && bot.grid.lower) {
    const step = (bot.grid.upper - bot.grid.lower) / bot.grid.levels;
    g.strokeStyle = "rgba(255,204,92,0.18)";
    for (let i = 0; i <= bot.grid.levels; i++) { const p = bot.grid.lower + i * step; g.beginPath(); g.moveTo(0, y(p)); g.lineTo(plotW, y(p)); g.stroke(); }
  }
  const last = data.at(-1).c;
  line(last, "#ffcc5c", price(last), [1, 0]);
  if (info) info.textContent = `${venueName(bot.venue)} · ${bot.market === "futures" ? "Futuros" : "Spot"} · EMA21`;
}

// ---------- Bots ----------
function botsView(v) {
  const d = S.d;
  v.innerHTML = `
    <div class="row" style="margin-bottom:16px;justify-content:space-between">
      <p class="muted mono" style="margin:0;font-size:12px">Simulación = precios reales, órdenes ficticias. REAL = órdenes en tu cuenta con tus claves API.</p>
      <button class="btn primary" id="newBot">+ Nuevo bot</button>
    </div>
    <div class="grid cards">${d.bots.map(botCard).join("") || '<p class="muted">No hay bots. Crea uno.</p>'}</div>`;
  $("#newBot").addEventListener("click", () => botForm());
  $$("[data-act]", v).forEach((btn) => btn.addEventListener("click", () => botAction(btn)));
}

function botCard(b) {
  const q = quoteOf(b.symbol);
  const open = S.open.has(b.id);
  const liqPct = b.leverage > 1 ? (100 / b.leverage).toFixed(1) : null;
  const lots = b.lots.length
    ? b.lots.map((l) => `<div><b>${l.side === "long" ? "LARGO" : "CORTO"}</b> ${price(l.qty)} @ <b>${price(l.entry)}</b> · margen ${money(l.margin, q)}${l.liq ? ` · liq ${price(l.liq)}` : ""}</div>`).join("")
    : "Sin posición abierta";
  return `<div class="card bot ${b.status}">
    <div class="bot-head">
      <div><h3><span class="dot"></span>${esc(b.name)}</h3><small>${esc(venueName(b.venue))} · ${esc(b.symbol)} · ${b.market === "futures" ? "Futuros" : "Spot"} · ${esc(b.timeframe)}</small></div>
      <span class="pill ${b.status === "running" ? "live" : b.status === "stopped" ? "" : "warn"}">${esc(STATUS[b.status])}</span>
    </div>
    <div class="chips">
      <span class="chip">${esc(stratName(b.strategy))}</span>
      <span class="chip lev ${b.leverage >= 20 ? "hot" : ""}">${b.leverage}x</span>
      <span class="chip ${b.mode === "live" ? "real" : "paper"}">${b.mode === "live" ? "REAL" : "SIMULACIÓN"}</span>
      <span class="chip">${b.market === "spot" ? "Solo largo (spot)" : b.direction === "both" ? "Largo + Corto" : b.direction === "long" ? "Solo largo" : "Solo corto"}</span>
      <span class="chip">SL ${b.stopLoss}% · TP ${b.takeProfit}%</span>
    </div>
    <div class="stats">
      <div><span>Precio</span><b>${price(b.price)}</b></div>
      <div><span>Saldo</span><b>${money(b.equityNow, q)}</b></div>
      <div><span>P&L total</span><b class="${cls(b.stats.pnl)}">${signed(b.stats.pnl, q)}</b></div>
      <div><span>No realizado</span><b class="${cls(b.unrealized)}">${signed(b.unrealized, q)}</b></div>
      <div><span>ROE</span><b class="${cls(b.roe)}">${b.roe.toFixed(2)}%</b></div>
      <div><span>Ops · acierto</span><b>${b.stats.trades} · ${b.winRate.toFixed(0)}%</b></div>
    </div>
    <div class="pos">${lots}</div>
    ${liqPct && b.stopLoss >= liqPct * 0.9 ? `<div class="errbox">Con ${b.leverage}x te liquidan con un movimiento de ~${liqPct}%: el stop-loss (${b.stopLoss}%) llega tarde. Baja el apalancamiento o el stop.</div>` : ""}
    ${b.status === "halted" ? '<div class="errbox">Pérdida máxima alcanzada. Revisa la configuración antes de reanudar.</div>' : ""}
    <div class="row">
      ${b.status === "running"
        ? `<button class="btn sm" data-act="stop" data-id="${b.id}">❚❚ Pausar</button><button class="btn sm danger" data-act="stopclose" data-id="${b.id}">Cerrar y detener</button>`
        : `<button class="btn sm go" data-act="start" data-id="${b.id}">▶ Iniciar</button><button class="btn sm" data-act="edit" data-id="${b.id}">Editar</button>`}
      <button class="btn sm" data-act="chart" data-id="${b.id}">Gráfico</button>
      <button class="btn sm" data-act="more" data-id="${b.id}">${open ? "Ocultar" : "Historial"}</button>
      ${b.status !== "running" ? `<button class="btn sm" data-act="reset" data-id="${b.id}">Reiniciar</button><button class="btn sm danger" data-act="delete" data-id="${b.id}">Borrar</button>` : ""}
    </div>
    ${open ? `<div>
      <h2 style="margin-top:6px">Operaciones cerradas</h2>
      <div class="scroll"><table><tr><th>Lado</th><th>Entrada</th><th>Salida</th><th>P&L</th><th>Motivo</th><th>Fecha</th></tr>
      ${b.history.map((h) => `<tr><td>${h.side === "long" ? "Largo" : "Corto"}</td><td>${price(h.entry)}</td><td>${price(h.exit)}</td><td class="${cls(h.pnl)}">${signed(h.pnl, q)}</td><td>${esc(h.reason)}</td><td>${dateTime(h.closedAt)}</td></tr>`).join("") || '<tr><td colspan="6" class="muted">Aún no hay operaciones</td></tr>'}
      </table></div>
      <h2 style="margin-top:14px">Registro</h2>
      <div class="feed" style="max-height:220px">${b.log.map((l) => `<div class="${esc(l.level)}"><time>${time(l.t)}</time>${esc(l.msg)}</div>`).join("")}</div>
    </div>` : ""}
  </div>`;
}

async function botAction(btn) {
  const id = btn.dataset.id, a = btn.dataset.act;
  const bot = S.d.bots.find((b) => b.id === id);
  if (a === "more") { S.open.has(id) ? S.open.delete(id) : S.open.add(id); return render(); }
  if (a === "chart") { S.chartBot = id; store.set("chartBot", id); S.candlesKey = ""; return go("dash"); }
  if (a === "edit") return botForm(bot);
  if (a === "start" && bot.mode === "live" && !confirm(`Vas a operar con DINERO REAL en ${venueName(bot.venue)} con ${bot.leverage}x. ¿Iniciar «${bot.name}»?`)) return;
  if (a === "delete" && !confirm(`¿Borrar «${bot.name}»?`)) return;
  if (a === "reset" && !confirm(`¿Reiniciar la cuenta simulada de «${bot.name}» a ${bot.capital}?`)) return;
  if (a === "stopclose" && !confirm(`¿Cerrar las posiciones de «${bot.name}» a mercado y detenerlo?`)) return;
  const path = { start: "start", stop: "stop", stopclose: "stop", reset: "reset", delete: "delete" }[a];
  await act(btn, () => api(`/api/quant/bots/${id}/${path}`, { method: "POST", body: { close: a === "stopclose" } }));
}

const TEMPLATES = [
  { label: "Scalper BTC 10x", sub: "Futuros · 5m · EMA", v: { name: "Scalper BTC 10x", venue: "binance", market: "futures", symbol: "BTC/USDT", timeframe: "5m", strategy: "trend", leverage: 10, allocation: 30, stopLoss: 0.6, takeProfit: 1.2, maxDrawdown: 20, capital: 500 } },
  { label: "Swing ETH 3x", sub: "Futuros · 4h · MACD", v: { name: "Swing ETH 3x", venue: "bybit", market: "futures", symbol: "ETH/USDT", timeframe: "4h", strategy: "macd", leverage: 3, allocation: 50, stopLoss: 4, takeProfit: 10, maxDrawdown: 25, capital: 1000 } },
  { label: "Grid BTC/MXN", sub: "Bitso · spot", v: { name: "Grid BTC Bitso", venue: "bitso", market: "spot", symbol: "BTC/MXN", timeframe: "5m", strategy: "grid", capital: 10000, stopLoss: 5, takeProfit: 5, maxDrawdown: 20, grid: { levels: 10 } } },
  { label: "DCA Kraken", sub: "Spot · 1h", v: { name: "DCA BTC Kraken", venue: "kraken", market: "spot", symbol: "BTC/USD", timeframe: "1h", strategy: "dca", capital: 1000, stopLoss: 15, takeProfit: 3, maxDrawdown: 30, dca: { every: 6, orders: 8 } } },
  { label: "Rebote SOL", sub: "KuCoin · RSI", v: { name: "Rebote SOL", venue: "kucoin", market: "spot", symbol: "SOL/USDT", timeframe: "15m", strategy: "rsi", capital: 500, allocation: 70, stopLoss: 3, takeProfit: 4, maxDrawdown: 20 } },
  { label: "IA NIKOLAI", sub: "Claude decide · 1h", v: { name: "IA NIKOLAI", venue: "okx", market: "futures", symbol: "BTC/USDT", timeframe: "1h", strategy: "ai", leverage: 3, allocation: 40, stopLoss: 2, takeProfit: 4, maxDrawdown: 20, capital: 1000 } },
];

function botForm(edit) {
  const d = S.d;
  const b = edit || { name: "", venue: "binance", market: "futures", symbol: "BTC/USDT", timeframe: "15m", strategy: "trend", direction: "both", capital: 1000, leverage: 5, allocation: 50, stopLoss: 1.5, takeProfit: 3, maxDrawdown: 25, mode: "paper", grid: { lower: 0, upper: 0, levels: 10 }, dca: { every: 4, orders: 8 } };
  const card = $("#modalCard");
  card.innerHTML = `
    <header><h3>${edit ? "Editar bot" : "Nuevo bot"}</h3><button class="btn sm" data-close>✕</button></header>
    ${edit ? "" : `<h2>Plantillas listas</h2><div class="presets">${TEMPLATES.map((t, i) => `<button class="preset" data-tpl="${i}"><b>${esc(t.label)}</b><small>${esc(t.sub)}</small></button>`).join("")}</div>`}
    <form class="form" id="bf">
      <label class="f full">Nombre<input class="in" name="name" maxlength="40" placeholder="Mi bot"></label>
      <label class="f">Exchange<select class="in" name="venue">${d.venues.map((v) => `<option value="${v.id}">${esc(v.name)}${v.futures ? "" : " (solo spot)"}</option>`).join("")}</select></label>
      <label class="f">Mercado<select class="in" name="market"><option value="spot">Spot (sin apalancamiento)</option><option value="futures">Futuros perpetuos (apalancamiento)</option></select></label>
      <label class="f">Par<input class="in" name="symbol" list="syms" placeholder="BTC/USDT"><datalist id="syms"></datalist></label>
      <label class="f">Temporalidad<select class="in" name="timeframe">${d.timeframes.map((t) => `<option>${t}</option>`).join("")}</select></label>
      <label class="f full">Estrategia<select class="in" name="strategy">${d.strategies.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select><span class="muted" id="stratDesc" style="letter-spacing:0;line-height:1.5"></span></label>
      <label class="f">Dirección<select class="in" name="direction"><option value="both">Largo y corto</option><option value="long">Solo largo</option><option value="short">Solo corto</option></select></label>
      <label class="f">Capital del bot<input class="in" name="capital" type="number" min="1" step="any"></label>
      <div class="f full" id="levBox"><label class="f">Apalancamiento<input type="range" name="leverage" min="1" max="125" step="1"></label>
        <div class="levrow"><span id="levVal"></span><span id="levLiq" class="muted"></span></div></div>
      <label class="f" data-only="single">% del saldo por operación<input class="in" name="allocation" type="number" min="1" max="100"></label>
      <label class="f">Pérdida máx. del bot (%)<input class="in" name="maxDrawdown" type="number" min="1" max="99" step="any"></label>
      <label class="f">Stop-loss (% precio)<input class="in" name="stopLoss" type="number" min="0.1" step="any"></label>
      <label class="f">Take-profit (% precio)<input class="in" name="takeProfit" type="number" min="0.1" step="any"></label>
      <label class="f" data-only="grid">Grid: precio inferior (0 = auto)<input class="in" name="gridLower" type="number" min="0" step="any"></label>
      <label class="f" data-only="grid">Grid: precio superior (0 = auto)<input class="in" name="gridUpper" type="number" min="0" step="any"></label>
      <label class="f" data-only="grid">Grid: niveles<input class="in" name="gridLevels" type="number" min="2" max="100"></label>
      <label class="f" data-only="dca">DCA: comprar cada N velas<input class="in" name="dcaEvery" type="number" min="1"></label>
      <label class="f" data-only="dca">DCA: número de compras<input class="in" name="dcaOrders" type="number" min="1" max="100"></label>
      <label class="f full">Modo<select class="in" name="mode"><option value="paper">Simulación (precios reales, sin dinero)</option><option value="live">REAL (órdenes con tus claves API)</option></select></label>
      <div class="full" id="liveBox" hidden>
        <div class="errbox" id="liveWarn"></div>
        <label class="check" style="margin-top:10px"><input type="checkbox" name="confirmLive"> Entiendo que el bot enviará órdenes reales, que el apalancamiento puede liquidar mi margen y que puedo perder dinero.</label>
      </div>
      <div class="full warnbox" id="riskWarn" hidden></div>
      <div class="full row" style="justify-content:flex-end"><button type="button" class="btn" data-close>Cancelar</button><button class="btn primary" type="submit">${edit ? "Guardar cambios" : "Crear bot"}</button></div>
    </form>`;
  const f = $("#bf", card);
  const fill = (x) => {
    for (const k of ["name", "venue", "market", "symbol", "timeframe", "strategy", "direction", "capital", "leverage", "allocation", "maxDrawdown", "stopLoss", "takeProfit", "mode"]) if (x[k] !== undefined) f.elements[k].value = x[k];
    f.elements.gridLower.value = x.grid?.lower ?? 0; f.elements.gridUpper.value = x.grid?.upper ?? 0; f.elements.gridLevels.value = x.grid?.levels ?? 10;
    f.elements.dcaEvery.value = x.dca?.every ?? 4; f.elements.dcaOrders.value = x.dca?.orders ?? 8;
    sync();
  };
  const sync = () => {
    const ven = d.venues.find((v) => v.id === f.elements.venue.value);
    const futOpt = f.elements.market.querySelector('[value="futures"]');
    futOpt.disabled = !ven.futures;
    if (!ven.futures) f.elements.market.value = "spot";
    const fut = f.elements.market.value === "futures";
    f.elements.leverage.max = fut ? ven.maxLev : 1;
    if (!fut) f.elements.leverage.value = 1;
    $("#levBox", card).style.opacity = fut ? 1 : 0.4;
    const lev = +f.elements.leverage.value;
    $("#levVal", card).textContent = `${lev}x`;
    $("#levLiq", card).textContent = lev > 1 ? `Liquidación con ~${(100 / lev).toFixed(2)}% en contra` : "Sin apalancamiento";
    $("#syms", card).innerHTML = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "ADA", "AVAX", "LINK", "LTC"].map((c) => `<option value="${c}/${ven.quote}">`).join("");
    const st = f.elements.strategy.value;
    $("#stratDesc", card).textContent = d.strategies.find((s) => s.id === st)?.desc || "";
    $$("[data-only]", card).forEach((el) => { el.hidden = el.dataset.only === "single" ? ["grid", "dca"].includes(st) : el.dataset.only !== st; });
    if (!fut) { f.elements.direction.querySelector('[value="short"]').disabled = true; if (f.elements.direction.value === "short") f.elements.direction.value = "long"; }
    else f.elements.direction.querySelector('[value="short"]').disabled = false;
    const live = f.elements.mode.value === "live";
    $("#liveBox", card).hidden = !live;
    const keys = d.keys[ven.id];
    $("#liveWarn", card).textContent = !keys?.set ? `No hay claves API de ${ven.name}. Agrégalas en «Exchanges» antes de iniciar.` : keys.broken ? `Las claves de ${ven.name} no se pueden descifrar (cambió la contraseña). Vuelve a guardarlas.` : `Operará con dinero real en ${ven.name}. Empieza con poco capital.`;
    const warns = [];
    if (lev > 1 && +f.elements.stopLoss.value >= (100 / lev) * 0.9) warns.push(`El stop-loss (${f.elements.stopLoss.value}%) está más lejos que la liquidación (~${(100 / lev).toFixed(2)}%). Bájalo o reduce el apalancamiento.`);
    if (lev >= 20) warns.push(`${lev}x es apalancamiento muy alto: un movimiento normal del mercado puede liquidar la posición.`);
    if (st === "ai" && !d.ai) warns.push("La estrategia IA necesita ANTHROPIC_API_KEY en el servidor.");
    $("#riskWarn", card).hidden = !warns.length;
    $("#riskWarn", card).innerHTML = warns.map(esc).join("<br>");
  };
  fill(b);
  f.addEventListener("input", sync);
  f.elements.venue.addEventListener("change", () => { const ven = d.venues.find((v) => v.id === f.elements.venue.value); const base = (f.elements.symbol.value.split("/")[0] || "BTC"); f.elements.symbol.value = `${base}/${ven.quote}`; sync(); });
  $$("[data-tpl]", card).forEach((btn) => btn.addEventListener("click", () => fill({ ...b, ...TEMPLATES[btn.dataset.tpl].v, mode: "paper" })));
  $$("[data-close]", card).forEach((x) => x.addEventListener("click", closeModal));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const el = f.elements;
    const body = {
      name: el.name.value, venue: el.venue.value, market: el.market.value, symbol: el.symbol.value, timeframe: el.timeframe.value,
      strategy: el.strategy.value, direction: el.direction.value, capital: +el.capital.value, leverage: +el.leverage.value,
      allocation: +el.allocation.value, maxDrawdown: +el.maxDrawdown.value, stopLoss: +el.stopLoss.value, takeProfit: +el.takeProfit.value,
      grid: { lower: +el.gridLower.value, upper: +el.gridUpper.value, levels: +el.gridLevels.value },
      dca: { every: +el.dcaEvery.value, orders: +el.dcaOrders.value },
      mode: el.mode.value, confirmLive: el.confirmLive.checked,
    };
    if (body.mode === "live" && !body.confirmLive) return toast("Marca la casilla de confirmación del modo REAL", true);
    const btn = e.submitter;
    const res = await act(btn, () => api(edit ? `/api/quant/bots/${edit.id}/update` : "/api/quant/bots", { method: "POST", body }));
    if (res) { closeModal(); toast(edit ? "Bot actualizado" : "Bot creado"); }
  });
  $("#modal").hidden = false;
}

function closeModal() { $("#modal").hidden = true; $("#modalCard").innerHTML = ""; render(); }

// ---------- IA ----------
function aiView(v) {
  const d = S.d;
  const last = store.get("ai", { venue: "binance", market: "spot", symbol: "BTC/USDT", timeframe: "1h" });
  v.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <h2>Análisis con IA (Claude)</h2>
      <form class="form" id="af" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
        <label class="f">Exchange<select class="in" name="venue">${d.venues.map((x) => `<option value="${x.id}" ${x.id === last.venue ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
        <label class="f">Mercado<select class="in" name="market"><option value="spot">Spot</option><option value="futures" ${last.market === "futures" ? "selected" : ""}>Futuros</option></select></label>
        <label class="f">Par<input class="in" name="symbol" value="${esc(last.symbol)}"></label>
        <label class="f">Temporalidad<select class="in" name="timeframe">${d.timeframes.map((t) => `<option ${t === last.timeframe ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <div class="f" style="justify-content:flex-end"><button class="btn primary" type="submit">Analizar</button></div>
      </form>
      ${d.ai ? "" : '<p class="warnbox" style="margin-top:12px">Falta ANTHROPIC_API_KEY en el servidor: verás los indicadores, pero no el análisis escrito.</p>'}
    </div>
    <div id="aiOut"></div>`;
  $("#af").addEventListener("submit", async (e) => {
    e.preventDefault();
    const el = e.target.elements;
    const body = { venue: el.venue.value, market: el.market.value, symbol: el.symbol.value.toUpperCase(), timeframe: el.timeframe.value };
    store.set("ai", body);
    const out = $("#aiOut");
    out.innerHTML = `<div class="card"><span class="spinner"></span> <span class="mono muted">NIKOLAI está analizando ${esc(body.symbol)}…</span></div>`;
    try {
      const r = await api("/api/quant/analyze", { method: "POST", body });
      const labels = { price: "Precio", change24: "Cambio 24 velas %", ema9: "EMA 9", ema21: "EMA 21", ema50: "EMA 50", ema200: "EMA 200", rsi14: "RSI 14", macd: "MACD", macdSignal: "Señal MACD", macdHist: "Histograma", bbUpper: "Bollinger sup.", bbLower: "Bollinger inf.", atr14: "ATR 14", high20: "Máx. 20", low20: "Mín. 20" };
      out.innerHTML = `<div class="grid cols">
        <div class="card ai-out">${r.text ? md(r.text) : '<p class="muted">Sin análisis escrito (configura la clave de Claude).</p>'}</div>
        <div class="card"><h2>Indicadores</h2><div class="ind">${Object.entries(r.snapshot).map(([k, val]) => `<div><span>${esc(labels[k] || k)}</span><b>${val == null ? "—" : price(val)}</b></div>`).join("")}</div></div>
      </div>`;
    } catch (err) { out.innerHTML = `<div class="errbox">${esc(err.message)}</div>`; }
  });
}

function md(text) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
  let html = "", list = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const li = line.match(/^[-*•]\s+(.*)/);
    if (li) { if (!list) { html += "<ul>"; list = true; } html += `<li>${inline(li[1])}</li>`; continue; }
    if (list) { html += "</ul>"; list = false; }
    const h = line.match(/^#{1,4}\s+(.*)/);
    if (h) html += `<h3 style="margin:14px 0 6px">${inline(h[1])}</h3>`;
    else if (line) html += `<p>${inline(line)}</p>`;
  }
  return html + (list ? "</ul>" : "");
}

// ---------- Exchanges ----------
function exView(v) {
  const d = S.d;
  v.innerHTML = `
    <div class="warnbox" style="margin-bottom:16px">Seguridad: crea claves API con permiso de <b>lectura + trading</b> y <b>NUNCA de retiro</b>. Restríngelas a la IP de tu servidor. Las claves se guardan cifradas (AES-256) en tu servidor y no vuelven a mostrarse.</div>
    <div class="grid cards">${d.venues.map((x) => {
      const k = d.keys[x.id];
      return `<div class="card" data-venue="${x.id}">
        <div class="bot-head"><div><h3>${esc(x.name)}</h3><small>${x.futures ? `Spot + Futuros · hasta ${x.maxLev}x` : "Solo spot"} · ${esc(x.quote)}</small></div>
          <span class="pill ${k.set && !k.broken ? "live" : k.broken ? "warn" : ""}">${k.set && !k.broken ? "Conectado " + esc(k.hint) : k.broken ? "Revisar" : "Sin claves"}</span></div>
        <form class="form" style="margin-top:14px" data-keyform>
          <label class="f full">API Key<input class="in" name="apiKey" autocomplete="off" required></label>
          <label class="f full">API Secret<input class="in" name="secret" type="password" autocomplete="off" required></label>
          ${x.passphrase ? '<label class="f full">Passphrase<input class="in" name="password" type="password" autocomplete="off" required></label>' : ""}
          <div class="full row">
            <button class="btn primary sm" type="submit">${k.set ? "Reemplazar" : "Guardar"}</button>
            ${k.set ? `<button class="btn sm" type="button" data-test>Probar / ver saldo</button><button class="btn sm danger" type="button" data-del>Borrar</button>` : ""}
            <a class="btn sm" href="${esc(x.keysUrl)}" target="_blank" rel="noopener noreferrer">Crear claves ↗</a>
            <a class="btn sm" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.name)} ↗</a>
          </div>
        </form>
        <div data-bal></div>
      </div>`;
    }).join("")}</div>`;
  $$("[data-venue]", v).forEach((c) => {
    const venue = c.dataset.venue;
    $("[data-keyform]", c).addEventListener("submit", async (e) => {
      e.preventDefault();
      const el = e.target.elements;
      const r = await act(e.submitter, () => api("/api/quant/keys", { method: "POST", body: { venue, apiKey: el.apiKey.value, secret: el.secret.value, password: el.password?.value } }));
      if (r) toast("Claves guardadas y cifradas");
    });
    $("[data-del]", c)?.addEventListener("click", async (e) => { if (confirm("¿Borrar las claves de este exchange?")) await act(e.currentTarget, () => api("/api/quant/keys/delete", { method: "POST", body: { venue } })); });
    $("[data-test]", c)?.addEventListener("click", async (e) => {
      const out = $("[data-bal]", c);
      out.innerHTML = '<p class="mono muted"><span class="spinner"></span> Conectando…</p>';
      const btn = e.currentTarget; btn.disabled = true;
      try {
        const r = await api("/api/quant/keys/test", { method: "POST", body: { venue, market: "spot" } });
        out.innerHTML = `<div class="pos" style="margin-top:12px"><b class="up">✓ Conexión correcta</b>${r.balances.length ? r.balances.map((x) => `<div>${esc(x.asset)}: <b>${price(x.total)}</b></div>`).join("") : "<div>Saldo vacío</div>"}</div>`;
      } catch (err) { out.innerHTML = `<div class="errbox" style="margin-top:12px">${esc(err.message)}</div>`; }
      btn.disabled = false;
    });
  });
}

// ---------- Minería ----------
function mineView(v) {
  const d = S.d;
  const c = store.get("calc", { hashrateTH: 200, powerW: 3500, costKwh: 0.1, poolFee: 2 });
  v.innerHTML = `
    <div class="warnbox" style="margin-bottom:16px">La minería real la hace tu hardware (ASIC para Bitcoin, GPU/CPU para otras monedas) conectado a un pool. Este panel calcula la rentabilidad con datos en vivo de la red y vigila tus mineros. Desconfía de cualquier "minería en la nube" que prometa ganancias fijas: casi siempre son estafas.</div>
    <div class="grid cols">
      <div class="card">
        <h2>Calculadora Bitcoin (datos en vivo)</h2>
        <form class="form" id="mc">
          <label class="f">Hashrate (TH/s)<input class="in" name="hashrateTH" type="number" step="any" value="${c.hashrateTH}"></label>
          <label class="f">Consumo (W)<input class="in" name="powerW" type="number" step="any" value="${c.powerW}"></label>
          <label class="f">Luz (USD/kWh)<input class="in" name="costKwh" type="number" step="any" value="${c.costKwh}"></label>
          <label class="f">Comisión pool (%)<input class="in" name="poolFee" type="number" step="any" value="${c.poolFee}"></label>
          <div class="full row"><button class="btn primary" type="submit">Calcular</button><span class="mono muted" style="font-size:12px">Ej.: Antminer S21 ≈ 200 TH/s · 3500 W</span></div>
        </form>
        <div id="mcOut" style="margin-top:14px"></div>
      </div>
      <div class="card">
        <h2>Mis mineros</h2>
        <div id="miners">${d.miners.map((m) => `<div class="pos" style="margin-bottom:8px" data-miner="${m.id}">
          <div class="row" style="justify-content:space-between"><b>${esc(m.name)}</b><span>${esc(m.pool)} · ${esc(m.coin.toUpperCase())}</span></div>
          <div style="word-break:break-all">${esc(m.wallet)}</div>
          <div data-ms class="muted">—</div>
          <div class="row" style="margin-top:6px"><button class="btn sm" data-mstat>Estado en el pool</button><button class="btn sm danger" data-mdel>Quitar</button></div>
        </div>`).join("") || '<p class="muted mono" style="font-size:12px">Agrega tu cartera de 2Miners para ver hashrate, trabajadores y saldo en vivo.</p>'}</div>
        <form class="form" id="mf" style="margin-top:12px">
          <label class="f">Nombre<input class="in" name="name" placeholder="Rig casa"></label>
          <label class="f">Moneda (2Miners)<select class="in" name="coin">${["etc", "rvn", "kas", "erg", "zec", "xna", "clore", "firo", "btg"].map((x) => `<option>${x}</option>`).join("")}</select></label>
          <label class="f full">Cartera<input class="in" name="wallet" required placeholder="Tu dirección de cartera"></label>
          <div class="full"><button class="btn sm" type="submit">+ Agregar minero</button></div>
        </form>
      </div>
    </div>
    <div class="card" style="margin-top:16px"><h2>Dónde minar (sitios oficiales)</h2>
      <div class="links">${d.guide.map((p) => `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(p.name)} ↗</b><small>${esc(p.what)}</small></a>`).join("")}</div>
    </div>`;
  const calc = async (e) => {
    e?.preventDefault();
    const el = $("#mc").elements;
    const q = { hashrateTH: el.hashrateTH.value, powerW: el.powerW.value, costKwh: el.costKwh.value, poolFee: el.poolFee.value };
    store.set("calc", q);
    const out = $("#mcOut");
    out.innerHTML = '<span class="spinner"></span>';
    try {
      const r = await api(`/api/quant/mining/btc?${new URLSearchParams(q)}`);
      const n = r.network, x = r.result;
      out.innerHTML = `<div class="ind">
        <div><span>Precio BTC</span><b>${price(n.priceUSD)} USD</b></div>
        <div><span>Dificultad</span><b>${(n.difficulty / 1e12).toFixed(2)} T</b></div>
        <div><span>Hashrate red</span><b>${(n.networkHashrate / 1e18).toFixed(0)} EH/s</b></div>
        <div><span>BTC / día</span><b>${x.btcDay.toFixed(8)}</b></div>
        <div><span>Ingreso / día</span><b>${money(x.revenueUSD, "USD")}</b></div>
        <div><span>Luz / día</span><b class="down">${money(x.powerUSD, "USD")}</b></div>
        <div><span>Ganancia / día</span><b class="${cls(x.profitUSD)}">${signed(x.profitUSD, "USD")}</b></div>
        <div><span>Ganancia / mes</span><b class="${cls(x.profitMonthUSD)}">${signed(x.profitMonthUSD, "USD")}</b></div>
        <div><span>Luz máx. rentable</span><b>${x.breakEvenKwh ? x.breakEvenKwh.toFixed(3) + " USD/kWh" : "—"}</b></div>
      </div>`;
    } catch (err) { out.innerHTML = `<div class="errbox">${esc(err.message)}</div>`; }
  };
  $("#mc").addEventListener("submit", calc);
  calc();
  $("#mf").addEventListener("submit", async (e) => {
    e.preventDefault();
    const el = e.target.elements;
    await act(e.submitter, () => api("/api/quant/miners", { method: "POST", body: { name: el.name.value, pool: "2miners", coin: el.coin.value, wallet: el.wallet.value } }));
  });
  $$("[data-miner]", v).forEach((m) => {
    const id = m.dataset.miner;
    $("[data-mdel]", m).addEventListener("click", (e) => act(e.currentTarget, () => api(`/api/quant/miners/${id}/delete`, { method: "POST" })));
    $("[data-mstat]", m).addEventListener("click", async () => {
      const out = $("[data-ms]", m);
      out.innerHTML = '<span class="spinner"></span>';
      try {
        const s = await api(`/api/quant/miners/${id}/status`);
        const hr = (h) => (h >= 1e12 ? (h / 1e12).toFixed(2) + " TH/s" : h >= 1e9 ? (h / 1e9).toFixed(2) + " GH/s" : (h / 1e6).toFixed(2) + " MH/s");
        out.innerHTML = `Hashrate <b>${hr(s.hashrate)}</b> (24 h ${hr(s.hashrate24h)}) · Trabajadores <b class="up">${s.workersOnline}</b>/<span class="down">${s.workersOffline}</span> · Saldo <b>${s.balance.toFixed(6)}</b> · Pagado <b>${s.paid.toFixed(6)}</b>`;
      } catch (err) { out.innerHTML = `<span class="down">${esc(err.message)}</span>`; }
    });
  });
}

// ---------- Herramientas ----------
function toolsView(v) {
  v.innerHTML = `<div class="grid cards">
    <div class="card"><h2>Liquidación</h2><form class="form" data-calc="liq">
      <label class="f">Entrada<input class="in" name="entry" type="number" step="any" value="60000"></label>
      <label class="f">Apalancamiento<input class="in" name="lev" type="number" min="1" value="10"></label>
      <label class="f full">Dirección<select class="in" name="side"><option value="long">Largo</option><option value="short">Corto</option></select></label>
    </form><div class="pos" data-out></div></div>
    <div class="card"><h2>Tamaño de posición por riesgo</h2><form class="form" data-calc="size">
      <label class="f">Capital<input class="in" name="cap" type="number" step="any" value="1000"></label>
      <label class="f">Riesgo por operación (%)<input class="in" name="risk" type="number" step="any" value="1"></label>
      <label class="f">Entrada<input class="in" name="entry" type="number" step="any" value="60000"></label>
      <label class="f">Stop-loss<input class="in" name="stop" type="number" step="any" value="59000"></label>
    </form><div class="pos" data-out></div></div>
    <div class="card"><h2>P&L con apalancamiento</h2><form class="form" data-calc="pnl">
      <label class="f">Margen<input class="in" name="margin" type="number" step="any" value="100"></label>
      <label class="f">Apalancamiento<input class="in" name="lev" type="number" min="1" value="10"></label>
      <label class="f">Entrada<input class="in" name="entry" type="number" step="any" value="60000"></label>
      <label class="f">Salida<input class="in" name="exit" type="number" step="any" value="61200"></label>
      <label class="f full">Dirección<select class="in" name="side"><option value="long">Largo</option><option value="short">Corto</option></select></label>
    </form><div class="pos" data-out></div></div>
  </div>`;
  const calcs = {
    liq: (x) => { const l = Math.max(1, x.lev), p = x.side === "long" ? x.entry * (1 - 1 / l + 0.005) : x.entry * (1 + 1 / l - 0.005); return `Liquidación aprox.: <b class="down">${price(p)}</b><br>Movimiento en contra: <b>${((1 / l - 0.005) * 100).toFixed(2)}%</b>`; },
    size: (x) => { const amt = x.cap * x.risk / 100, per = Math.abs(x.entry - x.stop), q = per ? amt / per : 0, notional = q * x.entry; return `Riesgo máximo: <b>${price(amt)}</b><br>Cantidad: <b>${q.toPrecision(5)}</b> (${price(notional)} nocional)<br>Apalancamiento necesario: <b>${x.cap ? Math.max(1, notional / x.cap).toFixed(1) : "—"}x</b>`; },
    pnl: (x) => { const l = Math.max(1, x.lev), q = (x.margin * l) / x.entry, pnl = (x.side === "long" ? 1 : -1) * (x.exit - x.entry) * q, roe = x.margin ? pnl / x.margin * 100 : 0; return `P&L: <b class="${cls(pnl)}">${pnl >= 0 ? "+" : ""}${price(pnl)}</b><br>ROE: <b class="${cls(roe)}">${roe.toFixed(2)}%</b> · Nocional ${price(x.margin * l)}`; },
  };
  $$("[data-calc]", v).forEach((f) => {
    const run = () => {
      const x = Object.fromEntries([...f.elements].map((el) => [el.name, el.type === "number" ? +el.value : el.value]));
      f.nextElementSibling.innerHTML = calcs[f.dataset.calc](x);
    };
    f.addEventListener("input", run); run();
  });
}

// ---------- Arranque ----------
function go(tab) { S.tab = tab; store.set("tab", tab); render(); window.scrollTo(0, 0); }
$$("#tabs button").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
$("#logout").addEventListener("click", async () => { await api("/api/quant/logout", { method: "POST" }).catch(() => {}); location.reload(); });
$("#panic").addEventListener("click", async (e) => {
  if (!confirm("PÁNICO: se detienen TODOS los bots y se cierran TODAS sus posiciones a mercado. ¿Continuar?")) return;
  await act(e.currentTarget, () => api("/api/quant/panic", { method: "POST" }));
  toast("Todos los bots detenidos y posiciones cerradas");
});
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });
window.addEventListener("resize", () => { if (S.tab === "dash" && S.candles && S.d) { const b = S.d.bots.find((x) => x.id === S.chartBot); if (b && $("#chart")) paint($("#chart"), S.candles, b); } });
setInterval(() => { $("#clock").textContent = new Date().toLocaleTimeString("es"); }, 1000);

await refresh();
render();
setInterval(refresh, 3000);
