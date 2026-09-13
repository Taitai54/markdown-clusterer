const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const OpenAI = require('openai');
const YAML = require('js-yaml');

let store;
let mainWindow;
let openaiClient = null;
let logger;
// Pinecone key for the current session only — never persisted in plaintext.
// Populated from the modal (set-api-key) or decrypted from electron-store on load-api-key.
let sessionPineconeKey = null;
// Runtime provider overrides — set via the in-app provider switch (Header),
// take precedence over CHAT_PROVIDER/EMBEDDING_PROVIDER in .env. Null means
// "use .env / default". Session-only, not persisted.
let activeChatProvider = null;
let activeEmbeddingProvider = null;

// Path validation helper
const sanitizePath = (filePath) => {
  const normalized = path.resolve(filePath);
  // Block paths containing null bytes (common injection vector)
  if (filePath.includes('\0')) {
    throw new Error('Invalid path: contains null bytes');
  }
  return normalized;
};

// Join path segments under `root`, throwing if the resolved result escapes it.
// Cluster names/namespaces are user-editable text, so `..`/absolute-path segments
// must not be allowed to write outside the chosen output folder.
const safeJoin = (root, ...segments) => {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...segments);
  if (target !== resolvedRoot && !target.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Path escapes output folder: "${segments.join('/')}"`);
  }
  return target;
};

// Strip YAML frontmatter and optionally extract title for embedding/naming
const FM_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;

// Extract dates from frontmatter
function extractFrontmatterDates(content) {
  const match = content.match(FM_REGEX);
  if (!match) return { createdAt: null, updatedAt: null };
  
  try {
    const fm = YAML.load(match[1]) || {};
    return {
      createdAt: fm.createdAt ? new Date(fm.createdAt) : null,
      updatedAt: fm.updatedAt ? new Date(fm.updatedAt) : null
    };
  } catch (e) {
    return { createdAt: null, updatedAt: null };
  }
}

function getContentForEmbedding(content, maxLength, options = {}) {
  const { includeTitle = true } = options;
  let body = content;
  let title = '';

  const match = content.match(FM_REGEX);
  if (match) {
    try {
      const fm = YAML.load(match[1]) || {};
      if (includeTitle && fm.title && typeof fm.title === 'string') {
        title = fm.title.trim();
      }
      body = content.substring(match[0].length).trim();
    } catch (e) {
      body = content;
    }
  }

  if (includeTitle && !title && body) {
    const firstLine = body.split(/\r?\n/)[0] || '';
    const headingMatch = firstLine.match(/^#+\s*(.+)$/);
    if (headingMatch) title = headingMatch[1].trim();
  }

  const bodyTrimmed = body.substring(0, maxLength);
  if (title) {
    const prefix = `Title: ${title}\n\n`;
    const rest = maxLength > prefix.length ? body.substring(0, maxLength - prefix.length) : '';
    return (prefix + rest).trim();
  }
  return bodyTrimmed;
}

class RateLimiter {
  constructor(maxRequests, timeWindowMs) {
    this.maxRequests = maxRequests;
    this.timeWindowMs = timeWindowMs;
    this.requests = [];
  }

  async throttle() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.timeWindowMs);

    if (this.requests.length >= this.maxRequests) {
      const waitTime = this.timeWindowMs - (now - this.requests[0]);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.requests.push(Date.now());
  }
}

// Configuration constants
const CONFIG = {
  EMBEDDING_PREVIEW_LENGTH: 1500,
  CLUSTER_PREVIEW_LENGTH: 1000,
  EMBEDDING_BATCH_SIZE: 100,
  MAX_RETRIES: 3,
  MAX_SAMPLE_FILES: 5,
  MAX_FILE_SIZE_MB: 50,
  EMBEDDING_MODEL: 'text-embedding-3-small',
  CLUSTERING_MODEL: 'gpt-4o-mini',
  CLUSTERING_TEMPERATURE: 0.3
};

const apiRateLimiter = new RateLimiter(50, 60000); // 50 requests per minute

// Chat-provider config for the cluster-naming call only. Embeddings stay on the
// existing OpenAI/Pinecone path above (OpenRouter/Gemini/Ollama embedding support
// is a documented future option, not wired up here — see README "Choosing a provider").
// All providers are OpenAI-compatible, so the same `openai` SDK is reused for each
// by swapping apiKey/baseURL — no extra provider SDKs needed.
const CHAT_PROVIDERS = {
  openai: {
    apiKeyEnv: 'OPENAI_API_KEY',
    baseURL: undefined,
    modelEnv: 'OPENAI_CHAT_MODEL',
    defaultModel: CONFIG.CLUSTERING_MODEL
  },
  openrouter: {
    apiKeyEnv: 'OPENROUTER_API_KEY',
    baseURL: 'https://openrouter.ai/api/v1',
    modelEnv: 'OPENROUTER_CHAT_MODEL',
    defaultModel: 'openai/gpt-4o-mini'
  },
  gemini: {
    apiKeyEnv: 'GEMINI_API_KEY',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    modelEnv: 'GEMINI_CHAT_MODEL',
    defaultModel: 'gemini-2.5-flash'
  },
  local: {
    apiKeyEnv: null, // Ollama's OpenAI-compat server ignores the key
    baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    modelEnv: 'OLLAMA_CHAT_MODEL',
    // No tag works for everyone — this must match an installed model exactly
    // (`ollama list`), so always set OLLAMA_CHAT_MODEL rather than relying on this.
    defaultModel: 'llama3.2:latest'
  }
};

// Build an OpenAI-SDK client pointed at whichever provider CHAT_PROVIDER selects.
function getChatClient() {
  const providerName = (activeChatProvider || process.env.CHAT_PROVIDER || 'openai').toLowerCase();
  const provider = CHAT_PROVIDERS[providerName] || CHAT_PROVIDERS.openai;
  const apiKey = provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : 'not-required';
  if (provider.apiKeyEnv && !apiKey) {
    throw new Error(`CHAT_PROVIDER=${providerName} requires ${provider.apiKeyEnv} to be set in .env`);
  }
  const model = (provider.modelEnv && process.env[provider.modelEnv]) || provider.defaultModel;
  const config = { apiKey: apiKey || 'not-required' };
  if (provider.baseURL) config.baseURL = provider.baseURL;
  return { client: new OpenAI(config), model, providerName };
}

// Embedding-provider config. `openai` reuses the already-validated `openaiClient` +
// the in-app embedding-model dropdown (CONFIG.EMBEDDING_MODEL) exactly as before —
// this is the default and preserves prior behavior unchanged. gemini/openrouter are
// alternates so clustering doesn't die if the OpenAI key runs out of credits.
// (Local/Ollama isn't listed: it has no embedding-capable model pulled by default,
// and even when one is pulled it's a separate, deliberate opt-in — see README.)
const EMBEDDING_PROVIDERS = {
  gemini: {
    apiKeyEnv: 'GEMINI_API_KEY',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    modelEnv: 'GEMINI_EMBEDDING_MODEL',
    defaultModel: 'gemini-embedding-001'
  },
  openrouter: {
    apiKeyEnv: 'OPENROUTER_API_KEY',
    baseURL: 'https://openrouter.ai/api/v1',
    modelEnv: 'OPENROUTER_EMBEDDING_MODEL',
    defaultModel: 'openai/text-embedding-3-small'
  },
  local: {
    apiKeyEnv: null, // Ollama's OpenAI-compat server ignores the key
    baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    modelEnv: 'OLLAMA_EMBEDDING_MODEL',
    // Requires a dedicated embedding model pulled — chat models (llama3.2 etc.)
    // don't do embeddings. `ollama pull nomic-embed-text` first.
    defaultModel: 'nomic-embed-text'
  }
};

// Returns the client+model to embed with, honoring EMBEDDING_PROVIDER when it's
// set to a non-OpenAI provider; otherwise falls back to the existing openaiClient
// + CONFIG.EMBEDDING_MODEL path (default, unchanged behavior).
function getEmbeddingClient() {
  const providerName = (activeEmbeddingProvider || process.env.EMBEDDING_PROVIDER || 'openai').toLowerCase();
  const provider = EMBEDDING_PROVIDERS[providerName];
  if (!provider) {
    return { client: openaiClient, model: CONFIG.EMBEDDING_MODEL, providerName: 'openai' };
  }
  const apiKey = provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : 'not-required';
  if (provider.apiKeyEnv && !apiKey) {
    throw new Error(`EMBEDDING_PROVIDER=${providerName} requires ${provider.apiKeyEnv} to be set in .env`);
  }
  const model = (provider.modelEnv && process.env[provider.modelEnv]) || provider.defaultModel;
  const config = { apiKey: apiKey || 'not-required' };
  if (provider.baseURL) config.baseURL = provider.baseURL;
  return { client: new OpenAI(config), model, providerName };
}

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

  // app.isPackaged is Electron's authoritative signal — don't gate this on
  // NODE_ENV too. .env sets NODE_ENV=development for logging purposes, and
  // dotenv loads it even inside a packaged build (it reads .env from the
  // working directory), which made the built .exe try to load the Vite dev
  // server (localhost:5173) instead of dist/index.html — blank window with
  // nothing to connect to.
  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    logger.info('Running in development mode');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    logger.info('Running in production mode');
  }

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logger.error('Renderer process crashed', details);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logger.error('Failed to load', { errorCode, errorDescription });
  });
}

app.whenReady().then(async () => {
  const Store = (await import('electron-store')).default;
  store = new Store();
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

// Shared embedding generation, used by both cluster-files and suggest-k so they
// stay in sync on the OpenAI/Pinecone branch (previously suggest-k always used
// OpenAI and errored when multilingual-e5-large was selected).
async function generateEmbeddingsForFiles(files, { onBatchDone } = {}) {
  const embeddings = [];

  for (let i = 0; i < files.length; i += CONFIG.EMBEDDING_BATCH_SIZE) {
    const batch = files.slice(i, i + CONFIG.EMBEDDING_BATCH_SIZE);
    const texts = batch.map(f => getContentForEmbedding(f.content, CONFIG.EMBEDDING_PREVIEW_LENGTH));

    let attempt = 0;
    let batchEmbeddings = null;

    while (attempt < CONFIG.MAX_RETRIES && !batchEmbeddings) {
      try {
        await apiRateLimiter.throttle();

        if (CONFIG.EMBEDDING_MODEL === 'multilingual-e5-large') {
          const pk = sessionPineconeKey || process.env.PINECONE_API_KEY;
          if (!pk) throw new Error('Pinecone API Key required for multilingual-e5-large');

          const response = await fetch('https://api.pinecone.io/embed', {
            method: 'POST',
            headers: {
              'Api-Key': pk,
              'Content-Type': 'application/json',
              'X-Pinecone-API-Version': '2024-10'
            },
            body: JSON.stringify({
              model: 'multilingual-e5-large',
              inputs: texts.map(t => ({ text: t })),
              parameters: { input_type: 'passage', truncate: 'END' }
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Pinecone Embedding Error: ${response.status} ${errText}`);
          }

          const resData = await response.json();
          batchEmbeddings = resData.data.map(d => d.values);
        } else {
          const emb = getEmbeddingClient();
          const response = await emb.client.embeddings.create({
            model: emb.model,
            input: texts,
          });
          batchEmbeddings = response.data.map(d => d.embedding);
        }
      } catch (error) {
        attempt++;
        if (attempt >= CONFIG.MAX_RETRIES) throw error;
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt))); // Exponential backoff
      }
    }
    embeddings.push(...batchEmbeddings);
    if (onBatchDone) onBatchDone(i + batch.length);
  }

  return embeddings;
}

