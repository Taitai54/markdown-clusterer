const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');

let mainWindow;
let openaiClient = null;
let logger;

// Initialize logger after app is ready
function initLogger() {
  logger = require('./logger');
  logger.info('Application starting', { 
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a2e'
  });

  // Load the app
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
    logger.info('Running in development mode');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    logger.info('Running in production mode');
  }

  // Log renderer errors
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logger.error('Renderer process crashed', details);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logger.error('Failed to load', { errorCode, errorDescription });
  });
}

app.whenReady().then(() => {
  initLogger();
  createWindow();
});

app.on('window-all-closed', () => {
  logger.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Global error handlers
process.on('uncaughtException', (error) => {
  if (logger) {
    logger.error('Uncaught exception', error);
  } else {
    console.error('Uncaught exception:', error);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  if (logger) {
    logger.error('Unhandled promise rejection', { reason: String(reason) });
  } else {
    console.error('Unhandled rejection:', reason);
  }
});

// IPC Handlers

// Set OpenAI API Key
ipcMain.handle('set-api-key', async (event, apiKey) => {
  logger.info('Setting OpenAI API key');
  try {
    openaiClient = new OpenAI({ apiKey });
    // Test the key with a simple request
    await openaiClient.models.list();
    logger.info('OpenAI API key validated successfully');
    return { success: true };
  } catch (error) {
    logger.error('Failed to validate OpenAI API key', error);
    openaiClient = null;
    return { success: false, error: error.message };
  }
});

// Select folder dialog
ipcMain.handle('select-folder', async () => {
  logger.debug('Opening folder selection dialog');
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (result.canceled) {
      logger.debug('Folder selection canceled');
      return null;
    }
    logger.info('Folder selected', { path: result.filePaths[0] });
    return result.filePaths[0];
  } catch (error) {
    logger.error('Error selecting folder', error);
    return null;
  }
});

// Select files dialog
ipcMain.handle('select-files', async () => {
  logger.debug('Opening file selection dialog');
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
    });
    if (result.canceled) {
      logger.debug('File selection canceled');
      return [];
    }
    logger.info('Files selected', { count: result.filePaths.length });
    return result.filePaths;
  } catch (error) {
    logger.error('Error selecting files', error);
    return [];
  }
});

// Read markdown files from a folder
ipcMain.handle('read-folder', async (event, folderPath) => {
  logger.info('Reading folder', { path: folderPath });
  try {
    const files = [];
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile() && /\.(md|markdown|txt)$/i.test(entry.name)) {
        const filePath = path.join(folderPath, entry.name);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const stats = fs.statSync(filePath);
          files.push({
            name: entry.name,
            path: filePath,
            content: content,
            size: stats.size,
            modified: stats.mtime
          });
        } catch (fileError) {
          logger.warn('Failed to read file', { file: filePath, error: fileError.message });
        }
      }
    }
    logger.info('Folder read complete', { filesFound: files.length });
    return { success: true, files };
  } catch (error) {
    logger.error('Error reading folder', error);
    return { success: false, error: error.message };
  }
});

// Read specific files
ipcMain.handle('read-files', async (event, filePaths) => {
  logger.info('Reading specific files', { count: filePaths.length });
  try {
    const files = [];
    for (const filePath of filePaths) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const stats = fs.statSync(filePath);
        files.push({
          name: path.basename(filePath),
          path: filePath,
          content: content,
          size: stats.size,
          modified: stats.mtime
        });
      } catch (fileError) {
        logger.warn('Failed to read file', { file: filePath, error: fileError.message });
      }
    }
    logger.info('Files read complete', { filesRead: files.length });
    return { success: true, files };
  } catch (error) {
    logger.error('Error reading files', error);
    return { success: false, error: error.message };
  }
});

