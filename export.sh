#!/bin/sh
# Re-export the Game Studio project into game/ (engine compressed to fit the app package).
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC=/data/apps/12/godot-src/g-vivldi
TMP="$(mktemp -d)"
"$HOME/.local/bin/godot" --headless --path "$SRC" --export-release Web "$TMP/index.html"
cp "$TMP/index.js" "$HERE/game/godot.js"
cp "$TMP/index.pck" "$TMP/index.audio.worklet.js" "$TMP/index.audio.position.worklet.js" "$HERE/game/"
gzip -9 -c "$TMP/index.wasm" > "$HERE/game/index.wasm.gz"
rm -rf "$TMP"
echo "exported; now apply the app"
