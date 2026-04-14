# Icon Setup Instructions

## Icon Created
I've created an animated SVG icon (`icon.svg`) showing books being pulled into a central folder - perfect for your markdown clustering app!

## Converting SVG to ICO for Windows

To use this icon with your `launch.bat` file, you'll need to convert it to ICO format:

### Option 1: Online Converter (Easiest)
1. Go to https://convertio.co/svg-ico/ or https://cloudconvert.com/svg-to-ico
2. Upload `icon.svg`
3. Set size to 256x256 (or multiple sizes: 16, 32, 48, 256)
4. Download as `icon.ico`
5. Place `icon.ico` in your project root

### Option 2: Using ImageMagick (Command Line)
```bash
magick convert -density 256x256 -background transparent icon.svg -define icon:auto-resize -colors 256 icon.ico
```

### Option 3: Using Inkscape (Free Software)
1. Install Inkscape (https://inkscape.org/)
2. Open `icon.svg`
3. Export as PNG at 256x256
4. Use an online ICO converter or GIMP to convert PNG to ICO

## Using the Icon with launch.bat

Once you have `icon.ico`, you can't directly set it in a batch file, but you can:

### Method 1: Create a Shortcut
1. Right-click `launch.bat` → Create Shortcut
2. Right-click the shortcut → Properties
3. Click "Change Icon"
4. Browse to `icon.ico`
5. Click OK

### Method 2: Use in Electron Build
The icon is already configured in your Electron app. The built executable in `release/win-unpacked/Markdown Clusterer.exe` should have its own icon set through the build process.

To update the Electron app icon, add to your `package.json` build configuration:
```json
"build": {
  "win": {
    "icon": "icon.ico"
  }
}
```

## Icon Features
- Animated books flying into a central folder
- Represents the clustering/organization concept
- Blue color scheme matching your app theme
- Motion lines showing the "pulling in" effect
- Central vortex/swirl effect for visual interest
