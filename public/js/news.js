// Noticias: por región (USA, México, Europa…) y tema, con bolsa en vivo y resumen con fuentes.
import { renderInto, speakable } from "./md.js";
import { tvWidget } from "./markets.js";
import { profile } from "./extras.js";

export const REGIONS = ["usa", "mexico", "europe", "world", "local"];
export const TOPICS = ["top", "markets", "economy", "politics", "tech", "sports", "science", "health", "entertainment"];

// Índices que se ven arriba cuando el tema es «Bolsa».
const INDICES = {
  usa: [["FOREXCOM:SPXUSD", "S&P 500"], ["FOREXCOM:NSXUSD", "Nasdaq 100"], ["FOREXCOM:DJI", "Dow Jones"], ["TVC:VIX", "VIX"]],
  mexico: [["BMV:ME", "IPC BMV"], ["FX_IDC:USDMXN", "USD/MXN"], ["BMV:WALMEX", "Walmex"], ["BMV:GFNORTEO", "Banorte"]],
  europe: [["TVC:SX5E", "Euro Stoxx 50"], ["INDEX:DEU40", "DAX"], ["TVC:UKX", "FTSE 100"], ["FX:EURUSD", "EUR/USD"]],
  world: [["FOREXCOM:SPXUSD", "S&P 500"], ["INDEX:DEU40", "DAX"], ["INDEX:NKY", "Nikkei"], ["BINANCE:BTCUSDT", "Bitcoin"]],
};

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const saved = load("nikolai.newsCache", {});
const old = load("nikolai.news", {});
export const news = {
  region: old.region || "usa", topic: old.topic || "top",
  text: "", at: 0, busy: false, follow: "", followBusy: false,
};
const key = () => `${news.region}|${news.topic}`;
function restore() {
  const c = saved[news.brief ? "brief" : key()];
  news.text = c?.text || ""; news.at = c?.at || 0;
}
restore();
function persist(k) {
  saved[k] = { text: news.text, at: news.at };
  const keys = Object.keys(saved).sort((a, b) => saved[b].at - saved[a].at);
  keys.slice(12).forEach((x) => delete saved[x]);
  try {
    localStorage.setItem("nikolai.newsCache", JSON.stringify(saved));
    localStorage.setItem("nikolai.news", JSON.stringify({ region: news.region, topic: news.topic }));
  } catch { /* lleno */ }
}

const ago = (t, at) => {
  const m = Math.round((Date.now() - at) / 60000);
  return m < 1 ? t("nw_now") : m < 60 ? t("nw_min").replace("{m}", m) : t("nw_hours").replace("{h}", Math.round(m / 60));
};

