# Development handoff — Markdown Clusterer

Updated: 20 September 2026 (Indian/Mauritius). Start here next session.

## Objective and current position

Build a dependable personal desktop tool for organizing a growing Markdown library on the owner's Mac, primarily with downloaded local models and offline operation. Optimize total time to an accepted organization, including manual corrections. Keep Electron/React; no rewrite, hosted backend, vector database or new hardware is currently justified.

The strategic review and three implementation rounds are complete. Next: representative acceptance and the remaining usability/reliability backlog below. Do not reimplement caching, cancellation, saved projects or export undo: they already exist.

## Workspace and version-control state

- Repository: `/Users/matt.atkinson/Documents/GitHub/markdown-clusterer`.
- Last commit observed: `e29da04` (`updates`). **The development described here is still uncommitted**, across modified tracked files and new untracked modules/docs/tests.
- Preserve all existing changes. `AGENTS.md` was already untracked before this work; do not replace it or treat it as a new implementation artifact.
- Build output under `release/` is ignored by Git. Tests use temporary synthetic fixtures. No owner document corpus was selected or processed.
- No commit, push, distribution publishing, global Ollama configuration change, or network disconnection was performed.

## Delivered functionality

| Area | Implemented |
|---|---|
| Local/offline readiness | Local setup without OpenAI credentials; persisted local settings; offline mode forces both model routes local and bypasses cloud startup validation; no cloud fallback. Loopback-only local endpoint, redirect rejection and explicit cloud-tag rejection. |
| Runtime and UI repairs | Electron updated to 44.4.3; modern dropped-file path bridge; virtualization APIs corrected; production dependency fixes. |
| Export review and recovery | Exact source/destination preview, frontmatter before/after, explicit Move acknowledgement, staged payloads/backups, persisted journals, guarded undo after restart and interrupted-Move recovery. |
| Saved projects | Named snapshots of files/groups/options, unsaved-change prompts, changed/missing source warnings, reload sources, path updates following Move/undo. |
| Reusable categories | Saved reviewed names/descriptions/namespaces and up to three example previews per category; examples embedded with the active model; weak/ambiguous assignments go to Uncertain. |
| Embedding reuse | Shared bounded in-memory LRU for Cluster, Suggest k and category application; input/provider/endpoint/model/preprocessing identity, duplicate-input reuse, manual clear. Maximum 5,000 vectors and 64 MiB vector payload. |
| Cancellation | Single active model job; abortable requests and waits; cancellable K-means worker; no partial groups replace previous results. Settings changes blocked during active model jobs. |
| Recovery autosave | Separate atomic local draft, 800 ms debounce, pre-task flush, explicit startup Recover/Discard, visible write failures. Named projects remain explicitly saved. |

## Machine and model evidence

Observed 19 September: Apple Silicon (`arm64`), 48 GiB RAM, host Node 24.2.0, Electron 44.4.3 / embedded Node 24.21.0. Ollama installed and running. Tested pairing:

- Endpoint: `http://127.0.0.1:11434/v1`
- Embeddings: `bge-m3:latest` (1,024 dimensions)
- Naming: `gpt-oss:20b`

Other downloaded models included `qwen3-embedding:4b` and several larger chat models. No downloads are needed for the tested pair. Do not infer that a running loopback server itself never proxies remotely: Ollama's cloud features must be disabled for the intended offline guarantee. Global Ollama settings were not changed.

## Verification already completed

Last implementation validation: **33 passing tests** — 23 backend and 10 UI/hook. Renderer build and Apple Silicon desktop build passed. Packaged archive smoke passed with real Ollama for normal inference and real Electron IPC for project/category/export/undo/recovery operations. Repeated Suggest k made zero extra embedding HTTP calls. Cancellation was checked with a controlled pending local request and separate worker/naming regression tests.

