// =====================================================================
// NIKOLAI GRANJA — agricultura: tierras, semillas, cultivos y cosecha.
// - Siembra semillas en tus parcelas; crecen con el tiempo real (aunque
//   cierres), riégalas para acelerar y cosecha para ganar.
// - Tienda de semillas, compra de tierras, inventario y mercado agrícola
//   con precios reales de materias primas (TradingView).
// - Agrónomo con IA (NIKOLAI): consejos de siembra, suelo y plagas.
// Datos guardados solo en tu navegador (localStorage).
// =====================================================================
import { tvWidget } from "./markets.js";

const KEY = "nikolai.farm";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(farm)); } catch { /* lleno */ } };

// Catálogo de cultivos: costo semilla, tiempo de crecimiento (seg), precio venta, rendimiento, color.
const CROPS = [
  { id: "maiz", name: "Maíz", color: "#f6c343", seed: 20, grow: 45, sell: 14, yield: 4, water: true, kind: "mazorca" },
  { id: "trigo", name: "Trigo", color: "#e3c565", seed: 15, grow: 40, sell: 10, yield: 5, water: false, kind: "espiga" },
  { id: "frijol", name: "Frijol", color: "#8d5a3c", seed: 18, grow: 50, sell: 16, yield: 3, water: true, kind: "vaina" },
  { id: "tomate", name: "Tomate", color: "#e2432f", seed: 30, grow: 70, sell: 26, yield: 4, water: true, kind: "fruto" },
  { id: "chile", name: "Chile", color: "#c62828", seed: 28, grow: 65, sell: 24, yield: 4, water: true, kind: "fruto" },
  { id: "fresa", name: "Fresa", color: "#e53956", seed: 40, grow: 80, sell: 34, yield: 5, water: true, kind: "fruto" },
  { id: "calabaza", name: "Calabaza", color: "#e67e22", seed: 35, grow: 90, sell: 40, yield: 2, water: true, kind: "bola" },
  { id: "sandia", name: "Sandía", color: "#2ecc71", seed: 45, grow: 110, sell: 55, yield: 2, water: true, kind: "bola" },
  { id: "girasol", name: "Girasol", color: "#f4d03f", seed: 25, grow: 60, sell: 22, yield: 3, water: false, kind: "flor" },
  { id: "cafe", name: "Café", color: "#6f4e37", seed: 60, grow: 150, sell: 95, yield: 3, water: true, kind: "fruto" },
  { id: "aguacate", name: "Aguacate", color: "#4e7d33", seed: 80, grow: 180, sell: 130, yield: 3, water: true, kind: "fruto" },
  { id: "zanahoria", name: "Zanahoria", color: "#e8821e", seed: 16, grow: 48, sell: 15, yield: 4, water: true, kind: "raiz" },
];
const CROP = (id) => CROPS.find((c) => c.id === id);
// Materias primas agrícolas reales (TradingView).
const AGRO = [
  { proName: "CBOT:ZC1!", title: "Maíz" }, { proName: "CBOT:ZW1!", title: "Trigo" }, { proName: "CBOT:ZS1!", title: "Soja" },
  { proName: "ICEUS:KC1!", title: "Café" }, { proName: "ICEUS:SB1!", title: "Azúcar" }, { proName: "ICEUS:CT1!", title: "Algodón" },
  { proName: "ICEUS:CC1!", title: "Cacao" }, { proName: "CME:LE1!", title: "Ganado" }, { proName: "CBOT:ZR1!", title: "Arroz" },
];

const farm = Object.assign({
  money: 500, tab: "farm", level: 1, xp: 0,
  plots: Array.from({ length: 6 }, (_, i) => ({ id: i, crop: null, planted: 0, watered: false })),
  seeds: { maiz: 3, tomate: 2, frijol: 2 },
  harvest: {},
}, load());

const usd = (v) => "$" + Math.round(v).toLocaleString("en-US");
const now = () => Date.now();
const growMs = (plot) => { const c = CROP(plot.crop); return c ? c.grow * 1000 * (plot.watered ? 0.75 : 1) : 1; };
const progress = (plot) => (plot.crop ? Math.min(1, (now() - plot.planted) / growMs(plot)) : 0);
const ready = (plot) => plot.crop && progress(plot) >= 1;
const needXp = () => farm.level * 100;

