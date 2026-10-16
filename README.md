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

## 🎞️ Cine 16 — estudio de película antigua

Web aparte en `public/cine16/` (en GitHub Pages: `https://855hjrb8rb-alt.github.io/nikolai/cine16/`).

- **Estudio 16 mm**: carga un vídeo, unas fotos o la cámara y conviértelos en 16 mm Kodachrome, noticiero en blanco y negro de 1945,
  Super 8, Ektachrome, cine mudo o Super 16. Puedes ajustar la resolución (240p a 4K), el formato del cuadro (4:3, 1.37, 1.66, 16:9, 2.39),
  la cadencia (12 a 24 fps), el grano, las rayas, el polvo, el parpadeo, el temblor, la halación, las fugas de luz, las perforaciones, la colilla con cuenta atrás y el sonido viejo con ruido de proyector.
  **Crear película** graba el resultado (MP4 o WebM) y lo descarga. Todo se procesa en el navegador.
- **Las cintas · El Hombre en el Castillo**: catálogo de las películas de otros mundos de la serie, de la temporada 1 a la 4, con resumen,
  enlace a Prime Video, búsqueda del clip y una reconstrucción original con efecto de película. La serie tiene derechos de autor, así que no se aloja
  ningún fragmento. Si tienes tu propia copia de un clip, puedes adjuntarla a su ficha: se guarda solo en tu navegador y se reproduce con el efecto.

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
| Dos aplausos | Enciende a NIKOLAI y pone tu canción desde el principio: por defecto «Should I Stay or Should I Go» de The Clash (se cambia en Música) |
| Decir «despierta» / «duérmete» | Enciende o pone en reposo a NIKOLAI |

La detección de la mano corre **100 % en tu navegador** (MediaPipe Hand Landmarker); el vídeo nunca sale de tu equipo.

## 🧭 Módulos

Tarjetas de cristal en un anillo 3D (la del centro en oro) y una **barra de accesos** arriba, como un escritorio.

