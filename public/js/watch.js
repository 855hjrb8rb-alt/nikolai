// Ver juntos: abres Netflix, Prime Video, etc. y NIKOLAI te acompaña como compañera de sofá:
// reacciona, opina, responde dudas y cuenta curiosidades sin spoilers. Puede flotar encima
// de la película (ventana flotante de Chrome/Edge) y, si quieres, mirar tu pantalla.
import { renderInto } from "./md.js";

export const PLATFORMS = [
  { id: "netflix", name: "Netflix", url: "https://www.netflix.com/browse", color: "#e50914" },
  { id: "prime", name: "Prime Video", url: "https://www.primevideo.com", color: "#1a98ff" },
  { id: "disney", name: "Disney+", url: "https://www.disneyplus.com", color: "#2f5cff" },
  { id: "max", name: "Max", url: "https://www.max.com", color: "#5b3cff" },
  { id: "vix", name: "ViX", url: "https://vix.com", color: "#ff6a13" },
  { id: "appletv", name: "Apple TV+", url: "https://tv.apple.com", color: "#d9d9d9" },
  { id: "crunchyroll", name: "Crunchyroll", url: "https://www.crunchyroll.com", color: "#f47521" },
  { id: "youtube", name: "YouTube", url: "https://www.youtube.com", color: "#ff3030" },
];
const QUICK = ["lol", "shock", "sad", "who", "opinion", "explain", "trivia", "music"];
const KEY = "nikolai.watch";

const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
export const watch = Object.assign(
  { platform: "netflix", title: "", ep: "", spoilers: false, active: false, startedAt: 0, offset: 0, paused: false, pausedAt: 0, log: [], auto: false, speak: false, lastAi: 0 },
  load(),
  { busy: false, screen: null, recs: "", recBusy: false },
);
const save = () => {
  const { busy, screen, recs, recBusy, ...rest } = watch;
  rest.log = rest.log.slice(-40);
  try { localStorage.setItem(KEY, JSON.stringify(rest)); } catch { /* lleno */ }
};
export function minuteNow() {
  if (!watch.active) return 0;
  const end = watch.paused ? watch.pausedAt : Date.now();
  return Math.max(0, Math.round(watch.offset + (end - watch.startedAt) / 60000));
}
const platform = () => PLATFORMS.find((p) => p.id === watch.platform) || PLATFORMS[0];

// Vistas abiertas (el panel y la ventana flotante) para repintarlas a la vez.
const views = new Set();
let pipWin = null;
let autoTimer = 0;
function refreshAll() { for (const v of [...views]) { if (!v.root.isConnected) views.delete(v); else v.draw(); } }

// =====================================================================
// IA
// =====================================================================
async function send(ctx, text, { hidden = false, look = false } = {}) {
  if (watch.busy || !watch.active) return;
  let images;
  if (look) {
    const shot = await grabScreen(ctx);
    if (!shot) return;
    if (shot === "black") { watch.log.push({ role: "assistant", content: ctx.t("wt_drm") }); save(); refreshAll(); return; }
    images = [{ media_type: "image/jpeg", data: shot }];
  }
  watch.log.push({ role: "user", content: text, hidden });
  const reply = { role: "assistant", content: "…", pending: true };
  watch.log.push(reply);
  watch.busy = true;
  refreshAll();
  // Historial limpio: alterna usuario/asistente y empieza por el usuario.
  const msgs = [];
  for (const m of watch.log.slice(0, -1).slice(-16)) {
    if (m.pending || !m.content) continue;
    if (msgs.length && msgs[msgs.length - 1].role === m.role) msgs[msgs.length - 1] = { role: m.role, content: m.content };
    else msgs.push({ role: m.role, content: m.content });
  }
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  let full = "";
  try {
    const err = await ctx.stream(
      { messages: msgs, channel: "text", watch: { title: watch.title, ep: watch.ep, platform: platform().name, minute: minuteNow(), spoilers: watch.spoilers }, ...(images ? { images } : {}) },
      { onText: (d) => { full += d; reply.content = full; for (const v of views) v.updateLast?.(full); } },
    );
    reply.content = full || ctx.errorText(err);
    if (full && watch.speak) ctx.speak(full);
  } catch {
    reply.content = ctx.t("errGeneric");
  }
  delete reply.pending;
  watch.busy = false;
  watch.lastAi = Date.now();
  save();
  refreshAll();
}

