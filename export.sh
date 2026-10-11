#!/bin/sh
# Re-export the Game Studio project into game/: the engine is gzip-compressed and, with the game
# pack, split into 1 MB parts (listed in parts.json) so every file stays small for publishing.
# Afterwards update the part entries in mobius.json "static_assets" if the counts changed.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC=/data/apps/12/godot-src/g-vivldi
TMP="$(mktemp -d)"
"$HOME/.local/bin/godot" --headless --path "$SRC" --export-release Web "$TMP/index.html"
cp "$TMP/index.js" "$HERE/game/godot.js"
cp "$TMP/index.audio.worklet.js" "$TMP/index.audio.position.worklet.js" "$HERE/game/"
gzip -9 -c "$TMP/index.wasm" > "$TMP/index.wasm.gz"
python3 - "$TMP" "$HERE/game" <<'PY'
import json, os, sys, glob
tmp, game = sys.argv[1], sys.argv[2]
out = {}
for kind, src in (("wasm", "index.wasm.gz"), ("pck", "index.pck")):
    d = open(os.path.join(tmp, src), "rb").read()
    os.makedirs(os.path.join(game, kind), exist_ok=True)
    for old in glob.glob(os.path.join(game, kind, "part-*.bin")): os.remove(old)
    n = 0
    for i in range(0, len(d), 1 << 20):
        open(os.path.join(game, kind, "part-%03d.bin" % n), "wb").write(d[i:i + (1 << 20)]); n += 1
    out[kind] = {"count": n, "bytes": len(d)}
json.dump(out, open(os.path.join(game, "parts.json"), "w"))
print(out)
PY
rm -rf "$TMP"
echo "exported; check the part counts in mobius.json, then apply the app"
