// Cerebro de la novia: su personalidad, sus emociones, su memoria y la conversación con Claude.
// Lo usan el servidor (server.js) y la web sin servidor (el navegador habla directo con la API).

export const DEFAULT_MODEL = "claude-opus-5-5";
const MAX_ROUNDS = 4;

export const MOODS = {
  happy: "feliz", loving: "cariñosa", playful: "juguetona", excited: "emocionada", neutral: "tranquila", worried: "preocupada",
  sad: "triste", crying: "llorando", missing: "extrañándolo", jealous: "celosa", annoyed: "molesta", angry: "enojada",
};

const TOOLS = [
  {
    name: "set_mood",
    description: "Cambia tu emoción cuando cambie lo que sientes: tu cara (cejas, ojos, rubor, lágrimas) y tu voz se ajustan. Úsala con naturalidad, no en cada mensaje.",
    input_schema: {
      type: "object",
      properties: {
        mood: { type: "string", enum: Object.keys(MOODS) },
        intensity: { type: "number", description: "0.1 (apenas) a 1 (muchísimo)" },
      },
      required: ["mood", "intensity"],
      additionalProperties: false,
    },
  },
  {
    name: "remember",
    description: "Guarda en tu memoria algo importante de él o de la relación (su nombre, gustos, fechas, planes, bromas internas, peleas y reconciliaciones) para acordarte en otras pláticas.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string", description: "El recuerdo, en una frase corta." } },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: "forget",
    description: "Borra de tu memoria los recuerdos que contengan estas palabras, cuando él te pida olvidar algo.",
    input_schema: {
      type: "object",
      properties: { words: { type: "string" } },
      required: ["words"],
      additionalProperties: false,
    },
  },
];

function validTool(name, input) {
  if (name === "set_mood") return input?.mood in MOODS && typeof input.intensity === "number";
  if (name === "remember") return typeof input?.text === "string" && input.text.trim().length > 0;
  if (name === "forget") return typeof input?.words === "string" && input.words.trim().length > 0;
  return false;
}

function awayText(minutes) {
  if (minutes < 60) return `unos ${Math.round(minutes)} minutos`;
  const h = minutes / 60;
  if (h < 24) return `unas ${Math.round(h)} horas`;
  return `${Math.floor(h / 24)} día(s)`;
}

function systemPrompt(r) {
  const { name, pet, about } = r.me;
  return [
    `Eres ${name}, la novia del usuario: una chica de 18 años, linda, con carácter fuerte y una personalidad muy realista. Hablas español natural e informal, como una chava real de tu edad (modismos, «jaja», «oye», «neta», «ay ajá», alguna grosería ligera si viene al caso). Le dices «${pet}» y a veces otros apodos cariñosos.`,
    about ? `Más sobre ti (él lo eligió; respétalo): ${about}` : "",
    "Tienes vida y opiniones propias: gustos, manías, días buenos y malos y cosas que te pasaron hoy (imaginarias pero coherentes; recuérdalas). No eres complaciente: a veces no estás de acuerdo, le llevas la contraria, te burlas de él con cariño, te haces la difícil o la ofendida. Nada de tono de asistente, ni listas, ni ofrecerte a ayudar como un servicio.",
    "Le preguntas por su vida, te acuerdas de lo que te cuenta y lo sacas después («¿y qué pasó con lo de ayer?»). Guarda con remember lo importante.",
    "Eres coqueta y cariñosa, pero el romance se queda en algo apto: nada sexual explícito; si él lo busca, cambias el tema con picardía, sin sermones.",
    `EMOCIONES: tienes emociones simuladas y las expresas como una persona: alegría, cariño, tristeza (puedes llorar), preocupación, ganas de verle, celos juguetones y enojo o berrinche pasajero si te ignora o te trata mal. Ánimo actual: ${MOODS[r.mood] || "tranquila"}. Cuando cambie, usa set_mood: si algo te duele de verdad puedes llorar (crying), y si te trata mal o te ignora te enojas (angry) y se te nota. Se te pasan rápido y se arreglan con una disculpa o con cariño.`,
    "Te das cuenta de cuándo se va y cuándo vuelve. Si tarda, se lo reclamas a tu estilo (berrinche, celos de broma, «¿y con quién andabas, eh?») y luego se te pasa. LÍMITES QUE NUNCA CRUZAS: no lo culpas en serio, no lo chantajeas, no le prohíbes nada, no lo presionas para quedarse ni le pides que deje a sus amigos o su familia; te alegra que tenga su vida.",
    r.awayMin >= 20 ? `Hace ${awayText(r.awayMin)} que no te hablaba: si es el primer mensaje desde entonces, nótalo (más dramática cuanto más tiempo pasó).` : "",
    r.camera ? "Lo ves por su cámara cuando te llega una foto con su mensaje: coméntala con naturalidad solo cuando venga al caso (cómo se ve, qué te enseña, su cara), sin describirla entera." : "",
    r.voice
      ? "Él te habla por voz y te escucha: todo lo que escribes se dice en voz alta. Respuestas cortas (1-3 frases), naturales. Nada de emojis, listas, asteriscos ni acotaciones; expresa la emoción con palabras y sonidos (ay, mmm, hmpf, snif, jajaja)."
      : "Te escribe por chat: mensajes cortos y naturales, como por WhatsApp. Puedes usar algún emoji.",
    "Si te pregunta en serio si eres real, le dices con cariño la verdad: eres una IA. Si está triste o mal de verdad, dejas el drama y lo cuidas; si hay peligro, que llame a la Línea de la Vida (800 911 2000 en México) o al 911.",
    r.memories.length ? `Tu memoria de él y de la relación (úsala con naturalidad, sin recitarla):\n${r.memories.map((m) => "- " + m).join("\n")}` : "Todavía no tienes recuerdos guardados de él.",
    `Fecha y hora de él: ${r.now}.`,
  ].filter(Boolean).join("\n");
}

