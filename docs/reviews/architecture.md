## ARCHITECTURE REVIEW — Markdown Clusterer local desktop readiness

**Confidence:** High for source defects; Medium for operational fitness.
**Basis:** Direct tracing of the import → embedding → clustering → naming → export journey; no live model benchmark or packaged-app execution performed by this reviewer.
**Materials reviewed:** `electron/main.js`, `electron/preload.js`, `electron/logger.js`, `src/App.jsx`, duplicate detection in `src/components/ClusterView.jsx`, `package.json`, `vite.config.js`, `index.html`, `launch.sh`, `markdowncluster.command`, `README.md`, `CODE_REVIEW.md`, `CLAUDE.md`, `verify_logic.js`, repository file inventory.
**Materials unavailable or unreadable:** No supplied representative corpus, measured performance budget, recovery test or model-quality evaluation. Secrets in `.env` deliberately not read.
**Proportionality applied:** One person's desktop productivity tool; no enterprise availability, identity platform, distributed service or regulated-system requirements imposed.

### Headline

Keep the Electron application and its existing provider seam. The baseline source supports local model requests but does not support a trustworthy offline workflow: cloud-key readiness gates local clustering, and the embedding-model override can still route to Pinecone. Export correctness and recoverability matter more than another model provider.

This is a **baseline review**, taken on 19 September 2026 with HEAD `e29da04`, before concurrent remediation in this work session. Line references describe that baseline; the main strategic review should distinguish fixes delivered subsequently from remaining work.

### The decision as you understand it

Make this existing application dependable on the owner's Mac, including operation without internet after installation and model download. The baseline README describes an “AI-powered desktop app” and local models, but supplies no bounded offline acceptance criteria, elapsed-time commitment or maintenance budget; those must be made explicit without inventing precision.

### Findings

**F-ARC-01 · GAP · MAJOR**
- **Claim:** The baseline material does not define the decision or measurable meaning of offline fitness.
- **Evidence:** `README.md`, “Choosing a provider”, “Installation” and “Running the app” describe provider configuration and build commands, but no disconnected cold-start acceptance test, corpus envelope or hardware acceptance record. `CLAUDE.md`, Architecture, describes implementation rather than the commitment.
- **So what:** Working API calls can be mistaken for a usable desktop product; a packaged Finder launch and a terminal development launch have different configuration paths. A limited hardening iteration is justified; a rewrite is not evidenced.
- **Ask:** Will the owner accept a bounded local-first hardening release, contingent on a disconnected packaged-app test with their representative files?

**F-ARC-02 · ISSUE · CRITICAL**
- **Claim:** Local provider support is blocked by OpenAI readiness, and selecting local does not guarantee local embedding traffic.
- **Evidence:** `electron/main.js:742` and `:1166` require `openaiClient`; `:455` and `:493` validate credentials with `models.list()`. `src/App.jsx:203` initializes readiness from these cloud-key paths and `:574` disables clustering without it. `electron/main.js:329` gives `multilingual-e5-large` precedence over `getEmbeddingClient()` and calls `https://api.pinecone.io/embed`.
- **So what:** The principal requested outcome cannot be relied on as presented. An independent main-process offline policy must cover startup validation, embedding and naming, including custom endpoints; a label saying “local” is insufficient.
- **Ask:** Can a fresh installation with no cloud credentials cluster and export while external network access is blocked, including after restarting with an old E5 selection?

**F-ARC-03 · ISSUE · MAJOR**
- **Claim:** Export can report completion while omitting files, and its index can name destinations that do not exist.
- **Evidence:** `electron/main.js:1018` constructs `relativeForManifest` from the original relative filename before writing, despite `getCollisionFreePath()` choosing a different actual name. Paths are appended before successful copy. `:1121` returns `success: true` with `warnings`; `src/App.jsx:423` marks organization complete without displaying them. Per-cluster namespace output at `main.js:980` is also not incorporated into that index path.
- **So what:** The owner cannot use the success screen or manifest to verify completeness. Re-running can create extra suffixed copies. Move and frontmatter rewrite are expensive-to-reverse decisions: `:1031` writes then unlinks the source without an export journal or demonstrated recovery.
- **Ask:** Will completion show successful, skipped and failed counts, with an index built only from actual committed destinations and copy as the safe default?

