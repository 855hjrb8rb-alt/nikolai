#!/bin/bash
# Quita George de la Mac. Tu música (~/Music/George) no se toca.
osascript -e 'tell application "George" to quit' >/dev/null 2>&1 || true
pkill -x George >/dev/null 2>&1 || true
osascript -e 'tell application "System Events" to delete (every login item whose name is "George")' >/dev/null 2>&1 || true
rm -rf "/Applications/George.app"
read -r -p "¿Borrar también la memoria, los ajustes y los modelos de George? (s/N) " R
case "$R" in s|S) rm -rf "$HOME/Library/Application Support/George"; echo "Borrado todo.";; *) echo "Se conservan en ~/Library/Application Support/George.";; esac
echo "George desinstalado. (Ollama y Whisper siguen instalados; se quitan con: brew uninstall ollama whisper-cpp)"
