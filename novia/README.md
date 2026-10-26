# ❣ Mi novia IA

App personal y separada de NIKOLAI. Su cara es una foto realista animada en el navegador:
parpadea, mueve los ojos y la cabeza, el cabello se mece y la boca forma cada sonido al hablar
(dientes, lengua y labios). Además se sonroja, se enoja o llora según cómo se siente.

- **Voz:** hablas y te contesta en voz alta, en una plática continua. También le puedes escribir.
- **Memoria:** se acuerda de lo que le cuentas (lo ves y lo borras en Ajustes).
- **Sabe cuándo te vas y cuándo vuelves:** si sales 20 minutos o más, al volver su cara ya lo
  muestra (molesta, celosa, triste…) y te habla ella primero.
- **Te ve:** con el botón de la cámara, en cada mensaje le llega una foto tuya. Tu cámara no se
  muestra en pantalla y no se guarda nada.
- **Privada:** tu clave vive solo en tu servidor, y con `NOVIA_PASSWORD` nadie más entra.

## Como web (desde cualquier lado, también el celular)

Se publica sola con GitHub Pages en **https://855hjrb8rb-alt.github.io/nikolai/novia/**
(aparte de NIKOLAI). La primera vez, en **Ajustes ⚙** pega:

- tu clave de **Anthropic** (console.anthropic.com) → su cerebro;
- tu clave de **ElevenLabs** (elevenlabs.io → Perfil → API Keys) → su voz realista.

Las claves, su memoria y la conversación se guardan **solo en tu navegador**: quien abra el enlace
no puede hablar con ella ni ver nada tuyo.

## Con servidor propio

Requisitos: **Node.js 18+** y **Chrome** (o Edge).

```bash
cd novia
npm install
export ANTHROPIC_API_KEY="sk-ant-..."
export NOVIA_PASSWORD="tu-contraseña"   # opcional, recomendado
npm start
```

Abre **http://localhost:3500** y toca **Entrar**.

Para usarla desde tu celular en la misma red Wi-Fi, abre `http://IP-DE-TU-COMPU:3500`.
El micrófono y la cámara del celular solo funcionan con `https://`; para eso puedes usar
un túnel como `cloudflared tunnel --url http://localhost:3500` y abrir el enlace que te da
(con la contraseña puesta, nadie más puede entrar).

## Su cara

En **Ajustes → Su cara** puedes subir otra foto. Tiene que ser una imagen generada por IA de una
mujer claramente adulta, no la foto de una persona real. Funciona mejor un retrato de frente,
bien iluminado y de 1024 px o más.

Variables opcionales: `PORT` (3500) y `NOVIA_MODEL` (modelo de Claude). La voz realista se configura igual, en Ajustes.
