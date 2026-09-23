> Follow-up implementation: saved projects, reusable categories, export preview and recovery journals have since been delivered. The strategic review below is preserved as the earlier assessment; see [product workflows](PRODUCT_WORKFLOWS.md) and [validation](VALIDATION.md) for current behavior.

**PROCEED WITH CONDITIONS — keep this app and finish proving the local, Copy-first workflow on this Mac.**

# TECHNOLOGY REVIEW — Markdown Clusterer
**Reviewed:** 19 September 2026 · **Lenses:** architecture, commercial, experience
**Material:** Original README at `e29da04`; current source and implementation diff; [architecture](ARCHITECTURE.md), [PRD](PRD.md), and [reviewer memos](reviews/architecture.md). **Decision under review:** the owner's request to run the tool “on my computer” and “use the tool offline.” No expenditure or delivery duration was committed in the request.

## Verdict
**PROCEED WITH CONDITIONS**

The existing desktop application is the right foundation for this personal tool; a rewrite, hosted backend and new hardware are not justified. The principal source defects blocking local operation have been addressed during this review, and real local-model and isolated Electron/IPC smoke runs (including the built app archive) establish basic compatibility on the owner's Apple Silicon Mac with 48 GiB RAM. Proceed to a bounded personal trial subject to these proposed acceptance conditions: **(1)** repository maintainer records a packaged, disconnected, no-cloud-key workflow by **26 September 2026**; **(2)** owner and maintainer compare a representative copied corpus against manual sorting by **3 October 2026**; **(3)** owner uses Copy for that trial, beginning **19 September 2026**, and the maintainer demonstrates recovery before recommending Move. These dates are review recommendations, not commitments already accepted by the owner.

**Confidence in this review:** Medium — strong source evidence and a small live model check; no observed complete disconnected desktop workflow, representative quality measurement or crash-recovery trial.

## The simple version

The tool should save you the work of sorting your notes while keeping them on your computer. It already has the useful parts: importing files, grouping them, letting you correct the groups and producing ordinary folders you can use elsewhere.

The one change that matters is making that whole journey dependable without internet access. The cloud-account dependency and conflicting local/cloud routing have been corrected. The next proof is opening the installed app offline, sorting a small real collection and checking every exported file.

Use the Mac and downloaded models you already have. The next cost is your review time and a small amount of engineering, not a new subscription or computer. Judge success by time to an output you actually accept, including correcting mistakes. Keep copying files until moving and recovery are proven. Stop adding providers and features until this basic journey saves time.

**What this is really about.** Recover useful order from your own collection without surrendering control of its contents or turning the organizing tool into another maintenance burden.

## The five things that matter

1. **The local route is now credible, but offline acceptance is still outstanding.** Current code forces both model stages local in offline mode, skips cloud-key startup checks, restricts local requests to loopback and prevents a stale Pinecone selection from overriding local embeddings. Saved local settings remove dependence on a terminal `.env`; these are meaningful fixes, not evidence of a completed disconnected Finder session. Sources: [`main.js`](../electron/main.js), `offlineMode`, `generateEmbeddingsForFiles`, `configure-local`; [`local-models.js`](../electron/local-models.js); [PRD OFF-01–04](PRD.md). *(F-ARC-02, F-ARC-06, F-COM-01, F-CX-01, F-CX-02)*

2. **Protect the source collection before trusting convenience features.** Export now records actual successful destinations, including collision suffixes and namespaces, and the UI displays returned partial-failure warnings. Move still uses rename or write-then-unlink without a recovery journal, and auxiliary index/dedup write errors are now included in returned warnings; Copy remains the appropriate first-use path. Sources: [`main.js`](../electron/main.js), `organize-files`; [`App.jsx`](../src/App.jsx), organize result handling; [PRD EXP-01–03](PRD.md). *(F-ARC-03, F-CX-03, F-CX-08)*

3. **Useful grouping matters more than a successful model call.** The implementation primarily embeds a 1,500-character preview and names from the first five members; topics appearing later can be missed, and application K-means is unseeded. The recorded four-document local smoke with `bge-m3:latest` and `gpt-oss:20b` produced two coherent groups and naming JSON in about 13.436 seconds, but cannot establish accuracy, largest collection size or net time saved. Sources: [`main.js`](../electron/main.js), `getContentForEmbedding`, `CONFIG`, clustering handler; [`smoke-local.cjs`](../scripts/smoke-local.cjs); execution results recorded in [validation](VALIDATION.md). *(F-ARC-05, F-COM-03, F-CX-07)*

