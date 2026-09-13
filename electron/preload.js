const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
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
  
  // Organization
  organizeFiles: (outputFolder, clusters, files, options) => 
    ipcRenderer.invoke('organize-files', outputFolder, clusters, files, options),
  readDedupManifest: (folderPath) => ipcRenderer.invoke('read-dedup-manifest', folderPath),
  
  // Logging & Debugging
  getLogPath: () => ipcRenderer.invoke('get-log-path'),
  getLogs: (lines) => ipcRenderer.invoke('get-logs', lines),
  openLogFolder: () => ipcRenderer.invoke('open-log-folder')
});
