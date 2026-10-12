# ⚡ NIKOLAI — Asistente de IA tipo JARVIS

Interfaz holográfica que controlas **con la mano** (cámara), **con la voz** y con el teclado.
Habla **12 idiomas en la interfaz** y entiende y responde en prácticamente cualquier idioma.
Su cerebro es **Claude** (Anthropic), con búsqueda web para información actual.

![menú radial](https://img.shields.io/badge/UI-holográfica-00e5ff) ![gestos](https://img.shields.io/badge/gestos-MediaPipe-ffb300) ![IA](https://img.shields.io/badge/IA-Claude-d97757)

## 🚀 Puesta en marcha

Requisitos: **Node.js 18+**, una webcam y **Chrome o Edge** (para el reconocimiento de voz).

```bash
npm install
export ANTHROPIC_API_KEY="sk-ant-..."   # tu clave de https://console.anthropic.com
npm start
```

Abre **http://localhost:3000**, permite el acceso a la cámara y al micrófono, y listo.

> Sin clave API la interfaz, los gestos, las notas y los ajustes funcionan igual; solo el «cerebro» no responderá.

## ✋ Gestos de la mano

| Gesto | Acción |
|---|---|
| ☝️ Índice extendido | Mueve el cursor holográfico |
| 🤏 Pellizco (pulgar + índice) | Clic / seleccionar (en el vacío abre la opción enfocada) |
| ⏳ Mantener el dedo quieto sobre un botón | Clic por permanencia (se puede desactivar) |
| ✋ Palma abierta 1 segundo | Abrir / cerrar el menú |
| 👋 Deslizar la palma ← → | Girar el menú circular |
| ✊ Puño cerrado | Volver / cerrar el panel |
| ✌️ Dos dedos (V) | Activar el micrófono |

La detección de la mano corre **100 % en tu navegador** (MediaPipe Hand Landmarker); el vídeo nunca sale de tu equipo.

**Teclado:** ← → girar menú · Enter abrir · Esc cerrar · Espacio hablar.

## 🧭 Opciones del menú

| Opción | Qué hace |
|---|---|
| 💬 **Conversar** | Chat con la IA, por texto o voz. Las respuestas se leen en voz alta. |
| 🎙️ **Voz** | Pulsar para hablar, **escucha continua con palabra clave «Nikolai»**, velocidad de voz. |
| 🌐 **Idiomas** | Español, English, Français, Português, Deutsch, Italiano, 日本語, 中文, 한국어, Русский, العربية, हिन्दी. Cambia la interfaz, el micrófono y la voz. |
| 🔁 **Traductor** | Traduce texto (o lo que dictes) a cualquiera de los idiomas y lo pronuncia. |
| 📝 **Notas** | Notas guardadas en tu navegador. También por voz: «Nikolai, apunta comprar leche». |
| 📊 **Sistema** | Hora, fecha, FPS de la cámara, mano detectada, batería, red, estado de la IA. |
| ⚙️ **Ajustes** | Voz on/off, clic por permanencia, suavizado del cursor, tamaño de la cámara. |
| ✋ **Ayuda** | Recordatorio de los gestos. |

### La IA controla la interfaz

NIKOLAI puede actuar sobre la pantalla cuando se lo pides:

- «Nikolai, **habla en japonés**» → cambia todo el sistema a japonés.
- «Nikolai, **abre las notas**» → abre el panel.
- «Nikolai, **recuérdame** llamar a mamá a las 6» → guarda una nota.
- «Nikolai, ¿qué **tiempo** hace en Ciudad de México?» → busca en la web y responde.

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

- `server.js` — sirve la web y hace de puente con Claude (la clave **nunca** llega al navegador). Respuestas en streaming, búsqueda web, herramientas para controlar la interfaz y *fallback* automático de modelo si un filtro de seguridad rechaza una petición.
- `public/js/gestures.js` — detección de la mano y reconocimiento de gestos.
- `public/js/voice.js` — reconocimiento de voz, palabra clave y síntesis de voz.
- `public/js/i18n.js` — textos de la interfaz en 12 idiomas.
- `public/js/app.js` — menú radial, paneles, chat y cursor holográfico.

## ❓ Problemas frecuentes

- **No se ve la cámara:** la cámara solo funciona en `localhost` o en `https`. Revisa los permisos del navegador.
- **El micrófono no funciona:** usa Chrome o Edge; Firefox no soporta el reconocimiento de voz.
- **El cursor tiembla:** sube el «Suavizado del cursor» en Ajustes y busca buena iluminación.
- **«Mi núcleo no tiene clave API»:** exporta `ANTHROPIC_API_KEY` antes de `npm start`.
