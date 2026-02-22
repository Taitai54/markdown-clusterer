const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const OpenAI = require('openai');
const YAML = require('yaml');

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

process.on('unhandledRejection', (reason) => {
  if (logger) {
    logger.error('Unhandled promise rejection', { reason: String(reason) });
  } else {
    console.error('Unhandled rejection:', reason);
  }
});

// IPC Handlers

// Check environment API Key
ipcMain.handle('check-env-api-key', async () => {
  logger.info('Checking environment for API key');
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) {
    try {
      openaiClient = new OpenAI({ apiKey: envKey });
      // Test the key
      await openaiClient.models.list();
      logger.info('Environment API key validated successfully');
      return { success: true };
    } catch (error) {
      logger.error('Failed to validate environment API key', error);
      openaiClient = null;
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'No OPENAI_API_KEY in environment' };
});

// Set OpenAI API Key
ipcMain.handle('set-api-key', async (event, apiKey, baseURL) => {
  logger.info('Setting OpenAI API key');
  try {
    const config = { apiKey };
    if (baseURL) {
      config.baseURL = baseURL;
    }
    openaiClient = new OpenAI(config);
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
    return { success: false, error: 'API configuration not set' };
  }

  const reportProgress = (msg) => {
    logger.info(`Clustering progress: ${msg}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('clustering-progress', msg);
    }
  };

  try {
    reportProgress(`Generating embeddings for ${files.length} files...`);
    
    // 1. Generate Embeddings for all files
    // Generate Embeddings
    const embeddings = [];
    const maxRetries = 3;

    for (let i = 0; i < files.length; i += 100) {
      const batch = files.slice(i, i + 100);
      const texts = batch.map(f => f.content.substring(0, 1500)); // Still use preview for embedding to save some tokens/time if files are huge
      
      let attempt = 0;
      let batchEmbeddings = null;

      while (attempt < maxRetries && !batchEmbeddings) {
        try {
          const response = await openaiClient.embeddings.create({
            model: "text-embedding-3-small",
            input: texts,
          });
          batchEmbeddings = response.data.map(d => d.embedding);
        } catch (error) {
          attempt++;
          if (attempt >= maxRetries) throw error;
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt))); // Exponential backoff
        }
      }
      embeddings.push(...batchEmbeddings);
      
      // Progress calculation
      Math.min(50, Math.round(((i + batch.length) / files.length) * 50));
      event.sender.send('clustering-progress', `Generated embeddings for ${i + batch.length}/${files.length} files...`);
    }

    event.sender.send('clustering-progress', `Running K-Means clustering...`);
    
    // Dynamically import ml-kmeans because it's an ES module
    const mlKmeans = await import('ml-kmeans');
    const { kmeans } = mlKmeans;
    
    // Perform K-Means clustering
    // The result object has a 'clusters' array where each element is the assigned cluster index (0 to numClusters - 1)
    const result = kmeans(embeddings, numClusters, { initialization: 'kmeans++' });
    const clusterLabels = result.clusters; // Array of cluster indices

    // 3. Group files by cluster
    const clusterGroups = Array.from({ length: numClusters }, () => []);
    for (let i = 0; i < files.length; i++) {
        clusterGroups[clusterLabels[i]].push(i);
    }

    // 4. Name the clusters using LLM
    const finalClusters = [];
    for (let i = 0; i < numClusters; i++) {
      const fileIndices = clusterGroups[i];
      if (fileIndices.length === 0) continue;

      reportProgress(`Generating name for Cluster ${i + 1} of ${numClusters}...`);
      
      // Sample up to 5 files
      const sampleIndices = fileIndices.slice(0, 5);
      const fileSummaries = sampleIndices.map(idx => {
        const preview = files[idx].content.substring(0, 1000);
        return `[File ${idx}] "${files[idx].name}"\nContent preview:\n${preview}\n---`;
      }).join('\n\n');

      const prompt = `You are categorizing documents. I have grouped several files into a cluster using an algorithm.
Based on the following file summaries, provide a short, descriptive name for this cluster and a brief description.

Files:
${fileSummaries}

Respond with a JSON object in this exact format:
{
  "name": "Cluster Name (short, descriptive)",
  "description": "Brief description of what this cluster contains"
}`;

      try {
        const response = await openaiClient.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        });
        
        const clusterInfo = JSON.parse(response.choices[0].message.content);
        
        finalClusters.push({
          name: clusterInfo.name,
          description: clusterInfo.description,
          fileIndices: fileIndices
        });
      } catch (err) {
        logger.error(`Failed to name cluster ${i}`, err);
        finalClusters.push({
          name: `Cluster ${i + 1}`,
          description: "Auto-generated cluster",
          fileIndices: fileIndices
        });
      }
    }
    
    logger.info('AI clustering complete', { 
      clustersCreated: finalClusters.length 
    });
    
    return { success: true, clusters: finalClusters };
  } catch (error) {
    logger.error('AI clustering failed', error);
    return { success: false, error: error.message };
  }
});

// Move files to cluster folders
ipcMain.handle('organize-files', async (event, outputFolder, clusters, files, options = {}) => {
  const { mode = 'copy', injectTags = false } = options;
  
  logger.info('Organizing files', { 
    outputFolder, 
    clusterCount: clusters.length,
    fileCount: files.length,
    mode,
    injectTags
  });
  
  try {
    const results = [];
    const errors = [];
    
    // Helper function for collision-free names
    const getCollisionFreePath = (filepath) => {
      if (!fs.existsSync(filepath)) return filepath;
      const parsed = path.parse(filepath);
      let counter = 1;
      let newPath = path.join(parsed.dir, `${parsed.name} (${counter})${parsed.ext}`);
      while (fs.existsSync(newPath)) {
        counter++;
        newPath = path.join(parsed.dir, `${parsed.name} (${counter})${parsed.ext}`);
      }
      return newPath;
    };

    // Helper function to inject metadata into Markdown frontmatter
    const injectFrontmatter = (content, tags) => {
      // Regex to match existing YAML frontmatter
      const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
      let newContent = content;
      let existingFm = {};

      const match = content.match(fmRegex);
      if (match) {
        try {
          existingFm = YAML.parse(match[1]) || {};
          newContent = content.substring(match[0].length).trim();
        } catch (e) {
          logger.warn('Failed to parse existing frontmatter', e);
        }
      }

      // Add tag to frontmatter
      existingFm.tags = Array.isArray(existingFm.tags) ? existingFm.tags : (existingFm.tags ? [existingFm.tags] : []);
      for (const tag of tags) {
        if (!existingFm.tags.includes(tag)) {
          existingFm.tags.push(tag);
        }
      }

      const newFmString = YAML.stringify(existingFm);
      return `---\n${newFmString}---\n${newContent}`;
    };
    
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
      
      // Copy or move files to cluster folder
      for (const fileIndex of cluster.fileIndices) {
        const file = files[fileIndex];
        if (file) {
          const destPath = getCollisionFreePath(path.join(clusterFolder, file.name));
          try {
            if (injectTags && /\.(md|markdown)$/i.test(file.name)) {
              const fileContent = fs.readFileSync(file.path, 'utf8');
              const newContent = injectFrontmatter(fileContent, [cluster.name]);
              fs.writeFileSync(destPath, newContent, 'utf8');
              if (mode === 'move') {
                fs.unlinkSync(file.path);
              }
            } else {
              if (mode === 'move') {
                fs.renameSync(file.path, destPath);
              } else {
                fs.copyFileSync(file.path, destPath);
              }
            }
            
            results.push({
              source: file.path,
              destination: destPath,
              cluster: cluster.name
            });
            logger.debug(`File ${mode === 'move' ? 'moved' : 'copied'}`, { source: file.path, destination: destPath });
          } catch (fileError) {
            logger.error(`Failed to ${mode} file`, { source: file.path, destination: destPath, error: fileError });
            errors.push({ type: mode, source: file.path, destination: destPath, error: fileError.message });
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
