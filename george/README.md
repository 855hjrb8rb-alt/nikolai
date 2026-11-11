# George — tu escritorio de cine y tu asistente, dentro de la Mac

George es una app para Mac (no es una página web) que hace dos cosas:

1. **Cambia tu pantalla** por un escritorio con estilo de película: fondo animado, reloj, tus apps
   con iconos tematizados, dock propio y música. Tapa el Dock y la barra de menús de macOS.
2. **George**, un asistente tipo mayordomo de película: habla, escucha, recuerda, te ve por la cámara
   y ve películas contigo. Funciona **sin internet** y **se queda aunque quites los estilos**.

## Instalar (una sola vez)

1. Descarga esta carpeta en tu Mac (botón verde **Code → Download ZIP** en GitHub, y descomprime).
2. Abre la carpeta `george` y haz **doble clic en `instalar.command`**.
   (Si macOS no lo deja abrir: clic derecho → Abrir.)

El instalador necesita internet solo esa vez: descarga el cerebro (Ollama + un modelo que entiende
texto e imágenes), el oído (Whisper) y construye `George.app` en **Aplicaciones**. Tarda unos minutos
y ocupa entre 4 y 9 GB según tu Mac. Después todo funciona sin conexión.

George queda puesto para **abrirse solo al encender la Mac** y vive en la **barra de menús**.
Atajo desde cualquier app: **⌥ Espacio**.

La primera vez macOS pedirá permisos: **Micrófono** (para hablarle), **Cámara** (para que te vea) y
**Grabación de pantalla** (para el modo cine; tras darlo, cierra y abre George).

## Los estilos

Diseños originales inspirados en géneros de cine (no usan logos ni imágenes de las películas):

| Estilo | Inspirado en | Qué tiene |
|---|---|---|
| 🧭 Reliquia | aventuras de arqueólogos de los años 30 | mapa antiguo, ruta roja que avanza, sellos de lacre |
| ⚛️ Reactor | armaduras con interfaz holográfica | anillos HUD, hexágonos cian |
| 🚂 Expreso del Norte | el tren de Nochebuena | aurora, tren con ventanas encendidas, boletos dorados, nieve |
| 🌌 Galaxia Lejana | ópera espacial | salto al hiperespacio, planeta, dos soles, hologramas |
| 🎖️ Cuartel 1944 | Segunda Guerra Mundial | sala de mapas, radar, teletipo, fichas selladas |
| 🎄 Navidad Clásica | Navidad con crooners | luces, chimenea, esferas, nieve |
| 🪄 Colegio de Magia | escuelas de magos | velas flotantes, medallones |
| 🟩 Código | lluvia digital | cascada de símbolos verdes |
| 🌃 Neón 2049 | ciencia ficción de neón | sol synthwave, lluvia |
| 🦖 Isla Jurásica | parques de dinosaurios | selva, luciérnagas, ámbar |

- Cambia de estilo con el botón de arriba a la izquierda, desde la barra de menús o diciéndole a
  George «pon el estilo de Star Wars».
- **Nieve:** botón ❄ (arriba a la derecha) o «George, quita la nieve». Se puede poner en cualquier estilo.
- **Quitar los estilos:** Estilos → «Quitar los estilos». Vuelve tu Mac normal y George se queda como
  ventana flotante y en la barra de menús.
- **Apps:** el dock de abajo tiene tus favoritas; el último botón abre todas. Escribe en cualquier
  momento para buscar una app; clic derecho en una app la fija o la quita del dock.
- **Iconos:** las apps conocidas llevan un icono dibujado con el color del estilo y el resto, su icono
  real teñido. Si prefieres los originales: Ajustes → General.

## La música

Cada estilo trae una **partitura original** que George genera en vivo (marcha de aventuras, fanfarria
espacial, swing de los 40, jazz navideño…). Funciona sin internet.

La música de las películas y las canciones de Frank Sinatra tienen derechos de autor, así que no
pueden venir dentro de la app. Para oírlas, usa **las tuyas**:

- **Tus archivos:** pulsa 📁 en el reproductor y mete ahí tus canciones (mp3, m4a, wav…). Cada estilo
  tiene su carpeta en `Música/George/<estilo>` (por ejemplo `navidad` para tu Sinatra). Al entrar al
  estilo suenan esas en vez de la partitura.
- **App Música / Apple Music:** crea una lista llamada como indica Ajustes → Música (por ejemplo
  `George – Navidad`) y pulsa ♫. Si no existe, ♫ abre la búsqueda de la banda sonora en Apple Music.

## George

- **Chat o voz:** escríbele, o pulsa «Voz» para manos libres: di «George, …» y te contesta en voz alta.
  Mientras él habla, la música baja sola.
- **Sin internet:** piensa con un modelo local (Ollama), oye con Whisper y habla con las voces de macOS.
- **Voz natural:** descarga una voz *Premium* o *Mejorada* en Ajustes del Sistema → Accesibilidad →
  Contenido hablado → Voz del sistema → Gestionar voces (por ejemplo «Jorge» en español o «Daniel» en
  inglés británico). George elige sola la mejor instalada; también puedes escogerla en Ajustes → George.
- **Idiomas:** responde en el idioma en que le hables y sabe traducir y conversar en lenguas antiguas
  (latín, griego antiguo, náhuatl clásico…). Con modelos locales pequeños las lenguas raras pueden
  tener errores; en una Mac con 24 GB o más se instala un modelo mayor y mejora.
- **Memoria:** recuerda lo que le cuentas («recuerda que…» o solo, cuando es importante). La ves y la
  borras en Ajustes → Memoria. Se guarda solo en tu Mac.
- **Te ve:** botón «Cámara». Lo que ve no se guarda.
- **Modo cine:** botón «Cine» o «George, veamos una película». Mira la pantalla cada cierto tiempo y
  comenta de vez en cuando; pregúntale lo que quieras sobre lo que están viendo. Nota: Netflix, Apple TV
  y otros servicios con protección se ven en negro al capturar la pantalla (lo impide el servicio);
  funciona con tus archivos de vídeo, YouTube, etc.
- **Órdenes rápidas** (funcionan incluso sin el cerebro instalado): «pon el estilo navidad», «quita la
  nieve», «pon música», «siguiente canción», «abre Safari», «enciende la cámara», «quita los estilos».
- **Cara:** por defecto, un rostro holográfico que parpadea y mueve la boca. En Ajustes → Cara puedes
  subir un retrato realista **generado por IA** (por ejemplo hecho en Higgsfield) y George lo anima.

## Quitar George

Doble clic en `desinstalar.command`. También puedes salir desde la barra de menús → «Salir de George»
y desmarcar «Abrir al encender la Mac».

## Para desarrollar

```bash
npm install
npm start        # abre la app sin instalarla
npm run check    # revisa la sintaxis
```

Carpetas: `main.js` (ventanas, voz, oído, pantalla, Ollama), `ui/` (escritorio y George),
`ui/js/themes.js` (para añadir o cambiar estilos).