// IPC Handlers

// Save API key securely
ipcMain.handle('save-api-key', async (event, apiKey, baseURL, pineconeKey) => {
  logger.info('Saving API keys securely');
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(apiKey);
      store.set('apiKey', encrypted.toString('base64'));
      if (pineconeKey) {
        const encryptedPinecone = safeStorage.encryptString(pineconeKey);
        store.set('pineconeApiKey', encryptedPinecone.toString('base64'));
      }
      logger.info('API keys encrypted and saved');
    } else {
      logger.warn('Encryption not available, storing in plain text');
      store.set('apiKey', apiKey);
      if (pineconeKey) store.set('pineconeApiKey', pineconeKey);
    }
    
    if (baseURL) {
      store.set('baseURL', baseURL);
    } else {
      store.delete('baseURL');
    }
    
    return { success: true };
  } catch (error) {
    logger.error('Failed to save API keys', error);
    return { success: false, error: error.message };
  }
});

// Load API key securely
ipcMain.handle('load-api-key', async () => {
  logger.info('Loading stored API key');
  try {
    const stored = store.get('apiKey');
    if (!stored) {
      logger.info('No stored API key found');
      return { success: false, error: 'No stored API key' };
    }

    let apiKey;
    if (safeStorage.isEncryptionAvailable()) {
      try {
        const buffer = Buffer.from(stored, 'base64');
        apiKey = safeStorage.decryptString(buffer);
      } catch (decryptError) {
        logger.error('Failed to decrypt API key', decryptError);
        // Clear corrupted key
        store.delete('apiKey');
        return { success: false, error: 'Failed to decrypt stored key' };
      }
    } else {
      apiKey = stored;
    }

    const baseURL = store.get('baseURL');

    // Restore the Pinecone key (if saved) into memory for this session so
    // multilingual-e5-large embeddings keep working after an app restart.
    const storedPineconeKey = store.get('pineconeApiKey');
    if (storedPineconeKey) {
      try {
        sessionPineconeKey = safeStorage.isEncryptionAvailable()
          ? safeStorage.decryptString(Buffer.from(storedPineconeKey, 'base64'))
          : storedPineconeKey;
      } catch (decryptError) {
        logger.warn('Failed to decrypt stored Pinecone key', decryptError);
        sessionPineconeKey = null;
      }
    }

    // Test the key
    const config = { apiKey };
    if (baseURL) config.baseURL = baseURL;
    openaiClient = new OpenAI(config);

    try {
      await openaiClient.models.list();
      logger.info('Stored API key validated successfully');
      return { success: true, baseURL };
    } catch (testError) {
      logger.error('Stored API key validation failed', testError);
      openaiClient = null;
      return { success: false, error: 'Stored API key is invalid' };
    }
  } catch (error) {
    logger.error('Failed to load API key', error);
    return { success: false, error: error.message };
  }
});