4. **The remaining performance work is mostly ordinary application work.** Local requests now have a 120-second deadline and eight-document batches, but import and K-means still run in the main process, the progress UI has no cancellation and Suggest k then Cluster repeats embeddings. A bounded session cache and measured import limits are cheaper first moves than adding a database or buying a larger computer; a request deadline is not cancellation of the whole job. Sources: [`local-models.js`](../electron/local-models.js); [`main.js`](../electron/main.js), `generateEmbeddingsForFiles`, `suggest-k`, file reads; [`ProgressModal.jsx`](../src/components/ProgressModal.jsx). *(F-ARC-04, F-COM-02, F-CX-04, F-CX-06)*

5. **Keep the product smaller than its provider menu.** Standard Markdown output, Copy defaults and human rename/merge/split controls are strengths to protect. Automatic naming already falls back to generic labels, but local setup still tests both models, so an explicit embedding-only mode would remove a real dependency; no evidence justifies a hosted service or expanded platform scope. Sources: [`main.js`](../electron/main.js), `configure-local` and naming fallback; [`App.jsx`](../src/App.jsx), initial `orgMode`; [architecture](ARCHITECTURE.md). *(F-COM-05, F-COM-06, F-CX-08)*

## Decision readiness

| What is being asked | Can it be decided on this material? | What is missing |
|---|---|---|
| Continue this architecture on the existing Mac [TWO-WAY] | YES | Nothing that warrants a rewrite |
| Start a personal trial using copied files [TWO-WAY] | WITH CONDITIONS | Packaged disconnected workflow and file reconciliation |
| Declare the complete workflow verified offline [TWO-WAY] | NO | Cold restart, absent cloud credentials, local-server failure and complete export acceptance |
| Use Move on valuable originals [ONE-WAY] | NO | Recovery demonstration and deliberate confirmation |
| Buy hardware or add paid commitments [ONE-WAY where non-refundable] | NO | Measured workload or quality shortfall |

## One-way doors

There is no proposed platform contract or irreversible architecture migration. The significant one-way door is deleting source files through Move, particularly when rewriting frontmatter; successful API calls do not justify crossing it. Uploading private document previews through explicitly selected cloud routes is also not undoable: keep offline mode enforced for private runs. Model choice, UI changes and session caching are inexpensive to reverse.

## Recommendations

Estimates below are review estimates of effort, not quotations or observed expenditure. Sequence prerequisites first; all actions can start within 90 days.

### R1 — Prove the installed offline journey [TWO-WAY]
**Why now:** Source fixes and model compatibility need one end-to-end acceptance record.
**First 90 days:** Maintainer and owner run the PRD's fresh-profile, disconnected launch/import/review/Copy checks by 26 September; include missing-model and stopped-server cases on disposable files.
**Cost shape:** Estimate: half to one engineering day plus owner observation; no new service.
**How you will know it worked:** Every exported path exists, originals are unchanged, settings survive restart and processing succeeds without external connectivity; record by 26 September.
**What it forecloses:** Declaring readiness solely from development startup or unit checks.

### R2 — Measure whether real organization saves time [TWO-WAY]
**Why now:** The current smoke proves compatibility, not value; follows R1.
**First 90 days:** Owner selects a copied 50–100-document sample, including long notes, and maintainer records manual versus assisted accepted-export time by 3 October.
**Cost shape:** Estimate: half a day each of owner/engineering time; no purchases.
**How you will know it worked:** Assisted total time including corrections beats the recorded manual baseline; source corruption and missing reported files remain zero.
**What it forecloses:** Choosing models from speed or reputation alone.

### R3 — Close export uncertainty before promoting Move [TWO-WAY]
**Why now:** A plausible success screen cannot substitute for a recoverable file operation.
**First 90 days:** Auxiliary output errors are now included in results. Maintainer adds export preview and explicit Move confirmation, then tests interrupted/failed writes using disposable fixtures by 10 October; keep Move secondary until recovery is demonstrated.
**Cost shape:** Estimate: two to four engineering days for reporting, preview and initial recovery work; cross-volume recovery may increase this.
**How you will know it worked:** Every requested operation reconciles to success or failure, and an interrupted trial can be resumed or reversed without missing originals.
**What it forecloses:** One-click destructive organization without a reviewed plan.

### R4 — Remove repeated inference and make naming optional [TWO-WAY]
**Why now:** Both reduce cost and waiting without changing the user's outcome; use R2 timings to confirm priority.
**First 90 days:** Maintainer adds a bounded session cache keyed by processed input, endpoint, provider, model and preprocessing version; expose embedding-only setup and visible naming fallback by 17 October.
**Cost shape:** Estimate: one to three engineering days; no database or subscription.
**How you will know it worked:** Unchanged Suggest k → Cluster performs one embedding pass, settings/content changes invalidate reuse, and a run succeeds without a chat model.
**What it forecloses:** Cache reuse across incompatible vector spaces; mandatory generative naming.

