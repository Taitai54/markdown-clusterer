# Markdown Clusterer

An AI-powered desktop app that organizes markdown files into topic-based clusters using OpenAI embeddings and K-Means clustering. Built with Electron and React for Mac, Windows, and Linux.

![Platform](https://img.shields.io/badge/Platform-Mac%20%7C%20Windows%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **AI clustering** — Embeddings (`text-embedding-3-small`) + K-Means; GPT names each cluster
- **Drag-and-drop** — Import folders/files; drag files between clusters to refine
- **Merge & split** — Merge two clusters or split one by selecting files (Ctrl+click) and "Split to new cluster"
- **Suggest k** — Optional "Suggest k" uses the elbow method to suggest number of clusters
- **Organize output** — Copy or move files into cluster folders; optional YAML tags, cluster meta, index manifest, per-cluster `_index.md`, and preserve relative paths
- **Duplicate filtering** — "Filter Already Organised" removes files already organised into a target folder in a previous run, so re-exporting a full knowledge base only processes new or updated files
- **Cross-platform** — Runs on macOS, Windows, and Linux

## Prerequisites

- **Node.js** 18+
- **OpenAI API key** ([platform.openai.com](https://platform.openai.com))

Supports OpenAI-compatible APIs (e.g. Ollama) via `OPENAI_BASE_URL` in `.env`.

## Installation

```bash
git clone https://github.com/YOUR_USERNAME/markdown-clusterer.git
cd markdown-clusterer
npm install
```

## Running the app

**Development (see logs in terminal):**
```bash
npm run dev
```

**Built app (Windows):**  
After `npm run build:win`, run `release\win-unpacked\Markdown Clusterer.exe`, or use the included `launch.bat` (see [DESKTOP_LAUNCH.md](DESKTOP_LAUNCH.md) for a desktop shortcut).

**Build for your platform:**
```bash
npm run build:win   # Windows (NSIS + portable)
npm run build:mac   # macOS (DMG + ZIP)
npm run build:linux # Linux (AppImage + DEB)
```

Output goes to the `release/` directory.

## Usage

1. **API key** — Enter your OpenAI API key when prompted (stored securely with Electron `safeStorage`).
2. **Import** — Add markdown (`.md`, `.markdown`, `.txt`) via folder, file picker, or drag-and-drop.
3. **Cluster** — Set number of clusters (or use “Suggest k”), optionally add an AI naming hint, then click “Cluster with AI”.
4. **Refine** — Drag files between clusters; use “Merge into…” to combine clusters; Ctrl+click files and “Split to new cluster” to split.
5. **Organize** — Choose output folder, set options (copy/move, inject tags, write index, cluster index, cluster meta, preserve paths), then “Organize Files”.

Content used for clustering has YAML frontmatter stripped and can use a title from frontmatter or the first heading, so clustering focuses on body content.

## Project structure

```
markdown-clusterer/
├── electron/
│   ├── main.js       # Main process: IPC, OpenAI, K-Means, file ops
│   ├── preload.js    # contextBridge for renderer
│   └── logger.js     # File logging
├── src/
│   ├── App.jsx       # Root state and views
│   ├── main.jsx
│   ├── index.css
│   └── components/   # FileDropZone, FileList, ClusterView, Header, etc.
├── launch.bat        # Windows launcher (built app or dev)
├── launch.sh         # macOS/Linux launcher
├── package.json
├── vite.config.js
├── tailwind.config.js
├── README.md
└── DESKTOP_LAUNCH.md # Desktop shortcut and icon notes
```

## Configuration

Key constants (embedding length, batch size, models, etc.) are in `electron/main.js` in the `CONFIG` object at the top.

## Troubleshooting

- **“API configuration not set”** — Enter and save your API key in the app (or set `OPENAI_API_KEY` in `.env`).
- **Build fails with “Access is denied”** — Close the app and any Explorer windows on `release\win-unpacked`, delete `release\win-unpacked`, then run `npm run build:win` again. If the project is under OneDrive, pausing sync or building to a different output directory can help.
- **ESM/require errors in built app** — Ensure you’re on a commit that uses `js-yaml` (not `yaml`) and loads `electron-store` via dynamic `import()` in `main.js`.

## License

MIT.

## Acknowledgments

- [Electron](https://www.electronjs.org/)
- [OpenAI API](https://openai.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [ml-kmeans](https://www.npmjs.com/package/ml-kmeans)
