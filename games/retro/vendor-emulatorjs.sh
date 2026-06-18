#!/usr/bin/env bash
# Vendor a minimal, self-hosted EmulatorJS into ./emulatorjs/data/ so 复古机 runs
# fully offline with NO dependency on cdn.emulatorjs.org.
#
# Only the cores for the consoles this tool ships are fetched (~8MB total), not the
# 289MB full release. Re-run to refresh; pin EJS_VER to a known-good version.
set -euo pipefail
EJS_VER="stable"   # EmulatorJS channel/tag served by the CDN (e.g. "stable")
BASE="https://cdn.emulatorjs.org/${EJS_VER}/data"
DEST="$(cd "$(dirname "$0")" && pwd)/emulatorjs/data"

# core .data file (libretro name) per console alias we expose in index.html
CORES=(fceumm snes9x gambatte mgba genesis_plus_gx mupen64plus_next)

# framework + support files the non-debug loader needs
FRAMEWORK=(
  loader.js
  emulator.min.js
  emulator.min.css
  version.json
  localization/en-US.json
  compression/extract7z.js
  compression/extractzip.js
  compression/libunrar.js
  compression/libunrar.wasm
)

fetch() { # <relpath>
  local rel="$1" out="$DEST/$1"
  mkdir -p "$(dirname "$out")"
  curl -fsSL "$BASE/$rel" -o "$out"
  printf '  %-44s %6sKB\n' "$rel" "$(( $(wc -c <"$out") / 1024 ))"
}

echo "Vendoring EmulatorJS ($EJS_VER) → $DEST"
for f in "${FRAMEWORK[@]}"; do fetch "$f"; done
# Two core variants per console: "-wasm.data" (webgl2, no threads — real devices on a
# plain static host) and "-legacy-wasm.data" (no webgl2 fallback). GitHub Pages sends no
# COOP/COEP, so the threaded ("-thread") variants are never used — skipped to save space.
for c in "${CORES[@]}"; do
  fetch "cores/${c}-wasm.data"
  fetch "cores/${c}-legacy-wasm.data"
  fetch "cores/reports/${c}.json"
done

# emulator.min.js hard-codes an update-check fetch to the CDN's version.json, ignoring
# EJS_pathtodata. Repoint it at the local copy so the app makes ZERO external requests.
sed -i.bak 's|https://cdn.emulatorjs.org/stable/data/version.json|./emulatorjs/data/version.json|g' "$DEST/emulator.min.js"
rm -f "$DEST/emulator.min.js.bak"
echo "  patched emulator.min.js version-check → local"

total=$(find "$DEST" -type f -exec wc -c {} + | tail -1 | awk '{print $1}')
echo "Done. Total: $(( total / 1024 / 1024 ))MB across $(find "$DEST" -type f | wc -l | tr -d ' ') files."
