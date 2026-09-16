#!/usr/bin/env bash
# Launch Markdown Clusterer (built app if present, otherwise development mode)
set -euo pipefail
cd "$(dirname "$0")"

# Load Node from common Mac install locations (Homebrew / nvm) when launched from Finder
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh"
fi

open_built_app() {
  local app="$1"
  if [[ -d "$app" ]]; then
    echo "Opening built app: $app"
    open "$app"
    exit 0
  fi
}

# Prefer Apple Silicon / Intel unpacked builds, then generic paths
open_built_app "release/mac-arm64/Markdown Clusterer.app"
open_built_app "release/mac/Markdown Clusterer.app"
open_built_app "release/mac-unpacked/Markdown Clusterer.app"

# Linux AppImage fallback (when this script is used on Linux)
shopt -s nullglob
for appimage in release/*.AppImage; do
  exec "$appimage"
done
shopt -u nullglob

if ! command -v npm >/dev/null 2>&1; then
  echo "Node/npm not found. Install Node.js, then run: npm install && ./launch.sh"
  echo "Press Enter to close..."
  read -r
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies (first run)..."
  npm install
fi

echo "Starting Markdown Clusterer in development mode..."
npm run dev
