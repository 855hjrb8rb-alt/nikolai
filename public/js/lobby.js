// Sala de madera: relojes de ciudades del mundo (se cambian tocándolos) y personas que
// caminan y con las que puedes platicar. Desde ahí, la puerta al Hotel en la playa:
// turistas, mar, palmeras y una computadora con trabajo (recepción del hotel y bolsa de trabajo).
import { renderInto } from "./md.js";

export const CITIES = [
  ["Ciudad de México", "America/Mexico_City", "🇲🇽"], ["Los Mochis", "America/Mazatlan", "🇲🇽"], ["Culiacán", "America/Mazatlan", "🇲🇽"],
  ["Tijuana", "America/Tijuana", "🇲🇽"], ["Monterrey", "America/Monterrey", "🇲🇽"], ["Cancún", "America/Cancun", "🇲🇽"], ["Guadalajara", "America/Mexico_City", "🇲🇽"],
  ["Nueva York", "America/New_York", "🇺🇸"], ["Los Ángeles", "America/Los_Angeles", "🇺🇸"], ["Chicago", "America/Chicago", "🇺🇸"], ["Miami", "America/New_York", "🇺🇸"],
  ["Houston", "America/Chicago", "🇺🇸"], ["Phoenix", "America/Phoenix", "🇺🇸"], ["Las Vegas", "America/Los_Angeles", "🇺🇸"], ["Denver", "America/Denver", "🇺🇸"],
  ["Honolulu", "Pacific/Honolulu", "🇺🇸"], ["Anchorage", "America/Anchorage", "🇺🇸"], ["Toronto", "America/Toronto", "🇨🇦"], ["Vancouver", "America/Vancouver", "🇨🇦"],
  ["Bogotá", "America/Bogota", "🇨🇴"], ["Lima", "America/Lima", "🇵🇪"], ["Buenos Aires", "America/Argentina/Buenos_Aires", "🇦🇷"], ["São Paulo", "America/Sao_Paulo", "🇧🇷"],
  ["Madrid", "Europe/Madrid", "🇪🇸"], ["Londres", "Europe/London", "🇬🇧"], ["París", "Europe/Paris", "🇫🇷"], ["Berlín", "Europe/Berlin", "🇩🇪"], ["Roma", "Europe/Rome", "🇮🇹"],
  ["Moscú", "Europe/Moscow", "🇷🇺"], ["Dubái", "Asia/Dubai", "🇦🇪"], ["Nueva Delhi", "Asia/Kolkata", "🇮🇳"], ["Pekín", "Asia/Shanghai", "🇨🇳"], ["Tokio", "Asia/Tokyo", "🇯🇵"],
  ["Seúl", "Asia/Seoul", "🇰🇷"], ["Sídney", "Australia/Sydney", "🇦🇺"],
];
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* lleno */ } };
export const lobby = {
  clocks: load("nikolai.clocks", ["Ciudad de México", "Los Mochis", "Nueva York", "Los Ángeles", "Chicago", "Madrid", "Tokio"]),
  job: load("nikolai.hotelJob", { money: 0, served: 0, stars: 0 }),
};
const city = (n) => CITIES.find((c) => c[0] === n) || CITIES[0];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- Personas (dibujadas en SVG) ----------
function person({ skin = "#e0b08a", shirt = "#3b6fb6", pants = "#2c2f3a", hair = "#3a2a1c", long = false, hat = "", glasses = false, shorts = false, dress = false, prop = "" }) {
  const legs = shorts
    ? `<g class="leg l"><rect x="23" y="96" width="8" height="18" fill="${pants}"/><rect x="23" y="114" width="7" height="24" fill="${skin}"/><rect x="21" y="136" width="11" height="5" rx="2" fill="#222"/></g>
       <g class="leg r"><rect x="33" y="96" width="8" height="18" fill="${pants}"/><rect x="34" y="114" width="7" height="24" fill="${skin}"/><rect x="32" y="136" width="11" height="5" rx="2" fill="#222"/></g>`
    : `<g class="leg l"><rect x="23" y="94" width="8" height="44" rx="3" fill="${pants}"/><rect x="20" y="136" width="12" height="6" rx="3" fill="#1d1d1d"/></g>
       <g class="leg r"><rect x="33" y="94" width="8" height="44" rx="3" fill="${pants}"/><rect x="32" y="136" width="12" height="6" rx="3" fill="#1d1d1d"/></g>`;
  const body = dress
    ? `<path d="M20 52 Q32 46 44 52 L50 104 L14 104 Z" fill="${shirt}"/>`
    : `<rect x="19" y="50" width="26" height="48" rx="8" fill="${shirt}"/>`;
  const hats = {
    sun: `<ellipse cx="32" cy="18" rx="20" ry="5" fill="#e8d6a0"/><rect x="22" y="8" width="20" height="11" rx="5" fill="#e8d6a0"/><rect x="22" y="15" width="20" height="3" fill="#b5523a"/>`,
    cap: `<path d="M20 20 Q32 4 44 20 Z" fill="#c33"/><rect x="38" y="17" width="14" height="4" rx="2" fill="#c33"/>`,
    bell: `<rect x="23" y="7" width="18" height="9" rx="2" fill="#8b1e2e"/><rect x="21" y="15" width="22" height="3" fill="#d4a017"/>`,
  };
  const props = {
    camera: `<rect x="38" y="66" width="14" height="10" rx="2" fill="#222"/><circle cx="45" cy="71" r="3" fill="#6af"/>`,
    case: `<rect x="44" y="84" width="14" height="18" rx="2" fill="#5a3a22"/><rect x="48" y="81" width="6" height="4" fill="#3a2414"/>`,
    drink: `<path d="M44 66 L52 66 L50 80 L46 80 Z" fill="#ffd36b" stroke="#fff" stroke-width=".8"/><line x1="49" y1="60" x2="51" y2="67" stroke="#f55" stroke-width="1.5"/>`,
    board: `<ellipse cx="54" cy="80" rx="6" ry="30" fill="#29b6c8" stroke="#fff" stroke-width="1.5"/>`,
    tray: `<rect x="40" y="64" width="20" height="3" rx="1" fill="#ccc"/><rect x="45" y="56" width="4" height="8" fill="#9cf"/>`,
  };
  return `<svg viewBox="0 0 64 146" class="npc-svg">
    <ellipse cx="32" cy="142" rx="18" ry="4" fill="rgba(0,0,0,.25)"/>
    ${legs}
    <g class="arm l"><rect x="12" y="54" width="8" height="36" rx="4" fill="${shirt}"/><circle cx="16" cy="92" r="4" fill="${skin}"/></g>
    ${body}
    <g class="arm r"><rect x="44" y="54" width="8" height="36" rx="4" fill="${shirt}"/><circle cx="48" cy="92" r="4" fill="${skin}"/></g>
    <rect x="28" y="40" width="8" height="10" fill="${skin}"/>
    ${long ? `<path d="M16 26 Q14 52 20 58 L44 58 Q50 52 48 26 Z" fill="${hair}"/>` : ""}
    <ellipse cx="32" cy="27" rx="13" ry="15" fill="${skin}"/>
    <path d="M19 24 Q20 10 32 10 Q44 10 45 24 Q40 16 32 17 Q24 16 19 24 Z" fill="${hair}"/>
    <circle class="eye" cx="27" cy="27" r="1.6" fill="#222"/><circle class="eye" cx="37" cy="27" r="1.6" fill="#222"/>
    <path d="M28 34 Q32 37 36 34" stroke="#8a3b2e" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    ${glasses ? `<g fill="none" stroke="#111" stroke-width="1.3"><circle cx="27" cy="27" r="4"/><circle cx="37" cy="27" r="4"/><line x1="31" y1="27" x2="33" y2="27"/></g>` : ""}
    ${hat ? hats[hat] : ""}
    ${prop ? props[prop] : ""}
  </svg>`;
}

