const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const OpenAI = require('openai');
const YAML = require('js-yaml');
const { buildMergedMarkdown } = require('./mergeMarkdown');
const { Jobs, check, delay, runClustering } = require('./jobs');
const { RecoveryStore } = require('./recovery-store');
let recoveryStore;
function recovery() {return recoveryStore ||= new RecoveryStore(path.join(app.getPath('userData'),'recovery'));}
const { EmbeddingCache } = require('./embedding-cache');
const jobs = new Jobs();
const embeddingCache = new EmbeddingCache();
const jobHandler = (name, handler) => ipcMain.handle(name, (event, ...args) => jobs.run(() => handler(event, ...args)));
ipcMain.handle('cancel-job', () => ({success:true,cancelled:jobs.cancel()}));
ipcMain.handle('cache-stats', () => ({success:true,...embeddingCache.stats()}));
ipcMain.handle('clear-embedding-cache', () => {
  if(jobs.active)return {success:false,error:'Wait for the model task to finish before clearing its cache.'};
  embeddingCache.clear();return {success:true};
});
const { ExportService } = require('./export-service');
const { LibraryService, assignCategories } = require('./library-service');
let exportService;
let libraryService;
function exportsService() { return exportService ||= new ExportService(path.join(app.getPath('userData'), 'exports')); }
function library() { return libraryService ||= new LibraryService(path.join(app.getPath('userData'), 'library')); }
const { validateLocalSettings, createLocalClient, validateEmbeddings } = require('./local-models');
let localSettings;
function getLocalSettings() {
  return localSettings || { baseURL: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1', chatModel: process.env.OLLAMA_CHAT_MODEL || 'llama3.2:latest', embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text' };
}
function offlineMode() { return store?.get('offlineMode', false) || process.env.OFFLINE_MODE === 'true'; }
function chatProviderName() { return offlineMode() ? 'local' : (activeChatProvider || process.env.CHAT_PROVIDER || 'openai').toLowerCase(); }
function embeddingProviderName() { return offlineMode() ? 'local' : (activeEmbeddingProvider || process.env.EMBEDDING_PROVIDER || 'openai').toLowerCase(); }

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

  async throttle(signal) {
    check(signal);
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.timeWindowMs);

    if (this.requests.length >= this.maxRequests) {
      const waitTime = this.timeWindowMs - (now - this.requests[0]);
      await delay(waitTime, signal);
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

// Naming and embeddings resolve independently; offline mode forces both local.
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
  const providerName = chatProviderName();
  if (providerName === 'local') return { client: createLocalClient(getLocalSettings()), model: getLocalSettings().chatModel, providerName };
  if (providerName === 'openai' && openaiClient) return { client: openaiClient, model: process.env.OPENAI_CHAT_MODEL || CONFIG.CLUSTERING_MODEL, providerName };
  const provider = CHAT_PROVIDERS[providerName] || CHAT_PROVIDERS.openai;
  const apiKey = provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : 'not-required';
  if (provider.apiKeyEnv && !apiKey) {
    throw new Error(`CHAT_PROVIDER=${providerName} requires ${provider.apiKeyEnv} to be set in .env`);
  }
  const model = (provider.modelEnv && process.env[provider.modelEnv]) || provider.defaultModel;
  const config = { apiKey: apiKey || 'not-required', timeout: 120000, maxRetries: 0 };
  if (provider.baseURL) config.baseURL = provider.baseURL;
  return { client: new OpenAI(config), model, providerName };
}

// OpenAI uses the saved client; other providers have their own credentials.
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
  const providerName = embeddingProviderName();
  if (providerName === 'local') return { client: createLocalClient(getLocalSettings()), model: getLocalSettings().embeddingModel, providerName };
  const provider = EMBEDDING_PROVIDERS[providerName];
  if (!provider) {
    if (providerName !== 'openai') throw new Error('Unknown embedding provider');
    if (!openaiClient) throw new Error('Configure an OpenAI key or choose local models in Model settings.');
    return { client: openaiClient, model: CONFIG.EMBEDDING_MODEL, providerName: 'openai' };
  }
  const apiKey = provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : 'not-required';
  if (provider.apiKeyEnv && !apiKey) {
    throw new Error(`EMBEDDING_PROVIDER=${providerName} requires ${provider.apiKeyEnv} to be set in .env`);
  }
  const model = (provider.modelEnv && process.env[provider.modelEnv]) || provider.defaultModel;
  const config = { apiKey: apiKey || 'not-required', timeout: 120000, maxRetries: 0 };
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

  mainWindow.webContents.on('will-prevent-unload', event => {
    const choice = dialog.showMessageBoxSync(mainWindow, {type:'question',buttons:['Keep editing','Discard changes'],defaultId:0,cancelId:0,message:'This project has unsaved changes.',detail:'Save your project before closing to keep your edits.'});
    if(choice === 1) event.preventDefault();
  });

  mainWindow.on('closed', () => jobs.cancel());
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    jobs.cancel();
    logger.error('Renderer process crashed', details);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logger.error('Failed to load', { errorCode, errorDescription });
  });
}