// ---------- Mirar la pantalla ----------
async function grabScreen(ctx) {
  try {
    if (!watch.screen || !watch.screen.active) {
      watch.screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 2 }, audio: false, selfBrowserSurface: "exclude" });
      watch.screen.getVideoTracks()[0].addEventListener("ended", () => { watch.screen = null; refreshAll(); });
    }
  } catch {
    watch.log.push({ role: "assistant", content: ctx.t("wt_noScreen") }); save(); refreshAll();
    return null;
  }
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.srcObject = watch.screen;
  await v.play().catch(() => {});
  await new Promise((r) => (v.readyState >= 2 ? r() : v.addEventListener("loadeddata", r, { once: true })));
  await new Promise((r) => setTimeout(r, 250));
  const s = Math.min(1, 1024 / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s);
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(v, 0, 0, c.width, c.height);
  v.srcObject = null;
  // Netflix y Prime protegen el video: la captura sale negra.
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let sum = 0, n = 0;
  for (let i = 0; i < d.length; i += 400) { sum += d[i] + d[i + 1] + d[i + 2]; n++; }
  if (sum / n / 3 < 12) return "black";
  return c.toDataURL("image/jpeg", 0.8).split(",")[1];
}

// ---------- Comentarios automáticos ----------
function scheduleAuto(ctx) {
  clearInterval(autoTimer);
  if (!watch.active || !watch.auto) return;
  autoTimer = setInterval(() => {
    if (!watch.active || !watch.auto || watch.busy || watch.paused) return;
    if (Date.now() - (watch.lastAi || watch.startedAt) < 8 * 60_000) return;
    send(ctx, ctx.t("wt_autoPrompt"), { hidden: true });
  }, 30_000);
}

// ---------- Ventana flotante (encima de la película) ----------
async function openFloating(ctx) {
  if (!("documentPictureInPicture" in window)) return false;
  if (pipWin && !pipWin.closed) { pipWin.focus?.(); return true; }
  pipWin = await documentPictureInPicture.requestWindow({ width: 380, height: 600 });
  for (const el of document.querySelectorAll('link[rel="stylesheet"], style')) pipWin.document.head.appendChild(el.cloneNode(true));
  pipWin.document.body.className = "pip-body";
  const root = pipWin.document.createElement("div");
  root.className = "wt-companion compact";
  pipWin.document.body.appendChild(root);
  mountCompanion(root, ctx, true);
  pipWin.addEventListener("pagehide", () => { pipWin = null; refreshAll(); });
  refreshAll();
  return true;
}