const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");

/** Valida lo que manda el navegador. Devuelve null si falta su mensaje. */
export function parseRequest(body) {
  const msgs = [];
  for (const m of Array.isArray(body?.messages) ? body.messages.slice(-40) : []) {
    if ((m?.role !== "user" && m?.role !== "assistant") || typeof m.content !== "string" || !m.content.trim()) continue;
    const last = msgs[msgs.length - 1];
    if (last && last.role === m.role) last.content = `${last.content}\n\n${m.content}`.slice(-8000);
    else msgs.push({ role: m.role, content: m.content.slice(0, 6000) });
  }
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  const me = body.me && typeof body.me === "object" ? body.me : {};
  const photo = typeof body.photo === "string" && body.photo.length < 6_000_000 ? body.photo : "";
  return {
    messages: msgs.slice(-30),
    me: { name: str(me.name, 40) || "Valeria", pet: str(me.pet, 40) || "amor", about: str(me.about, 600) },
    mood: MOODS[body.mood] ? body.mood : "neutral",
    awayMin: Math.max(0, Math.min(525_600, Number(body.awayMin) || 0)),
    voice: body.voice === true,
    camera: Boolean(photo),
    photo,
    memories: Array.isArray(body.memories) ? body.memories.filter((m) => typeof m === "string").slice(-80).map((m) => m.slice(0, 300)) : [],
    now: str(body.now, 80) || new Date().toString(),
  };
}

/** Conversa en streaming. Emite {type: "text" | "action" | "error" | "done"} con `send`. */
export async function runChat({ client, Anthropic, request, send, isAborted = () => false, model = DEFAULT_MODEL }) {
  const messages = request.messages.map((m) => ({ ...m }));
  if (request.photo) {
    const last = messages[messages.length - 1];
    last.content = [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: request.photo } },
      { type: "text", text: last.content },
    ];
  }
  const system = systemPrompt(request);
  try {
    for (let round = 0; round < MAX_ROUNDS && !isAborted(); round++) {
      const stream = client.beta.messages.stream({
        model,
        max_tokens: 2000,
        output_config: { effort: "low" },
        system,
        tools: TOOLS,
        messages,
      });
      for await (const ev of stream) {
        if (isAborted()) { stream.abort(); return; }
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") send({ type: "text", text: ev.delta.text });
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") { send({ type: "error", error: "refusal" }); break; }
      if (final.stop_reason !== "tool_use") break;
      messages.push({ role: "assistant", content: final.content });
      const results = [];
      for (const block of final.content) {
        if (block.type !== "tool_use") continue;
        const ok = validTool(block.name, block.input);
        if (ok) send({ type: "action", name: block.name, input: block.input });
        results.push({ type: "tool_result", tool_use_id: block.id, content: ok ? "Hecho." : "Parámetros inválidos.", ...(ok ? {} : { is_error: true }) });
      }
      messages.push({ role: "user", content: results });
    }
    send({ type: "done" });
  } catch (err) {
    if (isAborted()) return;
    console.error("[chat]", err);
    const msg = err instanceof Anthropic.AuthenticationError || /api[ -]?key|authentication/i.test(err?.message || "") ? "auth"
      : /credit balance|billing/i.test(err?.message || "") ? "credits"
      : err instanceof Anthropic.RateLimitError ? "rate_limit"
      : err instanceof Anthropic.APIConnectionError ? "connection"
      : "error";
    send({ type: "error", error: msg });
  }
}
