# Validation record — 19 September 2026

## Observed environment

Apple Silicon (`arm64`), 48 GiB RAM, host Node 24.2.0. Updated Electron 44.4.3 embeds Node 24.21.0. Ollama was running and had `bge-m3:latest`, `qwen3-embedding:4b`, `gpt-oss:20b` and other models already downloaded. No models or private documents were uploaded/downloaded by the inference checks; only synthetic text was used.

## Checks and outcomes

| Check | Result / meaning |
|---|---|
| `npm test -- --run` | 5 passing UI tests; real installed react-window is exercised, only layout measurement is mocked. ErrorBoundary deliberately logs a test crash. |
| `npm run test:offline` | 5 passing tests: loopback policy, malformed vectors, no-key offline startup, local clustering/Suggest k despite stale E5 selection, Copy/namespace/collision manifest integrity. Electron/model calls are isolated test doubles; real K-means and temporary file operations execute. |
| `npm run smoke:local` | PASS against real Ollama: bge-m3 1,024-dimensional vectors, two correct synthetic topic groups, gpt-oss JSON naming; 13.436 seconds for that run. |
| Real Electron desktop smoke | PASS with isolated temporary profile, built renderer, real preload/IPC, live local models and four copied synthetic files. Local settings were verified on disk; originals and all outputs existed. Main-process fetch rejected non-loopback hosts. No external network disconnection was performed. |
| Packaged archive smoke | PASS with `--packaged`: code, dependencies, preload and renderer loaded from app.asar; real local naming/clustering and all four copy outputs succeeded. This runs the archive under an isolated Electron harness, not a Finder cold restart. |
| Production renderer build | PASS; local assets emitted to `dist`. |
| `npm run build:mac:dir` | PASS; Apple Silicon app emitted to `release/mac-arm64/Markdown Clusterer.app`. Default Electron icon, no Developer ID signing/notarization. |
| `npm audit --omit=dev --json` | Zero production advisories after compatible js-yaml, fast-uri and form-data updates. This is advisory coverage, not a security certification. |
| Full dependency tree | Last install audit reported 32 advisories (3 low, 7 moderate, 20 high, 2 critical); development/build tooling remains maintenance work. No force-upgrade applied. |
| Syntax / whitespace | `node --check` on Electron entrypoints and `git diff --check` pass. |

## Fixed defects covered by inspection and regression

- Removed OpenAI readiness gates from local clustering and Suggest k; forced offline startup avoids cloud key validation.
- Scoped Pinecone E5 to the OpenAI route so it cannot override local embeddings.
- Added saved local capability setup, request deadlines, restricted URLs, redirect rejection and vector validation/normalization.
- Corrected saved OpenAI client reuse for naming.
- Updated Electron to satisfy electron-store runtime requirements; migrated dropped-file paths to `webUtils.getPathForFile`.
- Updated the file list to installed virtualization APIs; excluded unrelated `.kilo` worktree tests from this repository's test discovery.
- Corrected common-root path preservation, actual successful manifest paths, collision names, per-cluster namespace metadata, auxiliary output warnings and partial-export UI reporting.
- Avoided overwriting an imported `_index.md` with generated cluster index output.
- Removed plaintext credential persistence fallback; UI now reports session-only storage failure.

## Limits and acceptance still required

No claim of a fully disconnected, cold-restart, Finder-launched workflow on a representative owner corpus is made. The app cannot attest to network forwarding by a separate inference server. This review did not disable your network or modify your global Ollama configuration. Follow the [PRD acceptance procedure](PRD.md).

No cloud provider was live-tested, no Windows/Linux package was tested, and no representative maximum collection size or grouping-quality benchmark exists. Move is not transactional; symlink/race hardening, all-import size bounds, cancellation, resumable sessions, cache invalidation and long-document quality remain documented work. Development/build advisories also remain. Build success alone does not establish UI correctness, package installation trust or full offline behavior.

External references checked: [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility), [Ollama offline/cloud settings](https://docs.ollama.com/faq), [Electron support policy](https://www.electronjs.org/docs/latest/tutorial/electron-timelines). The installed electron-store README states Electron 30+ is required.

Desktop smoke command: `env -u ELECTRON_RUN_AS_NODE npx electron scripts/smoke-desktop.cjs`. It uses an isolated temporary profile and synthetic fixtures, leaving the owner's settings and documents unchanged. `--packaged` selects code/assets from the built app archive. The harness substitutes built assets for Vite and drives actual IPC programmatically; it does not simulate every user gesture.

## Product iteration: projects, categories and reversible export

The previous baseline above is retained as historical evidence. Added 10 passing product tests and 2 passing preview UI tests (22 total across backend and UI suites). Coverage includes exact preview plans, stale-plan refusal, Copy/Move undo after restart, edited-file conflicts, original byte restoration, existing sidecar restoration, fault-injected interrupted moves, saved-project snapshots and ambiguous category matches. Move now has a recovery journal; saved projects can resume review state. Whole-job cancellation, crash autosave and representative quality/disconnected acceptance remain unverified or unimplemented as documented.

The extended desktop smoke passed against real Ollama through the Electron bridge: saved and reopened a four-document project, saved/applied reviewed categories, previewed and committed a Copy export, verified all outputs, and undid it while retaining all originals. The updated Apple Silicon app build also passed. The smoke uses temporary data and does not establish representative category accuracy or power-loss durability.

The same extended project/category/export/undo smoke also passed using code, preload, dependencies and built UI from the rebuilt Mac app archive (`--packaged`). This verifies packaging of the new services, without claiming a disconnected Finder cold-start test.


## Reliability iteration: cache, cancellation and recovery autosave

Added seven resilience tests, one IPC cancellation regression and three recovery-hook tests. All 33 tests pass (23 backend, 10 UI/hook). Coverage includes input/provider/endpoint/model/preprocessing cache invalidation, within-batch deduplication, vector-memory/entry limits and eviction, cancellation before caching an aborted batch, single-job exclusion, abortable waits, active worker termination, naming-stage cancellation with no partial result, repeatable K-means, recovery snapshots across service restart, rejection of invalid snapshots, startup recovery protection, debounce and failed-save reporting. The existing offline IPC test now asserts that Cluster followed by Suggest k makes just one embedding request.

The production renderer and Apple Silicon app build pass. The cache is session-only; unchanged model tags are not resolved to immutable digests. Cancellation does not attest to server-side GPU job termination. Autosave protects completed snapshots, not edits within the debounce window or in-flight task progress. Large file I/O remains synchronous. These checks do not replace representative/disconnected acceptance on the owner's documents.

The rebuilt app archive passed the extended Electron smoke with the installed Ollama models: normal clustering, category assignment, project persistence, export and undo succeeded; a repeat Suggest k made zero additional embedding HTTP requests. A controlled pending local request verified abort propagation through the real SDK/IPC path. Draft save/load/clear succeeded through IPC. This cancellation test does not claim to measure cancellation of an actual GPU kernel or server queue.