### R5 — Set a measured size limit and add cancellation where it matters [TWO-WAY]
**Why now:** Full-file memory and synchronous work remain possible bottlenecks despite request deadlines.
**First 90 days:** Maintainer measures the owner's largest intended sample after R2, applies consistent import bounds, moves blocking work off the UI path and adds cancellation by 31 October; record a supported envelope rather than claiming unlimited scale.
**Cost shape:** Estimate: two to five engineering days, depending on recovery scope.
**How you will know it worked:** The documented maximum sample remains interactive, cancellation stops new model work, and aborted runs preserve sources and understandable state.
**What it forecloses:** Unbounded imports and reliance on force-quitting as routine recovery.

## Simplification

| Component | Verdict | Consequence |
|---|---|---|
| Electron app and existing local runtime | REUSE | Preserve the working desktop shape and avoid a new operations burden |
| Mandatory naming setup | DELETE | One embedding model can deliver useful editable groups |
| Additional providers and persistent vector database | DEFER | Support fewer combinations until workload evidence justifies expansion |
| Repeated embeddings within a session | DELETE | Cache one bounded result with correct identity |
| Local route policy, vector validation and narrow preload API | KEEP — LOAD-BEARING | Prevent configuration mistakes and malformed model output crossing critical boundaries |
| Human review, Copy and actual-path manifests | KEEP — LOAD-BEARING | Protect originals and retain inspectable, portable results |
| Cancellation and file-operation accounting | BUILD | Small-tool reliability that directly supports the owner |

**The riskiest assumption:** Preview-based local clustering saves more sorting effort than it creates in corrections.
**The cheapest thing that would test it:** R2's paired manual/assisted trial on a copied real sample, estimated half a day each for owner and maintainer, within two weeks.

## Scenarios

Horizon: the next six months of personal use. These are deliberately short scenarios for a small reversible decision, not an enterprise forecasting exercise. Driving forces considered: collection size, rate of new notes, topic overlap, document length, filename quality, correction effort, model compatibility, model storage, inference latency, available memory, maintenance time and privacy preference. Impact/uncertainty screening prioritizes collection growth and semantic difficulty; machine ownership and output portability are already known. The selected axes can vary independently: many short distinct notes can be easy to group, while a small set of long overlapping notes can be hard.

**Critical uncertainties:** collection workload remains occasional / becomes frequent and large × topics remain easy / require contextual judgment.
**Predetermined elements:** sources stay ordinary files; local models require downloaded assets and a running runtime; human acceptance determines useful output.

### Quiet filing cabinet — occasional workload × easy topics

A small collection sorts well and occasional manual corrections are acceptable. Maintaining many provider choices becomes a greater burden than processing itself; sophisticated persistence would sit unused. **For this decision:** the current desktop shape, generic naming and Copy are sufficient after acceptance; resist expanding the product.

### Busy inbox — frequent large workload × easy topics

Grouping stays useful but repeated import and waiting consume the saved time. Full-file memory, main-thread processing and re-embedding become observable costs. **For this decision:** retain the architecture while prioritizing caching, limits, cancellation and eventually incremental processing; model sophistication is overbuilt if workflow speed is the problem.

### Difficult notebook — occasional workload × contextual topics

The collection is modest but decisive content appears late or spans several subjects. Fast plausible groups create correction work. **For this decision:** compare title/tag sorting, chunk-aware previews and manual grouping before adding a larger model. Keep the tool as an assistant; do not automate source relocation.

### Working library — frequent large workload × contextual topics

Both throughput and judgment become difficult. A larger model alone fixes neither bookkeeping nor changing topic boundaries, and maintenance can erase the personal benefit. **For this decision:** first bound scope to selected collections; persistent indexing is an option only after measured repeated demand. Stop expansion if accepted-output effort no longer improves on simpler organization.

### Moves by type

| Move | Type | Rationale |
|---|---|---|
| Offline acceptance and source-preserving export | ROBUST | Necessary in every world |
| Session cache and manual naming | HEDGE | Cheap protection against repeated inference and naming overhead |
| Small chunking experiment | OPTION | Estimated one engineering day buys evidence before changing preprocessing |
| Persistent semantic library or new hardware | BET | Useful only if sustained workload and measured constraints justify it |

### Signposts

