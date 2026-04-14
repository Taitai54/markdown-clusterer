# Code Review - Markdown Clusterer

## Executive Summary

This is a well-structured Electron + React application for AI-powered markdown clustering. The codebase demonstrates good separation of concerns, proper IPC communication, and a clean UI. However, there are several security, performance, and code quality improvements that should be addressed.

## Critical Issues

### 1. **SECURITY: Exposed API Key in .env**
**Severity: CRITICAL**
- The `.env` file contains a hardcoded OpenAI API key that is committed to the repository
- This key is publicly visible and should be revoked immediately
- **Action Required**: 
  - Revoke the exposed API key at platform.openai.com
  - Remove the key from `.env` and add `.env` to `.gitignore` (already done)
  - Never commit API keys to version control

### 2. **SECURITY: API Key Storage**
**Severity: HIGH**
- API keys are only stored in memory, not persisted securely
- Users must re-enter their API key every time they restart the app
- **Recommendation**: Use Electron's `safeStorage` API to encrypt and persist API keys
```javascript
const { safeStorage } = require('electron');
// Store: safeStorage.encryptString(apiKey)
// Retrieve: safeStorage.decryptString(encrypted)
```

### 3. **Missing Error Boundaries**
**Severity: MEDIUM**
- React components lack error boundaries
- A single component error could crash the entire app
- **Recommendation**: Add error boundaries around major component trees

## Code Quality Issues

### electron/main.js

#### Issues:
1. **Unused variable**: `Math.min(50, ...)` calculation result is not used (line 244)
2. **Magic numbers**: Hardcoded values like `1500`, `1000`, `100` should be constants
3. **No rate limiting**: OpenAI API calls lack exponential backoff for all endpoints
4. **Memory concern**: Loading all file contents into memory could cause issues with large datasets

#### Improvements:

```javascript
// Add constants at the top
const CONFIG = {
  EMBEDDING_PREVIEW_LENGTH: 1500,
  CLUSTER_PREVIEW_LENGTH: 1000,
  EMBEDDING_BATCH_SIZE: 100,
  MAX_RETRIES: 3,
  MAX_SAMPLE_FILES: 5
};

// Fix unused calculation (line 244)
const progress = Math.min(50, Math.round(((i + batch.length) / files.length) * 50));
event.sender.send('clustering-progress', `Generated embeddings for ${i + batch.length}/${files.length} files... (${progress}%)`);
```

5. **Inconsistent error handling**: Some functions return `{ success: false, error }`, others throw
6. **No input validation**: File paths and user inputs aren't validated before use

### src/App.jsx

#### Issues:
1. **State management complexity**: 11 useState hooks - consider useReducer
2. **Missing cleanup**: Event listeners may not be properly cleaned up
3. **No debouncing**: `numClusters` input could trigger excessive re-renders
4. **Prop drilling**: Deep component hierarchies pass many props

#### Improvements:
```javascript
// Use useReducer for complex state
const initialState = {
  apiKeySet: false,
  files: [],
  clusters: [],
  isProcessing: false,
  // ... other state
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_FILES':
      return { ...state, files: action.payload, clusters: [], organized: false };
    case 'SET_CLUSTERS':
      return { ...state, clusters: action.payload };
    // ... other actions
  }
}

const [state, dispatch] = useReducer(appReducer, initialState);
```

2. **Add debouncing for numClusters**:
```javascript
import { useMemo } from 'react';
import debounce from 'lodash.debounce';

const debouncedSuggestClusters = useMemo(
  () => debounce((count) => {
    window.electronAPI.suggestClusters(count).then(setNumClusters);
  }, 300),
  []
);
```

### src/components/ClusterView.jsx

#### Issues:
1. **Accessibility**: Drag-and-drop only - no keyboard navigation
2. **No undo functionality**: File moves are immediate with no way to revert
3. **Large file preview**: Loading entire file content could freeze UI
4. **Color array hardcoded**: Should be in a theme/config file

#### Improvements:
```javascript
// Add keyboard support
const handleKeyDown = (e, fileIndex, clusterIndex) => {
  if (e.key === 'Enter' || e.key === ' ') {
    // Show move dialog or context menu
  }
};

// Virtualize file preview for large files
import { FixedSizeList } from 'react-window';

// Add undo stack
const [history, setHistory] = useState([]);
const handleMoveWithUndo = (fileIndex, from, to) => {
  setHistory(prev => [...prev, { type: 'move', fileIndex, from, to }]);
  onMoveFile(fileIndex, from, to);
};
```

