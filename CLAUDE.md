# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Markdown Clusterer is an Electron + React desktop app that organizes markdown files into topic-based clusters using OpenAI embeddings and K-Means clustering. Users drop in markdown files, the app generates embeddings via `text-embedding-3-small`, runs K-Means, then uses `gpt-4o-mini` to name each cluster. Users can manually refine clusters via drag-and-drop before organizing files into folders.

## Development Commands

```bash
npm run dev              # Start Vite dev server + Electron with hot reload
npm run dev:react        # Vite dev server only (port 5173)
npm run dev:electron     # Electron only (waits for Vite on port 5173)
npm run build            # Production build (Vite + electron-builder, all platforms)
npm run build:win        # Windows build (NSIS + Portable)
npm run build:mac        # macOS build (DMG + ZIP)
npm run build:linux      # Linux build (AppImage + DEB)
```

No test framework is configured.

## Architecture

### Process Model (Electron IPC)

```
React UI (renderer)  ──IPC──>  preload.js (contextBridge)  ──IPC──>  main.js (Node.js)
                                                                        ├── OpenAI API
                                                                        ├── File System
                                                                        └── electron-store
```

- **`electron/main.js`** — Main process. Contains ALL backend logic: IPC handlers, OpenAI API calls (embeddings + chat completions), file system operations, K-Means clustering, and encrypted API key storage via `electron-store` + `safeStorage`. This is a large file (~1000 lines) with configuration constants at the top (`CONFIG` object).
- **`electron/preload.js`** — Secure bridge exposing `window.electronAPI` to the renderer. Every IPC channel is explicitly listed here.
- **`electron/logger.js`** — File-based logging with 5MB rotation.

### Frontend (React + Vite)

- **`src/App.jsx`** — Root component managing all global state. Routes between three views based on workflow stage: FileDropZone → FileList → ClusterView.
- **`src/components/FileDropZone.jsx`** — File import via drag-drop, folder selection, or file picker.
- **`src/components/FileList.jsx`** — Shows loaded files as preview cards before clustering.
- **`src/components/ClusterView.jsx`** — Post-clustering interface with drag-drop reorganization, cluster renaming, file preview, and organize-to-folders action.
- **`src/components/Header.jsx`** — Top bar with API status indicator and debug menu.
- **`src/components/ApiKeyModal.jsx`** — API key input/management modal.
- **`src/components/ProgressModal.jsx`** — Processing progress display during clustering.

### Clustering Pipeline (in `electron/main.js`)

1. Generate embeddings in batches (`EMBEDDING_BATCH_SIZE: 100`) with exponential backoff retry
2. Run K-Means clustering (`ml-kmeans` with kmeans++ initialization)
3. Sample up to 5 files per cluster
4. Call GPT-4o-mini with JSON mode to generate cluster names and descriptions
5. Return clusters to renderer for manual refinement
6. On "Organize": copy or move files into named subdirectories, optionally inject YAML frontmatter tags

### State Management

Pure React hooks (`useState`/`useEffect`) in `App.jsx`. No external state library. Persistent storage (API keys only) uses `electron-store` with Electron's `safeStorage` encryption.

## Key Conventions

- **Styling**: Tailwind CSS with custom dark theme palette (`dark-100` through `dark-400`) and primary color (sky blue). Defined in `tailwind.config.js`.
- **CSP**: Strict Content Security Policy in `index.html` (`default-src 'self'`).
- **API key handling**: Keys are encrypted at rest via `safeStorage`, never stored in plaintext. Can also be loaded from `.env` file.
- **Custom endpoints**: Supports OpenAI-compatible APIs (e.g., Ollama) via `OPENAI_BASE_URL` env var.
- **Build output**: `release/` directory for packaged apps, `dist/` for Vite build output.
