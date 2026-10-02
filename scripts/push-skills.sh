#!/usr/bin/env bash
# Zip each skill under skills/ (SKILL.md at the zip root) and upload it to GoClaw.
#
# Usage:
#   scripts/push-skills.sh                 # push every skill
#   scripts/push-skills.sh fb-reel-reader  # push only the named skill(s)
#   DRY_RUN=1 scripts/push-skills.sh       # build zips into dist/ without uploading
#
# Env (read from deploy/.env if present):
#   GOCLAW_URL            default http://localhost:18790
#   GOCLAW_GATEWAY_TOKEN  required unless DRY_RUN=1
#   GOCLAW_USER_ID        X-GoClaw-User-Id header, default "system"
#   GOCLAW_AGENT_IDS      optional comma-separated agent UUIDs to grant the skill to
#
# GoClaw versions skills by a hash of SKILL.md: an unchanged skill returns
# status "unchanged"; a changed one becomes version N+1. The zip's SKILL.md gets a
# `build:` fingerprint of all files so script-only changes also count as changes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/deploy/.env" ]]; then
  # Values passed in the environment win over deploy/.env (e.g. GOCLAW_AGENT_IDS=... scripts/push-skills.sh).
  pre_env="$(export -p)"
  set -a; source "$ROOT/deploy/.env"; set +a
  eval "$pre_env"
fi

GOCLAW_URL="${GOCLAW_URL:-http://localhost:18790}"
GOCLAW_USER_ID="${GOCLAW_USER_ID:-system}"
DIST="$ROOT/dist"
mkdir -p "$DIST"

if [[ -z "${DRY_RUN:-}" && -z "${GOCLAW_GATEWAY_TOKEN:-}" ]]; then
  echo "GOCLAW_GATEWAY_TOKEN is not set (set it in deploy/.env or the shell)" >&2
  exit 1
fi

if [[ $# -gt 0 ]]; then
  names=("$@")
else
  names=()
  for d in "$ROOT"/skills/*/; do names+=("$(basename "$d")"); done
fi

failed=0
for name in "${names[@]}"; do
  dir="$ROOT/skills/$name"
  if [[ ! -f "$dir/SKILL.md" ]]; then
    echo "✗ $name: $dir/SKILL.md not found" >&2
    failed=1; continue
  fi

  zip="$DIST/$name.zip"
  rm -f "$zip"
  # GoClaw decides "unchanged" from a hash of SKILL.md alone, so a script-only edit would be
  # silently ignored. Stamp a fingerprint of every file into the frontmatter of a temp copy.
  stage="$(mktemp -d)"
  rsync -a --exclude '__pycache__' --exclude '*.pyc' --exclude '.DS_Store' "$dir/" "$stage/"
  build="$(cd "$stage" && find . -type f ! -name SKILL.md -print0 | sort -z | xargs -0 shasum -a 256 | cat - SKILL.md | shasum -a 256 | cut -c1-12)"
  awk -v b="$build" 'NR > 1 && !done && /^---[[:space:]]*$/ { print "build: " b; done = 1 } { print }' "$dir/SKILL.md" > "$stage/SKILL.md"
  (cd "$stage" && zip -qr -X "$zip" .)
  rm -rf "$stage"

  if [[ -n "${DRY_RUN:-}" ]]; then
    echo "• $name → ${zip#$ROOT/} (dry run)"
    continue
  fi

  form=(-F "file=@$zip;type=application/zip")
  if [[ -n "${GOCLAW_AGENT_IDS:-}" ]]; then
    # GoClaw expects a JSON array of agent UUIDs.
    ids_json="[$(printf '%s' "$GOCLAW_AGENT_IDS" | tr -d ' ' | sed 's/[^,][^,]*/"&"/g')]"
    form+=(-F "manager_agent_ids=$ids_json")
  fi

  resp="$(curl -sS -w $'\n%{http_code}' -X POST "$GOCLAW_URL/v1/skills/upload" \
    -H "Authorization: Bearer $GOCLAW_GATEWAY_TOKEN" \
    -H "X-GoClaw-User-Id: $GOCLAW_USER_ID" \
    "${form[@]}")" || { echo "✗ $name: cannot reach $GOCLAW_URL" >&2; failed=1; continue; }
  code="${resp##*$'\n'}"
  body="${resp%$'\n'*}"

  if [[ "$code" == 2* ]]; then
    echo "✓ $name ($code): $body"
  else
    echo "✗ $name ($code): $body" >&2
    failed=1
  fi
done

exit "$failed"
