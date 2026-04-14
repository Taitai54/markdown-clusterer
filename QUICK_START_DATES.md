# Quick Start: Date Features

## What's New?

Your Markdown Clusterer now extracts dates from frontmatter in your Recall export files!

## Your File Format

```markdown
createdAt: Sun Mar 08 2026 15:08:25 GMT+0000 (Greenwich Mean Time)
updatedAt: Sun Mar 08 2026 15:08:29 GMT+0000 (Greenwich Mean Time)
---
# Your content
```

## What You'll See

📅 **3/8/2026 3:08 PM** (hover shows "Created")

## Where Dates Appear

- ✓ File list cards (below file name)
- ✓ Cluster preview pane (in header)
- ✓ Everywhere files are displayed

## Date Priority

1. `createdAt` from frontmatter (best)
2. `updatedAt` from frontmatter (good)
3. File system modified date (fallback)

## Test It

1. Run: `npm run dev`
2. Load: `test-frontmatter-sample.md`
3. See: Date displayed with file info

## That's It!

No configuration needed. Just load your Recall export files and dates will be automatically extracted and displayed.

---

For more details, see:
- **FRONTMATTER_DATES_GUIDE.md** - Complete user guide
- **DATE_FEATURE_SUMMARY.md** - Technical details
- **IMPLEMENTATION_COMPLETE.md** - Full implementation summary