// Delete stored API keys
ipcMain.handle('delete-api-key', async () => {
  logger.info('Deleting stored API keys');
  try {
    store.delete('apiKey');
    store.delete('pineconeApiKey');
    store.delete('baseURL');
    openaiClient = null;
    sessionPineconeKey = null;
    return { success: true };
  } catch (error) {
    logger.error('Failed to delete API keys', error);
    return { success: false, error: error.message };
  }
});

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
ipcMain.handle('set-api-key', async (event, apiKey, baseURL, pineconeKey) => {
  logger.info('Setting API keys');
  try {
    const config = { apiKey };
    if (baseURL) {
      config.baseURL = baseURL;
    }
    openaiClient = new OpenAI(config);
    // Session-only, in-memory — never written to disk in plaintext.
    // (save-api-key persists an encrypted copy if the user opts to save.)
    if (pineconeKey) {
      sessionPineconeKey = pineconeKey;
    }
    // Test the key with a simple request
    await openaiClient.models.list();
    logger.info('API keys validated successfully');
    return { success: true };
  } catch (error) {
    logger.error('Failed to validate API keys', error);
    openaiClient = null;
    return { success: false, error: error.message };
  }
});

// New: Set Embedding Model
ipcMain.handle('set-embedding-model', async (event, modelName) => {
  if (modelName === 'text-embedding-3-small' || modelName === 'multilingual-e5-large' || modelName === 'text-embedding-3-large') {
    CONFIG.EMBEDDING_MODEL = modelName;
    logger.info('Embedding model updated', { model: modelName });
    return { success: true };
  }
  return { success: false, error: 'Invalid model name' };
});

