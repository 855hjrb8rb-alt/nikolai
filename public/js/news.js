// Noticias: titulares reales con foto que se actualizan solos cada día (sin gastar la clave),
// por región (USA, México, Europa…) y tema, con bolsa en vivo y resumen opcional con IA.
//
// Fuentes (gratis y sin clave, se combinan):
//  · GDELT (api.gdeltproject.org): noticias de miles de medios cada 15 min, con foto.
//  · Google Noticias y medios (BBC, El País, Infobae, CNN…) por RSS, leídos con rss2json.
import { renderInto, speakable } from "./md.js";
import { tvWidget } from "./markets.js";
import { profile } from "./extras.js";

export const REGIONS = ["usa", "mexico", "europe", "world", "local"];
export const TOPICS = ["top", "markets", "economy", "politics", "tech", "sports", "science", "health", "entertainment"];
const REFRESH = 2 * 3600_000; // se actualiza solo cada 2 horas (y siempre al cambiar de día)

// Índices que se ven arriba cuando el tema es «Bolsa».
const INDICES = {
  usa: [["FOREXCOM:SPXUSD", "S&P 500"], ["FOREXCOM:NSXUSD", "Nasdaq 100"], ["FOREXCOM:DJI", "Dow Jones"], ["TVC:VIX", "VIX"]],
  mexico: [["BMV:ME", "IPC BMV"], ["FX_IDC:USDMXN", "USD/MXN"], ["BMV:WALMEX", "Walmex"], ["BMV:GFNORTEO", "Banorte"]],
  europe: [["TVC:SX5E", "Euro Stoxx 50"], ["INDEX:DEU40", "DAX"], ["TVC:UKX", "FTSE 100"], ["FX:EURUSD", "EUR/USD"]],
  world: [["FOREXCOM:SPXUSD", "S&P 500"], ["INDEX:DEU40", "DAX"], ["INDEX:NKY", "Nikkei"], ["BINANCE:BTCUSDT", "Bitcoin"]],
};

// ---------- Búsquedas por idioma ----------
const Q = {
  es: {
    region: { usa: '"Estados Unidos"', mexico: "México", europe: "(Europa OR España OR Alemania OR Francia OR Italia)", world: "", local: "" },
    topic: {
      top: "", markets: '(bolsa OR acciones OR "Wall Street" OR BMV OR Nasdaq OR mercados)', economy: "(economía OR inflación OR dólar OR peso OR empleo)",
      politics: "(gobierno OR política OR elecciones OR congreso)", tech: '(tecnología OR "inteligencia artificial" OR Apple OR Google)',
      sports: "(fútbol OR deportes OR NBA OR NFL OR béisbol)", science: "(ciencia OR NASA OR espacio OR científicos)",
      health: "(salud OR hospital OR médicos OR enfermedad)", entertainment: "(cine OR música OR serie OR famosos OR concierto)",
    },
    gn: { usa: ["US", "es-419"], mexico: ["MX", "es-419"], europe: ["ES", "es"], world: ["MX", "es-419"], local: ["MX", "es-419"] },
    gdeltLang: "spanish",
  },
  en: {
    region: { usa: '"United States"', mexico: "Mexico", europe: "(Europe OR Germany OR France OR Britain OR Italy)", world: "", local: "" },
    topic: {
      top: "", markets: '(stocks OR "Wall Street" OR Nasdaq OR markets OR shares)', economy: "(economy OR inflation OR jobs OR dollar)",
      politics: "(government OR politics OR election OR congress)", tech: '(technology OR "artificial intelligence" OR Apple OR Google)',
      sports: "(football OR soccer OR NBA OR NFL OR baseball)", science: "(science OR NASA OR space OR scientists)",
      health: "(health OR hospital OR doctors OR disease)", entertainment: "(movie OR music OR series OR celebrity OR concert)",
    },
    gn: { usa: ["US", "en"], mexico: ["US", "en"], europe: ["GB", "en"], world: ["US", "en"], local: ["US", "en"] },
    gdeltLang: "english",
  },
};
// Medios con foto por RSS (los de Google Noticias casi nunca traen imagen).
const FEEDS = {
  es: {
    usa: ["https://cnnespanol.cnn.com/feed/", "https://feeds.bbci.co.uk/mundo/rss.xml"],
    mexico: ["https://www.infobae.com/arc/outboundfeeds/rss/category/mexico/", "https://www.elfinanciero.com.mx/arc/outboundfeeds/rss/?outputType=xml"],
    europe: ["https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada", "https://es.euronews.com/rss"],
    world: ["https://feeds.bbci.co.uk/mundo/rss.xml", "https://www.infobae.com/arc/outboundfeeds/rss/"],
    markets: ["https://es.investing.com/rss/news.rss", "https://www.elfinanciero.com.mx/arc/outboundfeeds/rss/?outputType=xml"],
  },
  en: {
    usa: ["https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml"],
    mexico: ["https://feeds.bbci.co.uk/news/world/latin_america/rss.xml"],
    europe: ["https://feeds.bbci.co.uk/news/world/europe/rss.xml"],
    world: ["https://feeds.bbci.co.uk/news/world/rss.xml"],
    markets: ["https://feeds.bbci.co.uk/news/business/rss.xml"],
    economy: ["https://feeds.bbci.co.uk/news/business/rss.xml"], tech: ["https://feeds.bbci.co.uk/news/technology/rss.xml"],
    science: ["https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"], health: ["https://feeds.bbci.co.uk/news/health/rss.xml"],
    entertainment: ["https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml"], sports: ["https://feeds.bbci.co.uk/sport/rss.xml"],
  },
};

