#!/usr/bin/env bash
# Pack the hand-over for another AI session to rebuild the product from scratch in a new project:
#   START_HERE.md, BUILD_SPEC.md, HANDOFF.md at the top + reference/ = the full source (no secrets).
#
#   scripts/pack.sh                 # → dist/skipli-context-<date>.zip
#   scripts/pack.sh ~/Desktop/x.zip
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/dist/skipli-context-$(date +%Y%m%d).zip}"
case "$OUT" in /*) ;; *) OUT="$PWD/$OUT" ;; esac
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

for f in START_HERE.md BUILD_SPEC.md HANDOFF.md; do
  [[ -f "$ROOT/docs/$f" ]] || { echo "✗ docs/$f missing" >&2; exit 1; }
  cp "$ROOT/docs/$f" "$STAGE/$f"
done

# -L: copy the real file behind symlinked shared scripts.
rsync -aL "$ROOT/" "$STAGE/reference/" \
  --exclude '.git' --exclude 'dist' --exclude 'node_modules' --exclude 'web/client/dist' --exclude 'web/.data' \
  --exclude '.firebase' --exclude '*.log' --exclude '__pycache__' --exclude '*.pyc' --exclude '.DS_Store' \
  --exclude 'deploy/.env' --exclude 'deploy/firebase-key.json' --exclude '*-firebase-adminsdk-*.json'

if find "$STAGE" \( -name '.env' -o -name '*firebase-key*' -o -name '*adminsdk*' -o -name '*service-account*' \) | grep . ; then
  echo "✗ secret-looking file found, aborting" >&2; exit 1
fi

mkdir -p "$(dirname "$OUT")"; rm -f "$OUT"
(cd "$STAGE" && zip -qr -X "$OUT" .)
echo "✓ $(unzip -l "$OUT" | tail -1 | awk '{print $2}') files, $(du -h "$OUT" | cut -f1) → $OUT"
