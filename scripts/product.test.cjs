const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');const os=require('os');const path=require('path');
const {ExportService}=require('../electron/export-service');
const {LibraryService,assignCategories}=require('../electron/library-service');
function fixture(run) {
  const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'cluster-product-'));
  const source=path.join(root,'notes');fs.mkdirSync(source);
  const files=['one.md','two.md'].map((name,i)=>{
    const content=`---\ntitle: Note ${i}\n---\n# Body ${i}\n`;const p=path.join(source,name);fs.writeFileSync(p,content);return {name,path:p,content};
  });
  const clusters=[{name:'Reviewed',description:'Example category',namespace:'Library',fileIndices:[0,1]}];
  const output=path.join(root,'output');const history=path.join(root,'recovery');const service=new ExportService(history);
  try{return run({root,source,files,clusters,output,history,service});}finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('preview makes no writes and commit uses exact reserved paths; restart undo removes copies',()=>fixture(({files,clusters,output,history,service})=>{
  const plan=service.preview(output,clusters,files,{writeManifest:true,writeClusterIndex:true,injectTags:true});
  assert.equal(fs.existsSync(output),false);assert.equal(plan.operations[0].metadata.after.includes('Reviewed'),true);
  const result=service.commit(plan.id);assert.equal(result.success,true);
  for(const op of plan.operations)assert.equal(fs.existsSync(op.destination),true);
  new ExportService(history).undo(plan.id);
  for(const op of plan.operations)assert.equal(fs.existsSync(op.destination),false);
  for(const f of files)assert.equal(fs.readFileSync(f.path,'utf8'),f.content);
  assert.equal(service.history()[0].status,'undone');
}));
test('preview becomes invalid when a source or destination changes',()=>fixture(({files,clusters,output,service})=>{
  let plan=service.preview(output,clusters,files);
  fs.appendFileSync(files[0].path,'edited');assert.throws(()=>service.commit(plan.id),/changed/);
  assert.equal(fs.existsSync(output),false);fs.writeFileSync(files[0].path,files[0].content);
  plan=service.preview(output,clusters,files);fs.mkdirSync(path.dirname(plan.operations[0].destination),{recursive:true});
  fs.writeFileSync(plan.operations[0].destination,'someone else');assert.throws(()=>service.commit(plan.id),/changed/);
  assert.equal(fs.readFileSync(plan.operations[0].destination,'utf8'),'someone else');
}));
test('move with metadata rewrites restores byte-exact sources after restart',()=>fixture(({files,clusters,output,history,service})=>{
  const plan=service.preview(output,clusters,files,{mode:'move',injectClusterDescription:true});service.commit(plan.id);
  assert.ok(files.every(f=>!fs.existsSync(f.path)));
  assert.match(fs.readFileSync(plan.operations[0].destination,'utf8'),/topic_context/);
  new ExportService(history).undo(plan.id);
  for(const f of files)assert.equal(fs.readFileSync(f.path,'utf8'),f.content);
}));
test('undo never removes modified output or overwrites newly created source',()=>fixture(({files,clusters,output,service})=>{
  const plan=service.preview(output,clusters,files,{mode:'move'});service.commit(plan.id);
  const dest=plan.operations[0].destination;fs.appendFileSync(dest,'edited');
  assert.throws(()=>service.undo(plan.id),/Cannot undo/);assert.equal(fs.existsSync(files[0].path),false);
  fs.writeFileSync(dest,files[0].content);fs.writeFileSync(files[0].path,'new source');
  assert.throws(()=>service.undo(plan.id),/source path/);assert.equal(fs.readFileSync(files[0].path,'utf8'),'new source');
}));
test('undo restores existing sidecar manifests instead of deleting them',()=>fixture(({files,clusters,output,service})=>{
  fs.mkdirSync(output);const manifest=path.join(output,'index.json');const dedup=path.join(output,'_dedup_manifest.json');
  fs.writeFileSync(manifest,'old index');fs.writeFileSync(dedup,'{"entries":{"old":"date"}}');
  const plan=service.preview(output,clusters,files,{writeManifest:true});service.commit(plan.id);service.undo(plan.id);
  assert.equal(fs.readFileSync(manifest,'utf8'),'old index');assert.equal(fs.readFileSync(dedup,'utf8'),'{"entries":{"old":"date"}}');
}));
test('interrupted move journal recovers the file written before source deletion failed',()=>fixture(({files,clusters,output,history,service})=>{
  const plan=service.preview(output,clusters,files,{mode:'move'});const unlink=fs.unlinkSync;
  let result;
  try {fs.unlinkSync=p=>{if(p===files[1].path)throw new Error('simulated removal failure');return unlink(p);};result=service.commit(plan.id);}finally{fs.unlinkSync=unlink;}
  assert.equal(result.success,false);assert.equal(service.history()[0].status,'incomplete');
  new ExportService(history).undo(plan.id);
  for(const f of files)assert.equal(fs.readFileSync(f.path,'utf8'),f.content);
}));
test('reject duplicate assignments, stale imports and symlink output directories',()=>fixture(({files,clusters,output,root,service})=>{
  assert.throws(()=>service.preview(output,[{...clusters[0],fileIndices:[0,0]}],files),/exactly one/);
  assert.throws(()=>service.preview(output,[{...clusters[0],fileIndices:[0]}],files),/not assigned/);
  assert.throws(()=>service.preview(output,clusters,[{...files[0],content:'stale'},files[1]]),/changed since import/);
  fs.symlinkSync(path.join(root,'notes'),output);assert.throws(()=>service.preview(output,clusters,files),/Symbolic/);
}));
test('projects persist review state without credentials and flag missing/changed sources',()=>fixture(({root,files,clusters})=>{
  const service=new LibraryService(path.join(root,'library'));
  const saved=service.saveProject('First review',{files,clusters,numClusters:2,apiKey:'never save me',embeddings:[[1,0]]});
  const loaded=new LibraryService(path.join(root,'library')).openProject(saved.id);
  assert.deepEqual(loaded.data.clusters,clusters);assert.equal(loaded.data.apiKey,undefined);assert.equal(loaded.data.embeddings,undefined);assert.equal(loaded.warnings.length,0);
  fs.appendFileSync(files[0].path,'changed');fs.unlinkSync(files[1].path);
  assert.equal(service.openProject(saved.id).warnings.length,2);
  assert.throws(()=>service.openProject('../../bad'),/Invalid/);
}));
test('category sets retain reviewed examples and namespaces',()=>fixture(({root,files,clusters})=>{
  const service=new LibraryService(path.join(root,'library'));const saved=service.saveCategories('Topics',{files,clusters});
  const data=service.read('categories',saved.id).data;
  assert.equal(data[0].namespace,'Library');assert.equal(data[0].examples.length,2);assert.equal(data[0].fileIndices,undefined);
}));
test('reusable category assignment keeps weak and ambiguous matches uncertain',()=>{
  const categories=[{name:'Fruit'},{name:'Code'}];
  const groups=assignCategories([[1,0],[0,1],[0.707,0.707],[-1,0]],[[1,0],[0,1]],categories,0.35);
  assert.deepEqual(groups.map(c=>c.fileIndices),[[0],[1],[2,3]]);
  assert.throws(()=>assignCategories([],[],[],NaN),/threshold/);
});
