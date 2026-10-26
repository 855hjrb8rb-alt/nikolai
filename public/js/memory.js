// Memoria a largo plazo: recuerdos que el usuario decide guardar (texto, categoría,
// fecha y foto opcionales). Viven solo en este navegador; se pueden exportar e importar.

const KEY = "nikolai.memories";
export const CATEGORIES = ["personal", "family", "likes", "school", "health", "dates", "other"];

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

export const memory = {
  items: load(),        // [{id, text, category, date, photo, desc, at}]
  enabled: (() => { try { return localStorage.getItem("nikolai.memoryOn") !== "0"; } catch { return true; } })(),
  draft: { text: "", category: "personal", date: "", photo: "" },
  filter: "",
  error: "",
};

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory.items));
    memory.error = "";
    return true;
  } catch {
    memory.error = "full";
    return false;
  }
}

export function setEnabled(on) {
  memory.enabled = on;
  try { localStorage.setItem("nikolai.memoryOn", on ? "1" : "0"); } catch { /* bloqueado */ }
}

export function addMemory({ text, category = "other", date = "", photo = "", desc = "" }) {
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text: String(text || "").trim().slice(0, 600),
    category: CATEGORIES.includes(category) ? category : "other",
    date, photo, desc, at: Date.now(),
  };
  if (!item.text && !item.photo) return null;
  memory.items.unshift(item);
  if (!save()) { memory.items.shift(); return null; }
  return item;
}

export function updateMemory(id, patch) {
  const it = memory.items.find((m) => m.id === id);
  if (!it) return;
  Object.assign(it, patch);
  save();
}

export function deleteMemory(id) {
  memory.items = memory.items.filter((m) => m.id !== id);
  save();
}

/** Borra el recuerdo que mejor coincide con las palabras dadas. Devuelve el borrado o null. */
export function forgetMatching(words) {
  const terms = String(words).toLowerCase().split(/\W+/u).filter((w) => w.length > 2);
  let best = null, score = 0;
  for (const m of memory.items) {
    const hay = `${m.text} ${m.desc}`.toLowerCase();
    const s = terms.filter((w) => hay.includes(w)).length;
    if (s > score) { score = s; best = m; }
  }
  if (best && score >= Math.min(2, terms.length)) { deleteMemory(best.id); return best; }
  return null;
}

/** Los recuerdos como frases para el cerebro (solo si la memoria está activada). */
export function memoriesForBrain(t) {
  if (!memory.enabled) return [];
  return memory.items.slice(0, 80).map((m) => {
    const parts = [`[${t("mem_" + m.category)}]`, m.text];
    if (m.date) parts.push(`(${t("memDate").toLowerCase()}: ${m.date})`);
    if (m.desc) parts.push(`— ${t("memPhoto").toLowerCase()}: ${m.desc}`);
    return parts.filter(Boolean).join(" ");
  });
}

/** Foto pequeña (JPEG ~480 px) para no llenar el almacenamiento del navegador. */
export async function photoToDataUrl(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * scale);
  c.height = Math.round(bitmap.height * scale);
  c.getContext("2d").drawImage(bitmap, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.72);
}

