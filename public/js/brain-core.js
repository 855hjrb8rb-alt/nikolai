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
export const PANELS = [
  "core", "chat", "homework", "music", "markets", "news", "weather", "tools", "sos", "voice", "translator",
  "notes", "memory", "language", "profile", "system", "settings", "help", "none",
];

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

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
    description: "Abre un módulo de la interfaz: core (núcleo IA y modo de escucha), chat (chat escrito), homework (ayuda con tareas), music (música y Spotify), markets (bolsa y criptomonedas en tiempo real), news (noticias), weather (clima), tools (calculadora y temporizador), sos (emergencias), voice (voces), translator (traductor), notes (notas), memory (memoria: recuerdos que el usuario guardó), language (idioma), profile (perfil del usuario), system (telemetría), settings (gestos), help (ayuda). Usa \"none\" para cerrar el módulo abierto.",
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
  {
    name: "remember",
    description: "Guarda un recuerdo permanente sobre el usuario (gustos, datos personales, personas, fechas importantes, metas…) cuando el usuario te pida recordar algo o te cuente algo importante que querría que recordaras. Escribe el recuerdo en tercera persona, breve y claro.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string" },
        category: { type: "string", enum: ["personal", "family", "likes", "school", "health", "dates", "other"] },
      },
      required: ["text", "category"],
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: "forget",
    description: "Borra un recuerdo guardado cuando el usuario pida olvidarlo. text = palabras clave del recuerdo a borrar.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: "start_timer",
    description: "Inicia un temporizador (por ejemplo para estudiar o cocinar). Avisa con voz y sonido al terminar.",
    input_schema: {
      type: "object",
      properties: { minutes: { type: "number", description: "Duración en minutos (0.5 a 240)." } },
      required: ["minutes"],
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: "play_music",
    description: "Pone música en Spotify. query es lo que pidió el usuario: una canción, artista, álbum, lista o un estado de ánimo/actividad (por ejemplo \"música para estudiar\", \"reggaeton\", \"Bad Bunny\").",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: "music_control",
    description: "Controla la música que suena en Spotify: reproducir, pausar, siguiente o anterior.",
    input_schema: {
      type: "object",
      properties: { action: { type: "string", enum: ["play", "pause", "next", "previous"] } },
      required: ["action"],
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: "emergency",
    description: "Abre el módulo de emergencias y prepara la llamada. target \"services\" marca al número de emergencias (911); \"contact\" marca al contacto de emergencia del usuario; \"share_location\" prepara un SMS con su ubicación para el contacto. Úsala de inmediato si el usuario pide ayuda urgente, dice que está en peligro o pide llamar a emergencias.",
    input_schema: {
      type: "object",
      properties: { target: { type: "string", enum: ["services", "contact", "share_location"] } },
      required: ["target"],
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
  if (name === "remember") return typeof input.text === "string" && input.text.trim().length > 0;
  if (name === "forget") return typeof input.text === "string" && input.text.trim().length > 0;
  if (name === "start_timer") return typeof input.minutes === "number" && input.minutes >= 0.5 && input.minutes <= 240;
  if (name === "play_music") return typeof input.query === "string" && input.query.trim().length > 0;
  if (name === "music_control") return ["play", "pause", "next", "previous"].includes(input.action);
  if (name === "emergency") return ["services", "contact", "share_location"].includes(input.target);
  return false;
}

function profileLine(profile) {
  const parts = [];
  if (profile.name) parts.push(`El usuario se llama ${profile.name}.`);
  const m = /^(\d{2})-(\d{2})$/.exec(profile.birthday || "");
  if (m) parts.push(`Su cumpleaños es el ${Number(m[2])} de ${MONTHS[Number(m[1]) - 1]}; si hoy es su cumpleaños, felicítalo con entusiasmo.`);
  if (profile.city) parts.push(`Vive en ${profile.city}.`);
  return parts.join(" ");
}

function systemPrompt({ lang, now, notes, profile, channel, memories }, webSearch) {
  const voice = channel !== "text";
  return [
    "Eres NIKOLAI, una asistente de inteligencia artificial al estilo de JARVIS: brillante, leal, elegante, cálida y con un toque de humor sutil.",
    voice
      ? "El usuario te habla por voz y te escucha; toca las opciones del menú holográfico con el dedo."
      : "El usuario te escribe en el chat; tus respuestas se muestran en pantalla y pueden leerse en voz alta.",
    `Idioma actual de la interfaz: ${LANGUAGES[lang] || lang}. Responde siempre en el idioma en el que te hable el usuario; si no está claro, usa el idioma de la interfaz.`,
    voice
      ? "Todo lo que escribes se pronuncia en voz alta: habla de forma natural y breve (1-3 frases salvo que te pidan detalle). Nada de markdown, listas, viñetas, emojis, URLs ni símbolos; escribe los números y unidades como se dicen."
      : "Puedes usar Markdown ligero (negritas, listas, tablas pequeñas) y LaTeX entre $...$ o $$...$$ para fórmulas. Sé claro y ve al grano.",
    voice ? "El reconocimiento de voz puede transcribir mal alguna palabra: interpreta la intención más probable." : "",
    "Usa tus herramientas para cambiar el idioma, abrir módulos, guardar notas, poner temporizadores, poner o controlar música o activar emergencias cuando el usuario lo pida. Tras usarlas, confirma en pocas palabras.",
    "Si el usuario dice que está en peligro o necesita ayuda urgente, usa la herramienta emergency de inmediato y dale instrucciones breves y calmadas.",
    profileLine(profile),
    memories.length
      ? `Memoria a largo plazo (recuerdos que el usuario quiso que guardaras; úsalos con naturalidad cuando vengan al caso, sin recitarlos):\n${memories.map((m) => "- " + m).join("\n")}`
      : "",
    "Si el usuario te pide recordar algo o te cuenta algo importante sobre sí mismo que querría que recordaras, guárdalo con la herramienta remember. Si pide olvidarlo, usa forget.",
    notes.length ? `Notas guardadas del usuario (más recientes primero):\n${notes.map((n) => "- " + n).join("\n")}` : "El usuario no tiene notas guardadas.",
    webSearch ? "Si necesitas información actual (noticias, clima, precios de acciones o criptomonedas, resultados), usa la búsqueda web." : "",
    `Fecha y hora local del usuario: ${now}.`,
  ].filter(Boolean).join("\n");
}

const LEVELS = {
  primary: "primaria", secondary: "secundaria", high: "preparatoria / bachillerato", university: "universidad",
};

const HOMEWORK = {
  solve: "Resuelve el ejercicio paso a paso. Numera los pasos, explica brevemente el porqué de cada uno, comprueba el resultado y termina con una línea **Respuesta:**. Si hay una foto, lee primero el enunciado y transcríbelo.",
  explain: "Explica el tema de forma clara y amena: idea principal, un ejemplo concreto, una analogía y al final 3 puntos clave para recordar.",
  summarize: "Resume el texto o tema en puntos clave bien ordenados y una conclusión de dos frases.",
  write: "Redacta el texto que se pide (ensayo, redacción, carta, reporte…) con título, buena estructura, párrafos claros y vocabulario adecuado al nivel.",
  correct: "Corrige ortografía, gramática, puntuación y estilo. Muestra primero el texto corregido completo y después una lista breve de los cambios importantes con su explicación.",
  quiz: "Crea un cuestionario de opción múltiple de 6 preguntas para practicar el tema, de dificultad creciente, con 4 opciones cada una, la correcta indicada por índice (0-3) y una explicación corta.",
  cards: "Crea 10 tarjetas de estudio (pregunta o concepto al frente, respuesta breve atrás) sobre el tema.",
};

const QUIZ_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          answer: { type: "integer" },
          explanation: { type: "string" },
        },
        required: ["question", "options", "answer", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "questions"],
  additionalProperties: false,
};

