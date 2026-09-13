# Code Review — Markdown Clusterer

## How to read this file

This file used to be a single, ever-growing review. It got stale — most of its
recommendations (safeStorage encryption, rate limiting, CSP, error boundaries,
input sanitization, virtual scrolling, `useReducer`) were implemented later but
the surrounding prose was never pruned, so it read as still-open. It's now a
short changelog: newest review on top, each superseded by the next unless
marked still open.

## 2026-09-06 — Independent review (Codex), pre multi-provider work

Run alongside adding `CHAT_PROVIDER` (OpenAI/OpenRouter/Gemini/Ollama) support.
Status reflects what this pass fixed vs. left open.

### Also added post-review (2026-09-06, same day)
- **`EMBEDDING_PROVIDER`** (`openai`/`gemini`/`openrouter`) — added after discovering, while testing the local-Ollama chat provider, that both OpenAI keys available on this machine had zero API credits (verified: chat AND embeddings 429 on both). Embeddings are what actually drive clustering, so this was a real gap, not a nice-to-have — `CHAT_PROVIDER` alone couldn't route around a dead OpenAI key. Gemini (`gemini-embedding-001`) and OpenRouter (`openai/text-embedding-3-small`) embeddings verified working live. `.env` here now defaults both `CHAT_PROVIDER` and `EMBEDDING_PROVIDER` to `gemini` until the OpenAI account has credits again.

### Fixed in this pass
- **Critical — output path escape.** Cluster names/namespaces were only
  stripped of Windows-invalid characters; `..`/`.`/absolute segments could
  write outside the chosen output folder. Fixed via `safeJoin()` in
  `electron/main.js`, applied everywhere a cluster/namespace name becomes part
  of a filesystem path.
- **Pinecone key handling.** `currentPineconeKey` was written to persistent
  `electron-store` in plaintext despite being labeled "temporary session
  storage," and the encrypted `pineconeApiKey` was saved but never loaded back.
  Now kept in an in-memory `sessionPineconeKey` variable, restored from the
  encrypted store on `load-api-key`, and cleared on `delete-api-key`.
- **3 integration bugs**: `preload.js` `setApiKey`/`saveApiKey` dropped the
  Pinecone-key argument; `setEmbeddingModel` had no bridge at all; `suggest-k`
  always called OpenAI for embeddings regardless of the selected embedding
  model. Fixed by passing the argument through, adding the bridge, and
  factoring embedding generation into one `generateEmbeddingsForFiles()`
  function shared by `cluster-files` and `suggest-k`.
- **Doc drift**: see README.md/CLAUDE.md/.env.example — duplicated title,
  dead `OPENAI_BASE_URL` claim, "~1000 lines"/no-test-framework/`useState`
  claims, missing `PINECONE_API_KEY` in `.env.example`, and this file itself.

### Still open (not fixed in this pass — tracked here, not implemented)
- **Rate limiter is not provider-aware.** One global 50 req/min bucket is
  shared across whichever `CHAT_PROVIDER` is active plus embeddings; it also
  doesn't back off on `Retry-After` and can compound with the OpenAI SDK's own
  retries. Fine for single-user desktop use today; revisit if multi-provider
  usage grows.
- **`suggest-k` and `cluster-files` each re-embed the full file set** — running
  "Suggest k" then "Cluster" pays for embeddings twice. Caching the
  `suggest-k` result for the immediately following cluster run would halve
  embedding cost/latency for that flow.
- **Electron hardening is partial.** `nodeIntegration:false` +
  `contextIsolation:true` are set, but there's no `sandbox: true`, and CSP
  allows `'unsafe-inline'` for both scripts and styles (not a strict CSP,
  despite earlier docs claiming otherwise).
- **Arbitrary custom Base URL in the API key modal** sends the entered key via
  bearer auth to whatever URL is typed there — a typo or bad-faith endpoint
  gets the secret. No warning is shown; HTTP is allowed even for non-loopback
  hosts.
- **Main-process I/O is synchronous and unbounded for direct file picks.** The
  50MB file-size cap only applies to recursive folder reads, not files added
  via the file picker; recursive reads, k-means, and file copy/move all run
  synchronously on Electron's main thread.
- **No test coverage on `electron/main.js`** — only two renderer component
  tests exist (`ErrorBoundary`, `FileList`). None of the IPC handlers,
  embedding/chat provider logic, or file-organize logic are tested.
- **JSON-mode reliability across chat providers isn't schema-validated** —
  `response_format: {type: 'json_object'}` is passed to whichever provider is
  configured; it degrades gracefully today (falls back to a generic cluster
  name on any parse/request failure), but isn't verified per-provider beyond
  that fallback.

## Earlier review (superseded)

An earlier, more detailed pass covered API key exposure (fixed — key rotated,
`.env` gitignored), missing `safeStorage` encryption (now implemented),
missing rate limiting (now implemented, see "still open" above for its
current limitations), missing error boundaries (now implemented,
`ErrorBoundary.jsx`), and missing input sanitization (`sanitizePath`, now
implemented — see this pass's path-traversal fix for a gap that remained).
Suggestions not yet acted on and still relevant as low-priority backlog:
TypeScript migration, CI/CD pipeline, accessibility (keyboard nav, ARIA),
undo/redo for file moves.
