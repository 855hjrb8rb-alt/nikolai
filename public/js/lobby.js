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
  { id: "leo", name: "Leo", kid: true, who: "un niño de 8 años de Guadalajara, de vacaciones con sus papás, travieso, fan de los dinosaurios y de los elevadores", look: { skin: "#d6a07a", shirt: "#ff7043", pants: "#1e88e5", hair: "#2a1a10", shorts: true, hat: "cap" }, x: 30, walk: true, speed: 14 },
  { id: "vale", name: "Vale", kid: true, who: "una niña de 6 años, hermana de Leo, curiosa, le encantan los gatos y preguntar todo", look: { skin: "#e3b48f", shirt: "#ab47bc", pants: "#f48fb1", hair: "#3a2412", long: true, dress: true }, x: 40, walk: true, speed: 17 },
  { id: "carmen", name: "Doña Carmen", who: "una abuelita de 78 años de Culiacán, muy cariñosa, cuenta historias del Sinaloa de antes y siempre ofrece dulces", look: { skin: "#d2a07c", shirt: "#7e57c2", pants: "#5d4037", hair: "#e0e0e0", glasses: true, dress: true }, x: 4, walk: false },
  { id: "beto", name: "Beto", who: "el botones del hotel, de Culiacán, 19 años, bromista y fan del béisbol y de los Tomateros", look: { skin: "#b97a52", shirt: "#8b1e2e", pants: "#1c1c1c", hair: "#140d08", hat: "bell", prop: "tray" }, x: 85, walk: true, speed: 45 },
];
const BEACH_NPCS = [
  { id: "emma", name: "Emma", who: "una turista canadiense de Toronto de 34 años, maestra, de vacaciones con su esposo; le encanta el ceviche y el snorkel", look: { skin: "#f3d0b4", shirt: "#ff8a5c", pants: "#29b6c8", hair: "#d9a650", long: true, shorts: true, hat: "sun", prop: "drink" }, x: 20, walk: true, speed: 22 },
  { id: "hans", name: "Hans", who: "un turista alemán de Múnich de 61 años, jubilado, ingeniero, puntual y curioso por la historia de México", look: { skin: "#f6d6c0", shirt: "#f4f4f4", pants: "#c9a36b", hair: "#ddd", shorts: true, hat: "sun", glasses: true, prop: "camera" }, x: 60, walk: true, speed: 18 },
  { id: "sofia", name: "Sofía", who: "una argentina de Buenos Aires de 29 años, diseñadora, viajando sola por la costa del Pacífico, muy alegre y habla con «vos» y «che»", look: { skin: "#e6b993", shirt: "#ffd84a", pants: "#2a6fdb", hair: "#5a3a22", long: true, dress: true }, x: 40, walk: true, speed: 26 },
  { id: "mike", name: "Mike", who: "un texano de Houston de 40 años, fanático del surf y de los tacos de pescado, vino con amigos", look: { skin: "#d7a27a", shirt: "#3aa66a", pants: "#1b3a6b", hair: "#3a2a1c", shorts: true, hat: "cap", prop: "board" }, x: 78, walk: true, speed: 30 },
  { id: "nico", name: "Nico", kid: true, who: "un niño de 9 años de Monterrey que está haciendo un castillo de arena y quiere ser biólogo marino", look: { skin: "#c58e66", shirt: "#26a69a", pants: "#fdd835", hair: "#1c120b", shorts: true, hat: "sun" }, x: 50, walk: true, speed: 12 },
  { id: "mia", name: "Mia", kid: true, who: "una niña estadounidense de 7 años de San Diego, habla mitad inglés mitad español y colecciona conchitas", look: { skin: "#f2cfb3", shirt: "#ef5350", pants: "#42a5f5", hair: "#e0b25a", long: true, shorts: true }, x: 70, walk: true, speed: 16 },
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
  hotel.floor = 0;
  scene === "beach" ? drawBeach() : drawLobby();
  timer = setInterval(() => ticks.forEach((f) => f()), 1000);
}
export function closeLobby() {
  clearInterval(timer); ticks.length = 0;
  stopAmbient();
  root?.remove(); root = null;
  document.body.classList.remove("in-lobby");
  removeEventListener("keydown", onKey, true);
}
function onKey(e) {
  if (e.key === "Escape") { e.stopPropagation(); closeLobby(); }
  else if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) e.stopPropagation();
}

