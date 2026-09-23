const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {hash} = require('./export-service');
const PROJECT_KEYS=['files','clusters','numClusters','outputFolder','orgMode','injectTags','writeManifest','writeClusterIndex','injectClusterDescription','preserveRelativePaths','aiHint','namespace'];
function validateSession(session) {
  if (!session || !Array.isArray(session.files) || !Array.isArray(session.clusters)) throw new Error('Invalid project');
  if (session.files.some(f=>typeof f.path !== 'string' || typeof f.name !== 'string' || typeof f.content !== 'string')) throw new Error('Invalid project files');
  const used=new Set();
  for (const c of session.clusters) {
    if (typeof c.name !== 'string' || !c.name.trim() || !Array.isArray(c.fileIndices)) throw new Error('Invalid category');
    for (const i of c.fileIndices) {
      if (!Number.isInteger(i) || !session.files[i] || used.has(i)) throw new Error('Invalid category assignment'); used.add(i);
    }
  }
  return Object.fromEntries(PROJECT_KEYS.filter(k=>session[k] !== undefined).map(k=>[k,session[k]]));
}
class LibraryService {
  constructor(root) {this.root=root;}
  file(kind,id) {
    if (!['projects','categories'].includes(kind) || !/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid saved item');
    return path.join(this.root,kind,`${id}.json`);
  }
  save(kind,name,data,id=crypto.randomUUID()) {
    if (typeof name !== 'string' || !name.trim() || name.length>120) throw new Error('Enter a name of up to 120 characters');
    const file=this.file(kind,id); fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
    const item={version:1,id,name:name.trim(),updatedAt:new Date().toISOString(),data};
    const temp=`${file}.${crypto.randomUUID()}.tmp`;
    try {fs.writeFileSync(temp,JSON.stringify(item),{flag:'wx',mode:0o600}); fs.renameSync(temp,file);} finally {if(fs.existsSync(temp))fs.unlinkSync(temp);}
    return {id,name:item.name};
  }
  list(kind) {
    const dir=path.join(this.root,kind); if(!fs.existsSync(dir))return [];
    return fs.readdirSync(dir).filter(n=>n.endsWith('.json')).flatMap(n=>{
      try {const {id,name,updatedAt}=JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));return [{id,name,updatedAt}];}catch{return [];}
    }).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  }
  read(kind,id) {const item=JSON.parse(fs.readFileSync(this.file(kind,id),'utf8'));if(item.version!==1)throw new Error('Unsupported saved format');return item;}
  saveProject(name,session,id) {return this.save('projects',name,validateSession(session),id);}
  openProject(id) {
    const item=this.read('projects',id);item.data=validateSession(item.data);const warnings=[];
    for(const f of item.data.files) {
      try {if(hash(fs.readFileSync(f.path))!==hash(Buffer.from(f.content)))warnings.push(`Changed: ${f.path}`);}catch{warnings.push(`Missing: ${f.path}`);}
    }
    return {...item,warnings};
  }
  saveCategories(name,session) {
    const {files,clusters}=validateSession(session);
    const categories=clusters.filter(c=>c.fileIndices.length).map(c=>({name:c.name,description:c.description || '',namespace:c.namespace || '',examples:c.fileIndices.slice(0,3).map(i=>files[i].content.slice(0,1500))}));
    if (!categories.length)throw new Error('Create and review some categories first');
    return this.save('categories',name,categories);
  }
}
function assignCategories(vectors,categoryVectors,categories,threshold=0.35,margin=0.04) {
  if (!Number.isFinite(threshold) || threshold<0 || threshold>1)throw new Error('Match threshold must be between 0 and 1');
  const groups=categories.map(c=>({name:c.name,description:c.description,namespace:c.namespace,fileIndices:[]}));
  const uncertain={name:'Uncertain — review',description:'Weak or ambiguous matches. Review these files before export.',fileIndices:[]};
  vectors.forEach((v,i)=>{
    const scores=categoryVectors.map((c,index)=>({index,score:v.reduce((sum,n,d)=>sum+n*c[d],0)})).sort((a,b)=>b.score-a.score);
    const first=scores[0];
    if(!first || first.score<threshold || (scores[1] && first.score-scores[1].score<margin))uncertain.fileIndices.push(i);
    else groups[first.index].fileIndices.push(i);
  });
  return [...groups,...(uncertain.fileIndices.length?[uncertain]:[])];
}
module.exports={LibraryService,validateSession,assignCategories};
