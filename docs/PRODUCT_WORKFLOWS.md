# Projects, reusable categories, and reversible export

Implemented September 19, 2026. These features use local storage and work with the existing offline model configuration.

## Save and resume a project

The **Library** panel appears beneath the header. Enter a name and select **Save project**. Select a saved project and **Open** to resume files, groups, descriptions, namespaces, and export options. Saving the same project name updates the open project; entering a different name saves a separate project. Model settings stay as currently configured.

The header shows **Unsaved changes**. Opening another project, starting a new project, or closing the window prompts before discarding edits. Named project saving is explicit. Unsaved edits also receive a separate recovery copy after 800 ms of inactivity and before a task starts. Startup offers Recover work or Discard recovery copy before overwriting that snapshot.

Projects retain the imported text snapshot. On opening, the app compares it with the current files and warns about changed/missing sources. Export rejects stale source contents. Use **Reload sources** to reread available files, skip missing files and clear prior groups. Save reviewed categories first if you want to reapply them. After a successful Move, the open project follows the destination paths; save again to retain these paths. Undo updates matching paths in the current project back to their original locations.

## Reuse your reviewed categories

After reviewing group names, assignments and namespaces, enter a name and choose **Save reviewed categories**. Start a new project or import a new batch, choose the set and select **Suggest categories**. Applying a set replaces current groups after confirmation.

Each saved category includes its name, description, namespace and the first three assigned document previews (up to 1,500 characters each). These are representative examples, not model training. Every application embeds the new documents and saved examples together using the currently selected embedding model. Normalized example centroids determine category matches; no vectors are reused across model spaces. Naming inference is unnecessary for this operation.

The minimum cosine match defaults to 0.35 and is adjustable from 0 to 1. A gap under 0.04 between the best two categories is also treated as ambiguous. Weak or ambiguous matches go to **Uncertain — review**. These thresholds are initial heuristics, not calibrated probabilities. Review suggestions before export; test on your own collection before relying on any particular threshold.

## Preview, export and undo

**Preview export** shows every exact source/destination path, generated index, collision suffix and frontmatter change before changing output files. Expand **See frontmatter changes** to inspect before/after metadata. Cancel makes no export writes. Confirm Copy or explicitly acknowledge removal of originals before confirming Move.

Preview plans are retained only in memory. Editing source/destination files after preview invalidates the plan: preview again. Exports require one category per input file and reject stale source content, duplicate assignments, path collisions and symlink paths. The app reserves actual collision filenames during preview; it does not silently switch to another path at commit.

Before changing files, the app stages output payloads, backs up replaced indexes and (for Move) original file bytes, and records a recovery journal. **Export history → Undo export** works after restart. Copy undo removes unchanged exported files and restores replaced indexes. Move undo also restores original contents, including original frontmatter. Empty directories remain. Edited outputs or occupied source paths with different content block undo instead of overwriting your changes. If an export is interrupted, its journal remains available for recovery. A completed undo is idempotent. If multiple exports updated the same index files, undo the newest export first; otherwise the changed-index check can block an older undo.

This is a recoverable sequence of file operations, not a filesystem-wide transaction. Power-loss durability, hostile concurrent filesystem changes and deleted recovery storage are not guaranteed. Original filesystem timestamps are not restored. Keep normal backups and review results.

## Local storage and retention

Electron userData contains:

- `library/projects/*.json`: versioned project snapshots, including imported document text; no API credentials or embedding arrays.
- `library/categories/*.json`: versioned category definitions and sample passages.
- `exports/<id>/`: journal, output payloads, replaced-index backups and Move source backups.

These contain private document content in local files. Directories use restricted permissions where supported. Recovery files remain after undo; there is no automatic cleanup or retention UI yet, so disk use grows with exports. Do not delete an export's recovery folder while you need its undo history. No project/category data is sent to a model merely by saving or opening; applying categories sends previews only to the selected embedding route.

## Verification

`npm run test:product` exercises preview without mutation, exact commit paths, stale plans, Copy/Move undo after service restart, original-byte restoration, refusal to overwrite later edits, sidecar restoration, interrupted-Move recovery, source validation, project persistence and category assignment. UI tests verify Move acknowledgement and Cancel. The desktop smoke additionally exercises real Electron IPC and Ollama inference through save/open/apply/preview/commit/undo.


## Faster repeats and cancellable tasks

Embeddings are cached in memory for the current app session, shared by Suggest k, Cluster, and reusable-category suggestions. The key includes the selected provider, endpoint, model name, preprocessing version, preview length and exact prepared input. Unchanged previews reuse vectors; changed previews or configuration do not. Repeated identical previews within a batch need only one inference. The cache holds at most 5,000 vectors and 64 MiB of vector data (plus bounded map/key overhead), evicting least-recently used entries. It contains vectors and hashes, not saved document text, and is not written to disk.

Use **Clear embedding cache** after replacing a local model under the same tag or when you want to force fresh inference. Provider/model-setting changes and quitting the app also clear it. Tags are identifiers, not immutable model digests, so replacing a model behind an unchanged endpoint/tag cannot be detected automatically.

**Cancel task** is available during Cluster, Suggest k and category suggestions. It aborts pending inference requests, rate-limit/retry waits and clustering workers. No partial groups or suggested cluster count replace the previous accepted state. Completed embedding batches may remain cached for another attempt. Only one model job runs at a time, and settings changes are rejected while it is active. Cancelling the application's request does not guarantee the separate inference server immediately releases GPU memory or stops already scheduled work.

K-means now runs in a worker with a fixed seed so the main process can receive cancellation and repeated runs are more reproducible. File import/export and recovery-file serialization remain synchronous and are not cancellable; export recovery continues to use its journal. A cancelled model task does not modify source files.

## Recovery autosave details

`recovery/draft.json` in Electron userData stores one current unsaved workspace snapshot, separate from named projects. It includes imported text and reviewed groups, excludes credentials and vectors, and is atomically replaced. It is local plaintext private document data, like saved projects. Disk-write failure is reported visibly; an existing snapshot is retained if a new write fails. Pending previous-session recovery is never silently replaced before the user chooses.

There is an 800 ms debounce window; edits made immediately before a crash may not be saved. Autosave pauses during tasks, with a flush before starting them. It restores review state, not an in-flight model request, and does not guarantee power-loss durability. Successful explicit project saving clears the now-redundant draft after the debounce period. Recovering changed/missing source files shows warnings and export still rejects stale source content.