**F-ARC-04 · GAP · MAJOR**
- **Claim:** The implementation has no evidenced corpus envelope or application-controlled deadline for expensive work.
- **Evidence:** `electron/main.js:612` recursively reads synchronously; the 50 MiB check at `:624` is absent from direct reads at `:667` and `:713`. K-means executes on the main thread at `:785` and repeatedly at `:1192`. `src/components/ClusterView.jsx:64` compares every pair within a cluster on the renderer thread. Provider client construction supplies no explicit timeout; the Pinecone fetch at `main.js:333` has no abort signal.
- **So what:** Large imports, an overloaded local runtime or stopped inference can make a personal tool appear hung. UI virtualization does not bound full-content memory or pairwise computation. This is a volume risk, not a measured claim that today's corpus is too large.
- **Ask:** What file-count, total-byte and longest-operation limits pass on the owner's actual Mac, and how can the user cancel a run safely?

**F-ARC-05 · GAP · MAJOR**
- **Claim:** Model choice and clustering quality lack a reproducible evaluation tied to organizing the owner's documents.
- **Evidence:** `electron/main.js:117` selects 1,500-character embedding previews; `:785` uses unseeded `kmeans++`; `:810` names from the first five members; `src/components/ClusterView.jsx:70` labels cosine similarity above `0.92` as overlap. `verify_logic.js` explicitly tests copied helper logic, while the baseline test inventory contains only two renderer component suites.
- **So what:** A local model returning valid vectors does not establish useful grouping, and a similarity threshold is not evidence of duplicate documents. Long notes may be grouped by boilerplate at their start. Human refinement is valuable and should remain.
- **Ask:** Does a representative labelled corpus show useful grouping versus a title/tag baseline, with stable results and no automatic deletion based on similarity?

**F-ARC-06 · GAP · MAJOR**
- **Claim:** Provider configuration and durable provenance are insufficient for repeatable Finder-launched use.
- **Evidence:** `electron/main.js:4` calls `require('dotenv').config()` using the working directory; runtime provider overrides at `:16` are explicitly “Session-only, not persisted.” `package.json`, build.files, includes `dist`, `electron` and `package.json`, not an external settings onboarding mechanism. The export manifest at `main.js:1080` stores clusters but no provider, exact model, preprocessing version or run identifier.
- **So what:** Terminal success may not transfer to a packaged launch, and a future model change can silently change groupings without a record explaining why. The underlying markdown remains portable; exported organization history is the missing system of record, not a reason to add a database service.
- **Ask:** Can the packaged app persist non-secret endpoint/model selections in its application data directory and record the resolved model plus preprocessing settings with each export?

**F-ARC-07 · GAP · MAJOR**
- **Claim:** The desktop trust boundary needs targeted hardening before claiming private processing.
- **Evidence:** `electron/preload.js` exposes explicit methods, which is a strength, but `organizeFiles` forwards renderer-supplied paths and structures; `electron/main.js:34` checks lexical containment only. `:511` accepts an arbitrary custom `baseURL`; provider maps allow an arbitrary `OLLAMA_BASE_URL`. `index.html:6` permits inline scripts. `package.json` pins the broad Electron 28 major range.
- **So what:** Local inference alone does not enforce data locality; endpoint validation and filesystem authorization deserve separate contracts. Symlink destinations are not covered by lexical path checks. No claim is made here about a current vulnerability or vendor support date: those require separate verification.
- **Ask:** Will offline mode constrain requests to validated loopback endpoints, and will export validate destinations and renderer inputs against the user's selected roots?

**F-ARC-08 · OPPORTUNITY · MAJOR**
- **Claim:** Reuse one embedding result through suggestion and clustering, and make generative naming optional.
- **Evidence:** `generateEmbeddingsForFiles()` is already shared by both handlers, but called afresh at `electron/main.js:769` and `:1184`. Naming already falls back to “Cluster N” at `:848`; the algorithm does not require chat output.
- **So what:** For a Suggest k → Cluster flow, a correctly keyed session cache removes one complete embedding pass. Skipping naming removes up to one chat call per nonempty cluster and lets a small machine run only its embedding model. Cost shape is local implementation and regression work; no new service, licence or purchased platform is required.
- **Ask:** Can embeddings be reused only when content, provider, endpoint, model and preprocessing match, with a usable naming-disabled mode?
- **First step:** Add a session-scoped cache at the existing embedding seam, instrument request counts, and verify that a changed document or model invalidates reuse.

### Numbers check