const LOBBY_NPCS = [
  { id: "laura", name: "Laura", who: "la recepcionista del hotel, mexicana de Mazatlán, amable y muy platicadora, conoce todos los restaurantes y lugares de la zona", look: { skin: "#c98d63", shirt: "#7a1f2b", pants: "#222", hair: "#1c120c", long: true }, x: 50, walk: false, desk: true },
  { id: "thompson", name: "Mr. Thompson", who: "un ejecutivo de Nueva York de 52 años en viaje de negocios, serio pero con humor seco, siempre pendiente de la hora de Wall Street", look: { skin: "#f0c8a8", shirt: "#2d3a55", pants: "#2d3a55", hair: "#8a8a8a", glasses: true, prop: "case" }, x: 15, walk: true, speed: 38 },
  { id: "yuki", name: "Yuki", who: "una turista japonesa de 27 años de Tokio, fotógrafa, emocionada por conocer México, habla español básico y algo de inglés", look: { skin: "#f1d1b5", shirt: "#f2a6c0", pants: "#4a5a7a", hair: "#111", long: true, prop: "camera" }, x: 70, walk: true, speed: 28 },
  { id: "beto", name: "Beto", who: "el botones del hotel, de Culiacán, 19 años, bromista y fan del béisbol y de los Tomateros", look: { skin: "#b97a52", shirt: "#8b1e2e", pants: "#1c1c1c", hair: "#140d08", hat: "bell", prop: "tray" }, x: 85, walk: true, speed: 45 },
];
const BEACH_NPCS = [
  { id: "emma", name: "Emma", who: "una turista canadiense de Toronto de 34 años, maestra, de vacaciones con su esposo; le encanta el ceviche y el snorkel", look: { skin: "#f3d0b4", shirt: "#ff8a5c", pants: "#29b6c8", hair: "#d9a650", long: true, shorts: true, hat: "sun", prop: "drink" }, x: 20, walk: true, speed: 22 },
  { id: "hans", name: "Hans", who: "un turista alemán de Múnich de 61 años, jubilado, ingeniero, puntual y curioso por la historia de México", look: { skin: "#f6d6c0", shirt: "#f4f4f4", pants: "#c9a36b", hair: "#ddd", shorts: true, hat: "sun", glasses: true, prop: "camera" }, x: 60, walk: true, speed: 18 },
  { id: "sofia", name: "Sofía", who: "una argentina de Buenos Aires de 29 años, diseñadora, viajando sola por la costa del Pacífico, muy alegre y habla con «vos» y «che»", look: { skin: "#e6b993", shirt: "#ffd84a", pants: "#2a6fdb", hair: "#5a3a22", long: true, dress: true }, x: 40, walk: true, speed: 26 },
  { id: "mike", name: "Mike", who: "un texano de Houston de 40 años, fanático del surf y de los tacos de pescado, vino con amigos", look: { skin: "#d7a27a", shirt: "#3aa66a", pants: "#1b3a6b", hair: "#3a2a1c", shorts: true, hat: "cap", prop: "board" }, x: 78, walk: true, speed: 30 },
  { id: "rafa", name: "Rafa", who: "el salvavidas de la playa del hotel, de Mazatlán, 25 años, responsable, sabe de corrientes, mareas y el clima", look: { skin: "#a8673f", shirt: "#e53935", pants: "#e53935", hair: "#120a06", shorts: true, hat: "cap" }, x: 90, walk: false },
];

