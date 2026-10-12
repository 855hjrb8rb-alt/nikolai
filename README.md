# ⚡ NIKOLAI — Asistente de IA tipo JARVIS

Interfaz holográfica que controlas **solo con la voz y con los dedos** (cámara).
Habla **12 idiomas en la interfaz** y entiende y responde en prácticamente cualquier idioma.
Su cerebro es **Claude** (Anthropic), con búsqueda web para información actual.

![menú radial](https://img.shields.io/badge/UI-holográfica-00e5ff) ![gestos](https://img.shields.io/badge/gestos-MediaPipe-ffb300) ![IA](https://img.shields.io/badge/IA-Claude-d97757)

## 🌐 Usarlo como web (sin instalar nada)

La carpeta `public/` es una web estática completa: se puede publicar en cualquier hosting
(GitHub Pages, Netlify, Vercel, Cloudflare Pages…). Al abrirla:

1. Permite cámara y micrófono.
2. La primera vez se abre el módulo **Núcleo IA**: pega tu clave de Anthropic
   (consíguela en https://console.anthropic.com). Se guarda **solo en tu navegador**.
3. Toca la barra de voz y habla.

Cada persona que abra la web usa su propia clave; la web no guarda ninguna.

### Publicarla en GitHub Pages

Este repositorio ya incluye el despliegue automático (`.github/workflows/pages.yml`). Solo falta activarlo:

1. **Settings → Pages → Build and deployment → Source: «GitHub Actions»**.
   (En cuentas gratuitas GitHub Pages solo funciona con repositorios **públicos**.)
2. **Actions → «Publicar web» → Run workflow** (o cualquier push a la rama).
3. La web queda en `https://855hjrb8rb-alt.github.io/nikolai/`.

### Alternativa rápida: Netlify Drop

Entra en https://app.netlify.com/drop y arrastra la carpeta `public/`. Te da un enlace `https://…` al momento.

> La cámara y el micrófono solo funcionan en `https://` o en `localhost`.

## 🖥️ Con servidor propio (la clave queda en el servidor)

Requisitos: **Node.js 18+**, una webcam y **Chrome o Edge**.

```bash
npm install
export ANTHROPIC_API_KEY="sk-ant-..."
npm start
```

Abre **http://localhost:3000**. En este modo la web no pide clave.

## 🎙️ Solo voz y manos

No hay chat ni teclado: **hablas y NIKOLAI te contesta en voz alta**.

1. Toca la barra de voz (o haz el gesto ✌️) para activar el micrófono.
2. NIKOLAI saluda y se queda **escuchando**. Habla con normalidad.
3. Mientras habla, empieza a responder en voz alta frase a frase, sin esperar a terminar.
4. Al acabar vuelve a escuchar solo. Es una conversación continua.

Para cortarle, cierra el puño ✊ o toca la barra. En el módulo **Núcleo IA** puedes elegir el modo
**palabra clave**, en el que solo responde si empiezas con «Nikolai…».

## ✋ Control con los dedos

| Gesto | Acción |
|---|---|
| ☝️ Apuntar con el índice | Mueve el cursor. Se **imanta** a la opción más cercana |
| 👉 Empujar el dedo hacia la pantalla | **Toque en el aire**: pulsa la opción |
| 🤏 Pulgar + índice | Pellizco: también pulsa |
| ⏳ Dejar el dedo quieto 1,5 s | Pulsa por permanencia (se puede desactivar) |
| 👋 Deslizar la palma ← → | Gira el carrusel de módulos |
| ✋ Palma abierta 1 s | Abre el módulo central |
| ✊ Puño | Interrumpe la voz / cierra el módulo |
| ✌️ Gesto V | Activa o pausa el micrófono |

La detección de la mano corre **100 % en tu navegador** (MediaPipe Hand Landmarker); el vídeo nunca sale de tu equipo.

## 🧭 Módulos

Tarjetas de cristal en un anillo 3D (la del centro en oro) y una **barra de accesos** arriba, como un escritorio.

| Módulo | Qué hace |
|---|---|
| **Núcleo IA** | Activar/pausar la voz, modo conversación o palabra clave, clave de Anthropic. |
| **Chat** | Chat escrito con formato y fórmulas; NIKOLAI puede leer sus respuestas en voz alta. Dictado por voz. |
| **Tareas** | Resolver paso a paso, explicar, resumir, redactar, corregir, **cuestionarios interactivos** y **tarjetas de estudio**. Nivel primaria → universidad. **Foto del ejercicio**. |
| **Bolsa y Cripto** | Cripto en vivo (Binance, cada segundo), acciones e índices, **todas las acciones** (screener), mapa del mercado, gráficos y noticias del mercado (TradingView). |
| **Música** | Spotify: listas listas para usar sin cuenta (concentración, lo-fi, éxitos, Top 50 México…), pegar cualquier enlace, y **conectar tu cuenta** para buscar, ver qué suena y controlar la reproducción (Premium). Por voz: «pon música para estudiar». |
| **Noticias** | Resumen de las noticias de hoy por tema (principales, mi ciudad, mundo, economía, tecnología, deportes…) con fuentes. |
| **Clima** | Clima actual, 24 h y 7 días (Open-Meteo). |
| **Herramientas** | Calculadora científica y temporizador de estudio con aviso por voz. |
| **Emergencia** | Llamar al 911, llamar a tu contacto, enviar tu ubicación por SMS y sirena. |
| **Voz** | Voz femenina / masculina, estilos (Natural, JARVIS, Suave, Rápida), todas las voces del sistema con su calidad, velocidad y tono. |
| **Traductor** | Habla y escucha la traducción. |
| **Notas** | Notas dictadas que NIKOLAI puede leer. |
| **Idioma** | 12 idiomas. |
| **Perfil** | Nombre, **cumpleaños** (cuenta atrás y felicitación), ciudad y contacto de emergencia. |
| **Sistema · Gestos · Protocolos** | Telemetría, ajustes del control con la mano y ayuda. |

Además: **pantalla completa** e **instalar como app** en la computadora o el celular (desde la barra de accesos).

> **Emergencias:** una página web no puede hacer llamadas sola. Al pulsar «Llamar», el teléfono abre el marcador con el número listo y solo hay que confirmar. En una computadora, usa tu celular.
> Tu número de contacto se guarda solo en tu navegador (módulo Perfil), nunca en el código.

### Comandos de voz

- «Abre el traductor», «cierra eso», «abre las notas»
- «Habla en inglés» → cambia todo el sistema de idioma
- «Apunta comprar pan» / «Lee mis notas»
- «¿Qué tiempo hace en Ciudad de México?» → busca en la web y responde
- «Pon un temporizador de 25 minutos»
- «¿A cuánto está el bitcoin?» / «¿Cómo va Apple hoy?»
- «Emergencia, llama a mi contacto»

## ⚙️ Configuración (variables de entorno)

| Variable | Por defecto | Descripción |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Clave de la API de Claude (obligatoria para la IA). |
| `PORT` | `3000` | Puerto del servidor. |
| `JARVIS_MODEL` | `claude-opus-5-5` | Modelo de Claude. |
| `JARVIS_EFFORT` | `low` | Nivel de razonamiento: `low` (rápido, ideal para voz), `medium`, `high`… |
| `JARVIS_WEB_SEARCH` | activado | Pon `off` para desactivar la búsqueda web. |

## 🏗️ Arquitectura

```
navegador                                   servidor (Node)            Anthropic
┌──────────────────────────────┐   SSE    ┌────────────────┐  stream  ┌────────┐
│ cámara → MediaPipe → gestos  │ ───────▶ │ server.js       │ ───────▶ │ Claude │
│ micrófono → Web Speech API   │ ◀─────── │ /api/chat       │ ◀─────── │  + web │
│ HUD holográfico + voz (TTS)  │ acciones │ (clave segura)  │  tools   │ search │
└──────────────────────────────┘          └────────────────┘          └────────┘
```

- `public/js/brain-core.js` — instrucciones, herramientas y bucle de conversación con Claude (streaming, búsqueda web, control de la interfaz y *fallback* de modelo). Lo usan el servidor y la web estática.
- `public/js/brain.js` — elige el modo: con servidor (`/api/chat`) o directo desde el navegador con la clave guardada.
- `server.js` — modo servidor: sirve la web y guarda la clave en el servidor.
- `public/vendor/anthropic-sdk.mjs` — SDK oficial de Anthropic empaquetado para el navegador (`npm run build:vendor`).
- `public/js/gestures.js` — detección de la mano y reconocimiento de gestos.
- `public/js/voice.js` — reconocimiento de voz, síntesis frase a frase y medidor del micrófono.
- `public/js/i18n.js` — textos de la interfaz en 12 idiomas.
- `public/js/app.js` — carrusel 3D de módulos, ciclo de voz continuo y cursor imantado.

### Conectar tu Spotify

1. Entra en https://developer.spotify.com/dashboard → **Create app** (cualquier nombre) y marca **Web API**.
2. En **Redirect URIs** pega la dirección exacta de tu NIKOLAI (por ejemplo `https://855hjrb8rb-alt.github.io/nikolai/`).
3. Copia el **Client ID** y pégalo en el módulo Música → Conectar.

## ❓ Problemas frecuentes

- **Diagnóstico:** el módulo **Sistema** revisa navegador, micrófono, voz y cámara, y tiene botones para probarlos.
- **Abriste el enlace desde WhatsApp/Instagram:** esas apps bloquean cámara y micrófono. Ábrelo en Chrome o Safari (menú ⋮ → Abrir en el navegador).

- **No se ve la cámara:** la cámara solo funciona en `localhost` o en `https`. Revisa los permisos del navegador.
- **El micrófono no funciona:** usa Chrome o Edge; Firefox no soporta el reconocimiento de voz.
- **El cursor tiembla:** sube el «Suavizado del cursor» en el módulo Gestos y busca buena iluminación.
- **El toque en el aire no entra:** empuja el dedo de forma corta y decidida hacia la cámara, o usa el pellizco.
- **Se escucha a sí mismo:** usa auriculares o el modo palabra clave.
- **«Mi núcleo no tiene clave API»:** exporta `ANTHROPIC_API_KEY` antes de `npm start`.