- **Quiet filing cabinet:** few runs in the owner's usage log; low manual movement counts in the acceptance record.
- **Busy inbox:** increasing imported bytes per run; repeated embedding time dominates stage measurements.
- **Difficult notebook:** manual moves concentrate in long notes; owner-reviewed decisive passages lie beyond previews.
- **Working library:** both correction counts and workflow time rise; maintenance time approaches observed sorting time saved.

## Blue sky

Two ideas earn a test; additional ideas would pad this review.

### B1 — Let the owner's corrections teach the next filing session
**The assumption it rests on:** The owner's recurring topics are more stable than unconstrained new clusters.
**Cheapest falsifying test:** Reuse representative examples from accepted groups to classify one later batch; estimate one engineering day plus one hour of owner review, over one week. Reject if corrections do not fall versus fresh clustering.
**What a positive result would unlock:** A small optional saved-topic workflow, before any vector database commitment.
**Why this is available to this business specifically:** The owner supplies an existing private collection and authoritative personal corrections that generic benchmarks cannot provide.

### B2 — Organize without copying the documents
**The assumption it rests on:** The owner primarily needs navigation rather than changed source locations.
**Cheapest falsifying test:** Generate a Markdown index of links for one accepted grouping and use it for a week; estimate half an engineering day and one hour of owner review. Reject if links do not support the owner's actual downstream work.
**What a positive result would unlock:** An index-only export mode that removes duplication and most move-recovery exposure.
**Why this is available to this business specifically:** The product already has local paths, group assignments and a Markdown-oriented owner workflow; an index can be tried without replacing the collection.

## Where the reviewers disagreed

Architecture and experience graded the baseline local/cloud gate CRITICAL; commercial graded it MAJOR because remediation was small and no purchase was pending. Both readings are understandable: it blocked the requested offline behavior, but did not justify stopping the product. Current source removes that gate, so the decision is now conditional acceptance, not a repeated unresolved critical defect.

All three converge on export truthfulness and representative quality; these are merged into findings 2 and 3. The compatibility smoke reduces uncertainty about this Mac and installed models, but does not contradict their missing-quality finding. Benefit versus capability was tested: no numerical benefit case exists and short previews cannot substantiate broad accuracy claims. Timeline versus dependencies was tested: downloaded models, a running local service and a real sample precede acceptance. No integration-budget, personalization/identity, headcount-saving or year-three retirement claims exist to reconcile; applying those enterprise tests would manufacture work.

## Reviewer reliability

All three memos clearly label their pre-remediation baseline and trace material findings to code. Their line numbers describe that baseline, so this synthesis checked current functions before promoting five findings. We do not carry forward cloud gating, incorrect manifest destinations or absent local request deadlines as unchanged defects. We also do not convert limited benchmarks into hardware inadequacy, or treat missing enterprise availability/cost models as a blocker for one owner.

Source review added the residual logging-only handling of auxiliary export failures and the fact that setup still requires both models despite naming fallback. The runtime has moved from Electron 28 to declared Electron 44.4.3; that is a compatibility improvement, not security certification. Package/build outcomes belong in the implementation validation record and should not be inferred from a changed version number.

## What could not be assessed

- Complete packaged offline usability: requires the disconnected restart-to-export test, including no cloud credentials and deliberate server failure.
- Owner-specific grouping quality, maximum useful collection size, peak memory and net time saved: require the PRD sample and timing record.
- Crash recovery, symlink/race behavior and cross-volume Move safety: require disposable filesystem failure-injection trials.
- Model licences, external provider guarantees and formal dependency security assurance: no external research or specialist audit was conducted by this synthesis.
- Keyboard/VoiceOver completion: experience identified source gaps; a direct accessibility session remains necessary.
- Monetary return: no owner time valuation, usage baseline or spending commitment was supplied; local processing is not zero-cost maintenance.

## Questions for the sponsor to put to the authors

1. Which copied 50–100-file sample will establish acceptance, and what was the manual sorting time?
2. Where is the recorded packaged restart-to-export run with internet disconnected and no cloud key?
3. Can each requested export operation be reconciled to an existing destination or a visible failure?
4. What exact recovery test must pass before Move is recommended for originals?
5. How many manual moves and renames are required on the representative sample, including long documents?
6. What measured collection size remains responsive on this Mac, and what happens when that size is exceeded?
7. Does generated naming save enough owner time to justify a second model and its setup?

## Standing caveat
This is a technical and commercial review — an input to your own judgement, not regulated legal, financial, tax, security-certification or data-protection advice. Where this memo names a matter for a qualified adviser, treat that as the recommendation.