// ---------- Escena ----------
let root = null, timer = 0, ctxRef = null, chats = {};
const ticks = [];

/** ctx = { t, esc, tile, icon, stream, errorText, speak, lang, openPanel } */
export function openLobby(ctx, scene = "lobby") {
  ctxRef = ctx;
  closeLobby();
  root = document.createElement("div");
  root.className = "lb";
  document.body.appendChild(root);
  document.body.classList.add("in-lobby");
  addEventListener("keydown", onKey, true);
  scene === "beach" ? drawBeach() : drawLobby();
  timer = setInterval(() => ticks.forEach((f) => f()), 1000);
}
export function closeLobby() {
  clearInterval(timer); ticks.length = 0;
  root?.remove(); root = null;
  document.body.classList.remove("in-lobby");
  removeEventListener("keydown", onKey, true);
}
function onKey(e) {
  if (e.key === "Escape") { e.stopPropagation(); closeLobby(); }
  else if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) e.stopPropagation();
}

function npcHtml(list) {
  return list.map((n) => `<button class="npc ${n.walk ? "walk" : ""} ${n.desk ? "desk" : ""}" data-target data-npc="${n.id}" style="--x:${n.x}%;--dur:${n.speed || 30}s;--delay:-${(n.x / 100) * (n.speed || 30)}s" aria-label="${esc(n.name)}">
    <span class="npc-body">${person(n.look)}</span><span class="npc-name">${esc(n.name)}</span></button>`).join("");
}

