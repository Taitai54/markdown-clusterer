const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // API Key management
  setApiKey: (apiKey) => ipcRenderer.invoke('set-api-key', apiKey),
  
  // File/Folder selection
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  
  // File reading
  readFolder: (folderPath) => ipcRenderer.invoke('read-folder', folderPath),
  readFiles: (filePaths) => ipcRenderer.invoke('read-files', filePaths),
  
  // Clustering
  clusterFiles: (files, numClusters) => ipcRenderer.invoke('cluster-files', files, numClusters),
  suggestClusters: (fileCount) => ipcRenderer.invoke('suggest-clusters', fileCount),
  
  // Organization
  organizeFiles: (outputFolder, clusters, files) => 
    ipcRenderer.invoke('organize-files', outputFolder, clusters, files)
});