### src/components/FileDropZone.jsx

#### Issues:
1. **Undefined function**: `onDropPaths` is called but not passed as prop
2. **Fallback behavior unclear**: Falls back to `onSelectFiles()` which may not handle paths

#### Fix:
```javascript
function FileDropZone({ onSelectFolder, onSelectFiles, onDropPaths }) {
  // ... existing code
  
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer && e.dataTransfer.files && onDropPaths) {
      const paths = Array.from(e.dataTransfer.files).map(f => f.path).filter(Boolean);
      if (paths.length > 0) {
        onDropPaths(paths);
        return;
      }
    }
    
    // Only fallback if onDropPaths not provided
    if (!onDropPaths) {
      onSelectFiles();
    }
  };
}
```

### electron/logger.js

#### Issues:
1. **Synchronous file operations**: `fs.appendFileSync` blocks the event loop
2. **No log level filtering**: Debug logs always written in production
3. **Memory leak potential**: Logs grow unbounded until rotation

#### Improvements:
```javascript
// Use async file operations
async write(level, message, data = null) {
  const logEntry = this.formatMessage(level, message, data);
  
  // Console logging (sync is OK here)
  this.logToConsole(level, logEntry);

  // Async file writing
  try {
    await this.rotateLogIfNeeded();
    await fs.promises.appendFile(this.logFile, logEntry + '\n\n');
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

// Add log level configuration
constructor(minLevel = 'info') {
  this.minLevel = minLevel;
  this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
  // ... rest of constructor
}

shouldLog(level) {
  return this.levels[level] >= this.levels[this.minLevel];
}
```

## Performance Improvements

### 1. **Batch Processing Optimization**
```javascript
// In cluster-files handler, process embeddings in parallel batches
const batchPromises = [];
for (let i = 0; i < files.length; i += 100) {
  batchPromises.push(processBatch(files.slice(i, i + 100)));
}
const embeddings = (await Promise.all(batchPromises)).flat();
```

### 2. **Memoization in React Components**
```javascript
// In FileList.jsx
import { memo } from 'react';

const FileCard = memo(({ file, index, onRemove, expanded, onToggle }) => {
  // ... component code
});

// In ClusterView.jsx
const clusterColors = useMemo(() => [
  'from-blue-500/20 to-blue-700/20 border-blue-500/30',
  // ... rest of colors
], []);
```

### 3. **Virtual Scrolling for Large Lists**
```javascript
// Install react-window
// npm install react-window

import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={files.length}
  itemSize={120}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <FileCard file={files[index]} />
    </div>
  )}
</FixedSizeList>
```

## Architecture Improvements

### 1. **Add Context API for Global State**
```javascript
// src/contexts/AppContext.jsx
import { createContext, useContext, useReducer } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
```

### 2. **Separate Business Logic from UI**
```javascript
// src/hooks/useClustering.js
export function useClustering() {
  const handleCluster = async (files, numClusters, aiHint) => {
    // Move clustering logic here
  };
  
  return { handleCluster, isProcessing, error };
}
```

### 3. **Add TypeScript**
Consider migrating to TypeScript for better type safety:
```typescript
interface ClusterFile {
  name: string;
  path: string;
  content: string;
  size: number;
  modified: Date;
}

interface Cluster {
  name: string;
  description: string;
  fileIndices: number[];
}
```

## Testing Recommendations

### 1. **Add Unit Tests**
```javascript
// tests/utils/fileProcessing.test.js
describe('File Processing', () => {
  test('should filter markdown files', () => {
    const files = ['test.md', 'test.txt', 'test.js'];
    const result = filterMarkdownFiles(files);
    expect(result).toEqual(['test.md', 'test.txt']);
  });
});
```

### 2. **Add Integration Tests**
```javascript
// tests/integration/clustering.test.js
describe('Clustering Flow', () => {
  test('should cluster files and organize them', async () => {
    // Test full clustering workflow
  });
});
```

### 3. **Add E2E Tests with Playwright**
```javascript
// tests/e2e/app.spec.js
test('should load files and cluster them', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.click('text=Select Files');
  // ... rest of test
});
```

## Security Enhancements

### 1. **Content Security Policy**
```javascript
// In electron/main.js
mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, 'preload.js'),
    sandbox: true, // Add sandboxing
  }
});

// Add CSP headers
mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': ["default-src 'self'; script-src 'self'"]
    }
  });
});
```

### 2. **Input Sanitization**
```javascript
// Add input validation
const sanitizePath = (filePath) => {
  // Prevent path traversal
  const normalized = path.normalize(filePath);
  if (normalized.includes('..')) {
    throw new Error('Invalid path');
  }
  return normalized;
};
```

