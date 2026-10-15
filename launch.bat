@echo off
REM Launch Markdown Clusterer.
REM A packaged app in release\win-unpacked is used when it exists.
REM The previous Windows build was moved out of this folder so it no longer opens by mistake.
REM Until a new build is created, this starts the current source with npm run dev.
cd /d "%~dp0"

if exist "release\win-unpacked\Markdown Clusterer.exe" (
    start "" "release\win-unpacked\Markdown Clusterer.exe"
    exit /b 0
)

echo Starting Markdown Clusterer in development mode...
call npm run dev
