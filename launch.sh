#!/usr/bin/env bash
# Launch Markdown Clusterer (built app if present, otherwise dev mode)
cd "$(dirname "$0")"

if [[ -d "release/mac-unpacked/Markdown Clusterer.app" ]]; then
  open "release/mac-unpacked/Markdown Clusterer.app"
  exit 0
fi

if [[ -d "release/mac/Markdown Clusterer.app" ]]; then
  open "release/mac/Markdown Clusterer.app"
  exit 0
fi

for appimage in release/*.AppImage; do
  [[ -f "$appimage" ]] && { exec "$appimage"; exit 0; }
done

echo "Starting Markdown Clusterer in development mode..."
npm run dev