app.whenReady().then(async () => {
  const Store = (await import('electron-store')).default;
  store = new Store();
  localSettings = store.get('localSettings');
  activeChatProvider = store.get('chatProvider', null);
  activeEmbeddingProvider = store.get('embeddingProvider', null);
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

// Session cache contains normalized vectors only; identity prevents cross-provider/model reuse.
async function generateEmbeddingsForFiles(files, { onBatchDone } = {}) {
  const signal=jobs.signal();check(signal);
  const providerName=embeddingProviderName();
  const local=providerName==='local';
  const pinecone=providerName==='openai' && CONFIG.EMBEDDING_MODEL==='multilingual-e5-large';
  const emb=pinecone ? null : getEmbeddingClient();
  const identity={provider:pinecone?'pinecone':providerName,endpoint:pinecone?'https://api.pinecone.io/embed':emb.client.baseURL,
    model:pinecone?CONFIG.EMBEDDING_MODEL:emb.model,preprocessing:'frontmatter-title-prefix-v1',length:CONFIG.EMBEDDING_PREVIEW_LENGTH,normalization:'l2-v1'};
  const texts=files.map(f=>getContentForEmbedding(f.content,CONFIG.EMBEDDING_PREVIEW_LENGTH));
  return embeddingCache.generate(texts,identity,async inputs=>{
    for(let attempt=0;attempt<CONFIG.MAX_RETRIES;attempt++) {
      try {
        check(signal);if(!local)await apiRateLimiter.throttle(signal);
        if(pinecone) {
          const pk=sessionPineconeKey || process.env.PINECONE_API_KEY;
          if(!pk)throw new Error('Pinecone API Key required for multilingual-e5-large');
          const response=await fetch('https://api.pinecone.io/embed',{
            method:'POST',signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000),
            headers:{'Api-Key':pk,'Content-Type':'application/json','X-Pinecone-API-Version':'2024-10'},
            body:JSON.stringify({model:'multilingual-e5-large',inputs:inputs.map(text=>({text})),parameters:{input_type:'passage',truncate:'END'}})
          });
          if(!response.ok)throw new Error(`Pinecone Embedding Error: ${response.status}`);
          return (await response.json()).data.map(d=>d.values);
        }
        const response=await emb.client.embeddings.create({model:emb.model,input:inputs,encoding_format:'float'},{signal});
        return [...response.data].sort((a,b)=>a.index-b.index).map(d=>d.embedding);
      } catch(error) {
        check(signal);if(local || attempt===CONFIG.MAX_RETRIES-1)throw error;
        await delay(1000*Math.pow(2,attempt+1),signal);
      }
    }
  },{signal,batchSize:local?8:CONFIG.EMBEDDING_BATCH_SIZE,onProgress:(done,remaining)=>{
    onBatchDone?.(done);
    if(mainWindow && !mainWindow.isDestroyed())mainWindow.webContents.send('clustering-progress',`${done}/${files.length} embeddings ready; ${remaining} remaining (cached results reused).`);
  }});
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
      return { success: false, error: 'Secure credential storage is unavailable. Key is usable for this session only.' };
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
  if (offlineMode() || embeddingProviderName() !== 'openai') return { success: true };
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
    if (offlineMode()) throw new Error('Disable offline mode before configuring cloud access.');
    const config = { apiKey, timeout: 120000, maxRetries: 0 };
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
  if(jobs.active)return {success:false,error:'Wait for the current model task or cancel it before changing settings.'};
  embeddingCache.clear();
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
  if (offlineMode() || embeddingProviderName() !== 'openai') return { success: true };
  logger.info('Checking environment for API key');
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) {
    try {
      openaiClient = new OpenAI({ apiKey: envKey, timeout: 120000, maxRetries: 0 });
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
  if(jobs.active)return {success:false,error:'Wait for the current model task or cancel it before changing settings.'};
  embeddingCache.clear();
  logger.info('Setting API keys');
  try {
    if (offlineMode()) throw new Error('Disable offline mode before configuring cloud access.');
    const config = { apiKey, timeout: 120000, maxRetries: 0 };
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
  if(jobs.active)return {success:false,error:'Wait for the current model task or cancel it before changing settings.'};
  embeddingCache.clear();
  if (embeddingProviderName() !== 'openai') return { success: false, error: 'This model selector applies to OpenAI/Pinecone only. Change local models in Model settings.' };
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
    chatProvider: chatProviderName(),
    offlineMode: offlineMode(),
    localSettings: getLocalSettings(),
    embeddingProvider: embeddingProviderName(),
    chatOptions: Object.keys(CHAT_PROVIDERS),
    embeddingOptions: ['openai', ...Object.keys(EMBEDDING_PROVIDERS)]
  };
});

ipcMain.handle('set-chat-provider', async (event, providerName) => {
  if(jobs.active)return {success:false,error:'Wait for the current model task or cancel it before changing settings.'};
  embeddingCache.clear();
  if (!CHAT_PROVIDERS[providerName]) {
    return { success: false, error: `Unknown chat provider: ${providerName}` };
  }
  if (offlineMode() && providerName !== 'local') return { success: false, error: 'Disable offline mode in Model settings first.' };
  activeChatProvider = providerName;
  store.set('chatProvider', providerName);
  logger.info('Chat provider switched at runtime', { providerName });
  return { success: true };
});

ipcMain.handle('set-embedding-provider', async (event, providerName) => {
  if(jobs.active)return {success:false,error:'Wait for the current model task or cancel it before changing settings.'};
  embeddingCache.clear();
  if (providerName !== 'openai' && !EMBEDDING_PROVIDERS[providerName]) {
    return { success: false, error: `Unknown embedding provider: ${providerName}` };
  }
  if (offlineMode() && providerName !== 'local') return { success: false, error: 'Disable offline mode in Model settings first.' };
  activeEmbeddingProvider = providerName;
  store.set('embeddingProvider', providerName);
  logger.info('Embedding provider switched at runtime', { providerName });
  return { success: true };
});

// Local settings contain no secrets. Test actual capabilities before saving.
ipcMain.handle('configure-local', async (event, settings) => {
  if(jobs.active)return {success:false,error:'Wait for the current model task or cancel it before changing settings.'};
  embeddingCache.clear();
  try {
    const validated = validateLocalSettings(settings);
    const client = createLocalClient(validated);
    const response = await client.embeddings.create({ model: validated.embeddingModel, input: ['Local model connection test'], encoding_format: 'float' });
    validateEmbeddings(response.data.map(d => d.embedding), 1);
    const chat = await client.chat.completions.create({ model: validated.chatModel, messages: [{ role: 'user', content: 'Reply with {"name":"Ready","description":"Local test"} as JSON.' }], response_format: { type: 'json_object' }, max_tokens: 256 });
    if (!chat.choices?.[0]?.message?.content) throw new Error('Naming model returned no text.');
    localSettings = validated;
    store.set('localSettings', validated);
    store.set('offlineMode', true);
    activeChatProvider = activeEmbeddingProvider = 'local';
    store.set('chatProvider', 'local');
    store.set('embeddingProvider', 'local');
    return { success: true };
  } catch (error) { return { success: false, error: `Local model test failed: ${error.message}` }; }
});
ipcMain.handle('disable-offline', async () => {
  if(jobs.active)return {success:false,error:'Wait for the current model task or cancel it before changing settings.'};
  embeddingCache.clear();
  if (process.env.OFFLINE_MODE === 'true') return { success: false, error: 'OFFLINE_MODE is enforced by the environment.' };
  store.set('offlineMode', false);
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

ipcMain.handle('save-markdown-dialog', async (event, defaultName) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save merged markdown',
      defaultPath: defaultName || 'merged.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    if (result.canceled || !result.filePath) return null;
    return /\.md$/i.test(result.filePath) ? result.filePath : `${result.filePath}.md`;
  } catch (error) {
    logger.error('Save dialog failed', error);
    return null;
  }
});

// Write selected markdown files into one new document. Sources are not moved or deleted.
ipcMain.handle('merge-markdown', async (event, files, outputPath, title) => {
  logger.info('Merging markdown files', { count: Array.isArray(files) ? files.length : 0, outputPath });
  try {
    if (!outputPath || typeof outputPath !== 'string') {
      return { success: false, error: 'Choose a file to save the merged document' };
    }
    const dest = sanitizePath(outputPath);
    if (fs.existsSync(dest) && fs.statSync(dest).isDirectory()) {
      return { success: false, error: 'Choose a markdown file, not a folder' };
    }
    const docTitle = title || path.basename(dest, path.extname(dest));
    const content = buildMergedMarkdown(files, docTitle);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, 'utf8');
    logger.info('Merged markdown written', { path: dest, fileCount: files.length });
    return { success: true, path: dest };
  } catch (error) {
    logger.error('Markdown merge failed', error);
    return { success: false, error: error.message };
  }
});