export function farmSummary() {
  const ready$ = farm.plots.filter(ready).length;
  return { money: farm.money, ready: ready$, plots: farm.plots.length };
}

let ctxRef = null, bodyRef = null, timer = 0;
export function renderFarm(body, ctx) {
  ctxRef = ctx; bodyRef = body; clearInterval(timer);
  const { t, esc } = ctx;
  const tabs = [["farm", "fm_tabFarm"], ["seeds", "fm_tabSeeds"], ["market", "fm_tabMarket"], ["agro", "fm_tabAgro"]];
  body.innerHTML = `
    <div class="fm-top">
      <div class="fm-brand"><b>${esc(t("fm_brand"))}</b><span class="mono">${esc(t("fm_tagline"))}</span></div>
      <div class="fm-wallet mono"><span class="fm-coin">●</span> <b id="fmMoney">${usd(farm.money)}</b> · Lv <b id="fmLvl">${farm.level}</b></div>
    </div>
    <div class="fm-tabs">${tabs.map(([id, k]) => `<button class="fm-tab ${farm.tab === id ? "on" : ""}" data-target data-fmtab="${id}">${esc(t(k))}</button>`).join("")}</div>
    <div class="fm-body"></div>`;
  body.querySelectorAll("[data-fmtab]").forEach((b) => b.addEventListener("click", () => { farm.tab = b.dataset.fmtab; save(); renderFarm(body, ctx); }));
  const host = body.querySelector(".fm-body");
  ({ farm: farmTab, seeds: seedsTab, market: marketTab, agro: agroTab }[farm.tab] || farmTab)(host, ctx);
  timer = setInterval(tick, 1000);
}

function tick() {
  if (!bodyRef || !bodyRef.isConnected) { clearInterval(timer); return; }
  if (farm.tab !== "farm") return;
  farm.plots.forEach((p) => {
    if (!p.crop) return;
    const el = bodyRef.querySelector(`[data-plot="${p.id}"]`); if (!el) return;
    const pr = progress(p), rdy = pr >= 1;
    el.classList.toggle("ready", rdy); el.classList.toggle("growing", !rdy);
    const bar = el.querySelector(".fm-prog i"); if (bar) bar.style.width = (pr * 100) + "%";
    const art = el.querySelector(".fm-crop"); if (art) art.style.setProperty("--g", pr.toFixed(2));
    const lbl = el.querySelector(".fm-plabel");
    if (lbl) lbl.textContent = rdy ? ctxRef.t("fm_ready") : `${Math.ceil((growMs(p) - (now() - p.planted)) / 1000)}s`;
  });
}

// ---------- Arte de cultivo (SVG) ----------
function cropArt(crop, cls = "fm-crop") {
  const c = crop; if (!c) return "";
  const fruit = (cx, cy, r) => c.kind === "flor"
    ? `<g>${Array.from({ length: 8 }, (_, i) => `<ellipse cx="${cx}" cy="${cy}" rx="3" ry="7" fill="${c.color}" transform="rotate(${i * 45} ${cx} ${cy})"/>`).join("")}<circle cx="${cx}" cy="${cy}" r="4" fill="#6b4a2c"/></g>`
    : c.kind === "espiga" ? `<g fill="${c.color}">${Array.from({ length: 5 }, (_, i) => `<ellipse cx="${cx + (i % 2 ? 3 : -3)}" cy="${cy - i * 4}" rx="3" ry="2.4"/>`).join("")}</g>`
      : c.kind === "bola" ? `<circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="${c.color}"/><ellipse cx="${cx - 2}" cy="${cy - 2}" rx="2.5" ry="4" fill="rgba(255,255,255,.3)"/>`
        : c.kind === "raiz" ? `<path d="M${cx - 4} ${cy} L${cx + 4} ${cy} L${cx} ${cy + 10} Z" fill="${c.color}"/>`
          : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c.color}"/>`; // fruto / mazorca / vaina
  return `<svg class="${cls}" viewBox="0 0 60 70" style="--g:0">
    <ellipse cx="30" cy="63" rx="24" ry="6" fill="#4a3220"/><ellipse cx="30" cy="61" rx="24" ry="5" fill="#6b4a2c"/>
    <g class="fm-plant">
      <path d="M30 61 L30 24" stroke="#3a7d2c" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M30 46 q-12 -4 -16 -12" stroke="#3a7d2c" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M30 40 q12 -4 16 -12" stroke="#3a7d2c" stroke-width="3" fill="none" stroke-linecap="round"/>
      <g class="fm-fruit">${fruit(30, 22, 6)}${c.kind === "fruto" ? fruit(20, 30, 4) + fruit(40, 30, 4) : ""}</g>
    </g></svg>`;
}