function topBar(title, extra = "") {
  const { t } = ctxRef;
  return `<div class="lb-top"><b>${esc(title)}</b>${extra}<button class="nw-mini lb-exit" data-target>✕ ${esc(t("lb_exit"))}</button></div>`;
}

function clockSvg() {
  let ticksSvg = "";
  for (let i = 0; i < 60; i++) {
    const a = (i * Math.PI) / 30, big = i % 5 === 0;
    ticksSvg += `<line x1="${50 + Math.sin(a) * (big ? 38 : 41)}" y1="${50 - Math.cos(a) * (big ? 38 : 41)}" x2="${50 + Math.sin(a) * 44}" y2="${50 - Math.cos(a) * 44}" stroke="#3a2a1a" stroke-width="${big ? 2.2 : 0.8}"/>`;
  }
  const nums = [12, 3, 6, 9].map((n, i) => `<text x="${50 + Math.sin(i * Math.PI / 2) * 31}" y="${54 - Math.cos(i * Math.PI / 2) * 31}" text-anchor="middle" font-size="10" font-family="Georgia,serif" fill="#3a2a1a">${n}</text>`).join("");
  return `<svg viewBox="0 0 100 100" class="lb-clock-face">
    <circle cx="50" cy="50" r="49" fill="url(#brass)"/><circle cx="50" cy="50" r="45" fill="#f7f1e3"/>
    ${ticksSvg}${nums}
    <line class="h-h" x1="50" y1="50" x2="50" y2="28" stroke="#1d140c" stroke-width="3.4" stroke-linecap="round"/>
    <line class="h-m" x1="50" y1="52" x2="50" y2="15" stroke="#1d140c" stroke-width="2.2" stroke-linecap="round"/>
    <line class="h-s" x1="50" y1="56" x2="50" y2="12" stroke="#b3261e" stroke-width="1" stroke-linecap="round"/>
    <circle cx="50" cy="50" r="2.6" fill="#b3261e"/>
  </svg>`;
}

