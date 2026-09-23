## COMMERCIAL REVIEW — Markdown Clusterer

**Confidence:** Medium
**Basis:** Direct review of the implementation and operating documentation establishes cost drivers and avoidable work; no measured personal workload or benefit baseline was supplied.
**Materials reviewed:** `README.md` (providers, usage, cost and efficiency); `package.json` (scripts and packaging); `DESKTOP_LAUNCH.md`; `CODE_REVIEW.md`; `launch.sh`; `electron/main.js` (provider clients, embedding generation, clustering, naming, export and suggested k); `src/App.jsx` (startup and workflow); `src/components/ApiKeyModal.jsx`.
**Materials unavailable or unreadable:** No cost spreadsheet, model benchmark, representative workload measurement or benefit log was supplied. Secrets were intentionally not read.
**Proportionality applied:** A reversible, personal desktop utility on an existing Mac; no enterprise funding process, five-year procurement exercise or cash-saving claim is required. This is the 19 September 2026 pre-remediation baseline: fixes made during the wider review must be assessed separately against their tests.

### Headline

Support a small, local-first improvement of the existing application. The strongest benefit is less manual document sorting without dependence on cloud credits or connectivity, but that benefit has not yet been measured. Do not buy hardware, expand provider coverage or commission a rewrite before the existing Mac completes a representative offline workflow with acceptable manual correction effort.

### The decision as you understand it

The user requests a strategic review and fitness for local models and offline use on their own computer. The repository describes an app that “organizes markdown files into topic-based clusters”; it does not state a time budget or incremental spending limit for making this reliable.

### Findings

**F-COM-01 · ISSUE · MAJOR**
- **Claim:** The baseline implementation makes the claimed local workflow depend on unrelated OpenAI readiness and can route a local selection to a paid external service.
- **Evidence:** `README.md`, Choosing a provider: local is “the only option with no quota ceiling at all, since it never leaves your machine.” `electron/main.js`, `cluster-files`: `if (!openaiClient)` returns “API configuration not set”; `generateEmbeddingsForFiles`: selecting `multilingual-e5-large` invokes `https://api.pinecone.io/embed` before considering the embedding provider. `src/App.jsx`, startup, tries `loadApiKey` and `checkEnvApiKey`.
- **So what:** The user cannot rely on the local/no-cloud-cost promise as the basis for adoption. This is major, rather than critical, because a small reversible fix is available and no purchase is proposed.
- **Ask:** Can a fresh local-only configuration complete import, clustering and export with no cloud key and external connectivity disabled?

**F-COM-02 · OPPORTUNITY · MAJOR**
- **Claim:** Reuse embeddings between Suggest k and clustering, with invalidation when input content, preprocessing, endpoint or model changes.
- **Evidence:** `CODE_REVIEW.md`, Still open: “`suggest-k` and `cluster-files` each re-embed the full file set”; `electron/main.js`, both handlers call `generateEmbeddingsForFiles(files)`.
- **So what:** This removes one complete embedding pass from that two-step workflow: 50% of its embedding requests and input volume before retries. It does not halve total runtime because k-means, naming and export remain. A bounded in-memory cache has a small implementation and test cost and avoids a database or storage migration.
- **Ask:** Does an unchanged Suggest k → Cluster run reuse vectors, and do model/content changes demonstrably invalidate them?
- **First step:** Cache one recent embedding result and test request counts and invalidation on a small fixture corpus.

**F-COM-03 · GAP · MAJOR**
- **Claim:** The repository does not evidence whether model-assisted sorting saves the user time after correcting the results.
- **Evidence:** `README.md`, Key Features promises “Groups files” and “real-time AI naming”; Usage includes manual drag, merge and split. The Cost and efficiency section lists model and truncation settings, but no before/after workload, correction rate or accepted-export timing.
- **So what:** Faster inference can still produce a slower overall task if short previews or poor groupings demand extensive corrections. Time saved is personal capacity, not a cash saving.
- **Ask:** On a representative corpus, what is the total time from import to an accepted export versus the user's current manual method?

**F-COM-04 · GAP · MINOR**
- **Claim:** Neither an improvement effort limit nor a complete personal run-cost baseline is recorded.
- **Evidence:** `README.md`, Cost and efficiency: “Defaults are chosen to keep this cheap to run”; `package.json` lists several cloud/local integration options and platform build targets, but the reviewed material contains no maintenance hours, corpus size, provider usage totals or spending ceiling.
- **So what:** Local inference removes metered API charges for those requests, not setup time, model storage, compute, electricity or maintenance. Existing hardware purchase cost is sunk; a new purchase requires a separate decision. A short personal baseline is sufficient here.
- **Ask:** What maximum maintenance effort and incremental spend would make this tool worthwhile to its owner?

**F-COM-05 · OPPORTUNITY · MINOR**
- **Claim:** Make generic/manual naming an explicit local workflow option, so a chat model is optional for useful grouping.
- **Evidence:** `electron/main.js`, naming error handling already returns `name: \`Cluster ${i + 1}\``; `src/App.jsx` exposes rename and regroup actions; `README.md`, Choosing a provider says embeddings are “what actually groups your files; naming is cosmetic by comparison.”
- **So what:** The minimum useful installation needs one embedding model. Optional naming avoids the second model download and its inference work when the user prefers to label groups manually. The cost shape is a small UI/configuration change with reuse of existing fallback behavior.
- **Ask:** Does automatic naming reduce accepted-export time enough to justify the extra local runtime and setup?
- **First step:** Expose a no-model naming option and compare manual labels against automatic labels on the same corpus.

