const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { validateLocalSettings, validateEmbeddings } = require('../electron/local-models');
const settings = { baseURL: 'http://localhost:11434/v1', chatModel: 'gpt-oss:20b', embeddingModel: 'bge-m3:latest' };

test('local URLs reject remote destinations and credentials', () => {
  assert.equal(validateLocalSettings(settings).baseURL, 'http://127.0.0.1:11434/v1');
  for (const baseURL of ['https://ollama.com/v1', 'http://localhost.evil.test/v1', 'http://key@localhost/v1', 'file:///tmp/model']) {
    assert.throws(() => validateLocalSettings({ ...settings, baseURL }));
  }
  assert.throws(() => validateLocalSettings({ ...settings, chatModel: 'model:cloud' }));
});
test('embedding validation detects corrupt batches and normalizes vectors', () => {
  assert.deepEqual(validateEmbeddings([[3,4]], 1), [[0.6,0.8]]);
  for (const vectors of [[], [[0,0]], [[NaN,1]], [[1,2],[1]], [[1,2]]]) {
    assert.throws(() => validateEmbeddings(vectors, 2));
  }
});

const handlers = {};
const modelCalls = [];
let namingStarted;
let blockNaming = false;
const state = new Map([['offlineMode', true]]);
const filename = path.resolve(__dirname, '../electron/main.js');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
const nativeRequire = loaded.require.bind(loaded);
loaded.require = id => {
  if (id === 'dotenv') return { config() {} };
  if (id === 'electron') return {
    app: { getPath: () => fs.realpathSync(os.tmpdir()) + '/cluster-offline-test-profile', whenReady: () => ({ then() {} }), on() {} },
    ipcMain: { handle: (name, handler) => { handlers[name] = handler; } },
    safeStorage: {}, BrowserWindow: {}, dialog: {}, shell: {}
  };
  if (id === './local-models') return {
    ...nativeRequire(id),
    createLocalClient: () => ({
      embeddings: { create: async request => {
        modelCalls.push(request.model);
        return { data: request.input.map((_, index) => ({ index, embedding: index % 2 ? [0,1] : [1,0] })) };
      } },
      chat: { completions: { create: async (request, {signal}={}) => {
        if(blockNaming) {namingStarted();await require('../electron/jobs').delay(30000,signal);}
        return {choices:[{message:{content:'{"name":"Local","description":"Local documents"}'}}]};
      } } }
    })
  };
  return nativeRequire(id);
};
loaded._compile(fs.readFileSync(filename, 'utf8') + `\nmodule.exports.initialize = (testStore) => { store = testStore; logger = { info(){}, error(){}, warn(){}, debug(){} }; localSettings = ${JSON.stringify(settings)}; CONFIG.EMBEDDING_MODEL = 'multilingual-e5-large'; };`, filename);
loaded.exports.initialize({get: (key, fallback) => state.has(key) ? state.get(key) : fallback, set: (key,value) => state.set(key,value)});
const event = { sender: { send() {} } };

test('offline startup bypasses cloud credentials and refuses cloud switching', async () => {
  assert.equal((await handlers['load-api-key']()).success, true);
  assert.equal((await handlers['check-env-api-key']()).success, true);
  assert.equal((await handlers['set-embedding-provider'](event, 'openai')).success, false);
  assert.equal((await handlers['set-chat-provider'](event, 'gemini')).success, false);
});
test('local clustering and suggest-k work without OpenAI, even with stale E5 selection', async () => {
  const files = Array.from({length: 6}, (_, i) => ({ name: `${i}.md`, content: `Document ${i}` }));
  const result = await handlers['cluster-files'](event, files, 2);
  assert.equal(result.success, true, result.error);
  assert.equal(result.clusters.flatMap(c => c.fileIndices).length, files.length);
  const suggestion = await handlers['suggest-k'](event, files);
  assert.equal(suggestion.success, true, suggestion.error);
  assert.equal(modelCalls.length, 1, 'Suggest k reuses the clustering embeddings');
  assert.ok(modelCalls.every(model => model === settings.embeddingModel));
});
test('copy export preserves originals, relative paths, namespaces and actual collision names', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cluster-test-'));
  try {
    const source = path.join(root, 'source'); const output = path.join(root, 'output');
    fs.mkdirSync(path.join(source, 'nested'), {recursive:true});
    const first = path.join(source, 'first.md'); const second = path.join(source, 'nested', 'second.md');
    fs.writeFileSync(first, '# First'); fs.writeFileSync(second, '# Second');
    const files = [first, second].map(p => ({path:p, name:path.basename(p)}));
    const clusters = [{name:'Topic', namespace:'space', description:'Test', fileIndices:[0,1]}];
    const options = {preserveRelativePaths:true, injectClusterDescription:true, writeManifest:true};
    const firstRun = await handlers['organize-files'](event, output, clusters, files, options);
    assert.equal(firstRun.warnings, undefined);
    const result = await handlers['organize-files'](event, output, clusters, files, options);
    assert.equal(result.warnings, undefined);
    assert.equal(fs.readFileSync(first,'utf8'), '# First');
    assert.match(fs.readFileSync(result.results[0].destination,'utf8'), /namespace: space/);
    const manifest = JSON.parse(fs.readFileSync(path.join(output,'index.json')));
    for (const file of manifest.clusters[0].filePaths) assert.ok(fs.existsSync(path.join(output,file)));
    assert.ok(manifest.clusters[0].filePaths.some(p => p.includes('(1)')));
    assert.ok(manifest.clusters[0].filePaths.some(p => p.includes('nested/second')));
  } finally { fs.rmSync(root, {recursive:true,force:true}); }
});

test('cancelling during naming returns cancellation, prevents provider changes and publishes no partial groups',async()=>{
  const started=new Promise(resolve=>{namingStarted=resolve;});blockNaming=true;
  const files=Array.from({length:6},(_,i)=>({name:`${i}.md`,content:`Document ${i}`}));
  const pending=handlers['cluster-files'](event,files,2);
  await started;
  assert.equal((await handlers['set-chat-provider'](event,'local')).success,false);
  await handlers['cancel-job']();
  const result=await pending;blockNaming=false;
  assert.equal(result.cancelled,true);assert.equal(result.clusters,undefined);
  assert.equal((await handlers['clear-embedding-cache']()).success,true);
  assert.equal((await handlers['cache-stats']()).entries,0);
});