function drawLobby() {
  const { t } = ctxRef;
  root.className = "lb lb-lobby";
  root.innerHTML = `
    <svg width="0" height="0" style="position:absolute"><defs><radialGradient id="brass" cx="35%" cy="30%"><stop offset="0" stop-color="#f7dc8a"/><stop offset=".6" stop-color="#b8892f"/><stop offset="1" stop-color="#6b4a14"/></radialGradient></defs></svg>
    ${topBar(t("lb_title"))}
    <div class="lb-wall">
      <div class="lb-clocks">${lobby.clocks.map((n, i) => `<button class="lb-clock" data-target data-clock="${i}">${clockSvg()}<span class="lb-plate"><b>${esc(city(n)[2])} ${esc(n)}</b><i class="mono" data-dig="${i}"></i></span></button>`).join("")}
        ${lobby.clocks.length < 8 ? `<button class="lb-clock add" data-target data-add>＋<span class="lb-plate"><b>${esc(t("lb_addClock"))}</b></span></button>` : ""}</div>
      <div class="lb-lamp l"></div><div class="lb-lamp r"></div>
    </div>
    <div class="lb-floor">
      <div class="lb-desk"><span>RECEPCIÓN · NIKOLAI HOTEL</span></div>
      <div class="lb-plant l">🪴</div><div class="lb-plant r">🪴</div>
      <div class="lb-sofa"></div>
      <button class="lb-door" data-target data-go="beach"><span>🏖</span><b>${esc(t("lb_toBeach"))}</b></button>
      ${npcHtml(LOBBY_NPCS)}
    </div>
    <div class="lb-picker" hidden></div>
    <div class="lb-chat" hidden></div>
    <p class="lb-hint mono">${esc(t("lb_hint"))}</p>`;
  bindCommon(LOBBY_NPCS, t("lb_placeLobby"));
  const tick = () => {
    lobby.clocks.forEach((n, i) => {
      const el = root?.querySelector(`[data-clock="${i}"]`);
      if (!el) return;
      const tz = city(n)[1];
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", second: "numeric", hour12: false }).formatToParts(new Date()).map((p) => [p.type, +p.value]));
      const h = parts.hour % 24, m = parts.minute, s = parts.second;
      el.querySelector(".h-h").setAttribute("transform", `rotate(${(h % 12) * 30 + m * 0.5} 50 50)`);
      el.querySelector(".h-m").setAttribute("transform", `rotate(${m * 6 + s * 0.1} 50 50)`);
      el.querySelector(".h-s").setAttribute("transform", `rotate(${s * 6} 50 50)`);
      const day = h >= 7 && h < 19;
      el.classList.toggle("night", !day);
      root.querySelector(`[data-dig="${i}"]`).textContent = `${new Date().toLocaleTimeString(ctxRef.lang || "es", { timeZone: tz, hour: "2-digit", minute: "2-digit" })} ${day ? "☀" : "☾"} · ${new Date().toLocaleDateString(ctxRef.lang || "es", { timeZone: tz, weekday: "short" })}`;
    });
  };
  ticks.push(tick); tick();
  root.querySelectorAll("[data-clock]").forEach((b) => b.addEventListener("click", () => picker(Number(b.dataset.clock))));
  root.querySelector("[data-add]")?.addEventListener("click", () => picker(-1));
}