// ---------- Pestaña: granja ----------
function farmTab(host, ctx) {
  const { t, esc } = ctx;
  host.innerHTML = `
    <div class="fm-grid">${farm.plots.map((p) => plotHtml(p, ctx)).join("")}</div>
    <div class="fm-actions">
      <button class="tile action" data-target data-harvestall><span class="t-main">${esc(t("fm_harvestAll"))}</span></button>
      <button class="nw-mini" data-target data-buyplot>+ ${esc(t("fm_buyPlot"))} (${usd(plotCost())})</button>
    </div>
    <p class="fm-hint mono">${esc(t("fm_hint"))}</p>
    <div class="fm-picker" hidden></div>`;
  host.querySelectorAll("[data-plot]").forEach((el) => el.addEventListener("click", () => plotClick(Number(el.dataset.plot), host, ctx)));
  host.querySelector("[data-harvestall]").addEventListener("click", () => { let n = 0; farm.plots.forEach((p) => { if (ready(p)) { harvest(p); n++; } }); if (n) { save(); renderFarm(bodyRef, ctx); } else toast(t("fm_nothingReady")); });
  host.querySelector("[data-buyplot]").addEventListener("click", () => {
    const cost = plotCost(); if (farm.money < cost) return toast(t("fm_noMoney"));
    farm.money -= cost; farm.plots.push({ id: farm.plots.length, crop: null, planted: 0, watered: false }); save(); renderFarm(bodyRef, ctx);
  });
}
function plotCost() { return 150 + (farm.plots.length - 6) * 120; }
function plotHtml(p, ctx) {
  const { t, esc } = ctx;
  const c = CROP(p.crop), pr = progress(p), rdy = pr >= 1;
  return `<div class="fm-plot ${p.crop ? (rdy ? "ready" : "growing") : "empty"}" data-plot="${p.id}">
    <div class="fm-soil">${p.crop ? cropArt(c) : `<svg viewBox="0 0 60 70"><ellipse cx="30" cy="63" rx="24" ry="6" fill="#4a3220"/><ellipse cx="30" cy="61" rx="24" ry="5" fill="#6b4a2c"/><g stroke="#573a22" stroke-width="2"><path d="M14 56h32M16 61h28"/></g></svg>`}</div>
    ${p.crop ? `<div class="fm-prog"><i style="width:${pr * 100}%"></i></div><span class="fm-plabel mono">${rdy ? esc(t("fm_ready")) : Math.ceil((growMs(p) - (now() - p.planted)) / 1000) + "s"}</span>`
      : `<span class="fm-plabel mono fm-dim">${esc(t("fm_empty"))}</span>`}
    ${c ? `<span class="fm-pname">${esc(c.name)}${p.watered ? " ·" : ""}</span>` : ""}</div>`;
}
function plotClick(id, host, ctx) {
  const p = farm.plots[id]; if (!p) return;
  if (!p.crop) return openSeedPicker(id, host, ctx);
  if (ready(p)) { harvest(p); save(); renderFarm(bodyRef, ctx); return; }
  // creciendo: regar
  if (!p.watered) { p.watered = true; save(); toast(ctx.t("fm_watered")); renderFarm(bodyRef, ctx); }
  else toast(ctx.t("fm_growingMsg"));
}
function openSeedPicker(id, host, ctx) {
  const { t, esc } = ctx;
  const owned = CROPS.filter((c) => (farm.seeds[c.id] || 0) > 0);
  const box = host.querySelector(".fm-picker"); box.hidden = false;
  box.innerHTML = `<div class="fm-card"><b>${esc(t("fm_choose"))}</b>
    ${owned.length ? `<div class="fm-seedgrid">${owned.map((c) => `<button class="fm-seed" data-plant="${c.id}"><span class="fm-seedart">${cropArt(c, "fm-crop mini")}</span><small>${esc(c.name)}</small><em class="mono">x${farm.seeds[c.id]}</em></button>`).join("")}</div>`
      : `<p class="fm-dim">${esc(t("fm_noSeeds"))}</p><button class="nw-mini" data-target data-goseeds>${esc(t("fm_goStore"))}</button>`}
    <div class="lb-row"><button class="nw-mini" data-target data-closep>${esc(t("fm_cancel"))}</button></div></div>`;
  box.querySelector("[data-closep]").addEventListener("click", () => { box.hidden = true; });
  box.querySelector("[data-goseeds]")?.addEventListener("click", () => { farm.tab = "seeds"; save(); renderFarm(bodyRef, ctx); });
  box.querySelectorAll("[data-plant]").forEach((b) => b.addEventListener("click", () => {
    const cid = b.dataset.plant; if (!(farm.seeds[cid] > 0)) return;
    farm.seeds[cid]--; Object.assign(farm.plots[id], { crop: cid, planted: now(), watered: false }); save(); renderFarm(bodyRef, ctx);
  }));
}
function harvest(p) {
  const c = CROP(p.crop); if (!c) return;
  farm.harvest[c.id] = (farm.harvest[c.id] || 0) + c.yield;
  farm.xp += c.yield * 3;
  while (farm.xp >= needXp()) { farm.xp -= needXp(); farm.level++; farm.money += farm.level * 20; }
  Object.assign(p, { crop: null, planted: 0, watered: false });
}

