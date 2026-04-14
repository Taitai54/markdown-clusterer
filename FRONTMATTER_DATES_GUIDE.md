# Frontmatter Date Extraction Guide

## Overview

Your Markdown Clusterer now intelligently extracts and displays dates from YAML frontmatter in your markdown files. This is especially useful for files exported from systems like Recall that include creation and update timestamps.

## Supported Frontmatter Format

The app recognizes this frontmatter format at the start of your markdown files:

```markdown
createdAt: Sun Mar 08 2026 15:08:25 GMT+0000 (Greenwich Mean Time)
updatedAt: Sun Mar 08 2026 15:08:29 GMT+0000 (Greenwich Mean Time)
---

# Your content starts here
```

## Date Priority Logic

The app uses intelligent fallback logic to always show the most relevant date:

1. **createdAt** (from frontmatter) - Preferred, shows original creation date
2. **updatedAt** (from frontmatter) - Used if createdAt is missing
3. **modified** (file system) - Used if no frontmatter dates exist

## Where Dates Appear

### File List View
- Below each file name and size
- Format: 📅 3/8/2026 3:08 PM
- Hover to see label (Created/Updated/Modified)

### Cluster View
- In the file preview pane header
- Shows alongside file size
- Same format and hover behavior

## Date Format

Dates are displayed using your system's locale settings:
- US: MM/DD/YYYY HH:MM AM/PM
- UK: DD/MM/YYYY HH:MM
- ISO: YYYY-MM-DD HH:MM

## Examples

### With Full Frontmatter
```markdown
createdAt: Sun Mar 08 2026 15:08:25 GMT+0000 (Greenwich Mean Time)
updatedAt: Mon Mar 09 2026 10:30:00 GMT+0000 (Greenwich Mean Time)
---
```
**Displays:** 📅 3/8/2026 3:08 PM (Created)

### With Only updatedAt
```markdown
updatedAt: Mon Mar 09 2026 10:30:00 GMT+0000 (Greenwich Mean Time)
---
```
**Displays:** 📅 3/9/2026 10:30 AM (Updated)

### Without Frontmatter
```markdown
# Just a regular markdown file
```
**Displays:** 📅 [file system date] (Modified)

## Technical Details

### Parsing
- Uses `js-yaml` library for robust YAML parsing
- Handles various date string formats
- Gracefully falls back if parsing fails

### Performance
- Date extraction happens during file loading
- No performance impact on clustering
- Dates cached with file objects

### Error Handling
- Invalid YAML is silently ignored
- Malformed dates fall back to next priority
- Always shows some date (file system as last resort)

## Testing Your Files

1. Load your Recall export files into the app
2. Check the file list - you should see creation dates
3. Click a file in a cluster to see dates in the preview
4. Hover over dates to see the label (Created/Updated/Modified)

## Troubleshooting

### Dates Not Showing
- Check that frontmatter starts at line 1 (no blank lines before)
- Verify the `---` separator is on its own line
- Ensure date format matches the expected pattern

### Wrong Dates Showing
- If showing "Modified" instead of "Created", check frontmatter format
- Verify the YAML field names are exactly `createdAt` and `updatedAt`
- Check for typos in the frontmatter

### Date Format Issues
- Dates display in your system locale
- Change system settings to adjust date format
- All dates use consistent formatting throughout the app

## Future Enhancements

Potential features that could be added:

- **Sort by date**: Order files by creation/update date
- **Date filtering**: Show only files from a date range
- **Date-aware clustering**: Group files by time period
- **Batch date editing**: Update frontmatter dates in bulk
- **Timeline visualization**: See files on a timeline
- **Date statistics**: Show date ranges per cluster

## Sample File

A test file (`test-frontmatter-sample.md`) is included in the project root. Load it into the app to verify date extraction is working correctly.
