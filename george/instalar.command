#!/bin/bash
# Instalador de George para Mac. Haz doble clic (o ejecútalo en Terminal).
# Necesita internet SOLO esta vez, para descargar el cerebro, el oído y las piezas.
# Después George funciona sin internet.
set -e
cd "$(dirname "$0")"

paso() { printf "\n\033[1;36m▶ %s\033[0m\n" "$1"; }
aviso() { printf "\033[1;33m! %s\033[0m\n" "$1"; }

[ "$(uname)" = "Darwin" ] || { echo "Este instalador es para macOS."; exit 1; }

paso "1/6 · Homebrew"
if ! command -v brew >/dev/null 2>&1; then
  [ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
  [ -x /usr/local/bin/brew ] && eval "$(/usr/local/bin/brew shellenv)"
fi
if ! command -v brew >/dev/null 2>&1; then
  echo "Instalando Homebrew (te pedirá la contraseña de tu Mac)…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  [ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
  [ -x /usr/local/bin/brew ] && eval "$(/usr/local/bin/brew shellenv)"
fi

paso "2/6 · Herramientas (Node, Ollama, Whisper)"
command -v node >/dev/null 2>&1 || brew install node
command -v ollama >/dev/null 2>&1 || brew install ollama
command -v whisper-cli >/dev/null 2>&1 || brew install whisper-cpp || aviso "No se pudo instalar whisper-cpp: George funcionará por chat, sin micrófono."

paso "3/6 · Cerebro de George (modelo local)"
RAM_GB=$(( $(sysctl -n hw.memsize) / 1073741824 ))
if [ "$RAM_GB" -ge 24 ]; then MODELO="gemma3:12b"; else MODELO="gemma3:4b"; fi
echo "Tu Mac tiene ${RAM_GB} GB de memoria → modelo ${MODELO} (entiende texto e imágenes, en muchos idiomas)."
brew services start ollama >/dev/null 2>&1 || (ollama serve >/dev/null 2>&1 &)
for i in $(seq 1 30); do curl -fs http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break; sleep 1; done
ollama pull "$MODELO" || aviso "No se pudo descargar el modelo. Luego puedes ejecutar: ollama pull $MODELO"

paso "4/6 · Oído (Whisper) y modelo de caras"
MODELOS="$HOME/Library/Application Support/George/models"
mkdir -p "$MODELOS"
bajar() { # url destino
  [ -s "$2" ] && { echo "Ya está: $(basename "$2")"; return 0; }
  curl -fL --progress-bar -o "$2.part" "$1" && mv "$2.part" "$2"
}
bajar "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin" "$MODELOS/ggml-large-v3-turbo-q5_0.bin" \
  || bajar "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin" "$MODELOS/ggml-small.bin" \
  || aviso "No se pudo descargar el modelo de Whisper: sin micrófono por ahora."
bajar "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" "$MODELOS/face_landmarker.task" \
  || aviso "No se pudo descargar el modelo de caras: la foto de George se verá sin animar."

paso "5/6 · Construyendo la app"
npm install --no-audit --no-fund
rm -rf dist
npx electron-builder --mac dir
APP=$(find dist -maxdepth 2 -name "George.app" | head -1)
[ -d "$APP" ] || { echo "No se pudo construir George.app"; exit 1; }
codesign --force --deep --sign - "$APP"

paso "6/6 · Instalando en Aplicaciones"
osascript -e 'tell application "George" to quit' >/dev/null 2>&1 || true
pkill -x George >/dev/null 2>&1 || true
sleep 1
rm -rf "/Applications/George.app"
cp -R "$APP" "/Applications/George.app"
xattr -cr "/Applications/George.app" 2>/dev/null || true
mkdir -p "$HOME/Music/George"
open "/Applications/George.app"

printf "\n\033[1;32m✔ George está instalado.\033[0m\n"
cat <<'FIN'
  · Se abre solo al encender la Mac y vive en la barra de menús.
  · Atajo para llamarlo desde cualquier app: ⌥ Espacio.
  · La primera vez macOS pedirá permiso para el micrófono, la cámara y
    (para el modo cine) la grabación de pantalla.
  · Para una voz más natural descarga una voz Premium en
    Ajustes del Sistema → Accesibilidad → Contenido hablado → Voz del sistema.
FIN
