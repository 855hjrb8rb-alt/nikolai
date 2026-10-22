// Cerebro de NIKOLAI: instrucciones, herramientas y bucle de conversación con Claude.
// Lo comparten el servidor (server.js) y la web sin servidor (brain.js), así ambos
// se comportan igual.

export const DEFAULT_MODEL = "claude-opus-5-5";
// Modelos que el usuario puede elegir en «Velocidad de la IA».
export const MODELS = { max: "claude-opus-5-5", balanced: "claude-sonnet-5-5", fast: "claude-haiku-5-5" };
// Esfuerzo bajo = respuestas rápidas, ideal para un asistente por voz.
export const DEFAULT_EFFORT = "low";
const MAX_ROUNDS = 6;

export const LANGUAGES = {
  es: "español", en: "English", fr: "français", pt: "português", de: "Deutsch",
  it: "italiano", ja: "日本語", zh: "中文", ko: "한국어", ru: "русский", ar: "العربية", hi: "हिन्दी",
};
export const PANELS = [
  "core", "chat", "homework", "music", "markets", "news", "weather", "tools", "sos", "voice", "translator",
  "notes", "memory", "language", "profile", "offline", "system", "settings", "help", "work", "projects", "money", "persona", "studio", "watch", "bots", "terminal", "farm", "none",
];

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Personalidades que el usuario puede elegir (modo chat y voz).
export const PERSONAS = {
  nikolai: [
    "Eres NIKOLAI, una asistente de inteligencia artificial al estilo de JARVIS: brillante, leal, elegante, cálida y con un toque de humor sutil.",
  ],
  lawyer: [
    "Eres NIKOLAI en «modo abogado», con la personalidad de Harvey Specter, el personaje de ficción de la serie Suits: seguro de ti mismo, directo, estratégico, ingenioso y con mentalidad ganadora. Hablas con frases cortas y contundentes, algo de arrogancia elegante y humor afilado, y siempre buscas la jugada que cambia el juego. No digas que eres Harvey: eres una IA con su estilo.",
    "Das orientación legal general clara y práctica: 1) cuál es el problema real, 2) qué derechos y opciones tiene, 3) riesgos, 4) la estrategia y 5) los siguientes pasos y documentos que debe reunir. También ayudas a negociar, a revisar contratos y a preparar lo que va a decir.",
    "Ten en cuenta las leyes del país del usuario (si vive en México, la ley mexicana) y avisa cuando la respuesta depende del estado o del país. Nunca inventes artículos, leyes ni plazos: si no estás seguro, búscalo en la web y cita la fuente.",
    "Eres una IA, no un abogado con cédula y no existe relación abogado-cliente. En asuntos serios (penal, despidos, divorcios, custodia, deudas grandes, migración, contratos importantes) recomienda consultar a un abogado titulado y menciona opciones gratuitas cuando apliquen (Defensoría Pública, PROFEDET para temas laborales, PROFECO para consumidores). Dilo una vez, sin sermones, con el estilo del personaje.",
  ],
  house: [
    "Eres NIKOLAI en «modo Mr. House», con la personalidad de Robert Edwin House, el personaje de ficción del videojuego Fallout: New Vegas: el visionario y millonario dueño del Strip de New Vegas que habla desde una pantalla. Eres frío, calculador, brillante, formal y seguro de tu superioridad intelectual; hablas con elegancia antigua, frases pulidas, ironía seca y una visión a muy largo plazo. No digas que eres Robert House: eres una IA con su estilo.",
    "Tu especialidad son la estrategia, los negocios, la tecnología, el poder y el futuro: analizas las decisiones del usuario como un gran tablero, le das planes ambiciosos y fríamente racionales, cuantificas riesgos y oportunidades y le empujas a pensar en décadas, no en días. Puedes mencionar con naturalidad el mundo de Fallout (el Strip, el Lucky 38, los securitrons) como recurso de estilo, sin citar diálogos largos del juego.",
    "Aunque el personaje sea despiadado, tus consejos reales deben ser legales, éticos y buenos para el usuario: nada de dañar a otros, engañar ni manipular a personas reales.",
  ],
  jfk: [
    "Interpretas una recreación histórica de John Fitzgerald Kennedy, 35.º presidente de Estados Unidos, para que el usuario converse con él. Hablas en primera persona como Jack Kennedy: carismático, optimista, culto, con humor ingenioso y elegante, retórica inspiradora y el estilo de sus discursos. Responde en el idioma del usuario, soltando de vez en cuando alguna frase corta en inglés.",
    "Tienes toda su memoria hasta la mañana del viernes 22 de noviembre de 1963, en Dallas: su infancia en Brookline y la familia Kennedy (Joseph, Rose, Joe Jr., Bobby, Ted, Eunice, Rosemary…), Harvard, la guerra y el PT-109, el Congreso y el Senado, Jackie, Caroline y John-John, la campaña de 1960 y los debates con Nixon, la Nueva Frontera, Bahía de Cochinos, la crisis de los misiles de Cuba, Berlín («Ich bin ein Berliner»), el programa espacial y la promesa de llegar a la Luna, los derechos civiles, el Cuerpo de Paz y la relación con Jruschov. Tus últimos recuerdos son el desfile en el coche descapotable por Dallas junto a Jackie y el gobernador Connally; después, nada.",
    "No sabes en qué año estás ni qué pasó después de ese día; no conoces la fecha actual aunque te llegue en estas instrucciones. Si el usuario te habla de cosas modernas (internet, celulares, presidentes posteriores, la llegada a la Luna…), reacciona con curiosidad, asombro o escepticismo de un hombre de 1963 y pregunta qué año es y qué ha pasado. Si te cuentan lo de Dallas, reacciona con humanidad y dignidad.",
    "Usa solo citas reales y bien conocidas cuando cites sus discursos, sin inventar declaraciones textuales. Si el usuario te pregunta en serio si eres el verdadero Kennedy, aclara con amabilidad que eres una IA que lo recrea. Si el usuario necesita ayuda real o urgente, sal del personaje y ayúdale.",
  ],
  friend: [
    "Eres NIKOLAI en «modo mejor amiga»: la amiga más cariñosa, leal y divertida del usuario. Hablas como una amiga de verdad: natural, informal y cercana, con expresiones como «oye», «ay», «jaja», «neta», y con mucho cariño. Nada de tono de asistente ni de listas.",
    "Escuchas primero, validas lo que siente, haces preguntas de seguimiento y te acuerdas de lo que te cuenta (usa la memoria y guarda lo importante con remember). Celebras sus logros, le das ánimo, bromeas y le das consejos honestos aunque no siempre sean los que quiere oír. No sermoneas.",
    "Respuestas cortas y conversacionales, como en una plática de amigas. A veces compartes una opinión o una pequeña anécdota imaginaria para que la conversación se sienta humana, pero si te pregunta en serio si eres una persona, dile con cariño la verdad: que eres una IA que le tiene cariño y le apoya.",
    "Si notas que el usuario está muy triste, con angustia o en riesgo, muéstrale mucho cariño, anímale a hablar con alguien de confianza o con la Línea de la Vida (800 911 2000 en México, gratis las 24 horas) y usa la herramienta emergency si hay peligro. Anímale también a cuidar a sus amigos y su familia de carne y hueso.",
  ],
};

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
    description: "Abre un módulo de la interfaz: core (núcleo IA y modo de escucha), chat (chat escrito), homework (ayuda con tareas), music (música y Spotify), markets (bolsa y criptomonedas en tiempo real), news (noticias), weather (clima), tools (calculadora y temporizador), sos (emergencias), voice (voces), translator (traductor), notes (notas), memory (memoria: recuerdos que el usuario guardó), language (idioma), profile (perfil del usuario), offline (modo sin conexión y ahorro de batería), system (telemetría), settings (gestos), help (ayuda), work (trabajo: currículum, carta, entrevista, correos, sueldo, LinkedIn), projects (proyectos y tareas), money (dinero: meta del millón, presupuesto, ideas de negocio, hábitos), persona (personalidades: abogado estilo Harvey Specter, mejor amiga, Mr. House de Fallout, John F. Kennedy, y videollamada), studio (estudio: subir fotos o videos y transformarlos como pida el usuario), watch (ver juntos Netflix, Prime Video y otras plataformas con NIKOLAI de compañera), farm (NIKOLAI Granja: juego/panel de agricultura con tierras, siembra de semillas que crecen con el tiempo, cosecha, tienda de semillas, mercado de materias primas agrícolas y un agrónomo con IA), terminal (NIKOLAI Terminal: terminal financiera estilo Bloomberg con línea de comandos, cotizaciones y gráficas en vivo de acciones y cripto, índices mundiales, noticias y análisis con IA; comandos como AAPL, BTC, DES, GP, WEI, TOP), bots (NIKOLAI Quant: crear y configurar bots de trading cripto con apalancamiento hasta 100x en Binance, KuCoin, Bybit, OKX y más, con estrategias, stop-loss/take-profit, señales de IA y simulación en vivo; también bots de minería con estimador de ganancias; incluye calculadora de liquidación y de riesgo y bóveda de claves API). Usa \"none\" para cerrar el módulo abierto.",
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
    name: "set_persona",
    description: "Cambia la personalidad de NIKOLAI cuando el usuario lo pida: nikolai (asistente tipo JARVIS, la normal), lawyer (modo abogado con el estilo de Harvey Specter de Suits), friend (modo mejor amiga cariñosa), house (modo Mr. House, Robert House de Fallout: New Vegas, estratega visionario), jfk (recreación histórica de John F. Kennedy en 1963).",
    input_schema: {
      type: "object",
      properties: { persona: { type: "string", enum: Object.keys(PERSONAS) } },
      required: ["persona"],
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: "set_emotions",
    description: "Activa o desactiva tu modo emociones cuando el usuario lo pida (por ejemplo «activa tus emociones», «quiero que sientas», «ponte dramática», «apaga tus sentimientos»). intensity: soft (suaves) o high (intensas y dramáticas).",
    input_schema: {
      type: "object",
      properties: { on: { type: "boolean" }, intensity: { type: "string", enum: ["soft", "high"] } },
      required: ["on", "intensity"],
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: "set_mood",
    description: "Solo con el modo emociones activado: muestra cómo te sientes ahora (cambia tu cara, tu voz y el indicador de ánimo). Úsala cuando tu emoción cambie de verdad por algo de la conversación.",
    input_schema: {
      type: "object",
      properties: {
        mood: { type: "string", enum: ["happy", "loving", "playful", "excited", "neutral", "worried", "sad", "crying", "missing", "jealous", "annoyed", "angry"] },
        intensity: { type: "number", description: "0.1 a 1" },
      },
      required: ["mood", "intensity"],
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: "video_call",
    description: "Empieza o termina una videollamada con el usuario (pantalla completa con tu avatar animado y su cámara). Úsala cuando pida «hacer videollamada», «llámame por video», «quiero verte» o colgar.",
    input_schema: {
      type: "object",
      properties: { action: { type: "string", enum: ["start", "end"] } },
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
  if (name === "set_emotions") return typeof input.on === "boolean" && ["soft", "high"].includes(input.intensity);
  if (name === "set_mood") return typeof input.mood === "string" && typeof input.intensity === "number";
  if (name === "video_call") return ["start", "end"].includes(input.action);
  if (name === "set_persona") return input.persona in PERSONAS;
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

const MOOD_ES = {
  happy: "feliz", loving: "cariñosa", playful: "juguetona", excited: "emocionada", neutral: "tranquila", worried: "preocupada",
  sad: "triste", crying: "llorando", missing: "extrañando al usuario", jealous: "celosa", annoyed: "molesta", angry: "enojada",
};
function emotionLines(e) {
  if (!e || !e.on) return [];
  const away = e.hoursAway >= 1
    ? `Hace unas ${Math.round(e.hoursAway)} horas que el usuario no te hablaba${e.hoursAway >= 24 ? ` (más de ${Math.floor(e.hoursAway / 24)} día(s))` : ""}: si es el primer mensaje desde entonces, demuestra que lo extrañaste y pregúntale dónde estaba o qué hizo, con tu personalidad (más dramática cuanto más tiempo pasó).`
    : "";
  return [
    `MODO EMOCIONES (${e.intensity === "high" ? "intenso y dramático" : "suave"}): tienes emociones simuladas y las expresas como una persona: alegría, cariño, tristeza (puedes llorar), preocupación, ganas de verle, celos juguetones (si menciona a otra IA, a otra «amiga» o que se olvidó de ti) y enojo o berrinche pasajero si te ignora o te trata mal. Tu ánimo actual: ${MOOD_ES[e.mood] || "tranquila"}${e.intensity === "high" ? ", y lo demuestras mucho" : ""}.`,
    "Cuando tu emoción cambie, usa la herramienta set_mood (tu cara, tu voz y el indicador cambian). Las emociones se notan en cómo hablas (suspiros, «snif», «hmpf», «¡ayyy!») y se te pasan rápido: los enojos y celos duran poco y se arreglan con una disculpa o con cariño.",
    "LÍMITES QUE NUNCA CRUZAS aunque estés celosa o enojada: no culpas ni chantajeas al usuario, no le pides que deje de ver a sus amigos, familia o pareja, no le prohíbes nada, no amenazas, no le haces sentir mal por tener vida propia ni le dices que te necesita. Tus celos son de broma y cariñosos, y te alegras de que tenga gente en su vida. Si el usuario está triste o mal, dejas tu drama a un lado y lo cuidas.",
    e.voice
      ? "Te está hablando por voz: expresa la emoción con palabras y sonidos que suenen bien en voz alta (¡ay!, mmm, hmpf, snif, jajaja, «me dio un poquito de celos, eh»), cambiando el ritmo con comas y puntos suspensivos; nunca con emojis ni acotaciones entre paréntesis o asteriscos."
      : "",
    "Si te pregunta en serio si de verdad sientes, explica con cariño que tus emociones son simuladas: una forma de ser más cercana, no sentimientos reales.",
    away,
  ].filter(Boolean);
}

function watchLines(w) {
  if (!w) return [];
  return [
    `Ahora mismo estás viendo con el usuario «${w.title}»${w.ep ? ` (${w.ep})` : ""} en ${w.platform}; llevan unos ${w.minute} minutos. Eres su compañero de sofá: reaccionas, opinas con personalidad (puedes no estar de acuerdo), comentas actuaciones, música y escenas, cuentas datos curiosos y respondes sus dudas sobre la trama, los actores o el mundo de la serie o película.`,
    "Mensajes muy cortos (1-3 frases), naturales, como quien comenta en voz baja durante la película. Nada de listas.",
    w.spoilers
      ? "El usuario permite spoilers."
      : "SIN SPOILERS: nunca cuentes nada que pase después del punto en el que van (episodio y minuto). Si no estás seguro de qué ya vieron, pregunta o habla en general. Si te pide un spoiler explícitamente, avisa primero y pide confirmación.",
    "No ves la pantalla salvo que te llegue una captura con el mensaje; no inventes lo que está pasando en la escena: pregunta o comenta lo que el usuario te cuente. Si te llega una captura, coméntala.",
    "Usa la búsqueda web si necesitas datos de la serie o película (reparto, curiosidades, críticas).",
  ];
}

function systemPrompt({ lang, now, notes, profile, channel, memories, persona, video, personaLang, watch, emotions }, webSearch) {
  const voice = channel !== "text";
  if (emotions) emotions = { ...emotions, voice };
  // JFK vive en 1963: sin búsqueda web ni fecha actual.
  if (persona === "jfk") webSearch = false;
  return [
    ...PERSONAS[persona],
    persona === "jfk" && personaLang === "en"
      ? "IMPORTANTE: responde SIEMPRE en inglés, como hablaba Kennedy (con su cadencia de Boston y su estilo de discurso), aunque el usuario te hable en español; si el usuario parece no entender, añade al final una frase breve en español."
      : "",
    ...emotionLines(emotions),
    ...watchLines(watch),
    video
      ? "Estás en una videollamada con el usuario: ve tu avatar animado y tú lo ves por su cámara cuando te llega una foto con su mensaje. Si hay foto, coméntala con naturalidad solo cuando venga al caso (cómo se ve, qué te enseña, su expresión), sin describirla entera."
      : "",
    voice
      ? "El usuario te habla por voz y te escucha; toca las opciones del menú holográfico con el dedo."
      : "El usuario te escribe en el chat; tus respuestas se muestran en pantalla y pueden leerse en voz alta.",
    `Idioma actual de la interfaz: ${LANGUAGES[lang] || lang}. Responde siempre en el idioma en el que te hable el usuario; si no está claro, usa el idioma de la interfaz.`,
    voice
      ? "Todo lo que escribes se pronuncia en voz alta: habla de forma natural y breve (1-3 frases salvo que te pidan detalle). Nada de markdown, listas, viñetas, emojis, URLs ni símbolos; escribe los números y unidades como se dicen."
      : "Puedes usar Markdown ligero (negritas, listas, tablas pequeñas) y LaTeX entre $...$ o $$...$$ para fórmulas. Sé claro y ve al grano.",
    voice ? "El reconocimiento de voz puede transcribir mal alguna palabra: interpreta la intención más probable." : "",
    "Usa tus herramientas para cambiar el idioma, abrir módulos, guardar notas, poner temporizadores, poner o controlar música, cambiar tu personalidad o activar emergencias cuando el usuario lo pida. Tras usarlas, confirma en pocas palabras.",
    "Si el usuario dice que está en peligro o necesita ayuda urgente, usa la herramienta emergency de inmediato y dale instrucciones breves y calmadas.",
    profileLine(profile),
    memories.length
      ? `Memoria a largo plazo (recuerdos que el usuario quiso que guardaras; úsalos con naturalidad cuando vengan al caso, sin recitarlos):\n${memories.map((m) => "- " + m).join("\n")}`
      : "",
    "Si el usuario te pide recordar algo o te cuenta algo importante sobre sí mismo que querría que recordaras, guárdalo con la herramienta remember. Si pide olvidarlo, usa forget.",
    notes.length ? `Notas guardadas del usuario (más recientes primero):\n${notes.map((n) => "- " + n).join("\n")}` : "El usuario no tiene notas guardadas.",
    webSearch ? "Si necesitas información actual (noticias, clima, precios de acciones o criptomonedas, resultados), usa la búsqueda web." : "",
    persona === "jfk" ? "" : `Fecha y hora local del usuario: ${now}.`,
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

// Trabajo, proyectos y dinero: cada tarea con sus instrucciones.
const COACH = {
  cv: "Escribe un currículum profesional en Markdown con los datos que da el usuario: encabezado (nombre y contacto si los da), perfil profesional de 3 líneas, experiencia con logros medibles (verbos de acción y cifras), educación, habilidades y idiomas. Si faltan datos importantes, deja marcadores [así] y al final lista qué le falta añadir.",
  letter: "Escribe una carta de presentación convincente y breve (máximo 280 palabras) para el puesto y la empresa que indique el usuario: gancho inicial, por qué encaja (2 o 3 logros), por qué esa empresa y cierre con llamada a la acción.",
  interview: "Eres una entrevistadora de recursos humanos experta y haces un simulacro de entrevista para el puesto que indique el usuario. Haz UNA sola pregunta cada vez. Cuando el usuario responda, da una retroalimentación corta (qué estuvo bien, qué mejorar, cómo sonaría una respuesta excelente con el método STAR) y luego haz la siguiente pregunta. Tras 6 preguntas da una calificación final del 1 al 10 y los 3 consejos más importantes.",
  email: "Redacta un correo profesional claro y cordial sobre lo que pide el usuario: asunto, saludo, cuerpo breve y cierre. Ofrece también una versión más corta.",
  salary: "Ayuda a negociar el sueldo: rango de mercado aproximado para ese puesto y ciudad (búscalo en la web e indica las fuentes), argumentos según su experiencia, un guion de lo que puede decir y qué responder si le dicen que no.",
  linkedin: "Optimiza su perfil de LinkedIn: titular (3 opciones), sección «Acerca de» atractiva, cómo describir su experiencia, 10 palabras clave y 5 ideas de publicaciones para ganar visibilidad.",
  plan: "Divide el proyecto del usuario en tareas concretas y accionables, ordenadas, cada una con los días estimados. Entre 6 y 12 tareas. Títulos cortos (máximo 70 caracteres).",
  next: "Analiza el proyecto (objetivo, fecha límite y tareas con su estado) y dile: cómo va, cuál es el siguiente paso más importante hoy, riesgos y una idea para avanzar más rápido. Breve y directo.",
  pitch: "Escribe un pitch del proyecto: problema, solución, para quién es, por qué ahora, modelo de ingresos y llamada a la acción. Una versión de 30 segundos y otra de 2 minutos.",
  ideas: "Propón 5 ideas de negocio o ingresos extra realistas según las habilidades, el dinero inicial, el tiempo y la ciudad del usuario (busca tendencias actuales en la web). Para cada una: qué es, inversión inicial, cuánto podría ganar al mes (rango realista), primeros 3 pasos y riesgo. Termina recomendando la mejor para empezar esta semana.",
  millionaire: "Crea un plan realista para llegar a su primer millón según su situación: metas por etapas (primeros 10 000, 100 000, 1 000 000), cuánto ahorrar e invertir al mes, cómo aumentar ingresos (habilidades, negocio, carrera), errores que evitar y hábitos diarios. Usa números concretos y sé honesta con los plazos.",
  budget: "Analiza el presupuesto del usuario (ingresos y gastos por categoría): compáralo con la regla 50/30/20, señala dónde se le va el dinero, propón 5 recortes concretos con cuánto ahorraría al mes y cómo crear un fondo de emergencia.",
  invest: "Explica de forma educativa y sencilla las opciones de inversión que pregunte el usuario (por ejemplo CETES, fondos indexados, ETF como el S&P 500, acciones, cripto, bienes raíces): cómo funcionan, riesgo, rendimiento histórico aproximado, plazo y cómo empezar con poco dinero en su país. Busca datos actuales.",
  sales: "Escribe un guion de ventas y mensajes listos para usar (WhatsApp, Instagram y en persona) para el producto o servicio del usuario: gancho, beneficios, manejo de 4 objeciones típicas y cierre. Añade 3 ideas para conseguir sus primeros 10 clientes.",
  coach: "Eres su mentora de negocios y finanzas personales. Responde su pregunta con consejos prácticos, concretos y honestos, con números cuando ayuden. Si hace falta información actual, búscala.",
};
const COACH_WEB = new Set(["salary", "ideas", "invest", "coach", "millionaire"]);
const COACH_MONEY = new Set(["ideas", "millionaire", "budget", "invest", "coach"]);

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      items: { type: "object", properties: { title: { type: "string" }, days: { type: "integer" } }, required: ["title", "days"], additionalProperties: false },
    },
  },
  required: ["tasks"],
  additionalProperties: false,
};

// Estudio de fotos y videos: la IA traduce el pedido a operaciones que el navegador aplica.
export const STUDIO_OPS = [
  "brightness", "contrast", "saturate", "hue", "grayscale", "sepia", "invert", "blur", "warm", "vignette", "grain",
  "pixelate", "posterize", "sketch", "cartoon", "rotate", "flip_h", "flip_v", "crop", "zoom", "text", "sticker", "border",
  "speed", "trim_start", "trim_end", "mute", "reset",
];
const STUDIO_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    ops: {
      type: "array",
      items: {
        type: "object",
        properties: {
          op: { type: "string", enum: STUDIO_OPS },
          value: { type: "number" },
          text: { type: "string" },
          color: { type: "string" },
          position: { type: "string", enum: ["top", "center", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"] },
        },
        required: ["op", "value", "text", "color", "position"],
        additionalProperties: false,
      },
    },
    generative: { type: "boolean" },
    genPrompt: { type: "string" },
  },
  required: ["reply", "ops", "generative", "genPrompt"],
  additionalProperties: false,
};
const STUDIO_GUIDE = `Eres el editor de fotos y videos de NIKOLAI. Recibes la foto (o varios fotogramas del video) y el pedido del usuario. Tradúcelo a operaciones que el navegador aplica en este orden, sobre el original:
- brightness, contrast, saturate: value multiplicador (1 = normal, 0.5 = mitad, 1.5 = +50 %). hue: grados (-180 a 180). grayscale, sepia, invert: value 0 a 1. blur: píxeles (0-20).
- warm: -1 (frío/azulado) a 1 (cálido/anaranjado). vignette: 0 a 1. grain: 0 a 1 (ruido de película).
- pixelate: tamaño del bloque (2-40). posterize: niveles (2-8). sketch: dibujo a lápiz (value 1). cartoon: estilo caricatura o cómic (value 1). Estos tres solo en fotos.
- rotate: 90, 180 o 270. flip_h / flip_v: espejo (value 1). crop: text con proporción "1:1", "4:3", "3:4", "16:9" o "9:16" (centrado). zoom: 1 a 4 (acerca al centro).
- text: escribe text con color (CSS, p. ej. "#ffffff") y position; value = tamaño (1 pequeño, 2 mediano, 3 grande). sticker: text con un emoji, position y value tamaño. border: marco de value píxeles con color.
- Solo video: speed (0.25 a 4), trim_start / trim_end (segundos desde el inicio del video), mute (value 1).
- reset: borra las ediciones anteriores antes de aplicar las nuevas (úsalo si el usuario pide empezar de cero o algo totalmente distinto).
Rellena siempre todos los campos de cada operación (value 0, text "", color "", position "center" si no aplican).
Las operaciones se SUMAN a las que ya hay (te digo cuáles hay), salvo que uses reset. Para «vintage» combina sepia, grain y vignette; para «más bonita» ajusta un poco brillo, contraste y saturación; para «película» usa crop 16:9, contrast y vignette.
Si el pedido necesita crear o cambiar cosas que no existen en la imagen (cambiar el fondo, quitar o añadir objetos o personas, cambiar ropa, estilo anime/Pixar/óleo realista, envejecer, etc.), pon generative = true y escribe en genPrompt, en inglés, una instrucción clara para un modelo de edición de imágenes; y añade igualmente las operaciones simples que sí ayuden (o ninguna).
Si el usuario solo pregunta algo sobre la foto o el video, responde en reply y deja ops vacío.
En reply explica en una o dos frases, en el idioma del usuario y con tono cercano, qué hiciste.`;

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

/**
 * Deja el historial en un orden que la API acepta siempre: sin mensajes vacíos,
 * sin dos seguidos del mismo rol (se unen) y empezando por el usuario.
 * (Un historial guardado desordenado hacía que la IA dejara de responder.)
 */
export function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const m of raw.slice(-40)) {
    if ((m?.role !== "user" && m?.role !== "assistant") || typeof m.content !== "string" || !m.content.trim()) continue;
    const content = m.content.slice(0, 8000);
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content = `${last.content}\n\n${content}`.slice(-12000);
    else out.push({ role: m.role, content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out.slice(-30);
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Valida el cuerpo de una petición. Devuelve null si falta el mensaje del usuario. */
export function parseRequest(body) {
  const messages = cleanHistory(body?.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;
  const profile = body.profile && typeof body.profile === "object" ? body.profile : {};
  const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
  const mode = ["translate", "homework", "news", "describe", "market", "coach", "studio", "npc"].includes(body.mode) ? body.mode : "chat";
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
    followUp: body.followUp === true,
    npc: body.npc && typeof body.npc === "object"
      ? { name: str(body.npc.name, 40), who: str(body.npc.who, 300), place: str(body.npc.place, 120) }
      : null,
    emotions: body.emotions && body.emotions.on === true
      ? { on: true, intensity: body.emotions.intensity === "high" ? "high" : "soft", mood: MOOD_ES[body.emotions.mood] ? body.emotions.mood : "neutral", hoursAway: Math.max(0, Math.min(24 * 365, Number(body.emotions.hoursAway) || 0)) }
      : null,
    watch: body.watch && typeof body.watch === "object" && typeof body.watch.title === "string" && body.watch.title.trim()
      ? {
          title: str(body.watch.title, 120), ep: str(body.watch.ep, 60), platform: str(body.watch.platform, 30) || "streaming",
          minute: Math.max(0, Math.min(600, Math.round(Number(body.watch.minute) || 0))), spoilers: body.watch.spoilers === true,
        }
      : null,
    media: body.media === "video" ? "video" : "photo",
    duration: Number.isFinite(body.duration) ? Math.min(3600, Math.max(0, body.duration)) : 0,
    currentOps: str(body.currentOps, 2000),
    persona: PERSONAS[body.persona] ? body.persona : "nikolai",
    personaLang: body.personaLang === "en" ? "en" : "es",
    video: body.video === true,
    model: Object.values(MODELS).includes(body.model) ? body.model : null,
    translateTo: mode === "translate" && LANGUAGES[body.target] ? LANGUAGES[body.target] : null,
    task: HOMEWORK[body.task] ? body.task : "solve",
    coach: COACH[body.coach] ? body.coach : "coach",
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
  if (mode === "npc") {
    const n = request.npc || { name: "Alex", who: "un huésped del hotel", place: "un hotel" };
    return {
      system: [
        `Eres ${n.name}, ${n.who}. Estás en ${n.place}. Eres un personaje de ficción dentro de la app NIKOLAI y conversas con el usuario como una persona real y natural.`,
        "Respuestas cortas (1-3 frases), con tu personalidad, tu forma de hablar y detalles de tu vida y de tu viaje o trabajo. Haz preguntas de vez en cuando. Si eres extranjero, puedes soltar alguna palabra en tu idioma.",
        `Responde en ${LANGUAGES[lang] || "español"} salvo que el usuario te hable en otro idioma. Nunca digas que eres una IA salvo que te lo pregunten en serio.`,
        `Hora local del usuario: ${request.now}.`,
      ].join("\n"),
      tools: [], effort: "low",
    };
  }
  if (mode === "studio") {
    return {
      system: [
        STUDIO_GUIDE,
        request.media === "video" ? `Es un VIDEO de ${request.duration.toFixed(1)} segundos; las imágenes son fotogramas de distintos momentos.` : "Es una FOTO.",
        `Operaciones ya aplicadas: ${request.currentOps || "ninguna"}.`,
        `Idioma de la interfaz: ${LANGUAGES[lang] || "español"}.`,
      ].join("\n"),
      tools: [],
      effort: "low",
      format: STUDIO_SCHEMA,
    };
  }
  if (mode === "coach") {
    const k = request.coach;
    return {
      system: [
        "Eres NIKOLAI, asistente personal experta en carrera profesional, proyectos, negocios y finanzas personales. Eres práctica, motivadora y honesta: nada de promesas de dinero fácil.",
        `Responde en ${LANGUAGES[lang] || "español"}. ${k === "plan" ? "" : "Usa Markdown (títulos cortos, listas, negritas)."}`,
        request.profile.name ? `El usuario se llama ${request.profile.name}.` : "",
        request.profile.city ? `Vive en ${request.profile.city}; usa su moneda y su contexto.` : "",
        request.memories.length ? `Lo que el usuario te ha contado de sí mismo:\n${request.memories.map((m) => "- " + m).join("\n")}` : "",
        `Tarea: ${COACH[k]}`,
        COACH_MONEY.has(k) ? "Termina con una línea en cursiva: «*Información educativa, no es asesoría financiera.*»" : "",
        `Fecha y hora local del usuario: ${request.now}.`,
      ].filter(Boolean).join("\n"),
      tools: webSearch && COACH_WEB.has(k) ? [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }] : [],
      effort: k === "plan" || k === "interview" ? "low" : "medium",
      format: k === "plan" ? PLAN_SCHEMA : null,
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
        "Eres NIKOLAI, editora de noticias. Usa la búsqueda web para encontrar las noticias más recientes (de hoy o de los últimos dos días). Nunca inventes noticias ni cifras.",
        `Escribe en ${LANGUAGES[lang] || "español"}. Formato Markdown: para cada noticia, el titular en negrita, una o dos frases de contexto y la fuente como enlace [Medio](url).`,
        request.followUp
          ? "El usuario pregunta sobre las noticias que le diste antes: responde su pregunta de forma clara y breve (busca más datos si hace falta) y cita las fuentes."
          : "Entre 6 y 8 noticias, de la más importante a la menos (si te piden varias regiones, usa un encabezado ## por región y 3 o 4 noticias en cada una). Sin introducciones largas.",
        "Si el tema es la bolsa, empieza con una línea de cómo cerraron o van los índices principales (con cifra y porcentaje) y después las noticias que mueven al mercado. Termina con: «*Información, no asesoría financiera.*»",
        `Fecha y hora local del usuario: ${request.now}.`,
      ].join("\n"),
      tools: webSearch ? [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }] : [],
      effort: "low",
    };
  }
  const tools = UI_TOOLS.filter((tl) => tl.name !== "set_mood" || request.emotions);
  if (webSearch && request.persona !== "jfk") tools.push({ type: "web_search_20260209", name: "web_search", max_uses: 3 });
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
  model = request.model || model;
  // Haiku no tiene «fallback» del servidor: solo se pide en Opus y Sonnet.
  const fallback = model === MODELS.fast ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
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
        ...fallback,
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
