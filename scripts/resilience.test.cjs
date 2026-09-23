const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('fs');const os=require('os');const path=require('path');
const {EmbeddingCache}=require('../electron/embedding-cache');
const {Jobs,delay,runClustering}=require('../electron/jobs');
const {RecoveryStore}=require('../electron/recovery-store');
const identity={provider:'local',endpoint:'http://127.0.0.1:11434/v1',model:'bge-m3',preprocessing:'v1'};
test('cache reuses unchanged inputs, deduplicates a batch and invalidates identity changes',async()=>{
  const cache=new EmbeddingCache();let calls=[];
  const fetch=async texts=>{calls.push(texts);return texts.map(()=>[3,4]);};
  await cache.generate(['a','a','b'],identity,fetch);
  const vectors=await cache.generate(['b','a'],identity,fetch);
  assert.deepEqual(calls,[['a','b']]);assert.equal(vectors.length,2);
  await cache.generate(['a','changed'],identity,fetch);assert.deepEqual(calls.at(-1),['changed']);
  for(const field of ['provider','endpoint','model','preprocessing'])await cache.generate(['a'],{...identity,[field]:'different'},fetch);
  assert.equal(calls.length,6);
  vectors[0][0]=999;assert.ok(cache.get(cache.key(identity,'b'))[0]<1);
});
test('cache obeys LRU vector byte and entry bounds, and clear removes everything',()=>{
  const cache=new EmbeddingCache({maxBytes:32,maxEntries:2});
  cache.set('a',[1,0]);cache.set('b',[0,1]);cache.get('a');cache.set('c',[0.5,0.5]);
  assert.equal(cache.get('b'),null);assert.equal(cache.stats().vectorBytes,32);
  cache.set('huge',[1,2,3,4,5]);assert.equal(cache.get('huge'),null);
  cache.clear();assert.equal(cache.stats().entries,0);
});
test('cancellation stops further batches and does not cache an aborted batch',async()=>{
  const cache=new EmbeddingCache();const controller=new AbortController();let calls=0;
  await assert.rejects(cache.generate(['a','b'],identity,async()=>{
    calls++;controller.abort();return [[1,0]];
  },{batchSize:1,signal:controller.signal}),{name:'AbortError'});
  assert.equal(calls,1);assert.equal(cache.stats().entries,0);
});
test('invalid vectors never enter the cache',async()=>{
  const cache=new EmbeddingCache();
  await assert.rejects(cache.generate(['a'],identity,async()=>[[0,0]]),/invalid/);
  assert.equal(cache.stats().entries,0);
});
test('jobs reject overlapping tasks, abort waits promptly, then allow a fresh job',async()=>{
  const jobs=new Jobs();let started;
  const running=jobs.run(async()=>{started=true;await delay(30000,jobs.signal());return {success:true};});
  assert.equal(started,true);assert.equal((await jobs.run(async()=>({success:true}))).success,false);
  jobs.cancel();const result=await running;assert.equal(result.cancelled,true);
  assert.equal((await jobs.run(async()=>({success:true}))).success,true);
});
test('worker clustering is repeatable and an active worker can be cancelled',async()=>{
  const data={operation:'cluster',embeddings:[[1,0],[0.99,0.01],[0,1],[0.01,0.99]],k:2};
  const first=await runClustering(data);const second=await runClustering(data);
  assert.deepEqual(first.clusters,second.clusters);assert.equal(first.clusters[0],first.clusters[1]);
  assert.notEqual(first.clusters[0],first.clusters[2]);
  const controller=new AbortController();const pending=runClustering(data,controller.signal);controller.abort();
  await assert.rejects(pending,{name:'AbortError'});
});
test('draft survives restart, excludes credentials, detects changed sources and clears explicitly',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cluster-draft-'));
  try {
    const file=path.join(root,'note.md');fs.writeFileSync(file,'# Original');
    const session={files:[{name:'note.md',path:file,content:'# Original'}],clusters:[{name:'Topic',fileIndices:[0]}],apiKey:'secret',embeddings:[[1,0]]};
    const store=new RecoveryStore(root);store.save(session,{id:null,name:'Unsaved'});
    const restarted=new RecoveryStore(root);let draft=restarted.load();
    assert.equal(draft.data.clusters[0].name,'Topic');assert.equal(draft.data.apiKey,undefined);assert.equal(draft.data.embeddings,undefined);
    fs.writeFileSync(file,'# Changed');draft=restarted.load();assert.equal(draft.warnings.length,1);
    assert.throws(()=>store.save({files:'bad',clusters:[]}),/Invalid/);assert.equal(restarted.load().project.name,'Unsaved');
    restarted.clear();assert.equal(restarted.load(),null);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
