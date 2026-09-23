const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const YAML = require('js-yaml');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const digest = file => fs.existsSync(file) ? hash(fs.readFileSync(file)) : null;
const segment = name => {
  if (typeof name !== 'string' || !name.trim() || ['.', '..'].includes(name.trim())) throw new Error('A folder name cannot be blank, . or ..');
  return name.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
};
function noSymlinks(target) {
  let p = path.resolve(target);
  while (true) {
    if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink() && !(['/var', '/tmp'].includes(p) && fs.realpathSync(p) === '/private' + p)) throw new Error(`Symbolic links are not supported for export: ${p}`);
    const parent = path.dirname(p); if (p === parent) break; p = parent;
  }
}
function atomic(file, data) {
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  try { fs.writeFileSync(temp, data, {flag:'wx', mode:0o600}); fs.renameSync(temp,file); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
function enrich(data, cluster, options, namespace) {
  if (!options.injectTags && !options.injectClusterDescription) return data;
  const content = data.toString('utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/);
  const metadata = match ? YAML.load(match[1]) || {} : {};
  if (typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Frontmatter must be a mapping');
  if (options.injectTags) metadata.tags = [...new Set([...(Array.isArray(metadata.tags) ? metadata.tags : metadata.tags ? [metadata.tags] : []), cluster.name])];
  if (options.injectClusterDescription) Object.assign(metadata, {cluster:cluster.name, clusterDescription:cluster.description || '', topic_context:cluster.description || ''});
  if (namespace) metadata.namespace = namespace;
  return Buffer.from(`---\n${YAML.dump(metadata)}---\n${match ? content.slice(match[0].length) : content}`);
}
class ExportService {
  constructor(root) { this.root = root; this.plans = new Map(); }
  preview(output, clusters, files, options = {}) {
    const mode = options.mode || 'copy';
    if (!['copy','move'].includes(mode) || !Array.isArray(files) || !files.length || !Array.isArray(clusters)) throw new Error('Invalid export request');
    const base = path.resolve(output); noSymlinks(base);
    const manifestRoot = options.namespace ? path.join(base,segment(options.namespace)) : base;
    const reserved = new Set(); const used = new Set(); const operations = []; const manifests = [];
    const unique = target => {
      const parsed = path.parse(target); let next = target; let i = 1;
      while (fs.existsSync(next) || reserved.has(next.toLowerCase())) next = path.join(parsed.dir,`${parsed.name} (${i++})${parsed.ext}`);
      reserved.add(next.toLowerCase()); return next;
    };
    const add = (destination, data, source = null, sourceHash = null, cluster = '') => {
      noSymlinks(destination);
      operations.push({destination, data:data.toString('base64'), afterHash:hash(data), beforeHash:digest(destination), source, sourceHash, cluster, metadata: source && sourceHash !== hash(data) ? { before: (fs.readFileSync(source,'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/) || [,'(No frontmatter)'])[1], after: (data.toString('utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/) || [,''])[1] } : null});
    };
    let common = path.dirname(path.resolve(files[0].path));
    for (const f of files) while (path.relative(common,path.resolve(f.path)).startsWith(`..${path.sep}`)) {
      const parent = path.dirname(common); if (parent === common) throw new Error('Files must share a filesystem root'); common = parent;
    }
    for (const cluster of clusters) {
      const namespace = cluster.namespace || options.namespace || '';
      const folder = path.join(base,...(namespace ? [segment(namespace)] : []),segment(cluster.name));
      const paths = [];
      for (const index of cluster.fileIndices) {
        if (!Number.isInteger(index) || !files[index] || used.has(index)) throw new Error('Every file must belong to exactly one category');
        used.add(index);
        const file = files[index]; const source = path.resolve(file.path); noSymlinks(source);
        const data = fs.readFileSync(source);
        if (file.content !== undefined && hash(Buffer.from(file.content)) !== hash(data)) throw new Error(`Source changed since import: ${file.name}. Reload the files before exporting.`);
        const relative = options.preserveRelativePaths ? path.relative(common,source) : path.basename(source);
        const destination = unique(path.join(folder,relative));
        if (!destination.startsWith(base + path.sep)) throw new Error('Destination escapes output folder');
        add(destination, /\.(md|markdown)$/i.test(source) ? enrich(data,cluster,options,namespace) : data,source,hash(data),cluster.name);
        paths.push(path.relative(manifestRoot,destination).split(path.sep).join('/'));
      }
      if (cluster.fileIndices.length) {
        manifests.push({name:cluster.name,description:cluster.description || '',folder:path.relative(manifestRoot,folder),filePaths:paths});
        if (options.writeClusterIndex) add(unique(path.join(folder,'_index.md')),Buffer.from(`# ${cluster.name}\n\n${cluster.description || ''}\n`));
      }
    }
    if (used.size !== files.length) throw new Error('Some files are not assigned to a category');
    if (options.writeManifest) add(path.join(manifestRoot,'index.json'),Buffer.from(JSON.stringify({clusters:manifests},null,2)));
    const dedup = path.join(manifestRoot,'_dedup_manifest.json'); let entries = {};
    if (fs.existsSync(dedup)) entries = JSON.parse(fs.readFileSync(dedup,'utf8')).entries || {};
    for (const op of operations.filter(o=>o.source)) entries[op.source] = fs.statSync(op.source).mtime.toISOString();
    add(dedup,Buffer.from(JSON.stringify({entries},null,2)));
    if (new Set(operations.map(o=>o.source).filter(Boolean)).size !== files.length) throw new Error('Duplicate source paths');
    const sourcePaths = new Set(operations.map(o=>o.source).filter(Boolean));
    if (new Set(operations.map(o=>o.destination.toLowerCase())).size !== operations.length) throw new Error('Output names collide with generated indexes');
    if (operations.some(o=>sourcePaths.has(o.destination))) throw new Error('Output would overwrite an input file');
    const id = crypto.randomUUID();
    // Keep only the latest preview, so abandoned previews do not retain document copies.
    this.plans.clear(); this.plans.set(id,{id,mode,createdAt:new Date().toISOString(),operations});
    return {id,mode,fileCount:files.length,operations:operations.map(({data,...op})=>({...op,change:op.source ? (op.sourceHash === op.afterHash ? 'Content unchanged' : 'Frontmatter updated') : op.beforeHash ? 'Replace index (backed up)' : 'Create index'}))};
  }
  journalPath(id) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid export ID');
    return path.join(this.root,id,'journal.json');
  }
  persist(journal) { atomic(this.journalPath(journal.id),JSON.stringify(journal,null,2)); }
  commit(id) {
    const plan = this.plans.get(id); if (!plan) throw new Error('Preview expired. Preview the export again.');
    for (const op of plan.operations) {
      noSymlinks(op.destination); if (op.source) noSymlinks(op.source);
      if (digest(op.destination) !== op.beforeHash || (op.source && digest(op.source) !== op.sourceHash)) throw new Error('Files changed after preview. Preview again before exporting.');
    }
    const dir = path.dirname(this.journalPath(id)); fs.mkdirSync(dir,{recursive:true,mode:0o700});
    const journal = {...plan,status:'prepared',operations:plan.operations.map(({data,...op},i)=>({...op,backup:path.join(dir,`${i}.before`),original:path.join(dir,`${i}.source`),payload:path.join(dir,`${i}.after`)}))};
    for (let i=0;i<journal.operations.length;i++) {
      const op=journal.operations[i];
      if (op.beforeHash) fs.copyFileSync(op.destination,op.backup,fs.constants.COPYFILE_EXCL);
      if (op.source && plan.mode === 'move') fs.copyFileSync(op.source,op.original,fs.constants.COPYFILE_EXCL);
      fs.writeFileSync(op.payload,Buffer.from(plan.operations[i].data,'base64'),{flag:'wx',mode:0o600});
    }
    this.persist(journal); this.plans.delete(id);
    try {
      for (const op of journal.operations) {
        noSymlinks(op.destination);
        if (digest(op.destination) !== op.beforeHash || (op.source && digest(op.source) !== op.sourceHash)) throw new Error('A file changed during export');
        fs.mkdirSync(path.dirname(op.destination),{recursive:true});
        if (op.beforeHash) atomic(op.destination,fs.readFileSync(op.payload));
        else fs.copyFileSync(op.payload,op.destination,fs.constants.COPYFILE_EXCL);
        if (plan.mode === 'move' && op.source) {
          noSymlinks(op.source);
          if (digest(op.source) !== op.sourceHash) throw new Error('Source changed during move; original retained');
          fs.unlinkSync(op.source);
        }
        op.done = true; this.persist(journal);
      }
      journal.status='complete'; this.persist(journal);
      return {success:true,id,results:journal.operations.filter(o=>o.source).map(o=>({source:o.source,destination:o.destination,cluster:o.cluster}))};
    } catch (error) {
      journal.status='incomplete'; journal.error=error.message; this.persist(journal);
      return {success:false,id,error:`Export interrupted: ${error.message}. Use Undo export to recover.`};
    }
  }
  history() {
    if (!fs.existsSync(this.root)) return [];
    return fs.readdirSync(this.root).flatMap(id=> {
      try {const j=JSON.parse(fs.readFileSync(this.journalPath(id),'utf8')); return [{id:j.id,mode:j.mode,status:j.status,createdAt:j.createdAt,fileCount:j.operations.filter(o=>o.source).length}];} catch {return [];}
    }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }
  undo(id) {
    const j=JSON.parse(fs.readFileSync(this.journalPath(id),'utf8'));
    if (j.status === 'undone') return {success:true};
    // Preflight every file before restoring anything. Never overwrite edits made after export.
    for (const op of j.operations) {
      noSymlinks(op.destination); const current=digest(op.destination);
      if (current !== op.afterHash && current !== op.beforeHash) throw new Error(`Cannot undo: output changed or was removed: ${op.destination}`);
      if (j.mode === 'move' && op.source) {
        noSymlinks(op.source); const original=digest(op.source);
        if (original !== null && original !== op.sourceHash) throw new Error(`Cannot undo: source path now contains different content: ${op.source}`);
        if (digest(op.original) !== op.sourceHash) throw new Error('Recovery backup is missing or damaged');
      }
      if (op.beforeHash && digest(op.backup) !== op.beforeHash) throw new Error('Index backup is missing or damaged');
    }
    j.status='undoing'; this.persist(j);
    for (const op of [...j.operations].reverse()) {
      if (j.mode === 'move' && op.source && !fs.existsSync(op.source)) {
        fs.mkdirSync(path.dirname(op.source),{recursive:true}); fs.copyFileSync(op.original,op.source,fs.constants.COPYFILE_EXCL);
      }
      if (digest(op.destination) === op.afterHash) {
        if (op.beforeHash) atomic(op.destination,fs.readFileSync(op.backup)); else fs.unlinkSync(op.destination);
      }
      op.undone=true; this.persist(j);
    }
    j.status='undone'; this.persist(j); return {success:true,mode:j.mode,restored:j.operations.filter(o=>o.source).map(o=>({source:o.source,destination:o.destination}))};
  }
}
module.exports={ExportService,hash};
