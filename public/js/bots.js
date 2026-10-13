// Bots de trading y minería: por ahora en mantenimiento, con cuenta regresiva.
// Cuando termine el mantenimiento, aquí se podrán crear bots (se activa quitando MAINTENANCE_UNTIL).
export const MAINTENANCE_UNTIL = Date.parse("2026-10-16T17:23:00Z"); // 3 días y 2 horas desde su publicación

export const botsInMaintenance = () => Date.now() < MAINTENANCE_UNTIL;

function left() {
  const ms = Math.max(0, MAINTENANCE_UNTIL - Date.now());
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4), s = Math.floor((ms % 6e4) / 1e3);
  return { d, h, m, s };
}

let timer = 0;
/** ctx = { t, esc } */
export function renderBots(body, ctx) {
  const { t, esc } = ctx;
  clearInterval(timer);
  const card = (k, icon) => `
    <div class="bot-card maint">
      <div class="bot-head"><span class="bot-ico">${icon}</span><div><b>${esc(t("bot_" + k))}</b><small class="mono">${esc(t("bot_" + k + "Sub"))}</small></div></div>
      <p>${esc(t("bot_" + k + "Desc"))}</p>
      <div class="bot-badge mono">🛠 ${esc(t("bot_maint").toUpperCase())}</div>
      <button class="tile" disabled><span class="t-main">${esc(t("bot_create"))}</span></button>
    </div>`;
  body.innerHTML = `
    <div class="bot-maint readout">
      <div class="k">${esc(t("bot_status").toUpperCase())} · <span class="bot-red">● ${esc(t("bot_maint").toUpperCase())}</span></div>
      <p>${esc(t("bot_maintMsg"))}</p>
      <div class="bot-count mono" id="botCount"></div>
      <p class="muted mono">${esc(t("bot_until"))}: ${esc(new Date(MAINTENANCE_UNTIL).toLocaleString(ctx.lang || "es", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }))}</p>
    </div>
    <div class="bot-cards">${card("trading", "📈")}${card("mining", "⛏")}</div>
    <p class="muted">${esc(t("bot_note"))}</p>`;
  const tick = () => {
    const el = body.querySelector("#botCount");
    if (!el) { clearInterval(timer); return; }
    const { d, h, m, s } = left();
    el.innerHTML = [[d, t("bot_days")], [h, t("bot_hours")], [m, t("bot_min")], [s, t("bot_sec")]]
      .map(([v, l]) => `<div><b>${String(v).padStart(2, "0")}</b><span>${esc(l)}</span></div>`).join("");
  };
  tick();
  timer = setInterval(tick, 1000);
}