function picker(i) {
  const { t } = ctxRef;
  const box = root.querySelector(".lb-picker");
  box.hidden = false;
  box.innerHTML = `<div class="lb-card">
    <b>${esc(i < 0 ? t("lb_addClock") : t("lb_changeClock"))}</b>
    <input class="field" placeholder="${esc(t("lb_searchCity"))}">
    <div class="lb-cities">${CITIES.map(([n, , f]) => `<button class="nw-mini" data-target data-city="${esc(n)}">${f} ${esc(n)}</button>`).join("")}</div>
    <div class="lb-row">${i >= 0 && lobby.clocks.length > 1 ? `<button class="nw-mini" data-target data-rm>🗑 ${esc(t("remove"))}</button>` : ""}<button class="nw-mini" data-target data-close>${esc(t("lb_cancel"))}</button></div>
  </div>`;
  const input = box.querySelector("input");
  input.addEventListener("input", () => box.querySelectorAll("[data-city]").forEach((b) => { b.hidden = !b.dataset.city.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(input.value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")); }));
  setTimeout(() => input.focus(), 30);
  box.querySelectorAll("[data-city]").forEach((b) => b.addEventListener("click", () => {
    if (i < 0) lobby.clocks.push(b.dataset.city); else lobby.clocks[i] = b.dataset.city;
    save("nikolai.clocks", lobby.clocks); ticks.length = 0; drawLobby();
  }));
  box.querySelector("[data-rm]")?.addEventListener("click", () => { lobby.clocks.splice(i, 1); save("nikolai.clocks", lobby.clocks); ticks.length = 0; drawLobby(); });
  box.querySelector("[data-close]").addEventListener("click", () => { box.hidden = true; });
}

function drawBeach() {
  const { t } = ctxRef;
  root.className = "lb lb-beach";
  root.innerHTML = `
    ${topBar(t("lb_beachTitle"), `<button class="nw-mini" data-target data-go="lobby">← ${esc(t("lb_toLobby"))}</button>`)}
    <div class="bc-sky"><div class="bc-sun"></div><div class="bc-cloud c1"></div><div class="bc-cloud c2"></div><span class="bc-bird b1">〰</span><span class="bc-bird b2">〰</span></div>
    <div class="bc-hotel"><div class="bc-tower"></div><div class="bc-tower t2"></div><span>NIKOLAI BEACH RESORT</span></div>
    <div class="bc-sea"><i class="wave w1"></i><i class="wave w2"></i><i class="wave w3"></i></div>
    <div class="bc-sand">
      <span class="bc-palm p1">🌴</span><span class="bc-palm p2">🌴</span><span class="bc-palm p3">🌴</span>
      <span class="bc-umb u1">⛱</span><span class="bc-umb u2">⛱</span>
      <button class="bc-pc" data-target data-pc><span class="bc-monitor">💻</span><b>${esc(t("lb_computer"))}</b></button>
      ${npcHtml(BEACH_NPCS)}
    </div>
    <div class="lb-chat" hidden></div>
    <div class="lb-computer" hidden></div>
    <p class="lb-hint mono">${esc(t("lb_beachHint"))}</p>`;
  bindCommon(BEACH_NPCS, t("lb_placeBeach"));
  root.querySelector("[data-pc]").addEventListener("click", openComputer);
}

function bindCommon(list, place) {
  root.querySelector(".lb-exit").addEventListener("click", closeLobby);
  root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => { ticks.length = 0; b.dataset.go === "beach" ? drawBeach() : drawLobby(); }));
  root.querySelectorAll("[data-npc]").forEach((b) => b.addEventListener("click", () => openChat(list.find((n) => n.id === b.dataset.npc), place)));
  // De vez en cuando alguien dice algo.
  const lines = ctxRef.t("lb_smallTalk").split("|");
  ticks.push(() => {
    if (Math.random() > 0.12) return;
    const els = root?.querySelectorAll(".npc");
    if (!els?.length) return;
    const el = els[(Math.random() * els.length) | 0];
    if (el.querySelector(".npc-say")) return;
    const say = document.createElement("span");
    say.className = "npc-say";
    say.textContent = lines[(Math.random() * lines.length) | 0];
    el.appendChild(say);
    setTimeout(() => say.remove(), 3500);
  });
}

// ---------- Platicar con una persona ----------
function openChat(n, place) {
  const { t } = ctxRef;
  const box = root.querySelector(".lb-chat");
  const log = (chats[n.id] ||= []);
  box.hidden = false;
  const draw = () => {
    box.innerHTML = `<div class="lb-card chat">
      <div class="lb-row"><span class="lb-avatar">${person(n.look)}</span><div><b>${esc(n.name)}</b><small class="muted">${esc(n.who.split(",")[0])}</small></div><button class="nw-mini lb-x" data-target>✕</button></div>
      <div class="lb-msgs">${log.length ? log.map((m) => `<div class="msg ${m.role}">${esc(m.content)}</div>`).join("") : `<p class="muted">${esc(t("lb_sayHi").replace("{name}", n.name))}</p>`}</div>
      <form class="chat-form"><input class="field" placeholder="${esc(t("lb_talk"))}" autocomplete="off"><button class="tile icon-tile action" data-target aria-label="${esc(t("send"))}">${ctxRef.icon("send")}</button></form>
    </div>`;
    const msgs = box.querySelector(".lb-msgs"); msgs.scrollTop = msgs.scrollHeight;
    box.querySelector(".lb-x").addEventListener("click", () => { box.hidden = true; });
    const input = box.querySelector("input");
    setTimeout(() => input.focus(), 30);
    box.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      log.push({ role: "user", content: text });
      const reply = { role: "assistant", content: "…" };
      log.push(reply);
      draw();
      let full = "";
      try {
        const err = await ctxRef.stream(
          { messages: log.slice(0, -1).slice(-12).map(({ role, content }) => ({ role, content })), mode: "npc", channel: "text", npc: { name: n.name, who: n.who, place } },
          { onText: (d) => { full += d; const last = box.querySelector(".lb-msgs .msg:last-child"); if (last) last.textContent = full; } },
        );
        reply.content = full || ctxRef.errorText(err);
        if (full) ctxRef.speak?.(full);
      } catch { reply.content = t("errGeneric"); }
      if (!box.hidden) draw();
    });
  };
  draw();
}

