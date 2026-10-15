# Markdown Clusters Output Folder

This folder is the default location for organized markdown files after clustering.

## How It Works

1. Load your markdown files into the Markdown Clusterer app
2. Run AI clustering to group similar files
3. Select this folder (or any other) as the output destination
4. Click "Organize Files" to copy/move files into cluster folders

## Folder Structure

After organization, you'll see subfolders like:

```
markdown_clusters/
├── Technical Documentation/
│   ├── api-guide.md
│   └── setup-instructions.md
├── Meeting Notes/
│   ├── standup-2024-01-15.md
│   └── planning-session.md
└── Project Ideas/
    ├── feature-brainstorm.md
    └── roadmap-draft.md
```

## Options

- **Copy Mode**: Keeps original files intact, creates copies in cluster folders
- **Move Mode**: Moves original files to cluster folders
- **Inject Tags**: Adds the cluster name to YAML `tags` (`.md` / `.markdown` only)
- **Inject cluster description**: Writes `cluster`, `clusterDescription`, and `topic_context` into frontmatter
- **Namespace**: Optional subfolder under this output root; also stored in frontmatter when descriptions are injected
- **Preserve relative paths**: Keeps the source folder layout inside each cluster folder
- **Manifest**: Writes `index.json` at the output root
- **Cluster index**: Writes `_index.md` inside each cluster folder
- **Dedup**: Every organize updates `_dedup_manifest.json` so a later run can skip unchanged sources

**Add group to…** puts two groups together. **Combine into one file** writes a single markdown document. **Preview folder export** is what copies or moves each file into a folder here.

## Tips

- Cluster names can be edited by clicking them in the app
- Files can be dragged between clusters before organizing
- The app suggests an optimal number of clusters based on file count
- Use the AI hint field to guide cluster naming (e.g., "Focus on project types")
