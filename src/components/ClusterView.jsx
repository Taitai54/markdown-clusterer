import React, { useState, useMemo } from 'react';

function ClusterView({ 
  clusters, 
  files, 
  numClustersRequested,
  outputFolder,
  organized,
  orgMode,
  setOrgMode,
  injectTags,
  setInjectTags,
  writeManifest,
  setWriteManifest,
  writeClusterIndex,
  setWriteClusterIndex,
  injectClusterDescription,
  setInjectClusterDescription,
  preserveRelativePaths,
  setPreserveRelativePaths,
  onSelectOutputFolder,
  onOrganize,
  onMoveFile,
  onRenameCluster,
  onSetClusterNamespace,
  onMergeClusters,
  onSplitCluster,
  onRecluster,
  namespace,
  setNamespace,
  embeddingModel,
  setEmbeddingModel,
  embeddings
}) {
  const [draggedFile, setDraggedFile] = useState(null);
  const [dragOverCluster, setDragOverCluster] = useState(null);
  const [editingCluster, setEditingCluster] = useState(null);
  const [editName, setEditName] = useState('');
  const [selectedFileIndex, setSelectedFileIndex] = useState(null);
  const [selectedForSplit, setSelectedForSplit] = useState(() => new Set());
  const [mergeMenuOpen, setMergeMenuOpen] = useState(null);
  const [duplicateFlags, setDuplicateFlags] = useState({}); // { fileIndex: true }

  const cosineSimilarity = (vecA, vecB) => {
    if (!vecA || !vecB) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  };

  const checkClusterDuplicates = (clusterIndex) => {
    const cluster = clusters[clusterIndex];
    if (!cluster || !embeddings || embeddings.length === 0) return;

    const newFlags = { ...duplicateFlags };
    const indices = cluster.fileIndices;
    
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const idxA = indices[i];
        const idxB = indices[j];
        const sim = cosineSimilarity(embeddings[idxA], embeddings[idxB]);
        
        if (sim > 0.92) { // 92% similarity threshold
          newFlags[idxA] = true;
          newFlags[idxB] = true;
        }
      }
    }
    setDuplicateFlags(newFlags);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getDisplayDate = (file) => {
    // Prefer frontmatter createdAt, then updatedAt, then file system modified
    if (file.createdAt) return { date: file.createdAt, label: 'Created' };
    if (file.updatedAt) return { date: file.updatedAt, label: 'Updated' };
    if (file.modified) return { date: file.modified, label: 'Modified' };
    return null;
  };

  const handleDragStart = (fileIndex, clusterIndex) => {
    setDraggedFile({ fileIndex, clusterIndex });
  };

  const handleDragOver = (e, clusterIndex) => {
    e.preventDefault();
    setDragOverCluster(clusterIndex);
  };

  const handleDragLeave = () => {
    setDragOverCluster(null);
  };

  const handleDrop = (e, toClusterIndex) => {
    e.preventDefault();
    if (draggedFile && draggedFile.clusterIndex !== toClusterIndex) {
      onMoveFile(draggedFile.fileIndex, draggedFile.clusterIndex, toClusterIndex);
    }
    setDraggedFile(null);
    setDragOverCluster(null);
  };

  const startEditing = (index, currentName) => {
    setEditingCluster(index);
    setEditName(currentName);
  };

  const saveEdit = (index) => {
    if (editName.trim()) {
      onRenameCluster(index, editName.trim());
    }
    setEditingCluster(null);
  };

  const toggleFileForSplit = (e, fileIndex) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setSelectedForSplit(prev => {
        const next = new Set(prev);
        if (next.has(fileIndex)) next.delete(fileIndex);
        else next.add(fileIndex);
        return next;
      });
    }
  };

  const getSelectedInCluster = (cluster) => cluster.fileIndices.filter(i => selectedForSplit.has(i));
  const clearSplitSelection = () => setSelectedForSplit(new Set());

  const clusterColors = useMemo(() => [
    'from-blue-500/20 to-blue-700/20 border-blue-500/30',
    'from-green-500/20 to-green-700/20 border-green-500/30',
    'from-purple-500/20 to-purple-700/20 border-purple-500/30',
    'from-orange-500/20 to-orange-700/20 border-orange-500/30',
    'from-pink-500/20 to-pink-700/20 border-pink-500/30',
    'from-cyan-500/20 to-cyan-700/20 border-cyan-500/30',
    'from-yellow-500/20 to-yellow-700/20 border-yellow-500/30',
    'from-red-500/20 to-red-700/20 border-red-500/30',
    'from-indigo-500/20 to-indigo-700/20 border-indigo-500/30',
    'from-teal-500/20 to-teal-700/20 border-teal-500/30',
  ], []);

  return (
    <div className="h-full flex flex-col">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between mb-4 flex-shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onRecluster}
            className="px-4 py-2 bg-dark-100 hover:bg-dark-300 rounded-lg transition-colors flex items-center gap-2"
            aria-label="Go back to file list"
          >
            ← Back to Files
          </button>
          <span className="text-gray-400">
            {clusters.length} clusters created
            {numClustersRequested != null && clusters.length < numClustersRequested && (
              <span className="ml-2 text-amber-400" title="Some clusters were empty and omitted">
                (fewer than requested)
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-4 bg-dark-200 p-2 rounded-lg border border-gray-700">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              name="orgMode"
              value="copy"
              checked={orgMode === 'copy'}
              onChange={() => setOrgMode('copy')}
              className="text-primary-500 bg-dark-100 border-gray-600 focus:ring-primary-600"
              aria-label="Copy files to output folder"
            />
            Copy
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              name="orgMode"
              value="move"
              checked={orgMode === 'move'}
              onChange={() => setOrgMode('move')}
              className="text-primary-500 bg-dark-100 border-gray-600 focus:ring-primary-600"
              aria-label="Move files to output folder"
            />
            Move
          </label>
          <div className="w-px h-4 bg-gray-600 mx-1"></div>
            <label className="flex items-center gap-2 cursor-pointer text-sm" title="Adds the cluster name to the file's YAML frontmatter as a tag">
            <input
              type="checkbox"
              checked={injectTags}
              onChange={(e) => setInjectTags(e.target.checked)}
              className="rounded text-primary-500 bg-dark-100 border-gray-600 focus:ring-primary-600"
              aria-label="Inject cluster name as YAML frontmatter tag"
            />
            Inject Tags
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm" title="Write index.json with cluster names, descriptions, and file paths">
            <input
              type="checkbox"
              checked={writeManifest}
              onChange={(e) => setWriteManifest(e.target.checked)}
              className="rounded text-primary-500 bg-dark-100 border-gray-600 focus:ring-primary-600"
              aria-label="Write index.json manifest"
            />
            Write index
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm" title="Write _index.md in each cluster folder with name and description">
            <input
              type="checkbox"
              checked={writeClusterIndex}
              onChange={(e) => setWriteClusterIndex(e.target.checked)}
              className="rounded text-primary-500 bg-dark-100 border-gray-600 focus:ring-primary-600"
              aria-label="Write _index.md per cluster"
            />
            Cluster index
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm" title="Add cluster and clusterDescription to frontmatter">
            <input
              type="checkbox"
              checked={injectClusterDescription}
              onChange={(e) => setInjectClusterDescription(e.target.checked)}
              className="rounded text-primary-500 bg-dark-100 border-gray-600 focus:ring-primary-600"
              aria-label="Inject cluster description in frontmatter"
            />
            Cluster meta
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm" title="Keep folder structure under each cluster">
            <input
              type="checkbox"
              checked={preserveRelativePaths}
              onChange={(e) => setPreserveRelativePaths(e.target.checked)}
              className="rounded text-primary-500 bg-dark-100 border-gray-600 focus:ring-primary-600"
              aria-label="Preserve relative paths"
            />
            Preserve paths
          </label>
        </div>

        <div className="flex items-center gap-4 bg-dark-200 p-2 rounded-lg border border-blue-500/30">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-blue-400 font-bold">Namespace:</span>
            <input
              type="text"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              placeholder="e.g. projects"
              className="w-24 px-2 py-1 bg-dark-100 border border-gray-600 rounded text-white text-xs focus:outline-none focus:border-blue-500"
              title="Creates a parent folder for all clusters and injects into metadata"
            />
          </label>
          <div className="w-px h-4 bg-gray-600 mx-1"></div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">Model:</span>
            <select
              value={embeddingModel}
              onChange={(e) => setEmbeddingModel(e.target.value)}
              className="bg-dark-100 border border-gray-600 rounded text-xs px-1 py-0.5 text-gray-300"
              title="Choose the model used for semantic analysis"
            >
              <option value="text-embedding-3-small">OpenAI Small (1536d)</option>
              <option value="text-embedding-3-large">OpenAI Large (3072d)</option>
              <option value="multilingual-e5-large">Pinecone E5 (1024d)</option>
            </select>
          </label>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onSelectOutputFolder}
            className="px-4 py-2 bg-dark-100 hover:bg-dark-300 border border-gray-600 rounded-lg transition-colors flex items-center gap-2"
            aria-label={outputFolder ? 'Change output folder' : 'Select output folder'}
          >
            📁 {outputFolder ? 'Change Output Folder' : 'Select Output Folder'}
          </button>
          
          {outputFolder && (
            <span className="text-gray-400 text-sm max-w-xs truncate" title={outputFolder}>
              → {outputFolder}
            </span>
          )}
          
          <button
            onClick={onOrganize}
            disabled={!outputFolder || organized}
            className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              organized
                ? 'bg-green-600 cursor-default'
                : 'bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:cursor-not-allowed'
            }`}
            aria-label={organized ? 'Files organized' : 'Organize files into folders'}
          >
            {organized ? '✓ Organized!' : '📂 Organize Files'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="mb-4 p-3 bg-dark-100 rounded-lg text-sm text-gray-400 flex-shrink-0">
        💡 <strong>Tip:</strong> Drag files between clusters to reorganize. Click cluster names to rename. Ctrl+click files to select for split, then use &quot;Split to new cluster&quot;. Use &quot;Merge into&quot; to combine two clusters.
      </div>

      {/* Split layout: Clusters and File Preview */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Clusters Area */}
        <div className="flex-[2] overflow-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clusters.map((cluster, clusterIndex) => (
            <div
              key={clusterIndex}
              className={`cluster-folder bg-gradient-to-br ${clusterColors[clusterIndex % clusterColors.length]} rounded-xl p-4 border-2 transition-all ${
                dragOverCluster === clusterIndex ? 'border-green-400 scale-[1.02]' : ''
              }`}
              onDragOver={(e) => handleDragOver(e, clusterIndex)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, clusterIndex)}
              role="region"
              aria-label={`Cluster: ${cluster.name}, ${cluster.fileIndices.length} files`}
            >
              {/* Cluster Header */}
              <div className="flex items-center justify-between mb-3">
                {editingCluster === clusterIndex ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => saveEdit(clusterIndex)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(clusterIndex)}
                    className="flex-1 px-2 py-1 bg-dark-200 border border-gray-500 rounded text-white focus:outline-none focus:border-primary-500"
                    autoFocus
                    aria-label="Rename cluster"
                  />
                ) : (
                  <h3
                    className="font-bold text-white text-lg cursor-pointer hover:text-primary-300 transition-colors"
                    onClick={() => startEditing(clusterIndex, cluster.name)}
                    title="Click to rename"
                    aria-label={`Cluster name: ${cluster.name}. Click to rename.`}
                  >
                    📁 {cluster.name}
                  </h3>
                )}
                
                {/* Per-cluster Namespace override */}
                <div className="flex items-center gap-1 ml-4 bg-dark-200/50 px-2 py-0.5 rounded border border-gray-600/30">
                  <span className="text-[10px] text-gray-500 font-bold uppercase">NS:</span>
                  <input
                    type="text"
                    value={cluster.namespace || ''}
                    placeholder={namespace || 'none'}
                    onChange={(e) => onSetClusterNamespace(clusterIndex, e.target.value)}
                    className="bg-transparent border-none text-xs text-blue-400 focus:outline-none w-20 placeholder:text-gray-600"
                    title="Override global namespace for this cluster"
                  />
                </div>

                <span className="text-sm text-gray-400 ml-auto">
                  {cluster.fileIndices.length} files
                </span>
                {clusters.length > 1 && (
                  <div className="relative flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => checkClusterDuplicates(clusterIndex)}
                      className="text-xs px-2 py-1 bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 rounded border border-amber-600/50"
                      title="Identify files with >92% semantic similarity"
                    >
                      Check Overlap
                    </button>
                    <button
                      type="button"
                      onClick={() => setMergeMenuOpen(mergeMenuOpen === clusterIndex ? null : clusterIndex)}
                      className="text-xs px-2 py-1 bg-dark-200 hover:bg-dark-300 rounded border border-gray-600"
                      aria-label="Merge this cluster into another"
                    >
                      Merge into…
                    </button>
                    {mergeMenuOpen === clusterIndex && (
                      <div className="absolute right-0 top-full mt-1 py-1 bg-dark-200 border border-gray-600 rounded-lg shadow-lg z-10 min-w-[140px]">
                        {clusters.map((other, otherIndex) => {
                          if (otherIndex === clusterIndex) return null;
                          return (
                            <button
                              key={otherIndex}
                              type="button"
                              onClick={() => {
                                onMergeClusters(clusterIndex, otherIndex);
                                setMergeMenuOpen(null);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-dark-300 truncate"
                            >
                              {other.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cluster Description */}
              {cluster.description && (
                <p className="text-sm text-gray-400 mb-3">{cluster.description}</p>
              )}

              {/* Files in Cluster */}
              <div className="space-y-2 max-h-60 overflow-auto">
                {cluster.fileIndices.length > 1 && getSelectedInCluster(cluster).length > 0 && (
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSplitCluster(clusterIndex, getSelectedInCluster(cluster));
                        clearSplitSelection();
                      }}
                      className="text-xs px-2 py-1 bg-primary-600 hover:bg-primary-700 rounded"
                    >
                      Split {getSelectedInCluster(cluster).length} to new cluster
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedForSplit(prev => {
                        const next = new Set(prev);
                        cluster.fileIndices.forEach(i => next.delete(i));
                        return next;
                      })}
                      className="text-xs px-2 py-1 bg-dark-300 hover:bg-dark-200 rounded"
                    >
                      Clear
                    </button>
                  </div>
                )}
                {cluster.fileIndices.map((fileIndex) => {
                  const file = files[fileIndex];
                  if (!file) return null;
                  const isSelectedForSplit = selectedForSplit.has(fileIndex);
                  
                  return (
                    <div
                      key={fileIndex}
                      draggable
                      onDragStart={() => handleDragStart(fileIndex, clusterIndex)}
                      onClick={(e) => {
                        toggleFileForSplit(e, fileIndex);
                        if (!e.ctrlKey && !e.metaKey) setSelectedFileIndex(fileIndex);
                      }}
                      className={`bg-dark-200/50 rounded-lg p-2 cursor-move hover:bg-dark-200 transition-colors flex items-center gap-2 ${selectedFileIndex === fileIndex ? 'ring-2 ring-primary-500' : ''} ${isSelectedForSplit ? 'ring-2 ring-amber-400' : ''} ${duplicateFlags[fileIndex] ? 'border border-amber-500 bg-amber-500/10' : ''}`}
                      role="button"
                      tabIndex={0}
                      title={duplicateFlags[fileIndex] ? "High semantic overlap detected with another file in this cluster" : ""}
                      aria-label={`File: ${file.name}. Drag to move, click to preview, Ctrl+click to select for split.`}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedFileIndex(fileIndex); } }}
                    >
                      <span className="text-gray-500">📄</span>
                      <span className="text-sm text-gray-300 truncate flex-1" title={file.name}>
                        {file.name}
                      </span>
                      {isSelectedForSplit && <span className="text-amber-400 text-xs">✓</span>}
                    </div>
                  );
                })}
                
                {cluster.fileIndices.length === 0 && (
                  <div className="text-center text-gray-500 py-4">
                    Drop files here
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* File Preview Pane */}
      <div className="flex-1 bg-dark-100 border border-gray-700 rounded-xl flex flex-col overflow-hidden min-w-[300px]">
        {selectedFileIndex !== null && files[selectedFileIndex] ? (
          <>
            <div className="p-3 border-b border-gray-700 bg-dark-200/50 flex-shrink-0">
              <div className="font-medium truncate" title={files[selectedFileIndex].name}>
                📄 {files[selectedFileIndex].name}
              </div>
              <div className="text-xs text-gray-500 mt-1 flex gap-3">
                {(() => {
                  const dateInfo = getDisplayDate(files[selectedFileIndex]);
                  return dateInfo ? (
                    <span title={dateInfo.label}>📅 {formatDate(dateInfo.date)}</span>
                  ) : null;
                })()}
                {files[selectedFileIndex].size && (
                  <span>📦 {formatSize(files[selectedFileIndex].size)}</span>
                )}
              </div>
            </div>
            <div className="p-4 flex-1 overflow-auto bg-dark-300 text-gray-300 text-sm font-mono whitespace-pre-wrap custom-scrollbar">
              {files[selectedFileIndex].content}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-6 text-center">
            <span className="text-4xl mb-4">👁️</span>
            <p>Click a file in any cluster to preview its contents here.</p>
          </div>
        )}
      </div>
    </div>

      {/* Success Message */}
      {organized && (
        <div className="mt-4 p-4 bg-green-900/30 border border-green-500/50 rounded-lg text-green-300 flex-shrink-0">
          ✓ Files have been successfully organized into folders at: <strong>{outputFolder}</strong>
        </div>
      )}
    </div>
  );
}

export default ClusterView;