// Runtime provider switch — lets the UI pick CHAT_PROVIDER/EMBEDDING_PROVIDER
// without editing .env or restarting. Session-only (see activeChatProvider/
// activeEmbeddingProvider above).
ipcMain.handle('get-provider-config', async () => {
  return {
    chatProvider: (activeChatProvider || process.env.CHAT_PROVIDER || 'openai').toLowerCase(),
    embeddingProvider: (activeEmbeddingProvider || process.env.EMBEDDING_PROVIDER || 'openai').toLowerCase(),
    chatOptions: Object.keys(CHAT_PROVIDERS),
    embeddingOptions: ['openai', ...Object.keys(EMBEDDING_PROVIDERS)]
  };
});

ipcMain.handle('set-chat-provider', async (event, providerName) => {
  if (!CHAT_PROVIDERS[providerName]) {
    return { success: false, error: `Unknown chat provider: ${providerName}` };
  }
  activeChatProvider = providerName;
  logger.info('Chat provider switched at runtime', { providerName });
  return { success: true };
});

ipcMain.handle('set-embedding-provider', async (event, providerName) => {
  if (providerName !== 'openai' && !EMBEDDING_PROVIDERS[providerName]) {
    return { success: false, error: `Unknown embedding provider: ${providerName}` };
  }
  activeEmbeddingProvider = providerName;
  logger.info('Embedding provider switched at runtime', { providerName });
  return { success: true };
});

