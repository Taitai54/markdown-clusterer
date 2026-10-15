## EXPERIENCE REVIEW — Markdown Clusterer offline desktop operation

**Confidence:** Medium
**Basis:** Direct inspection of the implemented import, provider selection, clustering and export journeys; no observed end-to-end desktop session or representative corpus benchmark.
**Materials reviewed:** `README.md`, `archive/CODE_REVIEW.md`, `package.json`, `electron/main.js`, `src/App.jsx`, `src/components/{ApiKeyModal,Header,FileDropZone,ClusterView,ProgressModal}.jsx` and the review standards, output contract and omnichannel reference.
**Materials unavailable or unreadable:** None of the requested source material; `.env` deliberately not read. Machine measurements and user research were not supplied to this reviewer.
**Proportionality applied:** One person's reversible desktop workflow. Retail personalization, consented identity graphs, assisted channels and revenue holdouts are outside scope; equivalent data-boundary, recovery and user-control tests remain applicable.

### Headline

The user problem is to turn a local collection of Markdown documents into useful topic folders without uploading private content or spending more time correcting the output than manual sorting would take. The baseline implementation has useful review controls and defaults to copying, but local-model support is not yet a dependable offline promise: onboarding and readiness still depend on OpenAI, and the selected model can override the apparent provider. Correct those seams before treating the tool as offline-ready, then prove quality and recovery on the owner's files.

This is a **baseline review recorded on 2026-09-19 before concurrent remediation**. Findings cite the inspected source and approximate line locations at that time; subsequent implementation and the final strategic review determine closure.

### The decision as you understand it

The request is to make the existing tool fit for use "on my computer" and "use the tool offline." No money or elapsed-time commitment is stated; this review supports a bounded local-first hardening pass, not a new platform. The README describes organization into "topic-based clusters" but does not evidence an acceptance benchmark; see F-CX-07.

### Findings

**F-CX-01 · ISSUE · CRITICAL**
- **Claim:** A fresh local-only user is blocked by OpenAI onboarding and backend readiness gates.
- **Evidence:** `src/components/ApiKeyModal.jsx:24` says "OpenAI API Key", rejects an empty key at line 11 and only exposes Cancel when `isSet`; `src/App.jsx:11` starts with `showApiModal: true`; `electron/main.js:741` and `:1166` gate clustering and Suggest k with `if (!openaiClient)`.
- **So what:** Selecting an installed local embedding/chat pair cannot independently establish readiness, blocking the user's central requirement.
- **Ask:** Can a clean installation with no cloud credentials import, cluster, name and export with the network disconnected?

**F-CX-02 · ISSUE · CRITICAL**
- **Claim:** Provider presentation is insufficient to guarantee that a document stays local.
- **Evidence:** `electron/main.js:329` routes `CONFIG.EMBEDDING_MODEL === 'multilingual-e5-large'` directly to `https://api.pinecone.io/embed`; `src/components/ClusterView.jsx:271` presents OpenAI and Pinecone models independently of the provider dropdown. `src/components/ApiKeyModal.jsx:84` promises the key is "never sent to any server except OpenAI" despite its custom Base URL input at line 45.
- **So what:** A user can reasonably infer local processing from the provider label while content uses a cloud route. Privacy wording also misstates the custom endpoint trust boundary.
- **Ask:** Does one visible offline mode enforce loopback-only model requests, reject cloud/Pinecone choices and display both effective models before processing?

**F-CX-03 · ISSUE · MAJOR**
- **Claim:** Partial export failure is presented as complete success.
- **Evidence:** `electron/main.js:1120` returns `success: true` with `warnings: errors`; `src/App.jsx:424` checks only `result.success`; `src/components/ClusterView.jsx:533` then says "Files have been successfully organized into folders".
- **So what:** The user may trust an incomplete archive or start a second operation without knowing which source files remain, especially in Move mode.
- **Ask:** Will the completion screen reconcile requested, successful and failed files and preserve a retryable failure list?

**F-CX-04 · GAP · MAJOR**
- **Claim:** The long-running local-model journey lacks an explicit cancellation and recovery contract.
- **Evidence:** `src/components/ProgressModal.jsx:18` shows "Processing" and a spinner with no cancel control; `electron/main.js:118` batches 100 embedding inputs and `:805` names clusters sequentially; `src/App.jsx:9` keeps the working session in reducer state.
- **So what:** A stalled model leaves no clear next action; closing the app loses review work. Severity is MAJOR, not CRITICAL, because processing itself precedes file export.
- **Ask:** What timeout, cancel behavior and recoverable state will a stopped local server produce during embedding and naming?

**F-CX-05 · GAP · MINOR**
- **Claim:** Keyboard access does not cover the refinement journey.
- **Evidence:** `src/components/ClusterView.jsx:354` uses a clickable `h3` to rename without a keyboard equivalent; file rows at `:462` support Enter/Space preview but moving uses drag events and selecting for split uses Ctrl/Meta-click. `src/components/ProgressModal.jsx` has no dialog semantics or live progress announcement.
- **So what:** Accessible labels are a useful start but do not establish keyboard completion or screen-reader usability. This is a code finding, not a completed accessibility audit.
- **Ask:** Can the owner complete rename, move, split and progress recovery with a keyboard and VoiceOver?

