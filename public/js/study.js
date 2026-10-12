// Módulo de Tareas: resolver paso a paso, explicar, resumir, redactar, corregir,
// cuestionarios interactivos y tarjetas de estudio. Admite fotos del ejercicio.

import { renderInto, speakable } from "./md.js";

const TASKS = ["solve", "explain", "summarize", "write", "correct", "quiz", "cards"];
const LEVELS = ["primary", "secondary", "high", "university"];

export const study = {
  task: "solve",
  level: "secondary",
  text: "",
  images: [],      // [{media_type, data, url}]
  result: "",      // Markdown de la última respuesta
  quiz: null,      // {title, questions, answers: []}
  cards: null,     // {title, cards, index, flipped}
  busy: false,
  done: 0,
};

/** Reduce una foto a un tamaño razonable y la convierte a base64 (JPEG). */
async function fileToImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { media_type: "image/jpeg", data: url.split(",")[1], url };
}

/**
 * ctx = { t, esc, tile, icon, stream, speak, dictate, errorText, onDone }
 */
export function renderHomework(body, ctx) {
  const { t, esc, tile, icon } = ctx;
  const s = study;
  body.innerHTML = `
    <div class="tiles hw-tasks">${TASKS.map((k) => tile(esc(t("hw_" + k)), "", s.task === k ? "on" : "")).join("")}</div>
    <div class="tiles hw-levels">${LEVELS.map((k) => tile(esc(t("lv_" + k)), esc(t("level").toUpperCase()), s.level === k ? "on" : "")).join("")}</div>
    <textarea id="hwText" class="field" rows="4" placeholder="${esc(t("hw_placeholder"))}">${esc(s.text)}</textarea>
    <div class="hw-photos">${s.images.map((im, i) => `<div class="hw-photo"><img src="${im.url}" alt=""><button class="tile" data-target data-del="${i}" aria-label="${esc(t("remove"))}">${icon("trash")}</button></div>`).join("")}</div>
    <div class="tiles hw-actions">
      ${tile(`${icon("send")}<br>${esc(s.busy ? t("thinking") : t("hw_run"))}`, "", "action" + (s.busy ? " live" : ""))}
      ${tile(`${icon("mic")}<br>${esc(t("hw_dictate"))}`, "", "action")}
      ${tile(`${icon("camera")}<br>${esc(t("hw_photo"))}`, "", "action")}
      ${tile(`${icon("speaker")}<br>${esc(t("readAloud"))}`, "", "action")}
    </div>
    <input type="file" id="hwFile" accept="image/*" capture="environment" hidden multiple>
    <div class="hw-out" id="hwOut"></div>`;

  const text = body.querySelector("#hwText");
  text.addEventListener("input", () => { s.text = text.value; });
  body.querySelectorAll(".hw-tasks .tile").forEach((el, i) => el.addEventListener("click", () => { s.task = TASKS[i]; renderHomework(body, ctx); }));
  body.querySelectorAll(".hw-levels .tile").forEach((el, i) => el.addEventListener("click", () => { s.level = LEVELS[i]; ctx.onLevel?.(s.level); renderHomework(body, ctx); }));
  body.querySelectorAll("[data-del]").forEach((el) => el.addEventListener("click", () => { s.images.splice(Number(el.dataset.del), 1); renderHomework(body, ctx); }));

  const [run, dictate, photo, read] = body.querySelectorAll(".hw-actions .tile");
  run.addEventListener("click", () => submit(body, ctx));
  dictate.addEventListener("click", () => ctx.dictate((said) => {
    s.text = (s.text ? s.text + " " : "") + said;
    renderHomework(body, ctx);
  }));
  const file = body.querySelector("#hwFile");
  photo.addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    for (const f of [...file.files].slice(0, 4 - s.images.length)) {
      try { s.images.push(await fileToImage(f)); } catch { /* imagen no válida */ }
    }
    renderHomework(body, ctx);
  });
  read.addEventListener("click", () => {
    const txt = s.quiz ? s.quiz.questions.map((q) => q.question).join(". ") : s.cards ? s.cards.cards.map((c) => c.front).join(". ") : speakable(s.result);
    if (txt) ctx.speak(txt);
  });

  drawResult(body.querySelector("#hwOut"), ctx);
}

