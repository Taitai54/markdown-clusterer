# Markdown Clusterer

A local Electron/React desktop app for grouping Markdown and text files into topics, reviewing those groups, and copying or moving files into organized folders. It supports local Ollama models and optional cloud providers.

## Start on this Mac

```sh
npm install
npm run dev
```

Open **Model settings**, use `http://127.0.0.1:11434/v1`, embedding model `bge-m3:latest`, and naming model `gpt-oss:20b`, then click **Test and use offline**. These models were already installed on this Mac and passed a synthetic compatibility test. No OpenAI key is needed. Settings persist across restarts.

For a built desktop app:

```sh
npm run build:mac:dir
./launch.sh
```

First-time installation/building/model downloads need connectivity. Runtime operation can use the downloaded local models offline. Follow the [offline guide](docs/OFFLINE_GUIDE.md), including Ollama cloud settings and disconnected acceptance. The full desktop workflow has not yet been certified by a disconnected end-to-end test.

## Workflow

Import `.md`, `.markdown` or `.txt` files through selection or drag-and-drop. Choose 2–15 clusters (no more than the file count), optionally suggest k, then cluster. Review, rename, merge or split groups. Ctrl+click two or more files and choose **Merge into one document** to save them as one new markdown file; the originals stay in place, and this is separate from merging two clusters into one group. Choose a fresh output folder and **Copy** first. Optional export features include YAML tags, cluster descriptions, namespaces, relative paths and manifests. Use Preview export to inspect paths and frontmatter changes before confirming. Export history provides undo for unchanged outputs, including restoration of moved originals.

Embeddings group files; a separate naming model labels groups. Naming failure leaves generic editable labels. Only leading document previews are used, so long-document quality needs manual review. “Similar” is not proof of duplication.

## Keep your library organized

The **Library** panel lets you save/resume projects, save reviewed category sets, apply those categories to new files, and undo previous exports. Weak or ambiguous category matches go into **Uncertain — review**. Projects warn if original files have changed or disappeared. Unsaved work receives a local recovery copy, model tasks can be cancelled, and unchanged embeddings are reused within a session. Read the [workflow guide](docs/PRODUCT_WORKFLOWS.md) for recovery behavior and local storage limits.

## Providers and privacy

**Offline mode** forces both routes local, skips startup cloud credential validation, rejects remote local-server addresses/redirects/explicit cloud model tags, and never falls back to a cloud provider. The inference server itself must be configured for offline use. `OFFLINE_MODE=true` can enforce local mode before first setup.

**Online mode** supports OpenAI, OpenRouter and Gemini; Pinecone E5 is an optional embedding route when OpenAI is selected. Cloud services receive document previews. OpenAI/custom-endpoint keys can be entered in Model settings; other provider credentials/default models are environment settings listed in [.env.example](.env.example). Do not commit secrets. A custom OpenAI Base URL receives the key supplied with it. Persisted keys use Electron secure storage; if encryption is unavailable, the key remains session-only.

Saved choices override environment provider defaults. Local settings live in Electron userData, so a packaged app needs no `.env` for offline operation. `.env` is loaded from the launch working directory for development/optional cloud configuration.

## Documentation

- [Development handoff and prioritized backlog](HANDOFF.md): start here next session

- [Strategic technical review](docs/TECH-REVIEW.md): verdict, evidence and priorities
- [Architecture](docs/ARCHITECTURE.md): implemented components, routing, storage and limits
- [PRD](docs/PRD.md): product requirements, acceptance and backlog
- [Offline setup](docs/OFFLINE_GUIDE.md): this Mac's model configuration and troubleshooting
- [Validation](docs/VALIDATION.md): what was tested and what remains unverified
- [Architecture decision](docs/adr/0001-local-first-desktop.md)
- [Desktop launchers](DESKTOP_LAUNCH.md)

Earlier `CODE_REVIEW.md` and `CLAUDE.md` describe historical implementation context; current architecture and validation documents take precedence for readiness claims.

## Development checks

```sh
npm test -- --run
npm run test:offline
npm run test:product
npm run test:resilience
npm run smoke:local  # requires running Ollama and installed models
npm run build:mac:dir
```

Source: `src/` contains React UI; `electron/main.js` handles IPC/model/file workflows; `electron/local-models.js` enforces the local adapter policy; `electron/preload.js` exposes the desktop bridge. Windows/Linux build scripts exist but were not verified during this Mac review.