export function renderNews(body, ctx) {
  const { t, esc, tile, icon } = ctx;
  const idx = news.topic === "markets" && !news.brief ? INDICES[news.region] || INDICES.usa : null;
  body.innerHTML = `
    <div class="k mono nw-label">${esc(t("nw_region").toUpperCase())}</div>
    <div class="tabs" id="nwRegions">${REGIONS.map((k) => tile(esc(t("nr_" + k)), "", !news.brief && news.region === k ? "on" : "")).join("")}</div>
    <div class="k mono nw-label">${esc(t("nw_topic").toUpperCase())}</div>
    <div class="tabs" id="nwTopics">${TOPICS.map((k) => tile(esc(t("nw_" + k)), "", !news.brief && news.topic === k ? "on" : "")).join("")}</div>
    <div class="tiles nw-actions">
      ${tile(`${icon("send")}<br>${esc(news.busy && !news.brief ? t("thinking") : t("nw_get"))}`, "", "action nw-get" + (news.busy && !news.brief ? " live" : ""))}
      ${tile(`${icon("news")}<br>${esc(news.busy && news.brief ? t("thinking") : t("nw_brief"))}`, "", "action nw-brief" + (news.brief ? " on" : "") + (news.busy && news.brief ? " live" : ""))}
      ${tile(`${icon("speaker")}<br>${esc(t("readAloud"))}`, "", "action nw-read")}
    </div>
    ${idx ? `<div class="nw-indices" id="nwIdx"></div>` : ""}
    ${news.at && !news.busy ? `<p class="muted mono">${esc(t("nw_updated"))} ${esc(ago(t, news.at))}</p>` : ""}
    <div class="hw-out" id="nwOut"></div>
    ${news.text && !news.busy ? `
      <div class="form-row nw-ask">
        <input class="field" id="nwQ" placeholder="${esc(t("nw_ask"))}">
        ${tile(esc(news.followBusy ? t("thinking") : t("nw_askBtn")), "", "nw-askbtn" + (news.followBusy ? " live" : ""))}
      </div>
      <div class="hw-out" id="nwFollow"></div>` : ""}
    ${news.topic === "markets" && !news.brief ? `<div class="k mono nw-label">${esc(t("nw_live").toUpperCase())}</div><div class="nw-live" id="nwLive"></div>` : ""}`;

  body.querySelectorAll("#nwRegions .tile").forEach((el, i) => el.addEventListener("click", () => {
    news.region = REGIONS[i]; news.brief = false; news.follow = ""; restore();
    renderNews(body, ctx); if (!news.text || Date.now() - news.at > 30 * 60_000) fetchNews(body, ctx);
  }));
  body.querySelectorAll("#nwTopics .tile").forEach((el, i) => el.addEventListener("click", () => {
    news.topic = TOPICS[i]; news.brief = false; news.follow = ""; restore();
    renderNews(body, ctx); if (!news.text || Date.now() - news.at > 30 * 60_000) fetchNews(body, ctx);
  }));
  body.querySelector(".nw-get").addEventListener("click", () => { news.brief = false; fetchNews(body, ctx); });
  body.querySelector(".nw-brief").addEventListener("click", () => { news.brief = true; news.follow = ""; fetchNews(body, ctx); });
  body.querySelector(".nw-read").addEventListener("click", () => news.text && ctx.speak(speakable(news.text)));

  const out = body.querySelector("#nwOut");
  if (news.text) renderInto(out, news.text);
  else if (!news.busy) out.innerHTML = `<p class="muted">${esc(t("nw_hint"))}</p>`;

  const fo = body.querySelector("#nwFollow");
  if (fo && news.follow) renderInto(fo, news.follow);
  const q = body.querySelector("#nwQ");
  if (q) {
    const go = () => q.value.trim() && askFollow(body, ctx, q.value.trim());
    body.querySelector(".nw-askbtn").addEventListener("click", go);
    q.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  }

  if (idx && navigator.onLine) {
    tvWidget(body.querySelector("#nwIdx"), "tickers", { symbols: idx.map(([proName, title]) => ({ proName, title })), locale: ctx.lang || "es" });
  }
  const live = body.querySelector("#nwLive");
  if (live && navigator.onLine) tvWidget(live, "timeline", { feedMode: "market", market: "stock", displayMode: "compact", locale: ctx.lang || "es" });
}

function promptFor(t) {
  const place = profile.city || t("nw_defaultRegion");
  if (news.brief) return t("nw_briefPrompt").replace("{place}", place);
  const region = news.region === "local" ? place : t("nr_" + news.region);
  let p = t("nw_prompt").replace("{topic}", t("nw_" + news.topic)).replace("{region}", region).replace("{place}", place);
  if (news.topic === "markets") p += " " + t("nw_marketsExtra").replace("{region}", region);
  return p;
}

async function fetchNews(body, ctx) {
  if (news.busy) return;
  const k = news.brief ? "brief" : key();
  news.busy = true; news.text = ""; news.follow = "";
  renderNews(body, ctx);
  let out = body.querySelector("#nwOut");
  out.innerHTML = `<p class="muted">${ctx.esc(ctx.t("nw_searching"))}</p>`;
  let full = "";
  try {
    const err = await ctx.stream(
      { messages: [{ role: "user", content: promptFor(ctx.t) }], mode: "news", channel: "text" },
      { onText: (d) => { full += d; out = body.querySelector("#nwOut") || out; if (out.isConnected) renderInto(out, full); } },
    );
    news.text = full || ctx.errorText(err);
    news.at = Date.now();
    if (full) persist(k);
  } catch {
    news.text = ctx.t("errGeneric");
  } finally {
    news.busy = false;
    if (body.isConnected) renderNews(body, ctx);
  }
}

async function askFollow(body, ctx, question) {
  if (news.followBusy) return;
  news.followBusy = true; news.follow = "";
  renderNews(body, ctx);
  let full = "";
  try {
    const err = await ctx.stream(
      {
        messages: [
          { role: "user", content: promptFor(ctx.t) },
          { role: "assistant", content: news.text },
          { role: "user", content: question },
        ],
        mode: "news", channel: "text", followUp: true,
      },
      { onText: (d) => { full += d; const fo = body.querySelector("#nwFollow"); if (fo) renderInto(fo, full); } },
    );
    news.follow = full || ctx.errorText(err);
  } catch {
    news.follow = ctx.t("errGeneric");
  } finally {
    news.followBusy = false;
    if (body.isConnected) renderNews(body, ctx);
  }
}