| Check | Expected | Stated in material / arithmetic | Result |
|---|---|---|---|
| Offline dependency count | Zero external requests when offline selected | Cloud readiness validation plus Pinecone override remain reachable | FAIL |
| Provider integration inventory | Explicitly count distinct model destinations | 4 embedding-compatible/chat services (OpenAI, OpenRouter, Gemini, Ollama) + Pinecone embedding endpoint = 5 destinations; not all active together | PASS — reviewer count |
| Reuse for Suggest k then Cluster | One embedding pass for unchanged inputs | With N files, 2 × ceil(N/100) embedding batches before retries; at illustrative N=1,000, 20 rather than 10 | FAIL |
| Suggest-k work bound | Quantify algorithm repetitions | k=2…min(10,floor(N/2)): at N≥20, 10−2+1 = 9 k-means runs, plus the final clustering run | PASS — count, not a speed guarantee |
| Pairwise overlap work | State scaling before claiming corpus fitness | One illustrative 1,000-file cluster: 1,000×999/2 = 499,500 vector comparisons; at 10,000: 49,995,000 | FAIL — no measured responsive envelope |
| Explicit embedding retry delay | Show configured delay separately from request time | 3 attempts → waits of 2+4 = 6 seconds; SDK retry/request duration is additional and not bounded by these constants | PASS — arithmetic; total deadline absent |
| Maximum sampled naming text | Bound preview sampling | 5 files × 1,000 characters × up to 15 clusters = 75,000 nominal preview characters plus filenames/instructions; unusually long titles can exceed the nominal preview bound | PASS — nominal arithmetic only |
| File-size contract | Same limit for all import routes | Folder path checks 50×1,024×1,024 = 52,428,800 bytes; direct selection lacks that check | FAIL |

### The simplification question

- Keep one Electron application, one narrowly defined preload interface and one provider abstraction. Splitting this into network services would create operations work for one owner without an evidenced benefit.
- Defer a vector database. The existing workflow is batch grouping of a chosen corpus, not a persistent semantic-search service. A session cache addresses the immediate repeat-work problem.
- Make naming optional and permit manual names. Protect the existing fallback and manual review; they keep the generative model out of the file-commit decision.
- Keep source markdown as the authority and copy as the default. Make manifests describe completed exports rather than introduce a second master for document content. The reference “Two masters” anti-pattern is avoidable here; no evidence justifies adding synchronization machinery.
- Retain provider flexibility, but remove contradictory provider/model controls and stale configuration comments. No business platform is being replaced, so decommissioning means retiring duplicate readiness logic and repeat requests, not inventing a migration programme.

### What I could not assess

- Installed model tags, available RAM/disk, inference throughput, thermal effects and competing applications. A hardware/runtime inventory and representative timed run are needed.
- Packaged cold start from Finder with internet unavailable and cloud credentials absent. Development startup does not prove it.
- Crash recovery, permission-denied writes, cross-volume moves, disk exhaustion, symlink destinations and integrity of export manifests under failure. These need disposable filesystem fixtures, not experiments on the owner's originals.
- Dependency security/support horizon, model licences and actual installed dependency versions. No external research or security certification was performed.
- Quality versus human organization, stability across runs and model-specific duplicate thresholds. A small owner-labelled corpus and recorded model versions would allow assessment.
- Numerical p95 latency, RPO/RTO and storage-growth targets are absent. For this tool, measured interaction responsiveness and copy-source preservation are more useful starting requirements than enterprise availability targets.

### Cross-functional flags

- **EXPERIENCE:** Separate “ready for embedding” from “naming available”; report partial exports and distinguish offline selection from runtime readiness.
- **COMMERCIAL:** Establish the maintenance time budget and acceptance corpus before estimating further work; provider price comparisons are secondary to local utility.

### Signals to watch

- Sustained UI stalls or memory pressure as corpus size grows: measure import, grouping and overlap time separately before moving CPU work to workers.
- A request for incremental search across persistent libraries: that would change the cache/persistence decision and could justify a different data architecture.
- External model traffic during an offline test: treat any occurrence as failure, regardless of whether clustering eventually succeeds.

### Top three questions for the sponsor

1. Which representative corpus must complete usefully on this Mac before the release is considered fit?
2. Can copy-only organization be the acceptance path until move recovery is demonstrated?
3. Is automatic naming useful enough to justify loading a chat model, or is local embedding plus manual naming sufficient for the first dependable offline release?