function npcHtml(list) {
  return list.map((n) => `<button class="npc ${n.walk ? "walk" : ""} ${n.desk ? "desk" : ""} ${n.kid ? "kid" : ""}" data-target data-npc="${n.id}" style="--x:${n.x}%;--dur:${n.speed || 30}s;--delay:-${(n.x / 100) * (n.speed || 30)}s" aria-label="${esc(n.name)}">
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
    ${topBar(t("lb_title"), muteBtn() + notebookBtn() + `<span class="lb-key mono">${hotel.key ? `🔑 ${hotel.key.room}${hotel.key.suite ? " ✨" : ""}` : "🔑 —"}</span>`)}
    <div class="lb-wall">
      <div class="lb-clocks">${lobby.clocks.map((n, i) => `<button class="lb-clock" data-target data-clock="${i}">${clockSvg()}<span class="lb-plate"><b>${esc(city(n)[2])} ${esc(n)}</b><i class="mono" data-dig="${i}"></i></span></button>`).join("")}
        ${lobby.clocks.length < 8 ? `<button class="lb-clock add" data-target data-add>＋<span class="lb-plate"><b>${esc(t("lb_addClock"))}</b></span></button>` : ""}</div>
      <div class="lb-lamp l"></div><div class="lb-lamp r"></div>
    </div>
    <div class="lb-floor">
      <button class="lb-desk" data-target data-recep><span>🛎 RECEPCIÓN · ${esc(t("ht_askKey").toUpperCase())}</span></button>
      <button class="lb-elev e1" data-target data-elev><span class="mono">${hotel.floor || "L"}</span><i></i><i></i><b>🛗</b></button>
      <button class="lb-elev e2" data-target data-elev><span class="mono">▲▼</span><i></i><i></i><b>🛗</b></button>
      <button class="lb-stairs-door" data-target data-stairs><span class="exit">EXIT</span>🚨<b>${esc(t("ht_stairs"))}</b></button>
      <button class="lb-place bar" data-target data-place="bar">🍹<b>${esc(t("pl_bar"))}</b></button>
      <button class="lb-place spa" data-target data-place="spa">💆<b>${esc(t("pl_spa"))}</b></button>
      <div class="lb-chair c1"></div><div class="lb-chair c2"></div><div class="lb-chair c3"></div><div class="lb-table">☕</div>
      <div class="lb-plant l">🪴</div><div class="lb-plant r">🪴</div>
      <div class="lb-sofa"></div>
      <button class="lb-door" data-target data-go="beach"><span>🏖</span><b>${esc(t("lb_toBeach"))}</b></button>
      ${npcHtml(LOBBY_NPCS)}
    </div>
    <div class="lb-picker" hidden></div>
    <div class="lb-chat" hidden></div>
    ${clueHtml({ lobby: true })}
    <p class="lb-hint mono">${esc(t("lb_hint"))}</p>`;
  bindCommon(LOBBY_NPCS, t("lb_placeLobby"));
  ambient("lobby");
  bindHotelCommon();
  root.querySelector("[data-recep]").addEventListener("click", reception);
  root.querySelectorAll("[data-elev]").forEach((b) => b.addEventListener("click", elevator));
  root.querySelector("[data-stairs]").addEventListener("click", () => drawStairs(0));
  root.querySelectorAll("[data-place]").forEach((b) => b.addEventListener("click", () => drawPlace(b.dataset.place)));
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
    ${topBar(t("lb_beachTitle"), `<button class="nw-mini" data-target data-go="lobby">← ${esc(t("lb_toLobby"))}</button>` + muteBtn() + notebookBtn())}
    <div class="bc-sky"><div class="bc-sun"></div><div class="bc-cloud c1"></div><div class="bc-cloud c2"></div><div class="bc-cloud c3"></div><div class="bc-cloud c4"></div><div class="bc-cloud c5"></div><div class="bc-cloud c6"></div><span class="bc-bird b1">〰</span><span class="bc-bird b2">〰</span></div>
    <div class="bc-hotel"><div class="bc-tower"></div><div class="bc-tower t2"></div><span>NIKOLAI BEACH RESORT</span></div>
    <div class="bc-sea"><i class="wave w1"></i><i class="wave w2"></i><i class="wave w3"></i></div>
    <div class="bc-sand">
      <span class="bc-palm p1">🌴</span><span class="bc-palm p2">🌴</span><span class="bc-palm p3">🌴</span>
      <span class="bc-umb u1">⛱</span><span class="bc-umb u2">⛱</span><span class="bc-castle">🏰</span><span class="bc-ball">🏐</span>
      <button class="bc-pc" data-target data-pc><span class="bc-monitor">💻</span><b>${esc(t("lb_computer"))}</b></button>
      ${npcHtml(BEACH_NPCS)}
    </div>
    <div class="lb-chat" hidden></div>
    <div class="lb-computer" hidden></div>
    ${clueHtml({ beach: true })}
    <div class="lb-picker" hidden></div>
    <p class="lb-hint mono">${esc(t("lb_beachHint"))}</p>`;
  bindCommon(BEACH_NPCS, t("lb_placeBeach"));
  ambient("beach");
  bindHotelCommon();
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
        <button class="pc-app" data-target data-app="tasks"><span>🧹</span>${esc(t("pc_tasks"))}</button>
        <button class="pc-app" data-target data-app="mysteries"><span>🔍</span>${esc(t("pc_mysteries"))}</button>
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
    if (k === "tasks") { tasksApp(win(t("pc_tasks"), "")); return; }
    if (k === "mysteries") { mysteriesApp(win(t("pc_mysteries"), "")); return; }
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

// =====================================================================
// Hotel: llave, elevadores, escaleras, pisos, habitaciones, tareas y misterios
// =====================================================================
export const hotel = Object.assign(
  { key: null, floor: 0, tasks: [], mystery: null, solved: [], found: [] },
  load("nikolai.hotel", {}),
);
const saveHotel = () => save("nikolai.hotel", hotel);
const FLOORS = 8, ROOMS = 10, SUITE_FLOORS = [7, 8];
const roomNo = (f, d) => `${f}${String(d).padStart(2, "0")}`;
const isSuite = (room) => SUITE_FLOORS.includes(Number(String(room)[0]));
/** Las habitaciones 01–04 de los pisos 2 a 6 tienen balcón con vista al mar. */
const hasBalcony = (room) => isSuite(room) || (Number(String(room)[0]) >= 2 && Number(String(room).slice(1)) <= 4);
const PRICES = { standard: 150, balcony: 300, suite: 600 };
// Bienvenida: un poco de dinero para la primera noche; lo demás se gana trabajando en la computadora.
if (!hotel.welcome) { hotel.welcome = true; lobby.job.money += PRICES.standard; save("nikolai.hotelJob", lobby.job); save("nikolai.hotel", hotel); }

// ---------- Sonido de ambiente (generado) ----------
let amb = null;
function ambient(kind) {
  try {
    if (!amb) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const master = ctx.createGain(); master.gain.value = hotel.muted ? 0 : 0.5; master.connect(ctx.destination);
      amb = { ctx, master, nodes: [], kind: "" };
    }
    if (amb.kind === kind) return;
    amb.nodes.forEach((n) => { try { n.stop?.(); n.disconnect(); } catch { /* ya parado */ } });
    amb.nodes = []; amb.kind = kind;
    clearInterval(amb.chordTimer);
    const { ctx, master } = amb;
    const noise = () => {
      const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.start(); amb.nodes.push(s); return s;
    };
    if (kind === "beach") {
      // Olas: ruido filtrado que sube y baja.
      const n = noise(), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600;
      const g = ctx.createGain(); g.gain.value = 0.12;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12; const lg = ctx.createGain(); lg.gain.value = 0.1;
      lfo.connect(lg); lg.connect(g.gain); lfo.start(); amb.nodes.push(lfo, lp, g, lg);
      n.connect(lp); lp.connect(g); g.connect(master);
      return;
    }
    // Lobby / pasillos: acordes suaves de piano eléctrico y murmullo de gente.
    const n = noise(), bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = kind === "lobby" ? 0.025 : 0.008;
    n.connect(bp); bp.connect(ng); ng.connect(master); amb.nodes.push(bp, ng);
    const CHORDS = [[261.6, 329.6, 392, 493.9], [220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6], [196, 246.9, 293.7, 349.2]];
    let ci = 0;
    const play = () => {
      const now = ctx.currentTime;
      for (const f of CHORDS[ci++ % CHORDS.length]) {
        const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f / (kind === "stairs" ? 2 : 1);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(kind === "stairs" ? 0.01 : 0.035, now + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);
        o.connect(g); g.connect(master); o.start(now); o.stop(now + 4);
      }
    };
    play(); amb.chordTimer = setInterval(play, 4000);
  } catch { /* sin audio */ }
}
function ding() {
  if (!amb || hotel.muted) return;
  const { ctx, master } = amb, now = ctx.currentTime;
  [[1318, 0], [1046, 0.28]].forEach(([f, d]) => {
    const o = ctx.createOscillator(); o.frequency.value = f; const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, now + d); g.gain.exponentialRampToValueAtTime(0.0001, now + d + 1.2);
    o.connect(g); g.connect(master); o.start(now + d); o.stop(now + d + 1.3);
  });
}
function stopAmbient() { if (!amb) return; clearInterval(amb.chordTimer); try { amb.ctx.close(); } catch { /* cerrada */ } amb = null; }
function muteBtn() { return `<button class="nw-mini" data-target data-mute>${hotel.muted ? "🔇" : "🔊"}</button>`; }
function bindMute() {
  root.querySelector("[data-mute]")?.addEventListener("click", (e) => {
    hotel.muted = !hotel.muted; saveHotel();
    if (amb) amb.master.gain.value = hotel.muted ? 0 : 0.5;
    e.currentTarget.textContent = hotel.muted ? "🔇" : "🔊";
  });
}

// ---------- Avisos ----------
function toast(text, ms = 3200) {
  const el = document.createElement("div");
  el.className = "lb-toast";
  el.textContent = text;
  root?.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// ---------- Acceso ----------
function staffRooms() {
  const r = new Set(hotel.tasks.filter((x) => x.accepted && !x.done).map((x) => x.room));
  const m = mysteryStep();
  if (m?.room) r.add(m.room);
  return r;
}
function canEnter(room) { return hotel.key?.room === room || staffRooms().has(room); }
function canReach(floor) {
  if (floor === 0) return true;
  if (!SUITE_FLOORS.includes(floor)) return Boolean(hotel.key) || [...staffRooms()].some((r) => +String(r)[0] === floor) || mysteryStep()?.floor === floor;
  return hotel.key?.suite || [...staffRooms()].some((r) => +String(r)[0] === floor) || mysteryStep()?.floor === floor;
}

// ---------- Recepción: pagar habitación y pedir llave ----------
function pickRoom(type) {
  for (let i = 0; i < 50; i++) {
    const f = type === "suite" ? SUITE_FLOORS[(Math.random() * 2) | 0] : type === "balcony" ? 2 + ((Math.random() * 5) | 0) : 1 + ((Math.random() * 6) | 0);
    const d = type === "balcony" ? 1 + ((Math.random() * 4) | 0) : type === "standard" ? (f === 1 ? 1 + ((Math.random() * ROOMS) | 0) : 5 + ((Math.random() * 6) | 0)) : 1 + ((Math.random() * ROOMS) | 0);
    const r = roomNo(f, d);
    if ((type === "suite") === isSuite(r) && (type === "balcony") === (hasBalcony(r) && !isSuite(r))) return r;
  }
  return type === "suite" ? "801" : type === "balcony" ? "301" : "105";
}
function reception() {
  const { t } = ctxRef;
  const box = root.querySelector(".lb-picker");
  box.hidden = false;
  const draw = () => {
    box.innerHTML = `<div class="lb-card">
      <b>🛎 ${esc(t("ht_reception"))}</b>
      <p>${hotel.key ? esc(t("ht_youHave").replace("{room}", hotel.key.room)) + ` · ${esc(t("rt_" + hotel.key.type))}` : esc(t("ht_noKey"))}</p>
      <div class="rt-list">${["standard", "balcony", "suite"].map((k) => `<button class="rt" data-target data-k="${k}">
        <span>${{ standard: "🛏", balcony: "🌅", suite: "✨" }[k]}</span><b>${esc(t("rt_" + k))}</b><small>${esc(t("rt_" + k + "Desc"))}</small><em class="mono">$${PRICES[k]} / ${esc(t("rt_night"))}</em></button>`).join("")}</div>
      ${hotel.key ? `<div class="lb-row"><button class="nw-mini" data-target data-k="return">↩ ${esc(t("ht_return"))}</button></div>` : ""}
      <p class="muted mono">💵 ${esc(t("rt_balance"))}: $${lobby.job.money.toLocaleString()} · ${esc(t("ht_moneyHint"))}</p>
      <div class="lb-row"><button class="nw-mini" data-target data-close>${esc(t("lb_cancel"))}</button></div>
    </div>`;
    box.querySelector("[data-close]").addEventListener("click", () => { box.hidden = true; });
    box.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.k;
      if (k === "return") { hotel.key = null; saveHotel(); toast(t("ht_returned")); draw(); refreshKey(); return; }
      if (lobby.job.money < PRICES[k]) { toast(t("ht_noMoney").replace("{p}", PRICES[k] - lobby.job.money)); return; }
      lobby.job.money -= PRICES[k]; save("nikolai.hotelJob", lobby.job);
      const room = pickRoom(k);
      hotel.key = { room, type: k, suite: k === "suite" };
      saveHotel(); ding();
      toast(t("ht_gotKey").replace("{room}", room).replace("{p}", PRICES[k]));
      draw(); refreshKey();
    }));
  };
  draw();
}
function refreshKey() {
  const el = root?.querySelector(".lb-key");
  if (el) el.textContent = hotel.key ? `🔑 ${hotel.key.room}${hotel.key.suite ? " ✨" : hotel.key.type === "balcony" ? " 🌅" : ""}` : "🔑 —";
}

// ---------- Bar y spa ----------
const BAR_MENU = [["margarita", "🍹", 80], ["michelada", "🍺", 60], ["mojito", "🍸", 85], ["horchata", "🥛", 40], ["coco", "🥥", 50], ["nachos", "🧀", 70]];
const SPA_MENU = [["relax", "💆", 250], ["stones", "🪨", 350], ["facial", "🧖", 200], ["feet", "🦶", 150]];
function drawPlace(kind) {
  const { t } = ctxRef;
  ticks.length = 0;
  const bar = kind === "bar";
  root.className = `lb ${bar ? "lb-bar" : "lb-spa"}`;
  const staff = bar
    ? [{ id: "javi", name: "Javi", who: "el bartender del hotel, de Mazatlán, 30 años, experto en cocteles y en música de banda, simpático y buen consejero", look: { skin: "#b47a50", shirt: "#111", pants: "#111", hair: "#140d08" }, x: 46, walk: false, desk: true },
       { id: "lupita", name: "Lupita", who: "una cantante de 28 años que toca guitarra en el bar del hotel; le piden boleros y baladas", look: { skin: "#c88e66", shirt: "#c2185b", pants: "#222", hair: "#1a0f08", long: true, dress: true }, x: 82, walk: false },
       { id: "frank", name: "Frank", who: "un turista de Chicago de 55 años que viene cada año, cuenta chistes y apuesta en los partidos de béisbol", look: { skin: "#efc5a3", shirt: "#f9a825", pants: "#37474f", hair: "#9e9e9e" }, x: 18, walk: true, speed: 30 }]
    : [{ id: "ana", name: "Ana", who: "la masajista del spa, de Culiacán, 35 años, tranquila y profesional, da consejos de relajación y respiración", look: { skin: "#c48a62", shirt: "#ffffff", pants: "#ffffff", hair: "#2a1a10", long: true }, x: 46, walk: false },
       { id: "irene", name: "Irene", who: "una huésped española de Madrid de 40 años que viene al spa a desconectarse del trabajo", look: { skin: "#f0c9a8", shirt: "#80cbc4", pants: "#80cbc4", hair: "#4e342e", long: true, dress: true }, x: 20, walk: false }];
  const menu = bar ? BAR_MENU : SPA_MENU;
  root.innerHTML = `
    ${topBar(t(bar ? "pl_barTitle" : "pl_spaTitle"), `<button class="nw-mini" data-target data-go="lobby">← ${esc(t("lb_toLobby"))}</button>` + muteBtn())}
    <div class="pl-back">${bar ? `<div class="bar-shelf">🍾🥃🍷🍸🍾🥃🍷🍹🍾</div><div class="bar-neon">BAR · LA OLA</div>` : `<div class="spa-plants">🎋 🪷 🕯 🪷 🎋</div><div class="spa-sign">SPA · ARENA</div>`}</div>
    <div class="pl-floor">${bar ? `<div class="bar-counter"></div><div class="bar-stools"><i></i><i></i><i></i><i></i><i></i></div>` : `<div class="spa-bed b1"></div><div class="spa-bed b2"></div><div class="spa-pool">💧</div>`}
      ${npcHtml(staff)}</div>
    <div class="pl-menu"><b>${esc(t(bar ? "pl_menu" : "pl_services"))}</b>${menu.map(([k, ic, p]) => `<button class="nw-mini" data-target data-buy="${k}">${ic} ${esc(t("pm_" + k))} · $${p}</button>`).join("")}
      <span class="mono muted">💵 $<span data-money>${lobby.job.money.toLocaleString()}</span></span></div>
    ${!bar ? `<div class="spa-relax"><span>${esc(t("pl_relax"))}</span><i><i style="width:${hotel.relax || 0}%"></i></i></div>` : ""}
    <div class="lb-picker" hidden></div><div class="lb-chat" hidden></div>`;
  ambient(bar ? "lobby" : "stairs");
  bindHotelCommon();
  root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => { ticks.length = 0; drawLobby(); }));
  root.querySelectorAll("[data-npc]").forEach((b) => b.addEventListener("click", () => openChat(staff.find((n) => n.id === b.dataset.npc), t(bar ? "pl_barPlace" : "pl_spaPlace"))));
  root.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => {
    const item = menu.find((m) => m[0] === b.dataset.buy);
    if (lobby.job.money < item[2]) { toast(t("ht_noMoney").replace("{p}", item[2] - lobby.job.money)); return; }
    lobby.job.money -= item[2]; save("nikolai.hotelJob", lobby.job);
    root.querySelector("[data-money]").textContent = lobby.job.money.toLocaleString();
    if (!bar) { hotel.relax = Math.min(100, (hotel.relax || 0) + item[2] / 5); saveHotel(); const bar2 = root.querySelector(".spa-relax i i"); if (bar2) bar2.style.width = `${hotel.relax}%`; }
    toast(`${item[1]} ${t("pm_" + item[0] + "_done")}`, 4000);
  }));
}

// ---------- Elevador ----------
function elevator() {
  const { t } = ctxRef;
  const box = root.querySelector(".lb-picker");
  box.hidden = false;
  box.innerHTML = `<div class="lb-card elev">
    <b>🛗 ${esc(t("ht_elevator"))}</b>
    <p class="muted">${esc(hotel.key ? t("ht_tapCard") : t("ht_needKey"))}</p>
    <div class="elev-pad">${[8, 7, 6, 5, 4, 3, 2, 1, 0].map((f) => `<button class="elev-btn ${SUITE_FLOORS.includes(f) ? "suite" : ""} ${canReach(f) ? "" : "locked"}" data-target data-floor="${f}">${f === 0 ? "L" : f}${SUITE_FLOORS.includes(f) ? "<small>SUITE</small>" : ""}</button>`).join("")}</div>
    <div class="lb-row"><button class="nw-mini" data-target data-close>${esc(t("lb_cancel"))}</button></div>
  </div>`;
  box.querySelector("[data-close]").addEventListener("click", () => { box.hidden = true; });
  box.querySelectorAll("[data-floor]").forEach((b) => b.addEventListener("click", () => {
    const f = Number(b.dataset.floor);
    if (!canReach(f)) { toast(SUITE_FLOORS.includes(f) ? t("ht_suiteOnly") : t("ht_needKey")); return; }
    box.hidden = true;
    ride(hotel.floor, f);
  }));
}
function ride(from, to) {
  const { t } = ctxRef;
  const box = root.querySelector(".lb-picker");
  box.hidden = false;
  box.innerHTML = `<div class="elev-ride"><div class="elev-doors"><i></i><i></i></div><b class="mono elev-num">${from || "L"}</b><span>${esc(t("ht_going"))}</span></div>`;
  const num = box.querySelector(".elev-num");
  let f = from;
  const step = setInterval(() => {
    f += Math.sign(to - f);
    num.textContent = f || "L";
    if (f === to) {
      clearInterval(step);
      ding();
      setTimeout(() => { box.hidden = true; goFloor(to); }, 700);
    }
  }, 550);
  if (from === to) { clearInterval(step); box.hidden = true; goFloor(to); }
}
function goFloor(f) {
  hotel.floor = f; saveHotel(); ticks.length = 0;
  if (f === 0) drawLobby(); else drawFloor(f);
}

// ---------- Escaleras de emergencia ----------
function drawStairs(f) {
  const { t } = ctxRef;
  ticks.length = 0;
  hotel.floor = f; saveHotel();
  root.className = "lb lb-stairs";
  root.innerHTML = `
    ${topBar(t("ht_stairsTitle"), muteBtn() + notebookBtn())}
    <div class="st-wall"><div class="st-sign">🚪 ${f === 0 ? "LOBBY" : `${t("ht_floor").toUpperCase()} ${f}`}</div><div class="st-exit">EXIT ⇢</div>
      <div class="st-steps">${Array.from({ length: 9 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div><div class="st-rail"></div></div>
    <div class="st-ctrl">
      <button class="tile" data-target data-st="up" ${f >= FLOORS ? "disabled" : ""}><span class="t-main">▲ ${esc(t("ht_up"))}</span></button>
      <button class="tile action" data-target data-st="door"><span class="t-main">🚪 ${esc(f === 0 ? t("ht_toLobby") : t("ht_toHall").replace("{f}", f))}</span></button>
      <button class="tile" data-target data-st="down" ${f <= 0 ? "disabled" : ""}><span class="t-main">▼ ${esc(t("ht_down"))}</span></button>
    </div>
    ${clueHtml({ stairs: f })}
    <div class="lb-picker" hidden></div>
    <p class="lb-hint mono">${esc(t("ht_stairsHint"))}</p>`;
  ambient("stairs");
  bindHotelCommon();
  root.querySelectorAll("[data-st]").forEach((b) => b.addEventListener("click", () => {
    const a = b.dataset.st;
    if (a === "up") drawStairs(Math.min(FLOORS, f + 1));
    else if (a === "down") drawStairs(Math.max(0, f - 1));
    else if (f === 0) { ticks.length = 0; drawLobby(); }
    else if (SUITE_FLOORS.includes(f) && !canReach(f)) toast(t("ht_suiteDoor"));
    else drawFloor(f);
  }));
}

// ---------- Pasillo de un piso ----------
function drawFloor(f) {
  const { t } = ctxRef;
  ticks.length = 0;
  root.className = `lb lb-hall ${SUITE_FLOORS.includes(f) ? "suite" : ""}`;
  const doors = Array.from({ length: ROOMS }, (_, i) => roomNo(f, i + 1));
  const taskAt = (r) => hotel.tasks.find((x) => x.accepted && !x.done && x.room === r);
  root.innerHTML = `
    ${topBar(`${t("ht_floor")} ${f}${SUITE_FLOORS.includes(f) ? " · SUITES" : ""}`, muteBtn() + notebookBtn())}
    <div class="hl-wall"><div class="hl-doors">${doors.map((r) => {
      const mine = hotel.key?.room === r, task = taskAt(r);
      return `<button class="hl-door ${mine ? "mine" : ""} ${task ? "task" : ""}" data-target data-door="${r}"><span class="hl-num">${r}</span>${isSuite(r) ? "<small>SUITE</small>" : hasBalcony(r) ? "<small>🌅</small>" : ""}<i class="hl-knob"></i>${mine ? `<em>🔑</em>` : task ? `<em>${task.icon}</em>` : ""}</button>`;
    }).join("")}</div></div>
    <div class="hl-carpet"></div>
    <div class="hl-ends">
      <button class="tile" data-target data-hl="elev"><span class="t-main">🛗 ${esc(t("ht_elevator"))}</span></button>
      <button class="tile" data-target data-hl="stairs"><span class="t-main">🚨 ${esc(t("ht_stairs"))}</span></button>
    </div>
    ${clueHtml({ hall: f })}
    ${npcHtml(f % 2 ? [{ id: "maid", name: "Rosa", who: "la camarista del hotel, de Los Mochis, 45 años, trabajadora y chismosa amable; sabe todo lo que pasa en los pisos", look: { skin: "#b9805a", shirt: "#4a6a8a", pants: "#4a6a8a", hair: "#1b120b", long: false }, x: 30, walk: true, speed: 40 }] : [])}
    <div class="lb-picker" hidden></div><div class="lb-chat" hidden></div>
    <p class="lb-hint mono">${esc(t("ht_hallHint"))}</p>`;
  ambient("hall");
  bindHotelCommon();
  root.querySelectorAll("[data-npc]").forEach((b) => b.addEventListener("click", () => openChat({ id: "maid", name: "Rosa", who: "la camarista del hotel, de Los Mochis, 45 años, trabajadora y chismosa amable; sabe todo lo que pasa en los pisos", look: { skin: "#b9805a", shirt: "#4a6a8a", pants: "#4a6a8a", hair: "#1b120b" } }, `el pasillo del piso ${f} del Hotel NIKOLAI`)));
  root.querySelector('[data-hl="elev"]').addEventListener("click", elevator);
  root.querySelector('[data-hl="stairs"]').addEventListener("click", () => drawStairs(f));
  root.querySelectorAll("[data-door]").forEach((b) => b.addEventListener("click", () => {
    const r = b.dataset.door;
    const task = taskAt(r);
    if (task && task.kind === "door") { completeTask(task); drawFloor(f); return; }
    if (canEnter(r)) { drawRoom(r); return; }
    // Tocar la puerta.
    const said = t("ht_knock").split("|");
    toast(`🚪 ${r}: ${said[(Math.random() * said.length) | 0]}`);
  }));
}

// ---------- Habitación ----------
const OBJECTS = ["bed", "tv", "minibar", "window", "painting", "safe", "bath"];
function drawRoom(r) {
  const { t } = ctxRef;
  ticks.length = 0;
  const f = Number(String(r)[0]);
  const suite = isSuite(r);
  root.className = `lb lb-room ${suite ? "suite" : ""}`;
  root.innerHTML = `
    ${topBar(`${t("ht_room")} ${r}${suite ? " · SUITE" : hasBalcony(r) ? " · " + t("rt_balcony") : ""}`, muteBtn() + notebookBtn())}
    <div class="rm-wall">
      <button class="rm-obj rm-window" data-target data-obj="window" style="--sky:${Math.min(1, f / 8)}"><i class="rm-sea"></i></button>
      <button class="rm-obj rm-painting" data-target data-obj="painting">🖼</button>
      <button class="rm-obj rm-tv" data-target data-obj="tv"><i></i></button>
      ${hasBalcony(r) ? `<button class="rm-obj rm-balcony" data-target data-obj="balcony">🌅 ${esc(t("ht_balcony"))}</button>` : ""}
    </div>
    <div class="rm-floor">
      <button class="rm-obj rm-bed" data-target data-obj="bed"><i class="pillow p1"></i><i class="pillow p2"></i></button>
      <button class="rm-obj rm-minibar" data-target data-obj="minibar">🧊</button>
      <button class="rm-obj rm-safe" data-target data-obj="safe">🔒</button>
      <button class="rm-obj rm-bath" data-target data-obj="bath">${suite ? "🛁" : "🚿"}</button>
      ${suite ? `<div class="rm-sofa"></div><div class="rm-jacuzzi">♨ Jacuzzi</div>` : ""}
    </div>
    <div class="hl-ends"><button class="tile" data-target data-back><span class="t-main">← ${esc(t("ht_toHall").replace("{f}", f))}</span></button></div>
    ${clueHtml({ room: r })}
    <div class="lb-picker" hidden></div>
    <p class="lb-hint mono">${esc(t("ht_roomHint"))}</p>`;
  ambient("hall");
  bindHotelCommon();
  root.querySelector("[data-back]").addEventListener("click", () => drawFloor(f));
  root.querySelectorAll("[data-obj]").forEach((b) => b.addEventListener("click", () => {
    const o = b.dataset.obj;
    const task = hotel.tasks.find((x) => x.accepted && !x.done && x.room === r && x.obj === o);
    if (task) { completeTask(task); return; }
    toast(t(`ho_${o}`) + (suite ? " " + t("ho_suite") : ""));
  }));
}

// ---------- Tareas de trabajo (computadora) ----------
const TASK_KINDS = [
  { id: "towels", kind: "door", icon: "🧺", pay: 60 },
  { id: "service", kind: "door", icon: "🍽", pay: 90 },
  { id: "tv", kind: "obj", obj: "tv", icon: "📺", pay: 110 },
  { id: "minibar", kind: "obj", obj: "minibar", icon: "🧊", pay: 70 },
  { id: "earring", kind: "obj", obj: "bed", icon: "💍", pay: 150 },
  { id: "ac", kind: "obj", obj: "window", icon: "❄", pay: 100 },
  { id: "leak", kind: "obj", obj: "bath", icon: "💧", pay: 130 },
];
function newTask() {
  const k = TASK_KINDS[(Math.random() * TASK_KINDS.length) | 0];
  const f = 1 + ((Math.random() * FLOORS) | 0);
  return { ...k, room: roomNo(f, 1 + ((Math.random() * ROOMS) | 0)), pay: k.pay + (SUITE_FLOORS.includes(f) ? 80 : 0), accepted: false, done: false, uid: Math.random().toString(36).slice(2, 8) };
}
function ensureTasks() {
  hotel.tasks = hotel.tasks.filter((x) => !x.done);
  while (hotel.tasks.length < 5) hotel.tasks.push(newTask());
  saveHotel();
}
function completeTask(task) {
  const { t } = ctxRef;
  task.done = true;
  lobby.job.money += task.pay; lobby.job.served++; lobby.job.stars += 5;
  save("nikolai.hotelJob", lobby.job);
  ensureTasks();
  ding();
  toast(`✓ ${t("tk_" + task.id).replace("{room}", task.room)} · +$${task.pay}`);
}
function tasksApp(body) {
  const { t } = ctxRef;
  ensureTasks();
  const draw = () => {
    body.innerHTML = `<p class="muted">${esc(t("tk_intro"))}</p>
      <div class="tk-list">${hotel.tasks.map((x) => `<div class="tk ${x.accepted ? "on" : ""}"><span class="tk-ico">${x.icon}</span>
        <div><b>${esc(t("tk_" + x.id).replace("{room}", x.room))}</b><small>${esc(t("ht_floor"))} ${String(x.room)[0]} · $${x.pay}${isSuite(x.room) ? " · SUITE" : ""}</small></div>
        <button class="nw-mini" data-target data-acc="${x.uid}">${x.accepted ? "✓ " + esc(t("tk_accepted")) : esc(t("tk_accept"))}</button></div>`).join("")}</div>
      <p class="muted">${esc(t("tk_how"))}</p>`;
    body.querySelectorAll("[data-acc]").forEach((b) => b.addEventListener("click", () => {
      const x = hotel.tasks.find((y) => y.uid === b.dataset.acc);
      x.accepted = !x.accepted; saveHotel(); draw();
    }));
  };
  draw();
}

// ---------- Misterios ----------
const MYSTERIES = [
  { id: "necklace", reward: 800, steps: [{ lobby: true }, { room: "801", obj: "safe" }, { hall: 8 }, { stairs: 7 }, { room: "305", obj: "minibar" }], answer: 1 },
  { id: "lights", reward: 600, steps: [{ hall: 6 }, { lobby: true }, { stairs: 6 }, { room: "606", obj: "tv" }], answer: 1 },
  { id: "ghost", reward: 700, steps: [{ lobby: true }, { hall: 4 }, { room: "404", obj: "window" }, { beach: true }], answer: 1 },
];
function mysteryStep() {
  const m = MYSTERIES.find((x) => x.id === hotel.mystery);
  if (!m) return null;
  const s = m.steps[hotel.found.length];
  if (!s) return null;
  return { ...s, floor: s.room ? Number(s.room[0]) : s.hall || s.stairs || null };
}
function clueHtml(where) {
  const s = mysteryStep();
  if (!s) return "";
  const match = (where.room && s.room === where.room) || (where.hall && s.hall === where.hall) || (where.stairs != null && s.stairs === where.stairs && where.stairs !== 0) || (where.lobby && s.lobby) || (where.beach && s.beach);
  if (!match) return "";
  const pos = s.obj ? { safe: "left:64%;bottom:22%", minibar: "left:46%;bottom:20%", tv: "left:62%;top:30%", window: "left:22%;top:26%" }[s.obj] : "left:40%;bottom:24%";
  return `<button class="clue" data-target data-clue style="${pos}">🔍<span>${esc(ctxRef.t("ms_clue"))}</span></button>`;
}
function bindClue() {
  root.querySelector("[data-clue]")?.addEventListener("click", () => {
    const { t } = ctxRef;
    const m = MYSTERIES.find((x) => x.id === hotel.mystery);
    const i = hotel.found.length;
    hotel.found.push(i); saveHotel();
    root.querySelector("[data-clue]").remove();
    const box = root.querySelector(".lb-picker");
    box.hidden = false;
    const all = hotel.found.length >= m.steps.length;
    const next = mysteryStep();
    box.innerHTML = `<div class="lb-card ms">
      <b>🔍 ${esc(t(`ms_${m.id}_title`))} · ${esc(t("ms_clue"))} ${i + 1}/${m.steps.length}</b>
      <p class="ms-text">${esc(t(`ms_${m.id}_${i}`))}</p>
      ${all ? `<p><b>${esc(t("ms_ready"))}</b></p>` : `<p class="muted">➜ ${esc(nextHint(next))}</p>`}
      <div class="lb-row"><button class="nw-mini" data-target data-close>${esc(t("ms_keep"))}</button>${all ? `<button class="nw-mini" data-target data-solve>⚖ ${esc(t("ms_solve"))}</button>` : ""}</div>
    </div>`;
    box.querySelector("[data-close]").addEventListener("click", () => { box.hidden = true; });
    box.querySelector("[data-solve]")?.addEventListener("click", () => solve());
  });
}
function nextHint(s) {
  const { t } = ctxRef;
  if (!s) return "";
  if (s.lobby) return t("ms_goLobby");
  if (s.beach) return t("ms_goBeach");
  if (s.room) return t("ms_goRoom").replace("{room}", s.room);
  if (s.hall) return t("ms_goHall").replace("{f}", s.hall);
  if (s.stairs) return t("ms_goStairs").replace("{f}", s.stairs);
  return "";
}
function notebookBtn() { return hotel.mystery ? `<button class="nw-mini" data-target data-notebook>📓 ${esc(ctxRef.t("ms_notebook"))}</button>` : ""; }
function notebook() {
  const { t } = ctxRef;
  const m = MYSTERIES.find((x) => x.id === hotel.mystery);
  if (!m) return;
  const box = root.querySelector(".lb-picker");
  box.hidden = false;
  const all = hotel.found.length >= m.steps.length;
  box.innerHTML = `<div class="lb-card ms">
    <b>📓 ${esc(t(`ms_${m.id}_title`))}</b>
    <p class="muted">${esc(t(`ms_${m.id}_intro`))}</p>
    <ol class="ms-list">${hotel.found.map((i) => `<li>${esc(t(`ms_${m.id}_${i}`))}</li>`).join("")}</ol>
    ${all ? "" : `<p>➜ ${esc(nextHint(mysteryStep()))}</p>`}
    <div class="lb-row"><button class="nw-mini" data-target data-close>${esc(t("lb_cancel"))}</button>${all ? `<button class="nw-mini" data-target data-solve>⚖ ${esc(t("ms_solve"))}</button>` : ""}<button class="nw-mini" data-target data-quit>${esc(t("ms_quit"))}</button></div>
  </div>`;
  box.querySelector("[data-close]").addEventListener("click", () => { box.hidden = true; });
  box.querySelector("[data-solve]")?.addEventListener("click", solve);
  box.querySelector("[data-quit]").addEventListener("click", () => { hotel.mystery = null; hotel.found = []; saveHotel(); box.hidden = true; root.querySelector("[data-notebook]")?.remove(); root.querySelector("[data-clue]")?.remove(); });
}
function solve() {
  const { t } = ctxRef;
  const m = MYSTERIES.find((x) => x.id === hotel.mystery);
  const box = root.querySelector(".lb-picker");
  const opts = t(`ms_${m.id}_q_opts`).split("|");
  box.hidden = false;
  box.innerHTML = `<div class="lb-card ms"><b>⚖ ${esc(t(`ms_${m.id}_q`))}</b>
    <div class="rc-opts">${opts.map((o, i) => `<button class="nw-mini" data-target data-ans="${i}">${esc(o)}</button>`).join("")}</div></div>`;
  box.querySelectorAll("[data-ans]").forEach((b) => b.addEventListener("click", () => {
    const ok = Number(b.dataset.ans) === m.answer;
    if (ok) {
      lobby.job.money += m.reward; save("nikolai.hotelJob", lobby.job);
      if (!hotel.solved.includes(m.id)) hotel.solved.push(m.id);
      hotel.mystery = null; hotel.found = []; saveHotel(); ding();
    }
    box.innerHTML = `<div class="lb-card ms"><b>${ok ? "🏆 " + esc(t("ms_solved")) : "✕ " + esc(t("ms_wrong"))}</b><p>${esc(ok ? t(`ms_${m.id}_end`) + ` +$${m.reward}` : t("ms_tryAgain"))}</p>
      <div class="lb-row"><button class="nw-mini" data-target data-close>OK</button></div></div>`;
    box.querySelector("[data-close]").addEventListener("click", () => { box.hidden = true; root.querySelector("[data-notebook]")?.remove(); });
  }));
}
function mysteriesApp(body) {
  const { t } = ctxRef;
  body.innerHTML = `<p class="muted">${esc(t("ms_intro"))}</p>
    <div class="tk-list">${MYSTERIES.map((m) => `<div class="tk ${hotel.mystery === m.id ? "on" : ""}"><span class="tk-ico">${hotel.solved.includes(m.id) ? "🏆" : "🔍"}</span>
      <div><b>${esc(t(`ms_${m.id}_title`))}</b><small>${esc(t(`ms_${m.id}_intro`))} · $${m.reward}</small></div>
      <button class="nw-mini" data-target data-ms="${m.id}">${hotel.mystery === m.id ? esc(t("ms_active")) : esc(t("ms_start"))}</button></div>`).join("")}</div>`;
  body.querySelectorAll("[data-ms]").forEach((b) => b.addEventListener("click", () => {
    hotel.mystery = b.dataset.ms; hotel.found = []; saveHotel();
    mysteriesApp(body);
    toast(`🔍 ${t(`ms_${hotel.mystery}_title`)} — ${nextHint(mysteryStep())}`, 5000);
  }));
}

function bindHotelCommon() {
  root.querySelector(".lb-exit")?.addEventListener("click", closeLobby);
  root.querySelector("[data-notebook]")?.addEventListener("click", notebook);
  bindMute();
  bindClue();
}
