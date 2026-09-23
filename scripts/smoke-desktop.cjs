// Electron smoke: isolated profile, built renderer, real IPC and local models.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const appRoot = process.argv.includes('--packaged')
  ? path.resolve(__dirname, '../release/mac-arm64/Markdown Clusterer.app/Contents/Resources/app.asar')
  : path.resolve(__dirname, '..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cluster-desktop-'));
app.setPath('userData', path.join(root, 'profile'));
process.env.OFFLINE_MODE = 'true';
process.env.OLLAMA_CHAT_MODEL = 'gpt-oss:20b';
process.env.OLLAMA_EMBEDDING_MODEL = 'bge-m3:latest';
process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434/v1';
const nativeFetch = global.fetch;
let embeddingRequests=0;
global.fetch = (url, options) => {
  if (!['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname)) throw new Error('Smoke blocked non-loopback request');
  if(new URL(url).pathname.endsWith('/embeddings')) {
    embeddingRequests++;
    if(String(options.body).includes('CANCEL-SMOKE')) return new Promise((resolve,reject)=>{
      const abort=()=>reject(new DOMException('Cancelled','AbortError'));
      if(options.signal.aborted)abort();else options.signal.addEventListener('abort',abort,{once:true});
    });
  }
  return nativeFetch(url, options);
};
// Exercise production assets without requiring Vite; production package does this itself.
BrowserWindow.prototype.loadURL = function () { return this.loadFile(path.join(appRoot, 'dist/index.html')); };
const fixtures = [
  ['apples.md', '# Apples\nOrchard fruit harvesting and apple growing.'],
  ['pears.md', '# Pears\nPear trees, orchard fruit and harvest.'],
  ['javascript.md', '# JavaScript\nSoftware programming with JavaScript functions.'],
  ['python.md', '# Python\nPython programming and software functions.']
];
const paths = fixtures.map(([name, body]) => { const p = path.join(root,name); fs.writeFileSync(p,body); return p; });
app.on('browser-window-created', (_, win) => {
  win.webContents.once('did-finish-load', async () => {
    try {
      const result = await win.webContents.executeJavaScript(`(async () => {
        const api = window.electronAPI;
        const ready = await api.configureLocal({baseURL:'http://127.0.0.1:11434/v1',chatModel:'gpt-oss:20b',embeddingModel:'bge-m3:latest'});
        if (!ready.success) throw new Error(ready.error);
        const imported = await api.processPaths(${JSON.stringify(paths)});
        if (!imported.success) throw new Error(imported.error);
        const grouped = await api.clusterFiles(imported.files,2,'');
        if (!grouped.success) throw new Error(grouped.error);
        const planned = await api.previewExport(${JSON.stringify(path.join(root,'output'))},grouped.clusters,imported.files,{mode:'copy',writeManifest:true});
        if(!planned.success)throw new Error(planned.error);
        const exported = await api.commitExport(planned.plan.id);
        if (!exported.success || exported.warnings?.length) throw new Error(JSON.stringify(exported));
        const saved = await api.saveProject('Smoke project',{files:imported.files,clusters:grouped.clusters});
        if(!saved.success)throw new Error(saved.error);
        const reopened = await api.openProject(saved.id);
        if(!reopened.success || reopened.project.data.files.length!==4)throw new Error('Project resume failed');
        const categories = await api.saveCategories('Smoke topics',{files:imported.files,clusters:grouped.clusters});
        if(!categories.success)throw new Error(categories.error);
        const assigned = await api.applyCategories(categories.id,imported.files,0.35);
        if(!assigned.success || assigned.clusters.flatMap(c=>c.fileIndices).length!==4)throw new Error('Category assignment failed');
        const outputRead = await api.readFiles(exported.results.map(r=>r.destination));
        if(!outputRead.success || outputRead.files.length!==4)throw new Error('Missing exported files');
        const undone = await api.undoExport(exported.id);
        if(!undone.success)throw new Error(undone.error);
        return {projectRestored:true,categoriesApplied:true,exportUndone:true,title:document.title, visibleText:document.body.innerText.slice(0,180), config:await api.getProviderConfig(), count:exported.results.length, destinations:exported.results.map(r=>r.destination)};
      })()`);
      for (const p of paths) if (!fs.existsSync(p)) throw new Error('Missing source');
      for (const p of result.destinations) if (fs.existsSync(p)) throw new Error('Undo left an exported file');
      const saved = JSON.parse(fs.readFileSync(path.join(root,'profile','config.json')));
      if (!saved.offlineMode || saved.localSettings.embeddingModel !== 'bge-m3:latest') throw new Error('Settings not persisted');
      const requestsBefore=embeddingRequests;
      const repeated=await win.webContents.executeJavaScript(`(async()=>{
        const imported=await window.electronAPI.readFiles(${JSON.stringify(paths)});
        return window.electronAPI.suggestK(imported.files);
      })()`);
      if(!repeated.success || embeddingRequests!==requestsBefore)throw new Error('Embedding reuse failed');
      const resilience=await win.webContents.executeJavaScript(`(async()=>{
        const api=window.electronAPI;
        const loaded=await api.readFiles(${JSON.stringify(paths)});
        const pending=api.suggestK(loaded.files.map(f=>({...f,content:f.content+' CANCEL-SMOKE'})));
        await new Promise(resolve=>setTimeout(resolve,100));
        await api.cancelJob();
        const cancelled=await pending;
        if(!cancelled.cancelled)throw new Error('Cancellation failed');
        const saved=await api.saveDraft({files:loaded.files,clusters:[]},{name:'Smoke recovery'});
        const restored=await api.loadDraft();
        if(!saved.success || restored.draft.data.files.length!==4)throw new Error('Draft recovery failed');
        await api.clearDraft();
        return {cacheReused:true,cancellationPassed:true,recoveryPassed:true};
      })()`);
      Object.assign(result,resilience);
      console.log('DESKTOP_SMOKE_PASS', JSON.stringify(result));
      app.exit(0);
    } catch (error) { console.error('DESKTOP_SMOKE_FAIL',error); app.exit(1); }
  });
});
setTimeout(() => { console.error('DESKTOP_SMOKE_TIMEOUT'); app.exit(1); }, 240000).unref();
require(path.join(appRoot, 'electron/main.js'));
