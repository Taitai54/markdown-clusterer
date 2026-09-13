@echo off
REM Launch Markdown Clusterer (built app if present, otherwise dev mode)
cd /d "%~dp0"

if exist "release\win-unpacked\Markdown Clusterer.exe" (
    start "" "release\win-unpacked\Markdown Clusterer.exe"
    exit /b 0
)

echo Starting Markdown Clusterer in development mode...
call npm run dev
