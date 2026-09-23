const { AsyncLocalStorage } = require('async_hooks');
const { Worker } = require('worker_threads');
const path = require('path');
function cancelled() { const error = new Error('Cancelled. Your previous groups are unchanged.'); error.name = 'AbortError'; return error; }
function check(signal) { if (signal?.aborted) throw cancelled(); }
function delay(ms, signal) {
  check(signal);
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const timer = setTimeout(() => { cleanup(); resolve(); }, ms);
    const abort = () => { clearTimeout(timer); cleanup(); reject(cancelled()); };
    signal?.addEventListener('abort', abort, { once: true });
  });
}
class Jobs {
  constructor() { this.context = new AsyncLocalStorage(); this.active = null; }
  signal() { return this.context.getStore()?.signal; }
  cancel() { if (!this.active) return false; this.active.abort(); return true; }
  async run(task) {
    if (this.active) return {success:false,error:'Another model task is running. Wait for it or cancel it first.'};
    const controller = new AbortController(); this.active = controller;
    try {
      return await this.context.run(controller, async () => { const result = await task(); check(controller.signal); return result; });
    } catch (error) {
      return {success:false,cancelled:controller.signal.aborted || error.name === 'AbortError',error:error.message};
    } finally { this.active = null; }
  }
}
function runClustering(data, signal) {
  check(signal);
  return new Promise((resolve,reject) => {
    const worker = new Worker(path.join(__dirname,'clustering-worker.js'), {workerData:data});
    let done = false;
    const finish = (error,result) => {
      if (done) return; done=true; signal?.removeEventListener('abort',abort);
      worker.terminate(); if(error)reject(error);else resolve(result);
    };
    const abort = () => finish(cancelled());
    signal?.addEventListener('abort',abort,{once:true});
    worker.once('message',message => message.error ? finish(new Error(message.error)) : finish(null,message.result));
    worker.once('error',error => finish(error));
    worker.once('exit',code => { if(!done)finish(new Error(`Clustering worker exited before completing (${code})`)); });
  });
}
module.exports = { Jobs, check, delay, runClustering };
