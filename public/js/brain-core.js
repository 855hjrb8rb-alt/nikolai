// Cerebro de NIKOLAI: instrucciones, herramientas y bucle de conversación con Claude.
// Lo comparten el servidor (server.js) y la web sin servidor (brain.js), así ambos
// se comportan igual.

export const DEFAULT_MODEL = "claude-opus-5-5";
// Esfuerzo bajo = respuestas rápidas, ideal para un asistente por voz.
export const DEFAULT_EFFORT = "low";
const MAX_ROUNDS = 6;

export const LANGUAGES = {
  es: "español", en: "English", fr: "français", pt: "português", de: "Deutsch",
  it: "italiano", ja: "日本語", zh: "中文", ko: "한국어", ru: "русский", ar: "العربية", hi: "हिन्दी",
};
export const PANELS = ["core", "language", "translator", "notes", "system", "voice", "settings", "help", "none"];

// Herramientas con las que Claude puede controlar la interfaz (las ejecuta el navegador).
export const UI_TOOLS = [
  {
    name: "set_language",
    description: "Cambia el idioma de la interfaz, del reconocimiento de voz y de la voz del asistente. Úsala cuando el usuario pida hablar en otro idioma.",
    input_schema: {
      type: "object",
      properties: { code: { type: "string", enum: Object.keys(LANGUAGES) } },
      required: ["code"],
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: "open_panel",
    description: "Abre un módulo del carrusel holográfico: core (núcleo IA y modo de escucha), language (idioma), translator (traductor por voz), notes (notas), system (telemetría del sistema), voice (elegir voz, velocidad y tono), settings (ajustes de gestos), help (protocolos: gestos y comandos). Usa \"none\" para cerrar el panel abierto.",
    input_schema: {
      type: "object",
      properties: { panel: { type: "string", enum: PANELS } },
      required: ["panel"],
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: "save_note",
    description: "Guarda una nota o recordatorio en el panel de notas del usuario.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
];

function validToolInput(name, input) {
  if (!input || typeof input !== "object") return false;
  if (name === "set_language") return typeof input.code === "string" && input.code in LANGUAGES;
  if (name === "open_panel") return PANELS.includes(input.panel);
  if (name === "save_note") return typeof input.text === "string" && input.text.trim().length > 0;
  return false;
}

function systemPrompt(lang, now, notes, webSearch) {
  return [
    "Eres NIKOLAI, un asistente de inteligencia artificial al estilo de JARVIS: brillante, leal, elegante y con un toque de humor británico sutil.",
    "La interfaz es solo de voz y gestos: el usuario te habla y te escucha, no lee ni escribe. Toca las opciones del menú holográfico con el dedo.",
    `Idioma actual de la interfaz: ${LANGUAGES[lang] || lang}. Responde siempre en el idioma en el que te hable el usuario; si no está claro, usa el idioma de la interfaz.`,
    "Todo lo que escribes se pronuncia en voz alta: habla de forma natural y breve (1-3 frases salvo que te pidan detalle). Nada de markdown, listas, viñetas, emojis, URLs ni símbolos; escribe los números y unidades como se dicen.",
    "El reconocimiento de voz puede transcribir mal alguna palabra: interpreta la intención más probable.",
    "Usa tus herramientas para cambiar el idioma, abrir o cerrar paneles y guardar notas cuando el usuario lo pida. Tras usarlas, confirma en pocas palabras.",
    notes.length ? `Notas guardadas del usuario (más recientes primero):\n${notes.map((n) => "- " + n).join("\n")}` : "El usuario no tiene notas guardadas.",
    webSearch ? "Si necesitas información actual (noticias, clima, precios, resultados), usa la búsqueda web." : "",
    `Fecha y hora local del usuario: ${now}.`,
  ].filter(Boolean).join("\n");
}

export function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-30)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
}

/** Valida el cuerpo de una petición. Devuelve null si falta el mensaje del usuario. */
export function parseRequest(body) {
  const messages = cleanHistory(body?.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;
  return {
    messages,
    lang: typeof body.lang === "string" ? body.lang : "es",
    now: typeof body.now === "string" ? body.now.slice(0, 80) : new Date().toString(),
    notes: Array.isArray(body.notes)
      ? body.notes.filter((n) => typeof n === "string").slice(0, 30).map((n) => n.slice(0, 500))
      : [],
    translateTo: body.mode === "translate" && LANGUAGES[body.target] ? LANGUAGES[body.target] : null,
  };
}

/**
 * Conversa con Claude en streaming y emite eventos con `send`:
 * {type:"text"|"status"|"action"|"error"|"done"}.
 */
export async function runChat({ client, Anthropic, request, send, signal, isAborted = () => signal?.aborted ?? false, model = DEFAULT_MODEL, effort = DEFAULT_EFFORT, webSearch = true }) {
  const { messages, lang, now, notes, translateTo } = request;
  // En modo traductor no hay herramientas: solo se devuelve la traducción.
  const tools = translateTo ? [] : [...UI_TOOLS];
  if (webSearch && !translateTo) tools.push({ type: "web_search_20260209", name: "web_search", max_uses: 3 });
  const system = translateTo
    ? `Eres un intérprete profesional. Traduce al ${translateTo} el texto que dicte el usuario, de forma natural y fiel. Responde solo con la traducción, sin comillas, notas ni explicaciones: se pronunciará en voz alta.`
    : systemPrompt(lang, now, notes, webSearch);

  try {
    for (let round = 0; round < MAX_ROUNDS && !isAborted(); round++) {
      const stream = client.beta.messages.stream({
        model,
        max_tokens: 16000,
        output_config: { effort },
        system,
        ...(tools.length ? { tools } : {}),
        messages,
        // Si un filtro de seguridad rechaza la petición, la API reintenta con otro modelo.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      }, signal ? { signal } : undefined);

      for await (const event of stream) {
        if (isAborted()) { stream.abort(); return; }
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          send({ type: "text", text: event.delta.text });
        } else if (event.type === "content_block_start" && event.content_block.type === "server_tool_use") {
          send({ type: "status", status: "searching" });
        }
      }

      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") {
        send({ type: "error", error: "refusal" });
        break;
      }
      if (final.stop_reason === "pause_turn") {
        // Búsqueda web larga: se continúa el mismo turno.
        messages.push({ role: "assistant", content: final.content });
        continue;
      }
      if (final.stop_reason !== "tool_use") break;

      messages.push({ role: "assistant", content: final.content });
      const results = [];
      for (const block of final.content) {
        if (block.type !== "tool_use") continue;
        if (validToolInput(block.name, block.input)) {
          send({ type: "action", name: block.name, input: block.input });
          results.push({ type: "tool_result", tool_use_id: block.id, content: "Hecho." });
        } else {
          results.push({ type: "tool_result", tool_use_id: block.id, content: "INVALID_INPUT: revisa los parámetros.", is_error: true });
        }
      }
      messages.push({ role: "user", content: results });
    }
    send({ type: "done" });
  } catch (err) {
    if (isAborted()) return;
    console.error("[chat]", err);
    const msg = err instanceof Anthropic.AuthenticationError || /authentication|api[ -]?key|x-api-key/i.test(err?.message || "")
      ? "auth"
      : err instanceof Anthropic.RateLimitError
        ? "rate_limit"
        : err instanceof Anthropic.APIConnectionError
          ? "connection"
          : err?.message || "error";
    send({ type: "error", error: msg });
  }
}