// ---------- Pestaña: semillas (tienda) ----------
function seedsTab(host, ctx) {
  const { t, esc } = ctx;
  host.innerHTML = `<p class="fm-hint mono">${esc(t("fm_storeHint"))}</p>
    <div class="fm-store">${CROPS.map((c) => `<div class="fm-item">
      <div class="fm-itemart">${cropArt(c, "fm-crop mini")}</div>
      <div class="fm-iteminfo"><b>${esc(c.name)}</b>
        <small class="mono">${esc(t("fm_grow"))}: ${c.grow}s · ${esc(t("fm_sellP"))}: ${usd(c.sell)}×${c.yield}${c.water ? " · " + esc(t("fm_waterTag")) : ""}</small>
        <span class="mono fm-dim">${esc(t("fm_have"))}: ${farm.seeds[c.id] || 0}</span></div>
      <button class="nw-mini" data-target data-buy="${c.id}">${esc(t("fm_buy"))} ${usd(c.seed)}</button>
    </div>`).join("")}</div>`;
  host.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => {
    const c = CROP(b.dataset.buy); if (farm.money < c.seed) return toast(t("fm_noMoney"));
    farm.money -= c.seed; farm.seeds[c.id] = (farm.seeds[c.id] || 0) + 1; save(); renderFarm(bodyRef, ctx);
  }));
}