// =====================================================================
// Interfaz
// =====================================================================
/** ctx = { t, esc, tile, icon, stream, speak, dictate, errorText } */
export function renderWatch(body, ctx) {
  const { t, esc, tile, icon } = ctx;
  scheduleAuto(ctx);
  if (!watch.active) {
    body.innerHTML = `
      <p class="muted">${esc(t("wt_intro"))}</p>
      <div class="wt-platforms">${PLATFORMS.map((p) => `<button class="wt-plat ${watch.platform === p.id ? "on" : ""}" data-target data-plat="${p.id}" style="--pc:${p.color}"><b>${esc(p.name)}</b></button>`).join("")}</div>
      <div class="biz-form">
        <input class="field" id="wtTitle" placeholder="${esc(t("wt_titlePh"))}" value="${esc(watch.title)}">
        <div class="form-row">
          <input class="field" id="wtEp" placeholder="${esc(t("wt_epPh"))}" value="${esc(watch.ep)}">
          <label class="wt-check"><input type="checkbox" id="wtSpoil" ${watch.spoilers ? "checked" : ""}> ${esc(t("wt_spoilers"))}</label>
        </div>
      </div>
      <div class="tiles biz-actions">
        ${tile(`${icon("send")}<br>${esc(t("wt_start"))}`, "", "action wt-start")}
        ${tile(`✦<br>${esc(watch.recBusy ? t("thinking") : t("wt_recommend"))}`, "", "action wt-rec" + (watch.recBusy ? " live" : ""))}
      </div>
      <div class="hw-out" id="wtRecs"></div>
      <div class="readout"><div class="k">${esc(t("wt_howTitle").toUpperCase())}</div>
        <ol class="steps"><li>${esc(t("wt_how1"))}</li><li>${esc(t("wt_how2"))}</li><li>${esc(t("wt_how3"))}</li><li>${esc(t("wt_how4"))}</li></ol>
        <p class="muted">${esc(t("wt_note"))}</p>
      </div>`;
    body.querySelectorAll("[data-plat]").forEach((b) => b.addEventListener("click", () => { watch.platform = b.dataset.plat; save(); renderWatch(body, ctx); }));
    const title = body.querySelector("#wtTitle"), ep = body.querySelector("#wtEp"), sp = body.querySelector("#wtSpoil");
    const sync = () => { watch.title = title.value.trim(); watch.ep = ep.value.trim(); watch.spoilers = sp.checked; save(); };
    [title, ep].forEach((el) => el.addEventListener("input", sync));
    sp.addEventListener("change", sync);
    if (watch.recs) renderInto(body.querySelector("#wtRecs"), watch.recs);
    body.querySelector(".wt-rec").addEventListener("click", async () => {
      if (watch.recBusy) return;
      watch.recBusy = true; watch.recs = ""; renderWatch(body, ctx);
      let full = "";
      try {
        const err = await ctx.stream(
          { messages: [{ role: "user", content: t("wt_recPrompt").replace("{platform}", platform().name) }], channel: "text" },
          { onText: (d) => { full += d; const o = body.querySelector("#wtRecs"); if (o) renderInto(o, full); } },
        );
        watch.recs = full || ctx.errorText(err);
      } catch { watch.recs = t("errGeneric"); }
      watch.recBusy = false;
      if (body.isConnected) renderWatch(body, ctx);
    });
    body.querySelector(".wt-start").addEventListener("click", () => {
      sync();
      if (!watch.title) { title.focus(); title.classList.add("shake"); return; }
      // Abre la plataforma en otra pestaña (Netflix y Prime no dejan verse dentro de otras páginas).
      window.open(platform().url, "_blank", "noopener");
      Object.assign(watch, { active: true, startedAt: Date.now(), offset: 0, paused: false, log: [], lastAi: 0 });
      watch.log.push({ role: "assistant", content: t("wt_hello").replace("{title}", watch.title) });
      save();
      renderWatch(body, ctx);
    });
    return;
  }

  body.innerHTML = `
    <div class="tiles biz-actions wt-top">
      ${tile(`⧉<br>${esc(pipWin ? t("wt_floatOn") : t("wt_float"))}`, "", "action wt-float" + (pipWin ? " on" : ""))}
      ${tile(`↗<br>${esc(t("wt_reopen").replace("{p}", platform().name))}`, "", "action wt-open")}
      ${tile(`■<br>${esc(t("wt_stop"))}`, "", "action wt-stop")}
    </div>
    <p class="muted wt-floatnote">${esc("documentPictureInPicture" in window ? t("wt_floatHint") : t("wt_noFloat"))}</p>
    <div class="wt-companion"></div>`;
  mountCompanion(body.querySelector(".wt-companion"), ctx, false);
  body.querySelector(".wt-float").addEventListener("click", async () => {
    try { if (!(await openFloating(ctx))) { body.querySelector(".wt-floatnote").textContent = t("wt_noFloat"); } } catch { body.querySelector(".wt-floatnote").textContent = t("wt_noFloat"); }
    if (body.isConnected) renderWatch(body, ctx);
  });
  body.querySelector(".wt-open").addEventListener("click", () => window.open(platform().url, "_blank", "noopener"));
  body.querySelector(".wt-stop").addEventListener("click", () => {
    watch.active = false;
    watch.screen?.getTracks().forEach((tr) => tr.stop());
    watch.screen = null;
    pipWin?.close(); pipWin = null;
    clearInterval(autoTimer);
    save();
    renderWatch(body, ctx);
  });
}

