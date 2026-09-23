import {useEffect, useState, useRef} from 'react';

export function useRecovery({snapshot,project,dirty,busy}) {
  const [ready,setReady]=useState(false);
  const [pending,setPending]=useState(null);
  const [status,setStatus]=useState('');
  const generation=useRef(0);
  useEffect(()=>{
    let active=true;
    window.electronAPI.loadDraft().then(result=>{
      if(!active)return;
      if(!result.success) {setPending({error:result.error});return;}
      if(result.draft)setPending(result.draft);else setReady(true);
    }).catch(e=>{if(active)setPending({error:e.message});});
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{
    const current=++generation.current;
    if(!ready || busy)return;
    setStatus(dirty?'Saving recovery copy…':'');
    const timer=setTimeout(async()=>{
      try {
        const result=dirty ? await window.electronAPI.saveDraft(JSON.parse(snapshot),project) : await window.electronAPI.clearDraft();
        if(current!==generation.current)return;
        setStatus(result.success ? (dirty ? 'Recovery copy saved' : '') : `Recovery save failed: ${result.error}`);
      } catch(e) {if(current===generation.current)setStatus(`Recovery save failed: ${e.message}`);}
    },800);
    return ()=>{clearTimeout(timer);generation.current++;};
  },[snapshot,project.id,project.name,dirty,ready,busy]);
  const flush=async()=>{
    if(!ready || !dirty)return;
    try {
      const result=await window.electronAPI.saveDraft(JSON.parse(snapshot),project);
      setStatus(result.success ? 'Recovery copy saved' : `Recovery save failed: ${result.error}`);
    } catch(e) {setStatus(`Recovery save failed: ${e.message}`);}
  };
  const dismiss=async()=>{
    const result=await window.electronAPI.clearDraft();
    if(!result.success)throw new Error(result.error);
    setPending(null);setReady(true);
  };
  const recovered=()=>{setPending(null);setReady(true);};
  return {pending,status,dismiss,recovered,flush};
}
