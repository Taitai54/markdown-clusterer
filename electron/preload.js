const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // API Key management
  setApiKey: (apiKey, baseURL) => ipcRenderer.invoke('set-api-key', apiKey, baseURL),
  checkEnvApiKey: () => ipcRenderer.invoke('check-env-api-key'),
  
  // File/Folder selection
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  
  // File reading
  readFolder: (folderPath) => ipcRenderer.invoke('read-folder', folderPath),
  readFiles: (filePaths) => ipcRenderer.invoke('read-files', filePaths),
  processPaths: (paths) => ipcRenderer.invoke('process-paths', paths),
  
  // Clustering
  clusterFiles: (files, numClusters) => ipcRenderer.invoke('cluster-files', files, numClusters),
  suggestClusters: (fileCount) => ipcRenderer.invoke('suggest-clusters', fileCount),
  onProgress: (callback) => ipcRenderer.on('clustering-progress', callback),
  removeProgressListener: () => ipcRenderer.removeAllListeners('clustering-progress'),
  
  // Organization
  organizeFiles: (outputFolder, clusters, files, options) => 
    ipcRenderer.invoke('organize-files', outputFolder, clusters, files, options),
  
  // Logging & Debugging
  getLogPath: () => ipcRenderer.invoke('get-log-path'),
  getLogs: (lines) => ipcRenderer.invoke('get-logs', lines),
  openLogFolder: () => ipcRenderer.invoke('open-log-folder')
});
