#!/usr/bin/env bash
# Scaffold a new self-contained PWA game from template/ into games/<id>/.
# Usage: ./new-game.sh <id> "<Display Name>" "<one-line description>"
# Then paste the printed registry snippet into games.json (under "games").
set -euo pipefail

id="${1:-}"; name="${2:-}"; short="${3:-A small grid-tile game.}"
if [ -z "$id" ] || [ -z "$name" ]; then
  echo "usage: $0 <id> \"<Display Name>\" \"<description>\"" >&2
  exit 1
fi
case "$id" in *[!a-z0-9-]*) echo "id must be lowercase letters, digits, hyphens" >&2; exit 1;; esac

root="$(cd "$(dirname "$0")" && pwd)"
dest="$root/games/$id"
[ -e "$dest" ] && { echo "games/$id already exists" >&2; exit 1; }

mkdir -p "$root/games"
cp -R "$root/template" "$dest"

# Escape sed replacement metacharacters (\ / &) so values stay safe.
esc() { printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'; }
id_esc="$(esc "$id")"; name_esc="$(esc "$name")"; short_esc="$(esc "$short")"

# Portable in-place replace (BSD/macOS + GNU sed): write to temp, move back.
replace() {
  local f="$1"
  sed -e "s/__ID__/$id_esc/g" -e "s/__NAME__/$name_esc/g" -e "s/__SHORT__/$short_esc/g" "$f" > "$f.tmp"
  mv "$f.tmp" "$f"
}
for f in "$dest"/index.html "$dest"/manifest.json "$dest"/sw.js; do replace "$f"; done

echo "Created games/$id/"
echo ""
echo "Add this entry to games.json (under \"games\"):"
cat <<EOF
    {
      "id": "$id",
      "name": "$name",
      "family": "gridbox",
      "short": "$short",
      "url": "./games/$id/",
      "color": "#3e63dd",
      "tags": []
    }
EOF
