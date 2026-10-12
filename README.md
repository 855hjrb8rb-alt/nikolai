# ⚡ NIKOLAI — Asistente de IA tipo JARVIS

Interfaz holográfica que controlas **solo con la voz y con los dedos** (cámara).
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

## 🧭 Módulos del carrusel

Tarjetas de cristal en un anillo 3D a tu alrededor; la del centro se marca en oro. Cada una muestra telemetría real.

| Módulo | Qué hace |
|---|---|
| **M-01 Núcleo IA** | Activar/pausar la voz, modo conversación o palabra clave, último intercambio. |
| **M-02 Voz** | Elegir la voz (prioriza las voces neuronales/naturales del sistema), velocidad y tono. |
| **M-03 Idioma** | 12 idiomas: cambia interfaz, micrófono y voz. |
| **M-04 Traductor** | Pulsa, habla, y escucha la traducción en el idioma elegido. |
| **M-05 Notas** | Dictar notas por voz y que te las lea. |
| **M-06 Sistema** | Núcleo IA, cámara (FPS), mano, red, batería, latencia, nivel del micrófono. |
| **M-07 Gestos** | Activar/desactivar toque en el aire, pellizco y permanencia; suavizado del cursor. |
| **M-08 Protocolos** | Recordatorio de gestos y comandos de voz. |

### Comandos de voz

- «Abre el traductor», «cierra eso», «abre las notas»
- «Habla en inglés» → cambia todo el sistema de idioma
- «Apunta comprar pan» / «Lee mis notas»
- «¿Qué tiempo hace en Ciudad de México?» → busca en la web y responde

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
- `public/js/voice.js` — reconocimiento de voz, síntesis frase a frase y medidor del micrófono.
- `public/js/i18n.js` — textos de la interfaz en 12 idiomas.
- `public/js/app.js` — carrusel 3D de módulos, ciclo de voz continuo y cursor imantado.

## ❓ Problemas frecuentes

- **No se ve la cámara:** la cámara solo funciona en `localhost` o en `https`. Revisa los permisos del navegador.
- **El micrófono no funciona:** usa Chrome o Edge; Firefox no soporta el reconocimiento de voz.
- **El cursor tiembla:** sube el «Suavizado del cursor» en el módulo Gestos y busca buena iluminación.
- **El toque en el aire no entra:** empuja el dedo de forma corta y decidida hacia la cámara, o usa el pellizco.
- **Se escucha a sí mismo:** usa auriculares o el modo palabra clave.
- **«Mi núcleo no tiene clave API»:** exporta `ANTHROPIC_API_KEY` antes de `npm start`.
