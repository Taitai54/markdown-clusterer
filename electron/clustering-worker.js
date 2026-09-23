const { parentPort, workerData } = require('worker_threads');
(async () => {
  const { kmeans } = await import('ml-kmeans');
  const { embeddings, k, operation } = workerData;
  const options = {initialization:'kmeans++',seed:42};
  if (operation === 'cluster') {
    const {clusters,centroids}=kmeans(embeddings,k,options);
    return {clusters,centroids};
  }
  const max = Math.min(10,Math.max(2,Math.floor(embeddings.length/2)));
  const wss=[];
  for(let count=2;count<=max;count++) {
    const result=kmeans(embeddings,count,options);
    wss.push(embeddings.reduce((sum,v,i)=>sum+v.reduce((s,n,d)=>s+(n-result.centroids[result.clusters[i]][d])**2,0),0));
  }
  let suggestedK=2,curvature=-Infinity;
  for(let i=1;i<wss.length-1;i++) {
    const value=wss[i-1]-2*wss[i]+wss[i+1];
    if(value>curvature){curvature=value;suggestedK=i+2;}
  }
  return {suggestedK};
})().then(result=>parentPort.postMessage({result})).catch(error=>parentPort.postMessage({error:error.message}));