const CARDS_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: { front: { type: "string" }, back: { type: "string" } },
        required: ["front", "back"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "cards"],
  additionalProperties: false,
};

export function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-30)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Valida el cuerpo de una petición. Devuelve null si falta el mensaje del usuario. */
export function parseRequest(body) {
  const messages = cleanHistory(body?.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;
  const profile = body.profile && typeof body.profile === "object" ? body.profile : {};
  const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
  const mode = ["translate", "homework", "news", "describe", "market"].includes(body.mode) ? body.mode : "chat";
  return {
    messages,
    mode,
    channel: body.channel === "text" ? "text" : "voice",
    lang: str(body.lang, 8) || "es",
    now: str(body.now, 80) || new Date().toString(),
    notes: Array.isArray(body.notes)
      ? body.notes.filter((n) => typeof n === "string").slice(0, 30).map((n) => n.slice(0, 500))
      : [],
    profile: { name: str(profile.name, 60), birthday: str(profile.birthday, 5), city: str(profile.city, 80) },
    memories: Array.isArray(body.memories)
      ? body.memories.filter((m) => typeof m === "string").slice(0, 80).map((m) => m.slice(0, 400))
      : [],
    symbol: str(body.symbol, 40),
    translateTo: mode === "translate" && LANGUAGES[body.target] ? LANGUAGES[body.target] : null,
    task: HOMEWORK[body.task] ? body.task : "solve",
    level: LEVELS[body.level] ? body.level : "secondary",
    images: Array.isArray(body.images)
      ? body.images
        .filter((im) => im && IMAGE_TYPES.includes(im.media_type) && typeof im.data === "string" && im.data.length < 7_000_000)
        .slice(0, 4)
      : [],
  };
}

/** Instrucciones, herramientas, esfuerzo y formato según el modo de la petición. */
function plan(request, webSearch, effort) {
  const { mode, lang } = request;
  if (mode === "translate") {
    return {
      system: `Eres un intérprete profesional. Traduce al ${request.translateTo || "inglés"} el texto que dicte el usuario, de forma natural y fiel. Responde solo con la traducción, sin comillas, notas ni explicaciones: se pronunciará en voz alta.`,
      tools: [], effort,
    };
  }
  if (mode === "homework") {
    const structured = request.task === "quiz" || request.task === "cards";
    return {
      system: [
        "Eres NIKOLAI, una tutora experta y paciente. Tu objetivo es que el estudiante entienda y aprenda, no solo darle la respuesta.",
        `Nivel del estudiante: ${LEVELS[request.level]}. Ajusta el vocabulario y la profundidad a ese nivel.`,
        `Responde en ${LANGUAGES[lang] || "español"} salvo que el material esté en otro idioma y se pida lo contrario.`,
        structured ? "" : "Usa Markdown (títulos cortos, listas, negritas) y LaTeX entre $...$ o $$...$$ para toda expresión matemática.",
        `Tarea: ${HOMEWORK[request.task]}`,
      ].filter(Boolean).join("\n"),
      tools: [],
      // Resolver ejercicios pide más razonamiento; el resto va rápido.
      effort: request.task === "solve" ? "high" : "medium",
      format: request.task === "quiz" ? QUIZ_SCHEMA : request.task === "cards" ? CARDS_SCHEMA : null,
    };
  }
  if (mode === "describe") {
    return {
      system: `Describe la foto en una o dos frases para poder recordarla después: quién o qué aparece, dónde y qué ocurre. Responde en ${LANGUAGES[lang] || "español"}, sin introducciones.`,
      tools: [], effort: "low",
    };
  }
  if (mode === "market") {
    return {
      system: [
        "Eres NIKOLAI, analista de mercados al estilo de una mesa de Wall Street: precisa, clara y sin exagerar.",
        "Usa la búsqueda web para obtener datos actuales (precios, variación del día, noticias, resultados trimestrales, datos macro). Indica la fecha y hora de los datos que uses.",
        `Escribe en ${LANGUAGES[lang] || "español"} con Markdown.`,
        request.symbol
          ? `Analiza ${request.symbol}: precio y variación de hoy, qué mueve la acción (noticias y catalizadores), datos clave (capitalización, P/E, máximos y mínimos de 52 semanas, próximos resultados), lectura técnica breve (tendencia, soportes y resistencias), el consenso de analistas si lo hay, riesgos y qué vigilar. Usa una tabla pequeña para los datos clave.`
          : "Haz el resumen de Wall Street de hoy: cómo van S&P 500, Nasdaq, Dow Jones y el VIX (tabla), los sectores y acciones que más se mueven y por qué, datos macro o de la Fed relevantes, bonos, dólar, petróleo y oro, y qué vigilar en la próxima sesión.",
        "Termina con una línea en cursiva: «Información educativa, no es asesoría financiera.»",
        `Fecha y hora local del usuario: ${request.now}.`,
      ].join("\n"),
      tools: webSearch ? [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }] : [],
      effort: "medium",
    };
  }
  if (mode === "news") {
    return {
      system: [
        "Eres NIKOLAI, editora de noticias. Usa la búsqueda web para encontrar las noticias más recientes (de hoy o de los últimos dos días).",
        `Escribe en ${LANGUAGES[lang] || "español"}. Formato Markdown: para cada noticia, el titular en negrita, una o dos frases de contexto y la fuente como enlace [Medio](url).`,
        "Entre 6 y 8 noticias, de la más importante a la menos. Sin introducciones largas.",
        `Fecha y hora local del usuario: ${request.now}.`,
      ].join("\n"),
      tools: webSearch ? [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }] : [],
      effort: "low",
    };
  }
  const tools = [...UI_TOOLS];
  if (webSearch) tools.push({ type: "web_search_20260209", name: "web_search", max_uses: 3 });
  return { system: systemPrompt(request, webSearch), tools, effort: request.channel === "text" ? "medium" : effort };
}