// ---------- Estado y caché ----------
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const old = load("nikolai.news", {});
const feeds = load("nikolai.newsFeed", {});
const summaries = load("nikolai.newsCache", {});
export const news = {
  region: REGIONS.includes(old.region) ? old.region : "usa", topic: TOPICS.includes(old.topic) ? old.topic : "top",
  items: [], at: 0, loading: false, error: false,
  ai: false, text: "", textAt: 0, busy: false, brief: false, follow: "", followBusy: false, explain: null,
};
const key = () => `${news.region}|${news.topic}`;
const langOf = (lang) => (String(lang || "es").startsWith("es") ? "es" : "en");

function restore() {
  const f = feeds[key()];
  news.items = f?.items || []; news.at = f?.at || 0; news.error = false;
  const s = summaries[news.brief ? "brief" : key()];
  news.text = s?.text || ""; news.textAt = s?.at || 0;
}
restore();

function saveFeeds() {
  Object.keys(feeds).sort((a, b) => feeds[b].at - feeds[a].at).slice(10).forEach((k) => delete feeds[k]);
  try {
    localStorage.setItem("nikolai.newsFeed", JSON.stringify(feeds));
    localStorage.setItem("nikolai.news", JSON.stringify({ region: news.region, topic: news.topic }));
  } catch { /* lleno */ }
}
function saveSummary(k) {
  summaries[k] = { text: news.text, at: news.textAt };
  Object.keys(summaries).sort((a, b) => summaries[b].at - summaries[a].at).slice(8).forEach((x) => delete summaries[x]);
  try { localStorage.setItem("nikolai.newsCache", JSON.stringify(summaries)); } catch { /* lleno */ }
}

/** ¿Hay que volver a descargar? (más de 2 horas o es otro día) */
export function isStale(at) {
  return !at || Date.now() - at > REFRESH || new Date(at).toDateString() !== new Date().toDateString();
}

