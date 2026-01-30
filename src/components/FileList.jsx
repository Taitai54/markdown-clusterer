import React, { useState } from 'react';

function FileList({ files, onRemove }) {
  const [expandedFile, setExpandedFile] = useState(null);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getPreview = (content, maxLength = 200) => {
    const cleaned = content.replace(/^#.*$/gm, '').trim();
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.substring(0, maxLength) + '...';
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {files.map((file, index) => (
          <div
            key={file.path}
            className="file-card bg-dark-100 rounded-xl p-4 border border-gray-700 hover:border-gray-600 cursor-pointer"
            onClick={() => setExpandedFile(expandedFile === index ? null : index)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-blue-900/30 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
                  📝
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-white truncate" title={file.name}>
                    {file.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(index);
                }}
                className="text-gray-500 hover:text-red-400 transition-colors p-1"
                title="Remove file"
              >
                ✕
              </button>
            </div>
            
            <div className={`text-sm text-gray-400 ${expandedFile === index ? '' : 'line-clamp-3'}`}>
              {expandedFile === index ? (
                <pre className="whitespace-pre-wrap font-sans max-h-60 overflow-auto bg-dark-200 p-3 rounded-lg">
                  {file.content.substring(0, 2000)}
                  {file.content.length > 2000 && '...'}
                </pre>
              ) : (
                getPreview(file.content)
              )}
            </div>
            
            {expandedFile !== index && (
              <p className="text-xs text-gray-600 mt-2">Click to expand</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default FileList;
