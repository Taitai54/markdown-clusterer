# Desktop shortcut and icon

Use the launchers from anywhere (e.g. desktop) and optionally give the shortcut a custom icon.

## Launchers

- **Windows:** `launch.bat` or `markdowncluster.bat`  
  - Runs the built app from `release\win-unpacked\Markdown Clusterer.exe` if it exists (no terminal window).  
  - Otherwise runs `npm run dev` (needs Node; terminal stays open).
- **macOS:** `markdowncluster.command` (double-click in Finder)  
  - Opens Terminal and runs `launch.sh`.  
  - Prefers a built `.app` under `release/mac-arm64`, `release/mac`, or `release/mac-unpacked`.  
  - Otherwise runs `npm run dev` (installs `node_modules` on first run if needed).
- **macOS / Linux:** `launch.sh`  
  - Same logic as above; use from Terminal or as the backend for the `.command` file.  
  - Make executable once: `chmod +x launch.sh markdowncluster.command`

## Create a desktop shortcut

### Windows

1. Right‑click `launch.bat` (or `markdowncluster.bat`) → **Create shortcut**.
2. Move the shortcut to the Desktop (or drag it there).
3. (Optional) Right‑click the shortcut → **Properties**:
   - **Target:** leave as is (it runs the batch file from its folder).
   - **Start in:** set to the project folder, e.g.  
     `C:\Users\YourName\...\markdown-clusterer`
   - **Run:** “Minimized” if you don’t want a console window when using the built app (the .bat already uses `start` for the .exe).
4. **Change Icon:**
   - Click **Change Icon**.
   - Use an `.ico` file (e.g. “books into one” style).  
   - You can convert a PNG to ICO with a site like [convertio.co](https://convertio.co/png-ico/) or [icoconvert.com](https://icoconvert.com/), then browse to the `.ico` in **Change Icon**.

### macOS

1. Make the launcher executable once (Terminal):  
   `chmod +x launch.sh markdowncluster.command`
2. Double‑click `markdowncluster.command` in Finder, or drag it (or an alias) to the Desktop / Dock.
3. If macOS blocks it: right‑click → **Open**, or allow it in **System Settings → Privacy & Security**.
4. Optional icon: Get Info on the `.command` file → drag a PNG/ICNS onto the icon in the top‑left.

### Linux

1. Copy or link `launch.sh` to the Desktop; ensure it’s executable:  
   `chmod +x launch.sh`
2. Right‑click the launcher → **Properties** → set the “books” icon if your desktop supports custom icons for shell scripts.

## Icon (“books into one”)

Use any “books into one” style image you like:

- Save a PNG (e.g. `icon-books.png`) in this project if you want to reuse it.
- **Windows:** Convert the PNG to `.ico` (e.g. at [convertio.co](https://convertio.co/png-ico/)), then in the shortcut **Properties** → **Change Icon** → browse to the `.ico` file.
- **macOS:** Use the PNG or convert to `.icns` for the script/alias icon (Get Info → drag image onto the icon).

After building the app, the built executable (e.g. `release\win-unpacked\Markdown Clusterer.exe`) has its own icon; the launcher scripts start that build or fall back to dev mode.