| Módulo | Qué hace |
|---|---|
| **Núcleo IA** | Activar/pausar la voz, modo conversación o palabra clave, **velocidad de la IA** (Rápida · Equilibrada · Máxima), clave de Anthropic. |
| **Google Maps** | Google Maps dentro de NIKOLAI. **Sin clave:** buscar, mapa / satélite / relieve, zoom, Street View y rutas (abren en Google Maps). **Con tu clave de Google** (gratis para uso personal normal): el mapa completo con el **muñequito de Street View**, vista 45°, tráfico, transporte público, ciclovías, mi ubicación y el **helicóptero UH-1** para volar sobre el satélite. Análisis de la zona con IA. |
| **Ver juntos** | Abre Netflix, Prime Video, Disney+, Max, ViX, Apple TV+, Crunchyroll o YouTube y NIKOLAI te acompaña como compañera de sofá: reacciona, opina, responde quién es quién y cuenta curiosidades **sin spoilers** (lleva la cuenta del episodio y el minuto). **Compañera flotante** encima de la película (Chrome/Edge), comentarios automáticos, «mira mi pantalla» (no funciona con Netflix/Prime, que protegen el video) y recomendaciones de qué ver. |
| **Estudio** | Sube una **foto o video** y pide con tus palabras cómo transformarlo: filtros (blanco y negro, vintage, cálido, cine…), caricatura, dibujo a lápiz, pixel art, recortes (cuadrado, historia 9:16), girar, espejo, zoom, textos y stickers, marco; en video además cámara lenta o rápida, recortar segundos y quitar el sonido. Guarda la foto o crea el video. Opcional: **IA generativa** (OpenAI, con tu clave) para cambiar el fondo, estilos Pixar/anime, quitar o añadir cosas. |
| **Personalidades** | **NIKOLAI** (tipo JARVIS), **Abogado** con el estilo de Harvey Specter de *Suits* (orientación legal general, estrategia y negociación) **Mejor amiga** cariñosa y muy humana, y **Mr. House** (Robert House de *Fallout: New Vegas*) en su monitor verde, estratega visionario, y **John F. Kennedy** (recreación histórica: recuerda su vida hasta el 22 de noviembre de 1963 y no sabe en qué año estamos), en una tele de los 60. Cada una con su voz. Por voz: «modo abogado», «modo amiga». |
| **Emociones** (opcional) | NIKOLAI siente de forma simulada: feliz, cariñosa, triste, llora, se preocupa, celos de broma y berrinches pasajeros; si tardas en volver te extraña y pregunta dónde estabas. Cambian su cara (lágrimas, ceño, rubor), su voz y el indicador de ánimo. Suaves o intensas. Nunca chantajea ni manipula. |
| **Videollamada** | Pantalla completa con un avatar holográfico animado (mueve la boca al hablar, parpadea, mira) y tu cámara con **zoom**. Dile «mírame» o toca el ojo y ella te ve (solo envía una foto cuando tú quieres). |
| **Trabajo** | Currículum, carta de presentación, **simulacro de entrevista** (te pregunta, califica y corrige), correos profesionales, negociar sueldo y perfil de LinkedIn. Copiar y descargar. |
| **Proyectos** | Tablero por hacer / en curso / hecho, fecha límite y avance; **Planear con IA** divide el proyecto en tareas, **Siguiente paso** y **Pitch**. |
| **Dinero** | **Meta del millón** (interés compuesto, gráfica y cuánto ahorrar al mes), **presupuesto** con regla 50/30/20 y análisis con IA, **hábitos** con racha, **ideas de negocio** y **mentora** (plan para tu primer millón, aprender a invertir, vender más). |
| **Chat** | Chat escrito con formato y fórmulas; NIKOLAI puede leer sus respuestas en voz alta. Dictado por voz. |
| **Tareas** | Resolver paso a paso, explicar, resumir, redactar, corregir, **cuestionarios interactivos** y **tarjetas de estudio**. Nivel primaria → universidad. **Foto del ejercicio**. |
| **Bolsa y Cripto** | Terminal estilo Wall Street: estado de NYSE/Nasdaq, BMV, Londres y Tokio con cuenta atrás y **campana de apertura**, cinta de cotizaciones, S&P 500 · Nasdaq · Dow · VIX, las que más suben/bajan, mapa del mercado, todas las acciones, análisis de una acción (gráfico, análisis técnico, perfil y finanzas), **mi lista**, calendario económico, miedo y codicia, cripto en vivo y **análisis con IA** con datos actuales. |
| **Música** | Spotify: listas listas para usar sin cuenta (concentración, lo-fi, éxitos, Top 50 México…), pegar cualquier enlace, y **conectar tu cuenta** para buscar, ver qué suena y controlar la reproducción (Premium). Por voz: «pon música para estudiar». |
| **Noticias** | **Titulares reales con foto que se actualizan solos cada día** (GDELT, Google Noticias, BBC, El País, Infobae, CNN… sin gastar tu clave). Por **región** (Estados Unidos, México, Europa, mundo, mi ciudad) y **tema** (principales, **bolsa y mercados**, economía, política, tecnología, deportes, ciencia, salud, espectáculos) con fuentes. En Bolsa: índices en vivo de la región y titulares del mercado en tiempo real. **Resumen USA · México · Europa** en un toque, preguntas sobre las noticias y lectura en voz alta. |
| **Clima** | Ahora, por horas y 7 días; **viento** (brújula, ráfagas, escala Beaufort), **lluvia y neblina** (mm por hora, cuándo empieza, visibilidad), **huracanes** activos con distancia a ti (NHC/GDACS) y resumen con IA, **mapa en vivo** (viento, lluvia, tormentas, neblina, oleaje) y avisos automáticos (ráfagas, lluvia intensa, tormentas, neblina, UV, calor, frío). |
| **Herramientas** | Calculadora científica y temporizador de estudio con aviso por voz. |
| **Emergencia** | Llamar al 911, llamar a tu contacto, enviar tu ubicación por SMS y sirena. |
| **Voz** | **Voz premium tipo JARVIS** (ElevenLabs con tu clave: George, Daniel, Alice… o cualquier voz de su biblioteca) con **efecto holográfico**; voces del sistema femenina / masculina, estilos (Natural, JARVIS, Suave, Rápida), todas las voces del sistema con su calidad, velocidad y tono. |
| **Traductor** | Habla y escucha la traducción. |
| **Memoria** | Recuerdos que tú decides guardar (texto, categoría, fecha y foto opcionales). NIKOLAI los usa para conocerte; se activa o apaga cuando quieras. Por voz: «recuerda que…» / «olvida…». Copia de seguridad para descargar e importar. |
| **Notas** | Notas dictadas que NIKOLAI puede leer. |
| **Idioma** | 12 idiomas. |
| **Sin conexión** | Funciona sin internet el tiempo que haga falta: NIKOLAI básica (hora, fecha, temporizador, cuentas, notas, recuerdos, clima guardado, emergencias), preguntas pendientes que se responden al volver la conexión, paquete descargable (app, detector de manos, fuentes) y **ahorro de batería**. |
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
- «Recuerda que mi perro se llama Rocky» / «Olvida lo de Rocky»

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
- **Los aplausos no ponen la música:** en Música sube la **sensibilidad**, toca la pantalla una vez (el navegador lo exige para usar micrófono y sonido) y mira el **registro de voz** en Sistema: si aparece «Doble aplauso» pero no suena, toca ▶ en el reproductor.
- **Se escucha a sí mismo:** usa auriculares o el modo palabra clave.
- **«Mi núcleo no tiene clave API»:** exporta `ANTHROPIC_API_KEY` antes de `npm start`.