// ---------- La computadora del hotel ----------
const GUESTS = [
  ["Emma", "🇨🇦", "rq_checkin", 0], ["Hans", "🇩🇪", "rq_towels", 1], ["Sofía", "🇦🇷", "rq_tour", 2], ["Mike", "🇺🇸", "rq_late", 0],
  ["Yuki", "🇯🇵", "rq_wifi", 1], ["Pierre", "🇫🇷", "rq_noise", 2], ["Ana", "🇲🇽", "rq_upgrade", 0], ["Luca", "🇮🇹", "rq_taxi", 1],
  ["Olivia", "🇬🇧", "rq_doctor", 2], ["Diego", "🇨🇴", "rq_checkout", 0], ["Min-jun", "🇰🇷", "rq_dinner", 1], ["Laila", "🇦🇪", "rq_lost", 2],
];
let shift = null;
function openComputer() {
  const { t } = ctxRef;
  const box = root.querySelector(".lb-computer");
  box.hidden = false;
  const desk = () => {
    box.innerHTML = `<div class="pc-frame"><div class="pc-screen">
      <div class="pc-bar"><b>NIKOLAI OS · ${esc(t("lb_hotelPc"))}</b><span class="mono" data-pcclock></span><button class="nw-mini" data-target data-off>⏻</button></div>
      <div class="pc-desk">
        <button class="pc-app" data-target data-app="recep"><span>🛎</span>${esc(t("pc_recep"))}</button>
        <button class="pc-app" data-target data-app="jobs"><span>💼</span>${esc(t("pc_jobs"))}</button>
        <button class="pc-app" data-target data-app="work"><span>📄</span>${esc(t("pc_myWork"))}</button>
        <div class="pc-stats mono">💵 $${lobby.job.money.toLocaleString()} · 🧳 ${lobby.job.served} · ⭐ ${lobby.job.served ? (lobby.job.stars / lobby.job.served).toFixed(1) : "—"}</div>
      </div>
      <div class="pc-win" hidden></div>
    </div></div>`;
    const clk = box.querySelector("[data-pcclock]");
    const tickPc = () => { if (clk.isConnected) clk.textContent = new Date().toLocaleTimeString(ctxRef.lang || "es", { hour: "2-digit", minute: "2-digit" }); };
    tickPc(); ticks.push(tickPc);
    box.querySelector("[data-off]").addEventListener("click", () => { box.hidden = true; shift = null; });
    box.querySelectorAll("[data-app]").forEach((b) => b.addEventListener("click", () => app(b.dataset.app)));
  };
  const win = (title, html) => {
    const w = box.querySelector(".pc-win");
    w.hidden = false;
    w.innerHTML = `<div class="pc-wbar"><b>${esc(title)}</b><button class="nw-mini" data-target data-wclose>✕</button></div><div class="pc-wbody">${html}</div>`;
    w.querySelector("[data-wclose]").addEventListener("click", () => { w.hidden = true; shift = null; desk(); });
    return w.querySelector(".pc-wbody");
  };
  const app = (k) => {
    if (k === "work") { closeLobby(); ctxRef.openPanel?.("work"); return; }
    if (k === "jobs") {
      const body = win(t("pc_jobs"), `<p class="muted">${esc(t("pc_jobsIntro"))}</p><div class="form-row"><input class="field" id="pcJobQ" placeholder="${esc(t("pc_jobsPh"))}"><button class="nw-mini" data-target id="pcJobGo">⌕ ${esc(t("search"))}</button></div><div class="hw-out" id="pcJobOut"></div>`);
      body.querySelector("#pcJobGo").addEventListener("click", async () => {
        const q = body.querySelector("#pcJobQ").value.trim() || t("pc_jobsDefault");
        const out = body.querySelector("#pcJobOut");
        out.innerHTML = `<p class="muted">${esc(t("thinking"))}</p>`;
        let full = "";
        try {
          const err = await ctxRef.stream({ messages: [{ role: "user", content: t("pc_jobsPrompt").replace("{q}", q) }], channel: "text" }, { onText: (d) => { full += d; renderInto(out, full); } });
          if (!full) out.textContent = ctxRef.errorText(err);
        } catch { out.textContent = t("errGeneric"); }
      });
      return;
    }
    // Turno en recepción: atiende huéspedes y gana propinas.
    shift = { i: 0, order: [...GUESTS].sort(() => Math.random() - 0.5), earned: 0 };
    const body = win(t("pc_recep"), `<div class="rc"></div>`);
    const next = () => {
      const el = body.querySelector(".rc");
      if (!shift || !el?.isConnected) return;
      if (shift.i >= 6) {
        el.innerHTML = `<div class="rc-end"><b>${esc(t("rc_done"))}</b><p>${esc(t("rc_earned").replace("{m}", shift.earned))}</p><button class="nw-mini" data-target data-again>${esc(t("rc_again"))}</button></div>`;
        el.querySelector("[data-again]").addEventListener("click", () => app("recep"));
        return;
      }
      const [name, flag, rq, ok] = shift.order[shift.i];
      const opts = t(rq + "_opts").split("|");
      const born = Date.now();
      el.innerHTML = `<div class="rc-guest"><span class="rc-flag">${flag}</span><div><b>${esc(name)}</b><p>«${esc(t(rq))}»</p></div></div>
        <div class="rc-patience"><i></i></div>
        <div class="rc-opts">${opts.map((o, j) => `<button class="nw-mini" data-target data-o="${j}">${esc(o)}</button>`).join("")}</div>
        <p class="muted mono">${esc(t("rc_guest"))} ${shift.i + 1} / 6 · 💵 $${shift.earned}</p>`;
      const bar = el.querySelector(".rc-patience i");
      const pat = setInterval(() => { const p = 1 - (Date.now() - born) / 20000; if (!bar.isConnected) return clearInterval(pat); bar.style.width = `${Math.max(0, p * 100)}%`; if (p <= 0) { clearInterval(pat); answer(-1); } }, 200);
      const answer = (j) => {
        clearInterval(pat);
        const right = j === ok;
        const fast = Date.now() - born < 8000;
        const tip = right ? (fast ? 120 : 70) : 0;
        const stars = right ? (fast ? 5 : 4) : j < 0 ? 1 : 2;
        shift.earned += tip;
        Object.assign(lobby.job, { money: lobby.job.money + tip, served: lobby.job.served + 1, stars: lobby.job.stars + stars });
        save("nikolai.hotelJob", lobby.job);
        el.querySelector(".rc-opts").innerHTML = `<p class="${right ? "rc-ok" : "rc-bad"}">${right ? `✓ ${esc(t("rc_good"))} +$${tip}` : j < 0 ? `⌛ ${esc(t("rc_slow"))}` : `✕ ${esc(t("rc_bad"))} «${esc(opts[ok])}»`} ${"⭐".repeat(stars)}</p>`;
        shift.i++;
        setTimeout(next, 1600);
      };
      el.querySelectorAll("[data-o]").forEach((b) => b.addEventListener("click", () => answer(Number(b.dataset.o))));
    };
    next();
  };
  desk();
}
