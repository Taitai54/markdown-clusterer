@echo off
cd /d "%~dp0"

if exist "release\win-unpacked\Markdown Clusterer.exe" (
  start "" "release\win-unpacked\Markdown Clusterer.exe"
) else (
  echo Starting Markdown Clusterer in development mode...
  npm run dev
)
