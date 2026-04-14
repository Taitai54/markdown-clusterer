# Desktop shortcut and icon

Use the launchers from anywhere (e.g. desktop) and optionally give the shortcut a custom icon.

## Launchers

- **Windows:** `launch.bat`  
  - Run the built app from `release\win-unpacked\Markdown Clusterer.exe` if it exists (no terminal window).  
  - Otherwise runs `npm run dev` (needs Node; terminal stays open).
- **macOS / Linux:** `launch.sh`  
  - Run the built app (`.app` on Mac, `.AppImage` on Linux) if present.  
  - Otherwise runs `npm run dev`.  
  - Make executable once: `chmod +x launch.sh`

## Create a desktop shortcut

### Windows

1. Right‑click `launch.bat` → **Create shortcut**.
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

1. Drag `launch.sh` to the Desktop (or make an alias).
2. To run it: double‑click → if needed, confirm in Security & Privacy that it’s allowed to run, or run from Terminal once:  
   `chmod +x /path/to/launch.sh`
3. For a “books” icon: Get a PNG or ICNS, then Get Info on the script → drag the image onto the icon in the top‑left of the Get Info window (some macOS versions allow this for scripts/aliases).

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
