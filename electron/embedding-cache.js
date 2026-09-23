const { createHash } = require('crypto');
const { check } = require('./jobs');
const { validateEmbeddings } = require('./local-models');
class EmbeddingCache {
  constructor({maxBytes=64*1024*1024,maxEntries=5000}={}) {
    this.maxBytes=maxBytes;this.maxEntries=maxEntries;this.entries=new Map();this.bytes=0;
  }
  key(identity,text) {return createHash('sha256').update(JSON.stringify([identity,text])).digest('hex');}
  get(key) {
    const value=this.entries.get(key);if(!value)return null;
    this.entries.delete(key);this.entries.set(key,value);return Array.from(value);
  }
  set(key,vector) {
    const value=Float64Array.from(vector);
    if(value.byteLength>this.maxBytes)return;
    if(this.entries.has(key)){this.bytes-=this.entries.get(key).byteLength;this.entries.delete(key);}
    while(this.entries.size && (this.bytes+value.byteLength>this.maxBytes || this.entries.size>=this.maxEntries)) {
      const oldest=this.entries.keys().next().value;this.bytes-=this.entries.get(oldest).byteLength;this.entries.delete(oldest);
    }
    this.entries.set(key,value);this.bytes+=value.byteLength;
  }
  clear() {this.entries.clear();this.bytes=0;}
  stats() {return {entries:this.entries.size,vectorBytes:this.bytes,maxBytes:this.maxBytes,maxEntries:this.maxEntries};}
  async generate(texts,identity,fetchBatch,{batchSize=8,signal,onProgress}={}) {
    check(signal);
    const keys=texts.map(text=>this.key(identity,text));
    const vectors=keys.map(key=>this.get(key));
    const missing=new Map();
    vectors.forEach((vector,i)=>{if(!vector && !missing.has(keys[i]))missing.set(keys[i],texts[i]);});
    const requests=[...missing];let completed=texts.length-vectors.filter(v=>!v).length;
    onProgress?.(completed,texts.length-completed);
    const resolved=new Map();
    for(let i=0;i<requests.length;i+=batchSize) {
      check(signal);const batch=requests.slice(i,i+batchSize);
      const result=validateEmbeddings(await fetchBatch(batch.map(([,text])=>text)),batch.length);
      check(signal);
      result.forEach((vector,j)=>{const key=batch[j][0];this.set(key,vector);resolved.set(key,vector);});
      completed=texts.length-keys.filter((key,j)=>!vectors[j] && !resolved.has(key)).length;
      onProgress?.(completed,texts.length-completed);
    }
    check(signal);
    const result=vectors.map((vector,i)=>vector || resolved.get(keys[i]));
    try {return validateEmbeddings(result,texts.length);}
    catch(error){this.clear();throw error;}
  }
}
module.exports={EmbeddingCache};
