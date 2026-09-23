const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {validateSession} = require('./library-service');
const {hash} = require('./export-service');
class RecoveryStore {
  constructor(root) {this.root=root;this.file=path.join(root,'draft.json');}
  save(session,project={}) {
    const data=validateSession(session);
    const draft={version:1,updatedAt:new Date().toISOString(),project:{id:typeof project.id==='string'?project.id:null,name:typeof project.name==='string'?project.name.slice(0,120):''},data};
    fs.mkdirSync(this.root,{recursive:true,mode:0o700});
    const temp=path.join(this.root,`${crypto.randomUUID()}.tmp`);
    try {fs.writeFileSync(temp,JSON.stringify(draft),{flag:'wx',mode:0o600});fs.renameSync(temp,this.file);}
    finally {if(fs.existsSync(temp))fs.unlinkSync(temp);}
    return {updatedAt:draft.updatedAt};
  }
  load() {
    if(!fs.existsSync(this.file))return null;
    const draft=JSON.parse(fs.readFileSync(this.file,'utf8'));
    if(draft.version!==1)throw new Error('Unsupported recovery snapshot version');
    draft.data=validateSession(draft.data);
    draft.warnings=[];
    for(const f of draft.data.files) {
      try {if(hash(fs.readFileSync(f.path))!==hash(Buffer.from(f.content)))draft.warnings.push(`Changed: ${f.path}`);}
      catch{draft.warnings.push(`Missing: ${f.path}`);}
    }
    return draft;
  }
  clear() {if(fs.existsSync(this.file))fs.unlinkSync(this.file);}
}
module.exports={RecoveryStore};