**F-CX-06 · OPPORTUNITY · MAJOR**
- **Claim:** Reuse embeddings between Suggest k and clustering to shorten the most natural exploratory workflow.
- **Evidence:** `electron/main.js:1184` calls `generateEmbeddingsForFiles(files)` for Suggest k, and the cluster handler calls the same generator again; `archive/CODE_REVIEW.md` explicitly tracks "each re-embed the full file set".
- **So what:** A session cache can eliminate the second full embedding pass on unchanged input; the investment is bounded application work with no additional service or subscription. Time saving remains unmeasured.
- **Ask:** Can reuse be keyed by exact processed content, provider, endpoint, model and preprocessing version so switching models cannot reuse the wrong vectors?
- **First step:** Add a bounded in-memory cache and demonstrate one embedding pass for Suggest k followed by Cluster on an unchanged fixture.

**F-CX-07 · OPPORTUNITY · MAJOR**
- **Claim:** Define a small owner-reviewed quality corpus before expanding model choice or document-processing sophistication.
- **Evidence:** `README.md` promises "topic-based clusters"; `electron/main.js:117` embeds only 1,500 characters per document, and `:810` takes the first five files for naming. The reviewed tests focus on UI behavior and title parsing rather than useful grouping.
- **So what:** A local benchmark can reveal when cheap previews miss a document's subject and whether the local model saves manual sorting time. This requires sample curation and a repeatable script, not an evaluation platform.
- **Ask:** Which real document set, manual correction count and elapsed-time baseline would make the owner accept local clustering as useful?
- **First step:** Curate a small non-sensitive set with short and long documents, record expected broad topics and manual sorting time, then compare local clustering and generic-name fallback against that baseline.

**F-CX-08 · OBSERVATION · MINOR**
- **Claim:** The existing human review and non-destructive defaults are strengths to preserve.
- **Evidence:** `src/App.jsx:20` sets `orgMode: 'copy'`; `src/components/ClusterView.jsx` supplies document preview, rename, merge and split; `electron/main.js:846` falls back to `Cluster ${i + 1}` when naming fails.
- **So what:** Embeddings can deliver value without successful generative naming, and the owner can correct the output before export. These controls support a simpler initial local product.
- **Ask:** Will the acceptance suite preserve Copy as the default and prove that naming failure never discards a valid cluster assignment?

### Numbers check

| Check | Expected | Stated in material | Result |
|---|---|---|---|
| Independent local processing stages | 2 stages: embedding + naming | Both have local clients, but cluster readiness adds an OpenAI-client dependency | FAIL — 2 local clients do not constitute local readiness |
| Embedding work for Suggest k then Cluster | One reusable pass on unchanged input | 2 × N embedded documents | FAIL — duplicate inference work |
| Naming content per cluster | Explicit bounded sample | Up to 5 × 1,000 = 5,000 content-preview characters, plus filenames and prompt | PASS — bounded, but representativeness untested |
| Embedding content for N files | Explicit bounded sample | Up to N × 1,500 content characters | PASS — bounded preview, not full-document analysis |
| Export reconciliation | Successes + failures = requested operations, visibly reported | Backend counts both; UI uses only boolean success | FAIL — user cannot reconcile the result |

The **personalization maturity ladder** is not applicable: document clustering does not rank customer offers and no revenue-uplift benefit case is claimed. Content-variant/segment/channel and identity-share arithmetic are therefore inapplicable. Under the reference's **latency class per use case**, this is batch work with interactive progress; sub-100ms personalization architecture would be unnecessary.

### The simplification question

- Make a single local-first setup path configure both stages and display the effective route; retire the OpenAI-specific onboarding dependency.
- Treat generated names as optional enrichment. Generic labels plus manual rename are a complete fallback.
- Apply the **spine test** proportionately: source documents are the authoritative inputs, model/provider configuration should have one owner, and exported paths must be the record of what actually succeeded. The independent model and provider controls currently risk conflicting interpretations of that configuration.
- Defer vector databases, accounts, orchestration services and persistent embedding storage until a measured need appears. A bounded session cache answers the immediate repeated-inference problem.

### What I could not assess

- Actual Mac memory pressure, local inference speed, warm/cold startup and model availability: require measurements on this computer.
- Actual offline behavior of a packaged app: require a fresh-profile launch with network disconnected and both models already installed.
- Semantic usefulness, long-document failures and manual correction burden: require an owner-reviewed corpus and baseline.
- VoiceOver and keyboard completion: require direct desktop testing; source inspection cannot certify accessibility.
- Session restore or export rollback after abrupt termination: require failure injection and documented expected state.

Two source-traced journeys frame these limits: (1) fresh launch → local setup → import → Suggest k → Cluster → review → Copy; it currently hits the cloud-key gate and repeats inference; (2) cluster review → destination choice → Move/export → partial failure → completion; it currently hides per-file failures. Neither involves a retail assisted-channel handover, which would be artificial to impose here.

### Cross-functional flags

- **ARCHITECTURE:** Enforce offline policy at every request boundary, validate local endpoints and ensure packaging does not rely on developer `.env` state.
- **ARCHITECTURE:** Verify export recovery, manifest path accuracy and source preservation under failure; the UX cannot compensate for incorrect filesystem results.
- **COMMERCIAL:** Evaluate saved owner time and avoided cloud inference against setup and correction effort; model choice alone is not the benefit.

### Signals to watch

- Naming falls back frequently: record fallback count per run so the owner can decide whether the local chat model is worth running.
- Preview-based clusters require repeated manual moves: measure corrections and inspect whether decisive topics occur after the preview boundary.
- The working collection grows enough to degrade responsiveness: measure peak memory and main-thread blocking on the owner's largest set.

### Top three questions for the sponsor

1. Which representative folders and acceptable correction burden define a successful local run?
2. Is all processing required to stay on this Mac, or should cloud processing remain an explicit opt-in for selected runs?
3. Can Move remain secondary to Copy until partial failure reporting and recovery are demonstrated?