These results are historical evidence from the preceding session, not checks rerun when this handoff was written. There has **not** been a fully disconnected Finder cold-start acceptance run, a representative owner-corpus quality benchmark, or validation of server-side GPU cancellation.

Commands for the next session:

```sh
npm test -- --run
npm run test:offline
npm run test:product
npm run test:resilience
npm run build:mac:dir
# Requires running Ollama and the installed models; uses an isolated profile and synthetic files:
env -u ELECTRON_RUN_AS_NODE npx electron scripts/smoke-desktop.cjs --packaged
```

Use `npm run dev` for development and `./launch.sh` for the built app. Build artifact: `release/mac-arm64/Markdown Clusterer.app`. Rebuild after code changes before judging the packaged smoke. The inherited `ELECTRON_RUN_AS_NODE` flag previously caused a misleading desktop-launch failure; the smoke command above removes it.

Production dependency audit last reported zero advisories after updates. The full tree still reported 32 development/build advisories (including two critical); recheck before release rather than assuming counts are current. The app has a default Electron icon and no Developer ID signing/notarization. Windows/Linux and live cloud providers remain unverified.

## Recommended next stage and prioritized backlog

Priority order is guidance, not a claim that work below is already authorized for execution by this handoff request.

| Priority / ID | Work | Acceptance / completion criterion |
|---|---|---|
| P0 / ACCEPT-01 | Representative pilot and disconnected cold start | Use 50–100 owner-approved **copied** documents across several topics. Record expected groups, stage timings, correction effort and time to accepted export. Reopen project and packaged app offline, export/undo, reconcile outputs and unchanged originals. Exercise stopped-server and missing-model errors. Record actual results, not assumptions. |
| P1 / LOCAL-02 | Discover models and allow embedding-only setup | List installed models/capabilities where supported, keep manual entry for other compatible servers, make generative naming optional, and visibly report naming fallback. A user with only a dedicated embedding model can complete clustering and export. No automatic downloads or cloud fallback. |
| P1 / SCALE-01 | Consistent import bounds and responsive file operations | Enforce per-file, total-byte and file-count limits across every import entry point; explain skipped files. Move blocking import work off the main thread and allow safe cancellation. Measure a supported collection envelope. Export cancellation must preserve journal recovery semantics rather than stopping arbitrarily. |
| P1 / RETAIN-01 | Manage saved data and recovery storage | Show project/category/export recovery sizes; add deliberate deletion and retention controls. Clearly identify loss of undo before removing backups. Never auto-prune incomplete recovery journals without an explicit policy. |
| P1 / REL-01 | Release/tooling maintenance and UI acceptance | Triage development/build advisories without blind force-upgrades. Add a proper icon and decide whether signing/distribution is needed. Verify keyboard/focus behavior, narrow-window layout, recovery dialog, actual user gestures and reopen flows. Preserve passing offline tests. |
| P2 / QUALITY-01 | Long-document embeddings, driven by pilot failures | Compare section sampling or chunk pooling against current prefix previews on the same annotated corpus. Demonstrate fewer corrections before making it default. Change preprocessing/cache identity and re-embed category examples consistently. |
| P2 / EXPLAIN-01 | Explain and improve suggestions | Show representative passages and weak/close matches; make clear that cosine scores are not calibrated confidence. Improve representative naming/example sampling beyond first members. Avoid promoting an unreviewed Uncertain group into a future category set by accident. |
| P2 / PROVENANCE-01 | Record reproducible run metadata | Persist effective provider/endpoint/model/preprocessing/seed and timings with runs/exports, without credentials. Consider local model digests to detect replaced tags; preserve provider isolation. |
| P3 / RESUME-01 | Resume partially completed inference | Only if measurements justify it: persist job checkpoints with correct content/model identity and clear stale-result rules. Current autosave restores review state, not running jobs. |

