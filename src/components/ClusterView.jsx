import React, { useState } from 'react';

function ClusterView({ 
  clusters, 
  files, 
  outputFolder, 
  organized,
  orgMode,
  setOrgMode,
  injectTags,
  setInjectTags,
  onSelectOutputFolder, 
  onOrganize,
  onMoveFile,
  onRenameCluster,
  onRecluster
}) {
  const [draggedFile, setDraggedFile] = useState(null);
  const [dragOverCluster, setDragOverCluster] = useState(null);
  const [editingCluster, setEditingCluster] = useState(null);
  const [editName, setEditName] = useState('');
  const [selectedFileIndex, setSelectedFileIndex] = useState(null);

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

  const clusterColors = [
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
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between mb-4 flex-shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onRecluster}
            className="px-4 py-2 bg-dark-100 hover:bg-dark-300 rounded-lg transition-colors flex items-center gap-2"
          >
            ← Back to Files
          </button>
          <span className="text-gray-400">
            {clusters.length} clusters created
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
            />
            Inject Tags
          </label>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onSelectOutputFolder}
            className="px-4 py-2 bg-dark-100 hover:bg-dark-300 border border-gray-600 rounded-lg transition-colors flex items-center gap-2"
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
          >
            {organized ? '✓ Organized!' : '📂 Organize Files'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="mb-4 p-3 bg-dark-100 rounded-lg text-sm text-gray-400 flex-shrink-0">
        💡 <strong>Tip:</strong> Drag files between clusters to reorganize. Click cluster names to rename them.
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
                  />
                ) : (
                  <h3 
                    className="font-bold text-white text-lg cursor-pointer hover:text-primary-300 transition-colors"
                    onClick={() => startEditing(clusterIndex, cluster.name)}
                    title="Click to rename"
                  >
                    📁 {cluster.name}
                  </h3>
                )}
                <span className="text-sm text-gray-400 ml-2">
                  {cluster.fileIndices.length} files
                </span>
              </div>

              {/* Cluster Description */}
              {cluster.description && (
                <p className="text-sm text-gray-400 mb-3">{cluster.description}</p>
              )}

              {/* Files in Cluster */}
              <div className="space-y-2 max-h-60 overflow-auto">
                {cluster.fileIndices.map((fileIndex) => {
                  const file = files[fileIndex];
                  if (!file) return null;
                  
                  return (
                    <div
                      key={fileIndex}
                      draggable
                      onDragStart={() => handleDragStart(fileIndex, clusterIndex)}
                      onClick={() => setSelectedFileIndex(fileIndex)}
                      className={`bg-dark-200/50 rounded-lg p-2 cursor-move hover:bg-dark-200 transition-colors flex items-center gap-2 ${selectedFileIndex === fileIndex ? 'ring-2 ring-primary-500' : ''}`}
                    >
                      <span className="text-gray-500">📄</span>
                      <span className="text-sm text-gray-300 truncate" title={file.name}>
                        {file.name}
                      </span>
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
            <div className="p-3 border-b border-gray-700 bg-dark-200/50 font-medium truncate flex-shrink-0" title={files[selectedFileIndex].name}>
              📄 {files[selectedFileIndex].name}
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
