# Markdown Clusterer

An AI-powered desktop app that organizes markdown files into topic-based clusters using AI embeddings and K-Means clustering. Built with Electron and React for Mac, Windows, and Linux.

![Platform](https://img.shields.io/badge/Platform-Mac%20%7C%20Windows%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Key Features

- **AI-Powered Clustering**: Groups files using OpenAI or Pinecone E5 embeddings (2–15 clusters).
- **Multi-Provider Naming**: Cluster names/descriptions can be generated via OpenAI, OpenRouter, Gemini, or a local model — see [Choosing a provider](#choosing-a-provider).
- **Pinecone Alignment**: Native support for embedding with `multilingual-e5-large` (1024d) to match the Pinecone 'peace' index's vector space. This app doesn't upload to a Pinecone index itself — "namespace" here just means the local folder/frontmatter label you'd later import under that namespace.
- **Dynamic Namespaces**: Assign a namespace label to clusters on the fly; it becomes a subfolder and gets written into file frontmatter.
- **Contextual Injection**: Automatically bakes cluster descriptions and namespace metadata into markdown frontmatter.
- **Semantic Overlap Detection**: Identifies and flags files with >92% semantic similarity to minimize database noise.
- **Interactive GUI**: Drag-and-drop file organization with real-time AI naming.
- **Flexible Organization**: Copy or Move modes with folder structure preservation.
- **Suggest k** — Optional "Suggest k" uses the elbow method to suggest number of clusters
- **Organize output** — Copy or move files into cluster folders; optional YAML tags, cluster meta, index manifest, per-cluster `_index.md`, and preserve relative paths
- **Duplicate filtering** — "Filter Already Organised" removes files already organised into a target folder in a previous run, so re-exporting a full knowledge base only processes new or updated files
- **Cross-platform** — Runs on macOS, Windows, and Linux
- **API key** — At least one provider key ([platform.openai.com](https://platform.openai.com), [openrouter.ai](https://openrouter.ai), [aistudio.google.com](https://aistudio.google.com/apikey), or a local Ollama install)

## Choosing a provider

Two dropdowns in the header — **Naming** and **Embeddings** — switch providers at runtime, no `.env` edit or restart needed. They start from whatever `.env` sets and can be changed per-session from there. Both are OpenAI-API-compatible under the hood, so the app reuses one client per provider — just a different key/base URL. See `.env.example` for the full variable list (still the way to set your *default* provider and per-provider API keys/models).

- **`CHAT_PROVIDER`** (`openai` | `openrouter` | `gemini` | `local`) — names your clusters. `local` uses Ollama by default (`OLLAMA_BASE_URL`); the model name (`OLLAMA_CHAT_MODEL`) must exactly match an installed tag (`ollama list`) — `llama3.2` fails, `llama3.2:3b` doesn't.
- **`EMBEDDING_PROVIDER`** (`openai` | `gemini` | `openrouter` | `local`) — this is what actually groups your files; naming is cosmetic by comparison. Worth having a fallback here since it's the one that breaks clustering entirely if the key runs dry. Verified working: OpenAI (`text-embedding-3-small`), Gemini (`gemini-embedding-001` — note `text-embedding-004` 404s on Gemini's OpenAI-compat endpoint), OpenRouter (`openai/text-embedding-3-small`, billed through OpenRouter), local via Ollama (`nomic-embed-text`, 768d — the only option with no quota ceiling at all, since it never leaves your machine). Local needs a dedicated embedding model pulled first — chat models like `llama3.2` don't do embeddings: `ollama pull nomic-embed-text`.
- Selecting `multilingual-e5-large` from the in-app embedding-model dropdown still routes through Pinecone regardless of `EMBEDDING_PROVIDER` (a Pinecone key is required for that specific choice).

The custom "Base URL" field in the API key modal is a manual override for the OpenAI client specifically (e.g. pointing it at a local OpenAI-compatible server); it sends whatever key you enter to that URL, so only point it at endpoints you trust.

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

Provider/API config lives in `.env` (see `.env.example`). Key constants (embedding length, batch size, default models, etc.) are in `electron/main.js` in the `CONFIG` object at the top.

## Cost and efficiency

Defaults are chosen to keep this cheap to run:

- **Embeddings**: `text-embedding-3-small` (the in-app default) is far cheaper than `-large` and plenty accurate for topic clustering — only switch up if cluster quality is consistently poor.
- **Naming**: whichever `CHAT_PROVIDER` model is set (`gpt-4o-mini`/`openai/gpt-4o-mini`/`gemini-2.5-flash`/a small local model by default) — the naming call only sees a handful of sampled files per cluster, not your whole corpus.
- **Content truncation**: each file is trimmed to 1500 chars for embedding and 1000 chars for naming (`CONFIG.EMBEDDING_PREVIEW_LENGTH` / `CLUSTER_PREVIEW_LENGTH`) before it's sent anywhere.
- **Sampling**: cluster naming only looks at up to 5 files per cluster (`CONFIG.MAX_SAMPLE_FILES`), not every file in it.
- **Batching + rate limiting**: embeddings are sent in batches of 100 (`CONFIG.EMBEDDING_BATCH_SIZE`) with a shared 50 requests/minute limiter and exponential-backoff retries.

## Troubleshooting

- **“API configuration not set”** — Enter and save your OpenAI API key in the app (or set `OPENAI_API_KEY` in `.env`); this key drives embeddings and the default naming provider.
- **Clusters default to "Cluster N" instead of an AI name** — the naming call failed; check `CHAT_PROVIDER` and the matching key/URL in `.env` (e.g. `OPENROUTER_API_KEY` for `CHAT_PROVIDER=openrouter`, or that Ollama is running at `OLLAMA_BASE_URL` for `CHAT_PROVIDER=local`) — see the log file (Debug menu → Open Log Folder) for the underlying error.
- **Build fails with “Access is denied”** — Close the app and any Explorer windows on `release\win-unpacked`, delete `release\win-unpacked`, then run `npm run build:win` again. If the project is under OneDrive, pausing sync or building to a different output directory can help.
- **ESM/require errors in built app** — Ensure you’re on a commit that uses `js-yaml` (not `yaml`) and loads `electron-store` via dynamic `import()` in `main.js`.

## License

MIT.

## Acknowledgments

- [Electron](https://www.electronjs.org/)
- [OpenAI API](https://openai.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [ml-kmeans](https://www.npmjs.com/package/ml-kmeans)