export function exportJson() {
  const blob = new Blob([JSON.stringify({ app: "nikolai", version: 1, memories: memory.items }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nikolai-recuerdos-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export async function importJson(file) {
  const data = JSON.parse(await file.text());
  const list = Array.isArray(data) ? data : data.memories;
  if (!Array.isArray(list)) throw new Error("bad file");
  const known = new Set(memory.items.map((m) => m.id));
  let added = 0;
  for (const m of list) {
    if (!m || (typeof m.text !== "string" && typeof m.photo !== "string") || known.has(m.id)) continue;
    memory.items.push({
      id: m.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: String(m.text || "").slice(0, 600), category: CATEGORIES.includes(m.category) ? m.category : "other",
      date: typeof m.date === "string" ? m.date : "", photo: typeof m.photo === "string" && m.photo.startsWith("data:image/") ? m.photo : "",
      desc: typeof m.desc === "string" ? m.desc.slice(0, 400) : "", at: Number(m.at) || Date.now(),
    });
    added++;
  }
  memory.items.sort((a, b) => b.at - a.at);
  save();
  return added;
}

/**
 * ctx = { t, esc, tile, icon, dictate, describe(photoDataUrl) -> Promise<string>, onChange }
 */
export function renderMemory(body, ctx) {
  const { t, esc, tile, icon } = ctx;
  const d = memory.draft;
  const q = memory.filter.toLowerCase();
  const list = memory.items.filter((m) => !q || `${m.text} ${m.desc} ${t("mem_" + m.category)}`.toLowerCase().includes(q));
  body.innerHTML = `
    <div class="readout mem-add">
      <div class="k">${esc(t("memNew").toUpperCase())}</div>
      <textarea class="field mem-text" id="memText" rows="4" placeholder="${esc(t("memPlaceholder"))}">${esc(d.text)}</textarea>
      <div class="mem-catrow"><span class="mem-catlabel">${esc(t("memCatLabel"))}</span>
        <div class="tiles mem-cats">${CATEGORIES.map((c) => tile(esc(t("mem_" + c)), "", d.category === c ? "on" : "")).join("")}</div></div>
      <div class="mem-row">
        <label class="mem-date">${esc(t("memDate"))}<input class="field" type="date" id="memDate" value="${esc(d.date)}"></label>
        ${d.photo ? `<div class="mem-thumb"><img src="${d.photo}" alt=""><button class="tile" data-target id="memNoPhoto" aria-label="${esc(t("remove"))}">${icon("trash")}</button></div>` : ""}
      </div>
      <button class="tile action mem-save" data-target id="memSaveBtn"><span class="t-main">${icon("send")} ${esc(t("memSaveBtn"))}</span></button>
      <div class="tiles mem-actions2">
        ${tile(`${icon("mic")} ${esc(t("hw_dictate"))}`, "", "")}
        ${tile(`${icon("camera")} ${esc(t("memPhoto"))}`, "", "")}
      </div>
      <input type="file" id="memFile" accept="image/*" hidden>
      <input type="file" id="memImportFile" accept="application/json,.json" hidden>
      <p class="mem-ok ${memory._justSaved ? "show" : ""}">${esc(t("memSaved"))}</p>
      ${memory.error ? `<p class="notice-err">${esc(t(memory.error === "full" ? "memFull" : "memImportError"))}</p>` : ""}
    </div>

    <div class="tiles mem-top">
      ${tile(esc(memory.enabled ? t("memOn") : t("memOff")), esc(t("memory").toUpperCase()), memory.enabled ? "on" : "")}
      ${tile(`${icon("install")}<br>${esc(t("memExport"))}`, "", "")}
      ${tile(`${icon("send")}<br>${esc(t("memImport"))}`, "", "")}
    </div>
    <p class="muted">${esc(memory.enabled ? t("memExplainOn") : t("memExplainOff"))}</p>

    <div class="form-row two">
      <input class="field" id="memSearch" placeholder="${esc(t("memSearch"))}" value="${esc(memory.filter)}">
      ${tile(esc(String(memory.items.length)), esc(t("memCount").toUpperCase()), "")}
    </div>
    <div class="mem-list">${list.length ? list.map((m) => `
      <article class="mem-item">
        ${m.photo ? `<img src="${m.photo}" alt="">` : ""}
        <div class="mem-body">
          <span class="mem-cat mono">${esc(t("mem_" + m.category).toUpperCase())}${m.date ? " · " + esc(m.date) : ""}</span>
          ${m.text ? `<p>${esc(m.text)}</p>` : ""}
          ${m.desc ? `<p class="muted">${esc(m.desc)}</p>` : ""}
        </div>
        <button class="tile" data-target data-del="${m.id}" aria-label="${esc(t("remove"))}">${icon("trash")}</button>
      </article>`).join("") : `<p class="muted">${esc(t("memEmpty"))}</p>`}</div>`;

  const rerender = () => renderMemory(body, ctx);
  const text = body.querySelector("#memText");
  text.addEventListener("input", () => { d.text = text.value; });
  body.querySelector("#memDate").addEventListener("change", (e) => { d.date = e.target.value; });

  const [toggle, exp, imp] = body.querySelectorAll(".mem-top .tile");
  toggle.addEventListener("click", () => { setEnabled(!memory.enabled); rerender(); ctx.onChange?.(); });
  exp.addEventListener("click", exportJson);
  const importFile = body.querySelector("#memImportFile");
  imp.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async () => {
    try { await importJson(importFile.files[0]); memory.error = ""; } catch { memory.error = "import"; }
    rerender();
    ctx.onChange?.();
  });

  // Elegir categoría SIN recargar el panel (así no se cierra el teclado del móvil al escribir).
  body.querySelectorAll(".mem-cats .tile").forEach((el, i) => el.addEventListener("click", () => {
    d.text = text.value; d.category = CATEGORIES[i];
    body.querySelectorAll(".mem-cats .tile").forEach((x, j) => x.classList.toggle("on", j === i));
  }));
  const [dictate, photo] = body.querySelectorAll(".mem-actions2 .tile");
  dictate.addEventListener("click", () => { d.text = text.value; ctx.dictate?.((said) => { d.text = (d.text ? d.text + " " : "") + said; rerender(); }); });
  const file = body.querySelector("#memFile");
  photo.addEventListener("click", () => { d.text = text.value; file.click(); });
  file.addEventListener("change", async () => {
    try { d.photo = await photoToDataUrl(file.files[0]); } catch { /* imagen no válida */ }
    rerender();
  });
  body.querySelector("#memNoPhoto")?.addEventListener("click", () => { d.photo = ""; rerender(); });
  const saveBtn = body.querySelector("#memSaveBtn");
  saveBtn.addEventListener("click", async () => {
    d.text = text.value; // toma lo escrito ahora mismo
    const item = addMemory({ text: d.text, category: d.category, date: d.date, photo: d.photo });
    if (!item) { rerender(); return; }
    memory.draft = { text: "", category: d.category, date: "", photo: "" };
    memory._justSaved = true;
    rerender();
    setTimeout(() => { memory._justSaved = false; const ok = body.querySelector(".mem-ok"); ok?.classList.remove("show"); }, 2200);
    ctx.onChange?.();
    // Con foto: NIKOLAI la describe una vez para poder recordarla en las conversaciones.
    if (item.photo && ctx.describe) {
      try {
        const desc = await ctx.describe(item.photo);
        if (desc) { updateMemory(item.id, { desc }); if (body.isConnected) rerender(); }
      } catch { /* sin descripción */ }
    }
  });

  const search = body.querySelector("#memSearch");
  search.addEventListener("input", () => {
    memory.filter = search.value;
    const pos = search.selectionStart;
    rerender();
    const s2 = body.querySelector("#memSearch");
    s2.focus();
    s2.setSelectionRange(pos, pos);
  });
  body.querySelectorAll("[data-del]").forEach((el) => el.addEventListener("click", () => { deleteMemory(el.dataset.del); rerender(); ctx.onChange?.(); }));
}