// Select folder dialog
ipcMain.handle('select-folder', async (event, options = {}) => {
  logger.debug('Opening folder selection dialog');
  try {
    const properties = ['openDirectory'];
    if (options.multiSelections) {
      properties.push('multiSelections');
    }
    const result = await dialog.showOpenDialog(mainWindow, { properties });
    if (result.canceled) {
      logger.debug('Folder selection canceled');
      return options.multiSelections ? [] : null;
    }
    logger.info('Folder(s) selected', { count: result.filePaths.length });
    return options.multiSelections ? result.filePaths : result.filePaths[0];
  } catch (error) {
    logger.error('Error selecting folder', error);
    return options.multiSelections ? [] : null;
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

// Helper for recursive markdown reading
function readMarkdownFilesRecursive(folderPath, fileArray = []) {
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);
      if (entry.isDirectory()) {
        readMarkdownFilesRecursive(fullPath, fileArray);
      } else if (entry.isFile() && /\.(md|markdown|txt)$/i.test(entry.name)) {
        try {
          const stats = fs.statSync(fullPath);
          
          // Skip files larger than max size
          if (stats.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
            logger.warn('File too large, skipping', { 
              file: fullPath, 
              size: stats.size,
              maxSize: CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024
            });
            continue;
          }
          
          const content = fs.readFileSync(fullPath, 'utf-8');
          const dates = extractFrontmatterDates(content);
          fileArray.push({
            name: entry.name,
            path: fullPath,
            content: content,
            size: stats.size,
            modified: stats.mtime,
            createdAt: dates.createdAt,
            updatedAt: dates.updatedAt
          });
        } catch (fileError) {
          logger.warn('Failed to read file', { file: fullPath, error: fileError.message });
        }
      }
    }
  } catch (err) {
    logger.warn('Failed to read directory', { path: folderPath, error: err.message });
  }
  return fileArray;
}

// Process mixed files and folders from drag and drop
ipcMain.handle('process-paths', async (event, paths) => {
  logger.info('Processing mixed paths', { count: paths.length });
  try {
    const files = [];
    for (const p of paths) {
      try {
        const sanitized = sanitizePath(p);
        const stats = fs.statSync(sanitized);
        if (stats.isDirectory()) {
          readMarkdownFilesRecursive(sanitized, files);
        } else if (stats.isFile() && /\.(md|markdown|txt)$/i.test(path.basename(sanitized))) {
          const content = fs.readFileSync(sanitized, 'utf-8');
          const dates = extractFrontmatterDates(content);
          files.push({
            name: path.basename(sanitized),
            path: sanitized,
            content: content,
            size: stats.size,
            modified: stats.mtime,
            createdAt: dates.createdAt,
            updatedAt: dates.updatedAt
          });
        }
      } catch (err) {
        logger.warn('Failed to process path', { path: p, error: err.message });
      }
    }
    logger.info('Paths processed', { filesFound: files.length });
    return { success: true, files };
  } catch (error) {
    logger.error('Error processing paths', error);
    return { success: false, error: error.message };
  }
});