// Cluster files using OpenAI
ipcMain.handle('cluster-files', async (event, files, numClusters) => {
  logger.info('Starting AI clustering', { fileCount: files.length, numClusters });
  
  if (!openaiClient) {
    logger.error('Clustering attempted without API key');
    return { success: false, error: 'OpenAI API key not set' };
  }

  try {
    // Prepare file summaries for clustering
    const fileSummaries = files.map((f, idx) => {
      // Take first 1500 chars of content for analysis
      const preview = f.content.substring(0, 1500);
      return `[File ${idx + 1}] "${f.name}"\nContent preview:\n${preview}\n---`;
    }).join('\n\n');

    const prompt = `You are an expert at organizing and categorizing documents. I have ${files.length} markdown files that are transcripts (mainly from YouTube videos). Please analyze them and group them into ${numClusters} logical clusters based on their topics and themes.

Here are the files:

${fileSummaries}

Please respond with a JSON object in this exact format:
{
  "clusters": [
    {
      "name": "Cluster Name (short, descriptive)",
      "description": "Brief description of what this cluster contains",
      "fileIndices": [0, 2, 5]
    }
  ]
}

The fileIndices should be 0-based indices referring to the files in the order provided (File 1 = index 0, File 2 = index 1, etc.).
Make sure every file is assigned to exactly one cluster.
Choose meaningful, descriptive cluster names that would work well as folder names.`;

    logger.debug('Sending request to OpenAI', { 
      model: 'gpt-4o-mini',
      promptLength: prompt.length 
    });

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    logger.info('AI clustering complete', { 
      clustersCreated: result.clusters.length,
      usage: response.usage
    });
    
    return { success: true, clusters: result.clusters };
  } catch (error) {
    logger.error('AI clustering failed', error);
    return { success: false, error: error.message };
  }
});

// Move files to cluster folders
ipcMain.handle('organize-files', async (event, outputFolder, clusters, files) => {
  logger.info('Organizing files', { 
    outputFolder, 
    clusterCount: clusters.length,
    fileCount: files.length 
  });
  
  try {
    const results = [];
    const errors = [];
    
    for (const cluster of clusters) {
      // Create cluster folder
      const clusterFolder = path.join(outputFolder, cluster.name.replace(/[<>:"/\\|?*]/g, '_'));
      
      try {
        if (!fs.existsSync(clusterFolder)) {
          fs.mkdirSync(clusterFolder, { recursive: true });
          logger.debug('Created cluster folder', { folder: clusterFolder });
        }
      } catch (mkdirError) {
        logger.error('Failed to create cluster folder', { folder: clusterFolder, error: mkdirError });
        errors.push({ type: 'mkdir', folder: clusterFolder, error: mkdirError.message });
        continue;
      }
      
      // Copy files to cluster folder
      for (const fileIndex of cluster.fileIndices) {
        const file = files[fileIndex];
        if (file) {
          const destPath = path.join(clusterFolder, file.name);
          try {
            fs.copyFileSync(file.path, destPath);
            results.push({
              source: file.path,
              destination: destPath,
              cluster: cluster.name
            });
            logger.debug('File copied', { source: file.path, destination: destPath });
          } catch (copyError) {
            logger.error('Failed to copy file', { source: file.path, destination: destPath, error: copyError });
            errors.push({ type: 'copy', source: file.path, destination: destPath, error: copyError.message });
          }
        }
      }
    }
    
    logger.info('File organization complete', { 
      filesCopied: results.length, 
      errors: errors.length 
    });
    
    if (errors.length > 0) {
      return { 
        success: true, 
        results, 
        warnings: errors,
        message: `Organized ${results.length} files with ${errors.length} errors`
      };
    }
    
    return { success: true, results };
  } catch (error) {
    logger.error('File organization failed', error);
    return { success: false, error: error.message };
  }
});

// Get suggested cluster count based on file count
ipcMain.handle('suggest-clusters', async (event, fileCount) => {
  if (fileCount <= 5) return 2;
  if (fileCount <= 15) return 3;
  if (fileCount <= 30) return 5;
  if (fileCount <= 50) return 7;
  return Math.min(10, Math.ceil(fileCount / 8));
});

// Get log file path
ipcMain.handle('get-log-path', async () => {
  return logger ? logger.getLogPath() : null;
});

// Get recent logs
ipcMain.handle('get-logs', async (event, lines = 100) => {
  return logger ? logger.getRecentLogs(lines) : 'Logger not initialized';
});

// Open log file in system file explorer
ipcMain.handle('open-log-folder', async () => {
  if (logger) {
    const logPath = logger.getLogPath();
    shell.showItemInFolder(logPath);
    return true;
  }
  return false;
});
