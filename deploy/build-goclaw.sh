#!/usr/bin/env bash
# Build skipli/goclaw:patched: upstream GoClaw at the commit the patch was made on, plus the browser fix.
# Run on the server (or any machine with Docker), from anywhere:  bash deploy/build-goclaw.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="${GOCLAW_SRC:-$HERE/.goclaw-src}"
COMMIT=52ced371

if [ ! -d "$SRC/.git" ]; then
  git clone https://github.com/nextlevelbuilder/goclaw.git "$SRC"
fi
cd "$SRC"
git fetch --quiet origin
git checkout --quiet --force "$COMMIT"
git clean --quiet -fd
git apply "$HERE/goclaw-patches/browser-settle-and-cookie-sync.patch"

docker build -t skipli/goclaw:patched \
  --build-arg ENABLE_EMBEDUI=true --build-arg ENABLE_PYTHON=true \
  --build-arg VERSION=v3.15.0-beta.225-skipli .

echo "Built skipli/goclaw:patched. The patched cookie-sync extension is in $SRC/extensions/chrome-selected-cookie-sync/"
