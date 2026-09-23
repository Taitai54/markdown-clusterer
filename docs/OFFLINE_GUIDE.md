# Run locally and offline on this Mac

## Verified machine and model combination

This review observed an Apple Silicon (`arm64`) Mac with 48 GiB RAM. Ollama is installed and running. Its inventory includes `bge-m3:latest`, `qwen3-embedding:4b`, `gpt-oss:20b`, and larger chat models. The tested starting pair is **bge-m3:latest for embeddings** and **gpt-oss:20b for naming**. Four synthetic documents produced 1,024-dimensional embeddings, sensible two-topic separation and valid naming JSON in 13.436 seconds. This is a compatibility check, not a benchmark of your full library. No model downloads were performed.

## Launch and configure

1. Start Ollama. Run `ollama list` in Terminal to confirm both model names are installed.
2. Launch the built app with `./launch.sh` or double-click `markdowncluster.command`. During development use `npm run dev`.
3. Open **Model settings** (or **Configure models**). Enter:
   - Local server URL: `http://127.0.0.1:11434/v1`
   - Embedding model: `bge-m3:latest`
   - Naming model: `gpt-oss:20b`
4. Click **Test and use offline**. The test uses synthetic text only, then saves local settings and forces both providers local. It needs no OpenAI key.
5. Import a small copied collection, choose a cluster count, and cluster. Inspect and rename groups before export. Use **Copy** and a fresh output directory first.
6. Quit and relaunch to verify preferences persist. Disconnect external networking, leaving Ollama running, and repeat the complete workflow before relying on it offline.

If a prior saved cloud configuration causes a startup validation request before local setup, launch development with `OFFLINE_MODE=true npm run dev`. This forces local routing immediately. `.env` may also set this flag. Once local settings are saved, packaged startup uses offline mode without an environment file.

To intentionally return to online providers, open Model settings and click **Allow cloud provider selection**. Then choose the desired providers in the header. When `OFFLINE_MODE=true` is set in the environment, remove it and restart first. Cloud model selection is independent for naming and embeddings. OpenAI keys can be entered in the UI; Gemini/OpenRouter keys still use environment configuration. The local model fields do not configure cloud models.

## Ollama's own cloud setting

An application connecting to loopback cannot guarantee that the server never forwards traffic. Use downloaded models and disable Ollama cloud features (`disable_ollama_cloud: true` in Ollama's server configuration, or `OLLAMA_NO_CLOUD=1` in its launch environment; restart Ollama after changing this). Check the [official Ollama FAQ](https://docs.ollama.com/faq) for the configuration used by your installed version. This review did not change your global Ollama settings.

The app rejects remote local-server URLs, redirects and names containing `cloud`, and does not switch to a cloud service when local inference fails. No live internet disconnection or network capture was performed by this review.

## Build once while connected

```sh
npm ci
npm run build:mac:dir
```

The unpacked app is `release/mac-arm64/Markdown Clusterer.app`; `npm run build:mac` also creates distribution targets. Build dependencies/runtime downloads may require the internet. Afterwards the packaged UI and runtime are local; npm/Vite are not needed to run it. Model files are managed separately by Ollama. This local build is not a signed/notarized distribution release.

## Diagnose problems

| Symptom | Action |
|---|---|
| Connection refused | Start Ollama; confirm the URL and port. |
| Model missing or wrong capability | Check exact tags with `ollama list`; embeddings need a dedicated embedding model. |
| Request times out | Close other heavy workloads, confirm a model loads in Ollama, or choose a smaller downloaded model. Local requests time out after 120 seconds. |
| Generic cluster names | Embeddings succeeded but naming failed; inspect Debug → Open Log Folder and edit names manually. |
| Model selector refuses a change | The OpenAI/Pinecone selector applies only to the OpenAI route; local model names belong in Model settings. |
| Partial organization error | Inspect the error and actual output before retrying; successful copies already exist and retries can add numbered duplicates. |
| Poor groups in long transcripts | Only the leading preview is embedded; manual review remains necessary. Chunking is a planned improvement. |

Diagnostic commands: `npm run smoke:local` (real local models, synthetic text), `npm run test:offline` (isolated regression fixtures), and `npm test -- --run` (UI checks). Alternative smoke models can be supplied through `SMOKE_EMBED_MODEL` and `SMOKE_CHAT_MODEL`. Keep backups when using Move. Preview and persisted guarded undo are now available; see [product workflows](PRODUCT_WORKFLOWS.md).