// ---------- Descarga de titulares ----------
const withTimeout = (url, ms = 12000) => {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), ms);
  return fetch(url, { signal: ctl.signal }).finally(() => clearTimeout(id));
};
const stripHtml = (s) => String(s || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

async function fromGdelt(region, topic, L, city) {
  const q = Q[L];
  const parts = [q.region[region] || "", q.topic[topic] || "", `sourcelang:${q.gdeltLang}`];
  if (region === "local" && city) parts[0] = `"${city.replace(/"/g, "")}"`;
  if (region === "mexico" && L === "es") parts[0] = "sourcecountry:MX";
  const query = parts.filter(Boolean).join(" ");
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&format=json&maxrecords=60&sort=hybridrel&timespan=1d`;
  const r = await withTimeout(url);
  const text = await r.text();
  const j = JSON.parse(text); // si GDELT pide esperar, responde texto y esto falla
  return (j.articles || []).map((a) => {
    const m = /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/.exec(a.seendate || "");
    return {
      t: a.title, u: a.url, img: a.socialimage || "", src: a.domain || host(a.url),
      at: m ? Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5], m[6]) : Date.now(),
    };
  });
}

async function fromRss(rssUrl) {
  const r = await withTimeout(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`);
  const j = await r.json();
  if (j.status !== "ok") throw new Error(j.message || "rss");
  const feedName = stripHtml(j.feed?.title || "").split(/[-|:]/)[0].trim();
  return (j.items || []).map((it) => {
    const imgInDesc = /<img[^>]+src=["']([^"']+)/i.exec(it.description || it.content || "")?.[1];
    const enc = it.enclosure?.link && /image|jpg|jpeg|png|webp/i.test(it.enclosure.type || it.enclosure.link) ? it.enclosure.link : "";
    let title = stripHtml(it.title), src = feedName || host(it.link);
    // Google Noticias pone «Titular - Medio».
    if (/news\.google\./.test(rssUrl)) { const k = title.lastIndexOf(" - "); if (k > 20) { src = title.slice(k + 3); title = title.slice(0, k); } }
    return {
      t: title, u: it.link, img: it.thumbnail || enc || imgInDesc || "", src,
      d: stripHtml(it.description).slice(0, 220), at: Date.parse((it.pubDate || "").replace(" ", "T") + (/(Z|[+-]\d\d:?\d\d)$/.test(it.pubDate || "") ? "" : "Z")) || Date.now(),
    };
  });
}

function googleNews(region, topic, L, city) {
  const q = Q[L];
  const [gl, hl] = q.gn[region];
  const terms = [region === "local" ? `"${city}"` : region === "usa" || region === "mexico" ? "" : q.region[region], q.topic[topic]].filter(Boolean).join(" ");
  const ceid = `${gl}:${hl}`;
  return terms
    ? `https://news.google.com/rss/search?q=${encodeURIComponent(terms + " when:1d")}&hl=${hl}&gl=${gl}&ceid=${ceid}`
    : `https://news.google.com/rss?hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

/** Descarga y mezcla los titulares de la región y el tema elegidos. */
export async function loadFeed(lang, region = news.region, topic = news.topic) {
  const L = langOf(lang);
  const city = profile.city || (L === "es" ? "México" : "");
  const curated = topic === "top" ? FEEDS[L][region] || []
    : topic === "markets" ? FEEDS[L].markets
    : region === "world" ? FEEDS[L][topic] || [] : [];
  const jobs = [
    fromGdelt(region, topic, L, city),
    fromRss(googleNews(region, topic, L, city)),
    ...curated.map(fromRss),
  ];
  const results = await Promise.allSettled(jobs);
  const seen = new Set();
  const day = Date.now() - 36 * 3600_000;
  const items = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .filter((it) => it.t && it.u && it.at > day)
    .filter((it) => {
      const k = it.t.toLowerCase().replace(/[^a-z0-9áéíóúñ]/g, "").slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  // Primero las que tienen foto, y dentro de cada grupo las más nuevas.
  items.sort((a, b) => (Boolean(b.img) - Boolean(a.img)) || b.at - a.at);
  if (!items.length) throw new Error("empty");
  const k = `${region}|${topic}`;
  feeds[k] = { at: Date.now(), items: items.slice(0, 30) };
  saveFeeds();
  return feeds[k];
}

/** Descarga en segundo plano los titulares por defecto para que estén listos (sin gastar la clave). */
export function prefetchNews(lang) {
  if (!navigator.onLine || !isStale(feeds[key()]?.at)) return;
  loadFeed(lang).then((f) => { if (!news.loading) { news.items = f.items; news.at = f.at; } }).catch(() => {});
}

/** Primeros titulares para leerlos en voz alta. */
export function headlines(n = 5) { return news.items.slice(0, n).map((it) => it.t); }

// ---------- Interfaz ----------
const ago = (t, at) => {
  const m = Math.round((Date.now() - at) / 60000);
  return m < 1 ? t("nw_now") : m < 60 ? t("nw_min").replace("{m}", m) : m < 48 * 60 ? t("nw_hours").replace("{h}", Math.round(m / 60)) : new Date(at).toLocaleDateString();
};
const PLACEHOLDER = { top: "◉", markets: "📈", economy: "💱", politics: "🏛", tech: "💡", sports: "⚽", science: "🔭", health: "✚", entertainment: "🎬" };

function card(it, i, ctx, hero) {
  const { esc, t } = ctx;
  const img = it.img && /^https?:/.test(it.img)
    ? `<img src="${esc(it.img)}" alt="" loading="${i < 4 ? "eager" : "lazy"}" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('noimg');this.remove()">`
    : "";
  return `<article class="nw-card ${hero ? "hero" : ""} ${img ? "" : "noimg"}" data-i="${i}">
    <a class="nw-img" href="${esc(it.u)}" target="_blank" rel="noopener" data-target>${img}<span class="nw-ph">${PLACEHOLDER[news.topic] || "◉"}<small>${esc(it.src)}</small></span></a>
    <div class="nw-body">
      <div class="nw-meta mono"><img class="nw-fav" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(host(it.u))}&sz=32" alt="" referrerpolicy="no-referrer" onerror="this.remove()">${esc(it.src)} · ${esc(ago(t, it.at))}</div>
      <a class="nw-title" href="${esc(it.u)}" target="_blank" rel="noopener" data-target>${esc(it.t)}</a>
      ${hero && it.d ? `<p class="nw-desc">${esc(it.d)}</p>` : ""}
      <div class="nw-btns">
        <button class="nw-mini" data-target data-act="say">${esc(t("nw_listen"))}</button>
        <button class="nw-mini" data-target data-act="explain">${esc(t("nw_explain"))}</button>
      </div>
      ${news.explain?.i === i ? `<div class="hw-out nw-explain" id="nwExplain"></div>` : ""}
    </div>
  </article>`;
}

export function renderNews(body, ctx) {
  const { t, esc, tile, icon } = ctx;
  const idx = news.topic === "markets" ? INDICES[news.region] || INDICES.usa : null;
  const items = news.items;
  body.innerHTML = `
    <div class="tabs" id="nwRegions">${REGIONS.map((k) => tile(esc(t("nr_" + k)), "", news.region === k ? "on" : "")).join("")}</div>
    <div class="tabs" id="nwTopics">${TOPICS.map((k) => tile(esc(t("nw_" + k)), "", news.topic === k ? "on" : "")).join("")}</div>
    <div class="nw-bar">
      <span class="mono muted">${news.loading ? esc(t("nw_searching")) : news.at ? `${esc(t("nw_updated"))} ${esc(ago(t, news.at))} · ${items.length} ${esc(t("nw_stories"))}` : ""}</span>
      <span class="nw-tools">
        <button class="nw-mini ${news.loading ? "live" : ""}" data-target data-act="refresh">↻ ${esc(t("nw_refresh"))}</button>
        <button class="nw-mini" data-target data-act="headlines">${esc(t("nw_readHeadlines"))}</button>
        <button class="nw-mini ${news.ai ? "on" : ""}" data-target data-act="ai">${esc(t("nw_aiSummary"))}</button>
      </span>
    </div>
    ${idx ? `<div class="nw-indices" id="nwIdx"></div>` : ""}
    ${news.ai ? `
      <div class="nw-ai">
        <div class="tiles nw-actions">
          ${tile(`${icon("send")}<br>${esc(news.busy && !news.brief ? t("thinking") : t("nw_get"))}`, "", "action nw-get" + (news.busy && !news.brief ? " live" : ""))}
          ${tile(`${icon("news")}<br>${esc(news.busy && news.brief ? t("thinking") : t("nw_brief"))}`, "", "action nw-brief" + (news.busy && news.brief ? " live" : ""))}
          ${tile(`${icon("speaker")}<br>${esc(t("readAloud"))}`, "", "action nw-read")}
        </div>
        ${news.textAt && !news.busy ? `<p class="muted mono">${esc(t("nw_updated"))} ${esc(ago(t, news.textAt))}</p>` : ""}
        <div class="hw-out" id="nwOut"></div>
        ${news.text && !news.busy ? `
          <div class="form-row nw-ask">
            <input class="field" id="nwQ" placeholder="${esc(t("nw_ask"))}">
            ${tile(esc(news.followBusy ? t("thinking") : t("nw_askBtn")), "", "nw-askbtn" + (news.followBusy ? " live" : ""))}
          </div>
          <div class="hw-out" id="nwFollow"></div>` : ""}
      </div>` : ""}
    <div class="nw-grid">
      ${items.length ? items.map((it, i) => card(it, i, ctx, i === 0)).join("")
        : `<p class="muted">${esc(news.loading ? t("nw_searching") : news.error ? (navigator.onLine ? t("nw_feedError") : t("nw_offline")) : t("nw_searching"))}</p>`}
    </div>
    ${news.topic === "markets" ? `<div class="k mono nw-label">${esc(t("nw_live").toUpperCase())}</div><div class="nw-live" id="nwLive"></div>` : ""}
    <p class="muted mono nw-credits">${esc(t("nw_sources"))}</p>`;

  const pick = () => { news.follow = ""; news.explain = null; restore(); renderNews(body, ctx); if (isStale(news.at)) refresh(body, ctx); };
  body.querySelectorAll("#nwRegions .tile").forEach((el, i) => el.addEventListener("click", () => { news.region = REGIONS[i]; pick(); }));
  body.querySelectorAll("#nwTopics .tile").forEach((el, i) => el.addEventListener("click", () => { news.topic = TOPICS[i]; pick(); }));
  body.querySelectorAll(".nw-bar [data-act]").forEach((b) => b.addEventListener("click", () => {
    const act = b.dataset.act;
    if (act === "refresh") refresh(body, ctx);
    else if (act === "headlines") items.length && ctx.speak(`${t("nw_headlinesIntro")} ${headlines(5).map((h, i) => `${i + 1}. ${h}.`).join(" ")}`);
    else if (act === "ai") { news.ai = !news.ai; renderNews(body, ctx); }
  }));
  body.querySelectorAll(".nw-card [data-act]").forEach((b) => b.addEventListener("click", () => {
    const i = Number(b.closest(".nw-card").dataset.i);
    if (b.dataset.act === "say") ctx.speak(items[i].t + (items[i].d ? ". " + items[i].d : ""));
    else explain(body, ctx, i);
  }));
  const ex = body.querySelector("#nwExplain");
  if (ex) renderInto(ex, news.explain.text || t("thinking"));

  if (news.ai) {
    body.querySelector(".nw-get").addEventListener("click", () => { news.brief = false; summarize(body, ctx); });
    body.querySelector(".nw-brief").addEventListener("click", () => { news.brief = true; news.follow = ""; summarize(body, ctx); });
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
  }

  if (idx && navigator.onLine) {
    tvWidget(body.querySelector("#nwIdx"), "tickers", { symbols: idx.map(([proName, title]) => ({ proName, title })), locale: ctx.lang || "es" });
  }
  const live = body.querySelector("#nwLive");
  if (live && navigator.onLine) tvWidget(live, "timeline", { feedMode: "market", market: "stock", displayMode: "compact", locale: ctx.lang || "es" });

  // Se actualiza solo: al abrir, si los titulares son de otro día o de hace más de 2 horas.
  if (!news.loading && !news.error && isStale(news.at) && navigator.onLine) refresh(body, ctx);
}

async function refresh(body, ctx) {
  const k = key();
  if (news.loading === k) return;
  news.loading = k; news.error = false;
  if (body.isConnected) renderNews(body, ctx);
  try {
    const f = await loadFeed(ctx.lang);
    if (key() === k) { news.items = f.items; news.at = f.at; }
  } catch {
    if (key() === k) news.error = true;
  } finally {
    if (news.loading === k) news.loading = false;
    if (body.isConnected) renderNews(body, ctx);
  }
}

// ---------- IA (opcional, usa la clave) ----------
function promptFor(t) {
  const place = profile.city || t("nw_defaultRegion");
  if (news.brief) return t("nw_briefPrompt").replace("{place}", place);
  const region = news.region === "local" ? place : t("nr_" + news.region);
  let p = t("nw_prompt").replace("{topic}", t("nw_" + news.topic)).replace("{region}", region).replace("{place}", place);
  if (news.topic === "markets") p += " " + t("nw_marketsExtra").replace("{region}", region);
  // Le pasamos los titulares que ya tenemos para que los use como punto de partida.
  if (news.items.length) p += "\n\n" + t("nw_known") + "\n" + news.items.slice(0, 12).map((it) => `- ${it.t} (${it.src})`).join("\n");
  return p;
}

async function summarize(body, ctx) {
  if (news.busy) return;
  const k = news.brief ? "brief" : key();
  news.busy = true; news.text = ""; news.follow = "";
  renderNews(body, ctx);
  let full = "";
  try {
    const err = await ctx.stream(
      { messages: [{ role: "user", content: promptFor(ctx.t) }], mode: "news", channel: "text" },
      { onText: (d) => { full += d; const out = body.querySelector("#nwOut"); if (out) renderInto(out, full); } },
    );
    news.text = full || ctx.errorText(err);
    news.textAt = Date.now();
    if (full) saveSummary(k);
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
        messages: [{ role: "user", content: promptFor(ctx.t) }, { role: "assistant", content: news.text }, { role: "user", content: question }],
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

async function explain(body, ctx, i) {
  const it = news.items[i];
  if (news.explain?.busy) return;
  news.explain = { i, text: "", busy: true };
  renderNews(body, ctx);
  body.querySelector(`.nw-card[data-i="${i}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  let full = "";
  try {
    const err = await ctx.stream(
      { messages: [{ role: "user", content: ctx.t("nw_explainPrompt").replace("{title}", it.t).replace("{src}", it.src).replace("{url}", it.u) }], mode: "news", channel: "text", followUp: true },
      { onText: (d) => { full += d; const ex = body.querySelector("#nwExplain"); if (ex) renderInto(ex, full); } },
    );
    news.explain.text = full || ctx.errorText(err);
  } catch {
    news.explain.text = ctx.t("errGeneric");
  } finally {
    news.explain.busy = false;
    if (body.isConnected) renderNews(body, ctx);
  }
}