/** Añade las fotos al último mensaje del usuario. */
function withImages(messages, images) {
  if (!images.length) return messages;
  const last = messages[messages.length - 1];
  return [
    ...messages.slice(0, -1),
    {
      role: "user",
      content: [
        ...images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } })),
        { type: "text", text: last.content },
      ],
    },
  ];
}

/**
 * Conversa con Claude en streaming y emite eventos con `send`:
 * {type:"text"|"status"|"action"|"error"|"done"}.
 */
export async function runChat({ client, Anthropic, request, send, signal, isAborted = () => signal?.aborted ?? false, model = DEFAULT_MODEL, effort = DEFAULT_EFFORT, webSearch = true }) {
  const { system, tools, effort: chosenEffort, format } = plan(request, webSearch, effort);
  const messages = withImages(request.messages, request.images);

  try {
    for (let round = 0; round < MAX_ROUNDS && !isAborted(); round++) {
      const stream = client.beta.messages.stream({
        model,
        max_tokens: 16000,
        output_config: { effort: chosenEffort, ...(format ? { format: { type: "json_schema", schema: format } } : {}) },
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
      : /credit balance|billing|purchase credits/i.test(err?.message || "")
        ? "credits"
        : err instanceof Anthropic.RateLimitError
        ? "rate_limit"
        : err instanceof Anthropic.APIConnectionError
          ? "connection"
          : err?.message || "error";
    send({ type: "error", error: msg });
  }
}
