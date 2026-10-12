// Markdown ligero y seguro (se escapa todo el HTML) + fórmulas con KaTeX.

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

/** Convierte Markdown a HTML seguro. Las fórmulas $...$ se dejan para KaTeX. */
export function md(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const out = [];
  let list = null, code = null, table = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const closeTable = () => {
    if (!table) return;
    const [head, ...rows] = table.filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r));
    const cells = (r) => r.replace(/^\s*\||\|\s*$/g, "").split("|");
    out.push(`<div class="md-table"><table><thead><tr>${cells(head).map((c) => `<th>${inline(c.trim())}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c.trim())}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
    table = null;
  };
  for (const line of lines) {
    if (code !== null) {
      if (/^```/.test(line)) { out.push(`<pre><code>${esc(code)}</code></pre>`); code = null; }
      else code += (code ? "\n" : "") + line;
      continue;
    }
    if (/^```/.test(line)) { closeList(); closeTable(); code = ""; continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) { closeList(); (table ??= []).push(line); continue; }
    closeTable();
    let m;
    if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) { closeList(); out.push(`<h${m[1].length + 2}>${inline(m[2])}</h${m[1].length + 2}>`); }
    else if ((m = /^\s*[-*•]\s+(.*)$/.exec(line))) { if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) { if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(m[1])}</li>`); }
    else if (/^\s*$/.test(line)) { closeList(); }
    else { closeList(); out.push(`<p>${inline(line)}</p>`); }
  }
  if (code !== null) out.push(`<pre><code>${esc(code)}</code></pre>`);
  closeList();
  closeTable();
  return out.join("");
}

// ---------- KaTeX (se carga solo cuando hace falta) ----------
const KATEX = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist";
let katexReady = null;

function loadKatex() {
  katexReady ??= new Promise((resolve) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${KATEX}/katex.min.css`;
    document.head.appendChild(css);
    const s1 = document.createElement("script");
    s1.src = `${KATEX}/katex.min.js`;
    s1.onload = () => {
      const s2 = document.createElement("script");
      s2.src = `${KATEX}/contrib/auto-render.min.js`;
      s2.onload = () => resolve(true);
      s2.onerror = () => resolve(false);
      document.head.appendChild(s2);
    };
    s1.onerror = () => resolve(false);
    document.head.appendChild(s1);
  });
  return katexReady;
}

/** Pinta el Markdown en `el` y renderiza las fórmulas si las hay. */
export async function renderInto(el, text) {
  el.innerHTML = md(text);
  if (!/\$|\\\(|\\\[/.test(text)) return;
  if (!(await loadKatex()) || !window.renderMathInElement) return;
  window.renderMathInElement(el, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false },
    ],
    throwOnError: false,
  });
}

/** Texto apto para leer en voz alta: sin Markdown, código, fórmulas crudas ni enlaces. */
export function speakable(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\$([^$]+)\$/g, (_, f) => f.replace(/\\[a-z]+/gi, " ").replace(/[{}^_]/g, " "))
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^\s*\|.*\|\s*$/gm, " ")
    .replace(/[*_#`>|~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
