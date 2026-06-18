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

fetch_opt() { # <relpath> — like fetch but tolerates a 404 (optional asset)
  local rel="$1" out="$DEST/$1"
  mkdir -p "$(dirname "$out")"
  if curl -fsSL "$BASE/$rel" -o "$out" 2>/dev/null; then
    printf '  %-44s %6sKB\n' "$rel" "$(( $(wc -c <"$out") / 1024 ))"
  else
    printf '  %-44s %s\n' "$rel" "(skipped: not on CDN)"
  fi
}

echo "Vendoring EmulatorJS ($EJS_VER) → $DEST"
for f in "${FRAMEWORK[@]}"; do fetch "$f"; done
# Three core variants per console:
#   "-wasm.data"        webgl2, single-thread  (default on a plain static host)
#   "-legacy-wasm.data" no-webgl2 fallback, single-thread
#   "-thread-wasm.data" threaded (SharedArrayBuffer) — used ONLY when the page is
#                       cross-origin isolated. We now inject COOP/COEP via the service
#                       worker (coi technique) so threads work on GitHub Pages too, hence
#                       the "-thread" variants are vendored. EJS_threads gates them on at
#                       runtime (desktop/Android only; iOS stays single-thread).
for c in "${CORES[@]}"; do
  fetch "cores/${c}-wasm.data"
  fetch "cores/${c}-legacy-wasm.data"
  fetch "cores/${c}-thread-wasm.data"
  fetch "cores/reports/${c}.json"
done

# PSP (ppsspp) — the CDN ships ONLY the threaded build (no -wasm/-legacy), the core
# *requires* both threads and WebGL2, and it needs its own ~11MB asset bundle. So PSP is
# desktop-only in practice (iOS = no stable threads + the WebGL2 polygon_mode crash).
fetch     "cores/ppsspp-thread-wasm.data"
fetch     "cores/ppsspp-assets.zip"
fetch_opt "cores/reports/ppsspp.json"

# emulator.min.js hard-codes an update-check fetch to the CDN's version.json, ignoring
# EJS_pathtodata. Repoint it at the local copy so the app makes ZERO external requests.
sed -i.bak 's|https://cdn.emulatorjs.org/stable/data/version.json|./emulatorjs/data/version.json|g' "$DEST/emulator.min.js"
rm -f "$DEST/emulator.min.js.bak"
echo "  patched emulator.min.js version-check → local"

total=$(find "$DEST" -type f -exec wc -c {} + | tail -1 | awk '{print $1}')
echo "Done. Total: $(( total / 1024 / 1024 ))MB across $(find "$DEST" -type f | wc -l | tr -d ' ') files."