### 3. **Rate Limiting for API Calls**
```javascript
class RateLimiter {
  constructor(maxRequests, timeWindow) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = [];
  }
  
  async throttle() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.timeWindow);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.timeWindow - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requests.push(now);
  }
}
```

## UI/UX Improvements

### 1. **Add Loading States**
- Show skeleton loaders instead of blank screens
- Add progress indicators for long operations
- Implement optimistic UI updates

### 2. **Improve Accessibility**
```javascript
// Add ARIA labels
<button
  aria-label="Remove file"
  aria-describedby={`file-${index}-name`}
  onClick={() => onRemove(index)}
>
  ✕
</button>

// Add keyboard navigation
<div
  role="button"
  tabIndex={0}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
```

### 3. **Add Tooltips and Help Text**
```javascript
// Install react-tooltip
import { Tooltip } from 'react-tooltip';

<button data-tooltip-id="cluster-tip" data-tooltip-content="Group similar files using AI">
  🤖 Cluster with AI
</button>
<Tooltip id="cluster-tip" />
```

## Documentation Improvements

### 1. **Add JSDoc Comments**
```javascript
/**
 * Clusters files using OpenAI embeddings and K-means algorithm
 * @param {Array<ClusterFile>} files - Array of file objects to cluster
 * @param {number} numClusters - Number of clusters to create
 * @param {string} aiHint - Optional hint for AI naming
 * @returns {Promise<{success: boolean, clusters?: Array<Cluster>, error?: string}>}
 */
ipcMain.handle('cluster-files', async (event, files, numClusters, aiHint) => {
  // ...
});
```

### 2. **Add Architecture Documentation**
Create `docs/ARCHITECTURE.md` explaining:
- Component hierarchy
- Data flow
- IPC communication patterns
- State management approach

### 3. **Add Contributing Guidelines**
Create `CONTRIBUTING.md` with:
- Code style guidelines
- PR process
- Testing requirements
- Commit message format

## Configuration Improvements

### 1. **Externalize Configuration**
```javascript
// config/default.json
{
  "embedding": {
    "model": "text-embedding-3-small",
    "previewLength": 1500,
    "batchSize": 100
  },
  "clustering": {
    "model": "gpt-4o-mini",
    "temperature": 0.3,
    "maxSampleFiles": 5
  },
  "logging": {
    "level": "info",
    "maxSize": 5242880
  }
}
```

### 2. **Environment-Specific Settings**
```javascript
// Use dotenv-expand for variable substitution
// .env.example
OPENAI_API_KEY=your_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
LOG_LEVEL=info
MAX_FILE_SIZE_MB=10
```

## Build & Deployment Improvements

### 1. **Add CI/CD Pipeline**
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run build
```

### 2. **Add Code Quality Tools**
```json
// package.json
{
  "scripts": {
    "lint": "eslint src electron",
    "lint:fix": "eslint src electron --fix",
    "format": "prettier --write \"src/**/*.{js,jsx}\" \"electron/**/*.js\"",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "@typescript-eslint/parser": "^6.0.0"
  }
}
```

### 3. **Add Pre-commit Hooks**
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

## Priority Action Items

### Immediate (Do Now):
1. ✅ **Revoke exposed API key**
2. ✅ **Remove API key from .env**
3. ✅ **Fix undefined `onDropPaths` prop**
4. ✅ **Add error boundaries**
5. ✅ **Implement secure API key storage**

### Short Term (This Week):
1. Add input validation and sanitization
2. Implement proper error handling patterns
3. Add unit tests for core functionality
4. Refactor state management with useReducer
5. Add accessibility improvements

### Medium Term (This Month):
1. Migrate to TypeScript
2. Add virtual scrolling for large file lists
3. Implement undo/redo functionality
4. Add comprehensive test coverage
5. Set up CI/CD pipeline

### Long Term (Next Quarter):
1. Add plugin system for custom clustering algorithms
2. Implement collaborative features
3. Add cloud sync capabilities
4. Create desktop app auto-updater
5. Build web version

## Conclusion

This is a solid foundation for a markdown clustering tool. The main areas for improvement are:
- **Security**: API key management and input validation
- **Performance**: Virtual scrolling and async operations
- **Code Quality**: TypeScript, testing, and better state management
- **UX**: Accessibility, keyboard navigation, and better feedback

The codebase is well-organized and maintainable. With these improvements, it will be production-ready and scalable.