/** Chat de compañera: sirve en el panel y en la ventana flotante. */
function mountCompanion(root, ctx, compact) {
  const { t, esc } = ctx;
  const view = { root };
  view.draw = () => {
    const m = minuteNow();
    root.innerHTML = `
      <div class="wt-head">
        <span class="wt-dot" style="--pc:${platform().color}"></span>
        <div><b>${esc(watch.title)}</b><small class="mono">${esc(platform().name)}${watch.ep ? " · " + esc(watch.ep) : ""}</small></div>
        <div class="wt-min mono">
          <button data-target data-min="-5">−5</button><span>${m} min${watch.paused ? " ❚❚" : ""}</span><button data-target data-min="5">+5</button>
          <button data-target data-act="pause">${watch.paused ? "▶" : "❚❚"}</button>
        </div>
      </div>
      <div class="wt-log">${watch.log.filter((x) => !x.hidden).map((x) => `<div class="msg ${x.role} ${x.pending ? "pending" : ""}">${x.role === "user" ? esc(x.content) : ""}</div>`).join("")}</div>
      <div class="wt-quick">${QUICK.map((k) => `<button class="nw-mini" data-target data-q="${k}">${esc(t("wtq_" + k))}</button>`).join("")}</div>
      <form class="chat-form wt-form">
        <input class="field" placeholder="${esc(t("wt_say"))}" autocomplete="off">
        <button type="button" class="tile icon-tile" data-target data-act="mic" aria-label="${esc(t("hw_dictate"))}">${ctx.icon("mic")}</button>
        <button type="submit" class="tile icon-tile action" data-target aria-label="${esc(t("send"))}">${ctx.icon("send")}</button>
      </form>
      <div class="wt-opts">
        <button class="nw-mini ${watch.screen ? "on" : ""}" data-target data-act="look">👁 ${esc(t("wt_look"))}</button>
        <button class="nw-mini ${watch.auto ? "on" : ""}" data-target data-act="auto">${esc(t("wt_auto"))}</button>
        <button class="nw-mini ${watch.speak ? "on" : ""}" data-target data-act="speak">${esc(t("wt_speak"))}</button>
        <button class="nw-mini ${watch.spoilers ? "on" : ""}" data-target data-act="spoil">${esc(t("wt_spoilers"))}</button>
      </div>`;
    const log = root.querySelector(".wt-log");
    const bubbles = log.querySelectorAll(".msg.assistant");
    watch.log.filter((x) => !x.hidden && x.role === "assistant").forEach((x, i) => renderInto(bubbles[i], x.content));
    log.scrollTop = log.scrollHeight;
    const input = root.querySelector("input");
    root.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); const v = input.value.trim(); if (v) { input.value = ""; send(ctx, v); } });
    root.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => send(ctx, t("wtqs_" + b.dataset.q))));
    root.querySelectorAll("[data-min]").forEach((b) => b.addEventListener("click", () => { watch.offset += Number(b.dataset.min); save(); refreshAll(); }));
    root.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => {
      const a = b.dataset.act;
      if (a === "pause") {
        if (watch.paused) { watch.startedAt += Date.now() - watch.pausedAt; watch.paused = false; } else { watch.paused = true; watch.pausedAt = Date.now(); }
      } else if (a === "auto") { watch.auto = !watch.auto; scheduleAuto(ctx); }
      else if (a === "speak") watch.speak = !watch.speak;
      else if (a === "spoil") watch.spoilers = !watch.spoilers;
      else if (a === "look") { send(ctx, t("wt_lookPrompt"), { look: true }); return; }
      else if (a === "mic") { ctx.dictate((said) => { if (said) send(ctx, said); }); return; }
      save(); refreshAll();
    }));
    if (!compact) setTimeout(() => input.focus({ preventScroll: true }), 30);
  };
  view.updateLast = (text) => {
    const bubbles = root.querySelectorAll(".wt-log .msg.assistant");
    const last = bubbles[bubbles.length - 1];
    if (last) { renderInto(last, text); last.parentNode.scrollTop = last.parentNode.scrollHeight; }
  };
  views.add(view);
  view.draw();
}

// El minuto avanza solo en las vistas abiertas.
setInterval(() => {
  if (!watch.active) return;
  for (const v of views) { const el = v.root.querySelector(".wt-min span"); if (el) el.textContent = `${minuteNow()} min${watch.paused ? " ❚❚" : ""}`; }
}, 20_000);
