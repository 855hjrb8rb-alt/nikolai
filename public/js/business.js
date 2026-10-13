// Trabajo, Proyectos y Dinero: currículum, entrevistas, tablero de proyectos con IA,
// meta del millón, presupuesto, hábitos e ideas de negocio.
import { renderInto, speakable } from "./md.js";

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* lleno */ } };
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);

/** Ejecuta una tarea de la IA y la va pintando en `out`. Devuelve el texto completo. */
async function runCoach(ctx, coach, messages, out, extra = {}) {
  let full = "";
  const err = await ctx.stream(
    { messages, mode: "coach", coach, channel: "text", ...extra },
    { onText: (d) => { full += d; if (out?.isConnected && coach !== "plan") renderInto(out, full); } },
  );
  return { full, err };
}

function download(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// =====================================================================
// Trabajo
// =====================================================================
const WORK = ["cv", "letter", "interview", "email", "salary", "linkedin"];
export const work = Object.assign({ task: "cv", input: {}, out: load("nikolai.work", {}), chat: [], busy: false });

export function renderWork(body, ctx) {
  const { t, esc, tile, icon } = ctx;
  const k = work.task;
  const isInterview = k === "interview";
  const out = work.out[k] || "";
  body.innerHTML = `
    <div class="tiles biz-tasks">${WORK.map((x) => tile(esc(t("wk_" + x)), esc(t("wkSub_" + x)), k === x ? "on" : "")).join("")}</div>
    ${isInterview && work.chat.length ? `
      <div class="chat-log biz-chat">${work.chat.filter((m) => !m.hidden).map((m) => `<div class="msg ${m.role}">${m.role === "user" ? esc(m.content) : ""}</div>`).join("")}</div>
      <textarea id="bizIn" class="field" rows="3" placeholder="${esc(t("wk_answer"))}"></textarea>
      <div class="tiles biz-actions">
        ${tile(`${icon("send")}<br>${esc(work.busy ? t("thinking") : t("wk_sendAnswer"))}`, "", "action" + (work.busy ? " live" : ""))}
        ${tile(`${icon("mic")}<br>${esc(t("hw_dictate"))}`, "", "action")}
        ${tile(`${icon("speaker")}<br>${esc(t("readAloud"))}`, "", "action")}
        ${tile(`${icon("trash")}<br>${esc(t("wk_restart"))}`, "", "action")}
      </div>` : `
      <textarea id="bizIn" class="field" rows="5" placeholder="${esc(t("wkPh_" + k))}">${esc(work.input[k] || "")}</textarea>
      <div class="tiles biz-actions">
        ${tile(`${icon("send")}<br>${esc(work.busy ? t("thinking") : isInterview ? t("wk_startInterview") : t("wk_make"))}`, "", "action" + (work.busy ? " live" : ""))}
        ${tile(`${icon("mic")}<br>${esc(t("hw_dictate"))}`, "", "action")}
        ${tile(`${icon("speaker")}<br>${esc(t("readAloud"))}`, "", "action")}
        ${tile(`${icon("notes")}<br>${esc(t("biz_copy"))}`, "", "action")}
        ${tile(`${icon("install")}<br>${esc(t("biz_download"))}`, "", "action")}
      </div>
      <div class="hw-out" id="bizOut"></div>`}`;

  body.querySelectorAll(".biz-tasks .tile").forEach((el, i) => el.addEventListener("click", () => { work.task = WORK[i]; renderWork(body, ctx); }));
  const input = body.querySelector("#bizIn");
  input.addEventListener("input", () => { if (!(isInterview && work.chat.length)) work.input[k] = input.value; });
  const [run, dict, read, a4, a5] = body.querySelectorAll(".biz-actions .tile");
  dict.addEventListener("click", () => ctx.dictate((said) => { input.value = (input.value ? input.value + " " : "") + said; input.dispatchEvent(new Event("input")); }));

  if (isInterview && work.chat.length) {
    const log = body.querySelector(".biz-chat");
    log.querySelectorAll(".msg.assistant").forEach((el, i) => renderInto(el, work.chat.filter((m) => m.role === "assistant")[i].content));
    log.scrollTop = log.scrollHeight;
    const send = async () => {
      const text = input.value.trim();
      if (!text || work.busy) return;
      work.chat.push({ role: "user", content: text });
      await interviewTurn(body, ctx);
    };
    run.addEventListener("click", send);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
    read.addEventListener("click", () => { const last = work.chat.filter((m) => m.role === "assistant").at(-1); if (last) ctx.speak(speakable(last.content)); });
    a4.addEventListener("click", () => { work.chat = []; renderWork(body, ctx); });
    setTimeout(() => input.focus(), 50);
    return;
  }

  const o = body.querySelector("#bizOut");
  if (out) renderInto(o, out); else o.innerHTML = `<p class="muted">${esc(t("wkHint_" + k))}</p>`;
  read.addEventListener("click", () => out && ctx.speak(speakable(out)));
  a4.addEventListener("click", () => out && navigator.clipboard?.writeText(out).then(() => { a4.querySelector(".t-main").lastChild.textContent = t("biz_copied"); }));
  a5.addEventListener("click", () => out && download(`nikolai-${k}.md`, out));
  run.addEventListener("click", async () => {
    const text = input.value.trim();
    if (!text || work.busy) return;
    if (isInterview) {
      work.chat = [{ role: "user", content: t("wk_interviewStart").replace("{job}", text), hidden: true }];
      await interviewTurn(body, ctx);
      return;
    }
    work.busy = true;
    renderWork(body, ctx);
    const target = body.querySelector("#bizOut");
    target.innerHTML = `<p class="muted">${esc(t("thinking"))}</p>`;
    try {
      const { full, err } = await runCoach(ctx, k, [{ role: "user", content: text }], target);
      work.out[k] = full || ctx.errorText(err);
      if (full) save("nikolai.work", work.out);
    } catch { work.out[k] = t("errGeneric"); }
    work.busy = false;
    if (body.isConnected) renderWork(body, ctx);
  });
}

async function interviewTurn(body, ctx) {
  work.busy = true;
  work.chat.push({ role: "assistant", content: "…" });
  renderWork(body, ctx);
  const bubbles = body.querySelectorAll(".biz-chat .msg.assistant");
  const bubble = bubbles[bubbles.length - 1];
  const msgs = work.chat.slice(0, -1).map(({ role, content }) => ({ role, content }));
  try {
    const { full, err } = await runCoach(ctx, "interview", msgs, bubble);
    work.chat[work.chat.length - 1].content = full || ctx.errorText(err);
    if (full) ctx.speakIfVoice?.(speakable(full));
  } catch { work.chat[work.chat.length - 1].content = ctx.t("errGeneric"); }
  work.busy = false;
  if (body.isConnected) renderWork(body, ctx);
}

// =====================================================================
// Proyectos
// =====================================================================
const COLS = ["todo", "doing", "done"];
export const projects = { list: load("nikolai.projects", []), open: null, busy: false, out: "" };
const saveProjects = () => save("nikolai.projects", projects.list);
export const projectStats = () => {
  const all = projects.list.flatMap((p) => p.tasks);
  return { count: projects.list.length, open: all.filter((x) => x.status !== "done").length, done: all.filter((x) => x.status === "done").length };
};
const progress = (p) => (p.tasks.length ? Math.round((p.tasks.filter((x) => x.status === "done").length / p.tasks.length) * 100) : 0);
const daysLeft = (due) => (due ? Math.ceil((new Date(due + "T23:59") - Date.now()) / 864e5) : null);

export function renderProjects(body, ctx) {
  const { t, esc, tile, icon } = ctx;
  const p = projects.list.find((x) => x.id === projects.open);
  if (!p) {
    body.innerHTML = `
      <div class="proj-list">${projects.list.map((x) => {
        const d = daysLeft(x.due);
        return `<button class="proj-item" data-target data-id="${x.id}">
          <b>${esc(x.name)}</b><span class="muted">${esc(x.goal || "")}</span>
          <div class="proj-bar"><i style="width:${progress(x)}%"></i></div>
          <span class="mono">${progress(x)}% · ${x.tasks.length} ${esc(t("pj_tasks"))}${d != null ? ` · ${d >= 0 ? esc(t("pj_daysLeft").replace("{n}", d)) : esc(t("pj_late"))}` : ""}</span>
        </button>`;
      }).join("") || `<p class="muted">${esc(t("pj_empty"))}</p>`}</div>
      <div class="readout"><div class="k">${esc(t("pj_new").toUpperCase())}</div>
        <div class="biz-form">
          <input class="field" id="pjName" placeholder="${esc(t("pj_name"))}">
          <input class="field" id="pjGoal" placeholder="${esc(t("pj_goal"))}">
          <label class="mono muted">${esc(t("pj_due"))} <input class="field" id="pjDue" type="date"></label>
          ${tile(`${icon("send")}<br>${esc(t("pj_create"))}`, "", "action pj-create")}
        </div>
        <p class="muted">${esc(t("pj_hint"))}</p>
      </div>`;
    body.querySelectorAll(".proj-item").forEach((el) => el.addEventListener("click", () => { projects.open = el.dataset.id; projects.out = ""; renderProjects(body, ctx); }));
    body.querySelector(".pj-create").addEventListener("click", () => {
      const name = body.querySelector("#pjName").value.trim();
      if (!name) return body.querySelector("#pjName").focus();
      const np = { id: uid(), name, goal: body.querySelector("#pjGoal").value.trim(), due: body.querySelector("#pjDue").value, tasks: [], created: Date.now() };
      projects.list.unshift(np); saveProjects();
      projects.open = np.id; projects.out = "";
      renderProjects(body, ctx);
      ctx.onChange?.();
    });
    return;
  }

  const d = daysLeft(p.due);
  body.innerHTML = `
    <div class="proj-head">
      <button class="nw-mini" data-target data-act="back">← ${esc(t("pj_all"))}</button>
      <div><h3>${esc(p.name)}</h3><p class="muted">${esc(p.goal || "")}${d != null ? ` · ${d >= 0 ? esc(t("pj_daysLeft").replace("{n}", d)) : esc(t("pj_late"))}` : ""}</p></div>
      <div class="proj-pct mono">${progress(p)}%</div>
    </div>
    <div class="proj-bar big"><i style="width:${progress(p)}%"></i></div>
    <div class="form-row">
      <input class="field" id="pjTask" placeholder="${esc(t("pj_addTask"))}">
      ${tile(esc(t("pj_add")), "", "pj-add")}
    </div>
    <div class="kanban">${COLS.map((c) => `
      <div class="kcol ${c}"><div class="k mono">${esc(t("pj_" + c).toUpperCase())} · ${p.tasks.filter((x) => x.status === c).length}</div>
        ${p.tasks.filter((x) => x.status === c).map((x) => `
          <div class="kcard" data-id="${x.id}">
            <span>${esc(x.title)}${x.days ? ` <small class="mono muted">${x.days}d</small>` : ""}</span>
            <span class="kbtns">
              ${c !== "todo" ? `<button class="nw-mini" data-target data-mv="-1" aria-label="←">←</button>` : ""}
              ${c !== "done" ? `<button class="nw-mini" data-target data-mv="1" aria-label="→">${c === "doing" ? "✓" : "→"}</button>` : ""}
              <button class="nw-mini" data-target data-del aria-label="${esc(t("remove"))}">✕</button>
            </span>
          </div>`).join("")}
      </div>`).join("")}</div>
    <div class="tiles biz-actions">
      ${tile(`${icon("send")}<br>${esc(projects.busy === "plan" ? t("thinking") : t("pj_aiPlan"))}`, "", "action" + (projects.busy === "plan" ? " live" : ""))}
      ${tile(`${icon("core")}<br>${esc(projects.busy === "next" ? t("thinking") : t("pj_aiNext"))}`, "", "action" + (projects.busy === "next" ? " live" : ""))}
      ${tile(`${icon("chat")}<br>${esc(projects.busy === "pitch" ? t("thinking") : t("pj_aiPitch"))}`, "", "action" + (projects.busy === "pitch" ? " live" : ""))}
      ${tile(`${icon("trash")}<br>${esc(t("pj_delete"))}`, "", "action pj-del")}
    </div>
    <div class="hw-out" id="pjOut"></div>`;

  body.querySelector('[data-act="back"]').addEventListener("click", () => { projects.open = null; renderProjects(body, ctx); });
  const addInput = body.querySelector("#pjTask");
  const add = () => { const v = addInput.value.trim(); if (!v) return; p.tasks.push({ id: uid(), title: v.slice(0, 120), status: "todo" }); saveProjects(); renderProjects(body, ctx); ctx.onChange?.(); setTimeout(() => body.querySelector("#pjTask")?.focus(), 30); };
  body.querySelector(".pj-add").addEventListener("click", add);
  addInput.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
  body.querySelectorAll(".kcard").forEach((el) => {
    const task = p.tasks.find((x) => x.id === el.dataset.id);
    el.querySelectorAll("[data-mv]").forEach((b) => b.addEventListener("click", () => {
      task.status = COLS[COLS.indexOf(task.status) + Number(b.dataset.mv)];
      saveProjects(); renderProjects(body, ctx); ctx.onChange?.();
    }));
    el.querySelector("[data-del]").addEventListener("click", () => { p.tasks = p.tasks.filter((x) => x !== task); saveProjects(); renderProjects(body, ctx); ctx.onChange?.(); });
  });
  const out = body.querySelector("#pjOut");
  if (projects.out) renderInto(out, projects.out);
  const [plan, next, pitch] = body.querySelectorAll(".biz-actions .tile");
  const describe = () => `${t("pj_name")}: ${p.name}\n${t("pj_goal")}: ${p.goal || "—"}\n${t("pj_due")}: ${p.due || "—"} (${t("today")}: ${today()})\n` +
    COLS.map((c) => `${t("pj_" + c)}: ${p.tasks.filter((x) => x.status === c).map((x) => x.title).join("; ") || "—"}`).join("\n");
  const ai = async (kind) => {
    if (projects.busy) return;
    projects.busy = kind; projects.out = "";
    renderProjects(body, ctx);
    try {
      const target = body.querySelector("#pjOut");
      const { full, err } = await runCoach(ctx, kind, [{ role: "user", content: describe() }], target);
      if (kind === "plan") {
        try {
          const list = JSON.parse(full).tasks || [];
          const have = new Set(p.tasks.map((x) => x.title.toLowerCase()));
          list.filter((x) => x.title && !have.has(x.title.toLowerCase())).forEach((x) => p.tasks.push({ id: uid(), title: String(x.title).slice(0, 120), status: "todo", days: Math.max(0, Number(x.days) || 0) }));
          saveProjects();
          projects.out = t("pj_planned").replace("{n}", list.length);
        } catch { projects.out = full ? t("errGeneric") : ctx.errorText(err); }
      } else projects.out = full || ctx.errorText(err);
    } catch { projects.out = t("errGeneric"); }
    projects.busy = false;
    if (body.isConnected) renderProjects(body, ctx);
    ctx.onChange?.();
  };
  plan.addEventListener("click", () => ai("plan"));
  next.addEventListener("click", () => ai("next"));
  pitch.addEventListener("click", () => ai("pitch"));
  body.querySelector(".pj-del").addEventListener("click", () => {
    if (!confirm(t("pj_confirmDelete").replace("{name}", p.name))) return;
    projects.list = projects.list.filter((x) => x !== p); saveProjects();
    projects.open = null; renderProjects(body, ctx); ctx.onChange?.();
  });
}

// =====================================================================
// Dinero: meta del millón, presupuesto, hábitos, ideas y mentora
// =====================================================================
const MONEY_TABS = ["goal", "budget", "habits", "ideas", "coach"];
const CATS = ["home", "food", "transport", "bills", "debt", "fun", "shopping", "savings", "other"];
const NEEDS = new Set(["home", "food", "transport", "bills", "debt"]);
const DEFAULT_HABITS = ["hb_save", "hb_learn", "hb_read", "hb_project", "hb_noImpulse", "hb_exercise"];

export const money = Object.assign(
  { tab: "goal", currency: "MXN", start: 10000, monthly: 3000, rate: 10, target: 1000000, years: 20, income: 0, expenses: [], out: {}, busy: false },
  load("nikolai.money", {}),
  { busy: false },
);
export const habits = Object.assign({ list: DEFAULT_HABITS.map((k) => ({ id: k, key: k })), log: {} }, load("nikolai.habits", {}));
const saveMoney = () => { const { busy, ...rest } = money; save("nikolai.money", rest); };
const saveHabits = () => save("nikolai.habits", habits);

/** Meses para llegar a la meta con interés compuesto mensual (null si más de 100 años). */
export function monthsToGoal(start, monthly, ratePct, target) {
  const r = ratePct / 100 / 12;
  let b = start;
  for (let m = 0; m <= 1200; m++) {
    if (b >= target) return m;
    b = b * (1 + r) + monthly;
  }
  return null;
}
/** Aporte mensual necesario para llegar a la meta en N años. */
export function monthlyNeeded(start, ratePct, target, years) {
  const n = years * 12, r = ratePct / 100 / 12;
  const grown = start * (1 + r) ** n;
  if (grown >= target) return 0;
  return r ? ((target - grown) * r) / ((1 + r) ** n - 1) : (target - start) / n;
}
export function streak() {
  let n = 0;
  const d = new Date();
  if (!(habits.log[today()] || []).length) d.setDate(d.getDate() - 1); // hoy aún no cuenta
  for (;;) {
    const k = d.toISOString().slice(0, 10);
    if ((habits.log[k] || []).length >= Math.ceil(habits.list.length / 2)) { n++; d.setDate(d.getDate() - 1); } else break;
  }
  return n;
}

export function renderMoney(body, ctx) {
  const { t, esc, tile } = ctx;
  const fmt = (v) => { try { return new Intl.NumberFormat(ctx.lang, { style: "currency", currency: money.currency, maximumFractionDigits: 0 }).format(v); } catch { return Math.round(v).toLocaleString(); } };
  let html = `<div class="tabs" id="mnTabs">${MONEY_TABS.map((k) => tile(esc(t("mn_" + k)), "", money.tab === k ? "on" : "")).join("")}</div>`;
  const num = (id, label, v, step = 1) => `<label class="biz-num"><span class="mono">${esc(label)}</span><input class="field" id="${id}" type="number" inputmode="decimal" step="${step}" value="${v}"></label>`;

  if (money.tab === "goal") {
    const months = monthsToGoal(money.start, money.monthly, money.rate, money.target);
    const need = monthlyNeeded(money.start, money.rate, money.target, money.years);
    // Serie anual para la gráfica (hasta la meta o 40 años).
    const horizon = Math.min(40, months != null ? Math.ceil(months / 12) + 1 : 40);
    const pts = [];
    let b = money.start, paid = money.start;
    for (let y = 0; y <= horizon; y++) {
      pts.push([y, b, paid]);
      for (let m = 0; m < 12; m++) { b = b * (1 + money.rate / 1200) + money.monthly; paid += money.monthly; }
    }
    const max = Math.max(money.target, ...pts.map((p) => p[1])) * 1.05;
    const X = (y) => 40 + (y / horizon) * 540, Y = (v) => 190 - (v / max) * 170;
    const line = (i) => pts.map((p) => `${X(p[0]).toFixed(1)},${Y(p[i]).toFixed(1)}`).join(" ");
    const final = months != null ? pts.find((p) => p[0] * 12 >= months) || pts.at(-1) : pts.at(-1);
    html += `
      <div class="biz-form grid">
        ${num("mnStart", t("mn_start"), money.start, 100)}${num("mnMonthly", t("mn_monthly"), money.monthly, 100)}
        ${num("mnRate", t("mn_rate"), money.rate, 0.5)}${num("mnTarget", t("mn_target"), money.target, 1000)}
        <label class="biz-num"><span class="mono">${esc(t("mn_currency"))}</span><select class="field" id="mnCur">${["MXN", "USD", "EUR"].map((c) => `<option ${c === money.currency ? "selected" : ""}>${c}</option>`).join("")}</select></label>
      </div>
      <div class="grid-stats">
        <div class="readout gold"><div class="k">${esc(t("mn_reach"))}</div><div class="v">${months == null ? "100+ " + esc(t("mn_yearsU")) : `${Math.floor(months / 12)} ${esc(t("mn_yearsU"))} ${months % 12} ${esc(t("mn_monthsU"))}`}</div></div>
        <div class="readout"><div class="k">${esc(t("mn_when"))}</div><div class="v small">${months == null ? "—" : new Date(Date.now() + months * 30.44 * 864e5).toLocaleDateString(ctx.lang, { month: "long", year: "numeric" })}</div></div>
        <div class="readout"><div class="k">${esc(t("mn_youPut"))}</div><div class="v small">${fmt(money.start + money.monthly * (months ?? 480))}</div></div>
        <div class="readout"><div class="k">${esc(t("mn_interest"))}</div><div class="v small">${months == null ? "—" : fmt(Math.max(0, money.target - money.start - money.monthly * months))}</div></div>
      </div>
      <div class="readout"><div class="k">${esc(t("mn_chart"))}</div>
        <svg class="mn-chart" viewBox="0 0 600 210" role="img" aria-label="${esc(t("mn_chart"))}">
          <line x1="40" x2="580" y1="${Y(money.target)}" y2="${Y(money.target)}" class="goal"/>
          <text x="44" y="${Y(money.target) - 6}" class="lbl">${esc(t("mn_target"))} ${fmt(money.target)}</text>
          <polyline points="${line(2)}" class="paid"/><polyline points="${line(1)}" class="bal"/>
          <text x="40" y="206" class="lbl">0</text><text x="560" y="206" class="lbl">${horizon} ${esc(t("mn_yearsU"))}</text>
        </svg>
        <div class="mn-legend mono"><span class="bal">━ ${esc(t("mn_balance"))}</span><span class="paid">━ ${esc(t("mn_contrib"))}</span><span>${esc(t("mn_final"))}: ${fmt(final[1])}</span></div>
      </div>
      <div class="readout"><div class="k">${esc(t("mn_needTitle"))}</div>
        <div class="form-row">${num("mnYears", t("mn_inYears"), money.years, 1)}<div class="v">${fmt(need)} <small class="mono">/ ${esc(t("mn_month"))}</small></div></div>
      </div>
      <p class="muted">${esc(t("mn_goalNote"))}</p>`;
  } else if (money.tab === "budget") {
    const spent = money.expenses.reduce((a, e) => a + e.amount, 0);
    const needs = money.expenses.filter((e) => NEEDS.has(e.cat)).reduce((a, e) => a + e.amount, 0);
    const saving = money.expenses.filter((e) => e.cat === "savings").reduce((a, e) => a + e.amount, 0);
    const wants = spent - needs - saving;
    const left = money.income - spent;
    const pct = (v) => (money.income ? Math.round((v / money.income) * 100) : 0);
    const row = (k, v, goal) => `<div class="mn-rule"><span>${esc(t(k))}</span><div class="proj-bar"><i style="width:${Math.min(100, pct(v))}%" class="${(k === "mn_savingsG" ? pct(v) >= goal : pct(v) <= goal) ? "ok" : "over"}"></i><b style="left:${goal}%"></b></div><span class="mono">${pct(v)}% / ${goal}%</span></div>`;
    html += `
      <div class="biz-form grid">${num("mnIncome", t("mn_income"), money.income, 100)}</div>
      <div class="form-row">
        <select class="field" id="mnCat">${CATS.map((c) => `<option value="${c}">${esc(t("cat_" + c))}</option>`).join("")}</select>
        <input class="field" id="mnDesc" placeholder="${esc(t("mn_desc"))}">
        <input class="field" id="mnAmt" type="number" inputmode="decimal" placeholder="${esc(t("mn_amount"))}">
        ${tile(esc(t("pj_add")), "", "mn-add")}
      </div>
      <div class="grid-stats">
        <div class="readout"><div class="k">${esc(t("mn_spent"))}</div><div class="v small">${fmt(spent)}</div></div>
        <div class="readout ${left < 0 ? "bad" : "gold"}"><div class="k">${esc(t("mn_left"))}</div><div class="v small">${fmt(left)}</div></div>
        <div class="readout"><div class="k">${esc(t("mn_saveRate"))}</div><div class="v small">${pct(saving + Math.max(0, left))}%</div></div>
      </div>
      <div class="readout"><div class="k">${esc(t("mn_rule"))}</div>${row("mn_needs", needs, 50)}${row("mn_wants", wants, 30)}${row("mn_savingsG", saving + Math.max(0, left), 20)}</div>
      <div class="mn-exp">${money.expenses.map((e, i) => `<div class="mn-item"><span class="mono muted">${esc(t("cat_" + e.cat))}</span><span>${esc(e.desc || "")}</span><b>${fmt(e.amount)}</b><button class="nw-mini" data-target data-del="${i}">✕</button></div>`).join("") || `<p class="muted">${esc(t("mn_noExp"))}</p>`}</div>
      <div class="tiles biz-actions">${tile(`${ctx.icon("send")}<br>${esc(money.busy ? t("thinking") : t("mn_analyze"))}`, "", "action mn-ai" + (money.busy ? " live" : ""))}</div>
      <div class="hw-out" id="mnOut"></div>`;
  } else if (money.tab === "habits") {
    const done = new Set(habits.log[today()] || []);
    const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return d.toISOString().slice(0, 10); });
    html += `
      <div class="grid-stats">
        <div class="readout gold"><div class="k">${esc(t("hb_streak"))}</div><div class="v">${streak()} ${esc(t("hb_days"))}</div></div>
        <div class="readout"><div class="k">${esc(t("hb_today"))}</div><div class="v">${done.size} / ${habits.list.length}</div></div>
      </div>
      <div class="hb-list">${habits.list.map((h) => `
        <div class="hb-item ${done.has(h.id) ? "on" : ""}">
          <button class="hb-check" data-target data-hb="${h.id}">${done.has(h.id) ? "✓" : ""}</button>
          <span>${esc(h.key ? t(h.key) : h.text)}</span>
          <span class="hb-dots">${days.map((d) => `<i class="${(habits.log[d] || []).includes(h.id) ? "on" : ""}" title="${d}"></i>`).join("")}</span>
          <button class="nw-mini" data-target data-hbdel="${h.id}">✕</button>
        </div>`).join("")}</div>
      <div class="form-row"><input class="field" id="hbNew" placeholder="${esc(t("hb_new"))}">${tile(esc(t("pj_add")), "", "hb-add")}</div>
      <p class="muted">${esc(t("hb_note"))}</p>`;
  } else {
    const k = money.tab === "ideas" ? "ideas" : money.coachTask || "millionaire";
    html += money.tab === "ideas" ? `
      <div class="biz-form">
        <input class="field" id="mnSkills" placeholder="${esc(t("mn_skills"))}" value="${esc(money.skills || "")}">
        <div class="form-row">
          <input class="field" id="mnCash" placeholder="${esc(t("mn_cash"))}" value="${esc(money.cash || "")}">
          <input class="field" id="mnHours" placeholder="${esc(t("mn_hours"))}" value="${esc(money.hours || "")}">
        </div>
      </div>` : `
      <div class="tiles biz-tasks">${["millionaire", "invest", "sales", "coach"].map((x) => tile(esc(t("mc_" + x)), "", k === x ? "on" : "")).join("")}</div>
      <textarea id="mnQ" class="field" rows="3" placeholder="${esc(t("mcPh_" + k))}">${esc(money.q?.[k] || "")}</textarea>`;
    html += `
      <div class="tiles biz-actions">${tile(`${ctx.icon("send")}<br>${esc(money.busy ? t("thinking") : t(money.tab === "ideas" ? "mn_getIdeas" : "wk_make"))}`, "", "action mn-ai" + (money.busy ? " live" : ""))}${tile(`${ctx.icon("speaker")}<br>${esc(t("readAloud"))}`, "", "action mn-read")}</div>
      <div class="hw-out" id="mnOut"></div>`;
  }
  body.innerHTML = html;

  // ---- eventos ----
  body.querySelectorAll("#mnTabs .tile").forEach((el, i) => el.addEventListener("click", () => { money.tab = MONEY_TABS[i]; saveMoney(); renderMoney(body, ctx); }));
  const bindNum = (id, key) => {
    const el = body.querySelector("#" + id);
    el?.addEventListener("change", () => { money[key] = Math.max(0, Number(el.value) || 0); saveMoney(); renderMoney(body, ctx); });
  };
  [["mnStart", "start"], ["mnMonthly", "monthly"], ["mnRate", "rate"], ["mnTarget", "target"], ["mnYears", "years"], ["mnIncome", "income"]].forEach(([a, b]) => bindNum(a, b));
  body.querySelector("#mnCur")?.addEventListener("change", (e) => { money.currency = e.target.value; saveMoney(); renderMoney(body, ctx); });

  const outKey = money.tab === "coach" ? money.coachTask || "millionaire" : money.tab;
  const out = body.querySelector("#mnOut");
  if (out && money.out[outKey]) renderInto(out, money.out[outKey]);
  body.querySelector(".mn-read")?.addEventListener("click", () => money.out[outKey] && ctx.speak(speakable(money.out[outKey])));

  if (money.tab === "budget") {
    const add = () => {
      const amount = Number(body.querySelector("#mnAmt").value);
      if (!amount) return body.querySelector("#mnAmt").focus();
      money.expenses.push({ cat: body.querySelector("#mnCat").value, desc: body.querySelector("#mnDesc").value.trim().slice(0, 60), amount: Math.abs(amount) });
      saveMoney(); renderMoney(body, ctx);
    };
    body.querySelector(".mn-add").addEventListener("click", add);
    body.querySelector("#mnAmt").addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
    body.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => { money.expenses.splice(Number(b.dataset.del), 1); saveMoney(); renderMoney(body, ctx); }));
  }
  if (money.tab === "habits") {
    body.querySelectorAll("[data-hb]").forEach((b) => b.addEventListener("click", () => {
      const list = new Set(habits.log[today()] || []);
      list.has(b.dataset.hb) ? list.delete(b.dataset.hb) : list.add(b.dataset.hb);
      habits.log[today()] = [...list];
      // Solo se guardan los últimos 60 días.
      Object.keys(habits.log).sort().slice(0, -60).forEach((d) => delete habits.log[d]);
      saveHabits(); renderMoney(body, ctx); ctx.onChange?.();
    }));
    body.querySelectorAll("[data-hbdel]").forEach((b) => b.addEventListener("click", () => { habits.list = habits.list.filter((h) => h.id !== b.dataset.hbdel); saveHabits(); renderMoney(body, ctx); }));
    const addH = () => { const v = body.querySelector("#hbNew").value.trim(); if (!v) return; habits.list.push({ id: uid(), text: v.slice(0, 80) }); saveHabits(); renderMoney(body, ctx); };
    body.querySelector(".hb-add").addEventListener("click", addH);
    body.querySelector("#hbNew").addEventListener("keydown", (e) => { if (e.key === "Enter") addH(); });
  }
  if (money.tab === "coach") {
    body.querySelectorAll(".biz-tasks .tile").forEach((el, i) => el.addEventListener("click", () => { money.coachTask = ["millionaire", "invest", "sales", "coach"][i]; saveMoney(); renderMoney(body, ctx); }));
    const q = body.querySelector("#mnQ");
    q.addEventListener("input", () => { money.q = { ...(money.q || {}), [outKey]: q.value }; saveMoney(); });
  }
  if (money.tab === "ideas") {
    ["mnSkills:skills", "mnCash:cash", "mnHours:hours"].forEach((x) => { const [id, k] = x.split(":"); body.querySelector("#" + id).addEventListener("input", (e) => { money[k] = e.target.value; saveMoney(); }); });
  }
  body.querySelector(".mn-ai")?.addEventListener("click", async () => {
    if (money.busy) return;
    let task = outKey, prompt = "";
    if (money.tab === "budget") {
      task = "budget";
      prompt = `${t("mn_income")}: ${fmt(money.income)}\n` + money.expenses.map((e) => `- ${t("cat_" + e.cat)}${e.desc ? " (" + e.desc + ")" : ""}: ${fmt(e.amount)}`).join("\n");
    } else if (money.tab === "ideas") {
      prompt = `${t("mn_skills")}: ${money.skills || "—"}\n${t("mn_cash")}: ${money.cash || "—"}\n${t("mn_hours")}: ${money.hours || "—"}`;
    } else {
      prompt = (money.q?.[task] || "").trim() || t("mcPh_" + task);
      if (task === "millionaire") prompt += `\n\n${t("mn_start")}: ${fmt(money.start)} · ${t("mn_monthly")}: ${fmt(money.monthly)} · ${t("mn_income")}: ${money.income ? fmt(money.income) : "—"}`;
    }
    money.busy = true; renderMoney(body, ctx);
    try {
      const { full, err } = await runCoach(ctx, task, [{ role: "user", content: prompt }], body.querySelector("#mnOut"));
      money.out[outKey] = full || ctx.errorText(err);
    } catch { money.out[outKey] = t("errGeneric"); }
    money.busy = false; saveMoney();
    if (body.isConnected) renderMoney(body, ctx);
  });
}
