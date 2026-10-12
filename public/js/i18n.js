// Textos de la interfaz en varios idiomas. Claude entiende y responde en
// prácticamente cualquier idioma; esta tabla solo traduce la interfaz.

export const LANGS = {
  es: { name: "Español", speech: "es-ES", flag: "🇪🇸" },
  en: { name: "English", speech: "en-US", flag: "🇺🇸" },
  fr: { name: "Français", speech: "fr-FR", flag: "🇫🇷" },
  pt: { name: "Português", speech: "pt-BR", flag: "🇧🇷" },
  de: { name: "Deutsch", speech: "de-DE", flag: "🇩🇪" },
  it: { name: "Italiano", speech: "it-IT", flag: "🇮🇹" },
  ja: { name: "日本語", speech: "ja-JP", flag: "🇯🇵" },
  zh: { name: "中文", speech: "zh-CN", flag: "🇨🇳" },
  ko: { name: "한국어", speech: "ko-KR", flag: "🇰🇷" },
  ru: { name: "Русский", speech: "ru-RU", flag: "🇷🇺" },
  ar: { name: "العربية", speech: "ar-SA", flag: "🇸🇦" },
  hi: { name: "हिन्दी", speech: "hi-IN", flag: "🇮🇳" },
};

const T = {
  es: {
    chat: "Conversar", voice: "Voz", languages: "Idiomas", translator: "Traductor",
    notes: "Notas", system: "Sistema", settings: "Ajustes", help: "Ayuda",
    greeting: "Sistemas en línea. Buenas, señor. ¿En qué puedo ayudarle?",
    placeholder: "Escribe o habla con NIKOLAI…", send: "Enviar", listen: "Escuchar",
    listening: "Escuchando…", thinking: "Pensando…", searching: "Buscando en la red…", idle: "En espera",
    wakeOn: "Palabra clave «Nikolai» activada", wakeOff: "Palabra clave desactivada",
    wakeToggle: "Escucha continua (di «Nikolai»)", translate: "Traducir", targetLang: "Traducir a",
    translateHint: "Texto a traducir…", addNote: "Guardar nota", noteHint: "Nueva nota…", noNotes: "Sin notas todavía.",
    camera: "Cámara", hand: "Mano", detected: "detectada", none: "no detectada", time: "Hora", date: "Fecha",
    battery: "Batería", network: "Red", online: "en línea", offline: "sin conexión", brain: "Cerebro IA",
    ready: "listo", noKey: "sin clave API", fps: "FPS",
    speakReplies: "Responder en voz alta", speechRate: "Velocidad de voz", sensitivity: "Suavizado del cursor",
    dwell: "Clic por permanencia (mantener el dedo)", showCam: "Mostrar cámara", startCam: "Activar cámara",
    camDenied: "No se pudo acceder a la cámara.", close: "Cerrar", clear: "Borrar conversación",
    errAuth: "Mi núcleo no tiene clave API. Configure ANTHROPIC_API_KEY en el servidor.",
    errGeneric: "Ha habido una interferencia en mis sistemas. Inténtelo de nuevo.",
    errRefusal: "Me temo que no puedo ayudar con eso.",
    helpTitle: "Gestos de la mano",
    helpItems: [
      ["☝️", "Índice extendido", "Mueve el cursor holográfico"],
      ["🤏", "Pellizco (pulgar + índice)", "Seleccionar / hacer clic"],
      ["✋", "Palma abierta 1 s", "Abrir o cerrar el menú"],
      ["👋", "Deslizar la palma ← →", "Girar el menú circular"],
      ["✊", "Puño cerrado", "Volver / cerrar panel"],
      ["✌️", "Dos dedos (V)", "Activar el micrófono"],
    ],
  },
  en: {
    chat: "Chat", voice: "Voice", languages: "Languages", translator: "Translator",
    notes: "Notes", system: "System", settings: "Settings", help: "Help",
    greeting: "Systems online. Good day, sir. How may I help you?",
    placeholder: "Type or talk to NIKOLAI…", send: "Send", listen: "Listen",
    listening: "Listening…", thinking: "Thinking…", searching: "Searching the web…", idle: "Standing by",
    wakeOn: "Wake word “Nikolai” enabled", wakeOff: "Wake word disabled",
    wakeToggle: "Continuous listening (say “Nikolai”)", translate: "Translate", targetLang: "Translate to",
    translateHint: "Text to translate…", addNote: "Save note", noteHint: "New note…", noNotes: "No notes yet.",
    camera: "Camera", hand: "Hand", detected: "detected", none: "not detected", time: "Time", date: "Date",
    battery: "Battery", network: "Network", online: "online", offline: "offline", brain: "AI core",
    ready: "ready", noKey: "no API key", fps: "FPS",
    speakReplies: "Speak replies aloud", speechRate: "Speech rate", sensitivity: "Cursor smoothing",
    dwell: "Dwell click (hold your finger)", showCam: "Show camera", startCam: "Start camera",
    camDenied: "Could not access the camera.", close: "Close", clear: "Clear conversation",
    errAuth: "My core has no API key. Please set ANTHROPIC_API_KEY on the server.",
    errGeneric: "There was interference in my systems. Please try again.",
    errRefusal: "I'm afraid I can't help with that.",
    helpTitle: "Hand gestures",
    helpItems: [
      ["☝️", "Index finger up", "Move the holographic cursor"],
      ["🤏", "Pinch (thumb + index)", "Select / click"],
      ["✋", "Open palm for 1 s", "Open or close the menu"],
      ["👋", "Swipe palm ← →", "Rotate the radial menu"],
      ["✊", "Closed fist", "Back / close panel"],
      ["✌️", "Two fingers (V)", "Activate the microphone"],
    ],
  },
  fr: {
    chat: "Discuter", voice: "Voix", languages: "Langues", translator: "Traducteur",
    notes: "Notes", system: "Système", settings: "Réglages", help: "Aide",
    greeting: "Systèmes en ligne. Bonjour, monsieur. Que puis-je faire pour vous ?",
    placeholder: "Écrivez ou parlez à NIKOLAI…", send: "Envoyer", listen: "Écouter",
    listening: "J'écoute…", thinking: "Je réfléchis…", searching: "Recherche sur le web…", idle: "En attente",
    translate: "Traduire", targetLang: "Traduire en", addNote: "Enregistrer", noNotes: "Aucune note.",
    errGeneric: "Une interférence a touché mes systèmes. Réessayez.",
  },
  pt: {
    chat: "Conversar", voice: "Voz", languages: "Idiomas", translator: "Tradutor",
    notes: "Notas", system: "Sistema", settings: "Ajustes", help: "Ajuda",
    greeting: "Sistemas online. Olá, senhor. Como posso ajudar?",
    placeholder: "Escreva ou fale com NIKOLAI…", send: "Enviar", listen: "Ouvir",
    listening: "Ouvindo…", thinking: "Pensando…", searching: "Pesquisando na web…", idle: "Em espera",
    translate: "Traduzir", targetLang: "Traduzir para", addNote: "Salvar nota", noNotes: "Nenhuma nota ainda.",
  },
  de: {
    chat: "Chat", voice: "Stimme", languages: "Sprachen", translator: "Übersetzer",
    notes: "Notizen", system: "System", settings: "Einstellungen", help: "Hilfe",
    greeting: "Systeme online. Guten Tag, Sir. Wie kann ich helfen?",
    placeholder: "Schreiben oder mit NIKOLAI sprechen…", send: "Senden", listen: "Zuhören",
    listening: "Ich höre…", thinking: "Ich denke nach…", searching: "Suche im Web…", idle: "Bereit",
    translate: "Übersetzen", targetLang: "Übersetzen nach", addNote: "Notiz speichern", noNotes: "Noch keine Notizen.",
  },
  it: {
    chat: "Parla", voice: "Voce", languages: "Lingue", translator: "Traduttore",
    notes: "Note", system: "Sistema", settings: "Impostazioni", help: "Aiuto",
    greeting: "Sistemi online. Buongiorno, signore. Come posso aiutarla?",
    placeholder: "Scrivi o parla con NIKOLAI…", send: "Invia", listen: "Ascolta",
    listening: "Ascolto…", thinking: "Sto pensando…", searching: "Cerco sul web…", idle: "In attesa",
    translate: "Traduci", targetLang: "Traduci in", addNote: "Salva nota", noNotes: "Nessuna nota.",
  },
  ja: {
    chat: "会話", voice: "音声", languages: "言語", translator: "翻訳",
    notes: "メモ", system: "システム", settings: "設定", help: "ヘルプ",
    greeting: "システム起動完了。ご用件をどうぞ。",
    placeholder: "NIKOLAI に入力または話しかける…", send: "送信", listen: "聞く",
    listening: "聞いています…", thinking: "考え中…", searching: "ウェブ検索中…", idle: "待機中",
    translate: "翻訳", targetLang: "翻訳先", addNote: "メモを保存", noNotes: "メモはまだありません。",
  },
  zh: {
    chat: "对话", voice: "语音", languages: "语言", translator: "翻译",
    notes: "笔记", system: "系统", settings: "设置", help: "帮助",
    greeting: "系统已上线。先生，您好，有什么可以帮您？",
    placeholder: "输入或对 NIKOLAI 说话…", send: "发送", listen: "聆听",
    listening: "正在聆听…", thinking: "思考中…", searching: "正在联网搜索…", idle: "待命",
    translate: "翻译", targetLang: "翻译成", addNote: "保存笔记", noNotes: "暂无笔记。",
  },
  ko: {
    chat: "대화", voice: "음성", languages: "언어", translator: "번역기",
    notes: "메모", system: "시스템", settings: "설정", help: "도움말",
    greeting: "시스템 온라인. 무엇을 도와드릴까요?",
    placeholder: "NIKOLAI에게 입력하거나 말하세요…", send: "보내기", listen: "듣기",
    listening: "듣는 중…", thinking: "생각 중…", idle: "대기 중", translate: "번역", addNote: "메모 저장",
  },
  ru: {
    chat: "Чат", voice: "Голос", languages: "Языки", translator: "Переводчик",
    notes: "Заметки", system: "Система", settings: "Настройки", help: "Помощь",
    greeting: "Системы в сети. Добрый день, сэр. Чем могу помочь?",
    placeholder: "Напишите или скажите NIKOLAI…", send: "Отправить", listen: "Слушать",
    listening: "Слушаю…", thinking: "Думаю…", idle: "Ожидание", translate: "Перевести", addNote: "Сохранить",
  },
  ar: {
    chat: "محادثة", voice: "صوت", languages: "اللغات", translator: "مترجم",
    notes: "ملاحظات", system: "النظام", settings: "الإعدادات", help: "مساعدة",
    greeting: "الأنظمة تعمل. كيف يمكنني مساعدتك؟",
    placeholder: "اكتب أو تحدث إلى NIKOLAI…", send: "إرسال", listen: "استماع",
    listening: "أستمع…", thinking: "أفكر…", idle: "في الانتظار", translate: "ترجمة", addNote: "حفظ",
  },
  hi: {
    chat: "बातचीत", voice: "आवाज़", languages: "भाषाएँ", translator: "अनुवादक",
    notes: "नोट्स", system: "सिस्टम", settings: "सेटिंग्स", help: "मदद",
    greeting: "सिस्टम ऑनलाइन। मैं आपकी क्या मदद कर सकता हूँ?",
    placeholder: "NIKOLAI को लिखें या बोलें…", send: "भेजें", listen: "सुनें",
    listening: "सुन रहा हूँ…", thinking: "सोच रहा हूँ…", idle: "प्रतीक्षा", translate: "अनुवाद", addNote: "सहेजें",
  },
};

let current = "es";

export function setLang(code) {
  if (LANGS[code]) current = code;
  document.documentElement.lang = current;
  document.documentElement.dir = current === "ar" ? "rtl" : "ltr";
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