async function submit(body, ctx) {
  const s = study;
  if (s.busy) return;
  const prompt = s.text.trim() || (s.images.length ? ctx.t("hw_fromPhoto") : "");
  if (!prompt) { body.querySelector("#hwText")?.focus(); return; }
  s.busy = true;
  s.result = "";
  s.quiz = null;
  s.cards = null;
  renderHomework(body, ctx);
  const out = body.querySelector("#hwOut");
  let full = "", pending = false;
  try {
    const err = await ctx.stream(
      {
        messages: [{ role: "user", content: prompt }],
        mode: "homework", channel: "text", task: s.task, level: s.level,
        images: s.images.map(({ media_type, data }) => ({ media_type, data })),
      },
      {
        onText: (d) => {
          full += d;
          if (s.task === "quiz" || s.task === "cards") return; // JSON: se muestra al final
          s.result = full;
          if (!pending) {
            pending = true;
            requestAnimationFrame(() => { pending = false; if (out.isConnected) renderInto(out, full); });
          }
        },
      },
    );
    if (err && !full) s.result = ctx.errorText(err);
    else if (s.task === "quiz" || s.task === "cards") {
      try {
        const data = JSON.parse(full);
        if (s.task === "quiz") s.quiz = { ...data, answers: [] };
        else s.cards = { ...data, index: 0, flipped: false };
      } catch {
        s.result = ctx.t("errGeneric");
      }
    } else s.result = full;
    if (!err) { s.done++; ctx.onDone?.(); }
  } catch {
    s.result = ctx.t("errGeneric");
  } finally {
    s.busy = false;
    if (body.isConnected) renderHomework(body, ctx);
  }
}

function drawResult(out, ctx) {
  const { t, esc, tile } = ctx;
  const s = study;
  if (s.quiz) {
    const q = s.quiz;
    const score = q.answers.filter((a, i) => a === q.questions[i].answer).length;
    out.innerHTML = `<h3 class="hw-title">${esc(q.title)}</h3>` + q.questions.map((qq, i) => {
      const chosen = q.answers[i];
      return `<div class="quiz-q"><p><b>${i + 1}.</b> ${esc(qq.question)}</p><div class="tiles">${qq.options.map((o, j) => {
        const cls = chosen == null ? "" : j === qq.answer ? "ok" : j === chosen ? "bad" : "";
        return `<button class="tile ${cls}" data-target data-q="${i}" data-o="${j}"><span class="t-main">${esc(o)}</span></button>`;
      }).join("")}</div>${chosen != null ? `<p class="muted">${esc(qq.explanation)}</p>` : ""}</div>`;
    }).join("") + `<p class="quiz-score mono">${esc(t("score").toUpperCase())} · ${score} / ${q.questions.length}</p>`;
    out.querySelectorAll("[data-q]").forEach((el) => el.addEventListener("click", () => {
      const i = Number(el.dataset.q);
      if (q.answers[i] != null) return;
      q.answers[i] = Number(el.dataset.o);
      drawResult(out, ctx);
    }));
    return;
  }
  if (s.cards) {
    const c = s.cards;
    const card = c.cards[c.index];
    out.innerHTML = `<h3 class="hw-title">${esc(c.title)}</h3>
      <button class="flashcard ${c.flipped ? "flipped" : ""}" data-target>
        <span class="fc-side mono">${c.flipped ? esc(t("answer").toUpperCase()) : esc(t("question").toUpperCase())} · ${c.index + 1}/${c.cards.length}</span>
        <span class="fc-text">${esc(c.flipped ? card.back : card.front)}</span>
        <span class="fc-hint mono">${esc(t("flip"))}</span>
      </button>
      <div class="tiles">${tile("‹ " + esc(t("prev")))}${tile(esc(t("next")) + " ›")}</div>`;
    out.querySelector(".flashcard").addEventListener("click", () => { c.flipped = !c.flipped; drawResult(out, ctx); });
    const [prev, next] = out.querySelectorAll(".tiles .tile");
    prev.addEventListener("click", () => { c.index = (c.index - 1 + c.cards.length) % c.cards.length; c.flipped = false; drawResult(out, ctx); });
    next.addEventListener("click", () => { c.index = (c.index + 1) % c.cards.length; c.flipped = false; drawResult(out, ctx); });
    return;
  }
  if (s.result) renderInto(out, s.result);
  else out.innerHTML = s.busy ? `<p class="muted">${esc(t("thinking"))}…</p>` : `<p class="muted">${esc(t("hw_hint"))}</p>`;
}
