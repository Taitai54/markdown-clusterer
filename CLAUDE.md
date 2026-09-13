# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Markdown Clusterer is an Electron + React desktop app that organizes markdown files into topic-based clusters using AI embeddings and K-Means clustering. Users drop in markdown files, the app generates embeddings (OpenAI `text-embedding-3-small`/`-large`, or Pinecone's `multilingual-e5-large`), runs K-Means, then calls an LLM to name each cluster. Users can manually refine clusters via drag-and-drop before organizing files into folders.

No test framework is configured. Vitest is set up (`npm test`), but only covers two React components (`ErrorBoundary`, `FileList`) — `electron/main.js`, where all the provider/IPC/file-I/O logic lives, has zero test coverage.

## Development Commands

```bash
npm run dev              # Start Vite dev server + Electron with hot reload
npm run dev:react        # Vite dev server only (port 5173)
npm run dev:electron     # Electron only (waits for Vite on port 5173)
npm run build            # Production build (Vite + electron-builder, all platforms)
npm run build:win        # Windows build (NSIS + Portable)
npm run build:mac        # macOS build (DMG + ZIP)
npm run build:linux      # Linux build (AppImage + DEB)
npm test                 # Run Vitest (renderer components only, see below)
```

## Architecture

### Process Model (Electron IPC)

```
React UI (renderer)  ──IPC──>  preload.js (contextBridge)  ──IPC──>  main.js (Node.js)
                                                                        ├── OpenAI/Gemini/OpenRouter/Ollama/Pinecone (embeddings, via EMBEDDING_PROVIDER)
                                                                        ├── OpenAI/OpenRouter/Gemini/Ollama (cluster naming, via CHAT_PROVIDER)
                                                                        ├── File System
                                                                        └── electron-store
```

- **`electron/main.js`** — Main process. Contains ALL backend logic: IPC handlers, embedding calls (OpenAI or Pinecone), chat completion calls for cluster naming (OpenAI-compatible client per `CHAT_PROVIDER`), file system operations, K-Means clustering, and encrypted API key storage via `electron-store` + `safeStorage`. This is a large file (1100+ lines) with configuration constants at the top (`CONFIG` object) and provider config (`CHAT_PROVIDERS`) just below it.
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

1. Generate embeddings in batches (`EMBEDDING_BATCH_SIZE: 100`) with exponential backoff retry, via `generateEmbeddingsForFiles()` — if `CONFIG.EMBEDDING_MODEL === 'multilingual-e5-large'`, a raw `fetch` to Pinecone's embed API; otherwise routes to whichever `EMBEDDING_PROVIDER` is configured (OpenAI `text-embedding-3-small`/`-large` by default, or Gemini/OpenRouter/local-via-Ollama). Shared by both `cluster-files` and `suggest-k` (elbow-method cluster-count suggestion) so they stay in sync.
2. Run K-Means clustering (`ml-kmeans` with kmeans++ initialization)
3. Sample up to 5 files per cluster
4. Call the configured `CHAT_PROVIDER` model (via `getChatClient()`) with JSON mode to generate cluster names and descriptions — falls back to a generic "Cluster N" name if the call fails
5. Return clusters to renderer for manual refinement
6. On "Organize": copy or move files into named subdirectories under the chosen output folder (optionally per-cluster namespace subfolders), optionally inject YAML frontmatter tags/cluster description, always writes a `_dedup_manifest.json` so a later run can skip already-organized source files, optionally writes a top-level `index.json` manifest and per-cluster `_index.md`. Destination paths are validated to stay under the output folder (`safeJoin()`) since cluster names/namespaces are user-editable text.

### State Management

`useReducer` in `App.jsx` (see the reducer switch near the top of the file). No external state library. Persistent storage (API keys) uses `electron-store` with Electron's `safeStorage` encryption; the Pinecone key is kept in-memory only for the session unless explicitly saved (encrypted).

## Key Conventions

- **Styling**: Tailwind CSS with custom dark theme palette (`dark-100` through `dark-400`) and primary color (sky blue). Defined in `tailwind.config.js`.
- **CSP**: `default-src 'self'` in `index.html`, but `script-src`/`style-src` both allow `'unsafe-inline'` — not a strict CSP.
- **API key handling**: Keys are encrypted at rest via `safeStorage` when available (falls back to plaintext with a logged warning if `safeStorage` is unavailable on the platform). Can also be loaded from `.env` file.
- **Provider selection**: `CHAT_PROVIDER` (`openai`/`openrouter`/`gemini`/`local`) picks the cluster-naming backend; `EMBEDDING_PROVIDER` (`openai`/`gemini`/`openrouter`/`local`) picks the embedding backend (the one that actually drives clustering) — independent settings, see `getChatClient()`/`getEmbeddingClient()` in `main.js`. `.env` sets the default; the two dropdowns in `Header.jsx` override it at runtime via `activeChatProvider`/`activeEmbeddingProvider` (session-only, set through `set-chat-provider`/`set-embedding-provider` IPC — see `get-provider-config` for how the UI reads current state on startup). Selecting `multilingual-e5-large` in the embedding-model dropdown still routes to Pinecone regardless of `EMBEDDING_PROVIDER`. See README's "Choosing a provider". The custom "Base URL" field in the API key modal is a manual override for the OpenAI client only.
- **Output path safety**: Cluster names and namespace labels are user-editable strings used to build folder paths — always resolve them with `safeJoin()` (in `main.js`), not raw `path.join()`, to prevent writing outside the chosen output folder.
- **Build output**: `release/` directory for packaged apps, `dist/` for Vite build output.