**F-COM-06 · OBSERVATION · MINOR**
- **Claim:** Plain-file output and the existing desktop architecture keep switching and exit costs relatively low.
- **Evidence:** `README.md`, Organize output describes copied/moved files, YAML metadata and index manifests, and explicitly says the app “doesn't upload to a Pinecone index itself”; `package.json`, build files includes `dist/**/*` and `electron/**/*`.
- **So what:** Preserve standard Markdown output and the existing Mac application. There is no evidenced need for a hosted backend, vector database subscription or replacement application to meet the user's stated outcome. This is an architectural strength, not a claim that export recovery is already proven.
- **Ask:** Can all useful results be read and reused without this application or any model service?

### Numbers check

These checks describe baseline code paths, exclude SDK retries, and are not model performance benchmarks. Characters are not tokens.

| Check | Expected | Stated in material | Result |
|---|---|---|---|
| Embedding requests for N files | `ceil(N / 100)` per pass | Batch size 100 | PASS: source arithmetic |
| Suggest k then Cluster | `2 × ceil(N / 100)`; reuse avoids `ceil(N / 100)` | Two independent generator calls | PASS: 50% fewer embedding requests with reuse |
| Illustration: 1,000 files, both actions | `2 × ceil(1000 / 100) = 20` embedding requests before retries; 10 with reuse | No workload size is claimed; 1,000 is an illustrative input | PASS: arithmetic only |
| Maximum embedding preview input in that illustration | `2 × 1000 × 1500 = 3,000,000` preview characters before retries | `EMBEDDING_PREVIEW_LENGTH: 1500` | PASS: upper bound for preview text, not token billing |
| Naming preview input per populated cluster | At most `5 × 1000 = 5000` preview characters, plus titles and prompt overhead | `MAX_SAMPLE_FILES: 5`, `CLUSTER_PREVIEW_LENGTH: 1000` | PASS: input is bounded; output tokens not explicitly capped in baseline |
| Naming requests | At most k requests for populated groups, k ≤ 15 | Clustering validation caps k at 15 | PASS: initial request count, excluding retries |
| Payback, NPV, IRR, benefit break-even and six-month delay sensitivity | Require cost, time benefit, usage frequency and dated cash flows | None supplied | NOT CALCULABLE: do not invent an ROI |

There is no stated financial headline to reconcile. Presented value is qualitative convenience and local control; value surviving financial scrutiny is still unquantified, not zero. A suitable personal value calculation is `(manual minutes − assisted minutes including correction) × runs`, tracked separately from cash expenditure. No conversion into currency is warranted without the owner's explicit valuation.

TCO scope for this decision: one-off setup/model downloads and fixing/testing time; recurring maintenance, optional cloud usage, disk and power; switching time if local models/endpoints change. Existing Mac ownership is not incremental expenditure. Build/signing distribution costs matter only if distributing the app; integration count is the maintained embedding/naming provider paths, not an enterprise platform programme. No year-three growth or hardware replacement can be responsibly modelled without observed usage.

Commercial red flags checked: total commitment, recurring costs, internal effort and benefit baseline are absent from the reviewed material; bounded calls are not a cloud currency budget. No claimed monetary benefits, attributed revenue, pilot uplift, double counting, contribution-margin case or headcount reduction were found. Renewal, minimum commitment, SLA, contractual exit and discount-rate tests are not decision-relevant to the proposed local-only personal workflow; revisit before adopting a paid commitment. There is no evidenced prior benefit outturn or stop gate; the proposed representative offline trial supplies the proportionate gate.

### The simplification question

- Keep the existing Electron application and Markdown exports; a rewrite adds cost without an evidenced benefit.
- Support one known-working local embedding model first; add further provider/model combinations only when they solve a measured quality or availability problem.
- Defer automatic naming when generic labels plus manual editing suffice.
- Avoid maintaining a persistent vector store until measured repeat workloads justify it; begin with bounded in-memory reuse.

### What I could not assess

- Actual Mac RAM, available disk, installed model tags, throughput and thermal behavior: need a measured run on the user's machine.
- Quality and net time saved: need a representative corpus and an accepted-output comparison against manual sorting.
- Currency cost: need real provider usage, tariffs if cloud use is retained, and the user's maintenance effort record. No external price claims were used.
- Offline release readiness: needs a disconnected launch and complete workflow test of the actual packaged or installed build, including downloaded models.
- Post-review remediation: findings above describe the baseline reviewed, not a certification of concurrent fixes.

### Cross-functional flags

- **ARCHITECTURE:** Verify key-free provider readiness, enforced local routing, bounded inference, vector validation and cache identity; local selected in a dropdown alone does not establish offline behavior.
- **ARCHITECTURE:** Verify copy/export recovery and completeness before recommending move mode for valuable source notes.
- **EXPERIENCE:** Measure manual correction time and truncated-document misclassification, not only successful API calls.

### Signals to watch

- The user repeatedly repairs the same grouping mistakes: observe corrected file assignments per accepted run before choosing a larger model.
- Suggest k or clustering dominates waiting time: compare stage timings before adding hardware.
- Provider bills or model downloads grow: record actual usage and disk consumption before adding more models.
- Maintenance time exceeds observed sorting time saved: simplify supported configurations or stop expanding the tool.

### Top three questions for the sponsor

1. Which real corpus and manual workflow should establish whether the tool saves you time?
2. What elapsed time and correction effort would make an offline run acceptable on your existing Mac?
3. What maintenance effort or new expenditure would make you prefer simpler manual organization instead?
