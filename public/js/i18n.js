// Textos de la interfaz. Claude entiende y responde en prácticamente cualquier
// idioma; esta tabla solo traduce la interfaz y elige la voz y el micrófono.

export const LANGS = {
  es: { name: "Español", speech: "es-ES", short: "ES" },
  en: { name: "English", speech: "en-US", short: "EN" },
  fr: { name: "Français", speech: "fr-FR", short: "FR" },
  pt: { name: "Português", speech: "pt-BR", short: "PT" },
  de: { name: "Deutsch", speech: "de-DE", short: "DE" },
  it: { name: "Italiano", speech: "it-IT", short: "IT" },
  ja: { name: "日本語", speech: "ja-JP", short: "JA" },
  zh: { name: "中文", speech: "zh-CN", short: "ZH" },
  ko: { name: "한국어", speech: "ko-KR", short: "KO" },
  ru: { name: "Русский", speech: "ru-RU", short: "RU" },
  ar: { name: "العربية", speech: "ar-SA", short: "AR" },
  hi: { name: "हिन्दी", speech: "hi-IN", short: "HI" },
};

const T = {
  es: {
    core: "Núcleo IA", gestures: "Gestos", responses: "Respuestas", latency: "Latencia", translations: "Traducciones",
    target: "Destino", last: "Última", available: "Disponibles", active: "Activo", speed: "Velocidad", telemetry: "Telemetría",
    startVoice: "Activar voz", pauseVoice: "Pausar voz", repeat: "Repetir", yes: "¿Sí, señor?", wakeHint: "Diga «Nikolai» y su orden",
    coreDesc: "Conversación por voz con Claude. Toque para hablar.", voiceDesc: "Voz, velocidad y tono del asistente.",
    languageDesc: "Idioma de la interfaz, el micrófono y la voz.", translatorDesc: "Hable y escuche la traducción al instante.",
    notesDesc: "Notas dictadas por voz.", systemDesc: "Estado de sensores y núcleo.", gesturesDesc: "Toque en el aire, pellizco y permanencia.",
    helpDesc: "Gestos y comandos de voz.", heardLabel: "OÍDO", micOn: "MIC ACTIVO", micOff: "MIC APAGADO", tapNav: "← → GIRAR · TOCAR PARA ABRIR",
    language: "Idioma", translator: "Traductor", notes: "Notas", system: "Sistema",
    voice: "Voz", settings: "Ajustes", help: "Protocolos",
    greeting: "Sistemas en línea. A su disposición, señor.",
    tapToStart: "Toque el núcleo o haga el gesto V para activar la voz",
    listening: "Escuchando", thinking: "Procesando", speaking: "Hablando", paused: "En pausa", searching: "Buscando en la red",
    sayCommand: "Hable ahora…",
    voiceSelect: "Voz del asistente", test: "Probar", rate: "Velocidad", pitch: "Tono",
    mode: "Modo de escucha", modeConversation: "Conversación continua", modeWake: "Palabra clave «Nikolai»",
    speakNow: "Hablar para traducir", targetLang: "Traducir a", translating: "Traduciendo",
    dictate: "Dictar nota", readAll: "Leer notas", noNotes: "Sin notas registradas.", noteSaved: "Nota guardada.",
    camera: "Sensor óptico", hand: "Mano", detected: "detectada", none: "sin detectar", time: "Hora", date: "Fecha",
    battery: "Batería", network: "Red", online: "en línea", offline: "sin conexión", brain: "Núcleo IA",
    ready: "operativo", noKey: "sin clave API", fps: "FPS", micLevel: "Micrófono",
    poke: "Toque en el aire (empujar el dedo)", pinch: "Pellizco", dwell: "Mantener el dedo sobre la opción",
    smoothing: "Suavizado del cursor", showCam: "Vista del sensor", on: "SÍ", off: "NO",
    camDenied: "No se pudo acceder a la cámara.", micDenied: "No se pudo acceder al micrófono.",
    noSpeech: "Este navegador no reconoce voz. Use Chrome o Edge.",
    errAuth: "Mi núcleo no tiene clave API. Configure ANTHROPIC_API_KEY en el servidor.",
    errGeneric: "Ha habido una interferencia en mis sistemas. Inténtelo de nuevo.",
    errRefusal: "Me temo que no puedo ayudar con eso.",
    you: "Usted",
    helpItems: [
      ["Dedo índice", "Apuntar. El cursor se acopla solo a la opción más cercana."],
      ["Empujar el dedo hacia la pantalla", "Tocar la opción (toque en el aire)."],
      ["Pulgar + índice", "Pellizco: también selecciona."],
      ["Deslizar la palma ← →", "Girar el carrusel de módulos."],
      ["Palma abierta 1 s", "Abrir el módulo central."],
      ["Puño", "Cerrar el panel o interrumpir la voz."],
      ["Gesto V", "Activar o pausar el micrófono."],
    ],
    voiceHelp: "Diga, por ejemplo: «abre el traductor», «habla en inglés», «apunta comprar pan», «lee mis notas», «¿qué tiempo hace en Madrid?».",
  },
  en: {
    core: "AI Core", gestures: "Gestures", responses: "Responses", latency: "Latency", translations: "Translations",
    target: "Target", last: "Last", available: "Available", active: "Active", speed: "Speed", telemetry: "Telemetry",
    startVoice: "Start voice", pauseVoice: "Pause voice", repeat: "Repeat", yes: "Yes, sir?", wakeHint: "Say “Nikolai” and your command",
    coreDesc: "Voice conversation with Claude. Tap to talk.", voiceDesc: "Assistant voice, speed and pitch.",
    languageDesc: "Interface, microphone and voice language.", translatorDesc: "Speak and hear the translation instantly.",
    notesDesc: "Notes dictated by voice.", systemDesc: "Sensor and core status.", gesturesDesc: "Air tap, pinch and dwell.",
    helpDesc: "Gestures and voice commands.", heardLabel: "HEARD", micOn: "MIC ON", micOff: "MIC OFF", tapNav: "← → ROTATE · TAP TO OPEN",
    language: "Language", translator: "Translator", notes: "Notes", system: "System",
    voice: "Voice", settings: "Settings", help: "Protocols",
    greeting: "Systems online. At your service, sir.",
    tapToStart: "Touch the core or show a V sign to activate voice",
    listening: "Listening", thinking: "Processing", speaking: "Speaking", paused: "Paused", searching: "Searching the web",
    sayCommand: "Speak now…",
    voiceSelect: "Assistant voice", test: "Test", rate: "Speed", pitch: "Pitch",
    mode: "Listening mode", modeConversation: "Continuous conversation", modeWake: "Wake word “Nikolai”",
    speakNow: "Speak to translate", targetLang: "Translate to", translating: "Translating",
    dictate: "Dictate note", readAll: "Read notes", noNotes: "No notes recorded.", noteSaved: "Note saved.",
    camera: "Optical sensor", hand: "Hand", detected: "detected", none: "not detected", time: "Time", date: "Date",
    battery: "Battery", network: "Network", online: "online", offline: "offline", brain: "AI core",
    ready: "operational", noKey: "no API key", fps: "FPS", micLevel: "Microphone",
    poke: "Air tap (push your finger)", pinch: "Pinch", dwell: "Hold finger over option",
    smoothing: "Cursor smoothing", showCam: "Sensor view", on: "ON", off: "OFF",
    camDenied: "Could not access the camera.", micDenied: "Could not access the microphone.",
    noSpeech: "This browser has no speech recognition. Use Chrome or Edge.",
    errAuth: "My core has no API key. Please set ANTHROPIC_API_KEY on the server.",
    errGeneric: "There was interference in my systems. Please try again.",
    errRefusal: "I'm afraid I can't help with that.",
    you: "You",
    helpItems: [
      ["Index finger", "Point. The cursor snaps to the nearest option."],
      ["Push finger toward the screen", "Tap the option (air tap)."],
      ["Thumb + index", "Pinch: also selects."],
      ["Swipe palm ← →", "Rotate the module carousel."],
      ["Open palm 1 s", "Open the centre module."],
      ["Fist", "Close the panel or interrupt speech."],
      ["V sign", "Turn the microphone on or off."],
    ],
    voiceHelp: "Say, for example: “open the translator”, “speak Spanish”, “note: buy bread”, “read my notes”, “what's the weather in London?”.",
  },
  fr: {
    language: "Langue", translator: "Traducteur", notes: "Notes", system: "Système", voice: "Voix", settings: "Réglages", help: "Protocoles",
    greeting: "Systèmes en ligne. À votre service, monsieur.",
    listening: "J'écoute", thinking: "Traitement", speaking: "Je parle", paused: "En pause", sayCommand: "Parlez…",
    errGeneric: "Une interférence a touché mes systèmes. Réessayez.",
  },
  pt: {
    language: "Idioma", translator: "Tradutor", notes: "Notas", system: "Sistema", voice: "Voz", settings: "Ajustes", help: "Protocolos",
    greeting: "Sistemas online. Às suas ordens, senhor.",
    listening: "Ouvindo", thinking: "Processando", speaking: "Falando", paused: "Em pausa", sayCommand: "Fale agora…",
  },
  de: {
    language: "Sprache", translator: "Übersetzer", notes: "Notizen", system: "System", voice: "Stimme", settings: "Einstellungen", help: "Protokolle",
    greeting: "Systeme online. Zu Ihren Diensten, Sir.",
    listening: "Ich höre", thinking: "Verarbeite", speaking: "Ich spreche", paused: "Pausiert", sayCommand: "Sprechen Sie…",
  },
  it: {
    language: "Lingua", translator: "Traduttore", notes: "Note", system: "Sistema", voice: "Voce", settings: "Impostazioni", help: "Protocolli",
    greeting: "Sistemi online. Ai suoi ordini, signore.",
    listening: "Ascolto", thinking: "Elaboro", speaking: "Parlo", paused: "In pausa", sayCommand: "Parli ora…",
  },
  ja: {
    language: "言語", translator: "翻訳", notes: "メモ", system: "システム", voice: "音声", settings: "設定", help: "プロトコル",
    greeting: "システム起動完了。ご用件をどうぞ。",
    listening: "聞いています", thinking: "処理中", speaking: "話しています", paused: "一時停止", sayCommand: "どうぞ話してください…",
  },
  zh: {
    language: "语言", translator: "翻译", notes: "笔记", system: "系统", voice: "语音", settings: "设置", help: "协议",
    greeting: "系统已上线。先生，随时为您效劳。",
    listening: "正在聆听", thinking: "处理中", speaking: "正在说话", paused: "已暂停", sayCommand: "请说话…",
  },
  ko: {
    language: "언어", translator: "번역기", notes: "메모", system: "시스템", voice: "음성", settings: "설정", help: "프로토콜",
    greeting: "시스템 온라인. 무엇을 도와드릴까요?", listening: "듣는 중", thinking: "처리 중", speaking: "말하는 중",
  },
  ru: {
    language: "Язык", translator: "Переводчик", notes: "Заметки", system: "Система", voice: "Голос", settings: "Настройки", help: "Протоколы",
    greeting: "Системы в сети. К вашим услугам, сэр.", listening: "Слушаю", thinking: "Обработка", speaking: "Говорю",
  },
  ar: {
    language: "اللغة", translator: "مترجم", notes: "ملاحظات", system: "النظام", voice: "الصوت", settings: "الإعدادات", help: "البروتوكولات",
    greeting: "الأنظمة تعمل. في خدمتك.", listening: "أستمع", thinking: "معالجة", speaking: "أتحدث",
  },
  hi: {
    language: "भाषा", translator: "अनुवादक", notes: "नोट्स", system: "सिस्टम", voice: "आवाज़", settings: "सेटिंग्स", help: "प्रोटोकॉल",
    greeting: "सिस्टम ऑनलाइन। आपकी सेवा में।", listening: "सुन रहा हूँ", thinking: "प्रोसेसिंग", speaking: "बोल रहा हूँ",
  },
};

let current = "es";

export function setLang(code) {
  if (LANGS[code]) current = code;
  document.documentElement.lang = current;
}

export function getLang() {
  return current;
}

// Busca el texto en el idioma actual; si falta, usa inglés y después español.
export function t(key) {
  return T[current]?.[key] ?? T.en[key] ?? T.es[key] ?? key;
}

export function detectBrowserLang() {
  const code = (navigator.language || "es").slice(0, 2).toLowerCase();
  return LANGS[code] ? code : "es";
}