// Cluster files using OpenAI
jobHandler('cluster-files', async (event, files, numClusters, aiHint) => {
  logger.info('Starting AI clustering', { fileCount: files?.length, numClusters, hasAiHint: !!aiHint });
  


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
    
    const result = await runClustering({operation:'cluster',embeddings,k:numClusters},jobs.signal());
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
      check(jobs.signal());
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
        if (chat.providerName !== 'local') await apiRateLimiter.throttle(jobs.signal());
        const response = await chat.client.chat.completions.create({
          model: chat.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: CONFIG.CLUSTERING_TEMPERATURE,
          response_format: { type: 'json_object' }
        }, {signal:jobs.signal()});
        check(jobs.signal());
        
        const clusterInfo = JSON.parse(response.choices[0].message.content);
        if (typeof clusterInfo.name !== 'string' || !clusterInfo.name.trim() || typeof clusterInfo.description !== 'string') throw new Error('Invalid cluster naming response');
        
        finalClusters.push({
          name: clusterInfo.name,
          description: clusterInfo.description,
          fileIndices: fileIndices
        });
      } catch (err) {
        check(jobs.signal());
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

// All desktop exports are previewed and committed by a main-process-owned plan.
const productHandler = (name, handler) => ipcMain.handle(name, async (event, ...args) => {
  try { return { success: true, ...await handler(...args) }; }
  catch (error) { return { success: false, error: error.message }; }
});
productHandler('save-draft', (session,project) => recovery().save(session,project));
productHandler('load-draft', () => ({draft:recovery().load()}));
productHandler('clear-draft', () => {recovery().clear();return {};});
productHandler('preview-export', (output, clusters, files, options) => ({plan: exportsService().preview(output, clusters, files, options)}));
productHandler('commit-export', id => exportsService().commit(id));
productHandler('export-history', () => ({items:exportsService().history()}));
productHandler('undo-export', id => exportsService().undo(id));
// Kept as a compatibility alias for scripts; UI uses explicit preview/commit.
productHandler('organize-files', (output, clusters, files, options) => {
  const plan=exportsService().preview(output,clusters,files,options);
  return exportsService().commit(plan.id);
});
productHandler('list-library', () => ({projects:library().list('projects'),categories:library().list('categories')}));
productHandler('save-project', (name,session,id) => library().saveProject(name,session,id));
productHandler('open-project', id => ({project:library().openProject(id)}));
productHandler('save-categories', (name,session) => library().saveCategories(name,session));
jobHandler('apply-categories', async (event, id, files, threshold) => {
  if (!Array.isArray(files) || !files.length) throw new Error('Import files first');
  const categories=library().read('categories',id).data;
  const examples=categories.flatMap(c=>(c.examples.length ? c.examples : ['']).map(text=>({name:c.name,content:[c.name,c.description,text].join('\n\n')})));
  // Re-embed every example with the active model, then form normalized centroids.
  const vectors=await generateEmbeddingsForFiles([...files,...examples]);
  const embeddings=vectors.slice(0,files.length);let offset=files.length;
  const centroids=categories.map(c=>{
    const count=Math.max(1,c.examples.length);const rows=vectors.slice(offset,offset+count);offset+=count;
    return rows[0].map((_,d)=>rows.reduce((sum,row)=>sum+row[d],0)/count);
  });
  check(jobs.signal());
  return {success:true,clusters:assignCategories(embeddings,validateEmbeddings(centroids,categories.length),categories,threshold),embeddings};
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
jobHandler('suggest-k', async (event, files) => {

  if (!Array.isArray(files) || files.length < 2) return { success: false, error: 'At least two files are required', suggestedK: null };
  if (files.length < 4) {
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

    const {suggestedK}=await runClustering({operation:'suggest',embeddings},jobs.signal());

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
