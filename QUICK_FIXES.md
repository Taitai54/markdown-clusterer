# Quick Fixes - Priority Issues

## 🚨 CRITICAL: Security Issue

### Exposed API Key
Your OpenAI API key is currently exposed in the `.env` file. Take these steps immediately:

1. **Revoke the exposed key**:
   - Go to https://platform.openai.com/api-keys
   - Find the key starting with `sk-proj-6EFHihntnPKqYoEheE7Y...`
   - Click "Revoke" or delete it

2. **Create a new key**:
   - Generate a new API key
   - Copy `.env.example` to `.env`
   - Add your new key to `.env`

3. **Verify .gitignore**:
   - ✅ `.env` is already in `.gitignore`
   - Never commit `.env` to version control

## 🔧 Code Fixes to Apply

### 1. Fix FileDropZone Missing Prop

**File**: `src/components/FileDropZone.jsx`

The component calls `onDropPaths` but it's not passed as a prop. Update the component signature:

```javascript
function FileDropZone({ onSelectFolder, onSelectFiles, onDropPaths }) {
  // ... rest of code
}
```

And in `src/App.jsx`, pass the prop:

```javascript
<FileDropZone 
  onSelectFolder={handleSelectFolder}
  onSelectFiles={handleSelectFiles}
  onDropPaths={handleProcessPaths}  // Add this line
/>
```

### 2. Fix Unused Calculation in main.js

**File**: `electron/main.js` (line ~244)

Change:
```javascript
Math.min(50, Math.round(((i + batch.length) / files.length) * 50));
event.sender.send('clustering-progress', `Generated embeddings for ${i + batch.length}/${files.length} files...`);
```

To:
```javascript
const progress = Math.min(50, Math.round(((i + batch.length) / files.length) * 50));
event.sender.send('clustering-progress', `Generated embeddings for ${i + batch.length}/${files.length} files... (${progress}%)`);
```

### 3. Add Error Boundary

**Create**: `src/components/ErrorBoundary.jsx`

```javascript
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-dark-200">
          <div className="bg-dark-100 rounded-2xl p-8 max-w-md border border-red-500/50">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h2>
            <p className="text-gray-400 mb-4">
              The application encountered an error. Please restart the app.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

**Update**: `src/main.jsx`

```javascript
import ErrorBoundary from './components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
```

### 4. Add Secure API Key Storage

**File**: `electron/main.js`

Add at the top:
```javascript
const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = require('electron');
const Store = require('electron-store');
const store = new Store();
```

Install electron-store:
```bash
npm install electron-store
```

Add new IPC handlers:
```javascript
// Save API key securely
ipcMain.handle('save-api-key', async (event, apiKey, baseURL) => {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(apiKey);
      store.set('apiKey', encrypted.toString('base64'));
      if (baseURL) {
        store.set('baseURL', baseURL);
      }
      return { success: true };
    } else {
      // Fallback for systems without encryption
      logger.warn('Encryption not available, storing in plain text');
      store.set('apiKey', apiKey);
      if (baseURL) {
        store.set('baseURL', baseURL);
      }
      return { success: true };
    }
  } catch (error) {
    logger.error('Failed to save API key', error);
    return { success: false, error: error.message };
  }
});

// Load API key securely
ipcMain.handle('load-api-key', async () => {
  try {
    const stored = store.get('apiKey');
    if (!stored) {
      return { success: false, error: 'No stored API key' };
    }

    let apiKey;
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(stored, 'base64');
      apiKey = safeStorage.decryptString(buffer);
    } else {
      apiKey = stored;
    }

    const baseURL = store.get('baseURL');
    
    // Test the key
    const config = { apiKey };
    if (baseURL) config.baseURL = baseURL;
    openaiClient = new OpenAI(config);
    await openaiClient.models.list();
    
    return { success: true, baseURL };
  } catch (error) {
    logger.error('Failed to load API key', error);
    return { success: false, error: error.message };
  }
});

// Delete stored API key
ipcMain.handle('delete-api-key', async () => {
  try {
    store.delete('apiKey');
    store.delete('baseURL');
    openaiClient = null;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

**Update**: `electron/preload.js`

```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing methods
  saveApiKey: (apiKey, baseURL) => ipcRenderer.invoke('save-api-key', apiKey, baseURL),
  loadApiKey: () => ipcRenderer.invoke('load-api-key'),
  deleteApiKey: () => ipcRenderer.invoke('delete-api-key'),
});
```

**Update**: `src/App.jsx`

```javascript
// In useEffect, check for stored key
useEffect(() => {
  const checkStoredKey = async () => {
    if (window.electronAPI?.loadApiKey) {
      const result = await window.electronAPI.loadApiKey();
      if (result.success) {
        setApiKeySet(true);
        setShowApiModal(false);
        return;
      }
    }
    
    // Fallback to env check
    if (window.electronAPI?.checkEnvApiKey) {
      const result = await window.electronAPI.checkEnvApiKey();
      if (result.success) {
        setApiKeySet(true);
        setShowApiModal(false);
      }
    }
  };
  checkStoredKey();
}, []);

// Update handleApiKeySubmit
const handleApiKeySubmit = async (apiKey, baseURL) => {
  try {
    const result = await window.electronAPI.setApiKey(apiKey, baseURL);
    if (result.success) {
      // Save for next time
      await window.electronAPI.saveApiKey(apiKey, baseURL);
      setApiKeySet(true);
      setShowApiModal(false);
      setError('');
    } else {
      setError(result.error || 'Invalid API key');
    }
  } catch (err) {
    setError('Failed to set API key: ' + err.message);
  }
};
```

## 📦 Dependencies to Install

```bash
npm install electron-store
```

## ✅ Testing Your Fixes

1. **Test API key storage**:
   - Enter your API key
   - Restart the app
   - Verify you don't need to re-enter it

2. **Test error boundary**:
   - Temporarily throw an error in a component
   - Verify the error boundary catches it

3. **Test file drop**:
   - Drag and drop files onto the app
   - Verify they load correctly

## 📝 Next Steps

After applying these fixes:
1. Review the full `CODE_REVIEW.md` for additional improvements
2. Consider adding TypeScript for better type safety
3. Add unit tests for core functionality
4. Set up ESLint and Prettier for code quality

## 🔒 Security Checklist

- [ ] Revoked exposed API key
- [ ] Created new API key
- [ ] Verified `.env` is in `.gitignore`
- [ ] Applied secure storage fixes
- [ ] Tested API key persistence
- [ ] Removed any other sensitive data from repo
