import React, { useState } from 'react';

export default function LibraryBar({items,history,dirty,projectName,busy,hasFiles,hasClusters,onSave,onOpen,onNew,onSaveCategories,onApply,onUndo,onImport,onReload,onClearCache}) {
  const [name,setName]=useState(''); const [project,setProject]=useState(''); const [category,setCategory]=useState(''); const [exportId,setExportId]=useState(''); const [threshold,setThreshold]=useState(0.35);
  const button='px-3 py-1.5 rounded bg-dark-300 border border-gray-600 disabled:opacity-40';
  const input='px-2 py-1.5 rounded bg-dark-200 border border-gray-600';
  return <details className="bg-dark-100 border-b border-gray-700 px-6 py-3" open>
    <summary className="cursor-pointer text-sm">Library · {projectName || 'Untitled project'}{dirty ? ' · Unsaved changes' : ''}</summary>
    <fieldset disabled={busy} className="mt-3 flex flex-wrap gap-3 items-center text-sm">
      <input aria-label="Save name" placeholder="Project or category set name" maxLength={120} value={name} onChange={e=>setName(e.target.value)} className={input}/>
      <button className={button} disabled={!hasFiles} onClick={()=>onSave(name || projectName)}>Save project</button>
      <select aria-label="Saved projects" className={input} value={project} onChange={e=>setProject(e.target.value)}><option value="">Saved projects…</option>{items.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <button className={button} disabled={!project} onClick={()=>onOpen(project)}>Open</button>
      <button className={button} onClick={onNew}>New project</button>
      <button className={button} onClick={onImport}>Import files</button>
      <button className={button} disabled={!hasFiles} onClick={onReload}>Reload sources</button>
      <span className="w-full border-t border-gray-700"/>
      <button className={button} disabled={!hasClusters || !name.trim()} onClick={()=>onSaveCategories(name)}>Save reviewed categories</button>
      <select aria-label="Category set" className={input} value={category} onChange={e=>setCategory(e.target.value)}><option value="">Reusable categories…</option>{items.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <label>Minimum match <input aria-label="Minimum match" className={`${input} w-20`} type="number" min="0" max="1" step="0.05" value={threshold} onChange={e=>setThreshold(Number(e.target.value))}/></label>
      <button className={button} disabled={!hasFiles || !category} onClick={()=>onApply(category,threshold)}>Suggest categories</button>
      <span className="text-xs text-gray-400">Weak or close matches go to Uncertain for review.</span>
      <span className="w-full border-t border-gray-700"/>
      <select aria-label="Export history" className={input} value={exportId} onChange={e=>setExportId(e.target.value)}><option value="">Export history…</option>{history.filter(h=>h.status!=='undone').map(h=><option key={h.id} value={h.id}>{new Date(h.createdAt).toLocaleString()} · {h.mode} {h.fileCount} files · {h.status}</option>)}</select>
      <button className={button} onClick={onClearCache}>Clear embedding cache</button>
      <button className={button} disabled={!exportId} onClick={()=>onUndo(exportId)}>Undo export</button>
    </fieldset>
  </details>;
}
