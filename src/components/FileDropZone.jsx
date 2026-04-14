import React, { useState } from 'react';

function FileDropZone({ onSelectFolder, onSelectFiles, onDropPaths }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer && e.dataTransfer.files) {
      const paths = Array.from(e.dataTransfer.files).map(f => f.path).filter(Boolean);
      if (paths.length > 0 && typeof onDropPaths === 'function') {
        onDropPaths(paths);
        return;
      }
    }
    
    // Fallback if no valid paths or onDropPaths is not provided
    onSelectFiles();
  };

  return (
    <div className="h-full flex items-center justify-center">
      <div
        className={`drop-zone w-full max-w-2xl p-12 border-2 border-dashed rounded-2xl text-center transition-all ${
          isDragging 
            ? 'border-primary-500 bg-primary-500/10 drag-over' 
            : 'border-gray-600 hover:border-gray-500'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="w-20 h-20 bg-gradient-to-br from-primary-500/20 to-primary-700/20 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6">
          📄
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">
          Drop your markdown files here
        </h2>
        <p className="text-gray-400 mb-8">
          or use the buttons below to select files
        </p>
        
        <div className="flex justify-center gap-4">
          <button
            onClick={onSelectFolder}
            className="px-6 py-3 bg-dark-100 hover:bg-dark-300 border border-gray-600 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span>📁</span>
            Select Folder
          </button>
          <button
            onClick={onSelectFiles}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span>📄</span>
            Select Files
          </button>
        </div>

        <p className="text-gray-500 text-sm mt-8">
          Supports .md, .markdown, and .txt files
        </p>
      </div>
    </div>
  );
}

export default FileDropZone;