// ---------- Pestaña: mercado ----------
function marketTab(host, ctx) {
  const { t, esc } = ctx;
  const inv = CROPS.filter((c) => (farm.harvest[c.id] || 0) > 0);
  const invValue = inv.reduce((s, c) => s + farm.harvest[c.id] * c.sell, 0);
  host.innerHTML = `
    <div class="fm-card2"><div class="fm-ph">${esc(t("fm_barn"))} · ${esc(t("fm_value"))}: ${usd(invValue)}</div>
      ${inv.length ? `<div class="fm-store">${inv.map((c) => `<div class="fm-item">
        <div class="fm-itemart">${cropArt(c, "fm-crop mini")}</div>
        <div class="fm-iteminfo"><b>${esc(c.name)}</b><small class="mono">${esc(t("fm_qty"))}: ${farm.harvest[c.id]} · ${usd(c.sell)} ${esc(t("fm_each"))}</small></div>
        <button class="nw-mini" data-target data-sell="${c.id}">${esc(t("fm_sell"))} (${usd(farm.harvest[c.id] * c.sell)})</button></div>`).join("")}</div>
        <button class="tile action" data-target data-sellall><span class="t-main">${esc(t("fm_sellAll"))} · ${usd(invValue)}</span></button>`
      : `<p class="fm-dim" style="padding:10px">${esc(t("fm_emptyBarn"))}</p>`}</div>
    <div class="fm-card2 fm-grow"><div class="fm-ph">${esc(t("fm_commodities"))}</div><div id="fmAgro" style="height:360px"></div></div>`;
  host.querySelectorAll("[data-sell]").forEach((b) => b.addEventListener("click", () => sell(b.dataset.sell, ctx)));
  host.querySelector("[data-sellall]")?.addEventListener("click", () => { inv.forEach((c) => sell(c.id, ctx, true)); save(); renderFarm(bodyRef, ctx); });
  if (navigator.onLine) tvWidget(host.querySelector("#fmAgro"), "market-overview", { colorTheme: "dark", showChart: true, isTransparent: true, locale: ctx.lang || "es", dateRange: "1D", tabs: [{ title: t("fm_commodities"), symbols: AGRO.map((a) => ({ s: a.proName, d: a.title })) }] });
}
function sell(cid, ctx, bulk) {
  const c = CROP(cid), qty = farm.harvest[cid] || 0; if (!qty) return;
  farm.money += qty * c.sell; farm.harvest[cid] = 0;
  if (!bulk) { save(); renderFarm(bodyRef, ctx); toast(`+${usd(qty * c.sell)}`); }
}

// ---------- Pestaña: agrónomo IA ----------
function agroTab(host, ctx) {
  const { t, esc } = ctx;
  const qs = [t("fm_q1"), t("fm_q2"), t("fm_q3"), t("fm_q4")];
  host.innerHTML = `<div class="fm-card2"><div class="fm-ph">${esc(t("fm_agroTitle"))}</div>
    <p class="fm-dim" style="padding:0 2px 6px">${esc(t("fm_agroIntro"))}</p>
    <div class="fm-chips">${qs.map((q) => `<button class="fm-chip" data-ask="${esc(q)}">${esc(q)}</button>`).join("")}</div>
    <div class="fm-askrow"><input class="q-in fm-ask" id="fmAsk" placeholder="${esc(t("fm_askPh"))}"><button class="nw-mini" data-target data-send>${esc(t("fm_send"))}</button></div>
    <div class="fm-ai mono" id="fmOut"></div></div>`;
  const ask = (q) => aiAgro(q, host.querySelector("#fmOut"), ctx);
  host.querySelectorAll("[data-ask]").forEach((b) => b.addEventListener("click", () => ask(b.dataset.ask)));
  host.querySelector("[data-send]").addEventListener("click", () => { const v = host.querySelector("#fmAsk").value.trim(); if (v) ask(v); });
  host.querySelector("#fmAsk").addEventListener("keydown", (e) => { if (e.key === "Enter") { const v = e.target.value.trim(); if (v) ask(v); } });
}
async function aiAgro(q, out, ctx) {
  out.textContent = ctx.t("fm_thinking");
  const msg = ctx.t("fm_prompt").replace("{q}", q);
  let full = "";
  try { await ctx.stream({ messages: [{ role: "user", content: msg }], mode: "chat", channel: "text" }, { onText: (d) => { full += d; out.textContent = full; } }); if (!full) out.textContent = ctx.t("errGeneric"); } catch { out.textContent = ctx.t("errGeneric"); }
}

function toast(msg) {
  const tm = bodyRef?.querySelector(".fm-top") || bodyRef; if (!tm) return;
  const el = document.createElement("div"); el.className = "fm-toast mono"; el.textContent = msg;
  bodyRef.appendChild(el); setTimeout(() => { el.classList.add("gone"); setTimeout(() => el.remove(), 400); }, 2200);
}
export function stopFarm() { clearInterval(timer); bodyRef = null; }