// Read markdown files from a folder
ipcMain.handle('read-folder', async (event, folderPath) => {
  logger.info('Reading folder', { path: folderPath });
  try {
    const sanitizedFolder = sanitizePath(folderPath);
    const files = readMarkdownFilesRecursive(sanitizedFolder);
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
        const sanitizedFile = sanitizePath(filePath);
        const content = fs.readFileSync(sanitizedFile, 'utf-8');
        const stats = fs.statSync(sanitizedFile);
        const dates = extractFrontmatterDates(content);
        files.push({
          name: path.basename(sanitizedFile),
          path: sanitizedFile,
          content: content,
          size: stats.size,
          modified: stats.mtime,
          createdAt: dates.createdAt,
          updatedAt: dates.updatedAt
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
ipcMain.handle('cluster-files', async (event, files, numClusters, aiHint) => {
  logger.info('Starting AI clustering', { fileCount: files.length, numClusters, hasAiHint: !!aiHint });
  
  if (!openaiClient) {
    logger.error('Clustering attempted without API key');
    return { success: false, error: 'API configuration not set' };
  }

  // Validate inputs
  if (!Array.isArray(files) || files.length === 0) {
    return { success: false, error: 'No files provided' };
  }

  if (!Number.isInteger(numClusters) || numClusters < 2 || numClusters > 15) {
    return { success: false, error: 'Number of clusters must be between 2 and 15' };
  }

  if (numClusters > files.length) {
    return { success: false, error: `Cannot create ${numClusters} clusters from ${files.length} files` };
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
    const embeddings = await generateEmbeddingsForFiles(files, {
      onBatchDone: (done) => {
        const progress = Math.min(50, Math.round((done / files.length) * 50));
        event.sender.send('clustering-progress', `Generated embeddings for ${done}/${files.length} files... (${progress}%)`);
      }
    });

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
    let chat;
    try {
      chat = getChatClient();
    } catch (chatConfigError) {
      logger.error('Chat provider misconfigured, cluster names will fall back to generic labels', chatConfigError);
    }

    const finalClusters = [];
    for (let i = 0; i < numClusters; i++) {
      const fileIndices = clusterGroups[i];
      if (fileIndices.length === 0) continue;

      reportProgress(`Generating name for Cluster ${i + 1} of ${numClusters}...`);
      
      // Sample up to configured max files (use body for naming too)
      const sampleIndices = fileIndices.slice(0, CONFIG.MAX_SAMPLE_FILES);
      const fileSummaries = sampleIndices.map(idx => {
        const preview = getContentForEmbedding(files[idx].content, CONFIG.CLUSTER_PREVIEW_LENGTH, { includeTitle: true });
        return `[File ${idx}] "${files[idx].name}"\nContent preview:\n${preview}\n---`;
      }).join('\n\n');

      const prompt = `You are categorizing documents. I have grouped several files into a cluster using an algorithm.
Based on the following file summaries, provide a short, descriptive name for this cluster and a brief description.

Files:
${fileSummaries}
${aiHint ? `\nUser Instructions/Hint for Naming: ${aiHint}\n` : ''}
Respond with a JSON object in this exact format:
{
  "name": "Cluster Name (short, descriptive)",
  "description": "Brief description of what this cluster contains"
}`;

      try {
        if (!chat) throw new Error('Chat provider not configured');
        await apiRateLimiter.throttle();
        const response = await chat.client.chat.completions.create({
          model: chat.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: CONFIG.CLUSTERING_TEMPERATURE,
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
    
    return { success: true, clusters: finalClusters, embeddings: embeddings };
  } catch (error) {
    logger.error('AI clustering failed', error);
    return { success: false, error: error.message };
  }
});

// Move files to cluster folders
ipcMain.handle('organize-files', async (event, outputFolder, clusters, files, options = {}) => {
  const { 
    mode = 'copy', 
    injectTags = false, 
    injectClusterDescription = false, 
    writeManifest = false, 
    writeClusterIndex = false, 
    preserveRelativePaths = false,
    namespace = '' // New: Namespace support
  } = options;
  
  const baseOutputFolder = sanitizePath(outputFolder);
  let sanitizedOutputFolder;
  try {
    sanitizedOutputFolder = namespace
      ? safeJoin(baseOutputFolder, namespace.replace(/[<>:"/\\|?*]/g, '_'))
      : baseOutputFolder;
  } catch (pathError) {
    logger.error('Blocked unsafe namespace path', { namespace, error: pathError.message });
    return { success: false, error: pathError.message };
  }

  logger.info('Organizing files', {
    outputFolder: sanitizedOutputFolder,
    clusterCount: clusters.length,
    fileCount: files.length,
    mode,
    injectTags,
    injectClusterDescription,
    writeManifest,
    writeClusterIndex,
    preserveRelativePaths
  });

  try {
    const results = [];
    const errors = [];
    const manifestClusters = [];

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

    const getCommonRoot = (paths) => {
      if (paths.length === 0) return '';
      const normalized = paths.map(p => path.normalize(p));
      const segments = normalized.map(p => p.split(path.sep).filter(Boolean));
      let common = segments[0];
      for (let i = 1; i < segments.length; i++) {
        let j = 0;
        while (j < common.length && j < segments[i].length && common[j] === segments[i][j]) j++;
        common = common.slice(0, j);
      }
      return common.length ? common.join(path.sep) + path.sep : '';
    };

    const commonRoot = preserveRelativePaths && files.length > 0 ? getCommonRoot(files.map(f => f.path)) : '';

    // Helper function to inject metadata into Markdown frontmatter
    const injectFrontmatter = (content, opts) => {
      const { tags = [], cluster, clusterDescription } = opts;
      const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
      let newContent = content;
      let existingFm = {};

      const match = content.match(fmRegex);
      if (match) {
        try {
          existingFm = YAML.load(match[1]) || {};
          newContent = content.substring(match[0].length).trim();
        } catch (e) {
          logger.warn('Failed to parse existing frontmatter', e);
        }
      }

      if (tags.length > 0) {
        existingFm.tags = Array.isArray(existingFm.tags) ? existingFm.tags : (existingFm.tags ? [existingFm.tags] : []);
        for (const tag of tags) {
          if (!existingFm.tags.includes(tag)) {
            existingFm.tags.push(tag);
          }
        }
      }
      
      if (cluster != null) existingFm.cluster = cluster;
      if (clusterDescription != null) {
        existingFm.clusterDescription = clusterDescription;
        // Search enrichment: Every chunk in Pinecone will now have this context
        existingFm.topic_context = clusterDescription; 
      }
      
      if (namespace) existingFm.namespace = namespace;

      const newFmString = YAML.dump(existingFm);
      return `---\n${newFmString}---\n${newContent}`;
    };
    
    for (const cluster of clusters) {
      // Per-cluster namespace support
      const currentNamespace = cluster.namespace || namespace;
      const relativeFilePaths = [];
      let clusterFolder;
      let clusterFolderName;

      try {
        const clusterBaseFolder = currentNamespace
          ? safeJoin(baseOutputFolder, currentNamespace.replace(/[<>:"/\\|?*]/g, '_'))
          : baseOutputFolder;

        // Create cluster folder
        clusterFolderName = cluster.name.replace(/[<>:"/\\|?*]/g, '_');
        clusterFolder = safeJoin(clusterBaseFolder, clusterFolderName);

        if (!fs.existsSync(clusterFolder)) {
          fs.mkdirSync(clusterFolder, { recursive: true });
          logger.debug('Created cluster folder', { folder: clusterFolder });
        }
      } catch (mkdirError) {
        logger.error('Failed to create cluster folder', { cluster: cluster.name, error: mkdirError.message });
        errors.push({ type: 'mkdir', cluster: cluster.name, error: mkdirError.message });
        continue;
      }

      for (const fileIndex of cluster.fileIndices) {
        const file = files[fileIndex];
        if (file) {
          const relPath = preserveRelativePaths && commonRoot ? path.relative(commonRoot, file.path) : file.name;
          let destDir, destFileName, destPath;
          try {
            destDir = safeJoin(clusterFolder, path.dirname(relPath));
            destFileName = path.basename(relPath);
            destPath = getCollisionFreePath(safeJoin(preserveRelativePaths && commonRoot ? destDir : clusterFolder, destFileName));
          } catch (pathError) {
            logger.error('Blocked unsafe destination path', { source: file.path, error: pathError.message });
            errors.push({ type: mode, source: file.path, error: pathError.message });
            continue;
          }
          if (preserveRelativePaths && commonRoot && path.dirname(relPath) !== '.') {
            try {
              fs.mkdirSync(destDir, { recursive: true });
            } catch (mkdirErr) {
              logger.warn('Failed to create subdir', { destDir, error: mkdirErr.message });
            }
          }
          const relativeForManifest = path.join(clusterFolderName, preserveRelativePaths && commonRoot ? relPath : destFileName).replace(/\\/g, '/');
          relativeFilePaths.push(relativeForManifest);
          try {
            if ((injectTags || injectClusterDescription) && /\.(md|markdown)$/i.test(file.name)) {
              const fileContent = fs.readFileSync(file.path, 'utf8');
              const newContent = injectFrontmatter(fileContent, {
                tags: injectTags ? [cluster.name] : [],
                cluster: injectClusterDescription ? cluster.name : undefined,
                clusterDescription: injectClusterDescription ? (cluster.description || '') : undefined,
                namespace: currentNamespace || undefined
              });
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

      if (writeManifest) {
        manifestClusters.push({
          name: cluster.name,
          description: cluster.description || '',
          folder: clusterFolderName,
          filePaths: relativeFilePaths.map(p => p.replace(/\\/g, '/'))
        });
      }

      if (writeClusterIndex) {
        const indexPath = path.join(clusterFolder, '_index.md');
        const indexContent = `# ${cluster.name}\n\n${cluster.description || 'No description.'}\n`;
        try {
          fs.writeFileSync(indexPath, indexContent, 'utf8');
          logger.debug('Wrote cluster index', { path: indexPath });
        } catch (indexErr) {
          logger.warn('Failed to write cluster index', { path: indexPath, error: indexErr.message });
        }
      }
    }
    
    if (writeManifest && manifestClusters.length > 0) {
      const manifestPath = path.join(sanitizedOutputFolder, 'index.json');
      try {
        fs.writeFileSync(manifestPath, JSON.stringify({ clusters: manifestClusters }, null, 2), 'utf8');
        logger.info('Wrote manifest', { path: manifestPath });
      } catch (writeErr) {
        logger.error('Failed to write manifest', { path: manifestPath, error: writeErr });
        errors.push({ type: 'manifest', path: manifestPath, error: writeErr.message });
      }
    }

    // Always write/update the dedup manifest so future runs can skip already-organised files
    try {
      const dedupPath = path.join(sanitizedOutputFolder, '_dedup_manifest.json');
      let existingEntries = {};
      if (fs.existsSync(dedupPath)) {
        try {
          existingEntries = JSON.parse(fs.readFileSync(dedupPath, 'utf8')).entries || {};
        } catch (_) { /* ignore corrupt manifest */ }
      }
      // Record each successfully organised file: sourcePath -> mtime ISO string
      for (const r of results) {
        const sourcePath = r.source;
        try {
          const mtime = fs.existsSync(sourcePath)
            ? fs.statSync(sourcePath).mtime.toISOString()
            : new Date().toISOString();
          existingEntries[sourcePath] = mtime;
        } catch (_) {
          existingEntries[sourcePath] = new Date().toISOString();
        }
      }
      fs.writeFileSync(dedupPath, JSON.stringify({ entries: existingEntries }, null, 2), 'utf8');
      logger.info('Wrote dedup manifest', { path: dedupPath, entryCount: Object.keys(existingEntries).length });
    } catch (dedupErr) {
      logger.warn('Failed to write dedup manifest', { error: dedupErr.message });
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

// Read dedup manifest from an output folder (returns map of sourcePath -> mtime)
ipcMain.handle('read-dedup-manifest', async (event, folderPath) => {
  logger.info('Reading dedup manifest', { folderPath });
  try {
    const sanitized = sanitizePath(folderPath);
    const manifestPath = path.join(sanitized, '_dedup_manifest.json');
    if (!fs.existsSync(manifestPath)) {
      logger.info('No dedup manifest found', { manifestPath });
      return { success: true, entries: {} };
    }
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const data = JSON.parse(raw);
    return { success: true, entries: data.entries || {} };
  } catch (error) {
    logger.error('Failed to read dedup manifest', error);
    return { success: false, error: error.message, entries: {} };
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

// Suggest k using elbow method (requires embeddings)
ipcMain.handle('suggest-k', async (event, files) => {
  if (!openaiClient) {
    return { success: false, error: 'API configuration not set', suggestedK: null };
  }
  if (!Array.isArray(files) || files.length < 4) {
    const fallback = files.length <= 5 ? 2 : files.length <= 15 ? 3 : Math.min(10, Math.ceil((files.length || 1) / 8));
    return { success: true, suggestedK: fallback };
  }

  const reportProgress = (msg) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('clustering-progress', msg);
    }
  };

  try {
    reportProgress('Generating embeddings for k suggestion...');
    // Shared with cluster-files so this respects CONFIG.EMBEDDING_MODEL
    // (previously always used OpenAI and errored on multilingual-e5-large).
    const embeddings = await generateEmbeddingsForFiles(files);

    const mlKmeans = await import('ml-kmeans');
    const { kmeans } = mlKmeans;

    const K_MAX = Math.min(10, Math.max(2, Math.floor(files.length / 2)));
    const wss = [];
    for (let k = 2; k <= K_MAX; k++) {
      const result = kmeans(embeddings, k, { initialization: 'kmeans++' });
      const centroids = result.centroids;
      const labels = result.clusters;
      let sumSq = 0;
      for (let i = 0; i < embeddings.length; i++) {
        const c = centroids[labels[i]];
        for (let d = 0; d < embeddings[i].length; d++) {
          const diff = embeddings[i][d] - c[d];
          sumSq += diff * diff;
        }
      }
      wss.push(sumSq);
    }

    let suggestedK = 2;
    if (wss.length >= 3) {
      let maxCurv = -Infinity;
      for (let i = 1; i < wss.length - 1; i++) {
        const curv = (wss[i - 1] - wss[i]) - (wss[i] - wss[i + 1]);
        if (curv > maxCurv) {
          maxCurv = curv;
          suggestedK = i + 2;
        }
      }
    } else {
      suggestedK = wss.length === 2 ? 2 : K_MAX;
    }

    reportProgress('');
    return { success: true, suggestedK: Math.min(15, Math.max(2, suggestedK)) };
  } catch (error) {
    logger.error('Suggest k failed', error);
    const fallback = files.length <= 5 ? 2 : files.length <= 15 ? 3 : Math.min(10, Math.ceil(files.length / 8));
    return { success: false, error: error.message, suggestedK: fallback };
  }
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
