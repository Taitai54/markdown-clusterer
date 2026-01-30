const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');

let mainWindow;
let openaiClient = null;

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
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

// Set OpenAI API Key
ipcMain.handle('set-api-key', async (event, apiKey) => {
  try {
    openaiClient = new OpenAI({ apiKey });
    // Test the key with a simple request
    await openaiClient.models.list();
    return { success: true };
  } catch (error) {
    openaiClient = null;
    return { success: false, error: error.message };
  }
});

// Select folder dialog
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// Select files dialog
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
  });
  if (result.canceled) return [];
  return result.filePaths;
});

// Read markdown files from a folder
ipcMain.handle('read-folder', async (event, folderPath) => {
  try {
    const files = [];
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile() && /\.(md|markdown|txt)$/i.test(entry.name)) {
        const filePath = path.join(folderPath, entry.name);
        const content = fs.readFileSync(filePath, 'utf-8');
        const stats = fs.statSync(filePath);
        files.push({
          name: entry.name,
          path: filePath,
          content: content,
          size: stats.size,
          modified: stats.mtime
        });
      }
    }
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Read specific files
ipcMain.handle('read-files', async (event, filePaths) => {
  try {
    const files = [];
    for (const filePath of filePaths) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const stats = fs.statSync(filePath);
      files.push({
        name: path.basename(filePath),
        path: filePath,
        content: content,
        size: stats.size,
        modified: stats.mtime
      });
    }
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Cluster files using OpenAI
ipcMain.handle('cluster-files', async (event, files, numClusters) => {
  if (!openaiClient) {
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

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return { success: true, clusters: result.clusters };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Move files to cluster folders
ipcMain.handle('organize-files', async (event, outputFolder, clusters, files) => {
  try {
    const results = [];
    
    for (const cluster of clusters) {
      // Create cluster folder
      const clusterFolder = path.join(outputFolder, cluster.name.replace(/[<>:"/\\|?*]/g, '_'));
      if (!fs.existsSync(clusterFolder)) {
        fs.mkdirSync(clusterFolder, { recursive: true });
      }
      
      // Copy files to cluster folder
      for (const fileIndex of cluster.fileIndices) {
        const file = files[fileIndex];
        if (file) {
          const destPath = path.join(clusterFolder, file.name);
          fs.copyFileSync(file.path, destPath);
          results.push({
            source: file.path,
            destination: destPath,
            cluster: cluster.name
          });
        }
      }
    }
    
    return { success: true, results };
  } catch (error) {
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
