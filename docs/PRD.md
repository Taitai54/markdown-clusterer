# PRD — Reliable offline Markdown organization

Owner: repository owner. Status: implemented baseline plus explicitly prioritized backlog. Date: 19 September 2026.

## Problem and outcome

A single Mac owner needs to organize local Markdown collections into useful topic folders without depending on internet access, cloud quotas or an OpenAI account. The result must remain understandable and recoverable after reviewing and exporting files. Success is an accepted organized collection with less total effort than manual sorting, including corrections—not merely successful model calls.

## Scope

Import `.md`, `.markdown` and `.txt`; embed, suggest or choose 2–15 groups; name groups; review/rename/merge/split; copy into local folders; optionally enrich frontmatter and create manifests. Support independent cloud providers for intentional online use. Primary offline platform: this owner's Apple Silicon Mac with 48 GiB RAM and installed Ollama models. Windows/Linux remain code targets, unverified in this review.

Non-goals: chat over the library, automatic model downloads, multiuser service, cloud sync, Pinecone ingestion, autonomous source deletion, enterprise identity, or a replacement model runtime.

## User journey and requirements

| ID | Requirement / acceptance | Status |
|---|---|---|
| OFF-01 | A user with no OpenAI key can configure local embedding and naming models, test them and cluster | Implemented; synthetic local and backend regression checks |
| OFF-02 | Saved offline mode forces both model routes local; startup makes no cloud validation request; cloud switching is rejected | Implemented; handler regression checks |
| OFF-03 | Local URL policy rejects remote hosts, redirects and explicit cloud tags; failure never chooses a cloud provider | Implemented; policy tests, redirect uses fetch error policy |
| OFF-04 | Local settings persist across packaged restarts without `.env` | Implemented; packaged restart acceptance still required |
| MOD-01 | Separate embedding and naming model fields with actionable capability errors | Implemented; both tested on save |
| MOD-02 | Naming failure still yields editable generic labels | Existing behavior retained; surface a visible naming warning next |
| EXP-01 | Copy preserves originals; manifests reference successful actual destinations, including collision suffixes and namespaces | Implemented; regression checked |
| EXP-02 | Partial export is visibly incomplete | Implemented; UI displays returned warnings |
| EXP-03 | Preview export plan and require deliberate Move confirmation; recovery journal supports failed moves | Implemented; persisted undo, edit-conflict and interrupted-Move tests |
| JOB-01 | Cancellation, time estimates, resumable sessions, bounded import memory | Saved projects, recovery autosave and model-task cancellation implemented; time estimates, in-flight resume and import memory bounds remain P1 |
| PERF-01 | Reuse embeddings for Suggest k→Cluster, invalidated by content/provider/model/preprocessing changes | Implemented with bounded session cache; configuration/input invalidation and reuse tests |
| QUAL-01 | Representative owner-reviewed benchmark measures cluster corrections and elapsed total workflow | Acceptance work, not established by four synthetic files |
| SEC-01 | Production dependency audit has no known high/critical advisories; maintained Electron runtime | Checked in validation; repeat before releases |

## Proposed acceptance benchmark

Use a copied, owner-approved sample of 50–100 documents spanning at least four topics, including long files, malformed frontmatter, identical names, duplicate content and nested folders. This is a proposed test size, not a validated capacity guarantee. Mark expected topics before viewing model output.

Record import time, embedding time, naming time, peak memory, manual moves/renames, failed files and total time to accepted export. Compare the same corpus against manual sorting. Acceptance target: zero source corruption, every reported exported path exists, no cloud requests in offline mode, both success and intentional server-down paths are understandable, and total accepted-export time improves on the owner's baseline. Quality/speed thresholds should be set after that baseline; no invented ROI or universal model ranking.

Disconnect external networking while leaving loopback/Ollama running. Quit and relaunch the packaged app, import the sample, suggest k, cluster, review, copy-export and inspect every manifest path. Repeat with Ollama stopped to verify prompt failure, then with a missing model. This acceptance is required before calling the entire desktop workflow verified offline.

## Delivery priorities

1. **Current foundation:** local readiness and route isolation, usable file list, maintained runtime, trustworthy export reporting, documented setup and tests.
2. **P1 reliability:** representative acceptance, optional naming, visible fallback warnings, import limits and recovery retention controls. Embedding reuse, worker-thread clustering, model-task cancellation, session recovery and export preview/undo are implemented.
3. **P2 quality:** chunk-aware embeddings for long documents, representative naming samples, stable seeds and run provenance, benchmark-driven model selection, keyboard-complete refinement.

Dependencies: downloaded compatible models, a running local inference server, sufficient free RAM/disk, and a writable output location. No new hardware commitment is justified until measuring the existing machine.

## Product iteration delivered

Project save/open with unsaved-change prompts, changed-source warnings and reload; reviewed category sets with model-consistent example embeddings and an Uncertain group; and exact export preview with persisted guarded undo are implemented. See [workflow guide](PRODUCT_WORKFLOWS.md) for scope and limits. Recovery autosave, bounded embedding caching and model-task cancellation are now implemented. Retention management, cancellable file I/O and resuming partially completed model requests remain future work.
