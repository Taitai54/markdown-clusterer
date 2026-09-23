const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPathForFile: (file) => webUtils.getPathForFile(file),
  configureLocal: (settings) => ipcRenderer.invoke('configure-local', settings),
  disableOffline: () => ipcRenderer.invoke('disable-offline'),
  // API Key management
  setApiKey: (apiKey, baseURL, pineconeKey) => ipcRenderer.invoke('set-api-key', apiKey, baseURL, pineconeKey),
  checkEnvApiKey: () => ipcRenderer.invoke('check-env-api-key'),
  saveApiKey: (apiKey, baseURL, pineconeKey) => ipcRenderer.invoke('save-api-key', apiKey, baseURL, pineconeKey),
  loadApiKey: () => ipcRenderer.invoke('load-api-key'),
  deleteApiKey: () => ipcRenderer.invoke('delete-api-key'),
  setEmbeddingModel: (modelName) => ipcRenderer.invoke('set-embedding-model', modelName),
  getProviderConfig: () => ipcRenderer.invoke('get-provider-config'),
  setChatProvider: (providerName) => ipcRenderer.invoke('set-chat-provider', providerName),
  setEmbeddingProvider: (providerName) => ipcRenderer.invoke('set-embedding-provider', providerName),
  
  // File/Folder selection
  selectFolder: () => ipcRenderer.invoke('select-folder', { multiSelections: true }),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  
  // File reading
  readFolder: (folderPath) => ipcRenderer.invoke('read-folder', folderPath),
  readFiles: (filePaths) => ipcRenderer.invoke('read-files', filePaths),
  processPaths: (paths) => ipcRenderer.invoke('process-paths', paths),
  
  // Clustering
  clusterFiles: (files, numClusters, aiHint) => ipcRenderer.invoke('cluster-files', files, numClusters, aiHint),
  suggestClusters: (fileCount) => ipcRenderer.invoke('suggest-clusters', fileCount),
  suggestK: (files) => ipcRenderer.invoke('suggest-k', files),
  onProgress: (callback) => ipcRenderer.on('clustering-progress', callback),
  removeProgressListener: () => ipcRenderer.removeAllListeners('clustering-progress'),
  
  cancelJob: () => ipcRenderer.invoke('cancel-job'),
  cacheStats: () => ipcRenderer.invoke('cache-stats'),
  clearEmbeddingCache: () => ipcRenderer.invoke('clear-embedding-cache'),
  saveDraft: (session, project) => ipcRenderer.invoke('save-draft', session, project),
  loadDraft: () => ipcRenderer.invoke('load-draft'),
  clearDraft: () => ipcRenderer.invoke('clear-draft'),
  listLibrary: () => ipcRenderer.invoke('list-library'),
  saveProject: (name, session, id) => ipcRenderer.invoke('save-project', name, session, id),
  openProject: (id) => ipcRenderer.invoke('open-project', id),
  saveCategories: (name, session) => ipcRenderer.invoke('save-categories', name, session),
  applyCategories: (id, files, threshold) => ipcRenderer.invoke('apply-categories', id, files, threshold),
  previewExport: (...args) => ipcRenderer.invoke('preview-export', ...args),
  commitExport: (id) => ipcRenderer.invoke('commit-export', id),
  exportHistory: () => ipcRenderer.invoke('export-history'),
  undoExport: (id) => ipcRenderer.invoke('undo-export', id),
  // Organization
  organizeFiles: (outputFolder, clusters, files, options) => 
    ipcRenderer.invoke('organize-files', outputFolder, clusters, files, options),
  readDedupManifest: (folderPath) => ipcRenderer.invoke('read-dedup-manifest', folderPath),
  
  // Logging & Debugging
  getLogPath: () => ipcRenderer.invoke('get-log-path'),
  getLogs: (lines) => ipcRenderer.invoke('get-logs', lines),
  openLogFolder: () => ipcRenderer.invoke('open-log-folder')
});