**Suggested next implementation slice if no corpus is ready:** LOCAL-02 (model discovery, embedding-only setup and visible naming warnings). It removes unnecessary onboarding friction without needing private documents. If larger imports are already causing pauses, move SCALE-01 ahead of it based on that evidence.

For ACCEPT-01, the missing input is the owner's chosen sample folder and expected categories. Ask for that specific information; do not search unrelated personal folders or process arbitrary private files. Useful code/documentation work can continue independently.

## Known limits to retain in product claims

- Embeddings use leading previews (normally 1,500 characters); exceptionally long titles can exceed that bound. Whole-document understanding is not implemented.
- Category threshold 0.35 and best/second-best gap 0.04 are heuristics, not validated probabilities. Category examples currently come from the first three members.
- Session cache does not survive restart and cannot detect a model replaced behind the same tag/endpoint; clear it manually in that case. K-means now uses seed 42.
- Cancellation covers model workflows and workers, not import/export. It cannot promise immediate cancellation of computation inside a separate inference server.
- File I/O and snapshot serialization remain synchronous. Full document contents are held in memory; maximum safe corpus size is unmeasured.
- Recovery can lose edits inside the debounce window. It is one current local draft, not multi-workspace history or in-flight task continuation.
- Export is a recoverable sequence, not a filesystem-wide transaction or power-loss guarantee. Undo refuses conflicting later edits, leaves empty folders, and does not restore original filesystem timestamps. Undo newer exports first when shared indexes changed.
- Project/category snapshots and recovery payloads contain private document text on local disk. Export recovery storage has no automatic retention cleanup yet. Keep normal backups.

## Code map

| File | Responsibility |
|---|---|
| `electron/main.js` | Main process, provider resolution, IPC, orchestration and import |
| `electron/preload.js` | Explicit desktop API exposed to renderer |
| `electron/local-models.js` | Loopback policy, local SDK client, vector validation |
| `electron/embedding-cache.js` | Bounded session vector cache |
| `electron/jobs.js`, `electron/clustering-worker.js` | Job cancellation and worker K-means/Suggest k |
| `electron/export-service.js` | Preview, commit journal, backups and undo |
| `electron/library-service.js` | Project/category storage and category assignment |
| `electron/recovery-store.js` | Atomic recovery snapshot storage |
| `src/App.jsx` | Workspace state and workflow integration |
| `src/hooks/useRecovery.js` | Debounce, pre-task flush and startup recovery decision |
| `src/components/LibraryBar.jsx`, `ExportPreview.jsx`, `ProgressModal.jsx` | Product controls, export review and cancellation |
| `scripts/{offline,product,resilience}.test.cjs` | Backend regression suites |
| `scripts/smoke-desktop.cjs` | Isolated Electron/local-model workflow smoke, optional packaged archive |

## Reading order and documentation caveats

1. This handoff, then [product workflows](docs/PRODUCT_WORKFLOWS.md).
2. [Architecture](docs/ARCHITECTURE.md) and [PRD](docs/PRD.md).
3. [Validation](docs/VALIDATION.md), read **through the latest appended iteration**.
4. [Offline guide](docs/OFFLINE_GUIDE.md) for setup.
5. [Strategic review](docs/TECH-REVIEW.md) and `docs/reviews/` for original rationale.

The strategic review, reviewer memos, and earlier validation sections are historical. Some describe features as absent that subsequent iterations delivered. Latest code and the docs in `docs/` take precedence. `archive/CODE_REVIEW.md` and `CLAUDE.md` also include older implementation context.

## Next-session starting prompt

> Read HANDOFF.md and the current AGENTS.md. Preserve the uncommitted implementation. Continue the next development stage: first establish whether a representative corpus is available; otherwise implement LOCAL-02 (installed-model discovery, embedding-only setup and visible naming fallback). Keep offline routing and export recovery intact, add meaningful regression coverage, rebuild the Mac app and update the handoff/validation with actual results. Do not repeat features already delivered or claim disconnected acceptance without running it.
