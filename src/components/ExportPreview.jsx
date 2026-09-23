import React, { useState } from 'react';

export default function ExportPreview({ plan, onCancel, onConfirm }) {
  const [acknowledged, setAcknowledged] = useState(false);
  return <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-6">
    <section role="dialog" aria-modal="true" aria-labelledby="export-title" className="bg-dark-100 rounded-xl border border-gray-600 p-6 w-full max-w-5xl max-h-[90vh] flex flex-col">
      <h2 id="export-title" className="text-xl font-bold">Review export</h2>
      <p className="text-gray-300 my-3">{plan.mode === 'move' ? 'Move' : 'Copy'} {plan.fileCount} files. Nothing has been changed yet. Undo remains available after restarting the app.</p>
      <div className="overflow-auto flex-1 border border-gray-700 rounded">
        <table className="w-full text-sm text-left"><thead className="bg-dark-200"><tr><th className="p-3">Source</th><th className="p-3">Exact destination</th><th className="p-3">Change</th></tr></thead>
          <tbody>{plan.operations.map((op,i)=><tr key={i} className="border-t border-gray-700"><td className="p-3 break-all">{op.source || 'Generated index'}</td><td className="p-3 break-all">{op.destination}</td><td className="p-3">{op.change}{op.metadata && <details className="mt-2"><summary>See frontmatter changes</summary><p>Before</p><pre className="whitespace-pre-wrap">{op.metadata.before}</pre><p>After</p><pre className="whitespace-pre-wrap">{op.metadata.after}</pre></details>}</td></tr>)}</tbody>
        </table>
      </div>
      {plan.mode === 'move' && <label className="flex gap-2 my-4 text-amber-300"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/>I understand that Move removes the originals from their current locations.</label>}
      <p className="text-xs text-gray-400 mt-3">Recovery copies stay on this computer. Undo refuses to replace content changed after export. Keep your normal backups.</p>
      <div className="flex justify-end gap-3 mt-4"><button autoFocus className="px-4 py-2 rounded bg-dark-300" onClick={onCancel}>Cancel</button><button className="px-4 py-2 rounded bg-primary-600 disabled:opacity-40" disabled={plan.mode==='move' && !acknowledged} onClick={onConfirm}>Confirm {plan.mode}</button></div>
    </section>
  </div>;
}
